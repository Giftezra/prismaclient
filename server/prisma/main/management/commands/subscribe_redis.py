from django.core.management.base import BaseCommand
import json
import logging

from main.models import BookedAppointment, BookedAppointmentImage, Notification, User, Address
from main.tasks import send_booking_confirmation_email, send_push_notification
from main.services.NotificationServices import NotificationService
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from main.utils.redis_streams import (
    STREAM_JOB_EVENTS,
    ensure_consumer_group,
    read_group_blocking,
    read_pending,
    ack,
)

logger = logging.getLogger(__name__)

CLIENT_GROUP = "client_group"
CONSUMER_NAME = "subscribe_redis"


class Command(BaseCommand):
    help = "Read from Redis stream job_events (job_acceptance, job_started, job_completed) and process messages."

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.notification_service = NotificationService()

    def handle(self, *args, **options):
        ensure_consumer_group(STREAM_JOB_EVENTS, CLIENT_GROUP)
        self.stdout.write(self.style.SUCCESS("Subscribed to job_events stream (client_group)"))

        channel_layer = get_channel_layer()

        # Process any pending messages from previous run
        for msg_id, fields in read_pending(STREAM_JOB_EVENTS, CLIENT_GROUP, CONSUMER_NAME):
            self._process_message(msg_id, fields, channel_layer)

        try:
            while True:
                entries = read_group_blocking(STREAM_JOB_EVENTS, CLIENT_GROUP, CONSUMER_NAME, block_ms=5000)
                for msg_id, fields in entries:
                    self._process_message(msg_id, fields, channel_layer)
        except KeyboardInterrupt:
            self.stdout.write(self.style.SUCCESS("subscribe_redis stopped"))

    def _process_message(self, msg_id, fields, channel_layer):
        event = fields.get("event")
        raw = fields.get("payload", "{}")
        if event not in ("job_acceptance", "job_started", "job_completed"):
            ack(STREAM_JOB_EVENTS, CLIENT_GROUP, msg_id)
            return
        try:
            data = json.loads(raw)
            if isinstance(data, dict):
                booking_reference = data.get("booking_reference", data)
                detailer_data = data.get("detailer", {})
            else:
                booking_reference = str(data).strip().strip('"').strip("'")
                detailer_data = {}
        except Exception:
            booking_reference = str(raw).strip().strip('"').strip("'")
            detailer_data = {}
            data = {}

        self.stdout.write(f"Received {event}: {booking_reference}")

        try:
            booking = BookedAppointment.objects.get(booking_reference=booking_reference)

            if event == "job_acceptance":
                if detailer_data and detailer_data.get("phone"):
                    from main.models import DetailerProfile
                    from main.util.phone_utils import normalize_phone

                    detailer_name = detailer_data.get("name", "").strip()
                    detailer_phone = detailer_data.get("phone", "").strip()
                    detailer_rating = detailer_data.get("rating", 0.0)
                    normalized_phone = normalize_phone(detailer_phone)
                    if not normalized_phone:
                        self.stderr.write(f"Invalid phone number for detailer: {detailer_name}")
                        ack(STREAM_JOB_EVENTS, CLIENT_GROUP, msg_id)
                        return
                    detailer, created = DetailerProfile.objects.get_or_create(
                        phone=normalized_phone,
                        defaults={"name": detailer_name, "rating": detailer_rating},
                    )
                    if not created and detailer_rating and detailer_rating != detailer.rating:
                        detailer.rating = detailer_rating
                        detailer.save()
                    booking.detailer = detailer
                    self.stdout.write(f"Detailer {detailer.name} assigned to booking {booking_reference}")

                booking.status = "confirmed"
                booking.save()
                self.stdout.write(f"Updated booking {booking_reference} to confirmed")

                if booking.user.allow_email_notifications and booking.detailer:
                    send_booking_confirmation_email.delay(
                        booking.user.email,
                        booking.user.name,
                        booking.booking_reference,
                        booking.vehicle.make,
                        booking.vehicle.model,
                        booking.appointment_date,
                        booking.start_time,
                        booking.service_type.name,
                        booking.valet_type.name,
                        booking.total_amount,
                        booking.detailer.name,
                    )
                send_push_notification.delay(
                    booking.user.id,
                    "Booking Confirmed! 🎉",
                    f"Your valet service is confirmed for {booking.appointment_date} at {booking.start_time}. Your detailer is {booking.detailer.name}",
                    {
                        "type": "booking_confirmed",
                        "booking_reference": booking.booking_reference,
                        "screen": "booking_details",
                    },
                )
                self.create_notification(
                    booking.user,
                    "Booking Confirmed",
                    "booking_confirmed",
                    "success",
                    f"Your booking has been confirmed! Your detailer will be with you at the specified time. Your detailer is {booking.detailer.name}",
                )

            elif event == "job_started":
                before_images = data.get("before_images", []) if isinstance(data, dict) else []
                booking.status = "in_progress"
                booking.save()
                self.stdout.write(f"Updated booking {booking.booking_reference} to in_progress")
                for img_data in before_images:
                    try:
                        BookedAppointmentImage.objects.create(
                            booking=booking,
                            image_type="before",
                            image_url=img_data["image_url"],
                            segment=img_data.get("segment", "exterior"),
                        )
                    except Exception as e:
                        self.stderr.write(f"Error saving before image: {e}")
                send_push_notification.delay(
                    booking.user.id,
                    "Service Started! 🚀",
                    f"Your valet service has started. {booking.detailer.name} is now working on your {booking.vehicle.make} {booking.vehicle.model}",
                    {"type": "appointment_started", "booking_reference": booking.booking_reference, "screen": "booking_details"},
                )
                self.create_notification(
                    booking.user,
                    "Appointment Started",
                    "appointment_started",
                    "success",
                    "Your appointment has been started! You will be notified when it is completed.",
                )

            elif event == "job_completed":
                after_images = data.get("after_images", []) if isinstance(data, dict) else []
                fleet_maintenance_data = data.get("fleet_maintenance") if isinstance(data, dict) else None
                booking.status = "completed"
                booking.save()
                self.stdout.write(f"Updated booking {booking.booking_reference} to completed")
                for img_data in after_images:
                    try:
                        BookedAppointmentImage.objects.create(
                            booking=booking,
                            image_type="after",
                            image_url=img_data["image_url"],
                            segment=img_data.get("segment", "exterior"),
                        )
                    except Exception as e:
                        self.stderr.write(f"Error saving after image: {e}")
                if fleet_maintenance_data:
                    try:
                        from main.models import EventDataManagement
                        EventDataManagement.objects.update_or_create(
                            booking=booking,
                            defaults={
                                "tire_tread_depth": fleet_maintenance_data.get("tire_tread_depth"),
                                "tire_condition": fleet_maintenance_data.get("tire_condition"),
                                "wiper_status": fleet_maintenance_data.get("wiper_status"),
                                "oil_level": fleet_maintenance_data.get("oil_level"),
                                "coolant_level": fleet_maintenance_data.get("coolant_level"),
                                "brake_fluid_level": fleet_maintenance_data.get("brake_fluid_level"),
                                "battery_condition": fleet_maintenance_data.get("battery_condition"),
                                "headlights_status": fleet_maintenance_data.get("headlights_status"),
                                "taillights_status": fleet_maintenance_data.get("taillights_status"),
                                "indicators_status": fleet_maintenance_data.get("indicators_status"),
                                "vehicle_condition_notes": fleet_maintenance_data.get("vehicle_condition_notes"),
                                "damage_report": fleet_maintenance_data.get("damage_report"),
                            },
                        )
                    except Exception as e:
                        self.stderr.write(f"Error saving fleet maintenance: {e}")
                send_push_notification.delay(
                    booking.user.id,
                    "Service Completed! ✨",
                    f"Your valet service has been completed! Thank you for choosing PRISMA VALET.",
                    {"type": "cleaning_completed", "booking_reference": booking.booking_reference, "screen": "service_history"},
                )
                self.create_notification(
                    booking.user,
                    "Appointment Completed",
                    "cleaning_completed",
                    "success",
                    "Your appointment has been completed! Thank you for choosing Prisma.",
                )

            ack(STREAM_JOB_EVENTS, CLIENT_GROUP, msg_id)
        except BookedAppointment.DoesNotExist:
            self.stderr.write(f"Booking not found: {booking_reference}")
            ack(STREAM_JOB_EVENTS, CLIENT_GROUP, msg_id)
        except Exception as e:
            self.stderr.write(f"Processing error: {e}")
            ack(STREAM_JOB_EVENTS, CLIENT_GROUP, msg_id)

    def create_notification(self, user, title, type, status, message):
        try:
            Notification.objects.create(user=user, title=title, type=type, status=status, message=message)
            return True
        except Exception as e:
            self.stderr.write(f"Failed to create notification: {e}")
            return False

    def get_currency_symbol(self, user_id):
        user = User.objects.get(id=user_id)
        address = Address.objects.filter(user=user).first()
        if address and address.country and (address.country == "United Kingdom" or address.country.lower() == "united kingdom"):
            return "£"
        if address and address.country and (address.country == "Ireland" or address.country.lower() == "ireland"):
            return "€"
        return "€"

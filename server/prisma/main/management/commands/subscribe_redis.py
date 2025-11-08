from django.core.management.base import BaseCommand
import redis
from main.models import BookedAppointment, BookedAppointmentImage, Notification, User, Address
from main.tasks import send_booking_confirmation_email, send_push_notification
from main.services.NotificationServices import NotificationService  # Import your service
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
import json
import logging
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = "Subscribe to Redis 'job_acceptance' and 'job_started' channels and process messages."

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.notification_service = NotificationService()  # Initialize notification service

    def handle(self, *args, **options):
        r = redis.Redis(host='prisma_redis', port=6379, db=0, decode_responses=True)
        pubsub = r.pubsub()
        
        # Subscribe to both channels
        pubsub.subscribe('job_acceptance', 'job_started', 'job_completed')
        self.stdout.write(self.style.SUCCESS('Subscribed to job_acceptance, job_started, and job_completed'))

        channel_layer = get_channel_layer()
        
        try:
            for message in pubsub.listen():
                if message.get('type') != 'message':
                    continue
                
                channel = message.get('channel')
                raw = message.get('data')
                
                # Handle quoted JSON string or plain string
                try:
                    data = json.loads(raw)
                    # Check if it's a dict with booking_reference or just a string
                    if isinstance(data, dict):
                        booking_reference = data.get('booking_reference', data)
                        detailer_data = data.get('detailer', {})
                    else:
                        booking_reference = str(data).strip().strip('"').strip("'")
                        detailer_data = {}
                except Exception:
                    booking_reference = str(raw).strip().strip('"').strip("'")
                    detailer_data = {}
                
                self.stdout.write(f"Received on {channel}: {booking_reference}")
                
                try:
                    booking = BookedAppointment.objects.get(booking_reference=booking_reference)
                    
                    if channel == 'job_acceptance':
                        # Handle detailer assignment if detailer data is provided
                        if detailer_data and detailer_data.get('phone'):
                            from main.models import DetailerProfile
                            from main.util.phone_utils import normalize_phone
                            
                            detailer_name = detailer_data.get('name', '').strip()
                            detailer_phone = detailer_data.get('phone', '').strip()
                            detailer_rating = detailer_data.get('rating', 0.0)
                            
                            # Normalize phone number to prevent duplicates
                            normalized_phone = normalize_phone(detailer_phone)
                            
                            if not normalized_phone:
                                self.stderr.write(f"Invalid phone number for detailer: {detailer_name}")
                                continue
                            
                            # Get or create detailer profile (with deduplication using normalized phone)
                            detailer, created = DetailerProfile.objects.get_or_create(
                                phone=normalized_phone,
                                defaults={
                                    'name': detailer_name,
                                    'rating': detailer_rating
                                }
                            )
                            
                            if not created and detailer_rating and detailer_rating != detailer.rating:
                                # Update rating if different
                                detailer.rating = detailer_rating
                                detailer.save()
                                self.stdout.write(f"Detailer rating updated: {detailer.name} (rating: {detailer.rating})")
                            else:
                                self.stdout.write(f"Detailer {'created' if created else 'found'}: {detailer.name} (phone: {normalized_phone})")
                            
                            # Assign detailer to booking
                            booking.detailer = detailer
                            self.stdout.write(f"Detailer {detailer.name} assigned to booking {booking_reference}")
                        
                        booking.status = 'confirmed'
                        booking.save()
                        self.stdout.write(f"Updated booking {booking_reference} to confirmed")
                        
                        # Check if the user has email notifications enabled
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
                        
                        
                        # Send push notification (NEW)
                        send_push_notification.delay(
                            booking.user.id,
                            "Booking Confirmed! 🎉",
                            f"Your valet service is confirmed for {booking.appointment_date} at {booking.start_time}. Your detailer is {booking.detailer.name}",
                            {
                                "type": "booking_confirmed",
                                "booking_reference": booking.booking_reference,
                                "booking_reference": booking.booking_reference,
                                "screen": "booking_details"
                            }
                        )
                        

                        # Create notification (existing)
                        self.create_notification(
                            booking.user,
                            'Booking Confirmed',
                            'booking_confirmed',
                            'success',
                            f'Your booking has been confirmed! Your detailer will be with you at the specified time. Your detailer is {booking.detailer.name}'
                        )
                        
                    elif channel == 'job_started':
                        # Parse message data (now includes before_images)
                        if isinstance(data, str):
                            try:
                                message_data = json.loads(data)
                                booking_reference = message_data.get('booking_reference', data)
                                before_images = message_data.get('before_images', [])
                            except json.JSONDecodeError:
                                # Fallback to old format (just booking reference)
                                booking_reference = data
                                before_images = []
                        else:
                            booking_reference = data.get('booking_reference', str(data))
                            before_images = data.get('before_images', [])
                        
                        # Update status to in_progress
                        booking.status = 'in_progress'
                        booking.save()
                        self.stdout.write(f"Updated booking {booking_reference} to in_progress")

                        # Save before images
                        for img_data in before_images:
                            try:
                                BookedAppointmentImage.objects.create(
                                    booking=booking,
                                    image_type='before',
                                    image_url=img_data['image_url']
                                )
                                self.stdout.write(f"Saved before image for booking {booking_reference}")
                            except Exception as e:
                                self.stderr.write(f"Error saving before image: {e}")

                        # Send push notification (NEW)
                        send_push_notification.delay(
                            booking.user,
                            "Service Started! 🚀",
                            f"Your valet service has started. {booking.detailer.name} is now working on your {booking.vehicle.make} {booking.vehicle.model}",
                            {
                                "type": "appointment_started",
                                "booking_reference": booking.booking_reference,
                                "booking_reference": booking.booking_reference,
                                "screen": "booking_details"
                            }
                        )

                        # Create notification (existing)
                        self.create_notification(
                            booking.user,
                            'Appointment Started',
                            'appointment_started',
                            'success',
                            'Your appointment has been started! You will be notified when it is completed.'
                        )

                    elif channel == 'job_completed':
                        # Parse message data (includes after_images)
                        # Note: before_images are saved when job_started is received
                        if isinstance(data, str):
                            try:
                                message_data = json.loads(data)
                                booking_reference = message_data.get('booking_reference', data)
                                after_images = message_data.get('after_images', [])
                            except json.JSONDecodeError:
                                # Fallback to old format (just booking reference)
                                booking_reference = data
                                after_images = []
                        else:
                            booking_reference = data.get('booking_reference', str(data))
                            after_images = data.get('after_images', [])
                        
                        # Update status to completed
                        booking.status = 'completed'
                        booking.save()
                        self.stdout.write(f"Updated booking {booking_reference} to completed")

                        # Save after images
                        for img_data in after_images:
                            try:
                                BookedAppointmentImage.objects.create(
                                    booking=booking,
                                    image_type='after',
                                    image_url=img_data['image_url']
                                )
                                self.stdout.write(f"Saved after image for booking {booking_reference}")
                            except Exception as e:
                                self.stderr.write(f"Error saving after image: {e}")

                        # Send push notification (NEW)
                        send_push_notification.delay(
                            booking.user.id,
                            "Service Completed! ✨",
                            f"Your valet service has been completed! Thank you for choosing PRISMA VALET. Total: {self.get_currency_symbol(booking.user.id)}{booking.total_amount}",
                            {
                                "type": "cleaning_completed",
                                "booking_reference": booking.booking_reference,
                                "booking_reference": booking.booking_reference,
                                "screen": "service_history"
                            }
                        )


                        # Create notification (existing)
                        self.create_notification(
                            booking.user,
                            'Appointment Completed',
                            'cleaning_completed',
                            'success',
                            'Your appointment has been completed! Thank you for choosing Prisma.'
                        )
                        
                except BookedAppointment.DoesNotExist:
                    self.stderr.write(f"Booking not found: {booking_reference}")
                except Exception as e:
                    self.stderr.write(f"Processing error: {e}")
                    
        finally:
            pubsub.close()




    def create_notification(self, user, title, type, status, message):
        """Create a notification (existing method)"""
        try:
            Notification.objects.create(
                user=user,
                title=title,
                type=type,
                status=status,
                message=message
            )
        except Exception as e:
            self.stderr.write(f"Failed to create notification: {e}")
            return False
        return True


    def get_currency_symbol(self, user_id):
        user = User.objects.get(id=user_id)
        address = Address.objects.get(user=user).first()
        if address.country == 'United Kingdom' or address.country == 'united kingdom':
            return '£'
        elif address.country == 'Ireland' or address.country == 'ireland':
            return '€'
        else:
            return '€'


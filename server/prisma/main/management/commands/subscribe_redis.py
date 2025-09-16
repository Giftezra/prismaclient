from django.core.management.base import BaseCommand
import redis
from main.models import BookedAppointment, Notification
from main.tasks import send_booking_confirmation_email
from main.services.NotificationServices import NotificationService  # Import your service
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
import json
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
                    booking_reference = json.loads(raw)
                except Exception:
                    booking_reference = str(raw).strip().strip('"').strip("'")
                
                self.stdout.write(f"Received on {channel}: {booking_reference}")
                
                try:
                    booking = BookedAppointment.objects.get(booking_reference=booking_reference)
                    
                    if channel == 'job_acceptance':
                        # Update status to confirmed
                        booking.status = 'confirmed'
                        booking.save()
                        self.stdout.write(f"Updated booking {booking_reference} to confirmed")
                        
                        # Chjeck if the user has email notifications enabled
                        if booking.user.allow_email_notifications:
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
                        self.send_push_notification(
                            booking.user,
                            "Booking Confirmed! 🎉",
                            f"Your valet service is confirmed for {booking.appointment_date} at {booking.start_time}",
                            {
                                "type": "booking_confirmed",
                                "booking_reference": booking.booking_reference,
                                "booking_reference": booking.booking_reference,
                                "screen": "booking_details"
                            }
                        )
                        
                        # # Send websocket notification (existing)
                        # self.send_websocket_notification(
                        #     channel_layer,
                        #     booking.user.id, 
                        #     booking.booking_reference, 
                        #     'confirmed', 
                        #     'Your booking has been confirmed! Your detailer will be with you at the specified time.'
                        # )

                        # Create notification (existing)
                        self.create_notification(
                            booking.user,
                            'Booking Confirmed',
                            'booking_confirmed',
                            'success',
                            'Your booking has been confirmed! Your detailer will be with you at the specified time.'
                        )
                        
                    elif channel == 'job_started':
                        # Update status to in_progress
                        booking.status = 'in_progress'
                        booking.save()
                        self.stdout.write(f"Updated booking {booking_reference} to in_progress")

                        # Send push notification (NEW)
                        self.send_push_notification(
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

                        # # Send websocket notification (existing)
                        # self.send_websocket_notification(
                        #     channel_layer,
                        #     booking.user.id, 
                        #     booking.booking_reference, 
                        #     'in_progress', 
                        #     'Your booking has been started! Your detailer will be with you at the specified time.'
                        # )

                        # Create notification (existing)
                        self.create_notification(
                            booking.user,
                            'Appointment Started',
                            'appointment_started',
                            'success',
                            'Your appointment has been started! You will be notified when it is completed.'
                        )

                    elif channel == 'job_completed':
                        # Update status to completed
                        booking.status = 'completed'
                        booking.save()
                        self.stdout.write(f"Updated booking {booking_reference} to completed")

                        # Send push notification (NEW)
                        self.send_push_notification(
                            booking.user,
                            "Service Completed! ✨",
                            f"Your valet service has been completed! Thank you for choosing PRISMA VALET. Total: ${booking.total_amount}",
                            {
                                "type": "cleaning_completed",
                                "booking_reference": booking.booking_reference,
                                "booking_reference": booking.booking_reference,
                                "screen": "service_history"
                            }
                        )

                        # # Send websocket notification (existing)
                        # self.send_websocket_notification(
                        #     channel_layer,
                        #     booking.user.id, 
                        #     booking.booking_reference, 
                        #     'completed', 
                        #     'Your appointment has been completed! Thank you for choosing Prisma.'
                        # )

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



    def send_push_notification(self, user, title, body, data=None):
        """Send push notification directly using PushClient (same as tasks.py)"""
        try:
            # Check if user has push notifications enabled and has a token
            if not user.allow_push_notifications:
                self.stdout.write(f"Push notifications disabled for user {user.id}")
                return False
                
            if not user.notification_token:
                self.stdout.write(f"No notification token for user {user.id}")
                return False
            
            # Import here to avoid any import issues
            from exponent_server_sdk import PushClient, PushMessage
            
            # Send the notification using the correct publish method
            push_client = PushClient()
            response = push_client.publish(
                PushMessage(
                    to=user.notification_token, 
                    title=title, 
                    body=body,
                    data=data or {}
                )
            )
            response.validate_response()
            
            self.stdout.write(f"Push notification sent to user {user.id}: {title}")
            return True
            
        except Exception as e:
            self.stderr.write(f"Failed to send push notification to user {user.id}: {e}")
            logger.error(f"Push notification error for user {user.id}: {str(e)}")
            return False


    def send_websocket_notification(self, channel_layer, user_id, booking_reference, status, message):
        """Send a websocket notification to the user (existing method)"""
        try:
            async_to_sync(channel_layer.group_send)(
                f"client_{user_id}",
                {
                    'type': 'status_update',
                    'booking_reference': booking_reference,
                    'status': status,
                    'message': message
                }
            )
            self.stdout.write(f"Websocket notification sent to {user_id}")
        except Exception as e:
            self.stderr.write(f"Failed to send websocket notification: {e}")
            return False
        return True



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

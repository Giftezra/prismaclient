from django.core.management.base import BaseCommand
import redis
from main.models import BookedAppointment, Notification
from main.tasks import send_booking_confirmation_email
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
import json

class Command(BaseCommand):
    help = "Subscribe to Redis 'job_acceptance' and 'job_started' channels and process messages."

    def handle(self, *args, **options):
        r = redis.Redis(host='prisma_redis', port=6379, db=0, decode_responses=True)
        pubsub = r.pubsub()
        
        # Subscribe to both channels
        pubsub.subscribe('job_acceptance', 'job_started', 'job_completed')
        self.stdout.write(self.style.SUCCESS('Subscribed to job_acceptance and job_started and job_completed'))

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
                        # Update status to confirmed and send confirmation email
                        booking.status = 'confirmed'
                        booking.save()
                        self.stdout.write(f"Updated booking {booking_reference} to confirmed")
                        
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
                        # # Send websocket notification
                        self.send_websocket_notification(
                            channel_layer,
                            booking.user.id, 
                            booking.booking_reference, 
                            'confirmed', 'Your booking has been confirmed! Your detailer will be with you at the specified time.')

                        # Create notification
                        self.create_notification(
                            booking.user,
                            'Booking Confirmed',
                            'booking_confirmed',
                            'success',
                            'Your booking has been confirmed! Your detailer will be with you at the specified time.')
                        

                        
                    elif channel == 'job_started':
                        # Update status to in_progress
                        booking.status = 'in_progress'
                        booking.save()
                        self.stdout.write(f"Updated booking {booking_reference} to in_progress")

                        # # Send websocket notification
                        self.send_websocket_notification(
                            channel_layer,
                            booking.user.id, 
                            booking.booking_reference, 
                            'in_progress', 'Your booking has been started! Your detailer will be with you at the specified time.')

                        # Create notification
                        self.create_notification(
                            booking.user,
                            'Appointment Started',
                            'appointment_started',
                            'success',
                            'Your appointment has been started! You will be notified when it is completed.')

                    elif channel == 'job_completed':
                        # Update status to completed
                        booking.status = 'completed'
                        booking.save()
                        self.stdout.write(f"Updated booking {booking_reference} to completed")

                        # # Send websocket notification
                        self.send_websocket_notification(
                            channel_layer,
                            booking.user.id, 
                            booking.booking_reference, 
                            'completed', 'Your appointment has been completed! Thank you for choosing Prisma.')

                        # Create notification
                        self.create_notification(
                            booking.user,
                            'Appointment Completed',
                            'cleaning_completed',
                            'success',
                            'Your appointment has been completed! Thank you for choosing Prisma.')
                        
                except BookedAppointment.DoesNotExist:
                    self.stderr.write(f"Booking not found: {booking_reference}")
                except Exception as e:
                    self.stderr.write(f"Processing error: {e}")
                    
        finally:
            pubsub.close()

    def send_websocket_notification(self, channel_layer, user_id, booking_reference, status, message):
        """ Send a websocket notification to the user """
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
        """ Create a notification """
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

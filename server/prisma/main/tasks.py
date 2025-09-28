from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from .util.graph_mail import send_mail as graph_send_mail
import os
import redis
from main.models import BookedAppointment
import json
from datetime import timedelta
from django.utils import timezone
from exponent_server_sdk import PushClient, PushMessage


@shared_task
def send_welcome_email(user_email):
    subject = "Welcome to Prisma - Let's Get Started! 🎉"
    html_message = render_to_string('welcome_email.html')
    try:
        graph_send_mail(subject, html_message, user_email)
        return f"Welcome email sent successfully to {user_email}"
    except Exception as e:
        return f"Failed to send welcome email: {str(e)}"


@shared_task
def send_booking_confirmation_email(user_email, customer_name, booking_reference, vehicle_make, vehicle_model, booking_date, start_time, service_type_name, valet_type_name, total_cost, detailer_name):
    subject = f'Booking Confirmation - #{booking_reference}'
    html_message = render_to_string('booking_confirmation.html', {
        'customer_name':customer_name,
        'booking_reference': booking_reference,
        'vehicle_make': vehicle_make,
        'vehicle_model': vehicle_model,
        'booking_date': booking_date.strftime('%B %d, %Y') if booking_date else '',
        'start_time': start_time.strftime('%I:%M %p') if start_time else '',
        'service_type_name': service_type_name,
        'valet_type_name': valet_type_name,
        'total_cost': total_cost,
        'detailer_name': detailer_name
    })
    try:
        graph_send_mail(subject, html_message, user_email)
        return f"Booking confirmation email sent successfully to {user_email}"
    except Exception as e:
        return f"Failed to send booking confirmation email: {str(e)}"


@shared_task
def send_promotional_email(user_email, customer_name):
    subject = f'Promotional Email - 10% Off Your Next Washes'
    html_message = render_to_string('promotional_email.html', {
        'customer_name': customer_name,
    })
    try:
        graph_send_mail(subject, html_message, user_email)
        return f"Promotional email sent successfully to {user_email}"
    except Exception as e:
        return f"Failed to send promotional email: {str(e)}"


@shared_task
def publish_booking_cancelled(booking_reference):
    print(f"DEBUG: publish_booking_cancelled called with booking_reference: {booking_reference}")
    try:
        r = redis.Redis(host='prisma_redis', port=6379, db=0)
        channel = 'booking_cancelled'
        message = json.dumps({
            'booking_reference': booking_reference  # Send as object, not just string
        })
        result = r.publish(channel, message)
        print(f"DEBUG: publish_booking_cancelled result: {result}")
        return f"Booking cancelled published to redis: {result}"
    except Exception as e:
        print(f"DEBUG: publish_booking_cancelled error: {str(e)}")
        return f"Failed to publish booking cancelled to redis: {str(e)}"


@shared_task
def publish_booking_rescheduled(booking_reference, new_date, new_time, total_cost):
    print(f"DEBUG: publish_booking_rescheduled called with booking_reference: {booking_reference}")
    try:
        r = redis.Redis(host='prisma_redis', port=6379, db=0)
        channel = 'booking_rescheduled'
        message = json.dumps({
            'booking_reference': booking_reference,
            'new_appointment_date': new_date,  # Changed from 'new_date'
            'new_appointment_time': new_time,  # Changed from 'new_time'
            'total_amount': total_cost         # Changed from 'total_cost'
        })
        result = r.publish(channel, message)
        print(f"DEBUG: publish_booking_rescheduled result: {result}")
        return f"Booking rescheduled published to redis: {result}"
    except Exception as e:
        print(f"DEBUG: publish_booking_rescheduled error: {str(e)}")
        return f"Failed to publish booking rescheduled to redis: {str(e)}"


@shared_task
def send_service_reminders():
    from main.models import BookedAppointment

    # Get appointments starting in the next 30 minutes
    now = timezone.now()
    reminder_start = now + timedelta(minutes=25)  # 25 minutes from now
    reminder_end = now + timedelta(minutes=35)    # 35 minutes from now
    
    try:
        # Get appointments that start between 25-35 minutes from now
        # This ensures we catch all appointments in the 30-minute window
        appointments = BookedAppointment.objects.filter(
            appointment_date=now.date(),
            start_time__gte=reminder_start.time(),
            start_time__lte=reminder_end.time(),
            status='confirmed'
        )
        
        print(f"Found {appointments.count()} appointments for reminder")
        
        for appointment in appointments:
            # Send push notification directly using the task
            send_push_notification.delay(
                appointment.user.id,
                "Service Reminder ⏰",
                f"Your {appointment.service_type.name} service is starting in 30 minutes at {appointment.start_time}",
                "service_reminder"
            )
            print(f"Service reminder sent successfully for appointment {appointment.booking_reference}")
        
        return f"Processed {appointments.count()} appointments for reminders"
        
    except Exception as e:
        print(f"Error sending service reminder: {str(e)}")
        return f"Failed to send service reminder: {str(e)}"


@shared_task
def send_push_notification(user_id, title, message, type):
    """ Send a push notification to the user """
    try:
        from main.models import User
        user = User.objects.get(id=user_id)
        
        # Check if user has notification token
        if not user.notification_token:
            return f"Push notification not sent: User {user_id} has no notification token"
        
        # Check if user has allowed push notifications
        if not user.allow_push_notifications:
            return f"Push notification not sent: User {user_id} has disabled push notifications"
        
        # Send the notification
        push_client = PushClient()
        response = push_client.publish(
            PushMessage(
                to=user.notification_token, 
                title=title, 
                body=message,
                data={
                    "type": type,
                    "title": title,
                    "body": message
                }
            )
        )
        
        # Check if the response indicates success
        if response and hasattr(response, 'data') and response.data:
            return f"Push notification sent successfully to user {user_id}"
        else:
            return f"Push notification failed for user {user_id}: Invalid response"
        
    except Exception as e:
        error_msg = f"Failed to send push notification to user {user_id}: {str(e)}"
        print(error_msg)
        return error_msg


@shared_task
def publish_review_to_detailer(booking_reference, rating, tip_amount):
    """Publish review data to Redis for detailer app"""
    try:
        print(f"DEBUG: publish_review_to_detailer called with booking_reference: {booking_reference}")
        r = redis.Redis(host='prisma_redis', port=6379, db=0, decode_responses=True)
        channel = 'review_received'
        message = json.dumps({
            'booking_reference': booking_reference,
            'rating': rating,
            'tip_amount': tip_amount
        })
        result = r.publish(channel, message)
        print(f"DEBUG: publish_review_to_detailer result: {result}")
        return f"Review published to detailer: {result}"
    except Exception as e:
        print(f"Failed to publish review to detailer: {e}")
        return f"Failed to publish review to detailer: {e}"
        
        

@shared_task
def cleanup_job_chat(chat_room_id):
    """Clean up chat messages after job completion"""
    try:
        from main.models import JobChatRoom, JobChatMessage
        from django.utils import timezone
        from datetime import timedelta
        
        # Wait 24 hours before cleanup to allow for reviews
        cleanup_time = timezone.now() + timedelta(hours=24)
        
        # Schedule the actual cleanup
        cleanup_job_chat_messages.apply_async(
            args=[chat_room_id],
            eta=cleanup_time
        )
        
        return f"Chat cleanup scheduled for room {chat_room_id}"
    except Exception as e:
        return f"Failed to schedule chat cleanup: {e}"


@shared_task
def cleanup_job_chat_messages(chat_room_id):
    """Actually delete chat messages"""
    try:
        from main.models import JobChatRoom, JobChatMessage
        
        chat_room = JobChatRoom.objects.get(id=chat_room_id)
        
        # Delete all messages
        message_count = JobChatMessage.objects.filter(room=chat_room).count()
        JobChatMessage.objects.filter(room=chat_room).delete()
        
        # Delete the chat room
        chat_room.delete()
        
        return f"Cleaned up {message_count} messages from room {chat_room_id}"
    except Exception as e:
        return f"Failed to cleanup chat room {chat_room_id}: {e}"      



@shared_task
def create_job_chat_room(booking_id):
    """Create a chat room for a specific booking"""
    try:
        from .models import BookedAppointment, JobChatRoom
        from django.utils import timezone
        
        # Get the booking
        booking = BookedAppointment.objects.get(id=booking_id)
        
        # Check if booking is still confirmed and not completed/cancelled
        if booking.status not in ['confirmed', 'scheduled', 'in_progress']:
            print(f"Booking {booking.booking_reference} is no longer active, skipping chat room creation")
            return f"Booking {booking.booking_reference} is no longer active"
        
        # Check if chat room already exists
        if JobChatRoom.objects.filter(booking=booking).exists():
            print(f"Chat room already exists for booking {booking.booking_reference}")
            return f"Chat room already exists for booking {booking.booking_reference}"
        
        # Create the chat room
        chat_room = JobChatRoom.objects.create(
            booking=booking,
            client=booking.user,
            detailer=booking.detailer,
            is_active=True
        )
        
        print(f"Chat room created for booking {booking.booking_reference}")
        
        # Send notification to both client and detailer
        send_push_notification.delay(
            booking.user.id,
            "Chat Available 💬",
            f"Chat is now available for your upcoming {booking.service_type.name} service",
            "chat_available"
        )
        
        # You could also send a notification to the detailer here
        # if they have a user account and notification preferences
        
        return f"Chat room created successfully for booking {booking.booking_reference}"
        
    except BookedAppointment.DoesNotExist:
        return f"Booking with ID {booking_id} not found"
    except Exception as e:
        return f"Failed to create chat room: {str(e)}"


@shared_task
def send_refund_success_email(user_email, customer_name, booking_reference, original_date, vehicle_make, vehicle_model, service_type_name, refund_amount, refund_date):
    """Send refund success email to user when refund is processed"""
    subject = f'Refund Processed Successfully - #{booking_reference}'
    html_message = render_to_string('refund_success_email.html', {
        'customer_name': customer_name,
        'booking_reference': booking_reference,
        'original_date': original_date.strftime('%B %d, %Y') if original_date else '',
        'vehicle_make': vehicle_make,
        'vehicle_model': vehicle_model,
        'service_type_name': service_type_name,
        'refund_amount': refund_amount,
        'refund_date': refund_date.strftime('%B %d, %Y at %I:%M %p') if refund_date else timezone.now().strftime('%B %d, %Y at %I:%M %p')
    })
    try:
        graph_send_mail(subject, html_message, user_email)
        return f"Refund success email sent successfully to {user_email}"
    except Exception as e:
        return f"Failed to send refund success email: {str(e)}"


@shared_task
def send_refund_failed_email(user_email, customer_name, booking_reference, original_date, vehicle_make, vehicle_model, service_type_name, refund_amount, failure_reason):
    """Send refund failed email to user when refund processing fails"""
    subject = f'Refund Issue - Action Required - #{booking_reference}'
    html_message = render_to_string('refund_failed_email.html', {
        'customer_name': customer_name,
        'booking_reference': booking_reference,
        'original_date': original_date.strftime('%B %d, %Y') if original_date else '',
        'vehicle_make': vehicle_make,
        'vehicle_model': vehicle_model,
        'service_type_name': service_type_name,
        'refund_amount': refund_amount,
        'issue_date': timezone.now().strftime('%B %d, %Y at %I:%M %p')
    })
    try:
        graph_send_mail(subject, html_message, user_email)
        return f"Refund failed email sent successfully to {user_email}"
    except Exception as e:
        return f"Failed to send refund failed email: {str(e)}"


@shared_task
def send_password_reset_email(user_email, user_name, reset_token):
    subject = "Reset Your Prisma Password"
    
    # Get base URL from settings
    from django.conf import settings
    base_url = getattr(settings, 'BASE_URL', 'https://yourdomain.com')
    
    # Web URL that works for everyone - note the /api/v1/ prefix
    web_reset_url = f"{base_url}/api/v1/auth/web-reset-password/?token={reset_token}"
    
    html_message = render_to_string('password_reset_email.html', {
        'user_name': user_name,
        'web_reset_url': web_reset_url,
        'expires_in': '1 hour'
    })
    
    try:
        graph_send_mail(subject, html_message, user_email)
        return f"Password reset email sent successfully to {user_email}"
    except Exception as e:
        return f"Failed to send password reset email: {str(e)}"


@shared_task
def send_promotion_expiration():
    """Send a notification to all users with promotions expiring in the next 24 hours"""
    from main.models import Promotions
    from django.utils import timezone
    from datetime import timedelta

    
    now = timezone.now()
    tomorrow = now + timedelta(days=1)
    
    try:
        # Get all active promotions that expire in the next 24 hours
        expiring_promotions = Promotions.objects.filter(
            is_active=True,
            is_used=False,
            valid_until__gte=now.date(),
            valid_until__lte=tomorrow.date()
        ).select_related('user')
        notifications_sent = 0
        
        for promotion in expiring_promotions:
            user = promotion.user
            
            # Send push notification if user allows it and has a token
            if user.allow_push_notifications and user.notification_token:
                send_push_notification.delay(
                    user.id,
                    "Promotion Expiring Soon ⏰",
                    f"Your {promotion.title} ({promotion.discount_percentage}% off) expires tomorrow! Don't miss out on this great deal.",
                    "promotion_expiring"
                )
                notifications_sent += 1
            
            # Create in-app notification record
            from main.models import Notification
            Notification.objects.create(
                user=user,
                title="Promotion Expiring Soon ⏰",
                message=f"Your {promotion.title} ({promotion.discount_percentage}% off) expires tomorrow! Book now to take advantage of this offer.",
                type='warning',
                status='active'
            )
        
        return f"Promotion expiration notifications processed: {notifications_sent} push notifications sent for {expiring_promotions.count()} expiring promotions"
        
    except Exception as e:
        return f"Failed to send promotion expiration notifications: {str(e)}"
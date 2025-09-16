from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from .util.graph_mail import send_mail as graph_send_mail
import os
import redis
from main.models import BookedAppointment
import json
from main.services.NotificationServices import NotificationService
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
    notification_service = NotificationService()

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
            notification_results = notification_service.send_service_reminder(appointment.user, appointment)
            if notification_results['errors']:
                print(f"Error sending service reminder: {notification_results['errors']}")
            else:
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
        push_client.publish(
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
        return f"Push notification sent successfully to user {user_id}"
        
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
        
        
        


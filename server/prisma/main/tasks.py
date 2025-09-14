from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from .util.graph_mail import send_mail as graph_send_mail
import os
import redis
from main.models import BookedAppointment
import json


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



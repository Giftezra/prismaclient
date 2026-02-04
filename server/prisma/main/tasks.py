from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from .util.graph_mail import send_mail as graph_send_mail
import os
import json
from main.models import BookedAppointment
from main.utils.redis_streams import stream_add, STREAM_JOB_EVENTS
from datetime import timedelta
from django.utils import timezone
from django.utils.dateparse import parse_datetime
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
    try:
        payload = json.dumps({'booking_reference': booking_reference})
        msg_id = stream_add(STREAM_JOB_EVENTS, {'event': 'booking_cancelled', 'payload': payload})
        return f"Booking cancelled published to stream: {msg_id}"
    except Exception as e:
        print(f"DEBUG: publish_booking_cancelled error: {str(e)}")
        return f"Failed to publish booking cancelled to redis: {str(e)}"


@shared_task
def publish_booking_rescheduled(booking_reference, new_date, new_time, total_cost):
    try:
        payload = json.dumps({
            'booking_reference': booking_reference,
            'new_appointment_date': new_date,
            'new_appointment_time': new_time,
            'total_amount': total_cost,
        })
        msg_id = stream_add(STREAM_JOB_EVENTS, {'event': 'booking_rescheduled', 'payload': payload})
        return f"Booking rescheduled published to stream: {msg_id}"
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
    """Publish review data to Redis stream for detailer app"""
    try:
        payload = json.dumps({
            'booking_reference': booking_reference,
            'rating': rating,
            'tip_amount': tip_amount,
        })
        msg_id = stream_add(STREAM_JOB_EVENTS, {'event': 'review_received', 'payload': payload})
        return f"Review published to detailer: {msg_id}"
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


@shared_task
def check_loyalty_decay():
    """Reset loyalty for users inactive for 60+ days"""
    from django.utils import timezone
    from datetime import timedelta
    from main.models import LoyaltyProgram, Notification
    
    sixty_days_ago = timezone.now().date() - timedelta(days=60)
    
    try:
        # Find users with last booking > 60 days ago
        inactive_loyalties = LoyaltyProgram.objects.filter(
            last_booking_date__lt=sixty_days_ago,
            completed_bookings__gt=0
        ).select_related('user')
        
        reset_count = 0
        for loyalty in inactive_loyalties:
            user = loyalty.user
            old_tier = loyalty.current_tier
            
            # Reset loyalty
            loyalty.completed_bookings = 0
            loyalty.current_tier = 'bronze'
            loyalty.save()
            reset_count += 1
            
            # Send notification to user about loyalty reset
            if user.allow_push_notifications and user.notification_token:
                send_push_notification.delay(
                    user.id,
                    "Loyalty Tier Reset",
                    f"Your loyalty tier has been reset to Bronze due to 60 days of inactivity. Book a service to start earning points again!",
                    "loyalty_reset"
                )
            
            # Create in-app notification
            Notification.objects.create(
                user=user,
                title="Loyalty Tier Reset",
                message=f"Your loyalty tier has been reset from {old_tier.title()} to Bronze due to 60 days of inactivity. Book a service to start earning points again!",
                type='info',
                status='info'
            )
        
        return f"Reset {reset_count} inactive loyalty accounts"
        
    except Exception as e:
        return f"Failed to check loyalty decay: {str(e)}"


@shared_task
def cleanup_expired_pending_bookings():
    """Clean up expired pending bookings (older than 24 hours)"""
    from main.models import PendingBooking
    from django.utils import timezone
    
    try:
        expired_bookings = PendingBooking.objects.filter(
            expires_at__lt=timezone.now(),
            payment_status__in=['pending', 'failed']
        )
        
        count = expired_bookings.count()
        expired_bookings.delete()
        
        print(f"Cleaned up {count} expired pending bookings")
        return f"Cleaned up {count} expired pending bookings"
    except Exception as e:
        print(f"Failed to cleanup expired pending bookings: {str(e)}")
        return f"Failed to cleanup expired pending bookings: {str(e)}"


@shared_task
def send_transfer_request_email(transfer_id, owner_email, requester_name, vehicle_registration):
    """Send email to current owner requesting vehicle transfer consent"""
    from main.models import VehicleTransfer
    from django.conf import settings
    
    try:
        transfer = VehicleTransfer.objects.get(id=transfer_id)
        base_url = getattr(settings, 'BASE_URL', 'https://yourdomain.com')
        
        # Create approval and rejection URLs (web views)
        approve_url = f"{base_url}/api/v1/garage/web-transfer-action/{transfer_id}/?action=approve"
        reject_url = f"{base_url}/api/v1/garage/web-transfer-action/{transfer_id}/?action=reject"
        
        subject = f"Vehicle Transfer Request - {vehicle_registration}"
        html_message = render_to_string('vehicle_transfer_request.html', {
            'owner_name': transfer.from_owner.name,
            'requester_name': requester_name,
            'vehicle_registration': vehicle_registration,
            'vehicle_make': transfer.vehicle.make,
            'vehicle_model': transfer.vehicle.model,
            'vehicle_year': transfer.vehicle.year,
            'approve_url': approve_url,
            'reject_url': reject_url,
            'expires_at': transfer.expires_at.strftime('%B %d, %Y at %I:%M %p'),
        })
        
        graph_send_mail(subject, html_message, owner_email)
        return f"Transfer request email sent successfully to {owner_email}"
    except VehicleTransfer.DoesNotExist:
        return f"Transfer {transfer_id} not found"
    except Exception as e:
        return f"Failed to send transfer request email: {str(e)}"


@shared_task
def send_transfer_approved_email(transfer_id, requester_email, owner_name, vehicle_registration):
    """Send email to requester when transfer is approved"""
    from main.models import VehicleTransfer
    
    try:
        transfer = VehicleTransfer.objects.get(id=transfer_id)
        
        subject = f"Vehicle Transfer Approved - {vehicle_registration}"
        html_message = render_to_string('vehicle_transfer_approved.html', {
            'requester_name': transfer.to_owner.name,
            'owner_name': owner_name,
            'vehicle_registration': vehicle_registration,
            'vehicle_make': transfer.vehicle.make,
            'vehicle_model': transfer.vehicle.model,
            'vehicle_year': transfer.vehicle.year,
            'transfer_date': transfer.responded_at.strftime('%B %d, %Y at %I:%M %p') if transfer.responded_at else '',
        })
        
        graph_send_mail(subject, html_message, requester_email)
        return f"Transfer approved email sent successfully to {requester_email}"
    except VehicleTransfer.DoesNotExist:
        return f"Transfer {transfer_id} not found"
    except Exception as e:
        return f"Failed to send transfer approved email: {str(e)}"


@shared_task
def send_transfer_rejected_email(transfer_id, requester_email, owner_name, vehicle_registration):
    """Send email to requester when transfer is rejected"""
    from main.models import VehicleTransfer
    
    try:
        transfer = VehicleTransfer.objects.get(id=transfer_id)
        
        subject = f"Vehicle Transfer Request Rejected - {vehicle_registration}"
        html_message = render_to_string('vehicle_transfer_rejected.html', {
            'requester_name': transfer.to_owner.name,
            'owner_name': owner_name,
            'vehicle_registration': vehicle_registration,
            'vehicle_make': transfer.vehicle.make,
            'vehicle_model': transfer.vehicle.model,
            'vehicle_year': transfer.vehicle.year,
        })
        
        graph_send_mail(subject, html_message, requester_email)
        return f"Transfer rejected email sent successfully to {requester_email}"
    except VehicleTransfer.DoesNotExist:
        return f"Transfer {transfer_id} not found"
    except Exception as e:
        return f"Failed to send transfer rejected email: {str(e)}"


@shared_task
def expire_old_transfers():
    """Expire transfer requests that are older than 7 days"""
    from main.models import VehicleTransfer
    
    try:
        now = timezone.now()
        expired_transfers = VehicleTransfer.objects.filter(
            status='pending',
            expires_at__lt=now
        )
        
        count = expired_transfers.count()
        expired_transfers.update(status='expired', responded_at=now)
        
        # Send notifications to requesters about expired transfers
        for transfer in expired_transfers:
            if transfer.to_owner.allow_push_notifications and transfer.to_owner.notification_token:
                send_push_notification.delay(
                    transfer.to_owner.id,
                    "Transfer Request Expired",
                    f"Your transfer request for {transfer.vehicle.registration_number} has expired. You can submit a new request.",
                    "transfer_expired"
                )
        
        return f"Expired {count} transfer requests"
    except Exception as e:
        return f"Failed to expire old transfers: {str(e)}"


@shared_task
def send_trial_ending_soon_email(user_email, fleet_name, trial_end_date, plan_name, billing_amount):
    """Send email notification 7 days before trial ends"""
    try:
        from datetime import datetime
        
        subject = "Your trial ends in 7 days - Prisma Fleet Subscription"
        
        # Parse trial end date if it's a string
        if isinstance(trial_end_date, str):
            trial_end_dt = parse_datetime(trial_end_date)
        else:
            trial_end_dt = trial_end_date
        
        # Calculate billing start date (day after trial ends)
        if trial_end_dt:
            billing_start_date = trial_end_dt + timedelta(days=1)
        else:
            billing_start_date = None
        
        html_message = render_to_string('trial_ending_soon.html', {
            'fleet_name': fleet_name,
            'trial_end_date': trial_end_dt.strftime('%B %d, %Y') if trial_end_dt else 'N/A',
            'billing_start_date': billing_start_date.strftime('%B %d, %Y') if billing_start_date else 'N/A',
            'plan_name': plan_name,
            'billing_amount': billing_amount,
        })
        
        graph_send_mail(subject, html_message, user_email)
        return f"Trial ending soon email sent successfully to {user_email}"
    except Exception as e:
        return f"Failed to send trial ending soon email: {str(e)}"


@shared_task
def send_trial_ended_email(user_email, fleet_name, plan_name, billing_amount, next_billing_date):
    """Send email notification when trial ends and billing starts"""
    try:
        from datetime import datetime
        
        subject = "Trial ended - Your subscription is now active"
        
        # Parse next billing date if it's a string
        if isinstance(next_billing_date, str):
            next_billing_dt = parse_datetime(next_billing_date)
        else:
            next_billing_dt = next_billing_date
        
        html_message = render_to_string('trial_ended.html', {
            'fleet_name': fleet_name,
            'plan_name': plan_name,
            'billing_amount': billing_amount,
            'next_billing_date': next_billing_dt.strftime('%B %d, %Y') if next_billing_dt else 'N/A',
        })
        
        graph_send_mail(subject, html_message, user_email)
        return f"Trial ended email sent successfully to {user_email}"
    except Exception as e:
        return f"Failed to send trial ended email: {str(e)}"


@shared_task
def send_subscription_cancelled_email(user_email, fleet_name, plan_name, cancellation_date, access_until_date):
    """Send email notification when subscription is cancelled"""
    try:
        from datetime import datetime
        
        subject = "Subscription cancelled - Prisma Fleet"
        
        # Parse dates if they're strings
        if isinstance(cancellation_date, str):
            cancellation_dt = parse_datetime(cancellation_date)
        else:
            cancellation_dt = cancellation_date
        
        if isinstance(access_until_date, str):
            access_until_dt = parse_datetime(access_until_date)
        else:
            access_until_dt = access_until_date
        
        html_message = render_to_string('subscription_cancelled.html', {
            'fleet_name': fleet_name,
            'plan_name': plan_name,
            'cancellation_date': cancellation_dt.strftime('%B %d, %Y') if cancellation_dt else 'N/A',
            'access_until_date': access_until_dt.strftime('%B %d, %Y') if access_until_dt else 'N/A',
        })
        
        graph_send_mail(subject, html_message, user_email)
        return f"Subscription cancelled email sent successfully to {user_email}"
    except Exception as e:
        return f"Failed to send subscription cancelled email: {str(e)}"


@shared_task
def send_payment_failed_email(user_email, fleet_name, plan_name, failed_amount, retry_date, update_payment_url, grace_period_until):
    """Send email notification when subscription payment fails"""
    try:
        from datetime import datetime
        
        subject = "Payment failed - Update your payment method"
        
        # Parse dates if they're strings
        if isinstance(retry_date, str):
            retry_dt = parse_datetime(retry_date)
        else:
            retry_dt = retry_date
        
        if isinstance(grace_period_until, str):
            grace_period_dt = parse_datetime(grace_period_until)
        else:
            grace_period_dt = grace_period_until
        
        html_message = render_to_string('payment_failed.html', {
            'fleet_name': fleet_name,
            'plan_name': plan_name,
            'failed_amount': failed_amount,
            'retry_date': retry_dt.strftime('%B %d, %Y at %I:%M %p') if retry_dt else 'N/A',
            'update_payment_url': update_payment_url,
            'grace_period_until': grace_period_dt.strftime('%B %d, %Y') if grace_period_dt else 'N/A',
        })
        
        graph_send_mail(subject, html_message, user_email)
        return f"Payment failed email sent successfully to {user_email}"
    except Exception as e:
        return f"Failed to send payment failed email: {str(e)}"


@shared_task
def send_payment_method_updated_email(user_email, fleet_name):
    """Send email notification when payment method is updated"""
    try:
        subject = "Payment method updated successfully"
        
        html_message = render_to_string('payment_method_updated.html', {
            'fleet_name': fleet_name,
        })
        
        graph_send_mail(subject, html_message, user_email)
        return f"Payment method updated email sent successfully to {user_email}"
    except Exception as e:
        return f"Failed to send payment method updated email: {str(e)}"


@shared_task
def send_trial_subscription_welcome_email(user_email, fleet_name, plan_name, trial_days, trial_end_date):
    """Send welcome email when trial subscription is activated"""
    try:
        from datetime import datetime
        
        subject = f"Welcome to {plan_name} - Your Trial Has Started! 🎉"
        
        # Parse trial end date if it's a string
        if isinstance(trial_end_date, str):
            trial_end_dt = parse_datetime(trial_end_date)
        else:
            trial_end_dt = trial_end_date
        
        html_message = render_to_string('trial_subscription_welcome.html', {
            'fleet_name': fleet_name,
            'plan_name': plan_name,
            'trial_days': trial_days,
            'trial_end_date': trial_end_dt.strftime('%B %d, %Y') if trial_end_dt else 'N/A',
        })
        
        graph_send_mail(subject, html_message, user_email)
        return f"Trial subscription welcome email sent successfully to {user_email}"
    except Exception as e:
        return f"Failed to send trial subscription welcome email: {str(e)}"
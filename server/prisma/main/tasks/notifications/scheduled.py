from celery import shared_task
from datetime import timedelta
from django.utils import timezone

from main.tasks.notifications.push import send_push_notification


@shared_task(name='main.tasks.send_service_reminders')
def send_service_reminders():
    from main.models import BookedAppointment

    now = timezone.now()
    reminder_start = now + timedelta(minutes=25)
    reminder_end = now + timedelta(minutes=35)

    try:
        appointments = BookedAppointment.objects.filter(
            appointment_date=now.date(),
            start_time__gte=reminder_start.time(),
            start_time__lte=reminder_end.time(),
            status='confirmed'
        )

        print(f"Found {appointments.count()} appointments for reminder")

        for appointment in appointments:
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


@shared_task(name='main.tasks.send_promotion_expiration')
def send_promotion_expiration():
    """Send a notification to all users with promotions expiring in the next 24 hours."""
    from main.models import Promotions

    now = timezone.now()
    tomorrow = now + timedelta(days=1)

    try:
        expiring_promotions = Promotions.objects.filter(
            is_active=True,
            is_used=False,
            valid_until__gte=now.date(),
            valid_until__lte=tomorrow.date()
        ).select_related('user')
        notifications_sent = 0

        for promotion in expiring_promotions:
            user = promotion.user

            if user.allow_push_notifications and user.notification_token:
                send_push_notification.delay(
                    user.id,
                    "Promotion Expiring Soon ⏰",
                    f"Your {promotion.title} ({promotion.discount_percentage}% off) expires tomorrow! Don't miss out on this great deal.",
                    "promotion_expiring"
                )
                notifications_sent += 1

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


@shared_task(name='main.tasks.check_loyalty_decay')
def check_loyalty_decay():
    """Reset loyalty for users inactive for 60+ days."""
    from main.models import LoyaltyProgram, Notification

    sixty_days_ago = timezone.now().date() - timedelta(days=60)

    try:
        inactive_loyalties = LoyaltyProgram.objects.filter(
            last_booking_date__lt=sixty_days_ago,
            completed_bookings__gt=0
        ).select_related('user')

        reset_count = 0
        for loyalty in inactive_loyalties:
            user = loyalty.user
            old_tier = loyalty.current_tier

            loyalty.completed_bookings = 0
            loyalty.current_tier = 'bronze'
            loyalty.save()
            reset_count += 1

            if user.allow_push_notifications and user.notification_token:
                send_push_notification.delay(
                    user.id,
                    "Loyalty Tier Reset",
                    "Your loyalty tier has been reset to Bronze due to 60 days of inactivity. Book a service to start earning points again!",
                    "loyalty_reset"
                )

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


@shared_task(name='main.tasks.cleanup_expired_pending_bookings')
def cleanup_expired_pending_bookings():
    """Clean up expired pending bookings (older than 24 hours)."""
    from main.models import PendingBooking

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


@shared_task(name='main.tasks.expire_old_transfers')
def expire_old_transfers():
    """Expire transfer requests that are older than 7 days."""
    from main.models import VehicleTransfer

    try:
        now = timezone.now()
        expired_transfers = VehicleTransfer.objects.filter(
            status='pending',
            expires_at__lt=now
        )

        # Get list before update for notifications
        transfer_list = list(expired_transfers)
        count = len(transfer_list)
        expired_transfers.update(status='expired', responded_at=now)

        for transfer in transfer_list:
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

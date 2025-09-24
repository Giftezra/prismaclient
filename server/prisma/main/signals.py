from django.db.models.signals import post_save
from django.dispatch import receiver
from datetime import timedelta
from django.utils import timezone
from main.models import User, BookedAppointment, LoyaltyProgram, Promotions,Notification, JobChatRoom
from main.tasks import send_promotional_email, send_push_notification
from main.tasks import cleanup_job_chat, create_job_chat_room

@receiver(post_save, sender=BookedAppointment)
def handle_booking_completion(sender, instance, created, **kwargs):
    if instance.status == 'completed':
        user = instance.user
        now = timezone.now()
        
        # 1. Update Loyalty Program (lifetime tracking only)
        # Only count bookings above Basic Wash towards loyalty points
        if instance.service_type.name != 'Basic Wash':
            loyalty, created = LoyaltyProgram.objects.get_or_create(user=user)
            loyalty.completed_bookings += 1
            
            # Check for tier upgrade
            old_tier = loyalty.current_tier
            if loyalty.completed_bookings >= 40:
                loyalty.current_tier = 'platinum'
            elif loyalty.completed_bookings >= 25:
                loyalty.current_tier = 'gold'
            elif loyalty.completed_bookings >= 10:
                loyalty.current_tier = 'silver'
            else:
                loyalty.current_tier = 'bronze'
            loyalty.save()
        else:
            # For Basic Wash, we still need old_tier for notification logic
            loyalty, created = LoyaltyProgram.objects.get_or_create(user=user)
            old_tier = loyalty.current_tier
        
        # Send the user a push notification whenever the user is upgraded to a new tier
        if old_tier != loyalty.current_tier:
        # check if the user has allowed push notifications and if they have a token saved 
            if user.allow_push_notifications and user.notification_token:
                send_push_notification.delay(
                    user.id, 
                    f"Tier Upgraded to {loyalty.current_tier.title()}! ⭐", 
                    f"Congratulations! You've been upgraded to {loyalty.current_tier.title()} tier!",
                    "tier_upgrade"
                )
                
        # 2. Check for Activity Promotion (3 washes in 30 days)
        thirty_days_ago = now - timedelta(days=30)
        
        # Count washes in last 30 days (excluding Basic Wash)
        recent_washes = BookedAppointment.objects.filter(
            user=user,
            status='completed',
            updated_at__gte=thirty_days_ago
        ).exclude(service_type__name='Basic Wash').count()
        
        # Check if user has already earned a VALID promotion in this 30-day window
        existing_promotion = Promotions.objects.filter(
            user=user,
            title__contains="Activity Bonus",
            created_at__gte=thirty_days_ago,
            is_active=True,
            valid_until__gte=now.date()  # Make sure it's still valid
        ).exists()
        
        # Create promotion only if:
        # 1. User has 3+ washes in 30 days (excluding Basic Wash)
        # 2. User hasn't already earned a valid promotion in this 30-day window
        # 3. Current booking is above Basic Wash
        if instance.service_type.name != 'Basic Wash':
            if recent_washes >= 3 and not existing_promotion:
                # Create the promotion
                promotion = Promotions.objects.create(
                    title=f"Activity Bonus - {user.name}",
                    description=f"Congratulations! You've completed 3 washes in 30 days. Get 10% off your next wash!",
                    discount_percentage=10,
                    valid_until=(now + timedelta(days=30)).date(),
                    is_active=True,
                    terms_conditions="Valid for 30 days from earning. Cannot be combined with other offers.",
                    user=user
                )
                
                # check if the user has allowed email notifications
                if user.allow_email_notifications:
                    send_promotional_email.delay(user.email, user.name)

                # Also send a push notification if the user has allowed push notifications and if they have a token saved 
                if user.allow_push_notifications and user.notification_token:
                    send_push_notification.delay(
                        user.id, 
                        "Activity Bonus Earned!🎉", 
                        "Great job! You've completed 3 washes in 30 days. You've earned a 10% discount on your next wash!",
                        "activity_bonus")

                # Create notification
                Notification.objects.create(
                    user=user,
                    title="Activity Bonus Earned! 🎉",
                    message=f"Great job! You've completed 3 washes in 30 days. You've earned a 10% discount on your next wash!",
                    type='info',
                    status='success'
                )
        
        # 3. Send tier upgrade notification (no promotion creation)
        if old_tier != loyalty.current_tier:
            Notification.objects.create(
                user=user,
                title=f"Tier Upgraded to {loyalty.current_tier.title()}! ⭐",
                message=f"Congratulations! You've been upgraded to {loyalty.current_tier.title()} tier!",
                type='info',
                status='success'
            )



# Handle how the chat room is created when a booking is confirmed
# The chatroom can only be created an hour before the booking starts#
@receiver(post_save, sender=BookedAppointment)
def handle_booking_status_change(sender, instance, created, **kwargs):
    """Handle booking status changes and chat room lifecycle"""
    if not created:  # Only for updates, not new bookings
        
        # Schedule chat room creation 1 hour before job starts when booking is confirmed
        if instance.status == 'confirmed':
            # Calculate when to create the chat room (1 hour before appointment)
            appointment_datetime = timezone.datetime.combine(
                instance.appointment_date, 
                instance.start_time or timezone.datetime.min.time()
            )
            appointment_datetime = timezone.make_aware(appointment_datetime)

            now = timezone.now()

            # Send the user a notification when their appointment has 15 minutes left
            end_time = appointment_datetime + timedelta(minutes=instance.duration or 0)
            closing_notification_time = end_time - timedelta(minutes=15)
            if closing_notification_time > now:
                send_push_notification.delay(
                    instance.user.id,
                    "Appointment Reminder ⏰",
                    f"Your appointment is starting in 15 minutes at {instance.start_time}",
                    "appointment_reminder"
                )

        
        # Close and cleanup chat room when job is completed or cancelled
        elif instance.status in ['completed', 'cancelled']:
            try:
                chat_room = JobChatRoom.objects.get(booking=instance)
                chat_room.is_active = False
                chat_room.closed_at = timezone.now()
                chat_room.save()
                
                # Schedule cleanup task
                cleanup_job_chat.delay(str(chat_room.id))
                print(f"Chat room closed for booking {instance.booking_reference}")
            except JobChatRoom.DoesNotExist:
                pass
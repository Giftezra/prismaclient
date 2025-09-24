from typing import Iterable
from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
import uuid
from django.utils import timezone
from datetime import timedelta
from django.core.validators import FileExtensionValidator
from django.core.exceptions import ValidationError




class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)
    

class User(AbstractUser):
    name = models.CharField(max_length=155)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=15, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    notification_token = models.CharField(max_length=255, blank=True, null=True)
    allow_marketing_emails = models.BooleanField(default=False)
    allow_push_notifications = models.BooleanField(default=True)
    allow_email_notifications = models.BooleanField(default=True)

    # Add promotions fields
    has_signup_promotions = models.BooleanField(default=True)
    has_booking_promotions = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']
    
    def __str__(self):
        return f"{self.name} - {self.email}"

    def save(self, *args, **kwargs):
        self.username = self.email
        is_new_user = self.pk is None
        super().save(*args, **kwargs)

        # Create a sign up promotions for new users
        if is_new_user and self.has_signup_promotions:
            from datetime import datetime, timedelta
            valid_until = datetime.now() + timedelta(days=30)
            Promotions.objects.create(
                user=self,
                title= "Welcome Bonus",
                description="Get 10% off your first service!",
                discount_percentage=10,
                valid_until=valid_until,
                is_active=True,
                terms_conditions= f"Valid for 30 days from {datetime.now().strftime('%Y-%m-%d')}. New customers only. Cannot be combined with other offers.",
            )
        # Create a loyalty program for new users
        if is_new_user:
            LoyaltyProgram.objects.create(user=self)


class Address(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    address = models.CharField(max_length=255)
    post_code = models.CharField(max_length=10)
    city = models.CharField(max_length=100)
    country = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.user.name} - {self.address}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)


class Vehicles(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    make = models.CharField(max_length=100)
    model = models.CharField(max_length=100)
    year = models.IntegerField()
    color = models.CharField(max_length=100)
    licence = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.name} - {self.make} {self.model} {self.year} {self.color} {self.licence}"


class ServiceType(models.Model):
    name = models.CharField(max_length=100)
    description = models.JSONField()  # This will store the array of strings from the interface
    price = models.DecimalField(max_digits=10, decimal_places=2)
    duration = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} - ${self.price}"


class ValetType(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name}"


class DetailerProfile(models.Model):
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=15)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} - {self.phone}"
    
class AddOns(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    extra_duration = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.name} - ${self.price}"




class BookedAppointment(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('in_progress', 'In Progress'),
        ('scheduled', 'Scheduled'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    booking_reference = models.CharField(max_length=255, editable=False, unique=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    vehicle = models.ForeignKey(Vehicles, on_delete=models.CASCADE)
    valet_type = models.ForeignKey(ValetType, on_delete=models.CASCADE)
    service_type = models.ForeignKey(ServiceType, on_delete=models.CASCADE)
    add_ons = models.ManyToManyField(AddOns, blank=True)
    detailer = models.ForeignKey(DetailerProfile, on_delete=models.CASCADE)
    address = models.ForeignKey(Address, on_delete=models.CASCADE)
    booking_date = models.DateField(auto_now_add=True) 
    appointment_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    start_time = models.TimeField(null=True, blank=True)
    duration = models.IntegerField(null=True, blank=True)
    special_instructions = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


    # Add a review 
    is_reviewed = models.BooleanField(default=False)
    review_rating = models.IntegerField(null=True, blank=True)
    review_tip = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    review_submitted_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.name} - {self.vehicle.make} {self.vehicle.model} - {self.appointment_date}"

    def save(self, *args, **kwargs):
        # Check the total number of completed booking. 
        # if more then 3 in a 30 day period, create the promotions for the user
        if self.user.has_booking_promotions:
            # Add promotion logic here
            pass
        
        super().save(*args, **kwargs)


class Notification(models.Model):
    NOTIFICATION_TYPE_CHOICES = [
        ('booking_confirmed', 'Booking Confirmed'),
        ('booking_cancelled', 'Booking Cancelled'),
        ('booking_rescheduled', 'Booking Rescheduled'),
        ('cleaning_completed', 'Cleaning Completed'),
        ('appointment_started', 'Appointment Started'),
        ('pending', 'Pending'),
    ]
    NOTIFICATION_STATUS_CHOICES = [
        ('success', 'Success'),
        ('warning', 'Warning'),
        ('error', 'Error'),
        ('info', 'Info'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    message = models.TextField()
    type = models.CharField(max_length=255, choices=NOTIFICATION_TYPE_CHOICES, default='pending')
    status = models.CharField(max_length=255, choices=NOTIFICATION_STATUS_CHOICES, default='info')
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.name} - {self.title}"
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)



class Promotions(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    description = models.TextField()
    discount_percentage = models.IntegerField()
    valid_until = models.DateField()
    is_active = models.BooleanField(default=True)
    terms_conditions = models.TextField()
    
    # Simple tracking fields
    is_used = models.BooleanField(default=False)
    used_in_booking = models.ForeignKey('BookedAppointment', on_delete=models.SET_NULL, null=True, blank=True)
    used_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} - {self.discount_percentage}%"

    def save(self, *args, **kwargs):
        # Set is_active to False if:
        # 1. 30 days have passed since creation, OR
        # 2. Promotion has been used
        if (self.created_at and timezone.now() - self.created_at > timedelta(days=30)) or self.is_used:
            self.is_active = False
        super().save(*args, **kwargs)
    
    def mark_as_used(self, booking):
        """Mark promotion as used with booking reference"""
        self.is_used = True
        self.used_in_booking = booking
        self.used_at = timezone.now()
        self.is_active = False  # This will be set in save() but being explicit
        self.save()



class LoyaltyProgram(models.Model):
    TIER_CHOICES = [
        ('bronze', 'Bronze'),
        ('silver', 'Silver'),
        ('gold', 'Gold'),
        ('platinum', 'Platinum'), 
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    current_tier = models.CharField(max_length=50, choices=TIER_CHOICES, default='bronze')
    completed_bookings = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Create the tier benefit method to track what discounts a user gets based on their current tier
    def get_tier_benefits(self):
        benefits = {
            'bronze': {'discount':0, 'free_service':[]},
            'silver': {'discount':5, 'free_service':['Air freshner']},
            'gold': {'discount':10, 'free_service':['Air freshner','Window cleaned']},
            'platinum': {'discount':15, 'free_service':['Air freshner','Window cleaned','Interior protection', 'Basic wash']},
        }
        return benefits.get(self.current_tier, benefits['bronze'])


class JobChatRoom(models.Model):
    """Chat room associated with a specific booking/appointment"""
    booking = models.OneToOneField(BookedAppointment, on_delete=models.CASCADE, related_name='chat_room')
    client = models.ForeignKey(User, on_delete=models.CASCADE, related_name='client_chat_rooms')
    detailer = models.ForeignKey(DetailerProfile, on_delete=models.CASCADE, related_name='detailer_chat_rooms')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        unique_together = ['booking', 'client', 'detailer']
    
    def __str__(self):
        return f"Chat for {self.booking.booking_reference}"


class JobChatMessage(models.Model):
    """Individual messages in a job chat room"""
    MESSAGE_TYPES = [
        ('text', 'Text'),
        ('system', 'System'),
        ('status_update', 'Status Update'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(JobChatRoom, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    sender_type = models.CharField(max_length=20, choices=[('client', 'Client'), ('detailer', 'Detailer')])
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPES, default='text')
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['created_at']
    
    def __str__(self):
        return f"{self.sender_type}: {self.content[:50]}..."


class PaymentTransaction(models.Model):
    """Track all payment transactions - created via webhook"""
    TRANSACTION_TYPES = [
        ('payment', 'Payment'),
        ('refund', 'Refund'),
    ]
    
    STATUS_CHOICES = [
        ('succeeded', 'Succeeded'),
        ('failed', 'Failed'),
        ('pending', 'Pending'),
    ]
    
    booking = models.ForeignKey(BookedAppointment, on_delete=models.CASCADE, related_name='transactions')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    
    # Stripe fields
    stripe_payment_intent_id = models.CharField(max_length=255, unique=True)
    stripe_refund_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    
    # Transaction details
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='gbp')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.transaction_type} - {self.amount} {self.currency} - {self.status}"


class RefundRecord(models.Model):
    """Track refund attempts and their status for dispute resolution"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('succeeded', 'Succeeded'),
        ('failed', 'Failed'),
        ('disputed', 'Disputed'),
    ]
    
    booking = models.ForeignKey(BookedAppointment, on_delete=models.CASCADE, related_name='refunds')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    original_transaction = models.ForeignKey(PaymentTransaction, on_delete=models.CASCADE, related_name='refund_attempts')
    
    # Refund details
    requested_amount = models.DecimalField(max_digits=10, decimal_places=2)
    stripe_refund_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Dispute resolution fields
    failure_reason = models.TextField(blank=True, null=True)
    admin_notes = models.TextField(blank=True, null=True)
    dispute_resolved = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    dispute_resolved_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"Refund {self.id} - {self.booking.booking_reference} - {self.status}"



class TermsAndConditions(models.Model):
    version = models.CharField(max_length=20, unique=True)
    content = models.TextField()
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Terms and Conditions - {self.version}"

class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'password_reset_tokens'
    
    def is_expired(self):
        return timezone.now() > self.expires_at
    
    def is_valid(self):
        return not self.used and not self.is_expired()
    
    def __str__(self):
        return f"Password reset token for {self.user.email}"

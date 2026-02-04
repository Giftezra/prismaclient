from typing import Iterable
from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
import uuid
import time
from django.utils import timezone
from datetime import timedelta
from django.core.validators import FileExtensionValidator
from django.core.exceptions import ValidationError
import random
import string




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
    referral_code = models.CharField(max_length=10, blank=True, null=True)
    referred_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='referrals')
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    is_fleet_owner = models.BooleanField(default=False)
    is_branch_admin = models.BooleanField(default=False)
    notification_token = models.CharField(max_length=255, blank=True, null=True)
    allow_marketing_emails = models.BooleanField(default=False)
    allow_push_notifications = models.BooleanField(default=True)
    allow_email_notifications = models.BooleanField(default=True)
    stripe_customer_id = models.CharField(max_length=255, blank=True, null=True)                                           
    has_signup_promotions = models.BooleanField(default=True)
    has_booking_promotions = models.BooleanField(default=False)

    referral_code = models.CharField(max_length=8, blank=True, null=True)
    referred_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='referrals')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']
    
    def __str__(self):
        return f"{self.name} - {self.email}"

    def create_referral_code(self):
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))
    
    def get_current_vehicles(self):
        """
        Get all vehicles currently owned by this user.
        Backward compatibility helper for user.vehicles pattern.
        """
        return Vehicle.objects.filter(
            ownerships__owner=self,
            ownerships__end_date__isnull=True
        ).distinct()
    
    def get_all_vehicles(self):
        """
        Get all vehicles ever owned by this user (including past ownership).
        """
        return Vehicle.objects.filter(ownerships__owner=self).distinct()
    
    def is_fleet_admin_or_manager(self):
        """
        Check if user is an admin or manager in any fleet.
        Used for determining fleet benefits in loyalty program.
        """
        return FleetMember.objects.filter(
            user=self,
            role__in=['admin', 'manager']
        ).exists()
    
    def get_managed_branch(self):
        """
        Get the branch that this branch admin manages.
        Returns None if user is not a branch admin.
        """
        if not self.is_branch_admin:
            return None
        fleet_membership = FleetMember.objects.filter(
            user=self,
            role='admin'
        ).first()
        return fleet_membership.branch if fleet_membership else None
    
    def is_fleet_user(self):
        """
        Check if user is a fleet owner or branch admin.
        Used for determining fleet pricing and access.
        """
        return self.is_fleet_owner or self.is_branch_admin
    
    def can_view_vehicle_details(self, vehicle=None):
        """
        Check if user can view detailed vehicle information (images, scans, reports).
        - Regular users: Always allowed (no subscription check needed)
        - Fleet owners: Only if their fleet has active subscription
        - Fleet members (admins/managers): Only if their fleet has active subscription
        """
        # Regular users can always view
        if not (self.is_fleet_owner or self.is_branch_admin):
            return True
        
        # For fleet users, check if their fleet has active subscription
        fleet = None
        if self.is_fleet_owner:
            fleet = Fleet.objects.filter(owner=self).first()
        else:
            # Fleet member - get fleet from membership
            membership = FleetMember.objects.filter(user=self).first()
            fleet = membership.fleet if membership else None
        
        if not fleet:
            return False
        
        subscription = fleet.get_active_subscription()
        return subscription is not None and subscription.status == 'active'

    def create_fleet(self):
        """Create a fleet for this user if they are a fleet owner"""
        if not self.is_fleet_owner:
            return None
        
        # Check if fleet already exists
        if Fleet.objects.filter(owner=self).exists():
            return Fleet.objects.filter(owner=self).first()
        
        # Create fleet with default name
        fleet_name = f"{self.name}'s Fleet"
        fleet = Fleet.objects.create(
            name=fleet_name,
            owner=self,
            description=f"Fleet managed by {self.name}"
        )
        return fleet

    def save(self, *args, **kwargs):
        self.username = self.email
        is_new_user = self.pk is None
        
        # Check if is_fleet_owner flag is being changed from False to True
        became_fleet_owner = False
        if not is_new_user:
            try:
                old_user = User.objects.get(pk=self.pk)
                became_fleet_owner = not old_user.is_fleet_owner and self.is_fleet_owner
            except User.DoesNotExist:
                pass
        
        # Generate referral code for new users
        if is_new_user and not self.referral_code:
            self.referral_code = self.create_referral_code()
        
        super().save(*args, **kwargs)

        # Create a sign up promotions for new users
        if is_new_user and self.has_signup_promotions:
            from datetime import datetime, timedelta
            valid_until = (datetime.now() + timedelta(days=30)).date()
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
        
        # Create a fleet for fleet owner users (new users or when flag changes to True)
        if (is_new_user and self.is_fleet_owner) or became_fleet_owner:
            self.create_fleet()
        
        # Create a referral code for new users
        if is_new_user:
            self.referral_code = self.create_referral_code()
            self.save()


class Referral(models.Model):
    referrer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='referrer')
    referred = models.ForeignKey(User, on_delete=models.CASCADE, related_name='referred')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.referrer.name} - {self.referred.name}"
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

class Referral(models.Model):
    referrer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='referrer')
    referred = models.ForeignKey(User, on_delete=models.CASCADE, related_name='referred')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.referrer.name} - {self.referred.name}"
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

class Address(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    address = models.CharField(max_length=255)
    post_code = models.CharField(max_length=10)
    city = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    latitude = models.DecimalField(max_digits=10, decimal_places=8, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=8, null=True, blank=True)
    def __str__(self):
        return f"{self.user.name} - {self.address}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)


class Vehicle(models.Model):
    """
    Independent vehicle model with global identity.
    Vehicles exist independently of users and can have multiple owners over time.
    Each vehicle can only have ONE active owner at a time.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    registration_number = models.CharField(max_length=50)  # Previously 'licence'
    country = models.CharField(max_length=100)  # Country of registration
    vin = models.CharField(max_length=17, unique=True)  # Vehicle Identification Number - REQUIRED
    make = models.CharField(max_length=100)
    model = models.CharField(max_length=100)
    year = models.IntegerField()
    color = models.CharField(max_length=100)
    image = models.ImageField(upload_to='vehicles/', null=True, blank=True)
    owner_count = models.IntegerField(default=0, help_text="Number of owners this vehicle has had")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = [['registration_number', 'country']]
        indexes = [
            models.Index(fields=['registration_number', 'country']),
            models.Index(fields=['vin']),
        ]
    
    def __str__(self):
        return f"{self.make} {self.model} {self.year} ({self.registration_number}, {self.country})"
    
    def get_current_owner(self):
        """Get the current active owner (if any)"""
        current_ownership = self.ownerships.filter(end_date__isnull=True).first()
        return current_ownership.owner if current_ownership else None
    
    def has_active_owner(self):
        """Check if vehicle has an active owner"""
        return self.ownerships.filter(end_date__isnull=True).exists()
    
    def get_active_ownership(self):
        """Get the current active ownership record"""
        return self.ownerships.filter(end_date__isnull=True).first()
    
    def get_all_owners(self):
        """Get all users who have owned this vehicle"""
        return User.objects.filter(vehicle_ownerships__vehicle=self).distinct()


class VehicleOwnership(models.Model):
    """
    Tracks vehicle ownership over time. Supports private, fleet, and lease ownership.
    """
    OWNERSHIP_TYPE_CHOICES = [
        ('private', 'Private'),
        ('fleet', 'Fleet'),
        ('lease', 'Lease'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # CASCADE: If Vehicle is deleted, delete this ownership record.
    # Vehicles should never be deleted directly - only ownership is ended via end_date.
    # Only ONE ownership record per vehicle can have end_date=NULL (enforced in save method)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='ownerships')
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='vehicle_ownerships')
    ownership_type = models.CharField(max_length=20, choices=OWNERSHIP_TYPE_CHOICES, default='private')
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)  # NULL = current ownership
    proof_of_transfer = models.FileField(upload_to='ownership_docs/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def save(self, *args, **kwargs):
        """
        Ensure only one active ownership per vehicle.
        If this ownership is active (end_date is NULL), end all other active ownerships.
        """
        if self.end_date is None:  # This is an active ownership
            # End all other active ownerships for this vehicle
            VehicleOwnership.objects.filter(
                vehicle=self.vehicle,
                end_date__isnull=True
            ).exclude(id=self.id if self.id else None).update(
                end_date=timezone.now().date()
            )
        super().save(*args, **kwargs)
    
    class Meta:
        ordering = ['-start_date']
        indexes = [
            models.Index(fields=['vehicle', '-start_date']),
            models.Index(fields=['owner', '-start_date']),
        ]
    
    def __str__(self):
        return f"{self.owner.name} - {self.vehicle.registration_number} ({self.ownership_type})"


class VehicleEvent(models.Model):
    """
    Immutable event log for all vehicle activities: washes, inspections, damage, repairs, OBD scans.
    """
    EVENT_TYPE_CHOICES = [
        ('wash', 'Wash'),
        ('inspection', 'Inspection'),
        ('damage', 'Damage Report'),
        ('repair', 'Repair'),
        ('obd_scan', 'OBD Scan'),
        ('service', 'Service'),
    ]
    
    VISIBILITY_CHOICES = [
        ('public', 'Public'),
        ('private', 'Private'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='events')
    event_type = models.CharField(max_length=20, choices=EVENT_TYPE_CHOICES)
    booking = models.ForeignKey('BookedAppointment', on_delete=models.SET_NULL, null=True, blank=True, related_name='vehicle_events')
    performed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='performed_events')
    metadata = models.JSONField(default=dict, blank=True)  # Flexible data storage
    visibility = models.CharField(max_length=10, choices=VISIBILITY_CHOICES, default='public')
    event_date = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-event_date']
        indexes = [
            models.Index(fields=['vehicle', '-event_date']),
            models.Index(fields=['booking']),
            models.Index(fields=['event_type', '-event_date']),
        ]
    
    def __str__(self):
        return f"{self.event_type} - {self.vehicle.registration_number} ({self.event_date})"


class Fleet(models.Model):
    """
    Fleet entity for managing multiple vehicles.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_fleets')
    description = models.TextField(blank=True)
    has_used_trial = models.BooleanField(default=False, help_text="Whether this fleet has used their trial period")
    trial_used_date = models.DateTimeField(null=True, blank=True, help_text="Date when the fleet used their trial period")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.name} ({self.owner.name})"
    
    def get_active_subscription(self):
        """Get the active subscription for this fleet (includes trialing status)"""
        return self.subscriptions.filter(
            status__in=['active', 'trialing'],
            end_date__gte=timezone.now()
        ).first()
    
    def check_subscription_limits(self):
        """Get current usage and limits for this fleet"""
        subscription = self.get_active_subscription()
        if not subscription:
            # No subscription - no access to create resources
            return {
                'has_subscription': False,
                'limits': {'max_admins': 0, 'max_branches': 0, 'max_vehicles': 0},
                'current': {'admins': 0, 'branches': 0, 'vehicles': 0}
            }
        
        tier = subscription.plan.tier
        limits = tier.get_limits()
        
        # Get current counts
        current_admins = FleetMember.objects.filter(fleet=self, role='admin').count()
        current_branches = Branch.objects.filter(fleet=self).count()
        current_vehicles = FleetVehicle.objects.filter(fleet=self).count()
        
        return {
            'has_subscription': True,
            'subscription_tier': tier.name,
            'limits': limits,
            'current': {
                'admins': current_admins,
                'branches': current_branches,
                'vehicles': current_vehicles
            }
        }
    
    def can_add_admin(self):
        """Check if fleet can add another admin"""
        limits_info = self.check_subscription_limits()
        if not limits_info['has_subscription']:
            return False, "No active subscription"
        
        max_admins = limits_info['limits']['max_admins']
        if max_admins is None:  # Unlimited
            return True, None
        
        current = limits_info['current']['admins']
        if current >= max_admins:
            return False, f"Admin limit reached ({current}/{max_admins})"
        return True, None
    
    def can_add_branch(self):
        """Check if fleet can add another branch"""
        limits_info = self.check_subscription_limits()
        if not limits_info['has_subscription']:
            return False, "No active subscription"
        
        max_branches = limits_info['limits']['max_branches']
        if max_branches is None:  # Unlimited
            return True, None
        
        current = limits_info['current']['branches']
        if current >= max_branches:
            return False, f"Branch limit reached ({current}/{max_branches})"
        return True, None
    
    def can_add_vehicle(self):
        """Check if fleet can add another vehicle"""
        limits_info = self.check_subscription_limits()
        if not limits_info['has_subscription']:
            return False, "No active subscription"
        
        max_vehicles = limits_info['limits']['max_vehicles']
        if max_vehicles is None:  # Unlimited
            return True, None
        
        current = limits_info['current']['vehicles']
        if current >= max_vehicles:
            return False, f"Vehicle limit reached ({current}/{max_vehicles})"
        return True, None


class Branch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fleet = models.ForeignKey(Fleet, on_delete=models.CASCADE, related_name='branches')
    name = models.CharField(max_length=100, null=True, blank=True)
    address = models.CharField(max_length=150, null=True, blank=True)
    postcode = models.CharField(max_length=10, null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    country = models.CharField(max_length=100, null=True, blank=True)
    spend_limit = models.DecimalField(
        max_digits=12, decimal_places=2, default=0, null=True, blank=True,
        help_text='Optional cap. 0 or null = no limit.'
    )
    spend_limit_period = models.CharField(
        max_length=10,
        choices=[('weekly', 'Weekly'), ('monthly', 'Monthly')],
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} - {self.fleet.name}"
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)


class FleetMember(models.Model):
    """
    Users associated with a fleet with specific roles.
    """
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('manager', 'Manager')
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fleet = models.ForeignKey(Fleet, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='fleet_memberships')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='fleet_members')
    joined_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = [['fleet', 'user']]
    
    def __str__(self):
        return f"{self.user.name} - {self.fleet.name} ({self.role})"


class FleetVehicle(models.Model):
    """
    Association between fleets and vehicles.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fleet = models.ForeignKey(Fleet, on_delete=models.CASCADE, related_name='fleet_vehicles')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='fleet_associations')
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='branch_vehicles')
    added_at = models.DateTimeField(auto_now_add=True)
    added_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    
    class Meta:
        unique_together = [['fleet', 'vehicle']]
    
    def __str__(self):
        return f"{self.fleet.name} - {self.vehicle.registration_number}"


class VehicleTransfer(models.Model):
    """
    Tracks pending vehicle ownership transfers requiring consent from current owner.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('expired', 'Expired'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='transfers')
    from_owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='outgoing_transfers')
    to_owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='incoming_transfers')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    requested_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()  # 7 days from request
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-requested_at']
        indexes = [
            models.Index(fields=['vehicle', 'status']),
            models.Index(fields=['from_owner', 'status']),
            models.Index(fields=['to_owner', 'status']),
        ]
    
    def __str__(self):
        return f"Transfer {self.vehicle.registration_number} from {self.from_owner.name} to {self.to_owner.name} ({self.status})"
    
    def is_expired(self):
        """Check if transfer request has expired"""
        return timezone.now() > self.expires_at
    
    def can_be_approved(self):
        """Check if transfer can still be approved"""
        return self.status == 'pending' and not self.is_expired()


class ServiceType(models.Model):
    name = models.CharField(max_length=100)
    description = models.JSONField()  # This will store the array of strings from the interface
    price = models.DecimalField(max_digits=10, decimal_places=2)
    fleet_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    duration = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} - ${self.price}"
    
    def get_price_for_user(self, user):
        """
        Get the appropriate price for a user based on their role.
        Returns fleet_price if user is fleet owner or branch admin, else returns regular price.
        """
        if user and (user.is_fleet_owner or user.is_branch_admin):
            return self.fleet_price if self.fleet_price is not None else self.price
        return self.price


class ValetType(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name}"


class DetailerProfile(models.Model):
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=15, unique=True)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} - {self.phone}"
    
    def save(self, *args, **kwargs):
        # Normalize phone number before saving
        from main.util.phone_utils import normalize_phone
        if self.phone:
            self.phone = normalize_phone(self.phone)
        super().save(*args, **kwargs)
    
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
    vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, null=True, blank=True)
    valet_type = models.ForeignKey(ValetType, on_delete=models.CASCADE)
    service_type = models.ForeignKey(ServiceType, on_delete=models.CASCADE)
    add_ons = models.ManyToManyField(AddOns, blank=True)
    detailer = models.ForeignKey(DetailerProfile, on_delete=models.SET_NULL, null=True, blank=True)
    address = models.ForeignKey(Address, on_delete=models.CASCADE)
    booking_date = models.DateField(auto_now_add=True) 
    appointment_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Amount before VAT (after discounts)")
    vat_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="VAT amount")
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=23.00, help_text="VAT rate percentage")
    start_time = models.TimeField(null=True, blank=True)
    duration = models.IntegerField(null=True, blank=True)
    special_instructions = models.TextField(null=True, blank=True)
    is_express_service = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


    # Add a review 
    is_reviewed = models.BooleanField(default=False)
    review_rating = models.IntegerField(null=True, blank=True)
    review_tip = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    review_submitted_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        vehicle_info = f"{self.vehicle.make} {self.vehicle.model}" if self.vehicle else "No Vehicle"
        return f"{self.user.name} - {vehicle_info} - {self.appointment_date}"

    def save(self, *args, **kwargs):
        # Generate booking_reference if it doesn't exist (for admin panel creation)
        if not self.booking_reference:
            self.booking_reference = f"APT{int(time.time() * 1000)}{str(uuid.uuid4())[:8].upper()}"
        
        # Check the total number of completed booking. 
        # if more then 3 in a 30 day period, create the promotions for the user
        if self.user.has_booking_promotions:
            # Add promotion logic here
            pass
        
        super().save(*args, **kwargs)


class BookedAppointmentImage(models.Model):
    """
    Store before/after images for completed bookings.
    Images are synced from detailer app via Redis when job is completed.
    Stores image URLs (not files) from detailer server.
    """
    IMAGE_TYPE_CHOICES = [
        ('before', 'Before'),
        ('after', 'After'),
    ]
    
    SEGMENT_CHOICES = [
        ('interior', 'Interior'),
        ('exterior', 'Exterior'),
    ]
    
    booking = models.ForeignKey(BookedAppointment, on_delete=models.CASCADE, related_name='job_images')
    vehicle_event = models.ForeignKey(VehicleEvent, on_delete=models.SET_NULL, null=True, blank=True, related_name='images')
    image_type = models.CharField(max_length=10, choices=IMAGE_TYPE_CHOICES)
    segment = models.CharField(max_length=10, choices=SEGMENT_CHOICES, null=True, blank=True)
    image_url = models.URLField(max_length=500)  # Store URL from detailer server
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['booking', 'image_type', 'segment']),
            models.Index(fields=['vehicle_event']),
        ]
    
    def __str__(self):
        return f"{self.image_type} {self.segment or 'unknown'} image for Booking {self.booking.booking_reference}"


class EventDataManagement(models.Model):
    """
    Store fleet maintenance inspection data for a booking.
    Synced from detailer app via Redis when job is completed.
    Helps fleet managers maintain vehicle readiness.
    """
    WIPER_STATUS_CHOICES = [
        ('good', 'Good'),
        ('needs_work', 'Needs Work'),
        ('bad', 'Bad'),
    ]
    
    FLUID_LEVEL_CHOICES = [
        ('good', 'Good'),
        ('low', 'Low'),
        ('needs_change', 'Needs Change'),
        ('needs_refill', 'Needs Refill'),
    ]
    
    BATTERY_CONDITION_CHOICES = [
        ('good', 'Good'),
        ('weak', 'Weak'),
        ('replace', 'Replace'),
    ]
    
    LIGHT_STATUS_CHOICES = [
        ('working', 'Working'),
        ('dim', 'Dim'),
        ('not_working', 'Not Working'),
    ]
    
    INDICATOR_STATUS_CHOICES = [
        ('working', 'Working'),
        ('not_working', 'Not Working'),
    ]
    
    booking = models.OneToOneField(BookedAppointment, on_delete=models.CASCADE, related_name='eventdatamanagement')
    tire_tread_depth = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="Tire tread depth in mm")
    tire_condition = models.TextField(blank=True, null=True, help_text="Notes about tire condition")
    wiper_status = models.CharField(max_length=20, choices=WIPER_STATUS_CHOICES, null=True, blank=True)
    oil_level = models.CharField(max_length=20, choices=FLUID_LEVEL_CHOICES, null=True, blank=True)
    coolant_level = models.CharField(max_length=20, choices=FLUID_LEVEL_CHOICES, null=True, blank=True)
    brake_fluid_level = models.CharField(max_length=20, choices=FLUID_LEVEL_CHOICES, null=True, blank=True)
    battery_condition = models.CharField(max_length=20, choices=BATTERY_CONDITION_CHOICES, null=True, blank=True)
    headlights_status = models.CharField(max_length=20, choices=LIGHT_STATUS_CHOICES, null=True, blank=True)
    taillights_status = models.CharField(max_length=20, choices=LIGHT_STATUS_CHOICES, null=True, blank=True)
    indicators_status = models.CharField(max_length=20, choices=INDICATOR_STATUS_CHOICES, null=True, blank=True)
    vehicle_condition_notes = models.TextField(blank=True, null=True, help_text="General observations about vehicle condition")
    damage_report = models.TextField(blank=True, null=True, help_text="Notes about any visible damage")
    inspected_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-inspected_at']
        indexes = [
            models.Index(fields=['booking']),
            models.Index(fields=['inspected_at']),
        ]
    
    def __str__(self):
        return f"Event data management for Booking {self.booking.booking_reference}"


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
        # 1. valid_until date has passed, OR
        # 2. 30 days have passed since creation, OR
        # 3. Promotion has been used
        from datetime import date
        today = timezone.now().date()
        
        if (self.valid_until and self.valid_until < today) or \
           (self.created_at and timezone.now() - self.created_at > timedelta(days=30)) or \
           self.is_used:
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
    last_booking_date = models.DateField(null=True, blank=True)
    free_quick_sparkle_used = models.IntegerField(default=0)
    free_quick_sparkle_reset_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Create the tier benefit method to track what discounts a user gets based on their current tier
    def get_tier_benefits(self):
        # Check if user is a fleet admin or manager
        is_fleet_user = self.user.is_fleet_admin_or_manager()
        if is_fleet_user:
            # Fleet owner benefits - different discounts, benefits TBD
            benefits = {
                'bronze': {'discount': 0, 'free_service': []},
                'silver': {'discount': 5, 'free_service': ['Air freshner', 'One easy bill per month']}, 
                'gold': {'discount': 8, 'free_service': ['Air freshner', 'One easy bill per month', 'Digital health check']},   
                'platinum': {'discount': 10, 'free_service': ['Air freshner', 'One easy bill per month', 'Digital health check', 'Interior protection', '3 Free Quick sparkle per month']},
            }
        else:
            # Regular user benefits
            benefits = {
                'bronze': {'discount': 0, 'free_service': []},
                'silver': {'discount': 5, 'free_service': ['Air freshner']},
                'gold': {'discount': 8, 'free_service': ['Air freshner', 'Digital health check']},
                'platinum': {'discount': 12, 'free_service': ['Air freshner','Interior protection', '1 Free Quick sparkle per month', 'Digital health check']},
            }
        return benefits.get(self.current_tier, benefits['bronze'])
    
    def get_free_wash_limit(self):
        """Get the monthly free wash limit based on tier and user type"""
        if self.current_tier != 'platinum':
            return 0
        
        if self.user.is_fleet_admin_or_manager():
            return 3
        else:
            return 1 
    
    def can_use_free_quick_sparkle(self):
        """Check if user can use a free basic wash"""
        # Only platinum tier gets free washes
        if self.current_tier != 'platinum':
            return False
        
        today = timezone.now().date()
        
        # Reset counter if 30 days have passed since last reset
        if self.free_quick_sparkle_reset_date:
            days_since_reset = (today - self.free_quick_sparkle_reset_date).days
            if days_since_reset >= 30:
                self.free_quick_sparkle_used = 0
                self.free_quick_sparkle_reset_date = today
                self.save()
        else:
            # First time using this feature
            self.free_quick_sparkle_reset_date = today
            self.save()
        
        # Check if user has washes remaining
        limit = self.get_free_wash_limit()
        return self.free_quick_sparkle_used < limit
    
    def use_free_quick_sparkle(self):
        """Increment the free wash counter after using one"""
        self.free_quick_sparkle_used += 1
        self.save()
        
    def get_remaining_free_quick_sparkles(self):
        """Get the number of remaining free washes for this month"""
        limit = self.get_free_wash_limit()
        remaining = limit - self.free_quick_sparkle_used
        return max(0, remaining)


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
        ('vin_lookup', 'VIN Lookup'),
        ('tip', 'Tip'),
        ('subscription', 'Subscription'),
    ]
    
    STATUS_CHOICES = [
        ('succeeded', 'Succeeded'),
        ('failed', 'Failed'),
        ('pending', 'Pending'),
    ]
    
    booking = models.ForeignKey(BookedAppointment, on_delete=models.CASCADE, related_name='transactions', null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    booking_reference = models.CharField(max_length=255, null=True, blank=True, help_text="Booking reference for payments created before booking exists")
    
    # Stripe fields
    stripe_payment_intent_id = models.CharField(max_length=255, unique=True)
    stripe_refund_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    
    # Transaction details
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='eur')
    last_4_digits = models.CharField(max_length=4, null=True, blank=True)
    card_brand = models.CharField(max_length=20, null=True, blank=True)
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


class VinLookupPurchase(models.Model):
    """
    Track VIN lookup purchases with 24-hour access.
    Supports both registered and unregistered users.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='vin_lookup_purchases', help_text="Registered user (nullable for unregistered users)")
    email = models.EmailField(help_text="Email address (required for all users, Stripe requires email)")
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='vin_lookup_purchases')
    vin = models.CharField(max_length=17, help_text="Denormalized VIN for quick lookup")
    purchase_reference = models.CharField(max_length=255, unique=True, help_text="Unique purchase reference (format: VIN-{timestamp}-{uuid})")
    payment_transaction = models.ForeignKey(PaymentTransaction, on_delete=models.CASCADE, related_name='vin_lookup_purchases')
    purchased_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(help_text="Access expires 24 hours from purchase")
    is_active = models.BooleanField(default=True, help_text="True if purchase is not expired")
    
    class Meta:
        ordering = ['-purchased_at']
        indexes = [
            models.Index(fields=['user', 'vin']),
            models.Index(fields=['email', 'vin']),
            models.Index(fields=['vehicle', 'vin']),
            models.Index(fields=['purchase_reference']),
            models.Index(fields=['expires_at', 'is_active']),
        ]
    
    def is_valid(self):
        """Check if purchase is still active (not expired)"""
        if not self.is_active:
            return False
        return timezone.now() < self.expires_at
    
    def get_user_identifier(self):
        """Return user ID if registered, or email if not"""
        if self.user:
            return str(self.user.id)
        return self.email
    
    def save(self, *args, **kwargs):
        """Ensure email is set from user if user is provided"""
        if self.user and not self.email:
            self.email = self.user.email
        super().save(*args, **kwargs)
    
    def __str__(self):
        user_identifier = self.user.name if self.user else self.email
        return f"VIN Lookup Purchase - {self.vin} - {user_identifier} - {self.purchase_reference}"


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


class PendingBooking(models.Model):
    """
    Temporary storage for booking data before payment is validated.
    Deleted after successful payment and booking creation.
    """
    PAYMENT_STATUS_CHOICES = [
        ('pending', 'Pending Payment'),
        ('processing', 'Processing Payment'),
        ('succeeded', 'Payment Succeeded'),
        ('failed', 'Payment Failed'),
        ('expired', 'Expired'),
    ]
    
    booking_reference = models.CharField(max_length=255, unique=True, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    
    # Store full booking data as JSON (unlimited size)
    booking_data = models.JSONField(help_text="Complete booking data from frontend for client app")
    detailer_booking_data = models.JSONField(help_text="Data formatted for detailer app", null=True, blank=True)
    
    # Payment tracking
    stripe_payment_intent_id = models.CharField(max_length=255, null=True, blank=True)
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='pending'
    )
    
    # Expiry for cleanup (24 hours)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['booking_reference']),
            models.Index(fields=['stripe_payment_intent_id']),
            models.Index(fields=['payment_status', 'expires_at']),
        ]
    
    def __str__(self):
        return f"Pending: {self.booking_reference} - {self.payment_status}"
    
    def is_expired(self):
        return timezone.now() > self.expires_at


class SubscriptionTier(models.Model):
    """
    Subscription tiers for fleet owners (e.g., Basic, Pro, Enterprise).
    Defines pricing and features available at each tier level.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    tagLine = models.CharField(max_length=255, blank=True, null=True)
    monthlyPrice = models.DecimalField(max_digits=10, decimal_places=2)
    yearly_price = models.DecimalField(max_digits=10, decimal_places=2)
    yearly_billing_text = models.CharField(max_length=100, blank=True, null=True, help_text="e.g., 'Save 20% with annual billing'")
    features = models.JSONField(default=list, help_text="List of features included in this tier")
    badge = models.CharField(max_length=50, blank=True, null=True, help_text="Optional badge text (e.g., 'Popular', 'Best Value')")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['monthlyPrice']
    
    def __str__(self):
        return f"{self.name} - ${self.monthlyPrice}/month"
    
    def get_limits(self):
        """
        Get subscription limits based on tier name.
        Returns dictionary with max_admins, max_branches, max_vehicles.
        None values indicate unlimited.
        """
        limits = {
            'Basic': {
                'max_admins': 3,
                'max_branches': 3,
                'max_vehicles': 50,
            },
            'Pro': {
                'max_admins': 10,
                'max_branches': 10,
                'max_vehicles': 200,
            },
            'Enterprise': {
                'max_admins': None,  # None = unlimited
                'max_branches': None,
                'max_vehicles': None,
            }
        }
        
        # Normalize tier name (case-insensitive)
        tier_name_lower = self.name.lower()
        if 'basic' in tier_name_lower:
            return limits['Basic']
        elif 'pro' in tier_name_lower:
            return limits['Pro']
        elif 'enterprise' in tier_name_lower:
            return limits['Enterprise']
        
        # Default to most restrictive if tier name doesn't match
        return limits['Basic']


class SubscriptionPlan(models.Model):
    """
    Specific subscription plans linked to tiers with billing cycles.
    """
    BILLING_CYCLE_CHOICES = [
        ('monthly', 'Monthly'),
        ('yearly', 'Yearly'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tier = models.ForeignKey(SubscriptionTier, on_delete=models.CASCADE, related_name='plans')
    billing_cycle = models.CharField(max_length=20, choices=BILLING_CYCLE_CHOICES)
    name = models.CharField(max_length=200, blank=True, help_text="Auto-generated from tier and cycle")
    price = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = [['tier', 'billing_cycle']]
        ordering = ['tier', 'billing_cycle']
    
    def __str__(self):
        return f"{self.tier.name} - {self.billing_cycle} (${self.price})"


class FleetSubscription(models.Model):
    """
    Active subscriptions for fleets.
    """
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('pending', 'Pending'),
        ('trialing', 'Trialing'),
        ('past_due', 'Past Due'),
        ('cancelled', 'Cancelled'),
        ('expired', 'Expired'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fleet = models.ForeignKey(Fleet, on_delete=models.CASCADE, related_name='subscriptions')
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.CASCADE, related_name='subscriptions')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    stripe_subscription_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    auto_renew = models.BooleanField(default=True)
    cancellation_date = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True, null=True)
    # Trial period fields
    is_early_adopter = models.BooleanField(default=False, help_text="Whether this subscription is for an early adopter (first 20)")
    trial_days = models.IntegerField(null=True, blank=True, help_text="Number of trial days (60 for early adopters, 30 for others)")
    trial_start_date = models.DateTimeField(null=True, blank=True, help_text="When the trial period started")
    trial_end_date = models.DateTimeField(null=True, blank=True, help_text="When the trial period ends")
    # Payment failure tracking
    payment_failure_count = models.IntegerField(default=0, help_text="Number of consecutive payment failures")
    last_payment_failure_date = models.DateTimeField(null=True, blank=True, help_text="Date of last payment failure")
    grace_period_until = models.DateTimeField(null=True, blank=True, help_text="Grace period end date for payment failures")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['fleet', 'status']),
            models.Index(fields=['stripe_subscription_id']),
        ]
    
    def __str__(self):
        return f"{self.fleet.name} - {self.plan.tier.name} ({self.status})"


class SubscriptionBilling(models.Model):
    """
    Billing history records for fleet subscriptions.
    """
    STATUS_CHOICES = [
        ('paid', 'Paid'),
        ('pending', 'Pending'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subscription = models.ForeignKey(FleetSubscription, on_delete=models.CASCADE, related_name='billing_records')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    billing_date = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    transaction_id = models.CharField(max_length=255, null=True, blank=True, help_text="Stripe PaymentIntent or Invoice ID")
    payment = models.ForeignKey(PaymentTransaction, on_delete=models.SET_NULL, null=True, blank=True, related_name='subscription_billings')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-billing_date']
        indexes = [
            models.Index(fields=['subscription', 'status']),
            models.Index(fields=['transaction_id']),
        ]
    
    def __str__(self):
        return f"Billing {self.id} - {self.subscription.fleet.name} - ${self.amount} ({self.status})"
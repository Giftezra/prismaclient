from django.contrib import admin
from django import forms
from django.db import models
from .models import User, Vehicles, ServiceType, ValetType, DetailerProfile, BookedAppointment, Address, AddOns, Notification, LoyaltyProgram, Promotions


admin.site.site_header = "Prisma Valet Admin"
admin.site.site_title = "Prisma Admin"
admin.site.index_title = "Welcome to Prisma Valet Admin Panel"


# Custom form for ServiceType to handle description as textarea
class ServiceTypeForm(forms.ModelForm):
    description_text = forms.CharField(
        widget=forms.Textarea(attrs={'rows': 4, 'cols': 50}),
        help_text="Enter each service item on a new line. These will be stored as an array.",
        required=False
    )
    
    class Meta:
        model = ServiceType
        fields = '__all__'
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            # Convert JSON array back to text for editing
            if self.instance.description:
                self.fields['description_text'].initial = '\n'.join(self.instance.description)
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        # Convert textarea input to JSON array
        description_text = self.cleaned_data.get('description_text', '')
        if description_text:
            # Split by newlines and filter out empty lines
            description_array = [line.strip() for line in description_text.split('\n') if line.strip()]
            instance.description = description_array
        else:
            instance.description = []
        
        if commit:
            instance.save()
        return instance

# Custom form for ValetType to handle description as textarea
class ValetTypeForm(forms.ModelForm):
    description_text = forms.CharField(
        widget=forms.Textarea(attrs={'rows': 4, 'cols': 50}),
        help_text="Enter the valet service description.",
        required=False
    )
    
    class Meta:
        model = ValetType
        fields = '__all__'
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            # Set the textarea with current description
            self.fields['description_text'].initial = self.instance.description
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        # Get the description from textarea
        instance.description = self.cleaned_data.get('description_text', '')
        
        if commit:
            instance.save()
        return instance


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'phone', 'is_active', 'created_at')
    list_filter = ('is_active', 'is_staff', 'created_at')
    search_fields = ('name', 'email', 'phone')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(Vehicles)
class VehiclesAdmin(admin.ModelAdmin):
    list_display = ('user', 'make', 'model', 'year', 'color', 'licence', 'created_at')
    list_filter = ('make', 'year', 'created_at')
    search_fields = ('user__name', 'make', 'model', 'licence')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(ServiceType)
class ServiceTypeAdmin(admin.ModelAdmin):
    form = ServiceTypeForm
    list_display = ('name', 'price', 'duration')
    list_filter = ('price', 'duration')
    search_fields = ('name',)
    
    def get_fields(self, request, obj=None):
        # Exclude the original description field and use our custom one
        fields = list(super().get_fields(request, obj))
        if 'description' in fields:
            fields.remove('description')
        return fields

@admin.register(ValetType)
class ValetTypeAdmin(admin.ModelAdmin):
    form = ValetTypeForm
    list_display = ('name',)
    search_fields = ('name',)
    
    def get_fields(self, request, obj=None):
        # Exclude the original description field and use our custom one
        fields = list(super().get_fields(request, obj))
        if 'description' in fields:
            fields.remove('description')
        return fields

@admin.register(DetailerProfile)
class DetailerProfileAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone', 'rating', 'created_at')
    list_filter = ('rating', 'created_at')
    search_fields = ('name','phone')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ('user', 'address', 'post_code', 'city', 'country')
    list_filter = ('city', 'country')
    search_fields = ('user__name', 'address', 'city')

@admin.register(BookedAppointment)
class BookedAppointmentAdmin(admin.ModelAdmin):
    list_display = ('user', 'vehicle', 'service_type', 'valet_type', 'appointment_date', 'status', 'total_amount','booking_reference')
    list_filter = ('status', 'appointment_date', 'created_at')
    search_fields = ('user__name', 'vehicle__make', 'vehicle__model', 'booking_reference')
    readonly_fields = ('id', 'booking_date', 'created_at', 'updated_at', 'booking_reference')
    date_hierarchy = 'appointment_date'

@admin.register(AddOns)
class AddOnsAdmin(admin.ModelAdmin):
    list_display = ('name', 'price', 'description', 'extra_duration')
    search_fields = ('name',)
    readonly_fields = ('created_at', 'updated_at')

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'type', 'status', 'message')
    list_filter = ('type', 'status')
    search_fields = ('user__name', 'title')

@admin.register(LoyaltyProgram)
class LoyaltyProgramAdmin(admin.ModelAdmin):
    list_display = ('user', 'current_tier', 'completed_bookings')
    search_fields = ('user__name',)

@admin.register(Promotions)
class PromotionsAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'discount_percentage', 'valid_until', 'is_active', 'terms_conditions')
    search_fields = ('user__name', 'title')

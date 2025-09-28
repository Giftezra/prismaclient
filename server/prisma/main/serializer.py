from rest_framework import serializers
from .models import User, Vehicles, ServiceType, ValetType, DetailerProfile, BookedAppointment, Address, AddOns, LoyaltyProgram, Promotions
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.exceptions import ValidationError   

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'

class VehiclesSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(required=False, allow_null=True, use_url=True)
    class Meta:
        model = Vehicles
        fields = '__all__'

class ServiceTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceType
        fields = '__all__'

class ValetTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ValetType
        fields = '__all__'

class DetailerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = DetailerProfile
        fields = '__all__'

class BookedAppointmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookedAppointment
        fields = '__all__'

class AddOnsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AddOns
        fields = '__all__'

class LoyaltyProgramSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltyProgram
        fields = '__all__'

class PromotionsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Promotions
        fields = '__all__'

""" Customise the token serializer to get the attrs sent from the client 
    This attrs contains the users email and password.
    Returns the users profile data, access and refresh tokens,
    and the users address data if there is any associated adress with the user , else returns null
"""
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        try:
            data = super().validate(attrs)
        except ValidationError as e:
            raise e
        
        user = self.user
        # Check if the user has an address
        address = Address.objects.filter(user=user).first()
        loyalty = LoyaltyProgram.objects.filter(user=user).first()
        loyalty_benefits = loyalty.get_tier_benefits() if loyalty else None
        
        # Add user data to the existing token data
        data.update({
            'user': {
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'phone': user.phone,
                'address': {
                    'address': address.address if address else None,
                    'city': address.city if address else None,
                    'post_code': address.post_code if address else None,
                    'country': address.country if address else None,
                },
                'push_notification_token': user.allow_push_notifications,
                'email_notification_token': user.allow_email_notifications,
                'marketing_email_token': user.allow_marketing_emails,
                'loyalty_tier': loyalty.current_tier if loyalty else None,
                'loyalty_benefits': loyalty_benefits,
                'referral_code': user.referral_code if user.referral_code else None,
            }
        })
        return data
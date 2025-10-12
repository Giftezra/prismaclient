from rest_framework.generics import CreateAPIView
from rest_framework.permissions import AllowAny
from ..serializer import UserSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from ..models import User, Address, LoyaltyProgram
from ..serializer import CustomTokenObtainPairSerializer
from rest_framework.response import Response
from rest_framework import status
from main.tasks import send_welcome_email, send_promotional_email
from time import sleep

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer



class AuthenticationView(CreateAPIView):
    permission_classes = [AllowAny]
    action_handlers = {
        'create_new_account': 'register'
    }

    """ Configure the handler to route the url in the kwargs to point to the correct method.
        If the url sent from the client api does not match any of the url here, a 404 is returned.
        Return {handler} 
    """

    def post(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handlers:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        
        handler = getattr(self, self.action_handlers[action])
        return handler(request)


    
    def register(self, request):
        """ Register a new user by using the data sent from the client.
            The data is sent in the body of the request.
            The data is in the format of {
                "credentials": {
                    "name": "John Doe",
                    "email": "john.doe@example.com",
                    "phone": "1234567890",
                    "password": "password",
                    "referralCode": "ABC123",  # Optional
                    "isFleetOwner": false  # Optional, defaults to false
                }
            }
        """
        try:
            data = request.data.get('credentials')
            referral_code = data.get('referred_code', None)
            is_fleet_owner = data.get('isFleetOwner', False)
            
            # Handle referral if code provided
            referred_by = None
            if referral_code:
                try:
                    referrer = User.objects.get(referral_code=referral_code)
                    referred_by = referrer
                except User.DoesNotExist:
                    return Response({'error': 'Invalid referral code'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Call the user model to create a new user
            user = User.objects.create_user(
                name=data['name'],
                email=data['email'],
                phone=data['phone'],
                password=data['password']
            )
            
            # Set fleet owner status and referral relationship
            user.is_fleet_owner = is_fleet_owner
            if referred_by:
                user.referred_by = referred_by
            user.save()
            # Send the welcome and promotional emails to the user even if they have not allowed them as this is a new user
            send_welcome_email.delay(user.email)
            sleep(60)
            send_promotional_email.delay(user.email, user.name)
            
            # Generate tokens for the newly created user
            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            refresh_token = str(refresh)
            
            # Get user address data (if any)
            address = Address.objects.filter(user=user).first()
            loyalty = LoyaltyProgram.objects.filter(user=user).first()
            loyalty_benefits = loyalty.get_tier_benefits() if loyalty else None
       
            return Response({
                'message': 'Welcome to PRISMA VALLET. Your account has been created successfully.\n\nPlease check your email for further updates',
                'user': {
                    'name': user.name,
                    'email': user.email,
                    'phone': user.phone,
                    'is_fleet_owner': user.is_fleet_owner,
                    'address': {
                        'address': address.address if address else None,
                        'city': address.city if address else None,
                        'post_code': address.post_code if address else None,
                        'country': address.country if address else None,
                    },
                    'loyalty_tier': loyalty.current_tier if loyalty else None,
                    'loyalty_benefits': loyalty_benefits,
                    'referral_code': user.referral_code if user.referral_code else None,
                },
                'access': access_token,
                'refresh': refresh_token
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

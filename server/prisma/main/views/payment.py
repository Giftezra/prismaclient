
from rest_framework.response import Response
from rest_framework import status
import stripe
from django.conf import settings
from rest_framework.permissions import IsAuthenticated
from datetime import datetime, timedelta, timezone
from rest_framework.views import APIView
from main.models import User

# Initialize Stripe with your secret key
stripe.api_key = settings.STRIPE_SECRET_KEY


class PaymentView(APIView):
    permission_classes = [IsAuthenticated]


    def post(self, request, *args, **kwargs):
        return self.create_payment_sheet(request)

    def create_payment_sheet(self, request):
        """
        Create a payment sheet for Stripe payment processing.
        
        Creates a Stripe payment intent and ephemeral key for client-side payment processing.
        """
        try:
            country = request.user.addresses.first().country
            # set the currency based on the country
            if country == 'United Kingdom':
                currency = 'gbp'
            else:
                currency = 'eur'

            # set the merchant country code based on the country
            if country == 'United Kingdom':
                merchant_country_code = 'GB'
            else:
                merchant_country_code = 'EUR'

            # Get amount and metadata from request
            amount = request.data.get('amount', 0)
            metadata = request.data.get('metadata', {})
            plan_id = metadata.get('plan_id', None)
            billing_period = metadata.get('billing_period', None)

            # Get the company object associated with the user
            user = User.objects.get(id=request.user.id)
            
            # Create Stripe customer
            customer = stripe.Customer.create()
            
            # Create payment intent with calculated amount
            payment_intent = stripe.PaymentIntent.create(
                amount=amount,  # Amount in cents from the frontend
                currency=currency,
                customer=customer.id,
                automatic_payment_methods={
                    'enabled': True,
                },
                googlePay={
                    'merchantCountryCode': merchant_country_code,
                    'currencyCode': currency,
                },
                applePay={
                    'merchantCountryCode': merchant_country_code,
                    'currencyCode': currency,
                },
                metadata={
                    'user_id': user.id,
                    'plan_id': plan_id,
                    'billing_period': billing_period,
                    'user_id': request.user.id,
                }
            )
            
            # Create ephemeral key for client-side access
            ephemeral_key = stripe.EphemeralKey.create(
                customer=customer.id,
                stripe_version='2022-11-15',
            )
            
            return Response({
                'paymentIntent': payment_intent.client_secret,
                'ephemeralKey': ephemeral_key.secret,
                'customer': customer.id,
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        

    def stripe_webhook(self, request):
        """
        Handle Stripe webhook events.
        
        Processes payment success events and updates subscription plans accordingly.
        """
        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
        
        try:
            # Verify webhook signature
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
            
            # Handle payment success events
            if event['type'] == 'payment_intent.succeeded':
                payment_intent = event['data']['object']
                metadata = payment_intent.metadata
                
                try:
                    # Get company and tier from metadata
                    billing_period = metadata.get('billing_period')
                    
                    # Calculate dates
                    start_date = timezone.now().date()
                    renewal_date = start_date + timedelta(
                        days=365 if billing_period == 'annually' else 30
                    )
                    
                    # Deactivate existing active plan
                    SubscriptionPlan.objects.filter(
                        company=company, 
                        is_active=True
                    ).update(is_active=False)
                    
                    # Create new subscription plan
                    new_plan = SubscriptionPlan.objects.create(
                        company=company,
                        tier=tier,
                        billing_cycle=billing_period,
                        start_date=start_date,
                        renewal_date=renewal_date,
                        is_active=True,
                    )
                        
                    # Create history record
                    SubscriptionHistory.objects.create(
                        subscription=new_plan,
                        start_date=start_date,
                        renewal_date=renewal_date,
                        is_active=True
                    )
                    
                    return Response({'status': 'subscription updated'}, status=200)
                    
                except Exception as e:
                    print(f"Error processing webhook: {str(e)}")
                    return Response({'error': str(e)}, status=200)
                    
            return Response({'status': 'event processed'}, status=200)
            
        except ValueError as e:
            return Response({'error': 'Invalid payload'}, status=400)
        except stripe.error.SignatureVerificationError as e:
            return Response({'error': 'Invalid signature'}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
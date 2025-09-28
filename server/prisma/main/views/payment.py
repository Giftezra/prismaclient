from rest_framework.response import Response
from rest_framework import status
from main.tasks import send_push_notification
import stripe
from django.conf import settings
from rest_framework.permissions import IsAuthenticated, AllowAny
from datetime import datetime, timedelta, timezone
from rest_framework.views import APIView
from main.models import User, BookedAppointment, PaymentTransaction, RefundRecord, Address
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.http import JsonResponse
from django.views import View

# Initialize Stripe with your secret key
stripe.api_key = settings.STRIPE_SECRET_KEY


class PaymentView(APIView):
    # Remove authentication requirement for webhook
    permission_classes = [AllowAny]  # Webhooks don't use authentication

    action_handlers = {
        'create_payment_sheet' : 'create_payment_sheet',
        'get_refund_status' : 'get_refund_status',
    }

    def get(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handlers:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handlers[action])
        return handler(request)
    
    def post(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handlers:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handlers[action])
        return handler(request)


    def create_payment_sheet(self, request):
        """
        Create a payment sheet for Stripe payment processing.
        
        Creates a Stripe payment intent and ephemeral key for client-side payment processing.
        """
        try:
            # Get the country from the users addresses 
            try:
                address = Address.objects.filter(user=request.user).first()
                if address:
                    country = address.country
                else:
                    country = 'United Kingdom'
            except Exception as e:
                print(f"Error getting address: {e}")
                country = 'United Kingdom'

            # set the currency and merchant country code based on the country
            if country == 'United Kingdom':
                currency = 'gbp'
                merchant_country_code = 'GB'
            else:
                currency = 'eur'
                merchant_country_code = 'EUR'

            # Get amount and metadata from request
            amount = request.data.get('amount', 0)
            metadata = request.data.get('metadata', {})
            booking_reference = request.data.get('booking_reference')
            
            if not booking_reference:
                return Response({'error': 'Booking reference required'}, status=400)

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
                    'booking_reference': booking_reference,
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
        
    def get_refund_status(self, request):
        """Get refund status for a booking - useful for dispute resolution"""
        try:
            booking_reference = request.data.get('booking_reference')
            booking = BookedAppointment.objects.get(booking_reference=booking_reference)
            
            refunds = RefundRecord.objects.filter(booking=booking).order_by('-created_at')
            
            refund_data = []
            for refund in refunds:
                refund_data.append({
                    'id': refund.id,
                    'requested_amount': float(refund.requested_amount),
                    'status': refund.status,
                    'stripe_refund_id': refund.stripe_refund_id,
                    'failure_reason': refund.failure_reason,
                    'admin_notes': refund.admin_notes,
                    'dispute_resolved': refund.dispute_resolved,
                    'created_at': refund.created_at,
                    'processed_at': refund.processed_at
                })
            
            return Response({
                'booking_reference': booking_reference,
                'refunds': refund_data
            }, status=status.HTTP_200_OK)
            
        except BookedAppointment.DoesNotExist:
            return Response({'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class StripeWebhookView(View):
    """
    Dedicated webhook view that's CSRF exempt
    """
    def post(self, request, *args, **kwargs):
        # Initialize Stripe with your secret key
        stripe.api_key = settings.STRIPE_SECRET_KEY
        
        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
        
        try:
            # Verify webhook signature
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
            
            print(f"Event type: {event['type']}")
            
            # Handle payment success events
            if event['type'] == 'payment_intent.succeeded':
                payment_intent = event['data']['object']
                metadata = payment_intent.metadata
                print(f"Metadata: {metadata}")
                try:
                    # Get booking reference from metadata
                    booking_reference = metadata.get('booking_reference')
                    if not booking_reference:
                        return JsonResponse({'error': 'No booking reference in metadata'}, status=400)
                    
                    # Get the booking
                    booking = BookedAppointment.objects.get(booking_reference=booking_reference)
                    
                    # Check if PaymentTransaction already exists to avoid duplicates
                    existing_transaction = PaymentTransaction.objects.filter(
                        booking=booking,
                        stripe_payment_intent_id=payment_intent.id
                    ).first()
                    
                    if not existing_transaction:
                        # Create payment transaction record
                        PaymentTransaction.objects.create(
                            booking=booking,
                            user=booking.user,
                            stripe_payment_intent_id=payment_intent.id,
                            transaction_type='payment',
                            amount=payment_intent.amount / 100,  # Convert from cents
                            currency=payment_intent.currency,
                            status='succeeded'
                        )
                        print(f"Payment transaction created for booking: {booking_reference}")
                    else:
                        print(f"Payment transaction already exists for booking: {booking_reference}")
                    booking.save()
                    
                    print(f"Payment recorded for booking: {booking_reference}")
                    return JsonResponse({'status': 'payment recorded'}, status=200)
                    
                except BookedAppointment.DoesNotExist:
                    print(f"Booking not found: {booking_reference}")
                    return JsonResponse({'error': 'Booking not found'}, status=400)
                except Exception as e:
                    print(f"Error processing webhook: {str(e)}")
                    return JsonResponse({'error': str(e)}, status=400)
            
            # Handle refund events
            elif event['type'] == 'charge.dispute.created':
                # Handle disputes
                dispute = event['data']['object']
                self._handle_dispute(dispute)
                
            elif event['type'] == 'charge.refunded':
                # Refund succeeded
                refund = event['data']['object']
                self._handle_refund_success(refund)

            elif event['type'] == 'charge.updated':
                # Refund updated
                refund = event['data']['object']
                self._handle_refund_updated(refund)
                
            elif event['type'] == 'charge.failed':
                # Refund failed
                refund = event['data']['object']
                self._handle_refund_failure(refund)
            
            print(f"Event processed: {event['type']}")
            return JsonResponse({'status': 'event processed'}, status=200)
            
        except ValueError as e:
            print(f"ValueError: {str(e)}")
            return JsonResponse({'error': 'Invalid payload'}, status=400)
        except stripe.error.SignatureVerificationError as e:
            print(f"Signature verification error: {str(e)}")
            return JsonResponse({'error': 'Invalid signature'}, status=400)
        except Exception as e:
            print(f"Unexpected error: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)


    def _handle_refund_updated(self, refund):
        print(f"Handling refund updated: {refund}")
        """Handle updated refunds"""
        # try:
        #     refund_record = RefundRecord.objects.filter(
        #         stripe_refund_id=refund.id
        #     ).first()
            
        #     if refund_record:
        #         refund_record.status = 'updated'
        #         refund_record.admin_notes = f"Refund updated: {refund.reason}"
        #         refund_record.save()
                
        #         print(f"Refund updated email queued for user {refund_record.user.email}")
        # except Exception as e:
        #     print(f"Error handling refund updated: {str(e)}")

    def _handle_dispute(self, dispute):
        print(f"Handling dispute: {dispute}")
        """Handle charge disputes"""
        try:
            # Find the refund record by metadata
            refund_record = RefundRecord.objects.filter(
                stripe_refund_id=dispute.charge
            ).first()
            
            if refund_record:
                refund_record.status = 'disputed'
                refund_record.admin_notes = f"Dispute created: {dispute.reason}"
                refund_record.save()

                # Send the dispute created email and notification to the user
                
        except Exception as e:
            print(f"Error handling dispute: {str(e)}")

    def _handle_refund_success(self, refund):
        print(f"Handling refund success: {refund}")
        """Handle successful refunds"""
        try:
            refund_record = RefundRecord.objects.filter(
                stripe_refund_id=refund.id
            ).first()
            
            if refund_record and refund_record.status == 'pending':
                refund_record.status = 'succeeded'
                refund_record.processed_at = timezone.now()
                refund_record.save()
                
                # Send the refund success email to the user
                from main.tasks import send_refund_success_email
                send_refund_success_email.delay(
                    user_email=refund_record.user.email,
                    customer_name=refund_record.user.name,
                    booking_reference=refund_record.booking.booking_reference,
                    original_date=refund_record.booking.appointment_date,
                    vehicle_make=refund_record.booking.vehicle.make,
                    vehicle_model=refund_record.booking.vehicle.model,
                    service_type_name=refund_record.booking.service_type.name,
                    refund_amount=float(refund_record.requested_amount),
                    refund_date=timezone.now()
                )
                
                print(f"Refund success email queued for user {refund_record.user.email}")
        except Exception as e:
            print(f"Error handling refund success: {str(e)}")

    def _handle_refund_failure(self, refund):
        print(f"Handling refund failure: {refund}")
        """Handle failed refunds"""
        try:
            refund_record = RefundRecord.objects.filter(
                stripe_refund_id=refund.id
            ).first()
            
            if refund_record:
                refund_record.status = 'failed'
                refund_record.failure_reason = refund.failure_reason or "Unknown failure"
                refund_record.processed_at = timezone.now()
                refund_record.save()
                
                # Send the refund failed email to the user
                # from main.tasks import send_refund_failed_email
                # send_refund_failed_email.delay(
                #     user_email=refund_record.user.email,
                #     customer_name=refund_record.user.name,
                #     booking_reference=refund_record.booking.booking_reference,
                #     original_date=refund_record.booking.appointment_date,
                #     vehicle_make=refund_record.booking.vehicle.make,
                #     vehicle_model=refund_record.booking.vehicle.model,
                #     service_type_name=refund_record.booking.service_type.name,
                #     refund_amount=float(refund_record.requested_amount),
                #     failure_reason=refund.failure_reason or "Unknown failure"
                # )
                
                print(f"Refund failure email queued for user {refund_record.user.email}")
                
        except Exception as e:
            print(f"Error handling refund failure: {str(e)}")
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
import logging
import json

# Initialize Stripe with your secret key
stripe.api_key = settings.STRIPE_SECRET_KEY


class PaymentView(APIView):
    permission_classes = [IsAuthenticated]

    action_handlers = {
        'create_payment_sheet' : 'create_payment_sheet',
        'get_refund_status' : 'get_refund_status',
        'check_payment_status' : 'check_payment_status',
        'confirm_payment_intent' : 'confirm_payment_intent',
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
        logger = logging.getLogger('main.views.payment')
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
                return Response({'error': 'Booking reference required'}, status=status.HTTP_400_BAD_REQUEST)

            user = User.objects.get(id=request.user.id)
            
            # Get or create Stripe customer
            if hasattr(user, 'stripe_customer_id') and user.stripe_customer_id:
                # Use existing customer
                customer = stripe.Customer.retrieve(user.stripe_customer_id)
            else:
                # Create new customer and save the ID
                customer = stripe.Customer.create(
                    email=user.email,
                    name=user.name,
                    metadata={
                        'user_id': user.id,
                    }
                )
                # Only save if the field exists (migration has been run)
                if hasattr(user, 'stripe_customer_id'):
                    user.stripe_customer_id = customer.id
                    user.save()
                logger.info(f"Created new Stripe customer: {customer.id}")
            
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
                # Enable setup for future payments
                setup_future_usage='off_session',
                metadata={
                    'user_id': str(user.id),
                    'booking_reference': booking_reference,
                }
            )
            
            logger.info(f"Created payment intent: {payment_intent.id} for booking: {booking_reference}")
            
            # Create ephemeral key for client-side access
            ephemeral_key = stripe.EphemeralKey.create(
                customer=customer.id,
                stripe_version='2022-11-15',
            )
            
            return Response({
                'paymentIntent': payment_intent.client_secret,
                'paymentIntentId': payment_intent.id,
                'ephemeralKey': ephemeral_key.secret,
                'customer': customer.id,
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error creating payment sheet: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
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

    def confirm_payment_intent(self, request):
        """Check if payment intent has been confirmed via webhook (for polling)"""
        logger = logging.getLogger('main.views.payment')
        
        try:
            payment_intent_id = request.data.get('payment_intent_id')
            if not payment_intent_id:
                return Response({'error': 'payment_intent_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            logger.info(f"Checking payment confirmation for payment intent: {payment_intent_id}")
            
            # Check if PaymentTransaction exists for this payment intent
            payment_transaction = PaymentTransaction.objects.filter(
                stripe_payment_intent_id=payment_intent_id,
                transaction_type='payment',
                status='succeeded'
            ).first()
            
            if payment_transaction:
                logger.info(f"Payment confirmed - transaction ID: {payment_transaction.id}")
                return Response({
                    'confirmed': True,
                    'payment_intent_id': payment_intent_id,
                    'transaction_id': str(payment_transaction.id),
                    'booking_reference': payment_transaction.booking_reference,
                }, status=status.HTTP_200_OK)
            else:
                logger.info(f"Payment not yet confirmed for payment intent: {payment_intent_id}")
                return Response({
                    'confirmed': False,
                    'payment_intent_id': payment_intent_id,
                }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error confirming payment intent: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def check_payment_status(self, request):
        """Check payment status for a booking - useful for debugging"""
        logger = logging.getLogger('main.views.payment')
        
        try:
            booking_reference = request.data.get('booking_reference')
            payment_intent_id = request.data.get('payment_intent_id')
            
            # If payment_intent_id is provided, check by that first (works before booking exists)
            if payment_intent_id:
                logger.info(f"Checking payment status for payment intent: {payment_intent_id}")
                payment_transaction = PaymentTransaction.objects.filter(
                    stripe_payment_intent_id=payment_intent_id,
                    transaction_type='payment'
                ).first()
                
                if payment_transaction:
                    return Response({
                        'payment_intent_id': payment_intent_id,
                        'has_payment': payment_transaction.status == 'succeeded',
                        'payment_status': payment_transaction.status,
                        'amount': float(payment_transaction.amount),
                        'currency': payment_transaction.currency,
                        'transaction_id': str(payment_transaction.id),
                    }, status=status.HTTP_200_OK)
                else:
                    return Response({
                        'payment_intent_id': payment_intent_id,
                        'has_payment': False,
                        'payment_status': 'not_found',
                    }, status=status.HTTP_200_OK)
            
            # Fall back to booking_reference lookup
            if not booking_reference:
                return Response({'error': 'booking_reference or payment_intent_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            logger.info(f"Checking payment status for booking: {booking_reference}")
            
            booking = BookedAppointment.objects.get(booking_reference=booking_reference)
            logger.info(f"Found booking: {booking.id}, user: {booking.user.id}, total_amount: {booking.total_amount}")
            
            # Check for payment transactions
            payment_transactions = PaymentTransaction.objects.filter(
                booking=booking,
                transaction_type='payment'
            ).order_by('-created_at')
            
            logger.info(f"Found {payment_transactions.count()} payment transactions for booking")
            
            payment_data = []
            for transaction in payment_transactions:
                payment_data.append({
                    'id': transaction.id,
                    'stripe_payment_intent_id': transaction.stripe_payment_intent_id,
                    'amount': float(transaction.amount),
                    'currency': transaction.currency,
                    'status': transaction.status,
                    'created_at': transaction.created_at,
                    'processed_at': transaction.processed_at
                })
                logger.info(f"Payment transaction: {transaction.id} - {transaction.status} - {transaction.amount} {transaction.currency}")
            
            return Response({
                'booking_reference': booking_reference,
                'booking_id': booking.id,
                'booking_total_amount': float(booking.total_amount),
                'has_payment': payment_transactions.filter(status='succeeded').exists(),
                'payment_transactions': payment_data,
                'successful_payments': payment_transactions.filter(status='succeeded').count()
            }, status=status.HTTP_200_OK)
            
        except BookedAppointment.DoesNotExist:
            logger.error(f"Booking not found: {booking_reference}")
            return Response({'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error checking payment status: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class StripeWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    
    def post(self, request, *args, **kwargs):
        print(f"Received Stripe webhook request: {request.body}")
        logger = logging.getLogger('main.views.payment')

        try:
            payload = request.body
            event = json.loads(payload)
            event_type = event.get('type')
            
            logger.info(f"Stripe webhook event type: {event_type}")
            print(f"Received Stripe webhook event: {event_type}")
            
            # Handle payment success events
            if event_type == 'payment_intent.succeeded':
                payment_intent = event['data']['object']
                metadata = payment_intent.get('metadata', {})
                
                logger.info(f"Payment intent succeeded - ID: {payment_intent.get('id')}")
                logger.info(f"Payment intent amount: {payment_intent.get('amount')} {payment_intent.get('currency')}")
                logger.info(f"Payment intent metadata: {metadata}")
                
                try:
                    # Get booking reference and user_id from metadata
                    booking_reference = metadata.get('booking_reference')
                    user_id = metadata.get('user_id')
                    
                    logger.info(f"Booking reference from metadata: {booking_reference}")
                    logger.info(f"User ID from metadata: {user_id}")
                    
                    if not booking_reference:
                        logger.error("No booking reference found in payment intent metadata")
                        return Response({'error': 'No booking reference in metadata'}, status=status.HTTP_400_BAD_REQUEST)
                    
                    if not user_id:
                        logger.error("No user_id found in payment intent metadata")
                        return Response({'error': 'No user_id in metadata'}, status=status.HTTP_400_BAD_REQUEST)
                    
                    # Check if PaymentTransaction already exists to avoid duplicates
                    payment_intent_id = payment_intent.get('id')
                    existing_transaction = PaymentTransaction.objects.filter(
                        stripe_payment_intent_id=payment_intent_id
                    ).first()
                    
                    if existing_transaction:
                        logger.warning(f"Payment transaction already exists for payment intent: {payment_intent_id}, transaction ID: {existing_transaction.id}")
                        return Response({'status': 'payment already recorded'}, status=status.HTTP_200_OK)
                    
                    # Get user from metadata
                    try:
                        user = User.objects.get(id=user_id)
                        logger.info(f"Found user: {user.id}")
                    except User.DoesNotExist:
                        logger.error(f"User not found for ID: {user_id}")
                        return Response({'error': 'User not found'}, status=status.HTTP_400_BAD_REQUEST)
                    
                    # Try to get booking if it exists (may not exist yet)
                    booking = None
                    try:
                        booking = BookedAppointment.objects.get(booking_reference=booking_reference)
                        logger.info(f"Found booking: {booking.id}, user: {booking.user.id}, amount: {booking.total_amount}")
                    except BookedAppointment.DoesNotExist:
                        logger.info(f"Booking not yet created for reference: {booking_reference} - will create payment transaction without booking")
                    
                    # Safely get payment method details (may not exist)
                    last_4_digits = None
                    card_brand = None
                    try:
                        payment_method_details = payment_intent.get('payment_method_details', {})
                        card_details = payment_method_details.get('card', {})
                        last_4_digits = card_details.get('last4')
                        card_brand = card_details.get('brand')
                    except (AttributeError, KeyError, TypeError) as e:
                        logger.warning(f"Could not extract card details: {str(e)}")
                    
                    # Create payment transaction record (booking may be None)
                    logger.info(f"Creating payment transaction for booking reference: {booking_reference}")
                    payment_transaction = PaymentTransaction.objects.create(
                        booking=booking,  # May be None if booking doesn't exist yet
                        user=user,
                        booking_reference=booking_reference,
                        stripe_payment_intent_id=payment_intent_id,
                        transaction_type='payment',
                        amount=payment_intent.get('amount', 0) / 100,  # Convert from cents
                        currency=payment_intent.get('currency', 'gbp'),
                        last_4_digits=last_4_digits,
                        card_brand=card_brand,
                        status='succeeded'
                    )
                    logger.info(f"Payment transaction created successfully: {payment_transaction.id}")
                    logger.info(f"Payment transaction details - Amount: {payment_transaction.amount}, Currency: {payment_transaction.currency}, Status: {payment_transaction.status}")
                    
                    # If booking exists, save it to trigger any signals
                    if booking:
                        booking.save()
                        logger.info(f"Booking saved after payment transaction creation")
                    
                    logger.info(f"Payment recorded successfully for booking reference: {booking_reference}")
                    return Response({'status': 'payment recorded'}, status=status.HTTP_200_OK)
                    
                except Exception as e:
                    logger.error(f"Error processing payment webhook: {str(e)}")
                    import traceback
                    logger.error(f"Traceback: {traceback.format_exc()}")
                    return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            
            # Handle refund events
            elif event_type == 'charge.dispute.created':
                logger.info(f"Handling dispute created event")
                dispute = event['data']['object']
                self._handle_dispute(dispute)
                
            elif event_type == 'charge.refunded':
                logger.info(f"Handling refund succeeded event")
                refund = event['data']['object']
                self._handle_refund_success(refund)

            elif event_type == 'charge.updated':
                logger.info(f"Handling charge updated event")
                refund = event['data']['object']
                self._handle_refund_updated(refund)
                
            elif event_type == 'charge.failed':
                logger.info(f"Handling charge failed event")
                refund = event['data']['object']
                self._handle_refund_failure(refund)
            
            else:
                logger.info(f"Unhandled Stripe event type: {event_type}")
                return Response({
                    'status': 'success',
                    'message': f'Received {event_type}',
                    'event_type': event_type
                }, status=status.HTTP_200_OK)
            
            logger.info(f"Stripe event processed successfully: {event_type}")
            return Response({'status': 'event processed'}, status=status.HTTP_200_OK)
            
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON payload: {str(e)}")
            return Response({'error': 'Invalid payload'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Unexpected error in webhook: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
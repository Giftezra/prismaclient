from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from main.models import BookedAppointment,ServiceType, ValetType, AddOns, Address, DetailerProfile, Vehicles, Promotions, PaymentTransaction, RefundRecord, User
import stripe
from django.conf import settings
from datetime import datetime
from django.utils import timezone
from main.tasks import publish_booking_cancelled, publish_booking_rescheduled, send_push_notification

# Initialize Stripe with your secret key
stripe.api_key = settings.STRIPE_SECRET_KEY

""" The view is used to define the structure of the booking api for the client.  """
class BookingView(APIView):
    permission_classes = [IsAuthenticated]
    """ Action handlers designed to route the url to the appropriate function """
    action_handlers = {
        'get_service_type' : 'get_service_type',
        'get_valet_type' : 'get_valet_type',
        'book_appointment' : '_book_appointment',
        'cancel_booking' : 'cancel_booking',
        'reschedule_booking' : 'reschedule_booking',
        'get_add_ons' : 'get_add_ons',
        'get_promotions' : 'get_promotions',
        'create_payment_sheet' : 'create_payment_sheet',
        'get_payment_methods' : 'get_payment_methods',
        'delete_payment_method' : 'delete_payment_method',
    }
    
    """ Here we will override the crud methods and define the methods that would route the url to the appropriate function """
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
    
    def patch(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handlers:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handlers[action])
        return handler(request)

    def delete(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handlers:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handlers[action])
        return handler(request)



    def get_promotions(self, request):
        """ Get the promotions for the user.
            ARGS : void
            RESPONSE : PromotionsProps or null
        """
        try:
            promotions = Promotions.objects.filter(user=request.user, is_active=True).first()
            if promotions:
                promotions_data = {
                    "id" : str(promotions.id),
                    "title" : promotions.title,
                    "discount_percentage" : promotions.discount_percentage,
                    "valid_until" : promotions.valid_until.strftime('%Y-%m-%d'),
                    "is_active" : promotions.is_active,
                    "terms_conditions" : promotions.terms_conditions,
                }
                return Response(promotions_data, status=status.HTTP_200_OK)
            else:
                return Response(None, status=status.HTTP_200_OK)
        except Exception as e:
            print(f"Error fetching promotions: {str(e)}")
            return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            

    def get_service_type(self, request):
        try:
            service_type = ServiceType.objects.all().order_by('price')
            service_type_data = []
            # Here we could use the serializer to get the data in the proper format,
            # but i always prefer to destructure it manually
            for service in service_type:
                service_items = {
                    "id" : service.id,
                    "name" : service.name,
                    "description" : service.description,
                    "price" : service.price,
                    "duration" : service.duration
                }
                service_type_data.append(service_items)
            return Response(service_type_data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        
    def get_valet_type(self, request):
        """ Get the valet type predefined by the admin in the system.
            ARGS : void
            RESPONSE : ValetTypeProps[]
            {
                id : string
                name : string
                description : string
            }
        """
        try:
            valet_type = ValetType.objects.all()
            valet_type_data = []
            for valet in valet_type:
                valet_items = {
                    "id" : valet.id,
                    "name" : valet.name,
                    "description" : valet.description
                }
                valet_type_data.append(valet_items)
            return Response(valet_type_data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    


    def cancel_booking(self, request):
        booking_reference = request.data.get('booking_reference')
        try:
            booking = BookedAppointment.objects.get(booking_reference=booking_reference)
            
            # Check if booking can be cancelled - only allow if not completed, cancelled, or in progress
            if booking.status in ['completed', 'cancelled', 'in_progress']:
                if booking.status == 'in_progress':
                    return Response({'error': 'Cannot cancel - service is already in progress'}, 
                                  status=status.HTTP_400_BAD_REQUEST)
                else:
                    return Response({'error': 'Booking cannot be cancelled'}, 
                                  status=status.HTTP_400_BAD_REQUEST)
            
            # Calculate time until appointment
            now = timezone.now()
            appointment_datetime = timezone.make_aware(
                timezone.datetime.combine(booking.appointment_date, booking.start_time or timezone.datetime.min.time())
            )
            hours_until_appointment = (appointment_datetime - now).total_seconds() / 3600
            
            # New refund rule: Only refund if cancelled MORE than 12 hours before appointment
            # Allow cancellation within 12 hours but no refund
            refund_eligible = hours_until_appointment > 12
            
            # Update booking status
            booking.status = 'cancelled'
            booking.save()
            
            # Publish to Redis for detailer app updates (only once)
            publish_booking_cancelled.delay(booking_reference)
            
            refund_data = {'eligible': refund_eligible, 'amount': 0, 'processed': False}
            
            # Process refund if eligible (only outside 12-hour window)
            if refund_eligible:
                refund_result = self._process_refund(booking)
                refund_data.update(refund_result)
            
            # Prepare response message based on refund eligibility
            vehicle_name = f"{booking.vehicle.make} {booking.vehicle.model}"
            message = f'You have cancelled your booking for {vehicle_name} on {booking.appointment_date}'
            
            if refund_eligible and refund_data['processed']:
                message += f"\n\nRefund of £{refund_data['amount']} has been processed and will appear in your account within 3-5 business days."
                
                # Send push notification for refunded cancellation
                send_push_notification.delay(
                    request.user.id,
                    "Booking Cancelled - Refund Processed!",
                    f"Your valet service has been cancelled for {booking.appointment_date} at {booking.start_time}. You will be refunded within 3-5 business days.",
                    "booking_cancelled_refunded"
                )
            else:
                message += f"\n\nNo refund available - cancellation was within 12 hours of appointment start time."
                
                # Send push notification for non-refunded cancellation
                send_push_notification.delay(
                    request.user.id,
                    "Booking Cancelled",
                    f"Your valet service has been cancelled for {booking.appointment_date} at {booking.start_time}. No refund available due to late cancellation.",
                    "booking_cancelled_no_refund"
                )
            
            return Response({
                'message': message,
                'booking_status': 'cancelled',
                'refund': refund_data,
                'hours_until_appointment': hours_until_appointment
            }, status=status.HTTP_200_OK)
            
        except BookedAppointment.DoesNotExist:
            return Response({'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




    def _process_refund(self, booking):
        """Process refund through Stripe with proper status tracking"""
        try:
            # Get the original payment transaction
            original_transaction = PaymentTransaction.objects.filter(
                booking=booking,
                transaction_type='payment',
                status='succeeded'
            ).first()
            
            if not original_transaction:
                return {'processed': False, 'error': 'No payment found'}
            
            # Create refund record first
            refund_record = RefundRecord.objects.create(
                booking=booking,
                user=booking.user,
                original_transaction=original_transaction,
                requested_amount=original_transaction.amount,
                status='pending'
            )
            
            try:
                # Create refund with Stripe
                refund = stripe.Refund.create(
                    payment_intent=original_transaction.stripe_payment_intent_id,
                    amount=int(original_transaction.amount * 100),  # Convert to cents
                    reason='requested_by_customer',
                    metadata={
                        'booking_reference': booking.booking_reference,
                        'refund_reason': 'Booking cancelled within 12 hours',
                        'refund_record_id': str(refund_record.id)
                    }
                )
                
                # Update refund record with success
                refund_record.stripe_refund_id = refund.id
                refund_record.status = 'succeeded'
                refund_record.processed_at = timezone.now()
                refund_record.save()
                
                # Create refund transaction record
                PaymentTransaction.objects.create(
                    booking=booking,
                    user=booking.user,
                    stripe_payment_intent_id=original_transaction.stripe_payment_intent_id,
                    stripe_refund_id=refund.id,
                    transaction_type='refund',
                    amount=original_transaction.amount,
                    currency=original_transaction.currency,
                    status='succeeded'
                )
                
                return {
                    'processed': True,
                    'amount': float(original_transaction.amount),
                    'refund_id': refund.id,
                    'refund_record_id': refund_record.id
                }
                
            except stripe.error.StripeError as e:
                # Update refund record with failure
                refund_record.status = 'failed'
                refund_record.failure_reason = str(e)
                refund_record.processed_at = timezone.now()
                refund_record.save()
                
                return {
                    'processed': False, 
                    'error': str(e),
                    'refund_record_id': refund_record.id
                }
                
        except Exception as e:
            print(f"Refund processing error: {str(e)}")
            return {'processed': False, 'error': str(e)}



    def reschedule_booking(self, request):
        """ Reschedule a booking for the user.
            ARGS : void
            RESPONSE : void
            QUERY_PARAMS : booking_id : string
        """

        try:
            data = request.data.get('data')
            booking = BookedAppointment.objects.get(id=data.get('booking_id'))
            booking.appointment_date = data.get('new_date')
            booking.start_time = data.get('new_time')
            booking.total_amount = data.get('total_cost')
            booking.status = 'pending'
            booking.save()
            publish_booking_rescheduled.delay(booking.booking_reference, booking.appointment_date, booking.start_time, booking.total_amount)

            # Send booking rescheduled notification
            send_push_notification.delay(
                request.user.id,
                "Booking Rescheduled! 📅",
                f"Your valet service has been rescheduled for {booking.appointment_date} at {booking.start_time}",
                "booking_rescheduled"
            )

            vehicle_name = f"{booking.vehicle.make} {booking.vehicle.model}"
            return Response({'message': f'You have rescheduled your booking for {vehicle_name} on {booking.appointment_date}'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    

    def _book_appointment(self, request):
        """ Create a booking and assign the booking to the user from the country.
            ARGs: CreateBookingProps

            RESPONSE: {
                appointment_id: string
            }
        """
        try:
            # Get the booking data from the request
            booking_data = request.data.get('booking_data', request.data)

            detailer = DetailerProfile.objects.create(
                name = booking_data.get('detailer', {}).get('name'),
                phone = booking_data.get('detailer', {}).get('phone'),
                rating = booking_data.get('detailer', {}).get('rating'),
            )
            
            # Get existing objects by ID
            vehicle = Vehicles.objects.get(id=booking_data.get('vehicle', {}).get('id'))
            valet_type = ValetType.objects.get(id=booking_data.get('valet_type', {}).get('id'))
            service_type = ServiceType.objects.get(id=booking_data.get('service_type', {}).get('id'))
            address = Address.objects.get(id=booking_data.get('address', {}).get('id'))
            
            # Convert date string to date object
            appointment_date = datetime.strptime(booking_data.get('date'), '%Y-%m-%d').date()
            
            # Convert start_time string to time object
            start_time = None
            if booking_data.get('start_time'):
                start_time = datetime.strptime(booking_data.get('start_time'), '%H:%M:%S.%f').time()
            # Create the booking in the database
            appointment = BookedAppointment.objects.create(
                user = request.user,
                appointment_date = appointment_date,
                vehicle = vehicle,
                valet_type = valet_type,
                service_type = service_type,
                detailer = detailer,
                address = address,
                status = booking_data.get('status'),
                total_amount = booking_data.get('total_amount'),
                start_time = start_time,
                duration = booking_data.get('duration'),
                special_instructions = booking_data.get('special_instructions'),
                booking_reference = booking_data.get('booking_reference')
            )
            # Add add-ons if any
            addons_data = booking_data.get('addons', [])
            if addons_data:
                addon_ids = [addon.get('id') for addon in addons_data]
                addons = AddOns.objects.filter(id__in=addon_ids)
                appointment.add_ons.set(addons)
            appointment.save()

            # Send booking confirmation notification
            send_push_notification.delay(
                request.user.id,
                "Booking Assigned! 🎉",
                f"Your valet service has been assigned to one of our detailers for {appointment.appointment_date} at {appointment.start_time}. Please wait for confirmation.",
                "booking_assigned"
            )

            return Response({'appointment_id': str(appointment.id)}, status=status.HTTP_200_OK)
        except Exception as e:
            print(f"Error creating appointment: {str(e)}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



    def get_add_ons(self, request):
        try:
            add_ons = AddOns.objects.all().order_by('price')
            add_ons_data = []
            for add_on in add_ons:
                add_on_items = {
                    "id" : add_on.id,
                    "name" : add_on.name,
                    "price" : add_on.price,
                    "description" : add_on.description,
                    "extra_duration" : add_on.extra_duration
                }
                add_ons_data.append(add_on_items)
            return Response(add_ons_data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        






    def create_payment_sheet(self, request):
        """
        Create a payment sheet for Stripe payment processing.
        
        Creates a Stripe payment intent and ephemeral key for client-side payment processing.
        """
        print(f"Creating payment sheet for request: {request.data}")
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
            
            # Create payment intent with calculated amount
            payment_intent = stripe.PaymentIntent.create(
                amount=amount, 
                currency=currency,
                customer=customer.id,
                automatic_payment_methods={
                    'enabled': True,
                },
                # Enable setup for future payments
                setup_future_usage='off_session',
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



    def get_payment_methods(self, request):
        """
        Get saved payment methods for the user
        """
        try:
            user = User.objects.get(id=request.user.id)
            
            if not hasattr(user, 'stripe_customer_id') or not user.stripe_customer_id:
                return Response({'payment_methods': []}, status=status.HTTP_200_OK)
            
            # Retrieve payment methods from Stripe
            payment_methods = stripe.PaymentMethod.list(
                customer=user.stripe_customer_id,
                type='card',
            )
            
            # Format payment methods for frontend
            formatted_methods = []
            for pm in payment_methods.data:
                formatted_methods.append({
                    'id': pm.id,
                    'type': pm.type,
                    'card': {
                        'brand': pm.card.brand,
                        'last4': pm.card.last4,
                        'exp_month': pm.card.exp_month,
                        'exp_year': pm.card.exp_year,
                    }
                })
            return Response({
                'payment_methods': formatted_methods
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def delete_payment_method(self, request):
        try:
            print(f"Deleting payment method: {request.data}")
            payment_method_id = request.data.get('payment_method_id')
            
            if not payment_method_id:
                return Response({'error': 'Payment method ID required'}, status=400)
            
            # Detach payment method from customer
            stripe.PaymentMethod.detach(payment_method_id)
            
            return Response({
                'message': 'Payment method deleted successfully'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from main.models import BookedAppointment,ServiceType, ValetType, AddOns, Address, DetailerProfile, Vehicles
import stripe
from django.conf import settings
from datetime import datetime
from main.tasks import publish_booking_cancelled, publish_booking_rescheduled
from main.services.NotificationServices import NotificationService

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
        'get_payment_sheet_details' : 'get_payment_sheet_details',
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
    
    """ These are the methods which will serve the user their request using the action handlers
        to get the methods and route then through the get, post, patch given the method passed in the 
        client api
    """

    def get_service_type(self, request):
        """ Get the service type predefined by the admin in the system.
            ARGS : void
            RESPONSE : ServiceTypeProps[]
            {
                id : string
                name : string
                description : string[]
                price : number
                duration : number
            }
        """
        try:
            service_type = ServiceType.objects.all()
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
        """ Cancel a booking for the user.
            ARGS : void
            RESPONSE : void
            QUERY_PARAMS : booking_id : string
        """
        booking_reference = request.data.get('booking_reference')
        try:
            booking = BookedAppointment.objects.get(booking_reference=booking_reference)
            booking.status = 'cancelled'
            booking.save()
            publish_booking_cancelled.delay(booking_reference)

            # Send booking cancelled notification
            self.send_push_notification(request.user, "Booking Cancelled!", f"Your valet service has been cancelled for {booking.appointment_date} at {booking.start_time}", {
                "type": "booking_cancelled",
                "booking_reference": booking.booking_reference,
                "booking_reference": booking.booking_reference,
                "screen": "booking_details"
            })


            vehicle_name = f"{booking.vehicle.make} {booking.vehicle.model}"
            return Response(f'You have cancelled your booking for {vehicle_name} on {booking.appointment_date}', status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



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
            self.send_push_notification(request.user, "Booking Rescheduled! 📅", f"Your valet service has been rescheduled for {booking.appointment_date} at {booking.start_time}", {
                "type": "booking_rescheduled",
                "booking_reference": booking.booking_reference,
                "booking_reference": booking.booking_reference,
                "screen": "booking_details"
            })

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
            self.send_push_notification(request.user, "Booking Confirmed! 🎉", f"Your valet service is confirmed for {appointment.appointment_date} at {appointment.start_time}", {
                "type": "booking_confirmed",
                "booking_reference": appointment.booking_reference,
                "booking_reference": appointment.booking_reference,
                "screen": "booking_details"
            })

            return Response({'appointment_id': str(appointment.id)}, status=status.HTTP_200_OK)
        except Exception as e:
            print(f"Error creating appointment: {str(e)}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



    def get_add_ons(self, request):
        """ Get the add ons for the user to choose from
            ARGS : void
            RESPONSE : AddOnsProps[]
            {
                id : string
                name : string
                price : number
                description : string
                extra_duration : number 
            }
        """
        try:
            add_ons = AddOns.objects.all()
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
        

    def get_payment_sheet_details(self, request):
        print(f"Stripe Secret Key: {settings.STRIPE_SECRET_KEY}")
        print(f"Request data: {request.data}")
        print(f"User: {request.user}")
        
        """ Get payment sheet details for Stripe payment processing.
            ARGS : { amount: number } (amount in cents)
            RESPONSE : {
                paymentIntent: string,
                ephemeralKey: string,
                customer: string
            }
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
            
            if country == 'United Kingdom':
                currency = 'gbp'
            else:
                currency = 'eur'
            
            # Get amount from request
            amount = request.data.get('amount', 0)
            print(f"Amount: {amount}")
            
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
                metadata={
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
            print(f"Error in payment sheet details: {str(e)}")
            print(f"Error type: {type(e)}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )




    
    def send_push_notification(self, user, title, body, data=None):
        """Send push notification using NotificationService"""
        try:
            # Check if user has push notifications enabled and has a token
            if not user.allow_push_notifications:
                print(f"Push notifications disabled for user {user.id}")
                return False
                
            if not user.notification_token:
                print(f"No notification token for user {user.id}")
                return False
            
            # Send push notification
            result = self.notification_service._send_push_notification(
                user=user,
                title=title,
                body=body,
                data=data or {}
            )
            
            print(f"Push notification sent to user {user.id}: {title}")
            return True
            
        except Exception as e:
            print(f"Failed to send push notification to user {user.id}: {e}")
            logger.error(f"Push notification error for user {user.id}: {str(e)}")
            return False
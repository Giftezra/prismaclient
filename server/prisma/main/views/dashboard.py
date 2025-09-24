from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from main.models import BookedAppointment
from django.conf import settings
from main.util.media_helper import get_full_media_url
from django.utils import timezone
from main.tasks import publish_review_to_detailer

class DashboardView(APIView):
    permission_classes = [IsAuthenticated]
    """ Action handlers designed to route the url to the appropriate function """
    action_handlers = {
        'get_upcoming_appointments': '_get_upcoming_appointments',
        'cancel_appointment': '_cancel_appointment',
        'get_recent_services': '_get_recent_services',
        'get_user_stats': '_get_user_stats',
        'submit_review': 'submit_review',  # Add this line
    }

    """ Here we will override the crud methods and define the methods that would route the url to the appropriate function """
    def get(self, request, *args, **kwargs):
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
    

    def _get_upcoming_appointments(self, request):
        try:
            # Get appointments that are confirmed, scheduled, or in progress
            upcoming_appointments = BookedAppointment.objects.filter(
                user=request.user, 
                status__in=["confirmed", "scheduled", "in_progress", "pending"]
            ).select_related(
                'detailer', 'vehicle', 'address', 'service_type', 'valet_type'
            )

            upcoming_appointments_data = []
            for appointment in upcoming_appointments:
                # Calculate end time based on start time and duration
                end_time = None
                if appointment.start_time and appointment.duration:
                    from datetime import datetime, timedelta
                    start_datetime = datetime.combine(appointment.appointment_date, appointment.start_time)
                    end_datetime = start_datetime + timedelta(minutes=appointment.duration)
                    end_time = end_datetime.time().strftime('%H:%M')

                add_ons_data = []
                for add_on in appointment.add_ons.all():
                    add_ons_data.append({
                        "id": str(add_on.id),
                        "name": add_on.name,
                        "price": float(add_on.price),
                        "description": add_on.description,
                        "extra_duration": add_on.extra_duration,
                    })

                upcoming_appointments_data.append({
                    "booking_reference": str(appointment.booking_reference),
                    "detailer": {
                        "id": str(appointment.detailer.id),
                        "name": appointment.detailer.name,
                        "rating": float(appointment.detailer.rating),
                        "image": None,
                        "phone": appointment.detailer.phone,
                    },
                    "vehicle": {
                        "id": str(appointment.vehicle.id),
                        "model": appointment.vehicle.model,
                        "make": appointment.vehicle.make,
                        "year": appointment.vehicle.year,
                        "color": appointment.vehicle.color,
                        "licence": appointment.vehicle.licence,
                        "image": None,
                    },
                    "address": {
                        "address": appointment.address.address,
                        "post_code": appointment.address.post_code,
                        "city": appointment.address.city,
                        "country": appointment.address.country,
                    },
                    "service_type": {
                        "id": str(appointment.service_type.id),
                        "name": appointment.service_type.name,
                        "description": appointment.service_type.description,
                        "price": float(appointment.service_type.price),
                        "duration": appointment.service_type.duration,
                    },
                    "valet_type": {
                        "id": str(appointment.valet_type.id),
                        "name": appointment.valet_type.name,
                        "description": appointment.valet_type.description,
                    },
                    "booking_date": appointment.appointment_date.strftime('%Y-%m-%d'),
                    "total_amount": float(appointment.total_amount),
                    "estimated_duration": f"{appointment.duration} minutes" if appointment.duration else "Not specified",
                    "special_instructions": appointment.special_instructions,
                    "status": appointment.status,
                    "start_time": appointment.start_time.strftime('%H:%M') if appointment.start_time else None,
                    "end_time": end_time,
                    'add_ons': add_ons_data,
                })
            return Response(upcoming_appointments_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': f'Failed to fetch upcoming appointments: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
    def _cancel_appointment(self, request):
        try:
            appointment_id = request.data.get('appointment_id')
            if not appointment_id:
                return Response({'error': 'Appointment ID is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            appointment = BookedAppointment.objects.get(id=appointment_id, user=request.user, status__in=['confirmed', 'scheduled', 'in_progress'])
            if not appointment:
                return Response({'error': 'Appointment not found'}, status=status.HTTP_404_NOT_FOUND)
            
            appointment.status = 'cancelled'
            appointment.save()
            return Response({'message': 'Appointment cancelled successfully'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': f'Failed to cancel appointment: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        
    def _get_recent_services(self, request):
        try:
            # Get the most recent completed appointment with related objects
            # Order by appointment_date descending to get the most recent completed service
            recent_service = BookedAppointment.objects.filter(
                user=request.user, 
                status='completed'
            ).select_related(
                'detailer', 'vehicle', 'service_type', 'valet_type'
            ).order_by('-appointment_date', '-created_at').first()
            
            if not recent_service:
                return Response({'error': 'No completed services found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Format the response to match the frontend interface
            recent_service_data = {
                "date": recent_service.appointment_date.strftime('%Y-%m-%d'),
                "vehicle_name": f"{recent_service.vehicle.make} {recent_service.vehicle.model}",
                "status": recent_service.status,
                "cost": float(recent_service.total_amount),
                "detailer": {
                    "id": str(recent_service.detailer.id),
                    "name": recent_service.detailer.name,
                    "rating": float(recent_service.detailer.rating) if recent_service.detailer.rating else 0.0,
                    "phone": recent_service.detailer.phone,
                },
                "valet_type": recent_service.valet_type.name,
                "service_type": recent_service.service_type.name,
                "tip": float(recent_service.review_tip) if recent_service.review_tip else 0.0,
                "is_reviewed": recent_service.is_reviewed,
                "rating": float(recent_service.review_rating) if recent_service.review_rating else 0.0,
                "booking_reference": str(recent_service.booking_reference),
            }
            print("recent_service_data", recent_service_data)
            
            return Response(recent_service_data, status=status.HTTP_200_OK)
        except Exception as e:
            print(f"Error in _get_recent_services: {str(e)}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            return Response({'error': f'Failed to fetch recent services: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    

    def _get_user_stats(self, request):
        """ Create a stat method to get the total number of services the user has been booked for in a calendar month and each year """
        try:
            from datetime import datetime
            
            this_month = datetime.now().month
            this_year = datetime.now().year

            # Get services for this month
            services_this_month = BookedAppointment.objects.filter(
                user=request.user, 
                appointment_date__month=this_month, 
                appointment_date__year=this_year
            ).count()

            # Get services for this year
            services_this_year = BookedAppointment.objects.filter(
                user=request.user, 
                appointment_date__year=this_year
            ).count()

            stats = {
                'services_this_month': services_this_month,
                'services_this_year': services_this_year,
            }

            return Response(stats, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': f'Failed to fetch user stats: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        


    def submit_review(self, request):
        """Submit review for a completed booking"""
        try:
            print(f"DEBUG: submit_review called with data: {request.data}")
            
            booking_reference = request.data.get('booking_reference')
            rating = request.data.get('rating')
            tip_amount = request.data.get('tip_amount', 0.00)

            print(f"DEBUG: booking_reference={booking_reference}, rating={rating}, tip_amount={tip_amount}")

            if not booking_reference or not rating:
                return Response(
                    {'error': 'Booking reference and rating are required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate rating
            if not isinstance(rating, int) or rating < 1 or rating > 5:
                return Response(
                    {'error': 'Rating must be an integer between 1 and 5'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get the booking
            try:
                print(f"DEBUG: Looking for booking with reference: {booking_reference}")
                booking = BookedAppointment.objects.get(
                    booking_reference=booking_reference,
                    user=request.user,
                    status='completed',
                    is_reviewed=False
                )
                print(f"DEBUG: Found booking: {booking}")
            except BookedAppointment.DoesNotExist:
                print(f"DEBUG: Booking not found or already reviewed")
                return Response(
                    {'error': 'Unreviewed completed booking not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )

            # Update the booking with review data
            booking.is_reviewed = True
            booking.review_rating = rating
            booking.review_tip = tip_amount
            booking.review_submitted_at = timezone.now()
            booking.save()
            print(f"DEBUG: Booking updated successfully")

            # Publish to Redis for detailer notification
            publish_review_to_detailer.delay(
                booking_reference,
                rating,
                tip_amount
            )
            print(f"DEBUG: Celery task queued")
            
            return Response({
                'message': 'Review submitted successfully',
                'booking_reference': booking_reference
            }, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"DEBUG: Exception in submit_review: {str(e)}")
            import traceback
            print(f"DEBUG: Traceback: {traceback.format_exc()}")
            return Response(
                {'error': f'Failed to submit review: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from main.models import BookedAppointment, BookedAppointmentImage, FleetVehicle, Fleet
from django.db.models import Q
import logging


class ServiceHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    """ Define a set of action handlers that would be used to route the url to the appropriate function """
    action_handlers = {
        "get_service_history": "get_service_history",
        "get_booking_images": "get_booking_images",
    }

    def get(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handlers:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        
        handler = getattr(self, self.action_handlers[action])
        return handler(request)

    def get_service_history(self, request):
        """
        Get all service history (completed and cancelled bookings) for the authenticated user.
        For fleet owners: includes bookings for vehicles in their fleet
        For branch admins: includes bookings for vehicles in their managed branch
        For regular users: only their own bookings
        Returns appointments ordered by appointment_date in descending order (most recent first).
        """
        try:
            # Build the base query filter
            query_filter = Q(status__in=["completed", "cancelled"])
            
            # Start with bookings where user is the current user
            user_filter = Q(user=request.user)
            
            # If user is a branch admin, also include bookings for vehicles in their branch
            if request.user.is_branch_admin:
                managed_branch = request.user.get_managed_branch()
                if managed_branch:
                    # Get vehicles in the managed branch
                    branch_vehicles = FleetVehicle.objects.filter(
                        fleet=managed_branch.fleet,
                        branch=managed_branch
                    ).values_list('vehicle_id', flat=True)
                    
                    # Add filter for bookings with vehicles in this branch
                    user_filter |= Q(vehicle_id__in=branch_vehicles)
            
            # If user is a fleet owner, also include bookings for vehicles in their fleet
            elif request.user.is_fleet_owner:
                fleet = Fleet.objects.filter(owner=request.user).first()
                if fleet:
                    # Get all vehicles in the fleet (across all branches)
                    fleet_vehicles = FleetVehicle.objects.filter(
                        fleet=fleet
                    ).values_list('vehicle_id', flat=True)
                    
                    # Add filter for bookings with vehicles in this fleet
                    user_filter |= Q(vehicle_id__in=fleet_vehicles)
            
            # Combine filters
            query_filter &= user_filter
            
            # Get all booked appointments matching the filter
            # Include related data to avoid N+1 queries
            # Order by appointment_date in descending order (most recent first)
            appointments = BookedAppointment.objects.filter(
                query_filter
            ).select_related(
                'service_type',
                'valet_type',
                'vehicle',
                'address',
                'detailer'
            ).order_by('-appointment_date')
            
            service_history = []
            
            for appointment in appointments:
                try:
                    # Format the service history data to match MyServiceHistoryProps interface
                    service_history_item = {
                        'id': str(appointment.id),
                        'booking_date': appointment.booking_date.isoformat(),
                        'appointment_date': appointment.appointment_date.isoformat(),
                        'service_type': appointment.service_type.name if appointment.service_type else 'Unknown',
                        'valet_type': appointment.valet_type.name if appointment.valet_type else 'Unknown',
                        'vehicle_reg': appointment.vehicle.registration_number if appointment.vehicle else 'Unknown',
                        'address': {
                            'id': str(appointment.address.id) if appointment.address else '',
                            'address': appointment.address.address if appointment.address else '',
                            'post_code': appointment.address.post_code if appointment.address else '',
                            'city': appointment.address.city if appointment.address else '',
                            'country': appointment.address.country if appointment.address else ''
                        },
                        # Return detailers as array for backward compatibility and express service support
                        'detailers': [
                            {
                                'id': str(appointment.detailer.id) if appointment.detailer else '',
                                'name': appointment.detailer.name if appointment.detailer else 'Unknown',
                                'rating': float(appointment.detailer.rating) if appointment.detailer and appointment.detailer.rating else 0.0,
                                'phone': appointment.detailer.phone if appointment.detailer else '',
                            }
                        ] if appointment.detailer else [],
                        # Keep detailer for backward compatibility
                        'detailer': {
                            'id': str(appointment.detailer.id) if appointment.detailer else '',
                            'name': appointment.detailer.name if appointment.detailer else 'Unknown',
                            'rating': float(appointment.detailer.rating) if appointment.detailer and appointment.detailer.rating else 0.0,
                            'phone': appointment.detailer.phone if appointment.detailer else '',
                        },
                        'status': appointment.status,
                        'total_amount': float(appointment.total_amount),
                        'rating': float(appointment.review_rating) if appointment.review_rating else 0.0,
                        'is_reviewed': appointment.review_rating is not None and appointment.review_rating > 0,
                        'booking_reference': str(appointment.booking_reference),
                    }
                    
                    service_history.append(service_history_item)
                except Exception as item_error:
                    # Log the error for individual items but continue processing
                    print(f"Error processing appointment {appointment.id}: {str(item_error)}")
                    continue
            
            return Response({'service_history': service_history}, status=status.HTTP_200_OK)
        except Exception as e:
            print(f"Service history error: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def get_booking_images(self, request):
        """
        Fetch all before/after images for a specific booking.
        Called from service history when client views completed bookings.
        
        Args:
            request: HTTP request with booking_id in query params
        
        Returns:
            Response with grouped before/after images
        """
        try:
            booking_id = request.query_params.get('booking_id')
            if not booking_id:
                return Response({
                    'error': 'booking_id is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get the booking and verify access
            try:
                booking = BookedAppointment.objects.get(id=booking_id)
            except BookedAppointment.DoesNotExist:
                return Response({
                    'error': 'Booking not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Check if user has access to this booking
            has_access = False
            
            # User owns the booking
            if booking.user == request.user:
                has_access = True
            # Branch admin - check if vehicle is in their branch
            elif request.user.is_branch_admin:
                managed_branch = request.user.get_managed_branch()
                if managed_branch and booking.vehicle:
                    has_access = FleetVehicle.objects.filter(
                        fleet=managed_branch.fleet,
                        branch=managed_branch,
                        vehicle=booking.vehicle
                    ).exists()
            # Fleet owner - check if vehicle is in their fleet
            elif request.user.is_fleet_owner:
                fleet = Fleet.objects.filter(owner=request.user).first()
                if fleet and booking.vehicle:
                    has_access = FleetVehicle.objects.filter(
                        fleet=fleet,
                        vehicle=booking.vehicle
                    ).exists()
            
            if not has_access:
                return Response({
                    'error': 'Booking not found or access denied'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Check if user can view vehicle details (subscription check for fleet users)
            can_view = request.user.can_view_vehicle_details(booking.vehicle)
            if not can_view:
                # Return empty arrays with access_denied flag for fleet users without subscription
                return Response({
                    'booking_reference': booking.booking_reference,
                    'before_images_interior': [],
                    'before_images_exterior': [],
                    'after_images_interior': [],
                    'after_images_exterior': [],
                    'event_data_management': None,
                    'access_denied': True,
                    'message': 'Detailed vehicle information is only available with an active fleet subscription.'
                }, status=status.HTTP_200_OK)
            
            # Fetch images grouped by segment
            before_images_interior = BookedAppointmentImage.objects.filter(
                booking=booking,
                image_type='before',
                segment='interior'
            ).order_by('created_at')
            
            before_images_exterior = BookedAppointmentImage.objects.filter(
                booking=booking,
                image_type='before',
                segment='exterior'
            ).order_by('created_at')
            
            after_images_interior = BookedAppointmentImage.objects.filter(
                booking=booking,
                image_type='after',
                segment='interior'
            ).order_by('created_at')
            
            after_images_exterior = BookedAppointmentImage.objects.filter(
                booking=booking,
                image_type='after',
                segment='exterior'
            ).order_by('created_at')
            
            # Format response with images grouped by segment
            before_images_interior_data = [
                {
                    'id': img.id,
                    'image_url': img.image_url,
                    'created_at': img.created_at.isoformat()
                } for img in before_images_interior
            ]
            
            before_images_exterior_data = [
                {
                    'id': img.id,
                    'image_url': img.image_url,
                    'created_at': img.created_at.isoformat()
                } for img in before_images_exterior
            ]
            
            after_images_interior_data = [
                {
                    'id': img.id,
                    'image_url': img.image_url,
                    'created_at': img.created_at.isoformat()
                } for img in after_images_interior
            ]
            
            after_images_exterior_data = [
                {
                    'id': img.id,
                    'image_url': img.image_url,
                    'created_at': img.created_at.isoformat()
                } for img in after_images_exterior
            ]
            
            # Get EventDataManagement if exists
            event_data = None
            if hasattr(booking, 'eventdatamanagement'):
                from main.serializer import EventDataManagementSerializer
                event_data = EventDataManagementSerializer(booking.eventdatamanagement).data
            
            return Response({
                'booking_reference': booking.booking_reference,
                'before_images_interior': before_images_interior_data,
                'before_images_exterior': before_images_exterior_data,
                'after_images_interior': after_images_interior_data,
                'after_images_exterior': after_images_exterior_data,
                'event_data_management': event_data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logging.error(f"Error fetching booking images: {str(e)}")
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

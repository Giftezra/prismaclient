from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from main.models import BookedAppointment, FleetVehicle, Branch, BulkOrder
from django.conf import settings
from main.util.media_helper import get_full_media_url
from django.utils import timezone
from main.tasks import publish_review_to_detailer
from main.utils.redis_geo import get_detailer_location as get_detailer_location_from_redis

class DashboardView(APIView):
    permission_classes = [IsAuthenticated]
    """ Action handlers designed to route the url to the appropriate function """
    action_handlers = {
        'get_upcoming_appointments': '_get_upcoming_appointments',
        'cancel_appointment': '_cancel_appointment',
        'get_recent_services': '_get_recent_services',
        'get_user_stats': '_get_user_stats',
        'submit_review': 'submit_review',
        'get_detailer_location': '_get_detailer_location',
    }

    """ Here we will override the crud methods and define the methods that would route the url to the appropriate function """
    def get(self, request, *args, **kwargs):
        action = kwargs.get('action')
        print(f"DashboardView.get - action: {action}, kwargs: {kwargs}")
        if action not in self.action_handlers:
            print(f"Invalid action: {action}, available actions: {list(self.action_handlers.keys())}")
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
            # For branch admins, get appointments for all vehicles in their managed branch
            # For regular users, get appointments for their own vehicles
            if request.user.is_branch_admin:
                managed_branch = request.user.get_managed_branch()
                if managed_branch:
                    # Get all vehicles in the managed branch
                    branch_vehicles = FleetVehicle.objects.filter(
                        fleet=managed_branch.fleet,
                        branch=managed_branch
                    ).select_related('vehicle')
                    vehicle_ids = [fv.vehicle.id for fv in branch_vehicles if fv.vehicle]
                    # Get appointments for vehicles in this branch
                    if vehicle_ids:
                        upcoming_appointments = BookedAppointment.objects.filter(
                            vehicle_id__in=vehicle_ids,
                            status__in=["confirmed", "scheduled", "in_progress", "pending"]
                        ).select_related(
                            'detailer', 'vehicle', 'address', 'service_type', 'valet_type'
                        ).order_by('appointment_date', 'start_time')
                    else:
                        # No vehicles in branch, return empty
                        upcoming_appointments = BookedAppointment.objects.none()
                else:
                    # No managed branch, return empty
                    upcoming_appointments = BookedAppointment.objects.none()
            else:
                print("Regular user - get their own appointments")
                # Regular user - get their own appointments
                upcoming_appointments = BookedAppointment.objects.filter(
                    user=request.user, 
                    status__in=["confirmed", "scheduled", "in_progress", "pending"]
                ).select_related(
                    'detailer', 'vehicle', 'address', 'service_type', 'valet_type'
                ).order_by('appointment_date', 'start_time')

                print("upcoming_appointments", upcoming_appointments)

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
                    # Return detailers as array for backward compatibility and express service support
                    "detailers": [
                        {
                            "id": str(appointment.detailer.id) if appointment.detailer else None,
                            "name": appointment.detailer.name if appointment.detailer else None,
                            "rating": float(appointment.detailer.rating) if appointment.detailer and appointment.detailer.rating else 0.0,
                            "image": None,
                            "phone": appointment.detailer.phone if appointment.detailer else None,
                        }
                    ] if appointment.detailer else [],
                    # Keep detailer for backward compatibility
                    "detailer": {
                        "id": str(appointment.detailer.id) if appointment.detailer else None,
                        "name": appointment.detailer.name if appointment.detailer else None,
                        "rating": float(appointment.detailer.rating) if appointment.detailer and appointment.detailer.rating else 0.0,
                        "image": None,
                        "phone": appointment.detailer.phone if appointment.detailer else None,
                    },
                    "vehicle": {
                        "id": str(appointment.vehicle.id) if appointment.vehicle else None,
                        "model": appointment.vehicle.model if appointment.vehicle else None,
                        "make": appointment.vehicle.make if appointment.vehicle else None,
                        "year": appointment.vehicle.year if appointment.vehicle else None,
                        "color": appointment.vehicle.color if appointment.vehicle else None,
                        "licence": appointment.vehicle.registration_number if appointment.vehicle else None,
                        "image": get_full_media_url(appointment.vehicle.image.url) if (appointment.vehicle and appointment.vehicle.image) else None,
                    },
                    "address": {
                        "address": appointment.address.address if appointment.address else None,
                        "post_code": appointment.address.post_code if appointment.address else None,
                        "city": appointment.address.city if appointment.address else None,
                        "country": appointment.address.country if appointment.address else None,
                        "latitude": float(appointment.address.latitude) if appointment.address and appointment.address.latitude is not None else None,
                        "longitude": float(appointment.address.longitude) if appointment.address and appointment.address.longitude is not None else None,
                    },
                    "service_type": {
                        "id": str(appointment.service_type.id) if appointment.service_type else None,
                        "name": appointment.service_type.name if appointment.service_type else None,
                        "description": appointment.service_type.description if appointment.service_type else None,
                        "price": float(appointment.service_type.price) if appointment.service_type and appointment.service_type.price else 0.0,
                        "duration": appointment.service_type.duration if appointment.service_type else None,
                    },
                    "valet_type": {
                        "id": str(appointment.valet_type.id) if appointment.valet_type else None,
                        "name": appointment.valet_type.name if appointment.valet_type else None,
                        "description": appointment.valet_type.description if appointment.valet_type else None,
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

            # Add upcoming bulk orders (same user or branch)
            from datetime import datetime as dt_module
            today = timezone.now().date()
            if getattr(request.user, 'is_branch_admin', False):
                managed_branch = getattr(request.user, 'get_managed_branch', lambda: None)()
                bulk_orders = BulkOrder.objects.filter(
                    branch=managed_branch,
                    payment_status__in=['succeeded', 'invoice_later'],
                ).order_by('created_at') if managed_branch else BulkOrder.objects.none()
            else:
                bulk_orders = BulkOrder.objects.filter(
                    user=request.user,
                    payment_status__in=['succeeded', 'invoice_later'],
                ).order_by('created_at')

            for bulk in bulk_orders:
                order_data = getattr(bulk, 'order_data', None) or {}
                if not isinstance(order_data, dict):
                    continue
                date_str = order_data.get('date')
                if not date_str:
                    continue
                try:
                    bulk_date = dt_module.strptime(date_str, '%Y-%m-%d').date()
                except (ValueError, TypeError):
                    continue
                if bulk_date < today:
                    continue
                start_time_str = order_data.get('start_time', '06:00')
                end_time_str = order_data.get('end_time', '21:00')
                addr = order_data.get('address') or {}
                if isinstance(addr, dict):
                    address_data = {
                        "address": addr.get('address'),
                        "post_code": addr.get('postcode') or addr.get('post_code'),
                        "city": addr.get('city'),
                        "country": addr.get('country'),
                        "latitude": addr.get('latitude'),
                        "longitude": addr.get('longitude'),
                    }
                else:
                    address_data = {"address": None, "post_code": None, "city": None, "country": None, "latitude": None, "longitude": None}
                st = order_data.get('service_type')
                if isinstance(st, dict):
                    service_name = st.get('name', 'Bulk service') or 'Bulk service'
                    duration_min = st.get('duration')
                    if duration_min is None:
                        duration_min = order_data.get('service_duration') or 60
                    else:
                        try:
                            duration_min = int(duration_min)
                        except (TypeError, ValueError):
                            duration_min = 60
                elif isinstance(st, str):
                    service_name = st
                    duration_min = order_data.get('service_duration') or 60
                else:
                    service_name = 'Bulk service'
                    duration_min = order_data.get('service_duration') or 60
                vt = order_data.get('valet_type')
                if isinstance(vt, dict):
                    valet_type_name = vt.get('name') or 'Bulk'
                    valet_type_id = vt.get('id')
                    valet_type_desc = vt.get('description')
                elif isinstance(vt, str):
                    valet_type_name = vt or 'Bulk'
                    valet_type_id = None
                    valet_type_desc = None
                else:
                    valet_type_name = 'Bulk'
                    valet_type_id = None
                    valet_type_desc = None
                num_vehicles = getattr(bulk, 'number_of_vehicles', 0) or order_data.get('number_of_vehicles', 0)
                assigned = getattr(bulk, 'assigned_detailers', None) or []
                if isinstance(assigned, list) and len(assigned) > 0:
                    detailers_list = [
                        {
                            "id": str(d.get("id")) if d.get("id") is not None else None,
                            "name": d.get("name") or None,
                            "rating": float(d.get("rating", 0) or 0),
                            "image": d.get("image"),
                            "phone": d.get("phone"),
                        }
                        for d in assigned
                    ]
                    first_detailer = detailers_list[0] if detailers_list else {"id": None, "name": None, "rating": 0.0, "image": None, "phone": None}
                else:
                    detailers_list = []
                    first_detailer = {"id": None, "name": None, "rating": 0.0, "image": None, "phone": None}
                upcoming_appointments_data.append({
                    "booking_reference": str(bulk.booking_reference),
                    "is_bulk": True,
                    "bulk_order_id": str(bulk.id),
                    "order_data": order_data,
                    "payment_status": getattr(bulk, 'payment_status', None) or 'succeeded',
                    "number_of_vehicles": num_vehicles,
                    "detailers": detailers_list,
                    "detailer": first_detailer,
                    "vehicle": {
                        "id": None,
                        "model": None,
                        "make": None,
                        "year": None,
                        "color": None,
                        "licence": f"Bulk · {num_vehicles} vehicles",
                        "image": None,
                    },
                    "address": address_data,
                    "service_type": {
                        "id": None,
                        "name": service_name,
                        "description": None,
                        "price": float(bulk.total_amount) if bulk.total_amount else 0.0,
                        "duration": duration_min,
                    },
                    "valet_type": {"id": valet_type_id, "name": valet_type_name, "description": valet_type_desc},
                    "booking_date": bulk_date.strftime('%Y-%m-%d'),
                    "total_amount": float(bulk.total_amount) if bulk.total_amount else 0.0,
                    "estimated_duration": f"{num_vehicles} vehicles · {duration_min} min each" if num_vehicles else "Not specified",
                    "special_instructions": None,
                    "status": "scheduled",
                    "start_time": start_time_str[:5] if isinstance(start_time_str, str) and len(start_time_str) >= 5 else start_time_str,
                    "end_time": end_time_str[:5] if isinstance(end_time_str, str) and len(end_time_str) >= 5 else end_time_str,
                    "add_ons": [],
                })

            # Sort combined list by booking_date then start_time
            def _sort_key(item):
                d = item.get('booking_date') or '9999-99-99'
                t = item.get('start_time') or '00:00'
                if isinstance(t, str) and len(t) >= 5:
                    t = t[:5]
                return (d, t)
            upcoming_appointments_data.sort(key=_sort_key)
            return Response(upcoming_appointments_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            print(f"Error in _get_upcoming_appointments: {str(e)}")
            print(f"Traceback: {traceback.format_exc()}")
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

    def _get_detailer_location(self, request):
        """Return detailer's current (lat, lng) from Redis for map view. GET ?booking_reference=."""
        try:
            booking_reference = request.query_params.get('booking_reference')
            if not booking_reference:
                return Response(
                    {'error': 'booking_reference is required'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                appointment = BookedAppointment.objects.get(
                    booking_reference=booking_reference,
                    user=request.user,
                )
            except BookedAppointment.DoesNotExist:
                return Response(
                    {'error': 'Appointment not found'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            detailer = appointment.detailer
            if not detailer or getattr(detailer, 'external_id', None) is None:
                return Response(
                    {'latitude': None, 'longitude': None},
                    status=status.HTTP_200_OK,
                )
            coords = get_detailer_location_from_redis(int(detailer.external_id))
            if coords is None:
                return Response(
                    {'latitude': None, 'longitude': None},
                    status=status.HTTP_200_OK,
                )
            lat, lng = coords
            return Response(
                {'latitude': lat, 'longitude': lng},
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            # Return nulls so client can still show service address on map
            return Response(
                {'latitude': None, 'longitude': None},
                status=status.HTTP_200_OK,
            )
        
    def _get_recent_services(self, request):
        try:
            # #region agent log
            import json
            import time
            log_data = {
                "sessionId": "debug-session",
                "runId": "run1",
                "hypothesisId": "A",
                "location": "dashboard.py:_get_recent_services:entry",
                "message": "Entry: _get_recent_services called",
                "data": {
                    "user_id": str(request.user.id),
                    "user_email": request.user.email,
                    "is_branch_admin": request.user.is_branch_admin,
                    "is_fleet_owner": getattr(request.user, 'is_fleet_owner', False),
                },
                "timestamp": int(time.time() * 1000)
            }
            with open('c:\\Users\\gifte\\Projects\\prisma\\client\\.cursor\\debug.log', 'a') as f:
                f.write(json.dumps(log_data) + '\n')
            # #endregion
            
            # For branch admins, get recent services for all vehicles in their managed branch
            # For regular users, get their own recent services
            if request.user.is_branch_admin:
                # #region agent log
                log_data = {
                    "sessionId": "debug-session",
                    "runId": "run1",
                    "hypothesisId": "A",
                    "location": "dashboard.py:_get_recent_services:branch_admin_path",
                    "message": "Branch admin path executed",
                    "data": {"user_id": str(request.user.id)},
                    "timestamp": int(time.time() * 1000)
                }
                with open('c:\\Users\\gifte\\Projects\\prisma\\client\\.cursor\\debug.log', 'a') as f:
                    f.write(json.dumps(log_data) + '\n')
                # #endregion
                
                managed_branch = request.user.get_managed_branch()
                
                # #region agent log
                log_data = {
                    "sessionId": "debug-session",
                    "runId": "run1",
                    "hypothesisId": "D",
                    "location": "dashboard.py:_get_recent_services:managed_branch_check",
                    "message": "Managed branch check",
                    "data": {
                        "user_id": str(request.user.id),
                        "managed_branch": str(managed_branch.id) if managed_branch else None,
                        "branch_name": managed_branch.name if managed_branch else None,
                    },
                    "timestamp": int(time.time() * 1000)
                }
                with open('c:\\Users\\gifte\\Projects\\prisma\\client\\.cursor\\debug.log', 'a') as f:
                    f.write(json.dumps(log_data) + '\n')
                # #endregion
                
                if managed_branch:
                    # Get all vehicles in the managed branch
                    branch_vehicles = FleetVehicle.objects.filter(
                        fleet=managed_branch.fleet,
                        branch=managed_branch
                    ).select_related('vehicle')
                    vehicle_ids = [fv.vehicle.id for fv in branch_vehicles if fv.vehicle]
                    
                    # #region agent log
                    log_data = {
                        "sessionId": "debug-session",
                        "runId": "run1",
                        "hypothesisId": "B",
                        "location": "dashboard.py:_get_recent_services:vehicle_ids",
                        "message": "Vehicle IDs for branch",
                        "data": {
                            "user_id": str(request.user.id),
                            "vehicle_count": len(vehicle_ids),
                            "vehicle_ids": [str(vid) for vid in vehicle_ids[:10]],  # First 10 only
                        },
                        "timestamp": int(time.time() * 1000)
                    }
                    with open('c:\\Users\\gifte\\Projects\\prisma\\client\\.cursor\\debug.log', 'a') as f:
                        f.write(json.dumps(log_data) + '\n')
                    # #endregion
                    
                    # Get most recent completed service for vehicles in this branch
                    if vehicle_ids:
                        recent_service = BookedAppointment.objects.filter(
                            vehicle_id__in=vehicle_ids,
                            status='completed'
                        ).select_related(
                            'detailer', 'vehicle', 'service_type', 'valet_type', 'user'
                        ).order_by('-appointment_date', '-created_at').first()
                    else:
                        recent_service = None
                else:
                    recent_service = None
            else:
                # #region agent log
                log_data = {
                    "sessionId": "debug-session",
                    "runId": "run1",
                    "hypothesisId": "C",
                    "location": "dashboard.py:_get_recent_services:regular_user_path",
                    "message": "Regular user path executed",
                    "data": {"user_id": str(request.user.id)},
                    "timestamp": int(time.time() * 1000)
                }
                with open('c:\\Users\\gifte\\Projects\\prisma\\client\\.cursor\\debug.log', 'a') as f:
                    f.write(json.dumps(log_data) + '\n')
                # #endregion
                
                # Regular user - get their own recent services
                # CRITICAL: Must filter by user to prevent data leakage
                recent_service = BookedAppointment.objects.filter(
                    user=request.user, 
                    status='completed'
                ).select_related(
                    'detailer', 'vehicle', 'service_type', 'valet_type', 'user'
                ).order_by('-appointment_date', '-created_at').first()
            
            # #region agent log
            import json
            import time
            log_data = {
                "sessionId": "debug-session",
                "runId": "run1",
                "hypothesisId": "E",
                "location": "dashboard.py:_get_recent_services:before_response",
                "message": "Recent service query result",
                "data": {
                    "user_id": str(request.user.id),
                    "recent_service_found": recent_service is not None,
                    "booking_reference": str(recent_service.booking_reference) if recent_service else None,
                    "booking_user_id": str(recent_service.user.id) if recent_service else None,
                    "booking_user_email": recent_service.user.email if recent_service else None,
                    "booking_user_is_branch_admin": recent_service.user.is_branch_admin if recent_service else None,
                    "vehicle_id": str(recent_service.vehicle.id) if recent_service and recent_service.vehicle else None,
                },
                "timestamp": int(time.time() * 1000)
            }
            with open('c:\\Users\\gifte\\Projects\\prisma\\client\\.cursor\\debug.log', 'a') as f:
                f.write(json.dumps(log_data) + '\n')
            # #endregion
            
            if not recent_service:
                # Return 200 with empty shape so client can show empty state (no 404)
                return Response({
                    "date": None,
                    "vehicle_name": None,
                    "status": None,
                    "cost": 0,
                    "detailer": None,
                    "valet_type": None,
                    "service_type": None,
                    "is_reviewed": False,
                    "rating": 0,
                    "booking_reference": None,
                }, status=status.HTTP_200_OK)
            
            # Format the response to match the frontend interface
            vehicle_name = "Unknown Vehicle"
            if recent_service.vehicle:
                vehicle_name = f"{recent_service.vehicle.make or ''} {recent_service.vehicle.model or ''}".strip()
                if not vehicle_name:
                    vehicle_name = "Unknown Vehicle"
            
            recent_service_data = {
                "date": recent_service.appointment_date.strftime('%Y-%m-%d'),
                "vehicle_name": vehicle_name,
                "status": recent_service.status,
                "cost": float(recent_service.total_amount),
                "detailer": {
                    "id": str(recent_service.detailer.id) if recent_service.detailer else None,
                    "name": recent_service.detailer.name if recent_service.detailer else None,
                    "rating": float(recent_service.detailer.rating) if recent_service.detailer and recent_service.detailer.rating else 0.0,
                    "phone": recent_service.detailer.phone if recent_service.detailer else None,
                },
                "valet_type": recent_service.valet_type.name if recent_service.valet_type else None,
                "service_type": recent_service.service_type.name if recent_service.service_type else None,
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

            # For branch admins, get stats for all vehicles in their managed branch
            # For regular users, get their own stats
            if request.user.is_branch_admin:
                managed_branch = request.user.get_managed_branch()
                if managed_branch:
                    # Get all vehicles in the managed branch
                    branch_vehicles = FleetVehicle.objects.filter(
                        fleet=managed_branch.fleet,
                        branch=managed_branch
                    )
                    vehicle_ids = [fv.vehicle.id for fv in branch_vehicles]
                    # Get services for this month
                    services_this_month = BookedAppointment.objects.filter(
                        vehicle_id__in=vehicle_ids,
                        appointment_date__month=this_month, 
                        appointment_date__year=this_year
                    ).count()

                    # Get services for this year
                    services_this_year = BookedAppointment.objects.filter(
                        vehicle_id__in=vehicle_ids,
                        appointment_date__year=this_year
                    ).count()
                else:
                    services_this_month = 0
                    services_this_year = 0
            else:
                # Regular user - get their own stats
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

            print(f"DEBUG: booking_reference={booking_reference}, rating={rating}")

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
            booking.review_submitted_at = timezone.now()
            booking.save()
            print(f"DEBUG: Booking updated successfully")

            # Publish to Redis for detailer notification
            publish_review_to_detailer.delay(booking_reference, rating)
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

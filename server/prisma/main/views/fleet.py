from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from main.models import Fleet, Branch, FleetMember, FleetVehicle, Vehicle, VehicleOwnership, BookedAppointment, User
from main.utils.branch_spend import get_branch_spend_for_period
from main.utils.fleet_analytics import (
    get_branch_performance, get_spend_trends, get_vehicle_health_scores,
    get_booking_activity, get_common_issues
)
from django.db.models import Count, Q
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal


class FleetView(APIView):
    permission_classes = [IsAuthenticated]
    
    action_handlers = {
        'create_branch': 'create_branch',
        'get_branches': 'get_branches',
        'create_branch_admin': 'create_branch_admin',
        'get_fleet_dashboard': 'get_fleet_dashboard',
        'get_branch_vehicles': 'get_branch_vehicles',
        'get_branch_spend': 'get_branch_spend',
        'update_branch': 'update_branch',
        'delete_branch': 'delete_branch',
        'get_vehicle_bookings': 'get_vehicle_bookings',
        'get_branch_admins': 'get_branch_admins',
    }
    
    def get(self, request, *args, **kwargs):
        print("get inside the method eet view")
        print(f"Action from kwargs: {kwargs.get('action')}")
        print(f"All kwargs: {kwargs}")
        action = kwargs.get('action')
        if action not in self.action_handlers:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handlers[action])
        branch_id = kwargs.get('branch_id')
        vehicle_id = kwargs.get('vehicle_id')
        if branch_id is not None:
            return handler(request, branch_id)
        if vehicle_id is not None:
            return handler(request, vehicle_id)
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
        branch_id = kwargs.get('branch_id')
        if branch_id is not None:
            return handler(request, branch_id)
        return handler(request)
    
    def delete(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handlers:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handlers[action])
        branch_id = kwargs.get('branch_id')
        if branch_id is not None:
            return handler(request, branch_id)
        return handler(request)
    
    def create_branch(self, request):
        """Create a new branch for the fleet owner's fleet"""
        try:
            # Check if user is a fleet owner
            if not request.user.is_fleet_owner:
                return Response({'error': 'Only fleet owners can create branches'}, status=status.HTTP_403_FORBIDDEN)
            
            # Get the fleet for this user
            fleet = Fleet.objects.filter(owner=request.user).first()
            if not fleet:
                return Response({'error': 'No fleet found for this user'}, status=status.HTTP_404_NOT_FOUND)
            
            # Check subscription limit
            can_add, error_msg = fleet.can_add_branch()
            if not can_add:
                return Response({'error': error_msg}, status=status.HTTP_403_FORBIDDEN)
            
            # Get branch data
            name = request.data.get('name')
            address = request.data.get('address', '')
            postcode = request.data.get('postcode', '')
            city = request.data.get('city', '')
            country = request.data.get('country', '')
            
            if not name:
                return Response({'error': 'Branch name is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Create branch
            branch = Branch.objects.create(
                fleet=fleet,
                name=name,
                address=address,
                postcode=postcode,
                city=city,
                country=country
            )
            
            return Response({
                'message': 'Branch created successfully',
                'branch': {
                    'id': str(branch.id),
                    'name': branch.name,
                    'address': branch.address,
                    'postcode': branch.postcode,
                    'city': branch.city,
                    'country': branch.country,
                    'fleet': str(fleet.id),
                }
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def get_branches(self, request):
        """Get all branches for the fleet owner's fleet"""
        try:
            # Check if user is a fleet owner
            if not request.user.is_fleet_owner:
                return Response({'error': 'Only fleet owners can view branches'}, status=status.HTTP_403_FORBIDDEN)
            
            # Get the fleet for this user
            fleet = Fleet.objects.filter(owner=request.user).first()
            if not fleet:
                return Response({'branches': []}, status=status.HTTP_200_OK)
            
            # Get all branches for this fleet
            branches = Branch.objects.filter(fleet=fleet).annotate(
                vehicle_count=Count('branch_vehicles'),
                admin_count=Count('fleet_members', filter=Q(fleet_members__role='admin'), distinct=True)
            )
            
            branches_data = []
            for branch in branches:
                period = branch.spend_limit_period or 'monthly'
                spent = get_branch_spend_for_period(branch, period)
                limit = branch.spend_limit
                if limit is not None and limit > 0:
                    remaining = max(Decimal('0'), limit - spent)
                else:
                    remaining = None
                branches_data.append({
                    'id': str(branch.id),
                    'name': branch.name,
                    'address': branch.address,
                    'postcode': branch.postcode,
                    'city': branch.city,
                    'country': branch.country,
                    'fleet': str(fleet.id),
                    'vehicle_count': branch.vehicle_count,
                    'admin_count': branch.admin_count,
                    'spend_limit': float(limit) if limit is not None else None,
                    'spend_limit_period': branch.spend_limit_period,
                    'spent': float(spent),
                    'remaining': float(remaining) if remaining is not None else None,
                    'created_at': branch.created_at.isoformat(),
                })
            
            return Response({'branches': branches_data}, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def create_branch_admin(self, request):
        """Create a branch admin account"""
        try:
            # Check if user is a fleet owner
            if not request.user.is_fleet_owner:
                return Response({'error': 'Only fleet owners can create branch admins'}, status=status.HTTP_403_FORBIDDEN)
            
            # Get the fleet for this user
            fleet = Fleet.objects.filter(owner=request.user).first()
            if not fleet:
                return Response({'error': 'No fleet found for this user'}, status=status.HTTP_404_NOT_FOUND)
            
            # Check subscription limit
            can_add, error_msg = fleet.can_add_admin()
            if not can_add:
                return Response({'error': error_msg}, status=status.HTTP_403_FORBIDDEN)
            
            # Get admin data
            name = request.data.get('name')
            email = request.data.get('email')
            phone = request.data.get('phone', '')
            password = request.data.get('password')
            branch_id = request.data.get('branch_id')
            
            # Validate required fields
            if not all([name, email, password, branch_id]):
                return Response({'error': 'Name, email, password, and branch_id are required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if branch belongs to this fleet
            try:
                branch = Branch.objects.get(id=branch_id, fleet=fleet)
            except Branch.DoesNotExist:
                return Response({'error': 'Branch not found or does not belong to your fleet'}, status=status.HTTP_404_NOT_FOUND)
            
            # Check if email already exists
            if User.objects.filter(email=email).exists():
                return Response({'error': 'User with this email already exists'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Create user with branch admin flag
            user = User.objects.create_user(
                email=email,
                password=password,
                name=name,
                phone=phone,
                is_branch_admin=True
            )
            
            # Create fleet member with admin role and branch assignment
            fleet_member = FleetMember.objects.create(
                fleet=fleet,
                user=user,
                role='admin',
                branch=branch
            )
            
            return Response({
                'message': 'Branch admin created successfully',
                'admin': {
                    'id': user.id,
                    'name': user.name,
                    'email': user.email,
                    'phone': user.phone,
                    'branch_id': str(branch.id),
                    'branch_name': branch.name,
                }
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def get_fleet_dashboard(self, request):
        print("get_fleet_dashboard inside the method")
        """Get fleet dashboard data with optional date range filtering"""
        try:
            # Check if user is a fleet owner
            if not request.user.is_fleet_owner:
                return Response({'error': 'Only fleet owners can view fleet dashboard'}, status=status.HTTP_403_FORBIDDEN)
            
            # Get the fleet for this user
            fleet = Fleet.objects.filter(owner=request.user).first()
            if not fleet:
                return Response({'error': 'No fleet found for this user'}, status=status.HTTP_404_NOT_FOUND)
            
            # Get date range from query parameters (default: last 30 days)
            start_date_str = request.query_params.get('start_date')
            end_date_str = request.query_params.get('end_date')
            
            if start_date_str and end_date_str:
                try:
                    start_date = timezone.make_aware(datetime.strptime(start_date_str, '%Y-%m-%d'))
                    end_date = timezone.make_aware(datetime.strptime(end_date_str, '%Y-%m-%d'))
                    # Set end_date to end of day
                    end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                except ValueError:
                    return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                # Default to last 30 days
                end_date = timezone.now()
                start_date = end_date - timedelta(days=30)
                start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Get all branches
            branches = Branch.objects.filter(fleet=fleet)
            total_branches = branches.count()
            
            # Get all vehicles in fleet (through FleetVehicle)
            fleet_vehicles = FleetVehicle.objects.filter(fleet=fleet)
            total_vehicles = fleet_vehicles.count()
            
            # Get all bookings for vehicles in this fleet
            vehicle_ids = [fv.vehicle.id for fv in fleet_vehicles]
            bookings = BookedAppointment.objects.filter(vehicle_id__in=vehicle_ids)
            total_bookings = bookings.count()
            
            # Get recent bookings (last 10)
            recent_bookings = bookings.order_by('-created_at')[:10]
            recent_bookings_data = []
            for booking in recent_bookings:
                recent_bookings_data.append({
                    'id': str(booking.id),
                    'booking_reference': booking.booking_reference,
                    'vehicle_reg': booking.vehicle.registration_number if booking.vehicle else None,
                    'service_type': booking.service_type.name,
                    'status': booking.status,
                    'appointment_date': booking.appointment_date.isoformat(),
                    'total_amount': float(booking.total_amount),
                })
            
            # Get referral code
            referral_code = request.user.referral_code
            
            # Get branch stats (include spend cap data)
            branches_data = []
            for branch in branches:
                branch_vehicles = FleetVehicle.objects.filter(fleet=fleet, branch=branch)
                branch_bookings = BookedAppointment.objects.filter(
                    vehicle_id__in=[bv.vehicle.id for bv in branch_vehicles]
                )
                period = branch.spend_limit_period or 'monthly'
                spent = get_branch_spend_for_period(branch, period)
                limit = branch.spend_limit
                remaining = None
                if limit is not None and limit > 0:
                    remaining = max(Decimal('0'), limit - spent)
                branches_data.append({
                    'id': str(branch.id),
                    'name': branch.name,
                    'address': branch.address,
                    'city': branch.city,
                    'vehicle_count': branch_vehicles.count(),
                    'booking_count': branch_bookings.count(),
                    'spend_limit': float(limit) if limit is not None else None,
                    'spend_limit_period': branch.spend_limit_period,
                    'spent': float(spent),
                    'remaining': float(remaining) if remaining is not None else None,
                })
            
            # Get analytics data
            branch_performance = get_branch_performance(fleet, start_date, end_date)
            spend_trends = get_spend_trends(fleet, start_date, end_date, granularity='daily')
            vehicle_health_scores = get_vehicle_health_scores(fleet, start_date, end_date)
            booking_activity = get_booking_activity(fleet, start_date, end_date)
            common_issues = get_common_issues(fleet, start_date, end_date)
            
            return Response({
                'fleet': {
                    'id': str(fleet.id),
                    'name': fleet.name,
                },
                'stats': {
                    'total_vehicles': total_vehicles,
                    'total_bookings': total_bookings,
                    'total_branches': total_branches,
                },
                'referral_code': referral_code,
                'branches': branches_data,
                'recent_bookings': recent_bookings_data,
                'analytics': {
                    'branch_performance': branch_performance,
                    'spend_trends': spend_trends,
                    'vehicle_health_scores': vehicle_health_scores,
                    'booking_activity': booking_activity,
                    'common_issues': common_issues,
                },
                'date_range': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat(),
                },
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def get_branch_vehicles(self, request, branch_id=None):
        """Get vehicles for a specific branch"""
        try:
            branch_id = branch_id or request.query_params.get('branch_id')
            
            if not branch_id:
                return Response({'error': 'Branch ID is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                branch = Branch.objects.get(id=branch_id)
            except Branch.DoesNotExist:
                return Response({'error': 'Branch not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Check permissions
            if request.user.is_fleet_owner:
                # Fleet owner can see all branches in their fleet
                fleet = Fleet.objects.filter(owner=request.user).first()
                if not fleet or branch.fleet != fleet:
                    return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
            elif request.user.is_branch_admin:
                # Branch admin can only see their own branch
                managed_branch = request.user.get_managed_branch()
                if not managed_branch or managed_branch.id != branch.id:
                    return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
            else:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
            
            # Get vehicles for this branch
            fleet_vehicles = FleetVehicle.objects.filter(fleet=branch.fleet, branch=branch)
            
            vehicles_data = []
            for fv in fleet_vehicles:
                vehicle = fv.vehicle
                # Get current owner
                ownership = VehicleOwnership.objects.filter(
                    vehicle=vehicle,
                    end_date__isnull=True
                ).first()
                
                vehicles_data.append({
                    'id': str(vehicle.id),
                    'make': vehicle.make,
                    'model': vehicle.model,
                    'year': vehicle.year,
                    'color': vehicle.color,
                    'registration_number': vehicle.registration_number,
                    'country': vehicle.country,
                    'vin': vehicle.vin,
                    'current_owner': ownership.owner.name if ownership else None,
                    'branch_id': str(branch.id),
                    'branch_name': branch.name,
                })
            
            return Response({
                'branch': {
                    'id': str(branch.id),
                    'name': branch.name,
                },
                'vehicles': vehicles_data,
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def get_branch_spend(self, request):
        """Get spend limit, spent, and remaining for a branch. Fleet owner: branch_id in query. Branch admin: managed branch."""
        try:
            branch = None
            if request.user.is_fleet_owner:
                branch_id = request.query_params.get('branch_id')
                if not branch_id:
                    return Response({'error': 'branch_id is required for fleet owners'}, status=status.HTTP_400_BAD_REQUEST)
                fleet = Fleet.objects.filter(owner=request.user).first()
                if not fleet:
                    return Response({'error': 'No fleet found'}, status=status.HTTP_404_NOT_FOUND)
                try:
                    branch = Branch.objects.get(id=branch_id, fleet=fleet)
                except Branch.DoesNotExist:
                    return Response({'error': 'Branch not found'}, status=status.HTTP_404_NOT_FOUND)
            elif request.user.is_branch_admin:
                branch = request.user.get_managed_branch()
                if not branch:
                    return Response({'error': 'No managed branch found'}, status=status.HTTP_404_NOT_FOUND)
            else:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
            
            period = branch.spend_limit_period or 'monthly'
            spent = get_branch_spend_for_period(branch, period)
            limit = branch.spend_limit
            remaining = None
            if limit is not None and limit > 0:
                remaining = max(Decimal('0'), limit - spent)
            
            return Response({
                'branch_id': str(branch.id),
                'spend_limit': float(limit) if limit is not None else None,
                'spend_limit_period': branch.spend_limit_period,
                'spent': float(spent),
                'remaining': float(remaining) if remaining is not None else None,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def update_branch(self, request, branch_id=None):
        """Update a branch"""
        try:
            branch_id = branch_id or request.data.get('branch_id')
            
            if not branch_id:
                return Response({'error': 'Branch ID is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if user is a fleet owner
            if not request.user.is_fleet_owner:
                return Response({'error': 'Only fleet owners can update branches'}, status=status.HTTP_403_FORBIDDEN)
            
            # Get the fleet for this user
            fleet = Fleet.objects.filter(owner=request.user).first()
            if not fleet:
                return Response({'error': 'No fleet found for this user'}, status=status.HTTP_404_NOT_FOUND)
            
            try:
                branch = Branch.objects.get(id=branch_id, fleet=fleet)
            except Branch.DoesNotExist:
                return Response({'error': 'Branch not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Update branch fields
            if 'name' in request.data:
                branch.name = request.data.get('name')
            if 'address' in request.data:
                branch.address = request.data.get('address')
            if 'postcode' in request.data:
                branch.postcode = request.data.get('postcode')
            if 'city' in request.data:
                branch.city = request.data.get('city')
            if 'country' in request.data:
                branch.country = request.data.get('country')
            if 'spend_limit' in request.data:
                sl = request.data.get('spend_limit')
                if sl is not None:
                    sl = Decimal(str(sl))
                    if sl < 0:
                        return Response(
                            {'error': 'spend_limit must be >= 0'},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    branch.spend_limit = sl
                    if sl == 0:
                        branch.spend_limit_period = None
            if 'spend_limit_period' in request.data:
                period = request.data.get('spend_limit_period')
                if period in ('weekly', 'monthly'):
                    branch.spend_limit_period = period
                elif period is None or period == '':
                    branch.spend_limit_period = None
            
            branch.save()
            
            period = branch.spend_limit_period or 'monthly'
            spent = get_branch_spend_for_period(branch, period)
            limit = branch.spend_limit
            remaining = None
            if limit is not None and limit > 0:
                remaining = max(Decimal('0'), limit - spent)
            
            return Response({
                'message': 'Branch updated successfully',
                'branch': {
                    'id': str(branch.id),
                    'name': branch.name,
                    'address': branch.address,
                    'postcode': branch.postcode,
                    'city': branch.city,
                    'country': branch.country,
                    'spend_limit': float(limit) if limit is not None else None,
                    'spend_limit_period': branch.spend_limit_period,
                    'spent': float(spent),
                    'remaining': float(remaining) if remaining is not None else None,
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def delete_branch(self, request, branch_id=None):
        """Delete a branch (only if it has no vehicles)"""
        try:
            branch_id = branch_id or request.query_params.get('branch_id') or request.data.get('branch_id')
            
            if not branch_id:
                return Response({'error': 'Branch ID is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if user is a fleet owner
            if not request.user.is_fleet_owner:
                return Response({'error': 'Only fleet owners can delete branches'}, status=status.HTTP_403_FORBIDDEN)
            
            # Get the fleet for this user
            fleet = Fleet.objects.filter(owner=request.user).first()
            if not fleet:
                return Response({'error': 'No fleet found for this user'}, status=status.HTTP_404_NOT_FOUND)
            
            try:
                branch = Branch.objects.get(id=branch_id, fleet=fleet)
            except Branch.DoesNotExist:
                return Response({'error': 'Branch not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Check if branch has vehicles
            vehicle_count = FleetVehicle.objects.filter(branch=branch).count()
            if vehicle_count > 0:
                return Response({
                    'error': f'Cannot delete branch with {vehicle_count} vehicle(s). Please remove vehicles first.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            branch_name = branch.name
            branch.delete()
            
            return Response({
                'message': f'Branch {branch_name} deleted successfully'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def get_vehicle_bookings(self, request, vehicle_id=None):
        """Get bookings for a specific vehicle (last 90 days)"""
        try:
            vehicle_id = vehicle_id or request.query_params.get('vehicle_id')
            
            if not vehicle_id:
                return Response({'error': 'Vehicle ID is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                vehicle = Vehicle.objects.get(id=vehicle_id)
            except Vehicle.DoesNotExist:
                return Response({'error': 'Vehicle not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Check permissions - user must have access to this vehicle
            has_access = False
            
            if request.user.is_fleet_owner:
                # Fleet owner: Check if vehicle is in their fleet
                fleet = Fleet.objects.filter(owner=request.user).first()
                if fleet:
                    has_access = FleetVehicle.objects.filter(
                        fleet=fleet,
                        vehicle=vehicle
                    ).exists()
            elif request.user.is_branch_admin:
                # Branch admin: Check if vehicle is in their managed branch
                managed_branch = request.user.get_managed_branch()
                if managed_branch:
                    has_access = FleetVehicle.objects.filter(
                        fleet=managed_branch.fleet,
                        branch=managed_branch,
                        vehicle=vehicle
                    ).exists()
            else:
                # Regular user: Check direct ownership
                ownership = VehicleOwnership.objects.filter(
                    vehicle=vehicle,
                    owner=request.user,
                    end_date__isnull=True
                ).first()
                has_access = ownership is not None
            
            if not has_access:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
            
            # Get bookings for this vehicle in the last 90 days
            ninety_days_ago = timezone.now() - timedelta(days=90)
            bookings = BookedAppointment.objects.filter(
                vehicle=vehicle,
                created_at__gte=ninety_days_ago
            ).select_related('service_type').order_by('-created_at')
            
            bookings_data = []
            for booking in bookings:
                bookings_data.append({
                    'id': str(booking.id),
                    'booking_reference': booking.booking_reference,
                    'created_at': booking.created_at.isoformat(),
                    'appointment_date': booking.appointment_date.isoformat(),
                    'status': booking.status,
                    'service_type': booking.service_type.name if booking.service_type else 'N/A',
                    'total_amount': float(booking.total_amount),
                })
            
            return Response({
                'vehicle': {
                    'id': str(vehicle.id),
                    'make': vehicle.make,
                    'model': vehicle.model,
                    'year': vehicle.year,
                    'registration_number': vehicle.registration_number,
                },
                'bookings': bookings_data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def get_branch_admins(self, request, branch_id=None):
        """Get all branch admins for a specific branch"""
        try:
            branch_id = branch_id or request.query_params.get('branch_id')
            
            if not branch_id:
                return Response({'error': 'Branch ID is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                branch = Branch.objects.get(id=branch_id)
            except Branch.DoesNotExist:
                return Response({'error': 'Branch not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Check permissions
            if request.user.is_fleet_owner:
                # Fleet owner: Check if branch belongs to their fleet
                fleet = Fleet.objects.filter(owner=request.user).first()
                if not fleet or branch.fleet != fleet:
                    return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
            elif request.user.is_branch_admin:
                # Branch admin: Can only see admins of their own branch
                managed_branch = request.user.get_managed_branch()
                if not managed_branch or managed_branch.id != branch.id:
                    return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
            else:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
            
            # Get all admins for this branch
            branch_admins = FleetMember.objects.filter(
                branch=branch,
                role='admin'
            ).select_related('user')
            
            admins_data = []
            for member in branch_admins:
                admins_data.append({
                    'id': str(member.user.id),
                    'name': member.user.name,
                    'email': member.user.email,
                    'phone': member.user.phone,
                    'joined_at': member.joined_at.isoformat(),
                })
            
            return Response({'admins': admins_data}, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
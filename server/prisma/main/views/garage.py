from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db import models
from main.models import Vehicles, BookedAppointment
from main.util.media_helper import get_full_media_url   
from datetime import datetime, timedelta
from main.serializer import VehiclesSerializer


class GarageView(APIView):
    permission_classes = [IsAuthenticated]


    """ Define a set of action handlers that would be used to route the url to the appropriate function """
    action_handlers = {
        'add_vehicle': 'add_vehicle',
        'get_vehicles': 'get_vehicles',
        'update_vehicle': 'update_vehicle',
        'delete_vehicle': 'delete_vehicle',
        'get_vehicle_stats': 'get_vehicle_stats',
    }

    """ Override the crude methods and defines methods that would route the user to the appropriate function given
        the url path in the kwargs
      """
    def get(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handlers:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handlers[action])
        
        # Check if we have vehicle_id in kwargs (from URL path)
        vehicle_id = kwargs.get('vehicle_id')
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
        
        # Check if we have vehicle_id in kwargs (from URL path)
        vehicle_id = kwargs.get('vehicle_id')
        if vehicle_id is not None:
            return handler(request, vehicle_id)
        return handler(request)
    
    
    def delete(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handlers:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handlers[action])
        
        # Check if we have vehicle_id in kwargs (from URL path)
        vehicle_id = kwargs.get('vehicle_id')
        if vehicle_id is not None:
            return handler(request, vehicle_id)
        return handler(request)
    
    """ Here we will define the methods that would handle the jobs that are to be done on the server """

    def add_vehicle(self, request):
        """ Add a vehicle to the db and return the vehicle object after adding it to the db
            ARGS:
                request: The request object that contains the vehicle object to be added to the db
                {
                    "make": "string",
                    "model": "string",
                    "year": "int",
                    "color": "string",
                    "licence": "string",
                }
            Returns:
                {
                    "id": "string",
                    "make": "string",
                    "model": "string",
                    "year": "int",
                    "color": "string",
                    "licence": "string",
                    "image": "any",
                }
          """
        print(request.data)
        try:
            make = request.data.get('make')
            model = request.data.get('model')
            year = request.data.get('year')
            color = request.data.get('color')
            licence = request.data.get('licence')
            image = request.FILES.get('image')  # Handle file upload
            
            if not all([make, model, year, color, licence]):
                return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Create vehicle with image
            new_vehicle = Vehicles.objects.create(
                user=request.user,
                make=make,
                model=model,
                year=year,
                color=color,
                licence=licence,
                image=image,  # This will automatically upload to S3 if configured
            )
            # Return the vehicle object
            print(f'You just added {new_vehicle.make} {new_vehicle.model} {new_vehicle.year} to your garage')
            return Response({
                'message': f'You just added {new_vehicle.make} {new_vehicle.model} {new_vehicle.year} to your garage',
                'vehicle_id': new_vehicle.id,
                'image_url': get_full_media_url(new_vehicle.image.url) if new_vehicle.image else None,
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            

    def get_vehicles(self, request):
        """ Get all the vehicles from the db and return the vehicle objects
            ARGS:
                request: The request object that contains the user object
            Returns:
                    [
                        {
                            "id": "string",
                            "make": "string",
                            "model": "string",
                            "year": "int",
                            "color": "string",
                            "licence": "string",
                            "image": "any",
                        },
                        ...
                    ]
          """
        try:
            # Get all the vehicles from the db associated with the user
            vehicles = Vehicles.objects.filter(user=request.user)

            vehicles_list = []
            for vehicle in vehicles:
                vehicles_list.append({
                    'id': vehicle.id,
                    'make': vehicle.make,
                    'model': vehicle.model,
                    'year': vehicle.year,
                    'color': vehicle.color,
                    'licence': vehicle.licence,
                    'image': get_full_media_url(vehicle.image.url) if vehicle.image else None,
                })
            return Response({'vehicles': vehicles_list}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        

    def update_vehicle(self, request, vehicle_id=None):
        """ Update a vehicle in the db and return the vehicle object after updating it in the db
            ARGS:
                {
                    "make": "string",
                    "model": "string",
                    "year": "int",
                    "color": "string",
                    "licence": "string",
                }
            Returns:
                {
                    "id": "string",
                    "make": "string",
                    "model": "string",
                    "year": "int",
                    "color": "string",
                    "licence": "string",
                    "image": "any",
                }
            URL PARAMS:
                vehicle_id: The id of the vehicle to be updated in the db (from URL path)
            QUERY PARAMS:
                vehicle_id: The id of the vehicle to be updated in the db (fallback from query params)
          """
        try:
            make = request.data.get('make')
            model = request.data.get('model')
            year = request.data.get('year')
            color = request.data.get('color')
            licence = request.data.get('licence')
            image = request.data.get('image')

            # Get the vehicle_id from URL path first, then fallback to query params
            if vehicle_id is None:
                vehicle_id = request.query_params.get('vehicle_id')

            if not vehicle_id:
                return Response({'error': 'Vehicle ID is required'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                # Get the vehicle from the db
                vehicle = Vehicles.objects.get(id=vehicle_id, user=request.user)

                # Check if the vehicle exists and return an error if it does not
                if not vehicle:
                    return Response({'error': 'Vehicle not found'}, status=status.HTTP_404_NOT_FOUND)
            except Vehicles.DoesNotExist:
                return Response({'error': 'Vehicle not found'}, status=status.HTTP_404_NOT_FOUND)
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

            # Update the vehicle with the new values or the old values if no new values are provided
            vehicle.make = make if make else vehicle.make
            vehicle.model = model if model else vehicle.model
            vehicle.year = year if year else vehicle.year
            vehicle.color = color if color else vehicle.color
            vehicle.licence = licence if licence else vehicle.licence
            vehicle.image = image if image else vehicle.image
            # Save the vehicle to the db
            vehicle.save()
            # Return the vehicle object
            return Response({
                'id': vehicle.id,
                'make': vehicle.make,
                'model': vehicle.model,
                'year': vehicle.year,
                'color': vehicle.color,
                'licence': vehicle.licence,
                'image': get_full_media_url(vehicle.image.url) if vehicle.image else None,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        

    def delete_vehicle(self, request, vehicle_id=None):
        """ Delete a vehicle from the db and return the vehicle object after deleting it from the db
            ARGS:
                request: The request object that contains the user object
                vehicle_id: The id of the vehicle to be deleted from the db (from URL path or query params)
            Returns:
                {
                    "message": "string"
                }
            URL PARAMS:
                vehicle_id: The id of the vehicle to be deleted from the db (from URL path)
            QUERY PARAMS:
                vehicle_id: The id of the vehicle to be deleted from the db (fallback from query params)
          """
        try:
            # Get the vehicle_id from URL path first, then fallback to query params
            if vehicle_id is None:
                vehicle_id = request.query_params.get('vehicle_id')
            
            if not vehicle_id:
                return Response({'error': 'Vehicle ID is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Get the vehicle from the db
            try:
                vehicle = Vehicles.objects.get(id=vehicle_id, user=request.user)
            except Vehicles.DoesNotExist:
                return Response({'error': 'Vehicle not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Store vehicle info before deletion for the response message
            vehicle_make = vehicle.make
            vehicle_model = vehicle.model
            
            # Delete the vehicle from the db
            vehicle.delete()
            
            # Return success message
            return Response({
                'message': f'You have successfully deleted {vehicle_make} {vehicle_model} from your garage',
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)  
        
        
    def get_vehicle_stats(self, request, vehicle_id=None):
        """ Get the stats of a vehicle from the db and return the vehicle stats object
            ARGS:
                request: The request object that contains the user object
            Returns:
                {
                    "vehicle": {
                        "id": "string",
                        "make": "string",
                        "model": "string",
                        "year": "int",
                        "color": "string",
                        "licence": "string",
                        "image": "string",
                    },
                    "total_bookings": "int",
                    "total_amount": "float",
                    "last_cleaned": "string",
                    "next_recommended_service": "string"
                }
            URL PARAMS:
                vehicle_id: The id of the vehicle to get the stats for (from URL path)
            QUERY PARAMS:
                vehicle_id: The id of the vehicle to get the stats for (fallback from query params)
          """
        try:
            # Get the vehicle_id from URL path first, then fallback to query params
            if vehicle_id is None:
                vehicle_id = request.query_params.get('vehicle_id')
            
            if not vehicle_id:
                return Response({'error': 'Vehicle ID is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Get the vehicle from the db
            try:
                vehicle = Vehicles.objects.get(id=vehicle_id, user=request.user)
            except Vehicles.DoesNotExist:
                return Response({'error': 'Vehicle not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Get all bookings for this vehicle
            bookings = BookedAppointment.objects.filter(vehicle=vehicle)
            total_bookings = bookings.count() if bookings else 0
            total_amount = bookings.filter(status__in=['completed', 'confirmed', 'in_progress']).aggregate(
                total=models.Sum('total_amount')
            )['total'] or 0.0
            
            # Get the last cleaned date (last completed booking)
            last_cleaned = None
            last_completed_booking = bookings.filter(status='completed').order_by('-appointment_date').first() if bookings else None
            if last_completed_booking:
                last_cleaned = last_completed_booking.appointment_date.isoformat()
            
            # Calculate next recommended service (30 days from last cleaning or 30 days from now if no previous cleaning)
            next_recommended_service = None
            if last_cleaned:
                last_cleaned_date = datetime.fromisoformat(last_cleaned.replace('Z', '+00:00'))
                next_recommended_service = (last_cleaned_date + timedelta(days=14)).isoformat()
            else:
                next_recommended_service = (datetime.now() + timedelta(days=14)).isoformat()

            
            # Return the vehicle stats
            return Response({
                'vehicle': {
                    'id': vehicle.id,
                    'make': vehicle.make,
                    'model': vehicle.model,
                    'year': vehicle.year,
                    'color': vehicle.color,
                    'licence': vehicle.licence,
                },
                'total_bookings': total_bookings,
                'total_amount': float(total_amount),
                'last_cleaned': last_cleaned,
                'next_recommended_service': next_recommended_service,
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

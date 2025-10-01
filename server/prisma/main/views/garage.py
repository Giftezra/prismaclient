from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db import models
from main.models import Vehicles, BookedAppointment
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
        'test_s3_connection': 'test_s3_connection',
    }

    """ Override the crude methods and defines methods that would route the user to the appropriate function given
        the url path in the kwargs
      """
    def get(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handlers:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handlers[action])
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
        print(f"Request data: {request.data}")
        print(f"Request content type: {request.content_type}")
        print(f"Request method: {request.method}")
        
        try:
            make = request.data.get('make')
            model = request.data.get('model')
            year = request.data.get('year')
            color = request.data.get('color')
            licence = request.data.get('licence')
            
            print(f"Parsed data - make: {make}, model: {model}, year: {year}, color: {color}, licence: {licence}")
            
            if not all([make, model, year, color, licence]):
                return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Create vehicle without image
            new_vehicle = Vehicles.objects.create(
                user=request.user,
                make=make,
                model=model,
                year=year,
                color=color,
                licence=licence,
            )
            
            # Return the vehicle object without image
            vehicle_data = {
                'id': new_vehicle.id,
                'make': new_vehicle.make,
                'model': new_vehicle.model,
                'year': new_vehicle.year,
                'color': new_vehicle.color,
                'licence': new_vehicle.licence,
            }
            print(f"Returning vehicle data: {vehicle_data}")
            return Response({
                'message': f'You just added {new_vehicle.make} {new_vehicle.model} {new_vehicle.year} to your garage',
                'vehicle': vehicle_data,
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            print(f"Error in add_vehicle: {str(e)}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


    def get_vehicles(self, request):
        try:
            # Get all the vehicles from the db associated with the user
            vehicles = Vehicles.objects.filter(user=request.user)

            vehicles_list = []
            for vehicle in vehicles:
                vehicle_data = {
                    'id': vehicle.id,
                    'make': vehicle.make,
                    'model': vehicle.model,
                    'year': vehicle.year,
                    'color': vehicle.color,
                    'licence': vehicle.licence,
                }
                vehicles_list.append(vehicle_data)
            print(f"Vehicles list: {vehicles_list}")
            return Response({'vehicles': vehicles_list}, status=status.HTTP_200_OK)
        except Exception as e:
            print(f"Error in get_vehicles: {str(e)}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        

    def update_vehicle(self, request, vehicle_id=None):
        try:
            make = request.data.get('make')
            model = request.data.get('model')
            year = request.data.get('year')
            color = request.data.get('color')
            licence = request.data.get('licence')

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
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        

    def delete_vehicle(self, request, vehicle_id=None):
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
            bookings = BookedAppointment.objects.filter(vehicle=vehicle, status__in=['completed', 'in_progress'])
            total_bookings = bookings.count() if bookings else 0
            
            # Calculate total amount including tips for COMPLETED bookings only
            completed_bookings = bookings.filter(status='completed')
            total_amount = 0.0
            
            for booking in completed_bookings:
                booking_total = float(booking.total_amount)
                # Add tip if it exists
                if booking.review_tip:
                    booking_total += float(booking.review_tip)
                total_amount += booking_total
            
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

    def test_s3_connection(self, request):
        """Test S3 connection and configuration"""
        try:
            from django.conf import settings
            import boto3
            from botocore.exceptions import ClientError, NoCredentialsError
            
            print(f"Testing S3 connection...")
            print(f"AWS_ACCESS_KEY_ID: {settings.AWS_ACCESS_KEY_ID}")
            print(f"AWS_SECRET_ACCESS_KEY: {'*' * len(settings.AWS_SECRET_ACCESS_KEY) if settings.AWS_SECRET_ACCESS_KEY else 'None'}")
            print(f"AWS_STORAGE_BUCKET_NAME: {settings.AWS_STORAGE_BUCKET_NAME}")
            print(f"AWS_S3_REGION_NAME: {settings.AWS_S3_REGION_NAME}")
            
            # Test S3 connection
            s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION_NAME
            )
            
            # Test bucket access
            try:
                response = s3_client.head_bucket(Bucket=settings.AWS_STORAGE_BUCKET_NAME)
                print(f"Bucket access successful: {response}")
                
                # Test file upload
                test_key = 'test/connection_test.txt'
                test_content = 'S3 connection test'
                
                s3_client.put_object(
                    Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                    Key=test_key,
                    Body=test_content,
                    ContentType='text/plain'
                )
                print(f"Test file uploaded successfully: {test_key}")
                
                # Test file URL generation
                test_url = f"https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.{settings.AWS_S3_REGION_NAME}.amazonaws.com/{test_key}"
                print(f"Generated test URL: {test_url}")
                
                # Clean up test file
                s3_client.delete_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=test_key)
                print("Test file cleaned up")
                
                return Response({
                    'status': 'success',
                    'message': 'S3 connection successful',
                    'bucket': settings.AWS_STORAGE_BUCKET_NAME,
                    'region': settings.AWS_S3_REGION_NAME,
                    'test_url': test_url
                }, status=status.HTTP_200_OK)
                
            except ClientError as e:
                error_code = e.response['Error']['Code']
                print(f"S3 bucket access error: {error_code} - {e}")
                return Response({
                    'status': 'error',
                    'message': f'S3 bucket access failed: {error_code}',
                    'error': str(e)
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except NoCredentialsError:
            print("AWS credentials not found")
            return Response({
                'status': 'error',
                'message': 'AWS credentials not configured',
                'error': 'No AWS credentials found'
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"S3 connection test failed: {str(e)}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            return Response({
                'status': 'error',
                'message': 'S3 connection test failed',
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

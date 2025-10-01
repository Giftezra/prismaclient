from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from main.models import Address, BookedAppointment

class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    """ Define a set of action handlers that would be used to route the url to the appropriate function """
    action_handlers = {
        "get_addresses": "get_addresses",
        "add_new_address": "add_address",
        "update_address": "update_address",
        "delete_address": "delete_address",
        'get_service_history': 'get_service_history',
        'update_push_notification_token': 'update_push_notification_token',
        'update_email_notification_token': 'update_email_notification_token',
        'update_marketing_email_token': 'update_marketing_email_token',
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
    
    """ The functions defined here are the functions that will be used to hanlde different actions that are defined in the action handlers """

    def add_address(self, request):
        """ Add a new address to the user's profile.
        ARGS
            request: The request object which contains the address data
            {
                "address": "123 Main St",
                "post_code": "12345",
                "city": "Anytown",
                "country": "USA"
            }
        RETURNS:
            A response object containing the saved address data matching MyAddressProps interface
            {
                "id": "address-id",
                "address": "123 Main St",
                "post_code": "12345",
                "city": "Anytown",
                "country": "USA"
            }
        """
        try:
            address = request.data.get('address')
            post_code = request.data.get('post_code')
            city = request.data.get('city')
            country = request.data.get('country')

            # Validate required fields
            if not all([address, post_code, city, country]):
                return Response(
                    {'error': 'All fields (address, post_code, city, country) are required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Create a new address object and save the address to the database
            new_address = Address.objects.create(
                address=address,
                post_code=post_code,
                city=city,
                country=country,
                user=request.user
            )
            new_address.save()
            
            # Return the saved address data matching MyAddressProps interface
            return Response({
                'id': str(new_address.id),
                'address': new_address.address,
                'post_code': new_address.post_code,
                'city': new_address.city,
                'country': new_address.country
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


    def update_address(self, request):
        """ Update an existing address in the user's profile.
        ARGS
            request: The request object which contains the address data
            {
                "address": "123 Main St",
                "post_code":     "12345",
                "city": "Anytown",
                "country": "USA"
            }
            and also the id of the address to update
        RETURNS:
            A message indicating that the address was updated successfully
        """
        try:
            address = request.data.get('address')
            post_code = request.data.get('post_code')
            city = request.data.get('city')
            country = request.data.get('country')
            id = request.data.get('id')
            
            # Get the address object to be updated using the id and the user object
            # Return an error if the address is not found 
            try:
                address_to_update = Address.objects.get(id=id, user=request.user)
            except Address.DoesNotExist:
                return Response({'error': 'Address not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Update the address object with the new data or the old data if no new data is provided
            address_to_update.address = address if address else address_to_update.address
            address_to_update.post_code = post_code if post_code else address_to_update.post_code
            address_to_update.city = city if city else address_to_update.city
            address_to_update.country = country if country else address_to_update.country

            # Save the updated address object
            address_to_update.save()
            return Response({
                'id': str(address_to_update.id),
                'address': address_to_update.address,
                'post_code': address_to_update.post_code,
                'city': address_to_update.city,
                'country': address_to_update.country
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        
    def delete_address(self, request):
        """ Delete an existing address from the user's profile.
        ARGS
            request: The request object which contains the id of the address to delete
        RETURNS:
            A message indicating that the address was deleted successfully
        """
        try:
            id = request.data.get('id')
            # Get the address object to be deleted using the id and the user object
            # Return an error if the address is not found 
            try:
                address_to_delete = Address.objects.get(id=id, user=request.user)
            except Address.DoesNotExist:
                return Response({'error': 'Address not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Delete the address object
            address_to_delete.delete()
            return Response({'id': id, 'message': 'Address deleted successfully'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        

    def get_addresses(self, request):
        """ Get all the addresses for the user.
        RETURNS:
            A response object containing the data of the action to route the url to the appropriate function
            {
                "addresses": [
                    {
                        "id": "123",
                        "address": "123 Main St",
                        "post_code": "12345",
                        "city": "Anytown",
                        "country": "USA"
                    }
                ]
            }
        """
        try:
            # Get all the addresses for the user
            addresses = Address.objects.filter(user=request.user)
            # Create the list of addresses to return
            addresses_list = []
            for address in addresses:
                addresses_list.append({
                    'id': address.id,
                    'address': address.address,
                    'post_code': address.post_code,
                    'city': address.city,
                    'country': address.country
                })
            return Response({'addresses': addresses_list}, status=status.HTTP_200_OK)
        
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        

    def get_service_history(self, request):
        try:
            # Get all booked appointments for the current user
            # Include related data to avoid N+1 queries
            # Order by appointment_date in descending order (most recent first)
            appointments = BookedAppointment.objects.filter(user=request.user, status__in=["completed", "cancelled"]).order_by('-appointment_date')
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
                        'vehicle_reg': appointment.vehicle.licence if appointment.vehicle else 'Unknown',
                        'address': {
                            'id': str(appointment.address.id) if appointment.address else '',
                            'address': appointment.address.address if appointment.address else '',
                            'post_code': appointment.address.post_code if appointment.address else '',
                            'city': appointment.address.city if appointment.address else '',
                            'country': appointment.address.country if appointment.address else ''
                        },
                        'detailer': {
                            'id': str(appointment.detailer.id) if appointment.detailer else '',
                            'name': appointment.detailer.name if appointment.detailer else 'Unknown',
                            'rating': float(appointment.detailer.rating) if appointment.detailer and appointment.detailer.rating else 0.0,
                            'phone': appointment.detailer.phone if appointment.detailer else '',
                        },
                        'status': appointment.status,
                        'total_amount': float(appointment.total_amount)
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



    def update_push_notification_token(self, request):
        try:
            update_value = request.data.get('update')
            
            if update_value is None:
                return Response(
                    {'error': 'Update value is required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            request.user.allow_push_notifications = update_value
            request.user.save()
            
            return Response({
                'success': True,
                'message': 'Push notification setting updated successfully',
                'value': update_value
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)



    def update_email_notification_token(self, request):
        try:
            update_value = request.data.get('update')
            
            if update_value is None:
                return Response(
                    {'error': 'Update value is required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Update the user's email notification setting
            request.user.allow_email_notifications = update_value
            request.user.save()
            
            return Response({
                'success': True,
                'message': 'Email notification setting updated successfully',
                'value': update_value
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)



    def update_marketing_email_token(self, request):
        try:
            update_value = request.data.get('update')
            
            if update_value is None:
                return Response(
                    {'error': 'Update value is required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Update the user's marketing email setting
            request.user.allow_marketing_emails = update_value
            request.user.save()
            
            return Response({
                'success': True,
                'message': 'Marketing email setting updated successfully',
                'value': update_value
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            
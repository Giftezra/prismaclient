from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.shortcuts import render
from django.utils import timezone
from django.db import transaction
from main.models import VehicleTransfer, VehicleOwnership
from main.tasks import send_transfer_approved_email, send_transfer_rejected_email


class WebTransferActionView(APIView):
    """
    Web view for vehicle transfer approval/rejection.
    Similar to password reset flow - renders HTML pages instead of JSON responses.
    """
    permission_classes = [AllowAny]
    
    def get(self, request, transfer_id):
        """Display the transfer confirmation page"""
        try:
            transfer = VehicleTransfer.objects.select_related('vehicle', 'from_owner', 'to_owner').get(id=transfer_id)
            
            # Check if transfer can still be processed
            if transfer.status != 'pending':
                return render(request, 'transfer_invalid.html', {
                    'error': f'This transfer request is {transfer.status} and cannot be processed',
                    'transfer': transfer
                })
            
            if transfer.is_expired():
                transfer.status = 'expired'
                transfer.save()
                return render(request, 'transfer_invalid.html', {
                    'error': 'This transfer request has expired',
                    'transfer': transfer
                })
            
            # Show confirmation page with vehicle details
            return render(request, 'transfer_action_confirm.html', {
                'transfer': transfer,
                'vehicle': transfer.vehicle,
                'requester': transfer.to_owner,
                'owner': transfer.from_owner,
                'expires_at': transfer.expires_at,
            })
            
        except VehicleTransfer.DoesNotExist:
            return render(request, 'transfer_invalid.html', {
                'error': 'Transfer request not found'
            })
        except Exception as e:
            return render(request, 'transfer_invalid.html', {
                'error': f'An error occurred: {str(e)}'
            })
    

    def post(self, request, transfer_id):
        """Process the transfer approval or rejection"""
        action = request.POST.get('action', '').strip().lower()
        
        if action not in ['approve', 'reject']:
            return render(request, 'transfer_invalid.html', {
                'error': 'Invalid action. Please use approve or reject.'
            })
        
        try:
            transfer = VehicleTransfer.objects.select_related('vehicle', 'from_owner', 'to_owner').get(id=transfer_id)
            
            # Validate transfer status
            if transfer.status != 'pending':
                return render(request, 'transfer_invalid.html', {
                    'error': f'This transfer request is {transfer.status} and cannot be processed',
                    'transfer': transfer
                })
            
            if transfer.is_expired():
                transfer.status = 'expired'
                transfer.save()
                return render(request, 'transfer_invalid.html', {
                    'error': 'This transfer request has expired',
                    'transfer': transfer
                })
            
            if action == 'approve':
                return self._process_approval(request, transfer)
            else:
                return self._process_rejection(request, transfer)
                
        except VehicleTransfer.DoesNotExist:
            return render(request, 'transfer_invalid.html', {
                'error': 'Transfer request not found'
            })
        except Exception as e:
            return render(request, 'transfer_invalid.html', {
                'error': f'An error occurred: {str(e)}'
            })
    

    def _process_approval(self, request, transfer):
        """Process transfer approval"""
        try:
            # Verify vehicle still has active ownership by from_owner
            active_ownership = transfer.vehicle.get_active_ownership()
            if not active_ownership or active_ownership.owner != transfer.from_owner:
                return render(request, 'transfer_invalid.html', {
                    'error': 'Vehicle ownership has changed. Transfer cannot be completed.',
                    'transfer': transfer
                })
            
            # Approve transfer
            with transaction.atomic():
                # End current ownership
                active_ownership.end_date = timezone.now().date()
                active_ownership.save()
                
                # Create new ownership for to_owner
                VehicleOwnership.objects.create(
                    vehicle=transfer.vehicle,
                    owner=transfer.to_owner,
                    ownership_type='private',
                    start_date=timezone.now().date(),
                )
                
                # Update transfer status
                transfer.status = 'approved'
                transfer.responded_at = timezone.now()
                transfer.save()
                
                # Increment owner count
                transfer.vehicle.owner_count += 1
                transfer.vehicle.save()
            
            # Send notification email
            send_transfer_approved_email.delay(
                transfer.id,
                transfer.to_owner.email,
                transfer.from_owner.name,
                transfer.vehicle.registration_number
            )
            
            return render(request, 'transfer_approve_success.html', {
                'transfer': transfer,
                'vehicle': transfer.vehicle,
                'requester': transfer.to_owner,
                'owner': transfer.from_owner,
            })
            
        except Exception as e:
            return render(request, 'transfer_invalid.html', {
                'error': f'Failed to approve transfer: {str(e)}',
                'transfer': transfer
            })

            
    
    def _process_rejection(self, request, transfer):
        """Process transfer rejection"""
        try:
            # Reject transfer
            transfer.status = 'rejected'
            transfer.responded_at = timezone.now()
            transfer.save()
            
            # Send notification email
            send_transfer_rejected_email.delay(
                transfer.id,
                transfer.to_owner.email,
                transfer.from_owner.name,
                transfer.vehicle.registration_number
            )
            
            return render(request, 'transfer_reject_success.html', {
                'transfer': transfer,
                'vehicle': transfer.vehicle,
                'requester': transfer.to_owner,
                'owner': transfer.from_owner,
            })
            
        except Exception as e:
            return render(request, 'transfer_invalid.html', {
                'error': f'Failed to reject transfer: {str(e)}',
                'transfer': transfer
            })

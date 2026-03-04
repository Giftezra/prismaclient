from rest_framework.response import Response
from rest_framework import status
from main.tasks import send_push_notification
import stripe
from django.conf import settings
from rest_framework.permissions import IsAuthenticated, AllowAny
from datetime import datetime, timedelta
from django.utils import timezone
from rest_framework.views import APIView
from main.models import (
    User, BookedAppointment, PaymentTransaction, RefundRecord, Address, PendingBooking, BulkOrder,
    Vehicle, ValetType, ServiceType, AddOns, LoyaltyProgram, Branch, ReferralAttribution
)
from main.utils.branch_spend import get_branch_spend_for_period
from main.utils.bulk_appointments import create_bulk_appointments
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import json
import time
import uuid
from decimal import Decimal

# Initialize Stripe with your secret key
stripe.api_key = settings.STRIPE_SECRET_KEY


def create_booking_from_pending(pending_booking):
    """
    Create actual BookedAppointment from pending booking data.
    Shared by PaymentView (free Quick Sparkle) and StripeWebhookView (post-payment).
    """
    booking_data = pending_booking.booking_data
    user = pending_booking.user

    # Extract related objects
    vehicle_id = booking_data.get('vehicle', {}).get('id') if isinstance(booking_data.get('vehicle'), dict) else booking_data.get('vehicle_id')
    valet_type_id = booking_data.get('valet_type', {}).get('id') if isinstance(booking_data.get('valet_type'), dict) else booking_data.get('valet_type_id')
    service_type_id = booking_data.get('service_type', {}).get('id') if isinstance(booking_data.get('service_type'), dict) else booking_data.get('service_type_id')
    address_id = booking_data.get('address', {}).get('id') if isinstance(booking_data.get('address'), dict) else booking_data.get('address_id')

    vehicle = Vehicle.objects.get(id=vehicle_id) if vehicle_id else None
    valet_type = ValetType.objects.get(id=valet_type_id)
    service_type = ServiceType.objects.get(id=service_type_id)

    # Try to get Address by ID first (for regular addresses)
    try:
        address = Address.objects.get(id=address_id)
    except (Address.DoesNotExist, ValueError):
        # If not found, check if it's a branch ID (UUID)
        try:
            branch_uuid = uuid.UUID(str(address_id))
            branch = Branch.objects.get(id=branch_uuid)
            # Create or get Address from branch data
            address, created = Address.objects.get_or_create(
                user=user,
                address=branch.address or '',
                post_code=branch.postcode or '',
                city=branch.city or '',
                country=branch.country or '',
                defaults={
                    'latitude': branch.latitude,
                    'longitude': branch.longitude
                }
            )
        except (Branch.DoesNotExist, ValueError, TypeError) as e:
            raise ValueError(f"Address with ID {address_id} not found")

    # Parse dates/times
    date_str = booking_data.get('date') or booking_data.get('appointment_date')
    appointment_date = datetime.strptime(date_str, '%Y-%m-%d').date()

    start_time_str = booking_data.get('start_time')
    start_time = None
    if start_time_str:
        try:
            start_time = datetime.strptime(start_time_str, '%H:%M:%S.%f').time()
        except Exception:
            try:
                start_time = datetime.strptime(start_time_str, '%H:%M:%S').time()
            except Exception:
                print(f"Could not parse start_time: {start_time_str}")

    # Calculate amounts
    subtotal_amount = booking_data.get('subtotal_amount')
    vat_amount = booking_data.get('vat_amount')
    vat_rate = booking_data.get('vat_rate', 23.00)
    total_amount = booking_data.get('total_amount')

    if subtotal_amount is None or vat_amount is None:
        if total_amount:
            vat_rate_decimal = vat_rate / 100 if vat_rate else 0.23
            subtotal_amount = total_amount / (1 + vat_rate_decimal)
            vat_amount = total_amount - subtotal_amount
        else:
            subtotal_amount = 0
            vat_amount = 0

    # Check if free Quick Sparkle should be applied (loyalty or partner referral)
    applied_free_wash = booking_data.get('applied_free_quick_sparkle', False)
    if applied_free_wash and service_type.name == 'The Quick Sparkle':
        loyalty_used = False
        try:
            loyalty = LoyaltyProgram.objects.get(user=user)
            if loyalty.can_use_free_quick_sparkle():
                loyalty.use_free_quick_sparkle()
                loyalty_used = True
                print(f"Free Quick Sparkle applied for user {user.id} (loyalty)")
        except LoyaltyProgram.DoesNotExist:
            pass

        if not loyalty_used:
            try:
                attr = ReferralAttribution.objects.get(referred_user=user, source='partner')
                if not attr.partner_free_wash_used and (attr.expires_at is None or attr.expires_at > timezone.now()):
                    attr.partner_free_wash_used = True
                    attr.save()
                    print(f"Free Quick Sparkle applied for user {user.id} (partner referral)")
            except ReferralAttribution.DoesNotExist:
                pass

    # Create booking
    appointment = BookedAppointment.objects.create(
        user=user,
        appointment_date=appointment_date,
        vehicle=vehicle,
        valet_type=valet_type,
        service_type=service_type,
        detailer=None,  # Will be assigned by detailer app
        address=address,
        status='confirmed',
        total_amount=total_amount,
        subtotal_amount=subtotal_amount,
        vat_amount=vat_amount,
        vat_rate=vat_rate,
        start_time=start_time,
        duration=booking_data.get('duration'),
        special_instructions=booking_data.get('special_instructions'),
        booking_reference=pending_booking.booking_reference
    )

    # Add add-ons
    addons_data = booking_data.get('addons', [])
    if addons_data:
        addon_ids = []
        for addon in addons_data:
            if isinstance(addon, dict):
                addon_ids.append(addon.get('id'))
            else:
                addon_ids.append(addon)
        addons = AddOns.objects.filter(id__in=addon_ids)
        appointment.add_ons.set(addons)
        appointment.save()

    # Send push notification
    send_push_notification.delay(
        user.id,
        "Booking Confirmed! 🎉",
        f"Your booking for {appointment_date} has been confirmed. Payment received!",
        "booking_confirmed"
    )

    print(f"Created booking {appointment.id} from pending booking {pending_booking.id}")
    return appointment


def build_detailer_payload_from_booking_data(booking_data, user, booking_reference):
    """
    Build the flat payload expected by the detailer app from client booking_data.
    Used when detailer_booking_data was not provided by the frontend.
    """
    if not booking_data or not isinstance(booking_data, dict):
        return {}

    # Resolve address to a dict with address, post_code, city, country, latitude, longitude
    address_obj = booking_data.get('address')
    address_id = None
    if isinstance(address_obj, dict):
        if 'address' in address_obj or 'city' in address_obj:
            addr = address_obj
        else:
            address_id = address_obj.get('id')
    else:
        address_id = booking_data.get('address_id')

    if address_id and not (isinstance(address_obj, dict) and ('address' in address_obj or 'city' in address_obj)):
        try:
            address = Address.objects.get(id=address_id)
            addr = {
                'address': address.address or '',
                'post_code': getattr(address, 'post_code', None) or '',
                'city': address.city or '',
                'country': address.country or '',
                'latitude': address.latitude,
                'longitude': address.longitude,
            }
        except (Address.DoesNotExist, ValueError):
            try:
                branch = Branch.objects.get(id=uuid.UUID(str(address_id)))
                addr = {
                    'address': branch.address or '',
                    'post_code': getattr(branch, 'postcode', None) or getattr(branch, 'post_code', None) or '',
                    'city': branch.city or '',
                    'country': branch.country or '',
                    'latitude': branch.latitude,
                    'longitude': branch.longitude,
                }
            except (Branch.DoesNotExist, ValueError, TypeError):
                addr = {'address': '', 'post_code': '', 'city': '', 'country': '', 'latitude': None, 'longitude': None}
    elif isinstance(address_obj, dict):
        addr = {
            'address': address_obj.get('address', ''),
            'post_code': address_obj.get('post_code', '') or address_obj.get('postcode', ''),
            'city': address_obj.get('city', ''),
            'country': address_obj.get('country', ''),
            'latitude': address_obj.get('latitude'),
            'longitude': address_obj.get('longitude'),
        }
    else:
        addr = {'address': '', 'post_code': '', 'city': '', 'country': '', 'latitude': None, 'longitude': None}

    # Vehicle
    vehicle = booking_data.get('vehicle') if isinstance(booking_data.get('vehicle'), dict) else {}
    valet_type = booking_data.get('valet_type')
    valet_type_name = valet_type.get('name', '') if isinstance(valet_type, dict) else ''
    service_type = booking_data.get('service_type')
    service_type_name = service_type.get('name', '') if isinstance(service_type, dict) else ''

    # Addons: list of names
    addons_raw = booking_data.get('addons', [])
    addon_names = []
    for a in addons_raw:
        if isinstance(a, dict):
            if a.get('name'):
                addon_names.append(a['name'])
        else:
            addon_names.append(str(a))
    # If we only have IDs, resolve names from AddOns
    if not addon_names and addons_raw:
        addon_ids = [a.get('id') if isinstance(a, dict) else a for a in addons_raw]
        addon_ids = [x for x in addon_ids if x is not None]
        if addon_ids:
            addon_names = list(AddOns.objects.filter(id__in=addon_ids).values_list('name', flat=True))

    # start_time + duration -> end_time
    start_time_str = booking_data.get('start_time', '00:00:00')
    duration_minutes = booking_data.get('duration') or 0
    try:
        try:
            start_dt = datetime.strptime(start_time_str, '%H:%M:%S.%f')
        except ValueError:
            start_dt = datetime.strptime(start_time_str, '%H:%M:%S')
        end_dt = start_dt + timedelta(minutes=duration_minutes)
        end_time_str = end_dt.strftime('%H:%M:%S.%f')[:-3]
    except Exception:
        end_time_str = start_time_str

    date_str = booking_data.get('date') or booking_data.get('appointment_date', '')
    total_amount = booking_data.get('total_amount', 0)
    if total_amount is not None:
        try:
            total_amount = float(total_amount)
        except (TypeError, ValueError):
            total_amount = 0

    # Loyalty (optional)
    loyalty_tier = 'bronze'
    loyalty_benefits = []
    try:
        loyalty = LoyaltyProgram.objects.get(user=user)
        loyalty_tier = getattr(loyalty, 'current_tier', 'bronze') or 'bronze'
        benefits = loyalty.get_tier_benefits() if hasattr(loyalty, 'get_tier_benefits') else {}
        loyalty_benefits = benefits.get('free_service', []) or []
    except LoyaltyProgram.DoesNotExist:
        pass

    return {
        'booking_reference': booking_reference,
        'service_type': service_type_name,
        'client_name': getattr(user, 'name', '') or '',
        'client_phone': getattr(user, 'phone', '') or '',
        'vehicle_registration': vehicle.get('licence', '') or '',
        'vehicle_make': vehicle.get('make', '') or '',
        'vehicle_model': vehicle.get('model', '') or '',
        'vehicle_color': vehicle.get('color', '') or '',
        'vehicle_year': vehicle.get('year'),
        'address': addr.get('address', ''),
        'city': (addr.get('city') or '').strip(),
        'postcode': addr.get('post_code', '') or addr.get('postcode', ''),
        'country': (addr.get('country') or '').strip(),
        'latitude': addr.get('latitude'),
        'longitude': addr.get('longitude'),
        'valet_type': valet_type_name,
        'addons': addon_names,
        'special_instructions': booking_data.get('special_instructions', '') or '',
        'total_amount': total_amount,
        'status': 'accepted',  # No separate accept step; job is accepted when created
        'booking_date': date_str,
        'start_time': start_time_str,
        'end_time': end_time_str,
        'loyalty_tier': loyalty_tier,
        'loyalty_benefits': loyalty_benefits,
        'is_express_service': booking_data.get('is_express_service', False),
    }


def build_bulk_detailer_payload(booking_data, user, booking_reference):
    """Build payload for detailer create_bulk_booking from bulk booking_data or order_data."""
    if not booking_data or not isinstance(booking_data, dict):
        return None
    address_obj = booking_data.get('address')
    address_id = booking_data.get('address_id')
    addr = None
    if isinstance(address_obj, dict) and (address_obj.get('address') or address_obj.get('city') or address_id is not None):
        city = (address_obj.get('city') or '').strip()
        country = (address_obj.get('country') or '').strip()
        addr = {
            'address': address_obj.get('address', ''),
            'post_code': address_obj.get('post_code', '') or address_obj.get('postcode', ''),
            'city': city,
            'country': country,
            'latitude': address_obj.get('latitude'),
            'longitude': address_obj.get('longitude'),
        }
        # If city/country missing from dict but we have address_id, resolve from DB
        if (not city or not country) and address_id is not None:
            try:
                address = Address.objects.get(id=address_id)
                if not addr['city']:
                    addr['city'] = address.city or ''
                if not addr['country']:
                    addr['country'] = address.country or ''
                if not addr['address']:
                    addr['address'] = address.address or ''
            except (Address.DoesNotExist, ValueError):
                try:
                    branch = Branch.objects.get(id=uuid.UUID(str(address_id)))
                    if not addr['city']:
                        addr['city'] = branch.city or ''
                    if not addr['country']:
                        addr['country'] = branch.country or ''
                    if not addr['address']:
                        addr['address'] = branch.address or ''
                except (Branch.DoesNotExist, ValueError, TypeError):
                    pass
    if addr is None and address_id is not None:
        try:
            address = Address.objects.get(id=address_id)
            addr = {
                'address': address.address or '',
                'post_code': getattr(address, 'post_code', '') or '',
                'city': address.city or '',
                'country': address.country or '',
                'latitude': getattr(address, 'latitude', None),
                'longitude': getattr(address, 'longitude', None),
            }
        except (Address.DoesNotExist, ValueError):
            try:
                branch = Branch.objects.get(id=uuid.UUID(str(address_id)))
                addr = {
                    'address': branch.address or '',
                    'post_code': getattr(branch, 'postcode', '') or '',
                    'city': branch.city or '',
                    'country': branch.country or '',
                    'latitude': getattr(branch, 'latitude', None),
                    'longitude': getattr(branch, 'longitude', None),
                }
            except (Branch.DoesNotExist, ValueError, TypeError):
                return None
    if addr is None:
        return None
    service_type = booking_data.get('service_type')
    service_type_name = (service_type.get('name', '') if isinstance(service_type, dict) else str(service_type or '')).strip()
    valet_type = booking_data.get('valet_type')
    if isinstance(valet_type, dict):
        valet_type_name = (valet_type.get('name') or '').strip()
    elif isinstance(valet_type, str):
        valet_type_name = (valet_type or '').strip()
    else:
        valet_type_name = ''
    date_str = booking_data.get('date') or booking_data.get('appointment_date', '')
    if isinstance(date_str, str) and len(date_str) > 10:
        date_str = date_str[:10]
    start_time = booking_data.get('best_start_time') or booking_data.get('start_time', '06:00')
    end_time = booking_data.get('estimated_finish_time') or booking_data.get('end_time', '21:00')
    if len(start_time) == 5:
        start_time = start_time + ':00'
    if len(end_time) == 5:
        end_time = end_time + ':00'
    total_amount = booking_data.get('total_amount', 0)
    try:
        total_amount = float(total_amount)
    except (TypeError, ValueError):
        total_amount = 0
    try:
        number_of_vehicles = max(0, int(booking_data.get('number_of_vehicles', 0)))
    except (TypeError, ValueError):
        number_of_vehicles = 0
    return {
        'booking_reference': booking_reference,
        'address': addr.get('address', ''),
        'city': (addr.get('city') or '').strip(),
        'country': (addr.get('country') or '').strip(),
        'postcode': (addr.get('post_code', '') or addr.get('postcode', '')).strip(),
        'latitude': addr.get('latitude'),
        'longitude': addr.get('longitude'),
        'date': date_str,
        'start_time': start_time,
        'end_time': end_time,
        'service_type': service_type_name,
        'valet_type': valet_type_name,
        'number_of_vehicles': number_of_vehicles,
        'total_amount': total_amount,
        'client_name': getattr(user, 'name', '') or '',
        'client_phone': getattr(user, 'phone', '') or '',
        'owner_note': booking_data.get('special_instructions', '') or '',
        'suggested_team_size': int(booking_data.get('suggested_team_size', 1)),
        'window': booking_data.get('window', 'fullday'),
    }


def try_create_bulk_booking_on_detailer(pending_booking_or_bulk_order):
    """
    Call detailer app create_bulk_booking. Accepts PendingBooking (booking_data is_bulk) or BulkOrder (order_data).
    Returns (True, assigned_detailers_list) on success (list may be empty), (False, error_message) on failure.
    """
    import requests
    if hasattr(pending_booking_or_bulk_order, 'booking_data'):
        payload = build_bulk_detailer_payload(
            pending_booking_or_bulk_order.booking_data,
            pending_booking_or_bulk_order.user,
            pending_booking_or_bulk_order.booking_reference,
        )
    else:
        order_data = getattr(pending_booking_or_bulk_order, 'order_data', None) or {}
        payload = build_bulk_detailer_payload(
            order_data,
            pending_booking_or_bulk_order.user,
            pending_booking_or_bulk_order.booking_reference,
        )
    if not payload:
        return (False, "Invalid bulk payload")
    detailer_app_url = getattr(settings, 'DETAILER_APP_URL', None) or getattr(settings, 'API_CONFIG', {}).get('detailerAppUrl')
    if not detailer_app_url:
        return (False, "Detailer app not configured")
    base = (detailer_app_url or "").rstrip("/")
    url = f"{base}/api/v1/booking/create_bulk_booking/"
    try:
        response = requests.post(url, json=payload, headers={'Content-Type': 'application/json'}, timeout=60)
        if response.status_code in [200, 201]:
            body = response.json() if response.content else {}
            assigned_detailers = body.get("assigned_detailers")
            if not isinstance(assigned_detailers, list):
                assigned_detailers = []
            return (True, assigned_detailers)
        err_body = response.json() if response.content else {}
        error_message = err_body.get('error', response.text or f"HTTP {response.status_code}")
        print(f"Detailer create_bulk_booking failed {response.status_code}: {error_message} (payload keys: {list(payload.keys()) if payload else []})")
        return (False, error_message)
    except Exception as e:
        return (False, str(e))


def try_create_booking_on_detailer(pending_booking):
    """
    Attempt to create the job on the detailer app (POST only). Used to try detailer first
    before creating the client booking, so we can refund on slot conflict.
    Returns (True, detailer_info) on success (detailer_info may be None if not in response),
    or (False, error_message) on failure.
    """
    import requests

    detailer_data = pending_booking.detailer_booking_data
    if not detailer_data or not isinstance(detailer_data, dict):
        detailer_data = build_detailer_payload_from_booking_data(
            pending_booking.booking_data,
            pending_booking.user,
            pending_booking.booking_reference,
        )
    if not detailer_data:
        print("No detailer payload available for try_create_booking_on_detailer")
        return (False, "No detailer payload")

    if 'booking_reference' not in detailer_data:
        detailer_data['booking_reference'] = pending_booking.booking_reference
    # No separate accept step; ensure detailer receives job as accepted
    detailer_data['status'] = 'accepted'

    detailer_app_url = getattr(settings, 'DETAILER_APP_URL', None)
    print(f"DETAILER_APP_URL: {detailer_app_url}")
    print(f"Detailer app URL: {detailer_app_url}")
    
    if not detailer_app_url:
        detailer_app_url = getattr(settings, 'API_CONFIG', {}).get('detailerAppUrl')
    if not detailer_app_url:
        print("DETAILER_APP_URL not configured in settings")
        return (False, "Detailer app not configured")

    try:
        base = (detailer_app_url or "").rstrip("/")
        url = f"{base}/api/v1/booking/create_booking/"
        response = requests.post(
            url,
            json=detailer_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )

        if response.status_code in [200, 201]:
            print(f"Successfully created booking {pending_booking.booking_reference} on detailer app")
            try:
                body = response.json()
                detailer_info = body.get("detailer") if isinstance(body, dict) else None
            except Exception:
                detailer_info = None
            return (True, detailer_info)
        try:
            err_body = response.json()
            error_message = err_body.get('error', response.text)
        except Exception:
            error_message = response.text or f"HTTP {response.status_code}"
        print(f"Detailer app rejected booking: {response.status_code} - {error_message}")
        return (False, error_message)

    except Exception as e:
        print(f"Error calling detailer app: {e}")
        return (False, str(e))


def assign_detailer_to_booking(booking, detailer_info):
    """
    Assign a detailer to a booking from detailer info dict (name, phone, rating, detailer_id).
    Same logic as subscribe_redis job_acceptance so the UI shows the detailer immediately.
    """
    if not detailer_info or not isinstance(detailer_info, dict) or not detailer_info.get("phone"):
        return
    from main.models import DetailerProfile
    from main.util.phone_utils import normalize_phone

    detailer_name = (detailer_info.get("name") or "").strip()
    detailer_phone = (detailer_info.get("phone") or "").strip()
    detailer_rating = detailer_info.get("rating", 0.0)
    detailer_id = detailer_info.get("detailer_id")
    normalized_phone = normalize_phone(detailer_phone)
    if not normalized_phone:
        return
    defaults = {"name": detailer_name or "Detailer", "rating": detailer_rating}
    if detailer_id is not None:
        defaults["external_id"] = detailer_id
    detailer, created = DetailerProfile.objects.get_or_create(
        phone=normalized_phone,
        defaults=defaults,
    )
    if not created:
        if detailer_rating is not None and detailer_rating != detailer.rating:
            detailer.rating = detailer_rating
        if detailer_id is not None and detailer.external_id != detailer_id:
            detailer.external_id = detailer_id
        detailer.save()
    booking.detailer = detailer
    booking.save(update_fields=["detailer"])


def send_booking_to_detailer(pending_booking, booking):
    """
    Send booking data to detailer app after payment validation.
    Shared by PaymentView (free Quick Sparkle) and StripeWebhookView.
    """
    success, _ = try_create_booking_on_detailer(pending_booking)
    return success


class PaymentView(APIView):
    permission_classes = [IsAuthenticated]

    action_handlers = {
        'create_payment_sheet': 'create_payment_sheet',
        'create_bulk_order_invoice_later': 'create_bulk_order_invoice_later',
        'get_refund_status': 'get_refund_status',
        'check_payment_status': 'check_payment_status',
        'confirm_payment_intent': 'confirm_payment_intent',
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


    def create_payment_sheet(self, request):
        """
        Create a payment sheet for Stripe payment processing.
        
        Creates a pending booking first, then creates Stripe payment intent and ephemeral key.
        Booking will be created in webhook after payment succeeds.
        """
        try:
            # Get booking data from request (should contain all booking info)
            booking_data = request.data.get('booking_data')
            detailer_booking_data = request.data.get('detailer_booking_data')
            
            # Generate booking reference
            booking_reference = request.data.get('booking_reference')
            if not booking_reference and booking_data and isinstance(booking_data, dict):
                booking_reference = booking_data.get('booking_reference')
            if not booking_reference:
                booking_reference = f"APT{int(time.time() * 1000)}{str(uuid.uuid4())[:8].upper()}"
            
            # Get amount from request or booking data
            amount = request.data.get('amount', 0)
            if amount == 0:
                if booking_data and isinstance(booking_data, dict):
                    amount = booking_data.get('total_amount', 0)
                    if amount:
                        amount = int(float(amount) * 100)  # Convert to cents
            
            if not booking_data:
                return Response(
                    {'error': 'booking_data is required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if amount == 0:
                # Handle free Quick Sparkle (loyalty or partner referral) - no Stripe payment needed
                if booking_data and isinstance(booking_data, dict):
                    applied_free = booking_data.get('applied_free_quick_sparkle', False)
                    total_amount = booking_data.get('total_amount', 0)
                    if applied_free and (total_amount == 0 or total_amount == 0.0):
                        service_type_data = booking_data.get('service_type', {})
                        service_name = service_type_data.get('name', '') if isinstance(service_type_data, dict) else ''
                        if service_name == 'The Quick Sparkle':
                            user = User.objects.get(id=request.user.id)
                            # Validate free wash eligibility
                            can_use = False
                            try:
                                loyalty = LoyaltyProgram.objects.get(user=user)
                                if loyalty.can_use_free_quick_sparkle():
                                    can_use = True
                            except LoyaltyProgram.DoesNotExist:
                                pass
                            if not can_use:
                                try:
                                    attr = ReferralAttribution.objects.get(
                                        referred_user=user, source='partner'
                                    )
                                    if not attr.partner_free_wash_used and (
                                        attr.expires_at is None or attr.expires_at > timezone.now()
                                    ):
                                        can_use = True
                                except ReferralAttribution.DoesNotExist:
                                    pass
                            if can_use:
                                expires_at = timezone.now() + timedelta(hours=24)
                                pending_booking = PendingBooking.objects.create(
                                    booking_reference=booking_reference,
                                    user=user,
                                    booking_data=booking_data,
                                    detailer_booking_data=detailer_booking_data or build_detailer_payload_from_booking_data(booking_data, user, booking_reference),
                                    payment_status='succeeded',
                                    expires_at=expires_at
                                )
                                success, detailer_info = try_create_booking_on_detailer(pending_booking)
                                if not success:
                                    pending_booking.delete()
                                    return Response({
                                        'error': 'This time slot is no longer available. Please choose another.',
                                        'detail': detailer_info,
                                    }, status=status.HTTP_400_BAD_REQUEST)
                                booking = create_booking_from_pending(pending_booking)
                                if detailer_info:
                                    assign_detailer_to_booking(booking, detailer_info)
                                pending_booking.delete()
                                return Response({
                                    'free_booking': True,
                                    'booking_reference': booking_reference,
                                    'success': True,
                                    'appointment_id': str(booking.id),
                                }, status=status.HTTP_200_OK)

                return Response(
                    {'error': 'Amount is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get country for currency setup
            try:
                # Try to get address from booking data or user's addresses
                address_id = None
                if booking_data and isinstance(booking_data, dict):
                    address_id = booking_data.get('address', {}).get('id') if isinstance(booking_data.get('address'), dict) else booking_data.get('address_id')
                if address_id:
                    # Try to get Address by ID first (for regular addresses)
                    try:
                        address = Address.objects.get(id=address_id)
                        country = address.country
                    except (Address.DoesNotExist, ValueError):
                        # If not found, check if it's a branch ID (UUID)
                        try:
                            branch_uuid = uuid.UUID(str(address_id))
                            branch = Branch.objects.get(id=branch_uuid)
                            country = branch.country or 'Ireland'
                        except (Branch.DoesNotExist, ValueError, TypeError):
                            # Fall back to default
                            country = 'Ireland'
                else:
                    address = Address.objects.filter(user=request.user).first()
                    if address:
                        country = address.country
                    else:
                        country = 'Ireland'
            except Exception as e:
                print(f"Error getting address: {e}")
                country = 'Ireland'

            # Set currency based on country
            if country == 'United Kingdom':
                currency = 'gbp'
                merchant_country_code = 'GB'
            else:
                currency = 'eur'
                merchant_country_code = 'IE'

            user = User.objects.get(id=request.user.id)

            # Branch spend leash: block branch admins over limit before creating PaymentIntent
            if user.is_branch_admin:
                branch = user.get_managed_branch()
                if branch:
                    limit = branch.spend_limit
                    if limit is not None and limit > 0:
                        period = branch.spend_limit_period or 'monthly'
                        spent = get_branch_spend_for_period(branch, period)
                        amount_for_booking = Decimal(amount) / 100  # cents -> same unit as spend_limit
                        if spent + amount_for_booking > limit:
                            return Response(
                                {
                                    'error': 'Branch spending limit exceeded for this period.',
                                    'code': 'BRANCH_SPEND_LIMIT_EXCEEDED',
                                },
                                status=status.HTTP_403_FORBIDDEN,
                            )
            
            # Create pending booking (expires in 24 hours). Bulk bookings don't use single-job detailer payload.
            is_bulk = isinstance(booking_data, dict) and booking_data.get('is_bulk') is True
            detailer_payload = None
            if not is_bulk:
                detailer_payload = detailer_booking_data or build_detailer_payload_from_booking_data(booking_data, user, booking_reference)
            expires_at = timezone.now() + timedelta(hours=24)
            pending_booking = PendingBooking.objects.create(
                booking_reference=booking_reference,
                user=user,
                booking_data=booking_data,
                detailer_booking_data=detailer_payload,
                payment_status='pending',
                expires_at=expires_at
            )
            print(f"Created pending booking: {pending_booking.id} with reference: {booking_reference}")
            
            # Get or create Stripe customer
            if hasattr(user, 'stripe_customer_id') and user.stripe_customer_id:
                customer = stripe.Customer.retrieve(user.stripe_customer_id)
            else:
                customer = stripe.Customer.create(
                    email=user.email,
                    name=user.name,
                    metadata={
                        'user_id': str(user.id),
                    }
                )
                if hasattr(user, 'stripe_customer_id'):
                    user.stripe_customer_id = customer.id
                    user.save()
                print(f"Created new Stripe customer: {customer.id}")
            
            # Create payment intent with pending booking reference in metadata
            # Prepare payment intent metadata
            payment_intent_metadata = {
                'user_id': str(user.id),
                'booking_reference': booking_reference,
            }
            
            if pending_booking:
                payment_intent_metadata['pending_booking_id'] = str(pending_booking.id)
            
            payment_intent = stripe.PaymentIntent.create(
                amount=amount,
                currency=currency,
                customer=customer.id,
                receipt_email=user.email,
                automatic_payment_methods={
                    'enabled': True,
                },
                setup_future_usage='off_session',
                metadata=payment_intent_metadata
            )
            
            if pending_booking:
                pending_booking.stripe_payment_intent_id = payment_intent.id
                pending_booking.payment_status = 'processing'
                pending_booking.save()
            
            print(f"Created payment intent: {payment_intent.id} for pending booking: {booking_reference}")
            
            # Create ephemeral key
            ephemeral_key = stripe.EphemeralKey.create(
                customer=customer.id,
                stripe_version='2022-11-15',
            )
            
            return Response({
                'paymentIntent': payment_intent.client_secret,
                'paymentIntentId': payment_intent.id,
                'ephemeralKey': ephemeral_key.secret,
                'customer': customer.id,
                'booking_reference': booking_reference,
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Error creating payment sheet: {e}")
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def create_bulk_order_invoice_later(self, request):
        """Create a bulk order with payment_status=invoice_later, create Stripe Invoice and send to user.email; then send bulk order to detailer."""
        try:
            booking_data = request.data.get('booking_data') or request.data
            if not booking_data or not isinstance(booking_data, dict):
                return Response({'error': 'booking_data is required'}, status=status.HTTP_400_BAD_REQUEST)
            booking_reference = (request.data.get('booking_reference') or
                                 booking_data.get('booking_reference') or
                                 f"BULK{int(time.time() * 1000)}{str(uuid.uuid4())[:8].upper()}")
            user = User.objects.get(id=request.user.id)
            total_amount = Decimal(str(booking_data.get('total_amount', 0) or 0))
            discount_applied = Decimal(str(booking_data.get('discount_applied', 0) or 0))
            number_of_vehicles = int(booking_data.get('number_of_vehicles', 0))
            address_id = (booking_data.get('address') or {}).get('id') if isinstance(booking_data.get('address'), dict) else booking_data.get('address_id')
            address_obj = None
            branch_obj = None
            fleet_obj = None
            if user.is_branch_admin:
                branch_obj = user.get_managed_branch()
                fleet_obj = branch_obj.fleet if branch_obj else None
            if address_id:
                try:
                    address_obj = Address.objects.get(id=address_id)
                except (Address.DoesNotExist, ValueError):
                    try:
                        branch = Branch.objects.get(id=uuid.UUID(str(address_id)))
                        branch_obj = branch if not branch_obj else branch_obj
                        fleet_obj = branch.fleet if branch_obj else fleet_obj
                        address_obj, _ = Address.objects.get_or_create(
                            user=user,
                            address=branch.address or '',
                            post_code=branch.postcode or '',
                            city=branch.city or '',
                            country=branch.country or '',
                            defaults={'latitude': branch.latitude, 'longitude': branch.longitude},
                        )
                    except (Branch.DoesNotExist, ValueError, TypeError):
                        pass
            if user.is_fleet_owner and not fleet_obj and hasattr(user, 'owned_fleets'):
                fleet_obj = user.owned_fleets.first()
            # Branch spend limit: block before creating invoice
            if user.is_branch_admin:
                branch = user.get_managed_branch()
                if branch and branch.spend_limit is not None and branch.spend_limit > 0:
                    period = branch.spend_limit_period or 'monthly'
                    spent = get_branch_spend_for_period(branch, period)
                    if spent + total_amount > branch.spend_limit:
                        return Response(
                            {
                                'error': 'Branch spending limit exceeded for this period.',
                                'code': 'BRANCH_SPEND_LIMIT_EXCEEDED',
                            },
                            status=status.HTTP_403_FORBIDDEN,
                        )
            bulk_order = BulkOrder.objects.create(
                booking_reference=booking_reference,
                user=user,
                branch=branch_obj,
                fleet=fleet_obj,
                address=address_obj,
                payment_status='invoice_later',
                total_amount=total_amount,
                discount_applied=discount_applied,
                number_of_vehicles=number_of_vehicles,
                order_data=booking_data,
            )
            try:
                create_bulk_appointments(bulk_order)
            except Exception as e:
                print(f"create_bulk_appointments failed for bulk order {bulk_order.id}: {e}")
            # Create Stripe Invoice and send to user.email; then send to detailer
            try:
                country = 'Ireland'
                if bulk_order.address:
                    country = bulk_order.address.country or 'Ireland'
                elif bulk_order.order_data:
                    addr = bulk_order.order_data.get('address')
                    if isinstance(addr, dict):
                        country = addr.get('country', 'Ireland')
                    else:
                        country = (bulk_order.order_data.get('country') or 'Ireland')
                currency = 'gbp' if country == 'United Kingdom' else 'eur'
                if hasattr(user, 'stripe_customer_id') and user.stripe_customer_id:
                    customer = stripe.Customer.retrieve(user.stripe_customer_id)
                else:
                    customer = stripe.Customer.create(
                        email=user.email,
                        name=user.name,
                        metadata={'user_id': str(user.id)},
                    )
                    if hasattr(user, 'stripe_customer_id'):
                        user.stripe_customer_id = customer.id
                        user.save()
                amount_cents = int(float(bulk_order.total_amount) * 100)
                if amount_cents <= 0:
                    return Response({'error': 'Invalid amount'}, status=status.HTTP_400_BAD_REQUEST)
                invoice = stripe.Invoice.create(
                    customer=customer.id,
                    collection_method='send_invoice',
                    days_until_due=30,
                    metadata={
                        'bulk_order_id': str(bulk_order.id),
                        'booking_reference': bulk_order.booking_reference,
                        'user_id': str(user.id),
                    },
                )
                stripe.InvoiceItem.create(
                    customer=customer.id,
                    invoice=invoice.id,
                    amount=amount_cents,
                    currency=currency,
                    description=f"Bulk detail – {bulk_order.number_of_vehicles} vehicles",
                )
                stripe.Invoice.finalize_invoice(invoice.id)
                stripe.Invoice.send_invoice(invoice.id)
                bulk_order.stripe_invoice_id = invoice.id
                bulk_order.save()
                # Invoice created and email sent; send bulk order to detailer
                success, assigned = try_create_bulk_booking_on_detailer(bulk_order)
                if not success:
                    print(f"Detailer bulk booking failed after invoice sent: {assigned}")
                elif assigned:
                    bulk_order.assigned_detailers = assigned
                    bulk_order.save(update_fields=['assigned_detailers'])
                    # Order and invoice already created; client can still pay. Log only.
            except stripe.StripeError as e:
                print(f"Stripe error creating/sending invoice for bulk order {bulk_order.id}: {e}")
                return Response(
                    {'error': f'Invoice could not be sent: {str(e)}'},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            return Response({
                'success': True,
                'booking_reference': bulk_order.booking_reference,
                'bulk_order_id': bulk_order.id,
                'message': 'Invoice has been sent to your email; you can pay when ready.',
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def get_refund_status(self, request):
        """Get refund status for a booking - useful for dispute resolution"""
        try:
            booking_reference = request.data.get('booking_reference')
            booking = BookedAppointment.objects.get(booking_reference=booking_reference)
            
            refunds = RefundRecord.objects.filter(booking=booking).order_by('-created_at')
            
            refund_data = []
            for refund in refunds:
                refund_data.append({
                    'id': refund.id,
                    'requested_amount': float(refund.requested_amount),
                    'status': refund.status,
                    'stripe_refund_id': refund.stripe_refund_id,
                    'failure_reason': refund.failure_reason,
                    'admin_notes': refund.admin_notes,
                    'dispute_resolved': refund.dispute_resolved,
                    'created_at': refund.created_at,
                    'processed_at': refund.processed_at
                })
            
            return Response({
                'booking_reference': booking_reference,
                'refunds': refund_data
            }, status=status.HTTP_200_OK)
            
        except BookedAppointment.DoesNotExist:
            return Response({'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


############################

    def confirm_payment_intent(self, request):
        """Check if payment intent has been confirmed via webhook (for polling)
        
        Works for all payment types:
        - Regular bookings (transaction_type='payment')
        - VIN lookups (transaction_type='vin_lookup')
        - Subscriptions (transaction_type='subscription')
        """
        try:
            payment_intent_id = request.data.get('payment_intent_id')
            if not payment_intent_id:
                return Response({'error': 'payment_intent_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            print(f"Checking payment confirmation for payment intent: {payment_intent_id}")
            
            # Check if PaymentTransaction exists for this payment intent
            # Works for all transaction types: payment, vin_lookup, subscription
            payment_transaction = PaymentTransaction.objects.filter(
                stripe_payment_intent_id=payment_intent_id,
                status='succeeded'
            ).first()
            
            if payment_transaction:
                print(f"Payment confirmed - transaction ID: {payment_transaction.id}, type: {payment_transaction.transaction_type}")
                return Response({
                    'confirmed': True,
                    'payment_intent_id': payment_intent_id,
                    'transaction_id': str(payment_transaction.id),
                    'booking_reference': payment_transaction.booking_reference,
                    'transaction_type': payment_transaction.transaction_type,
                }, status=status.HTTP_200_OK)
            # Check if payment was refunded due to slot conflict
            pending = PendingBooking.objects.filter(
                stripe_payment_intent_id=payment_intent_id,
                slot_conflict_refunded_at__isnull=False,
            ).first()
            if pending:
                return Response({
                    'confirmed': False,
                    'payment_intent_id': payment_intent_id,
                    'status': 'refunded_slot_unavailable',
                    'message': 'This time slot was no longer available. Your payment has been refunded. Please choose another slot.',
                }, status=status.HTTP_200_OK)
            print(f"Payment not yet confirmed for payment intent: {payment_intent_id}")
            return Response({
                'confirmed': False,
                'payment_intent_id': payment_intent_id,
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Error confirming payment intent: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    def check_payment_status(self, request):
        """Check payment status for a booking - useful for debugging"""
        try:
            booking_reference = request.data.get('booking_reference')
            payment_intent_id = request.data.get('payment_intent_id')
            
            # If payment_intent_id is provided, check by that first (works before booking exists)
            if payment_intent_id:
                print(f"Checking payment status for payment intent: {payment_intent_id}")
                payment_transaction = PaymentTransaction.objects.filter(
                    stripe_payment_intent_id=payment_intent_id,
                    transaction_type='payment'
                ).first()
                
                if payment_transaction:
                    return Response({
                        'payment_intent_id': payment_intent_id,
                        'has_payment': payment_transaction.status == 'succeeded',
                        'payment_status': payment_transaction.status,
                        'amount': float(payment_transaction.amount),
                        'currency': payment_transaction.currency,
                        'transaction_id': str(payment_transaction.id),
                    }, status=status.HTTP_200_OK)
                # Check if payment was refunded due to slot conflict
                pending = PendingBooking.objects.filter(
                    stripe_payment_intent_id=payment_intent_id,
                    slot_conflict_refunded_at__isnull=False,
                ).first()
                if pending:
                    return Response({
                        'payment_intent_id': payment_intent_id,
                        'status': 'refunded_slot_unavailable',
                        'message': 'This time slot was no longer available. Your payment has been refunded. Please choose another slot.',
                    }, status=status.HTTP_200_OK)
                return Response({
                    'payment_intent_id': payment_intent_id,
                    'has_payment': False,
                    'payment_status': 'not_found',
                }, status=status.HTTP_200_OK)
            
            # Fall back to booking_reference lookup
            if not booking_reference:
                return Response({'error': 'booking_reference or payment_intent_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            print(f"Checking payment status for booking: {booking_reference}")
            
            booking = BookedAppointment.objects.get(booking_reference=booking_reference)
            print(f"Found booking: {booking.id}, user: {booking.user.id}, total_amount: {booking.total_amount}")
            
            # Check for payment transactions
            payment_transactions = PaymentTransaction.objects.filter(
                booking=booking,
                transaction_type='payment'
            ).order_by('-created_at')
            
            print(f"Found {payment_transactions.count()} payment transactions for booking")
            
            payment_data = []
            for transaction in payment_transactions:
                payment_data.append({
                    'id': transaction.id,
                    'stripe_payment_intent_id': transaction.stripe_payment_intent_id,
                    'amount': float(transaction.amount),
                    'currency': transaction.currency,
                    'status': transaction.status,
                    'created_at': transaction.created_at,
                    'processed_at': transaction.processed_at
                })
                print(f"Payment transaction: {transaction.id} - {transaction.status} - {transaction.amount} {transaction.currency}")
            
            return Response({
                'booking_reference': booking_reference,
                'booking_id': booking.id,
                'booking_total_amount': float(booking.total_amount),
                'has_payment': payment_transactions.filter(status='succeeded').exists(),
                'payment_transactions': payment_data,
                'successful_payments': payment_transactions.filter(status='succeeded').count()
            }, status=status.HTTP_200_OK)
            
        except BookedAppointment.DoesNotExist:
            print(f"Booking not found: {booking_reference}")
            return Response({'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Error checking payment status: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StripeWebhookView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request, *args, **kwargs):
        print(f"Received Stripe webhook request")
        try:
            # Get the raw request body - important for signature verification
            payload = request.body
            
            # Get the Stripe signature from headers
            sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
            
            # Get webhook secret from settings
            webhook_secret = settings.STRIPE_WEBHOOK_SECRET
            
            # Verify signature if webhook secret is configured
            if webhook_secret and sig_header:
                try:
                    event = stripe.Webhook.construct_event(
                    payload, sig_header, webhook_secret
                    )
                    print(f"Stripe webhook signature verified successfully")
                except stripe.error.SignatureVerificationError as e:
                    print(f"Stripe webhook signature verification failed: {e}")
                    return Response({'error': 'Invalid signature'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                # For local testing with stripe listen (no signature verification)
                print("Webhook secret not configured or signature missing - skipping verification")
                if not sig_header:
                    print("No Stripe-Signature header found")
                if not webhook_secret:
                    print("STRIPE_WEBHOOK_SECRET not set in settings")
                
                # Parse JSON directly (only for local testing)
                try:
                    event = json.loads(payload)
                except json.JSONDecodeError as e:
                    print(f"Invalid JSON payload: {e}")
                    return Response({'error': 'Invalid payload'}, status=status.HTTP_400_BAD_REQUEST)
            
            event_type = event.get('type')
            print(f"Stripe webhook event type: {event_type}")
            
            # Handle payment success events
            if event_type == 'payment_intent.succeeded':
                payment_intent = event['data']['object']
                metadata = payment_intent.get('metadata', {})
                
                print(f"Payment intent succeeded - ID: {payment_intent.get('id')}")
                print(f"Payment intent amount: {payment_intent.get('amount')} {payment_intent.get('currency')}")
                print(f"Payment intent metadata: {metadata}")
                
                try:
                    # Check if this is a VIN lookup transaction
                    transaction_type = metadata.get('transaction_type')
                    if transaction_type == 'vin_lookup':
                        return self._handle_vin_lookup_payment(payment_intent, metadata)
                    
                    # Check if this is a fleet subscription payment (no booking flow)
                    if metadata.get('type') == 'fleet_subscription':
                        return self._handle_fleet_subscription_payment_intent(payment_intent, metadata)
                    
                    # Get pending booking ID from metadata (bulk pay-now uses pending_booking_id + is_bulk; invoice-later bulk is paid via invoice webhook)
                    pending_booking_id = metadata.get('pending_booking_id')
                    booking_reference = metadata.get('booking_reference')
                    user_id = metadata.get('user_id')
                    
                    print(f"Pending booking ID from metadata: {pending_booking_id}")
                    print(f"Booking reference from metadata: {booking_reference}")
                    print(f"User ID from metadata: {user_id}")
                    
                    if not pending_booking_id:
                        print("No pending_booking_id found in payment intent metadata - falling back to old flow")
                        # Fall back to old flow for backward compatibility
                        return self._handle_payment_old_flow(payment_intent, metadata, booking_reference, user_id)
                    
                    # Get pending booking
                    try:
                        pending_booking = PendingBooking.objects.get(id=pending_booking_id)
                    except PendingBooking.DoesNotExist:
                        print(f"Pending booking {pending_booking_id} not found")
                        return Response(
                            {'error': 'Pending booking not found'}, 
                            status=status.HTTP_404_NOT_FOUND
                        )
                    
                    # Check if booking already created (idempotency)
                    if pending_booking.payment_status == 'succeeded':
                        print(f"Booking already created for pending booking {pending_booking_id}")
                        return Response({'status': 'booking already created'}, status=status.HTTP_200_OK)
                    
                    # Check if booking already exists (in case webhook was called twice)
                    booking = None
                    bulk_order = None
                    is_bulk = isinstance(pending_booking.booking_data, dict) and pending_booking.booking_data.get('is_bulk') is True

                    if is_bulk:
                        # Bulk order flow: create BulkOrder and send to detailer create_bulk_booking
                        try:
                            bulk_order = BulkOrder.objects.get(booking_reference=booking_reference)
                            print(f"BulkOrder already exists: {bulk_order.id}")
                        except BulkOrder.DoesNotExist:
                            success, assigned = try_create_bulk_booking_on_detailer(pending_booking)
                            if not success:
                                payment_intent_id = payment_intent.get('id')
                                try:
                                    stripe.Refund.create(
                                        payment_intent=payment_intent_id,
                                        reason='requested_by_customer',
                                        metadata={
                                            'booking_reference': booking_reference,
                                            'refund_reason': 'bulk_slot_unavailable',
                                        },
                                    )
                                    print(f"Refunded payment intent {payment_intent_id} due to bulk detailer rejection: {assigned}")
                                except Exception as refund_err:
                                    print(f"Refund failed: {refund_err}")
                                pending_booking.slot_conflict_refunded_at = timezone.now()
                                pending_booking.save(update_fields=['slot_conflict_refunded_at'])
                                return Response({'status': 'refunded_slot_unavailable'}, status=status.HTTP_200_OK)
                            bd = pending_booking.booking_data
                            user_for_bulk = pending_booking.user
                            address_id = (bd.get('address') or {}).get('id') if isinstance(bd.get('address'), dict) else bd.get('address_id')
                            address_obj = None
                            branch_obj = None
                            fleet_obj = None
                            if user_for_bulk.is_branch_admin:
                                branch_obj = user_for_bulk.get_managed_branch()
                                fleet_obj = branch_obj.fleet if branch_obj else None
                            if address_id:
                                try:
                                    address_obj = Address.objects.get(id=address_id)
                                except (Address.DoesNotExist, ValueError):
                                    try:
                                        branch = Branch.objects.get(id=uuid.UUID(str(address_id)))
                                        branch_obj = branch if not branch_obj else branch_obj
                                        fleet_obj = branch.fleet if branch_obj else fleet_obj
                                        address_obj, _ = Address.objects.get_or_create(
                                            user=user_for_bulk,
                                            address=branch.address or '',
                                            post_code=branch.postcode or '',
                                            city=branch.city or '',
                                            country=branch.country or '',
                                            defaults={'latitude': branch.latitude, 'longitude': branch.longitude},
                                        )
                                    except (Branch.DoesNotExist, ValueError, TypeError):
                                        pass
                            if user_for_bulk.is_fleet_owner and not fleet_obj and hasattr(user_for_bulk, 'owned_fleets'):
                                fleet_obj = user_for_bulk.owned_fleets.first()
                            bulk_order = BulkOrder.objects.create(
                                booking_reference=booking_reference,
                                user=user_for_bulk,
                                branch=branch_obj,
                                fleet=fleet_obj,
                                address=address_obj,
                                payment_status='succeeded',
                                stripe_payment_intent_id=payment_intent.get('id'),
                                total_amount=Decimal(str(bd.get('total_amount', 0) or 0)),
                                discount_applied=Decimal(str(bd.get('discount_applied', 0) or 0)),
                                number_of_vehicles=int(bd.get('number_of_vehicles', 0)),
                                order_data=bd,
                                assigned_detailers=assigned or [],
                            )
                            print(f"Created BulkOrder {bulk_order.id} from pending booking {pending_booking_id}")
                            try:
                                create_bulk_appointments(bulk_order)
                            except Exception as e:
                                print(f"create_bulk_appointments failed for bulk order {bulk_order.id}: {e}")
                    else:
                        try:
                            booking = BookedAppointment.objects.get(booking_reference=booking_reference)
                            print(f"Booking already exists: {booking.id} - will update payment transaction only")
                        except BookedAppointment.DoesNotExist:
                            # Try detailer first; only create client booking if detailer accepts
                            success, detailer_info = try_create_booking_on_detailer(pending_booking)
                            if not success:
                                error_message = detailer_info  # (False, error_message)
                                # Slot conflict or other failure: refund and mark for client
                                payment_intent_id = payment_intent.get('id')
                                try:
                                    stripe.Refund.create(
                                        payment_intent=payment_intent_id,
                                        reason='requested_by_customer',
                                        metadata={
                                            'booking_reference': booking_reference,
                                            'refund_reason': 'slot_unavailable',
                                        },
                                    )
                                    print(f"Refunded payment intent {payment_intent_id} due to detailer rejection: {error_message}")
                                except Exception as refund_err:
                                    print(f"Refund failed: {refund_err}")
                                pending_booking.slot_conflict_refunded_at = timezone.now()
                                pending_booking.save(update_fields=['slot_conflict_refunded_at'])
                                return Response({'status': 'refunded_slot_unavailable'}, status=status.HTTP_200_OK)
                            # Detailer accepted: create client booking and transaction
                            pending_booking.payment_status = 'succeeded'
                            pending_booking.save()
                            booking = create_booking_from_pending(pending_booking)
                            print(f"Created booking {booking.id} from pending booking {pending_booking_id}")
                            # Assign detailer immediately from API response so UI shows detailer without waiting for Redis
                            if detailer_info:
                                assign_detailer_to_booking(booking, detailer_info)
                    
                    payment_intent_id = payment_intent.get('id')
                    existing_transaction = PaymentTransaction.objects.filter(
                        stripe_payment_intent_id=payment_intent_id
                    ).first()
                    
                    if not existing_transaction:
                        payment_method_details = payment_intent.get('payment_method_details', {})
                        card_details = payment_method_details.get('card', {})
                        PaymentTransaction.objects.create(
                            booking=booking,
                            bulk_order=bulk_order,
                            user=pending_booking.user,
                            booking_reference=booking_reference,
                            stripe_payment_intent_id=payment_intent_id,
                            transaction_type='payment',
                            amount=payment_intent.get('amount', 0) / 100,
                            currency=payment_intent.get('currency', 'gbp'),
                            last_4_digits=card_details.get('last4'),
                            card_brand=card_details.get('brand'),
                            status='succeeded'
                        )
                    
                    pending_booking.delete()
                    print(f"Deleted pending booking {pending_booking_id} after successful booking creation")
                    
                    return Response({'status': 'booking created successfully'}, status=status.HTTP_200_OK)
                    
                except Exception as e:
                    print(f"Error processing payment webhook: {e}")
                    return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            
            
            # Handle payment failure - mark pending booking as failed
            elif event_type == 'payment_intent.payment_failed':
                payment_intent = event['data']['object']
                metadata = payment_intent.get('metadata', {})
                pending_booking_id = metadata.get('pending_booking_id')
                
                if pending_booking_id:
                    try:
                        pending_booking = PendingBooking.objects.get(id=pending_booking_id)
                        pending_booking.payment_status = 'failed'
                        pending_booking.save()
                        print(f"Marked pending booking {pending_booking_id} as failed")
                    except PendingBooking.DoesNotExist:
                        print(f"Pending booking {pending_booking_id} not found for failure handling")
                
                return Response({'status': 'payment failed handled'}, status=status.HTTP_200_OK)
            
            # Handle refund events
            elif event_type == 'charge.dispute.created':
                print(f"Handling dispute created event")
                dispute = event['data']['object']
                self._handle_dispute(dispute)
                
            # Handle subscription invoice payment or bulk order invoice payment
            elif event_type == 'invoice.payment_succeeded':
                invoice = event['data']['object']
                print(f"Invoice payment succeeded - Invoice ID: {invoice.get('id')}")
                metadata = invoice.get('metadata') or {}
                bulk_order_id = metadata.get('bulk_order_id')
                if bulk_order_id:
                    try:
                        bulk_order = BulkOrder.objects.get(id=bulk_order_id)
                    except BulkOrder.DoesNotExist:
                        print(f"BulkOrder {bulk_order_id} not found in invoice.payment_succeeded")
                        return Response({'status': 'bulk order not found'}, status=status.HTTP_200_OK)
                    if bulk_order.payment_status == 'succeeded':
                        return Response({'status': 'bulk order already paid'}, status=status.HTTP_200_OK)
                    bulk_order.payment_status = 'succeeded'
                    payment_intent_id = invoice.get('payment_intent')
                    if payment_intent_id:
                        bulk_order.stripe_payment_intent_id = payment_intent_id
                    bulk_order.save()
                    pi_for_tx = payment_intent_id or invoice.get('id')
                    if not PaymentTransaction.objects.filter(stripe_payment_intent_id=pi_for_tx).exists():
                        PaymentTransaction.objects.create(
                            booking=None,
                            bulk_order=bulk_order,
                            user=bulk_order.user,
                            booking_reference=bulk_order.booking_reference,
                            stripe_payment_intent_id=pi_for_tx,
                            transaction_type='payment',
                            amount=Decimal(invoice.get('amount_paid', 0)) / 100,
                            currency=invoice.get('currency', 'eur'),
                            status='succeeded',
                        )
                    return Response({'status': 'bulk order payment recorded'}, status=status.HTTP_200_OK)
                return self._handle_subscription_payment(invoice)
            
            elif event_type == 'charge.refunded':
                print(f"Handling refund succeeded event")
                refund = event['data']['object']
                self._handle_refund_success(refund)

            elif event_type == 'charge.updated':
                print(f"Handling charge updated event")
                refund = event['data']['object']
                self._handle_refund_updated(refund)
                
            elif event_type == 'charge.failed':
                print(f"Handling charge failed event")
                refund = event['data']['object']
                self._handle_refund_failure(refund)
            
            # Handle subscription trial will end (7 days before)
            elif event_type == 'customer.subscription.trial_will_end':
                subscription = event['data']['object']
                print(f"Trial will end - Subscription ID: {subscription.get('id')}")
                return self._handle_trial_will_end(subscription)
            
            # Handle subscription updates (status changes, plan changes, etc.)
            elif event_type == 'customer.subscription.updated':
                subscription = event['data']['object']
                print(f"Subscription updated - Subscription ID: {subscription.get('id')}")
                return self._handle_subscription_updated(subscription)
            
            # Handle subscription deletion (cancellation)
            elif event_type == 'customer.subscription.deleted':
                subscription = event['data']['object']
                print(f"Subscription deleted - Subscription ID: {subscription.get('id')}")
                return self._handle_subscription_deleted(subscription)
            
            # Handle invoice payment failed
            elif event_type == 'invoice.payment_failed':
                invoice = event['data']['object']
                print(f"Invoice payment failed - Invoice ID: {invoice.get('id')}")
                return self._handle_invoice_payment_failed(invoice)

            elif event_type == 'invoice.sent':
                print(f"Invoice sent - acknowledged (bulk order invoice already created and dispatched in API)")
                return Response({'status': 'received'}, status=status.HTTP_200_OK)
            
            else:
                print(f"Unhandled Stripe event type: {event_type}")
                return Response({
                    'status': 'success',
                    'message': f'Received {event_type}',
                    'event_type': event_type
                }, status=status.HTTP_200_OK)
            
            print(f"Stripe event processed successfully: {event_type}")
            return Response({'status': 'event processed'}, status=status.HTTP_200_OK)
            
        except json.JSONDecodeError as e:
            print(f"Invalid JSON payload: {e}")
            return Response({'error': 'Invalid payload'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Unexpected error in webhook: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    def _handle_subscription_payment(self, invoice):
        """
        Handle subscription invoice payment webhook.
        Creates PaymentTransaction record and updates subscription status.
        Handles both initial payments and renewals.
        """
        from main.models import PaymentTransaction, User, FleetSubscription, SubscriptionBilling
        from dateutil.relativedelta import relativedelta
        
        try:
            # Get subscription from invoice
            subscription_id = invoice.get('subscription')
            if not subscription_id:
                print(f"No subscription ID found in invoice")
                return Response({
                    'error': 'No subscription ID in invoice'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Retrieve subscription to get metadata
            if isinstance(subscription_id, str):
                subscription_obj = stripe.Subscription.retrieve(subscription_id)
            else:
                subscription_obj = subscription_id
            
            metadata = subscription_obj.get('metadata', {})
            subscription_db_id = metadata.get('subscription_id')
            billing_id = metadata.get('billing_id')  # Only present for initial payment
            user_id = metadata.get('user_id')
            subscription_type = metadata.get('type')
            
            print(f"Processing subscription payment - Subscription DB ID: {subscription_db_id}, Billing ID: {billing_id}, User ID: {user_id}")
            
            if subscription_type != 'fleet_subscription':
                print(f"Not a fleet subscription, skipping")
                return Response({'status': 'not a fleet subscription'}, status=status.HTTP_200_OK)
            
            if not subscription_db_id or not user_id:
                print(f"Missing required metadata for subscription payment")
                return Response({
                    'error': 'Missing required metadata (subscription_id or user_id)'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get user
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                print(f"User not found: {user_id}")
                return Response({
                    'error': 'User not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Get subscription
            try:
                subscription = FleetSubscription.objects.get(id=subscription_db_id)
            except FleetSubscription.DoesNotExist:
                print(f"Subscription not found: {subscription_db_id}")
                return Response({
                    'error': 'Subscription not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Determine if this is an initial payment or renewal
            is_renewal = billing_id is None
            
            if is_renewal:
                print(f"This is a subscription renewal for subscription {subscription_db_id}")
                # For renewals, create a new billing record
                billing = SubscriptionBilling.objects.create(
                    subscription=subscription,
                    amount=Decimal(invoice.get('amount_paid', 0)) / 100,  # Convert from cents
                    billing_date=timezone.now(),
                    status='paid',
                    transaction_id=invoice.get('id'),  # Store invoice ID
                )
                
                # Extend subscription end_date based on billing cycle
                billing_cycle = subscription.plan.billing_cycle
                if billing_cycle == 'monthly':
                    subscription.end_date = subscription.end_date + relativedelta(months=1)
                elif billing_cycle == 'yearly':
                    subscription.end_date = subscription.end_date + relativedelta(years=1)
                else:
                    # Default to monthly
                    subscription.end_date = subscription.end_date + relativedelta(months=1)
                
                print(f"Extended subscription end_date to {subscription.end_date}")
            else:
                print(f"This is an initial subscription payment")
                # For initial payment, get existing billing record
                try:
                    billing = SubscriptionBilling.objects.get(id=billing_id)
                except SubscriptionBilling.DoesNotExist:
                    print(f"Billing record not found: {billing_id}")
                    return Response({
                        'error': 'Billing record not found'
                    }, status=status.HTTP_404_NOT_FOUND)
            
            # Get payment intent from invoice
            payment_intent_id = invoice.get('payment_intent')
            payment_intent = None
            payment_intent_id_str = None
            
            if payment_intent_id:
                if isinstance(payment_intent_id, str):
                    payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
                    payment_intent_id_str = payment_intent_id
                else:
                    payment_intent = payment_intent_id
                    payment_intent_id_str = payment_intent.get('id') if isinstance(payment_intent, dict) else payment_intent.id
            
            # If no payment intent, try to get from charge
            if not payment_intent_id_str:
                charge_id = invoice.get('charge')
                if charge_id:
                    if isinstance(charge_id, str):
                        charge = stripe.Charge.retrieve(charge_id)
                    else:
                        charge = charge_id
                    payment_intent_id_str = charge.get('payment_intent') if isinstance(charge, dict) else getattr(charge, 'payment_intent', None)
                    if payment_intent_id_str:
                        payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id_str)
            
            # For renewals, payment_intent might not exist if using saved payment method
            # Use invoice ID as fallback for transaction tracking
            if not payment_intent_id_str:
                # Use invoice ID as transaction identifier for renewals
                payment_intent_id_str = f"inv_{invoice.get('id')}"
                print(f"No payment intent found, using invoice ID as transaction identifier: {payment_intent_id_str}")
            
            # Check if transaction already exists (idempotency)
            existing_transaction = PaymentTransaction.objects.filter(
                stripe_payment_intent_id=payment_intent_id_str
            ).first()
            
            if existing_transaction:
                print(f"Subscription payment transaction already exists: {existing_transaction.id}")
                # Still update subscription and billing status
                subscription.status = 'active'
                subscription.save()
                billing.status = 'paid'
                billing.save()
                return Response({'status': 'subscription payment already recorded'}, status=status.HTTP_200_OK)
            
            # Create payment transaction record for subscription
            # Extract payment method details from payment intent or charge
            last_4_digits = None
            card_brand = None
            
            if payment_intent:
                payment_method_details = payment_intent.get('payment_method_details', {}) if isinstance(payment_intent, dict) else getattr(payment_intent, 'payment_method_details', {})
                card_details = payment_method_details.get('card', {})
                last_4_digits = card_details.get('last4')
                card_brand = card_details.get('brand')
            else:
                # Try to get from charge if payment intent not available
                charge_id = invoice.get('charge')
                if charge_id:
                    if isinstance(charge_id, str):
                        charge = stripe.Charge.retrieve(charge_id)
                    else:
                        charge = charge_id
                    if isinstance(charge, dict):
                        payment_method_details = charge.get('payment_method_details', {})
                        card_details = payment_method_details.get('card', {})
                        last_4_digits = card_details.get('last4')
                        card_brand = card_details.get('brand')
            
            # Create PaymentTransaction
            payment_transaction = PaymentTransaction.objects.create(
                booking=None,  # Subscriptions don't have bookings
                user=user,
                booking_reference=None,  # Subscriptions don't have booking references
                stripe_payment_intent_id=payment_intent_id_str,
                transaction_type='subscription',
                amount=Decimal(invoice.get('amount_paid', 0)) / 100,  # Convert from cents
                currency=invoice.get('currency', 'eur'),
                last_4_digits=last_4_digits,
                card_brand=card_brand,
                status='succeeded'
            )
            
            # Link payment transaction to billing record
            billing.payment = payment_transaction
            billing.transaction_id = payment_intent_id_str
            billing.save()
            
            # Check if trial just ended (subscription was in trialing status)
            trial_just_ended = subscription.status == 'trialing'
            
            # Update subscription and billing status
            subscription.status = 'active'
            subscription.save()
            
            billing.status = 'paid'
            billing.save()
            
            # Send trial ended email if this is the first payment after trial
            if trial_just_ended and not is_renewal:
                from main.tasks import send_trial_ended_email
                from dateutil.relativedelta import relativedelta
                
                # Calculate next billing date
                billing_cycle = subscription.plan.billing_cycle
                if billing_cycle == 'monthly':
                    next_billing_date = timezone.now() + relativedelta(months=1)
                elif billing_cycle == 'yearly':
                    next_billing_date = timezone.now() + relativedelta(years=1)
                else:
                    next_billing_date = timezone.now() + relativedelta(months=1)
                
                send_trial_ended_email.delay(
                    user.email,
                    subscription.fleet.name,
                    subscription.plan.tier.name,
                    float(billing.amount),
                    next_billing_date.isoformat()
                )
            
            print(f"Subscription payment transaction recorded successfully for subscription {subscription_db_id} (renewal: {is_renewal})")
            return Response({'status': 'subscription payment recorded successfully'}, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Error handling subscription payment: {e}")
            return Response({
                'error': f'Failed to process subscription payment: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _handle_fleet_subscription_payment_intent(self, payment_intent, metadata):
        """
        Handle payment_intent.succeeded for fleet subscription payments.
        Creates a PaymentTransaction so confirm_payment_intent returns quickly for the client.
        Also activates FleetSubscription and SubscriptionBilling when subscription_id and
        billing_id are in metadata (initial payment). invoice.payment_succeeded will still
        run and is idempotent (finds existing transaction and re-applies same status updates).
        """
        from main.models import FleetSubscription, SubscriptionBilling
        try:
            payment_intent_id = payment_intent.get('id')
            user_id = metadata.get('user_id')
            if not user_id:
                print("No user_id in fleet subscription payment intent metadata")
                return Response({'error': 'No user_id in metadata'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                print(f"User not found: {user_id}")
                return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
            existing = PaymentTransaction.objects.filter(
                stripe_payment_intent_id=payment_intent_id,
                status='succeeded',
            ).first()
            if existing:
                payment_transaction = existing
                print(f"Fleet subscription transaction already exists for payment intent: {payment_intent_id}")
            else:
                payment_method_details = payment_intent.get('payment_method_details', {}) or {}
                card_details = payment_method_details.get('card', {})
                last_4_digits = card_details.get('last4')
                card_brand = card_details.get('brand')
                payment_transaction = PaymentTransaction.objects.create(
                    booking=None,
                    user=user,
                    booking_reference=None,
                    stripe_payment_intent_id=payment_intent_id,
                    transaction_type='subscription',
                    amount=Decimal(payment_intent.get('amount', 0)) / 100,
                    currency=payment_intent.get('currency', 'eur'),
                    last_4_digits=last_4_digits,
                    card_brand=card_brand,
                    status='succeeded',
                )
                print(f"Fleet subscription payment transaction created for payment intent: {payment_intent_id}")
            subscription_db_id = metadata.get('subscription_id')
            billing_id = metadata.get('billing_id')
            if subscription_db_id and billing_id:
                try:
                    subscription = FleetSubscription.objects.get(id=subscription_db_id)
                    billing = SubscriptionBilling.objects.get(id=billing_id)
                    subscription.status = 'active'
                    subscription.save(update_fields=['status', 'updated_at'])
                    billing.status = 'paid'
                    billing.payment = payment_transaction
                    billing.transaction_id = payment_intent_id
                    billing.save(update_fields=['status', 'payment', 'transaction_id', 'updated_at'])
                    print(f"Fleet subscription {subscription_db_id} activated and billing {billing_id} marked paid")
                except FleetSubscription.DoesNotExist:
                    print(f"FleetSubscription not found: {subscription_db_id}")
                except SubscriptionBilling.DoesNotExist:
                    print(f"SubscriptionBilling not found: {billing_id}")
            # If this PaymentIntent was standalone (metadata has invoice_id), mark the Stripe
            # invoice as paid out of band so the subscription becomes Active in the dashboard.
            invoice_id = metadata.get('invoice_id')
            if invoice_id:
                try:
                    stripe.Invoice.pay(invoice_id, paid_out_of_band=True)
                    print(f"Marked Stripe invoice {invoice_id} paid out of band; subscription should be Active")
                except stripe.error.InvalidRequestError as e:
                    # Invoice may already be paid (e.g. we used the invoice's PaymentIntent)
                    print(f"Stripe invoice pay (out of band) skipped or failed: {e}")
            return Response({'status': 'subscription payment recorded'}, status=status.HTTP_200_OK)
        except Exception as e:
            print(f"Error handling fleet subscription payment intent: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    def _handle_vin_lookup_payment(self, payment_intent, metadata):
        """
        Handle VIN lookup payment webhook.
        Creates VinLookupPurchase record after successful payment.
        """
        from main.models import VinLookupPurchase, Vehicle, PaymentTransaction, User
        
        try:
            payment_intent_id = payment_intent.get('id')
            user_id = metadata.get('user_id')
            email = metadata.get('email')
            vin = metadata.get('vin')
            purchase_reference = metadata.get('purchase_reference')
            
            print(f"Processing VIN lookup payment - VIN: {vin}, Email: {email}, Purchase Reference: {purchase_reference}")
            
            if not vin or not email or not purchase_reference:
                print("Missing required metadata for VIN lookup payment")
                return Response({
                    'error': 'Missing required metadata (vin, email, or purchase_reference)'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Normalize VIN
            vin = vin.upper().strip()
            
            # Get vehicle
            try:
                vehicle = Vehicle.objects.get(vin=vin)
            except Vehicle.DoesNotExist:
                print(f"Vehicle not found for VIN: {vin}")
                return Response({
                    'error': 'Vehicle not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Get user if authenticated
            user = None
            if user_id and str(user_id).strip() and str(user_id).lower() != 'none':
                try:
                    user = User.objects.get(id=user_id)
                    # Use user's email if available
                    if user.email:
                        email = user.email.lower().strip()
                except (User.DoesNotExist, ValueError):
                    print(f"User {user_id} not found, proceeding as unregistered user")
            
            # Check if purchase already exists (idempotency)
            existing_purchase = VinLookupPurchase.objects.filter(
                purchase_reference=purchase_reference
            ).first()
            
            if existing_purchase:
                print(f"Purchase {purchase_reference} already exists")
                return Response({
                    'status': 'purchase already created'
                }, status=status.HTTP_200_OK)
            
            # Create payment transaction
            payment_method_details = payment_intent.get('payment_method_details', {})
            card_details = payment_method_details.get('card', {})
            
            payment_transaction = PaymentTransaction.objects.create(
                user=user if user else None,  # May be None for unregistered users
                booking_reference=purchase_reference,
                stripe_payment_intent_id=payment_intent_id,
                transaction_type='vin_lookup',
                amount=payment_intent.get('amount', 0) / 100,
                currency=payment_intent.get('currency', 'eur'),
                last_4_digits=card_details.get('last4'),
                card_brand=card_details.get('brand'),
                status='succeeded'
            )
            
            # Calculate expiration (24 hours from now)
            expires_at = timezone.now() + timedelta(hours=settings.VIN_LOOKUP_ACCESS_DURATION_HOURS)
            
            # Create VinLookupPurchase
            vin_lookup_purchase = VinLookupPurchase.objects.create(
                user=user,  # May be None for unregistered users
                email=email.lower().strip(),
                vehicle=vehicle,
                vin=vin,
                purchase_reference=purchase_reference,
                payment_transaction=payment_transaction,
                expires_at=expires_at,
                is_active=True
            )
            
            print(f"Created VinLookupPurchase {vin_lookup_purchase.id} for VIN {vin}, Email: {email}")
            
            return Response({
                'status': 'vin_lookup_purchase created successfully',
                'purchase_reference': purchase_reference
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Error processing VIN lookup payment: {e}")
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)



    def _handle_trial_will_end(self, subscription):
        """
        Handle trial_will_end webhook (triggered 7 days before trial ends).
        Sends email and push notification to user.
        """
        from main.models import User, FleetSubscription
        from main.tasks import send_trial_ending_soon_email, send_push_notification
        
        try:
            metadata = subscription.get('metadata', {})
            subscription_db_id = metadata.get('subscription_id')
            user_id = metadata.get('user_id')
            
            if not subscription_db_id or not user_id:
                print("Missing required metadata for trial_will_end")
                return Response({
                    'error': 'Missing required metadata'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get user
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                print(f"User not found: {user_id}")
                return Response({
                    'error': 'User not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Get subscription
            try:
                db_subscription = FleetSubscription.objects.get(id=subscription_db_id)
            except FleetSubscription.DoesNotExist:
                print(f"Subscription not found: {subscription_db_id}")
                return Response({
                    'error': 'Subscription not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Get trial end date from Stripe subscription
            trial_end_timestamp = subscription.get('trial_end')
            if trial_end_timestamp:
                from datetime import datetime
                trial_end_date = datetime.fromtimestamp(trial_end_timestamp, tz=timezone.utc)
            else:
                trial_end_date = db_subscription.trial_end_date
            
            # Get plan details
            plan_name = db_subscription.plan.tier.name if db_subscription.plan and db_subscription.plan.tier else "Subscription"
            billing_amount = float(db_subscription.plan.price) if db_subscription.plan else 0
            
            # Send email
            send_trial_ending_soon_email.delay(
                user.email,
                db_subscription.fleet.name,
                trial_end_date.isoformat() if trial_end_date else None,
                plan_name,
                billing_amount
            )
            
            # Send push notification
            send_push_notification.delay(
                str(user.id),
                "Trial Ending Soon",
                f"Your {plan_name} trial ends in 7 days. Billing will start automatically.",
                "subscription_trial_ending"
            )
            
            print(f"Trial ending soon notification sent for subscription {subscription_db_id}")
            return Response({'status': 'trial ending notification sent'}, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Error handling trial_will_end: {e}")
            return Response({
                'error': f'Failed to process trial_will_end: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    def _handle_subscription_updated(self, subscription):
        """
        Handle subscription.updated webhook.
        Handles status changes, plan changes, and payment method updates.
        """
        from main.models import User, FleetSubscription, SubscriptionPlan
        from main.tasks import send_payment_method_updated_email
        
        try:
            metadata = subscription.get('metadata', {})
            subscription_db_id = metadata.get('subscription_id')
            user_id = metadata.get('user_id')
            
            if not subscription_db_id or not user_id:
                print("Missing required metadata for subscription.updated")
                return Response({
                    'error': 'Missing required metadata'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get user
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                print(f"User not found: {user_id}")
                return Response({
                    'error': 'User not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Get subscription
            try:
                db_subscription = FleetSubscription.objects.get(id=subscription_db_id)
            except FleetSubscription.DoesNotExist:
                print(f"Subscription not found: {subscription_db_id}")
                return Response({
                    'error': 'Subscription not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Get Stripe subscription status
            stripe_status = subscription.get('status')
            
            # Map Stripe status to our status
            status_mapping = {
                'active': 'active',
                'trialing': 'trialing',
                'past_due': 'past_due',
                'canceled': 'cancelled',
                'unpaid': 'expired',
            }
            
            new_status = status_mapping.get(stripe_status, db_subscription.status)
            
            # Update subscription status if changed
            if db_subscription.status != new_status:
                old_status = db_subscription.status
                db_subscription.status = new_status
                db_subscription.save()
                print(f"Updated subscription {subscription_db_id} status from {old_status} to {new_status}")
            
            # Check if payment method was updated (check if default_payment_method changed)
            # This is a simple check - in production you might want to track this more carefully
            default_payment_method = subscription.get('default_payment_method')
            if default_payment_method:
                # Payment method exists - could be a new one
                # For now, we'll send email on any update (you might want to track this better)
                # In a real implementation, you'd compare with previous value
                pass
            
            # Handle plan changes (if items changed)
            items = subscription.get('items', {}).get('data', [])
            if items:
                # Plan might have changed - Stripe handles proration automatically
                # We could update the plan here if needed, but Stripe manages billing
                pass
            
            print(f"Subscription updated for subscription {subscription_db_id}")
            return Response({'status': 'subscription updated'}, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Error handling subscription.updated: {e}")
            return Response({
                'error': f'Failed to process subscription.updated: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    def _handle_subscription_deleted(self, subscription):
        """
        Handle subscription.deleted webhook (cancellation).
        Updates subscription status and sends cancellation email.
        """
        from main.models import User, FleetSubscription
        from main.tasks import send_subscription_cancelled_email, send_push_notification
        from datetime import datetime
        
        try:
            metadata = subscription.get('metadata', {})
            subscription_db_id = metadata.get('subscription_id')
            user_id = metadata.get('user_id')
            
            if not subscription_db_id or not user_id:
                print("Missing required metadata for subscription.deleted")
                return Response({
                    'error': 'Missing required metadata'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get user
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                print(f"User not found: {user_id}")
                return Response({
                    'error': 'User not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Get subscription
            try:
                db_subscription = FleetSubscription.objects.get(id=subscription_db_id)
            except FleetSubscription.DoesNotExist:
                print(f"Subscription not found: {subscription_db_id}")
                return Response({
                    'error': 'Subscription not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Store old status before updating
            old_status = db_subscription.status
            
            # Calculate access until date before updating status
            # If during trial, access until trial_end_date
            # If active, access until end_date
            if old_status == 'trialing' and db_subscription.trial_end_date:
                access_until_date = db_subscription.trial_end_date
            else:
                access_until_date = db_subscription.end_date
            
            # Update subscription status
            db_subscription.status = 'cancelled'
            db_subscription.cancellation_date = timezone.now()
            db_subscription.cancellation_reason = 'Cancelled by user via Stripe'
            db_subscription.save()
            
            # Get plan details
            plan_name = db_subscription.plan.tier.name if db_subscription.plan and db_subscription.plan.tier else "Subscription"
            
            # Send email
            send_subscription_cancelled_email.delay(
                user.email,
                db_subscription.fleet.name,
                plan_name,
                db_subscription.cancellation_date.isoformat(),
                access_until_date.isoformat() if access_until_date else None
            )
            
            # Send push notification
            send_push_notification.delay(
                str(user.id),
                "Subscription Cancelled",
                f"Your {plan_name} subscription has been cancelled. Access continues until {access_until_date.strftime('%B %d, %Y') if access_until_date else 'the end of your billing period'}.",
                "subscription_cancelled"
            )
            
            print(f"Subscription cancelled for subscription {subscription_db_id}")
            return Response({'status': 'subscription cancelled'}, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Error handling subscription.deleted: {e}")
            return Response({
                'error': f'Failed to process subscription.deleted: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _handle_invoice_payment_failed(self, invoice):
        """
        Handle invoice.payment_failed webhook for subscription payments.
        Updates subscription status, sets grace period, and sends notifications.
        """
        from main.models import User, FleetSubscription
        from main.tasks import send_payment_failed_email, send_push_notification
        from datetime import timedelta
        
        try:
            # Get subscription from invoice
            subscription_id = invoice.get('subscription')
            if not subscription_id:
                print(f"No subscription ID found in invoice")
                return Response({
                    'error': 'No subscription ID in invoice'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Retrieve subscription to get metadata
            if isinstance(subscription_id, str):
                subscription_obj = stripe.Subscription.retrieve(subscription_id)
            else:
                subscription_obj = subscription_id
            
            metadata = subscription_obj.get('metadata', {})
            subscription_db_id = metadata.get('subscription_id')
            user_id = metadata.get('user_id')
            subscription_type = metadata.get('type')
            
            if subscription_type != 'fleet_subscription':
                print(f"Not a fleet subscription, skipping")
                return Response({'status': 'not a fleet subscription'}, status=status.HTTP_200_OK)
            
            if not subscription_db_id or not user_id:
                print("Missing required metadata for invoice.payment_failed")
                return Response({
                    'error': 'Missing required metadata'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get user
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                print(f"User not found: {user_id}")
                return Response({
                    'error': 'User not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Get subscription
            try:
                subscription = FleetSubscription.objects.get(id=subscription_db_id)
            except FleetSubscription.DoesNotExist:
                print(f"Subscription not found: {subscription_db_id}")
                return Response({
                    'error': 'Subscription not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Update payment failure tracking
            subscription.payment_failure_count += 1
            subscription.last_payment_failure_date = timezone.now()
            subscription.grace_period_until = timezone.now() + timedelta(days=3)  # 3 day grace period
            subscription.status = 'past_due'
            subscription.save()
            
            # Get invoice details
            failed_amount = Decimal(invoice.get('amount_due', 0)) / 100
            retry_date = None
            if invoice.get('next_payment_attempt'):
                from datetime import datetime
                retry_date = datetime.fromtimestamp(invoice.get('next_payment_attempt'), tz=timezone.utc)
            
            # Get plan details
            plan_name = subscription.plan.tier.name if subscription.plan and subscription.plan.tier else "Subscription"
            
            # Build update payment URL (you'll need to implement this endpoint)
            update_payment_url = f"https://your-app.com/subscription/update-payment"  # Update with actual URL
            
            # Send email
            send_payment_failed_email.delay(
                user.email,
                subscription.fleet.name,
                plan_name,
                float(failed_amount),
                retry_date.isoformat() if retry_date else None,
                update_payment_url,
                subscription.grace_period_until.isoformat()
            )
            
            # Send push notification
            send_push_notification.delay(
                str(user.id),
                "Payment Failed",
                f"Your {plan_name} subscription payment failed. Please update your payment method to avoid service interruption.",
                "subscription_payment_failed"
            )
            
            print(f"Payment failed notification sent for subscription {subscription_db_id}")
            return Response({'status': 'payment failure handled'}, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Error handling invoice.payment_failed: {e}")
            return Response({
                'error': f'Failed to process invoice.payment_failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    def _handle_payment_old_flow(self, payment_intent, metadata, booking_reference, user_id):
        """Handle payment webhook with old flow (for backward compatibility)"""
        try:
            if not booking_reference:
                print("No booking reference found in payment intent metadata")
                return Response({'error': 'No booking reference in metadata'}, status=status.HTTP_400_BAD_REQUEST)
            
            if not user_id:
                print("No user_id found in payment intent metadata")
                return Response({'error': 'No user_id in metadata'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if PaymentTransaction already exists to avoid duplicates
            payment_intent_id = payment_intent.get('id')
            existing_transaction = PaymentTransaction.objects.filter(
                stripe_payment_intent_id=payment_intent_id
            ).first()
            
            if existing_transaction:
                print(f"Payment transaction already exists for payment intent: {payment_intent_id}, transaction ID: {existing_transaction.id}")
                return Response({'status': 'payment already recorded'}, status=status.HTTP_200_OK)
            
            # Get user from metadata
            try:
                user = User.objects.get(id=user_id)
                print(f"Found user: {user.id}")
            except User.DoesNotExist:
                print(f"User not found for ID: {user_id}")
                return Response({'error': 'User not found'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Try to get booking if it exists (may not exist yet)
            booking = None
            try:
                booking = BookedAppointment.objects.get(booking_reference=booking_reference)
                print(f"Found booking: {booking.id}, user: {booking.user.id}, amount: {booking.total_amount}")
            except BookedAppointment.DoesNotExist:
                print(f"Booking not yet created for reference: {booking_reference} - will create payment transaction without booking")
            
            # Safely get payment method details (may not exist)
            last_4_digits = None
            card_brand = None
            try:
                payment_method_details = payment_intent.get('payment_method_details', {})
                card_details = payment_method_details.get('card', {})
                last_4_digits = card_details.get('last4')
                card_brand = card_details.get('brand')
            except (AttributeError, KeyError, TypeError) as e:
                print(f"Could not extract card details: {e}")
            
            # Create payment transaction record (booking may be None)
            print(f"Creating payment transaction for booking reference: {booking_reference}")
            payment_transaction = PaymentTransaction.objects.create(
                booking=booking,  # May be None if booking doesn't exist yet
                user=user,
                booking_reference=booking_reference,
                stripe_payment_intent_id=payment_intent_id,
                transaction_type='payment',
                amount=payment_intent.get('amount', 0) / 100,  # Convert from cents
                currency=payment_intent.get('currency', 'gbp'),
                last_4_digits=last_4_digits,
                card_brand=card_brand,
                status='succeeded'
            )
            print(f"Payment transaction created successfully: {payment_transaction.id}")
            print(f"Payment transaction details - Amount: {payment_transaction.amount}, Currency: {payment_transaction.currency}, Status: {payment_transaction.status}")
            
            # If booking exists, save it to trigger any signals
            if booking:
                booking.save()
                print(f"Booking saved after payment transaction creation")
            
            print(f"Payment recorded successfully for booking reference: {booking_reference}")
            return Response({'status': 'payment recorded'}, status=status.HTTP_200_OK)
        except Exception as e:
            print(f"Error processing old payment flow: {e}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def _handle_refund_updated(self, refund):
        print(f"Handling refund updated: {refund}")
        """Handle updated refunds"""
        # try:
        #     refund_record = RefundRecord.objects.filter(
        #         stripe_refund_id=refund.id
        #     ).first()
            
        #     if refund_record:
        #         refund_record.status = 'updated'
        #         refund_record.admin_notes = f"Refund updated: {refund.reason}"
        #         refund_record.save()
                
        #         print(f"Refund updated email queued for user {refund_record.user.email}")
        # except Exception as e:
        #     print(f"Error handling refund updated: {str(e)}")

    def _handle_dispute(self, dispute):
        print(f"Handling dispute: {dispute}")
        """Handle charge disputes"""
        try:
            # Find the refund record by metadata
            refund_record = RefundRecord.objects.filter(
                stripe_refund_id=dispute.charge
            ).first()
            
            if refund_record:
                refund_record.status = 'disputed'
                refund_record.admin_notes = f"Dispute created: {dispute.reason}"
                refund_record.save()

                # Send the dispute created email and notification to the user
                
        except Exception as e:
            print(f"Error handling dispute: {e}")

    def _handle_refund_success(self, refund):
        print(f"Handling refund success: {refund}")
        """Handle successful refunds"""
        try:
            refund_record = RefundRecord.objects.filter(
                stripe_refund_id=refund.id
            ).first()
            
            if refund_record and refund_record.status == 'pending':
                refund_record.status = 'succeeded'
                refund_record.processed_at = timezone.now()
                refund_record.save()
                
                # Send the refund success email to the user
                from main.tasks import send_refund_success_email
                send_refund_success_email.delay(
                    user_email=refund_record.user.email,
                    customer_name=refund_record.user.name,
                    booking_reference=refund_record.booking.booking_reference,
                    original_date=refund_record.booking.appointment_date,
                    vehicle_make=refund_record.booking.vehicle.make,
                    vehicle_model=refund_record.booking.vehicle.model,
                    service_type_name=refund_record.booking.service_type.name,
                    refund_amount=float(refund_record.requested_amount),
                    refund_date=timezone.now()
                )
                
                print(f"Refund success email queued for user {refund_record.user.email}")
        except Exception as e:
            print(f"Error handling refund success: {e}")

    def _handle_refund_failure(self, refund):
        print(f"Handling refund failure: {refund}")
        """Handle failed refunds"""
        try:
            refund_record = RefundRecord.objects.filter(
                stripe_refund_id=refund.id
            ).first()
            
            if refund_record:
                refund_record.status = 'failed'
                refund_record.failure_reason = refund.failure_reason or "Unknown failure"
                refund_record.processed_at = timezone.now()
                refund_record.save()
                
                # Send the refund failed email to the user
                # from main.tasks import send_refund_failed_email
                # send_refund_failed_email.delay(
                #     user_email=refund_record.user.email,
                #     customer_name=refund_record.user.name,
                #     booking_reference=refund_record.booking.booking_reference,
                #     original_date=refund_record.booking.appointment_date,
                #     vehicle_make=refund_record.booking.vehicle.make,
                #     vehicle_model=refund_record.booking.vehicle.model,
                #     service_type_name=refund_record.booking.service_type.name,
                #     refund_amount=float(refund_record.requested_amount),
                #     failure_reason=refund.failure_reason or "Unknown failure"
                # )
                
                print(f"Refund failure email queued for user {refund_record.user.email}")
                
        except Exception as e:
            print(f"Error handling refund failure: {e}")
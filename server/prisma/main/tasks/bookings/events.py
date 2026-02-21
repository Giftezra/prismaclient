import json
from celery import shared_task
from main.utils.redis_streams import stream_add, STREAM_JOB_EVENTS


@shared_task
def publish_booking_cancelled(booking_reference):
    try:
        payload = json.dumps({'booking_reference': booking_reference})
        msg_id = stream_add(STREAM_JOB_EVENTS, {'event': 'booking_cancelled', 'payload': payload})
        return f"Booking cancelled published to stream: {msg_id}"
    except Exception as e:
        print(f"DEBUG: publish_booking_cancelled error: {str(e)}")
        return f"Failed to publish booking cancelled to redis: {str(e)}"


@shared_task
def publish_booking_rescheduled(booking_reference, new_date, new_time, total_cost):
    try:
        payload = json.dumps({
            'booking_reference': booking_reference,
            'new_appointment_date': new_date,
            'new_appointment_time': new_time,
            'total_amount': total_cost,
        })
        msg_id = stream_add(STREAM_JOB_EVENTS, {'event': 'booking_rescheduled', 'payload': payload})
        return f"Booking rescheduled published to stream: {msg_id}"
    except Exception as e:
        print(f"DEBUG: publish_booking_rescheduled error: {str(e)}")
        return f"Failed to publish booking rescheduled to redis: {str(e)}"


@shared_task
def publish_review_to_detailer(booking_reference, rating):
    """Publish review data to Redis stream for detailer app."""
    try:
        payload = json.dumps({
            'booking_reference': booking_reference,
            'rating': rating,
        })
        msg_id = stream_add(STREAM_JOB_EVENTS, {'event': 'review_received', 'payload': payload})
        return f"Review published to detailer: {msg_id}"
    except Exception as e:
        print(f"Failed to publish review to detailer: {e}")
        return f"Failed to publish review to detailer: {e}"

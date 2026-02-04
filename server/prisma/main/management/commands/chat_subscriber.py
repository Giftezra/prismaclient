from django.core.management.base import BaseCommand
import json

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from main.tasks import send_push_notification
from main.utils.redis_streams import (
    STREAM_JOB_CHAT,
    ensure_consumer_group,
    read_group_blocking,
    read_pending,
    ack,
)

CLIENT_CHAT_GROUP = "client_chat_group"
CONSUMER_NAME = "chat_subscriber"


class Command(BaseCommand):
    help = "Read from Redis stream job_chat and forward chat messages to WebSocket clients."

    def handle(self, *args, **options):
        ensure_consumer_group(STREAM_JOB_CHAT, CLIENT_CHAT_GROUP)
        self.stdout.write(self.style.SUCCESS("Subscribed to job_chat stream (client_chat_group)"))

        channel_layer = get_channel_layer()

        # Process pending messages from previous run
        for msg_id, fields in read_pending(STREAM_JOB_CHAT, CLIENT_CHAT_GROUP, CONSUMER_NAME):
            self._process_message(msg_id, fields, channel_layer)

        try:
            while True:
                entries = read_group_blocking(STREAM_JOB_CHAT, CLIENT_CHAT_GROUP, CONSUMER_NAME, block_ms=5000)
                for msg_id, fields in entries:
                    self._process_message(msg_id, fields, channel_layer)
        except KeyboardInterrupt:
            self.stdout.write(self.style.SUCCESS("Chat subscriber stopped"))

    def _process_message(self, msg_id, fields, channel_layer):
        channel = fields.get("channel")
        raw = fields.get("payload", "{}")
        try:
            data = json.loads(raw)
        except Exception:
            ack(STREAM_JOB_CHAT, CLIENT_CHAT_GROUP, msg_id)
            return
        message_data = data.get("message", {})
        async_to_sync(channel_layer.group_send)(
            channel,
            {"type": "chat_message", "message": message_data},
        )
        sender_id = message_data.get("sender_id")
        if sender_id is not None:
            send_push_notification.delay(
                sender_id,
                "New Message",
                f"You have a new message from {message_data.get('sender_name', 'someone')}",
                "chat_message",
            )
        self.stdout.write(f"Forwarded chat message from {channel}")
        ack(STREAM_JOB_CHAT, CLIENT_CHAT_GROUP, msg_id)

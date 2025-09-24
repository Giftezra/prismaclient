from django.core.management.base import BaseCommand
import redis
import json
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from main.tasks import send_push_notification

class Command(BaseCommand):
    help = "Subscribe to job chat messages from client app"

    def handle(self, *args, **options):
        r = redis.Redis(host='prisma_redis', port=6379, db=0, decode_responses=True)
        pubsub = r.pubsub()
        
        # Subscribe to job chat channels
        pubsub.psubscribe('job_chat')
        self.stdout.write(self.style.SUCCESS('Subscribed to job chat channels'))
        
        channel_layer = get_channel_layer()
        
        try:
            for message in pubsub.listen():
                if message.get('type') != 'pmessage':
                    continue
                
                channel = message.get('channel')
                data = json.loads(message.get('data'))
                
                # Forward message to WebSocket clients
                async_to_sync(channel_layer.group_send)(
                    channel,
                    {
                        'type': 'chat_message',
                        'message': data['message']
                    }
                )

                # Send push notification to the user
                send_push_notification.delay(
                    data['message']['sender_id'],
                    "New Message",
                    f"You have a new message from {data['message']['sender_name']}",
                    "chat_message"
                )
                self.stdout.write(f"Forwarded chat message from {channel}")
                
        except KeyboardInterrupt:
            self.stdout.write(self.style.SUCCESS('Chat subscriber stopped'))

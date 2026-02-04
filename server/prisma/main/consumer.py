# client/server/prisma/main/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model

class JobChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        print("🔌 WebSocket connection attempt started...")
        print(f"📍 Scope: {self.scope}")
        print(f"🔗 Channel name: {self.channel_name}")
        
        try:
            User = get_user_model()
            print("👤 User model loaded")
            
            await self.accept()
            print("✅ WebSocket connection accepted")
            
            # Authenticate user
            print("🔐 Starting authentication...")
            self.user = await self.get_user(User)
            if self.user.is_anonymous:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'Authentication failed'
                }))
                await self.close()
                return
            print(f"✅ Authentication successful for user: {self.user.email}")
            
            # Get booking reference from URL
            self.booking_reference = self.scope['url_route']['kwargs']['booking_reference']
            print(f"📋 Booking reference extracted: {self.booking_reference}")
            
            # Verify user has access to this booking
            print("🔍 Verifying booking access...")
            try:
                self.booking = await self.get_booking_sync()
                print(f"✅ Booking found: {self.booking.id}")
                
                if self.booking.user != self.user:
                    print(f"❌ Access denied: User {self.user.id} does not own booking {self.booking_reference}")
                    await self.close()
                    return
                print("✅ User has access to booking")
                
            except Exception as e:
                print(f"❌ Error getting booking {self.booking_reference}: {e}")
                await self.close()
                return
            
            # Join room-specific channel
            self.room_group_name = f"job_chat_{self.booking_reference}"
            print(f"🏠 Joining room: {self.room_group_name}")
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            print("✅ Joined chat room")
        
            self.chat_room = await self.get_or_create_chat_room_sync()
            print("✅ Chat room ready")
            
            print(f"🎉 SUCCESS: Client {self.user.id} connected to chat for booking {self.booking_reference}")
            
        except Exception as e:
            print(f"💥 CRITICAL ERROR in WebSocket connect: {e}")
            import traceback
            print(f"📜 Traceback: {traceback.format_exc()}")
            await self.close()

    async def disconnect(self, close_code):
        print(f"🔌 WebSocket disconnecting... Close code: {close_code}")
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
            print(f"✅ Left room: {self.room_group_name}")
        else:
            print("⚠️ No room group to leave")
        print("👋 WebSocket disconnected")

    async def receive(self, text_data):
        print(f"📨 Received message: {text_data[:100]}...")
        try:
            data = json.loads(text_data)
            message_type = data.get('type', 'text')
            content = data.get('content', '').strip()
            
            print(f"📝 Message type: {message_type}, Content: {content[:50]}...")
            
            if not content:
                print("⚠️ Empty message content, ignoring")
                return
            
            # Save message to database
            print("💾 Saving message to database...")
            message = await self.save_message_sync(content, message_type)
            print(f"✅ Message saved with ID: {message.id}")

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': {
                        'id': str(message.id),
                        'content': message.content,
                        'sender_type': message.sender_type,
                        'message_type': message.message_type,
                        'created_at': message.created_at.isoformat(),
                        'is_read': message.is_read,
                    }
                }
            )
            print("✅ Message broadcasted to room")
            
            # Publish to Redis for cross-app delivery
            print("🔄 Publishing to Redis...")
            await self.publish_to_redis(message)
            print("✅ Message published to Redis")
            
        except Exception as e:
            print(f"❌ Error processing message: {e}")
            import traceback
            print(f"📜 Message processing traceback: {traceback.format_exc()}")

    async def chat_message(self, event):
        print(f"📤 Sending chat message to client: {event['message']['id']}")
        message = event['message']
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': message
        }))
        print("✅ Chat message sent to client")

    @database_sync_to_async
    def get_booking_sync(self):
        from .models import BookedAppointment
        print(f"Looking for booking with reference: {self.booking_reference}")
        try:
            booking = BookedAppointment.objects.get(booking_reference=self.booking_reference)
            print(f"Found booking: {booking.id}")
            return booking
        except BookedAppointment.DoesNotExist:
            print(f"Booking with reference {self.booking_reference} does not exist")
            raise
        except Exception as e:
            print(f"Error getting booking: {e}")
            raise

    @database_sync_to_async
    def get_or_create_chat_room_sync(self):
        from .models import JobChatRoom
        print(f"Creating/getting chat room for booking: {self.booking.id}")
        try:
            room, created = JobChatRoom.objects.get_or_create(
                booking=self.booking,
                defaults={
                    'client': self.booking.user,
                    'detailer': self.booking.detailer,
                    'is_active': True
                }
            )
            print(f"Chat room {'created' if created else 'found'}: {room.id}")
            return room
        except Exception as e:
            print(f"Error creating/getting chat room: {e}")
            raise

    @database_sync_to_async
    def save_message_sync(self, content, message_type):
        from .models import JobChatMessage
        return JobChatMessage.objects.create(
            room=self.chat_room,
            sender=self.user,
            sender_type='client',
            message_type=message_type,
            content=content
        )

    async def publish_to_redis(self, message):
        import asyncio
        from main.utils.redis_streams import stream_add, STREAM_JOB_CHAT

        channel = f"job_chat_{self.booking_reference}"
        payload = json.dumps({
            "type": "chat_message",
            "booking_reference": self.booking_reference,
            "message": {
                "id": str(message.id),
                "content": message.content,
                "sender_type": message.sender_type,
                "message_type": message.message_type,
                "created_at": message.created_at.isoformat(),
            },
        })

        def publish():
            stream_add(STREAM_JOB_CHAT, {"channel": channel, "payload": payload})

        await asyncio.get_event_loop().run_in_executor(None, publish)

    @database_sync_to_async
    def get_user(self, User):
        from django.contrib.auth.models import AnonymousUser
        from rest_framework_simplejwt.tokens import AccessToken
        print("🔐 Starting token authentication...")
        
        # Extract token from URL path
        token = self.scope['url_route']['kwargs'].get('token')
        print(f"🎫 Token extracted: {token[:20]}..." if token else "❌ No token found")
        
        if not token:
            print("❌ No token provided in URL")
            return AnonymousUser()
        
        try:
            print("🔍 Validating JWT token...")
            # Validate JWT token
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            print(f"✅ Token validated for user_id: {user_id}")
            
            print("👤 Looking up user in database...")
            user = User.objects.get(id=user_id)
            print(f"✅ User found: {user.email} (ID: {user.id})")
            return user
            
        except Exception as e:
            print(f"❌ Token validation failed: {e}")
            import traceback
            print(f"📜 Token validation traceback: {traceback.format_exc()}")
            return AnonymousUser()
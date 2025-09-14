# client/server/prisma/main/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

class ClientNotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Import here to avoid Django apps registry error
        from django.contrib.auth.models import AnonymousUser
        from rest_framework_simplejwt.tokens import AccessToken
        from django.contrib.auth import get_user_model
        
        User = get_user_model()
        
        # Accept the WebSocket connection first
        await self.accept()
        print("WebSocket connection accepted")
        
        # Then authenticate user from token
        self.user = await self.get_user(User, AnonymousUser, AccessToken)
        if self.user.is_anonymous:
            print("Authentication failed - closing connection")
            # Send error message before closing
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Authentication failed'
            }))
            await self.close()
            return
        
        # Join user-specific channel
        self.group_name = f"client_{self.user.id}"
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        print(f"Client {self.user.id} connected successfully")

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        pass  # Clients don't send messages, only receive

    async def status_update(self, event):
        """Send booking status update to client"""
        await self.send(text_data=json.dumps({
            'type': 'status_update',
            'booking_reference': event['booking_reference'],
            'status': event['status'],
            'message': event['message'],
            'timestamp': event.get('timestamp', ''),
            'action': 'refresh_dashboard'
        }))

    @database_sync_to_async
    def get_user(self, User, AnonymousUser, AccessToken):
        # Extract token from URL path
        token = self.scope['url_route']['kwargs'].get('token')
        print(f"Extracted token: {token[:20]}..." if token else "No token found")
        
        if not token:
            print("No token provided in URL")
            return AnonymousUser()
        
        try:
            # Validate JWT token
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            print(f"Token validated for user_id: {user_id}")
            user = User.objects.get(id=user_id)
            print(f"User found: {user.email}")
            return user
        except Exception as e:
            print(f"Token validation failed: {e}")
            return AnonymousUser()
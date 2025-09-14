# client/server/prisma/prisma/routing.py
from django.urls import re_path
from main.consumer import ClientNotificationConsumer

websocket_urlpatterns = [
    re_path(r'ws/client/(?P<token>[^/]+)/$', ClientNotificationConsumer.as_asgi()),
]
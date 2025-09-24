# client/server/prisma/prisma/routing.py
from django.urls import re_path
from main.consumer import JobChatConsumer

websocket_urlpatterns = [
    re_path(r'ws/client/job-chat/(?P<booking_reference>[^/]+)/(?P<token>[^/]+)/$', JobChatConsumer.as_asgi()),
]


from django.urls import path
from main.views.authentication import CustomTokenObtainPairView, AuthenticationView
from rest_framework_simplejwt.views import TokenRefreshView
from main.views.profile import ProfileView
from main.views.garage import GarageView
from main.views.booking import BookingView
from main.views.dashboard import DashboardView
from django.conf import settings
from django.conf.urls.static import static
from main.views.notifications import NotificationsView


app_name = 'main'

urlpatterns = [
    path('authentication/login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('authentication/refresh/', TokenRefreshView.as_view(), name='refresh'),
    path('onboard/<action>/', AuthenticationView.as_view(), name='onboard'),
    path('profile/<action>/', ProfileView.as_view(), name='profile'),
    path('garage/<action>/', GarageView.as_view(), name='garage'),
    path('garage/<action>/<vehicle_id>/', GarageView.as_view(), name='garage'),
    path('booking/<action>/', BookingView.as_view(), name='booking'),
    path('dashboard/<action>/', DashboardView.as_view(), name='dashboard'),
    path('notifications/<action>/', NotificationsView.as_view(), name='notifications'),
]


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

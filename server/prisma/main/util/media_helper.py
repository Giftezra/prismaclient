from django.conf import settings

def get_full_media_url(relative_url):
    if not relative_url:
        return None
    
    # If the URL is already a full URL (starts with http/https), return it as-is
    if relative_url.startswith(('http://', 'https://')):
        return relative_url
    
    # Use the MEDIA_URL from settings which should point to S3
    if hasattr(settings, 'MEDIA_URL') and settings.MEDIA_URL:
        # Remove leading slash if present
        if relative_url.startswith('/'):
            relative_url = relative_url[1:]
        return f"{settings.MEDIA_URL}{relative_url}"
    
    # Fallback to base URL if MEDIA_URL not configured
    base_url = getattr(settings, 'BASE_URL', 'http://localhost:8000')
    if relative_url.startswith('/'):
        relative_url = relative_url[1:]
    return f"{base_url}/{relative_url}" 
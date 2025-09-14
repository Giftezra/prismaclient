from django.db.models.signals import post_save
from django.dispatch import receiver
from main.models import User
from main.tasks import send_welcome_email

@receiver(post_save, sender=User)
def send_welcome_email_signal(sender, instance, created, **kwargs):
    """ Send a welcome email to a user asynchronously when a user is created. """
    if created:
        send_welcome_email.delay(instance.email)
# Generated migration - remove chat models

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0010_bookedappointment_is_express_service'),
    ]

    operations = [
        migrations.DeleteModel(name='JobChatMessage'),
        migrations.DeleteModel(name='JobChatRoom'),
    ]

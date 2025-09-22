# Generated manually to re-add image field to Vehicles model

from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0009_bookedappointment_is_reviewed_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='vehicles',
            name='image',
            field=models.ImageField(
                blank=True, 
                null=True, 
                upload_to='vehicles/images/%Y/%m/%d/', 
                validators=[django.core.validators.FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png'])]
            ),
        ),
    ]
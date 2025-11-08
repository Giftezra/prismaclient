# Generated manually to add unique constraint to DetailerProfile.phone

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0006_normalize_existing_detailer_phones'),
    ]

    operations = [
        migrations.AlterField(
            model_name='detailerprofile',
            name='phone',
            field=models.CharField(max_length=15, unique=True),
        ),
    ]


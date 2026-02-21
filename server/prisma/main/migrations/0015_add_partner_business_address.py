# Generated migration - Partner business address fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0014_commissionadminlog'),
    ]

    operations = [
        migrations.AddField(
            model_name='partner',
            name='business_address',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='partner',
            name='business_postcode',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='partner',
            name='business_city',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='partner',
            name='business_country',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='partner',
            name='business_latitude',
            field=models.DecimalField(blank=True, decimal_places=8, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='partner',
            name='business_longitude',
            field=models.DecimalField(blank=True, decimal_places=8, max_digits=10, null=True),
        ),
    ]

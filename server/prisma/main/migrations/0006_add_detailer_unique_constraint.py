# Generated migration to add unique constraint to DetailerProfile

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0005_user_stripe_customer_id_and_more'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='detailerprofile',
            options={'verbose_name': 'Detailer Profile', 'verbose_name_plural': 'Detailer Profiles'},
        ),
        migrations.AddConstraint(
            model_name='detailerprofile',
            constraint=models.UniqueConstraint(
                fields=['name', 'phone'],
                name='unique_detailer_name_phone'
            ),
        ),
    ]

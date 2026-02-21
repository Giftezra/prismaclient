# Generated migration - Partner bank account for payouts

import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0018_alter_bookedappointment_subtotal_amount_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='PartnerBankAccount',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('account_holder_name', models.CharField(max_length=255)),
                ('sort_code', models.CharField(max_length=10)),
                ('account_number', models.CharField(max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('partner', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='bank_account', to='main.partner')),
            ],
        ),
    ]

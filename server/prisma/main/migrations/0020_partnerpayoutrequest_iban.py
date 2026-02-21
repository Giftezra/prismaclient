# Generated migration - PartnerPayoutRequest and IBAN on PartnerBankAccount

import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0019_partnerbankaccount'),
    ]

    operations = [
        migrations.AddField(
            model_name='partnerbankaccount',
            name='iban',
            field=models.CharField(blank=True, max_length=34),
        ),
        migrations.CreateModel(
            name='PartnerPayoutRequest',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('amount_requested', models.DecimalField(decimal_places=2, max_digits=10)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('processing', 'Processing'), ('paid', 'Paid'), ('cancelled', 'Cancelled')], default='pending', max_length=20)),
                ('requested_at', models.DateTimeField(auto_now_add=True)),
                ('paid_at', models.DateTimeField(blank=True, null=True)),
                ('admin_notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('partner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payout_requests', to='main.partner')),
            ],
            options={
                'ordering': ['-requested_at'],
            },
        ),
        migrations.AddIndex(
            model_name='partnerpayoutrequest',
            index=models.Index(fields=['partner'], name='main_partne_partner_6a0b0d_idx'),
        ),
        migrations.AddIndex(
            model_name='partnerpayoutrequest',
            index=models.Index(fields=['status'], name='main_partne_status_8b2e8a_idx'),
        ),
        migrations.AddIndex(
            model_name='partnerpayoutrequest',
            index=models.Index(fields=['requested_at'], name='main_partne_request_9c3f1e_idx'),
        ),
    ]

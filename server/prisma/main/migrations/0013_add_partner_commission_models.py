# Generated migration - Dealership Partner system

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0012_add_branch_lat_long'),
    ]

    operations = [
        migrations.CreateModel(
            name='Partner',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('partner_type', models.CharField(choices=[('dealership', 'Dealership'), ('garage', 'Garage'), ('vehicle_sales', 'Vehicle Sales')], default='dealership', max_length=30)),
                ('business_name', models.CharField(max_length=255)),
                ('referral_code', models.CharField(db_index=True, max_length=12, unique=True)),
                ('is_active', models.BooleanField(default=True)),
                ('commission_rate', models.DecimalField(decimal_places=2, default=5.0, max_digits=5)),
                ('min_payout_threshold', models.DecimalField(decimal_places=2, default=50.0, max_digits=10)),
                ('stripe_connect_account_id', models.CharField(blank=True, max_length=255, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='partner_profile', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='CommissionPayout',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('total_amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('period_start', models.DateField()),
                ('period_end', models.DateField()),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('processing', 'Processing'), ('completed', 'Completed'), ('failed', 'Failed'), ('cancelled', 'Cancelled')], default='pending', max_length=20)),
                ('stripe_payout_id', models.CharField(blank=True, max_length=255, null=True)),
                ('paid_at', models.DateTimeField(blank=True, null=True)),
                ('admin_notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('partner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payouts', to='main.partner')),
            ],
        ),
        migrations.CreateModel(
            name='ReferralAttribution',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('source', models.CharField(choices=[('user', 'User'), ('partner', 'Partner')], default='partner', max_length=10)),
                ('attribution_type', models.CharField(default='lifetime', max_length=20)),
                ('attributed_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('is_transferable', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('partner', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='attributed_users', to='main.partner')),
                ('referred_user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='partner_attribution', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddIndex(
            model_name='referralattribution',
            index=models.Index(fields=['partner'], name='main_refattr_partner_idx'),
        ),
        migrations.AddIndex(
            model_name='referralattribution',
            index=models.Index(fields=['referred_user'], name='main_refattr_refuser_idx'),
        ),
        migrations.CreateModel(
            name='CommissionEarning',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('gross_amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('commission_rate', models.DecimalField(decimal_places=2, max_digits=5)),
                ('commission_amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('paid', 'Paid'), ('reversed', 'Reversed'), ('disputed', 'Disputed')], default='pending', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('booking', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='commission_earnings', to='main.bookedappointment')),
                ('partner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='commission_earnings', to='main.partner')),
                ('payout', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='earnings', to='main.commissionpayout')),
                ('referred_user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='PartnerMetricsCache',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('total_referred_users', models.IntegerField(default=0)),
                ('active_referred_users', models.IntegerField(default=0)),
                ('total_revenue_from_referrals', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('total_commission_earned', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('pending_commission', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('last_updated', models.DateTimeField(auto_now=True)),
                ('partner', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='metrics_cache', to='main.partner')),
            ],
        ),
        migrations.AddIndex(
            model_name='commissionearning',
            index=models.Index(fields=['partner'], name='main_commearn_partner_idx'),
        ),
        migrations.AddIndex(
            model_name='commissionearning',
            index=models.Index(fields=['booking'], name='main_commearn_booking_idx'),
        ),
        migrations.AddConstraint(
            model_name='commissionearning',
            constraint=models.UniqueConstraint(fields=('partner', 'booking'), name='main_commissionearning_unique_partner_booking'),
        ),
    ]

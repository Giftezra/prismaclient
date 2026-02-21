# Generated migration - Commission admin audit log

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0013_add_partner_commission_models'),
    ]

    operations = [
        migrations.CreateModel(
            name='CommissionAdminLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('action', models.CharField(choices=[('reverse', 'Reversed'), ('adjust', 'Adjusted'), ('approve', 'Approved'), ('dispute', 'Disputed'), ('other', 'Other')], max_length=20)),
                ('reason', models.TextField(blank=True)),
                ('previous_status', models.CharField(blank=True, max_length=20)),
                ('previous_amount', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('admin_user', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='commission_admin_actions', to=settings.AUTH_USER_MODEL)),
                ('commission_earning', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='admin_logs', to='main.commissionearning')),
            ],
        ),
    ]

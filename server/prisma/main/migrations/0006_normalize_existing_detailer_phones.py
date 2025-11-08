# Generated manually to normalize existing DetailerProfile phone numbers and merge duplicates

from django.db import migrations
import re


def normalize_phone(phone):
    """Normalize phone number by removing all non-digit characters except leading +"""
    if not phone:
        return ""
    
    phone_str = str(phone).strip()
    if not phone_str:
        return ""
    
    # Remove all non-digit characters except +
    normalized = re.sub(r'[^\d+]', '', phone_str)
    
    # If it starts with +, keep it, otherwise remove any remaining +
    if normalized.startswith('+'):
        return normalized
    else:
        return normalized.replace('+', '')


def normalize_and_merge_duplicates(apps, schema_editor):
    """
    Normalize all DetailerProfile phone numbers and merge duplicates.
    When duplicates are found, keep the oldest profile and update all references.
    """
    DetailerProfile = apps.get_model('main', 'DetailerProfile')
    BookedAppointment = apps.get_model('main', 'BookedAppointment')
    
    # Step 1: Normalize all phone numbers first (temporarily store normalized in memory)
    print("Normalizing phone numbers...")
    profiles = DetailerProfile.objects.all()
    profile_normalized_map = {}  # Maps profile_id -> normalized_phone
    
    for profile in profiles:
        original_phone = profile.phone
        normalized = normalize_phone(original_phone)
        
        if not normalized:
            print(f"Warning: Profile {profile.id} ({profile.name}) has invalid phone: {original_phone}")
            continue
        
        profile_normalized_map[profile.id] = normalized
        
        if normalized != original_phone:
            print(f"Profile {profile.id}: {original_phone} -> {normalized}")
    
    # Step 2: Group profiles by normalized phone to find duplicates
    normalized_to_profiles = {}  # Maps normalized_phone -> list of profile IDs
    for profile_id, normalized_phone in profile_normalized_map.items():
        if normalized_phone not in normalized_to_profiles:
            normalized_to_profiles[normalized_phone] = []
        normalized_to_profiles[normalized_phone].append(profile_id)
    
    # Step 3: Update phone numbers and merge duplicates
    print("\nUpdating phone numbers and merging duplicates...")
    merged_count = 0
    
    for normalized_phone, profile_ids in normalized_to_profiles.items():
        if len(profile_ids) > 1:
            # Multiple profiles with same normalized phone - need to merge
            profiles_to_merge = DetailerProfile.objects.filter(id__in=profile_ids).order_by('created_at')
            
            # Keep the oldest profile (first created)
            primary_profile = profiles_to_merge.first()
            duplicate_profiles = list(profiles_to_merge[1:])
            
            print(f"Merging {len(duplicate_profiles)} duplicates into profile {primary_profile.id} ({primary_profile.name})")
            
            # Update primary profile's phone to normalized version
            primary_profile.phone = normalized_phone
            primary_profile.save()
            
            # Update all bookings to reference the primary profile and merge ratings
            for duplicate in duplicate_profiles:
                # Update all BookedAppointment references
                bookings_updated = BookedAppointment.objects.filter(detailer_id=duplicate.id).update(detailer=primary_profile)
                print(f"  Updated {bookings_updated} bookings from profile {duplicate.id} to {primary_profile.id}")
                
                # Use the highest rating if available
                if duplicate.rating and (not primary_profile.rating or duplicate.rating > primary_profile.rating):
                    primary_profile.rating = duplicate.rating
                    primary_profile.save()
                    print(f"  Updated rating to {primary_profile.rating}")
                
                # Delete the duplicate profile
                duplicate.delete()
                merged_count += 1
        else:
            # Single profile - just update its phone to normalized version
            profile = DetailerProfile.objects.get(id=profile_ids[0])
            if profile.phone != normalized_phone:
                profile.phone = normalized_phone
                profile.save()
                print(f"Updated phone for profile {profile.id}: {normalized_phone}")
    
    print(f"\nMigration complete: Merged {merged_count} duplicate profiles")


def reverse_migration(apps, schema_editor):
    """This migration cannot be reversed automatically"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0005_address_latitude_address_longitude'),
    ]

    operations = [
        migrations.RunPython(normalize_and_merge_duplicates, reverse_migration),
    ]


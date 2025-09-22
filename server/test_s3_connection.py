#!/usr/bin/env python3
"""
Test script to verify AWS S3 bucket connectivity and permissions
Run this script to check if your AWS credentials and bucket configuration are working
"""
import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

def test_aws_credentials():
    """Test if AWS credentials are properly set"""
    print("🔍 Checking AWS credentials...")
    
    aws_access_key = os.getenv('AWS_ACCESS_KEY_ID')
    aws_secret_key = os.getenv('AWS_SECRET_ACCESS_KEY')
    aws_bucket_name = os.getenv('AWS_STORAGE_BUCKET_NAME')
    aws_region = os.getenv('AWS_S3_REGION_NAME')
    
    if not aws_access_key:
        print("❌ AWS_ACCESS_KEY_ID not found in environment variables")
        return False
    
    if not aws_secret_key:
        print("❌ AWS_SECRET_ACCESS_KEY not found in environment variables")
        return False
        
    if not aws_bucket_name:
        print("❌ AWS_STORAGE_BUCKET_NAME not found in environment variables")
        return False
        
    if not aws_region:
        print("❌ AWS_S3_REGION_NAME not found in environment variables")
        return False
    
    print(f"✅ AWS_ACCESS_KEY_ID: {aws_access_key[:8]}****")
    print(f"✅ AWS_SECRET_ACCESS_KEY: ****{aws_secret_key[-4:]}")
    print(f"✅ AWS_STORAGE_BUCKET_NAME: {aws_bucket_name}")
    print(f"✅ AWS_S3_REGION_NAME: {aws_region}")
    
    return True

def test_boto3_connection():
    """Test boto3 connection to AWS S3"""
    print("\n🔍 Testing boto3 S3 connection...")
    
    try:
        import boto3
        from botocore.exceptions import NoCredentialsError, ClientError
        
        # Create S3 client
        s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_S3_REGION_NAME')
        )
        
        bucket_name = os.getenv('AWS_STORAGE_BUCKET_NAME')
        
        # Test bucket access
        print(f"🔍 Testing access to bucket '{bucket_name}'...")
        s3_client.head_bucket(Bucket=bucket_name)
        print(f"✅ Successfully connected to bucket '{bucket_name}'")
        
        # Test list objects (optional - requires ListBucket permission)
        try:
            response = s3_client.list_objects_v2(Bucket=bucket_name, MaxKeys=1)
            print(f"✅ Successfully listed objects in bucket (found {response.get('KeyCount', 0)} items)")
        except ClientError as e:
            if e.response['Error']['Code'] == 'AccessDenied':
                print("⚠️  List objects permission denied, but bucket access confirmed")
            else:
                print(f"⚠️  List objects failed: {e}")
        
        # Test upload permissions (create a small test file)
        test_key = 'test-uploads/connectivity-test.txt'
        test_content = b'AWS S3 connectivity test - this file can be deleted'
        
        print(f"🔍 Testing upload permissions...")
        s3_client.put_object(
            Bucket=bucket_name,
            Key=test_key,
            Body=test_content,
            ContentType='text/plain'
        )
        print(f"✅ Successfully uploaded test file to '{test_key}'")
        
        # Test read permissions
        print(f"🔍 Testing read permissions...")
        response = s3_client.get_object(Bucket=bucket_name, Key=test_key)
        print(f"✅ Successfully downloaded test file")
        
        # Clean up test file
        s3_client.delete_object(Bucket=bucket_name, Key=test_key)
        print(f"✅ Successfully deleted test file")
        
        return True
        
    except ImportError:
        print("❌ boto3 not installed. Run: pip install boto3")
        return False
    except NoCredentialsError:
        print("❌ AWS credentials not found or invalid")
        return False
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchBucket':
            print(f"❌ Bucket '{bucket_name}' does not exist")
        elif error_code == 'AccessDenied':
            print(f"❌ Access denied to bucket '{bucket_name}'. Check your permissions.")
        else:
            print(f"❌ AWS S3 error: {error_code} - {e.response['Error']['Message']}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def test_django_storages():
    """Test if django-storages is properly configured"""
    print("\n🔍 Testing django-storages configuration...")
    
    try:
        import storages
        print(f"✅ django-storages installed (version: {storages.__version__})")
        
        # Try to import the S3 backend
        from storages.backends.s3boto3 import S3Boto3Storage
        print("✅ S3Boto3Storage backend available")
        
        return True
    except ImportError as e:
        print(f"❌ django-storages import error: {e}")
        return False

def main():
    """Main test function"""
    print("🚀 AWS S3 Vehicle Image Upload Debug Test")
    print("=" * 50)
    
    all_tests_passed = True
    
    # Test 1: Check credentials
    if not test_aws_credentials():
        all_tests_passed = False
    
    # Test 2: Test django-storages
    if not test_django_storages():
        all_tests_passed = False
    
    # Test 3: Test boto3 connection
    if not test_boto3_connection():
        all_tests_passed = False
    
    print("\n" + "=" * 50)
    if all_tests_passed:
        print("🎉 All tests PASSED! Your AWS S3 configuration should work for vehicle image uploads.")
        print("\n📋 Next steps:")
        print("   1. Apply the database migration: python manage.py migrate")
        print("   2. Install the new requirements: pip install -r requirements.txt")
        print("   3. Restart your Django server")
        print("   4. Test vehicle image upload from your React Native app")
    else:
        print("❌ Some tests FAILED. Please fix the issues above before proceeding.")
        sys.exit(1)

if __name__ == "__main__":
    main()
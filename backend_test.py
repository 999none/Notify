#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class NotifyAPITester:
    def __init__(self, base_url="https://0b7873e0-e354-4980-bd5f-3bf52951ee28.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        if headers:
            default_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.text.strip() else {}
                except json.JSONDecodeError:
                    return True, {"text_response": response.text}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                return False, {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout (10s)")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_endpoint(self):
        """Test /api/health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET", 
            "health",
            200
        )
        if success:
            if response.get('status') == 'healthy':
                print(f"   ✅ Health status is healthy")
                return True
            else:
                print(f"   ❌ Unexpected health status: {response.get('status')}")
                return False
        return False

    def test_auth_login_endpoint(self):
        """Test /api/auth/login endpoint - should return Spotify OAuth URL"""
        success, response = self.run_test(
            "Auth Login URL",
            "GET",
            "auth/login", 
            200
        )
        if success:
            auth_url = response.get('auth_url')
            if auth_url and 'accounts.spotify.com' in auth_url:
                print(f"   ✅ Valid Spotify OAuth URL returned")
                # Check if redirect_uri is correct (URL-encoded in OAuth URL)
                expected_redirect_encoded = "https%3A%2F%2F0b7873e0-e354-4980-bd5f-3bf52951ee28.preview.emergentagent.com%2Fapi%2Fauth%2Fspotify%2Fcallback"
                if expected_redirect_encoded in auth_url:
                    print(f"   ✅ Correct redirect_uri found in OAuth URL")
                    return True
                else:
                    print(f"   ❌ Expected redirect_uri not found in OAuth URL")
                    print(f"   Auth URL: {auth_url}")
                    return False
            else:
                print(f"   ❌ Invalid auth_url: {auth_url}")
                return False
        return False

    def test_rooms_endpoint(self):
        """Test /api/rooms endpoint - should return empty array initially"""  
        success, response = self.run_test(
            "Rooms List",
            "GET",
            "rooms",
            200
        )
        if success:
            if isinstance(response, list):
                print(f"   ✅ Rooms endpoint returns array with {len(response)} rooms")
                return True
            else:
                print(f"   ❌ Rooms endpoint should return array, got: {type(response)}")
                return False
        return False

    def test_download_project_endpoint(self):
        """Test /api/download/project endpoint - should return ZIP file"""
        print(f"\n🔍 Testing Download Project ZIP...")
        url = f"{self.base_url}/download/project"
        print(f"   URL: {url}")
        
        self.tests_run += 1
        
        try:
            response = requests.get(url, timeout=30, stream=True)
            
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                content_disposition = response.headers.get('content-disposition', '')
                
                # Check if it's a ZIP file
                if 'application/zip' in content_type or 'zip' in content_disposition.lower():
                    # Read a small chunk to verify it's actually a ZIP
                    chunk = next(response.iter_content(1024), b'')
                    if chunk.startswith(b'PK'):  # ZIP magic number
                        self.tests_passed += 1
                        print(f"✅ Passed - Valid ZIP file returned (Content-Type: {content_type})")
                        print(f"   Content-Disposition: {content_disposition}")
                        return True
                    else:
                        print(f"❌ Failed - Response doesn't appear to be a valid ZIP file")
                        return False
                else:
                    print(f"❌ Failed - Expected ZIP file, got Content-Type: {content_type}")
                    return False
            else:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                return False
                
        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout (30s)")
            return False
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

    def test_root_endpoint(self):
        """Test /api/ root endpoint"""
        success, response = self.run_test(
            "API Root",
            "GET",
            "",
            200
        )
        if success:
            if response.get('message') and 'notify' in response.get('message', '').lower():
                print(f"   ✅ Valid API root response")
                return True
            else:
                print(f"   ❌ Unexpected root response: {response}")
                return False
        return False

def main():
    print("🚀 Starting Notify Backend API Tests...")
    print("=" * 60)
    
    tester = NotifyAPITester()
    
    # Track individual test results
    results = {}
    
    # Test all endpoints
    results['root'] = tester.test_root_endpoint()
    results['health'] = tester.test_health_endpoint()
    results['auth_login'] = tester.test_auth_login_endpoint()
    results['rooms'] = tester.test_rooms_endpoint()
    results['download'] = tester.test_download_project_endpoint()
    
    # Print summary
    print("\n" + "=" * 60)
    print(f"📊 BACKEND TEST RESULTS:")
    print(f"   Total Tests: {tester.tests_run}")
    print(f"   Passed: {tester.tests_passed}")
    print(f"   Failed: {tester.tests_run - tester.tests_passed}")
    print(f"   Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    # Detailed results
    print(f"\n📋 Individual Test Results:")
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"   {test_name}: {status}")
    
    # Return exit code based on success
    if tester.tests_passed == tester.tests_run:
        print(f"\n🎉 All backend tests passed!")
        return 0
    else:
        print(f"\n⚠️  {tester.tests_run - tester.tests_passed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
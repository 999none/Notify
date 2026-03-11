#!/usr/bin/env python3
"""
Backend API Testing for Notify - Social Spotify JAM Web App
Tests all unauthenticated endpoints and verifies authenticated endpoints return correct 401.
"""

import requests
import sys
import json
from datetime import datetime

class NotifyAPITester:
    def __init__(self, base_url="https://beat-bond.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, expected_status, actual_status, success, response_data=None, error_msg=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test_name": name,
            "expected_status": expected_status,
            "actual_status": actual_status,
            "success": success,
            "error_msg": error_msg,
            "timestamp": datetime.now().isoformat()
        }
        if response_data:
            result["response_data"] = response_data
        
        self.test_results.append(result)
        
        status_icon = "✅" if success else "❌"
        print(f"\n{status_icon} {name}")
        print(f"   Expected: {expected_status}, Got: {actual_status}")
        if error_msg:
            print(f"   Error: {error_msg}")
        elif response_data:
            print(f"   Response: {json.dumps(response_data, indent=2) if isinstance(response_data, dict) else response_data}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}" if not endpoint.startswith('http') else endpoint
        
        if headers is None:
            headers = {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = response.text[:200] if response.text else "No content"
            
            self.log_test(name, expected_status, response.status_code, success, response_data)
            return success, response_data, response.status_code

        except requests.exceptions.RequestException as e:
            error_msg = f"Request failed: {str(e)}"
            self.log_test(name, expected_status, 'ERROR', False, error_msg=error_msg)
            return False, {}, 'ERROR'
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            self.log_test(name, expected_status, 'ERROR', False, error_msg=error_msg)
            return False, {}, 'ERROR'

    def test_basic_endpoints(self):
        """Test basic unauthenticated endpoints"""
        print("🔍 Testing Basic Endpoints...")
        
        # Test root endpoint
        success, data, status = self.run_test(
            "API Root Endpoint",
            "GET", 
            "",
            200
        )
        if success and isinstance(data, dict):
            if data.get('message') == 'Notify API':
                print("   ✨ Root endpoint returns correct message: 'Notify API'")
            else:
                print(f"   ⚠️  Expected 'Notify API', got: {data.get('message')}")

        # Test info/urls endpoint
        success, data, status = self.run_test(
            "API Info URLs",
            "GET",
            "info/urls",
            200
        )
        if success and isinstance(data, dict):
            expected_keys = ['frontend_url', 'backend_api', 'spotify_login', 'spotify_callback', 'zip_download']
            for key in expected_keys:
                if key in data:
                    print(f"   ✨ Found {key}: {data[key]}")
                else:
                    print(f"   ⚠️  Missing {key} in response")

        # Test Spotify login endpoint
        success, data, status = self.run_test(
            "Spotify Login Endpoint",
            "GET",
            "auth/spotify/login",
            200
        )
        if success and isinstance(data, dict):
            if 'auth_url' in data and data['auth_url'].startswith('https://accounts.spotify.com'):
                print("   ✨ Spotify auth URL returned correctly")
            else:
                print(f"   ⚠️  Invalid auth_url: {data.get('auth_url')}")

        # Test ZIP download endpoint (should redirect)
        success, data, status = self.run_test(
            "ZIP Download Endpoint",
            "GET",
            "download",
            302  # Redirect status
        )

    def test_authenticated_endpoints(self):
        """Test endpoints that require authentication (should return 401)"""
        print("\n🔒 Testing Authenticated Endpoints (Should return 401)...")
        
        # Auth endpoints
        self.run_test("Get Current User", "GET", "auth/me", 401)
        
        # Friends endpoints  
        self.run_test("Search Friends", "GET", "friends/search?q=test", 401)
        self.run_test("List Friends", "GET", "friends/list", 401) 
        self.run_test("Pending Friends", "GET", "friends/pending", 401)
        
        # Compatibility endpoints
        self.run_test("Calculate Compatibility", "POST", "compatibility/calculate/dummy_id", 401)
        self.run_test("Get Compatibility", "GET", "compatibility/dummy_id", 401)
        
        # Rooms endpoint
        self.run_test("Create Room with Friend", "POST", "rooms/create-with-friend", 401, 
                     data={"friend_id": "dummy", "name": "Test Room"})
        
        # Spotify data endpoints
        self.run_test("Get Top Artists", "GET", "spotify/top-artists", 401)
        self.run_test("Get Top Tracks", "GET", "spotify/top-tracks", 401)
        self.run_test("Get Recently Played", "GET", "spotify/recently-played", 401)
        self.run_test("Get Playlists", "GET", "spotify/playlists", 401)
        
        # Rooms endpoints
        self.run_test("List Rooms", "GET", "rooms/list", 401)
        self.run_test("Create Room", "POST", "rooms/create", 401, data={"name": "Test Room"})

    def test_status_endpoints(self):
        """Test status-related endpoints"""
        print("\n📊 Testing Status Endpoints...")
        
        # Test status creation
        test_data = {"client_name": "test_client"}
        success, data, status = self.run_test(
            "Create Status Check",
            "POST",
            "status",
            200,
            data=test_data
        )
        
        # Test getting status checks
        self.run_test("Get Status Checks", "GET", "status", 200)

    def test_zip_download_direct(self):
        """Test direct ZIP download endpoint"""
        print("\n📦 Testing Direct ZIP Download...")
        
        self.run_test(
            "Direct ZIP Download", 
            "GET",
            "download/project-zip",
            200
        )

    def run_all_tests(self):
        """Run all test suites"""
        print(f"🚀 Starting Notify API Tests")
        print(f"🌐 Base URL: {self.base_url}")
        print(f"📅 Started at: {datetime.now().isoformat()}\n")
        
        try:
            self.test_basic_endpoints()
            self.test_status_endpoints()
            self.test_authenticated_endpoints()
            self.test_zip_download_direct()
            
        except KeyboardInterrupt:
            print("\n⚠️ Tests interrupted by user")
        except Exception as e:
            print(f"\n💥 Unexpected error during testing: {e}")
        
        self.print_summary()
        return self.tests_passed == self.tests_run

    def print_summary(self):
        """Print test results summary"""
        print(f"\n" + "="*60)
        print(f"📊 TEST SUMMARY")
        print(f"="*60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        print(f"Completed at: {datetime.now().isoformat()}")
        
        # Print failed tests
        failed_tests = [t for t in self.test_results if not t['success']]
        if failed_tests:
            print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"   • {test['test_name']}: Expected {test['expected_status']}, Got {test['actual_status']}")
                if test.get('error_msg'):
                    print(f"     Error: {test['error_msg']}")
        else:
            print(f"\n✅ All tests passed!")
        
        print(f"="*60)

    def get_results_summary(self):
        """Get structured results for test reports"""
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.tests_run - self.tests_passed,
            "success_rate": (self.tests_passed/self.tests_run*100) if self.tests_run > 0 else 0,
            "test_results": self.test_results,
            "timestamp": datetime.now().isoformat()
        }

def main():
    """Main test execution"""
    tester = NotifyAPITester()
    success = tester.run_all_tests()
    
    # Save results to file for reporting
    results = tester.get_results_summary()
    try:
        with open('/app/backend_test_results.json', 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\n💾 Results saved to: /app/backend_test_results.json")
    except Exception as e:
        print(f"\n⚠️ Could not save results: {e}")
    
    return 0 if success else 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
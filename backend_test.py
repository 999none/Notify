import requests
import sys
from datetime import datetime

class NotifyAPITester:
    def __init__(self, base_url="https://notify-feed.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}" if endpoint else self.base_url
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)

            print(f"   Response: {response.status_code}")
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ PASS - Status: {response.status_code}")
                try:
                    response_json = response.json()
                    if isinstance(response_json, dict) and len(str(response_json)) < 200:
                        print(f"   Response body: {response_json}")
                except:
                    if response.text and len(response.text) < 100:
                        print(f"   Response text: {response.text}")
            else:
                self.failed_tests.append(f"{name}: Expected {expected_status}, got {response.status_code}")
                print(f"❌ FAIL - Expected {expected_status}, got {response.status_code}")
                if response.text:
                    print(f"   Error response: {response.text[:200]}")

            return success, response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text

        except Exception as e:
            self.failed_tests.append(f"{name}: Error - {str(e)}")
            print(f"❌ FAIL - Error: {str(e)}")
            return False, {}

    def test_root_api(self):
        """Test GET /api/ returns Notify API message"""
        success, response = self.run_test(
            "Root API Message",
            "GET",
            "",
            200
        )
        if success and isinstance(response, dict):
            message = response.get('message', '')
            if 'Notify API' in message:
                print(f"✅ Correct message found: '{message}'")
                return True
            else:
                print(f"❌ Unexpected message: '{message}'")
                return False
        return success

    def test_info_urls(self):
        """Test GET /api/info/urls returns all URLs correctly"""
        success, response = self.run_test(
            "Info URLs Endpoint",
            "GET",
            "info/urls",
            200
        )
        if success and isinstance(response, dict):
            expected_keys = ['frontend_url', 'backend_api', 'spotify_login', 'spotify_callback', 'zip_download']
            found_keys = list(response.keys())
            print(f"   Found keys: {found_keys}")
            if all(key in response for key in expected_keys):
                print("✅ All required URL keys present")
                return True
            else:
                missing = [key for key in expected_keys if key not in response]
                print(f"❌ Missing keys: {missing}")
                return False
        return success

    def test_unauthorized_endpoints(self):
        """Test that protected endpoints return 401 without auth"""
        endpoints = [
            ("notifications/test-user-id", "GET"),
            ("notifications/mark-read/test-notification-id", "POST"),
            ("notifications/mark-all-read", "POST"),
            ("auth/me", "GET"),
            ("spotify/top-artists", "GET"),
        ]
        
        all_passed = True
        for endpoint, method in endpoints:
            success, _ = self.run_test(
                f"Unauthorized {method} {endpoint}",
                method,
                endpoint,
                401
            )
            if not success:
                all_passed = False
        
        return all_passed

    def test_download_endpoints(self):
        """Test download endpoints"""
        # Test redirect endpoint
        success1, _ = self.run_test(
            "Download Redirect",
            "GET", 
            "download",
            302  # Redirect response
        )
        
        # Test actual ZIP download endpoint
        success2, _ = self.run_test(
            "ZIP Download Endpoint",
            "GET",
            "download/project-zip", 
            200
        )
        
        return success1 and success2

def main():
    print("🚀 Starting Notify API Tests")
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # Setup
    tester = NotifyAPITester()

    # Run tests
    print("\n📋 Running Backend API Tests...")
    
    test_results = []
    test_results.append(tester.test_root_api())
    test_results.append(tester.test_info_urls())
    test_results.append(tester.test_unauthorized_endpoints())
    test_results.append(tester.test_download_endpoints())

    # Print results
    print("\n" + "=" * 60)
    print(f"📊 TEST SUMMARY")
    print(f"   Tests run: {tester.tests_run}")
    print(f"   Tests passed: {tester.tests_passed}")
    print(f"   Tests failed: {len(tester.failed_tests)}")
    print(f"   Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.failed_tests:
        print(f"\n❌ FAILED TESTS:")
        for i, failure in enumerate(tester.failed_tests, 1):
            print(f"   {i}. {failure}")
    else:
        print(f"\n✅ ALL TESTS PASSED!")
    
    print(f"\n⏰ Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())
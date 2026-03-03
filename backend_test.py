import requests
import sys
from datetime import datetime

class NotifyAPITester:
    def __init__(self, base_url="https://35a6892e-df29-4024-9648-2a9474396648.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        print(f"   Method: {method}")
        print(f"   Expected Status: {expected_status}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_json = response.json()
                    if isinstance(response_json, dict):
                        print(f"   Response keys: {list(response_json.keys())}")
                    return True, response_json
                except:
                    return True, {}
            else:
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "endpoint": endpoint
                })
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_response = response.json()
                    print(f"   Error: {error_response}")
                except:
                    print(f"   Response text: {response.text[:200]}")
                return False, {}

        except Exception as e:
            self.failed_tests.append({
                "test": name,
                "expected": expected_status,
                "actual": f"Exception: {str(e)}",
                "endpoint": endpoint
            })
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_endpoint(self):
        """Test /api/health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "api/health",
            200
        )
        if success:
            print(f"   Health status: {response.get('status', 'N/A')}")
        return success

    def test_download_without_auth(self):
        """Test /api/download/project without authentication"""
        # Temporarily remove token for this test
        original_token = self.token
        self.token = None
        
        success, response = self.run_test(
            "Download Project Without Auth",
            "GET",
            "api/download/project",
            401
        )
        
        # Restore token
        self.token = original_token
        return success

    def test_download_with_invalid_auth(self):
        """Test /api/download/project with invalid authentication"""
        success, response = self.run_test(
            "Download Project With Invalid Auth",
            "GET",
            "api/download/project",
            401,
            headers={'Authorization': 'Bearer invalid_token_123'}
        )
        return success

    def test_root_endpoint(self):
        """Test /api/ root endpoint"""
        success, response = self.run_test(
            "API Root",
            "GET",
            "api/",
            200
        )
        if success:
            print(f"   API Message: {response.get('message', 'N/A')}")
        return success

    def print_summary(self):
        """Print test summary"""
        print(f"\n{'='*60}")
        print(f"📊 BACKEND API TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {len(self.failed_tests)}")
        print(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%" if self.tests_run > 0 else "No tests run")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for failure in self.failed_tests:
                print(f"  • {failure['test']}: Expected {failure['expected']}, got {failure['actual']}")
                print(f"    Endpoint: {failure['endpoint']}")
        
        return self.tests_passed, len(self.failed_tests)

def main():
    """Main test function"""
    print(f"🚀 Starting Notify Backend API Tests")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tester = NotifyAPITester()
    
    # Run tests according to requirements
    tests_results = []
    
    # 1. Test health endpoint
    tests_results.append(tester.test_health_endpoint())
    
    # 2. Test root API endpoint
    tests_results.append(tester.test_root_endpoint())
    
    # 3. Test download endpoint without auth (should return 401)
    tests_results.append(tester.test_download_without_auth())
    
    # 4. Test download endpoint with invalid auth (should return 401)
    tests_results.append(tester.test_download_with_invalid_auth())
    
    # Print summary
    passed, failed = tester.print_summary()
    
    # Return appropriate exit code
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
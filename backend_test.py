import requests
import sys
import json
from datetime import datetime

class NotifyAPITester:
    def __init__(self, base_url="https://35a6892e-df29-4024-9648-2a9474396648.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, expect_json=True):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                if expect_json:
                    try:
                        json_resp = response.json()
                        print(f"   Response type: {type(json_resp)}")
                        return True, json_resp
                    except:
                        return True, {}
                else:
                    return True, response.text
            else:
                self.failed_tests.append({
                    "test": name,
                    "endpoint": endpoint,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
                })
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            self.failed_tests.append({
                "test": name,
                "endpoint": endpoint,
                "error": str(e)
            })
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        print("\n=== TESTING HEALTH & BASIC ENDPOINTS ===")
        
        # Test health endpoint
        self.run_test("Health Check", "GET", "health", 200)
        
        # Test root endpoint
        self.run_test("Root API", "GET", "", 200)

    def test_route_ordering_fix(self):
        """Test the critical route ordering fix - import-spotify should not be captured by {playlist_id}"""
        print("\n=== TESTING ROUTE ORDERING FIX ===")
        
        # This should hit the specific import-spotify route, not the dynamic {playlist_id} route
        # Without auth, it should return 401 (protected route) rather than 404 (route not found)
        success, resp = self.run_test(
            "Import Spotify Route Ordering", 
            "GET", 
            "playlists/import-spotify", 
            401  # Should be 401 (unauthorized) not 404 (not found) if route ordering is correct
        )
        
        if success or (not success and any("401" in str(failure.get("actual", "")) for failure in self.failed_tests[-1:])):
            print("✅ Route ordering appears correct - import-spotify route exists")
        else:
            print("❌ Route ordering issue - import-spotify may be captured by {playlist_id}")

        # Test the POST variant too
        self.run_test(
            "Import Spotify Playlist Route",
            "POST", 
            "playlists/import-spotify/test123", 
            401  # Should be 401 (unauthorized) not 404 (not found)
        )

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n=== TESTING AUTH ENDPOINTS ===")
        
        # Test login endpoint - should return auth_url
        success, resp = self.run_test("Auth Login", "GET", "auth/login", 200)
        if success and resp.get("auth_url"):
            print("✅ Auth login returns auth_url")
        else:
            print("❌ Auth login missing auth_url")

    def test_friends_endpoints(self):
        """Test friends API endpoints without authentication"""
        print("\n=== TESTING FRIENDS ENDPOINTS ===")
        
        # All should return 401 without auth
        endpoints = [
            ("GET", "friends", "Get Friends"),
            ("GET", "friends/pending", "Get Pending Requests"),
            ("POST", "friends/request", "Send Friend Request"),
            ("POST", "friends/accept", "Accept Friend Request"),
            ("POST", "friends/reject", "Reject Friend Request"),
            ("DELETE", "friends/dummy-id", "Remove Friend"),
            ("GET", "friends/dummy-id/status", "Get Friendship Status")
        ]
        
        for method, endpoint, name in endpoints:
            data = {"target_user_id": "dummy"} if method in ["POST"] else None
            self.run_test(name, method, endpoint, 401, data)

    def test_playlist_endpoints(self):
        """Test playlist CRUD endpoints without authentication"""
        print("\n=== TESTING PLAYLIST ENDPOINTS ===")
        
        # All should return 401 without auth
        endpoints = [
            ("POST", "playlists", "Create Playlist"),
            ("GET", "playlists", "List Playlists"),
            ("GET", "playlists/dummy-id", "Get Playlist"),
            ("PUT", "playlists/dummy-id", "Update Playlist"),
            ("DELETE", "playlists/dummy-id", "Delete Playlist")
        ]
        
        for method, endpoint, name in endpoints:
            data = {"name": "Test"} if method in ["POST", "PUT"] else None
            self.run_test(name, method, endpoint, 401, data)

    def test_room_endpoints(self):
        """Test room CRUD endpoints"""
        print("\n=== TESTING ROOM ENDPOINTS ===")
        
        # Test rooms list (should work without auth)
        self.run_test("List Rooms", "GET", "rooms", 200)
        
        # Test room by ID (should return 404 for non-existent room)
        self.run_test("Get Room", "GET", "rooms/nonexistent", 404)
        
        # Test create room (should require auth)
        self.run_test("Create Room", "POST", "rooms", 401, {"name": "Test Room"})

    def test_user_endpoints(self):
        """Test user endpoints without authentication"""
        print("\n=== TESTING USER ENDPOINTS ===")
        
        # All should return 401 without auth
        endpoints = [
            ("GET", "users/me", "Get Current User"),
            ("GET", "users/me/premium", "Check Premium"),
            ("GET", "users/me/spotify-token", "Get Spotify Token"),
            ("GET", "users/me/top-artists", "Get Top Artists"),
            ("GET", "users/me/top-tracks", "Get Top Tracks")
        ]
        
        for method, endpoint, name in endpoints:
            self.run_test(name, method, endpoint, 401)

    def print_summary(self):
        """Print test results summary"""
        print(f"\n{'='*50}")
        print(f"📊 BACKEND API TEST RESULTS")
        print(f"{'='*50}")
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {len(self.failed_tests)}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for i, failure in enumerate(self.failed_tests, 1):
                print(f"{i}. {failure.get('test', 'Unknown')}")
                if 'error' in failure:
                    print(f"   Error: {failure['error']}")
                else:
                    print(f"   Expected: {failure.get('expected')}, Got: {failure.get('actual')}")
                    if failure.get('response'):
                        print(f"   Response: {failure['response']}")
                print()

def main():
    print("🚀 Starting Notify API Backend Tests")
    print("=" * 50)
    
    tester = NotifyAPITester()
    
    # Run all test suites
    tester.test_health_endpoints()
    tester.test_route_ordering_fix()
    tester.test_auth_endpoints()
    tester.test_friends_endpoints()
    tester.test_playlist_endpoints()
    tester.test_room_endpoints()
    tester.test_user_endpoints()
    
    # Print summary
    tester.print_summary()
    
    # Return exit code based on results
    return 0 if len(tester.failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
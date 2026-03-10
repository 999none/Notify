import requests
import sys
import json
import jwt
import uuid
from datetime import datetime, timezone
import pymongo

class NotifyAPITester:
    def __init__(self, base_url="https://music-sync-13.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.test_user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # JWT secret from backend
        self.jwt_secret = "notify_jwt_secret_k3y_2026_sp0t1fy"
        
        # MongoDB setup
        try:
            self.mongo_client = pymongo.MongoClient("mongodb://localhost:27017")
            self.db = self.mongo_client["test_database"]
            print("✅ Connected to MongoDB")
        except Exception as e:
            print(f"❌ MongoDB connection failed: {e}")
            self.mongo_client = None
            self.db = None

    def log_test(self, name, success, status_code=None, details=None):
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "name": name,
            "success": success,
            "status_code": status_code,
            "details": details
        }
        self.test_results.append(result)
        
        status_emoji = "✅" if success else "❌"
        status_text = f"Status: {status_code}" if status_code else ""
        print(f"{status_emoji} {name} - {status_text}")
        if details:
            print(f"   Details: {details}")

    def create_test_user(self):
        """Create a test user directly in MongoDB and generate JWT token"""
        if self.db is None:
            self.log_test("Create Test User", False, details="MongoDB not available")
            return False
            
        try:
            # Create test user
            self.test_user_id = str(uuid.uuid4())
            spotify_id = f"test_spotify_{self.test_user_id[:8]}"
            
            user_doc = {
                "id": self.test_user_id,
                "spotify_id": spotify_id,
                "username": f"TestUser_{self.test_user_id[:8]}",
                "avatar": None,
                "email": f"test_{self.test_user_id[:8]}@example.com",
                "country": "US",
                "subscription": "free",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            
            # Insert user if not exists
            existing = self.db.users.find_one({"id": self.test_user_id})
            if not existing:
                self.db.users.insert_one(user_doc)
            
            # Generate JWT token
            payload = {
                "user_id": self.test_user_id,
                "spotify_id": spotify_id,
                "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7
            }
            self.token = jwt.encode(payload, self.jwt_secret, algorithm="HS256")
            
            self.log_test("Create Test User", True, details=f"User ID: {self.test_user_id}")
            return True
            
        except Exception as e:
            self.log_test("Create Test User", False, details=str(e))
            return False

    def run_api_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        # Add auth token if available
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
            
        # Add any additional headers
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)
            else:
                self.log_test(name, False, details=f"Unsupported method: {method}")
                return False, {}

            success = response.status_code == expected_status
            
            try:
                response_data = response.json() if response.content else {}
            except:
                response_data = {"text": response.text}
            
            if success:
                self.log_test(name, True, response.status_code, f"Response: {json.dumps(response_data, indent=2)[:200]}")
            else:
                self.log_test(name, False, response.status_code, f"Expected {expected_status}, got response: {json.dumps(response_data, indent=2)[:300]}")

            return success, response_data

        except requests.RequestException as e:
            self.log_test(name, False, details=f"Request failed: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test GET /api/ endpoint"""
        success, response = self.run_api_test(
            "Root API Endpoint",
            "GET", "/", 200
        )
        if success and response.get("message") == "Notify API":
            return True
        else:
            self.log_test("Root API Message Check", False, details=f"Expected 'Notify API', got: {response.get('message')}")
            return False

    def test_auth_me(self):
        """Test GET /api/auth/me endpoint"""
        if not self.token:
            self.log_test("Auth Me Test", False, details="No token available")
            return False
            
        success, response = self.run_api_test(
            "Auth Me Endpoint",
            "GET", "/auth/me", 200
        )
        return success and response.get("id") == self.test_user_id

    def test_room_operations(self):
        """Test room creation, listing, joining, and details"""
        results = []
        
        # 1. Create a room
        room_data = {"name": "Test Room for API Testing"}
        success, room_response = self.run_api_test(
            "Create Room",
            "POST", "/rooms/create", 200, room_data
        )
        
        if not success:
            return False
            
        room_id = room_response.get("id")
        if not room_id:
            self.log_test("Room ID Check", False, details="No room ID returned")
            return False
            
        results.append(success)
        
        # 2. List rooms
        success, list_response = self.run_api_test(
            "List Rooms",
            "GET", "/rooms/list", 200
        )
        results.append(success)
        
        # 3. Get room details
        success, room_details = self.run_api_test(
            "Get Room Details",
            "GET", f"/rooms/{room_id}", 200
        )
        results.append(success)
        
        # 4. Join room (should already be joined as host)
        join_data = {"room_id": room_id}
        success, join_response = self.run_api_test(
            "Join Room",
            "POST", "/rooms/join", 200, join_data
        )
        results.append(success)
        
        # Store room_id for queue tests
        self.test_room_id = room_id
        return all(results)

    def test_queue_operations(self):
        """Test queue add, vote, and retrieval operations"""
        if not hasattr(self, 'test_room_id'):
            self.log_test("Queue Operations", False, details="No test room available")
            return False
            
        results = []
        
        # 1. Add track to queue
        track_data = {
            "room_id": self.test_room_id,
            "track_id": "test_track_123",
            "track_name": "Test Track",
            "artist": "Test Artist",
            "album": "Test Album",
            "image": "https://example.com/test.jpg",
            "duration_ms": 180000,
            "external_url": "https://open.spotify.com/track/test_track_123"
        }
        
        success, queue_response = self.run_api_test(
            "Add Track to Queue",
            "POST", "/rooms/queue/add", 200, track_data
        )
        results.append(success)
        
        if not success:
            return False
            
        queue_item_id = queue_response.get("id")
        if not queue_item_id:
            self.log_test("Queue Item ID Check", False, details="No queue item ID returned")
            return False
        
        # 2. Vote on queue item
        vote_data = {
            "room_id": self.test_room_id,
            "queue_item_id": queue_item_id
        }
        
        success, vote_response = self.run_api_test(
            "Vote on Queue Item",
            "POST", "/rooms/queue/vote", 200, vote_data
        )
        results.append(success)
        
        # 3. Get room queue
        success, queue_list = self.run_api_test(
            "Get Room Queue",
            "GET", f"/rooms/{self.test_room_id}/queue", 200
        )
        results.append(success)
        
        return all(results)

    def test_leave_room(self):
        """Test leaving a room"""
        if not hasattr(self, 'test_room_id'):
            self.log_test("Leave Room", False, details="No test room available")
            return False
            
        leave_data = {"room_id": self.test_room_id}
        success, response = self.run_api_test(
            "Leave Room",
            "POST", "/rooms/leave", 200, leave_data
        )
        return success

    def cleanup_test_data(self):
        """Clean up test data from MongoDB"""
        if self.db is None or not self.test_user_id:
            return
            
        try:
            # Clean up test user and related data
            self.db.users.delete_one({"id": self.test_user_id})
            self.db.room_participants.delete_many({"user_id": self.test_user_id})
            if hasattr(self, 'test_room_id'):
                self.db.rooms.delete_one({"id": self.test_room_id})
                self.db.room_queue.delete_many({"room_id": self.test_room_id})
            print("✅ Test data cleaned up")
        except Exception as e:
            print(f"⚠️ Cleanup warning: {e}")

    def run_all_tests(self):
        """Run all API tests in sequence"""
        print("🧪 Starting Notify API Tests")
        print("=" * 50)
        
        # Setup
        if not self.create_test_user():
            print("❌ Test setup failed - cannot continue")
            return False
            
        # Core API tests
        tests = [
            ("Root Endpoint", self.test_root_endpoint),
            ("Auth Me", self.test_auth_me), 
            ("Room Operations", self.test_room_operations),
            ("Queue Operations", self.test_queue_operations),
            ("Leave Room", self.test_leave_room),
        ]
        
        for test_name, test_func in tests:
            print(f"\n🔍 Running {test_name}...")
            try:
                test_func()
            except Exception as e:
                self.log_test(f"{test_name} Exception", False, details=str(e))
        
        # Cleanup
        self.cleanup_test_data()
        
        # Results
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print("⚠️ Some tests failed")
            
            # Print failed tests
            failed_tests = [t for t in self.test_results if not t["success"]]
            if failed_tests:
                print("\n❌ Failed Tests:")
                for test in failed_tests:
                    print(f"  - {test['name']}: {test.get('details', 'No details')}")
            
            return False

def main():
    tester = NotifyAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
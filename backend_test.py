import requests
import sys
import json
from datetime import datetime

class SpotifyDashAPITester:
    def __init__(self, base_url="https://spotify-dash-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failures = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_base}/{endpoint}" if not endpoint.startswith('http') else endpoint
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
                    resp_data = response.json()
                    print(f"   Response: {json.dumps(resp_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:100]}...")
            else:
                self.failures.append({
                    'test': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'response': response.text[:200]
                })
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")

            return success, response.json() if success and response.headers.get('content-type', '').startswith('application/json') else response.text

        except Exception as e:
            self.failures.append({
                'test': name,
                'error': str(e)
            })
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test GET /api/ endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        if success and isinstance(response, dict):
            expected_message = "Notify API"
            if response.get('message') == expected_message:
                print(f"✅ Root endpoint returns correct message: {expected_message}")
                return True
            else:
                print(f"❌ Root endpoint message mismatch: expected '{expected_message}', got '{response.get('message')}'")
        return success

    def test_spotify_login_endpoint(self):
        """Test GET /api/auth/spotify/login endpoint"""
        success, response = self.run_test(
            "Spotify Login Endpoint",
            "GET",
            "auth/spotify/login",
            200
        )
        if success and isinstance(response, dict):
            if 'auth_url' in response and 'accounts.spotify.com' in response['auth_url']:
                print(f"✅ Spotify login returns valid auth_url")
                return True
            else:
                print(f"❌ Spotify login response missing or invalid auth_url")
        return success

    def test_info_urls_endpoint(self):
        """Test GET /api/info/urls endpoint"""
        success, response = self.run_test(
            "Info URLs Endpoint",
            "GET",
            "info/urls",
            200
        )
        if success and isinstance(response, dict):
            required_keys = ['frontend_url', 'backend_api', 'spotify_login', 'spotify_callback', 'zip_download']
            missing_keys = [key for key in required_keys if key not in response]
            if not missing_keys:
                print(f"✅ Info URLs endpoint returns all required URLs")
                return True
            else:
                print(f"❌ Info URLs endpoint missing keys: {missing_keys}")
        return success

    def test_download_zip_endpoint(self):
        """Test GET /api/download/project-zip endpoint"""
        success, response = self.run_test(
            "Download ZIP Endpoint",
            "GET",
            "download/project-zip",
            200
        )
        if success:
            print(f"✅ ZIP download endpoint is accessible")
            return True
        return success

    def test_youtube_search_endpoint(self):
        """Test GET /api/player/search-youtube endpoint with various tracks"""
        test_cases = [
            {
                "name": "YouTube Search - Bohemian Rhapsody by Queen",
                "params": {"track_name": "Bohemian Rhapsody", "artist_name": "Queen"},
                "should_find": True
            },
            {
                "name": "YouTube Search - Blinding Lights by The Weeknd", 
                "params": {"track_name": "Blinding Lights", "artist_name": "The Weeknd"},
                "should_find": True
            },
            {
                "name": "YouTube Search - Nonexistent track",
                "params": {"track_name": "NonexistentTrack123XYZ", "artist_name": "FakeArtist999"},
                "should_find": False
            }
        ]
        
        all_passed = True
        for test_case in test_cases:
            # Build URL with query params
            params_str = "&".join([f"{k}={v}" for k, v in test_case["params"].items()])
            endpoint = f"player/search-youtube?{params_str}"
            
            success, response = self.run_test(
                test_case["name"],
                "GET",
                endpoint,
                200
            )
            
            if success and isinstance(response, dict):
                if test_case["should_find"]:
                    if response.get("found") == True:
                        required_keys = ["video_id", "title", "channel", "duration", "thumbnail", "url"]
                        missing_keys = [key for key in required_keys if key not in response]
                        if not missing_keys:
                            print(f"✅ YouTube search found track with all required fields")
                        else:
                            print(f"❌ YouTube search missing fields: {missing_keys}")
                            all_passed = False
                    else:
                        print(f"❌ Expected to find track but got found=false")
                        all_passed = False
                else:
                    if response.get("found") == False and "message" in response:
                        print(f"✅ YouTube search correctly returned not found with message")
                    else:
                        print(f"❌ Expected found=false with message for nonexistent track")
                        all_passed = False
            else:
                all_passed = False
                
        return all_passed

    def test_spotify_token_endpoint_without_auth(self):
        """Test GET /api/player/spotify-token endpoint without auth (should return 401)"""
        success, response = self.run_test(
            "Spotify Token Endpoint (no auth)",
            "GET",
            "player/spotify-token",
            401
        )
        return success

    def test_protected_endpoints_without_auth(self):
        """Test protected endpoints without authentication (should return 401)"""
        protected_endpoints = [
            "auth/me",
            "spotify/top-artists", 
            "spotify/top-tracks",
            "spotify/recently-played",
            "spotify/playlists"
        ]
        
        all_passed = True
        for endpoint in protected_endpoints:
            success, _ = self.run_test(
                f"Protected endpoint {endpoint} (no auth)",
                "GET",
                endpoint,
                401
            )
            if not success:
                all_passed = False
        
        return all_passed

def main():
    # Setup
    tester = SpotifyDashAPITester()
    
    print("🚀 Starting Spotify Dashboard API Tests")
    print(f"📍 Testing against: {tester.base_url}")
    print("=" * 60)

    # Run tests
    tests = [
        tester.test_root_endpoint,
        tester.test_spotify_login_endpoint, 
        tester.test_info_urls_endpoint,
        tester.test_download_zip_endpoint,
        tester.test_youtube_search_endpoint,
        tester.test_spotify_token_endpoint_without_auth,
        tester.test_protected_endpoints_without_auth
    ]

    for test in tests:
        test()

    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.failures:
        print("\n❌ Failed Tests:")
        for failure in tester.failures:
            error_msg = failure.get('error', f"Expected {failure.get('expected')}, got {failure.get('actual')}")
            print(f"  - {failure['test']}: {error_msg}")
    
    if tester.tests_passed == tester.tests_run:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {len(tester.failures)} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
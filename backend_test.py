import requests
import sys
import json
from datetime import datetime, date

class ChallanAPITester:
    def __init__(self, base_url="https://bilingual-challan.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_challan_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(str(response_data)) < 500:
                        print(f"   Response: {response_data}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"username": "admin", "password": "admin123"}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response.get('user', {})
            print(f"   Logged in as: {self.user_data.get('username')} ({self.user_data.get('role')})")
            return True
        return False

    def test_get_current_user(self):
        """Test getting current user info"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_user_registration(self):
        """Test user registration"""
        test_user = {
            "username": f"test_user_{datetime.now().strftime('%H%M%S')}",
            "email": f"test_{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "TestPass123!",
            "role": "data_entry"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_user
        )
        return success

    def test_translation(self):
        """Test English to Hindi translation"""
        success, response = self.run_test(
            "Translation Service",
            "POST",
            "translate",
            200,
            data={"text": "Rice"}
        )
        if success and 'hindi' in response:
            print(f"   Translation: Rice -> {response['hindi']}")
        return success

    def test_create_challan(self):
        """Test creating a new challan with enhanced features"""
        challan_data = {
            "items": [
                {"name": "Rice", "quantity": 50.0, "unit": "bags"},
                {"name": "Wheat", "quantity": 25.5, "unit": "kgs"}
            ]
        }
        
        success, response = self.run_test(
            "Create Challan",
            "POST",
            "challans",
            200,
            data=challan_data
        )
        
        if success and 'id' in response:
            self.created_challan_id = response['id']
            challan_number = response.get('challan_number', '')
            print(f"   Created challan #{challan_number} with ID: {self.created_challan_id}")
            
            # Test new challan numbering format (YYYY/MM/DD-XXX)
            import re
            if re.match(r'\d{4}/\d{2}/\d{2}-\d{3}', challan_number):
                print(f"   ✅ Challan number format correct: {challan_number}")
            else:
                print(f"   ❌ Challan number format incorrect: {challan_number} (expected YYYY/MM/DD-XXX)")
            
            # Test totals calculation
            if 'totals' in response:
                totals = response['totals']
                expected_bags = 50.0
                expected_kgs = 25.5
                if totals.get('total_bags') == expected_bags and totals.get('total_kgs') == expected_kgs:
                    print(f"   ✅ Totals calculated correctly: {totals}")
                else:
                    print(f"   ❌ Totals calculation error: {totals} (expected bags: {expected_bags}, kgs: {expected_kgs})")
            
            # Test IST timestamp
            if 'created_at' in response:
                created_at = response['created_at']
                print(f"   📅 Created at (IST): {created_at}")
                # Check if timestamp contains timezone info
                if '+05:30' in created_at or 'Asia/Kolkata' in created_at:
                    print(f"   ✅ IST timezone detected in timestamp")
                else:
                    print(f"   ⚠️  Timezone info not clearly visible in timestamp")
            
            if 'items_hindi' in response:
                print(f"   🔤 Hindi translations: {response['items_hindi']}")
                
        return success

    def test_get_challans(self):
        """Test getting all challans"""
        success, response = self.run_test(
            "Get All Challans",
            "GET",
            "challans",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} challans")
        return success

    def test_get_single_challan(self):
        """Test getting a single challan by ID"""
        if not self.created_challan_id:
            print("⚠️  Skipping single challan test - no challan ID available")
            return True
            
        success, response = self.run_test(
            "Get Single Challan",
            "GET",
            f"challans/{self.created_challan_id}",
            200
        )
        return success

    def test_daily_report(self):
        """Test daily report generation"""
        success, response = self.run_test(
            "Daily Report",
            "POST",
            "reports",
            200,
            data={"report_type": "daily"}
        )
        if success:
            print(f"   Report: {response.get('total_challans', 0)} challans found")
            if 'item_totals' in response:
                print(f"   Item totals: {response['item_totals']}")
        return success

    def test_custom_report(self):
        """Test custom date range report"""
        today = date.today()
        success, response = self.run_test(
            "Custom Report",
            "POST",
            "reports",
            200,
            data={
                "report_type": "custom",
                "start_date": today.isoformat(),
                "end_date": today.isoformat()
            }
        )
        return success

    def test_get_users(self):
        """Test getting all users (admin only)"""
        success, response = self.run_test(
            "Get All Users",
            "GET",
            "users",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} users")
        return success

    def test_delete_challan(self):
        """Test deleting a challan (admin/supervisor only)"""
        if not self.created_challan_id:
            print("⚠️  Skipping delete test - no challan ID available")
            return True
            
        success, response = self.run_test(
            "Delete Challan",
            "DELETE",
            f"challans/{self.created_challan_id}",
            200
        )
        return success

    def test_unauthorized_access(self):
        """Test accessing protected routes without token"""
        old_token = self.token
        self.token = None
        
        success, response = self.run_test(
            "Unauthorized Access (should fail)",
            "GET",
            "challans",
            401  # Expecting unauthorized
        )
        
        self.token = old_token
        return success

def main():
    print("🚀 Starting Delivery Challan Generator API Tests")
    print("=" * 60)
    
    tester = ChallanAPITester()
    
    # Test sequence
    tests = [
        ("Admin Login", tester.test_admin_login),
        ("Get Current User", tester.test_get_current_user),
        ("User Registration", tester.test_user_registration),
        ("Translation Service", tester.test_translation),
        ("Create Challan", tester.test_create_challan),
        ("Get All Challans", tester.test_get_challans),
        ("Get Single Challan", tester.test_get_single_challan),
        ("Daily Report", tester.test_daily_report),
        ("Custom Report", tester.test_custom_report),
        ("Get All Users", tester.test_get_users),
        ("Delete Challan", tester.test_delete_challan),
        ("Unauthorized Access", tester.test_unauthorized_access),
    ]
    
    # Run all tests
    for test_name, test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
    
    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
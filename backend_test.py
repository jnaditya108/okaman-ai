#!/usr/bin/env python3
"""
Backend API Testing for Okaman AI Prompt Generation App
Tests non-DB dependent endpoints as database is not configured yet.
"""

import requests
import sys
import json
from datetime import datetime

class OkamanAPITester:
    def __init__(self, base_url="https://ai-prompt-lab-8.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def test_health_endpoint(self):
        """Test /api/health endpoint"""
        try:
            response = requests.get(f"{self.base_url}/api/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "status" in data and data["status"] == "healthy":
                    self.log_test("Health Check Endpoint", True, f"Status: {data}")
                    return True
                else:
                    self.log_test("Health Check Endpoint", False, f"Unexpected response: {data}")
            else:
                self.log_test("Health Check Endpoint", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_test("Health Check Endpoint", False, f"Exception: {str(e)}")
        return False

    def test_root_endpoint(self):
        """Test /api/ root endpoint"""
        try:
            response = requests.get(f"{self.base_url}/api/", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "Okaman API" in data["message"]:
                    self.log_test("Root API Endpoint", True, f"Response: {data}")
                    return True
                else:
                    self.log_test("Root API Endpoint", False, f"Unexpected response: {data}")
            else:
                self.log_test("Root API Endpoint", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_test("Root API Endpoint", False, f"Exception: {str(e)}")
        return False

    def test_pricing_plans_endpoint(self):
        """Test /api/payments/plans endpoint"""
        try:
            response = requests.get(f"{self.base_url}/api/payments/plans", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) == 4:
                    # Check if all plans have required fields
                    required_fields = ["id", "name", "credits", "price", "currency", "duration_months"]
                    all_valid = True
                    
                    for plan in data:
                        for field in required_fields:
                            if field not in plan:
                                all_valid = False
                                break
                    
                    if all_valid:
                        self.log_test("Pricing Plans Endpoint", True, f"Found {len(data)} plans with correct structure")
                        return True
                    else:
                        self.log_test("Pricing Plans Endpoint", False, "Plans missing required fields")
                else:
                    self.log_test("Pricing Plans Endpoint", False, f"Expected 4 plans, got {len(data) if isinstance(data, list) else 'non-list'}")
            else:
                self.log_test("Pricing Plans Endpoint", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_test("Pricing Plans Endpoint", False, f"Exception: {str(e)}")
        return False

    def test_db_dependent_endpoints(self):
        """Test that DB-dependent endpoints return 503 as expected"""
        db_endpoints = [
            "/api/auth/login",
            "/api/auth/register", 
            "/api/chats",
            "/api/credits"
        ]
        
        for endpoint in db_endpoints:
            try:
                if endpoint in ["/api/auth/login", "/api/auth/register"]:
                    # POST endpoints need data
                    response = requests.post(
                        f"{self.base_url}{endpoint}", 
                        json={"email": "test@test.com", "password": "test123"},
                        timeout=10
                    )
                else:
                    # GET endpoints
                    response = requests.get(f"{self.base_url}{endpoint}", timeout=10)
                
                if response.status_code == 503:
                    self.log_test(f"DB Endpoint {endpoint} (503 Expected)", True, "Correctly returns 503 - Database not available")
                elif response.status_code == 401 and endpoint in ["/api/chats", "/api/credits"]:
                    # These might return 401 for unauthorized instead of 503
                    self.log_test(f"DB Endpoint {endpoint} (401 Auth)", True, "Returns 401 - Authentication required")
                else:
                    self.log_test(f"DB Endpoint {endpoint}", False, f"Expected 503, got {response.status_code}")
            except Exception as e:
                self.log_test(f"DB Endpoint {endpoint}", False, f"Exception: {str(e)}")

    def test_cors_headers(self):
        """Test CORS configuration"""
        try:
            response = requests.options(f"{self.base_url}/api/health", timeout=10)
            headers = response.headers
            
            if "Access-Control-Allow-Origin" in headers:
                self.log_test("CORS Headers", True, f"CORS configured: {headers.get('Access-Control-Allow-Origin')}")
            else:
                # Try a GET request to check CORS on actual response
                response = requests.get(f"{self.base_url}/api/health", timeout=10)
                headers = response.headers
                if "Access-Control-Allow-Origin" in headers:
                    self.log_test("CORS Headers", True, f"CORS configured: {headers.get('Access-Control-Allow-Origin')}")
                else:
                    self.log_test("CORS Headers", False, "No CORS headers found")
        except Exception as e:
            self.log_test("CORS Headers", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Okaman Backend API Tests")
        print(f"📍 Testing API at: {self.base_url}")
        print("=" * 60)
        
        # Test non-DB endpoints
        self.test_root_endpoint()
        self.test_health_endpoint()
        self.test_pricing_plans_endpoint()
        
        # Test DB-dependent endpoints (should return 503)
        self.test_db_dependent_endpoints()
        
        # Test CORS
        self.test_cors_headers()
        
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed - see details above")
            return 1

def main():
    tester = OkamanAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())
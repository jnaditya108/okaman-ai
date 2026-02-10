#!/usr/bin/env python3
"""
Backend API Testing for Okaman AI Prompt Generation App
Tests all endpoints including database functionality with Supabase.
"""

import requests
import sys
import json
from datetime import datetime
import uuid

class OkamanAPITester:
    def __init__(self, base_url="https://ai-prompt-lab-8.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.auth_token = None
        self.test_user_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        self.test_password = "TestPass123!"

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

    def test_user_registration(self):
        """Test user registration with 50 free credits"""
        try:
            response = requests.post(
                f"{self.base_url}/api/auth/register",
                json={
                    "email": self.test_user_email,
                    "password": self.test_password
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if ("access_token" in data and "user" in data and 
                    data["user"]["current_credits"] == 50):
                    self.auth_token = data["access_token"]
                    self.log_test("User Registration", True, f"User created with 50 credits, token received")
                    return True
                else:
                    self.log_test("User Registration", False, f"Missing token or credits: {data}")
            else:
                self.log_test("User Registration", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("User Registration", False, f"Exception: {str(e)}")
        return False

    def test_user_login(self):
        """Test user login"""
        try:
            response = requests.post(
                f"{self.base_url}/api/auth/login",
                json={
                    "email": self.test_user_email,
                    "password": self.test_password
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.log_test("User Login", True, f"Login successful, token received")
                    return True
                else:
                    self.log_test("User Login", False, f"Missing token or user data: {data}")
            else:
                self.log_test("User Login", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("User Login", False, f"Exception: {str(e)}")
        return False

    def test_get_user_info(self):
        """Test getting current user info"""
        if not self.auth_token:
            self.log_test("Get User Info", False, "No auth token available")
            return False
            
        try:
            response = requests.get(
                f"{self.base_url}/api/auth/me",
                headers={"Authorization": f"Bearer {self.auth_token}"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "user_id" in data and "email" in data and "current_credits" in data:
                    self.log_test("Get User Info", True, f"User info retrieved: {data['email']}, Credits: {data['current_credits']}")
                    return True
                else:
                    self.log_test("Get User Info", False, f"Missing user fields: {data}")
            else:
                self.log_test("Get User Info", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_test("Get User Info", False, f"Exception: {str(e)}")
        return False

    def test_send_message(self):
        """Test sending a message and credit deduction"""
        if not self.auth_token:
            self.log_test("Send Message", False, "No auth token available")
            return False
            
        try:
            response = requests.post(
                f"{self.base_url}/api/chat/send",
                json={
                    "content": "Generate a prompt for a futuristic city video",
                    "model": "VEO 3"
                },
                headers={"Authorization": f"Bearer {self.auth_token}"},
                timeout=30  # Longer timeout for AI response
            )
            
            if response.status_code == 200:
                data = response.json()
                if ("chat" in data and "remaining_credits" in data and 
                    data["remaining_credits"] < 50):  # Credits should be deducted
                    self.log_test("Send Message", True, f"Message sent, credits deducted to {data['remaining_credits']}")
                    return True
                else:
                    self.log_test("Send Message", False, f"Unexpected response structure: {data}")
            else:
                self.log_test("Send Message", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Send Message", False, f"Exception: {str(e)}")
        return False

    def test_get_chats(self):
        """Test getting chat history"""
        if not self.auth_token:
            self.log_test("Get Chats", False, "No auth token available")
            return False
            
        try:
            response = requests.get(
                f"{self.base_url}/api/chats",
                headers={"Authorization": f"Bearer {self.auth_token}"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Get Chats", True, f"Retrieved {len(data)} chats")
                    return True
                else:
                    self.log_test("Get Chats", False, f"Expected list, got: {type(data)}")
            else:
                self.log_test("Get Chats", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_test("Get Chats", False, f"Exception: {str(e)}")
        return False

    def test_feedback_system(self):
        """Test feedback submission"""
        if not self.auth_token:
            self.log_test("Feedback System", False, "No auth token available")
            return False
            
        # First get chats to find a chat ID
        try:
            chats_response = requests.get(
                f"{self.base_url}/api/chats",
                headers={"Authorization": f"Bearer {self.auth_token}"},
                timeout=10
            )
            
            if chats_response.status_code == 200:
                chats = chats_response.json()
                if len(chats) > 0:
                    chat_id = chats[0]["id"]
                    
                    # Submit positive feedback
                    feedback_response = requests.post(
                        f"{self.base_url}/api/feedback",
                        json={
                            "chat_id": chat_id,
                            "is_positive": True
                        },
                        headers={"Authorization": f"Bearer {self.auth_token}"},
                        timeout=10
                    )
                    
                    if feedback_response.status_code == 200:
                        data = feedback_response.json()
                        if "id" in data and "is_positive" in data:
                            self.log_test("Feedback System", True, f"Feedback submitted successfully")
                            return True
                        else:
                            self.log_test("Feedback System", False, f"Invalid feedback response: {data}")
                    else:
                        self.log_test("Feedback System", False, f"Feedback failed: {feedback_response.status_code}")
                else:
                    self.log_test("Feedback System", False, "No chats available for feedback test")
            else:
                self.log_test("Feedback System", False, f"Could not get chats: {chats_response.status_code}")
        except Exception as e:
            self.log_test("Feedback System", False, f"Exception: {str(e)}")
        return False

    def test_invalid_login(self):
        """Test login with invalid credentials"""
        try:
            response = requests.post(
                f"{self.base_url}/api/auth/login",
                json={
                    "email": "invalid@example.com",
                    "password": "wrongpassword"
                },
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_test("Invalid Login", True, "Correctly rejects invalid credentials")
                return True
            else:
                self.log_test("Invalid Login", False, f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_test("Invalid Login", False, f"Exception: {str(e)}")
        return False

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
        print(f"👤 Test user email: {self.test_user_email}")
        print("=" * 60)
        
        # Test basic endpoints
        self.test_root_endpoint()
        self.test_health_endpoint()
        self.test_pricing_plans_endpoint()
        
        # Test authentication flow
        self.test_user_registration()
        self.test_user_login()
        self.test_get_user_info()
        self.test_invalid_login()
        
        # Test chat functionality
        self.test_send_message()
        self.test_get_chats()
        self.test_feedback_system()
        
        # Test CORS
        self.test_cors_headers()
        
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed >= (self.tests_run * 0.8):  # 80% pass rate
            print("🎉 Most tests passed!")
            return 0
        else:
            print("⚠️  Many tests failed - see details above")
            return 1

def main():
    tester = OkamanAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())
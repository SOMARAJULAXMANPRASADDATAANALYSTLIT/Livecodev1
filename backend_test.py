#!/usr/bin/env python3
"""
Live Code Mentor Backend API Tests
Tests all endpoints: health, analyze-code, generate-teaching, generate-deeper-explanation, 
generate-visual-diagram, evaluate-answer, english-chat, analyze-image
"""

import requests
import sys
import json
import base64
from datetime import datetime
from io import BytesIO
from PIL import Image

class LiveCodeMentorTester:
    def __init__(self, base_url="https://code-glimpse-15.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, timeout=30):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response keys: {list(response_data.keys()) if isinstance(response_data, dict) else 'Non-dict response'}")
                except:
                    print("   Response: Non-JSON or empty")
            else:
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200] if response.text else "Empty response"
                })
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")

            return success, response.json() if success and response.text else {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Timeout after {timeout}s")
            self.failed_tests.append({"test": name, "error": "Timeout"})
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({"test": name, "error": str(e)})
            return False, {}

    def create_test_image(self):
        """Create a simple test image in base64 format"""
        # Create a simple test image with some content
        img = Image.new('RGB', (200, 100), color='white')
        # Add some simple content
        from PIL import ImageDraw, ImageFont
        draw = ImageDraw.Draw(img)
        
        # Draw some basic shapes and text
        draw.rectangle([10, 10, 50, 50], fill='red')
        draw.ellipse([60, 10, 100, 50], fill='blue')
        draw.text((10, 60), "def hello():", fill='black')
        draw.text((10, 80), "  print('Hi')", fill='black')
        
        # Convert to base64
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        return img_base64

    def test_health(self):
        """Test health endpoint"""
        return self.run_test("Health Check", "GET", "health", 200)

    def test_analyze_code(self):
        """Test code analysis endpoint"""
        test_code = """def divide(a, b):
    return a / b

result = divide(10, 0)
print(result)"""
        
        data = {
            "code": test_code,
            "language": "python"
        }
        return self.run_test("Code Analysis", "POST", "analyze-code", 200, data, timeout=45)

    def test_generate_teaching(self):
        """Test teaching generation endpoint"""
        data = {
            "code": "def divide(a, b):\n    return a / b\n\nresult = divide(10, 0)",
            "bug": {
                "line": 4,
                "message": "Division by zero error",
                "severity": "critical"
            },
            "mentorStyle": "patient"
        }
        return self.run_test("Teaching Generation", "POST", "generate-teaching", 200, data, timeout=45)

    def test_generate_deeper_explanation(self):
        """Test deeper explanation endpoint"""
        data = {
            "conceptName": "Division by Zero",
            "currentExplanation": "This error occurs when dividing by zero"
        }
        return self.run_test("Deeper Explanation", "POST", "generate-deeper-explanation", 200, data, timeout=45)

    def test_generate_visual_diagram(self):
        """Test visual diagram generation endpoint"""
        data = {
            "conceptName": "Division by Zero",
            "diagramType": "state_flow",
            "code": "def divide(a, b):\n    return a / b",
            "explanation": "Shows division operation flow"
        }
        return self.run_test("Visual Diagram", "POST", "generate-visual-diagram", 200, data, timeout=45)

    def test_evaluate_answer(self):
        """Test answer evaluation endpoint"""
        data = {
            "question": "What causes a division by zero error?",
            "studentAnswer": "It happens when you try to divide a number by zero, which is mathematically undefined.",
            "correctConcept": "Division by zero is undefined in mathematics"
        }
        return self.run_test("Answer Evaluation", "POST", "evaluate-answer", 200, data, timeout=30)

    def test_english_chat(self):
        """Test English chat endpoint"""
        data = {
            "message": "How do I say 'hello' in a formal way?",
            "conversationHistory": [
                {"role": "user", "content": "Hi there!"},
                {"role": "assistant", "content": "Hello! How can I help you today?"}
            ]
        }
        return self.run_test("English Chat", "POST", "english-chat", 200, data, timeout=45)

    def test_analyze_image(self):
        """Test image analysis endpoint"""
        try:
            image_base64 = self.create_test_image()
            data = {
                "image_data": image_base64,
                "task_type": "code_screenshot",
                "additional_context": "This is a simple Python function"
            }
            return self.run_test("Image Analysis", "POST", "analyze-image", 200, data, timeout=60)
        except Exception as e:
            print(f"❌ Image Analysis Failed - Error creating test image: {str(e)}")
            self.failed_tests.append({"test": "Image Analysis", "error": f"Image creation error: {str(e)}"})
            return False, {}

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Live Code Mentor API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)

        # Test all endpoints
        tests = [
            self.test_health,
            self.test_analyze_code,
            self.test_generate_teaching,
            self.test_generate_deeper_explanation,
            self.test_generate_visual_diagram,
            self.test_evaluate_answer,
            self.test_english_chat,
            self.test_analyze_image
        ]

        for test in tests:
            try:
                test()
            except Exception as e:
                print(f"❌ Test failed with exception: {str(e)}")
                self.failed_tests.append({"test": test.__name__, "error": str(e)})

        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for failure in self.failed_tests:
                print(f"   • {failure.get('test', 'Unknown')}: {failure.get('error', failure.get('response', 'Unknown error'))}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test execution"""
    tester = LiveCodeMentorTester()
    
    # Check if we can reach the base URL
    try:
        response = requests.get(tester.base_url, timeout=10)
        print(f"✅ Base URL reachable: {tester.base_url}")
    except Exception as e:
        print(f"❌ Cannot reach base URL {tester.base_url}: {str(e)}")
        return 1
    
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
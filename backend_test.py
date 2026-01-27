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
import zipfile
import tempfile
import os
from datetime import datetime
from io import BytesIO
from PIL import Image

class LiveCodeMentorTester:
    def __init__(self, base_url="https://githubmentorlab.preview.emergentagent.com"):
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

    def create_test_zip_project(self):
        """Create a test ZIP file with a simple Python project"""
        # Create a temporary directory for the project
        with tempfile.TemporaryDirectory() as temp_dir:
            project_dir = os.path.join(temp_dir, "test_project")
            os.makedirs(project_dir)
            
            # Create main.py
            main_py_content = """def calculate_factorial(n):
    if n < 0:
        return None
    elif n == 0 or n == 1:
        return 1
    else:
        result = 1
        for i in range(2, n + 1):
            result *= i
        return result

def main():
    number = 5
    factorial = calculate_factorial(number)
    print(f"Factorial of {number} is {factorial}")

if __name__ == "__main__":
    main()
"""
            with open(os.path.join(project_dir, "main.py"), "w") as f:
                f.write(main_py_content)
            
            # Create utils.py with a bug
            utils_py_content = """def divide_numbers(a, b):
    # This function has a potential division by zero bug
    return a / b

def get_average(numbers):
    # This function has a bug when numbers list is empty
    total = sum(numbers)
    return total / len(numbers)

def process_data(data_list):
    results = []
    for item in data_list:
        if item > 0:
            results.append(divide_numbers(item, 2))
    return results
"""
            with open(os.path.join(project_dir, "utils.py"), "w") as f:
                f.write(utils_py_content)
            
            # Create README.md
            readme_content = """# Test Project

This is a simple test project for the Live Code Mentor IDE.

## Features
- Factorial calculation
- Utility functions for mathematical operations
- Example of common programming patterns

## Usage
Run `python main.py` to see the factorial calculation in action.
"""
            with open(os.path.join(project_dir, "README.md"), "w") as f:
                f.write(readme_content)
            
            # Create requirements.txt
            requirements_content = """# No external dependencies for this simple project
"""
            with open(os.path.join(project_dir, "requirements.txt"), "w") as f:
                f.write(requirements_content)
            
            # Create ZIP file
            zip_buffer = BytesIO()
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for root, dirs, files in os.walk(project_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arc_name = os.path.relpath(file_path, temp_dir)
                        zip_file.write(file_path, arc_name)
            
            zip_buffer.seek(0)
            return zip_buffer.getvalue()

    def run_test_with_files(self, name, method, endpoint, expected_status, files=None, data=None, timeout=30):
        """Run a test with file upload support"""
        url = f"{self.base_url}/api/{endpoint}"
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'POST' and files:
                response = requests.post(url, files=files, data=data, timeout=timeout)
            elif method == 'GET':
                response = requests.get(url, timeout=timeout)
            elif method == 'POST':
                headers = {'Content-Type': 'application/json'}
                response = requests.post(url, json=data, headers=headers, timeout=timeout)
            else:
                response = requests.request(method, url, json=data, timeout=timeout)

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
        """Test code analysis endpoint with skill levels"""
        test_code = """def calculate_average(numbers):
    total = 0
    for num in numbers:
        total += num
    return total / len(numbers)

result = calculate_average([])
print(result)"""
        
        # Test with different skill levels
        skill_levels = ["beginner", "intermediate", "advanced", "senior"]
        all_passed = True
        
        for skill_level in skill_levels:
            data = {
                "code": test_code,
                "language": "python",
                "skill_level": skill_level
            }
            success, response = self.run_test(f"Code Analysis ({skill_level})", "POST", "analyze-code", 200, data, timeout=45)
            if not success:
                all_passed = False
            elif response:
                # Check if response has expected structure
                if "bugs" in response and "overall_quality" in response:
                    print(f"   ✓ Found {len(response['bugs'])} bugs, quality: {response['overall_quality']}")
                else:
                    print(f"   ⚠️ Missing expected response structure")
        
        return all_passed, {}

    def test_generate_teaching(self):
        """Test teaching generation endpoint with skill levels"""
        test_code = """def calculate_average(numbers):
    total = 0
    for num in numbers:
        total += num
    return total / len(numbers)

result = calculate_average([])
print(result)"""
        
        skill_levels = ["beginner", "intermediate", "advanced", "senior"]
        all_passed = True
        
        for skill_level in skill_levels:
            data = {
                "code": test_code,
                "bug": {
                    "line": 7,
                    "message": "Division by zero error - empty list",
                    "severity": "critical"
                },
                "mentorStyle": "patient",
                "skill_level": skill_level
            }
            success, response = self.run_test(f"Teaching Generation ({skill_level})", "POST", "generate-teaching", 200, data, timeout=45)
            if not success:
                all_passed = False
            elif response:
                # Check if response has expected structure
                expected_keys = ["conceptName", "naturalExplanation", "whyItMatters", "commonMistake"]
                if all(key in response for key in expected_keys):
                    print(f"   ✓ Teaching concept: {response.get('conceptName', 'N/A')}")
                else:
                    print(f"   ⚠️ Missing expected response keys")
        
        return all_passed, {}

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

    def test_line_mentoring(self):
        """Test line-level mentoring endpoint"""
        test_code = """def calculate_average(numbers):
    total = 0
    for num in numbers:
        total += num
    return total / len(numbers)

result = calculate_average([])
print(result)"""
        
        skill_levels = ["beginner", "intermediate", "advanced", "senior"]
        all_passed = True
        
        for skill_level in skill_levels:
            data = {
                "code": test_code,
                "language": "python",
                "selected_lines": [5, 7],  # Focus on the division and function call
                "full_context": "Learning about division by zero errors",
                "skill_level": skill_level,
                "question": "Why does this code fail?"
            }
            success, response = self.run_test(f"Line Mentoring ({skill_level})", "POST", "line-mentoring", 200, data, timeout=45)
            if not success:
                all_passed = False
            elif response:
                expected_keys = ["explanation", "what_it_does", "potential_issues", "improvement_suggestions", "teaching_points"]
                if all(key in response for key in expected_keys):
                    print(f"   ✓ Issues found: {len(response.get('potential_issues', []))}")
                else:
                    print(f"   ⚠️ Missing expected response keys")
        
        return all_passed, {}

    def test_code_execution(self):
        """Test code execution endpoint"""
        # Test Python execution
        python_code = """def greet(name):
    return f"Hello, {name}!"

print(greet("World"))"""
        
        # Test JavaScript execution  
        js_code = """function greet(name) {
    return `Hello, ${name}!`;
}

console.log(greet("World"));"""
        
        # Test Python with error
        python_error_code = """def calculate_average(numbers):
    total = 0
    for num in numbers:
        total += num
    return total / len(numbers)

result = calculate_average([])
print(result)"""
        
        test_cases = [
            ("Python Success", python_code, "python", "beginner"),
            ("JavaScript Success", js_code, "javascript", "intermediate"), 
            ("Python Error", python_error_code, "python", "advanced")
        ]
        
        all_passed = True
        
        for test_name, code, language, skill_level in test_cases:
            data = {
                "code": code,
                "language": language,
                "skill_level": skill_level
            }
            success, response = self.run_test(f"Code Execution - {test_name}", "POST", "execute-code", 200, data, timeout=45)
            if not success:
                all_passed = False
            elif response:
                expected_keys = ["output", "execution_time"]
                if all(key in response for key in expected_keys):
                    if response.get("error"):
                        print(f"   ✓ Error detected with explanation: {bool(response.get('error_explanation'))}")
                    else:
                        print(f"   ✓ Execution time: {response.get('execution_time', 0):.3f}s")
                else:
                    print(f"   ⚠️ Missing expected response keys")
        
        return all_passed, {}

    def test_proactive_mentor(self):
        """Test proactive mentor endpoint"""
        # Test code with common issues
        test_codes = [
            ("Async Issue", "async function getData() { return fetch('/api/data'); }", "javascript"),
            ("Division by Zero", "def calc(x): return 10/x\nresult = calc(0)", "python"),
            ("Clean Code", "def add(a, b): return a + b", "python")
        ]
        
        skill_levels = ["beginner", "intermediate", "advanced", "senior"]
        all_passed = True
        
        for code_name, code, language in test_codes:
            for skill_level in skill_levels:
                data = {
                    "code": code,
                    "language": language,
                    "skill_level": skill_level,
                    "cursor_position": 10
                }
                success, response = self.run_test(f"Proactive Mentor - {code_name} ({skill_level})", "POST", "proactive-mentor", 200, data, timeout=30)
                if not success:
                    all_passed = False
                elif response:
                    expected_keys = ["has_issue", "severity"]
                    if all(key in response for key in expected_keys):
                        if response.get("has_issue"):
                            print(f"   ✓ Issue detected: {response.get('issue_type', 'N/A')} ({response.get('severity', 'N/A')})")
                        else:
                            print(f"   ✓ No issues detected")
                    else:
                        print(f"   ⚠️ Missing expected response keys")
        
        return all_passed, {}

    def test_fix_code(self):
        """Test AI code fixing endpoint"""
        test_code = """def calculate_average(numbers):
    total = 0
    for num in numbers:
        total += num
    return total / len(numbers)

result = calculate_average([])
print(result)"""
        
        skill_levels = ["beginner", "intermediate", "advanced", "senior"]
        all_passed = True
        
        for skill_level in skill_levels:
            for apply_comments in [False, True]:
                data = {
                    "code": test_code,
                    "language": "python",
                    "bugs": [
                        {"line": 5, "message": "Division by zero when empty list", "severity": "critical"}
                    ],
                    "skill_level": skill_level,
                    "apply_inline_comments": apply_comments
                }
                test_name = f"Fix Code ({skill_level})" + (" with comments" if apply_comments else "")
                success, response = self.run_test(test_name, "POST", "fix-code", 200, data, timeout=45)
                if not success:
                    all_passed = False
                elif response:
                    expected_keys = ["fixed_code", "explanation", "changes_made"]
                    if all(key in response for key in expected_keys):
                        print(f"   ✓ Changes made: {len(response.get('changes_made', []))}")
                        if apply_comments and "# " in response.get('fixed_code', ''):
                            print(f"   ✓ Inline comments added")
                    else:
                        print(f"   ⚠️ Missing expected response keys")
        
        return all_passed, {}

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Live Code Mentor API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)

        # Test all endpoints - prioritizing high-priority enhanced features
        tests = [
            self.test_health,
            # High priority enhanced features
            self.test_analyze_code,
            self.test_line_mentoring,
            self.test_code_execution,
            self.test_proactive_mentor,
            self.test_generate_teaching,
            self.test_fix_code,
            # Other existing features
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
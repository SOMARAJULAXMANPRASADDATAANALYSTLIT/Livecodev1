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
    def __init__(self, base_url="https://mentorbot-6.preview.emergentagent.com"):
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
    def test_project_upload(self):
        """Test project upload endpoint"""
        try:
            zip_data = self.create_test_zip_project()
            files = {'file': ('test_project.zip', zip_data, 'application/zip')}
            
            success, response = self.run_test_with_files("Project Upload", "POST", "upload-project", 200, files=files, timeout=60)
            
            if success and response:
                # Store project_id for subsequent tests
                self.project_id = response.get('project_id')
                expected_keys = ["project_id", "name", "root", "languages", "total_files", "frameworks"]
                if all(key in response for key in expected_keys):
                    print(f"   ✓ Project uploaded: {response.get('name', 'N/A')}")
                    print(f"   ✓ Total files: {response.get('total_files', 0)}")
                    print(f"   ✓ Languages detected: {len(response.get('languages', []))}")
                    print(f"   ✓ Frameworks: {response.get('frameworks', [])}")
                    return True, response
                else:
                    print(f"   ⚠️ Missing expected response keys")
            
            return success, response
            
        except Exception as e:
            print(f"❌ Project Upload Failed - Error: {str(e)}")
            self.failed_tests.append({"test": "Project Upload", "error": str(e)})
            return False, {}

    def test_project_file_access(self):
        """Test getting file content from uploaded project"""
        if not hasattr(self, 'project_id') or not self.project_id:
            print("❌ Skipping file access test - no project_id available")
            return False, {}
        
        # Test getting main.py content (files are in root, not subdirectory)
        url = f"project/{self.project_id}/file?path=main.py"
        success, response = self.run_test("Get File Content (main.py)", "GET", url, 200, timeout=30)
        
        if success and response:
            expected_keys = ["path", "content", "language"]
            if all(key in response for key in expected_keys):
                print(f"   ✓ File language: {response.get('language', 'N/A')}")
                print(f"   ✓ Content length: {len(response.get('content', ''))}")
                if "calculate_factorial" in response.get('content', ''):
                    print(f"   ✓ Content verification passed")
                return True, response
            else:
                print(f"   ⚠️ Missing expected response keys")
        
        return success, response

    def test_project_run(self):
        """Test running a file from uploaded project"""
        if not hasattr(self, 'project_id') or not self.project_id:
            print("❌ Skipping project run test - no project_id available")
            return False, {}
        
        data = {
            "project_id": self.project_id,
            "file_path": "main.py",  # Files are in root, not subdirectory
            "skill_level": "intermediate"
        }
        
        url = f"project/{self.project_id}/run"
        success, response = self.run_test("Run Project File", "POST", url, 200, data, timeout=45)
        
        if success and response:
            expected_keys = ["output", "exit_code", "execution_time"]
            if all(key in response for key in expected_keys):
                print(f"   ✓ Exit code: {response.get('exit_code', 'N/A')}")
                print(f"   ✓ Execution time: {response.get('execution_time', 0):.3f}s")
                if response.get('output'):
                    print(f"   ✓ Output received: {len(response.get('output', ''))}")
                if response.get('error'):
                    print(f"   ⚠️ Error occurred: {response.get('error', '')[:100]}")
                return True, response
            else:
                print(f"   ⚠️ Missing expected response keys")
        
        return success, response

    def test_project_full_analysis(self):
        """Test full project analysis"""
        if not hasattr(self, 'project_id') or not self.project_id:
            print("❌ Skipping project analysis test - no project_id available")
            return False, {}
        
        data = {
            "project_id": self.project_id,
            "skill_level": "intermediate"
        }
        
        url = f"project/{self.project_id}/analyze-full"
        success, response = self.run_test("Full Project Analysis", "POST", url, 200, data, timeout=90)
        
        if success and response:
            expected_keys = ["project_name", "purpose", "architecture_overview", "entry_points", "main_modules"]
            if all(key in response for key in expected_keys):
                print(f"   ✓ Project name: {response.get('project_name', 'N/A')}")
                print(f"   ✓ Entry points: {len(response.get('entry_points', []))}")
                print(f"   ✓ Main modules: {len(response.get('main_modules', []))}")
                print(f"   ✓ Dependencies: {len(response.get('dependencies', []))}")
                print(f"   ✓ Frameworks: {response.get('frameworks', [])}")
                return True, response
            else:
                print(f"   ⚠️ Missing expected response keys")
        
        return success, response

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

    def test_agent_visual_generation(self):
        """Test visual generation for agents"""
        # Test with form data as specified in the endpoint
        url = f"{self.base_url}/api/agent/generate-visual"
        
        self.tests_run += 1
        print(f"\n🔍 Testing Agent Visual Generation...")
        print(f"   URL: {url}")
        
        try:
            # Use form data as the endpoint expects
            form_data = {
                'agent_type': 'coding',
                'topic': 'REST API',
                'visual_type': 'diagram'
            }
            
            response = requests.post(url, data=form_data, timeout=60)
            
            success = response.status_code == 200
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if 'image_url' in response_data or 'svg' in response_data or 'diagram' in response_data:
                        print(f"   ✓ Visual content generated successfully")
                    else:
                        print(f"   Response keys: {list(response_data.keys()) if isinstance(response_data, dict) else 'Non-dict response'}")
                except:
                    print("   Response: Non-JSON or empty")
            else:
                self.failed_tests.append({
                    "test": "Agent Visual Generation",
                    "expected": 200,
                    "actual": response.status_code,
                    "response": response.text[:200] if response.text else "Empty response"
                })
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")

            return success, response.json() if success and response.text else {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Timeout after 60s")
            self.failed_tests.append({"test": "Agent Visual Generation", "error": "Timeout"})
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({"test": "Agent Visual Generation", "error": str(e)})
            return False, {}

    def test_news_feed(self):
        """Test news feed endpoint"""
        success, response = self.run_test("News Feed", "GET", "news/feed", 200, timeout=30)
        
        if success and response:
            # Check if response has articles with real URLs
            if 'articles' in response:
                articles = response['articles']
                print(f"   ✓ Found {len(articles)} articles")
                
                # Check for real-looking URLs
                real_urls_found = 0
                for article in articles[:3]:  # Check first 3 articles
                    url = article.get('url', '')
                    if any(domain in url for domain in ['cnn.com', 'bbc.com', 'reuters.com', 'techcrunch.com', 'bloomberg.com', 'wsj.com']):
                        real_urls_found += 1
                        print(f"   ✓ Real news URL found: {url[:50]}...")
                
                if real_urls_found > 0:
                    print(f"   ✓ {real_urls_found} articles with real news URLs")
                else:
                    print(f"   ⚠️ No real news URLs detected in sample")
            else:
                print(f"   ⚠️ No 'articles' key in response")
        
        return success, response

    def test_company_analysis(self):
        """Test company analysis (Business Agent)"""
        data = {
            "company_url": "https://openai.com",
            "analysis_type": "full"
        }
        
        success, response = self.run_test("Company Analysis", "POST", "agent/business/analyze", 200, data, timeout=120)
        
        if success and response:
            # Check for 8-sheet output structure
            expected_keys = ["company_name", "sheets"]
            if all(key in response for key in expected_keys):
                sheets = response.get('sheets', {})
                print(f"   ✓ Company: {response.get('company_name', 'N/A')}")
                print(f"   ✓ Analysis sheets: {len(sheets)}")
                
                # Check for expected sheet types
                expected_sheets = ['overview', 'products', 'competitors', 'financials', 'team', 'strategy', 'risks', 'opportunities']
                found_sheets = list(sheets.keys())
                print(f"   ✓ Sheet types found: {found_sheets}")
                
                if len(sheets) >= 6:  # At least 6 sheets for comprehensive analysis
                    print(f"   ✓ Comprehensive analysis with {len(sheets)} sheets")
                else:
                    print(f"   ⚠️ Limited analysis - only {len(sheets)} sheets")
            else:
                print(f"   ⚠️ Missing expected response structure")
        
        return success, response

    def test_html_report_generation(self):
        """Test HTML report generation endpoint"""
        # Sample company data and sheets for HTML report generation
        data = {
            "company_name": "OpenAI",
            "sheets": {
                "1_Company_Overview": {
                    "title": "Company Overview",
                    "content": "OpenAI is an AI research and deployment company focused on developing artificial general intelligence (AGI) that benefits all of humanity."
                },
                "2_Products_Services": {
                    "title": "Products & Services", 
                    "content": "Main products include GPT models, ChatGPT, DALL-E, and API services for developers."
                },
                "3_Market_Analysis": {
                    "title": "Market Analysis",
                    "content": "Leading position in the generative AI market with significant competitive advantages."
                }
            }
        }
        
        success, response = self.run_test("HTML Report Generation", "POST", "agent/html-report", 200, data, timeout=60)
        
        if success and response:
            # Check if HTML content is generated
            if 'html_report' in response:
                html_content = response['html_report']
                print(f"   ✓ HTML report generated: {len(html_content)} characters")
                
                # Basic HTML validation
                if '<html>' in html_content and '</html>' in html_content:
                    print(f"   ✓ Valid HTML structure detected")
                else:
                    print(f"   ⚠️ HTML structure may be incomplete")
                
                # Check for company name in HTML
                if 'OpenAI' in html_content:
                    print(f"   ✓ Company name found in HTML report")
                else:
                    print(f"   ⚠️ Company name not found in HTML report")
            else:
                print(f"   ⚠️ No 'html_report' key in response")
                print(f"   Response keys: {list(response.keys()) if isinstance(response, dict) else 'Non-dict response'}")
        
        return success, response

    # ============== NEW MOLTBOT INTEGRATION TESTS ==============
    
    def test_video_transcript(self):
        """Test YouTube video transcript fetching API"""
        # Test with a known YouTube video ID
        test_video_ids = [
            "dQw4w9WgXcQ",  # Rick Astley - Never Gonna Give You Up (commonly used for testing)
            "jNQXAC9IVRw"   # Another test video
        ]
        
        all_passed = True
        
        for video_id in test_video_ids:
            data = {
                "video_id": video_id,
                "language": "en"
            }
            
            success, response = self.run_test(f"Video Transcript ({video_id})", "POST", "learning/video/transcript", 200, data, timeout=60)
            
            if not success:
                all_passed = False
            elif response:
                # Check expected response structure
                expected_keys = ["success", "video_id", "transcript", "full_text", "total_segments", "available"]
                if all(key in response for key in expected_keys):
                    if response.get("available"):
                        print(f"   ✓ Transcript available: {response.get('total_segments', 0)} segments")
                        print(f"   ✓ Full text length: {len(response.get('full_text', ''))}")
                        
                        # Check transcript structure
                        transcript = response.get('transcript', [])
                        if transcript and len(transcript) > 0:
                            first_segment = transcript[0]
                            if all(key in first_segment for key in ['start', 'duration', 'text']):
                                print(f"   ✓ Transcript segments have proper timestamps")
                            else:
                                print(f"   ⚠️ Transcript segments missing required fields")
                    else:
                        print(f"   ⚠️ Transcript not available for this video (this is OK)")
                else:
                    print(f"   ⚠️ Missing expected response keys")
                    all_passed = False
        
        return all_passed, {}

    def test_video_contextual_help(self):
        """Test contextual video help API"""
        help_types = ["explain", "clarify", "example", "deeper"]
        skill_levels = ["beginner", "intermediate", "advanced", "senior"]
        
        all_passed = True
        
        # Test different combinations
        test_cases = [
            ("beginner", "explain"),
            ("intermediate", "example"),
            ("advanced", "deeper"),
            ("senior", "clarify")
        ]
        
        for skill_level, help_type in test_cases:
            data = {
                "video_id": "dQw4w9WgXcQ",
                "video_title": "Introduction to Programming Concepts",
                "current_time": 120.5,
                "transcript_segment": "In this section, we'll learn about variables and data types",
                "skill_level": skill_level,
                "help_type": help_type
            }
            
            success, response = self.run_test(f"Video Contextual Help ({skill_level}, {help_type})", "POST", "learning/video/contextual-help", 200, data, timeout=60)
            
            if not success:
                all_passed = False
            elif response:
                expected_keys = ["help", "timestamp", "video_id", "help_type"]
                if all(key in response for key in expected_keys):
                    help_content = response.get('help', '')
                    if len(help_content) > 50:  # Reasonable response length
                        print(f"   ✓ Structured markdown response received ({len(help_content)} chars)")
                        
                        # Check for markdown formatting
                        if any(marker in help_content for marker in ['##', '**', '###', '🎯', '📖']):
                            print(f"   ✓ Markdown formatting detected")
                        else:
                            print(f"   ⚠️ No markdown formatting detected")
                    else:
                        print(f"   ⚠️ Response too short")
                        all_passed = False
                else:
                    print(f"   ⚠️ Missing expected response keys")
                    all_passed = False
        
        return all_passed, {}

    def test_video_proactive_analysis(self):
        """Test proactive video analysis API"""
        # Test normal and rewind scenarios
        test_scenarios = [
            {
                "name": "Normal Playback",
                "current_time": 300.0,
                "last_pause_time": 250.0,
                "watch_duration": 320.0
            },
            {
                "name": "Rewound Video (Confusion Signal)",
                "current_time": 200.0,
                "last_pause_time": 280.0,  # User rewound from 280s to 200s
                "watch_duration": 400.0
            },
            {
                "name": "Frequent Pausing",
                "current_time": 150.0,
                "last_pause_time": 140.0,
                "watch_duration": 300.0  # Much longer than current_time
            }
        ]
        
        all_passed = True
        
        for scenario in test_scenarios:
            data = {
                "video_id": "dQw4w9WgXcQ",
                "video_title": "Advanced JavaScript Concepts",
                "current_time": scenario["current_time"],
                "last_pause_time": scenario["last_pause_time"],
                "watch_duration": scenario["watch_duration"],
                "skill_level": "intermediate",
                "transcript_context": "Now we're going to discuss closures and their practical applications in modern JavaScript development"
            }
            
            success, response = self.run_test(f"Proactive Analysis - {scenario['name']}", "POST", "learning/video/proactive-analysis", 200, data, timeout=45)
            
            if not success:
                all_passed = False
            elif response:
                expected_keys = ["should_intervene", "reason", "proactive_message", "severity"]
                if all(key in response for key in expected_keys):
                    should_intervene = response.get('should_intervene')
                    severity = response.get('severity')
                    
                    print(f"   ✓ Should intervene: {should_intervene}")
                    print(f"   ✓ Severity: {severity}")
                    
                    # Check if rewind scenario correctly detects confusion
                    if scenario["name"] == "Rewound Video (Confusion Signal)" and should_intervene:
                        print(f"   ✓ Correctly detected rewind pattern")
                    
                    # Validate severity levels
                    if severity in ["low", "medium", "high"]:
                        print(f"   ✓ Valid severity level")
                    else:
                        print(f"   ⚠️ Invalid severity level: {severity}")
                        all_passed = False
                else:
                    print(f"   ⚠️ Missing expected response keys")
                    all_passed = False
        
        return all_passed, {}

    def test_video_comprehension_check(self):
        """Test video comprehension check API"""
        test_topics = [
            "JavaScript Closures and Scope",
            "Python List Comprehensions", 
            "React Component Lifecycle",
            "Database Normalization"
        ]
        
        skill_levels = ["beginner", "intermediate", "advanced", "senior"]
        all_passed = True
        
        for i, topic in enumerate(test_topics):
            skill_level = skill_levels[i % len(skill_levels)]
            
            data = {
                "video_id": "dQw4w9WgXcQ",
                "video_title": f"Learning {topic}",
                "topic_covered": topic,
                "skill_level": skill_level
            }
            
            success, response = self.run_test(f"Comprehension Check - {topic} ({skill_level})", "POST", "learning/video/comprehension-check", 200, data, timeout=45)
            
            if not success:
                all_passed = False
            elif response:
                expected_keys = ["question", "options", "correct_answer", "explanation"]
                if all(key in response for key in expected_keys):
                    options = response.get('options', {})
                    correct_answer = response.get('correct_answer')
                    
                    # Validate options structure (A, B, C, D)
                    if all(key in options for key in ['A', 'B', 'C', 'D']):
                        print(f"   ✓ All 4 options (A/B/C/D) present")
                    else:
                        print(f"   ⚠️ Missing option keys: {list(options.keys())}")
                        all_passed = False
                    
                    # Validate correct answer
                    if correct_answer in ['A', 'B', 'C', 'D']:
                        print(f"   ✓ Valid correct answer: {correct_answer}")
                    else:
                        print(f"   ⚠️ Invalid correct answer: {correct_answer}")
                        all_passed = False
                    
                    # Check question relevance
                    question = response.get('question', '')
                    if len(question) > 20 and any(word in question.lower() for word in topic.lower().split()):
                        print(f"   ✓ Question relevant to topic")
                    else:
                        print(f"   ⚠️ Question may not be relevant to topic")
                else:
                    print(f"   ⚠️ Missing expected response keys")
                    all_passed = False
        
        return all_passed, {}

    def test_moltbot_chat(self):
        """Test Moltbot multi-agent chat API"""
        # Test different agent modes and thinking modes
        agent_modes = ["general", "research", "coding", "creative", "learning", "business"]
        thinking_modes = ["normal", "extended", "senior_engineer"]
        
        all_passed = True
        
        # Test each agent mode
        for agent_mode in agent_modes:
            data = {
                "message": f"Help me understand the best practices for {agent_mode} work",
                "agent_mode": agent_mode,
                "conversation_history": [
                    {"role": "user", "content": "Hello, I need some guidance"},
                    {"role": "assistant", "content": f"I'm the {agent_mode} agent, happy to help!"}
                ],
                "session_id": f"test_session_{agent_mode}",
                "thinking_mode": "normal",
                "skill_level": "intermediate"
            }
            
            success, response = self.run_test(f"Moltbot Chat - {agent_mode.title()} Agent", "POST", "moltbot/chat", 200, data, timeout=60)
            
            if not success:
                all_passed = False
            elif response:
                expected_keys = ["response", "agent_mode", "agent_config", "thinking_mode", "session_id"]
                if all(key in response for key in expected_keys):
                    agent_response = response.get('response', '')
                    agent_config = response.get('agent_config', {})
                    
                    if len(agent_response) > 50:
                        print(f"   ✓ Agent response received ({len(agent_response)} chars)")
                    else:
                        print(f"   ⚠️ Response too short")
                        all_passed = False
                    
                    # Check agent config
                    if 'role' in agent_config and 'capabilities' in agent_config:
                        print(f"   ✓ Agent config: {agent_config.get('role', 'N/A')}")
                    else:
                        print(f"   ⚠️ Missing agent config details")
                        all_passed = False
                else:
                    print(f"   ⚠️ Missing expected response keys")
                    all_passed = False
        
        # Test senior engineer thinking mode specifically
        data = {
            "message": "How should I architect a scalable microservices system?",
            "agent_mode": "coding",
            "conversation_history": [],
            "session_id": "test_session_senior",
            "thinking_mode": "senior_engineer",
            "skill_level": "senior"
        }
        
        success, response = self.run_test("Moltbot Chat - Senior Engineer Mode", "POST", "moltbot/chat", 200, data, timeout=90)
        
        if success and response:
            agent_response = response.get('response', '')
            
            # Check for senior engineer thinking patterns
            senior_indicators = ['trade-off', 'scalability', 'architecture', 'production', 'reasoning', 'consider']
            found_indicators = sum(1 for indicator in senior_indicators if indicator.lower() in agent_response.lower())
            
            if found_indicators >= 2:
                print(f"   ✓ Senior engineer reasoning detected ({found_indicators} indicators)")
            else:
                print(f"   ⚠️ Limited senior engineer reasoning ({found_indicators} indicators)")
                all_passed = False
        else:
            all_passed = False
        
        return all_passed, {}

    def test_moltbot_status(self):
        """Test Moltbot status/health API"""
        success, response = self.run_test("Moltbot Status", "GET", "moltbot/status", 200, timeout=30)
        
        if success and response:
            expected_keys = ["gateway", "version", "features", "agents", "timestamp"]
            if all(key in response for key in expected_keys):
                gateway_status = response.get('gateway')
                version = response.get('version')
                features = response.get('features', {})
                agents = response.get('agents', [])
                
                print(f"   ✓ Gateway status: {gateway_status}")
                print(f"   ✓ Version: {version}")
                print(f"   ✓ Features: {len(features)} feature flags")
                print(f"   ✓ Agents: {len(agents)} agents available")
                
                # Check feature flags
                expected_features = ["multi_agent", "senior_thinking", "video_mentoring", "real_time_help", "transcript_analysis"]
                for feature in expected_features:
                    if feature in features:
                        print(f"   ✓ Feature {feature}: {features[feature]}")
                    else:
                        print(f"   ⚠️ Missing feature flag: {feature}")
                
                # Check agents
                expected_agent_count = 6
                if len(agents) == expected_agent_count:
                    print(f"   ✓ All {expected_agent_count} agents present")
                    
                    # Check agent status
                    ready_agents = sum(1 for agent in agents if agent.get('status') == 'ready')
                    if ready_agents == expected_agent_count:
                        print(f"   ✓ All agents ready")
                    else:
                        print(f"   ⚠️ Only {ready_agents}/{expected_agent_count} agents ready")
                else:
                    print(f"   ⚠️ Expected {expected_agent_count} agents, found {len(agents)}")
            else:
                print(f"   ⚠️ Missing expected response keys")
        
        return success, response

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Live Code Mentor API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)

        # Test all endpoints - prioritizing NEW MOLTBOT INTEGRATION features
        tests = [
            self.test_health,
            # NEW MOLTBOT INTEGRATION - HIGHEST PRIORITY
            self.test_video_transcript,
            self.test_video_contextual_help,
            self.test_video_proactive_analysis,
            self.test_video_comprehension_check,
            self.test_moltbot_chat,
            self.test_moltbot_status,
            # Review Request Features - HIGH PRIORITY
            self.test_project_upload,
            self.test_project_full_analysis,
            self.test_agent_visual_generation,
            self.test_news_feed,
            self.test_company_analysis,
            # Other Project/IDE functionality
            self.test_project_file_access,
            self.test_project_run,
            # High priority enhanced features (Code Tab functionality)
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
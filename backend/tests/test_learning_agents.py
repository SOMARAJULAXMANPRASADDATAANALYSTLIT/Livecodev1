"""
Test suite for Live Code Mentor - Learning Path and Multi-Industry Agents APIs
Tests: Learning Path onboarding, mentor, topic completion, and all agent APIs
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        print(f"✓ Health check passed: {data}")


class TestAgentsAPI:
    """Multi-Industry Agents API tests"""
    
    def test_list_agents(self):
        """Test /api/agents returns all 4 agents"""
        response = requests.get(f"{BASE_URL}/api/agents")
        assert response.status_code == 200
        data = response.json()
        assert "agents" in data
        assert len(data["agents"]) == 4
        
        agent_ids = [a["id"] for a in data["agents"]]
        assert "coding" in agent_ids
        assert "health" in agent_ids
        assert "travel" in agent_ids
        assert "business" in agent_ids
        print(f"✓ Agents list: {agent_ids}")
    
    def test_agent_chat_coding(self):
        """Test /api/agent/chat with coding agent"""
        response = requests.post(
            f"{BASE_URL}/api/agent/chat",
            json={
                "agent_type": "coding",
                "message": "What is a variable in Python?",
                "conversation_history": []
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert data["agent_type"] == "coding"
        assert data["agent_name"] == "Coding Mentor Agent"
        assert len(data["response"]) > 10  # Should have meaningful response
        print(f"✓ Coding agent chat response length: {len(data['response'])}")
    
    def test_agent_chat_health(self):
        """Test /api/agent/chat with health agent"""
        response = requests.post(
            f"{BASE_URL}/api/agent/chat",
            json={
                "agent_type": "health",
                "message": "What is blood pressure?",
                "conversation_history": []
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert data["agent_type"] == "health"
        assert data["agent_name"] == "Health & Medical Agent"
        assert "suggestions" in data
        print(f"✓ Health agent chat response length: {len(data['response'])}")
    
    def test_agent_chat_travel(self):
        """Test /api/agent/chat with travel agent"""
        response = requests.post(
            f"{BASE_URL}/api/agent/chat",
            json={
                "agent_type": "travel",
                "message": "Tell me about Paris",
                "conversation_history": []
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert data["agent_type"] == "travel"
        assert data["agent_name"] == "Travel & Tourism Agent"
        print(f"✓ Travel agent chat response length: {len(data['response'])}")
    
    def test_agent_chat_business(self):
        """Test /api/agent/chat with business agent"""
        response = requests.post(
            f"{BASE_URL}/api/agent/chat",
            json={
                "agent_type": "business",
                "message": "What is market analysis?",
                "conversation_history": []
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert data["agent_type"] == "business"
        assert data["agent_name"] == "Business Intelligence Agent"
        print(f"✓ Business agent chat response length: {len(data['response'])}")
    
    def test_agent_chat_invalid_type(self):
        """Test /api/agent/chat with invalid agent type"""
        response = requests.post(
            f"{BASE_URL}/api/agent/chat",
            json={
                "agent_type": "invalid_agent",
                "message": "Hello",
                "conversation_history": []
            }
        )
        assert response.status_code == 400
        print("✓ Invalid agent type correctly rejected")


class TestHealthAgentSpecialized:
    """Health Agent specialized API tests"""
    
    def test_health_explain_simple(self):
        """Test /api/agent/health/explain with simple detail level"""
        response = requests.post(
            f"{BASE_URL}/api/agent/health/explain",
            json={
                "topic": "diabetes",
                "detail_level": "simple"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "title" in data or "explanation" in data
        print(f"✓ Health explain (simple) returned data with keys: {list(data.keys())}")
    
    def test_health_explain_intermediate(self):
        """Test /api/agent/health/explain with intermediate detail level"""
        response = requests.post(
            f"{BASE_URL}/api/agent/health/explain",
            json={
                "topic": "high blood pressure",
                "detail_level": "intermediate"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "explanation" in data or "title" in data
        # Check for disclaimer (important for health info)
        if "disclaimer" in data:
            assert len(data["disclaimer"]) > 0
        print(f"✓ Health explain (intermediate) returned data")


class TestTravelAgentSpecialized:
    """Travel Agent specialized API tests"""
    
    def test_travel_plan_basic(self):
        """Test /api/agent/travel/plan with basic parameters"""
        response = requests.post(
            f"{BASE_URL}/api/agent/travel/plan",
            json={
                "destination": "Tokyo",
                "duration_days": 3,
                "interests": ["food", "culture"],
                "budget_level": "moderate"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "destination" in data
        assert "duration" in data or "itinerary" in data
        print(f"✓ Travel plan returned data with keys: {list(data.keys())}")
    
    def test_travel_plan_luxury(self):
        """Test /api/agent/travel/plan with luxury budget"""
        response = requests.post(
            f"{BASE_URL}/api/agent/travel/plan",
            json={
                "destination": "Paris",
                "duration_days": 5,
                "interests": ["art", "fine dining"],
                "budget_level": "luxury"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "destination" in data
        print(f"✓ Travel plan (luxury) returned data")


class TestBusinessAgentSpecialized:
    """Business Agent specialized API tests"""
    
    def test_business_analyze(self):
        """Test /api/agent/business/analyze"""
        response = requests.post(
            f"{BASE_URL}/api/agent/business/analyze",
            json={
                "company_url": "https://stripe.com",
                "analysis_type": "full"
            },
            timeout=60  # Business analysis may take longer
        )
        assert response.status_code == 200
        data = response.json()
        assert "company_name" in data
        assert "sheets" in data
        print(f"✓ Business analyze returned company: {data.get('company_name', 'Unknown')}")


class TestLearningPathOnboard:
    """Learning Path onboarding API tests"""
    
    def test_onboard_software_engineer(self):
        """Test /api/learning/onboard for software engineering path"""
        response = requests.post(
            f"{BASE_URL}/api/learning/onboard",
            json={
                "targetRole": "AI Engineer",
                "industry": "software",
                "background": "I have basic Python knowledge and want to learn AI/ML",
                "hoursPerWeek": 15,
                "learningSpeed": "normal",
                "preferredStyle": "practical",
                "targetMonths": 12
            },
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify profile
        assert "profile" in data
        assert "id" in data["profile"]
        assert data["profile"]["targetRole"] == "AI Engineer"
        
        # Verify skill tree
        assert "skill_tree" in data
        assert "nodes" in data["skill_tree"]
        assert len(data["skill_tree"]["nodes"]) > 0
        
        # Verify weekly plan
        assert "weekly_plan" in data
        
        # Verify progress
        assert "progress" in data
        assert "completed" in data["progress"]
        assert "total" in data["progress"]
        
        print(f"✓ Learning onboard created profile: {data['profile']['id']}")
        print(f"  - Skill tree nodes: {len(data['skill_tree']['nodes'])}")
        print(f"  - Total topics: {data['progress']['total']}")
        
        return data["profile"]["id"]
    
    def test_onboard_data_analyst(self):
        """Test /api/learning/onboard for data analytics path"""
        response = requests.post(
            f"{BASE_URL}/api/learning/onboard",
            json={
                "targetRole": "Data Analyst",
                "industry": "data",
                "background": "Business background, want to learn data analysis",
                "hoursPerWeek": 10,
                "learningSpeed": "slow",
                "preferredStyle": "visual",
                "targetMonths": 6
            },
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert "profile" in data
        assert "skill_tree" in data
        print(f"✓ Data analyst path created with {len(data['skill_tree']['nodes'])} nodes")
    
    def test_onboard_business_strategy(self):
        """Test /api/learning/onboard for business path"""
        response = requests.post(
            f"{BASE_URL}/api/learning/onboard",
            json={
                "targetRole": "Product Manager",
                "industry": "business",
                "background": "Engineering background, transitioning to PM",
                "hoursPerWeek": 8,
                "learningSpeed": "fast",
                "preferredStyle": "mixed",
                "targetMonths": 9
            },
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert "profile" in data
        print(f"✓ Business path created")


class TestLearningPathMentor:
    """Learning Path mentor API tests"""
    
    def test_mentor_basic_question(self):
        """Test /api/learning/mentor with basic question"""
        response = requests.post(
            f"{BASE_URL}/api/learning/mentor",
            json={
                "message": "What is a variable in programming?",
                "topic": {
                    "id": "python_basics",
                    "name": "Python Basics",
                    "level": "Beginner",
                    "objective": "Learn Python syntax and basics"
                },
                "user_profile": {
                    "targetRole": "Software Engineer",
                    "learningSpeed": "normal",
                    "preferredStyle": "practical"
                },
                "conversation_history": []
            },
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert len(data["response"]) > 20  # Should have meaningful response
        print(f"✓ Mentor response length: {len(data['response'])}")
    
    def test_mentor_with_history(self):
        """Test /api/learning/mentor with conversation history"""
        response = requests.post(
            f"{BASE_URL}/api/learning/mentor",
            json={
                "message": "Can you give me an example?",
                "topic": {
                    "id": "functions",
                    "name": "Functions",
                    "level": "Beginner"
                },
                "user_profile": {
                    "targetRole": "Developer",
                    "learningSpeed": "normal"
                },
                "conversation_history": [
                    {"role": "user", "content": "What is a function?"},
                    {"role": "assistant", "content": "A function is a reusable block of code..."}
                ]
            },
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        print(f"✓ Mentor with history response received")


class TestLearningPathTopicCompletion:
    """Learning Path topic completion API tests"""
    
    def test_complete_topic(self):
        """Test /api/learning/complete-topic"""
        response = requests.post(
            f"{BASE_URL}/api/learning/complete-topic",
            json={
                "topic_id": "TEST_python_basics",
                "user_id": "TEST_user_123",
                "score": 85
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "progress" in data
        assert "completed" in data["progress"]
        print(f"✓ Topic completed, progress: {data['progress']}")
    
    def test_complete_multiple_topics(self):
        """Test completing multiple topics updates progress"""
        # Complete first topic
        response1 = requests.post(
            f"{BASE_URL}/api/learning/complete-topic",
            json={
                "topic_id": "TEST_topic_1",
                "user_id": "TEST_user_multi",
                "score": 90
            }
        )
        assert response1.status_code == 200
        
        # Complete second topic
        response2 = requests.post(
            f"{BASE_URL}/api/learning/complete-topic",
            json={
                "topic_id": "TEST_topic_2",
                "user_id": "TEST_user_multi",
                "score": 95
            }
        )
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Progress should show at least 2 completed
        assert data2["progress"]["completed"] >= 2
        print(f"✓ Multiple topics completed, total: {data2['progress']['completed']}")


class TestLearningPathProgress:
    """Learning Path progress API tests"""
    
    def test_get_progress(self):
        """Test /api/learning/progress/{user_id}"""
        # First complete a topic to ensure there's data
        requests.post(
            f"{BASE_URL}/api/learning/complete-topic",
            json={
                "topic_id": "TEST_progress_topic",
                "user_id": "TEST_progress_user",
                "score": 80
            }
        )
        
        # Get progress
        response = requests.get(f"{BASE_URL}/api/learning/progress/TEST_progress_user")
        assert response.status_code == 200
        data = response.json()
        assert "completed_topics" in data
        assert "stats" in data
        print(f"✓ Progress retrieved: {data['stats']}")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

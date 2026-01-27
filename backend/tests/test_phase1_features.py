"""
Test Phase 1 Features for Live Code Mentor
- Gamification system (XP, levels, streaks, badges)
- Voice input (Web Speech API - frontend only)
- Image input support for analysis
- Healthcare diagrams generation
- AI News Feed with categories
- Deep company research
- AI Agent building guide
- Learning mentor with image support
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Basic health check tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health endpoint working")


class TestAINewsFeed:
    """Test AI News Feed API - /api/news/feed"""
    
    def test_news_feed_all_category(self):
        """Test news feed with 'all' category"""
        response = requests.get(f"{BASE_URL}/api/news/feed?category=all")
        assert response.status_code == 200
        data = response.json()
        assert "articles" in data
        assert len(data["articles"]) > 0
        print(f"✓ News feed returned {len(data['articles'])} articles")
    
    def test_news_feed_ai_category(self):
        """Test news feed with 'ai' category"""
        response = requests.get(f"{BASE_URL}/api/news/feed?category=ai")
        assert response.status_code == 200
        data = response.json()
        assert "articles" in data
        print(f"✓ AI category news feed working")
    
    def test_news_feed_coding_category(self):
        """Test news feed with 'coding' category"""
        response = requests.get(f"{BASE_URL}/api/news/feed?category=coding")
        assert response.status_code == 200
        data = response.json()
        assert "articles" in data
        print(f"✓ Coding category news feed working")
    
    def test_news_feed_startups_category(self):
        """Test news feed with 'startups' category"""
        response = requests.get(f"{BASE_URL}/api/news/feed?category=startups")
        assert response.status_code == 200
        data = response.json()
        assert "articles" in data
        print(f"✓ Startups category news feed working")
    
    def test_news_article_structure(self):
        """Test news article has required fields"""
        response = requests.get(f"{BASE_URL}/api/news/feed?category=all")
        assert response.status_code == 200
        data = response.json()
        if data["articles"]:
            article = data["articles"][0]
            assert "id" in article
            assert "title" in article
            assert "summary" in article
            assert "source" in article
            assert "category" in article
            print("✓ News article structure is correct")


class TestHealthcareDiagram:
    """Test Healthcare Diagram Generation API - /api/healthcare/diagram"""
    
    def test_healthcare_diagram_anatomy(self):
        """Test healthcare diagram generation for anatomy"""
        response = requests.post(
            f"{BASE_URL}/api/healthcare/diagram",
            data={"topic": "heart anatomy", "diagram_type": "anatomy"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["topic"] == "heart anatomy"
        assert data["diagram_type"] == "anatomy"
        # Should have either svg or image_url/image_base64
        assert "svg" in data or "image_url" in data or "image_base64" in data
        print("✓ Healthcare anatomy diagram generated")
    
    def test_healthcare_diagram_process(self):
        """Test healthcare diagram generation for process"""
        response = requests.post(
            f"{BASE_URL}/api/healthcare/diagram",
            data={"topic": "blood circulation", "diagram_type": "process"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("✓ Healthcare process diagram generated")
    
    def test_healthcare_diagram_timeline(self):
        """Test healthcare diagram generation for timeline"""
        response = requests.post(
            f"{BASE_URL}/api/healthcare/diagram",
            data={"topic": "diabetes treatment", "diagram_type": "timeline"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("✓ Healthcare timeline diagram generated")


class TestDeepCompanyResearch:
    """Test Deep Company Research API - /api/research/company-deep"""
    
    def test_company_research_basic(self):
        """Test deep company research with a known company"""
        response = requests.post(
            f"{BASE_URL}/api/research/company-deep",
            data={"company_url": "https://google.com"},
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        assert "company_name" in data
        assert "overview" in data
        assert "products_services" in data
        print(f"✓ Deep company research returned data for: {data.get('company_name', 'Unknown')}")
    
    def test_company_research_structure(self):
        """Test company research response structure"""
        response = requests.post(
            f"{BASE_URL}/api/research/company-deep",
            data={"company_url": "https://microsoft.com"},
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        # Check for expected sections
        expected_sections = ["company_name", "overview", "products_services", "competitors"]
        for section in expected_sections:
            assert section in data, f"Missing section: {section}"
        print("✓ Company research structure is correct")


class TestAIAgentGuide:
    """Test AI Agent Building Guide API - /api/guide/ai-agents"""
    
    def test_ai_agent_guide_beginner(self):
        """Test AI agent guide for beginner level"""
        response = requests.post(
            f"{BASE_URL}/api/guide/ai-agents",
            json={"topic": "building chatbots", "skill_level": "beginner"},
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        assert "title" in data
        assert "steps" in data
        assert "level" in data
        print(f"✓ AI Agent guide generated: {data.get('title', 'Unknown')}")
    
    def test_ai_agent_guide_intermediate(self):
        """Test AI agent guide for intermediate level"""
        response = requests.post(
            f"{BASE_URL}/api/guide/ai-agents",
            json={"topic": "autonomous agents", "skill_level": "intermediate"},
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        assert "steps" in data
        assert len(data["steps"]) > 0
        print("✓ AI Agent guide for intermediate level working")
    
    def test_ai_agent_guide_structure(self):
        """Test AI agent guide response structure"""
        response = requests.post(
            f"{BASE_URL}/api/guide/ai-agents",
            json={"topic": "AI assistants", "skill_level": "beginner"},
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        expected_fields = ["title", "introduction", "steps", "best_practices"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        print("✓ AI Agent guide structure is correct")


class TestLearningMentor:
    """Test Learning Mentor API with image support - /api/learning/mentor"""
    
    def test_learning_mentor_basic(self):
        """Test basic learning mentor interaction"""
        response = requests.post(
            f"{BASE_URL}/api/learning/mentor",
            json={
                "message": "Explain Python decorators",
                "topic": {"name": "Python Decorators", "level": "Intermediate"},
                "user_profile": {"targetRole": "Software Engineer", "learningSpeed": "normal"},
                "conversation_history": []
            },
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert len(data["response"]) > 100  # Should have substantial content
        print("✓ Learning mentor basic interaction working")
    
    def test_learning_mentor_with_context(self):
        """Test learning mentor with conversation history"""
        response = requests.post(
            f"{BASE_URL}/api/learning/mentor",
            json={
                "message": "Can you give me an example?",
                "topic": {"name": "Python Functions", "level": "Beginner"},
                "user_profile": {"targetRole": "Data Analyst", "learningSpeed": "slow"},
                "conversation_history": [
                    {"role": "user", "content": "What are functions?"},
                    {"role": "assistant", "content": "Functions are reusable blocks of code..."}
                ]
            },
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        print("✓ Learning mentor with context working")


class TestLearningOnboard:
    """Test Learning Path Onboarding API - /api/learning/onboard"""
    
    def test_learning_onboard_software(self):
        """Test onboarding for software engineering path"""
        response = requests.post(
            f"{BASE_URL}/api/learning/onboard",
            json={
                "targetRole": "Software Engineer",
                "industry": "software",
                "background": "Some programming experience",
                "hoursPerWeek": 10,
                "learningSpeed": "normal",
                "preferredStyle": "mixed",
                "targetMonths": 12
            },
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        assert "profile" in data
        assert "skill_tree" in data
        assert "weekly_plan" in data
        print("✓ Learning onboard for software path working")
    
    def test_learning_onboard_healthcare(self):
        """Test onboarding for healthcare path"""
        response = requests.post(
            f"{BASE_URL}/api/learning/onboard",
            json={
                "targetRole": "Healthcare Professional",
                "industry": "healthcare",
                "background": "Medical background",
                "hoursPerWeek": 15,
                "learningSpeed": "fast",
                "preferredStyle": "visual",
                "targetMonths": 6
            },
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        assert "profile" in data
        assert "skill_tree" in data
        print("✓ Learning onboard for healthcare path working")


class TestAgentsList:
    """Test Agents List API - /api/agents"""
    
    def test_agents_list(self):
        """Test that agents list returns all 4 agents"""
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
        print("✓ All 4 agents returned correctly")


class TestAgentChat:
    """Test Agent Chat API - /api/agent/chat"""
    
    def test_coding_agent_chat(self):
        """Test coding agent chat"""
        response = requests.post(
            f"{BASE_URL}/api/agent/chat",
            json={
                "agent_type": "coding",
                "message": "How do I write a for loop in Python?",
                "conversation_history": []
            },
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert data["agent_type"] == "coding"
        print("✓ Coding agent chat working")
    
    def test_health_agent_chat(self):
        """Test health agent chat"""
        response = requests.post(
            f"{BASE_URL}/api/agent/chat",
            json={
                "agent_type": "health",
                "message": "What is diabetes?",
                "conversation_history": []
            },
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert data["agent_type"] == "health"
        print("✓ Health agent chat working")
    
    def test_invalid_agent_type(self):
        """Test invalid agent type returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/agent/chat",
            json={
                "agent_type": "invalid_agent",
                "message": "Hello",
                "conversation_history": []
            },
            timeout=60
        )
        assert response.status_code == 400
        print("✓ Invalid agent type correctly returns 400")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

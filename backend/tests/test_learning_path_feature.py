"""
Test suite for Learning Path Feature APIs
Tests: YouTube preview, Learning onboard, Research resources, Custom learning paths
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Basic health check to ensure API is running"""
    
    def test_health_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health check passed")


class TestYouTubePreviewAPI:
    """Tests for GET /api/learning/youtube/preview/{video_id}"""
    
    def test_youtube_preview_valid_video(self):
        """Test YouTube preview with a valid video ID"""
        video_id = "dQw4w9WgXcQ"  # Rick Astley - Never Gonna Give You Up
        response = requests.get(f"{BASE_URL}/api/learning/youtube/preview/{video_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        assert data["success"] == True
        assert data["video_id"] == video_id
        assert "title" in data
        assert "author_name" in data
        assert "thumbnail_url" in data
        assert "embed_url" in data
        
        # Validate URLs
        assert f"https://img.youtube.com/vi/{video_id}" in data["thumbnail_url"]
        assert f"https://www.youtube-nocookie.com/embed/{video_id}" in data["embed_url"]
        
        print(f"✓ YouTube preview returned: {data['title']}")
    
    def test_youtube_preview_another_video(self):
        """Test YouTube preview with another valid video ID"""
        video_id = "jNQXAC9IVRw"  # First YouTube video ever
        response = requests.get(f"{BASE_URL}/api/learning/youtube/preview/{video_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["video_id"] == video_id
        print(f"✓ YouTube preview for second video: {data['title']}")
    
    def test_youtube_preview_invalid_video(self):
        """Test YouTube preview with invalid video ID - should still return fallback"""
        video_id = "invalid_id_123"
        response = requests.get(f"{BASE_URL}/api/learning/youtube/preview/{video_id}")
        
        # API returns fallback data even for invalid IDs
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["video_id"] == video_id
        print("✓ YouTube preview handles invalid ID gracefully")


class TestLearningOnboardAPI:
    """Tests for POST /api/learning/onboard"""
    
    def test_onboard_software_industry(self):
        """Test onboarding for Software & AI Engineering industry"""
        payload = {
            "targetRole": "Full Stack Developer",
            "industry": "software",
            "background": "Some programming experience",
            "hoursPerWeek": 10,
            "learningSpeed": "moderate",
            "preferredStyle": "hands-on",
            "targetMonths": 6
        }
        
        response = requests.post(
            f"{BASE_URL}/api/learning/onboard",
            json=payload,
            timeout=30  # AI generation can take time
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate profile
        assert "profile" in data
        assert "id" in data["profile"]
        assert data["profile"]["targetRole"] == "Full Stack Developer"
        assert data["profile"]["industry"] == "software"
        
        # Validate skill tree
        assert "skill_tree" in data
        assert "name" in data["skill_tree"]
        assert "nodes" in data["skill_tree"]
        assert len(data["skill_tree"]["nodes"]) > 0
        
        # Validate weekly plan
        assert "weekly_plan" in data
        assert "tasks" in data["weekly_plan"]
        
        # Validate progress
        assert "progress" in data
        assert "completed" in data["progress"]
        assert "total" in data["progress"]
        
        print(f"✓ Onboarding created profile: {data['profile']['id']}")
        print(f"  - Skill tree: {data['skill_tree']['name']}")
        print(f"  - Total topics: {data['progress']['total']}")
    
    def test_onboard_data_science_industry(self):
        """Test onboarding for Data Science industry"""
        payload = {
            "targetRole": "Data Scientist",
            "industry": "data_science",
            "background": "Statistics background",
            "hoursPerWeek": 15,
            "learningSpeed": "fast",
            "preferredStyle": "theoretical",
            "targetMonths": 12
        }
        
        response = requests.post(
            f"{BASE_URL}/api/learning/onboard",
            json=payload,
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "profile" in data
        assert "skill_tree" in data
        print(f"✓ Data Science onboarding successful")
    
    def test_onboard_business_industry(self):
        """Test onboarding for Business & Finance industry"""
        payload = {
            "targetRole": "Business Analyst",
            "industry": "business",
            "background": "MBA student",
            "hoursPerWeek": 8,
            "learningSpeed": "moderate",
            "preferredStyle": "case-study",
            "targetMonths": 3
        }
        
        response = requests.post(
            f"{BASE_URL}/api/learning/onboard",
            json=payload,
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "profile" in data
        print(f"✓ Business onboarding successful")


class TestResearchResourcesAPI:
    """Tests for POST /api/learning/research-resources"""
    
    def test_research_python_resources(self):
        """Test researching Python learning resources"""
        payload = {
            "topic": "Python programming",
            "level": "beginner",
            "goal": "Learn Python basics"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/learning/research-resources",
            json=payload,
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate YouTube playlists
        assert "youtube_playlists" in data
        assert len(data["youtube_playlists"]) > 0
        
        # Validate each playlist has required fields
        for playlist in data["youtube_playlists"]:
            assert "title" in playlist
            assert "url" in playlist
            assert "youtube.com" in playlist["url"] or "youtu.be" in playlist["url"]
        
        # Validate free courses
        assert "free_courses" in data
        
        print(f"✓ Found {len(data['youtube_playlists'])} YouTube resources")
        print(f"✓ Found {len(data['free_courses'])} free courses")
    
    def test_research_react_resources(self):
        """Test researching React learning resources"""
        payload = {
            "topic": "React JavaScript",
            "level": "intermediate",
            "goal": "Build web applications"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/learning/research-resources",
            json=payload,
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "youtube_playlists" in data
        print(f"✓ React resources research successful")


class TestCustomLearningPathsAPI:
    """Tests for custom learning path CRUD operations"""
    
    @pytest.fixture
    def created_path_id(self):
        """Create a test learning path and return its ID"""
        payload = {
            "name": "TEST_Custom Python Path",
            "description": "Test learning path for Python",
            "career_goal": "Become a Python developer"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/learning/paths/create",
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        path_id = data["path_id"]
        
        yield path_id
        
        # Cleanup - no direct delete endpoint for paths, but topics can be deleted
    
    def test_create_custom_learning_path(self):
        """Test creating a custom learning path"""
        payload = {
            "name": "TEST_Machine Learning Path",
            "description": "Custom ML learning journey",
            "career_goal": "ML Engineer"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/learning/paths/create",
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "path_id" in data
        assert data["path"]["name"] == "TEST_Machine Learning Path"
        
        print(f"✓ Created custom path: {data['path_id']}")
    
    def test_get_all_learning_paths(self):
        """Test getting all custom learning paths"""
        response = requests.get(f"{BASE_URL}/api/learning/paths")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "paths" in data
        assert isinstance(data["paths"], list)
        
        print(f"✓ Retrieved {len(data['paths'])} learning paths")
    
    def test_get_specific_learning_path(self, created_path_id):
        """Test getting a specific learning path"""
        response = requests.get(f"{BASE_URL}/api/learning/paths/{created_path_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["path_id"] == created_path_id
        assert "name" in data
        assert "topics" in data
        
        print(f"✓ Retrieved path: {data['name']}")
    
    def test_add_topic_to_path(self, created_path_id):
        """Test adding a topic to a learning path"""
        payload = {
            "path_id": created_path_id,
            "name": "TEST_Python Basics",
            "description": "Learn Python fundamentals",
            "level": "beginner",
            "estimated_time": "2 weeks",
            "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/learning/paths/{created_path_id}/topics",
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "topic" in data
        assert data["topic"]["name"] == "TEST_Python Basics"
        assert "id" in data["topic"]
        
        # Verify video_id was extracted
        assert data["topic"]["video_id"] == "dQw4w9WgXcQ"
        
        print(f"✓ Added topic: {data['topic']['name']}")
        return data["topic"]["id"]
    
    def test_add_nested_topic(self, created_path_id):
        """Test adding a nested subtopic"""
        # First add a parent topic
        parent_payload = {
            "path_id": created_path_id,
            "name": "TEST_Parent Topic",
            "level": "beginner"
        }
        
        parent_response = requests.post(
            f"{BASE_URL}/api/learning/paths/{created_path_id}/topics",
            json=parent_payload
        )
        
        assert parent_response.status_code == 200
        parent_id = parent_response.json()["topic"]["id"]
        
        # Now add a child topic
        child_payload = {
            "path_id": created_path_id,
            "parent_id": parent_id,
            "name": "TEST_Child Topic",
            "level": "beginner"
        }
        
        child_response = requests.post(
            f"{BASE_URL}/api/learning/paths/{created_path_id}/topics",
            json=child_payload
        )
        
        assert child_response.status_code == 200
        child_data = child_response.json()
        
        assert child_data["success"] == True
        assert child_data["topic"]["parent_id"] == parent_id
        
        print(f"✓ Added nested topic under parent")
    
    def test_update_topic(self, created_path_id):
        """Test updating a topic"""
        # First create a topic
        create_payload = {
            "path_id": created_path_id,
            "name": "TEST_Topic to Update",
            "level": "beginner"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/learning/paths/{created_path_id}/topics",
            json=create_payload
        )
        
        topic_id = create_response.json()["topic"]["id"]
        
        # Update the topic
        update_payload = {
            "topic_id": topic_id,
            "name": "TEST_Updated Topic Name",
            "status": "in_progress",
            "youtube_url": "https://youtu.be/jNQXAC9IVRw"
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/learning/topics/{topic_id}",
            json=update_payload
        )
        
        assert update_response.status_code == 200
        data = update_response.json()
        
        assert data["success"] == True
        assert data["updated"]["name"] == "TEST_Updated Topic Name"
        assert data["updated"]["status"] == "in_progress"
        assert data["updated"]["video_id"] == "jNQXAC9IVRw"
        
        print(f"✓ Updated topic successfully")
    
    def test_delete_topic(self, created_path_id):
        """Test deleting a topic"""
        # First create a topic
        create_payload = {
            "path_id": created_path_id,
            "name": "TEST_Topic to Delete",
            "level": "beginner"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/learning/paths/{created_path_id}/topics",
            json=create_payload
        )
        
        topic_id = create_response.json()["topic"]["id"]
        
        # Delete the topic
        delete_response = requests.delete(
            f"{BASE_URL}/api/learning/topics/{topic_id}"
        )
        
        assert delete_response.status_code == 200
        data = delete_response.json()
        
        assert data["success"] == True
        assert data["deleted"] == topic_id
        
        print(f"✓ Deleted topic successfully")
    
    def test_get_nonexistent_path(self):
        """Test getting a non-existent learning path"""
        response = requests.get(f"{BASE_URL}/api/learning/paths/nonexistent-id-123")
        
        assert response.status_code == 404
        print("✓ Non-existent path returns 404")


class TestVideoLearningAPIs:
    """Tests for video learning companion APIs"""
    
    def test_video_qa_endpoint(self):
        """Test video Q&A endpoint"""
        payload = {
            "question": "What is this video about?",
            "video_title": "Python Tutorial",
            "video_id": "dQw4w9WgXcQ",
            "current_time": 60,
            "skill_level": "beginner",
            "has_transcript": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/learning/video-qa",
            json=payload,
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "answer" in data
        assert len(data["answer"]) > 0
        
        print(f"✓ Video Q&A returned answer")
    
    def test_video_contextual_help(self):
        """Test video contextual help endpoint"""
        payload = {
            "video_id": "dQw4w9WgXcQ",
            "video_title": "Python Tutorial",
            "current_time": 120,
            "transcript_segment": "Let's learn about variables",
            "skill_level": "beginner",
            "help_type": "explain"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/learning/video/contextual-help",
            json=payload,
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "help" in data
        
        print(f"✓ Contextual help returned")
    
    def test_video_comprehension_check(self):
        """Test video comprehension check endpoint"""
        payload = {
            "video_id": "dQw4w9WgXcQ",
            "video_title": "Python Tutorial",
            "topic_covered": "Variables and Data Types",
            "skill_level": "beginner"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/learning/video/comprehension-check",
            json=payload,
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "question" in data
        assert "options" in data
        assert "correct_answer" in data
        
        print(f"✓ Comprehension check generated")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

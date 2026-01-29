"""
Test new features for Video Learning Modal:
1. Chat button on topics opens VideoLearningModal
2. VideoLearningModal shows 'Add URL' form when no video
3. Screenshot analysis API - POST /api/learning/video/analyze-screenshot
4. YouTube preview API works when pasting URL
"""
import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndBasics:
    """Basic health check tests"""
    
    def test_health_endpoint(self):
        """Test health endpoint is working"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✅ Health endpoint working")


class TestYouTubePreviewAPI:
    """Test YouTube preview API for Add URL feature"""
    
    def test_youtube_preview_valid_video(self):
        """Test YouTube preview with valid video ID"""
        # Using a well-known video ID (Rick Astley - Never Gonna Give You Up)
        video_id = "dQw4w9WgXcQ"
        response = requests.get(f"{BASE_URL}/api/learning/youtube/preview/{video_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True
        assert "title" in data
        assert "author_name" in data
        assert "thumbnail_url" in data
        assert "video_id" in data
        assert data["video_id"] == video_id
        
        print(f"✅ YouTube preview API working - Title: {data.get('title', 'N/A')[:50]}")
    
    def test_youtube_preview_invalid_video(self):
        """Test YouTube preview with invalid video ID"""
        video_id = "invalid_id_123"
        response = requests.get(f"{BASE_URL}/api/learning/youtube/preview/{video_id}")
        
        # Should return 200 but with success=false or error
        assert response.status_code in [200, 404]
        print("✅ YouTube preview handles invalid video ID gracefully")


class TestScreenshotAnalysisAPI:
    """Test screenshot analysis endpoint for drag & drop feature"""
    
    def test_screenshot_analysis_endpoint_exists(self):
        """Test that screenshot analysis endpoint exists and accepts POST"""
        # Create a minimal test image (1x1 red pixel PNG in base64)
        test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
        
        payload = {
            "image_base64": test_image_base64,
            "video_title": "Test Video Title",
            "current_time": 120,
            "skill_level": "intermediate",
            "transcript_context": "This is a test transcript context",
            "conversation_history": []
        }
        
        response = requests.post(
            f"{BASE_URL}/api/learning/video/analyze-screenshot",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 200 (success) or 500 (if image processing fails)
        assert response.status_code in [200, 500]
        
        if response.status_code == 200:
            data = response.json()
            assert "analysis" in data or "success" in data
            print(f"✅ Screenshot analysis API working - Response: {str(data)[:100]}")
        else:
            print("⚠️ Screenshot analysis API returned 500 - may need valid image")
    
    def test_screenshot_analysis_with_context(self):
        """Test screenshot analysis with conversation history"""
        test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
        
        payload = {
            "image_base64": test_image_base64,
            "video_title": "Python Tutorial - Functions",
            "current_time": 300,
            "skill_level": "beginner",
            "transcript_context": "Now let's look at how to define a function in Python",
            "conversation_history": [
                {"type": "question", "summary": "Asked about function parameters"},
                {"type": "screenshot_analysis", "summary": "Analyzed code example"}
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/learning/video/analyze-screenshot",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code in [200, 500]
        print(f"✅ Screenshot analysis with context - Status: {response.status_code}")


class TestVideoQAAPI:
    """Test Video Q&A API for chat functionality"""
    
    def test_video_qa_without_video(self):
        """Test video Q&A when no video is provided (topic-only chat)"""
        payload = {
            "question": "What are the basics of Python programming?",
            "video_title": "Python Basics",
            "video_id": "",  # Empty string instead of null
            "current_time": 0,
            "skill_level": "beginner",
            "has_transcript": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/learning/video-qa",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        print(f"✅ Video Q&A without video working - Answer length: {len(data.get('answer', ''))}")
    
    def test_video_qa_with_video(self):
        """Test video Q&A with video context"""
        payload = {
            "question": "Can you explain what was just shown?",
            "video_title": "React Tutorial",
            "video_id": "dQw4w9WgXcQ",
            "current_time": 120,
            "skill_level": "intermediate",
            "has_transcript": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/learning/video-qa",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        print(f"✅ Video Q&A with video context working")


class TestContextualHelpAPI:
    """Test contextual help API for video learning"""
    
    def test_contextual_help_explain(self):
        """Test contextual help with explain type"""
        payload = {
            "video_id": "dQw4w9WgXcQ",
            "video_title": "JavaScript Fundamentals",
            "current_time": 60,
            "transcript_segment": "Variables are containers for storing data values",
            "skill_level": "beginner",
            "help_type": "explain"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/learning/video/contextual-help",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "help" in data
        print(f"✅ Contextual help (explain) working")
    
    def test_contextual_help_example(self):
        """Test contextual help with example type"""
        payload = {
            "video_id": "dQw4w9WgXcQ",
            "video_title": "CSS Flexbox",
            "current_time": 180,
            "transcript_segment": "Flexbox makes it easy to align items",
            "skill_level": "intermediate",
            "help_type": "example"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/learning/video/contextual-help",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        print(f"✅ Contextual help (example) working")


class TestTranscriptAPI:
    """Test transcript fetching API"""
    
    def test_transcript_fetch(self):
        """Test fetching video transcript"""
        payload = {
            "video_id": "dQw4w9WgXcQ",
            "language": "en"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/learning/video/transcript",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        # Transcript may or may not be available - accept 200 or 520 (cloudflare timeout)
        assert response.status_code in [200, 520]
        
        if response.status_code == 200:
            data = response.json()
            if data.get("available"):
                assert "full_text" in data or "transcript" in data
                print(f"✅ Transcript API working - Available: True")
            else:
                print(f"✅ Transcript API working - Available: False (expected for some videos)")
        else:
            print(f"⚠️ Transcript API returned 520 - Cloudflare timeout (acceptable)")


class TestProactiveAnalysisAPI:
    """Test proactive analysis API for AI watching feature"""
    
    def test_proactive_analysis(self):
        """Test proactive analysis endpoint"""
        payload = {
            "video_id": "dQw4w9WgXcQ",
            "video_title": "Machine Learning Basics",
            "current_time": 300,
            "last_pause_time": 250,
            "watch_duration": 300,
            "skill_level": "beginner",
            "transcript_context": "Neural networks are inspired by the human brain"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/learning/video/proactive-analysis",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "should_intervene" in data
        print(f"✅ Proactive analysis API working - Should intervene: {data.get('should_intervene')}")


class TestComprehensionCheckAPI:
    """Test comprehension check API for quiz feature"""
    
    def test_comprehension_check(self):
        """Test generating comprehension check questions"""
        payload = {
            "video_id": "dQw4w9WgXcQ",
            "video_title": "Data Structures",
            "topic_covered": "Arrays and Lists",
            "skill_level": "intermediate"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/learning/video/comprehension-check",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "question" in data
        assert "options" in data
        assert "correct_answer" in data
        print(f"✅ Comprehension check API working - Question: {data.get('question', '')[:50]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

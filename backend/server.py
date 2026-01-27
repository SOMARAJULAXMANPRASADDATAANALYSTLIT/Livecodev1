from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import zipfile
import io
import tempfile
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'live_code_mentor')]

# Collections
sessions_collection = db.sessions
projects_collection = db.projects

# Emergent LLM Setup
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI(title="Live Code Mentor API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== SKILL LEVEL DEFINITIONS ==============

SKILL_LEVEL_PROMPTS = {
    "beginner": {
        "tone": "Be extremely patient, warm, and encouraging. Use simple language and real-world analogies. Explain like teaching a complete newcomer.",
        "depth": "Focus on basic syntax and fundamental concepts. Avoid advanced topics unless asked.",
        "vocabulary": "Use simple terms. Define any technical jargon before using it.",
        "approach": "Step-by-step explanations. Celebrate small wins. Never overwhelm with too much information at once."
    },
    "intermediate": {
        "tone": "Be supportive and constructive. Balance explanation with reasoning.",
        "depth": "Explain common patterns, debugging techniques, and best practices.",
        "vocabulary": "Use standard programming terminology with brief clarifications when needed.",
        "approach": "Provide context and reasoning. Encourage exploration of alternatives."
    },
    "advanced": {
        "tone": "Be direct and technical. Focus on efficiency and optimization.",
        "depth": "Cover architecture patterns, performance considerations, design tradeoffs.",
        "vocabulary": "Use advanced technical terminology freely.",
        "approach": "Discuss trade-offs, scalability concerns, and advanced techniques."
    },
    "senior": {
        "tone": "Be concise and peer-level. Treat as a fellow senior engineer.",
        "depth": "Production-grade review: edge cases, security, scalability, maintainability.",
        "vocabulary": "Full technical vocabulary. Reference industry standards and patterns.",
        "approach": "Focus on architecture, system design, and long-term implications."
    }
}

MENTOR_PERSONAS = {
    "junior_tutor": "Focus on syntax, simple explanations, encouragement. Be like a friendly teaching assistant.",
    "intermediate_coach": "Focus on logic flow, common patterns, debugging techniques. Be like a supportive coach.",
    "advanced_architect": "Focus on performance, code structure, refactoring. Be like a technical lead.",
    "senior_engineer": "Focus on production-ready fixes, edge cases, error handling, security, scalability. Be like a principal engineer."
}

# ============== MODELS ==============

class CodeAnalysisRequest(BaseModel):
    code: str
    language: str
    skill_level: str = "intermediate"

class Bug(BaseModel):
    line: int
    severity: str
    message: str
    suggestion: str

class CodeAnalysisResponse(BaseModel):
    bugs: List[Bug]
    overall_quality: str

class TeachingRequest(BaseModel):
    code: str
    bug: dict
    mentorStyle: str = "patient"
    skill_level: str = "intermediate"

class TeachingResponse(BaseModel):
    conceptName: str
    naturalExplanation: str
    whyItMatters: str
    commonMistake: str

class DeeperExplanationRequest(BaseModel):
    conceptName: str
    currentExplanation: str
    skill_level: str = "intermediate"

class DeeperExplanationResponse(BaseModel):
    deeperExplanation: str
    codeExamples: List[str]
    relatedConcepts: List[str]

class VisualDiagramRequest(BaseModel):
    conceptName: str
    diagramType: str
    code: str
    explanation: str
    skill_level: str = "intermediate"

class VisualDiagramResponse(BaseModel):
    svg: str

class EvaluateAnswerRequest(BaseModel):
    question: str
    studentAnswer: str
    correctConcept: str
    skill_level: str = "intermediate"

class EvaluateAnswerResponse(BaseModel):
    understood: bool
    feedback: str
    encouragement: str
    follow_up_question: Optional[str] = None

class ChatMessage(BaseModel):
    role: str
    content: str

class EnglishChatRequest(BaseModel):
    message: str
    conversationHistory: List[ChatMessage] = []

class Correction(BaseModel):
    original: str
    corrected: str
    explanation: str

class EnglishChatResponse(BaseModel):
    response: str
    intent: str
    corrections: List[Correction]

class ImageAnalysisRequest(BaseModel):
    image_data: str
    task_type: str
    additional_context: Optional[str] = ""
    skill_level: str = "intermediate"

class ImageAnalysisResponse(BaseModel):
    analysis: str
    task_type: str

class FixCodeRequest(BaseModel):
    code: str
    language: str
    bugs: List[dict] = []
    skill_level: str = "intermediate"
    apply_inline_comments: bool = False

class FixCodeResponse(BaseModel):
    fixed_code: str
    explanation: str
    changes_made: List[str]

# ============== NEW MODELS FOR ENHANCED FEATURES ==============

class LineMentoringRequest(BaseModel):
    code: str
    language: str
    selected_lines: List[int]
    full_context: str = ""
    skill_level: str = "intermediate"
    question: Optional[str] = None

class LineMentoringResponse(BaseModel):
    explanation: str
    what_it_does: str
    potential_issues: List[str]
    improvement_suggestions: List[str]
    corrected_code: Optional[str] = None
    teaching_points: List[str]

class SessionMemoryRequest(BaseModel):
    session_id: str
    issue_type: str
    issue_description: str
    fix_applied: str
    skill_level: str = "intermediate"

class SessionMemoryResponse(BaseModel):
    stored: bool
    message: str

class CheckRepetitionRequest(BaseModel):
    session_id: str
    current_issue: str
    code_context: str

class CheckRepetitionResponse(BaseModel):
    is_repeated: bool
    previous_fix: Optional[str] = None
    escalation_message: Optional[str] = None
    higher_level_tip: Optional[str] = None

class ProjectFile(BaseModel):
    path: str
    content: str
    language: str

class ProjectAnalysisResponse(BaseModel):
    project_name: str
    purpose: str
    entry_points: List[str]
    main_modules: List[dict]
    dependencies: List[str]
    architecture_overview: str
    learning_roadmap: dict

class LearningJourneyRequest(BaseModel):
    project_id: str
    skill_level: str = "intermediate"
    focus_area: Optional[str] = None

class LearningJourneyResponse(BaseModel):
    journey_steps: List[dict]
    estimated_time: str
    key_concepts: List[str]

class CodeExecutionRequest(BaseModel):
    code: str
    language: str
    skill_level: str = "intermediate"

class CodeExecutionResponse(BaseModel):
    output: str
    error: Optional[str] = None
    execution_time: float
    error_explanation: Optional[str] = None
    fix_suggestion: Optional[str] = None

class ProactiveMentorRequest(BaseModel):
    code: str
    language: str
    skill_level: str = "intermediate"
    cursor_position: Optional[int] = None

class ProactiveMentorResponse(BaseModel):
    has_issue: bool
    issue_type: Optional[str] = None
    message: Optional[str] = None
    severity: str = "info"
    quick_fix: Optional[str] = None

class SmartQuestionRequest(BaseModel):
    concept_taught: str
    skill_level: str = "intermediate"
    previous_questions: List[str] = []

class SmartQuestionResponse(BaseModel):
    question: str
    expected_answer_hints: List[str]
    difficulty: str

# ============== HELPER FUNCTIONS ==============

def get_skill_context(skill_level: str) -> str:
    """Generate context string based on skill level"""
    level_data = SKILL_LEVEL_PROMPTS.get(skill_level, SKILL_LEVEL_PROMPTS["intermediate"])
    return f"""
SKILL LEVEL: {skill_level.upper()}
- Tone: {level_data['tone']}
- Depth: {level_data['depth']}
- Vocabulary: {level_data['vocabulary']}
- Approach: {level_data['approach']}
"""

def get_mentor_persona(skill_level: str) -> str:
    """Get appropriate mentor persona based on skill level"""
    persona_map = {
        "beginner": "junior_tutor",
        "intermediate": "intermediate_coach",
        "advanced": "advanced_architect",
        "senior": "senior_engineer"
    }
    persona_key = persona_map.get(skill_level, "intermediate_coach")
    return MENTOR_PERSONAS[persona_key]

def get_chat_instance(system_message: str, session_id: str = None):
    """Create a new LlmChat instance for each request"""
    if not session_id:
        session_id = str(uuid.uuid4())
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message
    ).with_model("gemini", "gemini-3-flash-preview")
    return chat

def safe_parse_json(response: str, default: dict = None) -> dict:
    """Safely parse JSON from AI response"""
    if default is None:
        default = {}
    
    if not response:
        return default
    
    try:
        clean_response = response.strip()
        # Remove markdown code blocks if present
        if clean_response.startswith("```"):
            lines = clean_response.split("\n")
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            clean_response = "\n".join(lines)
        
        return json.loads(clean_response)
    except (json.JSONDecodeError, AttributeError):
        return default

def detect_language_from_extension(filename: str) -> str:
    """Detect programming language from file extension"""
    ext_map = {
        '.py': 'python', '.js': 'javascript', '.ts': 'typescript',
        '.jsx': 'javascript', '.tsx': 'typescript', '.java': 'java',
        '.cpp': 'cpp', '.c': 'c', '.h': 'cpp', '.hpp': 'cpp',
        '.go': 'go', '.rs': 'rust', '.rb': 'ruby', '.php': 'php',
        '.cs': 'csharp', '.sql': 'sql', '.html': 'html', '.css': 'css',
        '.json': 'json', '.md': 'markdown', '.yaml': 'yaml', '.yml': 'yaml'
    }
    ext = Path(filename).suffix.lower()
    return ext_map.get(ext, 'text')

# ============== API ENDPOINTS ==============

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

@api_router.post("/analyze-code", response_model=CodeAnalysisResponse)
async def analyze_code(request: CodeAnalysisRequest):
    """Analyze code for bugs and issues with skill-level awareness"""
    try:
        skill_context = get_skill_context(request.skill_level)
        
        system_prompt = f"""You are an expert code analyzer and bug detector. Your job is to find ALL bugs, potential issues, and improvements in code.

{skill_context}

RESPOND ONLY WITH VALID JSON - NO MARKDOWN, NO EXPLANATION:
{{
    "bugs": [
        {{"line": 5, "severity": "critical", "message": "Description of the bug", "suggestion": "How to fix it"}}
    ],
    "overall_quality": "good|fair|poor"
}}

SEVERITY LEVELS:
- "critical": Runtime errors, crashes, exceptions (ZeroDivisionError, IndexError, NullPointerException, etc.)
- "warning": Logic bugs, edge cases not handled, security issues
- "info": Style improvements, performance optimizations, best practices

RULES:
1. ALWAYS check for: division by zero, empty list/array handling, null/undefined access, off-by-one errors
2. Line numbers must be accurate
3. If code has bugs, overall_quality should be "fair" or "poor"
4. Be thorough - find ALL issues, not just obvious ones
5. Adapt message complexity to the skill level"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Find ALL bugs and issues in this {request.language} code. Be thorough:\n\n```{request.language}\n{request.code}\n```")
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {"bugs": [], "overall_quality": "fair"})
        
        return CodeAnalysisResponse(
            bugs=[Bug(**b) for b in data.get("bugs", [])],
            overall_quality=data.get("overall_quality", "fair")
        )
            
    except Exception as e:
        logger.error(f"Code analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/generate-teaching", response_model=TeachingResponse)
async def generate_teaching(request: TeachingRequest):
    """Generate pedagogical explanation for a bug with skill-level adaptation"""
    try:
        skill_context = get_skill_context(request.skill_level)
        mentor_persona = get_mentor_persona(request.skill_level)
        
        style_instructions = {
            "patient": "Be patient, warm, and encouraging. Use simple analogies.",
            "socratic": "Ask guiding questions to help the student discover the answer.",
            "direct": "Be clear and concise. Get straight to the point."
        }
        
        system_prompt = f"""You are a coding mentor with this persona: {mentor_persona}
{style_instructions.get(request.mentorStyle, style_instructions['patient'])}

{skill_context}

Respond ONLY with valid JSON:
{{
    "conceptName": "Name of the concept/pattern being taught",
    "naturalExplanation": "Clear explanation adapted to skill level",
    "whyItMatters": "Why this matters in real programming",
    "commonMistake": "Why this is a common mistake and how to avoid it"
}}

IMPORTANT: Adapt your language complexity and depth to the {request.skill_level} level."""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Explain this bug to a {request.skill_level} developer:\n\nCode:\n```\n{request.code}\n```\n\nBug at line {request.bug.get('line', '?')}: {request.bug.get('message', 'Unknown issue')}")
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {
            "conceptName": "Code Issue",
            "naturalExplanation": response or "Let me explain this issue...",
            "whyItMatters": "Understanding this helps write better code.",
            "commonMistake": "This is a common pattern that trips up many developers."
        })
        
        return TeachingResponse(
            conceptName=data.get("conceptName", "Code Issue"),
            naturalExplanation=data.get("naturalExplanation", "Let me explain..."),
            whyItMatters=data.get("whyItMatters", "This is important for writing robust code."),
            commonMistake=data.get("commonMistake", "Many developers encounter this.")
        )
            
    except Exception as e:
        logger.error(f"Teaching generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/generate-deeper-explanation", response_model=DeeperExplanationResponse)
async def generate_deeper_explanation(request: DeeperExplanationRequest):
    """Generate a more detailed explanation with skill-level awareness"""
    try:
        skill_context = get_skill_context(request.skill_level)
        
        system_prompt = f"""You are an expert programming tutor providing deep explanations.

{skill_context}

Respond ONLY with valid JSON:
{{
    "deeperExplanation": "Detailed technical explanation with more context, adapted to skill level",
    "codeExamples": ["Example code snippet 1", "Example code snippet 2"],
    "relatedConcepts": ["Related concept 1", "Related concept 2"]
}}"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Provide a deeper explanation for: {request.conceptName}\n\nCurrent explanation: {request.currentExplanation}\n\nAdapt to {request.skill_level} level.")
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {
            "deeperExplanation": response or "Here's a deeper look...",
            "codeExamples": [],
            "relatedConcepts": []
        })
        
        return DeeperExplanationResponse(
            deeperExplanation=data.get("deeperExplanation", "Here's more detail..."),
            codeExamples=data.get("codeExamples", []),
            relatedConcepts=data.get("relatedConcepts", [])
        )
            
    except Exception as e:
        logger.error(f"Deeper explanation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/generate-visual-diagram", response_model=VisualDiagramResponse)
async def generate_visual_diagram(request: VisualDiagramRequest):
    """Generate SVG diagram for a concept with multiple diagram types"""
    try:
        skill_context = get_skill_context(request.skill_level)
        
        diagram_instructions = {
            "flowchart": "Create a flowchart showing step-by-step logic flow with decision diamonds and process rectangles",
            "state_flow": "Show state changes with arrows between boxes, highlighting data transformations",
            "async_timeline": "Show async operations on a horizontal timeline with call stack visualization",
            "closure_scope": "Show nested scopes with variable capture using nested boxes",
            "event_loop": "Show call stack, web APIs, and callback queue interactions",
            "data_flow": "Show how data moves through the system with arrows and transformations",
            "architecture": "Show system components and their relationships",
            "memory_model": "Show stack and heap memory allocation",
            "sequence": "Show sequence of function calls and returns over time"
        }
        
        system_prompt = f"""You are an expert at creating educational SVG diagrams.

{skill_context}

Create a clean, professional SVG diagram (800x500px) with:
- Dark background (#1E1E1E)
- Google colors: Blue (#4285F4), Red (#EA4335), Yellow (#FBBC04), Green (#34A853)
- White text (#FFFFFF) with clear labels
- Arrows and connecting lines
- Rounded rectangles for boxes
- Font: sans-serif, readable sizes

Diagram Type: {request.diagramType}
Instructions: {diagram_instructions.get(request.diagramType, "Create an informative diagram")}

Make the diagram appropriate for a {request.skill_level} level developer:
- Beginner: Simple, few elements, clear labels
- Intermediate: More detail, logical groupings
- Advanced: Complete picture, technical annotations
- Senior: Production-grade, edge cases noted

Respond with ONLY the SVG code, no explanation. Start with <svg and end with </svg>"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Create a {request.diagramType} diagram for: {request.conceptName}\n\nContext: {request.explanation}\n\nCode:\n```\n{request.code}\n```")
        response = await chat.send_message(user_msg)
        
        svg_content = response.strip() if response else ""
        if "<svg" in svg_content:
            start = svg_content.find("<svg")
            end = svg_content.rfind("</svg>") + 6
            svg_content = svg_content[start:end]
        else:
            svg_content = f'''<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg">
                <rect width="800" height="500" fill="#1E1E1E"/>
                <text x="400" y="250" fill="#FFFFFF" text-anchor="middle" font-size="20">{request.conceptName}</text>
            </svg>'''
        
        return VisualDiagramResponse(svg=svg_content)
        
    except Exception as e:
        logger.error(f"Diagram generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/evaluate-answer", response_model=EvaluateAnswerResponse)
async def evaluate_answer(request: EvaluateAnswerRequest):
    """Evaluate student understanding with follow-up questions"""
    try:
        skill_context = get_skill_context(request.skill_level)
        
        system_prompt = f"""You are a supportive coding mentor evaluating student understanding.

{skill_context}

Respond ONLY with valid JSON:
{{
    "understood": true or false,
    "feedback": "Specific feedback about their answer",
    "encouragement": "Encouraging message",
    "follow_up_question": "A follow-up question to deepen understanding (optional, null if not needed)"
}}

Be generous for beginners - if they show basic understanding, mark as understood.
Be more rigorous for advanced/senior levels - expect deeper understanding."""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Question: {request.question}\n\nCorrect concept: {request.correctConcept}\n\nStudent's answer ({request.skill_level} level): {request.studentAnswer}\n\nDid they understand?")
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {
            "understood": True,
            "feedback": "Good effort!",
            "encouragement": "Keep learning!",
            "follow_up_question": None
        })
        
        return EvaluateAnswerResponse(
            understood=data.get("understood", True),
            feedback=data.get("feedback", "Good effort!"),
            encouragement=data.get("encouragement", "Keep learning!"),
            follow_up_question=data.get("follow_up_question")
        )
            
    except Exception as e:
        logger.error(f"Answer evaluation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/english-chat", response_model=EnglishChatResponse)
async def english_chat(request: EnglishChatRequest):
    """English learning chat assistant"""
    try:
        system_prompt = """You are a friendly English language tutor. Help users improve their English.
        
        Detect the user's intent:
        - "question": They're asking how to say something in English
        - "practice": They wrote a sentence for correction
        - "conversation": General chat practice
        
        Respond ONLY with valid JSON:
        {
            "response": "Your helpful response",
            "intent": "question|practice|conversation",
            "corrections": [
                {"original": "what they wrote", "corrected": "corrected version", "explanation": "why"}
            ]
        }
        
        Be encouraging and patient. If there are no errors, the corrections array should be empty."""
        
        chat = get_chat_instance(system_prompt)
        
        context = ""
        for msg in request.conversationHistory[-5:]:
            context += f"{msg.role}: {msg.content}\n"
        
        user_msg = UserMessage(text=f"Conversation history:\n{context}\n\nUser's new message: {request.message}")
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {
            "response": response or "I'm here to help you learn English!",
            "intent": "conversation",
            "corrections": []
        })
        
        return EnglishChatResponse(
            response=data.get("response", "I'm here to help!"),
            intent=data.get("intent", "conversation"),
            corrections=[Correction(**c) for c in data.get("corrections", [])]
        )
            
    except Exception as e:
        logger.error(f"English chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/fix-code", response_model=FixCodeResponse)
async def fix_code(request: FixCodeRequest):
    """AI Senior fixes the code automatically with skill-level awareness"""
    try:
        skill_context = get_skill_context(request.skill_level)
        mentor_persona = get_mentor_persona(request.skill_level)
        
        bugs_context = ""
        if request.bugs:
            bugs_context = "Known bugs to fix:\n" + "\n".join([f"- Line {b.get('line', '?')}: {b.get('message', '')}" for b in request.bugs])
        
        inline_comment_instruction = ""
        if request.apply_inline_comments:
            inline_comment_instruction = "\n6. Add inline comments explaining each important change for learning purposes"
        
        system_prompt = f"""You are a senior software engineer with this persona: {mentor_persona}
Your job is to fix ALL bugs in the code and return clean, working code.

{skill_context}

RESPOND ONLY WITH VALID JSON:
{{
    "fixed_code": "The complete fixed code (properly formatted, ready to run)",
    "explanation": "Brief explanation of what was fixed, adapted to {request.skill_level} level",
    "changes_made": ["Change 1", "Change 2", "Change 3"]
}}

RULES:
1. Fix ALL bugs - division by zero, null checks, async/await issues, etc.
2. Keep the code structure similar but correct
3. Add necessary error handling
4. The fixed_code must be complete and runnable
5. Preserve comments but fix the issues they mention{inline_comment_instruction}

Adapt explanation complexity to the {request.skill_level} level."""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Fix this {request.language} code:\n\n```{request.language}\n{request.code}\n```\n\n{bugs_context}")
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {
            "fixed_code": request.code,
            "explanation": "Unable to generate fix",
            "changes_made": []
        })
        
        return FixCodeResponse(
            fixed_code=data.get("fixed_code", request.code),
            explanation=data.get("explanation", "Code has been reviewed"),
            changes_made=data.get("changes_made", [])
        )
        
    except Exception as e:
        logger.error(f"Fix code error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/analyze-image", response_model=ImageAnalysisResponse)
async def analyze_image(request: ImageAnalysisRequest):
    """Analyze uploaded image with skill-level awareness"""
    try:
        skill_context = get_skill_context(request.skill_level)
        
        task_prompts = {
            "code_screenshot": "Analyze this code screenshot. Identify the programming language, describe what the code does, and point out any visible bugs or issues.",
            "whiteboard": "Transcribe any handwritten code or diagrams in this whiteboard image. If it's code, identify the language and explain what it's trying to do.",
            "english_text": "Read the text in this image. Check for any grammar or spelling errors and provide corrections.",
            "general": "Analyze this educational image and provide helpful insights for learning."
        }
        
        system_prompt = f"""You are an expert at analyzing educational images.

{skill_context}

Task: {task_prompts.get(request.task_type, task_prompts['general'])}

{f'Additional context: {request.additional_context}' if request.additional_context else ''}

Provide a clear, helpful analysis adapted to a {request.skill_level} level learner."""
        
        chat = get_chat_instance(system_prompt)
        
        image_content = ImageContent(image_base64=request.image_data)
        user_msg = UserMessage(
            text="Please analyze this image:",
            file_contents=[image_content]
        )
        response = await chat.send_message(user_msg)
        
        return ImageAnalysisResponse(
            analysis=response or "Unable to analyze the image. Please try again.",
            task_type=request.task_type
        )
        
    except Exception as e:
        logger.error(f"Image analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== NEW ENDPOINTS FOR ENHANCED FEATURES ==============

@api_router.post("/line-mentoring", response_model=LineMentoringResponse)
async def line_mentoring(request: LineMentoringRequest):
    """Smart line-level mentoring - analyze specific lines with full context"""
    try:
        skill_context = get_skill_context(request.skill_level)
        mentor_persona = get_mentor_persona(request.skill_level)
        
        # Extract selected lines from code
        code_lines = request.code.split('\n')
        selected_code = '\n'.join([code_lines[i-1] if i <= len(code_lines) else '' for i in request.selected_lines])
        
        system_prompt = f"""You are a coding mentor with this persona: {mentor_persona}

{skill_context}

You are helping with specific lines of code. Analyze the selected lines in context of the full code.

RESPOND ONLY WITH VALID JSON:
{{
    "explanation": "Clear explanation of what these lines do",
    "what_it_does": "Technical description of functionality",
    "potential_issues": ["Issue 1", "Issue 2"],
    "improvement_suggestions": ["Suggestion 1", "Suggestion 2"],
    "corrected_code": "Improved version of just the selected lines (or null if no improvements needed)",
    "teaching_points": ["Key learning point 1", "Key learning point 2"]
}}

IMPORTANT:
- Consider the FULL context of the code, not just the selected lines
- Adapt explanation depth to {request.skill_level} level
- If the user asked a specific question, answer it directly
- Be a mentor, not just a critic - teach, don't just fix"""
        
        chat = get_chat_instance(system_prompt)
        
        question_context = f"\n\nUser's question: {request.question}" if request.question else ""
        
        user_msg = UserMessage(text=f"""Help me understand these lines of {request.language} code:

FULL CODE CONTEXT:
```{request.language}
{request.code}
```

SELECTED LINES ({', '.join(map(str, request.selected_lines))}):
```{request.language}
{selected_code}
```
{question_context}""")
        
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {
            "explanation": "Let me explain these lines...",
            "what_it_does": "This code performs...",
            "potential_issues": [],
            "improvement_suggestions": [],
            "corrected_code": None,
            "teaching_points": []
        })
        
        return LineMentoringResponse(
            explanation=data.get("explanation", ""),
            what_it_does=data.get("what_it_does", ""),
            potential_issues=data.get("potential_issues", []),
            improvement_suggestions=data.get("improvement_suggestions", []),
            corrected_code=data.get("corrected_code"),
            teaching_points=data.get("teaching_points", [])
        )
        
    except Exception as e:
        logger.error(f"Line mentoring error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/session-memory/store", response_model=SessionMemoryResponse)
async def store_session_memory(request: SessionMemoryRequest):
    """Store a fix/issue in session memory for repetition detection"""
    try:
        memory_entry = {
            "session_id": request.session_id,
            "issue_type": request.issue_type,
            "issue_description": request.issue_description,
            "fix_applied": request.fix_applied,
            "skill_level": request.skill_level,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await sessions_collection.insert_one(memory_entry)
        
        return SessionMemoryResponse(
            stored=True,
            message="Issue and fix stored in session memory"
        )
        
    except Exception as e:
        logger.error(f"Session memory store error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/session-memory/check-repetition", response_model=CheckRepetitionResponse)
async def check_repetition(request: CheckRepetitionRequest):
    """Check if an issue has been encountered before in this session"""
    try:
        # Find similar issues in session
        similar_issues = await sessions_collection.find({
            "session_id": request.session_id
        }).to_list(100)
        
        if not similar_issues:
            return CheckRepetitionResponse(
                is_repeated=False,
                previous_fix=None,
                escalation_message=None,
                higher_level_tip=None
            )
        
        # Use AI to check if current issue matches any previous ones
        system_prompt = """You are checking if a coding issue has been seen before in a session.

Respond ONLY with valid JSON:
{
    "is_repeated": true or false,
    "matched_issue_index": 0 (index of matched issue, or -1 if not repeated),
    "escalation_message": "Message about having seen this before (null if not repeated)",
    "higher_level_tip": "A more advanced tip since they've seen this before (null if not repeated)"
}"""
        
        chat = get_chat_instance(system_prompt)
        
        previous_issues = "\n".join([f"{i}. {issue['issue_type']}: {issue['issue_description']}" for i, issue in enumerate(similar_issues)])
        
        user_msg = UserMessage(text=f"""Current issue:
{request.current_issue}

Code context:
{request.code_context}

Previous issues in this session:
{previous_issues}

Is this a repeated issue?""")
        
        response = await chat.send_message(user_msg)
        data = safe_parse_json(response, {"is_repeated": False})
        
        previous_fix = None
        if data.get("is_repeated") and data.get("matched_issue_index", -1) >= 0:
            idx = data["matched_issue_index"]
            if idx < len(similar_issues):
                previous_fix = similar_issues[idx].get("fix_applied")
        
        return CheckRepetitionResponse(
            is_repeated=data.get("is_repeated", False),
            previous_fix=previous_fix,
            escalation_message=data.get("escalation_message"),
            higher_level_tip=data.get("higher_level_tip")
        )
        
    except Exception as e:
        logger.error(f"Check repetition error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/upload-project")
async def upload_project(file: UploadFile = File(...)):
    """Upload and analyze a project ZIP file"""
    try:
        project_id = str(uuid.uuid4())
        files_data = []
        
        # Read ZIP file
        content = await file.read()
        
        with zipfile.ZipFile(io.BytesIO(content), 'r') as zip_ref:
            for zip_info in zip_ref.infolist():
                if zip_info.is_dir():
                    continue
                    
                # Skip binary and large files
                if zip_info.file_size > 100000:  # 100KB limit per file
                    continue
                    
                filename = zip_info.filename
                ext = Path(filename).suffix.lower()
                
                # Skip non-code files
                skip_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', 
                                  '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4',
                                  '.zip', '.tar', '.gz', '.exe', '.dll', '.so'}
                if ext in skip_extensions:
                    continue
                
                try:
                    file_content = zip_ref.read(zip_info.filename).decode('utf-8')
                    files_data.append({
                        "path": filename,
                        "content": file_content[:10000],  # Limit content size
                        "language": detect_language_from_extension(filename)
                    })
                except:
                    continue
        
        # Store project in database
        await projects_collection.insert_one({
            "project_id": project_id,
            "name": file.filename,
            "files": files_data,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {"project_id": project_id, "files_count": len(files_data), "files": [f["path"] for f in files_data]}
        
    except Exception as e:
        logger.error(f"Project upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/analyze-project", response_model=ProjectAnalysisResponse)
async def analyze_project(project_id: str = Form(...), skill_level: str = Form("intermediate")):
    """Analyze uploaded project and create learning roadmap"""
    try:
        project = await projects_collection.find_one({"project_id": project_id})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        skill_context = get_skill_context(skill_level)
        
        # Prepare file summary for AI
        files_summary = "\n".join([f"- {f['path']} ({f['language']}): {len(f['content'])} chars" for f in project['files'][:50]])
        
        # Get sample of key files
        key_files_content = ""
        for f in project['files'][:10]:
            key_files_content += f"\n--- {f['path']} ---\n{f['content'][:2000]}\n"
        
        system_prompt = f"""You are an expert software architect analyzing a codebase.

{skill_context}

Analyze this project and create a learning roadmap.

RESPOND ONLY WITH VALID JSON:
{{
    "project_name": "Detected project name",
    "purpose": "What this project does",
    "entry_points": ["main.py", "index.js", etc],
    "main_modules": [
        {{"name": "Module name", "purpose": "What it does", "files": ["file1.py", "file2.py"]}}
    ],
    "dependencies": ["dependency1", "dependency2"],
    "architecture_overview": "High-level architecture description",
    "learning_roadmap": {{
        "beginner": ["Step 1", "Step 2"],
        "intermediate": ["Step 1", "Step 2"],
        "advanced": ["Step 1", "Step 2"]
    }}
}}"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"""Analyze this project:

Files in project:
{files_summary}

Sample file contents:
{key_files_content}

Create a learning roadmap for a {skill_level} developer.""")
        
        response = await chat.send_message(user_msg)
        data = safe_parse_json(response, {
            "project_name": project['name'],
            "purpose": "Unknown",
            "entry_points": [],
            "main_modules": [],
            "dependencies": [],
            "architecture_overview": "Analysis pending",
            "learning_roadmap": {"beginner": [], "intermediate": [], "advanced": []}
        })
        
        return ProjectAnalysisResponse(**data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Project analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/generate-learning-journey", response_model=LearningJourneyResponse)
async def generate_learning_journey(request: LearningJourneyRequest):
    """Generate a step-by-step learning journey for a project"""
    try:
        project = await projects_collection.find_one({"project_id": request.project_id})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        skill_context = get_skill_context(request.skill_level)
        
        files_summary = "\n".join([f"- {f['path']}" for f in project['files'][:30]])
        
        focus_instruction = f"Focus area: {request.focus_area}" if request.focus_area else ""
        
        system_prompt = f"""You are an expert coding tutor creating personalized learning journeys.

{skill_context}

Create a step-by-step learning journey through this codebase.

RESPOND ONLY WITH VALID JSON:
{{
    "journey_steps": [
        {{
            "step_number": 1,
            "file": "filename.py",
            "title": "Step title",
            "description": "What to learn in this step",
            "concepts": ["concept1", "concept2"],
            "estimated_time": "10 minutes"
        }}
    ],
    "estimated_time": "2 hours total",
    "key_concepts": ["Main concept 1", "Main concept 2"]
}}

RULES:
1. Order files logically - start with entry points, then core modules
2. Each step should build on previous steps
3. Adapt complexity to {request.skill_level} level
4. Include practical exercises where appropriate"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"""Create a learning journey for this project:

Project: {project['name']}
Files:
{files_summary}

Skill level: {request.skill_level}
{focus_instruction}""")
        
        response = await chat.send_message(user_msg)
        data = safe_parse_json(response, {
            "journey_steps": [],
            "estimated_time": "Unknown",
            "key_concepts": []
        })
        
        return LearningJourneyResponse(**data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Learning journey error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/execute-code", response_model=CodeExecutionResponse)
async def execute_code(request: CodeExecutionRequest):
    """Execute code and provide error explanations"""
    try:
        import subprocess
        import time
        
        skill_context = get_skill_context(request.skill_level)
        
        output = ""
        error = None
        execution_time = 0.0
        error_explanation = None
        fix_suggestion = None
        
        if request.language == "python":
            # Create temp file and execute
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
                f.write(request.code)
                temp_file = f.name
            
            try:
                start_time = time.time()
                result = subprocess.run(
                    ['python', temp_file],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                execution_time = time.time() - start_time
                
                output = result.stdout
                if result.returncode != 0:
                    error = result.stderr
            except subprocess.TimeoutExpired:
                error = "Execution timed out (10 second limit)"
            except Exception as e:
                error = str(e)
            finally:
                os.unlink(temp_file)
        
        elif request.language == "javascript":
            with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
                f.write(request.code)
                temp_file = f.name
            
            try:
                start_time = time.time()
                result = subprocess.run(
                    ['node', temp_file],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                execution_time = time.time() - start_time
                
                output = result.stdout
                if result.returncode != 0:
                    error = result.stderr
            except subprocess.TimeoutExpired:
                error = "Execution timed out (10 second limit)"
            except Exception as e:
                error = str(e)
            finally:
                os.unlink(temp_file)
        else:
            error = f"Execution not supported for {request.language}. Supported: Python, JavaScript"
        
        # If there's an error, get AI explanation
        if error:
            system_prompt = f"""You are a coding mentor explaining runtime errors.

{skill_context}

Respond ONLY with valid JSON:
{{
    "error_explanation": "Clear explanation of what went wrong",
    "fix_suggestion": "How to fix it"
}}"""
            
            chat = get_chat_instance(system_prompt)
            user_msg = UserMessage(text=f"""Explain this error to a {request.skill_level} developer:

Code:
```{request.language}
{request.code}
```

Error:
{error}""")
            
            response = await chat.send_message(user_msg)
            data = safe_parse_json(response, {})
            error_explanation = data.get("error_explanation")
            fix_suggestion = data.get("fix_suggestion")
        
        return CodeExecutionResponse(
            output=output,
            error=error,
            execution_time=execution_time,
            error_explanation=error_explanation,
            fix_suggestion=fix_suggestion
        )
        
    except Exception as e:
        logger.error(f"Code execution error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/proactive-mentor", response_model=ProactiveMentorResponse)
async def proactive_mentor(request: ProactiveMentorRequest):
    """Proactively detect issues while coding"""
    try:
        skill_context = get_skill_context(request.skill_level)
        
        system_prompt = f"""You are a proactive coding mentor watching live code.

{skill_context}

Detect common mistakes in the code:
- Async misuse (missing await, callback issues)
- State mutation problems
- Off-by-one errors
- Bad patterns (god functions, tight coupling)
- Security issues (SQL injection, XSS)
- Performance anti-patterns

ONLY interrupt for REAL issues, not style preferences.

RESPOND ONLY WITH VALID JSON:
{{
    "has_issue": true or false,
    "issue_type": "Type of issue (e.g., 'async_misuse', 'security', 'logic_error')",
    "message": "Brief, friendly message explaining the issue",
    "severity": "critical|warning|info",
    "quick_fix": "One-line fix suggestion if applicable"
}}

Be selective - only flag actual bugs or important patterns for {request.skill_level} level developers."""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"""Check this {request.language} code for issues:

```{request.language}
{request.code}
```

Developer skill level: {request.skill_level}""")
        
        response = await chat.send_message(user_msg)
        data = safe_parse_json(response, {"has_issue": False})
        
        return ProactiveMentorResponse(
            has_issue=data.get("has_issue", False),
            issue_type=data.get("issue_type"),
            message=data.get("message"),
            severity=data.get("severity", "info"),
            quick_fix=data.get("quick_fix")
        )
        
    except Exception as e:
        logger.error(f"Proactive mentor error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/generate-smart-question", response_model=SmartQuestionResponse)
async def generate_smart_question(request: SmartQuestionRequest):
    """Generate intelligent follow-up questions to verify understanding"""
    try:
        skill_context = get_skill_context(request.skill_level)
        
        previous_q_context = ""
        if request.previous_questions:
            previous_q_context = f"Previously asked questions (don't repeat): {', '.join(request.previous_questions)}"
        
        system_prompt = f"""You are a coding mentor creating questions to verify understanding.

{skill_context}

Create a question appropriate for a {request.skill_level} level developer.

RESPOND ONLY WITH VALID JSON:
{{
    "question": "The question to ask",
    "expected_answer_hints": ["Key point 1 to look for", "Key point 2"],
    "difficulty": "easy|medium|hard"
}}

{previous_q_context}

RULES:
- Beginner: Simple recall and basic application questions
- Intermediate: Application and analysis questions
- Advanced: Synthesis and evaluation questions
- Senior: Architecture and design trade-off questions"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"""Generate a question about: {request.concept_taught}

Skill level: {request.skill_level}""")
        
        response = await chat.send_message(user_msg)
        data = safe_parse_json(response, {
            "question": f"Can you explain {request.concept_taught} in your own words?",
            "expected_answer_hints": ["Understanding of the core concept"],
            "difficulty": "medium"
        })
        
        return SmartQuestionResponse(**data)
        
    except Exception as e:
        logger.error(f"Smart question error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/project/{project_id}/files")
async def get_project_files(project_id: str):
    """Get files from an uploaded project"""
    try:
        project = await projects_collection.find_one({"project_id": project_id})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        return {"files": project.get("files", [])}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get project files error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/session-memory/{session_id}")
async def clear_session_memory(session_id: str):
    """Clear session memory"""
    try:
        result = await sessions_collection.delete_many({"session_id": session_id})
        return {"deleted": result.deleted_count}
    except Exception as e:
        logger.error(f"Clear session memory error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

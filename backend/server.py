from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'live_code_mentor')]

# Emergent LLM Setup
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI(title="Live Code Mentor API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== MODELS ==============

class CodeAnalysisRequest(BaseModel):
    code: str
    language: str

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

class TeachingResponse(BaseModel):
    conceptName: str
    naturalExplanation: str
    whyItMatters: str
    commonMistake: str

class DeeperExplanationRequest(BaseModel):
    conceptName: str
    currentExplanation: str

class DeeperExplanationResponse(BaseModel):
    deeperExplanation: str
    codeExamples: List[str]
    relatedConcepts: List[str]

class VisualDiagramRequest(BaseModel):
    conceptName: str
    diagramType: str
    code: str
    explanation: str

class VisualDiagramResponse(BaseModel):
    svg: str

class EvaluateAnswerRequest(BaseModel):
    question: str
    studentAnswer: str
    correctConcept: str

class EvaluateAnswerResponse(BaseModel):
    understood: bool
    feedback: str
    encouragement: str

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

class ImageAnalysisResponse(BaseModel):
    analysis: str
    task_type: str

class FixCodeRequest(BaseModel):
    code: str
    language: str
    bugs: List[dict] = []

class FixCodeResponse(BaseModel):
    fixed_code: str
    explanation: str
    changes_made: List[str]

# ============== HELPER FUNCTIONS ==============

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
            # Remove first line (```json or ```)
            lines = lines[1:]
            # Remove last line if it's ```
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            clean_response = "\n".join(lines)
        
        return json.loads(clean_response)
    except (json.JSONDecodeError, AttributeError):
        return default

# ============== API ENDPOINTS ==============

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

@api_router.post("/analyze-code", response_model=CodeAnalysisResponse)
async def analyze_code(request: CodeAnalysisRequest):
    """Analyze code for bugs and issues"""
    try:
        system_prompt = """You are an expert code analyzer and bug detector. Your job is to find ALL bugs, potential issues, and improvements in code.

RESPOND ONLY WITH VALID JSON - NO MARKDOWN, NO EXPLANATION:
{
    "bugs": [
        {"line": 5, "severity": "critical", "message": "Description of the bug", "suggestion": "How to fix it"}
    ],
    "overall_quality": "good|fair|poor"
}

SEVERITY LEVELS:
- "critical": Runtime errors, crashes, exceptions (ZeroDivisionError, IndexError, NullPointerException, etc.)
- "warning": Logic bugs, edge cases not handled, security issues
- "info": Style improvements, performance optimizations, best practices

RULES:
1. ALWAYS check for: division by zero, empty list/array handling, null/undefined access, off-by-one errors
2. Line numbers must be accurate
3. If code has bugs, overall_quality should be "fair" or "poor"
4. Be thorough - find ALL issues, not just obvious ones"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Find ALL bugs and issues in this {request.language} code. Be thorough:\n\n```{request.language}\n{request.code}\n```")
        response = await chat.send_message(user_msg)
        
        # Parse JSON response with safe handler
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
    """Generate pedagogical explanation for a bug"""
    try:
        style_instructions = {
            "patient": "Be patient, warm, and encouraging. Use simple analogies.",
            "socratic": "Ask guiding questions to help the student discover the answer.",
            "direct": "Be clear and concise. Get straight to the point."
        }
        
        system_prompt = f"""You are a coding mentor. {style_instructions.get(request.mentorStyle, style_instructions['patient'])}
        
        Respond ONLY with valid JSON:
        {{
            "conceptName": "Name of the concept/pattern being taught",
            "naturalExplanation": "Clear explanation of what's wrong and why",
            "whyItMatters": "Why this matters in real programming",
            "commonMistake": "Why this is a common mistake and how to avoid it"
        }}"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Explain this bug to a student:\n\nCode:\n```\n{request.code}\n```\n\nBug at line {request.bug.get('line', '?')}: {request.bug.get('message', 'Unknown issue')}")
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
    """Generate a more detailed explanation"""
    try:
        system_prompt = """You are an expert programming tutor providing deep explanations.
        
        Respond ONLY with valid JSON:
        {
            "deeperExplanation": "Detailed technical explanation with more context",
            "codeExamples": ["Example code snippet 1", "Example code snippet 2"],
            "relatedConcepts": ["Related concept 1", "Related concept 2"]
        }"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Provide a deeper explanation for: {request.conceptName}\n\nCurrent explanation: {request.currentExplanation}")
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
    """Generate SVG diagram for a concept"""
    try:
        system_prompt = """You are an expert at creating educational SVG diagrams.
        
        Create a clean, professional SVG diagram (700x450px) with:
        - Dark background (#1E1E1E)
        - Google colors: Blue (#4285F4), Red (#EA4335), Yellow (#FBBC04), Green (#34A853)
        - White text (#FFFFFF) with clear labels
        - Arrows and connecting lines
        - Rounded rectangles for boxes
        
        Respond with ONLY the SVG code, no explanation. Start with <svg and end with </svg>"""
        
        diagram_instructions = {
            "state_flow": "Show state changes with arrows between boxes",
            "async_timeline": "Show async operations on a timeline with call stack",
            "closure_scope": "Show nested scopes with variable capture",
            "event_loop": "Show call stack, web APIs, and callback queue"
        }
        
        chat = get_chat_instance(system_prompt)
        instruction = diagram_instructions.get(request.diagramType, "Create an informative diagram")
        user_msg = UserMessage(text=f"Create a {request.diagramType} diagram for: {request.conceptName}\n\nContext: {request.explanation}\n\nCode:\n```\n{request.code}\n```\n\nInstruction: {instruction}")
        response = await chat.send_message(user_msg)
        
        # Extract SVG from response
        svg_content = response.strip() if response else ""
        if "<svg" in svg_content:
            start = svg_content.find("<svg")
            end = svg_content.rfind("</svg>") + 6
            svg_content = svg_content[start:end]
        else:
            # Generate a fallback SVG
            svg_content = f'''<svg viewBox="0 0 700 450" xmlns="http://www.w3.org/2000/svg">
                <rect width="700" height="450" fill="#1E1E1E"/>
                <text x="350" y="225" fill="#FFFFFF" text-anchor="middle" font-size="20">{request.conceptName}</text>
            </svg>'''
        
        return VisualDiagramResponse(svg=svg_content)
        
    except Exception as e:
        logger.error(f"Diagram generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/evaluate-answer", response_model=EvaluateAnswerResponse)
async def evaluate_answer(request: EvaluateAnswerRequest):
    """Evaluate if student understood the concept"""
    try:
        system_prompt = """You are a supportive coding mentor evaluating student understanding.
        
        Respond ONLY with valid JSON:
        {
            "understood": true or false,
            "feedback": "Specific feedback about their answer",
            "encouragement": "Encouraging message"
        }
        
        Be generous - if they show basic understanding, mark as understood."""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Question: {request.question}\n\nCorrect concept: {request.correctConcept}\n\nStudent's answer: {request.studentAnswer}\n\nDid they understand?")
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {
            "understood": True,
            "feedback": "Good effort!",
            "encouragement": "Keep learning!"
        })
        
        return EvaluateAnswerResponse(
            understood=data.get("understood", True),
            feedback=data.get("feedback", "Good effort!"),
            encouragement=data.get("encouragement", "Keep learning!")
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
        
        # Build context from history
        context = ""
        for msg in request.conversationHistory[-5:]:  # Last 5 messages for context
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
    """AI Senior fixes the code automatically"""
    try:
        bugs_context = ""
        if request.bugs:
            bugs_context = "Known bugs to fix:\n" + "\n".join([f"- Line {b.get('line', '?')}: {b.get('message', '')}" for b in request.bugs])
        
        system_prompt = """You are a senior software engineer. Your job is to fix ALL bugs in the code and return clean, working code.

RESPOND ONLY WITH VALID JSON:
{
    "fixed_code": "The complete fixed code (properly formatted, ready to run)",
    "explanation": "Brief explanation of what was fixed",
    "changes_made": ["Change 1", "Change 2", "Change 3"]
}

RULES:
1. Fix ALL bugs - division by zero, null checks, async/await issues, etc.
2. Keep the code structure similar but correct
3. Add necessary error handling
4. The fixed_code must be complete and runnable
5. Preserve comments but fix the issues they mention"""
        
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
    """Analyze uploaded image (code screenshot, whiteboard, etc.)"""
    try:
        task_prompts = {
            "code_screenshot": "Analyze this code screenshot. Identify the programming language, describe what the code does, and point out any visible bugs or issues.",
            "whiteboard": "Transcribe any handwritten code or diagrams in this whiteboard image. If it's code, identify the language and explain what it's trying to do.",
            "english_text": "Read the text in this image. Check for any grammar or spelling errors and provide corrections.",
            "general": "Analyze this educational image and provide helpful insights for learning."
        }
        
        system_prompt = f"""You are an expert at analyzing educational images.
        
        Task: {task_prompts.get(request.task_type, task_prompts['general'])}
        
        {f'Additional context: {request.additional_context}' if request.additional_context else ''}
        
        Provide a clear, helpful analysis."""
        
        chat = get_chat_instance(system_prompt)
        
        # Create image content from base64
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

from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
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

# ============== API ENDPOINTS ==============

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

@api_router.post("/analyze-code", response_model=CodeAnalysisResponse)
async def analyze_code(request: CodeAnalysisRequest):
    """Analyze code for bugs and issues"""
    try:
        system_prompt = """You are an expert code analyzer. Analyze the provided code and identify bugs, issues, and improvements.
        
        IMPORTANT: Respond ONLY with valid JSON in this exact format:
        {
            "bugs": [
                {"line": 1, "severity": "critical|warning|info", "message": "description", "suggestion": "how to fix"}
            ],
            "overall_quality": "good|fair|poor"
        }
        
        Rules:
        - If code is good, return empty bugs array and "good" quality
        - severity: "critical" for syntax/runtime errors, "warning" for logic issues, "info" for style/optimization
        - Be specific about line numbers
        - Keep messages concise but helpful"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Analyze this {request.language} code:\n\n```{request.language}\n{request.code}\n```")
        response = await chat.send_message(user_msg)
        
        # Parse JSON response
        import json
        try:
            # Clean response if wrapped in markdown
            clean_response = response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("\n", 1)[1]
                clean_response = clean_response.rsplit("```", 1)[0]
            
            data = json.loads(clean_response)
            return CodeAnalysisResponse(
                bugs=[Bug(**b) for b in data.get("bugs", [])],
                overall_quality=data.get("overall_quality", "fair")
            )
        except json.JSONDecodeError:
            # Fallback if AI doesn't return proper JSON
            return CodeAnalysisResponse(bugs=[], overall_quality="good")
            
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
        
        import json
        try:
            clean_response = response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("\n", 1)[1]
                clean_response = clean_response.rsplit("```", 1)[0]
            data = json.loads(clean_response)
            return TeachingResponse(**data)
        except json.JSONDecodeError:
            return TeachingResponse(
                conceptName="Code Issue",
                naturalExplanation=response,
                whyItMatters="Understanding this helps write better code.",
                commonMistake="This is a common pattern that trips up many developers."
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
        
        import json
        try:
            clean_response = response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("\n", 1)[1]
                clean_response = clean_response.rsplit("```", 1)[0]
            data = json.loads(clean_response)
            return DeeperExplanationResponse(**data)
        except json.JSONDecodeError:
            return DeeperExplanationResponse(
                deeperExplanation=response,
                codeExamples=[],
                relatedConcepts=[]
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
        svg_content = response.strip()
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
        
        import json
        try:
            clean_response = response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("\n", 1)[1]
                clean_response = clean_response.rsplit("```", 1)[0]
            data = json.loads(clean_response)
            return EvaluateAnswerResponse(**data)
        except json.JSONDecodeError:
            return EvaluateAnswerResponse(
                understood=True,
                feedback="Good effort!",
                encouragement="Keep learning!"
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
        
        import json
        try:
            clean_response = response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("\n", 1)[1]
                clean_response = clean_response.rsplit("```", 1)[0]
            data = json.loads(clean_response)
            return EnglishChatResponse(
                response=data.get("response", response),
                intent=data.get("intent", "conversation"),
                corrections=[Correction(**c) for c in data.get("corrections", [])]
            )
        except json.JSONDecodeError:
            return EnglishChatResponse(
                response=response,
                intent="conversation",
                corrections=[]
            )
            
    except Exception as e:
        logger.error(f"English chat error: {e}")
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
            analysis=response,
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

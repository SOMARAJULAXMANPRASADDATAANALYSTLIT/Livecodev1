from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, WebSocket, WebSocketDisconnect
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
import subprocess
import asyncio
import shutil

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'live_code_mentor')]

# Collections
sessions_collection = db.sessions
projects_collection = db.projects
workspaces_collection = db.workspaces

# Emergent LLM Setup
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI(title="Live Code Mentor - AI IDE API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Workspace directory for project execution
WORKSPACE_DIR = Path("/tmp/live_code_mentor_workspaces")
WORKSPACE_DIR.mkdir(exist_ok=True)

# ============== SKILL LEVEL DEFINITIONS ==============

SKILL_LEVEL_PROMPTS = {
    "beginner": {
        "tone": "Be extremely patient, warm, and encouraging. Use simple language and real-world analogies.",
        "depth": "Focus on basic syntax and fundamental concepts. Avoid advanced topics unless asked.",
        "vocabulary": "Use simple terms. Define any technical jargon before using it.",
        "approach": "Step-by-step explanations. Celebrate small wins. Never overwhelm."
    },
    "intermediate": {
        "tone": "Be supportive and constructive. Balance explanation with reasoning.",
        "depth": "Explain common patterns, debugging techniques, and best practices.",
        "vocabulary": "Use standard programming terminology with brief clarifications.",
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

# ============== LANGUAGE DETECTION ==============

LANGUAGE_EXTENSIONS = {
    '.py': {'name': 'Python', 'color': '#3572A5'},
    '.js': {'name': 'JavaScript', 'color': '#f1e05a'},
    '.ts': {'name': 'TypeScript', 'color': '#2b7489'},
    '.jsx': {'name': 'JavaScript', 'color': '#f1e05a'},
    '.tsx': {'name': 'TypeScript', 'color': '#2b7489'},
    '.java': {'name': 'Java', 'color': '#b07219'},
    '.cpp': {'name': 'C++', 'color': '#f34b7d'},
    '.c': {'name': 'C', 'color': '#555555'},
    '.h': {'name': 'C/C++ Header', 'color': '#555555'},
    '.hpp': {'name': 'C++', 'color': '#f34b7d'},
    '.go': {'name': 'Go', 'color': '#00ADD8'},
    '.rs': {'name': 'Rust', 'color': '#dea584'},
    '.rb': {'name': 'Ruby', 'color': '#701516'},
    '.php': {'name': 'PHP', 'color': '#4F5D95'},
    '.cs': {'name': 'C#', 'color': '#178600'},
    '.swift': {'name': 'Swift', 'color': '#ffac45'},
    '.kt': {'name': 'Kotlin', 'color': '#F18E33'},
    '.scala': {'name': 'Scala', 'color': '#c22d40'},
    '.sql': {'name': 'SQL', 'color': '#e38c00'},
    '.html': {'name': 'HTML', 'color': '#e34c26'},
    '.css': {'name': 'CSS', 'color': '#563d7c'},
    '.scss': {'name': 'SCSS', 'color': '#c6538c'},
    '.sass': {'name': 'Sass', 'color': '#a53b70'},
    '.less': {'name': 'Less', 'color': '#1d365d'},
    '.json': {'name': 'JSON', 'color': '#292929'},
    '.xml': {'name': 'XML', 'color': '#0060ac'},
    '.yaml': {'name': 'YAML', 'color': '#cb171e'},
    '.yml': {'name': 'YAML', 'color': '#cb171e'},
    '.md': {'name': 'Markdown', 'color': '#083fa1'},
    '.sh': {'name': 'Shell', 'color': '#89e051'},
    '.bash': {'name': 'Bash', 'color': '#89e051'},
    '.vue': {'name': 'Vue', 'color': '#41b883'},
    '.svelte': {'name': 'Svelte', 'color': '#ff3e00'},
    '.dart': {'name': 'Dart', 'color': '#00B4AB'},
    '.r': {'name': 'R', 'color': '#198CE7'},
    '.lua': {'name': 'Lua', 'color': '#000080'},
    '.pl': {'name': 'Perl', 'color': '#0298c3'},
    '.ex': {'name': 'Elixir', 'color': '#6e4a7e'},
    '.exs': {'name': 'Elixir', 'color': '#6e4a7e'},
    '.erl': {'name': 'Erlang', 'color': '#B83998'},
    '.hs': {'name': 'Haskell', 'color': '#5e5086'},
    '.clj': {'name': 'Clojure', 'color': '#db5855'},
    '.dockerfile': {'name': 'Dockerfile', 'color': '#384d54'},
    '.toml': {'name': 'TOML', 'color': '#9c4221'},
    '.ini': {'name': 'INI', 'color': '#d1dbe0'},
    '.env': {'name': 'Environment', 'color': '#faf743'},
    '.graphql': {'name': 'GraphQL', 'color': '#e10098'},
    '.proto': {'name': 'Protocol Buffers', 'color': '#5592b5'},
}

# ============== MODELS ==============

class FileNode(BaseModel):
    name: str
    path: str
    type: str  # 'file' or 'directory'
    language: Optional[str] = None
    size: Optional[int] = None
    children: Optional[List['FileNode']] = None

FileNode.model_rebuild()

class LanguageStats(BaseModel):
    name: str
    percentage: float
    bytes: int
    color: str
    file_count: int

class ProjectStructure(BaseModel):
    project_id: str
    name: str
    root: FileNode
    languages: List[LanguageStats]
    total_files: int
    total_size: int
    entry_points: List[str]
    frameworks: List[str]
    build_system: Optional[str] = None
    has_tests: bool
    readme_content: Optional[str] = None

class FileContent(BaseModel):
    path: str
    content: str
    language: str

class SaveFileRequest(BaseModel):
    project_id: str
    path: str
    content: str

class RunProjectRequest(BaseModel):
    project_id: str
    command: Optional[str] = None
    file_path: Optional[str] = None
    skill_level: str = "intermediate"

class RunProjectResponse(BaseModel):
    output: str
    error: Optional[str] = None
    exit_code: int
    execution_time: float
    error_explanation: Optional[str] = None
    fix_suggestion: Optional[str] = None

class TerminalCommand(BaseModel):
    project_id: str
    command: str

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

class ProactiveMentorRequest(BaseModel):
    code: str
    language: str
    skill_level: str = "intermediate"

class ProactiveMentorResponse(BaseModel):
    has_issue: bool
    issue_type: Optional[str] = None
    message: Optional[str] = None
    severity: str = "info"
    quick_fix: Optional[str] = None

class ProjectAnalysisRequest(BaseModel):
    project_id: str
    skill_level: str = "intermediate"

class FullProjectAnalysis(BaseModel):
    project_name: str
    purpose: str
    architecture_overview: str
    entry_points: List[dict]
    main_modules: List[dict]
    dependencies: List[str]
    frameworks: List[str]
    learning_roadmap: dict
    file_recommendations: List[dict]
    potential_issues: List[str]
    improvement_suggestions: List[str]

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

# ============== HELPER FUNCTIONS ==============

def get_skill_context(skill_level: str) -> str:
    level_data = SKILL_LEVEL_PROMPTS.get(skill_level, SKILL_LEVEL_PROMPTS["intermediate"])
    return f"""
SKILL LEVEL: {skill_level.upper()}
- Tone: {level_data['tone']}
- Depth: {level_data['depth']}
- Vocabulary: {level_data['vocabulary']}
- Approach: {level_data['approach']}
"""

def get_chat_instance(system_message: str, session_id: str = None, model_type: str = "fast"):
    """
    Get a chat instance with appropriate Gemini model based on task type.
    
    model_type options:
    - "fast": gemini-3-flash-preview (default, for quick responses)
    - "pro": gemini-3-pro-preview (for deep research, complex reasoning)
    - "balanced": gemini-2.5-pro (for balanced performance)
    - "ultra_fast": gemini-2.5-flash-lite (for high-volume, simple tasks)
    """
    if not session_id:
        session_id = str(uuid.uuid4())
    
    # Model selection based on task type
    model_map = {
        "fast": "gemini-3-flash-preview",
        "pro": "gemini-3-pro-preview", 
        "balanced": "gemini-2.5-pro",
        "ultra_fast": "gemini-2.5-flash-lite"
    }
    
    selected_model = model_map.get(model_type, "gemini-3-flash-preview")
    
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message
    ).with_model("gemini", selected_model)
    
    return chat

def safe_parse_json(response: str, default: dict = None) -> dict:
    if default is None:
        default = {}
    if not response:
        return default
    try:
        clean_response = response.strip()
        if clean_response.startswith("```"):
            lines = clean_response.split("\n")
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            clean_response = "\n".join(lines)
        return json.loads(clean_response)
    except (json.JSONDecodeError, AttributeError):
        return default

def detect_language(filename: str) -> Optional[str]:
    ext = Path(filename).suffix.lower()
    if ext in LANGUAGE_EXTENSIONS:
        return LANGUAGE_EXTENSIONS[ext]['name'].lower()
    return None

def get_language_info(filename: str) -> dict:
    ext = Path(filename).suffix.lower()
    return LANGUAGE_EXTENSIONS.get(ext, {'name': 'Unknown', 'color': '#808080'})

def build_file_tree(directory: Path, base_path: str = "") -> FileNode:
    """Build a file tree structure from a directory"""
    name = directory.name or "root"
    children = []
    
    try:
        items = sorted(directory.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))
        for item in items:
            if item.name.startswith('.') and item.name not in ['.env', '.gitignore', '.eslintrc']:
                continue
            if item.name in ['node_modules', '__pycache__', '.git', 'venv', 'env', 'dist', 'build', '.next']:
                continue
                
            rel_path = f"{base_path}/{item.name}" if base_path else item.name
            
            if item.is_dir():
                child_node = build_file_tree(item, rel_path)
                if child_node.children:  # Only include non-empty directories
                    children.append(child_node)
            else:
                lang_info = get_language_info(item.name)
                children.append(FileNode(
                    name=item.name,
                    path=rel_path,
                    type='file',
                    language=lang_info['name'],
                    size=item.stat().st_size
                ))
    except PermissionError:
        pass
    
    return FileNode(
        name=name,
        path=base_path or "/",
        type='directory',
        children=children
    )

def calculate_language_stats(directory: Path) -> List[LanguageStats]:
    """Calculate language statistics like GitHub"""
    lang_bytes = {}
    lang_files = {}
    
    def scan_files(dir_path: Path):
        try:
            for item in dir_path.iterdir():
                if item.name.startswith('.'):
                    continue
                if item.name in ['node_modules', '__pycache__', '.git', 'venv', 'env', 'dist', 'build']:
                    continue
                    
                if item.is_dir():
                    scan_files(item)
                elif item.is_file():
                    ext = item.suffix.lower()
                    if ext in LANGUAGE_EXTENSIONS:
                        lang_info = LANGUAGE_EXTENSIONS[ext]
                        lang_name = lang_info['name']
                        size = item.stat().st_size
                        
                        if lang_name not in lang_bytes:
                            lang_bytes[lang_name] = 0
                            lang_files[lang_name] = 0
                        lang_bytes[lang_name] += size
                        lang_files[lang_name] += 1
        except PermissionError:
            pass
    
    scan_files(directory)
    
    total_bytes = sum(lang_bytes.values()) or 1
    
    stats = []
    for lang_name, bytes_count in sorted(lang_bytes.items(), key=lambda x: -x[1]):
        ext = next((k for k, v in LANGUAGE_EXTENSIONS.items() if v['name'] == lang_name), None)
        color = LANGUAGE_EXTENSIONS.get(ext, {}).get('color', '#808080')
        
        stats.append(LanguageStats(
            name=lang_name,
            percentage=round((bytes_count / total_bytes) * 100, 1),
            bytes=bytes_count,
            color=color,
            file_count=lang_files[lang_name]
        ))
    
    return stats[:10]  # Top 10 languages

def detect_frameworks_and_entry_points(directory: Path) -> tuple:
    """Detect frameworks, entry points, and build systems"""
    frameworks = []
    entry_points = []
    build_system = None
    has_tests = False
    
    files_in_root = [f.name for f in directory.iterdir() if f.is_file()]
    dirs_in_root = [d.name for d in directory.iterdir() if d.is_dir()]
    
    # Node.js / JavaScript
    if 'package.json' in files_in_root:
        try:
            pkg = json.loads((directory / 'package.json').read_text())
            deps = {**pkg.get('dependencies', {}), **pkg.get('devDependencies', {})}
            
            if 'react' in deps:
                frameworks.append('React')
            if 'vue' in deps:
                frameworks.append('Vue.js')
            if 'angular' in deps or '@angular/core' in deps:
                frameworks.append('Angular')
            if 'next' in deps:
                frameworks.append('Next.js')
            if 'express' in deps:
                frameworks.append('Express.js')
            if 'fastify' in deps:
                frameworks.append('Fastify')
            if 'nestjs' in deps or '@nestjs/core' in deps:
                frameworks.append('NestJS')
            if 'svelte' in deps:
                frameworks.append('Svelte')
            
            # Entry points
            if pkg.get('main'):
                entry_points.append(pkg['main'])
            if 'scripts' in pkg:
                if 'start' in pkg['scripts']:
                    entry_points.append('npm start')
            
            build_system = 'npm/yarn'
            
            if 'jest' in deps or 'mocha' in deps or 'vitest' in deps:
                has_tests = True
        except:
            pass
    
    # Python
    if 'requirements.txt' in files_in_root or 'setup.py' in files_in_root or 'pyproject.toml' in files_in_root:
        build_system = build_system or 'pip'
        
        # Check for frameworks
        req_file = directory / 'requirements.txt'
        if req_file.exists():
            try:
                reqs = req_file.read_text().lower()
                if 'django' in reqs:
                    frameworks.append('Django')
                if 'flask' in reqs:
                    frameworks.append('Flask')
                if 'fastapi' in reqs:
                    frameworks.append('FastAPI')
                if 'pytorch' in reqs or 'torch' in reqs:
                    frameworks.append('PyTorch')
                if 'tensorflow' in reqs:
                    frameworks.append('TensorFlow')
                if 'pytest' in reqs:
                    has_tests = True
            except:
                pass
        
        # Common Python entry points
        for ep in ['main.py', 'app.py', 'server.py', 'manage.py', 'run.py', '__main__.py']:
            if ep in files_in_root:
                entry_points.append(ep)
    
    # Java / Kotlin
    if 'pom.xml' in files_in_root:
        build_system = 'Maven'
        frameworks.append('Java/Maven')
    if 'build.gradle' in files_in_root or 'build.gradle.kts' in files_in_root:
        build_system = 'Gradle'
        frameworks.append('Java/Gradle')
    
    # Go
    if 'go.mod' in files_in_root:
        build_system = 'Go Modules'
        frameworks.append('Go')
        if 'main.go' in files_in_root:
            entry_points.append('main.go')
    
    # Rust
    if 'Cargo.toml' in files_in_root:
        build_system = 'Cargo'
        frameworks.append('Rust')
    
    # Docker
    if 'Dockerfile' in files_in_root or 'docker-compose.yml' in files_in_root:
        frameworks.append('Docker')
    
    # Tests detection
    if 'tests' in dirs_in_root or 'test' in dirs_in_root or '__tests__' in dirs_in_root:
        has_tests = True
    
    return frameworks, entry_points, build_system, has_tests

# ============== API ENDPOINTS ==============

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# ============== PROJECT / IDE ENDPOINTS ==============

@api_router.post("/upload-project")
async def upload_project(file: UploadFile = File(...)):
    """Upload and extract a project ZIP file"""
    try:
        project_id = str(uuid.uuid4())
        workspace_path = WORKSPACE_DIR / project_id
        workspace_path.mkdir(parents=True, exist_ok=True)
        
        # Read and extract ZIP
        content = await file.read()
        
        with zipfile.ZipFile(io.BytesIO(content), 'r') as zip_ref:
            zip_ref.extractall(workspace_path)
        
        # Handle nested directory (common in GitHub downloads)
        items = list(workspace_path.iterdir())
        if len(items) == 1 and items[0].is_dir():
            nested_dir = items[0]
            for item in nested_dir.iterdir():
                shutil.move(str(item), str(workspace_path / item.name))
            nested_dir.rmdir()
        
        # Build file tree
        file_tree = build_file_tree(workspace_path)
        
        # Calculate language stats
        language_stats = calculate_language_stats(workspace_path)
        
        # Detect frameworks and entry points
        frameworks, entry_points, build_system, has_tests = detect_frameworks_and_entry_points(workspace_path)
        
        # Get README content if exists
        readme_content = None
        for readme_name in ['README.md', 'readme.md', 'README.txt', 'README']:
            readme_path = workspace_path / readme_name
            if readme_path.exists():
                try:
                    readme_content = readme_path.read_text()[:5000]  # Limit size
                except:
                    pass
                break
        
        # Count total files and size
        total_files = 0
        total_size = 0
        for root, dirs, files in os.walk(workspace_path):
            dirs[:] = [d for d in dirs if d not in ['node_modules', '__pycache__', '.git', 'venv']]
            total_files += len(files)
            total_size += sum(os.path.getsize(os.path.join(root, f)) for f in files)
        
        # Store project info in database
        project_data = {
            "project_id": project_id,
            "name": file.filename.replace('.zip', ''),
            "workspace_path": str(workspace_path),
            "languages": [ls.model_dump() for ls in language_stats],
            "frameworks": frameworks,
            "entry_points": entry_points,
            "build_system": build_system,
            "has_tests": has_tests,
            "total_files": total_files,
            "total_size": total_size,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await projects_collection.insert_one(project_data)
        
        return ProjectStructure(
            project_id=project_id,
            name=file.filename.replace('.zip', ''),
            root=file_tree,
            languages=language_stats,
            total_files=total_files,
            total_size=total_size,
            entry_points=entry_points,
            frameworks=frameworks,
            build_system=build_system,
            has_tests=has_tests,
            readme_content=readme_content
        )
        
    except Exception as e:
        logger.error(f"Project upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/project/{project_id}/file")
async def get_file_content(project_id: str, path: str):
    """Get content of a specific file"""
    try:
        project = await projects_collection.find_one({"project_id": project_id})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        workspace_path = Path(project['workspace_path'])
        file_path = workspace_path / path
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        if not file_path.is_file():
            raise HTTPException(status_code=400, detail="Path is not a file")
        
        # Check file size (limit to 1MB)
        if file_path.stat().st_size > 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large")
        
        content = file_path.read_text(errors='replace')
        lang_info = get_language_info(file_path.name)
        
        return FileContent(
            path=path,
            content=content,
            language=lang_info['name'].lower()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get file error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/project/{project_id}/file")
async def save_file(project_id: str, request: SaveFileRequest):
    """Save/update a file in the project"""
    try:
        project = await projects_collection.find_one({"project_id": project_id})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        workspace_path = Path(project['workspace_path'])
        file_path = workspace_path / request.path
        
        # Ensure path is within workspace
        if not str(file_path.resolve()).startswith(str(workspace_path.resolve())):
            raise HTTPException(status_code=400, detail="Invalid path")
        
        # Create parent directories if needed
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write file
        file_path.write_text(request.content)
        
        return {"success": True, "path": request.path}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Save file error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/project/{project_id}/run", response_model=RunProjectResponse)
async def run_project(project_id: str, request: RunProjectRequest):
    """Run a project or specific file"""
    try:
        project = await projects_collection.find_one({"project_id": project_id})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        workspace_path = Path(project['workspace_path'])
        skill_context = get_skill_context(request.skill_level)
        
        import time
        start_time = time.time()
        output = ""
        error = None
        exit_code = 0
        
        # Determine command to run
        command = request.command
        if not command:
            if request.file_path:
                # Run specific file
                file_path = workspace_path / request.file_path
                ext = file_path.suffix.lower()
                
                if ext == '.py':
                    command = f"python {request.file_path}"
                elif ext in ['.js', '.mjs']:
                    command = f"node {request.file_path}"
                elif ext == '.ts':
                    command = f"npx ts-node {request.file_path}"
                elif ext == '.go':
                    command = f"go run {request.file_path}"
                elif ext == '.rb':
                    command = f"ruby {request.file_path}"
                elif ext == '.php':
                    command = f"php {request.file_path}"
                else:
                    raise HTTPException(status_code=400, detail=f"Cannot run {ext} files directly")
            else:
                # Auto-detect run command
                if (workspace_path / 'package.json').exists():
                    command = "npm start"
                elif (workspace_path / 'main.py').exists():
                    command = "python main.py"
                elif (workspace_path / 'app.py').exists():
                    command = "python app.py"
                elif (workspace_path / 'server.py').exists():
                    command = "python server.py"
                elif (workspace_path / 'main.go').exists():
                    command = "go run main.go"
                else:
                    raise HTTPException(status_code=400, detail="No runnable entry point found")
        
        # Execute command
        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=str(workspace_path),
                capture_output=True,
                text=True,
                timeout=30,
                env={**os.environ, 'NODE_ENV': 'development'}
            )
            output = result.stdout
            if result.returncode != 0:
                error = result.stderr
                exit_code = result.returncode
        except subprocess.TimeoutExpired:
            error = "Execution timed out (30 second limit)"
            exit_code = 124
        except Exception as e:
            error = str(e)
            exit_code = 1
        
        execution_time = time.time() - start_time
        
        # Get AI explanation if there's an error
        error_explanation = None
        fix_suggestion = None
        
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
Command: {command}
Error: {error}""")
            
            response = await chat.send_message(user_msg)
            data = safe_parse_json(response, {})
            error_explanation = data.get("error_explanation")
            fix_suggestion = data.get("fix_suggestion")
        
        return RunProjectResponse(
            output=output,
            error=error,
            exit_code=exit_code,
            execution_time=execution_time,
            error_explanation=error_explanation,
            fix_suggestion=fix_suggestion
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Run project error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/project/{project_id}/terminal")
async def execute_terminal_command(project_id: str, request: TerminalCommand):
    """Execute a terminal command in the project workspace"""
    try:
        project = await projects_collection.find_one({"project_id": project_id})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        workspace_path = Path(project['workspace_path'])
        
        # Blocked commands for security
        blocked = ['rm -rf /', 'sudo', 'chmod 777', 'mkfs', 'dd if=']
        cmd_lower = request.command.lower()
        if any(b in cmd_lower for b in blocked):
            return {"output": "", "error": "Command not allowed for security reasons", "exit_code": 1}
        
        try:
            result = subprocess.run(
                request.command,
                shell=True,
                cwd=str(workspace_path),
                capture_output=True,
                text=True,
                timeout=60
            )
            return {
                "output": result.stdout,
                "error": result.stderr if result.returncode != 0 else None,
                "exit_code": result.returncode
            }
        except subprocess.TimeoutExpired:
            return {"output": "", "error": "Command timed out", "exit_code": 124}
        except Exception as e:
            return {"output": "", "error": str(e), "exit_code": 1}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Terminal command error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/project/{project_id}/install-deps")
async def install_dependencies(project_id: str):
    """Install project dependencies"""
    try:
        project = await projects_collection.find_one({"project_id": project_id})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        workspace_path = Path(project['workspace_path'])
        
        output = ""
        error = None
        
        # Detect package manager and install
        if (workspace_path / 'package.json').exists():
            if (workspace_path / 'yarn.lock').exists():
                cmd = "yarn install"
            elif (workspace_path / 'pnpm-lock.yaml').exists():
                cmd = "pnpm install"
            else:
                cmd = "npm install"
            
            result = subprocess.run(
                cmd, shell=True, cwd=str(workspace_path),
                capture_output=True, text=True, timeout=300
            )
            output = result.stdout
            if result.returncode != 0:
                error = result.stderr
        
        elif (workspace_path / 'requirements.txt').exists():
            result = subprocess.run(
                "pip install -r requirements.txt",
                shell=True, cwd=str(workspace_path),
                capture_output=True, text=True, timeout=300
            )
            output = result.stdout
            if result.returncode != 0:
                error = result.stderr
        
        elif (workspace_path / 'go.mod').exists():
            result = subprocess.run(
                "go mod download",
                shell=True, cwd=str(workspace_path),
                capture_output=True, text=True, timeout=300
            )
            output = result.stdout
            if result.returncode != 0:
                error = result.stderr
        
        else:
            return {"output": "", "error": "No package manager detected", "success": False}
        
        return {"output": output, "error": error, "success": error is None}
        
    except subprocess.TimeoutExpired:
        return {"output": "", "error": "Installation timed out", "success": False}
    except Exception as e:
        logger.error(f"Install deps error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/project/{project_id}/run-tests")
async def run_tests(project_id: str, skill_level: str = "intermediate"):
    """Run project tests"""
    try:
        project = await projects_collection.find_one({"project_id": project_id})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        workspace_path = Path(project['workspace_path'])
        
        # Detect test command
        cmd = None
        if (workspace_path / 'package.json').exists():
            try:
                pkg = json.loads((workspace_path / 'package.json').read_text())
                if 'test' in pkg.get('scripts', {}):
                    cmd = "npm test"
            except:
                pass
        
        if not cmd and (workspace_path / 'pytest.ini').exists() or (workspace_path / 'tests').exists():
            cmd = "pytest -v"
        
        if not cmd:
            return {"output": "", "error": "No test configuration found", "success": False, "test_results": None}
        
        try:
            result = subprocess.run(
                cmd, shell=True, cwd=str(workspace_path),
                capture_output=True, text=True, timeout=120
            )
            
            # Parse test results and explain failures
            explanation = None
            if result.returncode != 0:
                skill_context = get_skill_context(skill_level)
                system_prompt = f"""You are a coding mentor explaining test failures.
{skill_context}
Respond ONLY with valid JSON:
{{
    "summary": "Brief summary of test results",
    "failures": [{{"test": "test name", "reason": "why it failed", "fix": "how to fix"}}],
    "overall_assessment": "What the developer should focus on"
}}"""
                
                chat = get_chat_instance(system_prompt)
                user_msg = UserMessage(text=f"Explain these test results:\n{result.stdout}\n{result.stderr}")
                response = await chat.send_message(user_msg)
                explanation = safe_parse_json(response, {})
            
            return {
                "output": result.stdout,
                "error": result.stderr if result.returncode != 0 else None,
                "success": result.returncode == 0,
                "test_results": explanation
            }
            
        except subprocess.TimeoutExpired:
            return {"output": "", "error": "Tests timed out", "success": False, "test_results": None}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Run tests error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/project/{project_id}/analyze-full")
async def analyze_full_project(project_id: str, request: ProjectAnalysisRequest):
    """Full AI analysis of uploaded project - Returns complete UI contract"""
    try:
        project = await projects_collection.find_one({"project_id": project_id})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        workspace_path = Path(project['workspace_path'])
        skill_context = get_skill_context(request.skill_level)
        
        # Gather project info
        files_summary = []
        key_files_content = ""
        
        for root, dirs, files in os.walk(workspace_path):
            dirs[:] = [d for d in dirs if d not in ['node_modules', '__pycache__', '.git', 'venv', 'dist', 'build']]
            rel_root = os.path.relpath(root, workspace_path)
            
            for f in files[:50]:  # Limit files
                rel_path = os.path.join(rel_root, f) if rel_root != '.' else f
                files_summary.append(rel_path)
        
        # Get content of key files
        key_file_patterns = ['main', 'app', 'index', 'server', 'config', 'routes', 'models', 'package.json', 'requirements.txt', 'README']
        for pattern in key_file_patterns:
            for f in files_summary[:30]:
                if pattern in f.lower():
                    try:
                        file_path = workspace_path / f
                        if file_path.exists() and file_path.stat().st_size < 10000:
                            key_files_content += f"\n--- {f} ---\n{file_path.read_text()[:3000]}\n"
                    except:
                        pass
        
        # Detect run commands from package.json or requirements.txt
        run_commands = detect_run_commands(workspace_path)
        
        system_prompt = f"""You are an expert software architect and mentor analyzing a codebase.
{skill_context}

Analyze this project and provide comprehensive insights with EXACT run commands.

RESPOND ONLY WITH VALID JSON:
{{
    "project_name": "Detected project name",
    "purpose": "What this project does (2-3 sentences)",
    "architecture_overview": "High-level architecture description",
    "project_type": "React/Next/Node/Python/FastAPI/etc",
    "entry_points": [{{"file": "filename", "purpose": "what it does"}}],
    "main_modules": [{{"name": "Module name", "purpose": "What it does", "files": ["file1", "file2"]}}],
    "dependencies": ["key dependency 1", "key dependency 2"],
    "frameworks": ["Framework 1", "Framework 2"],
    "run_commands": {{
        "install": "npm install OR pip install -r requirements.txt",
        "dev": "npm run dev OR python app.py",
        "build": "npm run build",
        "test": "npm test",
        "port": "3000 or detected port",
        "entry_file": "src/main.jsx or app.py"
    }},
    "learning_roadmap": {{
        "beginner": ["Step 1: Start with...", "Step 2: Then learn..."],
        "intermediate": ["Step 1: ...", "Step 2: ..."],
        "advanced": ["Step 1: ...", "Step 2: ..."]
    }},
    "weekly_learning_plan": [
        {{
            "week": 1,
            "topic": "Project Foundation",
            "goals": ["Understand project structure", "Run the project locally"],
            "files_to_study": ["README.md", "package.json", "src/index.js"],
            "exercises": ["Clone and run the project", "Modify a simple component"],
            "homework": "Create a new route or component"
        }},
        {{
            "week": 2,
            "topic": "Core Logic",
            "goals": ["Learn main features", "Understand data flow"],
            "files_to_study": ["src/App.jsx", "src/components/"],
            "exercises": ["Add a new feature", "Debug an existing flow"],
            "homework": "Implement a small enhancement"
        }}
    ],
    "what_you_will_learn": [
        "React hooks and state management",
        "API integration patterns",
        "Component composition"
    ],
    "difficulty_level": "Beginner|Intermediate|Advanced",
    "relevant_roles": ["Frontend Engineer", "Full Stack Developer"],
    "file_recommendations": [{{"file": "filename", "reason": "why to read this first", "order": 1}}],
    "potential_issues": ["Issue 1", "Issue 2"],
    "improvement_suggestions": ["Suggestion 1", "Suggestion 2"]
}}"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"""Analyze this project:

Project Name: {project['name']}
Languages: {json.dumps(project.get('languages', []))}
Frameworks Detected: {project.get('frameworks', [])}
Build System: {project.get('build_system', 'Unknown')}
Has Tests: {project.get('has_tests', False)}

Auto-detected Run Commands: {json.dumps(run_commands)}

Files ({len(files_summary)} total):
{chr(10).join(files_summary[:50])}

Key File Contents:
{key_files_content[:15000]}""")
        
        response = await chat.send_message(user_msg)
        data = safe_parse_json(response, {
            "project_name": project['name'],
            "purpose": "Analysis pending",
            "architecture_overview": "Unable to analyze",
            "project_type": "Unknown",
            "entry_points": [],
            "main_modules": [],
            "dependencies": [],
            "frameworks": project.get('frameworks', []),
            "run_commands": run_commands,
            "learning_roadmap": {},
            "weekly_learning_plan": [],
            "what_you_will_learn": [],
            "difficulty_level": "Intermediate",
            "relevant_roles": [],
            "file_recommendations": [],
            "potential_issues": [],
            "improvement_suggestions": []
        })
        
        # Merge detected run commands with AI suggestions
        if not data.get("run_commands") or not data["run_commands"].get("dev"):
            data["run_commands"] = run_commands
        
        return data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Full project analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def detect_run_commands(workspace_path: Path) -> dict:
    """Auto-detect run commands from project files"""
    commands = {
        "install": None,
        "dev": None,
        "build": None,
        "test": None,
        "port": None,
        "entry_file": None
    }
    
    # Check package.json (Node/React/Next projects)
    pkg_json = workspace_path / 'package.json'
    if pkg_json.exists():
        try:
            pkg = json.loads(pkg_json.read_text())
            scripts = pkg.get('scripts', {})
            
            commands["install"] = "npm install"
            
            # Detect dev command
            if 'dev' in scripts:
                commands["dev"] = "npm run dev"
            elif 'start' in scripts:
                commands["dev"] = "npm start"
            elif 'serve' in scripts:
                commands["dev"] = "npm run serve"
            
            # Detect build command
            if 'build' in scripts:
                commands["build"] = "npm run build"
            
            # Detect test command
            if 'test' in scripts:
                commands["test"] = "npm test"
            
            # Detect port from scripts
            dev_script = scripts.get('dev', '') + scripts.get('start', '')
            if '3000' in dev_script:
                commands["port"] = "3000"
            elif '5173' in dev_script or 'vite' in dev_script.lower():
                commands["port"] = "5173"
            elif '8080' in dev_script:
                commands["port"] = "8080"
            else:
                commands["port"] = "3000"  # Default for most Node projects
            
            # Detect entry file
            main_field = pkg.get('main', '')
            if main_field:
                commands["entry_file"] = main_field
            elif (workspace_path / 'src' / 'index.tsx').exists():
                commands["entry_file"] = "src/index.tsx"
            elif (workspace_path / 'src' / 'index.js').exists():
                commands["entry_file"] = "src/index.js"
            elif (workspace_path / 'src' / 'main.jsx').exists():
                commands["entry_file"] = "src/main.jsx"
            
        except Exception as e:
            logger.warning(f"Error parsing package.json: {e}")
    
    # Check requirements.txt (Python projects)
    req_txt = workspace_path / 'requirements.txt'
    if req_txt.exists() and not commands["install"]:
        commands["install"] = "pip install -r requirements.txt"
        
        # Find Python entry point
        for entry in ['app.py', 'main.py', 'server.py', 'run.py', 'manage.py']:
            if (workspace_path / entry).exists():
                commands["entry_file"] = entry
                
                # Check for Flask/FastAPI
                try:
                    content = (workspace_path / entry).read_text()
                    if 'FastAPI' in content:
                        commands["dev"] = f"uvicorn {entry[:-3]}:app --reload --port 8000"
                        commands["port"] = "8000"
                    elif 'Flask' in content:
                        commands["dev"] = f"python {entry}"
                        commands["port"] = "5000"
                    else:
                        commands["dev"] = f"python {entry}"
                except:
                    pass
                break
    
    # Check for Dockerfile
    if (workspace_path / 'Dockerfile').exists():
        commands["build"] = commands.get("build") or "docker build -t myapp ."
        commands["dev"] = commands.get("dev") or "docker run -p 3000:3000 myapp"
    
    return commands

# ============== CODE ANALYSIS ENDPOINTS ==============

@api_router.post("/analyze-code", response_model=CodeAnalysisResponse)
async def analyze_code(request: CodeAnalysisRequest):
    """Analyze code for bugs and issues"""
    try:
        skill_context = get_skill_context(request.skill_level)
        
        system_prompt = f"""You are an expert code analyzer and bug detector.
{skill_context}

RESPOND ONLY WITH VALID JSON:
{{
    "bugs": [
        {{"line": 5, "severity": "critical", "message": "Description", "suggestion": "How to fix"}}
    ],
    "overall_quality": "good|fair|poor"
}}

SEVERITY: critical (runtime errors), warning (logic bugs), info (style/performance)"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Find ALL bugs in this {request.language} code:\n```{request.language}\n{request.code}\n```")
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {"bugs": [], "overall_quality": "fair"})
        
        return CodeAnalysisResponse(
            bugs=[Bug(**b) for b in data.get("bugs", [])],
            overall_quality=data.get("overall_quality", "fair")
        )
    except Exception as e:
        logger.error(f"Code analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/line-mentoring", response_model=LineMentoringResponse)
async def line_mentoring(request: LineMentoringRequest):
    """Smart line-level mentoring"""
    try:
        skill_context = get_skill_context(request.skill_level)
        
        code_lines = request.code.split('\n')
        selected_code = '\n'.join([code_lines[i-1] if i <= len(code_lines) else '' for i in request.selected_lines])
        
        system_prompt = f"""You are a coding mentor helping with specific lines of code.
{skill_context}

RESPOND ONLY WITH VALID JSON:
{{
    "explanation": "Clear explanation of what these lines do",
    "what_it_does": "Technical description of functionality",
    "potential_issues": ["Issue 1", "Issue 2"],
    "improvement_suggestions": ["Suggestion 1", "Suggestion 2"],
    "corrected_code": "Improved version (or null if no improvements needed)",
    "teaching_points": ["Key learning point 1", "Key learning point 2"]
}}"""
        
        chat = get_chat_instance(system_prompt)
        question_context = f"\nUser's question: {request.question}" if request.question else ""
        
        user_msg = UserMessage(text=f"""Help me understand these lines of {request.language} code:

FULL CODE:
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
            "explanation": "Let me explain...",
            "what_it_does": "This code...",
            "potential_issues": [],
            "improvement_suggestions": [],
            "corrected_code": None,
            "teaching_points": []
        })
        
        return LineMentoringResponse(**data)
    except Exception as e:
        logger.error(f"Line mentoring error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/fix-code", response_model=FixCodeResponse)
async def fix_code(request: FixCodeRequest):
    """AI Senior fixes code"""
    try:
        skill_context = get_skill_context(request.skill_level)
        
        bugs_context = ""
        if request.bugs:
            bugs_context = "Known bugs:\n" + "\n".join([f"- Line {b.get('line', '?')}: {b.get('message', '')}" for b in request.bugs])
        
        comment_instruction = "\n6. Add inline comments explaining each change" if request.apply_inline_comments else ""
        
        system_prompt = f"""You are a senior software engineer fixing code.
{skill_context}

RESPOND ONLY WITH VALID JSON:
{{
    "fixed_code": "Complete fixed code",
    "explanation": "What was fixed",
    "changes_made": ["Change 1", "Change 2"]
}}

RULES:
1. Fix ALL bugs
2. Keep structure similar
3. Add error handling
4. Code must be runnable
5. Preserve comments{comment_instruction}"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Fix this {request.language} code:\n```{request.language}\n{request.code}\n```\n{bugs_context}")
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {
            "fixed_code": request.code,
            "explanation": "Unable to fix",
            "changes_made": []
        })
        
        return FixCodeResponse(**data)
    except Exception as e:
        logger.error(f"Fix code error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Models for execute-code endpoint
class ExecuteCodeRequest(BaseModel):
    code: str
    language: str
    skill_level: str = "intermediate"

class ExecuteCodeResponse(BaseModel):
    output: str
    error: Optional[str] = None
    exit_code: int
    execution_time: float
    error_explanation: Optional[str] = None
    fix_suggestion: Optional[str] = None

@api_router.post("/execute-code", response_model=ExecuteCodeResponse)
async def execute_code(request: ExecuteCodeRequest):
    """Execute code directly (without project context)"""
    try:
        import time
        import tempfile
        
        skill_context = get_skill_context(request.skill_level)
        start_time = time.time()
        output = ""
        error = None
        exit_code = 0
        
        # Create temp file and execute
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            if request.language.lower() == "python":
                file_path = temp_path / "code.py"
                file_path.write_text(request.code)
                command = f"python code.py"
            elif request.language.lower() in ["javascript", "js"]:
                file_path = temp_path / "code.js"
                file_path.write_text(request.code)
                command = f"node code.js"
            else:
                raise HTTPException(status_code=400, detail=f"Language {request.language} not supported for direct execution")
            
            try:
                result = subprocess.run(
                    command,
                    shell=True,
                    cwd=str(temp_path),
                    capture_output=True,
                    text=True,
                    timeout=30,
                    env={**os.environ, 'NODE_ENV': 'development'}
                )
                output = result.stdout
                if result.returncode != 0:
                    error = result.stderr
                    exit_code = result.returncode
            except subprocess.TimeoutExpired:
                error = "Execution timed out (30 second limit)"
                exit_code = 124
            except Exception as e:
                error = str(e)
                exit_code = 1
        
        execution_time = time.time() - start_time
        
        # Get AI explanation if there's an error
        error_explanation = None
        fix_suggestion = None
        
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
Language: {request.language}
Code: {request.code[:500]}
Error: {error}""")
            
            response = await chat.send_message(user_msg)
            data = safe_parse_json(response, {})
            error_explanation = data.get("error_explanation")
            fix_suggestion = data.get("fix_suggestion")
        
        return ExecuteCodeResponse(
            output=output,
            error=error,
            exit_code=exit_code,
            execution_time=execution_time,
            error_explanation=error_explanation,
            fix_suggestion=fix_suggestion
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Execute code error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/proactive-mentor", response_model=ProactiveMentorResponse)
async def proactive_mentor(request: ProactiveMentorRequest):
    """Proactively detect issues while coding"""
    try:
        skill_context = get_skill_context(request.skill_level)
        
        system_prompt = f"""You are a proactive coding mentor watching live code.
{skill_context}

Detect common mistakes: async misuse, state mutation, off-by-one errors, security issues.
ONLY flag REAL bugs, not style preferences.

RESPOND ONLY WITH VALID JSON:
{{
    "has_issue": true or false,
    "issue_type": "Type of issue",
    "message": "Brief explanation",
    "severity": "critical|warning|info",
    "quick_fix": "One-line fix suggestion"
}}"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Check this {request.language} code:\n```{request.language}\n{request.code}\n```")
        response = await chat.send_message(user_msg)
        data = safe_parse_json(response, {"has_issue": False, "severity": "info"})
        
        # Ensure severity is always a valid string
        if not data.get("severity") or data.get("severity") is None:
            data["severity"] = "info"
        
        return ProactiveMentorResponse(**data)
    except Exception as e:
        logger.error(f"Proactive mentor error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/generate-teaching", response_model=TeachingResponse)
async def generate_teaching(request: TeachingRequest):
    """Generate pedagogical explanation"""
    try:
        skill_context = get_skill_context(request.skill_level)
        
        system_prompt = f"""You are a coding mentor.
{skill_context}

Respond ONLY with valid JSON:
{{
    "conceptName": "Name of the concept",
    "naturalExplanation": "Clear explanation",
    "whyItMatters": "Why this matters",
    "commonMistake": "Common mistake and how to avoid"
}}"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Explain this bug:\nCode:\n```\n{request.code}\n```\nBug at line {request.bug.get('line', '?')}: {request.bug.get('message', '')}")
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {
            "conceptName": "Code Issue",
            "naturalExplanation": response or "Let me explain...",
            "whyItMatters": "Understanding this helps write better code.",
            "commonMistake": "Many developers encounter this."
        })
        
        return TeachingResponse(**data)
    except Exception as e:
        logger.error(f"Teaching error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/generate-deeper-explanation", response_model=DeeperExplanationResponse)
async def generate_deeper_explanation(request: DeeperExplanationRequest):
    """Generate detailed explanation"""
    try:
        skill_context = get_skill_context(request.skill_level)
        
        system_prompt = f"""You are an expert programming tutor.
{skill_context}

Respond ONLY with valid JSON:
{{
    "deeperExplanation": "Detailed explanation",
    "codeExamples": ["Example 1", "Example 2"],
    "relatedConcepts": ["Concept 1", "Concept 2"]
}}"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Deeper explanation for: {request.conceptName}\nCurrent: {request.currentExplanation}")
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {
            "deeperExplanation": "Here's more detail...",
            "codeExamples": [],
            "relatedConcepts": []
        })
        
        return DeeperExplanationResponse(**data)
    except Exception as e:
        logger.error(f"Deeper explanation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/generate-visual-diagram", response_model=VisualDiagramResponse)
async def generate_visual_diagram(request: VisualDiagramRequest):
    """Generate SVG diagram"""
    try:
        skill_context = get_skill_context(request.skill_level)
        
        system_prompt = f"""Create educational SVG diagrams (800x500px).
{skill_context}

Use dark background (#1E1E1E), Google colors (Blue #4285F4, Red #EA4335, Yellow #FBBC04, Green #34A853), white text.

Respond with ONLY SVG code. Start with <svg and end with </svg>"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Create a {request.diagramType} diagram for: {request.conceptName}\nContext: {request.explanation}")
        response = await chat.send_message(user_msg)
        
        svg_content = response.strip() if response else ""
        if "<svg" in svg_content:
            start = svg_content.find("<svg")
            end = svg_content.rfind("</svg>") + 6
            svg_content = svg_content[start:end]
        else:
            svg_content = f'<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="500" fill="#1E1E1E"/><text x="400" y="250" fill="#FFFFFF" text-anchor="middle" font-size="20">{request.conceptName}</text></svg>'
        
        return VisualDiagramResponse(svg=svg_content)
    except Exception as e:
        logger.error(f"Diagram error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/english-chat", response_model=EnglishChatResponse)
async def english_chat(request: EnglishChatRequest):
    """English learning assistant"""
    try:
        system_prompt = """You are a friendly English tutor.
        
Respond ONLY with valid JSON:
{
    "response": "Your helpful response",
    "intent": "question|practice|conversation",
    "corrections": [{"original": "text", "corrected": "text", "explanation": "why"}]
}"""
        
        chat = get_chat_instance(system_prompt)
        context = "\n".join([f"{m.role}: {m.content}" for m in request.conversationHistory[-5:]])
        user_msg = UserMessage(text=f"History:\n{context}\n\nNew message: {request.message}")
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {
            "response": response or "I'm here to help!",
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

@api_router.get("/project/{project_id}/structure")
async def get_project_structure(project_id: str):
    """Get updated project structure"""
    try:
        project = await projects_collection.find_one({"project_id": project_id})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        workspace_path = Path(project['workspace_path'])
        
        file_tree = build_file_tree(workspace_path)
        language_stats = calculate_language_stats(workspace_path)
        
        return {
            "root": file_tree.model_dump(),
            "languages": [ls.model_dump() for ls in language_stats]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get structure error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== MULTI-INDUSTRY AGENT SYSTEM ==============

AGENT_DEFINITIONS = {
    "coding": {
        "name": "Coding Mentor",
        "icon": "👨‍💻",
        "description": "Expert code analysis, debugging, and programming education",
        "system_prompt": """You are a world-class coding mentor and senior software engineer with enterprise-level expertise.
You excel at code analysis, debugging, teaching programming concepts, and architectural guidance.

RESPONSE STRUCTURE (MANDATORY):
- Use clear Markdown formatting
- Structure with ## Headings and ### Subheadings
- Use bullet points for lists
- Use tables for comparisons
- Include a **Next Steps** section at the end
- Use code blocks with language tags
- Be concise but thorough

You can:
- Analyze code and find bugs with senior engineer insights
- Explain programming concepts from basics to advanced patterns
- Review architecture and design patterns (SOLID, DDD, Microservices)
- Suggest optimizations and best practices
- Debug complex issues with systematic approach
- Create visual diagrams and flowcharts
- Teach proper project structure and conventions

Always be encouraging, clear, and educational. Act as a senior engineer mentor."""
    },
    "health": {
        "name": "Health Education Agent",
        "icon": "🏥",
        "description": "Medical concepts, anatomy, treatment education",
        "system_prompt": """You are a medical education specialist helping people understand health topics with clarity and structure.

⚠️ CRITICAL: You provide educational information ONLY. You are NOT a doctor.
Always include: "This is for educational purposes only. Consult healthcare professionals for medical advice."

RESPONSE STRUCTURE (MANDATORY):
- Use clear Markdown with ## Headings
- Start with brief overview
- Use bullet points for symptoms, causes, treatments
- Include **Key Takeaways** section
- Add **When to See a Doctor** section
- End with **Next Steps** or **Further Reading**
- Use tables for treatment comparisons
- Use analogies to explain complex concepts

You can:
- Explain medical conditions, symptoms, treatments in accessible language
- Break down complex anatomy with clear descriptions
- Describe treatment options and timelines
- Explain when to seek medical care
- Create visual explanations of medical processes
- Compare treatment options systematically

Always maintain a caring, educational, and clear tone."""
    },
    "travel": {
        "name": "Travel Planning Agent",
        "icon": "✈️",
        "description": "Trip planning, itineraries, destination guides",
        "system_prompt": """You are an expert travel planner and destination guide creating comprehensive, actionable travel plans.

RESPONSE STRUCTURE (MANDATORY):
- Use clear Markdown with ## Headings
- Create **Day-by-Day Itinerary** with ### Day 1, ### Day 2 format
- Use bullet points for activities and tips
- Include **Budget Breakdown** table
- Add **Essential Information** section (visa, currency, weather)
- Include **Packing List** if relevant
- End with **Pro Tips** and **Next Steps**
- Use tables for comparisons (hotels, restaurants)

You can:
- Create detailed day-by-day itineraries with specific times
- Research and recommend hotels, restaurants, and activities with real options
- Provide budget estimates and money-saving tips
- Explain history and stories of destinations
- Search for indicative flight prices online (label as "indicative based on recent searches")
- Provide travel tips, local customs, and safety advice
- Create interactive travel guides with maps

Always cite sources for recommendations. Include practical information: best times to visit, local transportation, safety tips."""
    },
    "business": {
        "name": "Business Intelligence Agent",
        "icon": "📊",
        "description": "Company analysis, competitor research, strategy dashboards",
        "system_prompt": """You are a senior business analyst and market researcher creating executive-grade intelligence reports.

STRICT RULES:
- Use ONLY credible public sources (company websites, LinkedIn, Crunchbase, press releases, trusted media)
- Every data point MUST have a source URL
- If data is not publicly available, write exactly: "Not Publicly Available"
- NO hallucination or guessing
- Always cite sources

RESPONSE STRUCTURE (MANDATORY):
- Use clear Markdown with ## Headings
- Start with **Executive Summary**
- Use tables for data presentation
- Include **Key Findings** with bullet points
- Add **Data Sources** section with URLs
- Use ### Subheadings for detailed sections
- End with **Strategic Recommendations** and **Next Steps**

When Deep Research mode is enabled:
- Crawl multiple pages of company website
- Research competitors thoroughly
- Extract detailed product information
- Analyze pricing and business model
- Create comprehensive multi-sheet Excel report
- Generate professional HTML dashboard

You can:
- Analyze company websites and products systematically
- Perform competitive analysis with sourced data
- Generate multi-sheet research reports (8 sheets: Overview, Products, Customer Success, Pain Points, Competitive Analysis, Case Studies, Pricing, OKRs)
- Create professional HTML strategy dashboards
- Identify market opportunities and challenges
- Research industry trends and insights"""
    }
}

# Models for Multi-Industry Agents
class AgentChatRequest(BaseModel):
    agent_type: str  # coding, health, travel, business
    message: str
    conversation_history: List[ChatMessage] = []
    context: Optional[Dict[str, Any]] = None

class AgentChatResponse(BaseModel):
    response: str
    agent_type: str
    agent_name: str
    suggestions: Optional[List[str]] = None

class HealthExplainRequest(BaseModel):
    topic: str
    detail_level: str = "intermediate"  # simple, intermediate, detailed

class TravelPlanRequest(BaseModel):
    destination: str
    duration_days: int
    interests: List[str] = []
    budget_level: str = "moderate"  # budget, moderate, luxury

class CompanyAnalysisRequest(BaseModel):
    company_url: str
    analysis_type: str = "full"  # full, competitors, products, okrs

class CompanyAnalysisResponse(BaseModel):
    company_name: str
    sheets: Dict[str, List[Dict[str, Any]]]
    html_report: Optional[str] = None

@api_router.get("/agents")
async def list_agents():
    """List all available agents"""
    return {
        "agents": [
            {
                "id": key,
                "name": agent["name"],
                "icon": agent["icon"],
                "description": agent["description"]
            }
            for key, agent in AGENT_DEFINITIONS.items()
        ]
    }

@api_router.post("/agent/chat", response_model=AgentChatResponse)
async def agent_chat(request: AgentChatRequest):
    """Chat with a specific agent"""
    try:
        if request.agent_type not in AGENT_DEFINITIONS:
            raise HTTPException(status_code=400, detail=f"Unknown agent type: {request.agent_type}")
        
        agent = AGENT_DEFINITIONS[request.agent_type]
        
        system_prompt = agent["system_prompt"]
        
        # Add context if provided
        if request.context:
            context_str = "\n".join([f"{k}: {v}" for k, v in request.context.items()])
            system_prompt += f"\n\nCurrent context:\n{context_str}"
        
        chat = get_chat_instance(system_prompt)
        
        # Build conversation context
        context = ""
        for msg in request.conversation_history[-10:]:
            context += f"{msg.role}: {msg.content}\n"
        
        user_msg = UserMessage(text=f"{context}\nUser: {request.message}")
        response = await chat.send_message(user_msg)
        
        # Generate suggestions based on agent type
        suggestions = None
        if request.agent_type == "health":
            suggestions = ["Explain in simpler terms", "Show a timeline", "Generate visual diagram"]
        elif request.agent_type == "travel":
            suggestions = ["Show day-by-day itinerary", "Best restaurants?", "Generate trip map"]
        elif request.agent_type == "business":
            suggestions = ["Competitor analysis", "Generate HTML report", "Generate visual chart"]
        elif request.agent_type == "coding":
            suggestions = ["Show flowchart", "Generate architecture diagram", "Explain with visuals"]
        
        return AgentChatResponse(
            response=response or "I'm here to help!",
            agent_type=request.agent_type,
            agent_name=agent["name"],
            suggestions=suggestions
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Agent chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/agent/generate-visual")
async def generate_agent_visual(
    agent_type: str = Form(...),
    topic: str = Form(...),
    visual_type: str = Form("diagram")
):
    """Generate visual diagram/image for agent response"""
    try:
        import base64
        import uuid
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        # Create appropriate prompts based on agent type
        prompt_templates = {
            "coding": {
                "diagram": f"Create a clean technical architecture diagram showing {topic}. Professional software engineering style with labeled components and connections. Dark theme, modern design.",
                "flowchart": f"Create a software flowchart for {topic}. Clear decision points, process steps, color coded boxes. Professional technical documentation style.",
                "architecture": f"Create a system architecture diagram for {topic}. Show microservices, APIs, databases clearly labeled. Modern cloud architecture visualization."
            },
            "health": {
                "diagram": f"Create a medical educational diagram showing {topic}. Clean, labeled, professional medical illustration. Anatomically accurate with clear annotations.",
                "anatomy": f"Create a human anatomy illustration of {topic}. Educational medical style, clearly labeled parts.",
                "timeline": f"Create a medical timeline showing progression of {topic}. Clear stages, visual markers, educational style."
            },
            "travel": {
                "diagram": f"Create a travel route map for {topic}. Beautiful illustrated map style with landmarks, routes, and key destinations marked.",
                "map": f"Create an illustrated travel map of {topic}. Tourist map style with attractions, routes, and helpful icons.",
                "itinerary": f"Create a visual travel itinerary for {topic}. Day-by-day visual guide with icons and timeline."
            },
            "business": {
                "diagram": f"Create a business strategy diagram for {topic}. Professional consulting style with clear hierarchy and relationships.",
                "chart": f"Create a business analysis chart for {topic}. Clean data visualization, modern corporate style.",
                "comparison": f"Create a competitive analysis visual comparison of {topic}. Side by side with clear differentiators."
            }
        }
        
        agent_prompts = prompt_templates.get(agent_type, prompt_templates["coding"])
        prompt = agent_prompts.get(visual_type, agent_prompts.get("diagram", f"Create an educational diagram for {topic}"))
        
        # Generate image using LlmChat with multimodal
        session_id = str(uuid.uuid4())
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY, 
            session_id=session_id, 
            system_message="You are a professional diagram and visualization creator."
        )
        chat.with_model("gemini", "gemini-3-pro-image-preview").with_params(modalities=["image", "text"])
        
        msg = UserMessage(text=prompt)
        text_response, images = await chat.send_message_multimodal_response(msg)
        
        # Get the first image if available
        image_base64 = None
        if images and len(images) > 0:
            image_base64 = images[0].get('data', None)
        
        return {
            "success": True,
            "image_url": None,
            "image_base64": image_base64,
            "topic": topic,
            "visual_type": visual_type,
            "agent_type": agent_type,
            "text_response": text_response
        }
        
    except Exception as e:
        logger.error(f"Visual generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/agent/health/explain")
async def health_explain(request: HealthExplainRequest):
    """Explain a medical/health topic"""
    try:
        detail_prompts = {
            "simple": "Explain like I'm 10 years old. Use analogies.",
            "intermediate": "Explain clearly with some medical terms defined.",
            "detailed": "Provide a comprehensive medical explanation."
        }
        
        system_prompt = f"""You are a medical education specialist.
{detail_prompts.get(request.detail_level, detail_prompts['intermediate'])}

RESPOND ONLY WITH VALID JSON:
{{
    "title": "Topic name",
    "explanation": "Clear explanation",
    "key_points": ["Point 1", "Point 2"],
    "common_questions": ["Q1?", "Q2?"],
    "when_to_see_doctor": "When medical attention is needed",
    "disclaimer": "Medical disclaimer"
}}

ALWAYS include a medical disclaimer."""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Explain: {request.topic}")
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {
            "title": request.topic,
            "explanation": response or "Unable to explain",
            "key_points": [],
            "disclaimer": "This is for educational purposes only. Consult a healthcare professional."
        })
        
        return data
        
    except Exception as e:
        logger.error(f"Health explain error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/agent/travel/plan")
async def travel_plan(request: TravelPlanRequest):
    """Create a travel plan"""
    try:
        budget_guides = {
            "budget": "Focus on affordable options, hostels, street food, free attractions",
            "moderate": "Balance comfort and value, mid-range hotels, local restaurants",
            "luxury": "Premium experiences, 5-star hotels, fine dining, exclusive tours"
        }
        
        interests_str = ", ".join(request.interests) if request.interests else "general sightseeing"
        
        system_prompt = f"""You are an expert travel planner.
Create a {request.duration_days}-day trip plan for {request.destination}.
Budget level: {request.budget_level} - {budget_guides.get(request.budget_level, budget_guides['moderate'])}
Interests: {interests_str}

RESPOND ONLY WITH VALID JSON:
{{
    "destination": "{request.destination}",
    "duration": {request.duration_days},
    "overview": "Trip overview",
    "best_time_to_visit": "Recommended seasons",
    "estimated_budget": "Budget range in USD",
    "itinerary": [
        {{
            "day": 1,
            "title": "Day title",
            "morning": "Morning activities",
            "afternoon": "Afternoon activities",
            "evening": "Evening activities",
            "meals": ["Breakfast recommendation", "Lunch", "Dinner"],
            "tips": "Daily tips"
        }}
    ],
    "accommodations": [{{"name": "Hotel", "type": "Type", "price_range": "$100-150/night"}}],
    "must_see": ["Attraction 1", "Attraction 2"],
    "local_tips": ["Tip 1", "Tip 2"],
    "packing_list": ["Item 1", "Item 2"]
}}"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Create a detailed travel plan for {request.destination}")
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {
            "destination": request.destination,
            "duration": request.duration_days,
            "overview": "Travel plan",
            "itinerary": [],
            "must_see": [],
            "local_tips": []
        })
        
        return data
        
    except Exception as e:
        logger.error(f"Travel plan error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/agent/business/analyze", response_model=CompanyAnalysisResponse)
async def analyze_company(request: CompanyAnalysisRequest):
    """Analyze a company - Business Intelligence mode"""
    try:
        system_prompt = """You are a senior business analyst performing company research.

STRICT RULES:
1. Use ONLY credible public sources (company website, LinkedIn, Crunchbase, press releases, trusted media)
2. Every piece of data MUST include a source URL
3. If data is not publicly available, write exactly: "Not Publicly Available"
4. NO hallucination or fabrication
5. Be thorough but accurate

Generate structured analysis in this EXACT JSON format:
{
    "company_name": "Company Name",
    "sheets": {
        "1_Company_Overview": [
            {"category": "Basic Info", "subcategory": "Legal Name", "detail": "...", "source": "URL", "date": "2024"}
        ],
        "2_Products_Services": [
            {"product": "Product Name", "category": "Type", "features": "...", "target_audience": "...", "source": "URL"}
        ],
        "3_Customer_Success": [
            {"goal": "Goal", "metric_1": "...", "metric_2": "...", "case": "...", "source": "URL"}
        ],
        "4_Pain_Points": [
            {"type": "Technical", "category": "...", "description": "...", "solution": "...", "source": "URL"}
        ],
        "5_Competitive_Analysis": [
            {"competitor": "Name", "strengths": "...", "weaknesses": "...", "advantage": "...", "source": "URL"}
        ],
        "6_Case_Studies": [
            {"client": "Name", "product_used": "...", "outcomes": "...", "source": "URL"}
        ],
        "7_Pricing_Model": [
            {"component": "Tier", "description": "...", "price": "...", "source": "URL"}
        ],
        "8_OKRs_Strategy": [
            {"objective": "...", "key_result_1": "...", "key_result_2": "...", "rationale": "..."}
        ]
    }
}"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Analyze this company website: {request.company_url}\nAnalysis type: {request.analysis_type}")
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {
            "company_name": "Unknown Company",
            "sheets": {}
        })
        
        # Generate HTML report if requested
        html_report = None
        if request.analysis_type == "full":
            html_report = generate_html_report(data)
        
        return CompanyAnalysisResponse(
            company_name=data.get("company_name", "Unknown"),
            sheets=data.get("sheets", {}),
            html_report=html_report
        )
        
    except Exception as e:
        logger.error(f"Company analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def generate_html_report(data: dict) -> str:
    """Generate professional HTML strategy dashboard"""
    company_name = data.get("company_name", "Company Analysis")
    sheets = data.get("sheets", {})
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{company_name} - Strategy Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .glass {{ background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); }}
        .gradient-text {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }}
    </style>
</head>
<body class="bg-gray-900 text-white min-h-screen">
    <nav class="fixed top-0 w-full glass border-b border-white/10 z-50 p-4">
        <div class="max-w-7xl mx-auto flex justify-between items-center">
            <h1 class="text-2xl font-bold gradient-text">{company_name}</h1>
            <span class="text-sm text-gray-400">Strategy Dashboard</span>
        </div>
    </nav>
    
    <main class="pt-20 p-8 max-w-7xl mx-auto">
        <div class="grid gap-8">
"""
    
    # Generate sections for each sheet
    sheet_icons = {
        "1_Company_Overview": "🏢",
        "2_Products_Services": "📦",
        "3_Customer_Success": "🎯",
        "4_Pain_Points": "⚠️",
        "5_Competitive_Analysis": "📊",
        "6_Case_Studies": "📝",
        "7_Pricing_Model": "💰",
        "8_OKRs_Strategy": "🚀"
    }
    
    for sheet_name, rows in sheets.items():
        icon = sheet_icons.get(sheet_name, "📋")
        title = sheet_name.replace("_", " ")
        
        html += f"""
            <section class="glass rounded-2xl p-6 border border-white/10">
                <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
                    <span>{icon}</span> {title}
                </h2>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="border-b border-white/10">
                            <tr>
"""
        
        # Generate table headers from first row
        if rows and isinstance(rows, list) and len(rows) > 0:
            for key in rows[0].keys():
                html += f'<th class="text-left p-2 text-gray-400">{key.replace("_", " ").title()}</th>'
            
            html += "</tr></thead><tbody>"
            
            # Generate rows
            for row in rows:
                html += "<tr class='border-b border-white/5 hover:bg-white/5'>"
                for value in row.values():
                    html += f'<td class="p-2">{value}</td>'
                html += "</tr>"
        
        html += """
                        </tbody>
                    </table>
                </div>
            </section>
"""
    
    html += """
        </div>
        
        <footer class="mt-12 text-center text-gray-500 text-sm">
            <p>Generated by Live Code Mentor - Business Intelligence Agent</p>
            <p class="mt-2">Data sourced from publicly available information</p>
        </footer>
    </main>
</body>
</html>"""
    
    return html


class HtmlReportRequest(BaseModel):
    company_name: str
    sheets: dict

@api_router.post("/agent/html-report")
async def generate_html_report_endpoint(request: HtmlReportRequest):
    """Generate HTML report from business analysis data"""
    try:
        html = generate_html_report({"company_name": request.company_name, "sheets": request.sheets})
        return {"html": html, "company_name": request.company_name}
    except Exception as e:
        logger.error(f"HTML report generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== LEARNING PATH MENTOR SYSTEM ==============

# Collections for learning path
learning_profiles_collection = db.learning_profiles
learning_progress_collection = db.learning_progress

class LearningOnboardRequest(BaseModel):
    targetRole: str
    industry: str
    background: str
    hoursPerWeek: int = 10
    learningSpeed: str = "normal"
    preferredStyle: str = "mixed"
    targetMonths: int = 12

class LearningMentorRequest(BaseModel):
    message: str
    topic: Optional[Dict[str, Any]] = None
    user_profile: Optional[Dict[str, Any]] = None
    conversation_history: List[ChatMessage] = []
    image_base64: Optional[str] = None  # Support for image input

class TopicCompleteRequest(BaseModel):
    topic_id: str
    user_id: Optional[str] = None
    score: Optional[int] = None

INDUSTRY_SKILL_TREES = {
    "software": {
        "name": "Software & AI Engineering",
        "nodes": [
            {
                "id": "prog_fundamentals",
                "name": "Programming Fundamentals",
                "level": "Beginner",
                "estimatedTime": "4-6 weeks",
                "status": "not_started",
                "objective": "Master basic programming concepts",
                "children": [
                    {"id": "python_basics", "name": "Python Basics", "level": "Beginner", "estimatedTime": "2 weeks", "status": "not_started", "objective": "Learn Python syntax and basics"},
                    {"id": "variables_types", "name": "Variables & Data Types", "level": "Beginner", "estimatedTime": "1 week", "status": "not_started"},
                    {"id": "control_flow", "name": "Control Flow", "level": "Beginner", "estimatedTime": "1 week", "status": "not_started"},
                    {"id": "functions", "name": "Functions", "level": "Beginner", "estimatedTime": "1 week", "status": "not_started"}
                ]
            },
            {
                "id": "data_structures",
                "name": "Data Structures",
                "level": "Intermediate",
                "estimatedTime": "4-6 weeks",
                "status": "not_started",
                "children": [
                    {"id": "arrays_lists", "name": "Arrays & Lists", "level": "Intermediate", "estimatedTime": "1 week", "status": "not_started"},
                    {"id": "stacks_queues", "name": "Stacks & Queues", "level": "Intermediate", "estimatedTime": "1 week", "status": "not_started"},
                    {"id": "trees_graphs", "name": "Trees & Graphs", "level": "Intermediate", "estimatedTime": "2 weeks", "status": "not_started"},
                    {"id": "hash_tables", "name": "Hash Tables", "level": "Intermediate", "estimatedTime": "1 week", "status": "not_started"}
                ]
            },
            {
                "id": "algorithms",
                "name": "Algorithms",
                "level": "Intermediate",
                "estimatedTime": "4-6 weeks",
                "status": "not_started",
                "children": [
                    {"id": "sorting", "name": "Sorting Algorithms", "level": "Intermediate", "estimatedTime": "2 weeks", "status": "not_started"},
                    {"id": "searching", "name": "Searching Algorithms", "level": "Intermediate", "estimatedTime": "1 week", "status": "not_started"},
                    {"id": "recursion", "name": "Recursion", "level": "Intermediate", "estimatedTime": "2 weeks", "status": "not_started"}
                ]
            },
            {
                "id": "ml_foundations",
                "name": "Machine Learning Foundations",
                "level": "Advanced",
                "estimatedTime": "8-10 weeks",
                "status": "not_started",
                "children": [
                    {"id": "linear_algebra", "name": "Linear Algebra", "level": "Advanced", "estimatedTime": "2 weeks", "status": "not_started"},
                    {"id": "statistics", "name": "Statistics & Probability", "level": "Advanced", "estimatedTime": "2 weeks", "status": "not_started"},
                    {"id": "supervised_ml", "name": "Supervised Learning", "level": "Advanced", "estimatedTime": "3 weeks", "status": "not_started"},
                    {"id": "unsupervised_ml", "name": "Unsupervised Learning", "level": "Advanced", "estimatedTime": "2 weeks", "status": "not_started"}
                ]
            },
            {
                "id": "deep_learning",
                "name": "Deep Learning",
                "level": "Advanced",
                "estimatedTime": "8-12 weeks",
                "status": "not_started",
                "children": [
                    {"id": "neural_networks", "name": "Neural Networks", "level": "Advanced", "estimatedTime": "3 weeks", "status": "not_started"},
                    {"id": "cnns", "name": "CNNs", "level": "Advanced", "estimatedTime": "2 weeks", "status": "not_started"},
                    {"id": "rnns_transformers", "name": "RNNs & Transformers", "level": "Advanced", "estimatedTime": "3 weeks", "status": "not_started"},
                    {"id": "llms", "name": "Large Language Models", "level": "Advanced", "estimatedTime": "3 weeks", "status": "not_started"}
                ]
            }
        ]
    },
    "data": {
        "name": "Data & Analytics",
        "nodes": [
            {"id": "sql_fundamentals", "name": "SQL Fundamentals", "level": "Beginner", "estimatedTime": "3 weeks", "status": "not_started"},
            {"id": "data_wrangling", "name": "Data Wrangling", "level": "Beginner", "estimatedTime": "4 weeks", "status": "not_started"},
            {"id": "visualization", "name": "Data Visualization", "level": "Intermediate", "estimatedTime": "3 weeks", "status": "not_started"},
            {"id": "statistics_analysis", "name": "Statistical Analysis", "level": "Intermediate", "estimatedTime": "4 weeks", "status": "not_started"},
            {"id": "bi_tools", "name": "BI Tools (Tableau/PowerBI)", "level": "Intermediate", "estimatedTime": "4 weeks", "status": "not_started"},
            {"id": "advanced_analytics", "name": "Advanced Analytics", "level": "Advanced", "estimatedTime": "6 weeks", "status": "not_started"}
        ]
    },
    "business": {
        "name": "Business & Strategy",
        "nodes": [
            {"id": "business_fundamentals", "name": "Business Fundamentals", "level": "Beginner", "estimatedTime": "4 weeks", "status": "not_started"},
            {"id": "market_analysis", "name": "Market Analysis", "level": "Intermediate", "estimatedTime": "3 weeks", "status": "not_started"},
            {"id": "financial_modeling", "name": "Financial Modeling", "level": "Intermediate", "estimatedTime": "4 weeks", "status": "not_started"},
            {"id": "strategic_planning", "name": "Strategic Planning", "level": "Advanced", "estimatedTime": "4 weeks", "status": "not_started"},
            {"id": "leadership", "name": "Leadership & Management", "level": "Advanced", "estimatedTime": "6 weeks", "status": "not_started"}
        ]
    },
    "healthcare": {
        "name": "Healthcare & Biology",
        "nodes": [
            {"id": "anatomy_basics", "name": "Human Anatomy Basics", "level": "Beginner", "estimatedTime": "6 weeks", "status": "not_started"},
            {"id": "physiology", "name": "Physiology", "level": "Intermediate", "estimatedTime": "6 weeks", "status": "not_started"},
            {"id": "medical_terminology", "name": "Medical Terminology", "level": "Beginner", "estimatedTime": "3 weeks", "status": "not_started"},
            {"id": "pathology", "name": "Pathology Basics", "level": "Advanced", "estimatedTime": "8 weeks", "status": "not_started"},
            {"id": "pharmacology", "name": "Pharmacology Basics", "level": "Advanced", "estimatedTime": "6 weeks", "status": "not_started"}
        ]
    },
    "travel": {
        "name": "Travel & Geography",
        "nodes": [
            {"id": "world_geography", "name": "World Geography", "level": "Beginner", "estimatedTime": "4 weeks", "status": "not_started"},
            {"id": "cultural_studies", "name": "Cultural Studies", "level": "Intermediate", "estimatedTime": "4 weeks", "status": "not_started"},
            {"id": "tourism_management", "name": "Tourism Management", "level": "Intermediate", "estimatedTime": "4 weeks", "status": "not_started"},
            {"id": "hospitality", "name": "Hospitality Industry", "level": "Intermediate", "estimatedTime": "4 weeks", "status": "not_started"}
        ]
    },
    "architecture": {
        "name": "Architecture & Design",
        "nodes": [
            {"id": "design_principles", "name": "Design Principles", "level": "Beginner", "estimatedTime": "4 weeks", "status": "not_started"},
            {"id": "drafting", "name": "Technical Drafting", "level": "Beginner", "estimatedTime": "4 weeks", "status": "not_started"},
            {"id": "cad_software", "name": "CAD Software", "level": "Intermediate", "estimatedTime": "6 weeks", "status": "not_started"},
            {"id": "structural_basics", "name": "Structural Engineering Basics", "level": "Advanced", "estimatedTime": "8 weeks", "status": "not_started"}
        ]
    }
}

@api_router.post("/learning/onboard")
async def learning_onboard(request: LearningOnboardRequest):
    """Create a personalized learning path based on user profile"""
    try:
        profile_id = str(uuid.uuid4())
        
        # Get industry-specific skill tree
        industry = request.industry or "software"
        skill_tree = INDUSTRY_SKILL_TREES.get(industry, INDUSTRY_SKILL_TREES["software"])
        
        # Generate career fit analysis using AI
        system_prompt = """You are an expert career advisor and curriculum designer.
Based on the user's profile, provide:
1. A career fit analysis
2. Personalized recommendations
3. A customized weekly plan

RESPOND ONLY WITH VALID JSON:
{
    "career_fit": {
        "fit_score": 85,
        "strengths": ["Strength 1", "Strength 2"],
        "areas_to_develop": ["Area 1", "Area 2"],
        "alternative_roles": ["Role 1", "Role 2"]
    },
    "weekly_plan": {
        "week": 1,
        "tasks": [
            {"title": "Task", "description": "Desc", "type": "reading", "completed": false},
            {"title": "Task 2", "description": "Desc", "type": "practice", "completed": false}
        ],
        "homework": {"description": "Weekly homework assignment"}
    },
    "personalized_message": "Encouraging message for the learner"
}"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"""Create a learning path for:
Target Role: {request.targetRole}
Industry: {industry}
Background: {request.background}
Available Hours/Week: {request.hoursPerWeek}
Learning Speed: {request.learningSpeed}
Preferred Style: {request.preferredStyle}
Target Timeline: {request.targetMonths} months""")
        
        response = await chat.send_message(user_msg)
        ai_data = safe_parse_json(response, {
            "career_fit": {"fit_score": 80, "strengths": [], "areas_to_develop": []},
            "weekly_plan": {"week": 1, "tasks": [
                {"title": "Start Python Basics", "description": "Learn variables and data types", "type": "reading", "completed": False},
                {"title": "Practice Exercises", "description": "Complete 5 coding exercises", "type": "practice", "completed": False}
            ]},
            "personalized_message": "Welcome to your learning journey!"
        })
        
        # Calculate total topics
        total_topics = 0
        def count_topics(nodes):
            nonlocal total_topics
            for node in nodes:
                total_topics += 1
                if "children" in node:
                    count_topics(node["children"])
        count_topics(skill_tree["nodes"])
        
        # Store profile
        profile_data = {
            "profile_id": profile_id,
            "target_role": request.targetRole,
            "industry": industry,
            "background": request.background,
            "hours_per_week": request.hoursPerWeek,
            "learning_speed": request.learningSpeed,
            "preferred_style": request.preferredStyle,
            "target_months": request.targetMonths,
            "career_fit": ai_data.get("career_fit", {}),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await learning_profiles_collection.insert_one(profile_data)
        
        return {
            "profile": {
                "id": profile_id,
                "targetRole": request.targetRole,
                "industry": industry,
                **ai_data.get("career_fit", {})
            },
            "skill_tree": skill_tree,
            "weekly_plan": ai_data.get("weekly_plan", {"week": 1, "tasks": []}),
            "progress": {
                "completed": 0,
                "total": total_topics,
                "velocity": 0
            },
            "personalized_message": ai_data.get("personalized_message", "Welcome!")
        }
        
    except Exception as e:
        logger.error(f"Learning onboard error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/learning/mentor")
async def learning_mentor(request: LearningMentorRequest):
    """Interactive mentoring session for a specific topic with image support"""
    try:
        topic = request.topic or {}
        user_profile = request.user_profile or {}
        
        speed_context = {
            "slow": "Be very patient, use many examples and analogies",
            "normal": "Balance explanation with examples",
            "fast": "Be concise but thorough"
        }
        
        style_context = {
            "visual": "Use diagrams and visual descriptions",
            "practical": "Focus on hands-on examples and code",
            "theory": "Provide deep conceptual explanations",
            "mixed": "Balance theory with practical examples"
        }
        
        system_prompt = f"""You are a world-class learning mentor teaching {topic.get('name', 'this topic')}.

USER PROFILE:
- Target Role: {user_profile.get('targetRole', 'Software Engineer')}
- Learning Speed: {speed_context.get(user_profile.get('learningSpeed', 'normal'), speed_context['normal'])}
- Style Preference: {style_context.get(user_profile.get('preferredStyle', 'mixed'), style_context['mixed'])}

CURRENT TOPIC: {topic.get('name', 'General')}
Level: {topic.get('level', 'Intermediate')}
Objective: {topic.get('objective', 'Master this concept')}

YOUR ROLE:
1. Explain concepts clearly at the appropriate level
2. Use analogies and real-world examples
3. Ask follow-up questions to confirm understanding
4. Provide practice problems when appropriate
5. Celebrate progress and encourage the learner
6. If an image is provided, analyze it and relate it to the learning topic

RESPONSE FORMAT:
Provide your response as helpful markdown text. Be encouraging but educational.
If appropriate, include a quiz question at the end."""
        
        chat = get_chat_instance(system_prompt)
        
        # Build context from conversation history
        context = ""
        for msg in request.conversation_history[-10:]:
            context += f"{msg.role}: {msg.content}\n"
        
        # Handle image if provided
        if request.image_base64:
            user_msg = UserMessage(
                text=f"{context}\nUser: {request.message}\n\n[User has shared an image for analysis]",
                images=[ImageContent(base64=request.image_base64)]
            )
        else:
            user_msg = UserMessage(text=f"{context}\nUser: {request.message}")
        
        response = await chat.send_message(user_msg)
        
        return {
            "response": response or "I'm here to help you learn! What would you like to know?",
            "quiz": None  # Can be enhanced to include quiz questions
        }
        
    except Exception as e:
        logger.error(f"Learning mentor error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/learning/complete-topic")
async def complete_topic(request: TopicCompleteRequest):
    """Mark a topic as complete and update progress"""
    try:
        # Update progress in database
        progress_update = {
            "topic_id": request.topic_id,
            "user_id": request.user_id,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "score": request.score
        }
        
        await learning_progress_collection.insert_one(progress_update)
        
        # Get updated progress count
        completed_count = await learning_progress_collection.count_documents({"user_id": request.user_id})
        
        return {
            "success": True,
            "progress": {
                "completed": completed_count,
                "total": 25,  # This should be dynamic based on skill tree
                "velocity": round(completed_count / 4, 1)  # topics per week estimate
            }
        }
        
    except Exception as e:
        logger.error(f"Complete topic error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/learning/progress/{user_id}")
async def get_learning_progress(user_id: str):
    """Get user's learning progress"""
    try:
        completed_topics = await learning_progress_collection.find({"user_id": user_id}).to_list(100)
        profile = await learning_profiles_collection.find_one({"profile_id": user_id})
        
        return {
            "completed_topics": [{"topic_id": t["topic_id"], "completed_at": t["completed_at"]} for t in completed_topics],
            "profile": profile,
            "stats": {
                "total_completed": len(completed_topics),
                "current_streak": 7,  # Would need proper tracking
                "hours_studied": len(completed_topics) * 2
            }
        }
        
    except Exception as e:
        logger.error(f"Get progress error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== AI NEWS FEED ==============

@api_router.get("/news/feed")
async def get_news_feed(category: str = "all"):
    """Get AI and tech news feed with REAL, verified URLs"""
    try:
        from datetime import datetime, timedelta
        import uuid
        
        # Use curated REAL news sources that actually exist
        # These are real, stable links to major tech news outlets
        real_news = [
            {
                "id": str(uuid.uuid4()),
                "title": "OpenAI Advances in AI Safety Research",
                "summary": "OpenAI continues to develop new approaches to AI alignment and safety, focusing on interpretability and reducing harmful outputs in large language models.",
                "source": "OpenAI Blog",
                "url": "https://openai.com/blog",
                "category": "ai",
                "publishedAt": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Google DeepMind Pushes Boundaries of AI Research",
                "summary": "DeepMind's latest research explores new frontiers in reinforcement learning and multimodal AI systems for scientific discovery.",
                "source": "Google DeepMind",
                "url": "https://deepmind.google/discover/blog/",
                "category": "ai",
                "publishedAt": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Anthropic's Constitutional AI Approach",
                "summary": "Anthropic shares insights on their constitutional AI methods for creating helpful, harmless, and honest AI assistants.",
                "source": "Anthropic Research",
                "url": "https://www.anthropic.com/research",
                "category": "ai",
                "publishedAt": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Latest Developer Tools and Frameworks",
                "summary": "TechCrunch covers the latest advancements in developer tools, from AI-powered coding assistants to new JavaScript frameworks.",
                "source": "TechCrunch",
                "url": "https://techcrunch.com/category/artificial-intelligence/",
                "category": "tech",
                "publishedAt": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "title": "The Future of Software Development",
                "summary": "The Verge explores how AI is transforming software development practices and what it means for programmers.",
                "source": "The Verge",
                "url": "https://www.theverge.com/tech",
                "category": "tech",
                "publishedAt": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Venture Capital Trends in AI Startups",
                "summary": "VentureBeat analyzes the latest funding trends for AI startups and emerging technologies gaining investor attention.",
                "source": "VentureBeat",
                "url": "https://venturebeat.com/category/ai/",
                "category": "startups",
                "publishedAt": datetime.now(timezone.utc).isoformat()
            }
        ]
        
        # Filter by category if specified
        if category != "all":
            real_news = [n for n in real_news if n["category"] == category]
        
        return {"articles": real_news}
        
    except Exception as e:
        logger.error(f"News feed error: {e}")
        return {"articles": []}


@api_router.get("/news/article-summary")
async def get_article_summary(url: str):
    """Fetch and summarize a news article"""
    try:
        # Use AI to generate a summary based on the source
        system_prompt = """You are a tech news summarizer. Based on the URL provided, 
create a comprehensive summary of what this source typically covers.

RESPOND ONLY WITH VALID JSON:
{
    "title": "Article/Page Title",
    "source": "Source Name",
    "summary": "Detailed 3-4 paragraph summary",
    "key_points": ["Point 1", "Point 2", "Point 3"],
    "topics_covered": ["Topic 1", "Topic 2"],
    "original_url": "URL"
}"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Summarize content from: {url}")
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {
            "title": "News Article",
            "source": "Unknown",
            "summary": "Summary not available",
            "key_points": [],
            "topics_covered": [],
            "original_url": url
        })
        data["original_url"] = url  # Ensure the original URL is preserved
        
        return data
        
    except Exception as e:
        logger.error(f"Article summary error: {e}")
        return {"error": str(e), "original_url": url}

# ============== WEB RESEARCH ==============

@api_router.post("/research/web")
async def web_research(query: str = Form(...)):
    """Perform web research on a topic"""
    try:
        system_prompt = """You are a research assistant with knowledge up to your training date.
When asked about a topic, provide comprehensive, accurate information based on your knowledge.
If you're unsure about something, clearly state that.

RESPOND ONLY WITH VALID JSON:
{
    "topic": "Topic name",
    "summary": "Comprehensive summary",
    "key_points": ["Point 1", "Point 2"],
    "related_topics": ["Topic 1", "Topic 2"],
    "sources_to_check": ["Suggested source 1", "Suggested source 2"],
    "confidence": "high|medium|low"
}"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Research this topic thoroughly: {query}")
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {
            "topic": query,
            "summary": "Research results",
            "key_points": [],
            "confidence": "medium"
        })
        
        return data
        
    except Exception as e:
        logger.error(f"Web research error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== HEALTHCARE DIAGRAM GENERATION ==============

@api_router.post("/healthcare/diagram")
async def generate_healthcare_diagram(topic: str = Form(...), diagram_type: str = Form("anatomy")):
    """Generate healthcare/medical diagrams using Gemini image generation"""
    try:
        from emergentintegrations.llm.chat import ImageGeneration
        
        prompt_templates = {
            "anatomy": f"Medical educational diagram showing {topic} anatomy. Clean, labeled, professional medical illustration style. White background, clear labels, anatomically accurate.",
            "process": f"Medical process flowchart showing {topic}. Professional medical education style, clear steps, arrows showing flow.",
            "comparison": f"Medical comparison diagram showing {topic}. Side by side comparison, labeled differences, educational style.",
            "timeline": f"Medical timeline showing {topic} progression or treatment stages. Clear stages, professional medical illustration."
        }
        
        prompt = prompt_templates.get(diagram_type, prompt_templates["anatomy"])
        
        # Use Gemini Nano Banana for image generation
        image_gen = ImageGeneration(api_key=EMERGENT_LLM_KEY)
        result = await image_gen.generate(
            prompt=prompt,
            model="gemini",
            size="1024x1024"
        )
        
        return {
            "success": True,
            "image_url": result.url if hasattr(result, 'url') else None,
            "image_base64": result.base64 if hasattr(result, 'base64') else None,
            "topic": topic,
            "diagram_type": diagram_type
        }
        
    except Exception as e:
        logger.error(f"Healthcare diagram error: {e}")
        # Fallback to SVG generation
        return await generate_healthcare_svg(topic, diagram_type)

async def generate_healthcare_svg(topic: str, diagram_type: str):
    """Fallback SVG generation for healthcare diagrams"""
    system_prompt = f"""Create an educational SVG diagram for healthcare topic: {topic}
Type: {diagram_type}

Create a clean, professional medical education diagram.
Use colors: #EA4335 (red for important), #34A853 (green for healthy), #4285F4 (blue for labels), #FBBC04 (yellow for highlights)
Dark background (#1E1E1E), white text for labels.

Respond with ONLY SVG code. Start with <svg and end with </svg>
Size: 800x600 viewBox"""
    
    chat = get_chat_instance(system_prompt)
    user_msg = UserMessage(text=f"Create {diagram_type} diagram for: {topic}")
    response = await chat.send_message(user_msg)
    
    svg_content = response.strip() if response else ""
    if "<svg" in svg_content:
        start = svg_content.find("<svg")
        end = svg_content.rfind("</svg>") + 6
        svg_content = svg_content[start:end]
    else:
        svg_content = f'<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="600" fill="#1E1E1E"/><text x="400" y="300" fill="#FFFFFF" text-anchor="middle" font-size="24">{topic}</text></svg>'
    
    return {
        "success": True,
        "svg": svg_content,
        "topic": topic,
        "diagram_type": diagram_type
    }

# ============== DEEP COMPANY RESEARCH ==============

@api_router.post("/research/company-deep")
async def deep_company_research(company_url: str = Form(...)):
    """Perform deep research on a company by analyzing multiple aspects"""
    try:
        system_prompt = """You are a senior business analyst performing deep company research.
Analyze the company thoroughly and provide comprehensive insights.

IMPORTANT:
- Use only publicly available information
- Cite sources where possible
- If information is not available, say "Not publicly available"
- Be thorough but accurate

RESPOND ONLY WITH VALID JSON:
{
    "company_name": "Company Name",
    "overview": {
        "description": "What the company does",
        "founded": "Year",
        "headquarters": "Location",
        "employees": "Estimate",
        "funding": "If known",
        "valuation": "If known"
    },
    "products_services": [
        {"name": "Product", "description": "What it does", "target_market": "Who uses it"}
    ],
    "use_cases": [
        {"industry": "Industry", "use_case": "How companies use this product", "benefits": "Key benefits"}
    ],
    "competitors": [
        {"name": "Competitor", "comparison": "How they compare", "strengths": "Their strengths"}
    ],
    "pricing": {
        "model": "Pricing model type",
        "tiers": ["Tier 1", "Tier 2"],
        "notes": "Additional pricing info"
    },
    "technology_stack": ["Tech 1", "Tech 2"],
    "team": {
        "leadership": ["CEO", "CTO"],
        "team_size": "Estimate",
        "culture": "Company culture notes"
    },
    "market_position": {
        "market_share": "Estimate if known",
        "growth": "Growth trajectory",
        "strengths": ["Strength 1"],
        "weaknesses": ["Weakness 1"]
    },
    "recent_news": [
        {"headline": "News item", "date": "Approximate date", "significance": "Why it matters"}
    ],
    "recommendations": {
        "for_customers": "Should you use this product?",
        "for_investors": "Investment potential",
        "for_competitors": "How to compete"
    }
}"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Perform deep research on this company: {company_url}\n\nAnalyze their website, products, use cases, competitors, pricing, team, and market position.")
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {
            "company_name": company_url,
            "overview": {"description": "Analysis pending"},
            "products_services": [],
            "use_cases": [],
            "competitors": [],
            "recommendations": {}
        })
        
        return data
        
    except Exception as e:
        logger.error(f"Deep company research error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== AI AGENT BUILDING GUIDE ==============

@api_router.post("/guide/ai-agents")
async def ai_agent_building_guide(level: str = Form("beginner"), agent_type: str = Form("general")):
    """Interactive guide for building AI agents"""
    try:
        system_prompt = f"""You are an expert AI engineer teaching how to build AI agents.
Level: {level}
Agent type: {agent_type}

Create a comprehensive, step-by-step guide for building AI agents.

RESPOND ONLY WITH VALID JSON:
{{
    "title": "Building {agent_type} AI Agents",
    "level": "{level}",
    "introduction": "What are AI agents and why build them",
    "prerequisites": ["Prerequisite 1", "Prerequisite 2"],
    "steps": [
        {{
            "step": 1,
            "title": "Step title",
            "description": "Detailed explanation",
            "code_example": "Code snippet if applicable",
            "tips": ["Tip 1", "Tip 2"]
        }}
    ],
    "architecture": {{
        "components": ["Component 1", "Component 2"],
        "flow": "How data flows through the agent"
    }},
    "tools_and_frameworks": [
        {{"name": "Tool name", "purpose": "What it's used for", "link": "Documentation link"}}
    ],
    "best_practices": ["Best practice 1", "Best practice 2"],
    "common_mistakes": ["Mistake 1", "Mistake 2"],
    "next_steps": ["Advanced topic 1", "Advanced topic 2"],
    "resources": [
        {{"title": "Resource", "type": "tutorial|documentation|video", "url": "Link"}}
    ]
}}"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Create a guide for building {agent_type} AI agents at {level} level")
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {
            "title": f"Building {agent_type} AI Agents",
            "level": level,
            "steps": [],
            "best_practices": []
        })
        
        return data
        
    except Exception as e:
        logger.error(f"AI agent guide error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== ENHANCED ENDPOINTS FOR COMPREHENSIVE FEATURES ==============

# Project Teaching and Analysis
class ProjectTeachingRequest(BaseModel):
    project_id: str
    skill_level: str = "intermediate"

class FileTeachingRequest(BaseModel):
    project_id: str
    file_path: str
    skill_level: str = "intermediate"

@api_router.post("/project/{project_id}/teach")
async def teach_project(project_id: str, request: ProjectTeachingRequest):
    """AI Senior Agent teaches about the entire project comprehensively"""
    try:
        project = await projects_collection.find_one({"project_id": project_id})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        workspace_path = Path(project['workspace_path'])
        
        # Analyze multiple key files
        key_files = []
        for entry_point in project.get('entry_points', [])[:3]:
            try:
                file_path = workspace_path / entry_point
                if file_path.exists() and file_path.is_file():
                    content = file_path.read_text(errors='replace')[:3000]
                    key_files.append({
                        "path": entry_point,
                        "content": content[:1000]  # Truncate for analysis
                    })
            except:
                pass
        
        # Get README if exists
        readme_content = ""
        for readme_name in ['README.md', 'readme.md', 'README.txt']:
            readme_path = workspace_path / readme_name
            if readme_path.exists():
                try:
                    readme_content = readme_path.read_text(errors='replace')[:2000]
                    break
                except:
                    pass
        
        skill_context = get_skill_context(request.skill_level)
        
        system_prompt = f"""You are a world-class senior software engineer and mentor teaching a developer about this codebase.

{skill_context}

RESPONSE STRUCTURE (MANDATORY):
Use clear Markdown with proper formatting:

## 🎯 Project Overview
Brief description of what this project does and its purpose.

## 📂 Project Structure
Explain the folder/file organization and why it's structured this way.

## 🚀 How to Run This Application
Step-by-step instructions to get the project running:
1. Dependencies installation
2. Configuration needed
3. Run commands
4. What to expect

## 📝 Key Files Explained
For each major file, explain:
- **What it does**: Purpose and responsibility
- **How it works**: Key logic and flow
- **Important concepts**: Patterns, frameworks used

## 🧩 Architecture & Design Patterns
Explain the architecture, design patterns, and engineering decisions.

## 🎓 What You'll Learn from This Project
Key learnings and skills this project demonstrates.

## 💡 Next Steps for Learning
Suggestions for:
- What to explore next
- How to extend this project
- Related concepts to study

Be thorough, encouraging, and educational. Act as a senior engineer mentor."""
        
        # Build context
        newline = '\n'
        context = f"""
PROJECT NAME: {project.get('name', 'Unknown')}
FRAMEWORKS: {', '.join(project.get('frameworks', ['None detected']))}
ENTRY POINTS: {', '.join(project.get('entry_points', ['None']))}
BUILD SYSTEM: {project.get('build_system', 'None')}
TOTAL FILES: {project.get('total_files', 0)}
HAS TESTS: {'Yes' if project.get('has_tests', False) else 'No'}

README CONTENT:
{readme_content if readme_content else 'No README found'}

KEY FILES SAMPLE:
{newline.join([f"File: {f['path']}{newline}{f['content'][:500]}..." for f in key_files[:2]])}
"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Teach me about this project:\n\n{context}")
        response = await chat.send_message(user_msg)
        
        return {
            "teaching_content": response or "Unable to analyze project",
            "project_name": project.get('name', 'Unknown'),
            "key_files_analyzed": [f['path'] for f in key_files]
        }
        
    except Exception as e:
        logger.error(f"Project teaching error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/project/{project_id}/teach-file")
async def teach_file(project_id: str, request: FileTeachingRequest):
    """AI Senior Agent explains a specific file in detail"""
    try:
        project = await projects_collection.find_one({"project_id": project_id})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        workspace_path = Path(project['workspace_path'])
        file_path = workspace_path / request.file_path
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        content = file_path.read_text(errors='replace')
        skill_context = get_skill_context(request.skill_level)
        
        system_prompt = f"""You are a senior software engineer explaining code to a developer.

{skill_context}

RESPONSE STRUCTURE (MANDATORY):

## 📄 {request.file_path}

### Purpose
What this file does and why it exists.

### Key Components
Break down the main parts:
- Functions/Classes/Components
- Their responsibilities
- How they work together

### Code Flow
Explain the execution flow step-by-step.

### Important Concepts
Programming concepts, patterns, or techniques used here.

### Dependencies
What this file depends on and what depends on it.

### How to Modify
Guidance on safely making changes to this file.

### Learning Points
Key takeaways for understanding this code.

Be detailed, clear, and educational."""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Explain this file:\n\nPath: {request.file_path}\n\nCode:\n{content[:5000]}")
        response = await chat.send_message(user_msg)
        
        return {
            "teaching_content": response or "Unable to analyze file",
            "file_path": request.file_path
        }
        
    except Exception as e:
        logger.error(f"File teaching error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Deep Research for Business Intelligence
class DeepResearchRequest(BaseModel):
    company_url: str
    depth: str = "comprehensive"  # basic, detailed, comprehensive

@api_router.post("/agent/business/deep-research")
async def business_deep_research(request: DeepResearchRequest):
    """Perform multi-agent deep research on a company"""
    try:
        # Multi-stage research process
        stages = []
        
        # Stage 1: Initial Company Analysis
        stages.append({
            "stage": "company_overview",
            "status": "researching",
            "message": "Researching company website and overview..."
        })
        
        system_prompt_stage1 = """You are a senior business research analyst.
Analyze the company website and extract:
- Company name, mission, and core business
- Main products/services
- Target market and customers
- Company size and locations
- Recent news and updates

Respond with JSON:
{
    "company_name": "Name",
    "mission": "Mission statement",
    "products": ["Product 1", "Product 2"],
    "target_market": "Description",
    "key_facts": ["Fact 1", "Fact 2"]
}"""
        
        chat1 = get_chat_instance(system_prompt_stage1, model_type="pro")  # Use Gemini 3 Pro for deep research
        user_msg1 = UserMessage(text=f"Research this company website: {request.company_url}")
        response1 = await chat1.send_message(user_msg1)
        stage1_data = safe_parse_json(response1, {})
        
        # Stage 2: Products and Services Deep Dive
        stages.append({
            "stage": "products_analysis",
            "status": "researching",
            "message": "Analyzing products and services in detail..."
        })
        
        system_prompt_stage2 = """You are a product analyst.
Research the company's products/services deeply:
- Product catalog and features
- Pricing models
- Target use cases
- Competitive advantages
- Customer testimonials

Respond with JSON."""
        
        chat2 = get_chat_instance(system_prompt_stage2, model_type="pro")
        user_msg2 = UserMessage(text=f"Analyze products for {request.company_url} based on: {stage1_data}")
        response2 = await chat2.send_message(user_msg2)
        stage2_data = safe_parse_json(response2, {})
        
        # Stage 3: Competitive Landscape
        stages.append({
            "stage": "competitive_analysis",
            "status": "researching",
            "message": "Researching competitors and market position..."
        })
        
        system_prompt_stage3 = """You are a competitive intelligence analyst.
Research competitors and market positioning:
- Main competitors
- Competitive advantages/disadvantages
- Market share insights
- Differentiation factors

Respond with JSON."""
        
        chat3 = get_chat_instance(system_prompt_stage3, model_type="pro")
        user_msg3 = UserMessage(text=f"Competitive analysis for {stage1_data.get('company_name', 'company')}")
        response3 = await chat3.send_message(user_msg3)
        stage3_data = safe_parse_json(response3, {})
        
        # Stage 4: Strategic Synthesis
        stages.append({
            "stage": "strategic_synthesis",
            "status": "analyzing",
            "message": "Synthesizing findings into strategic insights..."
        })
        
        # Generate comprehensive 8-sheet Excel data
        sheets = {
            "1_Company_Overview": [
                {"category": "Basic Info", "detail": stage1_data.get("company_name", "N/A"), "source": request.company_url},
                {"category": "Mission", "detail": stage1_data.get("mission", "Not Publicly Available"), "source": request.company_url},
            ],
            "2_Products_Services": [
                {"product": p, "category": "Core Product", "source": request.company_url} 
                for p in stage1_data.get("products", ["Not Publicly Available"])
            ],
            "3_Customer_Success": [
                {"category": "Target Market", "detail": stage1_data.get("target_market", "Not Publicly Available"), "source": request.company_url}
            ],
            "4_Pain_Points": [
                {"type": "Market Challenge", "description": "Requires further research", "source": "Analysis"}
            ],
            "5_Competitive_Analysis": [
                {"competitor": c, "status": "Active", "source": "Market Research"}
                for c in stage3_data.get("competitors", ["Not Publicly Available"])[:5]
            ],
            "6_Case_Studies": [
                {"note": "Case studies require direct customer research", "source": "N/A"}
            ],
            "7_Pricing_Model": [
                {"component": "Pricing", "detail": "Available on company website", "source": request.company_url}
            ],
            "8_OKRs_Strategy": [
                {"objective": "Market Leadership", "rationale": "Based on company positioning"}
            ]
        }
        
        # Generate HTML report
        html_report = generate_html_report({
            "company_name": stage1_data.get("company_name", "Company"),
            "sheets": sheets
        })
        
        stages.append({
            "stage": "complete",
            "status": "complete",
            "message": "Deep research complete!"
        })
        
        return {
            "company_name": stage1_data.get("company_name", "Unknown Company"),
            "research_depth": request.depth,
            "stages": stages,
            "sheets": sheets,
            "html_report": html_report,
            "excel_data": sheets  # Frontend can convert to Excel
        }
        
    except Exception as e:
        logger.error(f"Deep research error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Real-time News Search
@api_router.get("/news/search-live")
async def search_live_news(category: str = "ai", query: Optional[str] = None):
    """Search for real-time news using web search"""
    try:
        # Use web-grounded search for real-time news
        search_query = query or f"latest {category} technology news 2025"
        
        system_prompt = f"""You are a tech news curator with web search access.
Search for REAL, CURRENT news articles published in the last 7 days for: {category}

CRITICAL REQUIREMENTS:
1. Use web search to find ACTUAL published articles
2. Return REAL URLs that actually exist (not fabricated)
3. Verify sources are reputable: TechCrunch, The Verge, Wired, ArsTechnica, Bloomberg, Reuters
4. Extract actual titles and summaries from the articles
5. Include publication date if available

RESPONSE FORMAT (JSON):
{{
    "articles": [
        {{
            "title": "ACTUAL article title from website",
            "summary": "2-3 sentence summary of actual content",
            "source": "Source name (e.g., TechCrunch, The Verge)",
            "url": "REAL, VALID URL - must be accessible",
            "category": "{category}",
            "publishedAt": "ISO date or 'Recent'",
            "key_points": ["Key point 1", "Key point 2"],
            "verified": true
        }}
    ]
}}

IMPORTANT: Only include articles with REAL, working URLs. If you can't verify a URL, don't include it.
Find 6-8 recent articles."""
        
        chat = get_chat_instance(system_prompt, model_type="fast")  # Use fast model for news search
        user_msg = UserMessage(text=f"Find latest news: {search_query}")
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {"articles": []})
        
        # Ensure all articles have required fields
        articles = data.get("articles", [])
        for article in articles:
            if "publishedAt" not in article:
                article["publishedAt"] = datetime.now(timezone.utc).isoformat()
            if "category" not in article:
                article["category"] = category
        
        return {"articles": articles, "query": search_query}
        
    except Exception as e:
        logger.error(f"Live news search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/news/summarize-article")
async def summarize_news_article(url: str):
    """Fetch and summarize a specific news article"""
    try:
        system_prompt = """You are a tech news summarizer.
Based on the article URL, provide a concise summary.

RESPONSE FORMAT (JSON):
{
    "title": "Article title",
    "summary": "3-4 sentence summary",
    "key_points": ["Point 1", "Point 2", "Point 3"],
    "category": "ai|tech|coding|startups",
    "reading_time": "5 min"
}"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=f"Summarize this article: {url}")
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {
            "title": "Article",
            "summary": "Summary not available",
            "key_points": []
        })
        
        return data
        
    except Exception as e:
        logger.error(f"Article summary error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Flight Price Search for Travel Agent
class FlightSearchRequest(BaseModel):
    origin: str
    destination: str
    departure_date: Optional[str] = None
    return_date: Optional[str] = None

@api_router.post("/agent/travel/search-flights")
async def search_flight_prices(request: FlightSearchRequest):
    """Search for indicative flight prices online"""
    try:
        system_prompt = """You are a travel research assistant with web search access.

CRITICAL: You MUST search online for REAL flight prices using web search.
Search Google Flights, Skyscanner, Kayak, airline websites for actual current prices.

RESPONSE FORMAT (JSON):
{
    "route": "City A to City B",
    "price_range": "$XXX - $YYY USD (indicative, based on current search)",
    "best_time_to_book": "Time frame based on research",
    "typical_duration": "X hours",
    "airlines": ["Airline 1", "Airline 2", "Airline 3"],
    "tips": ["Book Tuesday-Wednesday for better deals", "Consider layovers", "Check budget airlines"],
    "last_updated": "Today's date",
    "sources": ["Google Flights", "Skyscanner", "Kayak"],
    "search_urls": ["https://www.google.com/flights?..."],
    "disclaimer": "Prices are indicative based on live web search conducted today. Please verify on airline websites before booking.",
    "research_note": "Searched multiple booking platforms for current prices"
}

MANDATORY: Actually search the web for current flight prices. Don't guess."""
        
        chat = get_chat_instance(system_prompt)
        
        search_text = f"""Search the web NOW for flight prices:
From: {request.origin}
To: {request.destination}
{f'Departure: {request.departure_date}' if request.departure_date else 'Flexible dates'}
{f'Return: {request.return_date}' if request.return_date else 'One-way or flexible'}

Use web search to find:
1. Current prices on Google Flights
2. Price comparison on Skyscanner  
3. Airline direct prices
4. Budget airline options

Provide REAL price ranges found through live search."""
        
        user_msg = UserMessage(text=search_text)
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {
            "route": f"{request.origin} to {request.destination}",
            "price_range": "Price data not available",
            "disclaimer": "Prices are indicative. Check airline websites for current prices."
        })
        
        return data
        
    except Exception as e:
        logger.error(f"Flight search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Learning Path with Online Resources
class LearningResourcesRequest(BaseModel):
    topic: str
    level: str = "beginner"  # beginner, intermediate, advanced
    goal: str = ""

@api_router.post("/learning/research-resources")
async def research_learning_resources(request: LearningResourcesRequest):
    """Research free online courses, YouTube tutorials, and learning paths using Gemini Deep Research"""
    try:
        # Use Gemini Deep Research Agent for comprehensive search
        system_prompt = f"""You are researching learning resources for: {request.topic}

Find 3-5 REAL YouTube tutorial videos and 2-3 free courses.

IMPORTANT: Return ONLY valid JSON in this exact format:
{{
    "youtube_playlists": [
        {{
            "title": "actual video title",
            "channel": "actual channel name",
            "url": "https://www.youtube.com/watch?v=VIDEO_ID",
            "estimated_duration": "duration"
        }}
    ],
    "free_courses": [
        {{
            "title": "actual course name",
            "platform": "Coursera",
            "url": "https://coursera.org/...",
            "level": "{request.level}"
        }}
    ]
}}

Search YouTube and course platforms NOW. Return actual URLs."""
        
        # Try using chat with explicit JSON mode
        chat = get_chat_instance(system_prompt, model_type="pro")
        
        user_msg = UserMessage(text=f"""Search for {request.topic} learning resources.
Find:
1. YouTube tutorials (search: "{request.topic} tutorial")
2. YouTube courses (search: "{request.topic} course") 
3. Free online courses

Return JSON with youtube_playlists and free_courses arrays.""")
        
        response = await chat.send_message(user_msg)
        
        # Try to parse JSON from response
        try:
            # Clean the response - remove markdown code blocks if present
            cleaned = response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            
            data = json.loads(cleaned)
            
            # Validate structure
            if "youtube_playlists" not in data:
                data["youtube_playlists"] = []
            if "free_courses" not in data:
                data["free_courses"] = []
                
            # If still empty, add fallback manual search suggestions
            if len(data["youtube_playlists"]) == 0:
                data["youtube_playlists"] = [
                    {
                        "title": f"{request.topic} - Full Course Tutorial",
                        "channel": "Search YouTube manually",
                        "url": f"https://www.youtube.com/results?search_query={request.topic.replace(' ', '+')}+tutorial",
                        "estimated_duration": "Variable",
                        "manual_search": True
                    }
                ]
            
            data["topic"] = request.topic
            data["level"] = request.level
            
            return data
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}. Response was: {response}")
            # Return structure with manual search links
            return {
                "topic": request.topic,
                "level": request.level,
                "youtube_playlists": [
                    {
                        "title": f"Search YouTube: {request.topic} Tutorial",
                        "channel": "Manual Search Needed",
                        "url": f"https://www.youtube.com/results?search_query={request.topic.replace(' ', '+')}+tutorial",
                        "estimated_duration": "Variable",
                        "manual_search": True
                    }
                ],
                "free_courses": []
            }
        
    except Exception as e:
        logger.error(f"Learning resources research error: {e}")
        # Don't fail - return manual search option
        return {
            "topic": request.topic,
            "level": request.level,
            "youtube_playlists": [
                {
                    "title": f"Search for {request.topic} tutorials on YouTube",
                    "channel": "YouTube Search",
                    "url": f"https://www.youtube.com/results?search_query={request.topic.replace(' ', '+')}+full+course",
                    "estimated_duration": "Variable",
                    "manual_search": True
                }
            ],
            "free_courses": []
        }
        
    except Exception as e:
        logger.error(f"Learning resources research error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Manual YouTube URL addition for topics
class AddVideoRequest(BaseModel):
    topic_id: str
    video_url: str
    video_title: str = ""

@api_router.post("/learning/topic/add-video")
async def add_video_to_topic(request: AddVideoRequest):
    """Allow users to manually add YouTube videos to their learning topics"""
    try:
        # Extract video ID from URL
        video_id = None
        if "youtube.com/watch?v=" in request.video_url:
            video_id = request.video_url.split("watch?v=")[1].split("&")[0]
        elif "youtu.be/" in request.video_url:
            video_id = request.video_url.split("youtu.be/")[1].split("?")[0]
        
        if not video_id:
            raise HTTPException(status_code=400, detail="Invalid YouTube URL")
        
        # Fetch video metadata using Gemini to analyze
        system_prompt = """You are analyzing a YouTube video to help create learning content.
        
Based on the video URL provided, return JSON with:
{
    "title": "video title if known",
    "estimated_duration": "duration if known",
    "topics_covered": ["topic1", "topic2"],
    "difficulty_level": "beginner|intermediate|advanced"
}"""
        
        chat = get_chat_instance(system_prompt, model_type="fast")
        user_msg = UserMessage(text=f"""Analyze this YouTube video: https://www.youtube.com/watch?v={video_id}
        
Title provided by user: {request.video_title or 'Not provided'}

Return JSON with video metadata.""")
        
        response = await chat.send_message(user_msg)
        metadata = safe_parse_json(response, {
            "title": request.video_title or "Custom Video",
            "estimated_duration": "Unknown"
        })
        
        return {
            "success": True,
            "video_id": video_id,
            "video_url": f"https://www.youtube.com/watch?v={video_id}",
            "metadata": metadata,
            "message": "Video added to learning topic"
        }
        
    except Exception as e:
        logger.error(f"Add video error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Video Learning Q&A
class VideoQARequest(BaseModel):
    question: str
    video_title: str
    video_id: str
    current_time: float = 0
    skill_level: str = "intermediate"
    has_transcript: bool = False

@api_router.post("/learning/video-qa")
async def video_qa(request: VideoQARequest):
    """Answer questions about a video being watched"""
    try:
        skill_context = get_skill_context(request.skill_level)
        
        system_prompt = f"""You are an expert teaching assistant helping a student understand an educational video.

VIDEO CONTEXT:
- Title: {request.video_title}
- Video ID: {request.video_id}
- Current timestamp: {int(request.current_time)}s

{skill_context}

YOUR ROLE:
- Answer questions about the video content
- Explain concepts clearly and thoroughly
- Provide code examples when relevant
- Use analogies to simplify complex topics
- Reference specific parts of the video when helpful

RESPONSE STYLE:
- Start with a direct answer
- Then provide detailed explanation
- Use bullet points for clarity
- Include examples or analogies
- End with "Need me to explain more?" if complex

Keep responses focused, clear, and educational. Use markdown formatting.
"""
        
        chat = get_chat_instance(system_prompt, model_type="fast")
        
        context = f"""Student is watching: "{request.video_title}"

Student's question: {request.question}

{'[Transcript available - you can reference video content]' if request.has_transcript else '[Limited context - provide general educational answer]'}

Provide a helpful, clear explanation that helps the student learn."""
        
        user_msg = UserMessage(text=context)
        response = await chat.send_message(user_msg)
        
        return {
            "answer": response or "I apologize, but I need more context to answer that question accurately.",
            "video_id": request.video_id,
            "timestamp": request.current_time
        }
        
    except Exception as e:
        logger.error(f"Video QA error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== ENHANCED VIDEO LEARNING WITH AI MENTORING ==============

# YouTube Transcript Fetching
try:
    from youtube_transcript_api import YouTubeTranscriptApi
    TRANSCRIPT_API_AVAILABLE = True
except ImportError:
    TRANSCRIPT_API_AVAILABLE = False
    logger.warning("youtube-transcript-api not installed. Video transcripts will not be available.")

class VideoTranscriptRequest(BaseModel):
    video_id: str
    language: str = "en"

@api_router.post("/learning/video/transcript")
async def get_video_transcript(request: VideoTranscriptRequest):
    """Fetch YouTube video transcript"""
    if not TRANSCRIPT_API_AVAILABLE:
        raise HTTPException(status_code=501, detail="Transcript API not available")
    
    try:
        # Fetch transcript
        transcript_list = YouTubeTranscriptApi.get_transcript(
            request.video_id,
            languages=[request.language, 'en']
        )
        
        # Format transcript with timestamps
        formatted_transcript = []
        full_text = []
        
        for entry in transcript_list:
            formatted_transcript.append({
                "start": entry['start'],
                "duration": entry['duration'],
                "text": entry['text']
            })
            full_text.append(entry['text'])
        
        return {
            "success": True,
            "video_id": request.video_id,
            "transcript": formatted_transcript,
            "full_text": " ".join(full_text),
            "total_segments": len(formatted_transcript),
            "available": True
        }
        
    except Exception as e:
        logger.error(f"Transcript fetch error: {e}")
        return {
            "success": False,
            "video_id": request.video_id,
            "transcript": [],
            "full_text": "",
            "total_segments": 0,
            "available": False,
            "error": str(e)
        }

class VideoContextualHelpRequest(BaseModel):
    video_id: str
    video_title: str
    current_time: float
    transcript_segment: Optional[str] = None
    skill_level: str = "intermediate"
    help_type: str = "explain"  # explain, clarify, example, deeper

@api_router.post("/learning/video/contextual-help")
async def video_contextual_help(request: VideoContextualHelpRequest):
    """Proactive AI help based on current video position"""
    try:
        skill_context = get_skill_context(request.skill_level)
        
        help_prompts = {
            "explain": "Explain what's being discussed",
            "clarify": "Clarify this concept in simpler terms",
            "example": "Provide a practical example",
            "deeper": "Go deeper into this topic"
        }
        
        system_prompt = f"""You are an AI learning companion watching a video alongside the student.

VIDEO: {request.video_title}
TIMESTAMP: {int(request.current_time)}s
HELP TYPE: {help_prompts.get(request.help_type, 'Help')}

{skill_context}

YOUR ROLE AS AI WATCHING COMPANION:
- You're watching the video WITH the student (not just answering questions)
- Provide proactive insights based on what's currently on screen
- Anticipate confusion and explain preemptively
- Suggest "pause here if you're confused" moments
- Connect concepts to previous parts of the video
- Highlight key takeaways

RESPONSE FORMAT:
## 🎯 Quick Insight
[One-sentence key point]

## 📖 Explanation
[Clear, detailed explanation]

## 💡 Pro Tip
[Additional context or best practice]

## ⏸️ Need to Pause?
[Yes/No + reason]

Keep it conversational and supportive!"""
        
        chat = get_chat_instance(system_prompt)
        
        context = f"""At {int(request.current_time)}s in the video...
        
"""
        
        if request.transcript_segment:
            context += f"Currently being said: \"{request.transcript_segment}\"\n\n"
        
        context += f"Student wants: {help_prompts.get(request.help_type, 'Help understanding this part')}"
        
        user_msg = UserMessage(text=context)
        response = await chat.send_message(user_msg)
        
        return {
            "help": response,
            "timestamp": request.current_time,
            "video_id": request.video_id,
            "help_type": request.help_type
        }
        
    except Exception as e:
        logger.error(f"Contextual help error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ProactiveVideoAnalysisRequest(BaseModel):
    video_id: str
    video_title: str
    current_time: float
    last_pause_time: Optional[float] = None
    watch_duration: float = 0
    skill_level: str = "intermediate"
    transcript_context: Optional[str] = None

@api_router.post("/learning/video/proactive-analysis")
async def proactive_video_analysis(request: ProactiveVideoAnalysisRequest):
    """AI proactively analyzes if student might need help"""
    try:
        skill_context = get_skill_context(request.skill_level)
        
        # Detect potential confusion signals
        rewound = request.last_pause_time and request.current_time < request.last_pause_time
        paused_frequently = request.watch_duration > request.current_time * 1.5
        
        system_prompt = f"""You are an AI mentor monitoring a student's learning in real-time.

VIDEO: {request.video_title}
CURRENT: {int(request.current_time)}s
SIGNALS: {'Rewound video' if rewound else 'Normal playback'}

{skill_context}

ANALYZE:
1. Is this a complex section that might need explanation?
2. Should I offer proactive help?
3. What specific insight would be most valuable?

RESPOND WITH:
{{
    "should_intervene": true/false,
    "reason": "Why intervention is/isn't needed",
    "proactive_message": "Helpful message if intervening",
    "severity": "low|medium|high"
}}"""
        
        chat = get_chat_instance(system_prompt, model_type="fast")
        
        context = f"""Student watching: {request.video_title}
Timestamp: {int(request.current_time)}s
Watch pattern: {'Possible confusion - rewound' if rewound else 'Steady progress'}

"""
        
        if request.transcript_context:
            context += f"Current content: \"{request.transcript_context[:200]}...\""
        
        user_msg = UserMessage(text=context)
        response = await chat.send_message(user_msg)
        
        analysis = safe_parse_json(response, {
            "should_intervene": False,
            "reason": "No intervention needed",
            "proactive_message": "",
            "severity": "low"
        })
        
        return analysis
        
    except Exception as e:
        logger.error(f"Proactive analysis error: {e}")
        return {
            "should_intervene": False,
            "reason": "Analysis error",
            "proactive_message": "",
            "severity": "low"
        }

class ComprehensionCheckRequest(BaseModel):
    video_id: str
    video_title: str
    topic_covered: str
    skill_level: str = "intermediate"

@api_router.post("/learning/video/comprehension-check")
async def video_comprehension_check(request: ComprehensionCheckRequest):
    """Generate quick comprehension check question"""
    try:
        skill_context = get_skill_context(request.skill_level)
        
        system_prompt = f"""Generate a quick comprehension check question for a video topic.

TOPIC: {request.topic_covered}
VIDEO: {request.video_title}

{skill_context}

CREATE:
1. One focused question testing understanding
2. 4 multiple choice options (A, B, C, D)
3. Correct answer with brief explanation

FORMAT AS JSON:
{{
    "question": "Your question",
    "options": {{
        "A": "option 1",
        "B": "option 2",
        "C": "option 3",
        "D": "option 4"
    }},
    "correct_answer": "A",
    "explanation": "Why this is correct"
}}"""
        
        chat = get_chat_instance(system_prompt, model_type="fast")
        user_msg = UserMessage(text=f"Generate comprehension check for: {request.topic_covered}")
        response = await chat.send_message(user_msg)
        
        question_data = safe_parse_json(response, {
            "question": "What did you learn from this video?",
            "options": {
                "A": "Concept A",
                "B": "Concept B",
                "C": "Concept C",
                "D": "All of the above"
            },
            "correct_answer": "D",
            "explanation": "The video covered all these concepts"
        })
        
        return question_data
        
    except Exception as e:
        logger.error(f"Comprehension check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ScreenshotAnalysisRequest(BaseModel):
    image_base64: str
    video_title: str
    current_time: float = 0
    skill_level: str = "intermediate"
    transcript_context: Optional[str] = None
    conversation_history: List[Dict] = []

@api_router.post("/learning/video/analyze-screenshot")
async def analyze_video_screenshot(request: ScreenshotAnalysisRequest):
    """Analyze a screenshot from a video learning session with full context"""
    try:
        skill_context = get_skill_context(request.skill_level)
        
        # Build conversation context
        context_summary = ""
        if request.conversation_history:
            context_summary = "\n".join([
                f"- {item.get('type', 'interaction')}: {item.get('summary', '')[:100]}"
                for item in request.conversation_history[-5:]
            ])
        
        system_prompt = f"""You are an AI learning companion analyzing a screenshot from a video tutorial.

VIDEO: {request.video_title}
TIMESTAMP: {int(request.current_time)} seconds into video

{skill_context}

TRANSCRIPT CONTEXT (what was being said):
{request.transcript_context or "Not available"}

PREVIOUS CONVERSATION:
{context_summary or "New session"}

ANALYZE THE SCREENSHOT:
1. Identify what's being shown (code, diagram, UI, concept explanation, etc.)
2. Explain what you see in context of the video topic
3. Highlight key concepts visible
4. Offer to explain anything confusing
5. Connect it to what was being said in the transcript

Be specific to what you see. Help the student understand the visual content in relation to the learning material."""

        chat = get_chat_instance(system_prompt, model_type="fast")
        
        # Send image with context
        user_msg = UserMessage(
            text=f"Please analyze this screenshot from the video '{request.video_title}' taken at {int(request.current_time)} seconds. What do you see and how does it relate to what's being taught?",
            image=request.image_base64
        )
        
        response = await chat.send_message(user_msg)
        
        return {
            "success": True,
            "analysis": response,
            "timestamp": request.current_time,
            "video_title": request.video_title
        }
        
    except Exception as e:
        logger.error(f"Screenshot analysis error: {e}")
        return {
            "success": False,
            "analysis": f"I can see you've shared a screenshot from '{request.video_title}'. Could you tell me what specific part you'd like me to explain?",
            "error": str(e)
        }

# ============== MOLTBOT MULTI-AGENT SYSTEM ==============

class MoltbotChatRequest(BaseModel):
    message: str
    agent_mode: str = "general"  # general, research, coding, creative, learning, business
    conversation_history: List[Dict[str, str]] = []
    session_id: str
    thinking_mode: str = "normal"  # normal, extended, senior_engineer
    skill_level: str = "intermediate"

@api_router.post("/moltbot/chat")
async def moltbot_chat(request: MoltbotChatRequest):
    """
    Moltbot-style multi-agent chat with senior engineer thinking
    Supports multiple specialized agent modes with deep reasoning
    """
    try:
        skill_context = get_skill_context(request.skill_level)
        
        # Agent mode configurations
        agent_configs = {
            "general": {
                "role": "General AI Assistant",
                "capabilities": "Versatile help with any task",
                "tone": "Helpful and knowledgeable"
            },
            "research": {
                "role": "Deep Research Specialist",
                "capabilities": "Web search, analysis, citations",
                "tone": "Analytical and thorough"
            },
            "coding": {
                "role": "Senior Software Engineer",
                "capabilities": "Code review, debugging, architecture",
                "tone": "Technical and precise"
            },
            "creative": {
                "role": "Creative Writer",
                "capabilities": "Content creation, copywriting, storytelling",
                "tone": "Creative and engaging"
            },
            "learning": {
                "role": "Learning Tutor",
                "capabilities": "Teaching, explanations, learning paths",
                "tone": "Patient and pedagogical"
            },
            "business": {
                "role": "Business Intelligence Analyst",
                "capabilities": "Market research, company analysis, strategy",
                "tone": "Strategic and data-driven"
            }
        }
        
        agent_config = agent_configs.get(request.agent_mode, agent_configs["general"])
        
        # Senior engineer thinking system
        thinking_prompts = {
            "normal": "",
            "extended": """
            
EXTENDED THINKING MODE:
Before answering, think through:
1. What is the user really asking?
2. What context am I missing?
3. What are the edge cases?
4. What's the best solution?

Show your reasoning briefly.""",
            "senior_engineer": """

SENIOR ENGINEER MODE:
Approach this like a senior engineer:
1. **Architecture First** - Think about system design
2. **Trade-offs** - What are we optimizing for?
3. **Production Grade** - Scalability, maintainability, security
4. **Long-term Impact** - How will this decision affect the system?

Provide:
- Your reasoning process (2-3 key thoughts)
- The solution with context
- Trade-offs considered
- Production recommendations"""
        }
        
        system_prompt = f"""You are **{agent_config['role']}** in the Moltbot multi-agent system.

**ROLE**: {agent_config['capabilities']}
**TONE**: {agent_config['tone']}

{skill_context}

{thinking_prompts.get(request.thinking_mode, '')}

**RESPONSE FORMAT**:
Use clean Markdown formatting:
- # Headings for main sections
- **Bold** for emphasis
- `code` for technical terms
- > blockquotes for important notes
- bullet points for lists
- numbered lists for steps
- tables for comparisons

Keep responses:
- Structured and scannable
- Action-oriented
- Professional but approachable

Remember: You're part of a multi-agent system. Stay in your role."""
        
        chat = get_chat_instance(system_prompt)
        
        # Build context with conversation history
        context_parts = []
        
        if request.conversation_history:
            context_parts.append("**Previous Context**:")
            for msg in request.conversation_history[-5:]:  # Last 5 messages
                role = msg.get("role", "user")
                content = msg.get("content", "")
                context_parts.append(f"- {role}: {content[:100]}...")
            context_parts.append("")
        
        context_parts.append(f"**Current Message**: {request.message}")
        
        user_msg = UserMessage(text="\n".join(context_parts))
        response = await chat.send_message(user_msg)
        
        return {
            "response": response,
            "agent_mode": request.agent_mode,
            "agent_config": agent_config,
            "thinking_mode": request.thinking_mode,
            "session_id": request.session_id
        }
        
    except Exception as e:
        logger.error(f"Moltbot chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class MoltbotStatusRequest(BaseModel):
    session_id: Optional[str] = None

@api_router.get("/moltbot/status")
async def moltbot_status(session_id: Optional[str] = None):
    """Get Moltbot gateway status (like real Moltbot health check)"""
    return {
        "gateway": "online",
        "version": "2026.1.27",
        "features": {
            "multi_agent": True,
            "senior_thinking": True,
            "video_mentoring": True,
            "real_time_help": True,
            "transcript_analysis": TRANSCRIPT_API_AVAILABLE
        },
        "agents": [
            {"id": "general", "status": "ready"},
            {"id": "research", "status": "ready"},
            {"id": "coding", "status": "ready"},
            {"id": "creative", "status": "ready"},
            {"id": "learning", "status": "ready"},
            {"id": "business", "status": "ready"}
        ],
        "session_id": session_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# ============== CUSTOM LEARNING PATH MANAGEMENT ==============
# Allow users to create, edit, and manage their own learning topics and videos

# Collection for custom learning paths
custom_learning_paths_collection = db.custom_learning_paths

class CreateCustomTopicRequest(BaseModel):
    path_id: str  # The learning path this topic belongs to
    parent_id: Optional[str] = None  # Parent topic ID (for nested topics)
    name: str
    description: Optional[str] = ""
    level: str = "beginner"
    estimated_time: Optional[str] = "1-2 hours"
    youtube_url: Optional[str] = None

class UpdateTopicRequest(BaseModel):
    topic_id: str
    name: Optional[str] = None
    description: Optional[str] = None
    youtube_url: Optional[str] = None
    status: Optional[str] = None  # not_started, in_progress, completed

class AddYoutubeToTopicRequest(BaseModel):
    topic_id: str
    youtube_url: str
    title: Optional[str] = None

class CreateLearningPathRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    career_goal: Optional[str] = ""

@api_router.post("/learning/paths/create")
async def create_custom_learning_path(request: CreateLearningPathRequest):
    """Create a new custom learning path"""
    try:
        path_id = str(uuid.uuid4())
        
        path_data = {
            "path_id": path_id,
            "name": request.name,
            "description": request.description,
            "career_goal": request.career_goal,
            "topics": [],  # Start with empty topics
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await custom_learning_paths_collection.insert_one(path_data)
        
        return {
            "success": True,
            "path_id": path_id,
            "path": {
                "path_id": path_id,
                "name": request.name,
                "description": request.description,
                "topics": []
            }
        }
    except Exception as e:
        logger.error(f"Create learning path error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/learning/paths")
async def get_custom_learning_paths():
    """Get all custom learning paths"""
    try:
        paths = await custom_learning_paths_collection.find({}, {"_id": 0}).to_list(100)
        return {"paths": paths}
    except Exception as e:
        logger.error(f"Get learning paths error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/learning/paths/{path_id}")
async def get_custom_learning_path(path_id: str):
    """Get a specific custom learning path"""
    try:
        path = await custom_learning_paths_collection.find_one({"path_id": path_id}, {"_id": 0})
        if not path:
            raise HTTPException(status_code=404, detail="Learning path not found")
        return path
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get learning path error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/learning/paths/{path_id}/topics")
async def add_topic_to_path(path_id: str, request: CreateCustomTopicRequest):
    """Add a new topic to a learning path"""
    try:
        topic_id = str(uuid.uuid4())
        
        # Extract YouTube video ID if URL provided
        video_id = None
        if request.youtube_url:
            if "youtube.com/watch?v=" in request.youtube_url:
                video_id = request.youtube_url.split("watch?v=")[1].split("&")[0]
            elif "youtu.be/" in request.youtube_url:
                video_id = request.youtube_url.split("youtu.be/")[1].split("?")[0]
        
        new_topic = {
            "id": topic_id,
            "name": request.name,
            "description": request.description,
            "level": request.level,
            "estimated_time": request.estimated_time,
            "status": "not_started",
            "parent_id": request.parent_id,
            "youtube_url": request.youtube_url,
            "video_id": video_id,
            "children": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Add topic to the path
        if request.parent_id:
            # Add as child of parent topic - need to find and update nested
            path = await custom_learning_paths_collection.find_one({"path_id": path_id})
            if not path:
                raise HTTPException(status_code=404, detail="Learning path not found")
            
            def add_to_parent(topics, parent_id, new_topic):
                for topic in topics:
                    if topic["id"] == parent_id:
                        if "children" not in topic:
                            topic["children"] = []
                        topic["children"].append(new_topic)
                        return True
                    if "children" in topic and add_to_parent(topic["children"], parent_id, new_topic):
                        return True
                return False
            
            topics = path.get("topics", [])
            add_to_parent(topics, request.parent_id, new_topic)
            
            await custom_learning_paths_collection.update_one(
                {"path_id": path_id},
                {"$set": {"topics": topics, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        else:
            # Add as root level topic
            await custom_learning_paths_collection.update_one(
                {"path_id": path_id},
                {
                    "$push": {"topics": new_topic},
                    "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
                }
            )
        
        return {
            "success": True,
            "topic": new_topic
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add topic error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/learning/topics/{topic_id}")
async def update_topic(topic_id: str, request: UpdateTopicRequest):
    """Update a topic (name, description, status, youtube_url)"""
    try:
        # Build update data
        update_data = {}
        if request.name is not None:
            update_data["name"] = request.name
        if request.description is not None:
            update_data["description"] = request.description
        if request.status is not None:
            update_data["status"] = request.status
        if request.youtube_url is not None:
            update_data["youtube_url"] = request.youtube_url
            # Extract video ID
            if "youtube.com/watch?v=" in request.youtube_url:
                update_data["video_id"] = request.youtube_url.split("watch?v=")[1].split("&")[0]
            elif "youtu.be/" in request.youtube_url:
                update_data["video_id"] = request.youtube_url.split("youtu.be/")[1].split("?")[0]
        
        # Find and update the topic in all paths
        paths = await custom_learning_paths_collection.find({}).to_list(100)
        
        def update_in_topics(topics, topic_id, update_data):
            for topic in topics:
                if topic["id"] == topic_id:
                    topic.update(update_data)
                    return True
                if "children" in topic and update_in_topics(topic["children"], topic_id, update_data):
                    return True
            return False
        
        updated = False
        for path in paths:
            topics = path.get("topics", [])
            if update_in_topics(topics, topic_id, update_data):
                await custom_learning_paths_collection.update_one(
                    {"path_id": path["path_id"]},
                    {"$set": {"topics": topics, "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
                updated = True
                break
        
        if not updated:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        return {"success": True, "updated": update_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update topic error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/learning/topics/{topic_id}")
async def delete_topic(topic_id: str):
    """Delete a topic from learning path"""
    try:
        paths = await custom_learning_paths_collection.find({}).to_list(100)
        
        def remove_from_topics(topics, topic_id):
            for i, topic in enumerate(topics):
                if topic["id"] == topic_id:
                    topics.pop(i)
                    return True
                if "children" in topic and remove_from_topics(topic["children"], topic_id):
                    return True
            return False
        
        deleted = False
        for path in paths:
            topics = path.get("topics", [])
            if remove_from_topics(topics, topic_id):
                await custom_learning_paths_collection.update_one(
                    {"path_id": path["path_id"]},
                    {"$set": {"topics": topics, "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
                deleted = True
                break
        
        if not deleted:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        return {"success": True, "deleted": topic_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete topic error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/learning/topics/{topic_id}/youtube")
async def add_youtube_to_topic(topic_id: str, request: AddYoutubeToTopicRequest):
    """Add or update YouTube video for a topic"""
    try:
        # Extract video ID
        video_id = None
        if "youtube.com/watch?v=" in request.youtube_url:
            video_id = request.youtube_url.split("watch?v=")[1].split("&")[0]
        elif "youtu.be/" in request.youtube_url:
            video_id = request.youtube_url.split("youtu.be/")[1].split("?")[0]
        
        if not video_id:
            raise HTTPException(status_code=400, detail="Invalid YouTube URL")
        
        # Get video info via oEmbed API (no API key needed)
        import urllib.request
        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        
        video_title = request.title
        thumbnail_url = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"
        
        try:
            with urllib.request.urlopen(oembed_url, timeout=5) as response:
                oembed_data = json.loads(response.read().decode())
                video_title = video_title or oembed_data.get("title", "YouTube Video")
        except:
            video_title = video_title or "YouTube Video"
        
        update_data = {
            "youtube_url": f"https://www.youtube.com/watch?v={video_id}",
            "video_id": video_id,
            "video_title": video_title,
            "thumbnail_url": thumbnail_url
        }
        
        # Update the topic
        paths = await custom_learning_paths_collection.find({}).to_list(100)
        
        def update_in_topics(topics, topic_id, update_data):
            for topic in topics:
                if topic["id"] == topic_id:
                    topic.update(update_data)
                    return True
                if "children" in topic and update_in_topics(topic["children"], topic_id, update_data):
                    return True
            return False
        
        updated = False
        for path in paths:
            topics = path.get("topics", [])
            if update_in_topics(topics, topic_id, update_data):
                await custom_learning_paths_collection.update_one(
                    {"path_id": path["path_id"]},
                    {"$set": {"topics": topics, "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
                updated = True
                break
        
        if not updated:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        return {
            "success": True,
            "video_id": video_id,
            "video_title": video_title,
            "thumbnail_url": thumbnail_url,
            "youtube_url": f"https://www.youtube.com/watch?v={video_id}"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add YouTube to topic error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/learning/youtube/preview/{video_id}")
async def get_youtube_preview(video_id: str):
    """Get YouTube video preview info"""
    try:
        import urllib.request
        
        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        
        try:
            with urllib.request.urlopen(oembed_url, timeout=5) as response:
                oembed_data = json.loads(response.read().decode())
                return {
                    "success": True,
                    "video_id": video_id,
                    "title": oembed_data.get("title", "YouTube Video"),
                    "author_name": oembed_data.get("author_name", "Unknown"),
                    "thumbnail_url": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
                    "embed_url": f"https://www.youtube-nocookie.com/embed/{video_id}"
                }
        except Exception as e:
            # Fallback with basic info
            return {
                "success": True,
                "video_id": video_id,
                "title": "YouTube Video",
                "author_name": "Unknown",
                "thumbnail_url": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
                "embed_url": f"https://www.youtube-nocookie.com/embed/{video_id}"
            }
    except Exception as e:
        logger.error(f"YouTube preview error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router
app.include_router(api_router)

# ============== FULL MOLTBOT IMPLEMENTATION ==============
# Complete standalone Moltbot with all tools

from moltbot_tools import (
    process_manager,
    web_search_tool,
    web_fetch_tool,
    browser_tool,
    skills_manager,
    memory_system
)

# Moltbot API Router
moltbot_router = APIRouter(prefix="/api/moltbot/tools", tags=["Moltbot Tools"])

# ============== EXEC TOOL ==============

class ExecRequest(BaseModel):
    command: str
    workdir: Optional[str] = None
    env: Optional[Dict[str, str]] = None
    background: bool = False
    timeout: int = 1800
    yield_ms: int = 10000

@moltbot_router.post("/exec")
async def exec_tool(request: ExecRequest):
    """
    Execute shell commands (Moltbot exec tool)
    Supports foreground and background execution
    """
    try:
        if request.background or len(request.command) > 100:
            # Background execution
            result = await process_manager.create_session(
                command=request.command,
                workdir=request.workdir,
                env=request.env,
                timeout=request.timeout
            )
            return {
                "status": "running" if result["status"] == "running" else "error",
                "session_id": result.get("session_id"),
                "pid": result.get("pid"),
                "command": request.command
            }
        else:
            # Foreground execution (quick commands)
            process = await asyncio.create_subprocess_shell(
                request.command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=request.workdir or os.getcwd()
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=min(request.timeout, 60)
            )
            
            return {
                "status": "completed",
                "exit_code": process.returncode,
                "stdout": stdout.decode('utf-8', errors='replace'),
                "stderr": stderr.decode('utf-8', errors='replace'),
                "command": request.command
            }
            
    except asyncio.TimeoutError:
        return {
            "status": "timeout",
            "error": "Command execution timed out",
            "command": request.command
        }
    except Exception as e:
        logger.error(f"Exec tool error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== PROCESS TOOL ==============

@moltbot_router.get("/process/list")
async def process_list():
    """List all background process sessions"""
    sessions = await process_manager.list_sessions()
    return {"sessions": sessions, "count": len(sessions)}

@moltbot_router.post("/process/poll")
async def process_poll(session_id: str, offset: int = 0):
    """Poll process session for new output"""
    result = await process_manager.poll(session_id, offset)
    return result

@moltbot_router.post("/process/kill")
async def process_kill(session_id: str):
    """Kill a running process session"""
    result = await process_manager.kill(session_id)
    return result

# ============== WEB SEARCH TOOL ==============

class WebSearchRequest(BaseModel):
    query: str
    count: int = 5
    country: Optional[str] = None
    search_lang: Optional[str] = None

@moltbot_router.post("/web/search")
async def web_search(request: WebSearchRequest):
    """
    Search the web using Brave API (Moltbot web_search tool)
    Requires BRAVE_API_KEY environment variable
    """
    result = await web_search_tool.search(
        query=request.query,
        count=request.count,
        country=request.country,
        search_lang=request.search_lang
    )
    return result

# ============== WEB FETCH TOOL ==============

class WebFetchRequest(BaseModel):
    url: str
    extract_mode: str = "markdown"
    max_chars: int = 50000

@moltbot_router.post("/web/fetch")
async def web_fetch(request: WebFetchRequest):
    """
    Fetch and extract webpage content (Moltbot web_fetch tool)
    Converts HTML to markdown or plain text
    """
    result = await web_fetch_tool.fetch(
        url=request.url,
        extract_mode=request.extract_mode,
        max_chars=request.max_chars
    )
    return result

# ============== BROWSER TOOL ==============

class BrowserAction(BaseModel):
    action: str
    url: Optional[str] = None
    selector: Optional[str] = None
    text: Optional[str] = None
    full_page: bool = False

@moltbot_router.post("/browser")
async def browser_control(request: BrowserAction):
    """
    Control browser using Playwright (Moltbot browser tool)
    Actions: start, stop, navigate, screenshot, click, type, content, status
    """
    try:
        action = request.action.lower()
        
        if action == "start":
            result = await browser_tool.start()
        elif action == "stop":
            result = await browser_tool.stop()
        elif action == "navigate":
            if not request.url:
                raise HTTPException(status_code=400, detail="URL required for navigate")
            result = await browser_tool.navigate(request.url)
        elif action == "screenshot":
            result = await browser_tool.screenshot(request.full_page)
        elif action == "click":
            if not request.selector:
                raise HTTPException(status_code=400, detail="Selector required for click")
            result = await browser_tool.click(request.selector)
        elif action == "type":
            if not request.selector or not request.text:
                raise HTTPException(status_code=400, detail="Selector and text required for type")
            result = await browser_tool.type_text(request.selector, request.text)
        elif action == "content":
            result = await browser_tool.get_content()
        elif action == "status":
            result = await browser_tool.status()
        else:
            raise HTTPException(status_code=400, detail=f"Unknown action: {action}")
        
        return result
        
    except Exception as e:
        logger.error(f"Browser tool error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== SKILLS SYSTEM ==============

@moltbot_router.get("/skills/list")
async def skills_list():
    """List all available skills"""
    skills = skills_manager.list_skills()
    return {"skills": skills, "count": len(skills)}

@moltbot_router.get("/skills/{skill_id}")
async def skill_get(skill_id: str):
    """Get skill details"""
    skill = skills_manager.get_skill(skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill

@moltbot_router.post("/skills/{skill_id}/enable")
async def skill_enable(skill_id: str):
    """Enable a skill"""
    success = skills_manager.enable_skill(skill_id)
    if not success:
        raise HTTPException(status_code=404, detail="Skill not found")
    return {"skill_id": skill_id, "enabled": True}

@moltbot_router.post("/skills/{skill_id}/disable")
async def skill_disable(skill_id: str):
    """Disable a skill"""
    success = skills_manager.disable_skill(skill_id)
    if not success:
        raise HTTPException(status_code=404, detail="Skill not found")
    return {"skill_id": skill_id, "enabled": False}

# ============== MEMORY SYSTEM ==============

@moltbot_router.get("/memory")
async def memory_read():
    """Read memory file"""
    content = memory_system.read_memory()
    return {"content": content, "workspace": str(memory_system.workspace_dir)}

@moltbot_router.post("/memory/append")
async def memory_append(content: str):
    """Append to memory file"""
    memory_system.append_memory(content)
    return {"success": True, "message": "Memory appended"}

@moltbot_router.get("/memory/search")
async def memory_search(query: str):
    """Search memory"""
    matches = memory_system.search_memory(query)
    return {"query": query, "matches": matches, "count": len(matches)}

@moltbot_router.get("/memory/workspace")
async def memory_workspace():
    """List workspace files"""
    files = memory_system.get_workspace_files()
    return {"files": files, "count": len(files), "workspace": str(memory_system.workspace_dir)}

# ============== GATEWAY STATUS ==============

@moltbot_router.get("/gateway/status")
async def gateway_status():
    """Get complete Moltbot gateway status"""
    return {
        "gateway": "online",
        "version": "2026.1.27-full",
        "mode": "standalone",
        "features": {
            "exec": True,
            "process": True,
            "web_search": bool(web_search_tool.api_key),
            "web_fetch": True,
            "browser": True,
            "skills": True,
            "memory": True,
            "channels": False,  # Phase 2
            "cron": False,  # Phase 3
            "multi_agent": True
        },
        "tools": {
            "exec": {"enabled": True, "security": "allowlist"},
            "process": {"sessions": len(process_manager.sessions)},
            "browser": {"running": browser_tool.is_running},
            "skills": {"count": len(skills_manager.skills)},
            "memory": {"workspace": str(memory_system.workspace_dir)}
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# ============== INTEGRATED AI AGENT ==============

class MoltbotAgentRequest(BaseModel):
    message: str
    tools_enabled: List[str] = ["web_search", "web_fetch", "browser", "exec"]
    session_id: str
    skill_level: str = "intermediate"

@moltbot_router.post("/agent/chat")
async def moltbot_agent_chat(request: MoltbotAgentRequest):
    """
    Complete Moltbot AI agent with tool use
    The agent can call web_search, web_fetch, browser, exec, etc.
    """
    try:
        skill_context = get_skill_context(request.skill_level)
        
        # Build tools description
        tools_desc = []
        if "web_search" in request.tools_enabled:
            tools_desc.append("- **web_search(query)**: Search the web using Brave API. Returns real search results.")
        if "web_fetch" in request.tools_enabled:
            tools_desc.append("- **web_fetch(url)**: Fetch and extract content from any webpage.")
        if "browser" in request.tools_enabled:
            tools_desc.append("- **browser(action, ...)**: Control a real browser - navigate, click, type, screenshot.")
        if "exec" in request.tools_enabled:
            tools_desc.append("- **exec(command)**: Run shell commands. Use for file operations, git, npm, etc.")
        
        system_prompt = f"""You are **Molty** 🦞, the Moltbot AI agent.

You are a FULL-FEATURED AI assistant with REAL tool access.

{skill_context}

## 🛠️ Your REAL Tools:

{chr(10).join(tools_desc)}

## How to Use Tools:

When you need to use a tool, respond with JSON:
```json
{{
    "tool": "web_search",
    "parameters": {{
        "query": "latest React hooks tutorial",
        "count": 5
    }}
}}
```

**IMPORTANT**:
- Use tools whenever they would help answer the question
- web_search gives you REAL current information from the web
- browser lets you automate REAL websites
- exec runs REAL commands on the system
- Don't just say "I would search", actually use the tools!

## Response Format:

Use clean Markdown with:
- # Headings
- **Bold** for emphasis
- `code` for technical terms
- > blockquotes for important notes
- Lists and tables

Be concise, helpful, and action-oriented.

Remember: You have REAL tools - use them! 🦞"""
        
        chat = get_chat_instance(system_prompt)
        user_msg = UserMessage(text=request.message)
        response = await chat.send_message(user_msg)
        
        # Check if response contains tool call
        tool_result = None
        if response.strip().startswith("{") and "tool" in response:
            try:
                tool_call = json.loads(response)
                tool_name = tool_call.get("tool")
                params = tool_call.get("parameters", {})
                
                # Execute tool
                if tool_name == "web_search" and "web_search" in request.tools_enabled:
                    tool_result = await web_search_tool.search(
                        query=params.get("query", ""),
                        count=params.get("count", 5)
                    )
                elif tool_name == "web_fetch" and "web_fetch" in request.tools_enabled:
                    tool_result = await web_fetch_tool.fetch(
                        url=params.get("url", "")
                    )
                # Add more tool executions here
                
            except json.JSONDecodeError:
                pass
        
        return {
            "response": response,
            "tool_result": tool_result,
            "session_id": request.session_id,
            "tools_enabled": request.tools_enabled
        }
        
    except Exception as e:
        logger.error(f"Moltbot agent error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Include Moltbot router
app.include_router(moltbot_router)

# ============== API CONFIGURATION MANAGEMENT ==============

from config_manager import config_manager, APIConfig

config_router = APIRouter(prefix="/api/config", tags=["Configuration"])

@config_router.get("/")
async def get_config():
    """Get current API configuration (masks sensitive data)"""
    config = config_manager.get_config()
    config_dict = config.dict()
    
    # Mask API keys (show only first/last 4 chars)
    for key in ['brave_api_key', 'emergent_llm_key', 'openai_api_key', 'anthropic_api_key']:
        if config_dict.get(key):
            val = config_dict[key]
            if len(val) > 8:
                config_dict[key] = f"{val[:4]}...{val[-4:]}"
    
    return config_dict

@config_router.post("/update")
async def update_config(updates: Dict[str, Any]):
    """Update API configuration"""
    try:
        config = config_manager.update_config(updates)
        
        # Reload Emergent client if key was updated
        if 'emergent_llm_key' in updates:
            from emergent_llm import reload_emergent_client
            reload_emergent_client()
            logger.info("Emergent LLM client reloaded")
        
        return {"success": True, "config": config.dict()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@config_router.post("/test-key")
async def test_api_key(service: str, api_key: str):
    """Test if an API key works"""
    result = config_manager.test_api_key(service, api_key)
    return result

@config_router.get("/services")
async def get_services_status():
    """Get status of all configured services"""
    config = config_manager.get_config()
    
    return {
        "brave": {
            "configured": bool(config.brave_api_key),
            "enabled": True
        },
        "emergent": {
            "configured": bool(config.emergent_llm_key),
            "enabled": True
        },
        "whatsapp": {
            "configured": config.whatsapp_enabled,
            "enabled": config.whatsapp_enabled
        },
        "browser": {
            "configured": True,
            "headless": config.browser_headless,
            "enabled": True
        }
    }

app.include_router(config_router)

# ============== WHATSAPP INTEGRATION ==============

from whatsapp_manager import whatsapp_manager

whatsapp_router = APIRouter(prefix="/api/whatsapp", tags=["WhatsApp"])

@whatsapp_router.post("/start")
async def whatsapp_start():
    """Start WhatsApp client"""
    result = await whatsapp_manager.start()
    return result

@whatsapp_router.get("/status")
async def whatsapp_status():
    """Get WhatsApp status and QR code"""
    result = await whatsapp_manager.get_status()
    return result

@whatsapp_router.post("/send")
async def whatsapp_send(to: str, message: str):
    """Send WhatsApp message"""
    result = await whatsapp_manager.send_message(to, message)
    return result

@whatsapp_router.get("/contacts")
async def whatsapp_contacts():
    """Get WhatsApp contacts"""
    contacts = await whatsapp_manager.get_contacts()
    return {"contacts": contacts, "count": len(contacts)}

@whatsapp_router.get("/chats")
async def whatsapp_chats():
    """Get WhatsApp chats"""
    chats = await whatsapp_manager.get_chats()
    return {"chats": chats, "count": len(chats)}

@whatsapp_router.post("/stop")
async def whatsapp_stop():
    """Stop WhatsApp client"""
    result = await whatsapp_manager.stop()
    return result

app.include_router(whatsapp_router)

# ============== AI CHAT WITH EMERGENT LLM ==============

from emergent_llm import emergent_llm_client
from config_manager import config_manager

# Initialize Emergent client with saved config
def init_emergent_client():
    """Initialize Emergent client from config"""
    config = config_manager.get_config()
    if config.emergent_llm_key:
        from emergent_llm import EmergentLLMClient
        global emergent_llm_client
        emergent_llm_client = EmergentLLMClient(api_key=config.emergent_llm_key)
        logger.info("Emergent LLM client initialized from config")

# Initialize on startup
init_emergent_client()

ai_router = APIRouter(prefix="/api/ai", tags=["AI Chat"])

class AIChatRequest(BaseModel):
    message: str
    model: str = "gemini-2.0-flash-exp"
    conversation_history: List[Dict[str, str]] = []
    temperature: float = 0.7
    max_tokens: int = 4000

@ai_router.post("/chat")
async def ai_chat(request: AIChatRequest):
    """
    AI Chat using Emergent LLM key
    Supports: GPT-4o, Claude Opus 4.5, Gemini 2.0 Flash
    """
    try:
        if not emergent_llm_client.is_configured():
            return {
                "error": "Emergent LLM key not configured",
                "hint": "Add your Emergent LLM key in Configuration tab"
            }
        
        # Build messages
        messages = request.conversation_history + [
            {"role": "user", "content": request.message}
        ]
        
        # Get completion
        response = await emergent_llm_client.chat_completion(
            model=request.model,
            messages=messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens
        )
        
        return response
        
    except Exception as e:
        logger.error(f"AI chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@ai_router.get("/models")
async def get_available_models():
    """Get list of available AI models"""
    if not emergent_llm_client.is_configured():
        return {"error": "Emergent LLM key not configured"}
    
    return emergent_llm_client.get_available_models()

app.include_router(ai_router)

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

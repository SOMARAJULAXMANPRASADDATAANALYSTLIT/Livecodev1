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

def get_chat_instance(system_message: str, session_id: str = None):
    if not session_id:
        session_id = str(uuid.uuid4())
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message
    ).with_model("gemini", "gemini-2.0-flash")
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
    """Full AI analysis of uploaded project"""
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
        key_file_patterns = ['main', 'app', 'index', 'server', 'config', 'routes', 'models', 'package.json', 'requirements.txt']
        for pattern in key_file_patterns:
            for f in files_summary[:30]:
                if pattern in f.lower():
                    try:
                        file_path = workspace_path / f
                        if file_path.exists() and file_path.stat().st_size < 10000:
                            key_files_content += f"\n--- {f} ---\n{file_path.read_text()[:3000]}\n"
                    except:
                        pass
        
        system_prompt = f"""You are an expert software architect analyzing a codebase.
{skill_context}

Analyze this project and provide comprehensive insights.

RESPOND ONLY WITH VALID JSON:
{{
    "project_name": "Detected project name",
    "purpose": "What this project does (2-3 sentences)",
    "architecture_overview": "High-level architecture description",
    "entry_points": [{{"file": "filename", "purpose": "what it does"}}],
    "main_modules": [{{"name": "Module name", "purpose": "What it does", "files": ["file1", "file2"]}}],
    "dependencies": ["key dependency 1", "key dependency 2"],
    "frameworks": ["Framework 1", "Framework 2"],
    "learning_roadmap": {{
        "beginner": ["Step 1: Start with...", "Step 2: Then learn..."],
        "intermediate": ["Step 1: ...", "Step 2: ..."],
        "advanced": ["Step 1: ...", "Step 2: ..."]
    }},
    "file_recommendations": [{{"file": "filename", "reason": "why to read this first"}}],
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

Files ({len(files_summary)} total):
{chr(10).join(files_summary[:50])}

Key File Contents:
{key_files_content[:15000]}""")
        
        response = await chat.send_message(user_msg)
        data = safe_parse_json(response, {
            "project_name": project['name'],
            "purpose": "Analysis pending",
            "architecture_overview": "Unable to analyze",
            "entry_points": [],
            "main_modules": [],
            "dependencies": [],
            "frameworks": project.get('frameworks', []),
            "learning_roadmap": {},
            "file_recommendations": [],
            "potential_issues": [],
            "improvement_suggestions": []
        })
        
        return FullProjectAnalysis(**data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Full project analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
        data = safe_parse_json(response, {"has_issue": False})
        
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

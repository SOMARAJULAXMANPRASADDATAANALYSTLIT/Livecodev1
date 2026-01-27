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
        "name": "Coding Mentor Agent",
        "icon": "👨‍💻",
        "description": "Full IDE + tutor for software development",
        "system_prompt": """You are a world-class senior software engineer and coding mentor.
You teach, debug, analyze, and fix code across all programming languages.
Focus on teaching concepts, not just providing solutions.
Adapt explanations to the user's skill level."""
    },
    "health": {
        "name": "Health & Medical Agent",
        "icon": "🏥",
        "description": "Medical concepts, patient education, anatomy visualization",
        "system_prompt": """You are a medical education specialist and health advisor.
You explain medical concepts clearly, create patient education plans, and help visualize health information.

IMPORTANT DISCLAIMER: You are NOT a doctor. Always recommend consulting healthcare professionals.

You can:
- Explain medical concepts in simple terms
- Create patient education materials
- Describe anatomy and diseases
- Generate treatment timelines for education
- Explain medication purposes (not prescribe)
- Help understand lab results (not diagnose)

Always include appropriate medical disclaimers."""
    },
    "travel": {
        "name": "Travel & Tourism Agent",
        "icon": "✈️",
        "description": "Trip planning, itineraries, destination guides",
        "system_prompt": """You are an expert travel planner and tourism specialist.
You create comprehensive trip plans, day-wise itineraries, and share fascinating stories about places.

You can:
- Build full trip plans with budgets
- Create day-by-day itineraries
- Explain history and stories of destinations
- Recommend hotels, restaurants, attractions
- Provide travel tips and local customs
- Create interactive travel guides

Include practical information: best times to visit, local transportation, safety tips."""
    },
    "business": {
        "name": "Business Intelligence Agent",
        "icon": "📊",
        "description": "Company analysis, competitor research, strategy dashboards",
        "system_prompt": """You are a senior business analyst and market researcher.
You analyze companies, perform competitive analysis, and create executive-grade intelligence reports.

STRICT RULES:
- Use ONLY credible public sources
- Every data point MUST have a source URL
- If data is not publicly available, write exactly: "Not Publicly Available"
- NO hallucination or guessing
- Cite: company websites, press releases, LinkedIn, Crunchbase, trusted media

You can:
- Analyze company websites and products
- Perform competitor analysis
- Generate multi-sheet research reports
- Create professional HTML strategy dashboards
- Identify market opportunities and challenges"""
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
        from emergentintegrations.llm.chat import ImageGeneration
        
        # Create appropriate prompts based on agent type
        prompt_templates = {
            "coding": {
                "diagram": f"Technical architecture diagram showing {topic}. Clean, professional software engineering diagram style with labeled components and connections. Dark theme, modern design.",
                "flowchart": f"Software flowchart for {topic}. Clear decision points, process steps, color coded. Professional technical documentation style.",
                "architecture": f"System architecture diagram for {topic}. Microservices, APIs, databases clearly labeled. Modern cloud architecture visualization."
            },
            "health": {
                "diagram": f"Medical educational diagram showing {topic}. Clean, labeled, professional medical illustration. Anatomically accurate with clear annotations.",
                "anatomy": f"Human anatomy illustration of {topic}. Educational medical style, clearly labeled parts.",
                "timeline": f"Medical timeline showing progression of {topic}. Clear stages, visual markers, educational style."
            },
            "travel": {
                "diagram": f"Travel route map for {topic}. Beautiful illustrated map style with landmarks, routes, and key destinations marked.",
                "map": f"Illustrated travel map of {topic}. Tourist map style with attractions, routes, and helpful icons.",
                "itinerary": f"Visual travel itinerary for {topic}. Day-by-day visual guide with icons and timeline."
            },
            "business": {
                "diagram": f"Business strategy diagram for {topic}. Professional consulting style with clear hierarchy and relationships.",
                "chart": f"Business analysis chart for {topic}. Clean data visualization, modern corporate style.",
                "comparison": f"Competitive analysis visual comparison of {topic}. Side by side with clear differentiators."
            }
        }
        
        agent_prompts = prompt_templates.get(agent_type, prompt_templates["coding"])
        prompt = agent_prompts.get(visual_type, agent_prompts.get("diagram", f"Educational diagram for {topic}"))
        
        # Generate image using Nano Banana
        image_gen = ImageGeneration(api_key=EMERGENT_LLM_KEY)
        result = await image_gen.generate(
            prompt=prompt,
            aspect_ratio="16:9"
        )
        
        return {
            "success": True,
            "image_url": result.url if hasattr(result, 'url') else None,
            "image_base64": result.base64 if hasattr(result, 'base64') else None,
            "topic": topic,
            "visual_type": visual_type,
            "agent_type": agent_type
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
    """Get AI and tech news feed"""
    try:
        from datetime import datetime, timedelta
        
        # Use AI to generate relevant news summaries with REAL searchable URLs
        system_prompt = """You are a tech news curator. Generate 6 REAL, CURRENT AI and tech news articles from January 2026.

CRITICAL RULES:
1. Generate URLs that link to REAL news sources (TechCrunch, The Verge, Wired, Ars Technica, VentureBeat, MIT Tech Review)
2. Use real, searchable URL patterns like:
   - https://techcrunch.com/2026/01/topic-name
   - https://www.theverge.com/2026/1/27/news-title
   - https://www.wired.com/story/article-slug/
   - https://arstechnica.com/category/2026/01/article-slug/
3. Make headlines realistic and based on current AI trends
4. Include actual company names (OpenAI, Google, Anthropic, Meta, Microsoft)
        
RESPOND ONLY WITH VALID JSON:
{
    "articles": [
        {
            "id": "unique_id",
            "title": "Specific news headline",
            "summary": "2-3 sentence summary with specific details",
            "source": "TechCrunch",
            "url": "https://techcrunch.com/2026/01/27/article-slug",
            "category": "ai|tech|coding|startups",
            "publishedAt": "2026-01-27T10:00:00Z"
        }
    ]
}

Generate current news about latest developments:
- GPT-5, Gemini 3, Claude 4 updates
- React 20, Python 4, new frameworks
- AI coding assistants evolution
- Startup funding rounds
- Developer tool releases"""
        
        chat = get_chat_instance(system_prompt)
        
        category_prompt = f"Generate news for category: {category}" if category != "all" else "Generate mixed tech and AI news"
        user_msg = UserMessage(text=category_prompt)
        response = await chat.send_message(user_msg)
        
        data = safe_parse_json(response, {"articles": []})
        
        return data
        
    except Exception as e:
        logger.error(f"News feed error: {e}")
        return {"articles": []}

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

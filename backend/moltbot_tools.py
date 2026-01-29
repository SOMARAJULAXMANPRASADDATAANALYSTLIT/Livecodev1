"""
Moltbot Tools - Complete Implementation
Full standalone Moltbot with all tools from documentation
"""

import asyncio
import subprocess
import json
import os
import uuid
import time
import requests
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from pathlib import Path
import html2text
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright, Browser, Page
import logging

logger = logging.getLogger(__name__)

# ============== BACKGROUND TASK MANAGER ==============

class ProcessManager:
    """Manage background exec sessions (like Moltbot's process tool)"""
    
    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self.lock = asyncio.Lock()
    
    async def create_session(
        self,
        command: str,
        workdir: str = None,
        env: Dict[str, str] = None,
        timeout: int = 1800
    ) -> Dict[str, Any]:
        """Create a new background process session"""
        session_id = str(uuid.uuid4())[:8]
        
        # Prepare environment
        process_env = os.environ.copy()
        if env:
            process_env.update(env)
        
        # Start process
        try:
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=workdir or os.getcwd(),
                env=process_env
            )
            
            session = {
                "id": session_id,
                "command": command,
                "status": "running",
                "pid": process.pid,
                "process": process,
                "stdout_lines": [],
                "stderr_lines": [],
                "exit_code": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "timeout": timeout
            }
            
            async with self.lock:
                self.sessions[session_id] = session
            
            # Start output collectors
            asyncio.create_task(self._collect_output(session_id))
            asyncio.create_task(self._enforce_timeout(session_id, timeout))
            
            return {
                "session_id": session_id,
                "status": "running",
                "pid": process.pid
            }
            
        except Exception as e:
            logger.error(f"Failed to create session: {e}")
            return {
                "session_id": None,
                "status": "error",
                "error": str(e)
            }
    
    async def _collect_output(self, session_id: str):
        """Collect stdout/stderr from process"""
        async with self.lock:
            session = self.sessions.get(session_id)
        
        if not session:
            return
        
        process = session["process"]
        
        try:
            # Collect stdout
            if process.stdout:
                async for line in process.stdout:
                    decoded = line.decode('utf-8', errors='replace').rstrip()
                    async with self.lock:
                        if session_id in self.sessions:
                            self.sessions[session_id]["stdout_lines"].append(decoded)
            
            # Wait for process to complete
            exit_code = await process.wait()
            
            # Collect stderr
            if process.stderr:
                stderr_data = await process.stderr.read()
                decoded_stderr = stderr_data.decode('utf-8', errors='replace')
                async with self.lock:
                    if session_id in self.sessions:
                        self.sessions[session_id]["stderr_lines"].extend(decoded_stderr.splitlines())
            
            async with self.lock:
                if session_id in self.sessions:
                    self.sessions[session_id]["status"] = "completed"
                    self.sessions[session_id]["exit_code"] = exit_code
                    
        except Exception as e:
            logger.error(f"Error collecting output for {session_id}: {e}")
            async with self.lock:
                if session_id in self.sessions:
                    self.sessions[session_id]["status"] = "error"
                    self.sessions[session_id]["error"] = str(e)
    
    async def _enforce_timeout(self, session_id: str, timeout: int):
        """Kill process after timeout"""
        await asyncio.sleep(timeout)
        
        async with self.lock:
            session = self.sessions.get(session_id)
        
        if session and session["status"] == "running":
            try:
                process = session["process"]
                process.kill()
                async with self.lock:
                    if session_id in self.sessions:
                        self.sessions[session_id]["status"] = "timeout"
                logger.info(f"Killed session {session_id} after {timeout}s timeout")
            except Exception as e:
                logger.error(f"Error killing session {session_id}: {e}")
    
    async def poll(self, session_id: str, offset: int = 0) -> Dict[str, Any]:
        """Poll session for new output"""
        async with self.lock:
            session = self.sessions.get(session_id)
        
        if not session:
            return {"error": "Session not found"}
        
        stdout_lines = session["stdout_lines"][offset:]
        
        return {
            "session_id": session_id,
            "status": session["status"],
            "pid": session["pid"],
            "exit_code": session.get("exit_code"),
            "new_stdout": stdout_lines,
            "total_lines": len(session["stdout_lines"]),
            "offset": offset + len(stdout_lines)
        }
    
    async def list_sessions(self) -> List[Dict[str, Any]]:
        """List all sessions"""
        async with self.lock:
            return [{
                "id": sid,
                "command": s["command"][:50] + "..." if len(s["command"]) > 50 else s["command"],
                "status": s["status"],
                "pid": s["pid"],
                "created_at": s["created_at"]
            } for sid, s in self.sessions.items()]
    
    async def kill(self, session_id: str) -> Dict[str, Any]:
        """Kill a running session"""
        async with self.lock:
            session = self.sessions.get(session_id)
        
        if not session:
            return {"error": "Session not found"}
        
        if session["status"] != "running":
            return {"error": f"Session is {session['status']}, cannot kill"}
        
        try:
            process = session["process"]
            process.kill()
            async with self.lock:
                self.sessions[session_id]["status"] = "killed"
            return {"success": True, "session_id": session_id}
        except Exception as e:
            return {"error": str(e)}

# Global process manager
process_manager = ProcessManager()


# ============== WEB SEARCH (BRAVE API) ==============

class WebSearchTool:
    """Web search using Brave API (Moltbot-compatible)"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('BRAVE_API_KEY')
        self.base_url = "https://api.search.brave.com/res/v1/web/search"
        self.cache = {}
        self.cache_ttl = 900  # 15 minutes
    
    async def search(
        self,
        query: str,
        count: int = 5,
        country: str = None,
        search_lang: str = None
    ) -> Dict[str, Any]:
        """Search the web using Brave API"""
        
        if not self.api_key:
            return {
                "error": "Brave API key not configured",
                "setup_hint": "Set BRAVE_API_KEY environment variable or run: moltbot configure --section web"
            }
        
        # Check cache
        cache_key = f"{query}:{count}:{country}:{search_lang}"
        if cache_key in self.cache:
            cached_data, cached_time = self.cache[cache_key]
            if time.time() - cached_time < self.cache_ttl:
                return cached_data
        
        # Make API request
        try:
            params = {
                "q": query,
                "count": min(count, 10)
            }
            
            if country:
                params["country"] = country
            if search_lang:
                params["search_lang"] = search_lang
            
            headers = {
                "Accept": "application/json",
                "X-Subscription-Token": self.api_key
            }
            
            response = requests.get(
                self.base_url,
                params=params,
                headers=headers,
                timeout=30
            )
            
            if response.status_code != 200:
                return {
                    "error": f"Brave API error: {response.status_code}",
                    "details": response.text[:200]
                }
            
            data = response.json()
            
            # Format results Moltbot-style
            results = []
            for item in data.get("web", {}).get("results", [])[:count]:
                results.append({
                    "title": item.get("title", ""),
                    "url": item.get("url", ""),
                    "description": item.get("description", ""),
                    "age": item.get("age", "")
                })
            
            result = {
                "query": query,
                "results": results,
                "total_count": len(results),
                "provider": "brave"
            }
            
            # Cache result
            self.cache[cache_key] = (result, time.time())
            
            return result
            
        except Exception as e:
            logger.error(f"Web search error: {e}")
            return {
                "error": str(e),
                "query": query
            }

# Global web search instance
web_search_tool = WebSearchTool()


# ============== WEB FETCH ==============

class WebFetchTool:
    """Fetch and extract webpage content (Moltbot-compatible)"""
    
    def __init__(self):
        self.html_converter = html2text.HTML2Text()
        self.html_converter.ignore_links = False
        self.html_converter.ignore_images = False
        self.cache = {}
        self.cache_ttl = 900  # 15 minutes
    
    async def fetch(
        self,
        url: str,
        extract_mode: str = "markdown",
        max_chars: int = 50000
    ) -> Dict[str, Any]:
        """Fetch URL and extract readable content"""
        
        # Check cache
        cache_key = f"{url}:{extract_mode}"
        if cache_key in self.cache:
            cached_data, cached_time = self.cache[cache_key]
            if time.time() - cached_time < self.cache_ttl:
                return cached_data
        
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36"
            }
            
            response = requests.get(url, headers=headers, timeout=30, allow_redirects=True)
            
            if response.status_code != 200:
                return {
                    "error": f"HTTP {response.status_code}",
                    "url": url
                }
            
            # Parse HTML
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()
            
            # Extract based on mode
            if extract_mode == "markdown":
                content = self.html_converter.handle(str(soup))
            else:
                content = soup.get_text()
                # Clean up text
                lines = (line.strip() for line in content.splitlines())
                content = '\n'.join(line for line in lines if line)
            
            # Truncate if needed
            if len(content) > max_chars:
                content = content[:max_chars] + "\n\n[Content truncated...]"
            
            result = {
                "url": url,
                "content": content,
                "extract_mode": extract_mode,
                "length": len(content),
                "title": soup.title.string if soup.title else url
            }
            
            # Cache result
            self.cache[cache_key] = (result, time.time())
            
            return result
            
        except Exception as e:
            logger.error(f"Web fetch error: {e}")
            return {
                "error": str(e),
                "url": url
            }

# Global web fetch instance
web_fetch_tool = WebFetchTool()


# ============== BROWSER CONTROL (PLAYWRIGHT) ==============

class BrowserTool:
    """Browser automation using Playwright (Moltbot-compatible)"""
    
    def __init__(self):
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context = None
        self.page: Optional[Page] = None
        self.is_running = False
        self._lock = asyncio.Lock()
    
    async def start(self, headless: bool = True) -> Dict[str, Any]:
        """Start browser instance"""
        async with self._lock:
            if self.is_running:
                return {"status": "already_running", "url": self.page.url if self.page else None}
            
            try:
                self.playwright = await async_playwright().start()
                
                # Launch browser with proper configuration
                self.browser = await self.playwright.chromium.launch(
                    headless=headless,
                    args=[
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-blink-features=AutomationControlled'
                    ]
                )
                
                # Create context with realistic settings
                self.context = await self.browser.new_context(
                    viewport={'width': 1920, 'height': 1080},
                    user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                )
                
                self.page = await self.context.new_page()
                self.is_running = True
                
                return {
                    "status": "started",
                    "headless": headless,
                    "message": "Browser started successfully"
                }
            except Exception as e:
                logger.error(f"Browser start error: {e}")
                return {"error": str(e), "status": "error"}
    
    async def stop(self) -> Dict[str, Any]:
        """Stop browser instance"""
        async with self._lock:
            if not self.is_running:
                return {"status": "not_running"}
            
            try:
                if self.page:
                    await self.page.close()
                if self.context:
                    await self.context.close()
                if self.browser:
                    await self.browser.close()
                if self.playwright:
                    await self.playwright.stop()
                
                self.is_running = False
                self.page = None
                self.context = None
                self.browser = None
                self.playwright = None
                
                return {"status": "stopped", "message": "Browser stopped successfully"}
            except Exception as e:
                logger.error(f"Browser stop error: {e}")
                return {"error": str(e)}
    
    async def navigate(self, url: str) -> Dict[str, Any]:
        """Navigate to URL"""
        if not self.is_running:
            # Auto-start browser
            start_result = await self.start()
            if "error" in start_result:
                return start_result
        
        try:
            response = await self.page.goto(url, wait_until="networkidle", timeout=30000)
            title = await self.page.title()
            
            return {
                "url": url,
                "title": title,
                "status": response.status if response else 200,
                "message": f"Navigated to {url}"
            }
        except Exception as e:
            logger.error(f"Navigation error: {e}")
            return {"error": str(e)}
    
    async def screenshot(self, full_page: bool = False) -> Dict[str, Any]:
        """Take screenshot"""
        if not self.is_running or not self.page:
            return {"error": "Browser not running"}
        
        try:
            screenshot_path = f"/tmp/moltbot_screenshot_{int(time.time())}.png"
            await self.page.screenshot(path=screenshot_path, full_page=full_page)
            
            return {
                "path": screenshot_path,
                "full_page": full_page,
                "message": "Screenshot saved",
                "url": self.page.url
            }
        except Exception as e:
            logger.error(f"Screenshot error: {e}")
            return {"error": str(e)}
    
    async def click(self, selector: str) -> Dict[str, Any]:
        """Click element"""
        if not self.is_running or not self.page:
            return {"error": "Browser not running"}
        
        try:
            await self.page.click(selector, timeout=10000)
            return {
                "selector": selector,
                "action": "clicked",
                "message": f"Clicked {selector}"
            }
        except Exception as e:
            logger.error(f"Click error: {e}")
            return {"error": str(e), "selector": selector}
    
    async def type_text(self, selector: str, text: str) -> Dict[str, Any]:
        """Type text into element"""
        if not self.is_running or not self.page:
            return {"error": "Browser not running"}
        
        try:
            await self.page.fill(selector, text)
            return {
                "selector": selector,
                "text": text,
                "message": f"Typed into {selector}"
            }
        except Exception as e:
            logger.error(f"Type error: {e}")
            return {"error": str(e)}
    
    async def get_content(self) -> Dict[str, Any]:
        """Get page content"""
        if not self.is_running or not self.page:
            return {"error": "Browser not running"}
        
        try:
            content = await self.page.content()
            text = await self.page.evaluate("() => document.body.innerText")
            
            return {
                "html": content[:10000],  # Truncate
                "text": text[:5000],
                "url": self.page.url,
                "title": await self.page.title()
            }
        except Exception as e:
            logger.error(f"Get content error: {e}")
            return {"error": str(e)}
    
    async def evaluate(self, expression: str) -> Dict[str, Any]:
        """Execute JavaScript"""
        if not self.is_running or not self.page:
            return {"error": "Browser not running"}
        
        try:
            result = await self.page.evaluate(expression)
            return {
                "expression": expression,
                "result": result,
                "message": "JavaScript executed"
            }
        except Exception as e:
            logger.error(f"Evaluate error: {e}")
            return {"error": str(e)}
    
    async def status(self) -> Dict[str, Any]:
        """Get browser status"""
        return {
            "running": self.is_running,
            "url": self.page.url if self.is_running and self.page else None,
            "title": await self.page.title() if self.is_running and self.page else None
        }

# Global browser instance
browser_tool = BrowserTool()


# ============== SKILLS SYSTEM ==============

class SkillsManager:
    """Manage Moltbot skills (ClawdHub-style)"""
    
    def __init__(self):
        self.skills: Dict[str, Dict[str, Any]] = {
            "web_search": {
                "name": "Web Search",
                "description": "Search the web using Brave API",
                "category": "research",
                "enabled": True
            },
            "web_fetch": {
                "name": "Web Fetch",
                "description": "Fetch and extract webpage content",
                "category": "research",
                "enabled": True
            },
            "browser": {
                "name": "Browser Control",
                "description": "Automate web browser actions",
                "category": "automation",
                "enabled": True
            },
            "exec": {
                "name": "Command Execution",
                "description": "Run shell commands",
                "category": "system",
                "enabled": True
            },
            "process": {
                "name": "Process Management",
                "description": "Manage background tasks",
                "category": "system",
                "enabled": True
            }
        }
    
    def list_skills(self) -> List[Dict[str, Any]]:
        """List all available skills"""
        return [{"id": k, **v} for k, v in self.skills.items()]
    
    def get_skill(self, skill_id: str) -> Optional[Dict[str, Any]]:
        """Get skill details"""
        skill = self.skills.get(skill_id)
        if skill:
            return {"id": skill_id, **skill}
        return None
    
    def enable_skill(self, skill_id: str) -> bool:
        """Enable a skill"""
        if skill_id in self.skills:
            self.skills[skill_id]["enabled"] = True
            return True
        return False
    
    def disable_skill(self, skill_id: str) -> bool:
        """Disable a skill"""
        if skill_id in self.skills:
            self.skills[skill_id]["enabled"] = False
            return True
        return False

# Global skills manager
skills_manager = SkillsManager()


# ============== MEMORY SYSTEM ==============

class MemorySystem:
    """Persistent memory system (Markdown files like Moltbot)"""
    
    def __init__(self, workspace_dir: str = "/tmp/moltbot_workspace"):
        self.workspace_dir = Path(workspace_dir)
        self.workspace_dir.mkdir(parents=True, exist_ok=True)
        self.memory_file = self.workspace_dir / "memory.md"
        
        # Initialize memory file if it doesn't exist
        if not self.memory_file.exists():
            self.memory_file.write_text("# Moltbot Memory\n\n")
    
    def read_memory(self) -> str:
        """Read memory file"""
        return self.memory_file.read_text()
    
    def append_memory(self, content: str) -> None:
        """Append to memory file"""
        current = self.read_memory()
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        entry = f"\n## {timestamp}\n\n{content}\n"
        self.memory_file.write_text(current + entry)
    
    def search_memory(self, query: str) -> List[str]:
        """Search memory for query"""
        content = self.read_memory()
        lines = content.split('\n')
        matches = [line for line in lines if query.lower() in line.lower()]
        return matches[:10]  # Return top 10 matches
    
    def get_workspace_files(self) -> List[str]:
        """List workspace files"""
        return [str(f.relative_to(self.workspace_dir)) for f in self.workspace_dir.rglob('*') if f.is_file()]

# Global memory system
memory_system = MemorySystem()

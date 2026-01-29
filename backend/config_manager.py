"""
API Configuration Management
Handles API keys, credentials, and settings
"""

import os
from pathlib import Path
from typing import Dict, Any, Optional
import json
from pydantic import BaseModel
from fastapi import HTTPException

# Configuration file paths
CONFIG_DIR = Path.home() / ".moltbot_config"
ENV_FILE = Path("/app/backend/.env")
CONFIG_FILE = CONFIG_DIR / "config.json"

# Ensure config directory exists
CONFIG_DIR.mkdir(parents=True, exist_ok=True)

class APIConfig(BaseModel):
    """API Configuration model"""
    brave_api_key: Optional[str] = None
    emergent_llm_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    whatsapp_enabled: bool = False
    browser_headless: bool = True
    workspace_dir: str = "/tmp/moltbot_workspace"

class ConfigManager:
    """Manage API configurations"""
    
    def __init__(self):
        self.config = self.load_config()
    
    def load_config(self) -> APIConfig:
        """Load configuration from file"""
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, 'r') as f:
                    data = json.load(f)
                    return APIConfig(**data)
            except Exception as e:
                print(f"Error loading config: {e}")
        
        # Return default config
        return APIConfig()
    
    def save_config(self, config: APIConfig) -> bool:
        """Save configuration to file"""
        try:
            with open(CONFIG_FILE, 'w') as f:
                json.dump(config.dict(), f, indent=2)
            
            # Also update .env file for environment variables
            self.update_env_file(config)
            return True
        except Exception as e:
            print(f"Error saving config: {e}")
            return False
    
    def update_env_file(self, config: APIConfig):
        """Update .env file with API keys"""
        env_vars = {}
        
        # Read existing .env
        if ENV_FILE.exists():
            with open(ENV_FILE, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        env_vars[key] = value
        
        # Update with new values
        if config.brave_api_key:
            env_vars['BRAVE_API_KEY'] = config.brave_api_key
        if config.emergent_llm_key:
            env_vars['EMERGENT_LLM_KEY'] = config.emergent_llm_key
        if config.openai_api_key:
            env_vars['OPENAI_API_KEY'] = config.openai_api_key
        if config.anthropic_api_key:
            env_vars['ANTHROPIC_API_KEY'] = config.anthropic_api_key
        
        # Write back to .env
        with open(ENV_FILE, 'w') as f:
            for key, value in env_vars.items():
                f.write(f"{key}={value}\n")
    
    def get_config(self) -> APIConfig:
        """Get current configuration"""
        return self.config
    
    def update_config(self, updates: Dict[str, Any]) -> APIConfig:
        """Update configuration"""
        config_dict = self.config.dict()
        config_dict.update(updates)
        self.config = APIConfig(**config_dict)
        self.save_config(self.config)
        return self.config
    
    def test_api_key(self, service: str, api_key: str) -> Dict[str, Any]:
        """Test if an API key works"""
        if service == "brave":
            return self._test_brave(api_key)
        elif service == "emergent":
            return self._test_emergent(api_key)
        elif service == "openai":
            return self._test_openai(api_key)
        elif service == "anthropic":
            return self._test_anthropic(api_key)
        else:
            return {"success": False, "error": "Unknown service"}
    
    def _test_brave(self, api_key: str) -> Dict[str, Any]:
        """Test Brave API key"""
        import requests
        try:
            response = requests.get(
                "https://api.search.brave.com/res/v1/web/search",
                params={"q": "test", "count": 1},
                headers={"X-Subscription-Token": api_key},
                timeout=10
            )
            if response.status_code == 200:
                return {"success": True, "message": "Brave API key is valid"}
            else:
                return {"success": False, "error": f"HTTP {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _test_emergent(self, api_key: str) -> Dict[str, Any]:
        """Test Emergent LLM key"""
        # TODO: Add actual Emergent API test
        return {"success": True, "message": "Emergent LLM key configured (test not implemented)"}
    
    def _test_openai(self, api_key: str) -> Dict[str, Any]:
        """Test OpenAI API key"""
        try:
            import openai
            openai.api_key = api_key
            # Simple test call
            response = openai.models.list()
            return {"success": True, "message": "OpenAI API key is valid"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _test_anthropic(self, api_key: str) -> Dict[str, Any]:
        """Test Anthropic API key"""
        # TODO: Add actual Anthropic API test
        return {"success": True, "message": "Anthropic API key configured (test not implemented)"}

# Global config manager instance
config_manager = ConfigManager()

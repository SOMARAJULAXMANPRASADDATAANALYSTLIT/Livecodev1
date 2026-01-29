"""
Emergent LLM Integration
Universal key for OpenAI, Anthropic, Google models
"""

import os
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

try:
    import emergentintegrations.openai as emergent_openai
    import emergentintegrations.anthropic as emergent_anthropic
    import emergentintegrations.google_genai as emergent_google
    EMERGENT_AVAILABLE = True
    logger.info("emergentintegrations imported successfully")
except ImportError as e:
    logger.error(f"Failed to import emergentintegrations: {e}")
    EMERGENT_AVAILABLE = False

class EmergentLLMClient:
    """Universal LLM client using Emergent key"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('EMERGENT_LLM_KEY')
        self.clients = {}
        
        if not self.api_key:
            logger.warning("No Emergent LLM key configured")
        
        if self.api_key and EMERGENT_AVAILABLE:
            self._initialize_clients()
        
        logger.info(f"EmergentLLMClient initialized. Key present: {bool(self.api_key)}, Available: {EMERGENT_AVAILABLE}")
    
    def _initialize_clients(self):
        """Initialize all provider clients with Emergent key"""
        try:
            # OpenAI via Emergent
            self.clients['openai'] = emergent_openai.OpenAI(api_key=self.api_key)
            logger.info("Emergent OpenAI client initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Emergent OpenAI: {e}")
        
        try:
            # Anthropic via Emergent
            self.clients['anthropic'] = emergent_anthropic.Anthropic(api_key=self.api_key)
            logger.info("Emergent Anthropic client initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Emergent Anthropic: {e}")
        
        try:
            # Google via Emergent
            emergent_google.genai.configure(api_key=self.api_key)
            self.clients['google'] = emergent_google.genai
            logger.info("Emergent Google AI client initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Emergent Google: {e}")
    
    async def chat_completion(
        self,
        model: str,
        messages: list,
        temperature: float = 0.7,
        max_tokens: int = 4000
    ) -> Dict[str, Any]:
        """
        Universal chat completion across providers
        
        Models:
        - gpt-4o, gpt-4o-mini (OpenAI)
        - claude-opus-4-5, claude-sonnet-4 (Anthropic)
        - gemini-2.0-flash-exp (Google)
        """
        
        if not self.api_key:
            return {"error": "No Emergent LLM key configured"}
        
        if not EMERGENT_AVAILABLE:
            return {"error": "emergentintegrations not installed"}
        
        try:
            # Determine provider from model name
            if model.startswith('gpt-'):
                return await self._openai_completion(model, messages, temperature, max_tokens)
            elif model.startswith('claude-'):
                return await self._anthropic_completion(model, messages, temperature, max_tokens)
            elif model.startswith('gemini-'):
                return await self._google_completion(model, messages, temperature, max_tokens)
            else:
                return {"error": f"Unknown model: {model}"}
        
        except Exception as e:
            logger.error(f"Chat completion error: {e}")
            return {"error": str(e)}
    
    async def _openai_completion(self, model, messages, temperature, max_tokens):
        """OpenAI completion via Emergent"""
        client = self.clients.get('openai')
        if not client:
            return {"error": "OpenAI client not initialized"}
        
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        return {
            "content": response.choices[0].message.content,
            "model": model,
            "provider": "openai",
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            }
        }
    
    async def _anthropic_completion(self, model, messages, temperature, max_tokens):
        """Anthropic completion via Emergent"""
        client = self.clients.get('anthropic')
        if not client:
            return {"error": "Anthropic client not initialized"}
        
        # Convert messages format
        system_message = ""
        converted_messages = []
        for msg in messages:
            if msg['role'] == 'system':
                system_message = msg['content']
            else:
                converted_messages.append({
                    "role": msg['role'],
                    "content": msg['content']
                })
        
        response = client.messages.create(
            model=model,
            system=system_message if system_message else None,
            messages=converted_messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        return {
            "content": response.content[0].text,
            "model": model,
            "provider": "anthropic",
            "usage": {
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens,
                "total_tokens": response.usage.input_tokens + response.usage.output_tokens
            }
        }
    
    async def _google_completion(self, model, messages, temperature, max_tokens):
        """Google completion via Emergent"""
        genai = self.clients.get('google')
        if not genai:
            return {"error": "Google AI client not initialized"}
        
        # Convert messages to Google format
        history = []
        last_message = None
        
        for msg in messages:
            if msg['role'] == 'system':
                # Google doesn't have system role, prepend to first user message
                continue
            elif msg['role'] == 'user':
                last_message = msg['content']
            elif msg['role'] == 'assistant':
                if last_message:
                    history.append({"role": "user", "parts": [last_message]})
                history.append({"role": "model", "parts": [msg['content']]})
                last_message = None
        
        model_instance = genai.GenerativeModel(model)
        chat = model_instance.start_chat(history=history)
        
        response = chat.send_message(
            last_message if last_message else messages[-1]['content'],
            generation_config={
                "temperature": temperature,
                "max_output_tokens": max_tokens
            }
        )
        
        return {
            "content": response.text,
            "model": model,
            "provider": "google",
            "usage": {
                "prompt_tokens": 0,  # Google doesn't provide token counts easily
                "completion_tokens": 0,
                "total_tokens": 0
            }
        }
    
    def is_configured(self) -> bool:
        """Check if Emergent key is configured"""
        return bool(self.api_key and EMERGENT_AVAILABLE)
    
    def get_available_models(self) -> Dict[str, list]:
        """Get list of available models"""
        if not self.is_configured():
            return {}
        
        return {
            "openai": [
                "gpt-4o",
                "gpt-4o-mini",
                "gpt-4-turbo"
            ],
            "anthropic": [
                "claude-opus-4-5",
                "claude-sonnet-4",
                "claude-3-5-sonnet-20241022"
            ],
            "google": [
                "gemini-2.0-flash-exp",
                "gemini-1.5-pro",
                "gemini-1.5-flash"
            ]
        }

# Global Emergent LLM client
emergent_llm_client = EmergentLLMClient()

def reload_emergent_client():
    """Reload client with new API key"""
    global emergent_llm_client
    emergent_llm_client = EmergentLLMClient()

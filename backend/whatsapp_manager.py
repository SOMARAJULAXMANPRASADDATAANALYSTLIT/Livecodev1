"""
WhatsApp Integration using whatsapp-web.js
Complete backend wrapper for WhatsApp messaging
"""

import asyncio
import subprocess
import os
import json
from pathlib import Path
from typing import Dict, Any, Optional, List
import logging
import base64

logger = logging.getLogger(__name__)

# WhatsApp session storage
WHATSAPP_SESSION_DIR = Path.home() / ".moltbot_whatsapp"
WHATSAPP_SESSION_DIR.mkdir(parents=True, exist_ok=True)

class WhatsAppManager:
    """Manage WhatsApp connection and messaging"""
    
    def __init__(self):
        self.node_script_path = Path("/app/backend/tools/whatsapp_bridge.js")
        self.process = None
        self.is_authenticated = False
        self.qr_code = None
        self.contacts = []
        self.chats = []
        
    async def start(self) -> Dict[str, Any]:
        """Start WhatsApp client"""
        if self.process and self.process.returncode is None:
            return {"status": "already_running"}
        
        try:
            # Create Node.js bridge script if it doesn't exist
            if not self.node_script_path.exists():
                self._create_node_bridge()
            
            # Start Node.js process
            self.process = await asyncio.create_subprocess_exec(
                "node", str(self.node_script_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(self.node_script_path.parent)
            )
            
            # Wait for QR code or authentication
            await asyncio.sleep(2)
            
            return {
                "status": "started",
                "authenticated": self.is_authenticated,
                "message": "WhatsApp client started. Check for QR code."
            }
            
        except Exception as e:
            logger.error(f"WhatsApp start error: {e}")
            return {"error": str(e), "status": "error"}
    
    def _create_node_bridge(self):
        """Create Node.js bridge script"""
        node_script = """
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(require('os').homedir(), '.moltbot_whatsapp');
const STATE_FILE = path.join(SESSION_DIR, 'state.json');

// Ensure session directory exists
if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
}

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: SESSION_DIR
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

// State management
let state = {
    authenticated: false,
    ready: false,
    qr: null,
    contacts: [],
    chats: []
};

function saveState() {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        } catch (e) {
            return state;
        }
    }
    return state;
}

state = loadState();

// QR Code generation
client.on('qr', (qr) => {
    console.log('QR_CODE:', qr);
    state.qr = qr;
    state.authenticated = false;
    saveState();
    qrcode.generate(qr, { small: true });
});

// Authentication success
client.on('authenticated', () => {
    console.log('AUTHENTICATED');
    state.authenticated = true;
    state.qr = null;
    saveState();
});

// Client ready
client.on('ready', async () => {
    console.log('READY');
    state.ready = true;
    
    // Load contacts
    const contacts = await client.getContacts();
    state.contacts = contacts.map(c => ({
        id: c.id._serialized,
        name: c.name || c.pushname || c.number,
        number: c.number,
        isGroup: c.isGroup
    }));
    
    // Load chats
    const chats = await client.getChats();
    state.chats = chats.map(c => ({
        id: c.id._serialized,
        name: c.name,
        isGroup: c.isGroup,
        unreadCount: c.unreadCount,
        lastMessage: c.lastMessage ? {
            body: c.lastMessage.body,
            timestamp: c.lastMessage.timestamp
        } : null
    }));
    
    saveState();
    console.log('CONTACTS_LOADED:', state.contacts.length);
    console.log('CHATS_LOADED:', state.chats.length);
});

// Message received
client.on('message', async (msg) => {
    const message = {
        from: msg.from,
        body: msg.body,
        timestamp: msg.timestamp,
        isGroup: msg.from.includes('@g.us'),
        hasMedia: msg.hasMedia
    };
    console.log('MESSAGE_RECEIVED:', JSON.stringify(message));
});

// Authentication failure
client.on('auth_failure', (msg) => {
    console.error('AUTH_FAILURE:', msg);
    state.authenticated = false;
    saveState();
});

// Disconnected
client.on('disconnected', (reason) => {
    console.log('DISCONNECTED:', reason);
    state.ready = false;
    saveState();
});

// Handle process termination
process.on('SIGINT', async () => {
    console.log('SHUTTING_DOWN');
    await client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('SHUTTING_DOWN');
    await client.destroy();
    process.exit(0);
});

// Initialize client
console.log('INITIALIZING');
client.initialize();

// API Server for commands
const http = require('http');
const url = require('url');

const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    try {
        if (pathname === '/status') {
            res.writeHead(200);
            res.end(JSON.stringify(state));
        }
        else if (pathname === '/send' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
                try {
                    const { to, message } = JSON.parse(body);
                    
                    // Format phone number
                    let chatId = to;
                    if (!to.includes('@')) {
                        chatId = to.replace(/[^0-9]/g, '') + '@c.us';
                    }
                    
                    await client.sendMessage(chatId, message);
                    
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, to: chatId }));
                } catch (e) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
        }
        else if (pathname === '/contacts') {
            res.writeHead(200);
            res.end(JSON.stringify({ contacts: state.contacts }));
        }
        else if (pathname === '/chats') {
            res.writeHead(200);
            res.end(JSON.stringify({ chats: state.chats }));
        }
        else {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Not found' }));
        }
    } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
    }
});

const PORT = 18790;
server.listen(PORT, () => {
    console.log(`API_SERVER_STARTED:${PORT}`);
});
"""
        
        self.node_script_path.write_text(node_script)
        logger.info(f"Created WhatsApp bridge at {self.node_script_path}")
    
    async def get_status(self) -> Dict[str, Any]:
        """Get WhatsApp client status"""
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get('http://localhost:18790/status', timeout=5) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        self.is_authenticated = data.get('authenticated', False)
                        self.qr_code = data.get('qr')
                        return data
        except Exception as e:
            logger.error(f"Status check error: {e}")
        
        return {
            "authenticated": False,
            "ready": False,
            "error": "Client not responding"
        }
    
    async def send_message(self, to: str, message: str) -> Dict[str, Any]:
        """Send WhatsApp message"""
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    'http://localhost:18790/send',
                    json={"to": to, "message": message},
                    timeout=10
                ) as resp:
                    if resp.status == 200:
                        return await resp.json()
                    else:
                        error = await resp.text()
                        return {"error": error}
        except Exception as e:
            logger.error(f"Send message error: {e}")
            return {"error": str(e)}
    
    async def get_contacts(self) -> List[Dict[str, Any]]:
        """Get WhatsApp contacts"""
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get('http://localhost:18790/contacts', timeout=5) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data.get('contacts', [])
        except Exception as e:
            logger.error(f"Get contacts error: {e}")
        
        return []
    
    async def get_chats(self) -> List[Dict[str, Any]]:
        """Get WhatsApp chats"""
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get('http://localhost:18790/chats', timeout=5) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data.get('chats', [])
        except Exception as e:
            logger.error(f"Get chats error: {e}")
        
        return []
    
    async def stop(self) -> Dict[str, Any]:
        """Stop WhatsApp client"""
        if self.process:
            try:
                self.process.terminate()
                await asyncio.wait_for(self.process.wait(), timeout=5)
                return {"status": "stopped"}
            except asyncio.TimeoutError:
                self.process.kill()
                return {"status": "force_stopped"}
        
        return {"status": "not_running"}

# Global WhatsApp manager
whatsapp_manager = WhatsAppManager()

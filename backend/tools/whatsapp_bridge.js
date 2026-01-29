
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

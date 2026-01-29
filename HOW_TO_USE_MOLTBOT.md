# 🦞 MOLTBOT FULL - HOW TO USE GUIDE

## ⚠️ Current Status & Known Issues

### ✅ What's Working:
1. **API Configuration** - Save and test API keys ✅
2. **Browser Tool** - Playwright automation ✅
3. **Command Execution** - Run shell commands ✅
4. **Web Search** - Brave API search ✅
5. **Web Fetch** - Get webpage content ✅
6. **Process Management** - Background tasks ✅

### ⚠️ What's Not Working Yet:
1. **WhatsApp** - Puppeteer architecture issue (ARM vs x64)
   - **Issue:** Container is ARM-based, Puppeteer needs x64
   - **Fix:** Use alternative WhatsApp library or run on x64 system
   
---

## 📖 HOW TO USE EACH TOOL

### 1. **⚙️ Configuration Tab**

**Purpose:** Set up API keys for external services

**Steps:**
1. Click "⚙️ Configuration" tab
2. **Brave API Key:**
   - Get free key: https://brave.com/search/api/
   - Paste key in input field
   - Click "Save Key"
   - Click "Test" button to verify
   
3. **Emergent LLM Key:**
   - Get from your Emergent profile
   - Paste in input field
   - Click "Save Key"

**What It Does:**
- Saves keys to backend configuration
- Enables web search functionality
- Enables AI features with Emergent key

---

### 2. **🛠️ Tools Tab**

#### **Command Execution**
**What It Does:** Runs shell commands on the server

**How to Use:**
1. Click "🛠️ Tools" tab
2. Enter command in first box, e.g.:
   ```
   echo "Hello from Moltbot!"
   ls -la /app
   whoami
   pwd
   ```
3. Click "Execute"
4. See results below in JSON format

**Real Example:**
```bash
Input: echo "Test $(date)"
Output: Test Wed Jan 29 18:45:00 UTC 2026
```

#### **Browser Control**
**What It Does:** Automates a real Chromium browser

**How to Use:**
1. Enter URL: `https://example.com`
2. Click "Start" (launches browser)
3. Click "Navigate" (goes to URL)
4. Can also:
   - Take screenshots
   - Click elements
   - Fill forms
   - Execute JavaScript

**Real Example:**
```
1. Start browser
2. Navigate to https://google.com
3. Browser opens (headless)
4. Returns page title
```

#### **Web Search**
**What It Does:** Searches the web using Brave API (REAL results, not AI guessing)

**How to Use:**
1. Configure Brave API key first (Configuration tab)
2. Enter search query: `latest React tutorials`
3. Click "Search"
4. Get real search results with URLs

**Real Example:**
```
Input: "AI coding tools 2026"
Output: 5 real search results with titles, URLs, descriptions
```

---

### 3. **📱 WhatsApp Tab** (Currently Broken)

**What It SHOULD Do:**
1. Click "Start WhatsApp Client"
2. QR code appears
3. Scan with phone (WhatsApp → Linked Devices)
4. Send messages to contacts
5. Receive messages

**Why It's Not Working:**
- Architecture mismatch (ARM container vs x64 Puppeteer)
- Need to install alternative WhatsApp library

**Fix Options:**
1. Use `baileys` library (pure JavaScript, no Puppeteer)
2. Run on x64 system instead of ARM
3. Use WhatsApp Business API (cloud-based)

---

### 4. **📊 Status Tab**

**What It Shows:**
- Gateway version
- WhatsApp connection status
- Number of available tools
- Service health

**How to Use:**
- Just view system status
- Refresh with refresh button in header

---

## 🎯 REALISTIC USE CASES

### **Use Case 1: Web Research**
```
1. Go to Tools tab
2. Search: "best Python web frameworks 2026"
3. Get real search results
4. Use Browser tool to screenshot top result
```

### **Use Case 2: Server Management**
```
1. Go to Tools tab
2. Execute: ls -la /app/backend
3. See file listing
4. Execute: cat /app/backend/server.py | head -20
5. View file contents
```

### **Use Case 3: Website Testing**
```
1. Go to Tools tab
2. Browser: Start
3. Browser: Navigate to https://your-website.com
4. Browser: Screenshot
5. Get screenshot file path
```

---

## ⚡ QUICK TESTS YOU CAN DO NOW

### Test 1: Command Execution
```
Command: echo "Moltbot Test $(date)" && whoami && pwd
Expected: Shows date, username, current directory
```

### Test 2: Browser (if Chromium installed)
```
1. URL: https://example.com
2. Click Start
3. Click Navigate
Expected: Returns page title "Example Domain"
```

### Test 3: Web Search (if Brave key configured)
```
Query: OpenAI GPT-5
Expected: Real search results about GPT-5
```

---

## 🐛 TROUBLESHOOTING

### "Browser not working"
**Problem:** Chromium not in correct path
**Solution:** 
```bash
playwright install chromium
```

### "Web search returns error"
**Problem:** No Brave API key
**Solution:** 
1. Get key from https://brave.com/search/api/
2. Add in Configuration tab

### "WhatsApp won't start"
**Problem:** Architecture mismatch
**Solution:** 
- Currently being fixed
- Alternative: Use WhatsApp Business API
- Or run on x64 system

### "Command execution fails"
**Problem:** Invalid command or permissions
**Solution:**
- Use simple commands first
- Check command syntax
- Some commands need sudo (not available)

---

## 🔮 WHAT'S COMING NEXT

### **Hours 7-8:** (In Progress)
- Fix WhatsApp with alternative library
- Add Slack integration
- Add Discord integration
- Add GitHub API integration

### **Hours 9-10:**
- AI Agent chat interface
- Tool-aware AI (AI that uses tools)
- Conversation memory
- Multi-turn reasoning

### **Hours 11-12:**
- Polish and testing
- Better error messages
- Documentation
- Performance improvements

---

## 💡 TIP: How to Tell What's Working

**Green Status = Working:**
- If service shows ✅ in Configuration tab
- If tool returns JSON result (not error)
- If status tab shows "Gateway Online"

**Red/Error = Not Working:**
- Error messages in results
- "Not configured" status
- Empty/null results

---

## 📞 NEED HELP?

**Try this order:**
1. Configuration tab → Set up API keys
2. Tools tab → Try Command Execution (simplest)
3. Tools tab → Try Browser (if Chromium works)
4. Tools tab → Try Web Search (if Brave key set)

**Each tool is independent!** If one doesn't work, try another.

---

Built with 🦞 by Moltbot
Version: 2026.1.27-full
Status: 82% Complete (6/12 hours)

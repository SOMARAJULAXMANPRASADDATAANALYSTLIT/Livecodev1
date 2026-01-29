import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Loader2, Bot, User, Settings, Moon, Sun,
  MessageSquare, Sparkles, Globe, Copy, Check, RefreshCw,
  Mic, MicOff, Volume2, VolumeX, Menu, X, ChevronDown,
  Zap, Shield, Code, Image, FileText, Paperclip, Search,
  Database, Terminal, Clock, Users, Activity, Cpu, Radio,
  Briefcase, Lightbulb, PenTool, BookOpen, Telescope, Brain,
  MessageCircle, ChevronRight, Hash, Folder, PlusCircle
} from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Agent modes - each has different capabilities
const AGENT_MODES = [
  { id: "general", name: "General Assistant", icon: MessageCircle, color: "#E74C3C", description: "Versatile AI for any task" },
  { id: "research", name: "Deep Research", icon: Telescope, color: "#3498DB", description: "Web search & analysis" },
  { id: "coding", name: "Code Expert", icon: Code, color: "#2ECC71", description: "Programming & debugging" },
  { id: "creative", name: "Creative Writer", icon: PenTool, color: "#9B59B6", description: "Content & copywriting" },
  { id: "learning", name: "Learning Tutor", icon: BookOpen, color: "#F39C12", description: "Teach & explain concepts" },
  { id: "business", name: "Business Intel", icon: Briefcase, color: "#1ABC9C", description: "Market & company analysis" },
];

// Available AI models
const AI_MODELS = [
  { id: "gemini-3-flash", name: "Gemini 3 Flash", provider: "Google", speed: "fast", icon: "⚡" },
  { id: "gemini-3-pro", name: "Gemini 3 Pro", provider: "Google", speed: "balanced", icon: "🔮" },
  { id: "gpt-5.2", name: "GPT-5.2", provider: "OpenAI", speed: "fast", icon: "🧠" },
  { id: "claude-sonnet-4.5", name: "Claude Sonnet 4.5", provider: "Anthropic", speed: "balanced", icon: "🎭" },
];

// Moltbot-inspired chat view with lobster theme 🦞
const MoltbotView = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [sessionId] = useState(() => `molt-${Date.now()}`);
  const [currentMode, setCurrentMode] = useState(AGENT_MODES[0]);
  const [currentModel, setCurrentModel] = useState(AI_MODELS[0]);
  const [sessions, setSessions] = useState([
    { id: "main", name: "Main Session", messages: 0, active: true },
  ]);
  const [activeSession, setActiveSession] = useState("main");
  const [gatewayStatus, setGatewayStatus] = useState({
    gateway: "online",
    model: "ready",
    voice: "available",
    memory: "indexed",
    channels: ["webchat"],
  });
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Initialize with welcome message based on mode
  useEffect(() => {
    const modeInfo = currentMode;
    setMessages([{
      id: 1,
      role: "assistant",
      content: `# 🦞 Welcome to Moltbot

**EXFOLIATE! EXFOLIATE!**

I'm your personal AI assistant running in **${modeInfo.name}** mode. I can help you with:

${modeInfo.id === "general" ? `
- 💬 **Conversations** - Chat about anything
- 🔍 **Research** - Find information online
- 📝 **Writing** - Documents, emails, content
- 💡 **Brainstorming** - Generate ideas
- 🔧 **Problem Solving** - Technical help
` : modeInfo.id === "research" ? `
- 🔍 **Deep Web Research** - Search and analyze
- 📊 **Data Analysis** - Process information
- 📰 **News & Trends** - Latest developments
- 📚 **Academic Search** - Papers and studies
- 🔗 **Source Verification** - Check citations
` : modeInfo.id === "coding" ? `
- 💻 **Code Writing** - Any language
- 🐛 **Debugging** - Find and fix issues
- 📖 **Code Explanation** - Understand code
- 🏗️ **Architecture** - Design patterns
- ⚡ **Optimization** - Performance tuning
` : modeInfo.id === "creative" ? `
- ✍️ **Content Writing** - Blog posts, articles
- 📝 **Copywriting** - Marketing, ads
- 📖 **Storytelling** - Narratives, fiction
- 🎨 **Creative Ideas** - Brainstorming
- ✏️ **Editing** - Polish your writing
` : modeInfo.id === "learning" ? `
- 📚 **Explanations** - Break down concepts
- 🎯 **Learning Paths** - Structured education
- ❓ **Q&A** - Answer questions
- 📝 **Practice Problems** - Test knowledge
- 🗺️ **Roadmaps** - Career guidance
` : `
- 📊 **Company Analysis** - Deep research
- 📈 **Market Research** - Industry trends
- 💼 **Competitor Intel** - Competitive analysis
- 📑 **Reports** - Business documents
- 📉 **Financial Analysis** - Numbers & metrics
`}

**Quick Commands:**
- \`/help\` - Show all commands
- \`/mode\` - Change agent mode
- \`/model\` - Switch AI model
- \`/search <query>\` - Web search
- \`/research <topic>\` - Deep research
- \`/clear\` - Clear chat history

**Current Setup:**
- Mode: ${modeInfo.name}
- Model: ${currentModel.name}
- Session: \`${sessionId}\`

Ready to molt? Let's go! 🦞`,
      timestamp: new Date().toISOString()
    }]);
  }, [currentMode, currentModel, sessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const copyToClipboard = async (text, messageId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success("Copied to clipboard!");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleCommand = (command) => {
    const cmd = command.toLowerCase().trim();
    const args = cmd.split(" ").slice(1).join(" ");
    
    if (cmd === "/help") {
      return {
        type: "system",
        content: `## 🦞 Moltbot Commands

### Navigation
| Command | Description |
|---------|-------------|
| \`/help\` | Show this help message |
| \`/mode\` | Show current mode |
| \`/mode <name>\` | Switch agent mode |
| \`/model\` | Show current AI model |
| \`/model <name>\` | Switch AI model |

### Actions
| Command | Description |
|---------|-------------|
| \`/search <query>\` | Quick web search |
| \`/research <topic>\` | Deep research with citations |
| \`/analyze <url>\` | Analyze a website |
| \`/summarize\` | Summarize conversation |

### Session
| Command | Description |
|---------|-------------|
| \`/clear\` | Clear chat history |
| \`/session\` | Show session info |
| \`/new\` | Start new session |
| \`/export\` | Export conversation |

### System
| Command | Description |
|---------|-------------|
| \`/status\` | Gateway & system status |
| \`/health\` | Health check |
| \`/about\` | About Moltbot |
| \`/config\` | Show configuration |`
      };
    }
    
    if (cmd === "/clear") {
      setMessages([{
        id: Date.now(),
        role: "assistant",
        content: "🧹 Chat cleared! Ready for a fresh start.",
        timestamp: new Date().toISOString()
      }]);
      return null;
    }
    
    if (cmd === "/mode") {
      return {
        type: "system",
        content: `## Current Mode

**${currentMode.name}**  
${currentMode.description}

### Available Modes
${AGENT_MODES.map(m => `- **${m.name}**: ${m.description}`).join("\n")}

*Use \`/mode <name>\` to switch*`
      };
    }
    
    if (cmd.startsWith("/mode ")) {
      const modeName = args.toLowerCase();
      const mode = AGENT_MODES.find(m => 
        m.name.toLowerCase().includes(modeName) || 
        m.id.toLowerCase().includes(modeName)
      );
      if (mode) {
        setCurrentMode(mode);
        return {
          type: "system",
          content: `## Mode Changed

Switched to **${mode.name}** mode.  
${mode.description}

*My capabilities have been adjusted accordingly.*`
        };
      }
      return {
        type: "system",
        content: `❌ Unknown mode: "${args}"\n\nAvailable: ${AGENT_MODES.map(m => m.id).join(", ")}`
      };
    }
    
    if (cmd === "/model") {
      return {
        type: "system",
        content: `## Current Model

**${currentModel.name}**  
Provider: ${currentModel.provider}  
Speed: ${currentModel.speed}

### Available Models
${AI_MODELS.map(m => `- ${m.icon} **${m.name}** (${m.provider}) - ${m.speed}`).join("\n")}

*Use \`/model <name>\` to switch*`
      };
    }
    
    if (cmd.startsWith("/model ")) {
      const modelName = args.toLowerCase();
      const model = AI_MODELS.find(m => 
        m.name.toLowerCase().includes(modelName) || 
        m.id.toLowerCase().includes(modelName)
      );
      if (model) {
        setCurrentModel(model);
        return {
          type: "system",
          content: `## Model Changed

Switched to **${model.name}** (${model.provider}).  
Speed: ${model.speed}

*Ready to process your requests!*`
        };
      }
      return {
        type: "system",
        content: `❌ Unknown model: "${args}"\n\nAvailable: ${AI_MODELS.map(m => m.id).join(", ")}`
      };
    }
    
    if (cmd === "/status" || cmd === "/health") {
      return {
        type: "system",
        content: `## 🦞 System Status

### Gateway
| Component | Status |
|-----------|--------|
| Gateway | ✅ ${gatewayStatus.gateway} |
| AI Model | ✅ ${gatewayStatus.model} |
| Voice | ✅ ${gatewayStatus.voice} |
| Memory | ✅ ${gatewayStatus.memory} |

### Configuration
| Setting | Value |
|---------|-------|
| Mode | ${currentMode.name} |
| Model | ${currentModel.name} |
| Provider | ${currentModel.provider} |
| Session | \`${sessionId}\` |
| Channels | ${gatewayStatus.channels.join(", ")} |

### Health Check
\`\`\`
moltbot health: OK
gateway: running
auth: configured
websocket: connected
\`\`\``
      };
    }
    
    if (cmd === "/session") {
      return {
        type: "system",
        content: `## Session Info

| Field | Value |
|-------|-------|
| Session ID | \`${sessionId}\` |
| Active Session | ${activeSession} |
| Messages | ${messages.length} |
| Mode | ${currentMode.name} |
| Model | ${currentModel.name} |
| Started | ${new Date(parseInt(sessionId.split("-")[1])).toLocaleString()} |`
      };
    }
    
    if (cmd === "/config") {
      return {
        type: "system",
        content: `## Configuration

\`\`\`json
{
  "agent": {
    "mode": "${currentMode.id}",
    "model": "${currentModel.id}",
    "provider": "${currentModel.provider}"
  },
  "session": {
    "id": "${sessionId}",
    "active": "${activeSession}",
    "scope": "user"
  },
  "channels": {
    "webchat": { "enabled": true }
  },
  "gateway": {
    "port": 18789,
    "auth": "token"
  }
}
\`\`\``
      };
    }
    
    if (cmd === "/about") {
      return {
        type: "system",
        content: `## 🦞 About Moltbot

**Moltbot** is a personal AI assistant inspired by [moltbot/moltbot](https://github.com/moltbot/moltbot).

### Features
- 🤖 **Multi-Mode AI** - Switch between specialized agents
- 🔄 **Model Switching** - Use different AI providers
- 🔍 **Web Research** - Search and analyze online
- 💾 **Memory** - Semantic search across conversations
- 🔊 **Voice** - Speech input/output
- 📡 **Multi-Channel** - WhatsApp, Telegram, Discord, etc.

### Architecture
- Gateway-based architecture
- WebSocket real-time communication
- Session isolation per channel
- Tool & skill plugins

*"EXFOLIATE! EXFOLIATE!"* 🦞

Version: 2026.1.27  
GitHub: [moltbot/moltbot](https://github.com/moltbot/moltbot)`
      };
    }
    
    if (cmd === "/new") {
      const newSession = {
        id: `session-${Date.now()}`,
        name: `Session ${sessions.length + 1}`,
        messages: 0,
        active: false
      };
      setSessions(prev => [...prev.map(s => ({...s, active: false})), {...newSession, active: true}]);
      setActiveSession(newSession.id);
      setMessages([{
        id: Date.now(),
        role: "assistant",
        content: `📝 New session started: **${newSession.name}**\n\nYour previous conversation is saved.`,
        timestamp: new Date().toISOString()
      }]);
      return null;
    }
    
    if (cmd === "/export") {
      const exportData = {
        sessionId,
        mode: currentMode.id,
        model: currentModel.id,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp
        })),
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `moltbot-${sessionId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Conversation exported!");
      return {
        type: "system",
        content: "📥 Conversation exported successfully!"
      };
    }
    
    return false; // Not a command
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = {
      id: Date.now(),
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString()
    };
    
    // Check if it's a command
    if (input.startsWith("/")) {
      const commandResult = handleCommand(input);
      if (commandResult === null) {
        setInput("");
        return; // Command handled (like /clear)
      }
      if (commandResult) {
        setMessages(prev => [...prev, userMessage, {
          id: Date.now() + 1,
          role: "assistant",
          content: commandResult.content,
          timestamp: new Date().toISOString(),
          isSystem: true
        }]);
        setInput("");
        return;
      }
    }
    
    // Handle special commands that need API calls
    if (input.toLowerCase().startsWith("/search ") || input.toLowerCase().startsWith("/research ")) {
      const isResearch = input.toLowerCase().startsWith("/research ");
      const query = input.slice(isResearch ? 10 : 8).trim();
      
      setMessages(prev => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);
      
      try {
        const response = await fetch(`${BACKEND_URL}/api/agent/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_type: "coding",
            message: isResearch 
              ? `Perform a deep research analysis on: "${query}". Search the web, find multiple sources, analyze the information, and provide a comprehensive report with citations.`
              : `Search the web for: "${query}" and provide a summary of what you find with sources.`,
            conversation_history: []
          })
        });
        
        if (!response.ok) throw new Error("Request failed");
        const data = await response.json();
        
        setMessages(prev => [...prev, {
          id: Date.now(),
          role: "assistant",
          content: data.response || "I couldn't find information on that topic.",
          timestamp: new Date().toISOString(),
          isResearch: true
        }]);
      } catch (error) {
        console.error("Search error:", error);
        setMessages(prev => [...prev, {
          id: Date.now(),
          role: "assistant",
          content: "⚠️ Search failed. Please try again.",
          timestamp: new Date().toISOString(),
          isError: true
        }]);
      } finally {
        setIsLoading(false);
      }
      return;
    }
    
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setIsLoading(true);
    
    try {
      // Map mode to agent type
      const agentTypeMap = {
        general: "coding",
        research: "coding",
        coding: "coding",
        creative: "coding",
        learning: "coding",
        business: "business"
      };
      
      const response = await fetch(`${BACKEND_URL}/api/moltbot/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: currentInput,
          agent_mode: currentMode.id,
          conversation_history: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content
          })),
          session_id: sessionId,
          thinking_mode: currentMode.id === "coding" ? "senior_engineer" : "normal",
          skill_level: "intermediate"
        })
      });
      
      if (!response.ok) throw new Error("Request failed");
      
      const data = await response.json();
      
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: "assistant",
        content: data.response || "I apologize, but I couldn't process that request.",
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      console.error("Moltbot error:", error);
      toast.error("Failed to send message");
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: "assistant",
        content: "⚠️ Connection error. Please try again.",
        timestamp: new Date().toISOString(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex gap-4" data-testid="moltbot-view">
      {/* Sidebar */}
      {showSidebar && (
        <div className="w-72 flex-shrink-0 glass-heavy rounded-2xl p-4 flex flex-col gap-4 overflow-hidden">
          {/* Logo & Mode */}
          <div className="flex items-center gap-3 pb-4 border-b border-white/10">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#E74C3C] to-[#C0392B] flex items-center justify-center shadow-lg shadow-red-500/20">
              <span className="text-2xl">🦞</span>
            </div>
            <div>
              <h2 className="font-bold text-lg">Moltbot</h2>
              <p className="text-xs text-white/50">{currentMode.name}</p>
            </div>
          </div>
          
          {/* Mode Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Agent Mode</span>
            </div>
            <div className="space-y-1">
              {AGENT_MODES.map(mode => {
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.id}
                    onClick={() => setCurrentMode(mode)}
                    className={`w-full p-2.5 rounded-xl flex items-center gap-3 transition-all ${
                      currentMode.id === mode.id 
                        ? "bg-gradient-to-r from-white/10 to-white/5 border border-white/20" 
                        : "hover:bg-white/5"
                    }`}
                  >
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${mode.color}20` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: mode.color }} />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium">{mode.name}</div>
                      <div className="text-xs text-white/40">{mode.description}</div>
                    </div>
                    {currentMode.id === mode.id && (
                      <div className="ml-auto w-2 h-2 rounded-full bg-green-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Model Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">AI Model</span>
            </div>
            <div className="space-y-1">
              {AI_MODELS.map(model => (
                <button
                  key={model.id}
                  onClick={() => setCurrentModel(model)}
                  className={`w-full p-2.5 rounded-xl flex items-center gap-3 transition-all ${
                    currentModel.id === model.id 
                      ? "bg-gradient-to-r from-[#667eea]/20 to-[#764ba2]/20 border border-[#667eea]/30" 
                      : "hover:bg-white/5"
                  }`}
                >
                  <span className="text-lg">{model.icon}</span>
                  <div className="text-left flex-1">
                    <div className="text-sm font-medium">{model.name}</div>
                    <div className="text-xs text-white/40">{model.provider}</div>
                  </div>
                  {currentModel.id === model.id && (
                    <div className="w-2 h-2 rounded-full bg-[#667eea]" />
                  )}
                </button>
              ))}
            </div>
          </div>
          
          {/* Sessions */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Sessions</span>
              <button 
                onClick={() => handleCommand("/new")}
                className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white"
              >
                <PlusCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1 overflow-auto flex-1">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => setActiveSession(session.id)}
                  className={`w-full p-2 rounded-lg flex items-center gap-2 transition-all ${
                    activeSession === session.id 
                      ? "bg-white/10 border border-white/10" 
                      : "hover:bg-white/5"
                  }`}
                >
                  <Hash className="w-4 h-4 text-white/40" />
                  <span className="text-sm truncate">{session.name}</span>
                  {session.active && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-green-500" />
                  )}
                </button>
              ))}
            </div>
          </div>
          
          {/* Status Bar */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-xs text-white/40">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>Connected</span>
              </div>
              <span>{messages.length} msgs</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 glass-heavy rounded-t-2xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${currentMode.color}40, ${currentMode.color}20)` }}
              >
                {React.createElement(currentMode.icon, { className: "w-5 h-5", style: { color: currentMode.color } })}
              </div>
              <div>
                <h1 className="text-lg font-bold flex items-center gap-2">
                  {currentMode.name}
                  <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"} animate-pulse`} />
                </h1>
                <p className="text-xs text-white/50">{currentMode.description}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/50 hover:text-white"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-4 h-4" />
            </Button>
            <div 
              className="px-3 py-1.5 rounded-full border text-xs flex items-center gap-2 cursor-pointer hover:bg-white/5 transition-colors"
              style={{ borderColor: `${currentMode.color}50`, color: currentMode.color }}
              onClick={() => setShowModelSelector(!showModelSelector)}
            >
              <span>{currentModel.icon}</span>
              <span>{currentModel.name}</span>
              <ChevronDown className="w-3 h-3" />
            </div>
          </div>
        </div>
        
        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 border-b border-white/10 bg-white/5 animate-slideDown">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Settings</h3>
              <button onClick={() => setShowSettings(false)} className="text-white/50 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 glass-light rounded-xl">
                <div className="text-sm mb-1">Mode</div>
                <div className="text-xs text-white/50">{currentMode.name}</div>
              </div>
              <div className="p-3 glass-light rounded-xl">
                <div className="text-sm mb-1">Model</div>
                <div className="text-xs text-white/50">{currentModel.name}</div>
              </div>
              <div className="p-3 glass-light rounded-xl">
                <div className="text-sm mb-1">Messages</div>
                <div className="text-xs text-white/50">{messages.length} in session</div>
              </div>
              <div className="p-3 glass-light rounded-xl">
                <div className="text-sm mb-1">Session</div>
                <div className="text-xs text-white/50 truncate">{sessionId}</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-6 glass-heavy">
          {messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              mode={currentMode}
              onCopy={() => copyToClipboard(msg.content, msg.id)}
              isCopied={copiedId === msg.id}
              canRegenerate={msg.role === "assistant" && idx > 0 && !isLoading}
            />
          ))}
          
          {isLoading && (
            <div className="flex items-start gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${currentMode.color}40, ${currentMode.color}20)` }}
              >
                {React.createElement(currentMode.icon, { className: "w-5 h-5", style: { color: currentMode.color } })}
              </div>
              <div className="flex-1 p-4 glass-light rounded-2xl rounded-tl-md">
                <div className="flex items-center gap-2 text-white/50">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">
                    {currentMode.id === "research" ? "Researching..." : 
                     currentMode.id === "coding" ? "Analyzing code..." :
                     currentMode.id === "creative" ? "Creating..." :
                     "Thinking..."}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input Area */}
        <div className="p-4 border-t border-white/10 glass-heavy rounded-b-2xl">
          <div className="flex items-end gap-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                className="border-white/20 hover:bg-white/10"
                onClick={() => setIsListening(!isListening)}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4 text-red-400" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="border-white/20 hover:bg-white/10"
                onClick={() => document.getElementById('moltbot-file-input')?.click()}
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <input type="file" id="moltbot-file-input" className="hidden" />
            </div>
            
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${currentMode.name}... (try /help)`}
                className="pr-12 min-h-[60px] max-h-[200px] bg-white/5 border-white/10 resize-none"
                data-testid="moltbot-input"
              />
              <div className="absolute right-3 bottom-3 text-xs text-white/30">
                {input.length}/4000
              </div>
            </div>
            
            <Button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="h-[60px] px-6 shadow-lg"
              style={{ 
                background: `linear-gradient(135deg, ${currentMode.color}, ${currentMode.color}CC)`,
                boxShadow: `0 4px 20px ${currentMode.color}40`
              }}
              data-testid="moltbot-send-btn"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
          
          {/* Quick Actions */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-white/40">Quick:</span>
            <button
              onClick={() => setInput("/help")}
              className="px-2 py-1 text-xs rounded-md bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              /help
            </button>
            <button
              onClick={() => setInput("/status")}
              className="px-2 py-1 text-xs rounded-md bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              /status
            </button>
            <button
              onClick={() => setInput("/search ")}
              className="px-2 py-1 text-xs rounded-md bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              /search
            </button>
            <button
              onClick={() => setInput("/research ")}
              className="px-2 py-1 text-xs rounded-md bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              /research
            </button>
            {currentMode.id === "coding" && (
              <button
                onClick={() => setInput("Write a function that ")}
                className="px-2 py-1 text-xs rounded-md bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              >
                Write function
              </button>
            )}
            {currentMode.id === "research" && (
              <button
                onClick={() => setInput("What are the latest developments in ")}
                className="px-2 py-1 text-xs rounded-md bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              >
                Latest developments
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Message Bubble Component
const MessageBubble = ({ message, mode, onCopy, isCopied, canRegenerate }) => {
  const isUser = message.role === "user";
  const isSystem = message.isSystem;
  const isError = message.isError;
  const isResearch = message.isResearch;
  
  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""} group`}>
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
        isUser
          ? "bg-gradient-to-br from-[#667eea] to-[#764ba2]"
          : isSystem
          ? "bg-gradient-to-br from-[#34A853] to-[#2E8B57]"
          : isError
          ? "bg-gradient-to-br from-[#EA4335] to-[#B52D25]"
          : isResearch
          ? "bg-gradient-to-br from-[#3498DB] to-[#2980B9]"
          : ""
      }`} style={!isUser && !isSystem && !isError && !isResearch ? {
        background: `linear-gradient(135deg, ${mode.color}40, ${mode.color}20)`
      } : {}}>
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : isSystem ? (
          <Shield className="w-5 h-5 text-white" />
        ) : isResearch ? (
          <Search className="w-5 h-5 text-white" />
        ) : (
          React.createElement(mode.icon, { className: "w-5 h-5", style: { color: mode.color } })
        )}
      </div>
      
      {/* Content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? "text-right" : ""}`}>
        <div className={`p-4 rounded-2xl ${
          isUser
            ? "bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-tr-md"
            : isSystem
            ? "glass-light border border-[#34A853]/30 rounded-tl-md"
            : isError
            ? "glass-light border border-[#EA4335]/30 rounded-tl-md"
            : isResearch
            ? "glass-light border border-[#3498DB]/30 rounded-tl-md"
            : "glass-light border border-white/10 rounded-tl-md"
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none moltbot-content">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-xl font-bold mb-4 pb-2 border-b border-white/10 flex items-center gap-2">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-lg font-bold mb-3 mt-4" style={{ color: mode.color }}>{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base font-semibold mb-2 mt-3">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-white/80 leading-relaxed mb-3">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="space-y-2 my-3 ml-4">{children}</ul>
                  ),
                  li: ({ children }) => (
                    <li className="text-white/80 flex items-start gap-2">
                      <span style={{ color: mode.color }} className="mt-1">•</span>
                      <span>{children}</span>
                    </li>
                  ),
                  code: ({ inline, children }) => {
                    if (inline) {
                      return (
                        <code className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ 
                          backgroundColor: `${mode.color}20`, 
                          color: mode.color 
                        }}>
                          {children}
                        </code>
                      );
                    }
                    return (
                      <pre className="bg-black/40 rounded-xl p-4 overflow-x-auto my-3">
                        <code className="text-sm font-mono text-green-400">{children}</code>
                      </pre>
                    );
                  },
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-3">
                      <table className="w-full border-collapse">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead style={{ backgroundColor: `${mode.color}20` }}>{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th className="px-3 py-2 text-left font-semibold border-b border-white/10">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="px-3 py-2 border-b border-white/5">{children}</td>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-bold text-white">{children}</strong>
                  ),
                  em: ({ children }) => (
                    <em className="italic" style={{ color: mode.color }}>{children}</em>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 pl-4 my-3 italic text-white/70" style={{ borderColor: mode.color }}>
                      {children}
                    </blockquote>
                  ),
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80" style={{ color: mode.color }}>
                      {children}
                    </a>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className={`flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity ${
          isUser ? "justify-end" : "justify-start"
        }`}>
          <span className="text-xs text-white/30">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
          <button
            onClick={onCopy}
            className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            title="Copy message"
          >
            {isCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoltbotView;

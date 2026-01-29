import React, { useState, useRef, useEffect } from "react";
import {
  Send, Loader2, Bot, User, Settings, Moon, Sun,
  MessageSquare, Sparkles, Globe, Copy, Check, RefreshCw,
  Mic, MicOff, Volume2, VolumeX, Menu, X, ChevronDown,
  Zap, Shield, Code, Image, FileText, Paperclip
} from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Moltbot-inspired chat view with lobster theme 🦞
const MoltbotView = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [sessionId] = useState(() => `molt-${Date.now()}`);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Initialize with welcome message
  useEffect(() => {
    setMessages([{
      id: 1,
      role: "assistant",
      content: `# 🦞 Welcome to Moltbot

**EXFOLIATE! EXFOLIATE!**

I'm your personal AI assistant, ready to help you with anything. I can:

- 💬 **Chat & Conversation** - Ask me anything
- 🔍 **Research & Analysis** - Deep dives into topics
- 📝 **Writing & Editing** - Documents, emails, code
- 💡 **Ideas & Brainstorming** - Creative solutions
- 🔧 **Technical Help** - Coding, debugging, explanations

**Quick Tips:**
- Use \`/help\` for available commands
- Use \`/clear\` to clear chat history
- Use \`/model\` to check current AI model

Ready to molt? Let's go! 🦞`,
      timestamp: new Date().toISOString()
    }]);
  }, []);

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
    
    if (cmd === "/help") {
      return {
        type: "system",
        content: `## Available Commands

| Command | Description |
|---------|-------------|
| \`/help\` | Show this help message |
| \`/clear\` | Clear chat history |
| \`/model\` | Show current AI model |
| \`/status\` | Check connection status |
| \`/about\` | About Moltbot |`
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
    
    if (cmd === "/model") {
      return {
        type: "system",
        content: `## Current Model

**Provider:** Gemini  
**Model:** gemini-3-flash-preview  
**Status:** ✅ Connected  
**Session:** \`${sessionId}\``
      };
    }
    
    if (cmd === "/status") {
      return {
        type: "system",
        content: `## System Status

| Component | Status |
|-----------|--------|
| Gateway | ✅ Online |
| AI Model | ✅ Ready |
| Voice | ✅ Available |
| Session | \`${sessionId}\` |`
      };
    }
    
    if (cmd === "/about") {
      return {
        type: "system",
        content: `## 🦞 About Moltbot

**Moltbot** is a personal AI assistant inspired by [moltbot/moltbot](https://github.com/moltbot/moltbot).

This is a UI replica integrated into Live Code Mentor, featuring:
- Multi-model AI support
- Command system
- Conversation memory
- Voice input/output

*"EXFOLIATE! EXFOLIATE!"* 🦞`
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
    
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setIsLoading(true);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_type: "coding", // Using coding agent as base
          message: currentInput,
          conversation_history: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content
          }))
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

  const regenerateResponse = async (messageIndex) => {
    if (isLoading || messageIndex < 1) return;
    
    // Find the user message before this assistant message
    const userMessage = messages[messageIndex - 1];
    if (userMessage?.role !== "user") return;
    
    // Remove the assistant message and regenerate
    setMessages(prev => prev.slice(0, messageIndex));
    setInput(userMessage.content);
    
    // Trigger send after state update
    setTimeout(() => {
      setInput("");
      sendMessage();
    }, 100);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col" data-testid="moltbot-view">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 glass-heavy rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#E74C3C] to-[#C0392B] flex items-center justify-center shadow-lg shadow-red-500/20">
            <span className="text-2xl">🦞</span>
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              Moltbot
              <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"} animate-pulse`} />
            </h1>
            <p className="text-xs text-white/50">Personal AI Assistant • {sessionId}</p>
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
          <div className="px-3 py-1 rounded-full bg-gradient-to-r from-[#E74C3C]/20 to-[#C0392B]/20 border border-[#E74C3C]/30 text-xs flex items-center gap-2">
            <Zap className="w-3 h-3 text-[#E74C3C]" />
            <span>Gemini 3</span>
          </div>
        </div>
      </div>
      
      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 border-b border-white/10 bg-white/5 animate-slideDown">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Settings</h3>
            <button onClick={() => setShowSettings(false)} className="text-white/50 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-3">
            <div className="p-3 glass-light rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-sm">Theme</span>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 rounded-lg hover:bg-white/10"
                >
                  {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="p-3 glass-light rounded-xl">
              <div className="text-sm">Model</div>
              <div className="text-xs text-white/50 mt-1">gemini-3-flash</div>
            </div>
            <div className="p-3 glass-light rounded-xl">
              <div className="text-sm">Messages</div>
              <div className="text-xs text-white/50 mt-1">{messages.length} in session</div>
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
            onCopy={() => copyToClipboard(msg.content, msg.id)}
            isCopied={copiedId === msg.id}
            onRegenerate={() => msg.role === "assistant" && regenerateResponse(idx)}
            canRegenerate={msg.role === "assistant" && idx > 0 && !isLoading}
          />
        ))}
        
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E74C3C] to-[#C0392B] flex items-center justify-center">
              <span className="text-lg">🦞</span>
            </div>
            <div className="flex-1 p-4 glass-light rounded-2xl rounded-tl-md">
              <div className="flex items-center gap-2 text-white/50">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Moltbot is thinking...</span>
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
          </div>
          
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "Listening..." : "Message Moltbot... (try /help for commands)"}
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
            className="h-[60px] px-6 bg-gradient-to-r from-[#E74C3C] to-[#C0392B] hover:opacity-90 shadow-lg shadow-red-500/20"
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
        <div className="flex items-center gap-2 mt-3">
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
            onClick={() => setInput("Explain how React hooks work")}
            className="px-2 py-1 text-xs rounded-md bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            Explain React hooks
          </button>
          <button
            onClick={() => setInput("Write a Python function to sort a list")}
            className="px-2 py-1 text-xs rounded-md bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            Python sort function
          </button>
        </div>
      </div>
    </div>
  );
};

// Message Bubble Component
const MessageBubble = ({ message, onCopy, isCopied, onRegenerate, canRegenerate }) => {
  const isUser = message.role === "user";
  const isSystem = message.isSystem;
  const isError = message.isError;
  
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
          : "bg-gradient-to-br from-[#E74C3C] to-[#C0392B]"
      }`}>
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : isSystem ? (
          <Shield className="w-5 h-5 text-white" />
        ) : (
          <span className="text-lg">🦞</span>
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
                    <h2 className="text-lg font-bold mb-3 mt-4 text-[#E74C3C]">{children}</h2>
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
                      <span className="text-[#E74C3C] mt-1">•</span>
                      <span>{children}</span>
                    </li>
                  ),
                  code: ({ inline, children }) => {
                    if (inline) {
                      return (
                        <code className="px-1.5 py-0.5 bg-[#E74C3C]/20 text-[#E74C3C] rounded text-xs font-mono">
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
                    <thead className="bg-[#E74C3C]/20">{children}</thead>
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
                    <em className="italic text-[#E74C3C]">{children}</em>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-[#E74C3C] pl-4 my-3 italic text-white/70">
                      {children}
                    </blockquote>
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
          {canRegenerate && (
            <button
              onClick={onRegenerate}
              className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              title="Regenerate response"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MoltbotView;

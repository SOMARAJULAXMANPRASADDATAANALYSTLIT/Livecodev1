import React, { useState, useEffect, useRef } from "react";
import { 
  Terminal, Search, Globe, Code, Cpu, Brain, Zap, Play, Pause, 
  Download, Upload, Settings, Activity, Folder, FileText, Eye,
  Command, RefreshCw, Check, X, Loader2, Send, ChevronRight,
  Box, Layers, Database, Cloud, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const MoltbotFullView = () => {
  const [activeTab, setActiveTab] = useState("agent");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState(null);
  const [processes, setProcesses] = useState([]);
  const [skills, setSkills] = useState([]);
  const [browserStatus, setBrowserStatus] = useState({ running: false });
  const [memory, setMemory] = useState("");
  const messagesEndRef = useRef(null);

  // Load gateway status on mount
  useEffect(() => {
    loadGatewayStatus();
    loadProcesses();
    loadSkills();
  }, []);

  const loadGatewayStatus = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/moltbot/tools/gateway/status`);
      const data = await response.json();
      setGatewayStatus(data);
      setBrowserStatus(data.tools.browser);
    } catch (error) {
      console.error("Failed to load gateway status:", error);
    }
  };

  const loadProcesses = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/moltbot/tools/process/list`);
      const data = await response.json();
      setProcesses(data.sessions || []);
    } catch (error) {
      console.error("Failed to load processes:", error);
    }
  };

  const loadSkills = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/moltbot/tools/skills/list`);
      const data = await response.json();
      setSkills(data.skills || []);
    } catch (error) {
      console.error("Failed to load skills:", error);
    }
  };

  const loadMemory = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/moltbot/tools/memory`);
      const data = await response.json();
      setMemory(data.content || "");
    } catch (error) {
      console.error("Failed to load memory:", error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    
    setMessages(prev => [...prev, {
      role: "user",
      content: userMessage
    }]);

    setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/moltbot/tools/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          tools_enabled: ["web_search", "web_fetch", "browser", "exec"],
          session_id: "moltbot-full",
          skill_level: "intermediate"
        })
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.response,
        tool_result: data.tool_result
      }]);

      // Refresh status
      loadGatewayStatus();
      loadProcesses();
      
    } catch (error) {
      console.error("Agent error:", error);
      toast.error("Failed to get response");
    } finally {
      setIsLoading(false);
    }
  };

  const executeTool = async (tool, params) => {
    setIsLoading(true);
    try {
      let response;
      
      if (tool === "exec") {
        response = await fetch(`${BACKEND_URL}/api/moltbot/tools/exec`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params)
        });
      } else if (tool === "web_search") {
        response = await fetch(`${BACKEND_URL}/api/moltbot/tools/web/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params)
        });
      } else if (tool === "browser") {
        response = await fetch(`${BACKEND_URL}/api/moltbot/tools/browser`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params)
        });
      }

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        role: "system",
        content: `**Tool: ${tool}**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
      }]);

      toast.success(`${tool} executed successfully`);
      loadGatewayStatus();
      loadProcesses();
      
    } catch (error) {
      console.error(`${tool} error:`, error);
      toast.error(`Failed to execute ${tool}`);
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f0e17] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#EA4335] to-[#FBBC04] flex items-center justify-center">
                  <Terminal className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Moltbot 🦞</h1>
                  <p className="text-sm text-white/50">Full Gateway Implementation</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {gatewayStatus && (
                <>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#34A853]/20 rounded-lg border border-[#34A853]/30">
                    <div className="w-2 h-2 rounded-full bg-[#34A853] animate-pulse" />
                    <span className="text-sm font-medium text-[#34A853]">Gateway Online</span>
                  </div>
                  <div className="text-xs text-white/40">
                    v{gatewayStatus.version}
                  </div>
                </>
              )}
              <button
                onClick={loadGatewayStatus}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex gap-2 mt-4 overflow-x-auto">
            {[
              { id: "agent", label: "AI Agent", icon: Brain },
              { id: "tools", label: "Tools", icon: Zap },
              { id: "processes", label: "Processes", icon: Activity },
              { id: "skills", label: "Skills", icon: Box },
              { id: "memory", label: "Memory", icon: Database },
              { id: "status", label: "Status", icon: Settings }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === "memory") loadMemory();
                  if (tab.id === "processes") loadProcesses();
                  if (tab.id === "skills") loadSkills();
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? "bg-[#667eea] text-white"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-sm font-medium whitespace-nowrap">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1800px] mx-auto p-6">
        {/* Agent Tab */}
        {activeTab === "agent" && (
          <div className="grid grid-cols-3 gap-6">
            {/* Chat */}
            <div className="col-span-2 bg-white/5 rounded-xl border border-white/10 p-6 flex flex-col" style={{ height: "calc(100vh - 220px)" }}>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-[#667eea]" />
                AI Agent with Real Tools
              </h2>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                {messages.length === 0 && (
                  <div className="text-center text-white/50 py-12">
                    <Terminal className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">Welcome to Moltbot!</p>
                    <p className="text-sm">I'm your AI agent with REAL tool access:</p>
                    <div className="mt-4 space-y-1 text-xs">
                      <p>🔍 <strong>web_search</strong> - Search the web (Brave API)</p>
                      <p>🌐 <strong>web_fetch</strong> - Fetch webpage content</p>
                      <p>🌍 <strong>browser</strong> - Control a real browser</p>
                      <p>⚙️ <strong>exec</strong> - Run shell commands</p>
                    </div>
                    <p className="mt-4 text-xs">Try: "Search for latest React tutorials"</p>
                  </div>
                )}
                
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] p-4 rounded-xl ${
                        msg.role === "user"
                          ? "bg-[#667eea] text-white"
                          : msg.role === "system"
                          ? "bg-[#FBBC04]/20 border border-[#FBBC04]/30"
                          : "bg-white/10 border border-white/10"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown
                            components={{
                              h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                              p: ({ children }) => <p className="text-sm mb-2 last:mb-0">{children}</p>,
                              code: ({ inline, children }) => 
                                inline ? (
                                  <code className="px-1.5 py-0.5 bg-[#667eea]/20 text-[#667eea] rounded text-xs">
                                    {children}
                                  </code>
                                ) : (
                                  <code className="block p-2 bg-black/40 rounded text-xs overflow-x-auto">
                                    {children}
                                  </code>
                                ),
                              ul: ({ children }) => <ul className="list-disc list-inside text-sm mb-2">{children}</ul>,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                          {msg.tool_result && (
                            <div className="mt-3 pt-3 border-t border-white/10">
                              <div className="text-xs text-white/50 mb-1">Tool Result:</div>
                              <pre className="text-xs bg-black/40 p-2 rounded overflow-x-auto">
                                {JSON.stringify(msg.tool_result, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/10 border border-white/10 p-4 rounded-xl">
                      <Loader2 className="w-4 h-4 animate-spin text-[#667eea]" />
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything... I have real tools!"
                  className="flex-1 min-h-[80px] bg-white/5 border-white/10 text-sm"
                  disabled={isLoading}
                />
                <Button
                  onClick={sendMessage}
                  disabled={isLoading || !input.trim()}
                  className="px-6 bg-[#667eea] hover:bg-[#667eea]/80"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Quick Tools */}
            <div className="space-y-4">
              <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#FBBC04]" />
                  Quick Tools
                </h3>
                
                <div className="space-y-2">
                  <button
                    onClick={() => executeTool("web_search", { query: "latest AI news", count: 5 })}
                    className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-left transition-colors"
                    disabled={isLoading}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium mb-1">
                      <Search className="w-4 h-4 text-[#667eea]" />
                      Web Search
                    </div>
                    <div className="text-xs text-white/50">Search latest AI news</div>
                  </button>

                  <button
                    onClick={() => executeTool("browser", { action: "start" })}
                    className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-left transition-colors"
                    disabled={isLoading || browserStatus.running}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium mb-1">
                      <Globe className="w-4 h-4 text-[#34A853]" />
                      Start Browser
                    </div>
                    <div className="text-xs text-white/50">
                      {browserStatus.running ? "Already running" : "Launch Playwright browser"}
                    </div>
                  </button>

                  <button
                    onClick={() => executeTool("exec", { command: "echo 'Hello from Moltbot!'", background: false })}
                    className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-left transition-colors"
                    disabled={isLoading}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium mb-1">
                      <Terminal className="w-4 h-4 text-[#EA4335]" />
                      Run Command
                    </div>
                    <div className="text-xs text-white/50">Execute echo command</div>
                  </button>
                </div>
              </div>

              {/* Features */}
              <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                <h3 className="font-semibold mb-3">Features</h3>
                <div className="space-y-2 text-sm">
                  {gatewayStatus?.features && Object.entries(gatewayStatus.features).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-white/70 capitalize">{key.replace(/_/g, " ")}</span>
                      {value ? (
                        <Check className="w-4 h-4 text-[#34A853]" />
                      ) : (
                        <X className="w-4 h-4 text-white/30" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tools Tab */}
        {activeTab === "tools" && (
          <div className="grid grid-cols-3 gap-6">
            {[
              { name: "exec", icon: Terminal, desc: "Run shell commands", color: "EA4335" },
              { name: "web_search", icon: Search, desc: "Search the web (Brave API)", color: "667eea" },
              { name: "web_fetch", icon: Globe, desc: "Fetch webpage content", color: "34A853" },
              { name: "browser", icon: Eye, desc: "Control browser automation", color: "FBBC04" },
              { name: "process", icon: Activity, desc: "Manage background tasks", color: "764ba2" },
              { name: "skills", icon: Box, desc: "Installed skills & plugins", color: "667eea" }
            ].map(tool => (
              <div key={tool.name} className="bg-white/5 rounded-xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-12 h-12 rounded-xl bg-[#${tool.color}]/20 flex items-center justify-center`}>
                    <tool.icon className="w-6 h-6" style={{ color: `#${tool.color}` }} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{tool.name}</h3>
                    <p className="text-xs text-white/50">{tool.desc}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className={`w-full bg-[#${tool.color}]/20 hover:bg-[#${tool.color}]/30 border border-[#${tool.color}]/30`}
                >
                  Try {tool.name}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Processes Tab */}
        {activeTab === "processes" && (
          <div className="bg-white/5 rounded-xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#667eea]" />
                Background Processes
              </h2>
              <button
                onClick={loadProcesses}
                className="p-2 rounded-lg hover:bg-white/10"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            
            {processes.length === 0 ? (
              <div className="text-center text-white/50 py-12">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No background processes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {processes.map(proc => (
                  <div key={proc.id} className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium mb-1">{proc.command}</div>
                        <div className="flex items-center gap-4 text-xs text-white/50">
                          <span>PID: {proc.pid}</span>
                          <span>Status: <span className={proc.status === "running" ? "text-[#34A853]" : "text-white/70"}>{proc.status}</span></span>
                          <span>{proc.created_at}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Skills Tab */}
        {activeTab === "skills" && (
          <div className="bg-white/5 rounded-xl border border-white/10 p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Box className="w-5 h-5 text-[#667eea]" />
              Skills ({skills.length})
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              {skills.map(skill => (
                <div key={skill.id} className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium">{skill.name}</h3>
                      <p className="text-xs text-white/50 mt-1">{skill.description}</p>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs ${
                      skill.enabled 
                        ? "bg-[#34A853]/20 text-[#34A853]" 
                        : "bg-white/10 text-white/50"
                    }`}>
                      {skill.enabled ? "Enabled" : "Disabled"}
                    </div>
                  </div>
                  <div className="text-xs text-white/40 capitalize">{skill.category}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Memory Tab */}
        {activeTab === "memory" && (
          <div className="bg-white/5 rounded-xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Database className="w-5 h-5 text-[#667eea]" />
                Persistent Memory
              </h2>
              <button
                onClick={loadMemory}
                className="p-2 rounded-lg hover:bg-white/10"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            
            <div className="bg-black/40 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap">
              {memory || "No memory stored yet"}
            </div>
          </div>
        )}

        {/* Status Tab */}
        {activeTab === "status" && gatewayStatus && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Settings className="w-8 h-8 text-[#667eea]" />
                  <div>
                    <div className="text-2xl font-bold">{gatewayStatus.version}</div>
                    <div className="text-xs text-white/50">Gateway Version</div>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Activity className="w-8 h-8 text-[#34A853]" />
                  <div>
                    <div className="text-2xl font-bold">{gatewayStatus.tools.process.sessions}</div>
                    <div className="text-xs text-white/50">Active Processes</div>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Box className="w-8 h-8 text-[#FBBC04]" />
                  <div>
                    <div className="text-2xl font-bold">{gatewayStatus.tools.skills.count}</div>
                    <div className="text-xs text-white/50">Installed Skills</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h3 className="font-semibold mb-4">Complete Status</h3>
              <pre className="text-xs bg-black/40 p-4 rounded overflow-x-auto">
                {JSON.stringify(gatewayStatus, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MoltbotFullView;

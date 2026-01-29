import React, { useState, useEffect, useRef } from "react";
import { 
  Terminal, Search, Globe, Code, Cpu, Brain, Zap, Play, Pause, 
  Download, Upload, Settings, Activity, Folder, FileText, Eye,
  Command, RefreshCw, Check, X, Loader2, Send, ChevronRight,
  Box, Layers, Database, Cloud, Sparkles, MessageSquare, Users,
  Smartphone, QrCode, Key, TestTube
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const MoltbotFullView = () => {
  const [activeTab, setActiveTab] = useState("config");
  const [config, setConfig] = useState(null);
  const [services, setServices] = useState(null);
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // API Config
  const [braveKey, setBraveKey] = useState("");
  const [emergentKey, setEmergentKey] = useState("");
  
  // WhatsApp
  const [qrCode, setQrCode] = useState(null);
  const [whatsappContacts, setWhatsappContacts] = useState([]);
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [selectedContact, setSelectedContact] = useState("");
  
  // Tools
  const [toolResult, setToolResult] = useState(null);
  const [commandInput, setCommandInput] = useState("echo 'Hello Moltbot!'");
  const [browserUrl, setBrowserUrl] = useState("https://example.com");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Chat
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadConfig();
    loadServices();
    loadWhatsAppStatus();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/config/`);
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  };

  const loadServices = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/config/services`);
      const data = await response.json();
      setServices(data);
    } catch (error) {
      console.error("Failed to load services:", error);
    }
  };

  const loadWhatsAppStatus = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/status`);
      const data = await response.json();
      setWhatsappStatus(data);
      if (data.qr) {
        setQrCode(data.qr);
      }
    } catch (error) {
      console.error("Failed to load WhatsApp status:", error);
    }
  };

  const saveApiKey = async (service, key) => {
    setIsLoading(true);
    try {
      const updates = {};
      if (service === "brave") updates.brave_api_key = key;
      if (service === "emergent") updates.emergent_llm_key = key;
      
      const response = await fetch(`${BACKEND_URL}/api/config/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        toast.success(`${service} API key saved!`);
        loadConfig();
        loadServices();
      }
    } catch (error) {
      toast.error(`Failed to save ${service} key`);
    } finally {
      setIsLoading(false);
    }
  };

  const testApiKey = async (service, key) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/config/test-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, api_key: key })
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success(`✅ ${service} API key is valid!`);
      } else {
        toast.error(`❌ ${service} key test failed: ${data.error}`);
      }
    } catch (error) {
      toast.error(`Test failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const startWhatsApp = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/start`, {
        method: "POST"
      });
      const data = await response.json();
      toast.success("WhatsApp client starting...");
      
      // Poll for QR code
      setTimeout(() => {
        loadWhatsAppStatus();
      }, 3000);
    } catch (error) {
      toast.error("Failed to start WhatsApp");
    } finally {
      setIsLoading(false);
    }
  };

  const loadWhatsAppContacts = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/contacts`);
      const data = await response.json();
      setWhatsappContacts(data.contacts || []);
    } catch (error) {
      console.error("Failed to load contacts:", error);
    }
  };

  const sendWhatsAppMessage = async () => {
    if (!selectedContact || !whatsappMessage) {
      toast.error("Select a contact and enter a message");
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedContact,
          message: whatsappMessage
        })
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success("Message sent!");
        setWhatsappMessage("");
      } else {
        toast.error("Failed to send message");
      }
    } catch (error) {
      toast.error("Send error: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const executeTool = async (tool, params) => {
    setIsLoading(true);
    setToolResult(null);
    try {
      let endpoint = "";
      let method = "POST";
      let body = params;
      
      if (tool === "exec") {
        endpoint = "/api/moltbot/tools/exec";
        body = { command: params.command, background: false };
      } else if (tool === "browser") {
        endpoint = "/api/moltbot/tools/browser";
      } else if (tool === "web_search") {
        endpoint = "/api/moltbot/tools/web/search";
      } else if (tool === "web_fetch") {
        endpoint = "/api/moltbot/tools/web/fetch";
      }
      
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      setToolResult({ tool, data });
      toast.success(`${tool} executed!`);
    } catch (error) {
      toast.error(`${tool} failed: ${error.message}`);
      setToolResult({ tool, error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f0e17] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#EA4335] to-[#FBBC04] flex items-center justify-center">
                <Terminal className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">🦞 Moltbot Full</h1>
                <p className="text-sm text-white/50">Complete Gateway Implementation</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {services && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#34A853]/20 rounded-lg border border-[#34A853]/30">
                  <div className="w-2 h-2 rounded-full bg-[#34A853] animate-pulse" />
                  <span className="text-sm font-medium text-[#34A853]">Gateway Online</span>
                </div>
              )}
              <button
                onClick={() => {
                  loadConfig();
                  loadServices();
                  loadWhatsAppStatus();
                }}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 mt-4 overflow-x-auto">
            {[
              { id: "config", label: "⚙️ Configuration", icon: Settings },
              { id: "whatsapp", label: "📱 WhatsApp", icon: Smartphone },
              { id: "tools", label: "🛠️ Tools", icon: Zap },
              { id: "agent", label: "🤖 AI Agent", icon: Brain },
              { id: "status", label: "📊 Status", icon: Activity }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-[#667eea] text-white"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1800px] mx-auto p-6">
        
        {/* Configuration Tab */}
        {activeTab === "config" && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-[#FBBC04]" />
                Brave API Key (Web Search)
              </h2>
              <p className="text-sm text-white/60 mb-4">
                Get your free key from: <a href="https://brave.com/search/api/" target="_blank" className="text-[#667eea] hover:underline">brave.com/search/api</a>
              </p>
              <div className="space-y-3">
                <Input
                  type="password"
                  placeholder="Enter Brave API key..."
                  value={braveKey}
                  onChange={(e) => setBraveKey(e.target.value)}
                  className="bg-white/5 border-white/10"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => saveApiKey("brave", braveKey)}
                    disabled={!braveKey || isLoading}
                    className="flex-1 bg-[#667eea] hover:bg-[#667eea]/80"
                  >
                    Save Key
                  </Button>
                  <Button
                    onClick={() => testApiKey("brave", braveKey)}
                    disabled={!braveKey || isLoading}
                    className="bg-[#34A853] hover:bg-[#34A853]/80"
                  >
                    <TestTube className="w-4 h-4 mr-2" />
                    Test
                  </Button>
                </div>
                {services?.brave?.configured && (
                  <div className="text-sm text-[#34A853] flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Configured
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#667eea]" />
                Emergent LLM Key
              </h2>
              <p className="text-sm text-white/60 mb-4">
                Universal key for OpenAI, Anthropic, Google models. Get from your profile.
              </p>
              <div className="space-y-3">
                <Input
                  type="password"
                  placeholder="Enter Emergent LLM key..."
                  value={emergentKey}
                  onChange={(e) => setEmergentKey(e.target.value)}
                  className="bg-white/5 border-white/10"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => saveApiKey("emergent", emergentKey)}
                    disabled={!emergentKey || isLoading}
                    className="flex-1 bg-[#667eea] hover:bg-[#667eea]/80"
                  >
                    Save Key
                  </Button>
                </div>
                {services?.emergent?.configured && (
                  <div className="text-sm text-[#34A853] flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Configured
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-2 bg-white/5 rounded-xl border border-white/10 p-6">
              <h2 className="text-xl font-bold mb-4">Services Status</h2>
              {services && (
                <div className="grid grid-cols-4 gap-4">
                  {Object.entries(services).map(([key, value]) => (
                    <div key={key} className="p-4 bg-white/5 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium capitalize">{key}</span>
                        {value.configured ? (
                          <Check className="w-4 h-4 text-[#34A853]" />
                        ) : (
                          <X className="w-4 h-4 text-white/30" />
                        )}
                      </div>
                      <div className="text-xs text-white/50">
                        {value.configured ? "Configured" : "Not configured"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* WhatsApp Tab */}
        {activeTab === "whatsapp" && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[#34A853]" />
                WhatsApp Authentication
              </h2>
              
              {!whatsappStatus?.authenticated && (
                <div className="space-y-4">
                  <Button
                    onClick={startWhatsApp}
                    disabled={isLoading}
                    className="w-full bg-[#34A853] hover:bg-[#34A853]/80"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                    Start WhatsApp Client
                  </Button>
                  
                  {qrCode && (
                    <div className="p-4 bg-white rounded-lg">
                      <p className="text-sm text-black mb-2 font-medium">Scan with WhatsApp:</p>
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`}
                        alt="WhatsApp QR Code"
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              )}
              
              {whatsappStatus?.authenticated && (
                <div className="space-y-4">
                  <div className="p-4 bg-[#34A853]/20 rounded-lg border border-[#34A853]/30">
                    <div className="flex items-center gap-2 text-[#34A853]">
                      <Check className="w-5 h-5" />
                      <span className="font-medium">WhatsApp Connected!</span>
                    </div>
                  </div>
                  
                  <Button
                    onClick={loadWhatsAppContacts}
                    className="w-full bg-[#667eea] hover:bg-[#667eea]/80"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Load Contacts
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#667eea]" />
                Send Message
              </h2>
              
              {whatsappStatus?.authenticated ? (
                <div className="space-y-3">
                  <select
                    value={selectedContact}
                    onChange={(e) => setSelectedContact(e.target.value)}
                    className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-sm"
                  >
                    <option value="">Select contact...</option>
                    {whatsappContacts.map(contact => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name || contact.number}
                      </option>
                    ))}
                  </select>
                  
                  <Textarea
                    value={whatsappMessage}
                    onChange={(e) => setWhatsappMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="min-h-[120px] bg-white/5 border-white/10"
                  />
                  
                  <Button
                    onClick={sendWhatsAppMessage}
                    disabled={!selectedContact || !whatsappMessage || isLoading}
                    className="w-full bg-[#34A853] hover:bg-[#34A853]/80"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    Send Message
                  </Button>
                </div>
              ) : (
                <div className="text-center text-white/50 py-12">
                  <Smartphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Connect WhatsApp first</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tools Tab */}
        {activeTab === "tools" && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-6">
              {/* Exec Tool */}
              <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-[#EA4335]" />
                  Command Execution
                </h3>
                <div className="space-y-3">
                  <Input
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    placeholder="Enter command..."
                    className="bg-white/5 border-white/10 font-mono text-sm"
                  />
                  <Button
                    onClick={() => executeTool("exec", { command: commandInput })}
                    disabled={isLoading}
                    className="w-full bg-[#EA4335] hover:bg-[#EA4335]/80"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                    Execute
                  </Button>
                </div>
              </div>

              {/* Browser Tool */}
              <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-[#34A853]" />
                  Browser Control
                </h3>
                <div className="space-y-3">
                  <Input
                    value={browserUrl}
                    onChange={(e) => setBrowserUrl(e.target.value)}
                    placeholder="URL..."
                    className="bg-white/5 border-white/10 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => executeTool("browser", { action: "start" })}
                      disabled={isLoading}
                      size="sm"
                      className="bg-[#34A853] hover:bg-[#34A853]/80"
                    >
                      Start
                    </Button>
                    <Button
                      onClick={() => executeTool("browser", { action: "navigate", url: browserUrl })}
                      disabled={isLoading}
                      size="sm"
                      className="bg-[#667eea] hover:bg-[#667eea]/80"
                    >
                      Navigate
                    </Button>
                  </div>
                </div>
              </div>

              {/* Web Search Tool */}
              <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Search className="w-5 h-5 text-[#667eea]" />
                  Web Search
                </h3>
                <div className="space-y-3">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search query..."
                    className="bg-white/5 border-white/10 text-sm"
                  />
                  <Button
                    onClick={() => executeTool("web_search", { query: searchQuery, count: 5 })}
                    disabled={isLoading || !searchQuery}
                    className="w-full bg-[#667eea] hover:bg-[#667eea]/80"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                    Search
                  </Button>
                </div>
              </div>
            </div>

            {/* Tool Results */}
            {toolResult && (
              <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                <h3 className="font-semibold mb-3">Result: {toolResult.tool}</h3>
                <pre className="text-xs bg-black/40 p-4 rounded overflow-x-auto">
                  {JSON.stringify(toolResult.data || toolResult.error, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Status Tab */}
        {activeTab === "status" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                <div className="text-2xl font-bold mb-1">v2026.1.27</div>
                <div className="text-sm text-white/50">Gateway Version</div>
              </div>
              <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                <div className="text-2xl font-bold mb-1">
                  {whatsappStatus?.authenticated ? "✅ Connected" : "❌ Not Connected"}
                </div>
                <div className="text-sm text-white/50">WhatsApp Status</div>
              </div>
              <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                <div className="text-2xl font-bold mb-1">9 Tools</div>
                <div className="text-sm text-white/50">Available</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MoltbotFullView;

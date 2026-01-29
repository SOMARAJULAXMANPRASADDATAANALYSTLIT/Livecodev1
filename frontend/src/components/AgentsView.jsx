import React, { useState, useRef, useEffect } from "react";
import { 
  Code, Stethoscope, Plane, BarChart3, Send, Loader2, 
  Download, Lightbulb, ChevronRight, Building, MapPin,
  Heart, FileText, Globe, Calendar, DollarSign, Users,
  Activity, Clock, Star, ExternalLink, Map, Mic, MicOff, Image, X, Zap
} from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AGENTS = [
  { id: "coding", name: "Coding Mentor", icon: Code, color: "#667eea", description: "Code analysis, debugging, tutoring" },
  { id: "health", name: "Health Agent", icon: Stethoscope, color: "#EA4335", description: "Medical concepts, patient education" },
  { id: "travel", name: "Travel Agent", icon: Plane, color: "#34A853", description: "Trip planning, itineraries, guides" },
  { id: "business", name: "Business Intel", icon: BarChart3, color: "#FBBC04", description: "Company analysis, research" },
];

const AgentsView = () => {
  const [activeAgent, setActiveAgent] = useState("coding");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [specialResult, setSpecialResult] = useState(null);
  const [deepResearchMode, setDeepResearchMode] = useState(false);
  const [researchProgress, setResearchProgress] = useState(null);
  const messagesEndRef = useRef(null);

  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);

  // Image input state
  const [selectedImage, setSelectedImage] = useState(null);
  const fileInputRef = useRef(null);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        setInput(transcript);
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
      };

      recognitionInstance.onerror = () => {
        setIsListening(false);
      };

      setRecognition(recognitionInstance);
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!recognition) {
      toast.error('Voice input not supported');
      return;
    }
    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
      setIsListening(true);
      toast.info('Listening...');
    }
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage({
          file,
          preview: reader.result,
          base64: reader.result.split(',')[1]
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setMessages([]);
    setSuggestions([]);
    setSpecialResult(null);
    setSelectedImage(null);
    const agent = AGENTS.find(a => a.id === activeAgent);
    if (agent) {
      setMessages([{
        role: "assistant",
        content: getWelcomeMessage(activeAgent),
        agent: activeAgent
      }]);
    }
  }, [activeAgent]);

  const getWelcomeMessage = (agentType) => {
    switch (agentType) {
      case "coding":
        return "Hello! I'm your **Coding Mentor**. I can help you with:\n\n• Code analysis and debugging\n• Learning programming concepts\n• Best practices and architecture\n• Code reviews and optimization\n\nPaste your code or ask me anything!";
      case "health":
        return "Hello! I'm your **Health Education Agent**. I can help you understand:\n\n• Medical concepts and conditions\n• Treatment options and timelines\n• Anatomy and health topics\n• When to seek medical care\n\n⚠️ *Disclaimer: I provide educational information only. Always consult healthcare professionals for medical advice.*\n\nTry asking: **\"Explain diabetes\"** or **\"What causes high blood pressure?\"**";
      case "travel":
        return "Hello! I'm your **Travel Planning Agent**. I can help you with:\n\n• Complete trip itineraries 📅\n• Destination guides and history 🏛️\n• Hotel and restaurant recommendations 🏨\n• Local customs and travel tips ✨\n\nTry: **\"Plan a 5-day trip to Tokyo\"** or **\"Best time to visit Paris\"**";
      case "business":
        return "Hello! I'm your **Business Intelligence Agent**. I can help you with:\n\n• Company analysis and research 🔍\n• Competitor analysis 📊\n• Market intelligence reports 📈\n• Professional strategy dashboards 📋\n\n**Provide a company website URL** for detailed analysis!\n\nExample: **\"Analyze https://stripe.com\"**";
      default:
        return "Hello! How can I help you today?";
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setIsLoading(true);
    setSpecialResult(null);

    try {
      // Check for visual/diagram generation request
      const isVisualRequest = /diagram|visual|flowchart|chart|image|map|illustrat/i.test(currentInput);
      
      if (isVisualRequest) {
        // Generate visual
        const formData = new FormData();
        formData.append('agent_type', activeAgent);
        formData.append('topic', currentInput);
        formData.append('visual_type', currentInput.toLowerCase().includes('flowchart') ? 'flowchart' : 
                                        currentInput.toLowerCase().includes('chart') ? 'chart' :
                                        currentInput.toLowerCase().includes('map') ? 'map' : 'diagram');
        
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: "🎨 Generating visual diagram...",
          agent: activeAgent 
        }]);
        
        const visualResponse = await fetch(`${BACKEND_URL}/api/agent/generate-visual`, {
          method: "POST",
          body: formData
        });
        
        if (visualResponse.ok) {
          const visualData = await visualResponse.json();
          setSpecialResult({ type: "visual", data: visualData });
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              role: "assistant",
              content: `Here's your visual diagram for: **${visualData.topic}**`,
              agent: activeAgent
            };
            return newMessages;
          });
        } else {
          throw new Error("Visual generation failed");
        }
      }
      // Health agent - detect explain requests OR medical topics
      else if (activeAgent === "health" && (
        currentInput.toLowerCase().startsWith("explain ") ||
        /diabetes|blood pressure|heart|health|symptom|disease|condition|treatment|medicine|pain|fever|cough|cold|flu|cancer|infection/i.test(currentInput)
      )) {
        const topic = currentInput.toLowerCase().startsWith("explain ") 
          ? currentInput.substring(8) 
          : currentInput;
        await handleHealthExplain(topic);
      }
      // Travel agent - detect trip planning requests
      else if (activeAgent === "travel" && (
        (currentInput.toLowerCase().includes("plan") && (currentInput.toLowerCase().includes("trip") || currentInput.toLowerCase().includes("travel"))) ||
        /trip to|visit|itinerary|travel|vacation|holiday/i.test(currentInput)
      )) {
        await handleTravelPlan(currentInput);
      }
      // Business agent - detect company analysis requests
      else if (activeAgent === "business" && (
        currentInput.includes("http") || 
        currentInput.includes("www") ||
        /analyze|research|company|business|competitor/i.test(currentInput)
      )) {
        await handleBusinessAnalysis(currentInput);
      }
      // Regular chat for all other cases
      else {
        const response = await fetch(`${BACKEND_URL}/api/agent/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_type: activeAgent,
            message: currentInput,
            conversation_history: messages.map(m => ({ role: m.role, content: m.content }))
          })
        });

        if (!response.ok) throw new Error("Failed to get response");

        const data = await response.json();
        setMessages(prev => [...prev, { role: "assistant", content: data.response, agent: activeAgent }]);
        if (data.suggestions) setSuggestions(data.suggestions);
      }
    } catch (error) {
      toast.error("Failed to get response");
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again.", agent: activeAgent }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHealthExplain = async (topic) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/agent/health/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, detail_level: "intermediate" })
      });
      
      if (!response.ok) throw new Error("Failed to get explanation");
      
      const data = await response.json();
      setSpecialResult({ type: "health", data });
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: `Here's what you need to know about **${data.title || topic}**:`,
        agent: activeAgent 
      }]);
    } catch (error) {
      throw error;
    }
  };

  const handleTravelPlan = async (message) => {
    try {
      // Check if asking for flight prices
      const flightPriceQuery = /(?:flight|flights?|plane|airfare|air\s*fare).*(?:price|cost|how much)/i.test(message) ||
                               /how much.*(?:flight|fly)/i.test(message);
      
      if (flightPriceQuery) {
        // Extract origin and destination
        const fromMatch = message.match(/from\s+([A-Za-z\s]+?)(?:\s+to|\s+and|,|$)/i);
        const toMatch = message.match(/to\s+([A-Za-z\s,]+?)(?:\s+from|\s+on|$)/i);
        
        const origin = fromMatch ? fromMatch[1].trim() : "New York";
        const destination = toMatch ? toMatch[1].trim() : "London";
        
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: `✈️ Searching for flight prices from **${origin}** to **${destination}**...`,
          agent: activeAgent 
        }]);
        
        const response = await fetch(`${BACKEND_URL}/api/agent/travel/search-flights`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            origin, 
            destination
          })
        });
        
        if (!response.ok) throw new Error("Flight search failed");
        
        const data = await response.json();
        
        const flightInfo = `## ✈️ Flight Price Information\n\n` +
          `**Route:** ${data.route}\n\n` +
          `**💰 Indicative Price Range:** ${data.price_range}\n\n` +
          `**⏱️ Typical Duration:** ${data.typical_duration || 'Varies by route'}\n\n` +
          `**🛫 Airlines:** ${(data.airlines || []).join(', ') || 'Multiple carriers available'}\n\n` +
          `**📅 Best Time to Book:** ${data.best_time_to_book || '2-3 months in advance'}\n\n` +
          `### 💡 Tips\n` +
          (data.tips || []).map(tip => `• ${tip}`).join('\n') + '\n\n' +
          `**⚠️ Important:** ${data.disclaimer}\n\n` +
          `**Sources:** ${(data.sources || ['Real-time web search']).join(', ')}`;
        
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: flightInfo,
          agent: activeAgent 
        }]);
        
        return;
      }
      
      // Regular trip planning
      // Extract destination from message
      const destinationMatch = message.match(/(?:to|in|for)\s+([A-Za-z\s,]+?)(?:\s+for|\s+in|\.|$)/i);
      const destination = destinationMatch ? destinationMatch[1].trim() : "popular destination";
      
      // Extract duration
      const durationMatch = message.match(/(\d+)[\s-]?day/i);
      const duration = durationMatch ? parseInt(durationMatch[1]) : 5;
      
      const response = await fetch(`${BACKEND_URL}/api/agent/travel/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          destination, 
          duration_days: duration,
          interests: [],
          budget_level: "moderate"
        })
      });
      
      if (!response.ok) throw new Error("Failed to create plan");
      
      const data = await response.json();
      setSpecialResult({ type: "travel", data });
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: `Here's your **${data.duration || duration}-day trip plan** for **${data.destination || destination}**! 🎉`,
        agent: activeAgent 
      }]);
    } catch (error) {
      throw error;
    }
  };

  const handleBusinessAnalysis = async (message) => {
    try {
      // Extract URL from message, or use company name
      const urlMatch = message.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/i);
      let url = urlMatch ? urlMatch[1] : "";
      
      // If no URL, try to extract company name
      if (!url) {
        const companyMatch = message.match(/(?:analyze|research)\s+(.+?)(?:\s*company)?$/i);
        if (companyMatch) {
          const companyName = companyMatch[1].trim();
          url = `https://${companyName.toLowerCase().replace(/\s+/g, '')}.com`;
        }
      }
      
      if (!url) {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: "Please provide a company name or URL to analyze (e.g., 'Analyze Stripe' or 'https://stripe.com')",
          agent: activeAgent 
        }]);
        return;
      }
      
      // Check if deep research mode is enabled
      if (deepResearchMode) {
        // Multi-stage deep research
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: `🔬 **Deep Research Mode Activated**\n\nAnalyzing **${url}** comprehensively...`,
          agent: activeAgent 
        }]);
        
        setResearchProgress({ stage: 0, total: 5 });
        
        const response = await fetch(`${BACKEND_URL}/api/agent/business/deep-research`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            company_url: url,
            depth: "comprehensive"
          })
        });
        
        if (!response.ok) throw new Error("Deep research failed");
        
        const data = await response.json();
        
        // Show research stages
        for (let i = 0; i < data.stages.length; i++) {
          setResearchProgress({ stage: i, total: data.stages.length, message: data.stages[i].message });
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        setResearchProgress(null);
        setSpecialResult({ type: "business_deep", data });
        
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: `✅ **Deep Research Complete!**\n\n**${data.company_name}** - Comprehensive analysis ready!\n\n📊 Generated 8-sheet detailed report\n📈 Analyzed competitors, products, pricing, and strategy\n📄 Professional HTML dashboard available\n\nView the detailed analysis below or download reports.`,
          agent: activeAgent 
        }]);
      } else {
        // Standard analysis
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: `🔍 Analyzing **${url}**... This may take a moment as I research the company.`,
          agent: activeAgent 
        }]);
        
        const response = await fetch(`${BACKEND_URL}/api/agent/business/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company_url: url, analysis_type: "full" })
        });
        
        if (!response.ok) throw new Error("Failed to analyze company");
        
        const data = await response.json();
        setSpecialResult({ type: "business", data });
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: `Analysis complete for **${data.company_name || url}**! 📊\n\nI've generated a comprehensive 8-sheet report. You can view each section below or download the full HTML dashboard.`,
          agent: activeAgent 
        }]);
      }
    } catch (error) {
      throw error;
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const downloadReport = async () => {
    if (!specialResult?.data) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/agent/html-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          company_name: specialResult.data.company_name,
          sheets: specialResult.data.sheets
        })
      });
      
      if (!response.ok) throw new Error("Failed to generate report");
      
      const data = await response.json();
      
      // Create download
      const blob = new Blob([data.html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${specialResult.data.company_name}_report.html`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success("Report downloaded!");
    } catch (error) {
      toast.error("Failed to download report");
    }
  };

  const agent = AGENTS.find(a => a.id === activeAgent);
  const AgentIcon = agent?.icon || Code;

  return (
    <div className="h-[calc(100vh-120px)] flex gap-4" data-testid="agents-view">
      {/* Left Sidebar - Agent Selection */}
      <div className="w-64 shrink-0 flex flex-col gap-2">
        <h2 className="text-lg font-semibold mb-2 px-2">AI Agents</h2>
        {AGENTS.map((a) => {
          const Icon = a.icon;
          const isActive = activeAgent === a.id;
          return (
            <button
              key={a.id}
              data-testid={`agent-${a.id}-btn`}
              onClick={() => setActiveAgent(a.id)}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                isActive 
                  ? 'bg-white/10 border border-white/20' 
                  : 'hover:bg-white/5 border border-transparent'
              }`}
            >
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${a.color}20` }}
              >
                <Icon className="w-5 h-5" style={{ color: a.color }} />
              </div>
              <div>
                <div className="font-medium text-sm">{a.name}</div>
                <div className="text-xs text-white/50">{a.description}</div>
              </div>
            </button>
          );
        })}

        {/* Quick Actions */}
        <div className="mt-auto p-3 glass-light rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-[#FBBC04]" />
            <span className="text-sm font-medium">Quick Actions</span>
          </div>
          {activeAgent === "health" && (
            <>
              <QuickAction icon={Heart} text="Explain diabetes" onClick={() => setInput("Explain diabetes in simple terms")} />
              <QuickAction icon={Activity} text="Blood pressure info" onClick={() => setInput("What causes high blood pressure?")} />
            </>
          )}
          {activeAgent === "travel" && (
            <>
              <QuickAction icon={MapPin} text="Plan Tokyo trip" onClick={() => setInput("Plan a 5-day trip to Tokyo, Japan")} />
              <QuickAction icon={Map} text="Paris itinerary" onClick={() => setInput("Create a 3-day Paris itinerary")} />
            </>
          )}
          {activeAgent === "business" && (
            <>
              <QuickAction icon={Building} text="Analyze Stripe" onClick={() => setInput("Analyze https://stripe.com")} />
              <QuickAction icon={Users} text="Competitor analysis" onClick={() => setInput("Do a competitor analysis for Netflix")} />
            </>
          )}
          {activeAgent === "coding" && (
            <>
              <QuickAction icon={Code} text="Review code" onClick={() => setInput("Review this Python code:\n\ndef hello():\n    print('hello')")} />
              <QuickAction icon={FileText} text="Explain concept" onClick={() => setInput("Explain async/await in JavaScript")} />
            </>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col glass-heavy rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${agent?.color}20` }}
          >
            <AgentIcon className="w-5 h-5" style={{ color: agent?.color }} />
          </div>
          <div>
            <h3 className="font-semibold">{agent?.name}</h3>
            <p className="text-xs text-white/50">{agent?.description}</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} agentColor={agent?.color} />
          ))}
          
          {/* Special Result Cards */}
          {specialResult && (
            <SpecialResultCard 
              result={specialResult} 
              onDownload={downloadReport}
            />
          )}
          
          {isLoading && (
            <div className="flex items-center gap-2 text-white/50">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="px-4 pb-2 flex gap-2 flex-wrap">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSuggestionClick(s)}
                className="px-3 py-1 text-xs rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-white/10 bg-black/20">
          {/* Deep Research Toggle for Business Intel */}
          {activeAgent === "business" && (
            <div className="mb-3 flex items-center justify-between p-3 bg-[#FBBC04]/10 border border-[#FBBC04]/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#FBBC04]" />
                <span className="text-sm font-medium">Deep Research Mode</span>
                <span className="text-xs text-white/50">(Multi-agent comprehensive analysis)</span>
              </div>
              <button
                onClick={() => setDeepResearchMode(!deepResearchMode)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  deepResearchMode ? 'bg-[#FBBC04]' : 'bg-white/20'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  deepResearchMode ? 'left-7' : 'left-1'
                }`} />
              </button>
            </div>
          )}
          
          {/* Research Progress */}
          {researchProgress && (
            <div className="mb-3 p-3 bg-[#667eea]/10 border border-[#667eea]/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="w-4 h-4 text-[#667eea] animate-spin" />
                <span className="text-sm font-medium">{researchProgress.message || "Researching..."}</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div 
                  className="bg-[#667eea] h-2 rounded-full transition-all duration-500"
                  style={{ width: `${((researchProgress.stage + 1) / researchProgress.total) * 100}%` }}
                />
              </div>
              <div className="text-xs text-white/50 mt-1">
                Stage {researchProgress.stage + 1} of {researchProgress.total}
              </div>
            </div>
          )}
          
          {/* Selected Image Preview */}
          {selectedImage && (
            <div className="mb-3">
              <div className="relative inline-block">
                <img 
                  src={selectedImage.preview} 
                  alt="Upload preview" 
                  className="h-16 rounded-lg border border-white/20"
                />
                <button 
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            {/* Voice input button */}
            <Button
              onClick={toggleVoiceInput}
              variant="outline"
              size="icon"
              className={`border-white/20 shrink-0 ${isListening ? 'bg-red-500/20 border-red-500' : ''}`}
              data-testid="voice-input-btn"
            >
              {isListening ? <MicOff className="w-4 h-4 text-red-500" /> : <Mic className="w-4 h-4" />}
            </Button>

            {/* Image upload button */}
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="icon"
              className="border-white/20 shrink-0"
              data-testid="image-upload-btn"
            >
              <Image className="w-4 h-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "Listening..." : `Ask ${agent?.name}...`}
              className="flex-1 min-h-[60px] max-h-[150px] bg-white/5 border-white/10"
              data-testid="agent-input"
            />
            <Button
              onClick={sendMessage}
              disabled={isLoading || (!input.trim() && !selectedImage)}
              className="px-4"
              style={{ backgroundColor: agent?.color }}
              data-testid="agent-send-btn"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Message Bubble Component with Enhanced Formatting
const MessageBubble = ({ message, agentColor }) => {
  const isUser = message.role === "user";
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div 
        className={`max-w-[85%] p-6 rounded-2xl ${
          isUser 
            ? 'bg-[#667eea] text-white' 
            : 'glass-light border border-white/10'
        }`}
      >
        <div className="prose prose-invert prose-sm max-w-none agent-response">
          <ReactMarkdown
            components={{
              // Headings with icons and spacing
              h1: ({ children }) => (
                <h1 className="text-3xl font-bold mb-6 mt-8 pb-3 border-b border-white/20 flex items-center gap-3">
                  <span className="text-[#667eea]">📘</span>
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-2xl font-bold mb-4 mt-8 text-[#667eea] flex items-center gap-2">
                  <span>▸</span>
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-xl font-semibold mb-3 mt-6 text-white/90 flex items-center gap-2">
                  <span className="text-[#34A853]">●</span>
                  {children}
                </h3>
              ),
              // Paragraphs with spacing
              p: ({ children }) => (
                <p className="text-white/80 leading-relaxed mb-4 text-base">{children}</p>
              ),
              // Enhanced lists
              ul: ({ children }) => (
                <ul className="space-y-3 my-6 pl-6">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="space-y-3 my-6 pl-6">{children}</ol>
              ),
              li: ({ children }) => (
                <li className="text-white/80 leading-relaxed pl-2">
                  <span className="inline-block w-2 h-2 bg-[#667eea] rounded-full mr-3 -ml-6"></span>
                  {children}
                </li>
              ),
              // Code blocks with better styling
              code: ({ inline, children, className }) => {
                if (inline) {
                  return (
                    <code className="px-2 py-1 bg-[#667eea]/20 text-[#667eea] rounded font-mono text-sm border border-[#667eea]/30">
                      {children}
                    </code>
                  );
                }
                return (
                  <div className="my-6">
                    <pre className="bg-black/40 rounded-xl p-6 overflow-x-auto border border-white/10">
                      <code className="text-sm font-mono text-green-400 leading-relaxed">
                        {children}
                      </code>
                    </pre>
                  </div>
                );
              },
              // Tables with proper styling
              table: ({ children }) => (
                <div className="my-6 overflow-x-auto">
                  <table className="w-full border-collapse bg-black/20 rounded-lg overflow-hidden">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-[#667eea]/20">{children}</thead>
              ),
              th: ({ children }) => (
                <th className="px-4 py-3 text-left font-semibold text-white border-b border-white/10">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-4 py-3 text-white/80 border-b border-white/5">
                  {children}
                </td>
              ),
              // Blockquotes as info boxes
              blockquote: ({ children }) => (
                <div className="my-6 p-4 bg-[#667eea]/10 border-l-4 border-[#667eea] rounded-r-lg">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 text-[#FBBC04] flex-shrink-0 mt-1" />
                    <div className="text-white/90">{children}</div>
                  </div>
                </div>
              ),
              // Strong text
              strong: ({ children }) => (
                <strong className="font-bold text-white">{children}</strong>
              ),
              // Emphasis
              em: ({ children }) => (
                <em className="italic text-[#667eea]">{children}</em>
              ),
              // Horizontal rules as section dividers
              hr: () => (
                <hr className="my-8 border-t-2 border-white/10" />
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

// Special Result Card Component
const SpecialResultCard = ({ result, onDownload }) => {
  const [expandedSheet, setExpandedSheet] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showHtmlReport, setShowHtmlReport] = useState(false);
  
  if (result.type === "health") {
    const { data } = result;
    return (
      <div className="glass-light rounded-2xl p-6 border border-[#EA4335]/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#EA4335]/20 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-[#EA4335]" />
          </div>
          <h3 className="font-bold text-lg">{data.title}</h3>
        </div>
        
        <p className="text-white/80 mb-4">{data.explanation}</p>
        
        {data.key_points && data.key_points.length > 0 && (
          <div className="mb-4">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Star className="w-4 h-4 text-[#FBBC04]" />
              Key Points
            </h4>
            <ul className="space-y-1">
              {data.key_points.map((point, i) => (
                <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                  <span className="text-[#34A853]">•</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {data.when_to_see_doctor && (
          <div className="p-3 bg-[#EA4335]/10 border border-[#EA4335]/30 rounded-xl">
            <div className="flex items-center gap-2 text-[#EA4335] font-medium text-sm mb-1">
              <Activity className="w-4 h-4" />
              When to See a Doctor
            </div>
            <p className="text-xs text-white/60">{data.when_to_see_doctor}</p>
          </div>
        )}
        
        {data.disclaimer && (
          <p className="text-xs text-white/40 mt-4 italic">⚠️ {data.disclaimer}</p>
        )}
      </div>
    );
  }
  
  if (result.type === "travel") {
    const { data } = result;
    return (
      <div className="glass-light rounded-2xl p-6 border border-[#34A853]/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#34A853]/20 flex items-center justify-center">
              <Plane className="w-5 h-5 text-[#34A853]" />
            </div>
            <div>
              <h3 className="font-bold text-lg">{data.destination}</h3>
              <p className="text-xs text-white/50">{data.duration} days • {data.budget_level || "Moderate"} budget</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-[#FBBC04]">{data.estimated_budget}</div>
            <div className="text-xs text-white/50">{data.best_time_to_visit}</div>
          </div>
        </div>
        
        <p className="text-white/80 mb-4">{data.overview}</p>
        
        {/* Itinerary */}
        {data.itinerary && data.itinerary.length > 0 && (
          <div className="space-y-3 mb-4">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#4285F4]" />
              Day-by-Day Itinerary
            </h4>
            {data.itinerary.map((day, i) => (
              <div key={i} className="p-3 bg-white/5 rounded-xl">
                <div className="font-medium text-sm mb-2">
                  Day {day.day}: {day.title}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-white/60">
                  <div><span className="text-[#FBBC04]">Morning:</span> {day.morning}</div>
                  <div><span className="text-[#34A853]">Afternoon:</span> {day.afternoon}</div>
                  <div><span className="text-[#9333ea]">Evening:</span> {day.evening}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Must See */}
        {data.must_see && data.must_see.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {data.must_see.map((item, i) => (
              <span key={i} className="px-3 py-1 text-xs bg-[#34A853]/20 text-[#34A853] rounded-full">
                {item}
              </span>
            ))}
          </div>
        )}
        
        {/* Local Tips */}
        {data.local_tips && data.local_tips.length > 0 && (
          <div className="p-3 bg-[#FBBC04]/10 border border-[#FBBC04]/30 rounded-xl">
            <div className="flex items-center gap-2 text-[#FBBC04] font-medium text-sm mb-2">
              <Lightbulb className="w-4 h-4" />
              Local Tips
            </div>
            <ul className="space-y-1">
              {data.local_tips.slice(0, 3).map((tip, i) => (
                <li key={i} className="text-xs text-white/60">• {tip}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
  
  if (result.type === "visual") {
    const { data } = result;
    
    const downloadImage = () => {
      if (data.image_base64) {
        const link = document.createElement('a');
        link.href = `data:image/png;base64,${data.image_base64}`;
        link.download = `${data.topic.replace(/\s+/g, '_')}_diagram.png`;
        link.click();
      } else if (data.image_url) {
        window.open(data.image_url, '_blank');
      }
    };
    
    return (
      <div className="glass-light rounded-2xl p-6 border border-[#667eea]/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#667eea]/20 flex items-center justify-center">
              <Image className="w-5 h-5 text-[#667eea]" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Visual Diagram</h3>
              <p className="text-xs text-white/50">{data.visual_type} for {data.agent_type}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsZoomed(!isZoomed)} size="sm" variant="outline" className="gap-1">
              {isZoomed ? <span>🔍-</span> : <span>🔍+</span>}
              {isZoomed ? 'Zoom Out' : 'Zoom In'}
            </Button>
            <Button onClick={downloadImage} size="sm" className="bg-[#667eea] gap-1">
              <Download className="w-4 h-4" />
              Download
            </Button>
          </div>
        </div>
        
        {data.image_url ? (
          <div className={`rounded-xl overflow-hidden border border-white/10 transition-all ${isZoomed ? 'max-h-none' : 'max-h-96'}`}>
            <img 
              src={data.image_url} 
              alt={data.topic} 
              className={`w-full object-contain cursor-pointer ${isZoomed ? '' : 'max-h-96'}`}
              onClick={() => setIsZoomed(!isZoomed)}
            />
          </div>
        ) : data.image_base64 ? (
          <div className={`rounded-xl overflow-hidden border border-white/10 transition-all ${isZoomed ? 'max-h-none' : 'max-h-96'}`}>
            <img 
              src={`data:image/png;base64,${data.image_base64}`} 
              alt={data.topic} 
              className={`w-full object-contain cursor-pointer ${isZoomed ? '' : 'max-h-96'}`}
              onClick={() => setIsZoomed(!isZoomed)}
            />
          </div>
        ) : (
          <div className="p-8 text-center text-white/50">
            <Image className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Visual generation in progress...</p>
          </div>
        )}
        
        <p className="text-sm text-white/60 mt-4">{data.topic}</p>
        {data.text_response && <p className="text-xs text-white/40 mt-2">{data.text_response}</p>}
      </div>
    );
  }
  
  if (result.type === "business" || result.type === "business_deep") {
    const { data } = result;
    const sheets = data.sheets || {};
    const isDeepResearch = result.type === "business_deep";
    
    // Function to open HTML report in new window
    const openHtmlReportViewer = () => {
      if (data.html_report) {
        const newWindow = window.open('', '_blank', 'width=1200,height=800');
        if (newWindow) {
          newWindow.document.write(data.html_report);
          newWindow.document.close();
        }
      }
    };
    
    // Function to download Excel data as CSV
    const downloadExcelData = () => {
      if (!sheets || Object.keys(sheets).length === 0) {
        toast.error("No data to download");
        return;
      }
      
      let csvContent = "";
      Object.entries(sheets).forEach(([sheetName, rows]) => {
        csvContent += `\n=== ${sheetName} ===\n`;
        if (Array.isArray(rows) && rows.length > 0) {
          // Add headers
          csvContent += Object.keys(rows[0]).join(",") + "\n";
          // Add data rows
          rows.forEach(row => {
            csvContent += Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(",") + "\n";
          });
        }
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.company_name || 'report'}_data.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel data downloaded!");
    };
    
    return (
      <div className="glass-light rounded-2xl p-6 border border-[#FBBC04]/30">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FBBC04] to-[#EA4335] flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-xl">{data.company_name}</h3>
              <p className="text-sm text-white/60">
                {isDeepResearch ? "🔬 Deep Research Report - Multi-Page Analysis" : "Business Intelligence Report"}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            {data.html_report && (
              <>
                <Button 
                  onClick={openHtmlReportViewer}
                  size="sm" 
                  className="bg-[#667eea] text-white hover:bg-[#667eea]/80 gap-2"
                >
                  <Globe className="w-4 h-4" />
                  View Report
                </Button>
                <Button 
                  onClick={() => {
                    const blob = new Blob([data.html_report], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${data.company_name || 'report'}_report.html`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("HTML Report downloaded!");
                  }}
                  size="sm" 
                  variant="outline"
                  className="border-[#FBBC04] text-[#FBBC04] hover:bg-[#FBBC04]/10 gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Download HTML
                </Button>
              </>
            )}
            <Button 
              onClick={downloadExcelData} 
              size="sm" 
              variant="outline"
              className="border-[#34A853] text-[#34A853] hover:bg-[#34A853]/10 gap-2"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </Button>
          </div>
        </div>
        
        {/* Deep Research Badge */}
        {isDeepResearch && (
          <div className="mb-4 p-3 bg-gradient-to-r from-[#667eea]/10 to-[#764ba2]/10 border border-[#667eea]/30 rounded-xl">
            <div className="flex items-center gap-2 text-sm">
              <Zap className="w-4 h-4 text-[#667eea]" />
              <span className="font-semibold">Multi-Agent Deep Research Complete</span>
              <span className="ml-auto text-xs text-white/50">
                {Object.keys(sheets).length} comprehensive sheets generated
              </span>
            </div>
          </div>
        )}
        
        {/* Inline HTML Report Preview */}
        {data.html_report && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-white/70 flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#667eea]" />
                Report Preview
              </h4>
              <Button
                onClick={() => setShowHtmlReport(!showHtmlReport)}
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                {showHtmlReport ? "Hide Preview" : "Show Preview"}
              </Button>
            </div>
            {showHtmlReport && (
              <div className="border border-white/10 rounded-xl overflow-hidden bg-white">
                <iframe
                  srcDoc={data.html_report}
                  className="w-full h-[400px] border-0"
                  title="Business Report Preview"
                  sandbox="allow-same-origin"
                />
              </div>
            )}
          </div>
        )}
        
        {/* Report Sheets - Expandable */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-white/70 mb-2">📊 Data Sheets</h4>
          {Object.keys(sheets).length === 0 ? (
            <div className="text-center py-8 text-white/40">
              No sheet data available
            </div>
          ) : (
            Object.entries(sheets).map(([sheetName, rows]) => (
              <div key={sheetName} className="border border-white/10 rounded-xl overflow-hidden bg-black/20">
                <button
                  onClick={() => setExpandedSheet(expandedSheet === sheetName ? null : sheetName)}
                  className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#FBBC04]/20 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-[#FBBC04]" />
                    </div>
                    <div className="text-left">
                      <span className="font-semibold text-sm block">
                        {sheetName.replace(/_/g, " ").replace(/^\d+_/, "")}
                      </span>
                      <span className="text-xs text-white/40">
                        {Array.isArray(rows) ? rows.length : 0} rows
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 transition-transform ${expandedSheet === sheetName ? "rotate-90" : ""}`} />
                </button>
                {expandedSheet === sheetName && rows && Array.isArray(rows) && rows.length > 0 && (
                  <div className="border-t border-white/10 bg-white/5">
                    <div className="p-4 max-h-80 overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-[#667eea]/20">
                          <tr className="border-b border-white/20">
                            {Object.keys(rows[0]).map(key => (
                              <th key={key} className="text-left p-3 text-white/80 font-semibold">
                                {key.replace(/_/g, " ").toUpperCase()}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) => (
                            <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                              {Object.values(row).map((val, j) => (
                                <td key={j} className="p-3 text-white/70">{String(val)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }
  
  return null;
};

// Quick Action Button Component
const QuickAction = ({ icon: Icon, text, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-2 p-2 text-xs text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
  >
    <Icon className="w-3 h-3" />
    {text}
    <ChevronRight className="w-3 h-3 ml-auto" />
  </button>
);

export default AgentsView;

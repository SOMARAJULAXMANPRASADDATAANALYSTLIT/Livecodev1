import React, { useState, useRef, useEffect } from "react";
import { 
  Code, Stethoscope, Plane, BarChart3, Send, Loader2, 
  Download, Lightbulb, ChevronRight, Building, MapPin,
  Heart, FileText, Globe
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
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setMessages([]);
    setSuggestions([]);
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
        return "Hello! I'm your Coding Mentor. I can help you with:\n\n• Code analysis and debugging\n• Learning programming concepts\n• Best practices and architecture\n• Code reviews and optimization\n\nPaste your code or ask me anything!";
      case "health":
        return "Hello! I'm your Health Education Agent. I can help you understand:\n\n• Medical concepts and conditions\n• Treatment options and timelines\n• Anatomy and health topics\n• When to seek medical care\n\n⚠️ *Disclaimer: I provide educational information only. Always consult healthcare professionals for medical advice.*\n\nWhat would you like to learn about?";
      case "travel":
        return "Hello! I'm your Travel Planning Agent. I can help you with:\n\n• Complete trip itineraries\n• Destination guides and history\n• Hotel and restaurant recommendations\n• Local customs and travel tips\n\nWhere would you like to go?";
      case "business":
        return "Hello! I'm your Business Intelligence Agent. I can help you with:\n\n• Company analysis and research\n• Competitor analysis\n• Market intelligence reports\n• Professional strategy dashboards\n\n📊 Provide a company website URL for detailed analysis, or ask me about any business topic!";
      default:
        return "Hello! How can I help you today?";
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_type: activeAgent,
          message: input,
          conversation_history: messages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.response, agent: activeAgent }]);
      if (data.suggestions) setSuggestions(data.suggestions);
    } catch (error) {
      toast.error("Failed to get response");
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again.", agent: activeAgent }]);
    } finally {
      setIsLoading(false);
    }
  };

  const useSuggestion = (suggestion) => {
    setInput(suggestion);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const agent = AGENTS.find(a => a.id === activeAgent);
  const AgentIcon = agent?.icon || Code;

  return (
    <div className="h-[calc(100vh-120px)] flex gap-4">
      <div className="w-64 shrink-0 flex flex-col gap-2">
        <h2 className="text-lg font-semibold mb-2 px-2">AI Agents</h2>
        {AGENTS.map((a) => {
          const Icon = a.icon;
          const isActive = activeAgent === a.id;
          return (
            <button
              key={a.id}
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

        <div className="mt-auto p-3 glass-light rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-[#FBBC04]" />
            <span className="text-sm font-medium">Quick Actions</span>
          </div>
          {activeAgent === "health" && (
            <QuickAction icon={Heart} text="Explain a condition" onClick={() => setInput("Explain diabetes in simple terms")} />
          )}
          {activeAgent === "travel" && (
            <QuickAction icon={MapPin} text="Plan a trip" onClick={() => setInput("Plan a 5-day trip to Tokyo, Japan")} />
          )}
          {activeAgent === "business" && (
            <QuickAction icon={Building} text="Analyze company" onClick={() => setInput("Analyze https://stripe.com")} />
          )}
          {activeAgent === "coding" && (
            <QuickAction icon={Code} text="Review code" onClick={() => setInput("Review this Python code:\n\ndef hello():\n    print('hello')")} />
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col glass-heavy rounded-2xl overflow-hidden">
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

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} agentColor={agent?.color} />
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-white/50">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {suggestions.length > 0 && (
          <div className="px-4 pb-2 flex gap-2 flex-wrap">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => useSuggestion(s)}
                className="px-3 py-1 text-xs rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="p-4 border-t border-white/10">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask ${agent?.name}...`}
              className="flex-1 min-h-[60px] max-h-[150px] bg-white/5 border-white/10"
            />
            <Button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="px-4"
              style={{ backgroundColor: agent?.color }}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MessageBubble = ({ message, agentColor }) => {
  const isUser = message.role === "user";
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`max-w-[80%] p-4 rounded-2xl ${
          isUser 
            ? 'bg-[#667eea] text-white' 
            : 'glass-light'
        }`}
      >
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

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

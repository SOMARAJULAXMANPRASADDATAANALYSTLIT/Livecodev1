import { useState, useRef, useEffect } from "react";
import { Send, Camera, Loader2, Sparkles, User, Bot, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import ImageUploadModal from "@/components/ImageUploadModal";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const EnglishChatView = () => {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! 👋 I'm your English learning assistant. You can:\n\n• **Ask questions** - \"How do I say...\" or \"What's the difference between...\"\n• **Practice writing** - Write a sentence and I'll help correct it\n• **Just chat** - Let's have a conversation to practice!\n• **🎤 Voice chat** - Click the mic button to talk with me!\n\nHow can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        setInput(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          toast.error("Microphone access denied. Please enable it in your browser settings.");
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error("Speech recognition not supported in your browser");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInput("");
      recognitionRef.current.start();
      setIsListening(true);
      toast.info("Listening... Speak now!");
    }
  };

  const speakText = (text) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Clean text for speech (remove markdown)
    const cleanText = text
      .replace(/[*_~`#]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n+/g, '. ');
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    // Stop listening if active
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/english-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) throw new Error("Chat failed");

      const data = await response.json();

      let aiResponse = data.response;
      
      // Add corrections if any
      if (data.corrections?.length > 0) {
        aiResponse += "\n\n---\n**Corrections:**\n";
        data.corrections.forEach((c) => {
          aiResponse += `\n• ~~${c.original}~~ → **${c.corrected}**\n  _${c.explanation}_`;
        });
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: aiResponse, intent: data.intent },
      ]);

      // Speak the response if voice is enabled
      if (voiceEnabled) {
        speakText(data.response);
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Failed to send message. Please try again.");
      setMessages((prev) => prev.slice(0, -1)); // Remove user message on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageAnalysis = (analysis) => {
    setMessages((prev) => [
      ...prev,
      { role: "user", content: "📷 [Uploaded an image for analysis]" },
      { role: "assistant", content: analysis },
    ]);
  };

  const getIntentBadge = (intent) => {
    const badges = {
      question: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Question" },
      practice: { bg: "bg-green-500/20", text: "text-green-400", label: "Practice" },
      conversation: { bg: "bg-purple-500/20", text: "text-purple-400", label: "Chat" },
    };
    const badge = badges[intent];
    if (!badge) return null;
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div data-testid="english-chat-view" className="h-full max-w-3xl mx-auto">
      <div className="glass-heavy rounded-2xl h-[calc(100vh-160px)] flex flex-col overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold">English Learning Assistant</h2>
              <p className="text-xs text-white/50">Practice, learn, and improve with voice!</p>
            </div>
          </div>
          
          {/* Voice Toggle */}
          <Button
            data-testid="voice-toggle-btn"
            onClick={() => {
              setVoiceEnabled(!voiceEnabled);
              if (isSpeaking) stopSpeaking();
            }}
            variant="ghost"
            size="sm"
            className={`gap-2 ${voiceEnabled ? 'text-[#667eea]' : 'text-white/50'}`}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="text-xs">{voiceEnabled ? 'Voice On' : 'Voice Off'}</span>
          </Button>
        </div>

        {/* Messages */}
        <div 
          data-testid="chat-messages-container"
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {messages.map((message, index) => (
            <div
              key={index}
              data-testid={`chat-message-${index}`}
              className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""} animate-slideUp`}
            >
              {/* Avatar */}
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                ${message.role === "user" ? "gradient-primary" : "bg-white/10"}
              `}>
                {message.role === "user" ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-[#667eea]" />
                )}
              </div>

              {/* Message Content */}
              <div className={`max-w-[80%] ${message.role === "user" ? "items-end" : "items-start"}`}>
                {message.intent && message.role === "assistant" && (
                  <div className="mb-1 flex items-center gap-2">
                    {getIntentBadge(message.intent)}
                    {voiceEnabled && message.role === "assistant" && (
                      <button
                        onClick={() => speakText(message.content)}
                        className="text-white/40 hover:text-white/70 transition-colors"
                        title="Listen to this message"
                      >
                        <Volume2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
                <div className={message.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"}>
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3 animate-slideUp">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-[#667eea]" />
              </div>
              <div className="chat-bubble-ai px-4 py-3">
                <div className="loading-dots flex gap-1">
                  <span className="w-2 h-2 bg-white/60 rounded-full"></span>
                  <span className="w-2 h-2 bg-white/60 rounded-full"></span>
                  <span className="w-2 h-2 bg-white/60 rounded-full"></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Speaking Indicator */}
        {isSpeaking && (
          <div className="px-4 py-2 bg-[#667eea]/10 border-t border-[#667eea]/20 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#667eea] text-sm">
              <Volume2 className="w-4 h-4 animate-pulse" />
              Speaking...
            </div>
            <Button
              onClick={stopSpeaking}
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-white/60"
            >
              Stop
            </Button>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-white/10">
          <form onSubmit={sendMessage} className="flex gap-2">
            <Button
              type="button"
              data-testid="image-upload-btn"
              onClick={() => setShowImageModal(true)}
              className="btn-secondary px-3"
              title="Upload Image"
            >
              <Camera className="w-5 h-5" />
            </Button>

            {/* Voice Input Button */}
            <Button
              type="button"
              data-testid="voice-input-btn"
              onClick={toggleListening}
              className={`px-3 transition-all ${
                isListening 
                  ? 'bg-[#EA4335] hover:bg-[#d33828] text-white animate-pulse' 
                  : 'btn-secondary'
              }`}
              title={isListening ? "Stop listening" : "Start voice input"}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>

            <div className="flex-1 chat-input-container">
              <Input
                data-testid="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? "Listening..." : "Type or speak your message..."}
                className={`bg-white/5 border-white/10 h-12 ${isListening ? 'border-[#EA4335]/50' : ''}`}
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              data-testid="send-message-btn"
              disabled={isLoading || !input.trim()}
              className="btn-primary px-4"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Send <Sparkles className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </form>
          
          {/* Voice hint */}
          <p className="text-xs text-white/30 mt-2 text-center">
            🎤 Click the mic to talk • 🔊 AI will speak responses when voice is on
          </p>
        </div>
      </div>

      {/* Image Upload Modal */}
      {showImageModal && (
        <ImageUploadModal
          onClose={() => setShowImageModal(false)}
          onAnalysis={handleImageAnalysis}
        />
      )}
    </div>
  );
};

export default EnglishChatView;

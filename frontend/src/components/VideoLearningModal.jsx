import React, { useState, useEffect, useRef } from "react";
import { X, Play, Pause, MessageSquare, Lightbulb, Send, Loader2, Volume2, VolumeX, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const VideoLearningModal = ({ videoUrl, videoTitle, onClose, skillLevel = "intermediate" }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Extract YouTube video ID
  const getVideoId = (url) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
  };

  const videoId = getVideoId(videoUrl);

  useEffect(() => {
    // Initial welcome message
    setMessages([{
      role: "assistant",
      content: `🎥 **${videoTitle}**\n\nI'm your AI learning companion! I'll help you understand this video.\n\n**I can:**\n- ✅ Explain concepts from the video\n- ✅ Answer questions about what you're watching\n- ✅ Provide additional context and examples\n- ✅ Help you understand difficult parts\n\n**Tips:**\n- Pause the video when you have questions\n- Ask me to explain specific topics\n- Request code examples or visual diagrams\n\nLet's start learning! 🚀`
    }]);

    // Fetch YouTube transcript (simulation - in production, use YouTube Transcript API)
    fetchTranscript(videoId);
  }, [videoId, videoTitle]);

  const fetchTranscript = async (videoId) => {
    // In production, you'd call YouTube Transcript API or your backend
    // For now, we'll simulate having transcript context
    setTranscript({
      videoId,
      title: videoTitle,
      available: true
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      const response = await fetch(`${BACKEND_URL}/api/learning/video-qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMessage,
          video_title: videoTitle,
          video_id: videoId,
          current_time: currentTime,
          skill_level: skillLevel,
          has_transcript: transcript?.available || false
        })
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.answer
      }]);
    } catch (error) {
      console.error("Video QA error:", error);
      toast.error("Failed to get answer. Please try again.");
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I apologize, but I couldn't process your question. Could you try rephrasing it?"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-7xl h-[90vh] bg-[#1a1a2e] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-[#667eea]/10 to-[#764ba2]/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#EA4335] to-[#FBBC04] flex items-center justify-center">
              <Play className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{videoTitle}</h2>
              <p className="text-xs text-white/50">AI-Powered Video Learning</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Video Player */}
          <div className="flex-1 flex flex-col bg-black/40 p-4">
            <div className="flex-1 rounded-xl overflow-hidden border border-white/20">
              {videoId ? (
                <iframe
                  ref={iframeRef}
                  className="w-full h-full"
                  src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&rel=0`}
                  title={videoTitle}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="flex items-center justify-center h-full text-white/50">
                  Invalid video URL
                </div>
              )}
            </div>
            
            {/* Video Info */}
            <div className="mt-4 p-3 bg-white/5 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-[#34A853]">
                    <Lightbulb className="w-4 h-4" />
                    <span>Ask questions anytime</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#667eea]">
                    <MessageSquare className="w-4 h-4" />
                    <span>AI is watching with you</span>
                  </div>
                </div>
                <a 
                  href={videoUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-white/50 hover:text-white transition-colors"
                >
                  Open in YouTube →
                </a>
              </div>
            </div>
          </div>

          {/* AI Chat Panel */}
          <div className="w-96 border-l border-white/10 flex flex-col bg-black/20">
            {/* Chat Header */}
            <div className="p-4 border-b border-white/10">
              <h3 className="font-semibold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#667eea]" />
                Ask About This Video
              </h3>
              <p className="text-xs text-white/50 mt-1">
                I'm analyzing the video content to help you learn
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-xl ${
                      msg.role === "user"
                        ? "bg-[#667eea] text-white"
                        : "bg-white/10 border border-white/10"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>,
                            strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                            code: ({ inline, children }) => 
                              inline ? (
                                <code className="px-1.5 py-0.5 bg-[#667eea]/20 text-[#667eea] rounded text-xs font-mono">
                                  {children}
                                </code>
                              ) : (
                                <code className="block p-2 bg-black/40 rounded text-xs font-mono overflow-x-auto">
                                  {children}
                                </code>
                              ),
                            ul: ({ children }) => <ul className="list-disc list-inside text-sm space-y-1 ml-2">{children}</ul>,
                            li: ({ children }) => <li className="text-white/80">{children}</li>,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/10 border border-white/10 p-3 rounded-xl">
                    <Loader2 className="w-4 h-4 animate-spin text-[#667eea]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-white/10 bg-black/20">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about the video..."
                  className="flex-1 min-h-[60px] max-h-[120px] bg-white/5 border-white/10 text-sm"
                  disabled={isLoading}
                />
                <Button
                  onClick={sendMessage}
                  disabled={isLoading || !input.trim()}
                  className="px-4 bg-[#667eea] hover:bg-[#667eea]/80"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <div className="mt-2 text-xs text-white/40">
                💡 Tip: Pause the video to ask detailed questions
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoLearningModal;

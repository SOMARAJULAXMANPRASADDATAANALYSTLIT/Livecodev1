import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  X, Play, Pause, MessageSquare, Lightbulb, Send, Loader2, Volume2, VolumeX, 
  Maximize2, Minimize2, Sparkles, CheckCircle, AlertCircle, HelpCircle, Zap,
  Eye, Brain, BookOpen, Target, Link2, Search, Upload, Image, Youtube
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const VideoLearningModal = ({ videoUrl, videoTitle, onClose, skillLevel = "intermediate", onUpdateVideoUrl }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState(null);
  const [transcriptSegments, setTranscriptSegments] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [lastPauseTime, setLastPauseTime] = useState(null);
  const [watchDuration, setWatchDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [aiWatching, setAiWatching] = useState(true);
  const [proactiveHelp, setProactiveHelp] = useState(null);
  const [showComprehensionCheck, setShowComprehensionCheck] = useState(false);
  const [comprehensionQuestion, setComprehensionQuestion] = useState(null);
  const [showAddUrl, setShowAddUrl] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [urlPreview, setUrlPreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [conversationContext, setConversationContext] = useState([]);
  const iframeRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);
  const watchStartTime = useRef(Date.now());

  // Extract YouTube video ID
  const getVideoId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
  };

  const videoId = getVideoId(videoUrl);

  useEffect(() => {
    // Different welcome message based on whether video is available
    const welcomeContent = videoId ? `# 🎥 ${videoTitle}

👁️ **AI Watching Mode: ACTIVE**

I'm your AI learning companion, and I'll be **watching this video alongside you!**

## 🚀 What I Can Do:

### Real-Time Assistance
- 👁️ **Watch with you** - I monitor video progress
- 💡 **Proactive hints** - I'll suggest pauses when concepts get complex
- 🎯 **Contextual help** - Ask about what's on screen right now
- ✅ **Comprehension checks** - Quick quizzes to test understanding
- 📸 **Screenshot analysis** - Drag & drop a screenshot for instant explanation

### How to Use Me:
- Just **pause and ask** whenever you're confused
- I'll track where you are in the video
- Click **"Help with this part"** for instant explanations
- I can **fetch the transcript** for better context

**Tips:**
- The more you interact, the better I can help!
- Don't hesitate to ask "basic" questions
- I adapt explanations to your skill level: **${skillLevel}**

Let's learn together! 🚀` : `# 📚 ${videoTitle}

I'm your AI learning companion for this topic!

## 🚀 What I Can Do:

### Topic Assistance
- 💬 **Answer questions** about ${videoTitle}
- 💡 **Explain concepts** at your level
- 🎯 **Provide examples** and practical applications
- ✅ **Test your understanding** with quizzes

### No Video Yet?
You can **add a YouTube video** to enhance your learning:
- Click the "Add URL" button below
- Paste any relevant YouTube tutorial link
- I'll then be able to use the video transcript for more context!

**Tips:**
- Ask me anything about ${videoTitle}
- I adapt explanations to your skill level: **${skillLevel}**
- Share screenshots for visual explanations

Let's learn together! 🚀`;

    setMessages([{
      role: "assistant",
      content: welcomeContent
    }]);

    // Fetch YouTube transcript only if video exists
    if (videoId) {
      fetchTranscript(videoId);
    }
  }, [videoId, videoTitle, skillLevel]);

  const fetchTranscript = async (videoId) => {
    if (!videoId) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/learning/video/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_id: videoId,
          language: "en"
        })
      });

      const data = await response.json();
      
      if (data.success && data.available) {
        setTranscript(data.full_text);
        setTranscriptSegments(data.transcript);
        
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `✅ **Transcript loaded!** (${data.total_segments} segments)\n\nI can now provide precise, context-aware help based on what's being said in the video.`
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `⚠️ **Transcript not available** for this video.\n\nI can still help, but my answers will be more general without the exact video content.`
        }]);
      }
    } catch (error) {
      console.error("Transcript fetch error:", error);
    }
  };

  // Fetch YouTube video preview
  const fetchUrlPreview = async (url) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    const extractedVideoId = match ? match[1] : null;
    
    if (!extractedVideoId) {
      setUrlPreview(null);
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/learning/youtube/preview/${extractedVideoId}`);
      const data = await response.json();
      if (data.success) {
        setUrlPreview(data);
      }
    } catch (error) {
      console.error("Preview fetch error:", error);
    }
  };

  // Debounce URL preview
  useEffect(() => {
    if (!newVideoUrl) {
      setUrlPreview(null);
      return;
    }
    const timer = setTimeout(() => fetchUrlPreview(newVideoUrl), 500);
    return () => clearTimeout(timer);
  }, [newVideoUrl]);

  // Handle replacing video URL
  const handleReplaceVideo = () => {
    if (!urlPreview || !onUpdateVideoUrl) return;
    
    onUpdateVideoUrl({
      url: `https://www.youtube.com/watch?v=${urlPreview.video_id}`,
      title: urlPreview.title,
      video_id: urlPreview.video_id
    });
    
    setShowAddUrl(false);
    setNewVideoUrl("");
    setUrlPreview(null);
    toast.success("Video updated! Refreshing...");
    
    // Reload the page to load new video
    window.location.reload();
  };

  // Handle image drop for screenshot analysis
  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      toast.error("Please drop an image file");
      return;
    }
    
    await processImage(file);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  // Process uploaded/dropped image
  const processImage = async (file) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const base64 = e.target.result;
      setUploadedImage({
        preview: base64,
        file: file
      });
      
      // Add user message with image
      setMessages(prev => [...prev, {
        role: "user",
        content: "📸 [Screenshot uploaded]",
        image: base64
      }]);
      
      // Send to AI for analysis
      setIsLoading(true);
      
      try {
        const response = await fetch(`${BACKEND_URL}/api/learning/video/analyze-screenshot`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_base64: base64.split(',')[1], // Remove data:image/... prefix
            video_title: videoTitle,
            current_time: currentTime,
            skill_level: skillLevel,
            transcript_context: transcriptSegments
              .filter(seg => seg.start <= currentTime && seg.start >= currentTime - 60)
              .map(seg => seg.text)
              .join(' '),
            conversation_history: conversationContext.slice(-5)
          })
        });
        
        const data = await response.json();
        
        setMessages(prev => [...prev, {
          role: "assistant",
          content: data.analysis || "I analyzed the screenshot. What would you like to know about it?"
        }]);
        
        // Update conversation context
        setConversationContext(prev => [...prev, {
          type: "screenshot_analysis",
          timestamp: currentTime,
          summary: data.analysis?.slice(0, 200)
        }]);
        
      } catch (error) {
        console.error("Screenshot analysis error:", error);
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "I can see you've shared a screenshot. Could you tell me what you'd like to understand about what's shown on screen?"
        }]);
      } finally {
        setIsLoading(false);
        setUploadedImage(null);
      }
    };
    
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  // Track video progress and provide proactive help
  const checkForProactiveHelp = useCallback(async () => {
    if (!aiWatching || isLoading || !videoId) return;
    
    // Find current transcript segment
    const currentSegment = transcriptSegments.find(seg => 
      currentTime >= seg.start && currentTime <= seg.start + seg.duration
    );
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/learning/video/proactive-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_id: videoId,
          video_title: videoTitle,
          current_time: currentTime,
          last_pause_time: lastPauseTime,
          watch_duration: (Date.now() - watchStartTime.current) / 1000,
          skill_level: skillLevel,
          transcript_context: currentSegment?.text || null
        })
      });

      const data = await response.json();
      
      if (data.should_intervene && data.severity !== "low") {
        setProactiveHelp({
          message: data.proactive_message,
          reason: data.reason,
          severity: data.severity
        });
        
        // Auto-dismiss low severity after 10 seconds
        if (data.severity === "medium") {
          setTimeout(() => setProactiveHelp(null), 10000);
        }
      }
    } catch (error) {
      console.error("Proactive analysis error:", error);
    }
  }, [currentTime, videoId, videoTitle, skillLevel, lastPauseTime, aiWatching, isLoading, transcriptSegments]);

  // Proactive help check every 10 seconds
  useEffect(() => {
    if (!aiWatching) return;
    
    const interval = setInterval(() => {
      checkForProactiveHelp();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [checkForProactiveHelp, aiWatching]);

  // Update current time (simulate video player tracking)
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentTime(prev => prev + 1);
      setWatchDuration(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isPlaying]);

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
          has_transcript: transcript !== null
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

  const getContextualHelp = async (helpType = "explain") => {
    setIsLoading(true);
    
    // Find current transcript segment
    const currentSegment = transcriptSegments.find(seg => 
      currentTime >= seg.start && currentTime <= seg.start + seg.duration
    );
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/learning/video/contextual-help`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_id: videoId,
          video_title: videoTitle,
          current_time: currentTime,
          transcript_segment: currentSegment?.text || null,
          skill_level: skillLevel,
          help_type: helpType
        })
      });

      if (!response.ok) throw new Error("Failed to get help");

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.help,
        timestamp: currentTime
      }]);
      
      toast.success("AI guidance provided!");
    } catch (error) {
      console.error("Contextual help error:", error);
      toast.error("Failed to get contextual help");
    } finally {
      setIsLoading(false);
    }
  };

  const generateComprehensionCheck = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/learning/video/comprehension-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_id: videoId,
          video_title: videoTitle,
          topic_covered: videoTitle,
          skill_level: skillLevel
        })
      });

      if (!response.ok) throw new Error("Failed to generate question");

      const data = await response.json();
      setComprehensionQuestion(data);
      setShowComprehensionCheck(true);
      toast.success("Comprehension check ready!");
    } catch (error) {
      console.error("Comprehension check error:", error);
      toast.error("Failed to generate question");
    }
  };

  const handleComprehensionAnswer = (selected) => {
    if (!comprehensionQuestion) return;
    
    const isCorrect = selected === comprehensionQuestion.correct_answer;
    
    setMessages(prev => [...prev, {
      role: "assistant",
      content: `## ${isCorrect ? "✅ Correct!" : "❌ Not quite"}\n\n**Your answer:** ${selected}\n**Correct answer:** ${comprehensionQuestion.correct_answer}\n\n**Explanation:** ${comprehensionQuestion.explanation}`
    }]);
    
    setShowComprehensionCheck(false);
    setComprehensionQuestion(null);
    
    if (isCorrect) {
      toast.success("Great job! You understand this concept!");
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
              <div className="flex items-center gap-3 text-xs text-white/50">
                <span>AI-Powered Video Learning</span>
                {aiWatching && (
                  <div className="flex items-center gap-1 text-[#34A853]">
                    <Eye className="w-3 h-3 animate-pulse" />
                    <span>AI Watching</span>
                  </div>
                )}
                {transcript && (
                  <div className="flex items-center gap-1 text-[#667eea]">
                    <CheckCircle className="w-3 h-3" />
                    <span>Transcript Loaded</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAiWatching(!aiWatching)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                aiWatching 
                  ? "bg-[#34A853]/20 text-[#34A853] border border-[#34A853]/30" 
                  : "bg-white/5 text-white/50 border border-white/10"
              }`}
            >
              {aiWatching ? "👁️ Watching" : "Paused"}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Proactive Help Banner */}
        {proactiveHelp && (
          <div className={`p-3 border-b flex items-start gap-3 animate-slideDown ${
            proactiveHelp.severity === "high" 
              ? "bg-[#EA4335]/10 border-[#EA4335]/30" 
              : "bg-[#FBBC04]/10 border-[#FBBC04]/30"
          }`}>
            <Lightbulb className="w-5 h-5 text-[#FBBC04] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium mb-1">AI Suggestion</div>
              <div className="text-xs text-white/80">{proactiveHelp.message}</div>
            </div>
            <button
              onClick={() => setProactiveHelp(null)}
              className="p-1 rounded hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Video Player */}
          <div className="flex-1 flex flex-col bg-black/40 p-4">
            <div className="flex-1 rounded-xl overflow-hidden border border-white/20 relative">
              {videoId ? (
                <>
                  <iframe
                    ref={iframeRef}
                    className="w-full h-full"
                    src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&rel=0`}
                    title={videoTitle}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    onError={() => setShowAddUrl(true)}
                  />
                  {/* Video unavailable overlay */}
                  {showAddUrl && (
                    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6">
                      <AlertCircle className="w-16 h-16 text-[#EA4335] mb-4" />
                      <h3 className="text-xl font-bold mb-2">Video Unavailable</h3>
                      <p className="text-white/60 text-sm mb-6 text-center">
                        This video is not available. You can add a different video URL below.
                      </p>
                      
                      {/* Add URL Form */}
                      <div className="w-full max-w-md space-y-4">
                        <div className="relative">
                          <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#EA4335]" />
                          <Input
                            value={newVideoUrl}
                            onChange={(e) => setNewVideoUrl(e.target.value)}
                            placeholder="Paste YouTube URL here..."
                            className="pl-11 bg-white/5 border-white/20"
                          />
                        </div>
                        
                        {/* URL Preview */}
                        {urlPreview && (
                          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                            <div className="flex gap-3">
                              <img
                                src={urlPreview.thumbnail_url}
                                alt=""
                                className="w-24 h-16 rounded object-cover"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {urlPreview.title}
                                </div>
                                <div className="text-xs text-white/50 mt-1">
                                  {urlPreview.author_name}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <Button
                          onClick={handleReplaceVideo}
                          disabled={!urlPreview}
                          className="w-full bg-[#EA4335] hover:bg-[#EA4335]/80"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Load This Video
                        </Button>
                        
                        <button
                          onClick={() => setShowAddUrl(false)}
                          className="w-full text-sm text-white/50 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-white/50 p-6">
                  <AlertCircle className="w-12 h-12 mb-4 text-[#EA4335]" />
                  <p className="mb-4">No video URL provided</p>
                  
                  {/* Add URL when no video */}
                  <div className="w-full max-w-md space-y-3">
                    <div className="relative">
                      <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#EA4335]" />
                      <Input
                        value={newVideoUrl}
                        onChange={(e) => setNewVideoUrl(e.target.value)}
                        placeholder="Paste YouTube URL here..."
                        className="pl-11 bg-white/5 border-white/20"
                      />
                    </div>
                    
                    {urlPreview && (
                      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                        <div className="flex gap-3">
                          <img
                            src={urlPreview.thumbnail_url}
                            alt=""
                            className="w-20 h-12 rounded object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{urlPreview.title}</div>
                            <div className="text-xs text-white/50">{urlPreview.author_name}</div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <Button
                      onClick={handleReplaceVideo}
                      disabled={!urlPreview}
                      className="w-full bg-[#EA4335] hover:bg-[#EA4335]/80"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Load Video
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Video Controls & Quick Actions */}
            <div className="mt-4 space-y-3">
              {/* Info Bar */}
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-[#34A853]">
                      <MessageSquare className="w-4 h-4" />
                      <span>Ask questions anytime</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#667eea]">
                      <Brain className="w-4 h-4" />
                      <span>AI watching with you</span>
                    </div>
                    <div className="text-white/40">
                      ⏱️ {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
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

              {/* Quick Action Buttons */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => getContextualHelp("explain")}
                  disabled={isLoading}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <HelpCircle className="w-4 h-4 text-[#667eea]" />
                  Explain This
                </button>
                <button
                  onClick={() => getContextualHelp("example")}
                  disabled={isLoading}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Target className="w-4 h-4 text-[#34A853]" />
                  Example
                </button>
                <button
                  onClick={() => getContextualHelp("deeper")}
                  disabled={isLoading}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <BookOpen className="w-4 h-4 text-[#FBBC04]" />
                  Go Deeper
                </button>
                <button
                  onClick={generateComprehensionCheck}
                  disabled={isLoading}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-[#EA4335]" />
                  Quiz Me
                </button>
              </div>
            </div>
          </div>

          {/* AI Chat Panel */}
          <div className="w-96 border-l border-white/10 flex flex-col bg-black/20">
            {/* Chat Header */}
            <div className="p-4 border-b border-white/10">
              <h3 className="font-semibold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#667eea]" />
                AI Learning Companion
              </h3>
              <p className="text-xs text-white/50 mt-1">
                {aiWatching ? "🔴 Live - Watching with you" : "Paused"}
              </p>
            </div>

            {/* Comprehension Check Modal */}
            {showComprehensionCheck && comprehensionQuestion && (
              <div className="p-4 bg-[#667eea]/10 border-b border-[#667eea]/30 animate-slideDown">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#667eea]" />
                    Quick Check
                  </h4>
                  <button
                    onClick={() => setShowComprehensionCheck(false)}
                    className="p-1 rounded hover:bg-white/10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-sm mb-3">{comprehensionQuestion.question}</div>
                <div className="space-y-2">
                  {Object.entries(comprehensionQuestion.options).map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => handleComprehensionAnswer(key)}
                      className="w-full p-2 text-left text-xs bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-colors"
                    >
                      <strong>{key}:</strong> {value}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                            h1: ({ children }) => <h1 className="text-lg font-bold mb-2 pb-2 border-b border-white/10">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2">{children}</h3>,
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
                            ul: ({ children }) => <ul className="list-disc list-inside text-sm space-y-1 ml-2 mb-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside text-sm space-y-1 ml-2 mb-2">{children}</ol>,
                            li: ({ children }) => <li className="text-white/80">{children}</li>,
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-[#667eea] pl-3 py-1 my-2 bg-[#667eea]/10 rounded-r text-sm italic">
                                {children}
                              </blockquote>
                            ),
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

            {/* Input with Drag & Drop */}
            <div 
              ref={dropZoneRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`p-4 border-t border-white/10 bg-black/20 transition-colors ${
                dragOver ? "bg-[#667eea]/20 border-[#667eea]/50" : ""
              }`}
            >
              {/* Drag overlay */}
              {dragOver && (
                <div className="absolute inset-0 bg-[#667eea]/10 border-2 border-dashed border-[#667eea] rounded-lg flex items-center justify-center z-10">
                  <div className="text-center">
                    <Image className="w-8 h-8 mx-auto mb-2 text-[#667eea]" />
                    <p className="text-sm font-medium">Drop screenshot to analyze</p>
                  </div>
                </div>
              )}
              
              {/* Uploaded image preview */}
              {uploadedImage && (
                <div className="mb-3 relative">
                  <img
                    src={uploadedImage.preview}
                    alt="Screenshot"
                    className="max-h-32 rounded-lg border border-white/20"
                  />
                  <button
                    onClick={() => setUploadedImage(null)}
                    className="absolute -top-2 -right-2 p-1 bg-[#EA4335] rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              
              <div className="flex gap-2">
                {/* Screenshot upload button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
                  title="Upload screenshot"
                >
                  <Image className="w-5 h-5 text-[#667eea]" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about the video or drop a screenshot..."
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
              <div className="mt-2 flex items-center gap-4 text-xs text-white/40">
                <span>💡 Tip: AI uses transcript context</span>
                <span>📸 Drag & drop screenshots to analyze</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoLearningModal;

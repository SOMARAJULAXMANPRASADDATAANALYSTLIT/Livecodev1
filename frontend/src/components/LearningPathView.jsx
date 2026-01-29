import React, { useState, useRef, useEffect } from "react";
import {
  GraduationCap, Target, TreePine, Calendar, Brain, Award,
  ChevronRight, ChevronDown, Send, Loader2, Play, CheckCircle2,
  Circle, Clock, BarChart3, BookOpen, Lightbulb, Sparkles,
  User, Briefcase, Code, Stethoscope, Plane, Building,
  Download, RefreshCw, MessageSquare, Home, ArrowLeft, Trophy,
  Flame, Star, Mic, MicOff, Image, X, Zap, TrendingUp, Youtube, ExternalLink, Link2, Plus, Edit3
} from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { Progress } from "./ui/progress";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import VideoLearningModal from "./VideoLearningModal";
import EditableLearningPath from "./EditableLearningPath";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const INDUSTRIES = [
  { id: "software", name: "Software & AI Engineering", icon: Code, color: "#667eea" },
  { id: "data", name: "Data & Analytics", icon: BarChart3, color: "#34A853" },
  { id: "business", name: "Business & Strategy", icon: Briefcase, color: "#FBBC04" },
  { id: "healthcare", name: "Healthcare & Biology", icon: Stethoscope, color: "#EA4335" },
  { id: "travel", name: "Travel & Geography", icon: Plane, color: "#4285F4" },
  { id: "architecture", name: "Architecture & Design", icon: Building, color: "#9333ea" },
];

// Gamification badges
const BADGES = [
  { id: "first_topic", name: "First Steps", icon: "🎯", description: "Complete your first topic", xp: 50 },
  { id: "streak_3", name: "On Fire", icon: "🔥", description: "3-day learning streak", xp: 100 },
  { id: "streak_7", name: "Dedicated", icon: "⭐", description: "7-day learning streak", xp: 250 },
  { id: "streak_30", name: "Unstoppable", icon: "🏆", description: "30-day learning streak", xp: 1000 },
  { id: "fast_learner", name: "Fast Learner", icon: "⚡", description: "Complete 5 topics in a week", xp: 300 },
  { id: "quiz_master", name: "Quiz Master", icon: "🧠", description: "Score 100% on 10 quizzes", xp: 500 },
];

const LearningPathView = () => {
  const [phase, setPhase] = useState("onboarding"); // onboarding, roadmap, learning, dashboard
  const [userProfile, setUserProfile] = useState(null);
  const [skillTree, setSkillTree] = useState(null);
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [currentTopic, setCurrentTopic] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0, velocity: 0 });
  const messagesEndRef = useRef(null);

  // Gamification state
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [badges, setBadges] = useState([]);
  const [level, setLevel] = useState(1);

  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);

  // Image input state
  const [selectedImage, setSelectedImage] = useState(null);
  const fileInputRef = useRef(null);

  // Video learning state
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [onlineResources, setOnlineResources] = useState(null);

  // Onboarding state
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingData, setOnboardingData] = useState({
    targetRole: "",
    industry: "",
    background: "",
    hoursPerWeek: 10,
    learningSpeed: "normal",
    preferredStyle: "mixed",
    targetMonths: 12
  });

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

      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast.error('Voice input error. Please try again.');
      };

      setRecognition(recognitionInstance);
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!recognition) {
      toast.error('Voice input not supported in this browser');
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
      toast.info('Listening... Speak now');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Calculate level from XP
  useEffect(() => {
    const newLevel = Math.floor(xp / 500) + 1;
    if (newLevel !== level) {
      setLevel(newLevel);
      if (newLevel > 1) {
        toast.success(`🎉 Level Up! You're now Level ${newLevel}!`);
      }
    }
  }, [xp, level]);

  const addXp = (amount) => {
    setXp(prev => prev + amount);
    toast.success(`+${amount} XP!`, { duration: 1500 });
  };

  const awardBadge = (badgeId) => {
    const badge = BADGES.find(b => b.id === badgeId);
    if (badge && !badges.includes(badgeId)) {
      setBadges(prev => [...prev, badgeId]);
      addXp(badge.xp);
      toast.success(`🏆 Badge Unlocked: ${badge.name}!`);
    }
  };

  const resetToHome = () => {
    setPhase("onboarding");
    setOnboardingStep(0);
    setOnboardingData({
      targetRole: "",
      industry: "",
      background: "",
      hoursPerWeek: 10,
      learningSpeed: "normal",
      preferredStyle: "mixed",
      targetMonths: 12
    });
    setUserProfile(null);
    setSkillTree(null);
    setWeeklyPlan(null);
    setCurrentTopic(null);
    setMessages([]);
  };

  const handleOnboardingComplete = async () => {
    setIsLoading(true);
    try {
      // First create the learning path
      const response = await fetch(`${BACKEND_URL}/api/learning/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(onboardingData)
      });
      
      if (!response.ok) throw new Error("Failed to create learning path");
      
      const data = await response.json();
      
      // Then research online resources for the target role
      toast.info("Researching free courses and resources...");
      
      try {
        const resourcesResponse = await fetch(`${BACKEND_URL}/api/learning/research-resources`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: onboardingData.targetRole,
            level: "beginner",
            goal: `Become a ${onboardingData.targetRole}`
          })
        });
        
        if (resourcesResponse.ok) {
          const resourcesData = await resourcesResponse.json();
          // Add resources to the skill tree
          data.skill_tree.online_resources = resourcesData;
          setOnlineResources(resourcesData);
          toast.success("Found " + (resourcesData.youtube_playlists?.length || 0) + " YouTube playlists!");
        }
      } catch (error) {
        console.error("Resources research failed:", error);
        // Continue even if resources research fails
      }
      
      setUserProfile(data.profile);
      setSkillTree(data.skill_tree);
      setWeeklyPlan(data.weekly_plan);
      setProgress(data.progress || { completed: 0, total: data.skill_tree?.nodes?.length || 0, velocity: 0 });
      setPhase("roadmap");
      addXp(100); // XP for starting journey
      toast.success("Learning path created with curated resources!");
    } catch (error) {
      toast.error("Failed to create learning path");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const startTopic = async (topic) => {
    setCurrentTopic(topic);
    setPhase("learning");
    setMessages([{
      role: "assistant",
      content: `Let's learn about **${topic.name}**!\n\n${topic.description || "I'll guide you through this topic step by step."}\n\nFeel free to ask questions, and I'll explain concepts at your pace. You can:\n- Type your questions\n- Use 🎤 voice input\n- Upload 📷 images for analysis\n\nReady to begin?`
    }]);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;
    
    const userMessage = { 
      role: "user", 
      content: input,
      image: selectedImage?.preview 
    };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    const currentImage = selectedImage;
    setInput("");
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const requestBody = {
        message: currentInput || "Please analyze this image",
        topic: currentTopic,
        user_profile: userProfile,
        conversation_history: messages.map(m => ({ role: m.role, content: m.content }))
      };

      // If there's an image, include it
      if (currentImage) {
        requestBody.image_base64 = currentImage.base64;
      }

      const response = await fetch(`${BACKEND_URL}/api/learning/mentor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
      
      if (data.quiz) {
        setMessages(prev => [...prev, { role: "quiz", content: data.quiz }]);
      }

      addXp(10); // XP for asking questions
    } catch (error) {
      toast.error("Failed to get response");
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const markTopicComplete = async (topicId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/learning/complete-topic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic_id: topicId, user_id: userProfile?.id })
      });
      
      if (response.ok) {
        const data = await response.json();
        setProgress(data.progress);
        setSkillTree(prev => ({
          ...prev,
          nodes: prev.nodes.map(n => n.id === topicId ? { ...n, status: "completed" } : n)
        }));
        
        addXp(100); // XP for completing topic
        setStreak(prev => prev + 1);
        
        // Check for badges
        if (progress.completed === 0) awardBadge("first_topic");
        if (streak + 1 >= 3) awardBadge("streak_3");
        if (streak + 1 >= 7) awardBadge("streak_7");
        
        toast.success("Topic completed! Great job!");
        setPhase("roadmap");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Render different phases
  if (phase === "onboarding") {
    return <OnboardingPhase 
      step={onboardingStep}
      setStep={setOnboardingStep}
      data={onboardingData}
      setData={setOnboardingData}
      onComplete={handleOnboardingComplete}
      isLoading={isLoading}
    />;
  }

  if (phase === "roadmap") {
    return (
      <>
        <RoadmapPhase 
          skillTree={skillTree}
          setSkillTree={setSkillTree}
          weeklyPlan={weeklyPlan}
          progress={progress}
          userProfile={userProfile}
          onStartTopic={startTopic}
          onViewDashboard={() => setPhase("dashboard")}
          onGoHome={resetToHome}
          xp={xp}
          level={level}
          streak={streak}
          badges={badges}
          onlineResources={onlineResources}
          onPlayVideo={(video) => {
            setCurrentVideo(video);
            setShowVideoModal(true);
          }}
        />
        {/* Video Learning Modal - rendered at roadmap phase level */}
        {showVideoModal && currentVideo && (
          <VideoLearningModal
            videoUrl={currentVideo.url}
            videoTitle={currentVideo.title}
            onClose={() => {
              setShowVideoModal(false);
              setCurrentVideo(null);
            }}
            skillLevel={userProfile?.experience || "intermediate"}
          />
        )}
      </>
    );
  }

  if (phase === "dashboard") {
    return <DashboardPhase 
      progress={progress}
      skillTree={skillTree}
      userProfile={userProfile}
      onBack={() => setPhase("roadmap")}
      onGoHome={resetToHome}
      xp={xp}
      level={level}
      streak={streak}
      badges={badges}
    />;
  }

  // Learning phase - Interactive mentoring
  return (
    <div className="h-[calc(100vh-120px)] flex gap-4">
      {/* Left sidebar - Topic info */}
      <div className="w-72 shrink-0 glass-heavy rounded-2xl p-4 flex flex-col">
        {/* Home button */}
        <Button 
          onClick={resetToHome}
          variant="ghost" 
          size="sm" 
          className="mb-4 text-white/60 hover:text-white"
        >
          <Home className="w-4 h-4 mr-2" />
          Choose Another Career
        </Button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#667eea]/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-[#667eea]" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{currentTopic?.name}</h3>
            <p className="text-xs text-white/50">Level: {currentTopic?.level}</p>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/50">Understanding</span>
            <span className="text-[#34A853]">{currentTopic?.understanding || 0}%</span>
          </div>
          <Progress value={currentTopic?.understanding || 0} className="h-2" />
        </div>

        {/* Gamification stats */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="p-2 glass-light rounded-lg text-center">
            <div className="text-lg font-bold text-[#FBBC04]">{xp}</div>
            <div className="text-xs text-white/50">XP</div>
          </div>
          <div className="p-2 glass-light rounded-lg text-center">
            <div className="text-lg font-bold text-[#EA4335] flex items-center justify-center gap-1">
              <Flame className="w-4 h-4" />
              {streak}
            </div>
            <div className="text-xs text-white/50">Streak</div>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="p-3 glass-light rounded-xl">
            <div className="flex items-center gap-2 text-white/70 mb-1">
              <Target className="w-4 h-4" />
              <span className="font-medium">Learning Objective</span>
            </div>
            <p className="text-xs text-white/50">{currentTopic?.objective || "Master this concept"}</p>
          </div>
          
          <div className="p-3 glass-light rounded-xl">
            <div className="flex items-center gap-2 text-white/70 mb-1">
              <Clock className="w-4 h-4" />
              <span className="font-medium">Estimated Time</span>
            </div>
            <p className="text-xs text-white/50">{currentTopic?.estimatedTime || "1-2 hours"}</p>
          </div>
        </div>

        <div className="mt-auto space-y-2">
          <Button 
            onClick={() => markTopicComplete(currentTopic?.id)}
            className="w-full bg-[#34A853] hover:bg-[#34A853]/80"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Mark as Complete (+100 XP)
          </Button>
          <Button 
            onClick={() => setPhase("roadmap")}
            variant="outline"
            className="w-full border-white/20"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Roadmap
          </Button>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col glass-heavy rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold">AI Learning Mentor</h3>
              <p className="text-xs text-white/50">Interactive tutoring session</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 glass-light rounded-full text-xs flex items-center gap-1">
              <Zap className="w-3 h-3 text-[#FBBC04]" />
              Level {level}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-white/50">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Image preview */}
        {selectedImage && (
          <div className="px-4 pb-2">
            <div className="relative inline-block">
              <img 
                src={selectedImage.preview} 
                alt="Upload preview" 
                className="h-20 rounded-lg border border-white/20"
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

        <div className="p-4 border-t border-white/10">
          <div className="flex gap-2">
            {/* Voice input button */}
            <Button
              onClick={toggleVoiceInput}
              variant="outline"
              size="icon"
              className={`border-white/20 ${isListening ? 'bg-red-500/20 border-red-500' : ''}`}
            >
              {isListening ? <MicOff className="w-4 h-4 text-red-500" /> : <Mic className="w-4 h-4" />}
            </Button>

            {/* Image upload button */}
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="icon"
              className="border-white/20"
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
              placeholder={isListening ? "Listening..." : "Ask a question or explain back what you learned..."}
              className="flex-1 min-h-[60px] max-h-[150px] bg-white/5 border-white/10"
            />
            <Button onClick={sendMessage} disabled={isLoading || (!input.trim() && !selectedImage)} className="px-4 bg-[#667eea]">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Video Learning Modal */}
      {showVideoModal && currentVideo && (
        <VideoLearningModal
          videoUrl={currentVideo.url}
          videoTitle={currentVideo.title}
          onClose={() => {
            setShowVideoModal(false);
            setCurrentVideo(null);
          }}
          skillLevel={userProfile?.experience || "intermediate"}
        />
      )}
    </div>
  );
};

// Onboarding Phase Component
const OnboardingPhase = ({ step, setStep, data, setData, onComplete, isLoading }) => {
  const steps = [
    { title: "Your Goal", subtitle: "What do you want to become?" },
    { title: "Background", subtitle: "Tell us about yourself" },
    { title: "Learning Style", subtitle: "How do you learn best?" },
    { title: "Commitment", subtitle: "Set your pace" }
  ];

  const updateData = (key, value) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  // Check if step 0 can continue - either has targetRole OR has industry selected
  const canContinueStep0 = data.targetRole.trim() !== "" || data.industry !== "";

  return (
    <div className="h-[calc(100vh-120px)] flex items-center justify-center">
      <div className="w-full max-w-2xl glass-heavy rounded-3xl p-8">
        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                i < step ? "bg-[#34A853] text-white" :
                i === step ? "bg-[#667eea] text-white" :
                "bg-white/10 text-white/50"
              }`}>
                {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-16 h-0.5 mx-2 ${i < step ? "bg-[#34A853]" : "bg-white/10"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">{steps[step].title}</h2>
          <p className="text-white/50">{steps[step].subtitle}</p>
        </div>

        {/* Step content */}
        <div className="min-h-[300px]">
          {step === 0 && (
            <div className="space-y-4">
              <input
                type="text"
                value={data.targetRole}
                onChange={(e) => updateData("targetRole", e.target.value)}
                placeholder="e.g., AI Engineer, Data Scientist, Product Manager... (optional)"
                className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#667eea]"
              />
              <p className="text-sm text-white/50 text-center">Select an industry:</p>
              <div className="grid grid-cols-2 gap-3">
                {INDUSTRIES.map(ind => {
                  const Icon = ind.icon;
                  return (
                    <button
                      key={ind.id}
                      onClick={() => {
                        updateData("industry", ind.id);
                        // Auto-fill targetRole if empty
                        if (!data.targetRole) {
                          const defaultRoles = {
                            software: "Software Engineer",
                            data: "Data Analyst",
                            business: "Business Analyst",
                            healthcare: "Healthcare Professional",
                            travel: "Travel Specialist",
                            architecture: "Architect"
                          };
                          updateData("targetRole", defaultRoles[ind.id] || ind.name);
                        }
                      }}
                      className={`p-4 rounded-xl border transition-all flex items-center gap-3 ${
                        data.industry === ind.id 
                          ? "border-[#667eea] bg-[#667eea]/10" 
                          : "border-white/10 hover:border-white/20"
                      }`}
                    >
                      <Icon className="w-5 h-5" style={{ color: ind.color }} />
                      <span className="text-sm">{ind.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <textarea
                value={data.background}
                onChange={(e) => updateData("background", e.target.value)}
                placeholder="Describe your current skills, education, and experience... (optional - helps personalize your path)"
                rows={6}
                className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#667eea] resize-none"
              />
              <p className="text-xs text-white/40 text-center">
                This helps us personalize your learning path and skip concepts you already know.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-white/70 mb-3">Learning Speed</label>
                <div className="grid grid-cols-3 gap-3">
                  {["slow", "normal", "fast"].map(speed => (
                    <button
                      key={speed}
                      onClick={() => updateData("learningSpeed", speed)}
                      className={`p-3 rounded-xl border text-sm capitalize transition-all ${
                        data.learningSpeed === speed 
                          ? "border-[#667eea] bg-[#667eea]/10" 
                          : "border-white/10 hover:border-white/20"
                      }`}
                    >
                      {speed}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-3">Preferred Style</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "visual", label: "Visual (Diagrams & Videos)" },
                    { id: "practical", label: "Practical (Projects)" },
                    { id: "theory", label: "Theory (Deep Reading)" },
                    { id: "mixed", label: "Mixed (All Approaches)" }
                  ].map(style => (
                    <button
                      key={style.id}
                      onClick={() => updateData("preferredStyle", style.id)}
                      className={`p-3 rounded-xl border text-sm transition-all ${
                        data.preferredStyle === style.id 
                          ? "border-[#667eea] bg-[#667eea]/10" 
                          : "border-white/10 hover:border-white/20"
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-white/70 mb-3">Hours per week: {data.hoursPerWeek}</label>
                <input
                  type="range"
                  min="5"
                  max="40"
                  value={data.hoursPerWeek}
                  onChange={(e) => updateData("hoursPerWeek", parseInt(e.target.value))}
                  className="w-full accent-[#667eea]"
                />
                <div className="flex justify-between text-xs text-white/40 mt-1">
                  <span>5 hrs</span>
                  <span>40 hrs</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-3">Target timeline: {data.targetMonths} months</label>
                <input
                  type="range"
                  min="3"
                  max="24"
                  value={data.targetMonths}
                  onChange={(e) => updateData("targetMonths", parseInt(e.target.value))}
                  className="w-full accent-[#667eea]"
                />
                <div className="flex justify-between text-xs text-white/40 mt-1">
                  <span>3 months</span>
                  <span>24 months</span>
                </div>
              </div>
              <div className="p-4 glass-light rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-[#FBBC04]" />
                  <span className="font-medium">Estimated Completion</span>
                </div>
                <p className="text-sm text-white/60">
                  With {data.hoursPerWeek} hours/week, you can become a {data.targetRole || "professional"} in approximately {data.targetMonths} months.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <Button
            onClick={() => setStep(Math.max(0, step - 1))}
            variant="outline"
            disabled={step === 0}
            className="border-white/20"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={step === 0 && !canContinueStep0}
              className="bg-[#667eea]"
            >
              Continue
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={onComplete}
              disabled={isLoading}
              className="bg-[#34A853]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Path...
                </>
              ) : (
                <>
                  <GraduationCap className="w-4 h-4 mr-2" />
                  Start Learning Journey
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// Roadmap Phase Component
const RoadmapPhase = ({ skillTree, setSkillTree, weeklyPlan, progress, userProfile, onStartTopic, onViewDashboard, onGoHome, xp, level, streak, badges, onlineResources, onPlayVideo }) => {
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);

  // Handle updating the skill tree from EditableLearningPath
  const handleUpdateTree = (updatedTree) => {
    setSkillTree(updatedTree);
  };

  // Handle playing video from EditableLearningPath (already handled in parent via onPlayVideo)
  const handlePlayVideo = (video) => {
    if (onPlayVideo) {
      onPlayVideo(video);
    } else {
      setCurrentVideo(video);
      setShowVideoModal(true);
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex gap-4">
      {/* Left - Skill Tree */}
      <div className="flex-1 glass-heavy rounded-2xl p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button 
              onClick={onGoHome}
              variant="ghost" 
              size="sm"
              className="text-white/60 hover:text-white"
            >
              <Home className="w-4 h-4 mr-2" />
              Change Career
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onViewDashboard} variant="outline" className="border-white/20">
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#667eea]/20 flex items-center justify-center">
            <TreePine className="w-5 h-5 text-[#667eea]" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Learning Roadmap</h2>
            <p className="text-xs text-white/50">{userProfile?.targetRole}</p>
          </div>
        </div>

        {/* Gamification bar */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="p-3 glass-light rounded-xl text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold text-[#667eea]">
              <Zap className="w-4 h-4" />
              {level}
            </div>
            <div className="text-xs text-white/50">Level</div>
          </div>
          <div className="p-3 glass-light rounded-xl text-center">
            <div className="text-lg font-bold text-[#FBBC04]">{xp}</div>
            <div className="text-xs text-white/50">XP</div>
          </div>
          <div className="p-3 glass-light rounded-xl text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold text-[#EA4335]">
              <Flame className="w-4 h-4" />
              {streak}
            </div>
            <div className="text-xs text-white/50">Streak</div>
          </div>
          <div className="p-3 glass-light rounded-xl text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold text-[#34A853]">
              <Trophy className="w-4 h-4" />
              {badges.length}
            </div>
            <div className="text-xs text-white/50">Badges</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-6 p-4 glass-light rounded-xl">
          <div className="flex justify-between text-sm mb-2">
            <span>Overall Progress</span>
            <span className="text-[#34A853]">{Math.round((progress.completed / Math.max(progress.total, 1)) * 100)}%</span>
          </div>
          <Progress value={(progress.completed / Math.max(progress.total, 1)) * 100} className="h-3" />
          <div className="flex justify-between text-xs text-white/40 mt-2">
            <span>{progress.completed} of {progress.total} topics completed</span>
            <span>Velocity: {progress.velocity} topics/week</span>
          </div>
        </div>

        {/* Online Resources Section */}
        {onlineResources && (onlineResources.youtube_playlists?.length > 0 || onlineResources.free_courses?.length > 0) && (
          <div className="mb-6 p-5 bg-gradient-to-r from-[#EA4335]/10 to-[#FBBC04]/10 border border-[#EA4335]/30 rounded-xl">
            <div className="flex items-center gap-2 mb-4">
              <Youtube className="w-5 h-5 text-[#EA4335]" />
              <h3 className="font-bold">🎓 Free Learning Resources</h3>
            </div>
            
            {/* YouTube Playlists */}
            {onlineResources.youtube_playlists && onlineResources.youtube_playlists.length > 0 && (
              <div className="space-y-2 mb-4">
                <h4 className="text-sm font-semibold text-white/70">📺 YouTube Videos & Tutorials</h4>
                {onlineResources.youtube_playlists.slice(0, 5).map((playlist, idx) => (
                  <div
                    key={idx}
                    className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#EA4335]/50 rounded-lg transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <button 
                        onClick={() => onPlayVideo && onPlayVideo({
                          url: playlist.url,
                          title: playlist.title
                        })}
                        className="w-10 h-10 rounded-lg bg-[#EA4335]/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform hover:bg-[#EA4335]/40 cursor-pointer"
                        title="Play with AI Companion"
                      >
                        <Play className="w-5 h-5 text-[#EA4335]" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <a
                          href={playlist.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-sm text-white hover:text-[#EA4335] transition-colors line-clamp-1 cursor-pointer underline-offset-2 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {playlist.title}
                        </a>
                        <div className="text-xs text-white/50 mt-1">
                          {playlist.channel && `${playlist.channel} • `}
                          {playlist.estimated_duration || "Video Tutorial"}
                        </div>
                        <a 
                          href={playlist.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#EA4335]/70 hover:text-[#EA4335] mt-1 inline-block truncate max-w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {playlist.url}
                        </a>
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <a
                          href={playlist.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-white/10 transition-colors"
                          title="Open in YouTube"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-4 h-4 text-white/30 hover:text-[#EA4335]" />
                        </a>
                        <button
                          onClick={() => onPlayVideo && onPlayVideo({
                            url: playlist.url,
                            title: playlist.title
                          })}
                          className="p-1.5 rounded hover:bg-white/10 transition-colors"
                          title="Watch with AI Companion"
                        >
                          <MessageSquare className="w-4 h-4 text-white/30 hover:text-[#667eea]" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Free Courses */}
            {onlineResources.free_courses && onlineResources.free_courses.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-white/70">🎓 Free Courses</h4>
                {onlineResources.free_courses.slice(0, 3).map((course, idx) => (
                  <a
                    key={idx}
                    href={course.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#34A853]/50 rounded-lg transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#34A853]/20 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-5 h-5 text-[#34A853]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-white group-hover:text-[#34A853] transition-colors line-clamp-1">
                          {course.title}
                        </div>
                        <div className="text-xs text-white/50 mt-1">
                          {course.platform} • {course.level || "All levels"}
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-white/30 group-hover:text-[#34A853]" />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Editable Skill tree - Add your own topics and YouTube URLs */}
        <EditableLearningPath 
          skillTree={skillTree}
          userProfile={userProfile}
          onUpdateTree={handleUpdateTree}
        />
      </div>

      {/* Right - Weekly Plan */}
      <div className="w-80 shrink-0 glass-heavy rounded-2xl p-6 overflow-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#FBBC04]/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-[#FBBC04]" />
          </div>
          <div>
            <h2 className="text-lg font-bold">This Week</h2>
            <p className="text-xs text-white/50">Week {weeklyPlan?.week || 1}</p>
          </div>
        </div>

        {weeklyPlan?.tasks?.map((task, i) => (
          <div key={i} className="p-4 glass-light rounded-xl mb-3">
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
                task.completed ? "bg-[#34A853]" : "border-2 border-white/30"
              }`}>
                {task.completed && <CheckCircle2 className="w-3 h-3 text-white" />}
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">{task.title}</div>
                <div className="text-xs text-white/50 mt-1">{task.description}</div>
                {task.type === "reading" && (
                  <div className="text-xs text-[#4285F4] mt-2 flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> Reading
                  </div>
                )}
                {task.type === "practice" && (
                  <div className="text-xs text-[#34A853] mt-2 flex items-center gap-1">
                    <Code className="w-3 h-3" /> Practice
                  </div>
                )}
                {task.type === "project" && (
                  <div className="text-xs text-[#9333ea] mt-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Project
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {weeklyPlan?.homework && (
          <div className="mt-6">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#EA4335]" />
              Homework (+50 XP)
            </h3>
            <div className="p-4 border border-[#EA4335]/30 bg-[#EA4335]/5 rounded-xl">
              <p className="text-sm">{weeklyPlan.homework.description}</p>
              <Button size="sm" className="mt-3 w-full bg-[#EA4335]">
                Start Homework
              </Button>
            </div>
          </div>
        )}

        {/* Badges section */}
        {badges.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#FBBC04]" />
              Your Badges
            </h3>
            <div className="flex flex-wrap gap-2">
              {badges.map(badgeId => {
                const badge = BADGES.find(b => b.id === badgeId);
                return badge ? (
                  <div 
                    key={badgeId}
                    className="px-3 py-2 glass-light rounded-lg text-center"
                    title={badge.description}
                  >
                    <div className="text-2xl">{badge.icon}</div>
                    <div className="text-xs mt-1">{badge.name}</div>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Dashboard Phase Component
const DashboardPhase = ({ progress, skillTree, userProfile, onBack, onGoHome, xp, level, streak, badges }) => {
  const completedTopics = skillTree?.nodes?.filter(n => n.status === "completed").length || 0;
  const totalTopics = skillTree?.nodes?.length || 1;

  return (
    <div className="h-[calc(100vh-120px)] overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button onClick={onBack} variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Roadmap
          </Button>
          <Button onClick={onGoHome} variant="ghost" size="sm" className="text-white/60">
            <Home className="w-4 h-4 mr-1" />
            Change Career
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard 
          icon={Target} 
          label="Topics Completed" 
          value={completedTopics} 
          total={totalTopics}
          color="#34A853" 
        />
        <StatCard 
          icon={Zap} 
          label="Current Level" 
          value={level} 
          suffix=""
          color="#667eea" 
        />
        <StatCard 
          icon={TrendingUp} 
          label="Total XP" 
          value={xp} 
          suffix="xp"
          color="#FBBC04" 
        />
        <StatCard 
          icon={Flame} 
          label="Current Streak" 
          value={streak} 
          suffix="days"
          color="#EA4335" 
        />
      </div>

      {/* Progress visualization */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-heavy rounded-2xl p-6">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <TreePine className="w-5 h-5 text-[#34A853]" />
            Skill Progress
          </h3>
          <div className="space-y-4">
            {skillTree?.nodes?.slice(0, 8).map((node, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{node.name}</span>
                  <span className="text-white/50">{node.status === "completed" ? "100%" : node.status === "in_progress" ? "50%" : "0%"}</span>
                </div>
                <Progress 
                  value={node.status === "completed" ? 100 : node.status === "in_progress" ? 50 : 0} 
                  className="h-2" 
                />
              </div>
            ))}
          </div>
        </div>

        <div className="glass-heavy rounded-2xl p-6">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#FBBC04]" />
            Badges Earned ({badges.length}/{BADGES.length})
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {BADGES.map(badge => {
              const earned = badges.includes(badge.id);
              return (
                <div 
                  key={badge.id}
                  className={`p-3 rounded-xl text-center transition-all ${
                    earned ? 'glass-light' : 'opacity-30'
                  }`}
                  title={badge.description}
                >
                  <div className="text-3xl mb-1">{badge.icon}</div>
                  <div className="text-xs font-medium">{badge.name}</div>
                  <div className="text-xs text-white/50">+{badge.xp} XP</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper Components
const MessageBubble = ({ message }) => {
  const isUser = message.role === "user";
  const isQuiz = message.role === "quiz";
  
  if (isQuiz) {
    return (
      <div className="p-4 border border-[#FBBC04]/30 bg-[#FBBC04]/5 rounded-2xl">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-5 h-5 text-[#FBBC04]" />
          <span className="font-semibold">Quick Check</span>
        </div>
        <p className="text-sm mb-4">{message.content.question}</p>
        <div className="space-y-2">
          {message.content.options?.map((opt, i) => (
            <button 
              key={i}
              className="w-full p-3 text-left text-sm glass-light rounded-xl hover:bg-white/10 transition-colors"
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] p-4 rounded-2xl ${
        isUser ? 'bg-[#667eea] text-white' : 'glass-light'
      }`}>
        {message.image && (
          <img 
            src={message.image} 
            alt="User upload" 
            className="max-h-40 rounded-lg mb-2"
          />
        )}
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, total, suffix, color }) => (
  <div className="glass-heavy rounded-2xl p-6">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <span className="text-sm text-white/60">{label}</span>
    </div>
    <div className="text-3xl font-bold">
      {value}
      {total && <span className="text-lg text-white/40">/{total}</span>}
      {suffix && <span className="text-lg text-white/40 ml-1">{suffix}</span>}
    </div>
  </div>
);

export default LearningPathView;

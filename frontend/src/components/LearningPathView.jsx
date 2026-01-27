import React, { useState, useRef, useEffect } from "react";
import {
  GraduationCap, Target, TreePine, Calendar, Brain, Award,
  ChevronRight, ChevronDown, Send, Loader2, Play, CheckCircle2,
  Circle, Clock, BarChart3, BookOpen, Lightbulb, Sparkles,
  User, Briefcase, Code, Stethoscope, Plane, Building,
  Download, RefreshCw, MessageSquare
} from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Progress } from "./ui/progress";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const INDUSTRIES = [
  { id: "software", name: "Software & AI Engineering", icon: Code, color: "#667eea" },
  { id: "data", name: "Data & Analytics", icon: BarChart3, color: "#34A853" },
  { id: "business", name: "Business & Strategy", icon: Briefcase, color: "#FBBC04" },
  { id: "healthcare", name: "Healthcare & Biology", icon: Stethoscope, color: "#EA4335" },
  { id: "travel", name: "Travel & Geography", icon: Plane, color: "#4285F4" },
  { id: "architecture", name: "Architecture & Design", icon: Building, color: "#9333ea" },
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleOnboardingComplete = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/learning/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(onboardingData)
      });
      
      if (!response.ok) throw new Error("Failed to create learning path");
      
      const data = await response.json();
      setUserProfile(data.profile);
      setSkillTree(data.skill_tree);
      setWeeklyPlan(data.weekly_plan);
      setProgress(data.progress || { completed: 0, total: data.skill_tree?.nodes?.length || 0, velocity: 0 });
      setPhase("roadmap");
      toast.success("Learning path created!");
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
      content: `Let's learn about **${topic.name}**!\n\n${topic.description || "I'll guide you through this topic step by step."}\n\nFeel free to ask questions, and I'll explain concepts at your pace. Ready to begin?`
    }]);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/learning/mentor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          topic: currentTopic,
          user_profile: userProfile,
          conversation_history: messages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
      
      if (data.quiz) {
        setMessages(prev => [...prev, { role: "quiz", content: data.quiz }]);
      }
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
        toast.success("Topic completed! Great job!");
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
    return <RoadmapPhase 
      skillTree={skillTree}
      weeklyPlan={weeklyPlan}
      progress={progress}
      userProfile={userProfile}
      onStartTopic={startTopic}
      onViewDashboard={() => setPhase("dashboard")}
    />;
  }

  if (phase === "dashboard") {
    return <DashboardPhase 
      progress={progress}
      skillTree={skillTree}
      userProfile={userProfile}
      onBack={() => setPhase("roadmap")}
    />;
  }

  // Learning phase - Interactive mentoring
  return (
    <div className="h-[calc(100vh-120px)] flex gap-4">
      {/* Left sidebar - Topic info */}
      <div className="w-72 shrink-0 glass-heavy rounded-2xl p-4 flex flex-col">
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
            Mark as Complete
          </Button>
          <Button 
            onClick={() => setPhase("roadmap")}
            variant="outline"
            className="w-full border-white/20"
          >
            Back to Roadmap
          </Button>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col glass-heavy rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold">AI Learning Mentor</h3>
            <p className="text-xs text-white/50">Interactive tutoring session</p>
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

        <div className="p-4 border-t border-white/10">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question or explain back what you learned..."
              className="flex-1 min-h-[60px] max-h-[150px] bg-white/5 border-white/10"
            />
            <Button onClick={sendMessage} disabled={isLoading || !input.trim()} className="px-4 bg-[#667eea]">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
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
                placeholder="e.g., AI Engineer, Data Scientist, Product Manager..."
                className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#667eea]"
              />
              <p className="text-sm text-white/50 text-center">Select an industry:</p>
              <div className="grid grid-cols-2 gap-3">
                {INDUSTRIES.map(ind => {
                  const Icon = ind.icon;
                  return (
                    <button
                      key={ind.id}
                      onClick={() => updateData("industry", ind.id)}
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
                placeholder="Describe your current skills, education, and experience..."
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
            Back
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={step === 0 && !data.targetRole}
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
const RoadmapPhase = ({ skillTree, weeklyPlan, progress, userProfile, onStartTopic, onViewDashboard }) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set(["root"]));

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) newSet.delete(nodeId);
      else newSet.add(nodeId);
      return newSet;
    });
  };

  const renderTreeNode = (node, depth = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const statusColors = {
      completed: "#34A853",
      in_progress: "#667eea",
      not_started: "#666"
    };

    return (
      <div key={node.id} style={{ marginLeft: depth * 20 }}>
        <div 
          className={`flex items-center gap-3 p-3 rounded-xl mb-2 transition-all cursor-pointer hover:bg-white/5 ${
            node.status === "in_progress" ? "bg-[#667eea]/10 border border-[#667eea]/30" : ""
          }`}
          onClick={() => hasChildren ? toggleNode(node.id) : onStartTopic(node)}
        >
          {hasChildren ? (
            <button onClick={(e) => { e.stopPropagation(); toggleNode(node.id); }}>
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <div className="w-4" />
          )}
          
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: statusColors[node.status || "not_started"] }}
          />
          
          <div className="flex-1">
            <div className="font-medium text-sm">{node.name}</div>
            <div className="text-xs text-white/50">{node.level} • {node.estimatedTime}</div>
          </div>

          {!hasChildren && (
            <Button size="sm" variant="ghost" className="h-7 text-xs">
              <Play className="w-3 h-3 mr-1" />
              Start
            </Button>
          )}
        </div>
        
        {isExpanded && hasChildren && (
          <div className="ml-4 border-l border-white/10 pl-2">
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-120px)] flex gap-4">
      {/* Left - Skill Tree */}
      <div className="flex-1 glass-heavy rounded-2xl p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#667eea]/20 flex items-center justify-center">
              <TreePine className="w-5 h-5 text-[#667eea]" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Learning Roadmap</h2>
              <p className="text-xs text-white/50">{userProfile?.targetRole}</p>
            </div>
          </div>
          <Button onClick={onViewDashboard} variant="outline" className="border-white/20">
            <BarChart3 className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
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

        {/* Skill tree */}
        <div className="space-y-2">
          {skillTree?.nodes?.map(node => renderTreeNode(node))}
        </div>
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
                  <div className="text-xs text-[#4285F4] mt-2">📖 Reading</div>
                )}
                {task.type === "practice" && (
                  <div className="text-xs text-[#34A853] mt-2">💻 Practice</div>
                )}
                {task.type === "project" && (
                  <div className="text-xs text-[#9333ea] mt-2">🚀 Project</div>
                )}
              </div>
            </div>
          </div>
        ))}

        {weeklyPlan?.homework && (
          <div className="mt-6">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#EA4335]" />
              Homework
            </h3>
            <div className="p-4 border border-[#EA4335]/30 bg-[#EA4335]/5 rounded-xl">
              <p className="text-sm">{weeklyPlan.homework.description}</p>
              <Button size="sm" className="mt-3 w-full bg-[#EA4335]">
                Start Homework
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Dashboard Phase Component
const DashboardPhase = ({ progress, skillTree, userProfile, onBack }) => {
  const completedTopics = skillTree?.nodes?.filter(n => n.status === "completed").length || 0;
  const totalTopics = skillTree?.nodes?.length || 1;

  return (
    <div className="h-[calc(100vh-120px)] overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button onClick={onBack} variant="ghost" size="sm">
            <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
            Back to Roadmap
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
          icon={Clock} 
          label="Hours Studied" 
          value={Math.round(completedTopics * 2)} 
          suffix="hrs"
          color="#667eea" 
        />
        <StatCard 
          icon={BarChart3} 
          label="Weekly Velocity" 
          value={progress.velocity || 0} 
          suffix="topics/wk"
          color="#FBBC04" 
        />
        <StatCard 
          icon={Award} 
          label="Current Streak" 
          value={7} 
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
            <Lightbulb className="w-5 h-5 text-[#FBBC04]" />
            Learning Insights
          </h3>
          <div className="space-y-4">
            <InsightCard 
              title="Strongest Area" 
              value="Programming Fundamentals" 
              trend="up"
            />
            <InsightCard 
              title="Needs Practice" 
              value="Data Structures" 
              trend="down"
            />
            <InsightCard 
              title="Recommended Focus" 
              value="Complete Python Functions module" 
              trend="neutral"
            />
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

const InsightCard = ({ title, value, trend }) => (
  <div className="p-4 glass-light rounded-xl">
    <div className="text-xs text-white/50 mb-1">{title}</div>
    <div className="font-medium text-sm">{value}</div>
  </div>
);

export default LearningPathView;

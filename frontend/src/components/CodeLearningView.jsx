import React, { useState, useRef, useCallback, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { 
  Play, Bug, Sparkles, ChevronRight, Wand2, Split, Copy, Check, 
  HelpCircle, Lightbulb, MessageSquare, Terminal, Upload, BookOpen,
  Eye, EyeOff, ChevronDown, Zap, AlertTriangle, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import TeachingOverlay from "@/components/TeachingOverlay";
import LineMentoringPanel from "@/components/LineMentoringPanel";
import CodeExecutionPanel from "@/components/CodeExecutionPanel";
import ProjectUploadModal from "@/components/ProjectUploadModal";
import LearningJourneyPanel from "@/components/LearningJourneyPanel";
import { useMentor, SKILL_LEVELS } from "@/contexts/MentorContext";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const LANGUAGES = [
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "sql", label: "SQL" },
  { value: "typescript", label: "TypeScript" },
  { value: "csharp", label: "C#" },
  { value: "php", label: "PHP" },
];

const DEFAULT_CODE = `# Welcome to Live Code Mentor!
# Paste your code here and click "Analyze My Code"

def calculate_average(numbers):
    total = 0
    for num in numbers:
        total += num
    return total / len(numbers)

# Try this code with an empty list - what happens?
result = calculate_average([])
print(result)
`;

const CodeLearningView = () => {
  const { 
    skillLevel, setSkillLevel, sessionId, 
    proactiveMentorEnabled, setProactiveMentorEnabled,
    addToSessionMemory, learningJourney
  } = useMentor();

  const [code, setCode] = useState(DEFAULT_CODE);
  const [language, setLanguage] = useState("python");
  const [bugs, setBugs] = useState([]);
  const [overallQuality, setOverallQuality] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedBug, setSelectedBug] = useState(null);
  const [showTeaching, setShowTeaching] = useState(false);
  
  // AI Senior / Split View states
  const [fixedCode, setFixedCode] = useState("");
  const [fixExplanation, setFixExplanation] = useState("");
  const [changesMade, setChangesMade] = useState([]);
  const [isFixing, setIsFixing] = useState(false);
  const [showSplitView, setShowSplitView] = useState(false);
  const [copied, setCopied] = useState(false);

  // Line mentoring states
  const [selectedLines, setSelectedLines] = useState([]);
  const [showLineMentoring, setShowLineMentoring] = useState(false);
  const [editorInstance, setEditorInstance] = useState(null);
  const [showCodeHelpPopup, setShowCodeHelpPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

  // Code execution states
  const [showExecution, setShowExecution] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Project upload
  const [showProjectUpload, setShowProjectUpload] = useState(false);
  const [showLearningJourney, setShowLearningJourney] = useState(false);

  // Proactive mentor
  const [proactiveWarning, setProactiveWarning] = useState(null);
  const proactiveTimeoutRef = useRef(null);

  // Handle editor mount
  const handleEditorDidMount = (editor, monaco) => {
    setEditorInstance(editor);
    
    // Add keyboard shortcut for line help
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
      handleHelpWithSelection();
    });

    // Listen for selection changes
    editor.onDidChangeCursorSelection((e) => {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        const startLine = selection.startLineNumber;
        const endLine = selection.endLineNumber;
        const lines = [];
        for (let i = startLine; i <= endLine; i++) {
          lines.push(i);
        }
        setSelectedLines(lines);
        
        // Show help popup near the selection
        const position = editor.getPosition();
        const coords = editor.getScrolledVisiblePosition(position);
        if (coords) {
          setPopupPosition({ 
            x: coords.left + coords.width + 10, 
            y: coords.top 
          });
          setShowCodeHelpPopup(true);
        }
      } else {
        setSelectedLines([]);
        setShowCodeHelpPopup(false);
      }
    });
  };

  // Proactive mentor check
  useEffect(() => {
    if (!proactiveMentorEnabled || !code || code.length < 50) return;

    // Debounce the proactive check
    if (proactiveTimeoutRef.current) {
      clearTimeout(proactiveTimeoutRef.current);
    }

    proactiveTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/proactive-mentor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, language, skill_level: skillLevel }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.has_issue) {
            setProactiveWarning(data);
          } else {
            setProactiveWarning(null);
          }
        }
      } catch (error) {
        console.error("Proactive mentor error:", error);
      }
    }, 2000);

    return () => {
      if (proactiveTimeoutRef.current) {
        clearTimeout(proactiveTimeoutRef.current);
      }
    };
  }, [code, language, skillLevel, proactiveMentorEnabled]);

  const analyzeCode = async () => {
    if (!code.trim()) {
      toast.error("Please enter some code to analyze");
      return;
    }

    setIsAnalyzing(true);
    setBugs([]);
    setOverallQuality(null);
    setFixedCode("");
    setShowSplitView(false);
    setProactiveWarning(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/analyze-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, skill_level: skillLevel }),
      });

      if (!response.ok) throw new Error("Analysis failed");

      const data = await response.json();
      setBugs(data.bugs || []);
      setOverallQuality(data.overall_quality);

      if (data.bugs?.length > 0) {
        toast.warning(`Found ${data.bugs.length} issue(s) in your code`);
      } else {
        toast.success("Your code looks great! No issues found.");
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Failed to analyze code. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const letAISeniorFix = async () => {
    if (!code.trim()) {
      toast.error("Please enter some code first");
      return;
    }

    setIsFixing(true);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/fix-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          code, 
          language, 
          bugs, 
          skill_level: skillLevel,
          apply_inline_comments: skillLevel === "beginner" || skillLevel === "intermediate"
        }),
      });

      if (!response.ok) throw new Error("Fix failed");

      const data = await response.json();
      setFixedCode(data.fixed_code);
      setFixExplanation(data.explanation);
      setChangesMade(data.changes_made || []);
      setShowSplitView(true);
      setProactiveWarning(null);
      toast.success("AI Senior has fixed your code!");

      // Store in session memory
      addToSessionMemory({
        type: "fix",
        original: code,
        fixed: data.fixed_code,
        changes: data.changes_made,
      });
    } catch (error) {
      console.error("Fix error:", error);
      toast.error("Failed to fix code. Please try again.");
    } finally {
      setIsFixing(false);
    }
  };

  const applyFix = () => {
    if (fixedCode) {
      setCode(fixedCode);
      setShowSplitView(false);
      setFixedCode("");
      setBugs([]);
      setOverallQuality("good");
      toast.success("Fixed code applied!");
    }
  };

  const copyFixedCode = async () => {
    if (fixedCode) {
      await navigator.clipboard.writeText(fixedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Code copied to clipboard!");
    }
  };

  const handleTeachMe = (bug) => {
    setSelectedBug(bug);
    setShowTeaching(true);
  };

  const handleHelpWithSelection = () => {
    if (selectedLines.length > 0) {
      setShowLineMentoring(true);
    } else {
      toast.info("Select some lines first (click and drag), then click 'Help with this'");
    }
  };

  const executeCode = async () => {
    if (!code.trim()) {
      toast.error("Please enter some code first");
      return;
    }

    if (!["python", "javascript"].includes(language)) {
      toast.error("Execution currently supports Python and JavaScript only");
      return;
    }

    setIsExecuting(true);
    setShowExecution(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/execute-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, skill_level: skillLevel }),
      });

      if (!response.ok) throw new Error("Execution failed");

      const data = await response.json();
      setExecutionResult(data);

      if (data.error) {
        toast.error("Code execution had errors");
      } else {
        toast.success("Code executed successfully!");
      }
    } catch (error) {
      console.error("Execution error:", error);
      toast.error("Failed to execute code");
    } finally {
      setIsExecuting(false);
    }
  };

  const applyProactiveFix = () => {
    if (proactiveWarning?.quick_fix) {
      // Simple fix application - in production would be smarter
      toast.info(`Suggested fix: ${proactiveWarning.quick_fix}`);
    }
  };

  const getSeverityBadge = (severity) => {
    const classes = {
      critical: "badge-critical",
      warning: "badge-warning",
      info: "badge-info",
    };
    return `px-2 py-0.5 rounded-full text-xs font-medium ${classes[severity] || classes.info}`;
  };

  const getQualityColor = (quality) => {
    const colors = {
      good: "quality-good",
      fair: "quality-fair",
      poor: "quality-poor",
    };
    return colors[quality] || "text-white/60";
  };

  return (
    <div data-testid="code-learning-view" className="h-full">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Language Select */}
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger data-testid="language-select" className="w-36 bg-white/5 border-white/10">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Skill Level Select */}
          <Select value={skillLevel} onValueChange={setSkillLevel}>
            <SelectTrigger data-testid="skill-level-select" className="w-44 bg-white/5 border-white/10">
              <SelectValue placeholder="Skill Level" />
            </SelectTrigger>
            <SelectContent>
              {SKILL_LEVELS.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  <div className="flex flex-col">
                    <span>{level.label}</span>
                    <span className="text-xs text-white/50">{level.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Proactive Mentor Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setProactiveMentorEnabled(!proactiveMentorEnabled)}
            className={`gap-2 ${proactiveMentorEnabled ? 'text-[#34A853]' : 'text-white/50'}`}
          >
            {proactiveMentorEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            Mentor Watch
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Project Upload */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowProjectUpload(true)}
            className="gap-2 text-white/70 hover:text-white"
          >
            <Upload className="w-4 h-4" />
            Upload Project
          </Button>

          {/* Learning Journey */}
          {learningJourney && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLearningJourney(true)}
              className="gap-2 text-[#667eea]"
            >
              <BookOpen className="w-4 h-4" />
              Learning Journey
            </Button>
          )}

          {/* Help with Selection */}
          <Button
            onClick={handleHelpWithSelection}
            disabled={selectedLines.length === 0}
            variant="outline"
            size="sm"
            className="gap-2 border-[#667eea] text-[#667eea] hover:bg-[#667eea]/10 disabled:opacity-50"
          >
            <HelpCircle className="w-4 h-4" />
            Help with this line
            {selectedLines.length > 0 && (
              <span className="ml-1 text-xs bg-[#667eea]/20 px-1.5 rounded">
                L{selectedLines[0]}{selectedLines.length > 1 ? `-${selectedLines[selectedLines.length - 1]}` : ''}
              </span>
            )}
          </Button>

          {/* Run Code */}
          {["python", "javascript"].includes(language) && (
            <Button
              onClick={executeCode}
              disabled={isExecuting}
              variant="outline"
              size="sm"
              className="gap-2 border-[#FBBC04] text-[#FBBC04] hover:bg-[#FBBC04]/10"
            >
              <Terminal className="w-4 h-4" />
              Run Code
            </Button>
          )}

          {/* Analyze */}
          <Button
            data-testid="analyze-code-btn"
            onClick={analyzeCode}
            disabled={isAnalyzing}
            className="btn-primary gap-2"
          >
            {isAnalyzing ? (
              <>
                <span className="loading-dots">
                  <span className="inline-block w-1 h-1 bg-white rounded-full mx-0.5 animate-bounce"></span>
                  <span className="inline-block w-1 h-1 bg-white rounded-full mx-0.5 animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                  <span className="inline-block w-1 h-1 bg-white rounded-full mx-0.5 animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                </span>
                Analyzing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Analyze
              </>
            )}
          </Button>

          {/* AI Senior Fix */}
          <Button
            data-testid="ai-senior-fix-btn"
            onClick={letAISeniorFix}
            disabled={isFixing || isAnalyzing}
            className="btn-secondary gap-2 border-[#34A853] text-[#34A853] hover:bg-[#34A853]/10"
          >
            {isFixing ? (
              <>
                <span className="loading-dots">
                  <span className="inline-block w-1 h-1 bg-[#34A853] rounded-full mx-0.5 animate-bounce"></span>
                  <span className="inline-block w-1 h-1 bg-[#34A853] rounded-full mx-0.5 animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                  <span className="inline-block w-1 h-1 bg-[#34A853] rounded-full mx-0.5 animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                </span>
                Fixing...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                AI Senior Fix
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Proactive Warning Banner */}
      {proactiveWarning && (
        <div className={`mb-4 p-3 rounded-xl flex items-center justify-between gap-3 animate-slideDown ${
          proactiveWarning.severity === 'critical' ? 'bg-[#EA4335]/20 border border-[#EA4335]/30' :
          proactiveWarning.severity === 'warning' ? 'bg-[#FBBC04]/20 border border-[#FBBC04]/30' :
          'bg-[#4285F4]/20 border border-[#4285F4]/30'
        }`}>
          <div className="flex items-center gap-3">
            <AlertTriangle className={`w-5 h-5 ${
              proactiveWarning.severity === 'critical' ? 'text-[#EA4335]' :
              proactiveWarning.severity === 'warning' ? 'text-[#FBBC04]' :
              'text-[#4285F4]'
            }`} />
            <div>
              <p className="text-sm font-medium">{proactiveWarning.issue_type?.replace('_', ' ').toUpperCase()}</p>
              <p className="text-xs text-white/70">{proactiveWarning.message}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {proactiveWarning.quick_fix && (
              <Button size="sm" variant="ghost" onClick={applyProactiveFix} className="text-xs">
                <Zap className="w-3 h-3 mr-1" />
                Quick Fix
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setProactiveWarning(null)} className="text-xs text-white/50">
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <div className={`grid gap-6 h-full ${showSplitView ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
        {/* Editor Panel */}
        <div className="flex flex-col gap-4">
          {/* Split View: Original + Fixed Code */}
          {showSplitView ? (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[400px]">
              {/* Original Code */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-2 px-2">
                  <div className="w-3 h-3 rounded-full bg-[#EA4335]"></div>
                  <span className="text-sm font-medium text-white/70">Your Code (with bugs)</span>
                </div>
                <div className="monaco-container flex-1 rounded-2xl border-[#EA4335]/30">
                  <Editor
                    height="100%"
                    language={language}
                    value={code}
                    onChange={(value) => setCode(value || "")}
                    theme="vs-dark"
                    options={{
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', monospace",
                      minimap: { enabled: false },
                      padding: { top: 12, bottom: 12 },
                      scrollBeyondLastLine: false,
                      readOnly: false,
                      lineNumbers: "on",
                    }}
                  />
                </div>
              </div>

              {/* Fixed Code */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2 px-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#34A853]"></div>
                    <span className="text-sm font-medium text-white/70">AI Senior's Fix (error-free)</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      data-testid="copy-fixed-code-btn"
                      onClick={copyFixedCode}
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </Button>
                    <Button
                      data-testid="apply-fix-btn"
                      onClick={applyFix}
                      size="sm"
                      className="h-7 px-3 text-xs bg-[#34A853] hover:bg-[#2d8f47]"
                    >
                      Apply Fix
                    </Button>
                  </div>
                </div>
                <div className="monaco-container flex-1 rounded-2xl border-[#34A853]/30">
                  <Editor
                    height="100%"
                    language={language}
                    value={fixedCode}
                    theme="vs-dark"
                    options={{
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', monospace",
                      minimap: { enabled: false },
                      padding: { top: 12, bottom: 12 },
                      scrollBeyondLastLine: false,
                      readOnly: true,
                      lineNumbers: "on",
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div 
              data-testid="code-editor-container"
              className="monaco-container flex-1 min-h-[400px] lg:min-h-[500px] editor-glow rounded-2xl"
            >
              <Editor
                height="100%"
                language={language}
                value={code}
                onChange={(value) => setCode(value || "")}
                onMount={handleEditorDidMount}
                theme="vs-dark"
                options={{
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', monospace",
                  minimap: { enabled: false },
                  padding: { top: 16, bottom: 16 },
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                  lineNumbers: "on",
                  renderLineHighlight: "all",
                  bracketPairColorization: { enabled: true },
                  glyphMargin: true,
                }}
              />
              
              {/* Inline Code Help Popup */}
              {showCodeHelpPopup && selectedLines.length > 0 && (
                <div 
                  className="absolute z-50 animate-slideUp"
                  style={{ 
                    left: `${popupPosition.x}px`, 
                    top: `${popupPosition.y}px`,
                    pointerEvents: 'auto'
                  }}
                >
                  <div className="bg-gradient-to-br from-[#667eea]/95 to-[#764ba2]/95 backdrop-blur-sm rounded-lg shadow-2xl p-3 flex items-center gap-2 border border-white/20">
                    <HelpCircle className="w-4 h-4 text-white" />
                    <button
                      onClick={() => {
                        setShowLineMentoring(true);
                        setShowCodeHelpPopup(false);
                      }}
                      className="text-sm font-medium text-white hover:text-yellow-300 transition-colors"
                    >
                      Need help with this line?
                    </button>
                    <button
                      onClick={() => setShowCodeHelpPopup(false)}
                      className="ml-2 text-white/60 hover:text-white transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fix Explanation */}
          {showSplitView && fixExplanation && (
            <div className="glass-light rounded-xl p-4 animate-slideUp">
              <h3 className="font-semibold text-[#34A853] mb-2 flex items-center gap-2">
                <Wand2 className="w-4 h-4" />
                What AI Senior Fixed:
              </h3>
              <p className="text-white/80 text-sm mb-3">{fixExplanation}</p>
              {changesMade.length > 0 && (
                <ul className="space-y-1">
                  {changesMade.map((change, i) => (
                    <li key={i} className="text-xs text-white/60 flex items-start gap-2">
                      <span className="text-[#34A853]">✓</span>
                      {change}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Code Execution Panel */}
          {showExecution && (
            <CodeExecutionPanel 
              result={executionResult}
              isExecuting={isExecuting}
              onClose={() => setShowExecution(false)}
              onApplyFix={(fix) => {
                // Apply fix suggestion
                toast.info(`Suggested: ${fix}`);
              }}
            />
          )}
        </div>

        {/* Results Panel - Hidden in split view */}
        {!showSplitView && (
          <div 
            data-testid="analysis-results-panel"
            className="glass-heavy rounded-2xl p-6 flex flex-col"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Bug className="w-5 h-5 text-[#667eea]" />
                Analysis Results
              </h2>
              {overallQuality && (
                <span data-testid="quality-badge" className={`text-sm font-medium ${getQualityColor(overallQuality)}`}>
                  Quality: {overallQuality.charAt(0).toUpperCase() + overallQuality.slice(1)}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {bugs.length === 0 ? (
                <div 
                  data-testid="no-bugs-message"
                  className="h-full flex flex-col items-center justify-center text-center text-white/50"
                >
                  <Sparkles className="w-12 h-12 mb-4 text-[#667eea]/50" />
                  <p className="text-lg font-medium mb-2">No issues found yet</p>
                  <p className="text-sm">Paste your code and click "Analyze" to get started</p>
                  <p className="text-xs mt-4 text-white/30">Or click "AI Senior Fix" to auto-fix any issues</p>
                  <div className="mt-6 text-xs text-white/40">
                    <p>💡 Tip: Select lines and press <kbd className="px-1.5 py-0.5 bg-white/10 rounded">Ctrl/Cmd + H</kbd> for help</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {bugs.map((bug, index) => (
                    <div
                      key={index}
                      data-testid={`bug-item-${index}`}
                      className="bug-item glass-light rounded-xl p-4 cursor-pointer"
                      onClick={() => handleTeachMe(bug)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={getSeverityBadge(bug.severity)}>
                              {bug.severity}
                            </span>
                            <span className="text-xs text-white/40">Line {bug.line}</span>
                          </div>
                          <p className="text-sm text-white/80 mb-2">{bug.message}</p>
                          <p className="text-xs text-white/50">{bug.suggestion}</p>
                        </div>
                        <button
                          data-testid={`teach-me-btn-${index}`}
                          className="flex items-center gap-1 text-[#667eea] text-sm font-medium hover:underline shrink-0"
                        >
                          Teach Me <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Quick Fix Button */}
                  <div className="pt-4 border-t border-white/10">
                    <Button
                      data-testid="quick-fix-all-btn"
                      onClick={letAISeniorFix}
                      disabled={isFixing}
                      className="w-full btn-secondary border-[#34A853] text-[#34A853] hover:bg-[#34A853]/10 gap-2"
                    >
                      <Wand2 className="w-4 h-4" />
                      Fix All Issues with AI Senior
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Teaching Overlay */}
      {showTeaching && selectedBug && (
        <TeachingOverlay
          code={code}
          bug={selectedBug}
          skillLevel={skillLevel}
          onClose={() => {
            setShowTeaching(false);
            setSelectedBug(null);
          }}
        />
      )}

      {/* Line Mentoring Panel */}
      {showLineMentoring && selectedLines.length > 0 && (
        <LineMentoringPanel
          code={code}
          language={language}
          selectedLines={selectedLines}
          skillLevel={skillLevel}
          onClose={() => setShowLineMentoring(false)}
          onApplyFix={(newCode) => {
            // Apply the suggested fix for selected lines
            const lines = code.split('\n');
            // For now, just show the suggestion
            toast.success("Review the suggestion and apply manually if helpful");
          }}
        />
      )}

      {/* Project Upload Modal */}
      {showProjectUpload && (
        <ProjectUploadModal
          onClose={() => setShowProjectUpload(false)}
          onProjectLoaded={(projectData) => {
            setShowProjectUpload(false);
            
            // If there's a project with entry points, load the first file
            if (projectData && projectData.entry_points && projectData.entry_points.length > 0) {
              const entryFile = projectData.entry_points[0];
              const entryPath = typeof entryFile === 'string' ? entryFile : entryFile.file;
              
              // Fetch and load the entry file content
              fetch(`${BACKEND_URL}/api/project/${projectData.project_id}/file?path=${encodeURIComponent(entryPath)}`)
                .then(res => res.json())
                .then(data => {
                  setCode(data.content || '// File loaded - start coding!');
                  setLanguage(data.language || 'javascript');
                  toast.success(`Loaded: ${entryPath} - Start coding!`);
                })
                .catch(() => {
                  toast.error('Failed to load entry file');
                });
            } else {
              // Fallback: just show learning journey
              setShowLearningJourney(true);
            }
          }}
        />
      )}

      {/* Learning Journey Panel */}
      {showLearningJourney && (
        <LearningJourneyPanel
          onClose={() => setShowLearningJourney(false)}
          onLoadFile={(content, lang) => {
            setCode(content);
            setLanguage(lang);
            setShowLearningJourney(false);
          }}
        />
      )}
    </div>
  );
};

export default CodeLearningView;

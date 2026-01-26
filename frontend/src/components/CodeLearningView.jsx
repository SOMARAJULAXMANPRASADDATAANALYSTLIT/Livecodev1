import { useState } from "react";
import Editor from "@monaco-editor/react";
import { Play, Bug, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import TeachingOverlay from "@/components/TeachingOverlay";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const LANGUAGES = [
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
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
  const [code, setCode] = useState(DEFAULT_CODE);
  const [language, setLanguage] = useState("python");
  const [bugs, setBugs] = useState([]);
  const [overallQuality, setOverallQuality] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedBug, setSelectedBug] = useState(null);
  const [showTeaching, setShowTeaching] = useState(false);

  const analyzeCode = async () => {
    if (!code.trim()) {
      toast.error("Please enter some code to analyze");
      return;
    }

    setIsAnalyzing(true);
    setBugs([]);
    setOverallQuality(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/analyze-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
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

  const handleTeachMe = (bug) => {
    setSelectedBug(bug);
    setShowTeaching(true);
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
        {/* Editor Panel */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger 
                data-testid="language-select"
                className="w-40 bg-white/5 border-white/10"
              >
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

            <Button
              data-testid="analyze-code-btn"
              onClick={analyzeCode}
              disabled={isAnalyzing}
              className="btn-primary gap-2"
            >
              {isAnalyzing ? (
                <>
                  <span className="loading-dots">
                    <span className="inline-block w-1 h-1 bg-white rounded-full mx-0.5"></span>
                    <span className="inline-block w-1 h-1 bg-white rounded-full mx-0.5"></span>
                    <span className="inline-block w-1 h-1 bg-white rounded-full mx-0.5"></span>
                  </span>
                  Analyzing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Analyze My Code
                </>
              )}
            </Button>
          </div>

          <div 
            data-testid="code-editor-container"
            className="monaco-container flex-1 min-h-[400px] lg:min-h-[500px] editor-glow rounded-2xl"
          >
            <Editor
              height="100%"
              language={language}
              value={code}
              onChange={(value) => setCode(value || "")}
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
              }}
            />
          </div>
        </div>

        {/* Results Panel */}
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
                <p className="text-sm">Paste your code and click "Analyze My Code" to get started</p>
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Teaching Overlay */}
      {showTeaching && selectedBug && (
        <TeachingOverlay
          code={code}
          bug={selectedBug}
          onClose={() => {
            setShowTeaching(false);
            setSelectedBug(null);
          }}
        />
      )}
    </div>
  );
};

export default CodeLearningView;

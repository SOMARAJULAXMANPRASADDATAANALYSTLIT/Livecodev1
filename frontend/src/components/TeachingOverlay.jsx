import React, { useState, useEffect } from "react";
import { X, ChevronDown, ChevronUp, CheckCircle, Loader2, BookOpen, Lightbulb, AlertTriangle, HelpCircle, Image, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const DIAGRAM_TYPES = [
  { value: "flowchart", label: "Flowchart", description: "Step-by-step logic flow" },
  { value: "state_flow", label: "State Flow", description: "State changes and transitions" },
  { value: "async_timeline", label: "Timeline", description: "Async operations timeline" },
  { value: "data_flow", label: "Data Flow", description: "How data moves through code" },
  { value: "memory_model", label: "Memory", description: "Stack and heap visualization" },
  { value: "sequence", label: "Sequence", description: "Function call sequence" },
];

const TeachingOverlay = ({ code, bug, skillLevel = "intermediate", onClose }) => {
  const [teaching, setTeaching] = useState(null);
  const [deeperExplanation, setDeeperExplanation] = useState(null);
  const [svgDiagram, setSvgDiagram] = useState(null);
  const [showDeeper, setShowDeeper] = useState(false);
  const [isLoadingTeaching, setIsLoadingTeaching] = useState(true);
  const [isLoadingDeeper, setIsLoadingDeeper] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [studentAnswer, setStudentAnswer] = useState("");
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  
  // Enhanced features
  const [selectedDiagramType, setSelectedDiagramType] = useState("flowchart");
  const [isLoadingDiagram, setIsLoadingDiagram] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState(null);
  const [smartQuestion, setSmartQuestion] = useState(null);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);

  useEffect(() => {
    fetchTeaching();
  }, []);

  const fetchTeaching = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/generate-teaching`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          bug: { line: bug.line, message: bug.message },
          mentorStyle: "patient",
          skill_level: skillLevel,
        }),
      });

      if (!response.ok) throw new Error("Failed to get teaching");
      const data = await response.json();
      setTeaching(data);
    } catch (error) {
      console.error("Teaching error:", error);
      toast.error("Failed to load explanation");
    } finally {
      setIsLoadingTeaching(false);
    }
  };

  const fetchDeeperExplanation = async () => {
    if (!teaching) return;
    
    setIsLoadingDeeper(true);
    setShowDeeper(true);

    try {
      // Fetch deeper explanation
      const deeperResponse = await fetch(`${BACKEND_URL}/api/generate-deeper-explanation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptName: teaching.conceptName,
          currentExplanation: teaching.naturalExplanation,
          skill_level: skillLevel,
        }),
      });

      if (deeperResponse.ok) {
        const deeperData = await deeperResponse.json();
        setDeeperExplanation(deeperData);
      }

      // Fetch visual diagram with selected type
      await fetchDiagram(selectedDiagramType);
    } catch (error) {
      console.error("Deeper explanation error:", error);
      toast.error("Failed to load deeper explanation");
    } finally {
      setIsLoadingDeeper(false);
    }
  };

  const fetchDiagram = async (diagramType) => {
    if (!teaching) return;
    
    setIsLoadingDiagram(true);
    try {
      const diagramResponse = await fetch(`${BACKEND_URL}/api/generate-visual-diagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptName: teaching.conceptName,
          diagramType: diagramType,
          code,
          explanation: teaching.naturalExplanation,
          skill_level: skillLevel,
        }),
      });

      if (diagramResponse.ok) {
        const diagramData = await diagramResponse.json();
        setSvgDiagram(diagramData.svg);
      }
    } catch (error) {
      console.error("Diagram error:", error);
      toast.error("Failed to generate diagram");
    } finally {
      setIsLoadingDiagram(false);
    }
  };

  const handleDiagramTypeChange = (type) => {
    setSelectedDiagramType(type);
    if (showDeeper && teaching) {
      fetchDiagram(type);
    }
  };

  const handleEvaluate = async () => {
    if (!studentAnswer.trim() || !teaching) return;

    setIsEvaluating(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/evaluate-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `Explain the concept: ${teaching.conceptName}`,
          studentAnswer,
          correctConcept: teaching.naturalExplanation,
          skill_level: skillLevel,
        }),
      });

      if (!response.ok) throw new Error("Evaluation failed");
      const data = await response.json();
      setEvaluationResult(data);

      if (data.understood) {
        toast.success("Great job! You understood the concept!");
      }

      // If there's a follow-up question, show it
      if (data.follow_up_question) {
        setFollowUpQuestion(data.follow_up_question);
      }
    } catch (error) {
      console.error("Evaluation error:", error);
      toast.error("Failed to evaluate answer");
    } finally {
      setIsEvaluating(false);
    }
  };

  const generateSmartQuestion = async () => {
    if (!teaching) return;

    setIsLoadingQuestion(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/generate-smart-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept_taught: teaching.conceptName,
          skill_level: skillLevel,
          previous_questions: smartQuestion ? [smartQuestion.question] : [],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSmartQuestion(data);
      }
    } catch (error) {
      console.error("Smart question error:", error);
      toast.error("Failed to generate question");
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  const getSkillLevelBadge = () => {
    const colors = {
      beginner: "bg-green-500/20 text-green-400",
      intermediate: "bg-blue-500/20 text-blue-400",
      advanced: "bg-purple-500/20 text-purple-400",
      senior: "bg-orange-500/20 text-orange-400",
    };
    return colors[skillLevel] || colors.intermediate;
  };

  return (
    <div 
      data-testid="teaching-overlay"
      className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4 animate-fadeIn"
    >
      <div 
        className="teaching-card w-full max-w-2xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10 animate-slideUp"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {isLoadingTeaching ? "Loading..." : teaching?.conceptName || "Understanding the Bug"}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-white/50">Line {bug.line}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${getSkillLevelBadge()}`}>
                  {skillLevel}
                </span>
              </div>
            </div>
          </div>
          <button
            data-testid="close-teaching-btn"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-6">
          {isLoadingTeaching ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#667eea] mb-4" />
              <p className="text-white/60">Preparing your lesson...</p>
            </div>
          ) : teaching ? (
            <div className="space-y-6">
              {/* Main Explanation */}
              <div className="glass-light rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-[#FBBC04]" />
                  <h3 className="font-semibold">What's happening?</h3>
                </div>
                <p className="text-white/80 leading-relaxed">{teaching.naturalExplanation}</p>
              </div>

              {/* Why It Matters */}
              <div className="glass-light rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-[#EA4335]" />
                  <h3 className="font-semibold">Why this matters</h3>
                </div>
                <p className="text-white/80 leading-relaxed">{teaching.whyItMatters}</p>
              </div>

              {/* Common Mistake */}
              <div className="glass-light rounded-xl p-4">
                <h3 className="font-semibold mb-2 text-[#4285F4]">Common Mistake</h3>
                <p className="text-white/70 text-sm">{teaching.commonMistake}</p>
              </div>

              {/* Show More Section */}
              <div>
                <button
                  data-testid="show-more-btn"
                  onClick={() => showDeeper ? setShowDeeper(false) : fetchDeeperExplanation()}
                  disabled={isLoadingDeeper}
                  className="flex items-center gap-2 text-[#667eea] font-medium hover:underline"
                >
                  {isLoadingDeeper ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : showDeeper ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  {showDeeper ? "Show Less" : "Show More & Visual Explanation"}
                </button>

                {showDeeper && (
                  <div className="mt-4 space-y-4 animate-slideUp">
                    {deeperExplanation && (
                      <>
                        <div className="glass-light rounded-xl p-4">
                          <h3 className="font-semibold mb-3">Deeper Explanation</h3>
                          <div className="text-white/80 prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown>{deeperExplanation.deeperExplanation}</ReactMarkdown>
                          </div>
                        </div>

                        {deeperExplanation.codeExamples?.length > 0 && (
                          <div className="glass-light rounded-xl p-4">
                            <h3 className="font-semibold mb-3">Code Examples</h3>
                            <div className="space-y-2">
                              {deeperExplanation.codeExamples.map((example, i) => (
                                <pre key={i} className="bg-black/30 rounded-lg p-3 text-sm overflow-x-auto">
                                  <code>{example}</code>
                                </pre>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Visual Diagram with Type Selection */}
                    <div className="glass-light rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Image className="w-5 h-5 text-[#667eea]" />
                          <h3 className="font-semibold">Visual Explanation</h3>
                        </div>
                        <Select value={selectedDiagramType} onValueChange={handleDiagramTypeChange}>
                          <SelectTrigger className="w-36 h-8 text-xs bg-white/5 border-white/10">
                            <SelectValue placeholder="Diagram type" />
                          </SelectTrigger>
                          <SelectContent>
                            {DIAGRAM_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                <div>
                                  <span>{type.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {isLoadingDiagram ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-[#667eea]" />
                        </div>
                      ) : svgDiagram ? (
                        <div 
                          data-testid="svg-diagram"
                          className="diagram-container bg-black/20 rounded-xl p-4 overflow-auto"
                          dangerouslySetInnerHTML={{ __html: svgDiagram }}
                        />
                      ) : (
                        <p className="text-white/50 text-center py-4">No diagram available</p>
                      )}
                    </div>

                    {deeperExplanation?.relatedConcepts?.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <span className="text-sm text-white/50">Related:</span>
                        {deeperExplanation.relatedConcepts.map((concept, i) => (
                          <span key={i} className="px-3 py-1 rounded-full text-xs bg-white/10 text-white/70">
                            {concept}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Smart Question Section */}
              <div className="border-t border-white/10 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setShowEvaluation(!showEvaluation)}
                    className="text-sm text-white/60 hover:text-white flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Check my understanding
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={generateSmartQuestion}
                    disabled={isLoadingQuestion}
                    className="text-xs text-[#667eea]"
                  >
                    {isLoadingQuestion ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Sparkles className="w-3 h-3 mr-1" />
                    )}
                    Quiz Me
                  </Button>
                </div>

                {/* Smart Question Display */}
                {smartQuestion && (
                  <div className="mb-4 glass-light rounded-xl p-4 border border-[#667eea]/30">
                    <div className="flex items-center gap-2 mb-2">
                      <HelpCircle className="w-4 h-4 text-[#667eea]" />
                      <span className="text-xs text-white/50">
                        {smartQuestion.difficulty} question
                      </span>
                    </div>
                    <p className="text-sm font-medium mb-3">{smartQuestion.question}</p>
                    <details className="text-xs text-white/50">
                      <summary className="cursor-pointer hover:text-white/70">Show hints</summary>
                      <ul className="mt-2 space-y-1 pl-4">
                        {smartQuestion.expected_answer_hints?.map((hint, i) => (
                          <li key={i}>• {hint}</li>
                        ))}
                      </ul>
                    </details>
                  </div>
                )}

                {showEvaluation && (
                  <div className="mt-4 space-y-3 animate-slideUp">
                    <p className="text-sm text-white/70">
                      {followUpQuestion || `Explain in your own words what you learned about ${teaching.conceptName}:`}
                    </p>
                    <Textarea
                      data-testid="student-answer-input"
                      value={studentAnswer}
                      onChange={(e) => setStudentAnswer(e.target.value)}
                      placeholder="Type your explanation here..."
                      className="bg-white/5 border-white/10 min-h-[100px]"
                    />
                    <Button
                      data-testid="submit-answer-btn"
                      onClick={handleEvaluate}
                      disabled={isEvaluating || !studentAnswer.trim()}
                      className="btn-secondary"
                    >
                      {isEvaluating ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Check Answer
                    </Button>

                    {evaluationResult && (
                      <div className={`rounded-xl p-4 ${evaluationResult.understood ? 'bg-green-500/10 border border-green-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
                        <p className="font-medium mb-1">{evaluationResult.understood ? '✅ Great job!' : '💡 Keep trying!'}</p>
                        <p className="text-sm text-white/80">{evaluationResult.feedback}</p>
                        <p className="text-sm text-white/60 mt-2">{evaluationResult.encouragement}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-white/60 text-center py-8">Failed to load explanation</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10">
          <Button
            data-testid="got-it-btn"
            onClick={onClose}
            className="w-full btn-primary"
          >
            Got It! ✨
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TeachingOverlay;

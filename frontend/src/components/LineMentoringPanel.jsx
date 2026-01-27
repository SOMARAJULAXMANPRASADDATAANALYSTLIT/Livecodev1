import React, { useState, useEffect } from "react";
import { X, Loader2, Lightbulb, AlertTriangle, CheckCircle, Code, BookOpen, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const LineMentoringPanel = ({ code, language, selectedLines, skillLevel, onClose, onApplyFix }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [mentoring, setMentoring] = useState(null);
  const [question, setQuestion] = useState("");
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);

  useEffect(() => {
    fetchMentoring();
  }, []);

  const fetchMentoring = async (customQuestion = null) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/line-mentoring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language,
          selected_lines: selectedLines,
          skill_level: skillLevel,
          question: customQuestion,
        }),
      });

      if (!response.ok) throw new Error("Failed to get mentoring");
      const data = await response.json();
      setMentoring(data);
    } catch (error) {
      console.error("Line mentoring error:", error);
      toast.error("Failed to get help for selected lines");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim()) return;
    setIsAskingQuestion(true);
    await fetchMentoring(question);
    setIsAskingQuestion(false);
    setQuestion("");
  };

  const getSelectedCode = () => {
    const lines = code.split('\n');
    return selectedLines.map(lineNum => lines[lineNum - 1] || '').join('\n');
  };

  return (
    <div className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4 animate-fadeIn">
      <div className="teaching-card w-full max-w-3xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10 animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#667eea] to-[#764ba2] flex items-center justify-center">
              <Code className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Line-by-Line Mentoring</h2>
              <p className="text-xs text-white/50">
                Lines {selectedLines[0]}{selectedLines.length > 1 ? `-${selectedLines[selectedLines.length - 1]}` : ''} • {skillLevel} level
              </p>
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
        <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
          {/* Selected Code Preview */}
          <div className="mb-6 glass-light rounded-xl p-4">
            <h3 className="text-sm font-medium text-white/60 mb-2">Selected Code:</h3>
            <pre className="bg-black/30 rounded-lg p-3 text-sm overflow-x-auto">
              <code className="text-[#4285F4]">{getSelectedCode()}</code>
            </pre>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#667eea] mb-4" />
              <p className="text-white/60">Analyzing selected lines...</p>
            </div>
          ) : mentoring ? (
            <div className="space-y-4">
              {/* What it does */}
              <div className="glass-light rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-[#FBBC04]" />
                  <h3 className="font-semibold">What This Does</h3>
                </div>
                <p className="text-white/80 leading-relaxed">{mentoring.what_it_does}</p>
              </div>

              {/* Explanation */}
              <div className="glass-light rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-5 h-5 text-[#4285F4]" />
                  <h3 className="font-semibold">Explanation</h3>
                </div>
                <div className="text-white/80 prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{mentoring.explanation}</ReactMarkdown>
                </div>
              </div>

              {/* Potential Issues */}
              {mentoring.potential_issues?.length > 0 && (
                <div className="glass-light rounded-xl p-4 border border-[#EA4335]/30">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-[#EA4335]" />
                    <h3 className="font-semibold">Potential Issues</h3>
                  </div>
                  <ul className="space-y-2">
                    {mentoring.potential_issues.map((issue, i) => (
                      <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                        <span className="text-[#EA4335]">•</span>
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Improvement Suggestions */}
              {mentoring.improvement_suggestions?.length > 0 && (
                <div className="glass-light rounded-xl p-4 border border-[#34A853]/30">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-[#34A853]" />
                    <h3 className="font-semibold">Suggestions</h3>
                  </div>
                  <ul className="space-y-2">
                    {mentoring.improvement_suggestions.map((suggestion, i) => (
                      <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                        <span className="text-[#34A853]">✓</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Corrected Code */}
              {mentoring.corrected_code && (
                <div className="glass-light rounded-xl p-4 border border-[#34A853]/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-5 h-5 text-[#34A853]" />
                      <h3 className="font-semibold">Improved Version</h3>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => onApplyFix(mentoring.corrected_code)}
                      className="bg-[#34A853] hover:bg-[#2d8f47] text-xs"
                    >
                      Apply Fix
                    </Button>
                  </div>
                  <pre className="bg-black/30 rounded-lg p-3 text-sm overflow-x-auto">
                    <code className="text-[#34A853]">{mentoring.corrected_code}</code>
                  </pre>
                </div>
              )}

              {/* Teaching Points */}
              {mentoring.teaching_points?.length > 0 && (
                <div className="glass-light rounded-xl p-4">
                  <h3 className="font-semibold mb-3 text-[#667eea]">Key Learning Points</h3>
                  <ul className="space-y-2">
                    {mentoring.teaching_points.map((point, i) => (
                      <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                        <span className="text-[#667eea]">📚</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Ask a Question */}
              <div className="border-t border-white/10 pt-4">
                <h3 className="text-sm font-medium text-white/60 mb-2">Have a specific question?</h3>
                <div className="flex gap-2">
                  <Textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask about these lines..."
                    className="bg-white/5 border-white/10 min-h-[60px] flex-1"
                  />
                  <Button
                    onClick={handleAskQuestion}
                    disabled={isAskingQuestion || !question.trim()}
                    className="btn-primary"
                  >
                    {isAskingQuestion ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ask"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-white/60 text-center py-8">Failed to load explanation</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10">
          <Button onClick={onClose} className="w-full btn-secondary">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LineMentoringPanel;

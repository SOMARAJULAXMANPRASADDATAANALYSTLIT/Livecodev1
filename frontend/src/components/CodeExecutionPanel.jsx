import React from "react";
import { X, Loader2, Terminal, AlertCircle, CheckCircle, Clock, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

const CodeExecutionPanel = ({ result, isExecuting, onClose, onApplyFix }) => {
  return (
    <div className="glass-light rounded-xl p-4 animate-slideUp">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-[#FBBC04]" />
          <h3 className="font-semibold">Code Execution</h3>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10">
          <X className="w-4 h-4" />
        </button>
      </div>

      {isExecuting ? (
        <div className="flex items-center gap-3 py-4">
          <Loader2 className="w-5 h-5 animate-spin text-[#FBBC04]" />
          <span className="text-white/70">Running code...</span>
        </div>
      ) : result ? (
        <div className="space-y-3">
          {/* Execution Time */}
          {result.execution_time !== undefined && (
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Clock className="w-3 h-3" />
              Executed in {result.execution_time.toFixed(3)}s
            </div>
          )}

          {/* Output */}
          {result.output && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-[#34A853]" />
                <span className="text-sm font-medium text-[#34A853]">Output</span>
              </div>
              <pre className="bg-black/30 rounded-lg p-3 text-sm overflow-x-auto text-white/80 max-h-[200px] overflow-y-auto">
                {result.output}
              </pre>
            </div>
          )}

          {/* Error */}
          {result.error && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-[#EA4335]" />
                <span className="text-sm font-medium text-[#EA4335]">Error</span>
              </div>
              <pre className="bg-[#EA4335]/10 border border-[#EA4335]/30 rounded-lg p-3 text-sm overflow-x-auto text-[#EA4335] max-h-[150px] overflow-y-auto">
                {result.error}
              </pre>
            </div>
          )}

          {/* Error Explanation */}
          {result.error_explanation && (
            <div className="bg-[#FBBC04]/10 border border-[#FBBC04]/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-[#FBBC04]" />
                <span className="text-sm font-medium text-[#FBBC04]">What went wrong</span>
              </div>
              <p className="text-sm text-white/80">{result.error_explanation}</p>
            </div>
          )}

          {/* Fix Suggestion */}
          {result.fix_suggestion && (
            <div className="bg-[#34A853]/10 border border-[#34A853]/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#34A853]" />
                  <span className="text-sm font-medium text-[#34A853]">How to fix it</span>
                </div>
                {onApplyFix && (
                  <Button
                    size="sm"
                    onClick={() => onApplyFix(result.fix_suggestion)}
                    className="text-xs bg-[#34A853] hover:bg-[#2d8f47]"
                  >
                    Apply
                  </Button>
                )}
              </div>
              <p className="text-sm text-white/80">{result.fix_suggestion}</p>
            </div>
          )}

          {/* Success message if no errors */}
          {!result.error && result.output && (
            <div className="text-sm text-[#34A853] flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Code executed successfully!
            </div>
          )}
        </div>
      ) : (
        <p className="text-white/50 text-sm py-4">No execution result</p>
      )}
    </div>
  );
};

export default CodeExecutionPanel;

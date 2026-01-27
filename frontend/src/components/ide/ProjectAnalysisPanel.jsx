import React from "react";
import { X, Cpu, FileCode, Folder, AlertTriangle, Lightbulb, BookOpen, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const ProjectAnalysisPanel = ({ analysis, onLoadFile, onClose }) => {
  if (!analysis) return null;
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-[#EA4335]" />
          <h3 className="font-semibold">Project Analysis</h3>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10">
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Overview */}
        <div className="p-3 rounded-lg bg-white/5">
          <h4 className="font-medium text-[#4285F4] mb-2">{analysis.project_name}</h4>
          <p className="text-sm text-white/70">{analysis.purpose}</p>
        </div>
        
        {/* Architecture */}
        <div className="p-3 rounded-lg bg-white/5">
          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
            <Folder className="w-4 h-4 text-[#FBBC04]" />
            Architecture
          </h4>
          <p className="text-sm text-white/70">{analysis.architecture_overview}</p>
        </div>
        
        {/* Entry Points */}
        {analysis.entry_points?.length > 0 && (
          <div className="p-3 rounded-lg bg-white/5">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#34A853]" />
              Entry Points
            </h4>
            <div className="space-y-2">
              {analysis.entry_points.map((ep, i) => (
                <div 
                  key={i}
                  className="flex items-center justify-between p-2 rounded bg-black/20 cursor-pointer hover:bg-black/30"
                  onClick={() => onLoadFile(ep.file)}
                >
                  <span className="text-sm text-[#4285F4]">{ep.file}</span>
                  <span className="text-xs text-white/50">{ep.purpose}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Main Modules */}
        {analysis.main_modules?.length > 0 && (
          <div className="p-3 rounded-lg bg-white/5">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-[#667eea]" />
              Main Modules
            </h4>
            <div className="space-y-2">
              {analysis.main_modules.map((mod, i) => (
                <div key={i} className="p-2 rounded bg-black/20">
                  <div className="font-medium text-sm">{mod.name}</div>
                  <div className="text-xs text-white/50">{mod.purpose}</div>
                  {mod.files && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {mod.files.slice(0, 3).map((f, j) => (
                        <span 
                          key={j}
                          className="px-2 py-0.5 text-xs bg-[#667eea]/20 rounded cursor-pointer hover:bg-[#667eea]/30"
                          onClick={() => onLoadFile(f)}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Potential Issues */}
        {analysis.potential_issues?.length > 0 && (
          <div className="p-3 rounded-lg bg-[#EA4335]/10 border border-[#EA4335]/30">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2 text-[#EA4335]">
              <AlertTriangle className="w-4 h-4" />
              Potential Issues
            </h4>
            <ul className="space-y-1">
              {analysis.potential_issues.map((issue, i) => (
                <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                  <span className="text-[#EA4335]">•</span>
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Improvement Suggestions */}
        {analysis.improvement_suggestions?.length > 0 && (
          <div className="p-3 rounded-lg bg-[#34A853]/10 border border-[#34A853]/30">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2 text-[#34A853]">
              <Lightbulb className="w-4 h-4" />
              Suggestions
            </h4>
            <ul className="space-y-1">
              {analysis.improvement_suggestions.map((sug, i) => (
                <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                  <span className="text-[#34A853]">✓</span>
                  {sug}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Learning Roadmap */}
        {analysis.learning_roadmap && (
          <div className="p-3 rounded-lg bg-white/5">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#667eea]" />
              Learning Roadmap
            </h4>
            <div className="space-y-3">
              {Object.entries(analysis.learning_roadmap).map(([level, steps]) => (
                <div key={level}>
                  <div className="text-xs font-medium text-white/50 uppercase mb-1">
                    {level}
                  </div>
                  <ol className="space-y-1">
                    {steps.slice(0, 3).map((step, i) => (
                      <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                        <span className="text-[#667eea] font-medium">{i + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Frameworks & Dependencies */}
        <div className="flex flex-wrap gap-2">
          {analysis.frameworks?.map((fw, i) => (
            <span key={i} className="px-2 py-1 text-xs bg-[#4285F4]/20 text-[#4285F4] rounded">
              {fw}
            </span>
          ))}
          {analysis.dependencies?.slice(0, 5).map((dep, i) => (
            <span key={i} className="px-2 py-1 text-xs bg-white/10 text-white/60 rounded">
              {dep}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectAnalysisPanel;

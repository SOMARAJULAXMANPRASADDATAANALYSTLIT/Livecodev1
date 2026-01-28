import React, { useState, useEffect } from "react";
import { X, BookOpen, Loader2, CheckCircle, FileCode, FolderOpen, Play, Lightbulb, ChevronRight, Code, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ANALYSIS_STAGES = [
  { key: "scanning", label: "Scanning files", icon: FileCode },
  { key: "framework", label: "Detecting framework", icon: Code },
  { key: "entrypoint", label: "Finding entry point", icon: Play },
  { key: "analyzing", label: "Analyzing architecture", icon: Brain },
  { key: "teaching", label: "Preparing teaching view", icon: BookOpen },
];

const ProjectTeachingModal = ({ projectId, projectData, onClose, skillLevel = "intermediate" }) => {
  const [currentStage, setCurrentStage] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [teachingContent, setTeachingContent] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileTeaching, setFileTeaching] = useState(null);
  const [loadingFile, setLoadingFile] = useState(false);

  useEffect(() => {
    analyzeProject();
  }, []);

  const analyzeProject = async () => {
    setIsAnalyzing(true);
    
    // Animate through stages
    for (let i = 0; i < ANALYSIS_STAGES.length; i++) {
      setCurrentStage(i);
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${projectId}/teach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          skill_level: skillLevel
        })
      });
      
      if (!response.ok) throw new Error("Analysis failed");
      
      const data = await response.json();
      setTeachingContent(data.teaching_content);
    } catch (error) {
      console.error("Teaching error:", error);
      setTeachingContent("Unable to analyze project. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileClick = async (filePath) => {
    setSelectedFile(filePath);
    setLoadingFile(true);
    setFileTeaching(null);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${projectId}/teach-file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          file_path: filePath,
          skill_level: skillLevel
        })
      });
      
      if (!response.ok) throw new Error("File analysis failed");
      
      const data = await response.json();
      setFileTeaching(data.teaching_content);
    } catch (error) {
      console.error("File teaching error:", error);
      setFileTeaching("Unable to analyze this file.");
    } finally {
      setLoadingFile(false);
    }
  };

  const renderFileTree = (node, level = 0) => {
    if (!node) return null;
    
    if (node.type === 'file') {
      return (
        <button
          key={node.path}
          onClick={() => handleFileClick(node.path)}
          className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-lg text-sm text-left w-full transition-colors"
          style={{ paddingLeft: `${level * 12 + 12}px` }}
        >
          <FileCode className="w-4 h-4 text-[#667eea]" />
          <span className={selectedFile === node.path ? "text-[#667eea] font-medium" : "text-white/70"}>
            {node.name}
          </span>
          {node.language && (
            <span className="ml-auto text-xs text-white/40">{node.language}</span>
          )}
        </button>
      );
    }
    
    if (node.type === 'directory' && node.children && node.children.length > 0) {
      return (
        <div key={node.path}>
          <div
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium"
            style={{ paddingLeft: `${level * 12 + 12}px` }}
          >
            <FolderOpen className="w-4 h-4 text-[#FBBC04]" />
            <span className="text-white/80">{node.name}</span>
          </div>
          {node.children.map(child => renderFileTree(child, level + 1))}
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-7xl max-h-[90vh] bg-[#1a1a2e] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-[#667eea]/10 to-[#764ba2]/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">AI Senior Engineer - Project Teaching</h2>
              <p className="text-sm text-white/60">{projectData?.name || "Project Analysis"}</p>
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
          {/* Left: File Tree */}
          <div className="w-80 border-r border-white/10 overflow-y-auto bg-black/20">
            <div className="p-4 border-b border-white/10">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-[#FBBC04]" />
                Project Files
              </h3>
              <p className="text-xs text-white/50">Click a file to learn about it</p>
            </div>
            <div className="p-2">
              {projectData?.root && renderFileTree(projectData.root)}
            </div>
          </div>

          {/* Right: Teaching Content */}
          <div className="flex-1 overflow-y-auto">
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center h-full p-12">
                <div className="w-24 h-24 mb-8 relative">
                  <div className="absolute inset-0 rounded-full border-4 border-[#667eea]/20"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#667eea] animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Brain className="w-10 h-10 text-[#667eea] animate-pulse" />
                  </div>
                </div>
                
                <h3 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-[#667eea] to-[#764ba2] bg-clip-text text-transparent">
                  Analyzing Your Codebase
                </h3>
                
                <div className="space-y-4 w-full max-w-md">
                  {ANALYSIS_STAGES.map((stage, index) => {
                    const StageIcon = stage.icon;
                    const isActive = index === currentStage;
                    const isComplete = index < currentStage;
                    
                    return (
                      <div
                        key={stage.key}
                        className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                          isActive ? 'bg-[#667eea]/10 border border-[#667eea]/30' : 
                          isComplete ? 'bg-white/5' : 'bg-white/[0.02]'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isComplete ? 'bg-green-500/20' : isActive ? 'bg-[#667eea]/20' : 'bg-white/5'
                        }`}>
                          {isComplete ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : isActive ? (
                            <Loader2 className="w-5 h-5 text-[#667eea] animate-spin" />
                          ) : (
                            <StageIcon className="w-5 h-5 text-white/40" />
                          )}
                        </div>
                        <span className={`font-medium ${
                          isActive ? 'text-[#667eea]' : isComplete ? 'text-green-500' : 'text-white/40'
                        }`}>
                          {stage.label}
                          {isActive && "..."}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-8">
                {!selectedFile ? (
                  <div className="prose prose-invert max-w-none">
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => (
                          <h1 className="text-3xl font-bold mb-4 flex items-center gap-3">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-2xl font-bold mt-8 mb-4 flex items-center gap-2 text-[#667eea]">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-xl font-semibold mt-6 mb-3 text-white/90">{children}</h3>
                        ),
                        p: ({ children }) => (
                          <p className="text-white/70 leading-relaxed mb-4">{children}</p>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc list-inside space-y-2 mb-4 text-white/70">{children}</ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal list-inside space-y-2 mb-4 text-white/70">{children}</ol>
                        ),
                        li: ({ children }) => (
                          <li className="ml-4 text-white/70">{children}</li>
                        ),
                        code: ({ inline, children }) =>
                          inline ? (
                            <code className="px-2 py-1 bg-[#667eea]/10 text-[#667eea] rounded text-sm font-mono">
                              {children}
                            </code>
                          ) : (
                            <code className="block p-4 bg-black/40 rounded-lg text-sm font-mono overflow-x-auto border border-white/10 text-white/80">
                              {children}
                            </code>
                          ),
                        strong: ({ children }) => (
                          <strong className="font-semibold text-white">{children}</strong>
                        ),
                      }}
                    >
                      {teachingContent}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                      <button
                        onClick={() => {
                          setSelectedFile(null);
                          setFileTeaching(null);
                        }}
                        className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
                      >
                        <ChevronRight className="w-4 h-4 rotate-180" />
                        Back to Overview
                      </button>
                    </div>
                    
                    {loadingFile ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-[#667eea]" />
                      </div>
                    ) : (
                      <div className="prose prose-invert max-w-none">
                        <ReactMarkdown
                          components={{
                            h2: ({ children }) => (
                              <h2 className="text-2xl font-bold mb-4 text-[#667eea]">{children}</h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-xl font-semibold mt-6 mb-3 text-white/90">{children}</h3>
                            ),
                            p: ({ children }) => (
                              <p className="text-white/70 leading-relaxed mb-4">{children}</p>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc list-inside space-y-2 mb-4">{children}</ul>
                            ),
                            code: ({ inline, children }) =>
                              inline ? (
                                <code className="px-2 py-1 bg-[#667eea]/10 text-[#667eea] rounded text-sm">
                                  {children}
                                </code>
                              ) : (
                                <code className="block p-4 bg-black/40 rounded-lg text-sm font-mono overflow-x-auto">
                                  {children}
                                </code>
                              ),
                          }}
                        >
                          {fileTeaching}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectTeachingModal;

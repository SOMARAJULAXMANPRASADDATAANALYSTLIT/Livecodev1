import React, { useState, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { 
  FolderOpen, Play, Bug, Sparkles, Terminal, X, RefreshCw, 
  ChevronRight, Loader2, Download, PanelRightOpen, PanelRightClose,
  FileCode, Cpu, HelpCircle, Lightbulb, BookOpen, Zap, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import FileExplorer from "./FileExplorer";
import LanguageStats from "./LanguageStats";
import ProjectAnalysisPanel from "./ProjectAnalysisPanel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const IDEWorkspace = ({ project, onNewProject }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  
  // Analysis states
  const [projectAnalysis, setProjectAnalysis] = useState(null);
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
  const [codeAnalysis, setCodeAnalysis] = useState(null);
  
  // Terminal/Output states
  const [terminalOutput, setTerminalOutput] = useState("");
  const [showTerminal, setShowTerminal] = useState(false);
  
  // Modified indicator
  const [isModified, setIsModified] = useState(false);
  
  // Auto-analyze project on load
  useEffect(() => {
    if (project?.project_id) {
      analyzeProject();
    }
  }, [project?.project_id]);
  
  const analyzeProject = async () => {
    if (!project?.project_id) return;
    
    setIsAnalyzing(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/analyze-full`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          project_id: project.project_id,
          skill_level: "intermediate" 
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setProjectAnalysis(data);
        setShowAnalysisPanel(true);
        toast.success("Project analyzed successfully!");
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Failed to analyze project");
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const loadFile = async (path) => {
    if (!project?.project_id) return;
    
    setIsLoadingFile(true);
    setSelectedFile(path);
    
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/project/${project.project_id}/file?path=${encodeURIComponent(path)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setFileContent(data.content);
        setLanguage(data.language || "plaintext");
        setIsModified(false);
        setCodeAnalysis(null);
      } else {
        throw new Error("Failed to load file");
      }
    } catch (error) {
      console.error("Load file error:", error);
      toast.error("Failed to load file");
    } finally {
      setIsLoadingFile(false);
    }
  };
  
  const saveFile = async () => {
    if (!project?.project_id || !selectedFile) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.project_id,
          path: selectedFile,
          content: fileContent,
        }),
      });
      
      if (response.ok) {
        setIsModified(false);
        toast.success("File saved!");
      } else {
        throw new Error("Save failed");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save file");
    } finally {
      setIsSaving(false);
    }
  };
  
  const analyzeCurrentFile = async () => {
    if (!fileContent.trim()) {
      toast.error("No code to analyze");
      return;
    }
    
    setIsAnalyzing(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/analyze-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: fileContent,
          language: language.toLowerCase(),
          skill_level: "intermediate",
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setCodeAnalysis(data);
        
        if (data.bugs?.length > 0) {
          toast.warning(`Found ${data.bugs.length} issue(s)`);
        } else {
          toast.success("No issues found!");
        }
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Failed to analyze code");
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const runCurrentFile = async () => {
    if (!project?.project_id || !selectedFile) {
      toast.error("Select a file first");
      return;
    }
    
    const ext = selectedFile.split('.').pop()?.toLowerCase();
    if (!['py', 'js'].includes(ext)) {
      toast.error("Can only run Python (.py) or JavaScript (.js) files");
      return;
    }
    
    setIsRunning(true);
    setShowTerminal(true);
    setTerminalOutput("Running...\n");
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.project_id,
          file_path: selectedFile,
          skill_level: "intermediate",
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        let output = "";
        
        if (data.output) {
          output += data.output;
        }
        
        if (data.error) {
          output += `\n❌ Error:\n${data.error}`;
          if (data.error_explanation) {
            output += `\n\n💡 Explanation: ${data.error_explanation}`;
          }
          if (data.fix_suggestion) {
            output += `\n\n🔧 Suggestion: ${data.fix_suggestion}`;
          }
        } else {
          output += `\n✅ Execution successful (${data.execution_time?.toFixed(3)}s)`;
        }
        
        setTerminalOutput(output);
        
        if (data.error) {
          toast.error("Code execution had errors");
        } else {
          toast.success("Code executed successfully!");
        }
      }
    } catch (error) {
      console.error("Run error:", error);
      setTerminalOutput("Failed to execute code");
      toast.error("Failed to run code");
    } finally {
      setIsRunning(false);
    }
  };
  
  const handleEditorChange = (value) => {
    setFileContent(value || "");
    setIsModified(true);
  };
  
  const getLanguageForMonaco = (lang) => {
    const langMap = {
      'python': 'python',
      'javascript': 'javascript',
      'typescript': 'typescript',
      'java': 'java',
      'c++': 'cpp',
      'c': 'c',
      'go': 'go',
      'rust': 'rust',
      'ruby': 'ruby',
      'php': 'php',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'yaml': 'yaml',
      'markdown': 'markdown',
      'shell': 'shell',
      'sql': 'sql',
    };
    return langMap[lang?.toLowerCase()] || 'plaintext';
  };
  
  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#161b22]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-[#FBBC04]" />
            <span className="font-medium">{project?.name || "Project"}</span>
            <span className="text-xs text-white/40">
              ({project?.total_files} files)
            </span>
          </div>
          
          {selectedFile && (
            <div className="flex items-center gap-1 text-sm text-white/60">
              <ChevronRight className="w-4 h-4" />
              <span className={isModified ? "text-[#FBBC04]" : ""}>
                {selectedFile}
                {isModified && " •"}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Analysis Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAnalysisPanel(!showAnalysisPanel)}
            className={showAnalysisPanel ? "text-[#667eea]" : "text-white/60"}
          >
            {showAnalysisPanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </Button>
          
          {/* Re-analyze Project */}
          <Button
            variant="ghost"
            size="sm"
            onClick={analyzeProject}
            disabled={isAnalyzing}
            className="gap-2 text-white/60 hover:text-white"
          >
            {isAnalyzing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Cpu className="w-4 h-4" />
            )}
            Analyze Project
          </Button>
          
          {/* Analyze Current File */}
          {selectedFile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={analyzeCurrentFile}
              disabled={isAnalyzing}
              className="gap-2 text-white/60 hover:text-white"
            >
              <Bug className="w-4 h-4" />
              Find Bugs
            </Button>
          )}
          
          {/* Run */}
          {selectedFile && ['py', 'js'].includes(selectedFile.split('.').pop()?.toLowerCase()) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={runCurrentFile}
              disabled={isRunning}
              className="gap-2 text-[#34A853] hover:text-[#34A853]"
            >
              {isRunning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Run
            </Button>
          )}
          
          {/* Save */}
          {isModified && (
            <Button
              variant="ghost"
              size="sm"
              onClick={saveFile}
              disabled={isSaving}
              className="gap-2 text-[#FBBC04]"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          )}
          
          {/* New Project */}
          <Button
            variant="outline"
            size="sm"
            onClick={onNewProject}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            New Project
          </Button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* File Explorer */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
            <div className="h-full flex flex-col bg-[#0d1117] border-r border-white/10">
              {/* Language Stats */}
              {project?.languages && <LanguageStats languages={project.languages} />}
              
              {/* File Tree */}
              <div className="flex-1 overflow-auto">
                <FileExplorer 
                  node={project?.root}
                  onFileSelect={loadFile}
                  selectedPath={selectedFile}
                />
              </div>
              
              {/* Project Info */}
              <div className="p-3 border-t border-white/10 space-y-1">
                {project?.frameworks?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {project.frameworks.map((fw, i) => (
                      <span key={i} className="px-2 py-0.5 text-xs bg-[#4285F4]/20 text-[#4285F4] rounded">
                        {fw}
                      </span>
                    ))}
                  </div>
                )}
                {project?.has_tests && (
                  <span className="text-xs text-[#34A853]">✓ Tests detected</span>
                )}
              </div>
            </div>
          </ResizablePanel>
          
          <ResizableHandle className="w-1 bg-white/5 hover:bg-[#667eea]/50" />
          
          {/* Editor Area */}
          <ResizablePanel defaultSize={showAnalysisPanel ? 50 : 80}>
            <div className="h-full flex flex-col">
              {/* Editor */}
              <div className="flex-1">
                {isLoadingFile ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-[#667eea]" />
                  </div>
                ) : selectedFile ? (
                  <Editor
                    height="100%"
                    language={getLanguageForMonaco(language)}
                    value={fileContent}
                    onChange={handleEditorChange}
                    theme="vs-dark"
                    options={{
                      fontSize: 14,
                      minimap: { enabled: true },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      wordWrap: "on",
                      padding: { top: 10 },
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-white/40">
                    <div className="text-center">
                      <FileCode className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Select a file to view</p>
                      <p className="text-sm mt-2">
                        Click on any file in the explorer to open it
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Code Analysis Results */}
              {codeAnalysis && codeAnalysis.bugs?.length > 0 && (
                <div className="border-t border-white/10 p-3 bg-[#161b22] max-h-40 overflow-auto">
                  <div className="flex items-center gap-2 mb-2">
                    <Bug className="w-4 h-4 text-[#EA4335]" />
                    <span className="text-sm font-medium">
                      {codeAnalysis.bugs.length} issue(s) found
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      codeAnalysis.overall_quality === 'good' ? 'bg-[#34A853]/20 text-[#34A853]' :
                      codeAnalysis.overall_quality === 'fair' ? 'bg-[#FBBC04]/20 text-[#FBBC04]' :
                      'bg-[#EA4335]/20 text-[#EA4335]'
                    }`}>
                      Quality: {codeAnalysis.overall_quality}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {codeAnalysis.bugs.map((bug, i) => (
                      <div key={i} className="p-2 rounded bg-black/20 text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                            bug.severity === 'critical' ? 'bg-[#EA4335]/20 text-[#EA4335]' :
                            bug.severity === 'warning' ? 'bg-[#FBBC04]/20 text-[#FBBC04]' :
                            'bg-[#4285F4]/20 text-[#4285F4]'
                          }`}>
                            Line {bug.line}
                          </span>
                          <span className="text-white/80">{bug.message}</span>
                        </div>
                        {bug.suggestion && (
                          <p className="text-xs text-white/50 mt-1 flex items-center gap-1">
                            <Lightbulb className="w-3 h-3" /> {bug.suggestion}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Terminal Output */}
              {showTerminal && (
                <div className="border-t border-white/10 bg-black">
                  <div className="flex items-center justify-between px-3 py-1 bg-[#161b22]">
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <Terminal className="w-4 h-4" />
                      Output
                    </div>
                    <button 
                      onClick={() => setShowTerminal(false)}
                      className="p-1 rounded hover:bg-white/10"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <pre className="p-3 text-sm text-white/80 font-mono max-h-40 overflow-auto whitespace-pre-wrap">
                    {terminalOutput || "No output"}
                  </pre>
                </div>
              )}
            </div>
          </ResizablePanel>
          
          {/* Analysis Panel */}
          {showAnalysisPanel && (
            <>
              <ResizableHandle className="w-1 bg-white/5 hover:bg-[#667eea]/50" />
              <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
                <div className="h-full bg-[#0d1117] border-l border-white/10">
                  {isAnalyzing && !projectAnalysis ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-[#667eea] mx-auto mb-3" />
                        <p className="text-white/60">Analyzing project...</p>
                      </div>
                    </div>
                  ) : projectAnalysis ? (
                    <ProjectAnalysisPanel 
                      analysis={projectAnalysis}
                      onLoadFile={loadFile}
                      onClose={() => setShowAnalysisPanel(false)}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-white/40">
                      <div className="text-center p-4">
                        <Cpu className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Click "Analyze Project" to get</p>
                        <p>AI-powered insights</p>
                      </div>
                    </div>
                  )}
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default IDEWorkspace;

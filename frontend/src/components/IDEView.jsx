import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  FolderOpen, File, ChevronRight, ChevronDown, 
  Play, Terminal as TerminalIcon, Upload, Settings, 
  X, Loader2, RefreshCw, Download, Search, Plus,
  Code, BookOpen, Wand2, HelpCircle, Eye, EyeOff,
  TestTube, Package, GitBranch, Cpu, Zap, AlertTriangle
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useMentor, SKILL_LEVELS } from "@/contexts/MentorContext";
import FileExplorer from "@/components/ide/FileExplorer";
import IDETerminal from "@/components/ide/IDETerminal";
import LanguageStats from "@/components/ide/LanguageStats";
import ProjectUploadZone from "@/components/ide/ProjectUploadZone";
import ProjectAnalysisPanel from "@/components/ide/ProjectAnalysisPanel";
import LineMentoringPanel from "@/components/LineMentoringPanel";
import TeachingOverlay from "@/components/TeachingOverlay";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const IDEView = () => {
  const { skillLevel, setSkillLevel, proactiveMentorEnabled, setProactiveMentorEnabled } = useMentor();
  
  // Project state
  const [project, setProject] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(true);
  
  // Editor state
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [editorContent, setEditorContent] = useState("");
  const [currentLanguage, setCurrentLanguage] = useState("javascript");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState({});
  const [editorInstance, setEditorInstance] = useState(null);
  
  // Analysis state
  const [bugs, setBugs] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [projectAnalysis, setProjectAnalysis] = useState(null);
  const [isAnalyzingProject, setIsAnalyzingProject] = useState(false);
  
  // Terminal state
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  
  // Line mentoring state
  const [selectedLines, setSelectedLines] = useState([]);
  const [showLineMentoring, setShowLineMentoring] = useState(false);
  
  // Teaching state
  const [selectedBug, setSelectedBug] = useState(null);
  const [showTeaching, setShowTeaching] = useState(false);
  
  // Proactive mentor
  const [proactiveWarning, setProactiveWarning] = useState(null);
  const proactiveTimeoutRef = useRef(null);
  
  // Get current file
  const currentFile = openFiles[activeFileIndex] || null;

  // Handle project upload
  const handleProjectUpload = async (projectData) => {
    setProject(projectData);
    setShowUpload(false);
    
    // Auto-update language based on dominant language
    if (projectData.languages?.length > 0) {
      const dominant = projectData.languages[0].name.toLowerCase();
      setCurrentLanguage(dominant);
    }
    
    // Load README or first entry point
    if (projectData.entry_points?.length > 0) {
      await loadFile(projectData.entry_points[0]);
    } else if (projectData.readme_content) {
      setOpenFiles([{ path: 'README.md', content: projectData.readme_content, language: 'markdown' }]);
      setEditorContent(projectData.readme_content);
      setCurrentLanguage('markdown');
    }
    
    toast.success(`Project loaded: ${projectData.name}`);
  };

  // Load file from project
  const loadFile = async (path) => {
    if (!project) return;
    
    // Check if already open
    const existingIndex = openFiles.findIndex(f => f.path === path);
    if (existingIndex !== -1) {
      setActiveFileIndex(existingIndex);
      setEditorContent(openFiles[existingIndex].content);
      setCurrentLanguage(openFiles[existingIndex].language || 'javascript');
      return;
    }
    
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/project/${project.project_id}/file?path=${encodeURIComponent(path)}`
      );
      
      if (!response.ok) throw new Error("Failed to load file");
      
      const data = await response.json();
      
      const newFile = {
        path: data.path,
        content: data.content,
        language: data.language
      };
      
      setOpenFiles(prev => [...prev, newFile]);
      setActiveFileIndex(openFiles.length);
      setEditorContent(data.content);
      setCurrentLanguage(data.language);
      
    } catch (error) {
      console.error("Load file error:", error);
      toast.error("Failed to load file");
    }
  };

  // Save current file
  const saveFile = async () => {
    if (!project || !currentFile) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.project_id,
          path: currentFile.path,
          content: editorContent
        })
      });
      
      if (!response.ok) throw new Error("Failed to save");
      
      // Update local state
      setOpenFiles(prev => prev.map((f, i) => 
        i === activeFileIndex ? { ...f, content: editorContent } : f
      ));
      setHasUnsavedChanges(prev => ({ ...prev, [currentFile.path]: false }));
      
      toast.success("File saved");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save file");
    }
  };

  // Close file tab
  const closeFile = (index) => {
    const newFiles = openFiles.filter((_, i) => i !== index);
    setOpenFiles(newFiles);
    
    if (index === activeFileIndex) {
      const newIndex = Math.min(index, newFiles.length - 1);
      setActiveFileIndex(Math.max(0, newIndex));
      if (newFiles[newIndex]) {
        setEditorContent(newFiles[newIndex].content);
        setCurrentLanguage(newFiles[newIndex].language);
      } else {
        setEditorContent("");
      }
    } else if (index < activeFileIndex) {
      setActiveFileIndex(activeFileIndex - 1);
    }
  };

  // Run project or file
  const runProject = async (filePath = null) => {
    if (!project) return;
    
    setIsRunning(true);
    setTerminalOutput(prev => [...prev, { type: 'command', text: filePath ? `Running ${filePath}...` : 'Running project...' }]);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.project_id,
          file_path: filePath,
          skill_level: skillLevel
        })
      });
      
      const data = await response.json();
      
      if (data.output) {
        setTerminalOutput(prev => [...prev, { type: 'output', text: data.output }]);
      }
      
      if (data.error) {
        setTerminalOutput(prev => [...prev, { type: 'error', text: data.error }]);
        
        if (data.error_explanation) {
          setTerminalOutput(prev => [...prev, { 
            type: 'info', 
            text: `💡 ${data.error_explanation}` 
          }]);
        }
        if (data.fix_suggestion) {
          setTerminalOutput(prev => [...prev, { 
            type: 'suggestion', 
            text: `🔧 Suggested fix: ${data.fix_suggestion}` 
          }]);
        }
      }
      
      setTerminalOutput(prev => [...prev, { 
        type: data.exit_code === 0 ? 'success' : 'error', 
        text: `Process exited with code ${data.exit_code} (${data.execution_time.toFixed(2)}s)` 
      }]);
      
    } catch (error) {
      console.error("Run error:", error);
      setTerminalOutput(prev => [...prev, { type: 'error', text: `Error: ${error.message}` }]);
    } finally {
      setIsRunning(false);
    }
  };

  // Run tests
  const runTests = async () => {
    if (!project) return;
    
    setIsRunning(true);
    setTerminalOutput(prev => [...prev, { type: 'command', text: 'Running tests...' }]);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/run-tests?skill_level=${skillLevel}`, {
        method: "POST"
      });
      
      const data = await response.json();
      
      if (data.output) {
        setTerminalOutput(prev => [...prev, { type: 'output', text: data.output }]);
      }
      
      if (data.error) {
        setTerminalOutput(prev => [...prev, { type: 'error', text: data.error }]);
      }
      
      if (data.test_results) {
        setTerminalOutput(prev => [...prev, { 
          type: 'info', 
          text: `📊 ${data.test_results.summary || 'Test analysis complete'}` 
        }]);
      }
      
    } catch (error) {
      setTerminalOutput(prev => [...prev, { type: 'error', text: `Error: ${error.message}` }]);
    } finally {
      setIsRunning(false);
    }
  };

  // Install dependencies
  const installDeps = async () => {
    if (!project) return;
    
    setIsRunning(true);
    setTerminalOutput(prev => [...prev, { type: 'command', text: 'Installing dependencies...' }]);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/install-deps`, {
        method: "POST"
      });
      
      const data = await response.json();
      
      if (data.output) {
        setTerminalOutput(prev => [...prev, { type: 'output', text: data.output }]);
      }
      
      if (data.error) {
        setTerminalOutput(prev => [...prev, { type: 'error', text: data.error }]);
      }
      
      setTerminalOutput(prev => [...prev, { 
        type: data.success ? 'success' : 'error', 
        text: data.success ? '✅ Dependencies installed successfully' : '❌ Installation failed' 
      }]);
      
    } catch (error) {
      setTerminalOutput(prev => [...prev, { type: 'error', text: `Error: ${error.message}` }]);
    } finally {
      setIsRunning(false);
    }
  };

  // Execute terminal command
  const executeCommand = async (command) => {
    if (!project) return;
    
    setTerminalOutput(prev => [...prev, { type: 'command', text: `$ ${command}` }]);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/terminal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.project_id, command })
      });
      
      const data = await response.json();
      
      if (data.output) {
        setTerminalOutput(prev => [...prev, { type: 'output', text: data.output }]);
      }
      if (data.error) {
        setTerminalOutput(prev => [...prev, { type: 'error', text: data.error }]);
      }
      
    } catch (error) {
      setTerminalOutput(prev => [...prev, { type: 'error', text: `Error: ${error.message}` }]);
    }
  };

  // Analyze current file
  const analyzeCode = async () => {
    if (!editorContent.trim()) return;
    
    setIsAnalyzing(true);
    setBugs([]);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/analyze-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          code: editorContent, 
          language: currentLanguage,
          skill_level: skillLevel 
        })
      });
      
      const data = await response.json();
      setBugs(data.bugs || []);
      setShowAnalysis(true);
      
      if (data.bugs?.length > 0) {
        toast.warning(`Found ${data.bugs.length} issue(s)`);
      } else {
        toast.success("No issues found!");
      }
    } catch (error) {
      toast.error("Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Full project analysis
  const analyzeFullProject = async () => {
    if (!project) return;
    
    setIsAnalyzingProject(true);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/analyze-full`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          project_id: project.project_id,
          skill_level: skillLevel 
        })
      });
      
      const data = await response.json();
      setProjectAnalysis(data);
      toast.success("Project analysis complete!");
    } catch (error) {
      toast.error("Project analysis failed");
    } finally {
      setIsAnalyzingProject(false);
    }
  };

  // AI Fix
  const aiSeniorFix = async () => {
    if (!editorContent.trim()) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/fix-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          code: editorContent, 
          language: currentLanguage,
          bugs,
          skill_level: skillLevel,
          apply_inline_comments: skillLevel === 'beginner'
        })
      });
      
      const data = await response.json();
      setEditorContent(data.fixed_code);
      setHasUnsavedChanges(prev => ({ ...prev, [currentFile?.path]: true }));
      toast.success("Code fixed!");
    } catch (error) {
      toast.error("Fix failed");
    }
  };

  // Handle editor mount
  const handleEditorDidMount = (editor, monaco) => {
    setEditorInstance(editor);
    
    // Keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveFile());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
      if (selectedLines.length > 0) setShowLineMentoring(true);
    });
    
    // Track selection
    editor.onDidChangeCursorSelection((e) => {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        const lines = [];
        for (let i = selection.startLineNumber; i <= selection.endLineNumber; i++) {
          lines.push(i);
        }
        setSelectedLines(lines);
      } else {
        setSelectedLines([]);
      }
    });
  };

  // Proactive mentor
  useEffect(() => {
    if (!proactiveMentorEnabled || !editorContent || editorContent.length < 50) return;
    
    if (proactiveTimeoutRef.current) clearTimeout(proactiveTimeoutRef.current);
    
    proactiveTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/proactive-mentor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: editorContent, language: currentLanguage, skill_level: skillLevel })
        });
        
        if (response.ok) {
          const data = await response.json();
          setProactiveWarning(data.has_issue ? data : null);
        }
      } catch (error) {
        console.error("Proactive mentor error:", error);
      }
    }, 2000);
    
    return () => {
      if (proactiveTimeoutRef.current) clearTimeout(proactiveTimeoutRef.current);
    };
  }, [editorContent, currentLanguage, skillLevel, proactiveMentorEnabled]);

  // Handle editor content change
  const handleEditorChange = (value) => {
    setEditorContent(value || "");
    if (currentFile) {
      setHasUnsavedChanges(prev => ({ ...prev, [currentFile.path]: true }));
    }
  };

  // Render upload zone if no project
  if (showUpload) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <ProjectUploadZone onProjectUpload={handleProjectUpload} />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between gap-4 p-2 bg-[#1E1E1E] border-b border-white/10">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowUpload(true)}
            className="gap-2 text-white/70"
          >
            <Upload className="w-4 h-4" />
            New Project
          </Button>
          
          <div className="h-4 w-px bg-white/20" />
          
          <Select value={skillLevel} onValueChange={setSkillLevel}>
            <SelectTrigger className="w-40 h-8 text-xs bg-white/5 border-white/10">
              <SelectValue placeholder="Skill Level" />
            </SelectTrigger>
            <SelectContent>
              {SKILL_LEVELS.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setProactiveMentorEnabled(!proactiveMentorEnabled)}
            className={`gap-1 ${proactiveMentorEnabled ? 'text-[#34A853]' : 'text-white/50'}`}
          >
            {proactiveMentorEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            Watch
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => runProject(currentFile?.path)}
            disabled={isRunning}
            className="gap-1 text-[#34A853]"
          >
            <Play className="w-4 h-4" />
            Run
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={runTests}
            disabled={isRunning || !project?.has_tests}
            className="gap-1 text-[#FBBC04]"
          >
            <TestTube className="w-4 h-4" />
            Tests
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={installDeps}
            disabled={isRunning}
            className="gap-1 text-[#4285F4]"
          >
            <Package className="w-4 h-4" />
            Install
          </Button>
          
          <div className="h-4 w-px bg-white/20" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={analyzeCode}
            disabled={isAnalyzing}
            className="gap-1 text-[#667eea]"
          >
            <Code className="w-4 h-4" />
            Analyze
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={aiSeniorFix}
            className="gap-1 text-[#34A853]"
          >
            <Wand2 className="w-4 h-4" />
            AI Fix
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLineMentoring(true)}
            disabled={selectedLines.length === 0}
            className="gap-1 text-[#667eea]"
          >
            <HelpCircle className="w-4 h-4" />
            Help
          </Button>
          
          <div className="h-4 w-px bg-white/20" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={analyzeFullProject}
            disabled={isAnalyzingProject}
            className="gap-1 text-[#EA4335]"
          >
            {isAnalyzingProject ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
            Full Analysis
          </Button>
        </div>
      </div>
      
      {/* Proactive Warning */}
      {proactiveWarning && (
        <div className={`p-2 flex items-center justify-between gap-3 ${
          proactiveWarning.severity === 'critical' ? 'bg-[#EA4335]/20' :
          proactiveWarning.severity === 'warning' ? 'bg-[#FBBC04]/20' : 'bg-[#4285F4]/20'
        }`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">{proactiveWarning.message}</span>
          </div>
          <div className="flex gap-2">
            {proactiveWarning.quick_fix && (
              <Button size="sm" variant="ghost" className="text-xs h-6">
                <Zap className="w-3 h-3 mr-1" /> Quick Fix
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setProactiveWarning(null)} className="text-xs h-6">
              Dismiss
            </Button>
          </div>
        </div>
      )}
      
      {/* Main IDE Layout */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* Left Sidebar - File Explorer */}
          <Panel defaultSize={20} minSize={15} maxSize={35}>
            <div className="h-full bg-[#252526] border-r border-white/10 flex flex-col">
              {/* Project Info */}
              <div className="p-3 border-b border-white/10">
                <h3 className="font-semibold text-sm truncate">{project?.name || 'Project'}</h3>
                <div className="flex items-center gap-2 text-xs text-white/50 mt-1">
                  <span>{project?.total_files} files</span>
                  <span>•</span>
                  <span>{(project?.total_size / 1024).toFixed(1)} KB</span>
                </div>
              </div>
              
              {/* Language Stats */}
              {project?.languages && (
                <LanguageStats languages={project.languages} />
              )}
              
              {/* File Tree */}
              <div className="flex-1 overflow-auto">
                {project?.root && (
                  <FileExplorer 
                    node={project.root} 
                    onFileSelect={loadFile}
                    selectedPath={currentFile?.path}
                  />
                )}
              </div>
            </div>
          </Panel>
          
          <PanelResizeHandle className="w-1 bg-white/5 hover:bg-[#667eea]/50 transition-colors" />
          
          {/* Center - Editor + Terminal */}
          <Panel defaultSize={55} minSize={30}>
            <PanelGroup direction="vertical">
              {/* Editor */}
              <Panel defaultSize={70} minSize={30}>
                <div className="h-full flex flex-col bg-[#1E1E1E]">
                  {/* File Tabs */}
                  <div className="flex items-center bg-[#252526] border-b border-white/10 overflow-x-auto">
                    {openFiles.map((file, index) => (
                      <div
                        key={file.path}
                        className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer border-r border-white/10 ${
                          index === activeFileIndex ? 'bg-[#1E1E1E] text-white' : 'text-white/60 hover:bg-white/5'
                        }`}
                        onClick={() => {
                          setActiveFileIndex(index);
                          setEditorContent(file.content);
                          setCurrentLanguage(file.language);
                        }}
                      >
                        <File className="w-3 h-3" />
                        <span className="truncate max-w-[120px]">
                          {file.path.split('/').pop()}
                        </span>
                        {hasUnsavedChanges[file.path] && <span className="w-2 h-2 rounded-full bg-[#FBBC04]" />}
                        <button
                          onClick={(e) => { e.stopPropagation(); closeFile(index); }}
                          className="p-0.5 rounded hover:bg-white/10"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  {/* Monaco Editor */}
                  <div className="flex-1">
                    {openFiles.length > 0 ? (
                      <Editor
                        height="100%"
                        language={currentLanguage}
                        value={editorContent}
                        onChange={handleEditorChange}
                        onMount={handleEditorDidMount}
                        theme="vs-dark"
                        options={{
                          fontSize: 14,
                          fontFamily: "'JetBrains Mono', monospace",
                          minimap: { enabled: true },
                          padding: { top: 8 },
                          scrollBeyondLastLine: false,
                          smoothScrolling: true,
                          lineNumbers: "on",
                          renderLineHighlight: "all",
                          bracketPairColorization: { enabled: true },
                          automaticLayout: true,
                        }}
                      />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-white/40">
                        <FolderOpen className="w-16 h-16 mb-4" />
                        <p>Select a file from the explorer to edit</p>
                        <p className="text-xs mt-2">or upload a new project</p>
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
              
              <PanelResizeHandle className="h-1 bg-white/5 hover:bg-[#667eea]/50 transition-colors" />
              
              {/* Terminal */}
              <Panel defaultSize={30} minSize={15}>
                <IDETerminal 
                  output={terminalOutput}
                  onCommand={executeCommand}
                  isRunning={isRunning}
                  onClear={() => setTerminalOutput([])}
                />
              </Panel>
            </PanelGroup>
          </Panel>
          
          <PanelResizeHandle className="w-1 bg-white/5 hover:bg-[#667eea]/50 transition-colors" />
          
          {/* Right Sidebar - Analysis */}
          <Panel defaultSize={25} minSize={15} maxSize={40}>
            <div className="h-full bg-[#252526] border-l border-white/10 overflow-auto">
              {projectAnalysis ? (
                <ProjectAnalysisPanel 
                  analysis={projectAnalysis}
                  onLoadFile={loadFile}
                  onClose={() => setProjectAnalysis(null)}
                />
              ) : showAnalysis && bugs.length > 0 ? (
                <div className="p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Code className="w-4 h-4 text-[#667eea]" />
                    Code Analysis
                  </h3>
                  <div className="space-y-3">
                    {bugs.map((bug, i) => (
                      <div 
                        key={i}
                        className="p-3 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10"
                        onClick={() => { setSelectedBug(bug); setShowTeaching(true); }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            bug.severity === 'critical' ? 'bg-[#EA4335]/20 text-[#EA4335]' :
                            bug.severity === 'warning' ? 'bg-[#FBBC04]/20 text-[#FBBC04]' :
                            'bg-[#4285F4]/20 text-[#4285F4]'
                          }`}>
                            {bug.severity}
                          </span>
                          <span className="text-xs text-white/50">Line {bug.line}</span>
                        </div>
                        <p className="text-sm text-white/80">{bug.message}</p>
                        <p className="text-xs text-white/50 mt-1">{bug.suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-white/40">
                  <Cpu className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Click "Full Analysis" to analyze</p>
                  <p className="text-xs mt-1">the entire project structure</p>
                </div>
              )}
            </div>
          </Panel>
        </PanelGroup>
      </div>
      
      {/* Modals */}
      {showLineMentoring && selectedLines.length > 0 && (
        <LineMentoringPanel
          code={editorContent}
          language={currentLanguage}
          selectedLines={selectedLines}
          skillLevel={skillLevel}
          onClose={() => setShowLineMentoring(false)}
          onApplyFix={(newCode) => {
            toast.info("Review the suggestion");
          }}
        />
      )}
      
      {showTeaching && selectedBug && (
        <TeachingOverlay
          code={editorContent}
          bug={selectedBug}
          skillLevel={skillLevel}
          onClose={() => { setShowTeaching(false); setSelectedBug(null); }}
        />
      )}
    </div>
  );
};

export default IDEView;

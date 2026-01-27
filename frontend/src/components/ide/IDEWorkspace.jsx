import React, { useState, useRef, useEffect } from "react";
import { 
  File, X, FolderOpen, Play, Upload, Code, Wand2, HelpCircle, 
  Eye, EyeOff, TestTube, Package, Cpu, Zap, AlertTriangle, Loader2
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useMentor, SKILL_LEVELS } from "@/contexts/MentorContext";
import FileExplorer from "@/components/ide/FileExplorer";
import IDETerminal from "@/components/ide/IDETerminal";
import LanguageStats from "@/components/ide/LanguageStats";
import ProjectAnalysisPanel from "@/components/ide/ProjectAnalysisPanel";
import LineMentoringPanel from "@/components/LineMentoringPanel";
import TeachingOverlay from "@/components/TeachingOverlay";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const IDEWorkspace = ({ project, onNewProject }) => {
  const { skillLevel, setSkillLevel, proactiveMentorEnabled, setProactiveMentorEnabled } = useMentor();
  
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [editorContent, setEditorContent] = useState("");
  const [currentLanguage, setCurrentLanguage] = useState("javascript");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState({});
  
  const [bugs, setBugs] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [projectAnalysis, setProjectAnalysis] = useState(null);
  const [isAnalyzingProject, setIsAnalyzingProject] = useState(false);
  
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  
  const [selectedLines, setSelectedLines] = useState([]);
  const [showLineMentoring, setShowLineMentoring] = useState(false);
  const [selectedBug, setSelectedBug] = useState(null);
  const [showTeaching, setShowTeaching] = useState(false);
  
  const [proactiveWarning, setProactiveWarning] = useState(null);
  const proactiveTimeoutRef = useRef(null);
  
  const currentFile = openFiles[activeFileIndex] || null;

  useEffect(() => {
    if (project?.languages?.length > 0) {
      setCurrentLanguage(project.languages[0].name.toLowerCase());
    }
    if (project?.readme_content) {
      setOpenFiles([{ path: 'README.md', content: project.readme_content, language: 'markdown' }]);
      setEditorContent(project.readme_content);
      setCurrentLanguage('markdown');
    }
  }, [project]);

  const loadFile = async (path) => {
    if (!project) return;
    const existingIndex = openFiles.findIndex(f => f.path === path);
    if (existingIndex !== -1) {
      setActiveFileIndex(existingIndex);
      setEditorContent(openFiles[existingIndex].content);
      setCurrentLanguage(openFiles[existingIndex].language || 'javascript');
      return;
    }
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/file?path=${encodeURIComponent(path)}`);
      if (!response.ok) throw new Error("Failed to load file");
      const data = await response.json();
      
      const newFile = { path: data.path, content: data.content, language: data.language };
      setOpenFiles(prev => [...prev, newFile]);
      setActiveFileIndex(openFiles.length);
      setEditorContent(data.content);
      setCurrentLanguage(data.language);
    } catch (error) {
      toast.error("Failed to load file");
    }
  };

  const saveFile = async () => {
    if (!project || !currentFile) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.project_id, path: currentFile.path, content: editorContent })
      });
      if (!response.ok) throw new Error("Failed to save");
      setOpenFiles(prev => prev.map((f, i) => i === activeFileIndex ? { ...f, content: editorContent } : f));
      setHasUnsavedChanges(prev => ({ ...prev, [currentFile.path]: false }));
      toast.success("File saved");
    } catch (error) {
      toast.error("Failed to save file");
    }
  };

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

  const runProject = async (filePath = null) => {
    if (!project) return;
    setIsRunning(true);
    setTerminalOutput(prev => [...prev, { type: 'command', text: filePath ? `Running ${filePath}...` : 'Running project...' }]);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.project_id, file_path: filePath, skill_level: skillLevel })
      });
      const data = await response.json();
      
      if (data.output) setTerminalOutput(prev => [...prev, { type: 'output', text: data.output }]);
      if (data.error) {
        setTerminalOutput(prev => [...prev, { type: 'error', text: data.error }]);
        if (data.error_explanation) setTerminalOutput(prev => [...prev, { type: 'info', text: `💡 ${data.error_explanation}` }]);
        if (data.fix_suggestion) setTerminalOutput(prev => [...prev, { type: 'suggestion', text: `🔧 ${data.fix_suggestion}` }]);
      }
      setTerminalOutput(prev => [...prev, { type: data.exit_code === 0 ? 'success' : 'error', text: `Exit code ${data.exit_code}` }]);
    } catch (error) {
      setTerminalOutput(prev => [...prev, { type: 'error', text: `Error: ${error.message}` }]);
    } finally {
      setIsRunning(false);
    }
  };

  const installDeps = async () => {
    if (!project) return;
    setIsRunning(true);
    setTerminalOutput(prev => [...prev, { type: 'command', text: 'Installing dependencies...' }]);
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/install-deps`, { method: "POST" });
      const data = await response.json();
      if (data.output) setTerminalOutput(prev => [...prev, { type: 'output', text: data.output }]);
      if (data.error) setTerminalOutput(prev => [...prev, { type: 'error', text: data.error }]);
      setTerminalOutput(prev => [...prev, { type: data.success ? 'success' : 'error', text: data.success ? '✅ Done' : '❌ Failed' }]);
    } catch (error) {
      setTerminalOutput(prev => [...prev, { type: 'error', text: `Error: ${error.message}` }]);
    } finally {
      setIsRunning(false);
    }
  };

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
      if (data.output) setTerminalOutput(prev => [...prev, { type: 'output', text: data.output }]);
      if (data.error) setTerminalOutput(prev => [...prev, { type: 'error', text: data.error }]);
    } catch (error) {
      setTerminalOutput(prev => [...prev, { type: 'error', text: `Error: ${error.message}` }]);
    }
  };

  const analyzeCode = async () => {
    if (!editorContent.trim()) return;
    setIsAnalyzing(true);
    setBugs([]);
    try {
      const response = await fetch(`${BACKEND_URL}/api/analyze-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: editorContent, language: currentLanguage, skill_level: skillLevel })
      });
      const data = await response.json();
      setBugs(data.bugs || []);
      if (data.bugs?.length > 0) toast.warning(`Found ${data.bugs.length} issue(s)`);
      else toast.success("No issues found!");
    } catch (error) {
      toast.error("Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeFullProject = async () => {
    if (!project) return;
    setIsAnalyzingProject(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/analyze-full`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.project_id, skill_level: skillLevel })
      });
      const data = await response.json();
      setProjectAnalysis(data);
      toast.success("Analysis complete!");
    } catch (error) {
      toast.error("Analysis failed");
    } finally {
      setIsAnalyzingProject(false);
    }
  };

  const aiSeniorFix = async () => {
    if (!editorContent.trim()) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/fix-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: editorContent, language: currentLanguage, bugs, skill_level: skillLevel, apply_inline_comments: skillLevel === 'beginner' })
      });
      const data = await response.json();
      setEditorContent(data.fixed_code);
      if (currentFile) setHasUnsavedChanges(prev => ({ ...prev, [currentFile.path]: true }));
      toast.success("Code fixed!");
    } catch (error) {
      toast.error("Fix failed");
    }
  };

  const handleEditorDidMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveFile());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
      if (selectedLines.length > 0) setShowLineMentoring(true);
    });
    editor.onDidChangeCursorSelection((e) => {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        const lines = [];
        for (let i = selection.startLineNumber; i <= selection.endLineNumber; i++) lines.push(i);
        setSelectedLines(lines);
      } else {
        setSelectedLines([]);
      }
    });
  };

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
      } catch (error) {}
    }, 2000);
    return () => { if (proactiveTimeoutRef.current) clearTimeout(proactiveTimeoutRef.current); };
  }, [editorContent, currentLanguage, skillLevel, proactiveMentorEnabled]);

  const handleEditorChange = (value) => {
    setEditorContent(value || "");
    if (currentFile) setHasUnsavedChanges(prev => ({ ...prev, [currentFile.path]: true }));
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <IDEToolbar 
        onNewProject={onNewProject}
        skillLevel={skillLevel}
        setSkillLevel={setSkillLevel}
        proactiveMentorEnabled={proactiveMentorEnabled}
        setProactiveMentorEnabled={setProactiveMentorEnabled}
        onRun={() => runProject(currentFile?.path)}
        onInstall={installDeps}
        onAnalyze={analyzeCode}
        onAIFix={aiSeniorFix}
        onHelp={() => setShowLineMentoring(true)}
        onFullAnalysis={analyzeFullProject}
        isRunning={isRunning}
        isAnalyzing={isAnalyzing}
        isAnalyzingProject={isAnalyzingProject}
        hasTests={project?.has_tests}
        hasSelectedLines={selectedLines.length > 0}
      />
      
      {proactiveWarning && (
        <ProactiveWarningBar warning={proactiveWarning} onDismiss={() => setProactiveWarning(null)} />
      )}
      
      <div className="flex-1 grid grid-cols-[250px_1fr_300px] gap-0 overflow-hidden">
        <IDESidebar project={project} currentFilePath={currentFile?.path} onFileSelect={loadFile} />
        
        <div className="h-full flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col bg-[#1E1E1E] overflow-hidden" style={{ height: '65%' }}>
            <FileTabs 
              files={openFiles} 
              activeIndex={activeFileIndex} 
              hasUnsavedChanges={hasUnsavedChanges}
              onSelect={(i) => { setActiveFileIndex(i); setEditorContent(openFiles[i].content); setCurrentLanguage(openFiles[i].language); }}
              onClose={closeFile}
            />
            <div className="flex-1 overflow-hidden">
              {openFiles.length > 0 ? (
                <Editor
                  height="100%"
                  language={currentLanguage}
                  value={editorContent}
                  onChange={handleEditorChange}
                  onMount={handleEditorDidMount}
                  theme="vs-dark"
                  options={{ fontSize: 14, minimap: { enabled: true }, automaticLayout: true }}
                />
              ) : (
                <EmptyEditor />
              )}
            </div>
          </div>
          <div className="h-[35%] border-t border-white/10">
            <IDETerminal output={terminalOutput} onCommand={executeCommand} isRunning={isRunning} onClear={() => setTerminalOutput([])} />
          </div>
        </div>
        
        <AnalysisPanel 
          projectAnalysis={projectAnalysis}
          bugs={bugs}
          onLoadFile={loadFile}
          onCloseAnalysis={() => setProjectAnalysis(null)}
          onTeachBug={(bug) => { setSelectedBug(bug); setShowTeaching(true); }}
        />
      </div>
      
      {showLineMentoring && selectedLines.length > 0 && (
        <LineMentoringPanel code={editorContent} language={currentLanguage} selectedLines={selectedLines} skillLevel={skillLevel} onClose={() => setShowLineMentoring(false)} onApplyFix={() => toast.info("Review the suggestion")} />
      )}
      
      {showTeaching && selectedBug && (
        <TeachingOverlay code={editorContent} bug={selectedBug} skillLevel={skillLevel} onClose={() => { setShowTeaching(false); setSelectedBug(null); }} />
      )}
    </div>
  );
};

// Sub-components
const IDEToolbar = ({ onNewProject, skillLevel, setSkillLevel, proactiveMentorEnabled, setProactiveMentorEnabled, onRun, onInstall, onAnalyze, onAIFix, onHelp, onFullAnalysis, isRunning, isAnalyzing, isAnalyzingProject, hasTests, hasSelectedLines }) => (
  <div className="flex items-center justify-between gap-4 p-2 bg-[#1E1E1E] border-b border-white/10 flex-wrap">
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={onNewProject} className="gap-2 text-white/70"><Upload className="w-4 h-4" />New</Button>
      <Select value={skillLevel} onValueChange={setSkillLevel}>
        <SelectTrigger className="w-36 h-8 text-xs bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
        <SelectContent>{SKILL_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
      </Select>
      <Button variant="ghost" size="sm" onClick={() => setProactiveMentorEnabled(!proactiveMentorEnabled)} className={proactiveMentorEnabled ? 'text-[#34A853]' : 'text-white/50'}>
        {proactiveMentorEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </Button>
    </div>
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={onRun} disabled={isRunning} className="text-[#34A853]"><Play className="w-4 h-4" /></Button>
      <Button variant="ghost" size="sm" onClick={onInstall} disabled={isRunning} className="text-[#4285F4]"><Package className="w-4 h-4" /></Button>
      <Button variant="ghost" size="sm" onClick={onAnalyze} disabled={isAnalyzing} className="text-[#667eea]"><Code className="w-4 h-4" /></Button>
      <Button variant="ghost" size="sm" onClick={onAIFix} className="text-[#34A853]"><Wand2 className="w-4 h-4" /></Button>
      <Button variant="ghost" size="sm" onClick={onHelp} disabled={!hasSelectedLines} className="text-[#667eea]"><HelpCircle className="w-4 h-4" /></Button>
      <Button variant="ghost" size="sm" onClick={onFullAnalysis} disabled={isAnalyzingProject} className="text-[#EA4335]">
        {isAnalyzingProject ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
      </Button>
    </div>
  </div>
);

const ProactiveWarningBar = ({ warning, onDismiss }) => (
  <div className={`p-2 flex items-center justify-between gap-3 ${warning.severity === 'critical' ? 'bg-[#EA4335]/20' : warning.severity === 'warning' ? 'bg-[#FBBC04]/20' : 'bg-[#4285F4]/20'}`}>
    <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /><span className="text-sm">{warning.message}</span></div>
    <Button size="sm" variant="ghost" onClick={onDismiss} className="text-xs h-6">Dismiss</Button>
  </div>
);

const IDESidebar = ({ project, currentFilePath, onFileSelect }) => (
  <div className="h-full bg-[#252526] border-r border-white/10 flex flex-col overflow-hidden">
    <div className="p-3 border-b border-white/10">
      <h3 className="font-semibold text-sm truncate">{project?.name || 'Project'}</h3>
      <div className="text-xs text-white/50 mt-1">{project?.total_files} files</div>
    </div>
    {project?.languages && <LanguageStats languages={project.languages} />}
    <div className="flex-1 overflow-auto">
      {project?.root && <FileExplorer node={project.root} onFileSelect={onFileSelect} selectedPath={currentFilePath} />}
    </div>
  </div>
);

const FileTabs = ({ files, activeIndex, hasUnsavedChanges, onSelect, onClose }) => (
  <div className="flex items-center bg-[#252526] border-b border-white/10 overflow-x-auto shrink-0">
    {files.map((file, i) => (
      <div key={file.path} className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer border-r border-white/10 ${i === activeIndex ? 'bg-[#1E1E1E] text-white' : 'text-white/60 hover:bg-white/5'}`} onClick={() => onSelect(i)}>
        <File className="w-3 h-3" />
        <span className="truncate max-w-[120px]">{file.path.split('/').pop()}</span>
        {hasUnsavedChanges[file.path] && <span className="w-2 h-2 rounded-full bg-[#FBBC04]" />}
        <button onClick={(e) => { e.stopPropagation(); onClose(i); }} className="p-0.5 rounded hover:bg-white/10"><X className="w-3 h-3" /></button>
      </div>
    ))}
  </div>
);

const EmptyEditor = () => (
  <div className="h-full flex flex-col items-center justify-center text-white/40">
    <FolderOpen className="w-16 h-16 mb-4" />
    <p>Select a file to edit</p>
  </div>
);

const AnalysisPanel = ({ projectAnalysis, bugs, onLoadFile, onCloseAnalysis, onTeachBug }) => (
  <div className="h-full bg-[#252526] border-l border-white/10 overflow-auto">
    {projectAnalysis ? (
      <ProjectAnalysisPanel analysis={projectAnalysis} onLoadFile={onLoadFile} onClose={onCloseAnalysis} />
    ) : bugs.length > 0 ? (
      <div className="p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Code className="w-4 h-4 text-[#667eea]" />Analysis</h3>
        <div className="space-y-3">
          {bugs.map((bug, i) => (
            <div key={i} className="p-3 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10" onClick={() => onTeachBug(bug)}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-xs ${bug.severity === 'critical' ? 'bg-[#EA4335]/20 text-[#EA4335]' : 'bg-[#FBBC04]/20 text-[#FBBC04]'}`}>{bug.severity}</span>
                <span className="text-xs text-white/50">Line {bug.line}</span>
              </div>
              <p className="text-sm text-white/80">{bug.message}</p>
            </div>
          ))}
        </div>
      </div>
    ) : (
      <div className="p-4 text-center text-white/40"><Cpu className="w-12 h-12 mx-auto mb-4 opacity-50" /><p className="text-sm">Click Full Analysis</p></div>
    )}
  </div>
);

export default IDEWorkspace;

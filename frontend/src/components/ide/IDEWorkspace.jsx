import React, { useState, useRef, useEffect } from "react";
import { File, X, FolderOpen, Play, Upload, Code, Wand2, HelpCircle, Eye, EyeOff, Package, Cpu, Zap, AlertTriangle, Loader2 } from "lucide-react";
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
    if (project?.languages?.length > 0) setCurrentLanguage(project.languages[0].name.toLowerCase());
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
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      setOpenFiles(prev => [...prev, { path: data.path, content: data.content, language: data.language }]);
      setActiveFileIndex(openFiles.length);
      setEditorContent(data.content);
      setCurrentLanguage(data.language);
    } catch (error) {
      toast.error("Failed to load file");
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
      } else setEditorContent("");
    } else if (index < activeFileIndex) setActiveFileIndex(activeFileIndex - 1);
  };

  const runProject = async () => {
    if (!project) return;
    setIsRunning(true);
    setTerminalOutput(prev => [...prev, { type: 'command', text: 'Running...' }]);
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/run`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.project_id, file_path: currentFile?.path, skill_level: skillLevel })
      });
      const data = await response.json();
      if (data.output) setTerminalOutput(prev => [...prev, { type: 'output', text: data.output }]);
      if (data.error) setTerminalOutput(prev => [...prev, { type: 'error', text: data.error }]);
    } catch (error) {
      setTerminalOutput(prev => [...prev, { type: 'error', text: error.message }]);
    } finally { setIsRunning(false); }
  };

  const installDeps = async () => {
    if (!project) return;
    setIsRunning(true);
    setTerminalOutput(prev => [...prev, { type: 'command', text: 'Installing...' }]);
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/install-deps`, { method: "POST" });
      const data = await response.json();
      setTerminalOutput(prev => [...prev, { type: data.success ? 'success' : 'error', text: data.success ? 'Done' : data.error }]);
    } catch (error) {
      setTerminalOutput(prev => [...prev, { type: 'error', text: error.message }]);
    } finally { setIsRunning(false); }
  };

  const executeCommand = async (command) => {
    if (!project) return;
    setTerminalOutput(prev => [...prev, { type: 'command', text: `$ ${command}` }]);
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/terminal`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.project_id, command })
      });
      const data = await response.json();
      if (data.output) setTerminalOutput(prev => [...prev, { type: 'output', text: data.output }]);
      if (data.error) setTerminalOutput(prev => [...prev, { type: 'error', text: data.error }]);
    } catch (error) {
      setTerminalOutput(prev => [...prev, { type: 'error', text: error.message }]);
    }
  };

  const analyzeFullProject = async () => {
    if (!project) return;
    setIsAnalyzingProject(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/analyze-full`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.project_id, skill_level: skillLevel })
      });
      const data = await response.json();
      setProjectAnalysis(data);
      toast.success("Analysis complete!");
    } catch (error) { toast.error("Failed"); } 
    finally { setIsAnalyzingProject(false); }
  };

  const handleEditorDidMount = (editor, monaco) => {
    editor.onDidChangeCursorSelection((e) => {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        const lines = [];
        for (let i = selection.startLineNumber; i <= selection.endLineNumber; i++) lines.push(i);
        setSelectedLines(lines);
      } else setSelectedLines([]);
    });
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-center justify-between gap-4 p-2 bg-[#1E1E1E] border-b border-white/10">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onNewProject}><Upload className="w-4 h-4" /></Button>
          <Select value={skillLevel} onValueChange={setSkillLevel}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{SKILL_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={runProject} disabled={isRunning} className="text-[#34A853]"><Play className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={installDeps} disabled={isRunning} className="text-[#4285F4]"><Package className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={analyzeFullProject} disabled={isAnalyzingProject} className="text-[#EA4335]">
            {isAnalyzingProject ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      
      <div className="flex-1 grid grid-cols-[250px_1fr_280px] gap-0 overflow-hidden">
        <div className="h-full bg-[#252526] border-r border-white/10 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/10">
            <h3 className="font-semibold text-sm truncate">{project?.name}</h3>
            <div className="text-xs text-white/50">{project?.total_files} files</div>
          </div>
          {project?.languages && <LanguageStats languages={project.languages} />}
          <div className="flex-1 overflow-auto">
            {project?.root && <FileExplorer node={project.root} onFileSelect={loadFile} selectedPath={currentFile?.path} />}
          </div>
        </div>
        
        <div className="h-full flex flex-col overflow-hidden">
          <div className="flex-[2] flex flex-col bg-[#1E1E1E] overflow-hidden">
            <div className="flex items-center bg-[#252526] border-b border-white/10 overflow-x-auto">
              {openFiles.map((file, i) => (
                <div key={file.path} className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer ${i === activeFileIndex ? 'bg-[#1E1E1E]' : 'text-white/60'}`}
                  onClick={() => { setActiveFileIndex(i); setEditorContent(openFiles[i].content); setCurrentLanguage(openFiles[i].language); }}>
                  <File className="w-3 h-3" />
                  <span className="truncate max-w-[100px]">{file.path.split('/').pop()}</span>
                  <button onClick={(e) => { e.stopPropagation(); closeFile(i); }}><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
            <div className="flex-1">
              {openFiles.length > 0 ? (
                <Editor height="100%" language={currentLanguage} value={editorContent}
                  onChange={(v) => setEditorContent(v || "")} onMount={handleEditorDidMount} theme="vs-dark"
                  options={{ fontSize: 14, minimap: { enabled: true }, automaticLayout: true }} />
              ) : (
                <div className="h-full flex items-center justify-center text-white/40"><FolderOpen className="w-12 h-12" /></div>
              )}
            </div>
          </div>
          <div className="flex-1 border-t border-white/10">
            <IDETerminal output={terminalOutput} onCommand={executeCommand} isRunning={isRunning} onClear={() => setTerminalOutput([])} />
          </div>
        </div>
        
        <div className="h-full bg-[#252526] border-l border-white/10 overflow-auto">
          {projectAnalysis ? (
            <ProjectAnalysisPanel analysis={projectAnalysis} onLoadFile={loadFile} onClose={() => setProjectAnalysis(null)} />
          ) : (
            <div className="p-4 text-center text-white/40"><Cpu className="w-12 h-12 mx-auto mb-4" /><p className="text-sm">Click Analyze</p></div>
          )}
        </div>
      </div>
      
      {showLineMentoring && selectedLines.length > 0 && (
        <LineMentoringPanel code={editorContent} language={currentLanguage} selectedLines={selectedLines} skillLevel={skillLevel} onClose={() => setShowLineMentoring(false)} onApplyFix={() => toast.info("Review")} />
      )}
      {showTeaching && selectedBug && (
        <TeachingOverlay code={editorContent} bug={selectedBug} skillLevel={skillLevel} onClose={() => { setShowTeaching(false); setSelectedBug(null); }} />
      )}
    </div>
  );
};

export default IDEWorkspace;

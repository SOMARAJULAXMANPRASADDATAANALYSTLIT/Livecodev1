import React, { useState, useEffect } from "react";
import { File, X, FolderOpen, Play, Upload, Package, Cpu, Loader2 } from "lucide-react";
import Editor from "@monaco-editor/react";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { toast } from "sonner";
import { useMentor, SKILL_LEVELS } from "../../contexts/MentorContext";
import FileExplorer from "./FileExplorer";
import IDETerminal from "./IDETerminal";
import LanguageStats from "./LanguageStats";
import ProjectAnalysisPanel from "./ProjectAnalysisPanel";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const IDEWorkspace = ({ project, onNewProject }) => {
  const { skillLevel, setSkillLevel } = useMentor();
  
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [editorContent, setEditorContent] = useState("");
  const [currentLanguage, setCurrentLanguage] = useState("javascript");
  const [projectAnalysis, setProjectAnalysis] = useState(null);
  const [isAnalyzingProject, setIsAnalyzingProject] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  
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
      } else {
        setEditorContent("");
      }
    } else if (index < activeFileIndex) {
      setActiveFileIndex(activeFileIndex - 1);
    }
  };

  const runProject = async () => {
    if (!project) return;
    setIsRunning(true);
    setTerminalOutput(prev => [...prev, { type: 'command', text: 'Running...' }]);
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.project_id, file_path: currentFile?.path, skill_level: skillLevel })
      });
      const data = await response.json();
      if (data.output) setTerminalOutput(prev => [...prev, { type: 'output', text: data.output }]);
      if (data.error) setTerminalOutput(prev => [...prev, { type: 'error', text: data.error }]);
      if (data.error_explanation) setTerminalOutput(prev => [...prev, { type: 'info', text: data.error_explanation }]);
    } catch (error) {
      setTerminalOutput(prev => [...prev, { type: 'error', text: error.message }]);
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
      setTerminalOutput(prev => [...prev, { type: data.success ? 'success' : 'error', text: data.success ? 'Done!' : (data.error || 'Failed') }]);
    } catch (error) {
      setTerminalOutput(prev => [...prev, { type: 'error', text: error.message }]);
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
      setTerminalOutput(prev => [...prev, { type: 'error', text: error.message }]);
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

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <ToolbarSection 
        onNewProject={onNewProject}
        skillLevel={skillLevel}
        setSkillLevel={setSkillLevel}
        onRun={runProject}
        onInstall={installDeps}
        onAnalyze={analyzeFullProject}
        isRunning={isRunning}
        isAnalyzingProject={isAnalyzingProject}
      />
      
      <div className="flex-1 grid grid-cols-[250px_1fr_280px] gap-0 overflow-hidden">
        <SidebarSection project={project} currentFilePath={currentFile?.path} onFileSelect={loadFile} />
        <EditorSection 
          openFiles={openFiles}
          activeFileIndex={activeFileIndex}
          editorContent={editorContent}
          currentLanguage={currentLanguage}
          onSelectFile={(i) => { setActiveFileIndex(i); setEditorContent(openFiles[i].content); setCurrentLanguage(openFiles[i].language); }}
          onCloseFile={closeFile}
          onEditorChange={(v) => setEditorContent(v || "")}
          terminalOutput={terminalOutput}
          onCommand={executeCommand}
          isRunning={isRunning}
          onClearTerminal={() => setTerminalOutput([])}
        />
        <AnalysisSidebar projectAnalysis={projectAnalysis} onLoadFile={loadFile} onClose={() => setProjectAnalysis(null)} />
      </div>
    </div>
  );
};

const ToolbarSection = ({ onNewProject, skillLevel, setSkillLevel, onRun, onInstall, onAnalyze, isRunning, isAnalyzingProject }) => (
  <div className="flex items-center justify-between gap-4 p-2 bg-[#1E1E1E] border-b border-white/10">
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={onNewProject}>
        <Upload className="w-4 h-4" />
      </Button>
      <Select value={skillLevel} onValueChange={setSkillLevel}>
        <SelectTrigger className="w-32 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SKILL_LEVELS.map((l) => (
            <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={onRun} disabled={isRunning} className="text-[#34A853]">
        <Play className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onInstall} disabled={isRunning} className="text-[#4285F4]">
        <Package className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onAnalyze} disabled={isAnalyzingProject} className="text-[#EA4335]">
        {isAnalyzingProject ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
      </Button>
    </div>
  </div>
);

const SidebarSection = ({ project, currentFilePath, onFileSelect }) => (
  <div className="h-full bg-[#252526] border-r border-white/10 flex flex-col overflow-hidden">
    <div className="p-3 border-b border-white/10">
      <h3 className="font-semibold text-sm truncate">{project?.name}</h3>
      <div className="text-xs text-white/50">{project?.total_files} files</div>
    </div>
    {project?.languages && <LanguageStats languages={project.languages} />}
    <div className="flex-1 overflow-auto">
      {project?.root && <FileExplorer node={project.root} onFileSelect={onFileSelect} selectedPath={currentFilePath} />}
    </div>
  </div>
);

const EditorSection = ({ openFiles, activeFileIndex, editorContent, currentLanguage, onSelectFile, onCloseFile, onEditorChange, terminalOutput, onCommand, isRunning, onClearTerminal }) => (
  <div className="h-full flex flex-col overflow-hidden">
    <div className="flex-[2] flex flex-col bg-[#1E1E1E] overflow-hidden">
      <div className="flex items-center bg-[#252526] border-b border-white/10 overflow-x-auto">
        {openFiles.map((file, i) => (
          <div 
            key={file.path} 
            className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer ${i === activeFileIndex ? 'bg-[#1E1E1E]' : 'text-white/60'}`}
            onClick={() => onSelectFile(i)}
          >
            <File className="w-3 h-3" />
            <span className="truncate max-w-[100px]">{file.path.split('/').pop()}</span>
            <button onClick={(e) => { e.stopPropagation(); onCloseFile(i); }}>
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex-1">
        {openFiles.length > 0 ? (
          <Editor 
            height="100%" 
            language={currentLanguage} 
            value={editorContent}
            onChange={onEditorChange} 
            theme="vs-dark"
            options={{ fontSize: 14, minimap: { enabled: true }, automaticLayout: true }} 
          />
        ) : (
          <div className="h-full flex items-center justify-center text-white/40">
            <FolderOpen className="w-12 h-12" />
          </div>
        )}
      </div>
    </div>
    <div className="flex-1 border-t border-white/10">
      <IDETerminal output={terminalOutput} onCommand={onCommand} isRunning={isRunning} onClear={onClearTerminal} />
    </div>
  </div>
);

const AnalysisSidebar = ({ projectAnalysis, onLoadFile, onClose }) => (
  <div className="h-full bg-[#252526] border-l border-white/10 overflow-auto">
    {projectAnalysis ? (
      <ProjectAnalysisPanel analysis={projectAnalysis} onLoadFile={onLoadFile} onClose={onClose} />
    ) : (
      <div className="p-4 text-center text-white/40">
        <Cpu className="w-12 h-12 mx-auto mb-4" />
        <p className="text-sm">Click Analyze button</p>
      </div>
    )}
  </div>
);

export default IDEWorkspace;

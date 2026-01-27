import React, { useState, useEffect, useCallback } from "react";
import { 
  FolderOpen, Play, Bug, Terminal, X, 
  ChevronRight, Loader2, PanelRightOpen, PanelRightClose,
  FileCode, Cpu, Lightbulb, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import FileExplorer from "./FileExplorer";
import LanguageStats from "./LanguageStats";
import ProjectAnalysisPanel from "./ProjectAnalysisPanel";
import Editor from "@monaco-editor/react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function IDEWorkspace({ project, onNewProject }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [projectAnalysis, setProjectAnalysis] = useState(null);
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
  const [codeAnalysis, setCodeAnalysis] = useState(null);
  const [terminalOutput, setTerminalOutput] = useState("");
  const [showTerminal, setShowTerminal] = useState(false);
  const [isModified, setIsModified] = useState(false);

  const analyzeProject = useCallback(async () => {
    if (!project?.project_id) return;
    setIsAnalyzing(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/analyze-full`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.project_id, skill_level: "intermediate" }),
      });
      if (response.ok) {
        const data = await response.json();
        setProjectAnalysis(data);
        setShowAnalysisPanel(true);
        toast.success("Project analyzed successfully!");
      }
    } catch (error) {
      toast.error("Failed to analyze project");
    } finally {
      setIsAnalyzing(false);
    }
  }, [project?.project_id]);
  
  useEffect(() => {
    if (project?.project_id) analyzeProject();
  }, [project?.project_id, analyzeProject]);
  
  const loadFile = useCallback(async (path) => {
    if (!project?.project_id) return;
    setIsLoadingFile(true);
    setSelectedFile(path);
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/file?path=${encodeURIComponent(path)}`);
      if (response.ok) {
        const data = await response.json();
        setFileContent(data.content);
        setLanguage(data.language || "plaintext");
        setIsModified(false);
        setCodeAnalysis(null);
      }
    } catch (error) {
      toast.error("Failed to load file");
    } finally {
      setIsLoadingFile(false);
    }
  }, [project?.project_id]);
  
  const saveFile = useCallback(async () => {
    if (!project?.project_id || !selectedFile) return;
    setIsSaving(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.project_id, path: selectedFile, content: fileContent }),
      });
      if (response.ok) {
        setIsModified(false);
        toast.success("File saved!");
      }
    } catch (error) {
      toast.error("Failed to save file");
    } finally {
      setIsSaving(false);
    }
  }, [project?.project_id, selectedFile, fileContent]);
  
  const analyzeCurrentFile = useCallback(async () => {
    if (!fileContent.trim()) return toast.error("No code to analyze");
    setIsAnalyzing(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/analyze-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: fileContent, language: language.toLowerCase(), skill_level: "intermediate" }),
      });
      if (response.ok) {
        const data = await response.json();
        setCodeAnalysis(data);
        if (data.bugs?.length > 0) toast.warning(`Found ${data.bugs.length} issue(s)`);
        else toast.success("No issues found!");
      }
    } catch (error) {
      toast.error("Failed to analyze code");
    } finally {
      setIsAnalyzing(false);
    }
  }, [fileContent, language]);
  
  const runCurrentFile = useCallback(async () => {
    if (!project?.project_id || !selectedFile) return toast.error("Select a file first");
    const ext = selectedFile.split('.').pop();
    if (ext !== 'py' && ext !== 'js') return toast.error("Can only run .py or .js files");
    
    setIsRunning(true);
    setShowTerminal(true);
    setTerminalOutput("Running...\n");
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.project_id, file_path: selectedFile, skill_level: "intermediate" }),
      });
      if (response.ok) {
        const data = await response.json();
        let output = data.output || "";
        if (data.error) {
          output += `\n❌ Error:\n${data.error}`;
          if (data.error_explanation) output += `\n\n💡 ${data.error_explanation}`;
          if (data.fix_suggestion) output += `\n\n🔧 ${data.fix_suggestion}`;
          toast.error("Execution had errors");
        } else {
          output += `\n✅ Success (${(data.execution_time || 0).toFixed(3)}s)`;
          toast.success("Code executed!");
        }
        setTerminalOutput(output);
      }
    } catch (error) {
      setTerminalOutput("Failed to execute");
      toast.error("Failed to run");
    } finally {
      setIsRunning(false);
    }
  }, [project?.project_id, selectedFile]);
  
  const handleEditorChange = useCallback((value) => {
    setFileContent(value || "");
    setIsModified(true);
  }, []);
  
  const getMonacoLang = (lang) => {
    const map = { python: 'python', javascript: 'javascript', typescript: 'typescript', java: 'java', 'c++': 'cpp', go: 'go', rust: 'rust', html: 'html', css: 'css', json: 'json', yaml: 'yaml', markdown: 'markdown' };
    return map[lang?.toLowerCase()] || 'plaintext';
  };

  const canRun = selectedFile && (selectedFile.endsWith('.py') || selectedFile.endsWith('.js'));

  // Render toolbar
  const renderToolbar = () => (
    <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#161b22]">
      <div className="flex items-center gap-3">
        <FolderOpen className="w-5 h-5 text-[#FBBC04]" />
        <span className="font-medium">{project?.name || "Project"}</span>
        <span className="text-xs text-white/40">({project?.total_files || 0} files)</span>
        {selectedFile && (
          <span className="flex items-center gap-1 text-sm text-white/60">
            <ChevronRight className="w-4 h-4" />
            <span className={isModified ? "text-[#FBBC04]" : ""}>{selectedFile}{isModified && " •"}</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setShowAnalysisPanel(!showAnalysisPanel)}>
          {showAnalysisPanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={analyzeProject} disabled={isAnalyzing} className="gap-2">
          {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />} Analyze
        </Button>
        {selectedFile && (
          <Button variant="ghost" size="sm" onClick={analyzeCurrentFile} disabled={isAnalyzing} className="gap-2">
            <Bug className="w-4 h-4" /> Bugs
          </Button>
        )}
        {canRun && (
          <Button variant="ghost" size="sm" onClick={runCurrentFile} disabled={isRunning} className="gap-2 text-[#34A853]">
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run
          </Button>
        )}
        {isModified && (
          <Button variant="ghost" size="sm" onClick={saveFile} disabled={isSaving} className="text-[#FBBC04]">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onNewProject} className="gap-2">
          <Upload className="w-4 h-4" /> New
        </Button>
      </div>
    </div>
  );

  // Render sidebar
  const renderSidebar = () => (
    <div className="w-64 flex-shrink-0 flex flex-col bg-[#0d1117] border-r border-white/10">
      {project?.languages && <LanguageStats languages={project.languages} />}
      <div className="flex-1 overflow-auto">
        <FileExplorer node={project?.root} onFileSelect={loadFile} selectedPath={selectedFile} />
      </div>
      <div className="p-3 border-t border-white/10">
        {project?.frameworks?.map((fw, i) => (
          <span key={i} className="mr-1 px-2 py-0.5 text-xs bg-[#4285F4]/20 text-[#4285F4] rounded">{fw}</span>
        ))}
      </div>
    </div>
  );

  // Render editor area
  const renderEditor = () => (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex-1">
        {isLoadingFile ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#667eea]" />
          </div>
        ) : selectedFile ? (
          <Editor
            height="100%"
            language={getMonacoLang(language)}
            value={fileContent}
            onChange={handleEditorChange}
            theme="vs-dark"
            options={{ fontSize: 14, minimap: { enabled: true }, automaticLayout: true }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-white/40">
            <div className="text-center">
              <FileCode className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Select a file to view</p>
            </div>
          </div>
        )}
      </div>
      {codeAnalysis?.bugs?.length > 0 && (
        <div className="border-t border-white/10 p-3 bg-[#161b22] max-h-40 overflow-auto">
          <div className="flex items-center gap-2 mb-2">
            <Bug className="w-4 h-4 text-[#EA4335]" />
            <span className="text-sm">{codeAnalysis.bugs.length} issue(s)</span>
          </div>
          {codeAnalysis.bugs.map((bug, i) => (
            <div key={i} className="p-2 rounded bg-black/20 text-sm mb-1">
              <span className="text-[#EA4335]">Line {bug.line}:</span> {bug.message}
              {bug.suggestion && <p className="text-xs text-white/50 mt-1"><Lightbulb className="w-3 h-3 inline" /> {bug.suggestion}</p>}
            </div>
          ))}
        </div>
      )}
      {showTerminal && (
        <div className="border-t border-white/10 bg-black">
          <div className="flex items-center justify-between px-3 py-1 bg-[#161b22]">
            <span className="flex items-center gap-2 text-sm text-white/60"><Terminal className="w-4 h-4" /> Output</span>
            <button onClick={() => setShowTerminal(false)} className="p-1 hover:bg-white/10 rounded"><X className="w-4 h-4" /></button>
          </div>
          <pre className="p-3 text-sm font-mono max-h-40 overflow-auto whitespace-pre-wrap">{terminalOutput}</pre>
        </div>
      )}
    </div>
  );

  // Render analysis panel
  const renderAnalysisPanel = () => {
    if (!showAnalysisPanel) return null;
    return (
      <div className="w-80 flex-shrink-0 bg-[#0d1117] border-l border-white/10">
        {isAnalyzing && !projectAnalysis ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#667eea]" />
          </div>
        ) : projectAnalysis ? (
          <ProjectAnalysisPanel analysis={projectAnalysis} onLoadFile={loadFile} onClose={() => setShowAnalysisPanel(false)} />
        ) : (
          <div className="h-full flex items-center justify-center text-white/40">
            <div className="text-center"><Cpu className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Click Analyze</p></div>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {renderToolbar()}
      <div className="flex-1 flex overflow-hidden">
        {renderSidebar()}
        {renderEditor()}
        {renderAnalysisPanel()}
      </div>
    </div>
  );
}

export default IDEWorkspace;

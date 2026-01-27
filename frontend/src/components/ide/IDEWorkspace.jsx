import React, { useState, useEffect, lazy, Suspense } from "react";
import { FolderOpen, Upload, Loader2, FileCode, Play, Terminal, X, Bug, Cpu, ChevronRight, ChevronDown, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Lazy load heavy components
const Editor = lazy(() => import("@monaco-editor/react"));

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Inline simple file tree component
function SimpleFileTree({ files, onSelect, selected }) {
  if (!files) return null;
  return (
    <div className="text-sm">
      {files.map((f, i) => (
        <div
          key={f.path || i}
          className={`py-1 px-2 cursor-pointer hover:bg-white/10 rounded ${selected === f.path ? 'bg-[#667eea]/20' : ''}`}
          onClick={() => f.type === 'file' && onSelect(f.path)}
        >
          {f.type === 'directory' ? <Folder className="w-4 h-4 inline mr-2 text-yellow-500" /> : <FileCode className="w-4 h-4 inline mr-2 text-blue-400" />}
          {f.name}
        </div>
      ))}
    </div>
  );
}

// Inline analysis summary
function AnalysisSummary({ data, onClose }) {
  if (!data) return null;
  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center p-3 border-b border-white/10">
        <span className="font-medium flex items-center gap-2"><Cpu className="w-4 h-4 text-red-500" />Analysis</span>
        <button onClick={onClose}><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-3 text-sm">
        <div className="p-2 bg-white/5 rounded"><strong>{data.project_name}</strong><p className="text-white/60 text-xs mt-1">{data.purpose}</p></div>
        {data.architecture_overview && <div className="p-2 bg-white/5 rounded"><strong>Architecture</strong><p className="text-white/60 text-xs mt-1">{data.architecture_overview}</p></div>}
        {data.entry_points?.length > 0 && (
          <div className="p-2 bg-white/5 rounded">
            <strong>Entry Points</strong>
            {data.entry_points.map((ep, i) => <p key={i} className="text-blue-400 text-xs">{ep.file}</p>)}
          </div>
        )}
        {data.potential_issues?.length > 0 && (
          <div className="p-2 bg-red-500/10 rounded border border-red-500/30">
            <strong className="text-red-400">Issues</strong>
            {data.potential_issues.map((issue, i) => <p key={i} className="text-xs text-white/60">• {issue}</p>)}
          </div>
        )}
        {data.improvement_suggestions?.length > 0 && (
          <div className="p-2 bg-green-500/10 rounded border border-green-500/30">
            <strong className="text-green-400">Suggestions</strong>
            {data.improvement_suggestions.map((s, i) => <p key={i} className="text-xs text-white/60">✓ {s}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function IDEWorkspace({ project, onNewProject }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [language, setLanguage] = useState("plaintext");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [showPanel, setShowPanel] = useState(true);
  const [output, setOutput] = useState("");
  const [showOutput, setShowOutput] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (project?.project_id) {
      setAnalyzing(true);
      fetch(`${BACKEND_URL}/api/project/${project.project_id}/analyze-full`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.project_id, skill_level: "intermediate" }),
      })
        .then(r => r.json())
        .then(data => {
          setAnalysis(data);
          toast.success("Project analyzed!");
        })
        .catch(() => toast.error("Analysis failed"))
        .finally(() => setAnalyzing(false));
    }
  }, [project?.project_id]);

  const openFile = async (path) => {
    setLoading(true);
    setSelectedFile(path);
    try {
      const r = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/file?path=${encodeURIComponent(path)}`);
      const data = await r.json();
      setFileContent(data.content);
      setLanguage(data.language?.toLowerCase() || "plaintext");
    } catch (e) {
      toast.error("Failed to load file");
    }
    setLoading(false);
  };

  const runFile = async () => {
    if (!selectedFile) return;
    setShowOutput(true);
    setRunning(true);
    setOutput("Running...");
    try {
      const r = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.project_id, file_path: selectedFile, skill_level: "intermediate" }),
      });
      const data = await r.json();
      let out = data.output || "";
      if (data.error) {
        out += `\n\n❌ Error:\n${data.error}`;
        if (data.error_explanation) out += `\n\n💡 ${data.error_explanation}`;
        if (data.fix_suggestion) out += `\n\n🔧 ${data.fix_suggestion}`;
      } else {
        out += `\n\n✅ Success (${(data.execution_time || 0).toFixed(3)}s)`;
      }
      setOutput(out);
      toast.success(data.error ? "Execution had errors" : "Code executed!");
    } catch (e) {
      setOutput("Execution failed");
      toast.error("Failed to run");
    }
    setRunning(false);
  };

  const analyzeFile = async () => {
    if (!fileContent.trim()) return toast.error("No code");
    setAnalyzing(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/analyze-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: fileContent, language, skill_level: "intermediate" }),
      });
      const data = await r.json();
      if (data.bugs?.length > 0) {
        toast.warning(`Found ${data.bugs.length} issue(s)`);
        setOutput(`Code Analysis:\n${data.bugs.map(b => `Line ${b.line}: ${b.message}`).join('\n')}`);
        setShowOutput(true);
      } else {
        toast.success("No issues found!");
      }
    } catch (e) {
      toast.error("Analysis failed");
    }
    setAnalyzing(false);
  };

  const canRun = selectedFile?.endsWith(".py") || selectedFile?.endsWith(".js");
  const langMap = { python: 'python', javascript: 'javascript', typescript: 'typescript', java: 'java', 'c++': 'cpp', go: 'go', rust: 'rust', html: 'html', css: 'css', json: 'json', yaml: 'yaml', markdown: 'markdown' };
  const monacoLang = langMap[language] || 'plaintext';

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-white/10 bg-[#161b22]">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-yellow-500" />
          <span className="font-medium">{project?.name}</span>
          <span className="text-xs text-white/40">({project?.total_files} files)</span>
          {selectedFile && <span className="text-white/50 text-sm flex items-center gap-1"><ChevronRight className="w-3 h-3" />{selectedFile}</span>}
        </div>
        <div className="flex gap-2">
          {selectedFile && <Button size="sm" variant="ghost" onClick={analyzeFile} disabled={analyzing}><Bug className="w-4 h-4 mr-1" />Bugs</Button>}
          {canRun && <Button size="sm" variant="ghost" onClick={runFile} disabled={running}><Play className="w-4 h-4 mr-1" />{running ? "..." : "Run"}</Button>}
          <Button size="sm" variant="ghost" onClick={() => setShowPanel(!showPanel)}><Cpu className="w-4 h-4" /></Button>
          <Button size="sm" variant="outline" onClick={onNewProject}><Upload className="w-4 h-4 mr-1" />New</Button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-56 border-r border-white/10 flex flex-col">
          {project?.languages && (
            <div className="p-2 border-b border-white/10">
              <div className="h-2 rounded flex overflow-hidden">
                {project.languages.map((l, i) => <div key={i} style={{ width: `${l.percentage}%`, backgroundColor: l.color }} title={l.name} />)}
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {project.languages.slice(0, 3).map((l, i) => <span key={i} className="text-xs text-white/50">{l.name} {l.percentage}%</span>)}
              </div>
            </div>
          )}
          <div className="flex-1 overflow-auto p-2">
            <SimpleFileTree files={project?.root?.children} onSelect={openFile} selected={selectedFile} />
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1">
            {loading ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#667eea]" /></div>
            ) : selectedFile ? (
              <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
                <Editor
                  height="100%"
                  language={monacoLang}
                  value={fileContent}
                  theme="vs-dark"
                  options={{ fontSize: 14, minimap: { enabled: true }, automaticLayout: true, readOnly: true }}
                />
              </Suspense>
            ) : (
              <div className="h-full flex items-center justify-center text-white/40 flex-col">
                <FileCode className="w-16 h-16 mb-4 opacity-50" />
                <p>Select a file to view</p>
              </div>
            )}
          </div>
          {showOutput && (
            <div className="h-40 border-t border-white/10 bg-black">
              <div className="flex justify-between px-3 py-1 bg-[#161b22]">
                <span className="text-xs flex items-center gap-1"><Terminal className="w-3 h-3" />Output</span>
                <button onClick={() => setShowOutput(false)}><X className="w-3 h-3" /></button>
              </div>
              <pre className="p-3 text-xs overflow-auto h-32 whitespace-pre-wrap">{output}</pre>
            </div>
          )}
        </div>

        {/* Analysis Panel */}
        {showPanel && (
          <div className="w-72 border-l border-white/10">
            {analyzing && !analysis ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#667eea]" /></div>
            ) : (
              <AnalysisSummary data={analysis} onClose={() => setShowPanel(false)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

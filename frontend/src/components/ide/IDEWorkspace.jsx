import React, { useState, useEffect } from "react";
import { FolderOpen, Upload, Loader2, FileCode, Play, Terminal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import FileExplorer from "./FileExplorer";
import LanguageStats from "./LanguageStats";
import ProjectAnalysisPanel from "./ProjectAnalysisPanel";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function IDEWorkspace({ project, onNewProject }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [showPanel, setShowPanel] = useState(true);
  const [output, setOutput] = useState("");
  const [showOutput, setShowOutput] = useState(false);

  useEffect(() => {
    if (project?.project_id) {
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
        .catch(() => toast.error("Analysis failed"));
    }
  }, [project?.project_id]);

  const openFile = async (path) => {
    setLoading(true);
    setSelectedFile(path);
    try {
      const r = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/file?path=${encodeURIComponent(path)}`);
      const data = await r.json();
      setFileContent(data.content);
    } catch (e) {
      toast.error("Failed to load file");
    }
    setLoading(false);
  };

  const runFile = async () => {
    if (!selectedFile) return;
    setShowOutput(true);
    setOutput("Running...");
    try {
      const r = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.project_id, file_path: selectedFile, skill_level: "intermediate" }),
      });
      const data = await r.json();
      setOutput(data.output + (data.error ? `\nError: ${data.error}` : "\n✅ Success"));
    } catch (e) {
      setOutput("Execution failed");
    }
  };

  const canRun = selectedFile?.endsWith(".py") || selectedFile?.endsWith(".js");

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      <div className="flex items-center justify-between p-3 border-b border-white/10 bg-[#161b22]">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-yellow-500" />
          <span>{project?.name}</span>
          {selectedFile && <span className="text-white/50 text-sm">/ {selectedFile}</span>}
        </div>
        <div className="flex gap-2">
          {canRun && <Button size="sm" variant="ghost" onClick={runFile}><Play className="w-4 h-4 mr-1" />Run</Button>}
          <Button size="sm" variant="outline" onClick={onNewProject}><Upload className="w-4 h-4 mr-1" />New</Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-56 border-r border-white/10 flex flex-col">
          {project?.languages && <LanguageStats languages={project.languages} />}
          <div className="flex-1 overflow-auto">
            <FileExplorer node={project?.root} onFileSelect={openFile} selectedPath={selectedFile} />
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>
          ) : selectedFile ? (
            <pre className="flex-1 p-4 overflow-auto text-sm font-mono bg-[#1e1e1e]">{fileContent}</pre>
          ) : (
            <div className="flex-1 flex items-center justify-center text-white/40"><FileCode className="w-16 h-16" /></div>
          )}
          {showOutput && (
            <div className="h-32 border-t border-white/10 bg-black">
              <div className="flex justify-between px-2 py-1 bg-[#161b22]">
                <span className="text-xs flex items-center gap-1"><Terminal className="w-3 h-3" />Output</span>
                <button onClick={() => setShowOutput(false)}><X className="w-3 h-3" /></button>
              </div>
              <pre className="p-2 text-xs overflow-auto h-24">{output}</pre>
            </div>
          )}
        </div>

        {showPanel && analysis && (
          <div className="w-72 border-l border-white/10">
            <ProjectAnalysisPanel analysis={analysis} onLoadFile={openFile} onClose={() => setShowPanel(false)} />
          </div>
        )}
      </div>
    </div>
  );
}

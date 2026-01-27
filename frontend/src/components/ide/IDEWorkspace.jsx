import React, { useState } from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function IDEWorkspace({ project, onNewProject }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-yellow-500" />
          <span>{project?.name}</span>
        </div>
        <Button size="sm" onClick={onNewProject}>New Project</Button>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="w-56 border-r border-white/10 overflow-auto p-2">
          {project?.root?.children?.map((file, i) => (
            <div key={i} className="p-1 cursor-pointer hover:bg-white/10 rounded" onClick={() => openFile(file.path)}>
              {file.name}
            </div>
          ))}
        </div>
        <div className="flex-1 p-4">
          {loading ? "Loading..." : <pre className="text-sm">{fileContent || "Select a file"}</pre>}
        </div>
      </div>
    </div>
  );
}

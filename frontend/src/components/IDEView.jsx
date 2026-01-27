import React, { useState } from "react";
import { FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMentor } from "@/contexts/MentorContext";
import ProjectUploadZone from "@/components/ide/ProjectUploadZone";
import IDEWorkspace from "@/components/ide/IDEWorkspace";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const IDEView = () => {
  const { skillLevel } = useMentor();
  const [project, setProject] = useState(null);
  const [showUpload, setShowUpload] = useState(true);

  const handleProjectUpload = async (projectData) => {
    setProject(projectData);
    setShowUpload(false);
    toast.success(`Project loaded: ${projectData.name}`);
  };

  if (showUpload) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <ProjectUploadZone onProjectUpload={handleProjectUpload} />
      </div>
    );
  }

  return (
    <IDEWorkspace 
      project={project}
      onNewProject={() => setShowUpload(true)}
    />
  );
};

export default IDEView;

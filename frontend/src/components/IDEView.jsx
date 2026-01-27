import React, { useState } from "react";
import { toast } from "sonner";
import ProjectUploadZone from "./ide/ProjectUploadZone";
import IDEWorkspace from "./ide/IDEWorkspace";

const IDEView = () => {
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

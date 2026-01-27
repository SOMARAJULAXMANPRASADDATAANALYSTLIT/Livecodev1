import React from "react";

export default function IDEWorkspace({ project, onNewProject }) {
  return (
    <div style={{ padding: 20, color: "white", background: "#111", height: "100vh" }}>
      <h1>IDE Workspace - Coming Soon</h1>
      <p>Project: {project?.name}</p>
      <button onClick={onNewProject} style={{ marginTop: 20, padding: "10px 20px", cursor: "pointer" }}>
        Upload New Project
      </button>
    </div>
  );
}

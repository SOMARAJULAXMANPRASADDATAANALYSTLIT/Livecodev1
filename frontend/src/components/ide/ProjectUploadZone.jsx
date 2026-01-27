import React, { useState, useCallback } from "react";
import { Upload, Loader2, FolderOpen, Github, FileCode, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ProjectUploadZone = ({ onProjectUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);
  
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };
  
  const handleFileUpload = async (file) => {
    if (!file.name.endsWith('.zip')) {
      toast.error('Please upload a ZIP file');
      return;
    }
    
    setIsUploading(true);
    setUploadProgress("Uploading project...");
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      setUploadProgress("Extracting files...");
      
      const response = await fetch(`${BACKEND_URL}/api/upload-project`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      setUploadProgress("Analyzing project structure...");
      
      const data = await response.json();
      
      toast.success(`Project loaded: ${data.total_files} files`);
      onProjectUpload(data);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload project');
    } finally {
      setIsUploading(false);
      setUploadProgress("");
    }
  };
  
  return (
    <div className="w-full max-w-2xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center">
          <FolderOpen className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Live Code Mentor IDE</h1>
        <p className="text-white/60">Upload a project to start coding with AI assistance</p>
      </div>
      
      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
          isDragging
            ? 'border-[#667eea] bg-[#667eea]/10'
            : 'border-white/20 hover:border-white/40'
        }`}
      >
        {isUploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-12 h-12 animate-spin text-[#667eea] mb-4" />
            <p className="text-white/70">{uploadProgress}</p>
          </div>
        ) : (
          <>
            <Upload className="w-12 h-12 mx-auto mb-4 text-white/40" />
            <p className="text-lg font-medium mb-2">Drop your project ZIP here</p>
            <p className="text-sm text-white/50 mb-6">or click to browse files</p>
            
            <input
              type="file"
              accept=".zip"
              onChange={handleFileSelect}
              className="hidden"
              id="project-upload-input"
            />
            <label htmlFor="project-upload-input">
              <Button variant="outline" className="cursor-pointer" asChild>
                <span>
                  <FileCode className="w-4 h-4 mr-2" />
                  Select ZIP File
                </span>
              </Button>
            </label>
          </>
        )}
      </div>
      
      {/* Features */}
      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white/5 text-center">
          <Zap className="w-6 h-6 mx-auto mb-2 text-[#FBBC04]" />
          <h3 className="font-medium text-sm">Run Code</h3>
          <p className="text-xs text-white/50">Execute any file</p>
        </div>
        <div className="p-4 rounded-xl bg-white/5 text-center">
          <FileCode className="w-6 h-6 mx-auto mb-2 text-[#4285F4]" />
          <h3 className="font-medium text-sm">AI Analysis</h3>
          <p className="text-xs text-white/50">Find bugs & issues</p>
        </div>
        <div className="p-4 rounded-xl bg-white/5 text-center">
          <Github className="w-6 h-6 mx-auto mb-2 text-[#34A853]" />
          <h3 className="font-medium text-sm">Full Support</h3>
          <p className="text-xs text-white/50">Any language</p>
        </div>
      </div>
      
      {/* Supported Languages */}
      <div className="mt-6 text-center">
        <p className="text-xs text-white/40">
          Supports: Python, JavaScript, TypeScript, Java, Go, Rust, C++, PHP, Ruby, and more
        </p>
      </div>
    </div>
  );
};

export default ProjectUploadZone;

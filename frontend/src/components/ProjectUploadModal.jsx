import React, { useState, useCallback } from "react";
import { X, Upload, Loader2, FolderOpen, FileCode, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useMentor } from "@/contexts/MentorContext";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ProjectUploadModal = ({ onClose, onProjectLoaded }) => {
  const { skillLevel, setUploadedProject, setProjectAnalysis, setLearningJourney } = useMentor();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

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
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${BACKEND_URL}/api/upload-project`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      setProjectId(data.project_id);
      setUploadedFiles(data.files);
      setUploadedProject(data);
      toast.success(`Uploaded ${data.files_count} files`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload project');
    } finally {
      setIsUploading(false);
    }
  };

  const analyzeProject = async () => {
    if (!projectId) return;

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('project_id', projectId);
      formData.append('skill_level', skillLevel);

      const response = await fetch(`${BACKEND_URL}/api/analyze-project`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Analysis failed');

      const data = await response.json();
      setAnalysisResult(data);
      setProjectAnalysis(data);

      // Generate learning journey
      const journeyResponse = await fetch(`${BACKEND_URL}/api/generate-learning-journey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          skill_level: skillLevel,
        }),
      });

      if (journeyResponse.ok) {
        const journeyData = await journeyResponse.json();
        setLearningJourney(journeyData);
      }

      toast.success('Project analyzed successfully!');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze project');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4 animate-fadeIn">
      <div className="teaching-card w-full max-w-2xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10 animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#4285F4] to-[#667eea] flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Upload Project</h2>
              <p className="text-xs text-white/50">Learn from a complete codebase</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-6">
          {!uploadedFiles ? (
            /* Upload Zone */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                isDragging
                  ? 'border-[#4285F4] bg-[#4285F4]/10'
                  : 'border-white/20 hover:border-white/40'
              }`}
            >
              {isUploading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-12 h-12 animate-spin text-[#4285F4] mb-4" />
                  <p className="text-white/70">Uploading project...</p>
                </div>
              ) : (
                <>
                  <Upload className="w-12 h-12 mx-auto mb-4 text-white/40" />
                  <p className="text-lg font-medium mb-2">Drop your project ZIP here</p>
                  <p className="text-sm text-white/50 mb-4">or click to browse</p>
                  <input
                    type="file"
                    accept=".zip"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="project-upload"
                  />
                  <label htmlFor="project-upload">
                    <Button variant="outline" className="cursor-pointer" asChild>
                      <span>Select ZIP File</span>
                    </Button>
                  </label>
                  <p className="text-xs text-white/40 mt-4">
                    Supports ZIP files up to 10MB with code files
                  </p>
                </>
              )}
            </div>
          ) : !analysisResult ? (
            /* Files Preview */
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#34A853]">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Project uploaded successfully!</span>
              </div>

              <div className="glass-light rounded-xl p-4">
                <h3 className="font-medium mb-3">Files detected ({uploadedFiles.length})</h3>
                <div className="max-h-[200px] overflow-y-auto space-y-1">
                  {uploadedFiles.slice(0, 30).map((file, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-white/70">
                      <FileCode className="w-4 h-4 text-white/40" />
                      {file}
                    </div>
                  ))}
                  {uploadedFiles.length > 30 && (
                    <p className="text-xs text-white/50 mt-2">
                      ...and {uploadedFiles.length - 30} more files
                    </p>
                  )}
                </div>
              </div>

              <Button
                onClick={analyzeProject}
                disabled={isAnalyzing}
                className="w-full btn-primary gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing project...
                  </>
                ) : (
                  <>
                    <FolderOpen className="w-4 h-4" />
                    Analyze & Create Learning Journey
                  </>
                )}
              </Button>
            </div>
          ) : (
            /* Analysis Result */
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#34A853]">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Project analyzed!</span>
              </div>

              <div className="glass-light rounded-xl p-4">
                <h3 className="text-lg font-bold mb-2">{analysisResult.project_name}</h3>
                <p className="text-white/70 text-sm mb-4">{analysisResult.purpose}</p>

                {analysisResult.entry_points?.length > 0 && (
                  <div className="mb-3">
                    <span className="text-xs text-white/50">Entry Points:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {analysisResult.entry_points.map((ep, i) => (
                        <span key={i} className="px-2 py-1 bg-[#4285F4]/20 rounded text-xs text-[#4285F4]">
                          {ep}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <span className="text-xs text-white/50">Architecture:</span>
                  <p className="text-sm text-white/80 mt-1">{analysisResult.architecture_overview}</p>
                </div>
              </div>

              <Button
                onClick={() => onProjectLoaded(analysisResult)}
                className="w-full btn-primary gap-2"
              >
                Start Learning Journey
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10">
          <Button onClick={onClose} variant="outline" className="w-full">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProjectUploadModal;

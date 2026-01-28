import React, { useState, useCallback } from "react";
import { X, Upload, Loader2, FolderOpen, FileCode, CheckCircle, Bug, Lightbulb, BookOpen, Cpu, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useMentor } from "@/contexts/MentorContext";
import ProjectTeachingModal from "./ProjectTeachingModal";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ProjectUploadModal = ({ onClose, onProjectLoaded }) => {
  const { skillLevel, setUploadedProject, setProjectAnalysis, setLearningJourney } = useMentor();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [projectData, setProjectData] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [showTeachingModal, setShowTeachingModal] = useState(false);

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
      setProjectData(data);
      setUploadedProject(data);
      toast.success(`Uploaded ${data.total_files} files from ${data.name}`);
      
      // Automatically start analysis
      analyzeProject(data.project_id);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload project');
      setIsUploading(false);
    }
  };

  const analyzeProject = async (projectId) => {
    setIsAnalyzing(true);
    try {
      // Full project analysis
      const response = await fetch(`${BACKEND_URL}/api/project/${projectId}/analyze-full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          skill_level: skillLevel,
        }),
      });

      if (!response.ok) throw new Error('Analysis failed');

      const data = await response.json();
      setAnalysisResult(data);
      setProjectAnalysis(data);

      // Generate learning journey based on analysis
      if (data.learning_roadmap) {
        setLearningJourney({
          roadmap: data.learning_roadmap,
          file_recommendations: data.file_recommendations || [],
          current_step: 0
        });
      }

      toast.success('Project analyzed successfully!');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze project');
    } finally {
      setIsUploading(false);
      setIsAnalyzing(false);
    }
  };

  const handleStartCoding = () => {
    if (projectData && onProjectLoaded) {
      // Pass project data for coding mode
      onProjectLoaded({
        ...projectData,
        analysis: analysisResult,
        mode: 'coding' // Indicate this is coding mode, not teaching
      });
    }
    onClose();
  };

  const handleStartLearning = () => {
    if (analysisResult && onProjectLoaded) {
      // Pass project data for learning journey mode
      onProjectLoaded({
        ...projectData,
        analysis: analysisResult,
        mode: 'learning' // Indicate this is learning mode
      });
    }
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4 animate-fadeIn">
      <div className="teaching-card w-full max-w-2xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10 animate-slideUp bg-[#1a1a2e]">
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
          {!projectData ? (
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
                  <p className="text-white/70">Uploading and analyzing project...</p>
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
                      <span><FileCode className="w-4 h-4 mr-2" />Select ZIP File</span>
                    </Button>
                  </label>
                  <p className="text-xs text-white/40 mt-4">
                    Supports ZIP files up to 10MB with code files
                  </p>
                </>
              )}
            </div>
          ) : isAnalyzing ? (
            /* Analyzing State */
            <div className="text-center py-12">
              <Cpu className="w-16 h-16 mx-auto mb-4 text-[#667eea] animate-pulse" />
              <h3 className="text-lg font-semibold mb-2">Analyzing Your Codebase</h3>
              <p className="text-white/60 text-sm mb-4">AI is understanding your project structure...</p>
              <div className="flex justify-center gap-2">
                <div className="w-2 h-2 bg-[#667eea] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-[#667eea] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-[#667eea] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          ) : analysisResult ? (
            /* Analysis Result */
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#34A853]">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Project analyzed successfully!</span>
              </div>

              {/* Project Overview */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-[#FBBC04]" />
                  {analysisResult.project_name}
                </h3>
                <p className="text-white/70 text-sm mb-4">{analysisResult.purpose}</p>

                {/* Languages */}
                {projectData?.languages?.length > 0 && (
                  <div className="mb-4">
                    <span className="text-xs text-white/50">Languages:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {projectData.languages.slice(0, 5).map((lang, i) => (
                        <span key={i} className="px-2 py-1 text-xs rounded" style={{ backgroundColor: `${lang.color}20`, color: lang.color }}>
                          {lang.name} {lang.percentage}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Entry Points */}
                {analysisResult.entry_points?.length > 0 && (
                  <div className="mb-4">
                    <span className="text-xs text-white/50">Entry Points:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {analysisResult.entry_points.map((ep, i) => (
                        <span key={i} className="px-2 py-1 bg-[#4285F4]/20 rounded text-xs text-[#4285F4]">
                          {ep.file || ep}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Architecture */}
                {analysisResult.architecture_overview && (
                  <div>
                    <span className="text-xs text-white/50">Architecture:</span>
                    <p className="text-sm text-white/80 mt-1">{analysisResult.architecture_overview}</p>
                  </div>
                )}
              </div>

              {/* Potential Issues */}
              {analysisResult.potential_issues?.length > 0 && (
                <div className="bg-[#EA4335]/10 border border-[#EA4335]/30 rounded-xl p-4">
                  <h4 className="font-medium text-[#EA4335] mb-2 flex items-center gap-2">
                    <Bug className="w-4 h-4" /> Potential Issues ({analysisResult.potential_issues.length})
                  </h4>
                  <ul className="space-y-1">
                    {analysisResult.potential_issues.slice(0, 3).map((issue, i) => (
                      <li key={i} className="text-sm text-white/70">• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggestions */}
              {analysisResult.improvement_suggestions?.length > 0 && (
                <div className="bg-[#34A853]/10 border border-[#34A853]/30 rounded-xl p-4">
                  <h4 className="font-medium text-[#34A853] mb-2 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" /> Improvement Suggestions
                  </h4>
                  <ul className="space-y-1">
                    {analysisResult.improvement_suggestions.slice(0, 3).map((sug, i) => (
                      <li key={i} className="text-sm text-white/70">✓ {sug}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Learning Roadmap */}
              {analysisResult.learning_roadmap && (
                <div className="bg-[#667eea]/10 border border-[#667eea]/30 rounded-xl p-4">
                  <h4 className="font-medium text-[#667eea] mb-2 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" /> Learning Roadmap ({skillLevel})
                  </h4>
                  <ol className="space-y-1">
                    {(analysisResult.learning_roadmap[skillLevel] || analysisResult.learning_roadmap.beginner || []).slice(0, 3).map((step, i) => (
                      <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                        <span className="text-[#667eea] font-bold">{i + 1}.</span> {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Start Learning Buttons */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <Button 
                  onClick={() => setShowTeachingModal(true)} 
                  className="btn-primary gap-2"
                >
                  <GraduationCap className="w-4 h-4" />
                  Teach Me This Project
                </Button>
                <Button 
                  onClick={handleStartCoding} 
                  variant="outline" 
                  className="gap-2 border-[#667eea] text-[#667eea] hover:bg-[#667eea]/10"
                >
                  <Cpu className="w-4 h-4" />
                  Start Coding
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10">
          <Button onClick={onClose} variant="outline" className="w-full">
            Close
          </Button>
        </div>
      </div>
    </div>
      
      {/* Teaching Modal */}
      {showTeachingModal && projectData && analysisResult && (
        <ProjectTeachingModal
          projectId={projectData.project_id}
          projectData={projectData}
          onClose={() => setShowTeachingModal(false)}
          skillLevel={skillLevel}
        />
      )}
    </>
  );
};

export default ProjectUploadModal;

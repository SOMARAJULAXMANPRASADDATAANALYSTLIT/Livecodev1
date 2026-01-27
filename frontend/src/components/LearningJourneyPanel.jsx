import React, { useState } from "react";
import { X, BookOpen, ChevronRight, Clock, CheckCircle, Play, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMentor } from "@/contexts/MentorContext";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const LearningJourneyPanel = ({ onClose, onLoadFile }) => {
  const { 
    learningJourney, 
    projectAnalysis, 
    uploadedProject,
    currentJourneyStep, 
    setCurrentJourneyStep 
  } = useMentor();
  
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [completedSteps, setCompletedSteps] = useState(new Set());

  if (!learningJourney) {
    return null;
  }

  const loadStepFile = async (step) => {
    if (!uploadedProject?.project_id || !step.file) {
      toast.error('Could not load file');
      return;
    }

    setIsLoadingFile(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/project/${uploadedProject.project_id}/files`);
      if (!response.ok) throw new Error('Failed to load files');

      const data = await response.json();
      const file = data.files.find(f => f.path.endsWith(step.file) || f.path.includes(step.file));

      if (file) {
        onLoadFile(file.content, file.language);
        setCurrentJourneyStep(step.step_number - 1);
        toast.success(`Loaded ${step.file}`);
      } else {
        toast.error('File not found in project');
      }
    } catch (error) {
      console.error('Load file error:', error);
      toast.error('Failed to load file');
    } finally {
      setIsLoadingFile(false);
    }
  };

  const markStepComplete = (stepNumber) => {
    setCompletedSteps(prev => new Set([...prev, stepNumber]));
    toast.success('Step completed! Great progress!');
  };

  const progress = (completedSteps.size / (learningJourney.journey_steps?.length || 1)) * 100;

  return (
    <div className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4 animate-fadeIn">
      <div className="teaching-card w-full max-w-3xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10 animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#667eea] to-[#764ba2] flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Learning Journey</h2>
              <p className="text-xs text-white/50">
                {projectAnalysis?.project_name || 'Your Project'} • {learningJourney.estimated_time}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3 bg-white/5">
          <div className="flex items-center justify-between text-xs text-white/60 mb-2">
            <span>Progress</span>
            <span>{completedSteps.size} / {learningJourney.journey_steps?.length || 0} steps</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#667eea] to-[#764ba2] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-280px)] p-6">
          {/* Key Concepts */}
          {learningJourney.key_concepts?.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-white/60 mb-2">Key Concepts You'll Learn</h3>
              <div className="flex flex-wrap gap-2">
                {learningJourney.key_concepts.map((concept, i) => (
                  <span key={i} className="px-3 py-1 bg-[#667eea]/20 rounded-full text-xs text-[#667eea]">
                    {concept}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Journey Steps */}
          <div className="space-y-3">
            {learningJourney.journey_steps?.map((step, index) => {
              const isCompleted = completedSteps.has(step.step_number);
              const isCurrent = index === currentJourneyStep;

              return (
                <div
                  key={index}
                  className={`glass-light rounded-xl p-4 transition-all ${
                    isCurrent ? 'border border-[#667eea]/50 bg-[#667eea]/5' : ''
                  } ${isCompleted ? 'opacity-70' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Step Number */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isCompleted 
                        ? 'bg-[#34A853] text-white' 
                        : isCurrent 
                          ? 'bg-[#667eea] text-white' 
                          : 'bg-white/10 text-white/60'
                    }`}>
                      {isCompleted ? <CheckCircle className="w-4 h-4" /> : step.step_number}
                    </div>

                    {/* Step Content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{step.title}</h4>
                        {step.estimated_time && (
                          <span className="flex items-center gap-1 text-xs text-white/50">
                            <Clock className="w-3 h-3" />
                            {step.estimated_time}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-white/70 mb-2">{step.description}</p>

                      {step.file && (
                        <div className="flex items-center gap-2 text-xs text-[#4285F4] mb-2">
                          <Code className="w-3 h-3" />
                          {step.file}
                        </div>
                      )}

                      {step.concepts?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {step.concepts.map((concept, i) => (
                            <span key={i} className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/60">
                              {concept}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        {step.file && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => loadStepFile(step)}
                            disabled={isLoadingFile}
                            className="text-xs gap-1"
                          >
                            <Play className="w-3 h-3" />
                            Load File
                          </Button>
                        )}
                        {!isCompleted && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markStepComplete(step.step_number)}
                            className="text-xs text-[#34A853]"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Mark Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10">
          <Button onClick={onClose} className="w-full btn-secondary">
            Continue Learning
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LearningJourneyPanel;

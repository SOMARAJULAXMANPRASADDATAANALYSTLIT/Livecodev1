import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

const MentorContext = createContext(null);

export const SKILL_LEVELS = [
  { value: "beginner", label: "Beginner", description: "New to programming" },
  { value: "intermediate", label: "Intermediate", description: "Familiar with basics" },
  { value: "advanced", label: "Advanced", description: "Experienced developer" },
  { value: "senior", label: "Senior Engineer", description: "Production-ready focus" },
];

export const MentorProvider = ({ children }) => {
  const [skillLevel, setSkillLevel] = useState("intermediate");
  const [sessionId, setSessionId] = useState(() => {
    const stored = localStorage.getItem("mentor_session_id");
    return stored || uuidv4();
  });
  const [sessionMemory, setSessionMemory] = useState([]);
  const [uploadedProject, setUploadedProject] = useState(null);
  const [projectAnalysis, setProjectAnalysis] = useState(null);
  const [learningJourney, setLearningJourney] = useState(null);
  const [currentJourneyStep, setCurrentJourneyStep] = useState(0);
  const [proactiveMentorEnabled, setProactiveMentorEnabled] = useState(true);

  // Persist session ID
  useEffect(() => {
    localStorage.setItem("mentor_session_id", sessionId);
  }, [sessionId]);

  // Store skill level preference
  useEffect(() => {
    const stored = localStorage.getItem("mentor_skill_level");
    if (stored) {
      setSkillLevel(stored);
    }
  }, []);

  const updateSkillLevel = useCallback((level) => {
    setSkillLevel(level);
    localStorage.setItem("mentor_skill_level", level);
  }, []);

  const addToSessionMemory = useCallback((entry) => {
    setSessionMemory((prev) => [...prev, { ...entry, timestamp: Date.now() }]);
  }, []);

  const clearSessionMemory = useCallback(() => {
    setSessionMemory([]);
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    localStorage.setItem("mentor_session_id", newSessionId);
  }, []);

  const startNewSession = useCallback(() => {
    clearSessionMemory();
    setUploadedProject(null);
    setProjectAnalysis(null);
    setLearningJourney(null);
    setCurrentJourneyStep(0);
  }, [clearSessionMemory]);

  const value = {
    // Skill level
    skillLevel,
    setSkillLevel: updateSkillLevel,
    
    // Session
    sessionId,
    sessionMemory,
    addToSessionMemory,
    clearSessionMemory,
    startNewSession,
    
    // Project learning
    uploadedProject,
    setUploadedProject,
    projectAnalysis,
    setProjectAnalysis,
    learningJourney,
    setLearningJourney,
    currentJourneyStep,
    setCurrentJourneyStep,
    
    // Proactive mentor
    proactiveMentorEnabled,
    setProactiveMentorEnabled,
  };

  return (
    <MentorContext.Provider value={value}>
      {children}
    </MentorContext.Provider>
  );
};

export const useMentor = () => {
  const context = useContext(MentorContext);
  if (!context) {
    throw new Error("useMentor must be used within a MentorProvider");
  }
  return context;
};

export default MentorContext;

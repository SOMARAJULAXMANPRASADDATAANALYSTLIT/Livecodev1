import React, { useState } from "react";
import "./App.css";
import { Toaster } from "./components/ui/sonner";
import Header from "./components/Header";
import CodeLearningView from "./components/CodeLearningView";
import EnglishChatView from "./components/EnglishChatView";
import IDEView from "./components/IDEView";
import AgentsView from "./components/AgentsView";
import LearningPathView from "./components/LearningPathView";
import AINewsFeed from "./components/AINewsFeed";
import MoltbotView from "./components/MoltbotView";
import MoltbotFullView from "./components/MoltbotFullView";
import { MentorProvider } from "./contexts/MentorContext";

function App() {
  const [mode, setMode] = useState("learning");

  return (
    <MentorProvider>
      <div className="min-h-screen bg-[#0B0B0F] grid-bg">
        <div className="noise-overlay" />
        <div className="relative z-10 flex flex-col min-h-screen">
          <Header mode={mode} onModeChange={setMode} />
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            {mode === "learning" ? (
              <LearningPathView />
            ) : mode === "agents" ? (
              <AgentsView />
            ) : mode === "news" ? (
              <div className="max-w-4xl mx-auto">
                <AINewsFeed />
              </div>
            ) : mode === "ide" ? (
              <IDEView />
            ) : mode === "code" ? (
              <CodeLearningView />
            ) : mode === "moltbot" ? (
              <div className="max-w-5xl mx-auto">
                <MoltbotView />
              </div>
            ) : mode === "moltbot-full" ? (
              <MoltbotFullView />
            ) : (
              <EnglishChatView />
            )}
          </main>
        </div>
        <Toaster position="bottom-right" richColors />
      </div>
    </MentorProvider>
  );
}

export default App;

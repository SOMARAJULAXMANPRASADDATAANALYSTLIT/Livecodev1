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
import { MentorProvider } from "./contexts/MentorContext";
import { Newspaper, X } from "lucide-react";

function App() {
  const [mode, setMode] = useState("learning");
  const [showNews, setShowNews] = useState(false);

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
            ) : mode === "ide" ? (
              <IDEView />
            ) : mode === "code" ? (
              <CodeLearningView />
            ) : (
              <EnglishChatView />
            )}
          </main>
        </div>
        
        {/* AI News Floating Button */}
        <button
          onClick={() => setShowNews(!showNews)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-50"
          data-testid="news-toggle-btn"
        >
          {showNews ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Newspaper className="w-6 h-6 text-white" />
          )}
        </button>

        {/* AI News Sidebar */}
        {showNews && (
          <div className="fixed right-6 bottom-24 w-96 max-h-[70vh] z-50 animate-in slide-in-from-right">
            <AINewsFeed />
          </div>
        )}
        
        <Toaster position="bottom-right" richColors />
      </div>
    </MentorProvider>
  );
}

export default App;

import React, { useState } from "react";
import "@/App.css";
import { Toaster } from "@/components/ui/sonner";
import Header from "@/components/Header";
import CodeLearningView from "@/components/CodeLearningView";
import EnglishChatView from "@/components/EnglishChatView";
import { MentorProvider } from "@/contexts/MentorContext";

function App() {
  const [mode, setMode] = useState("code"); // "code" or "english"

  return (
    <MentorProvider>
      <div className="min-h-screen bg-[#0B0B0F] grid-bg">
        {/* Noise overlay */}
        <div className="noise-overlay" />
        
        {/* Main content */}
        <div className="relative z-10 flex flex-col min-h-screen">
          <Header mode={mode} onModeChange={setMode} />
          
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            {mode === "code" ? (
              <CodeLearningView />
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

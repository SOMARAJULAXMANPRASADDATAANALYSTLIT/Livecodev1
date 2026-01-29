import { Code, Globe, MonitorPlay, Sparkles, Brain, Bot, Newspaper } from "lucide-react";

const Header = ({ mode, onModeChange }) => {
  return (
    <header 
      data-testid="app-header"
      className="sticky top-0 z-40 w-full glass-heavy border-b border-white/10"
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div 
            data-testid="app-logo"
            className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center"
          >
            <span className="text-xl">🎓</span>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Live Code Mentor</h1>
            <p className="text-xs text-white/50 hidden sm:block">AI-Powered Learning Platform</p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div 
          data-testid="mode-switcher"
          className="flex items-center gap-1 p-1 rounded-full glass-light overflow-x-auto max-w-[60%] md:max-w-none"
        >
          <button
            data-testid="mode-learning-btn"
            onClick={() => onModeChange("learning")}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap
              ${mode === "learning" 
                ? "mode-active text-white" 
                : "text-white/60 hover:text-white hover:bg-white/5"
              }
            `}
          >
            <Brain className="w-4 h-4" />
            <span className="hidden md:inline">Learning</span>
          </button>
          <button
            data-testid="mode-agents-btn"
            onClick={() => onModeChange("agents")}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap
              ${mode === "agents" 
                ? "mode-active text-white" 
                : "text-white/60 hover:text-white hover:bg-white/5"
              }
            `}
          >
            <Bot className="w-4 h-4" />
            <span className="hidden md:inline">Agents</span>
          </button>
          <button
            data-testid="mode-moltbot-btn"
            onClick={() => onModeChange("moltbot")}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap
              ${mode === "moltbot" 
                ? "mode-active text-white bg-gradient-to-r from-[#E74C3C]/20 to-[#C0392B]/20" 
                : "text-white/60 hover:text-white hover:bg-white/5"
              }
            `}
          >
            <span className="text-base">🦞</span>
            <span className="hidden md:inline">Moltbot</span>
          </button>
          <button
            data-testid="mode-moltbot-full-btn"
            onClick={() => onModeChange("moltbot-full")}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap
              ${mode === "moltbot-full" 
                ? "mode-active text-white bg-gradient-to-r from-[#EA4335]/20 to-[#FBBC04]/20" 
                : "text-white/60 hover:text-white hover:bg-white/5"
              }
            `}
          >
            <span className="text-base">🦞✨</span>
            <span className="hidden md:inline">Moltbot Full</span>
          </button>
          <button
            data-testid="mode-news-btn"
            onClick={() => onModeChange("news")}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap
              ${mode === "news" 
                ? "mode-active text-white" 
                : "text-white/60 hover:text-white hover:bg-white/5"
              }
            `}
          >
            <Newspaper className="w-4 h-4" />
            <span className="hidden md:inline">News</span>
          </button>
          <button
            data-testid="mode-ide-btn"
            onClick={() => onModeChange("ide")}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap
              ${mode === "ide" 
                ? "mode-active text-white" 
                : "text-white/60 hover:text-white hover:bg-white/5"
              }
            `}
          >
            <MonitorPlay className="w-4 h-4" />
            <span className="hidden lg:inline">IDE</span>
          </button>
          <button
            data-testid="mode-code-btn"
            onClick={() => onModeChange("code")}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap
              ${mode === "code" 
                ? "mode-active text-white" 
                : "text-white/60 hover:text-white hover:bg-white/5"
              }
            `}
          >
            <Code className="w-4 h-4" />
            <span className="hidden lg:inline">Code</span>
          </button>
          <button
            data-testid="mode-english-btn"
            onClick={() => onModeChange("english")}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap
              ${mode === "english" 
                ? "mode-active text-white" 
                : "text-white/60 hover:text-white hover:bg-white/5"
              }
            `}
          >
            <Globe className="w-4 h-4" />
            <span className="hidden lg:inline">English</span>
          </button>
        </div>
        
        {/* Status Badge */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-white/50">
          <Sparkles className="w-3 h-3 text-[#667eea]" />
          <span>Powered by Gemini AI</span>
        </div>
      </div>
    </header>
  );
};

export default Header;

import { Code, Globe } from "lucide-react";

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
            <p className="text-xs text-white/50 hidden sm:block">AI-Powered Learning</p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div 
          data-testid="mode-switcher"
          className="flex items-center gap-1 p-1 rounded-full glass-light"
        >
          <button
            data-testid="mode-code-btn"
            onClick={() => onModeChange("code")}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
              ${mode === "code" 
                ? "mode-active text-white" 
                : "text-white/60 hover:text-white hover:bg-white/5"
              }
            `}
          >
            <Code className="w-4 h-4" />
            <span className="hidden sm:inline">Code Learning</span>
          </button>
          <button
            data-testid="mode-english-btn"
            onClick={() => onModeChange("english")}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
              ${mode === "english" 
                ? "mode-active text-white" 
                : "text-white/60 hover:text-white hover:bg-white/5"
              }
            `}
          >
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">English Learning</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

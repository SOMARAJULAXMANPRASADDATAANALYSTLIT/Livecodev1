import React, { useState, useRef, useEffect } from "react";
import { Terminal, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

const IDETerminal = ({ output, onCommand, isRunning, onClear }) => {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef(null);
  const inputRef = useRef(null);
  
  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isRunning) return;
    
    onCommand(input);
    setHistory(prev => [...prev, input]);
    setHistoryIndex(-1);
    setInput("");
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex] || "");
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex] || "");
      } else {
        setHistoryIndex(-1);
        setInput("");
      }
    }
  };
  
  const getLineClass = (type) => {
    switch (type) {
      case 'command': return 'text-[#4285F4]';
      case 'output': return 'text-white/80';
      case 'error': return 'text-[#EA4335]';
      case 'success': return 'text-[#34A853]';
      case 'info': return 'text-[#667eea]';
      case 'suggestion': return 'text-[#FBBC04]';
      default: return 'text-white/60';
    }
  };
  
  return (
    <div className="h-full flex flex-col bg-[#1E1E1E] font-mono text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#252526] border-b border-white/10">
        <div className="flex items-center gap-2 text-white/70">
          <Terminal className="w-4 h-4" />
          <span className="text-xs font-medium">Terminal</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-6 px-2 text-white/50 hover:text-white"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
      
      {/* Output */}
      <div 
        ref={outputRef}
        className="flex-1 overflow-auto p-3 space-y-1"
        onClick={() => inputRef.current?.focus()}
      >
        {output.length === 0 ? (
          <div className="text-white/40">
            <p>Welcome to Live Code Mentor Terminal</p>
            <p className="text-xs mt-1">Type a command or use the toolbar buttons</p>
          </div>
        ) : (
          output.map((line, i) => (
            <pre key={i} className={`whitespace-pre-wrap break-all ${getLineClass(line.type)}`}>
              {line.text}
            </pre>
          ))
        )}
        
        {isRunning && (
          <div className="flex items-center gap-2 text-[#FBBC04]">
            <span className="animate-pulse">●</span>
            <span>Running...</span>
          </div>
        )}
      </div>
      
      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2 border-t border-white/10">
        <span className="text-[#34A853]">$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
          placeholder="Enter command..."
          className="flex-1 bg-transparent outline-none text-white placeholder-white/30"
        />
      </form>
    </div>
  );
};

export default IDETerminal;

import React, { useState, useEffect, lazy, Suspense } from "react";
import { 
  FolderOpen, Upload, Loader2, FileCode, Play, Terminal, X, Bug, Cpu, 
  ChevronRight, ChevronDown, Folder, BookOpen, Zap, Code, Package,
  GitBranch, Layers, Target, CheckCircle, Clock, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Lazy load heavy components
const Editor = lazy(() => import("@monaco-editor/react"));

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// File Tree Component - Non-recursive to avoid Babel issues
const FileTreeNode = React.memo(function FileTreeNode({ node, onSelect, selected, level = 0 }) {
  const [expanded, setExpanded] = useState(level < 2);
  
  if (!node) return null;
  
  const isFolder = node.type === 'directory' || node.children?.length > 0;
  const isSelected = selected === node.path;
  
  return (
    <>
      <div
        className={`flex items-center py-1 px-2 cursor-pointer hover:bg-white/10 rounded ${isSelected ? 'bg-[#667eea]/20' : ''}`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (isFolder) {
            setExpanded(!expanded);
          } else {
            onSelect(node.path);
          }
        }}
      >
        {isFolder ? (
          expanded ? <ChevronDown className="w-3 h-3 mr-1 text-white/50" /> : <ChevronRight className="w-3 h-3 mr-1 text-white/50" />
        ) : <span className="w-3 mr-1" />}
        {isFolder ? (
          <Folder className="w-4 h-4 mr-2 text-yellow-500" />
        ) : (
          <FileCode className="w-4 h-4 mr-2 text-blue-400" />
        )}
        <span className="text-sm truncate">{node.name}</span>
      </div>
      {isFolder && expanded && node.children && 
        node.children.map((child, i) => (
          <FileTreeNode key={child.path || i} node={child} onSelect={onSelect} selected={selected} level={level + 1} />
        ))
      }
    </>
  );
});

// Wrapper to start the tree
function FileTree({ node, onSelect, selected }) {
  if (!node) return null;
  return <FileTreeNode node={node} onSelect={onSelect} selected={selected} level={0} />;
}

// Run Commands Panel
function RunCommandsPanel({ commands, onRunCommand }) {
  if (!commands) return null;
  
  return (
    <div className="p-3 border-t border-white/10 bg-[#0d1117]">
      <div className="flex items-center gap-2 mb-2">
        <Terminal className="w-4 h-4 text-[#34A853]" />
        <span className="font-medium text-sm">How to Run</span>
      </div>
      <div className="space-y-2 text-xs font-mono">
        {commands.install && (
          <div className="flex items-center gap-2">
            <span className="text-white/40">1.</span>
            <code className="bg-black/30 px-2 py-1 rounded flex-1">{commands.install}</code>
            <button onClick={() => onRunCommand(commands.install)} className="text-[#4285F4] hover:underline">Copy</button>
          </div>
        )}
        {commands.dev && (
          <div className="flex items-center gap-2">
            <span className="text-white/40">2.</span>
            <code className="bg-black/30 px-2 py-1 rounded flex-1">{commands.dev}</code>
            <button onClick={() => onRunCommand(commands.dev)} className="text-[#34A853] hover:underline">Run</button>
          </div>
        )}
        {commands.port && (
          <div className="flex items-center gap-2 text-white/50">
            <span className="text-white/40">→</span>
            <span>Opens at <span className="text-[#4285F4]">http://localhost:{commands.port}</span></span>
          </div>
        )}
        {commands.entry_file && (
          <div className="flex items-center gap-2 text-white/50">
            <span className="text-white/40">→</span>
            <span>Entry: <span className="text-[#FBBC04]">{commands.entry_file}</span></span>
          </div>
        )}
      </div>
    </div>
  );
}

// Enhanced Analysis Panel with Learning Path
function AnalysisPanel({ data, onLoadFile, onClose, onStartLearning }) {
  const [activeTab, setActiveTab] = useState('overview');
  
  if (!data) return null;
  
  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Header */}
      <div className="flex justify-between items-center p-3 border-b border-white/10">
        <span className="font-medium flex items-center gap-2"><Cpu className="w-4 h-4 text-[#667eea]" />Analysis</span>
        <button onClick={onClose}><X className="w-4 h-4" /></button>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {['overview', 'run', 'learn', 'files'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-xs ${activeTab === tab ? 'border-b-2 border-[#667eea] text-white' : 'text-white/50'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-3 space-y-3 text-sm">
        {activeTab === 'overview' && (
          <>
            {/* Project Info */}
            <div className="p-3 bg-gradient-to-r from-[#667eea]/10 to-[#4285F4]/10 rounded-lg border border-[#667eea]/30">
              <h3 className="font-bold text-lg">{data.project_name}</h3>
              <p className="text-white/70 text-sm mt-1">{data.purpose}</p>
              {data.project_type && (
                <span className="inline-block mt-2 px-2 py-0.5 bg-[#4285F4]/20 text-[#4285F4] text-xs rounded">
                  {data.project_type}
                </span>
              )}
            </div>
            
            {/* Architecture */}
            {data.architecture_overview && (
              <div className="p-2 bg-white/5 rounded">
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="w-4 h-4 text-[#FBBC04]" />
                  <strong>Architecture</strong>
                </div>
                <p className="text-white/60 text-xs">{data.architecture_overview}</p>
              </div>
            )}
            
            {/* Entry Points */}
            {data.entry_points?.length > 0 && (
              <div className="p-2 bg-white/5 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-[#34A853]" />
                  <strong>Entry Points</strong>
                </div>
                {data.entry_points.map((ep, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <button onClick={() => onLoadFile(ep.file || ep)} className="text-[#4285F4] hover:underline">
                      {ep.file || ep}
                    </button>
                    {ep.purpose && <span className="text-white/40">- {ep.purpose}</span>}
                  </div>
                ))}
              </div>
            )}
            
            {/* Issues */}
            {data.potential_issues?.length > 0 && (
              <div className="p-2 bg-[#EA4335]/10 rounded border border-[#EA4335]/30">
                <div className="flex items-center gap-2 mb-1">
                  <Bug className="w-4 h-4 text-[#EA4335]" />
                  <strong className="text-[#EA4335]">Issues ({data.potential_issues.length})</strong>
                </div>
                {data.potential_issues.map((issue, i) => (
                  <p key={i} className="text-xs text-white/70">• {issue}</p>
                ))}
              </div>
            )}
          </>
        )}
        
        {activeTab === 'run' && (
          <>
            {/* Run Commands */}
            <div className="p-3 bg-[#34A853]/10 rounded border border-[#34A853]/30">
              <div className="flex items-center gap-2 mb-3">
                <Play className="w-4 h-4 text-[#34A853]" />
                <strong className="text-[#34A853]">Run This Project</strong>
              </div>
              
              {data.run_commands ? (
                <div className="space-y-3 font-mono text-xs">
                  {data.run_commands.install && (
                    <div>
                      <span className="text-white/50 block mb-1">1. Install dependencies:</span>
                      <code className="bg-black/30 px-3 py-2 rounded block">{data.run_commands.install}</code>
                    </div>
                  )}
                  {data.run_commands.dev && (
                    <div>
                      <span className="text-white/50 block mb-1">2. Start development server:</span>
                      <code className="bg-black/30 px-3 py-2 rounded block text-[#34A853]">{data.run_commands.dev}</code>
                    </div>
                  )}
                  {data.run_commands.port && (
                    <div className="text-white/50">
                      → App runs at <span className="text-[#4285F4]">http://localhost:{data.run_commands.port}</span>
                    </div>
                  )}
                  {data.run_commands.entry_file && (
                    <div className="text-white/50">
                      → Entry file: <button onClick={() => onLoadFile(data.run_commands.entry_file)} className="text-[#FBBC04] hover:underline">{data.run_commands.entry_file}</button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-white/50 text-xs">No run commands detected. Check README.md</p>
              )}
            </div>
            
            {/* Build & Test */}
            {(data.run_commands?.build || data.run_commands?.test) && (
              <div className="p-2 bg-white/5 rounded">
                <strong className="text-xs text-white/50">Other Commands</strong>
                {data.run_commands.build && (
                  <div className="mt-2">
                    <span className="text-xs text-white/40">Build:</span>
                    <code className="text-xs bg-black/30 px-2 py-1 rounded block mt-1">{data.run_commands.build}</code>
                  </div>
                )}
                {data.run_commands.test && (
                  <div className="mt-2">
                    <span className="text-xs text-white/40">Test:</span>
                    <code className="text-xs bg-black/30 px-2 py-1 rounded block mt-1">{data.run_commands.test}</code>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        
        {activeTab === 'learn' && (
          <>
            {/* What You'll Learn */}
            {data.what_you_will_learn?.length > 0 && (
              <div className="p-3 bg-[#667eea]/10 rounded border border-[#667eea]/30">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-[#667eea]" />
                  <strong className="text-[#667eea]">What You'll Learn</strong>
                </div>
                <ul className="space-y-1">
                  {data.what_you_will_learn.map((item, i) => (
                    <li key={i} className="text-xs text-white/70 flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-[#34A853]" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Difficulty & Roles */}
            <div className="flex gap-2">
              {data.difficulty_level && (
                <span className={`px-2 py-1 text-xs rounded ${
                  data.difficulty_level === 'Beginner' ? 'bg-[#34A853]/20 text-[#34A853]' :
                  data.difficulty_level === 'Advanced' ? 'bg-[#EA4335]/20 text-[#EA4335]' :
                  'bg-[#FBBC04]/20 text-[#FBBC04]'
                }`}>
                  {data.difficulty_level}
                </span>
              )}
              {data.relevant_roles?.map((role, i) => (
                <span key={i} className="px-2 py-1 text-xs bg-white/10 rounded">{role}</span>
              ))}
            </div>
            
            {/* Weekly Learning Plan */}
            {data.weekly_learning_plan?.length > 0 && (
              <div className="p-2 bg-white/5 rounded">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-[#4285F4]" />
                  <strong>Weekly Learning Plan</strong>
                </div>
                <div className="space-y-3">
                  {data.weekly_learning_plan.map((week, i) => (
                    <div key={i} className="p-2 bg-black/20 rounded">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-6 h-6 rounded-full bg-[#667eea] flex items-center justify-center text-xs font-bold">{week.week}</span>
                        <span className="font-medium text-sm">{week.topic}</span>
                      </div>
                      <div className="ml-8 space-y-1 text-xs text-white/60">
                        {week.goals?.map((goal, j) => (
                          <p key={j}>• {goal}</p>
                        ))}
                        {week.files_to_study?.length > 0 && (
                          <div className="mt-1">
                            <span className="text-white/40">Files: </span>
                            {week.files_to_study.map((f, j) => (
                              <button key={j} onClick={() => onLoadFile(f)} className="text-[#4285F4] hover:underline mr-2">{f}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Start Learning Button */}
            <Button onClick={onStartLearning} className="w-full btn-primary gap-2">
              <Zap className="w-4 h-4" /> Start Learning Journey
            </Button>
          </>
        )}
        
        {activeTab === 'files' && (
          <>
            {/* Recommended Files */}
            {data.file_recommendations?.length > 0 && (
              <div className="p-2 bg-white/5 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <FileCode className="w-4 h-4 text-[#4285F4]" />
                  <strong>Recommended Reading Order</strong>
                </div>
                <div className="space-y-2">
                  {data.file_recommendations.map((rec, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-black/20 rounded">
                      <span className="w-5 h-5 rounded-full bg-[#4285F4]/20 text-[#4285F4] flex items-center justify-center text-xs">{rec.order || i + 1}</span>
                      <div className="flex-1">
                        <button onClick={() => onLoadFile(rec.file)} className="text-[#4285F4] hover:underline text-sm">{rec.file}</button>
                        {rec.reason && <p className="text-xs text-white/40">{rec.reason}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Suggestions */}
            {data.improvement_suggestions?.length > 0 && (
              <div className="p-2 bg-[#34A853]/10 rounded border border-[#34A853]/30">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-[#34A853]" />
                  <strong className="text-[#34A853]">Improvements</strong>
                </div>
                {data.improvement_suggestions.map((s, i) => (
                  <p key={i} className="text-xs text-white/70">✓ {s}</p>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function IDEWorkspace({ project, onNewProject }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [language, setLanguage] = useState("plaintext");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [showPanel, setShowPanel] = useState(true);
  const [output, setOutput] = useState("");
  const [showOutput, setShowOutput] = useState(false);
  const [running, setRunning] = useState(false);
  const [showLearningModal, setShowLearningModal] = useState(false);

  useEffect(() => {
    if (project?.project_id) {
      setAnalyzing(true);
      fetch(`${BACKEND_URL}/api/project/${project.project_id}/analyze-full`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.project_id, skill_level: "intermediate" }),
      })
        .then(r => r.json())
        .then(data => {
          setAnalysis(data);
          toast.success("Project analyzed!");
        })
        .catch(() => toast.error("Analysis failed"))
        .finally(() => setAnalyzing(false));
    }
  }, [project?.project_id]);

  const openFile = async (path) => {
    if (!path) return;
    setLoading(true);
    setSelectedFile(path);
    try {
      const r = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/file?path=${encodeURIComponent(path)}`);
      const data = await r.json();
      setFileContent(data.content || "");
      setLanguage(data.language?.toLowerCase() || "plaintext");
    } catch (e) {
      toast.error("Failed to load file");
    }
    setLoading(false);
  };

  const runFile = async () => {
    if (!selectedFile) return;
    setShowOutput(true);
    setRunning(true);
    setOutput("Running...");
    try {
      const r = await fetch(`${BACKEND_URL}/api/project/${project.project_id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.project_id, file_path: selectedFile, skill_level: "intermediate" }),
      });
      const data = await r.json();
      let out = data.output || "";
      if (data.error) {
        out += `\n\n❌ Error:\n${data.error}`;
        if (data.error_explanation) out += `\n\n💡 ${data.error_explanation}`;
        if (data.fix_suggestion) out += `\n\n🔧 ${data.fix_suggestion}`;
      } else {
        out += `\n\n✅ Success (${(data.execution_time || 0).toFixed(3)}s)`;
      }
      setOutput(out);
      toast.success(data.error ? "Execution had errors" : "Code executed!");
    } catch (e) {
      setOutput("Execution failed");
      toast.error("Failed to run");
    }
    setRunning(false);
  };

  const handleRunCommand = (cmd) => {
    navigator.clipboard.writeText(cmd);
    toast.success(`Copied: ${cmd}`);
  };

  const handleStartLearning = () => {
    setShowLearningModal(true);
  };

  const canRun = selectedFile?.endsWith(".py") || selectedFile?.endsWith(".js");
  const langMap = { python: 'python', javascript: 'javascript', typescript: 'typescript', java: 'java', 'c++': 'cpp', go: 'go', rust: 'rust', html: 'html', css: 'css', json: 'json', yaml: 'yaml', markdown: 'markdown', scss: 'scss' };
  const monacoLang = langMap[language] || 'plaintext';

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-white/10 bg-[#161b22]">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-yellow-500" />
          <span className="font-medium">{project?.name}</span>
          <span className="text-xs text-white/40">({project?.total_files} files)</span>
          {selectedFile && <span className="text-white/50 text-sm flex items-center gap-1"><ChevronRight className="w-3 h-3" />{selectedFile}</span>}
        </div>
        <div className="flex gap-2">
          {canRun && <Button size="sm" variant="ghost" onClick={runFile} disabled={running}><Play className="w-4 h-4 mr-1" />{running ? "..." : "Run"}</Button>}
          <Button size="sm" variant="ghost" onClick={() => setShowPanel(!showPanel)}><Cpu className="w-4 h-4" /></Button>
          <Button size="sm" variant="outline" onClick={onNewProject}><Upload className="w-4 h-4 mr-1" />New</Button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - File Tree */}
        <div className="w-60 border-r border-white/10 flex flex-col bg-[#0d1117]">
          {/* Language Stats */}
          {project?.languages && (
            <div className="p-2 border-b border-white/10">
              <div className="h-2 rounded flex overflow-hidden">
                {project.languages.map((l, i) => <div key={i} style={{ width: `${l.percentage}%`, backgroundColor: l.color }} title={`${l.name} ${l.percentage}%`} />)}
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {project.languages.slice(0, 3).map((l, i) => <span key={i} className="text-xs text-white/50">{l.name} {l.percentage}%</span>)}
              </div>
            </div>
          )}
          
          {/* File Tree */}
          <div className="flex-1 overflow-auto p-2">
            <FileTree node={project?.root} onSelect={openFile} selected={selectedFile} />
          </div>
          
          {/* Run Commands */}
          {analysis?.run_commands && <RunCommandsPanel commands={analysis.run_commands} onRunCommand={handleRunCommand} />}
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1">
            {loading ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#667eea]" /></div>
            ) : selectedFile ? (
              <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
                <Editor
                  height="100%"
                  language={monacoLang}
                  value={fileContent}
                  theme="vs-dark"
                  options={{ fontSize: 14, minimap: { enabled: true }, automaticLayout: true, readOnly: true }}
                />
              </Suspense>
            ) : (
              <div className="h-full flex items-center justify-center text-white/40 flex-col">
                <FileCode className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg">Select a file to view</p>
                <p className="text-sm mt-2 text-white/30">Click any file in the explorer →</p>
              </div>
            )}
          </div>
          
          {/* Terminal Output */}
          {showOutput && (
            <div className="h-40 border-t border-white/10 bg-black">
              <div className="flex justify-between px-3 py-1 bg-[#161b22]">
                <span className="text-xs flex items-center gap-1"><Terminal className="w-3 h-3" />Output</span>
                <button onClick={() => setShowOutput(false)}><X className="w-3 h-3" /></button>
              </div>
              <pre className="p-3 text-xs overflow-auto h-32 whitespace-pre-wrap">{output}</pre>
            </div>
          )}
        </div>

        {/* Analysis Panel */}
        {showPanel && (
          <div className="w-80 border-l border-white/10">
            {analyzing && !analysis ? (
              <div className="h-full flex items-center justify-center flex-col">
                <Loader2 className="w-8 h-8 animate-spin text-[#667eea]" />
                <p className="text-white/50 text-sm mt-2">Analyzing project...</p>
              </div>
            ) : (
              <AnalysisPanel 
                data={analysis} 
                onLoadFile={openFile} 
                onClose={() => setShowPanel(false)} 
                onStartLearning={handleStartLearning}
              />
            )}
          </div>
        )}
      </div>

      {/* Learning Journey Modal */}
      {showLearningModal && analysis && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1a1a2e] rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden border border-white/10">
            <div className="flex justify-between items-center p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <BookOpen className="w-6 h-6 text-[#667eea]" />
                <div>
                  <h2 className="font-bold">Learning Journey</h2>
                  <p className="text-xs text-white/50">{analysis.project_name}</p>
                </div>
              </div>
              <button onClick={() => setShowLearningModal(false)}><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-4 overflow-auto max-h-[60vh]">
              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Progress</span>
                  <span className="text-white/50">0/{analysis.weekly_learning_plan?.length || 0} weeks</span>
                </div>
                <div className="h-2 bg-white/10 rounded overflow-hidden">
                  <div className="h-full bg-[#667eea] w-0" />
                </div>
              </div>
              
              {/* Weekly Plan */}
              <div className="space-y-3">
                {analysis.weekly_learning_plan?.map((week, i) => (
                  <div key={i} className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-8 h-8 rounded-full bg-[#667eea]/20 text-[#667eea] flex items-center justify-center font-bold">
                        {week.week}
                      </span>
                      <div>
                        <h3 className="font-medium">{week.topic}</h3>
                        <p className="text-xs text-white/50">{week.goals?.length} goals • {week.files_to_study?.length} files</p>
                      </div>
                    </div>
                    
                    <div className="ml-11 space-y-2 text-sm">
                      <div>
                        <span className="text-white/40 text-xs">Goals:</span>
                        {week.goals?.map((g, j) => <p key={j} className="text-white/70">• {g}</p>)}
                      </div>
                      
                      {week.exercises?.length > 0 && (
                        <div>
                          <span className="text-white/40 text-xs">Exercises:</span>
                          {week.exercises.map((e, j) => <p key={j} className="text-[#34A853]">→ {e}</p>)}
                        </div>
                      )}
                      
                      {week.homework && (
                        <div className="p-2 bg-[#FBBC04]/10 rounded border border-[#FBBC04]/30">
                          <span className="text-[#FBBC04] text-xs">📝 Homework:</span>
                          <p className="text-white/80">{week.homework}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              <Button onClick={() => setShowLearningModal(false)} className="w-full mt-4 btn-primary">
                Continue Learning
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

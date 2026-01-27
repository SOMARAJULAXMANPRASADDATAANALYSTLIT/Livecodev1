import React, { useState } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react";

const FILE_ICONS = {
  'JavaScript': '🟨',
  'TypeScript': '🔷',
  'Python': '🐍',
  'Java': '☕',
  'HTML': '🌐',
  'CSS': '🎨',
  'SCSS': '🎨',
  'JSON': '📋',
  'Markdown': '📝',
  'YAML': '⚙️',
  'Shell': '💻',
  'Go': '🐹',
  'Rust': '🦀',
  'Ruby': '💎',
  'PHP': '🐘',
  'C++': '⚡',
  'C': '⚡',
  'C#': '💜',
  'Swift': '🍎',
  'Kotlin': '🟣',
  'Vue': '💚',
  'Svelte': '🧡',
  'Dockerfile': '🐳',
};

const FileTreeNode = ({ node, depth = 0, onFileSelect, selectedPath, expandedPaths, toggleExpanded }) => {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const isDirectory = node.type === 'directory';
  
  const icon = isDirectory 
    ? (isExpanded ? <FolderOpen className="w-4 h-4 text-[#FBBC04]" /> : <Folder className="w-4 h-4 text-[#FBBC04]" />)
    : <span className="text-sm">{FILE_ICONS[node.language] || '📄'}</span>;
  
  const handleClick = () => {
    if (isDirectory) {
      toggleExpanded(node.path);
    } else {
      onFileSelect(node.path);
    }
  };
  
  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-white/10 transition-colors ${
          isSelected ? 'bg-[#667eea]/20 text-white' : 'text-white/70'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {isDirectory && (
          <span className="w-4 h-4 flex items-center justify-center">
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </span>
        )}
        {!isDirectory && <span className="w-4" />}
        {icon}
        <span className="text-sm truncate ml-1">{node.name}</span>
        {!isDirectory && node.size && (
          <span className="text-xs text-white/30 ml-auto">
            {node.size > 1024 ? `${(node.size / 1024).toFixed(1)}KB` : `${node.size}B`}
          </span>
        )}
      </div>
      
      {isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child, index) => (
            <FileTreeNode
              key={child.path || index}
              node={child}
              depth={depth + 1}
              onFileSelect={onFileSelect}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              toggleExpanded={toggleExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FileExplorer = ({ node, onFileSelect, selectedPath }) => {
  const [expandedPaths, setExpandedPaths] = useState(new Set(['/']));
  
  const toggleExpanded = (path) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };
  
  if (!node) return null;
  
  return (
    <div className="py-2">
      {node.children?.map((child, index) => (
        <FileTreeNode
          key={child.path || index}
          node={child}
          depth={0}
          onFileSelect={onFileSelect}
          selectedPath={selectedPath}
          expandedPaths={expandedPaths}
          toggleExpanded={toggleExpanded}
        />
      ))}
    </div>
  );
};

export default FileExplorer;

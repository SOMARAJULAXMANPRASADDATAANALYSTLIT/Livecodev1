import React from "react";

const LanguageStats = ({ languages }) => {
  if (!languages || languages.length === 0) return null;
  
  return (
    <div className="p-3 border-b border-white/10">
      {/* Progress bar */}
      <div className="h-2 rounded-full overflow-hidden flex mb-2">
        {languages.map((lang, i) => (
          <div
            key={lang.name}
            className="h-full"
            style={{ 
              width: `${lang.percentage}%`,
              backgroundColor: lang.color,
              marginLeft: i > 0 ? '1px' : '0'
            }}
            title={`${lang.name}: ${lang.percentage}%`}
          />
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {languages.slice(0, 5).map((lang) => (
          <div key={lang.name} className="flex items-center gap-1 text-xs">
            <span 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: lang.color }}
            />
            <span className="text-white/70">{lang.name}</span>
            <span className="text-white/40">{lang.percentage}%</span>
          </div>
        ))}
      </div>
      
      {languages.length > 5 && (
        <p className="text-xs text-white/40 mt-1">
          +{languages.length - 5} more languages
        </p>
      )}
    </div>
  );
};

export default LanguageStats;

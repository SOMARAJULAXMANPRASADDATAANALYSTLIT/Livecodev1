import React, { useState, useEffect } from "react";
import { 
  Newspaper, RefreshCw, Loader2, ExternalLink, Clock, 
  Sparkles, TrendingUp, Code, Brain, Cpu, Globe,
  ChevronRight, Search, Filter
} from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const NEWS_CATEGORIES = [
  { id: "all", name: "All News", icon: Newspaper, color: "#667eea" },
  { id: "ai", name: "AI & ML", icon: Brain, color: "#EA4335" },
  { id: "tech", name: "Technology", icon: Cpu, color: "#34A853" },
  { id: "coding", name: "Programming", icon: Code, color: "#FBBC04" },
  { id: "startups", name: "Startups", icon: TrendingUp, color: "#9333ea" },
];

const AINewsFeed = () => {
  const [news, setNews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchNews();
  }, [category]);

  const fetchNews = async () => {
    setIsLoading(true);
    try {
      // Use live search endpoint for real-time news
      const response = await fetch(`${BACKEND_URL}/api/news/search-live?category=${category}`);
      if (!response.ok) throw new Error("Failed to fetch news");
      const data = await response.json();
      setNews(data.articles || []);
      toast.success("Latest news loaded!");
    } catch (error) {
      console.error("News fetch error:", error);
      toast.error("Failed to fetch live news");
      // Fallback to mock news if API fails
      setNews(getMockNews());
    } finally {
      setIsLoading(false);
    }
  };

  const getMockNews = () => [
    {
      id: "1",
      title: "OpenAI Announces GPT-5 with Multimodal Capabilities",
      summary: "The latest model features enhanced reasoning, longer context windows, and real-time audio/video processing capabilities.",
      source: "TechCrunch",
      url: "#",
      category: "ai",
      publishedAt: new Date().toISOString(),
      image: null
    },
    {
      id: "2",
      title: "Google DeepMind's Gemini 3 Sets New Benchmarks",
      summary: "The new Gemini model achieves state-of-the-art performance across multiple domains including code generation and scientific reasoning.",
      source: "The Verge",
      url: "#",
      category: "ai",
      publishedAt: new Date(Date.now() - 3600000).toISOString(),
      image: null
    },
    {
      id: "3",
      title: "React 20 Released with Server Components by Default",
      summary: "The React team announces major changes to component architecture, making server components the default pattern.",
      source: "Dev.to",
      url: "#",
      category: "coding",
      publishedAt: new Date(Date.now() - 7200000).toISOString(),
      image: null
    },
    {
      id: "4",
      title: "Anthropic Launches Claude 4 with Enhanced Safety Features",
      summary: "New constitutional AI improvements make Claude 4 the most aligned model yet, with reduced hallucinations.",
      source: "Wired",
      url: "#",
      category: "ai",
      publishedAt: new Date(Date.now() - 10800000).toISOString(),
      image: null
    },
    {
      id: "5",
      title: "Microsoft Copilot Gets Autonomous Agent Capabilities",
      summary: "The updated Copilot can now perform multi-step tasks autonomously, including code refactoring and deployment.",
      source: "ZDNet",
      url: "#",
      category: "tech",
      publishedAt: new Date(Date.now() - 14400000).toISOString(),
      image: null
    },
    {
      id: "6",
      title: "Nvidia H200 GPUs See Massive Demand for AI Training",
      summary: "The new GPU architecture enables 2x faster training times for large language models.",
      source: "Ars Technica",
      url: "#",
      category: "tech",
      publishedAt: new Date(Date.now() - 18000000).toISOString(),
      image: null
    },
  ];

  const filteredNews = news.filter(article => {
    if (searchQuery) {
      return article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
             article.summary?.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getCategoryColor = (cat) => {
    const found = NEWS_CATEGORIES.find(c => c.id === cat);
    return found?.color || "#667eea";
  };

  return (
    <div className="glass-heavy rounded-2xl p-6 h-full" data-testid="ai-news-feed">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#667eea]/20 flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-[#667eea]" />
          </div>
          <div>
            <h2 className="text-lg font-bold">AI & Tech News</h2>
            <p className="text-xs text-white/50">Stay updated with the latest</p>
          </div>
        </div>
        <Button 
          onClick={fetchNews} 
          variant="outline" 
          size="sm"
          disabled={isLoading}
          className="border-white/20"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search news..."
          className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#667eea]"
        />
      </div>

      {/* Categories */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {NEWS_CATEGORIES.map(cat => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
                category === cat.id 
                  ? 'bg-white/10 border border-white/20' 
                  : 'hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" style={{ color: cat.color }} />
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* News List */}
      <div className="space-y-4 max-h-[500px] overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-white/50" />
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="text-center py-12 text-white/50">
            <Newspaper className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No news found</p>
          </div>
        ) : (
          filteredNews.map((article, i) => (
            <NewsCard 
              key={article.id || i} 
              article={article} 
              formatTime={formatTime}
              getCategoryColor={getCategoryColor}
            />
          ))
        )}
      </div>
    </div>
  );
};

const NewsCard = ({ article, formatTime, getCategoryColor }) => {
  return (
    <a 
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-4 glass-light rounded-xl hover:bg-white/10 transition-colors group"
    >
      <div className="flex gap-4">
        {article.image && (
          <img 
            src={article.image} 
            alt={article.title}
            className="w-20 h-20 object-cover rounded-lg shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span 
              className="px-2 py-0.5 rounded-full text-xs"
              style={{ 
                backgroundColor: `${getCategoryColor(article.category)}20`,
                color: getCategoryColor(article.category)
              }}
            >
              {article.category?.toUpperCase() || 'NEWS'}
            </span>
            <span className="text-xs text-white/40 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(article.publishedAt)}
            </span>
          </div>
          <h3 className="font-semibold text-sm mb-1 line-clamp-2 group-hover:text-[#667eea] transition-colors">
            {article.title}
          </h3>
          {article.summary && (
            <p className="text-xs text-white/60 line-clamp-2">{article.summary}</p>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-white/40">{article.source}</span>
            <ExternalLink className="w-3 h-3 text-white/40 group-hover:text-[#667eea] transition-colors" />
          </div>
        </div>
      </div>
    </a>
  );
};

export default AINewsFeed;

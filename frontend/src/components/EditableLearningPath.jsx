import React, { useState, useEffect, useRef } from "react";
import {
  Plus, Trash2, Edit2, Play, Check, X, ChevronRight, ChevronDown,
  Youtube, Link2, ExternalLink, MessageSquare, Loader2, FolderPlus,
  GraduationCap, BookOpen, Save, Eye, AlertCircle
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
import VideoLearningModal from "./VideoLearningModal";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const EditableLearningPath = ({ skillTree, userProfile, onUpdateTree }) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set(["root"]));
  const [editingNode, setEditingNode] = useState(null);
  const [addingToNode, setAddingToNode] = useState(null);
  const [newTopicName, setNewTopicName] = useState("");
  const [newYoutubeUrl, setNewYoutubeUrl] = useState("");
  const [videoPreview, setVideoPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [addUrlToNode, setAddUrlToNode] = useState(null);
  const [urlInput, setUrlInput] = useState("");

  const toggleNode = (nodeId) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) newSet.delete(nodeId);
      else newSet.add(nodeId);
      return newSet;
    });
  };

  // Extract YouTube video ID from URL
  const extractVideoId = (url) => {
    if (!url) return null;
    const match = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
    );
    return match ? match[1] : null;
  };

  // Fetch YouTube preview when URL is entered
  const fetchYoutubePreview = async (url) => {
    const videoId = extractVideoId(url);
    if (!videoId) {
      setVideoPreview(null);
      return;
    }

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/learning/youtube/preview/${videoId}`
      );
      const data = await response.json();
      if (data.success) {
        setVideoPreview(data);
      }
    } catch (error) {
      console.error("Failed to fetch preview:", error);
    }
  };

  // Debounce URL input for preview
  useEffect(() => {
    const timer = setTimeout(() => {
      if (newYoutubeUrl || urlInput) {
        fetchYoutubePreview(newYoutubeUrl || urlInput);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [newYoutubeUrl, urlInput]);

  // Add new topic
  const handleAddTopic = async (parentId = null) => {
    if (!newTopicName.trim()) {
      toast.error("Please enter a topic name");
      return;
    }

    setIsLoading(true);
    try {
      // Extract video ID if URL provided
      const videoId = extractVideoId(newYoutubeUrl);

      // Create the new topic object
      const newTopic = {
        id: `topic_${Date.now()}`,
        name: newTopicName.trim(),
        level: "Beginner",
        estimatedTime: "1-2 hours",
        status: "not_started",
        youtube_url: newYoutubeUrl || null,
        video_id: videoId,
        video_title: videoPreview?.title || null,
        thumbnail_url: videoPreview?.thumbnail_url || null,
        children: [],
      };

      // Update the tree
      const updatedNodes = [...(skillTree?.nodes || [])];

      if (parentId) {
        // Add as child
        const addToParent = (nodes, parentId, newTopic) => {
          for (let node of nodes) {
            if (node.id === parentId) {
              if (!node.children) node.children = [];
              node.children.push(newTopic);
              return true;
            }
            if (node.children && addToParent(node.children, parentId, newTopic)) {
              return true;
            }
          }
          return false;
        };
        addToParent(updatedNodes, parentId, newTopic);
      } else {
        // Add as root level
        updatedNodes.push(newTopic);
      }

      // Update parent component
      if (onUpdateTree) {
        onUpdateTree({ ...skillTree, nodes: updatedNodes });
      }

      // Reset form
      setNewTopicName("");
      setNewYoutubeUrl("");
      setVideoPreview(null);
      setAddingToNode(null);

      toast.success("Topic added successfully!");
    } catch (error) {
      toast.error("Failed to add topic");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add YouTube URL to existing topic
  const handleAddUrlToTopic = async (topicId) => {
    if (!urlInput.trim()) {
      toast.error("Please enter a YouTube URL");
      return;
    }

    const videoId = extractVideoId(urlInput);
    if (!videoId) {
      toast.error("Invalid YouTube URL");
      return;
    }

    setIsLoading(true);
    try {
      // Update the tree
      const updatedNodes = [...(skillTree?.nodes || [])];

      const updateTopic = (nodes, topicId, updates) => {
        for (let node of nodes) {
          if (node.id === topicId) {
            Object.assign(node, updates);
            return true;
          }
          if (node.children && updateTopic(node.children, topicId, updates)) {
            return true;
          }
        }
        return false;
      };

      updateTopic(updatedNodes, topicId, {
        youtube_url: urlInput,
        video_id: videoId,
        video_title: videoPreview?.title || "YouTube Video",
        thumbnail_url: videoPreview?.thumbnail_url,
      });

      if (onUpdateTree) {
        onUpdateTree({ ...skillTree, nodes: updatedNodes });
      }

      setAddUrlToNode(null);
      setUrlInput("");
      setVideoPreview(null);

      toast.success("Video added to topic!");
    } catch (error) {
      toast.error("Failed to add video");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete topic
  const handleDeleteTopic = (topicId) => {
    const updatedNodes = [...(skillTree?.nodes || [])];

    const removeFromNodes = (nodes, topicId) => {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === topicId) {
          nodes.splice(i, 1);
          return true;
        }
        if (nodes[i].children && removeFromNodes(nodes[i].children, topicId)) {
          return true;
        }
      }
      return false;
    };

    removeFromNodes(updatedNodes, topicId);

    if (onUpdateTree) {
      onUpdateTree({ ...skillTree, nodes: updatedNodes });
    }

    toast.success("Topic removed");
  };

  // Play video with AI companion
  const handlePlayVideo = (node) => {
    if (node.youtube_url || node.video_id) {
      setCurrentVideo({
        url: node.youtube_url || `https://www.youtube.com/watch?v=${node.video_id}`,
        title: node.video_title || node.name,
        topicId: node.id
      });
      setShowVideoModal(true);
    }
  };

  // Open chat without video (for topics without URL)
  const handleOpenChat = (node) => {
    setCurrentVideo({
      url: null,
      title: node.name,
      topicId: node.id,
      topicOnly: true  // Flag to indicate no video, just chat about topic
    });
    setShowVideoModal(true);
  };

  // Update video URL for a topic (callback from VideoLearningModal)
  const handleUpdateVideoUrl = (topicId, videoData) => {
    const updatedNodes = [...(skillTree?.nodes || [])];
    
    const updateTopic = (nodes, topicId, updates) => {
      for (let node of nodes) {
        if (node.id === topicId) {
          Object.assign(node, {
            youtube_url: videoData.url,
            video_id: videoData.video_id,
            video_title: videoData.title,
            thumbnail_url: `https://img.youtube.com/vi/${videoData.video_id}/hqdefault.jpg`
          });
          return true;
        }
        if (node.children && updateTopic(node.children, topicId, updates)) {
          return true;
        }
      }
      return false;
    };
    
    updateTopic(updatedNodes, currentVideo?.topicId);
    
    if (onUpdateTree) {
      onUpdateTree({ ...skillTree, nodes: updatedNodes });
    }
  };

  // Render a single tree node
  const renderTreeNode = (node, depth = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const hasVideo = node.youtube_url || node.video_id;
    const isAddingUrl = addUrlToNode === node.id;

    const statusColors = {
      completed: "#34A853",
      in_progress: "#667eea",
      not_started: "#666",
    };

    return (
      <div key={node.id} className="mb-2">
        <div
          className={`group flex items-start gap-3 p-3 rounded-xl transition-all hover:bg-white/5 ${
            node.status === "in_progress"
              ? "bg-[#667eea]/10 border border-[#667eea]/30"
              : ""
          }`}
          style={{ marginLeft: depth * 20 }}
        >
          {/* Expand/Collapse button */}
          <button
            onClick={() => toggleNode(node.id)}
            className="mt-1 w-5 h-5 flex items-center justify-center text-white/50 hover:text-white"
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )
            ) : (
              <div className="w-4" />
            )}
          </button>

          {/* Status indicator */}
          <div
            className="mt-1.5 w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: statusColors[node.status || "not_started"] }}
          />

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{node.name}</span>
              {hasVideo && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-[#EA4335]/20 rounded text-xs text-[#EA4335]">
                  <Youtube className="w-3 h-3" />
                  Video
                </div>
              )}
            </div>
            <div className="text-xs text-white/50 mt-0.5">
              {node.level} • {node.estimatedTime || "1-2 hours"}
            </div>

            {/* Video thumbnail preview */}
            {hasVideo && node.thumbnail_url && (
              <div className="mt-2 flex items-center gap-3">
                <div
                  className="relative w-24 h-14 rounded-lg overflow-hidden cursor-pointer group/thumb"
                  onClick={() => handlePlayVideo(node)}
                >
                  <img
                    src={node.thumbnail_url}
                    alt={node.video_title || node.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                    <Play className="w-6 h-6 text-white" fill="white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white/70 truncate">
                    {node.video_title || "Watch video"}
                  </div>
                  <button
                    onClick={() => handlePlayVideo(node)}
                    className="text-xs text-[#667eea] hover:text-[#667eea]/80 flex items-center gap-1 mt-1"
                  >
                    <MessageSquare className="w-3 h-3" />
                    Learn with AI Companion
                  </button>
                </div>
              </div>
            )}

            {/* Add URL form */}
            {isAddingUrl && (
              <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Youtube className="w-4 h-4 text-[#EA4335]" />
                  <span className="text-sm font-medium">Add YouTube Video</span>
                </div>
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Paste YouTube URL..."
                  className="bg-white/5 border-white/10 text-sm mb-2"
                />
                {videoPreview && (
                  <div className="flex items-center gap-2 p-2 bg-white/5 rounded mb-2">
                    <img
                      src={videoPreview.thumbnail_url}
                      alt=""
                      className="w-16 h-10 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {videoPreview.title}
                      </div>
                      <div className="text-xs text-white/50">
                        {videoPreview.author_name}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleAddUrlToTopic(node.id)}
                    disabled={isLoading || !urlInput.trim()}
                    size="sm"
                    className="bg-[#EA4335] hover:bg-[#EA4335]/80"
                  >
                    {isLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    Add Video
                  </Button>
                  <Button
                    onClick={() => {
                      setAddUrlToNode(null);
                      setUrlInput("");
                      setVideoPreview(null);
                    }}
                    size="sm"
                    variant="outline"
                    className="border-white/20"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Chat button - always visible */}
            <Button
              onClick={() => hasVideo ? handlePlayVideo(node) : handleOpenChat(node)}
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[#667eea] hover:bg-[#667eea]/10"
              title={hasVideo ? "Watch with AI" : "Chat about this topic"}
            >
              <MessageSquare className="w-3 h-3 mr-1" />
              Chat
            </Button>
            
            {hasVideo ? (
              <Button
                onClick={() => handlePlayVideo(node)}
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[#EA4335] hover:bg-[#EA4335]/10"
                title="Watch with AI"
              >
                <Play className="w-3 h-3 mr-1" />
                Learn
              </Button>
            ) : (
              <Button
                onClick={() => setAddUrlToNode(node.id)}
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[#EA4335] hover:bg-[#EA4335]/10"
                title="Add YouTube video"
              >
                <Link2 className="w-3 h-3 mr-1" />
                Add URL
              </Button>
            )}
            <Button
              onClick={() => setAddingToNode(node.id)}
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[#34A853] hover:bg-[#34A853]/10"
              title="Add subtopic"
            >
              <Plus className="w-3 h-3" />
            </Button>
            <Button
              onClick={() => handleDeleteTopic(node.id)}
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[#EA4335]/60 hover:text-[#EA4335] hover:bg-[#EA4335]/10"
              title="Delete topic"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Add subtopic form */}
        {addingToNode === node.id && (
          <div
            className="ml-8 mt-2 p-4 bg-white/5 rounded-xl border border-white/10"
            style={{ marginLeft: depth * 20 + 32 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <FolderPlus className="w-4 h-4 text-[#34A853]" />
              <span className="text-sm font-medium">Add Subtopic to "{node.name}"</span>
            </div>
            <Input
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              placeholder="Topic name (e.g., React Hooks)"
              className="bg-white/5 border-white/10 text-sm mb-2"
            />
            <Input
              value={newYoutubeUrl}
              onChange={(e) => setNewYoutubeUrl(e.target.value)}
              placeholder="YouTube URL (optional)"
              className="bg-white/5 border-white/10 text-sm mb-2"
            />
            {videoPreview && (
              <div className="flex items-center gap-2 p-2 bg-white/5 rounded mb-2">
                <img
                  src={videoPreview.thumbnail_url}
                  alt=""
                  className="w-16 h-10 rounded object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">
                    {videoPreview.title}
                  </div>
                  <div className="text-xs text-white/50">
                    {videoPreview.author_name}
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                onClick={() => handleAddTopic(node.id)}
                disabled={isLoading || !newTopicName.trim()}
                size="sm"
                className="bg-[#34A853] hover:bg-[#34A853]/80"
              >
                {isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <Check className="w-3 h-3 mr-1" />
                )}
                Add Topic
              </Button>
              <Button
                onClick={() => {
                  setAddingToNode(null);
                  setNewTopicName("");
                  setNewYoutubeUrl("");
                  setVideoPreview(null);
                }}
                size="sm"
                variant="outline"
                className="border-white/20"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Render children */}
        {isExpanded && hasChildren && (
          <div className="ml-4 border-l border-white/10 pl-2">
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with Add Root Topic */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-[#667eea]" />
          <h3 className="font-semibold">Learning Topics</h3>
          <span className="text-xs text-white/50">
            ({skillTree?.nodes?.length || 0} topics)
          </span>
        </div>
        <Button
          onClick={() => setAddingToNode("root")}
          size="sm"
          className="bg-[#667eea] hover:bg-[#667eea]/80"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Topic
        </Button>
      </div>

      {/* Root level add form */}
      {addingToNode === "root" && (
        <div className="p-4 bg-white/5 rounded-xl border border-[#667eea]/30 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-[#667eea]" />
            <span className="text-sm font-medium">Add New Topic</span>
          </div>
          <Input
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
            placeholder="Topic name (e.g., Machine Learning Basics)"
            className="bg-white/5 border-white/10 text-sm mb-2"
            autoFocus
          />
          <Input
            value={newYoutubeUrl}
            onChange={(e) => setNewYoutubeUrl(e.target.value)}
            placeholder="YouTube URL (optional)"
            className="bg-white/5 border-white/10 text-sm mb-2"
          />
          {videoPreview && (
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg mb-3">
              <img
                src={videoPreview.thumbnail_url}
                alt=""
                className="w-20 h-12 rounded object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {videoPreview.title}
                </div>
                <div className="text-xs text-white/50">
                  {videoPreview.author_name}
                </div>
              </div>
              <Eye className="w-4 h-4 text-[#34A853]" />
            </div>
          )}
          <div className="flex gap-2">
            <Button
              onClick={() => handleAddTopic(null)}
              disabled={isLoading || !newTopicName.trim()}
              size="sm"
              className="bg-[#667eea] hover:bg-[#667eea]/80"
            >
              {isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <Plus className="w-3 h-3 mr-1" />
              )}
              Add Topic
            </Button>
            <Button
              onClick={() => {
                setAddingToNode(null);
                setNewTopicName("");
                setNewYoutubeUrl("");
                setVideoPreview(null);
              }}
              size="sm"
              variant="outline"
              className="border-white/20"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {(!skillTree?.nodes || skillTree.nodes.length === 0) && (
        <div className="text-center py-12 text-white/50">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="mb-2">No topics yet</p>
          <p className="text-sm">
            Click "Add Topic" to create your first learning topic
          </p>
        </div>
      )}

      {/* Tree nodes */}
      <div className="space-y-1">
        {skillTree?.nodes?.map((node) => renderTreeNode(node))}
      </div>

      {/* Video Learning Modal */}
      {showVideoModal && currentVideo && (
        <VideoLearningModal
          videoUrl={currentVideo.url}
          videoTitle={currentVideo.title}
          onClose={() => {
            setShowVideoModal(false);
            setCurrentVideo(null);
          }}
          skillLevel={userProfile?.experience || "intermediate"}
          onUpdateVideoUrl={(videoData) => handleUpdateVideoUrl(currentVideo.topicId, videoData)}
        />
      )}
    </div>
  );
};

export default EditableLearningPath;

import { useState, useCallback } from "react";
import { X, Upload, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const TASK_TYPES = [
  { value: "code_screenshot", label: "Code Screenshot" },
  { value: "whiteboard", label: "Whiteboard / Handwritten" },
  { value: "english_text", label: "English Text / Document" },
  { value: "general", label: "General Analysis" },
];

const ImageUploadModal = ({ onClose, onAnalysis }) => {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [taskType, setTaskType] = useState("general");
  const [additionalContext, setAdditionalContext] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file) => {
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a JPG, PNG, or WebP image");
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be smaller than 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(",")[1];
      setImage(base64);
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleAnalyze = async () => {
    if (!image) {
      toast.error("Please upload an image first");
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/analyze-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_data: image,
          task_type: taskType,
          additional_context: additionalContext,
        }),
      });

      if (!response.ok) throw new Error("Analysis failed");

      const data = await response.json();
      onAnalysis(data.analysis);
      onClose();
      toast.success("Image analyzed successfully!");
    } catch (error) {
      console.error("Image analysis error:", error);
      toast.error("Failed to analyze image. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div 
      data-testid="image-upload-modal"
      className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4 animate-fadeIn"
    >
      <div className="glass-heavy w-full max-w-lg rounded-2xl overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Image Analysis</h2>
              <p className="text-xs text-white/50">Upload an image for AI analysis</p>
            </div>
          </div>
          <button
            data-testid="close-image-modal-btn"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Drop Zone */}
          <div
            data-testid="image-dropzone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              dropzone rounded-xl p-8 text-center cursor-pointer transition-all
              ${isDragging ? "dragging" : ""}
              ${imagePreview ? "border-[#667eea]" : ""}
            `}
            onClick={() => document.getElementById("file-input").click()}
          >
            {imagePreview ? (
              <div className="space-y-4">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-48 mx-auto rounded-lg object-contain"
                />
                <p className="text-sm text-white/60">Click or drag to replace</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto rounded-xl bg-white/5 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-white/40" />
                </div>
                <div>
                  <p className="font-medium">Drop your image here</p>
                  <p className="text-sm text-white/50 mt-1">or click to browse</p>
                </div>
                <p className="text-xs text-white/40">JPG, PNG, WebP • Max 10MB</p>
              </div>
            )}
            <input
              id="file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => handleFile(e.target.files[0])}
              className="hidden"
            />
          </div>

          {/* Task Type Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70">What should I analyze?</label>
            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger 
                data-testid="task-type-select"
                className="bg-white/5 border-white/10"
              >
                <SelectValue placeholder="Select task type" />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Additional Context */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70">Additional context (optional)</label>
            <Input
              data-testid="additional-context-input"
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="Any specific questions or context..."
              className="bg-white/5 border-white/10"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex gap-3">
          <Button
            data-testid="cancel-image-btn"
            onClick={onClose}
            className="flex-1 btn-secondary"
          >
            Cancel
          </Button>
          <Button
            data-testid="analyze-image-btn"
            onClick={handleAnalyze}
            disabled={!image || isAnalyzing}
            className="flex-1 btn-primary"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Analyze Image
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Add missing import
import { Sparkles } from "lucide-react";

export default ImageUploadModal;

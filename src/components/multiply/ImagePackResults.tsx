import { useNavigate } from "react-router-dom";
/**
 * ImagePackResults Component
 * 
 * Displays generated image prompts (Hero, Social, Email)
 * with copy buttons and links to Image Studio.
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, ExternalLink, RefreshCw, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ImagePackOutput, ContentAnalysis } from "@/lib/agents/contentToVisualPrompts";

interface ImagePackResultsProps {
  images: ImagePackOutput;
  analysis: ContentAnalysis;
  onRegenerate?: (type: 'hero' | 'social' | 'emailHeader') => void;
  isRegenerating?: boolean;
}

export function ImagePackResults({ 
  images, 
  analysis, 
  onRegenerate,
  isRegenerating 
}: ImagePackResultsProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (prompt: string, id: string) => {
    await navigator.clipboard.writeText(prompt);
    setCopiedId(id);
    toast({
      title: "Prompt copied",
      description: "Image prompt copied to clipboard",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openInImageStudio = (prompt: string) => {
    // Navigate to Dark Room (new Image Studio) with prompt pre-filled
    const encodedPrompt = encodeURIComponent(prompt);
    navigate(`/darkroom?prompt=${encodedPrompt}`);
  };

  const imageConfigs = [
    {
      key: 'hero' as const,
      title: 'Hero Image',
      data: images.hero,
      aspectPreview: 'aspect-video', // 16:9
      bgColor: 'bg-gradient-to-br from-amber-50 to-orange-50',
    },
    {
      key: 'social' as const,
      title: 'Social Post',
      data: images.social,
      aspectPreview: 'aspect-square', // 1:1
      bgColor: 'bg-gradient-to-br from-pink-50 to-purple-50',
    },
    {
      key: 'emailHeader' as const,
      title: 'Email Header',
      data: images.emailHeader,
      aspectPreview: 'aspect-[3/1]', // 3:1
      bgColor: 'bg-gradient-to-br from-blue-50 to-cyan-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Analysis Summary */}
      <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
        <h4 className="font-medium text-sm mb-2">Content Analysis</h4>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs">
            Mood: {analysis.mood}
          </Badge>
          {analysis.themes.slice(0, 3).map((theme) => (
            <Badge key={theme} variant="secondary" className="text-xs">
              {theme}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {analysis.colorPalette.slice(0, 4).map((color) => (
            <div
              key={color}
              className="w-5 h-5 rounded-full border border-white shadow-sm"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Image Prompts Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {imageConfigs.map(({ key, title, data, aspectPreview, bgColor }) => (
          <Card key={key} className="overflow-hidden">
            {/* Aspect Ratio Preview */}
            <div className={`${aspectPreview} ${bgColor} flex items-center justify-center`}>
              <div className="text-center">
                <ImageIcon className="w-8 h-8 mx-auto text-muted-foreground/40" />
                <span className="text-xs text-muted-foreground/60 mt-1 block">
                  {data.aspectRatio}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">{title}</h4>
                <Badge variant="outline" className="text-xs">
                  {data.aspectRatio}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground line-clamp-4">
                {data.prompt}
              </p>

              {data.negativePrompt && (
                <p className="text-xs text-red-500/70">
                  Avoid: {data.negativePrompt}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleCopy(data.prompt, key)}
                >
                  {copiedId === key ? (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </>
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="default"
                  className="flex-1 bg-primary hover:bg-primary/90"
                  onClick={() => openInImageStudio(data.prompt)}
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Generate
                </Button>
              </div>

              {onRegenerate && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full text-xs"
                  onClick={() => onRegenerate(key)}
                  disabled={isRegenerating}
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${isRegenerating ? 'animate-spin' : ''}`} />
                  Regenerate this prompt
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default ImagePackResults;

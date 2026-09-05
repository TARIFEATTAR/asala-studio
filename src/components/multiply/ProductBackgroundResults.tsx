import { useNavigate } from "react-router-dom";
/**
 * ProductBackgroundResults Component
 * 
 * Displays generated product background prompts
 * for e-commerce and lifestyle photography.
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, ExternalLink, RefreshCw, Layers, Sun, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ProductBackgroundOutput, ContentAnalysis } from "@/lib/agents/contentToVisualPrompts";

interface ProductBackgroundResultsProps {
  backgrounds: ProductBackgroundOutput;
  analysis: ContentAnalysis;
  onRegenerate?: (type: 'productHero' | 'lifestyle' | 'detail') => void;
  isRegenerating?: boolean;
  onBeforeNavigate?: () => void;
}

export function ProductBackgroundResults({ 
  backgrounds, 
  analysis, 
  onRegenerate,
  isRegenerating,
  onBeforeNavigate,
}: ProductBackgroundResultsProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (prompt: string, id: string) => {
    await navigator.clipboard.writeText(prompt);
    setCopiedId(id);
    toast({
      title: "Prompt copied",
      description: "Background prompt copied to clipboard",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openInImageStudio = (prompt: string) => {
    // Navigate to Dark Room (new Image Studio) with prompt pre-filled
    const encodedPrompt = encodeURIComponent(prompt);
    onBeforeNavigate?.();
    navigate(`/darkroom?prompt=${encodedPrompt}`);
  };

  const bgConfigs = [
    {
      key: 'productHero' as const,
      title: 'Product Hero',
      data: backgrounds.productHero,
      aspectPreview: 'aspect-square', // 1:1
      // Create a gradient based on first color in palette
      gradient: `linear-gradient(135deg, ${analysis.colorPalette[0] || '#F5F1E8'}22, ${analysis.colorPalette[1] || '#B8956A'}22)`,
    },
    {
      key: 'lifestyle' as const,
      title: 'Lifestyle Wide',
      data: backgrounds.lifestyle,
      aspectPreview: 'aspect-video', // 16:9
      gradient: `linear-gradient(135deg, ${analysis.colorPalette[1] || '#B8956A'}22, ${analysis.colorPalette[2] || '#2F2A26'}22)`,
    },
    {
      key: 'detail' as const,
      title: 'Detail Shot',
      data: backgrounds.detail,
      aspectPreview: 'aspect-[4/5]', // 4:5
      gradient: `linear-gradient(135deg, ${analysis.colorPalette[2] || '#2F2A26'}22, ${analysis.colorPalette[0] || '#F5F1E8'}22)`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Analysis Summary */}
      <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
        <h4 className="font-medium text-sm mb-2">Surface & Material Analysis</h4>
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="outline" className="text-xs">
            Mood: {analysis.mood}
          </Badge>
          {analysis.surfaces.slice(0, 4).map((surface) => (
            <Badge key={surface} variant="secondary" className="text-xs">
              {surface}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {analysis.colorPalette.slice(0, 5).map((color) => (
            <div
              key={color}
              className="w-6 h-6 rounded border border-white shadow-sm"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Background Prompts */}
      <div className="grid gap-4 md:grid-cols-3">
        {bgConfigs.map(({ key, title, data, aspectPreview, gradient }) => (
          <Card key={key} className="overflow-hidden">
            {/* Visual Preview - represents the background scene */}
            <div 
              className={`${aspectPreview} flex items-center justify-center relative`}
              style={{ background: gradient }}
            >
              {/* Product placeholder indicator */}
              <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg w-1/3 h-1/3 flex items-center justify-center">
                <Square className="w-6 h-6 text-muted-foreground/30" />
              </div>
              <span className="absolute bottom-2 left-2 text-xs text-muted-foreground/50 bg-background/80 px-2 py-0.5 rounded">
                Product goes here
              </span>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">{title}</h4>
                <Badge variant="outline" className="text-xs">
                  {data.aspectRatio}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground line-clamp-3">
                {data.prompt}
              </p>

              {/* Surface & Lighting Tags */}
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs bg-stone-50">
                  <Layers className="w-2.5 h-2.5 mr-1" />
                  {data.surface}
                </Badge>
                <Badge variant="outline" className="text-xs bg-amber-50">
                  <Sun className="w-2.5 h-2.5 mr-1" />
                  {data.lighting}
                </Badge>
              </div>

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
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
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
                  Regenerate
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Usage Tips */}
      <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
        <h4 className="font-medium text-sm text-emerald-800 dark:text-emerald-200 mb-2">
          How to use these backgrounds
        </h4>
        <ul className="text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
          <li>• Generate the background in Image Studio</li>
          <li>• Place your product photo on top using background removal</li>
          <li>• The prompts are designed to leave space for your product</li>
          <li>• All prompts exclude the product to ensure clean compositing</li>
        </ul>
      </div>
    </div>
  );
}

export default ProductBackgroundResults;

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share2, X, Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import MobileAspectRatioSelector from "./MobileAspectRatioSelector";
import type { ImageCategoryDefinition } from "@/data/imageCategories";

interface MobileGeneratedImageViewProps {
  imageUrl: string;
  prompt: string;
  aspectRatio: string;
  onSave: () => void;
  onClose: () => void;
  onRegenerate: (prompt: string) => void;
  onPromptChange: (prompt: string) => void;
  onAspectRatioChange: (ratio: string) => void;
  onShotTypeSelect: (shotType: ImageCategoryDefinition) => void;
  isGenerating: boolean;
  isSaving?: boolean;
}

export default function MobileGeneratedImageView({ imageUrl, prompt, aspectRatio, onSave, onClose, onRegenerate, onPromptChange, onAspectRatioChange, isGenerating, isSaving = false }: MobileGeneratedImageViewProps) {
  const [isExporting, setIsExporting] = useState(false);
  const busy = isGenerating || isSaving || isExporting;
  const handleExport = async (share: boolean) => {
    setIsExporting(true);
    try {
      if (share && navigator.share) {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error("Unable to load image");
        const blob = await response.blob();
        const file = new File([blob], "madison-image.png", { type: blob.type });
        if (navigator.canShare?.({files: [file]})) {
          await navigator.share({files: [file], title: "Madison image"});
          return;
        }
      }
      const { downloadImage } = await import("@/utils/imageDownload");
      await downloadImage(imageUrl, `madison-${Date.now()}.png`);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) toast.error("Could not export the image. Please try again.");
    } finally { setIsExporting(false); }
  };

  return (
    <section aria-label="Generated image" className="mobile-image-result fixed inset-0 z-50 flex flex-col bg-ink-black text-parchment-white">
      <header className="flex shrink-0 items-center gap-2 border-b border-charcoal p-3 pt-[max(12px,env(safe-area-inset-top))]">
        <Button variant="ghost" size="icon" onClick={onClose} disabled={busy} aria-label="Back to image gallery"><X className="h-5 w-5" /></Button>
        <Button onClick={onSave} disabled={busy} className="flex-1 bg-aged-brass text-ink-black hover:bg-aged-brass/90">{isSaving ? "Saving…" : "Save image"}</Button>
        {typeof navigator.share === "function" && <Button variant="ghost" size="icon" onClick={() => handleExport(true)} disabled={busy} aria-label="Share image"><Share2 className="h-5 w-5" /></Button>}
        <Button variant="ghost" size="icon" onClick={() => handleExport(false)} disabled={busy} aria-label="Download image"><Download className="h-5 w-5" /></Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        <img src={imageUrl} alt="Generated image" className="mx-auto max-h-[55dvh] w-full rounded-lg object-contain" />
        <details className="mt-4 rounded-lg border border-charcoal bg-charcoal">
          <summary className="cursor-pointer px-4 py-4 font-medium">Create a variation</summary>
          <div className="space-y-4 px-4 pb-4">
            <Label htmlFor="mobile-variation-prompt">Image description</Label>
            <Textarea id="mobile-variation-prompt" value={prompt} onChange={e => onPromptChange(e.target.value)} rows={4} disabled={busy} className="bg-ink-black border-charcoal" />
            <MobileAspectRatioSelector value={aspectRatio} onChange={onAspectRatioChange} />
            <Button onClick={() => onRegenerate(prompt)} disabled={busy || !prompt.trim()} className="w-full bg-aged-brass text-ink-black hover:bg-aged-brass/90"><Sparkles className="mr-2 h-4 w-4" />{isGenerating ? "Generating…" : "Generate variation"}</Button>
          </div>
        </details>
      </div>
    </section>
  );
}

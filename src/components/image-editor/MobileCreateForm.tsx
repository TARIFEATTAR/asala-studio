import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Camera, Sparkles, Upload, X, Wand2, Type } from "lucide-react";
import MobileAspectRatioSelector from "./MobileAspectRatioSelector";
import {
  imageCategories,
  type ImageCategoryDefinition,
} from "@/data/imageCategories";

// Dark Room themed options - monochromatic with brass accents
const CREATION_OPTIONS = [
  ...imageCategories.map((category) => ({
    id: category.key,
    label: category.label,
    icon: category.icon || Camera,
    prompt: category.prompt,
    categoryKey: category.key,
  })),
  {
    id: "custom",
    label: "Custom Prompt",
    icon: Type,
    prompt: "",
    categoryKey: undefined as string | undefined,
  },
  {
    id: "magic",
    label: "AI Enhanced",
    icon: Wand2,
    prompt: "Professionally styled product image with cinematic lighting and premium aesthetic.",
    categoryKey: undefined as string | undefined,
  }
];

interface MobileCreateFormProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  aspectRatio: string;
  onAspectRatioChange: (ratio: string) => void;
  onShotTypeSelect: (shotType: ImageCategoryDefinition) => void;
  referenceImage: { file: File; url: string } | null;
  onReferenceUpload: (file: File, url: string) => void;
  onReferenceRemove: () => void;
  onGenerate: (overridePrompt?: string) => void;
  isGenerating: boolean;
  marketplace?: string;
  imagesCount: number;
  maxImages: number;
}

export default function MobileCreateForm({
  prompt,
  onPromptChange,
  aspectRatio,
  onAspectRatioChange,
  onShotTypeSelect,
  referenceImage,
  onReferenceUpload,
  onReferenceRemove,
  onGenerate,
  isGenerating,
  marketplace,
  imagesCount,
  maxImages,
}: MobileCreateFormProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [modalPrompt, setModalPrompt] = useState("");

  const handleCardClick = (option: typeof CREATION_OPTIONS[0]) => {
    setSelectedOption(option.id);
    setModalPrompt(option.id === "custom" ? prompt : option.prompt);
    onPromptChange(option.id === "custom" ? prompt : option.prompt);
    if (option.categoryKey) {
      const definition = imageCategories.find(
        (category) => category.key === option.categoryKey
      );
      if (definition) {
        onShotTypeSelect(definition);
      }
    }
  };


  const handleModalClose = () => {
    setSelectedOption(null);
  };

  const handleGenerateFromModal = () => {
    onPromptChange(modalPrompt);
    onGenerate(modalPrompt);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        onReferenceUpload(file, url);
      };
      reader.readAsDataURL(file);
    }
  };

  const selectedOptionData = CREATION_OPTIONS.find(opt => opt.id === selectedOption);

  return (
    <>
      {/* Card Grid - Dark Room Theme */}
      <div className="flex-1 p-4 overflow-y-auto bg-ink-black">
        <div className="grid grid-cols-2 gap-3">
          {CREATION_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                type="button"
                key={option.id}
                onClick={() => handleCardClick(option)}
                className={cn(
                  "relative overflow-hidden cursor-pointer transition-all duration-200 border",
                  "bg-charcoal/60 border-charcoal hover:border-aged-brass/50",
                  "active:scale-95 h-28 rounded-lg"
                )}
              >
                {/* Subtle dark gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-charcoal/80 to-ink-black/90 opacity-50" />

                <div className="relative h-full p-4 flex flex-col items-center justify-center text-center gap-3">
                  {/* Icon with brass tint */}
                  <div className="w-10 h-10 rounded-lg bg-charcoal border border-aged-brass/30 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-aged-brass" />
                  </div>
                  <span className="text-sm font-medium text-parchment-white/90">
                    {option.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {imagesCount > 0 && (
          <p className="text-center text-xs text-parchment-white/40 mt-4">
            {imagesCount} of {maxImages} images created
          </p>
        )}
      </div>

      {/* Full Screen Creation Modal - Dark Room Theme */}
      <Dialog open={!!selectedOption} onOpenChange={(open) => { if (!open) handleModalClose(); }}>
        <DialogContent onOpenAutoFocus={event => event.preventDefault()} aria-describedby={undefined} className="mobile-fullscreen-dialog [&>button]:hidden fixed inset-0 bg-ink-black border-none rounded-none p-0 max-w-none w-screen h-[100dvh] flex flex-col transform-none m-0">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-charcoal bg-charcoal/50">
            <div className="flex items-center gap-3">
              {selectedOptionData && (
                <>
                  <div className="w-9 h-9 rounded-lg bg-charcoal border border-aged-brass/30 flex items-center justify-center">
                    <selectedOptionData.icon className="w-4 h-4 text-aged-brass" />
                  </div>
                  <DialogTitle className="text-base font-semibold text-aged-brass">
                    {selectedOptionData.label}
                  </DialogTitle>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleModalClose}
              aria-label="Close image setup"
              className="text-parchment-white/60 hover:text-parchment-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Modal Content */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-5 bg-ink-black">
            {/* Prompt Input */}
            <div className="space-y-2">
              <label htmlFor="mobile-image-prompt" className="text-xs font-medium text-aged-brass/80 uppercase tracking-wider">
                Describe Your Image
              </label>
              <Textarea
                id="mobile-image-prompt"
                value={modalPrompt}
                onChange={(e) => { setModalPrompt(e.target.value); onPromptChange(e.target.value); }}
                placeholder="Describe what you want to create..."
                rows={4}
                className="w-full bg-charcoal/80 border-charcoal text-parchment-white placeholder:text-parchment-white/30 resize-none focus:border-aged-brass/50 focus:ring-aged-brass/20"
                disabled={isGenerating}
              />
            </div>

            {/* Reference Image Upload */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-aged-brass/80 uppercase tracking-wider">
                Reference Image (Optional)
              </label>
              {referenceImage ? (
                <div className="relative rounded-lg overflow-hidden border border-charcoal">
                  <img
                    src={referenceImage.url}
                    alt="Reference"
                    className="w-full h-48 object-cover"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={onReferenceRemove} aria-label="Remove reference image"
                    className="absolute top-2 right-2 h-8 w-8 bg-black/70 hover:bg-black/90 text-parchment-white"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label className="block">
                  <input
                    aria-label="Upload reference image" type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isGenerating}
                  />
                  <div className={cn(
                    "border-2 border-dashed rounded-lg p-6 cursor-pointer transition-all",
                    "border-charcoal bg-charcoal/40 hover:border-aged-brass/40 hover:bg-charcoal/60"
                  )}>
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Upload className="w-8 h-8 text-parchment-white/40" />
                      <span className="text-sm text-parchment-white/50">Tap to upload</span>
                    </div>
                  </div>
                </label>
              )}
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-aged-brass/80 uppercase tracking-wider">
                Image Size
              </label>
              <MobileAspectRatioSelector
                value={aspectRatio}
                onChange={onAspectRatioChange}
                marketplace={marketplace}
              />
            </div>
          </div>

          {/* Modal Footer - Generate Button */}
          <div className="shrink-0 border-t border-charcoal bg-charcoal/50 p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
            <Button
              onClick={handleGenerateFromModal}
              disabled={!modalPrompt.trim() || isGenerating || imagesCount >= maxImages}
              type="button"
              size="lg"
              className="w-full h-12 bg-aged-brass hover:bg-aged-brass/90 text-ink-black font-semibold"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="w-5 h-5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate Image
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

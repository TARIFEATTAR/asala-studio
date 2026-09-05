/**
 * MobileDarkRoom - Mobile-optimized Dark Room interface
 * 
 * Clean tile-based UI for mobile that avoids scrolling by using
 * full-screen modals for each setting category.
 * 
 * Features:
 * - Hero image preview with developing animation
 * - Full-screen image viewer on tap
 * - Tile-based settings grid
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Dices, Camera, Loader2, ChevronLeft, CheckCircle, Sparkles, Bookmark, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MobileSettingsGrid } from "./MobileSettingsGrid";
import { MobileBottomSheet } from "./MobileBottomSheet";
import { UploadZone } from "./UploadZone";
import { ThumbnailCarousel } from "./ThumbnailCarousel";
import { DevelopingAnimation, useDevelopingAnimation } from "./DevelopingAnimation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { ProModeSettings } from "./ProSettings";
import { Product } from "@/hooks/useProducts";
import { ProductSelector } from "@/components/forge/ProductSelector";
import { ImageLibraryModal } from "@/components/image-editor/ImageLibraryModal";
import {
  BACKGROUND_SCENE_TAG,
  LIBRARY_ROLE_BACKGROUND_SCENE,
} from "@/lib/imageLibraryTags";
import { StyleReferenceGuideModal } from "./StyleReferenceGuideModal";

interface UploadedImage {
  url: string;
  file?: File;
  name?: string;
}

interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  timestamp: number;
  isSaved: boolean;
  isHero?: boolean;
}

interface MobileDarkRoomProps {
  // Prompt
  prompt: string;
  onPromptChange: (value: string) => void;
  onOpenMadison: () => void;
  onSavePrompt: () => void;
  canSavePrompt: boolean;
  
  // Generation
  onGenerate: () => void;
  isGenerating: boolean;
  canGenerate: boolean;
  
  // Images
  images: GeneratedImage[];
  heroImageId: string | null;
  onSetHero: (id: string) => void;
  onSaveImage: (id: string) => void;
  onDeleteImage: (id: string) => void;
  onRefineImage: (image: GeneratedImage) => void;
  maxImages: number;
  
  // Track newly generated for animation
  newlyGeneratedId?: string | null;
  
  // Product & References
  selectedProduct: Product | null;
  onProductSelect: (product: Product | null) => void;
  productImage: UploadedImage | null;
  onProductImageUpload: (image: UploadedImage | null) => void;
  backgroundImage: UploadedImage | null;
  onBackgroundImageUpload: (image: UploadedImage | null) => void;
  styleReference: UploadedImage | null;
  onStyleReferenceUpload: (image: UploadedImage | null) => void;
  
  // Pro Settings
  proSettings: ProModeSettings;
  onProSettingsChange: (settings: ProModeSettings) => void;

  backgroundPlateMode: boolean;
  onBackgroundPlateModeChange: (value: boolean) => void;

  styleReferenceLibraryOutput: boolean;
  onStyleReferenceLibraryOutputChange: (value: boolean) => void;
}

export function MobileDarkRoom({
  prompt,
  onPromptChange,
  onOpenMadison,
  onSavePrompt,
  canSavePrompt,
  onGenerate,
  isGenerating,
  canGenerate,
  images,
  heroImageId,
  onSetHero,
  onSaveImage,
  onDeleteImage,
  onRefineImage,
  maxImages,
  newlyGeneratedId,
  selectedProduct,
  onProductSelect,
  productImage,
  onProductImageUpload,
  backgroundImage,
  onBackgroundImageUpload,
  styleReference,
  onStyleReferenceUpload,
  proSettings,
  onProSettingsChange,
  backgroundPlateMode,
  onBackgroundPlateModeChange,
  styleReferenceLibraryOutput,
  onStyleReferenceLibraryOutputChange,
}: MobileDarkRoomProps) {
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputsSheetOpen, setInputsSheetOpen] = useState(false);
  const [showBackgroundLibrary, setShowBackgroundLibrary] = useState(false);
  const [styleGuideOpen, setStyleGuideOpen] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<GeneratedImage | null>(null);

  useEffect(() => {
    if (fullscreenImage) {
      const current = images.find(image => image.id === fullscreenImage.id);
      if (current && current !== fullscreenImage) setFullscreenImage(current);
    }
  }, [images, fullscreenImage]);

  const heroImage = images.find((img) => img.id === heroImageId) || images[0] || null;
  const isNewlyGenerated = heroImage && heroImage.id === newlyGeneratedId;

  // Use the developing animation hook for newly generated images
  const { phase } = useDevelopingAnimation(
    isNewlyGenerated ? heroImage?.imageUrl : null,
    {
      autoStart: !!isNewlyGenerated,
      developDuration: 2500,
      onComplete: () => {
        // Animation complete
      },
    }
  );

  // Auto-resize textarea
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onPromptChange(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  // Random prompt ideas
  const handleRandomPrompt = () => {
    const prompts = [
      "Elegant product shot with soft morning light",
      "Minimalist composition on marble surface",
      "Luxurious lifestyle setting with botanical elements",
      "Dramatic studio lighting with deep shadows",
      "Golden hour glow with natural textures",
    ];
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    onPromptChange(randomPrompt);
  };

  // Handle generate with Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canGenerate && !isGenerating) {
      e.preventDefault();
      onGenerate();
    }
  };

  const handleRandomClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (e.type === "touchend") e.preventDefault();
    handleRandomPrompt();
  }, []);

  const handleGenerateClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (e.type === "touchend") e.preventDefault();
    if (canGenerate && !isGenerating && images.length < maxImages) {
      onGenerate();
    }
  }, [canGenerate, isGenerating, images.length, maxImages, onGenerate]);

  const handleOpenInputsClick = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e?.type === "touchend") e.preventDefault();
    setInputsSheetOpen(true);
  }, []);

  return (
    <div className="mobile-darkroom">
      {/* Header */}
      <div className="mobile-darkroom__header">
        <div className="flex items-center gap-2">
          <button
            aria-label="Back to Create" onClick={() => navigate("/create")}
            className="w-9 h-9 flex items-center justify-center rounded-[4px] bg-[var(--darkroom-surface)] border border-[var(--darkroom-border-subtle)] text-[var(--darkroom-text-muted)] active:bg-[var(--darkroom-surface-elevated)] active:scale-[0.97] transition-all"
            type="button"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="mobile-darkroom__title">Dark Room</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSavePrompt}
            className="w-9 h-9 flex items-center justify-center rounded-[4px] bg-[var(--darkroom-surface)] border border-[var(--darkroom-border-subtle)] text-[var(--darkroom-text-muted)] disabled:opacity-40 active:bg-[var(--darkroom-surface-elevated)] active:scale-[0.97] transition-all"
            type="button"
            disabled={!canSavePrompt}
            aria-label="Save prompt"
          >
            <Bookmark className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenMadison}
            className="h-9 rounded-[4px] bg-[var(--darkroom-surface)] border border-[var(--darkroom-border-subtle)] px-3 text-[12px] font-medium text-[var(--darkroom-text-muted)] active:bg-[var(--darkroom-surface-elevated)] active:scale-[0.97] transition-all inline-flex items-center gap-1.5"
            type="button"
          >
            <Sparkles className="w-4 h-4" />
            Madison
          </button>
        </div>
      </div>

      {/* Prompt Area */}
      <div className="mobile-darkroom__prompt-area">
        <textarea
          ref={textareaRef}
          className="mobile-darkroom__prompt-input"
          aria-label="Describe your image" placeholder="Describe your image…"
          value={prompt}
          onChange={handlePromptChange}
          onKeyDown={handleKeyDown}
          rows={3}
        />
        <div className="mobile-darkroom__prompt-footer">
          <div className="mobile-darkroom__image-count">
            <Plus className="w-4 h-4" />
            <span>{images.length}/{maxImages}</span>
          </div>
          <button
            className="mobile-darkroom__random-btn"
            onClick={handleRandomClick}
            title="Random prompt idea"
            type="button"
          >
            <Dices className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Hero Image Preview - Shows during/after generation */}
      <AnimatePresence mode="wait">
        {(isGenerating || heroImage) && (
          <motion.div
            className="mobile-darkroom__hero-preview"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            {isGenerating ? (
              // Developing animation while generating
              <div className="mobile-darkroom__developing">
                <DevelopingAnimation
                  phase="submerged"
                  developingText="Exposing image..."
                />
              </div>
            ) : heroImage && isNewlyGenerated ? (
              // Newly generated image with reveal animation
              <motion.button type="button" aria-label="Open image preview"
                className="mobile-darkroom__hero-container"
                onClick={() => setFullscreenImage(heroImage)}
              >
                <DevelopingAnimation
                  imageUrl={heroImage.imageUrl}
                  phase={phase}
                  developDuration={2500}
                  developingText="Developing..."
                />
                <div className="mobile-darkroom__hero-hint">Tap to expand</div>
              </motion.button>
            ) : heroImage ? (
              // Regular hero image display
              <motion.button type="button" aria-label="Open image preview"
                className="mobile-darkroom__hero-container"
                onClick={() => setFullscreenImage(heroImage)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <img 
                  src={heroImage.imageUrl} 
                  alt="Generated" 
                  className="mobile-darkroom__hero-image"
                />
                {heroImage.isSaved && (
                  <div className="mobile-darkroom__saved-badge">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                )}
                <div className="mobile-darkroom__hero-hint">Tap to expand</div>
              </motion.button>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Grid */}
      <MobileSettingsGrid
        proSettings={proSettings}
        onProSettingsChange={onProSettingsChange}
        onOpenInputs={handleOpenInputsClick}
        hasProductImage={!!productImage}
        hasBackgroundImage={!!backgroundImage}
        hasStyleReference={!!styleReference}
        disabled={isGenerating}
      />

      {/* Film Strip (if images exist) */}
      {images.length > 0 && (
        <div className="mobile-darkroom__film-strip">
          <ThumbnailCarousel
            images={images}
            activeId={heroImageId}
            onSelect={(id) => {
              onSetHero(id);
              const img = images.find(i => i.id === id);
              if (img) setFullscreenImage(img);
            }}
            onSave={onSaveImage}
            onDelete={onDeleteImage}
            maxSlots={maxImages}
          />
        </div>
      )}

      {/* Generate Button */}
      <button
        className="mobile-darkroom__generate-btn"
        onClick={handleGenerateClick}
        disabled={!canGenerate || isGenerating || images.length >= maxImages}
        type="button"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Generating...</span>
          </>
        ) : (
          <>
            <Camera className="w-5 h-5" />
            <span>Generate Image</span>
          </>
        )}
      </button>

      {/* Inputs Sheet (Product, Background, Style images) */}
      <MobileBottomSheet
        isOpen={inputsSheetOpen}
        onClose={() => setInputsSheetOpen(false)}
        title="Reference Images"
        className="mobile-inputs-sheet"
      >
        <div className="space-y-4 p-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--darkroom-border)] bg-[var(--darkroom-bg)] p-3">
            <Label htmlFor="mobile-bg-plate" className="text-sm text-[var(--darkroom-text-muted)]">
              Background plate mode
            </Label>
            <Switch
              id="mobile-bg-plate"
              checked={backgroundPlateMode}
              onCheckedChange={onBackgroundPlateModeChange}
              disabled={isGenerating}
            />
          </div>

          {/* Product Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--darkroom-text-muted)]">
              Product Context
            </label>
            <ProductSelector
              value={selectedProduct?.name || ""}
              onSelect={(product) => onProductSelect(product)}
              onProductDataChange={(product) => onProductSelect(product)}
              showLabel={false}
              buttonClassName="w-full justify-between h-12 bg-[var(--darkroom-bg)] border-[var(--darkroom-border)] text-[var(--darkroom-text-muted)] hover:text-[var(--darkroom-text)] hover:border-[var(--darkroom-accent)]"
            />
          </div>

          {/* Product Image */}
          <UploadZone
            type="product"
            label="Product Image"
            description={
              backgroundPlateMode
                ? "Skipped in plate mode — add products after you have a scene"
                : "For enhancement & placement"
            }
            image={productImage}
            onUpload={onProductImageUpload}
            onRemove={() => onProductImageUpload(null)}
            disabled={isGenerating || backgroundPlateMode}
          />

          {/* Background Scene */}
          <UploadZone
            type="background"
            label="Background Scene"
            description="Composites product into scene"
            image={backgroundImage}
            onUpload={onBackgroundImageUpload}
            onRemove={() => onBackgroundImageUpload(null)}
            onLibraryOpen={() => setShowBackgroundLibrary(true)}
            disabled={isGenerating}
          />

          {/* Style Reference */}
          <div className="space-y-2">
            <div className="flex items-center justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-[var(--darkroom-text-muted)]"
                onClick={() => setStyleGuideOpen(true)}
              >
                <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                Style reference guide
              </Button>
            </div>
            <UploadZone
              type="style"
              label="Style Reference"
              description="Matches lighting & mood"
              image={styleReference}
              onUpload={onStyleReferenceUpload}
              onRemove={() => onStyleReferenceUpload(null)}
              disabled={isGenerating}
            />
            {styleReference ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--darkroom-border)] bg-[var(--darkroom-bg)] p-3">
                <Label htmlFor="mobile-style-lib-out" className="text-sm text-[var(--darkroom-text-muted)]">
                  Save render as style reference in library
                </Label>
                <Switch
                  id="mobile-style-lib-out"
                  checked={styleReferenceLibraryOutput}
                  onCheckedChange={onStyleReferenceLibraryOutputChange}
                  disabled={isGenerating || backgroundPlateMode}
                />
              </div>
            ) : null}
          </div>

          {/* Done Button */}
          <Button
            className="w-full mt-4"
            variant="brass"
            onClick={() => setInputsSheetOpen(false)}
          >
            Done
          </Button>
        </div>
      </MobileBottomSheet>

      {/* The viewer shares the same focus trap and scroll handling as settings. */}
      <MobileBottomSheet isOpen={!!fullscreenImage} onClose={() => setFullscreenImage(null)} title="Image preview">
        {fullscreenImage && <div className="space-y-4">
          <img src={fullscreenImage.imageUrl} alt="Generated image" className="max-h-[60dvh] w-full rounded-lg object-contain" />
          <div className="grid grid-cols-3 gap-2">
            <button type="button" className="min-h-12 rounded-lg bg-aged-brass px-3 text-ink-black" onClick={() => { const selected = fullscreenImage; setFullscreenImage(null); onRefineImage(selected); }}>Refine</button>
            <button type="button" className="min-h-12 rounded-lg border border-white/20 px-3" disabled={fullscreenImage.isSaved} onClick={() => onSaveImage(fullscreenImage.id)}>{fullscreenImage.isSaved ? "Saved" : "Save"}</button>
            <button type="button" className="min-h-12 rounded-lg border border-white/20 px-3 text-red-300" onClick={() => {onDeleteImage(fullscreenImage.id); setFullscreenImage(null);}}>Delete</button>
          </div>
        </div>}
      </MobileBottomSheet>

      <ImageLibraryModal
        open={showBackgroundLibrary}
        onOpenChange={setShowBackgroundLibrary}
        onSelectImage={(img) => {
          onBackgroundImageUpload({ url: img.url, name: img.name });
          setShowBackgroundLibrary(false);
          setInputsSheetOpen(false);
        }}
        title="Background scenes"
        libraryTagContainsAny={[LIBRARY_ROLE_BACKGROUND_SCENE, BACKGROUND_SCENE_TAG]}
      />

      <StyleReferenceGuideModal open={styleGuideOpen} onOpenChange={setStyleGuideOpen} />
    </div>
  );
}

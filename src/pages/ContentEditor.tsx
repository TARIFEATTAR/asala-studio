/**
 * ContentEditor Page - Madison Studio
 *
 * Rich text editor page for editing generated content.
 * Now powered by Tiptap for improved editing experience.
 *
 * Features:
 * - Tiptap-based rich text editing
 * - Floating selection toolbar
 * - Slash command support
 * - Madison AI assistant panel
 * - Auto-save functionality
 * - Quality rating system
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Check, Loader2, MessageSquare, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditorialAssistantPanel } from "@/components/assistant/EditorialAssistantPanel";
import QualityRating from "@/components/QualityRating";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useToast } from "@/hooks/use-toast";
import { AutosaveIndicator } from "@/components/ui/autosave-indicator";
import { AUTOSAVE_CONFIG } from "@/config/autosaveConfig";
import { supabase } from "@/integrations/supabase/client";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useOnboarding } from "@/hooks/useOnboarding";
import { MadisonEditor } from "@/components/editor";
import { ImageLibraryPicker } from "@/components/email-composer/ImageLibraryPicker";
import type { JSONContent } from '@tiptap/react';

/**
 * Feature flag for Tiptap editor
 * Set to true to use the new Tiptap-based editor
 * Set to false to use the legacy contentEditable editor
 */
const USE_TIPTAP_EDITOR = true;

export default function ContentEditorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { currentOrganizationId } = useOnboarding();

  /**
   * Invalidate library cache and navigate away
   * This ensures Archives shows fresh data after editing
   */
  const handleExit = useCallback((destination: string = "/") => {
    // Invalidate the library content cache so Archives fetches fresh data
    queryClient.invalidateQueries({ queryKey: ["library-content"] });
    console.log('[ContentEditor] Invalidated library-content cache, navigating to:', destination);
    navigate(destination);
  }, [queryClient, navigate]);

  // Content state
  const [isLoading, setIsLoading] = useState(true);
  const [contentId, setContentId] = useState<string | undefined>(location.state?.contentId);
  const [editableContent, setEditableContent] = useState("");
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState("");
  const [productName, setProductName] = useState("");
  const [featuredImageUrl, setFeaturedImageUrl] = useState("");
  const [category, setCategory] = useState<"master" | "derivative" | "output">(location.state?.category || "master");

  // Editor state
  const [wordCount, setWordCount] = useState(0);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [qualityRating, setQualityRating] = useState(0);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);

  // Store editor JSON content for persistence
  const editorContentRef = useRef<JSONContent | null>(null);
  const plainTextContentRef = useRef<string>("");

  /**
   * Get content for saving - returns plain text
   */
  const getContentForSave = useCallback(() => {
    const content = plainTextContentRef.current || editableContent;
    console.log('[ContentEditor] getContentForSave called, content length:', content?.length, 'preview:', content?.substring(0, 100));
    return content;
  }, [editableContent]);

  // Determine table and field based on category
  const tableName = category === "master"
    ? "master_content"
    : category === "derivative"
    ? "derivative_assets"
    : "outputs";

  const fieldName = category === "master" ? "full_content" : "generated_content";

  // Log for debugging
  console.log('[ContentEditor] Save config:', { category, tableName, fieldName, contentId });

  // Auto-save hook - now uses correct table based on category!
  const { saveStatus, lastSavedAt, forceSave } = useAutoSave({
    content: getContentForSave(),
    contentId,
    contentName: title,
    tableName,
    fieldName,
    delay: AUTOSAVE_CONFIG.AGGRESSIVE_DELAY
  });

  /**
   * Load content on mount
   */
  useEffect(() => {
    const loadContent = async () => {
      console.log("[ContentEditor] Loading content...", {
        hasLocationState: !!location.state,
        content: location.state?.content?.substring(0, 100)
      });

      // Load from navigation state
      // Check if content property exists (even if empty string) to allow new documents
      if (location.state && 'content' in location.state) {
        const content = location.state.content || "";
        console.log("[ContentEditor] Loading from location.state, content length:", content.length, "category:", location.state.category);
        setEditableContent(content);
        plainTextContentRef.current = content;
        setTitle(location.state.contentName || "Untitled Content");
        setContentType(location.state.contentType || "Blog Post");
        setProductName(location.state.productName || "Product");
        setContentId(location.state.contentId);
        setCategory(location.state.category || "master"); // Set category for correct table targeting
        setIsLoading(false);
        return;
      }

      // Load from URL param
      const urlParams = new URLSearchParams(location.search);
      const idFromUrl = urlParams.get('id');
      if (idFromUrl) {
        try {
          const { data, error } = await supabase
            .from('master_content')
            .select('*')
            .eq('id', idFromUrl)
            .single();

          if (error) throw error;

          const content = data.full_content || "";
          setEditableContent(content);
          plainTextContentRef.current = content;
          setTitle(data.title || "Untitled Content");
          setContentType(data.content_type || "Blog Post");
          setContentId(data.id);
          setQualityRating(data.quality_rating || 0);
          setFeaturedImageUrl(data.featured_image_url || "");
          setIsLoading(false);
          return;
        } catch (error) {
          console.error("[ContentEditor] Error loading from DB:", error);
          toast({
            title: "Failed to load content",
            description: "Unable to load content from database. Please try again.",
            variant: "destructive"
          });
        }
      }

      // Load from localStorage backup
      const savedDraft = localStorage.getItem('madison-content-draft');
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          const content = draft.content || "";
          setEditableContent(content);
          plainTextContentRef.current = content;
          setTitle(draft.title || "Untitled Content");
          setContentId(draft.id);
          setIsLoading(false);
          return;
        } catch (error) {
          console.error("[ContentEditor] Error loading from localStorage:", error);
        }
      }

      console.error("[ContentEditor] No content source found");
      toast({
        title: "No content found",
        description: "No content available to edit. Redirecting to content creation...",
        variant: "destructive"
      });
      setTimeout(() => navigate("/create"), 1500);
    };

    loadContent();
  }, [location.state, location.search, navigate, toast]);

  /**
   * Invalidate library cache when component unmounts
   * This ensures Archives shows fresh data when user navigates away (including browser back button)
   */
  useEffect(() => {
    return () => {
      console.log('[ContentEditor] Unmounting - invalidating library-content cache');
      queryClient.invalidateQueries({ queryKey: ["library-content"] });
    };
  }, [queryClient]);

  /**
   * Handle editor content change
   */
  const handleEditorChange = useCallback((json: JSONContent) => {
    editorContentRef.current = json;
  }, []);

  /**
   * Handle editor text change - update word count and plain text
   * IMPORTANT: Also update editableContent state to trigger re-render for auto-save!
   */
  const handleTextChange = useCallback((text: string) => {
    console.log('[ContentEditor] handleTextChange called, text length:', text?.length, 'preview:', text?.substring(0, 100));

    plainTextContentRef.current = text;

    // Update state to trigger re-render so useAutoSave sees the new content
    setEditableContent(text);

    // Calculate word count
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
  }, []);

  /**
   * Handle editor ready
   */
  const handleEditorReady = useCallback(() => {
    setIsEditorReady(true);
  }, []);

  /**
   * Manual save handler - respects category for correct table/field
   */
  const handleSave = async () => {
    const contentToSave = getContentForSave();

    if (contentId) {
      console.log('[ContentEditor] Manual save to:', tableName, fieldName, 'id:', contentId);

      // Build update payload based on category
      const updatePayload: Record<string, any> = {
        [fieldName]: contentToSave,
      };

      // Add quality_rating for master_content
      if (category === 'master') {
        updatePayload.quality_rating = qualityRating > 0 ? qualityRating : null;
        updatePayload.updated_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from(tableName)
        .update(updatePayload)
        .eq('id', contentId)
        .select();

      console.log('[ContentEditor] Manual save response:', { data, error, rowsAffected: data?.length });

      if (error) {
        toast({
          title: "Save failed",
          description: error.message,
          variant: "destructive"
        });
      } else if (!data || data.length === 0) {
        toast({
          title: "Save may have failed",
          description: "No rows were updated. Check permissions.",
          variant: "destructive"
        });
      } else {
        toast({ title: "Saved successfully" });
      }
    } else {
      await forceSave();
      toast({
        title: "Saved",
        description: "Your content has been saved successfully",
      });
    }
  };

  /**
   * Navigate to Multiply page with content
   */
  const handleNextToMultiply = async () => {
    console.log('[ContentEditor] Starting navigation to Multiply');
    console.log('[ContentEditor] Save status before navigation:', saveStatus);

    try {
      // Force save and wait for completion (best-effort)
      if (saveStatus !== "saved") {
        console.log('[ContentEditor] Forcing save before navigation...');
        try {
          await forceSave();
          console.log('[ContentEditor] Save completed');
        } catch (e) {
          console.warn('[ContentEditor] forceSave failed, proceeding with resolve-save fallback:', e);
        }
      }

      const contentToSend = getContentForSave();

      // Ensure we have a contentId - create master_content if needed
      let finalContentId = contentId;

      if (!finalContentId) {
        console.info('[ContentEditor] No contentId - starting resolve-save routine');

        const { data: userData } = await supabase.auth.getUser();

        // Get organization ID using authoritative source
        let orgId = currentOrganizationId;

        if (!orgId) {
          console.info('[ContentEditor] No currentOrganizationId from useOnboarding, fetching from organization_members');
          const { data: orgData } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', userData?.user?.id)
            .limit(1)
            .maybeSingle();

          orgId = orgData?.organization_id || null;
        }

        if (!orgId) {
          console.error('[ContentEditor] Could not determine organization ID');
          toast({
            title: "Error",
            description: "Could not find organization",
            variant: "destructive"
          });
          return;
        }

        console.info('[ContentEditor] Using organization ID:', orgId);

        const normalizedTitle = (title || 'Untitled Content').trim();
        const payload = {
          full_content: contentToSend || '',
          content_type: contentType || 'Content',
          word_count: (contentToSend?.split(/\s+/).filter(Boolean).length) || 0,
          updated_at: new Date().toISOString(),
          ...(qualityRating && { quality_rating: qualityRating })
        };

        // Try to find active row first
        const { data: activeRow, error: activeErr } = await supabase
          .from('master_content')
          .select('id')
          .eq('organization_id', orgId)
          .eq('title', normalizedTitle)
          .eq('is_archived', false)
          .maybeSingle();

        if (activeErr) {
          console.error('[ContentEditor] Error checking for active row:', activeErr);
          toast({
            title: 'Error',
            description: activeErr.message || 'Failed to save content',
            variant: 'destructive',
          });
          return;
        }

        if (activeRow) {
          // Active row exists, update it
          const { error: updateErr } = await supabase
            .from('master_content')
            .update(payload)
            .eq('id', activeRow.id);

          if (updateErr) {
            toast({
              title: 'Error',
              description: updateErr.message || 'Failed to save content',
              variant: 'destructive',
            });
            return;
          }

          finalContentId = activeRow.id;
        } else {
          // Insert new row
          const { data: insertData, error: insertErr } = await supabase
            .from('master_content')
            .insert({
              organization_id: orgId,
              title: normalizedTitle,
              created_by: userData?.user?.id || null,
              ...payload,
              is_archived: false,
              archived_at: null
            })
            .select('id')
            .single();

          if (insertErr) {
            toast({
              title: 'Error',
              description: insertErr.message || 'Failed to save content',
              variant: 'destructive',
            });
            return;
          }

          finalContentId = insertData.id;
        }
      } else {
        // Update existing content
        const payload = {
          full_content: contentToSend || '',
          content_type: contentType || 'Content',
          word_count: (contentToSend?.split(/\s+/).filter(Boolean).length) || 0,
          updated_at: new Date().toISOString(),
          ...(qualityRating && { quality_rating: qualityRating })
        };

        const { error: updateErr } = await supabase
          .from('master_content')
          .update(payload)
          .eq('id', contentId);

        if (updateErr) {
          toast({
            title: 'Error',
            description: updateErr.message || 'Failed to save content',
            variant: 'destructive',
          });
          return;
        }

        finalContentId = contentId;
      }

      // Persist master ID to localStorage for robust tracking
      localStorage.setItem('lastEditedMasterId', finalContentId);
      localStorage.setItem('lastEditedMasterTitle', title);

      navigate(`/multiply?id=${finalContentId}`, {
        state: {
          content: contentToSend,
          title,
          contentType,
          productName,
          contentId: finalContentId
        }
      });
    } catch (error) {
      console.error('[ContentEditor] Error during navigation:', error);
      toast({
        title: "Error",
        description: "Failed to save content before continuing",
        variant: "destructive"
      });
    }
  };

  /**
   * Toggle assistant panel
   */
  const handleToggleAssistant = useCallback(() => {
    setAssistantOpen((prev) => !prev);
  }, []);

  /**
   * Handle featured image change
   */
  const handleFeaturedImageChange = useCallback(async (url: string) => {
    setFeaturedImageUrl(url);

    // Auto-save featured image if we have a contentId
    if (contentId) {
      const { error } = await supabase
        .from('master_content')
        .update({ featured_image_url: url || null } as any)
        .eq('id', contentId);

      if (error) {
        toast({
          title: "Error saving image",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: url ? "Featured image set" : "Featured image removed",
          description: url ? "Your featured image has been saved." : "Featured image cleared.",
        });
      }
    }
  }, [contentId, toast]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your content...</p>
      </div>
    );
  }

  return (
    <div className="mobile-content-editor h-screen flex flex-col overflow-hidden bg-background">
      {/* Top Toolbar - Clean & Minimal */}
      <div className="border-b z-10 flex-shrink-0 bg-card border-border">
        <div className="editor-toolbar flex flex-wrap items-center justify-between px-3 sm:px-4 py-2 gap-2">
          {/* Left: Exit Button */}
          <div className="editor-heading min-w-0 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleExit("/")}
              className="h-8 w-8 p-0"
              title="Exit Editor" aria-label="Exit editor"
            >
              <X className="w-4 h-4" />
            </Button>

            <div className="h-5 w-px bg-border mx-1" />

            {/* Title */}
            <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
              {title}
            </span>
          </div>

          {/* Center: Featured Image & Editorial Assistant */}
          <div className="flex items-center gap-2">
            {/* Featured Image Toggle */}
            <Button
              variant={showImagePicker ? "default" : "ghost"}
              onClick={() => setShowImagePicker(!showImagePicker)}
              className="gap-2 h-8"
              title="Set featured image" aria-label="Set featured image"
            >
              <ImageIcon className="w-4 h-4" />
              <span className="hidden lg:inline">
                {featuredImageUrl ? "Change Image" : "Add Image"}
              </span>
            </Button>

            {/* Editorial Assistant Toggle */}
          <Button
            variant={assistantOpen ? "default" : "ghost"}
            onClick={handleToggleAssistant}
            className="gap-2 h-8 hidden lg:flex"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden xl:inline">Editorial Assistant</span>
            <span className="xl:hidden">Assistant</span>
          </Button>
          </div>

          {/* Right: Word Count, Quality Rating, Save, Next */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Word Count */}
            <span className="hidden sm:block text-xs text-muted-foreground px-1 tabular-nums">
              {wordCount}w
            </span>

            {/* Autosave Indicator */}
            <div className="hidden lg:block">
              <AutosaveIndicator
                saveStatus={saveStatus}
                lastSavedAt={lastSavedAt}
              />
            </div>

            {/* Quality Rating */}
            <div className="hidden xl:block">
              <QualityRating
                rating={qualityRating}
                onRatingChange={setQualityRating}
              />
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={saveStatus === "saving"}
              variant="default"
              className="gap-1 h-8 px-2 sm:px-3"
            >
              {saveStatus === "saving" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saveStatus === "saved" ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span className="text-sm">Save</span>
            </Button>

            {/* Continue to Multiply */}
            <Button
              onClick={handleNextToMultiply}
              disabled={saveStatus === "saving"}
              variant="secondary"
              className="gap-1 h-8 px-2 sm:px-3"
            >
              {saveStatus === "saving" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span className="hidden md:inline text-sm">Continue to Multiply</span>
                  <span className="md:hidden text-sm">Multiply</span>
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Featured Image Picker Panel */}
      {showImagePicker && (
        <div className="border-b border-border bg-card/50 p-4 flex-shrink-0">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ImageIcon className="w-4 h-4 text-primary" />
                Featured Image
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowImagePicker(false)}
                className="h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Current Image Preview */}
            {featuredImageUrl && (
              <div className="mb-3 relative rounded-lg overflow-hidden border border-border max-w-xs">
                <img
                  src={featuredImageUrl}
                  alt="Featured"
                  className="w-full h-32 object-cover"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleFeaturedImageChange("")}
                  className="absolute top-2 right-2 h-6 px-2 text-xs"
                >
                  Remove
                </Button>
              </div>
            )}

            {/* Image Library Picker */}
            <ImageLibraryPicker
              value={featuredImageUrl}
              onChange={handleFeaturedImageChange}
            />

            <p className="text-xs text-muted-foreground mt-2">
              Select an image from your library or paste an image URL. This will be used as the featured/hero image for your blog post.
            </p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0">
        {!isMobile && assistantOpen ? (
          <ResizablePanelGroup direction="horizontal" className="w-full h-full">
            {/* Editor Panel */}
            <ResizablePanel defaultSize={50} minSize={30} maxSize={70}>
              <div className="w-full h-full overflow-auto bg-background">
                <div className="max-w-4xl mx-auto py-6 px-4 md:py-16 md:px-16">
                  {USE_TIPTAP_EDITOR ? (
                    <MadisonEditor
                      initialContent={editableContent}
                      onChange={handleEditorChange}
                      onTextChange={handleTextChange}
                      onReady={handleEditorReady}
                      placeholder="Start writing…"
                      organizationId={currentOrganizationId || undefined}
                      autoFocus={!isMobile}
                    />
                  ) : (
                    // Legacy editor fallback (not shown with USE_TIPTAP_EDITOR = true)
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      className="w-full min-h-[calc(100vh-200px)] focus:outline-none prose prose-lg max-w-none"
                    />
                  )}
                </div>
              </div>
            </ResizablePanel>

            {/* Resizable Handle */}
            <ResizableHandle className="w-1 hover:w-2 transition-all bg-border/20 hover:bg-primary/40" />

            {/* Madison Assistant Panel */}
            <ResizablePanel defaultSize={50} minSize={30} maxSize={70}>
              <div className="w-full h-full bg-card">
                <EditorialAssistantPanel
                  onClose={handleToggleAssistant}
                  initialContent={getContentForSave()}
                />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          /* Full-width editor when assistant is closed */
          <div className="w-full h-full overflow-auto bg-background">
            <div className="max-w-4xl mx-auto py-6 px-4 md:py-16 md:px-16">
              {USE_TIPTAP_EDITOR ? (
                <MadisonEditor
                  initialContent={editableContent}
                  onChange={handleEditorChange}
                  onTextChange={handleTextChange}
                  onReady={handleEditorReady}
                  placeholder="Start writing…"
                  organizationId={currentOrganizationId || undefined}
                  autoFocus={!isMobile}
                />
              ) : (
                // Legacy editor fallback
                <div
                  contentEditable
                  suppressContentEditableWarning
                  className="w-full min-h-[calc(100vh-200px)] focus:outline-none prose prose-lg max-w-none"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile: Bottom drawer assistant */}
      {isMobile && (
        <>
          {/* Floating Madison Button - Mobile Only */}
          {!assistantOpen && (
            <button
              onClick={handleToggleAssistant}
              className="fixed bottom-6 right-6 z-50 group"
              style={{
                width: '64px',
                height: '64px',
                background: 'linear-gradient(135deg, #B8956A 0%, #A3865A 100%)',
                borderRadius: '16px 16px 16px 4px',
                boxShadow: '0 8px 24px rgba(184, 149, 106, 0.4), inset 0 -2px 8px rgba(0, 0, 0, 0.15)',
                border: '2px solid rgba(139, 115, 85, 0.3)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              aria-label="Open Editorial Assistant"
            >
              <div className="relative w-full h-full flex items-center justify-center">
                <span
                  className="font-serif text-3xl font-bold"
                  style={{
                    color: '#FFFCF5',
                    textShadow: '0 2px 4px rgba(0, 0, 0, 0.3), 0 -1px 2px rgba(255, 255, 255, 0.1)',
                    transform: 'translateY(-1px)'
                  }}
                >
                  M
                </span>
              </div>
            </button>
          )}

          <Drawer open={assistantOpen} onOpenChange={setAssistantOpen}>
            <DrawerContent
              className="h-screen max-h-[100dvh] mt-0 rounded-t-none flex flex-col overflow-hidden bg-card"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="flex-1 overflow-hidden">
                <EditorialAssistantPanel
                  onClose={handleToggleAssistant}
                  initialContent={getContentForSave()}
                />
              </div>
            </DrawerContent>
          </Drawer>
        </>
      )}
    </div>
  );
}

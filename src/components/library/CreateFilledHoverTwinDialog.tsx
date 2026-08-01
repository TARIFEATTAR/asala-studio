import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  buildFilledHoverTwinInvocation,
  FILLED_HOVER_TWIN_PARENT_APPROVAL_TAG,
  getFilledHoverTwinParentEligibility,
  type FilledHoverTwinLibraryImage,
} from "@/lib/bestBottlesFilledHoverTwinClient";
import { addLibraryTag } from "@/lib/imageLibraryTags";

type CreateFilledHoverTwinDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  image: FilledHoverTwinLibraryImage | null;
  organizationId: string | null | undefined;
  userId: string | null | undefined;
  reviewedBy: string | null | undefined;
  onChanged: () => Promise<unknown> | unknown;
};

export function CreateFilledHoverTwinDialog({
  open,
  onOpenChange,
  image,
  organizationId,
  userId,
  reviewedBy,
  onChanged,
}: CreateFilledHoverTwinDialogProps) {
  const { toast } = useToast();
  const [parentApprovalConfirmed, setParentApprovalConfirmed] = useState(false);
  const [approved, setApproved] = useState(false);
  const [maskFile, setMaskFile] = useState<File | null>(null);
  const [maskReviewed, setMaskReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    imageUrl?: string;
    reviewStatus?: string;
  } | null>(null);

  const eligibility = useMemo(
    () => image ? getFilledHoverTwinParentEligibility(image) : null,
    [image],
  );
  const maskPreviewUrl = useMemo(
    () => maskFile ? URL.createObjectURL(maskFile) : null,
    [maskFile],
  );

  useEffect(() => {
    return () => {
      if (maskPreviewUrl) URL.revokeObjectURL(maskPreviewUrl);
    };
  }, [maskPreviewUrl]);

  useEffect(() => {
    setApproved(Boolean(eligibility?.approved));
    setParentApprovalConfirmed(false);
    setMaskFile(null);
    setMaskReviewed(false);
    setResult(null);
  }, [image?.id, eligibility?.approved]);

  const approveParent = async () => {
    if (!image || !eligibility?.eligible || !parentApprovalConfirmed) return;
    setBusy(true);
    try {
      const next = await addLibraryTag(image.id, FILLED_HOVER_TWIN_PARENT_APPROVAL_TAG);
      if (!next) throw new Error("Parent approval tag could not be saved.");
      setApproved(true);
      setParentApprovalConfirmed(false);
      await onChanged();
      toast({
        title: "Marketing parent approved",
        description: "This approval applies only to the filled-hover pilot; it is not PDP approval.",
      });
    } catch (error) {
      toast({
        title: "Could not approve parent",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const createTwin = async () => {
    if (!image || !organizationId || !userId || !reviewedBy || !maskFile || !maskReviewed) return;
    if (maskFile.type !== "image/png") {
      toast({ title: "PNG mask required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const storagePath =
        `${userId}/filled-hover-masks/${image.id}/${crypto.randomUUID()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("reference-images")
        .upload(storagePath, maskFile, { contentType: "image/png", upsert: false });
      if (uploadError) throw uploadError;
      const maskImageUrl = supabase.storage.from("reference-images")
        .getPublicUrl(storagePath).data.publicUrl;
      const invocation = buildFilledHoverTwinInvocation({
        image: {
          ...image,
          libraryTags: Array.from(new Set([
            ...image.libraryTags,
            FILLED_HOVER_TWIN_PARENT_APPROVAL_TAG,
          ])),
        },
        organizationId,
        maskImageUrl,
        reviewedBy,
      });
      const { data, error } = await supabase.functions.invoke(
        invocation.functionName,
        { body: invocation.body },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data ?? null);
      await onChanged();
      toast({
        title: data?.reviewStatus === "review-pending"
          ? "Filled twin saved for review"
          : "Filled twin rejected by pair QA",
        description: "The result remains library-only and cannot publish automatically.",
        variant: data?.reviewStatus === "review-pending" ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Filled twin generation failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (!image || !eligibility) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-[var(--darkroom-surface)] text-[var(--darkroom-text)]">
        <DialogHeader>
          <DialogTitle>Create Filled Hover Twin</DialogTitle>
          <DialogDescription>
            Marketing-only pilot for GB-CYL-CLR-9ML-ROL-BKDT-02. The parent is submitted once to GPT Image 2; only transparent mask pixels may change.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Approved empty parent</Label>
            <div className="relative aspect-[10/11] overflow-hidden rounded-lg border border-white/10 bg-black/20">
              <img src={image.imageUrl} alt="Empty marketing parent" className="h-full w-full object-contain" />
            </div>
            {!approved ? (
              <div className="space-y-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs">
                <label className="flex items-start gap-2">
                  <Checkbox
                    checked={parentApprovalConfirmed}
                    onCheckedChange={(value) => setParentApprovalConfirmed(value === true)}
                  />
                  <span>I approve this exact scene as the empty marketing parent. This does not approve or replace a PDP image.</span>
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!parentApprovalConfirmed || busy}
                  onClick={() => void approveParent()}
                >
                  Approve parent for pilot
                </Button>
              </div>
            ) : (
              <p className="text-xs text-emerald-300">Marketing-parent approval is durably recorded.</p>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="filled-hover-mask">Reviewed interior cavity mask</Label>
              <Input
                id="filled-hover-mask"
                type="file"
                accept="image/png"
                disabled={!approved || busy}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setMaskFile(file);
                  setMaskReviewed(false);
                  setResult(null);
                }}
              />
              <p className="mt-1 text-[11px] text-white/55">The PNG must exactly match the parent dimensions. Transparent pixels define the bottle’s editable internal cavity.</p>
            </div>

            {maskPreviewUrl && (
              <div className="relative aspect-[10/11] overflow-hidden rounded-lg border border-white/10 bg-[repeating-conic-gradient(#333_0_25%,#222_0_50%)_50%/16px_16px]">
                <img src={image.imageUrl} alt="Parent beneath cavity mask" className="absolute inset-0 h-full w-full object-contain opacity-45" />
                <img src={maskPreviewUrl} alt="Reviewed cavity mask overlay" className="absolute inset-0 h-full w-full object-contain opacity-70" />
              </div>
            )}

            <div className="rounded-lg border border-white/10 bg-black/15 p-3 text-xs">
              <p><strong>Liquid:</strong> warm translucent amber</p>
              <p><strong>Fill:</strong> 70% ±3%</p>
              <p><strong>Provider:</strong> GPT Image 2 masked edit</p>
              <p><strong>Budget:</strong> maximum two filled attempts for this parent</p>
            </div>

            <label className="flex items-start gap-2 text-xs">
              <Checkbox
                checked={maskReviewed}
                disabled={!maskFile || !approved || busy}
                onCheckedChange={(value) => setMaskReviewed(value === true)}
              />
              <span>I reviewed the overlay: transparency covers only the internal cavity and excludes the silhouette, cap, roller, base exterior, platform, background, and shadow.</span>
            </label>

            {result?.imageUrl && (
              <a href={result.imageUrl} target="_blank" rel="noreferrer" className="text-sm text-[var(--darkroom-accent)] underline">
                Open {result.reviewStatus === "review-pending" ? "review-pending" : "rejected"} child
              </a>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Close
          </Button>
          <Button
            type="button"
            onClick={() => void createTwin()}
            disabled={!approved || !maskFile || !maskReviewed || !organizationId || !userId || !reviewedBy || busy}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate one paid filled twin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

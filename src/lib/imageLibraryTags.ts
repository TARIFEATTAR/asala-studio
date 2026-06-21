/**
 * Client-side helpers for the `library_tags` column on `generated_images`.
 *
 * Durable image curation — today we ship "hero" tagging (featured render
 * for a SKU or variation family) but the column is intentionally generic so
 * future curation states ("client-approved", "published", "archived") can
 * be added without another migration.
 *
 * Contract with the DB:
 *   • `library_tags` is a non-null TEXT[] defaulting to an empty array
 *   • a GIN index supports fast array-containment queries
 *   • RLS on `generated_images` already scopes reads/writes by org + user,
 *     so these helpers rely on the standard authenticated Supabase client
 */

import { supabase } from "@/integrations/supabase/client";
import { BEST_BOTTLES_STATUS_TAG_APPROVED_KEEP } from "./bestBottlesImageCoverage";

// Supabase's generated types derive from the deployed schema, so until the
// 20260422010000_library_tags_column migration is applied AND types are
// regenerated (`supabase gen types typescript …`), the `library_tags`
// column won't appear in the Database type. The `anyClient` cast below
// sidesteps that narrow window without loosening types anywhere else in
// the app. Once types are regenerated this cast becomes a no-op and can
// be removed safely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyClient = supabase as any;

export const HERO_TAG = "hero" as const;

/**
 * Stamped on images generated in Dark Room “background plate” mode so they
 * appear when choosing a scene from the library for Background Scene compositing.
 */
export const BACKGROUND_SCENE_TAG = "kind:darkroom-background-scene" as const;

/**
 * Library browsing roles — mutually exclusive primary bucket per generated asset.
 * Used by Image Library filters and Dark Room “pick from library” queries.
 */
export const LIBRARY_ROLE_PRODUCT = "role:product-image" as const;
export const LIBRARY_ROLE_BACKGROUND_SCENE = "role:background-scene" as const;
export const LIBRARY_ROLE_STYLE_REFERENCE = "role:style-reference" as const;

export type LibraryTag =
  | typeof HERO_TAG
  | typeof BACKGROUND_SCENE_TAG
  | typeof LIBRARY_ROLE_PRODUCT
  | typeof LIBRARY_ROLE_BACKGROUND_SCENE
  | typeof LIBRARY_ROLE_STYLE_REFERENCE
  | (string & {});

// ────────────────────────────────────────────────────────────────────────────
// Single-image helpers

/**
 * Add a tag to an image's library_tags if not already present. Returns the
 * updated tag array or null on failure.
 */
export async function addLibraryTag(
  imageId: string,
  tag: LibraryTag,
): Promise<string[] | null> {
  const current = await fetchTagsById(imageId);
  if (current === null) return null;
  if (current.includes(tag)) return current;
  const next = [...current, tag];
  const { error } = await anyClient
    .from("generated_images")
    .update({ library_tags: next })
    .eq("id", imageId);
  if (error) {
    console.error("[imageLibraryTags] addLibraryTag failed", error);
    return null;
  }
  return next;
}

/**
 * Remove a tag from an image's library_tags. No-op if it wasn't set.
 * Returns the updated tag array or null on failure.
 */
export async function removeLibraryTag(
  imageId: string,
  tag: LibraryTag,
): Promise<string[] | null> {
  const current = await fetchTagsById(imageId);
  if (current === null) return null;
  if (!current.includes(tag)) return current;
  const next = current.filter((t) => t !== tag);
  const { error } = await anyClient
    .from("generated_images")
    .update({ library_tags: next })
    .eq("id", imageId);
  if (error) {
    console.error("[imageLibraryTags] removeLibraryTag failed", error);
    return null;
  }
  return next;
}

/**
 * Toggle a tag on an image. Returns the updated tag array, the new boolean
 * presence state, or null on failure.
 */
export async function toggleLibraryTag(
  imageId: string,
  tag: LibraryTag,
): Promise<{ tags: string[]; active: boolean } | null> {
  const current = await fetchTagsById(imageId);
  if (current === null) return null;
  const isActive = current.includes(tag);
  const next = isActive ? current.filter((t) => t !== tag) : [...current, tag];
  const { error } = await anyClient
    .from("generated_images")
    .update({ library_tags: next })
    .eq("id", imageId);
  if (error) {
    console.error("[imageLibraryTags] toggleLibraryTag failed", error);
    return null;
  }
  return { tags: next, active: !isActive };
}

// Convenience wrappers for the most common tag.
export const markImageAsHero = (id: string) => addLibraryTag(id, HERO_TAG);
export const unmarkImageAsHero = (id: string) => removeLibraryTag(id, HERO_TAG);
export const toggleImageHero = (id: string) => toggleLibraryTag(id, HERO_TAG);

/**
 * Stamp the axis-2 quality verdict `status:approved-keep` on an approved Best
 * Bottles image so the pipeline completeness metric and any quality filter read
 * the approval from the durable tag (not a stale export). Best-effort and
 * idempotent — a no-op if the id is blank or the tag is already present, and it
 * never throws, so it can be awaited inside an approval flow without risking the
 * primary status write.
 */
export async function markBestBottlesImageApprovedKeep(
  imageId: string | null | undefined,
): Promise<string[] | null> {
  const id = imageId?.trim();
  if (!id) return null;
  return addLibraryTag(id, BEST_BOTTLES_STATUS_TAG_APPROVED_KEEP);
}

// ────────────────────────────────────────────────────────────────────────────
// Batch helpers

/**
 * Fetch the library_tags for a batch of image IDs. Returns a map keyed by
 * image id. Unknown ids are omitted from the result rather than mapped to
 * an empty array — callers can default to [] as needed.
 */
export async function fetchTagsByIds(
  imageIds: string[],
): Promise<Record<string, string[]>> {
  if (imageIds.length === 0) return {};
  const { data, error } = await anyClient
    .from("generated_images")
    .select("id, library_tags")
    .in("id", imageIds);
  if (error) {
    console.error("[imageLibraryTags] fetchTagsByIds failed", error);
    return {};
  }
  const out: Record<string, string[]> = {};
  for (const row of data ?? []) {
    if (row.id) out[row.id as string] = (row.library_tags as string[]) ?? [];
  }
  return out;
}

/** Returns the set of image IDs (from the provided list) that are heroes. */
export async function getHeroIdSet(imageIds: string[]): Promise<Set<string>> {
  const tags = await fetchTagsByIds(imageIds);
  const set = new Set<string>();
  for (const [id, ts] of Object.entries(tags)) {
    if (ts.includes(HERO_TAG)) set.add(id);
  }
  return set;
}

// ────────────────────────────────────────────────────────────────────────────
// Internal

async function fetchTagsById(imageId: string): Promise<string[] | null> {
  const { data, error } = await anyClient
    .from("generated_images")
    .select("library_tags")
    .eq("id", imageId)
    .maybeSingle();
  if (error) {
    console.error("[imageLibraryTags] fetchTagsById failed", error);
    return null;
  }
  return (data?.library_tags as string[]) ?? [];
}

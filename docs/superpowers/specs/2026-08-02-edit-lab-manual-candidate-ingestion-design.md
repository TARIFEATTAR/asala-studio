# Edit Lab Manual Candidate Ingestion

**Status:** Approved design

**Date:** 2026-08-02

**Scope:** CYL-9ML plastic and metal roller candidate uploads from Desktop and Image Library

## Purpose

Make Desktop upload and Image Library selection two entrances to one deterministic Production Candidate Bench workflow. A transparent roller asset must become a reviewable, versioned candidate fitted to the selected component's registered authority mask. Uploading, fitting, or previewing a candidate must not mutate the authority mask, the selected parent component version, active release membership, or Sanity.

## Decision

Use server-side alpha-bounds normalization followed by the existing authority-mask clamp.

The browser sends the original bytes and exact source name. Private storage remains content-addressed by SHA-256. The worker discovers the uploaded image's non-transparent bounds, scales those bounds uniformly to fit inside the selected component's authority-mask bounds, centers the result, and clamps every output pixel to the binary authority mask. The resulting pixels—not a browser-only preview transform—form the immutable candidate.

This is preferred over client-only canvas placement because deterministic server processing produces reproducible pixels, consistent QA evidence, and an auditable candidate regardless of browser size. Re-rendering uploads through Blender is intentionally excluded: these uploads are already visual source assets and only require deterministic normalization and masking.

## User flow

1. The operator selects the plastic roller or metal roller component in Edit Lab.
2. The operator chooses **Upload from computer** or **Choose from Image Library**.
3. Both entry points produce the same manual-candidate input and preserve the source asset's exact filename for display and history.
4. The candidate job is queued against the selected component version and its registered authority mask.
5. The worker fits the uploaded visible pixels to the authority bounds, applies the edit mask, clamps to authority alpha, and records normalization evidence.
6. When processing completes, Edit Lab mounts the candidate over the selected bottle for inspection.
7. The operator may reject it or explicitly approve it after blocking QA passes.
8. Approval creates an approved child component version. It does not edit the parent, authority mask, five locked body plates, active release, or Sanity.
9. The approved component can subsequently be assembled against all five locked body plates. Plastic and metal roller versions never share candidate history or authority identity.

## Immutable provenance

The manual upload reference stores:

- the content-addressed private bucket and object path;
- SHA-256, content type, and byte size;
- the exact original `File.name`, including case, spaces, and extension.

The source name is inert metadata. Desktop filenames and Image Library display names—including names containing `/` or `\\`—are preserved exactly. They never participate in an object path, URL, filesystem operation, or lookup; storage remains SHA-addressed. Control characters and names longer than 255 characters still fail closed. The existing database trigger that prevents updates to `manual_output_ref` protects the name together with the asset identity. Candidate-history responses expose this reference so the UI can display it for queued, failed, ready, approved, and rejected attempts.

Image Library assets use their downloaded file name through the same contract. Desktop uploads preserve the browser-provided `File.name` exactly. The API validates a bounded non-empty string and rejects control characters without rewriting accepted names.

## Placement algorithm

For a manual candidate only:

1. Decode the uploaded image to RGBA without resizing it to the release canvas.
2. Find the bounding rectangle containing pixels with non-zero alpha.
3. Reject an image with no non-transparent pixels.
4. Find the selected component authority mask's exact binary-alpha bounds on the 2080×2288 release canvas.
5. Calculate one uniform contain scale:

   `min(authorityWidth / visibleWidth, authorityHeight / visibleHeight)`

6. Resize the visible rectangle with that uniform scale, preserving aspect ratio.
7. Center it within the authority bounds and composite it onto a transparent 2080×2288 canvas.
8. Apply the edit mask and binary authority clamp. Pixels outside authority are transparent.
9. Record source dimensions, visible bounds, authority bounds, output dimensions, offsets, and equal X/Y scale values in candidate metadata.

The candidate is not described as geometry locked merely because it was fitted to the bounds. Geometry lock is awarded only after the exact server-side authority-mask alpha verification succeeds.

Authority topology is also fail-closed. A closure authority mask must be one 8-connected silhouette before clamping can earn geometry lock. This gate was calibrated against the uploaded v02 plastic roller (one connected component) and the revoked registered mask `d2d1bd4a…` (15 components: the closure plus 14 detached islands). The revoked SHA remains immutable in history but cannot queue another candidate or be approved in the workbench.

## Component and release boundaries

- Plastic and metal rollers have independent component IDs, parent version IDs, authority-mask references, requirements, jobs, QA, and histories.
- A manual candidate always targets the component selected when the job is created.
- Changing the selected bottle changes only assembly context and preview; it does not retarget the candidate.
- Candidate creation and approval are append-only operations.
- Candidate approval creates an approved child but does not modify active release membership.
- Applying an approved roller across the five bodies is an assembly/release-building action after approval, not an upload side effect.
- Sanity publication remains a separate, gated action.

## Failure handling

- Empty files and fully transparent images fail before candidate approval.
- Invalid or unavailable Image Library downloads show an explicit error and create no job.
- Upload or queue failures leave the selected authority and active release untouched.
- Non-binary authority masks fail geometry verification instead of being guessed or thresholded.
- Opaque backgrounds count as visible pixels; this workflow does not silently remove backgrounds.
- A failed signed candidate preview remains visible in immutable history with its original filename and status.

## Focused verification

Tests must prove:

- exact filename preservation through browser request, shared API parser, immutable database payload, repository parser, and history display;
- Desktop and Image Library inputs use the same manual-candidate queue path;
- transparent padding does not affect fitted placement;
- visible pixels are uniformly contained and centered inside calibrated authority bounds;
- no asymmetric or full-canvas stretch occurs;
- fully transparent input is rejected;
- authority-mask bytes and references are unchanged;
- candidate creation and approval do not alter active release membership;
- plastic and metal histories remain isolated by component ID;
- a completed manual candidate appears in Edit Lab without being displaced by a newer queued attempt.

## Pull-request boundary

The pull request includes the shared manual asset contract, API parsing and persistence, deterministic worker normalization, candidate-history display, focused tests, and any narrowly required migration or generated database typing. It does not add live Sanity publication, automatically alter release membership, replace the five locked body plates, or redesign the wider Studio.

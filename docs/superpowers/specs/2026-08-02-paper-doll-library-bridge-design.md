# Paper Doll Image Library Bridge

## Purpose

Let an operator take an existing or newly uploaded Image Library asset through Darkroom cleanup and place it into a Paper Doll production candidate without managing local file paths or duplicating assets.

## Primary flow

1. In a Paper Doll Edit Lab, **Upload** offers **From computer** and **From Image Library**.
2. The library picker inherits the active bench context: family, slot, variant, and component version.
3. The operator confirms that prefilled target, optionally adjusts placement, then queues a manual candidate.
4. The source library asset and any Darkroom-derived asset remain immutable and traceable.
5. A candidate does not replace the released component or publish to Sanity. Only explicit approval can promote it.

## Escape hatch for new components

From Image Library or Darkroom, **Send to Paper Doll** opens a handoff.

- If launched from a bench, it shows the inherited target for confirmation.
- If launched without a bench, the operator chooses **New component**, supplies a display name, selects body, roller, cap, or overcap, and supplies the relevant family, fitment, material, and color details.
- The result is a draft component/candidate only. It cannot enter an active release until it has required geometry-mask, placement, QA, and approval evidence.

## Data and safety boundaries

- Library records are canonical source records; Darkroom outputs are derived versions linked to their source.
- Paper Doll candidates store the selected library/derived asset reference plus original filename and display name for review clarity.
- Direct computer upload remains supported as a fallback and follows the same candidate contract.
- The UI must label source, candidate, queued work, and active release distinctly. A queued generation may not displace a ready manual candidate in the inspector.

## Failure handling

- Missing or non-transparent assets are accepted as sources but are clearly flagged before candidate approval.
- Unavailable signed previews do not hide candidate history.
- If a target cannot be inferred, the handoff requires explicit component setup rather than guessing.
- Upload, library selection, candidate review, approval, and Sanity publication each report independent success or failure; no step silently promotes another.

## Acceptance criteria

- A cleaned library asset can be selected in Edit Lab without downloading it locally.
- The current CYL-9ML plastic roller bench pre-fills its roller/plastic context and displays the chosen asset name.
- A new cap can be created from a library asset through the New Component path.
- Every flow produces a review-only candidate; active release and Sanity remain unchanged until approval.
- Candidate history reliably shows ready manual candidates ahead of later queued attempts and retains history when preview signing fails.

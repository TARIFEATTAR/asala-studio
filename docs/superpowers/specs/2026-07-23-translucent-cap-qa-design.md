# Translucent Detached-Cap QA Design

Date: 2026-07-23

## Context

The 9 ml Cobalt Cylinder fine-mist renders use the correct SKU identity, canonical dimensions, immutable sidecar reference, and measured cap proportion prompt lock. Their primary bottle framing passes.

The new detached-cap geometry gate falsely rejects translucent plastic overcaps after rig cleanup. The cleanup can remove background-like interior pixels from a translucent cap, leaving only a narrow edge component for measurement. This produced implausible failures such as `123.7%` aspect-ratio drift even though the raw red-cap render measured about `10.3%` drift and remained close to the source visually.

The repository already classifies sidecar caps by solid-foreground fraction for deterministic cap splicing. A foreground fraction below `0.35` is established as translucent and unsuitable for solid-pixel treatment.

## Decision

Reuse the existing sidecar foreground-fraction classification to select detached-cap QA enforcement:

- Opaque cap (`foregroundFraction >= 0.35`): keep strict detached-cap geometry blocking at the current `±8%` aspect-ratio and `±3` percentage-point relative-height limits.
- Translucent cap (`foregroundFraction < 0.35`): keep the measured cap proportions in the generation prompt, calculate geometry QA when possible, but treat the result as advisory and do not add its failures to blocking rig QA issues.
- Unresolved classification: fail closed to the existing strict behavior unless no reference cap metrics can be measured, preserving the current best-effort fallback.

This does not change canonical measurements, SKU identity, reference selection, component topology, bottle framing, or Shopify/pipeline behavior.

## Data Flow

1. Load the exact byte-verified product reference once.
2. Measure primary bottle and detached-cap proportions as today.
3. Extract the reference-sidecar cap using the existing detector and read its `foregroundFraction`.
4. Resolve detached-cap enforcement as `strict` or `advisory`.
5. Append the measured cap lock to the prompt in both modes.
6. Pass the enforcement mode with the expected cap metrics into rig normalization.
7. Always return the detached-cap geometry report when metrics exist.
8. Add detached-cap failures to blocking `qaIssues` only in strict mode.

## Error Handling

- A malformed opaque cap must still fail.
- A translucent cap must not be rejected solely because post-rig measurement fragments its background-like interior.
- Bottle framing, aspect, baseline, topology, and other QA failures remain blocking.
- The generated image is not automatically approved or pushed; it still enters the normal human review and reconciliation flow.

## Tests

Add regression coverage before implementation:

1. A translucent reference classification resolves to advisory enforcement.
2. Advisory detached-cap geometry can report large drift without adding a blocking rig QA issue.
3. An opaque reference classification remains strict.
4. Strict mode continues to reject the existing synthetic stretched-cap case.
5. Real red and shiny-silver reference fixtures classify as translucent.
6. Existing rig, prompt, and opaque sidecar tests remain green.

## Success Criteria

- The red and shiny-silver 9 ml Cobalt fine-mist attempts are no longer blocked solely by fragmented translucent-cap geometry.
- The measured prompt lock remains present.
- Opaque detached-cap regressions remain blocked at current tolerances.
- No canonical truth, tracker, Shopify, or database contract is weakened.

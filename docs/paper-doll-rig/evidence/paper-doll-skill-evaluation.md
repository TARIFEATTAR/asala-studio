# Paper-doll production skill evaluation

## RED baseline: observed project behavior without the skill

The baseline is not hypothetical. The CYL-9ML closure rebirth recorded these failures:

- 23 visually plausible generated closures diverged into different geometry: 71% aspect spread and worst silhouette IoU 0.3475 against 0.985 required.
- A QA pass measured the image frame instead of the object and reported clean numbers.
- Reference-anchored generations were described as locked despite having no exact mask clamp.
- Fixed thresholds produced confident errors across materials and shapes.
- Rhinestone generation did not preserve per-stone placement.
- Upload and approval paths previously blurred candidate, authority, Current Release, and publication state.

Source: `docs/paper-doll-rig/CLOSURE-REBIRTH-RESEARCH-HANDOFF.md` and the implemented regression tests.

## GREEN checks with the skill

The skill and deterministic wrappers require a future-family run to:

- keep four distinct bounding boxes;
- distinguish CAD/photo authority from generated material evidence;
- require exact alpha before claiming geometry lock;
- preserve deterministic rhinestone IDs and positions;
- stop at each named approval;
- separate release cut, Sanity draft, and public publication;
- report missing ledger state rather than inventing completion.

Validation uses the official skill validator plus executable manifest/status wrappers. A fresh subagent pressure test was not run because this session disallows subagent delegation; the existing measured failures supply the RED evidence, and the final wrapper outputs supply deterministic GREEN coverage.

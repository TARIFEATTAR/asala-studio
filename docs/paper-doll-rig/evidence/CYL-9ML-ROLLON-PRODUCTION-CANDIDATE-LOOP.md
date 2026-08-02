# CYL-9ML Roll-On Production Candidate Loop

**Evidence date:** 2026-08-02

**Scope:** private CYL-9ML roll-on release draft, five-body lineup, candidate workbench, and publication lock

## Verdict

The production candidate loop is operational and fail-closed. The five locked body plates are registered in a new private release draft, the UI renders them as one catalog lineup, the Assembly/Edit canvas is scrollable, and no Sanity publication occurred.

The family is not release-ready. The draft correctly remains `blocked` because the ten overcaps and both roller requirements do not yet have exact approved inventory versions. The defective metal roller remains rejected at `72.9467%` opaque white junk.

## Registered private draft

| Field | Verified value |
|---|---|
| Release ID | `613b5a21-c4b8-4058-9b81-ab18d1094e03` |
| Family | `CYL-9ML` |
| Version | `1.0.0-rollon-draft.1` |
| Status | `blocked` |
| Manifest SHA-256 | `9d781b30d18bc8216c97542dfdf3d6dac8ec6bd7c27c8f7ea67ffb825b477c7d` |
| Source commit | `12e23d9008231f37e0706da68eea4868b5603f31` |
| Requirements SHA-256 | `3e8eef9471bc9b635fdaefb18c0b72165b214efde86a2936f407c6ab569ca331` |
| Renderer | `cyl9-rollon-blender-v1` |
| Geometry recipe SHA-256 | `5ed7917a5d27edb2e95820893be91422dde7ca59fca58e2fd36367f842681550` |
| Canvas | `2080×2288` |
| Sanity publish runs | `0` |

The builder downloaded and rehashed all five private objects before registration. A second registration of the same version returned `created: false` with the same release ID and manifest SHA, proving the operation is idempotent.

## Denominator reconciliation

The requirement snapshot contains 17 unique component requirements and 100 exact catalog assembly mappings.

| State | Count |
|---|---:|
| Required | 17 |
| Approved and included | 5 |
| Explicitly blocked | 1 |
| Missing approved inventory version | 11 |

`approved + blocked + missing = required` (`5 + 1 + 11 = 17`). No missing requirement is represented as complete.

## Exact release membership

Only the five locked body versions are members of this draft:

| Slot | Variant | Component version ID |
|---|---|---|
| body | `CLR` | `20594dc6-e7e9-4c84-8904-e3e38c3c5a1a` |
| body | `AMB` | `a8afb0f2-0746-4688-9194-a377c3382532` |
| body | `BLU` | `8f00c3a4-267f-4846-aaa0-4b16048218c4` |
| body | `FRS` | `dc1a0d63-ac0c-47b8-bc48-54173a551572` |
| body | `SWL` | `b1b4bc9b-fe5c-4fb5-87c8-ec34784b1001` |

No cap, roller, sprayer, pump, translucent component, candidate, or fallback asset is a release member.

## Browser verification

Verified in the signed local Studio route without `paperDollPreview=1`:

- Compose loads the live private ledger version and manifest SHA.
- The five locked body plates appear together in the baseline-alignment sequence.
- The five-body catalog lineup renders Clear, Amber, Cobalt, Frosted, and Swirl in one row.
- The lineup reports `0/5 complete · PLASTIC + SHN-SL`; every card identifies the exact missing roller and overcap instead of rendering a fallback.
- Candidate controls remain disabled for locked body plates and state that locked plates cannot become generation sources.
- The inspector states that geometry lock is not earned without exact server-side authority-mask alpha identity.
- The workbench states `Candidate-only writes · active release unchanged · no Sanity publication`.

## Scrollable canvas verification

The Assembly/Edit canvas is contained by a labeled scroll viewport with `overflow: auto` and a bounded height. Browser measurements proved real overflow rather than a decorative scrollbar:

- At 100% zoom, content height was `730px` inside a `502px` viewport.
- At 140% zoom, content was `1061×1168px` inside a `758×502px` viewport, enabling both horizontal and vertical scrolling.
- Plain wheel input scrolls; `Ctrl`/`Command` + wheel zooms; `Alt` + drag pans by changing scroll offsets.

## Safety checks

- Registration uses a service-role-only atomic RPC; `anon` and `authenticated` cannot execute it.
- Re-registration verifies manifest identity and performs no mutation.
- `paper_doll_publish_runs` contains zero rows for this release.
- Supabase's post-migration security advisor reports no Paper-Doll findings.
- Performance advisor findings are pre-existing index/RLS optimization notices; the release-registration function introduced no new security finding.

## Remaining blockers

1. Register and qualify the plastic roller as a private approved component version.
2. Repair the metal roller from a real ML-matted transparent source and requalify it; the Yaps engine was unavailable in this run, so no replacement asset was fabricated.
3. Complete named visual approval for all ten opaque overcaps after assembly-context review.
4. Add only approved exact versions to a subsequent release draft and rerun the five-body lineup.
5. Keep Sanity publication locked until the draft becomes `ready` and receives named approval.

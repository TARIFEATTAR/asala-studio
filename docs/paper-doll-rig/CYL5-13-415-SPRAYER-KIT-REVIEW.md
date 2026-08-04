# CYL-5ML 13-415 Sprayer Kit Review

**State:** source extraction and exact-alpha head review complete; named geometry and family-fit review required
**Scope:** review artifacts only; no approval, placement, release, Supabase, or Sanity writes

## What the source estate proves

The 13-415 fine-mist system is not one flat reusable plate. It contains three physical responsibilities:

1. `sprayer-head-and-collar` — reusable exterior component plate
2. `opaque-protective-overcap` — reusable, independently selectable opaque cap plate
3. `sprayer-dip-tube` — body-contextual internal delivery layer, clipped and welded per compatible bottle body

The source images also contain the bottle body, but that body remains registration evidence only. The paper-doll body authority continues to come from the bottle rig/body review lane.

The decomposition contract is recorded in `sprayer-13-415-component-kit-decomposition.json`.

## Source-backed coverage

- Eight immutable component PSDs provide the head/collar finishes: matte black, matte copper, glossy black, matte blue, mirror gold, matte gold, matte silver, and mirror silver.
- Seven clear 5 mL assembly PSDs provide separated opaque caps and dip tubes for every finish except matte copper.
- The matte-copper assembly is currently represented only by a low-resolution catalog composite. It is source evidence, not a production cap or tube plate.
- The existing matte-gold head export remains preserved at its recorded SHA-256 and was previously reviewed by Jordan. Its approval is treated as appearance/silhouette evidence, not automatically as a named geometry authority.

## Alpha calibration

The approved matte-gold export contains one real connected sprayer object plus 28 detached alpha-pollution islands. The calibrated cleanup retains the 422,143-pixel main object and discards 519 total pollution pixels; the largest discarded island is 37 pixels.

The eight PSD scene cleanups are individually calibrated to their immutable source SHA-256 values. No universal alpha threshold or fixed component count is assumed across files.

After cleanup, all eight head material candidates copy one exact centered authority-review alpha on the 2080×2288 canvas:

- candidate count: 8
- exact alpha across candidates: yes
- geometry locked: no
- production eligible: no
- next gate: named geometry/profile review, then family fit on compatible bodies

## Review artifacts

- Exact-alpha head candidates: `outputs/paper-doll-component-authority-reviews/sprayer-13-415/head-authority-v1/`
- Head contact sheet: `outputs/paper-doll-component-authority-reviews/sprayer-13-415/head-authority-v1/contact-sheet.png`
- Responsibility extraction manifest: `outputs/paper-doll-component-kit-reviews/13-415-sprayer/source-extraction-v1/manifest.json`
- Head source sheet: `outputs/paper-doll-component-kit-reviews/13-415-sprayer/source-extraction-v1/sprayer-head-and-collar/contact-sheet.png`
- Opaque-cap source sheet: `outputs/paper-doll-component-kit-reviews/13-415-sprayer/source-extraction-v1/opaque-protective-overcap/contact-sheet.png`
- Dip-tube source sheet: `outputs/paper-doll-component-kit-reviews/13-415-sprayer/source-extraction-v1/sprayer-dip-tube/contact-sheet.png`
- Exact-alpha opaque-overcap review: `outputs/paper-doll-component-authority-reviews/sprayer-13-415/opaque-overcap-v1/`
- Opaque-overcap contact sheet: `outputs/paper-doll-component-authority-reviews/sprayer-13-415/opaque-overcap-v1/contact-sheet.png`
- Source-body tube registration: `outputs/paper-doll-component-kit-reviews/13-415-sprayer/tube-registration-v1/manifest.json`

The seven opaque-overcap candidates now share byte-identical review alpha. This is a named profile-review set, not an approved authority. Matte copper remains absent because there is no equivalent layered 5 mL overcap source.

All seven layered assemblies preserve the same tube registration relative to their 218×636 px source body: x offset 89 px, y offset 105 px, width 60 px, and height 463 px. This proves a repeatable source relationship. It does not authorize a target-body weld because the current 53×17 mm body remains `named-geometry-review-required`.

## Required next work

1. Obtain named approval of the clean head authority profile.
2. Fit the head/collar onto the reviewed 53×17 mm 5 mL body without changing the body authority.
3. Obtain named approval of the opaque-overcap review profile; keep matte copper incomplete until equivalent source evidence exists.
4. Approve the 53×17 mm target body authority, then map the confirmed source-body tube registration into explicit immutable target-body jobs. Never flatten a tube into a global reusable plate.
5. Review open and capped assemblies separately. A future translucent overcap must use a compound closed-assembly swatch rather than a transparent cap overlay.

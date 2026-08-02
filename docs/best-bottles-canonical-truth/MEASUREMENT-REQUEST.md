# Physical measurement request — Best Bottles (5 items)

> For the client / Cowork lane. These are the only measurements the 2026-07-12
> canonical-truth audit could not resolve from data — every lane either disagrees
> or is silent. Everything else in the catalog is already reconciled in
> `BEST-BOTTLES-CANONICAL-TRUTH.md`.

**How to record every measurement:** millimeters with a tolerance (`52 ±0.5 mm`),
calipers at the widest point of the axis, glass body only (no cap/applicator) unless
the item says otherwise. Axes: **H** = base to top of neck finish; **W** = widest
face width; **D** = front-to-back depth. A phone photo of the caliper on the bottle
per measurement is ideal evidence.

---

## 1. Diamond 60 ml — DEPTH (the only family with no depth anywhere)

- Applies to all 45 Diamond variants. Site publishes W 39 ±0.5 and H 88 ±1 but no depth.
- Example: `LB-DMD-CLR-60ML-LPM-COCP` — https://www.bestbottles.com/product/diamond-design-2-oz-glass-bottle-clear-over-the-cap-lotion-pump-matte-silver-collar-cap
- **Need: D** (and confirm W 39 / H 88 while it's in hand).

## 2. Round 78 ml AND 128 ml — the site contradicts itself

- The 78 ml page's spec table says H 73 ±1 / Ø 59 ±1, but the site's own measured
  render (labeled 78 ml / 2 oz) shows H 84.64 / Ø 68.92. One of them is a different
  bottle. 128 ml (spec: H 83 / Ø 69) should be checked at the same time — the two
  claims look suspiciously like neighbors on the same size ladder.
- Examples: `LB-RND-CLR-78ML-LPM-COCP` — https://www.bestbottles.com/product/round-design-78-ml-glass-bottle-clear-over-the-cap-lotion-pump-matte-silver-collar-cap
  and `GB-RND-CLR-128ML-DRP-CPR` — https://www.bestbottles.com/product/round-design-128-ml-glass-bottle-white-dropper-shiny-copper-collar-cap
- **Need: H and max Ø of both sizes**, measured on physically capacity-verified
  bottles (fill with water and weigh if there is any doubt which size is in hand).

## 3. Aluminum 100 ml — body height

- Convex says body H 127.8 (a suspicious 5.03-inch conversion); the site publishes
  only the with-cap height (150 ±2) and Ø 50 ±0.5.
- `AB-ALU-CLR-100ML-SPR-BLK` — https://www.bestbottles.com/product/Cylinder-shaped-matte-aluminum-100ml-bottle-black-sprayer
- **Need: H without sprayer** (and confirm Ø 50).

## 4. Boston Round 30 ml — is there a second, smaller shell?

- One row (`GB-BSR-AMB-30ML-WHT-T-01`, white dropper —
  https://www.bestbottles.com/product/boston-round-design-1-oz-amber-glass-bottle-white-dropper)
  claims 60 × Ø28 while 52 sibling rows and the site say 78 × Ø33.
- **Need: confirm the 1 oz amber Boston Round is 78 × Ø33 and that no 60 × Ø28
  variant physically exists.** If a smaller shell does exist, measure it fully.

## 5. Royal 13 ml — three vial-coded SKUs with vial-sized widths

- `GB-VIA-CLR-13ML-GLD-T`, `GB-VIA-CLR-13ML-SLV-T`, `GB-VIA-WHT-13ML-WHT-S` carry
  Ø 16.8 × H 56 but live in the Royal family and point at royal-design pages
  (e.g. https://www.bestbottles.com/product/royal-design-13-ml-glass-bottle-shiny-gold-cap);
  the other 26 Royal rows say W 44 (site-confirmed).
- **Need: what these three SKUs physically are** — a 44 mm Royal flask (then the
  16.8 dims are wrong) or a 16.8 mm vial (then the family/URL mapping is wrong).
  Measure H / W / D of whichever bottle actually ships under these SKUs.

---

Results go back into `best-bottles-master-truth.csv` (as `manual-override` rows) and
then into the Convex sync-back migration. Questions → the canonical truth sheet,
§8 "Verification protocol".

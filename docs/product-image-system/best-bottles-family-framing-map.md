# Best Bottles Family Framing Map

Source: fresh read-only Convex export on 2026-06-27.

Export path:

```text
/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/data/audits/2026-06-27-framing-profiles/convex_snapshot.json
```

The fixed studio canvas remains:

```text
2080 x 2288 px
Best Bottles Bone #F5F3EF
```

The profile resolver uses `heightWithCap` first, then `heightWithoutCap`, to choose the exact target inside each approved fill-height range.

## Implemented Bands

| Profile | Convex cues | Convex observed height band | Approved fill-height range | Default / midpoint |
| --- | --- | ---: | ---: | ---: |
| `sample-vial` | capacity <= 4ml, explicit Vial family, vial cues | 32-75mm | 55-60% | 58% |
| `roller-bottle` | Roll-On / Roller Ball applicator cues | 55-118mm | 65-70% | 68% |
| `small-bottle` | 5-15ml small upright bottles, regular 9ml roll-ons | 60-90mm | 64-70% | 67% |
| `cylinder-standard` | Cylinder after sample/roller overrides | 75-142mm | 72-78% | 76% |
| `cylinder-tall` | Cylinder >30ml or very tall measured height | 142-199mm | 80-84% | 82% |
| `boston-round` | Boston Round family/cues | 72-117mm | 78-82% | 80% |
| `empire-bottle` | Empire family/cues | 93-139mm | 80-84% | 82% |
| `heavy-perfume-bottle` | Decorative perfume families: Diva, Elegant, Diamond, Sleek, Slim, Decorative, Grace | 80-198mm | 84-88% | 86% |
| `aluminum-bottle` | Aluminum Bottle family/cues | 127-186mm | 88-92% | 90% |

## Precedence

The resolver applies profiles in this order:

1. Sample vial
2. Roller bottle
3. Small bottle / small cylinder
4. Cylinder
5. Boston Round
6. Empire
7. Aluminum Bottle
8. Heavy perfume / decorative

This prevents a 3ml cylinder sprayer or a cylinder roller bottle from being rendered at a full cylinder scale.

## Recommended Next Bands

These Convex families have enough current data to deserve explicit profiles next:

| Family group | Convex examples | Suggested fill-height range | Reason |
| --- | --- | ---: | --- |
| Circle / Round / Apothecary | Circle, Round, Apothecary | 78-82% | Round upright glass families behave closer to Boston/Empire than slender cylinders. |
| Small decorative bottles | Tulip, Flair, Square, Royal, Bell, Pillar, Teardrop when not roller/sample | 68-76% | These are short, decorative bodies and should not jump to heavy-perfume scale unless their measured height proves it. |
| Cream jars | Cream Jar | 55-68% by height, width-constrained | Low/wide products need a width-first profile rather than tall-bottle fill-height logic. |
| Atomizers | Atomizer Collection / Metal Atomizer | 76-84% | Slim metal atomizers are tall but small-capacity; they should be distinct from large Aluminum Bottles. |
| Plastic bottles | Plastic Bottle | 72-78% | Current Convex heights overlap small cylinders. |
| Lotion bottles | Lotion Bottle | 80-84% | Current records are tall, upright treatment-style bottles. |

Do not add these as fixed guesses without tests. Add one profile at a time from Convex examples and verify the resulting prompt block for representative SKUs.

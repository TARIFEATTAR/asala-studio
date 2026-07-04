# Best Bottles — Design System

> "Beautifully Contained." — Best Bottles is a division of Nemat International (20+ year family fragrance house) selling premium glass bottles, closures, and packaging to beauty, fragrance, and wellness brands at every stage — indie Etsy perfumers through enterprise retailers like Ulta and Whole Foods.

**Catalog scale:** 2,300+ products · 27 bottle families (Cylinder, Diva, Elegant, Empire, Boston Round, Sleek, Circle, Atomizer, Apothecary, Decorative…) · 500+ brand customers · $50 order minimum · Made-in-USA manufacturing · Free sample kits · Shopify + Sanity + Convex stack.

**The Grace layer.** Every surface carries **Grace**, an always-on AI Bottling Specialist (voice + chat) that handles the catalog's hardest problem — thread-size fitment between bottles, caps, sprayers, droppers, and roll-ons. Grace shows up as a subtle gold-tinted pulse + four vertical "voice bars" throughout the UI, and is the third homepage entry path alongside Search and the Guided Selector.

---

## Sources

| | |
|---|---|
| **Marketing site codebase** (Next.js 16 / React 19 / Tailwind v4 / Sanity / Convex / Shopify / Clerk) | `Best-Bottles-Website-02-20-2026-clean-pr/` (mounted) |
| Key references | `src/app/globals.css`, `src/app/layout.tsx`, `src/components/HomePage.tsx`, `src/components/Navbar.tsx`, `src/components/icons.tsx`, `USER-JOURNEY-ANALYSIS.md`, `UX-AUDIT-REPORT.md` |
| Product imagery | `public/assets/*.png` (copied into `assets/`) |

No Figma link or slide deck was provided with this project — only the marketing-site codebase. UI kit is scoped to the marketing website (`ui_kits/website/`).

---

## Products represented

The codebase exposes one public product (the marketing/e-commerce website) and one gated product (a customer portal).

1. **Marketing & commerce website** — `best-bottles.com`. Homepage, mega-menu navigation, catalog with rich filtering, PDP with fitment, cart/checkout, Journal (blog), About, Contact, quote/sample request forms. This is what the UI kit recreates.
2. **Portal** (`/app/(portal)`) — signed-in customer area; order history, reorders, saved fitments, quote workflow. Uses the same brand tokens with slightly darker "portal palette" (`--ink`, `--ash`, `--gold-dim`). Not recreated here; flag it as a second UI kit if needed.
3. **Grace AI** — lives *inside* the website rather than being a standalone product, but has its own visual language (breathing pulse, voice bars, side-panel docking).
4. **Sanity Studio** (`/studio`) — admin CMS. Off-brand (Sanity's own UI); not part of this system.

---

## Content Fundamentals

### Voice & tone
Refined, confident, technically fluent. Best Bottles reads like a **third-generation family atelier that also ships 2,300 SKUs on time** — aesthetic vocabulary from the perfume world ("silhouette," "atelier," "discovery kit," "refined 55 ml") crossed with operator-grade specificity ("Type III cosmetic," "thread size," "fitment verified," "no tariff surprises"). Never whimsical, never slangy.

### Person & address
Addresses the reader as **"you"** in calls-to-action and microcopy; uses **"we" / "our"** for the brand. First-person singular ("I") is avoided — Grace's chat is the one place where voice becomes more conversational.

### Casing rules
- **Section eyebrows** are UPPERCASE with wide tracking (`tracking-[0.25em]`). *e.g.* `FIND YOUR BOTTLE` · `ALREADY KNOW YOUR STYLE?` · `FROM THE LAB` · `OUR STORY`.
- **Headlines** are Title Case or sentence case in serif — never all-caps.
- **Button labels** are UPPERCASE with wide tracking. *e.g.* `BROWSE CATALOG`, `EXPLORE`, `VIEW ALL ARTICLES`, `SUBSCRIBE`.
- **Logo wordmark** is `BEST BOTTLES` — UPPERCASE, Cormorant semibold.
- **Body copy** is sentence case. Em dashes ( — ) used liberally for rhythm.

### Tagline & brand phrases
- Master tagline: **"Beautifully Contained."**
- Sign-off in footer: *"Beautifully Contained."* in italic muted-gold serif.
- Dark announce bar (top of every page): `Free shipping on orders above $99 · Need fitment help? Talk with Grace, AI Bottling Specialist`.
- Grace's promo line: `Your AI bottling specialist for fitment and product guidance.`

### Specific copy examples (pull these before inventing)

| Context | Exact copy |
|---|---|
| Hero eyebrow | `A DIVISION OF NEMAT INTERNATIONAL` |
| Hero headline | `Beautifully Contained` |
| Hero sub | `Premium glass bottles and packaging for brands ready to scale.` |
| Hero CTA | `BROWSE CATALOG` |
| Trust stats | `$50 Order Minimum` · `2,300+ Products` · `Fitment Verified` |
| Trust sub | `Order what you need` · `Premium bottles & closures` · `Guaranteed compatibility` |
| Path chooser eyebrow | `FIND YOUR BOTTLE` |
| Path chooser title | `How would you like to start?` |
| Path 1 | `I Know What I Need` — `Search by name, SKU, size, or color.` · placeholder `e.g. 9ml clear cylinder roll-on` |
| Path 2 | `Help Me Choose` — `3 quick questions to find your perfect bottle.` |
| Path 3 | `Talk with Grace` — `Your AI bottling specialist for fitment and product guidance.` |
| Guided Q1 | `What are you packaging?` — `Pick the closest match — we'll narrow the catalog for you.` |
| Guided Q2 | `How should it dispense?` |
| Guided Q3 | `What size?` — `Pick a size range — you can always refine in the catalog.` |
| Families header | `ALREADY KNOW YOUR STYLE?` / `Shop by design family` |
| Social proof | `WHO TRUSTS BEST BOTTLES` / `Serving 500+ Brands` / `From boutique indie perfumers to enterprise retail labels.` |
| Testimonial segments | `Graduate` · `Scaler` · `Professional` |
| Blog section | `FROM THE LAB` / `Packaging Insights` |
| Newsletter | `Stay in the Know` / `Packaging insights, new arrivals, and scaling strategies. No spam—just expertise.` |
| About hero | `OUR STORY` / `The Art of Beautiful Packaging` |
| About values | `Heritage` · `Quality` · `Made in USA` · `Partnership` |
| About body | "What began as a family fragrance business has evolved into one of the most trusted names in premium glass packaging. Our founder's original insight was simple: the bottle should be as beautiful as what's inside it." |

### Vocabulary
- **Preferred:** silhouette, family, applicator, fitment, closure, dispenser, atomizer, apothecary, discovery kit, sample kit, thread size, volume pricing, made in USA, refined, premium, artisan.
- **Avoided:** "amazing", "awesome", "game-changer", "unlock", exclamation points.

### Emoji
**None.** Zero emoji anywhere in the product copy, cards, testimonials, or nav. Icon language is handled through Phosphor Icons (see Iconography). Do not introduce emoji.

### Numerals & units
- Measurements: `9 ml`, `55 ml`, `100 ml` (space before unit). Also shown with oz: `30 ml (1.01 oz)`.
- Counts: `2,300+ Products`, `500+ Brands`, `$50` (always formal formatting).
- Ranges in menus: `Miniature — 1 to 5 ml`, `Small — 6 to 15 ml` (en dash in label, `to` in prose).

---

## Visual Foundations

### Palette (see `colors_and_type.css` for tokens)

**Primary** — a warm-neutral "gallery" palette, never pure white or true black.
- `--obsidian #1D1D1F` — primary text, dark announce bar, footer.
- `--bone #F5F3EF` — default page background. Warmer than off-white.
- `--muted-gold #C5A065` — brand accent, hover, active links, Grace cues, pill tints.
- `--slate #637588` — secondary text, eyebrow copy.
- `--champagne #D4C5A9` — borders and dividers (usually at `/50` opacity).
- `--linen #FAF8F5` — light surface (PathChooser, Education band).
- `--travertine #F5F3EF` — warmer image-placeholder surface.
- `--parchment #ECE5D8` / `--warm-white #FDFBF8` — secondary grid surfaces.

**Portal extensions** — `--ash #9A9590`, `--ink #2C2C2E`, `--gold-dim #8B6F42`.

**Status** — `--destructive #EF4444` (only visible color used for errors; no `success` token in code — I'm proposing `#5A8F6E` and flagging it).

**How colors stack in practice (top → bottom of homepage):**  
`bone hero (image bg)` → `linen trust bar` → `white path chooser` → `warm-white families band` → `parchment/20 social proof` → `linen education` → `linen newsletter` → `obsidian footer`. The rhythm is *light → lighter → warmest → darker → light → DARK*.

### Type
- **Display / serif — EB Garamond** — hero, all `h1/h2/h3/h4`, testimonial quotes, CTA card titles. Weight 500 is the default; 400 is used for quotes. Italic EB Garamond appears in testimonials and the footer sign-off.
- **Logo display — Cormorant** — only the `BEST BOTTLES` wordmark (Cormorant semibold, uppercase, tight tracking). Do not use elsewhere.
- **UI sans — Inter** — all body copy, nav, buttons, eyebrows, badges, meta.
- **Display size** is genuinely big: the hero uses `text-[87px]` on desktop with `line-height: 1.05`. Section titles are `text-4xl` (40px) EB Garamond.
- **Eyebrows** are a consistent pattern: `text-[10–12px]`, uppercase, `tracking-[0.25em]`, `font-semibold`, color `slate` (or `muted-gold` for the Grace accent).

### Backgrounds & imagery
- **Imagery is bottle-centric product photography** on warm neutral backdrops — amber glass, clear/frosted glass, aluminum, cream jars, vintage atomizers. Not lifestyle shots.
- **Full-bleed hero image** with a `from-obsidian/55 via-obsidian/25 to-transparent` *horizontal* gradient wash (L→R) is the signature hero treatment. Text sits in the left gutter over the darkened band.
- **Card images** use `bg-travertine` as the empty state / letterbox color while `<Image>` loads.
- **No hand-drawn illustrations. No repeating patterns or textures. No photographic grain filters.** The brand is calm, gallery-like.
- **No bluish-purple gradients.** The only gradients are: hero dark wash, subtle muted-gold/10 → champagne/40 background on mega-menu featured cards, and text-shimmer across white Grace text.

### Motion & interaction

**Animation library:** Framer Motion (`framer-motion@12`) for React animation; plus bespoke CSS keyframes for Grace's ambient loops.

- **FadeUp** is the canonical entrance: `opacity: 0, y: 30 → opacity: 1, y: 0`, `duration: 0.8`, `ease: [0.22, 1, 0.36, 1]`, triggered `whileInView` with `once: true, margin: -100px`. Used on nearly every section. Stagger delay = `i * 0.08–0.1s`.
- **Hero image** scales from `1.05 → 1` over `8s ease-out` (barely perceptible zoom).
- **Cart drawer** slides in from right, `0.45s cubic-bezier(0.4, 0, 0.2, 1)`.
- **Grace ambient pulse** — breathing scale `1 → 1.15 → 1` over `2s ease-in-out infinite`. Softer `gracePulseSubtle` variant (1 → 1.05) for PDP trigger.
- **Grace voice bars** — four 2px-wide bars animate height `3px → 13px` with staggered delays (`0s, .18s, .36s, .54s`) at `0.9s ease-in-out infinite`. Gold on light, white on dark.
- **Grace glow** — `0 0 16px 4px rgba(197,160,101,0.2)` box-shadow pulse on "Talk with Grace" buttons.
- **Text shimmer** — a gold highlight sweeps across white body text (`textShimmer`, 3s infinite). Used sparingly on Grace's primary CTA.
- **No bouncy springs.** No overshoot. Easing is always gentle cubic-bezier.

### Hover & press states
- **Links / nav items** — `hover:text-muted-gold` (color change, no underline shift).
- **Icon buttons** — icon color → `muted-gold` on hover.
- **Buttons (solid dark)** — `bg-obsidian` → `hover:bg-muted-gold`. Solid-gold → `hover:bg-obsidian`. (The primary CTA pattern *inverts* on hover — dark becomes gold and vice versa.)
- **White/outline buttons** — `bg-white` → `hover:bg-bone`.
- **Cards** — `border-champagne/50` → `hover:border-muted-gold hover:shadow-lg` (border color + shadow intensify; no transform). Inner image `group-hover:scale-105` zoom over `duration-700 ease-in-out`.
- **Underlines on secondary links** — `underline-offset-4 decoration-champagne hover:decoration-muted-gold`.
- **Press/active** — mobile-only card tap: `active:scale-105` on the inner image. No global press-shrink on buttons.
- **Focus ring** — `ring-2 ring-muted-gold/15–20` on inputs; `ring-muted-gold/20` on focused cards. Keyboard focus follows shadcn defaults (`ring-ring` = muted-gold).

### Borders
- Default border: `1px solid var(--champagne)` at 50–60% opacity. Visible but quiet.
- Borders thicken to full `--muted-gold` on hover/focus.
- Divider lines in the Trust Bar use `divide-x divide-champagne/60`.

### Shadows & elevation
Sparse and soft. Three layers in practice:
- **`shadow-sm`** — passive product cards, testimonial cards, Trust Bar.
- **`shadow-md`** — hero CTA button, mega-menu featured card.
- **`shadow-lg` / `shadow-xl`** — card hover state; cart drawer.
- **`shadow-2xl`** only on the mega-menu panel itself (large floating layer).

Grace adds its own glow layer (`0 0 20px 2px rgba(197, 160, 101, 0.15)`) as breathing effect — this is an *accent*, not a general elevation tool.

### Corner radii
Best Bottles is **decidedly low-radius**. The dominant corner is a *sharp* `rounded-sm` (2px). Rounded surfaces by use:

| Surface | Radius |
|---|---|
| Product cards, testimonial cards, article cards, CTA buttons | `rounded-sm` (2px) |
| Badge / pill / chip / circular icon well / dot nav / avatar | `rounded-full` |
| Search field, Grace button, nav input | `rounded-xl` (12px) |
| shadcn primitives (buttons, tables, separators) | `rounded-md` (6px) |
| Design-family large cards | `rounded-[10px]` |

Newsletter bar is pill-shaped (`rounded-full` container with a pill submit button inside). Everything else defaults to `rounded-sm`.

### Transparency & blur
- **Fixed navbar** uses a subtle backdrop treatment: `bg-bone` when at top, `bg-bone/95 shadow-sm backdrop-blur-md` once scrolled past 20px.
- **Hero text bands** use obsidian gradient overlays (55% → 25% → 0%) — no blur.
- **Overlays** (mega menu closed, mobile menu closed) use `bg-obsidian/10` and `/40` respectively.
- **Inputs** use `bg-white/60` for a soft-glass effect when the page behind is off-white.
- **Blur is used sparingly** — only on the scrolled header.

### Layout rules
- **Max content width: 1440px**, centered with `px-6` (24px) gutters on desktop and `px-4` (16px) on mobile.
- **Vertical rhythm:** major sections are `py-24` (96px) with tight sections at `py-14–16` (PathChooser) and hero at `h-[100dvh]` with `pt-[120px]` to clear the nav.
- **Fixed elements:** navbar (`z-50`), cart drawer (`z-[70]`), mega-menu overlay (`z-40`), mobile menu (`z-[60]–[61]`), Grace layout shell wraps everything.
- **Mobile tab bar padding** — `main` gets `padding-bottom: calc(3.5rem + env(safe-area-inset-bottom))` on `<1024px` so content never hides behind mobile nav.
- **Design-family carousel** uses a *full-width* horizontal scroll that starts flush with the page gutter and extends past the right edge — `pl-[max(1.5rem, calc((100vw-1440px)/2+1.5rem))]` and `pr-[10vw]`. A deliberate edge-bleeding pattern that appears in several horizontal-scroll rows.

### Imagery color vibe
**Warm, neutral, softly-lit, indoor studio.** Amber and clear glass dominate; backdrops are bone / travertine / champagne. Never cool, never blue-hour, never black-and-white, never grainy. Bottles are the hero — people rarely appear.

### Density
Medium. Cards are generous (p-6 to p-8), touch targets exceed 44px on mobile, but information density is high in the catalog grid (3–4 columns on desktop). The brand is **not minimalist** — it leans **editorial** — lots of small eyebrows, counters ("28 products"), badges, and utility meta ("tracking-[0.2em] text-[10px]").

---

## Iconography

**Primary icon system:** [`@phosphor-icons/react`](https://phosphoricons.com/) — all icons in the app import from `@phosphor-icons/react` via `src/components/icons.tsx`, which acts as a central barrel and alias file. Phosphor is a **thin-stroke, 1.5px, geometric** set with variants (thin/light/regular/bold/fill/duotone). The default weight used is **`regular`**, rendered at `size={16|20|24}`.

Phosphor is available via CDN at `https://unpkg.com/@phosphor-icons/react@2.1.10` and via Phosphor's own web-font loader:
```html
<link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web/src/regular/style.css" />
<i class="ph ph-arrow-right"></i>
```

**Icons actually used in the codebase** (imported from `src/components/icons.tsx`):
`ArrowRight`, `ArrowLeft`, `CaretRight/Down/Up`, `X`, `List`, `House`, `MagnifyingGlass`, `User`, `ShoppingBag`, `ShoppingCart`, `Heart`, `Check`, `Plus`, `Minus`, `Trash`, `XCircle`, `WarningCircle`, `Clock`, `Calendar`, `ShieldCheck`, `Shield`, `ChatCircle`, `Headphones`, `GridFour`, `Lightning`, `Compass`, `Trophy`, `Globe`, `Users`, `BookOpen`, `Wrench`, `FileText`, `BookBookmark`, `PaperPlaneTilt`, `CheckCircle`, `CircleNotch`, `Drop`, `SprayBottle`, `Sparkle`, `Star`, `Truck`, `Package`, `SlidersHorizontal`, `ArrowsDownUp`, `Rows`, `Diamond`, `Flask`, `Medal`, `Sun`, `Leaf`, `Recycle`, `SquaresFour`, `Tag`, `Microphone`, `SpeakerHigh/Slash`, `Waveform`, `Eyedropper`, `Flower`, `Gift`, `Stack`, `Question`.

**Applicator icons** — `Roll-On`, `Spray`, `Reducer`, `Lotion Pump`, `Dropper` are **custom inline SVGs** drawn in `HomePage.tsx` (`APPLICATOR_ICONS`) at `viewBox="0 0 40 40"`, `stroke="currentColor"`, `strokeWidth="1.5"`. These match Phosphor's stroke weight for consistency. They're simple bottle silhouettes, not photoreal.

**PNG/raster iconography:** none for UI chrome. A handful of raster assets serve as *illustrative content* (product family photos, hero photos) — see `assets/`.

**Emoji:** not used anywhere. Do not introduce.

**Unicode dashes as UI:** the en-dash `–` separates ranges in mega-menu links (`Miniature — 1 to 5 ml`); the em-dash `—` is a common rhythm character in prose. Middle-dot `·` separates clauses in the dark announce bar.

**Logo:** there is a raster logo referenced at `/assets/best-bottles-logo.png` in the mobile menu — not present in the repo's `public/assets`. Main desktop logo is the **Cormorant wordmark** rendered as text. Treat the wordmark as the canonical logo; when a raster mark is needed, flag for the user to supply it.

---

## Files in this design system

```
.
├── README.md                    ← this file
├── SKILL.md                     ← invoke instructions (Claude Code-compatible)
├── colors_and_type.css          ← all CSS variables + semantic element styles
├── assets/
│   ├── Hero-BB.png              ← hero product shot (perfume atomizer)
│   ├── Cylinder-BB.png          ← Cylinder family
│   ├── Slim-BB.png              ← Slim family
│   ├── CreamJars-BB.png         ← cream/cosmetic jars
│   ├── collection_amber.png     ← amber glass collection
│   ├── Assorted Closers.png     ← caps / closures lineup
│   ├── hero_bottles.png         ← alternate hero
│   ├── uploaded_hero.png        ← secondary hero option
│   └── vintage-spray.png        ← antique-bulb atomizer
├── preview/                     ← design-system preview cards (registered assets)
└── ui_kits/
    └── website/                 ← Best Bottles marketing site UI kit
        ├── index.html           ← interactive homepage recreation
        ├── README.md
        └── *.jsx                ← component files
```

## Caveats / substitutions

- **Fonts** — EB Garamond, Cormorant, and Inter are all served from Google Fonts in the source codebase (Next font loader), so no local `.ttf` substitution was needed. `colors_and_type.css` imports them from the Google CDN; swap to self-hosted `.woff2` for production.
- **Logo raster** — referenced at `/assets/best-bottles-logo.png` but not in the repo. UI kits use the Cormorant text wordmark. Ask user for logo PNG/SVG if needed.
- **Success color** — the codebase defines no `--color-success`. I added `#5A8F6E` as a warm-sage proposal; confirm or replace.
- **Portal UI kit** — not built. Scope was the public marketing site. Ping me to extend.
- **No Figma** — all visuals were derived from code. Pixel-exact on primitives; hero/card photography relies on the provided PNGs.

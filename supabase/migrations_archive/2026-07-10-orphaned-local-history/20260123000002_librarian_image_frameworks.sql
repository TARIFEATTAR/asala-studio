-- ============================================================================
-- THE LIBRARIAN - Image Prompt Framework Seed Data
-- Madison Studio's curated visual methodology library
--
-- Phase 2: 10 Core Image/Video Frameworks
-- ============================================================================

INSERT INTO librarian_frameworks (
  title,
  slug,
  sort_letter,
  category,
  channel,
  intent,
  masters,
  awareness_stage,
  industries,
  short_description,
  framework_content,
  madison_note,
  example_output,
  is_featured
) VALUES

-- A: Atmospheric Lifestyle
(
  'Atmospheric Lifestyle Scene',
  'atmospheric-lifestyle',
  'A',
  'image',
  'instagram',
  'launch',
  ARRAY['burnett', 'peterman'],
  'unaware',
  ARRAY['fragrance', 'skincare', 'home_fragrance', 'candles'],
  'Evocative lifestyle imagery that tells a story through atmosphere',
  E'SCENE CONSTRUCTION:

1. SETTING
[Time of day]: Golden hour / Blue hour / Soft morning light
[Location type]: Mediterranean villa / Japanese garden / Urban loft / Coastal retreat
[Season/Weather]: Spring blooms / Summer warmth / Autumn warmth / Winter coziness

2. MOOD ELEMENTS
Environmental detail that supports the product story:
• [Texture 1]: linen / marble / weathered wood / brass
• [Texture 2]: botanical element / water / smoke / fabric
• [Light quality]: dappled / diffused / dramatic / soft

3. PRODUCT PLACEMENT
[Position]: Hero center / Nestled among elements / Partially visible
[Reflection]: Subtle surface reflection / None
[Focus]: Product sharp, background soft (f/2.8)

4. ATMOSPHERE KEYWORDS
"ambient light, editorial photography, lifestyle imagery,
soft shadows, natural materials, [brand mood]"

TECHNICAL:
Aspect ratio: 4:5 (Instagram) or 16:9 (landscape)
Style: Editorial, lifestyle, aspirational
Avoid: Harsh shadows, synthetic materials, cluttered compositions',
  E'Burnett taught us that every product has inherent drama. In lifestyle imagery, that drama isn''t about the product directly—it''s about the world it inhabits. A perfume bottle catching golden light on a marble surface tells a story before anyone reads a word. The product becomes the hero not by being centered and lit, but by belonging to a world your customer wants to enter.',
  E'A perfume bottle rests on weathered marble in a sunlit Mediterranean villa.
Morning light streams through linen curtains, casting soft shadows across the scene.
Fresh olive branches and a half-filled espresso cup suggest a moment just paused.
Shot at f/2.8, the product remains sharp while the terracotta and white walls
dissolve into a warm, dreamy bokeh. Editorial lifestyle photography, ambient light.',
  true
),

-- D: Dark & Moody Studio
(
  'Dark & Moody Studio',
  'dark-moody-studio',
  'D',
  'image',
  'web',
  'convert',
  ARRAY['ogilvy', 'burnett'],
  'product',
  ARRAY['fragrance', 'skincare', 'luxury'],
  'High-contrast dramatic studio lighting for luxury positioning',
  E'LIGHTING SETUP:

1. KEY LIGHT
[Position]: 45° camera left, elevated
[Quality]: Hard light with slight diffusion
[Intensity]: High contrast, deep shadows

2. FILL LIGHT
[Position]: Minimal or none (embrace shadows)
[Quality]: Very subtle, if present
[Purpose]: Just enough to show product detail in shadows

3. BACKGROUND
[Color]: Pure black (#000000) or deep charcoal (#1A1A1A)
[Material]: Velvet, matte black acrylic, or deep gradient
[Edge lighting]: Optional rim light for separation

4. SURFACE
[Material]: Black marble / dark slate / obsidian glass
[Reflection]: Mirror or matte depending on product finish

5. ATMOSPHERE
Optional: subtle smoke/mist for depth
Color grade: Rich, deep, slightly desaturated

PROMPT STRUCTURE:
"[Product name] on [dark surface], dramatic studio lighting,
deep shadows, high contrast, minimalist composition,
dark background, luxury product photography,
professional lighting setup, editorial style"

TECHNICAL:
Aspect ratio: 1:1 (product) or 2:3 (editorial)
Post-processing: High contrast, lifted shadows just enough for detail',
  E'When Ogilvy photographed expensive products, he understood that darkness equals luxury in the visual language. White backgrounds say "accessible." Black backgrounds say "exclusive." The key is using just enough light to reveal the product''s essential details while letting the shadows create mystery. A perfume bottle emerging from darkness feels like a secret being shared.',
  E'Amber glass perfume bottle on polished black marble, dramatic studio lighting from above-left,
deep shadows, single hard key light with slight diffusion, minimal fill,
rich amber liquid catching the light, pure black background,
subtle reflection on surface, high contrast, luxury fragrance photography',
  true
),

-- F: Flat Lay Composition
(
  'Flat Lay Composition',
  'flat-lay-composition',
  'F',
  'image',
  'instagram',
  'nurture',
  ARRAY['ogilvy'],
  'solution',
  ARRAY['skincare', 'fragrance', 'wellness', 'beauty'],
  'Organised overhead compositions showing product ecosystem',
  E'COMPOSITION GRID:

1. LAYOUT STRUCTURE
[Primary]: Product(s) at visual center or golden ratio point
[Secondary]: Supporting elements arranged in intentional grid/organic pattern
[Negative space]: Generous margins (20%+ of frame)

2. SUPPORTING ELEMENTS (Choose 3-5)
Category-relevant props:
• Raw ingredients (botanicals, minerals, extracts)
• Tools of ritual (brushes, cloths, vessels)
• Textural elements (fabric swatches, paper, stone)
• Organic matter (flowers, leaves, branches)

3. SURFACE SELECTION
[Option A]: Neutral (white marble, linen, cream paper)
[Option B]: Contrasting (dark slate, terracotta, wood grain)
[Option C]: Textured (handmade paper, raw canvas, concrete)

4. LIGHTING
Soft, even illumination from above or slight angle
Minimal shadows (use diffuser)
Natural window light or softbox

5. COLOR HARMONY
[Approach]: Monochromatic / Complementary / Analogous
Keep palette to 2-3 colors plus neutrals

PROMPT STRUCTURE:
"Flat lay composition, [product] surrounded by [ingredients/props],
[surface material], overhead view, soft natural lighting,
minimal shadows, organized arrangement, [color palette],
beauty photography, editorial style"',
  E'The flat lay is the visual equivalent of the ingredient list—it builds credibility through specificity. When a customer sees the raw botanicals arranged around your product, they understand the care that went into formulation. Ogilvy would approve: we''re showing our work, making claims visible rather than abstract.',
  E'Flat lay composition featuring amber serum bottle surrounded by dried rose petals,
vitamin E capsules, and golden jojoba seeds, arranged on cream linen fabric,
overhead view, soft diffused natural lighting, minimal shadows,
organized asymmetric arrangement, warm neutral color palette,
skincare photography, editorial beauty flat lay',
  true
),

-- H: Hero Product Shot
(
  'Hero Product Shot',
  'hero-product-shot',
  'H',
  'image',
  'web',
  'convert',
  ARRAY['reeves', 'ogilvy'],
  'product',
  ARRAY['fragrance', 'skincare', 'general'],
  'Clean, focused product imagery for e-commerce and marketing',
  E'STRUCTURE:

1. PRODUCT POSITION
[Angle]: 3/4 view (most flattering for most products)
[Height]: Eye level or slightly below
[Rotation]: Show best identifying features (label, texture, color)

2. LIGHTING (3-Point Setup)
Key Light: 45° from camera, softbox or umbrella
Fill Light: Opposite side, lower intensity
Back Light: Rim/edge light for separation from background

3. BACKGROUND OPTIONS
[Clean]: Pure white (#FFFFFF) for e-commerce
[Lifestyle]: Simple complementary surface
[Gradient]: Subtle neutral gradient for depth

4. FOCUS & DEPTH
Aperture: f/8 to f/11 for full product sharpness
Focus point: Most prominent product feature (label, cap, etc.)
Background: Clean falloff, not distracting

5. POST-PROCESSING
• Clean up any dust or imperfections
• Correct color to match actual product
• Ensure white balance is accurate
• Subtle shadow for grounding

PROMPT STRUCTURE:
"Professional product photography of [product name],
3/4 angle, [background type] background,
soft studio lighting, sharp focus,
commercial photography, clean composition,
[any specific detail to highlight]"',
  E'The hero shot is where Reeves'' USP discipline becomes visual. Every product has one angle, one lighting setup, one background that makes it look its absolute best. Your job is to find it and execute it flawlessly. This isn''t creative expression—it''s commercial craft. The product must look exactly as good as it will appear in the customer''s hands.',
  E'Professional product photography of luxury perfume bottle,
amber glass with gold cap, 3/4 angle view showing embossed label,
pure white background, soft studio lighting with subtle shadows,
sharp focus throughout product, commercial fragrance photography,
clean minimal composition, high-end product shot',
  true
),

-- M: Macro Texture Detail
(
  'Macro Texture Detail',
  'macro-texture-detail',
  'M',
  'image',
  'social',
  'nurture',
  ARRAY['ogilvy', 'hopkins'],
  'product',
  ARRAY['skincare', 'fragrance', 'general'],
  'Close-up texture shots that emphasise product quality',
  E'SUBJECT FOCUS:

1. TEXTURE SUBJECTS
• Product surface (glass texture, cap material, label embossing)
• Content (cream swirl, liquid clarity, oil droplets)
• Packaging details (debossing, foiling, material grain)
• Application moment (product on skin, spreading, absorption)

2. LIGHTING FOR TEXTURE
Side lighting (30-45°) to emphasize dimension
Consider using:
• Hard light for crisp texture definition
• Soft light for organic, skin-like textures
• Backlight for translucent materials

3. TECHNICAL SETTINGS
Macro lens or extension tubes
Very narrow depth of field (f/2.8-4)
Focus stacking if full sharpness needed
Tripod essential for sharpness

4. COMPOSITION
Fill 60-80% of frame with texture
Leave some context at edges
Consider rule of thirds for focal point

5. COLOR & GRADING
True-to-life colors essential
White balance must be accurate
Minimal post-processing (authenticity is key)

PROMPT STRUCTURE:
"Macro photography of [specific texture detail],
extreme close-up, side lighting emphasizing texture,
shallow depth of field, [product/ingredient name],
beauty macro photography, detail shot,
showing [specific quality: shimmer/cream texture/glass clarity]"',
  E'Hopkins believed every claim needs evidence. Macro texture shots ARE that evidence. When you show the silken swirl of a cream or the clarity of an oil, you''re proving quality in a way no words can match. This is specificity made visual—the photography equivalent of "aged seven years in oak casks."',
  E'Macro photography of face cream texture being swirled with a gold spatula,
extreme close-up showing silky consistency and light-catching shimmer,
side lighting from camera left emphasizing creamy peaks and valleys,
shallow depth of field with product name visible in soft background,
luxury skincare macro photography, texture detail shot',
  true
),

-- S: Social Story Frame
(
  'Social Story Frame',
  'social-story-frame',
  'S',
  'image',
  'instagram',
  'nurture',
  ARRAY['wieden_kennedy', 'burnett'],
  'problem',
  ARRAY['fragrance', 'skincare', 'wellness', 'general'],
  'Casual, authentic imagery for social stories and posts',
  E'AUTHENTICITY APPROACH:

1. SETTING
[Location]: Your home / bathroom shelf / vanity / travel bag
[Time]: Morning routine / Evening ritual / On-the-go moment
[Context]: Real-life usage, not staged perfection

2. STYLE NOTES
• Slightly imperfect compositions (off-center, casual)
• Natural lighting (phone quality is acceptable)
• Real hands and real skin (not retouched)
• Background tells a lifestyle story

3. CONTENT ANGLES
• Product-in-use: Application moment, mid-routine
• Product-in-context: Among other products, in morning light
• Product-and-me: Partial self (hand, silhouette, reflection)
• Product moment: Unboxing, discovery, reorganizing

4. AVOID
• Stock photo aesthetics
• Over-produced lighting
• Perfect placement
• Unrealistic skin

5. MOOD
Approachable, relatable, "caught in the moment"
Connection over perfection

PROMPT STRUCTURE:
"Candid lifestyle photo of [product] on [real location like bathroom shelf],
natural morning light through window, casual composition,
authentic aesthetic, social media photography,
relatable lifestyle imagery, [mood: cozy/fresh/minimal]"',
  E'Wieden+Kennedy understood that authenticity is the new luxury. On social platforms, overly produced imagery reads as advertising and gets scrolled past. What stops thumbs is recognition—"that could be my bathroom." The slight imperfection signals truth. Burnett''s drama here isn''t dramatic lighting; it''s the drama of a relatable moment.',
  E'Candid iPhone-style photo of skincare products on a white marble bathroom shelf,
morning light streaming through frosted window, slightly off-center composition,
toothbrush visible at edge of frame, authentic lived-in aesthetic,
Instagram story photography, relatable self-care moment,
soft natural shadows, casual lifestyle imagery',
  false
),

-- V: Video Scene Direction
(
  'Video Scene Direction',
  'video-scene-direction',
  'V',
  'video',
  'video',
  'launch',
  ARRAY['burnett', 'peterman'],
  'unaware',
  ARRAY['fragrance', 'skincare', 'general'],
  'AI video prompt framework for product storytelling',
  E'SCENE STRUCTURE:

1. OPENING FRAME (0-2s)
[Setting]: Establish atmospheric context
[Movement]: Slow push-in or gentle pan
[Focus]: Environment first, product mystery

2. REVELATION (2-4s)
[Action]: Product enters frame or is revealed
[Movement]: Camera finds the product
[Light]: Product catches light at key moment

3. HERO MOMENT (4-6s)
[Composition]: Product in full glory
[Movement]: Subtle, steady (handheld or gimbal)
[Detail]: Show defining feature (label, texture, etc.)

4. CLOSING (6-8s)
[Action]: Fade to black or pull away
[Feel]: Resolve the visual story

5. MOTION GUIDELINES
• Slow, deliberate movements (half speed feels right)
• No handheld shake (use gimbal or steady)
• Single direction of movement per shot
• Match motion to product personality

ATMOSPHERE:
• Lighting: [Natural / Studio / Dramatic]
• Pace: [Contemplative / Dynamic / Luxurious]
• Sound design note: [Ambient / Musical / Silent with SFX]

PROMPT STRUCTURE:
"Cinematic product video, [product] in [setting],
slow camera movement [direction],
[lighting style], atmospheric,
luxury brand aesthetic, [mood keywords],
8 seconds, smooth motion"',
  E'Video is where Burnett''s inherent drama finds its fullest expression. The movement itself becomes storytelling—a slow push toward a perfume bottle creates anticipation. Peterman''s romance translates to pacing: luxurious means slow, considered, almost meditative. Every frame should feel like a complete photograph.',
  E'Cinematic product video of amber perfume bottle in morning Mediterranean villa,
slow push-in camera movement toward product on marble surface,
golden hour natural lighting streaming through linen curtains,
atmospheric and contemplative pace, luxury fragrance brand aesthetic,
dust particles visible in light beams, 8 seconds, smooth gimbal motion',
  true
),

-- W: White Studio Clean
(
  'White Studio Clean',
  'white-studio-clean',
  'W',
  'image',
  'marketplace',
  'convert',
  ARRAY['reeves', 'hopkins'],
  'product',
  ARRAY['general'],
  'Clean white backgrounds for e-commerce and marketplaces',
  E'E-COMMERCE REQUIREMENTS:

1. BACKGROUND
Pure white (#FFFFFF)
No visible horizon line
Even, seamless white surrounding product

2. LIGHTING
Full, even illumination
No harsh shadows
Minimal to no bottom shadow (or very soft)
True color representation

3. PRODUCT POSITION
Centered in frame
Adequate padding (15-20% margins)
Consistent angle across product line
Front-facing or 3/4 view

4. FOCUS
Full product sharpness (f/8-f/11)
No bokeh, no blur effects
Edge-to-edge clarity

5. POST-PROCESSING
Background must be pure white
No color cast
Remove any dust or imperfections
Consistent across product line

AMAZON/SHOPIFY REQUIREMENTS:
• Main image: Product fills 85%+ of frame
• Pure white background
• No text, logos, or watermarks
• JPEG or PNG format
• Minimum 1000px on longest side

PROMPT STRUCTURE:
"Product photography of [product name],
pure white background, centered composition,
bright even studio lighting, no shadows,
e-commerce photography, marketplace ready,
sharp focus, clean isolated product shot"',
  E'White background photography is the foundation of e-commerce. It''s not glamorous, but it''s essential—and it must be done perfectly. Reeves would remind us: this is where the product must sell itself with no support. Hopkins would add: the lighting must be honest. Any tricks here will lead to disappointed customers.',
  E'Product photography of skincare bottle with pump,
pure white #FFFFFF background, perfectly centered composition,
bright even studio lighting eliminating all shadows,
e-commerce ready photograph, Amazon and Shopify compliant,
sharp focus edge to edge, clean isolated product shot,
true color representation, professional packshot',
  false
);

-- Mark featured image frameworks
UPDATE librarian_frameworks
SET is_featured = true
WHERE slug IN ('hero-product-shot', 'dark-moody-studio', 'atmospheric-lifestyle', 'video-scene-direction');

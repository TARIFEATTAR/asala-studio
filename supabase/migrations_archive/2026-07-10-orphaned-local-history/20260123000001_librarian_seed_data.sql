-- ============================================================================
-- THE LIBRARIAN - Initial Framework Seed Data
-- Madison Studio's curated marketing methodology library
--
-- Phase 1: 20 Core Copy Frameworks (A-W)
-- ============================================================================

-- Clear existing data (for development)
-- DELETE FROM librarian_frameworks;

-- ============================================================================
-- COPY FRAMEWORKS (A-Z)
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

-- A: Abandoned Cart Recovery
(
  'Abandoned Cart Recovery',
  'abandoned-cart-recovery',
  'A',
  'copy',
  'email',
  'convert',
  ARRAY['schwartz', 'hopkins'],
  'product',
  ARRAY['fragrance', 'skincare', 'general'],
  'Re-engage customers who left items in their cart with reason-why copy',
  E'SUBJECT LINE:
[Product Name] is still waiting for you

EMAIL STRUCTURE:

1. ACKNOWLEDGMENT (Schwartz - Product Aware)
Open with recognition that they were considering [Product Name].
No guilt, just gentle reminder.

2. REASON-WHY (Hopkins)
Why this product deserves a second look:
• [Specific benefit with proof]
• [Social proof element]
• [Scarcity or urgency if genuine]

3. OBJECTION HANDLING
Address the likely hesitation:
"Perhaps you wanted to consider [common objection]..."
Provide the reassurance.

4. DIGNIFIED CLOSE
Simple, single CTA. No pressure tactics.
"If it\'s meant to be, we\'ll be here."',
  E'The abandoned cart email is a delicate dance. Push too hard and you seem desperate; too soft and you\'re forgotten. Hopkins taught us that every claim needs a reason-why. So rather than "Come back!" we explain WHY this product is worth their attention. The key is treating the customer as someone who made a considered decision to pause—respect that, and give them new information to reconsider.',
  E'Subject: Your Moroccan Rose awaits

Still thinking about Moroccan Rose?

We noticed you were exploring our signature eau de parfum. These things shouldn\'t be rushed—fragrance is, after all, rather personal.

What you might want to know: This particular blend took our perfumer 14 months to perfect. The Damask rose is sourced from the Dadès Valley, harvested at dawn when the oil concentration peaks. That\'s why you\'ll notice it evolves over 8 hours on skin, rather than fading after 2.

If it calls to you, it\'ll be here. If not, we understand perfectly.

With warmth,
[Brand]',
  true
),

-- B: Blog Post (Long-form Authority)
(
  'Blog Post: Long-form Authority',
  'blog-post-authority',
  'B',
  'copy',
  'blog',
  'nurture',
  ARRAY['ogilvy', 'schwartz'],
  'solution',
  ARRAY['fragrance', 'skincare', 'wellness', 'general'],
  'SEO-driven thought leadership with Ogilvy''s specificity',
  E'STRUCTURE:

1. HEADLINE (Solution-Aware Hook)
Promise specific value. Use numbers where possible.
"The [X] Guide to [Specific Outcome]" or
"Why [Common Approach] Fails (And What Works Instead)"

2. INTRODUCTION (100-150 words)
• Hook with a relatable problem or surprising fact
• Establish credibility briefly
• Preview what they\'ll learn

3. BODY SECTIONS (300-500 words each)
Each section follows:
• Subhead (scannable, specific)
• Key insight or teaching
• Proof/evidence (Ogilvy\'s specificity)
• Practical application

4. EXPERT POSITIONING
Include ONE personal insight or behind-the-scenes detail.
This builds authority without being self-promotional.

5. CONCLUSION
• Summarize key takeaways
• Soft CTA (related content or newsletter)
• Leave them more informed than when they arrived',
  E'Long-form content is where Ogilvy\'s love of research truly shines. The internet is drowning in surface-level "5 Tips" posts. What cuts through is genuine expertise demonstrated through specificity. If you can cite the temperature at which a particular ingredient degrades, or the exact percentage improvement a technique provides—you\'ve earned their trust. The goal isn\'t to sell; it\'s to become the authoritative resource they return to.',
  NULL,
  false
),

-- C: Collection Launch Announcement
(
  'Collection Launch Announcement',
  'collection-launch-announcement',
  'C',
  'copy',
  'email',
  'launch',
  ARRAY['burnett', 'peterman', 'ogilvy'],
  'solution',
  ARRAY['fragrance', 'skincare', 'home_fragrance', 'fashion'],
  'New product line introductions with inherent drama',
  E'SUBJECT LINE OPTIONS:
"Introducing [Collection Name]" (classic)
"[Evocative phrase from collection theme]" (Peterman)
"After [X months/years], it\'s here" (anticipation)

EMAIL STRUCTURE:

1. THE REVEAL (Burnett''s Drama)
Open with the emotional atmosphere of the collection.
Paint the scene before naming products.
[Evocative sensory description - 2-3 sentences]

2. THE COLLECTION OVERVIEW
Name the collection with purpose.
What unites these pieces?
"[Collection Name]: [Tagline]"

3. INDIVIDUAL PIECES (Ogilvy''s Specificity)
For each product:
• Name
• One-line sensory description
• Single most compelling specific detail

4. THE STORY BEHIND (Peterman''s Romance)
Why this collection exists. The inspiration.
Keep it intimate, not corporate.

5. INVITATION TO EXPLORE
Single CTA. No discount—the newness IS the offer.
"Explore the Collection"',
  E'Leo Burnett believed every product has inherent drama waiting to be discovered. For a collection launch, that drama isn\'t in the products themselves—it\'s in the moment of unveiling. Peterman understood that customers buy the story as much as the product. So we open with atmosphere, build with specifics, and close with invitation. Notice there\'s no urgency or scarcity. New collections ARE scarce by nature; we don\'t need to manufacture it.',
  NULL,
  true
),

-- D: Discovery Set Introduction
(
  'Discovery Set Introduction',
  'discovery-set-introduction',
  'D',
  'copy',
  'web',
  'convert',
  ARRAY['hopkins', 'schwartz'],
  'solution',
  ARRAY['fragrance', 'skincare'],
  'Sample/trial set positioning with reason-why justification',
  E'PAGE STRUCTURE:

1. HEADLINE
"Experience [Brand] Before You Commit"
or "Your Personal [Category] Journey Starts Here"

2. THE PROPOSITION (Hopkins - Reason Why)
Explain WHY a discovery set makes sense:
• Fragrance/skincare is personal
• [X ml] is enough to truly know a product
• [Specific value: "6 full-size sprays" or "2 weeks of daily use"]

3. WHAT''S INCLUDED
Each product listed with:
• Name
• Size with context (not just "2ml" but "2ml - approximately 20 applications")
• Brief description
• Which skin type/preference it suits

4. THE ECONOMICS (if applicable)
"[Discovery price] • [Value if purchased separately: $X]"
Frame as investment in finding your perfect match.

5. NEXT STEPS
What happens after discovery?
Credit toward full size? Subscription option?

6. SINGLE, CLEAR CTA
"Begin Your Discovery"',
  E'Hopkins would approve of the discovery set concept—it\'s essentially a trial offer with reason-why backing. The key is framing it not as a discount but as an intelligent approach to personal products. Schwartz reminds us these customers are solution-aware: they know sampling exists, they know your brand exists. Our job is to convince them YOUR discovery experience is worth their time and modest investment.',
  NULL,
  false
),

-- E: Email Sequence (5-Part Narrative Arc)
(
  'Email Sequence: 5-Part Narrative Arc',
  'email-sequence-5-part',
  'E',
  'copy',
  'email',
  'nurture',
  ARRAY['schwartz', 'burnett', 'peterman'],
  'problem',
  ARRAY['fragrance', 'skincare', 'general'],
  'Progressive awareness email journey following Schwartz''s stages',
  E'EMAIL 1: THE HOOK
Awareness: Problem-Aware
Purpose: Acknowledge their pain, hint at solution
• Open with recognition of their struggle
• Share a brief story or observation
• End with intrigue (not a pitch)

EMAIL 2: THE DEEPENING
Awareness: Problem → Solution
Purpose: Educate on the real cause
• Explain why common solutions fail
• Introduce the principle behind your approach
• Build credibility through specificity

EMAIL 3: THE REVEAL
Awareness: Solution-Aware
Purpose: Introduce your product as the answer
• Connect the principle to your product
• Use Ogilvy''s specificity
• Include one testimonial or result

EMAIL 4: THE OBJECTION
Awareness: Product-Aware
Purpose: Address the hesitation
• Name the objection directly
• Provide the reason-why (Hopkins)
• Offer reassurance

EMAIL 5: THE INVITATION
Awareness: Most-Aware
Purpose: Dignified close
• Brief recap of value
• Clear, single CTA
• Scarcity of craft, not urgency tricks',
  E'The 5-part sequence follows Schwartz\'s awareness progression rather elegantly. Each email moves the reader one stage closer to purchase without ever feeling pushy. I particularly favour this structure for luxury brands because it respects the customer\'s decision-making process. Notice there are no countdown timers or "ACT NOW" nonsense—scarcity comes from the craft itself, not artificial pressure.',
  NULL,
  true
),

-- H: Homepage Hero
(
  'Homepage Hero Copy',
  'homepage-hero',
  'H',
  'copy',
  'web',
  'launch',
  ARRAY['reeves', 'burnett'],
  'unaware',
  ARRAY['fragrance', 'skincare', 'general'],
  'Above-fold brand positioning with USP clarity',
  E'STRUCTURE:

1. HEADLINE (Reeves'' USP)
One clear, memorable claim that only you can make.
Maximum 8 words. Must pass the "could a competitor say this?" test.
If yes, it''s not a USP.

2. SUBHEADLINE
Expand on the headline with one specific proof point.
15-20 words maximum.

3. BODY (if needed)
2-3 sentences maximum. Support the claim with:
• A specific detail
• Social proof element (subtle)
• Emotional benefit

4. CTA
Single, clear action. Matches the promise.
"Discover [Product/Collection]" not "Shop Now"

5. VISUAL DIRECTION NOTE
What imagery supports this message?
Hero product or atmospheric? Action or still?

TESTING FRAMEWORK:
• Can someone understand the brand in 5 seconds?
• Is the USP defensible and specific?
• Does the CTA align with the promise?',
  E'The homepage hero is the most ruthless piece of copy you\'ll write. You have perhaps 5 seconds to communicate who you are and why they should care. Reeves was adamant: if your competitor can say the same thing, it\'s not a USP. Burnett adds the drama—the emotional resonance that makes people pause. The combination is powerful: logical differentiation wrapped in emotional appeal.',
  NULL,
  true
),

-- L: Landing Page (Product)
(
  'Product Landing Page',
  'product-landing-page',
  'L',
  'copy',
  'web',
  'convert',
  ARRAY['ogilvy', 'hopkins', 'schwartz'],
  'product',
  ARRAY['fragrance', 'skincare', 'home_fragrance', 'general'],
  'High-conversion product pages with specificity and proof',
  E'PAGE STRUCTURE:

1. HERO SECTION
Product name (prominent)
One-line positioning statement
Hero image with key angles available

2. THE PROMISE (Above fold)
What will this product do for the customer?
Specific, measurable outcome if possible.

3. SPECIFICITY SECTION (Ogilvy)
The details that build credibility:
• Ingredients with sourcing
• Process with timeframes
• Concentrations with comparisons
• Certifications with meaning

4. SENSORY/EXPERIENCE SECTION
What is it LIKE to use this product?
Texture, scent evolution, ritual description.

5. REASON-WHY (Hopkins)
For each key claim, the justification:
"[Claim] because [specific reason]"

6. SOCIAL PROOF
Reviews, testimonials, press mentions.
Quality over quantity.

7. OBJECTION HANDLING
FAQ section addressing:
• Price justification
• Suitability questions
• Usage/application
• Shipping/returns

8. CTA SECTION
Product options, pricing, clear purchase path.
Trust signals (secure checkout, guarantee).',
  E'A product page is where Ogilvy and Hopkins collaborate beautifully. Ogilvy provides the specificity—the facts and details that make the product real. Hopkins provides the reason-why—the justification for why those details matter. Together, they create an irresistible case. Notice we place specificity BEFORE social proof; let the product speak first, then confirm with outside voices.',
  NULL,
  true
),

-- M: Mission Statement
(
  'Mission Statement',
  'mission-statement',
  'M',
  'copy',
  'web',
  'launch',
  ARRAY['wieden_kennedy', 'burnett'],
  'unaware',
  ARRAY['general'],
  'Brand purpose articulation with cultural authenticity',
  E'FRAMEWORK:

1. THE TENSION
What''s wrong with the current state of your industry/category?
One sentence that identifies the gap.

2. THE BELIEF
What do you believe to be true that others don''t?
This is your worldview, your philosophy.

3. THE ACTION
Therefore, what do you do differently?
How does your belief manifest in your work?

4. THE OUTCOME
What world are you creating for your customers?
Benefits framed as transformation.

STRUCTURE OPTIONS:

Option A - The Declaration:
"We believe [worldview]. That''s why we [action]. For people who [customer identity]."

Option B - The Question:
"What if [current state] could be [better state]? We think it can."

Option C - The Contrast:
"Most [category] companies [common approach]. We [different approach]. Because [worldview]."

TESTS:
• Is it true? (Can you prove it with your actions?)
• Is it unique? (Could a competitor say this?)
• Is it inspiring? (Does it make people want to join?)
• Is it actionable? (Can employees use it to make decisions?)',
  E'Mission statements are often the most over-worked, committee-driven pieces of copy in existence. Wieden+Kennedy\'s genius is in finding the cultural truth—the authentic position that resonates. Burnett adds drama: the mission should feel consequential, not corporate. The best test? If your employees can\'t recite it, it\'s too complicated. If competitors could say it, it\'s too generic.',
  NULL,
  false
),

-- N: Newsletter (Monthly Editorial)
(
  'Newsletter: Monthly Editorial',
  'newsletter-monthly',
  'N',
  'copy',
  'email',
  'nurture',
  ARRAY['peterman', 'ogilvy'],
  'problem',
  ARRAY['fragrance', 'skincare', 'wellness', 'general'],
  'Ongoing audience nurture with storytelling and value',
  E'STRUCTURE:

1. PERSONAL OPENING (2-3 sentences)
Start with a moment, observation, or thought from the founder/brand.
Genuine, not manufactured. Seasonal awareness optional.

2. MAIN FEATURE (40% of content)
One substantial piece of value:
• Behind-the-scenes of a product/process
• Educational content related to category
• Story about sourcing, creation, or craft
• Interview or profile

3. PRODUCT SPOTLIGHT (20% of content)
One product featured with fresh angle:
• Seasonal usage suggestion
• Customer story
• Pairing recommendations
• New way to experience it

4. QUICK LINKS (20% of content)
3-4 items, briefly annotated:
• Recent blog post
• Social content worth seeing
• External inspiration
• Community highlight

5. WARM CLOSE (10% of content)
Human sign-off. First name.
Optional: what you''re looking forward to next month.

TONE GUIDELINES:
• Write like a letter to a friend who shares your interests
• Peterman''s warmth, Ogilvy''s intelligence
• Information-rich, not purely promotional
• 80% value, 20% product',
  E'The monthly newsletter is your most intimate customer touchpoint. Peterman understood that customers want to feel part of something—privy to information the general public doesn\'t have. Ogilvy reminds us this doesn\'t mean dumbing down; your subscribers signed up because they\'re interested. Give them substance. The 80/20 value-to-promotion ratio is crucial: earn the right to mention products by providing genuine value first.',
  NULL,
  false
),

-- O: Origin Story
(
  'Origin Story',
  'origin-story',
  'O',
  'copy',
  'web',
  'nurture',
  ARRAY['peterman', 'burnett'],
  'unaware',
  ARRAY['general'],
  'Founder and brand narrative with emotional resonance',
  E'STRUCTURE:

1. THE INCITING INCIDENT
What moment sparked the brand?
Be specific: time, place, sensory details.

2. THE PROBLEM RECOGNIZED
What did you notice that others didn''t?
What bothered you enough to act?

3. THE JOURNEY
Key moments of development:
• Early experiments
• Pivotal lessons
• Mentors or influences
• Setbacks that shaped you

4. THE BREAKTHROUGH
When did it crystallize?
The moment it became real.

5. THE PRESENT
Where you are now.
Keep it humble but confident.

6. THE FUTURE (optional)
Where you''re going.
Vision without over-promising.

NARRATIVE TECHNIQUES:
• Specific sensory details (Peterman)
• Dramatic tension and resolution (Burnett)
• Show vulnerability without victimhood
• Let the reader feel they discovered something

AVOID:
• Abstract corporate language
• Exhaustive chronology
• Unearned claims of innovation
• Name-dropping without purpose',
  E'Every brand has an origin story; few tell it well. Peterman was a master of the romantic narrative—making everyday moments feel significant. Burnett understood dramatic structure: tension, complication, resolution. Together, they teach us that an origin story isn\'t a timeline; it\'s a revelation. The reader should feel they\'ve learned something true about who you are and why you care.',
  NULL,
  false
),

-- P: Product Description (Marketplace-Optimised)
(
  'Product Description: Marketplace-Optimised',
  'product-description-marketplace',
  'P',
  'copy',
  'marketplace',
  'convert',
  ARRAY['ogilvy', 'hopkins', 'reeves'],
  'product',
  ARRAY['fragrance', 'skincare', 'home_fragrance'],
  'Shopify/Etsy/Amazon optimised with specificity and USP',
  E'STRUCTURE:

1. OPENING HOOK (Reeves'' USP)
Lead with what only you can claim.
[Insert unique differentiator—sourcing, process, formulation]

2. SPECIFICITY SECTION (Ogilvy)
Concrete, measurable details:
• [Percentage/concentration]
• [Origin/source]
• [Process duration]
• [Certification/standard]

3. REASON-WHY (Hopkins)
Connect features to benefits:
"[Feature] means [benefit] because [reason]"

4. SENSORY DESCRIPTION (Burnett''s Drama)
Paint the experience:
[Scent journey / Texture feel / Visual impact]

5. PRACTICAL DETAILS
• Size/volume with context
• Usage instructions
• Shelf life/storage
• What''s included

6. DIGNIFIED CLOSE
Invite rather than push.
"For those who [customer identity]"

MARKETPLACE-SPECIFIC:
• Front-load keywords naturally
• Use bullet points for scannability
• Include comparison context
• Address common questions inline',
  E'This framework works rather beautifully for luxury e-commerce because it respects the customer\'s intelligence whilst building irrefutable credibility. I\'ve found that specificity—the precise details Ogilvy championed—does most of the heavy lifting. When you write \'seven-year aged Cambodian oud\' rather than \'premium ingredients,\' you\'ve already won half the battle. The reason-why section is where Hopkins\' genius shines: don\'t simply claim, justify.',
  E'MOROCCAN ROSE EAU DE PARFUM | 50ml

Distilled from 10,000 Damask rose petals harvested at dawn in Morocco\'s Dadès Valley.

• 22% concentration (parfum strength)
• 48-hour cold maceration process
• Single-origin, single-harvest (Spring 2024)
• Certified organic Rosa damascena

Why dawn harvesting matters: Rose oil content peaks in the 2 hours after sunrise. Later harvesting yields 40% less fragrance intensity.

The experience: Opens with dew-fresh petals, evolves through honeyed warmth over 8 hours, settles into soft, powdery intimacy.

50ml spray bottle with magnetic cap.
For those who believe fragrance should tell a story.

£185 | Free UK shipping',
  true
),

-- S: SMS Alert
(
  'SMS Alert',
  'sms-alert',
  'S',
  'copy',
  'sms',
  'convert',
  ARRAY['reeves', 'hopkins'],
  'most',
  ARRAY['fragrance', 'skincare', 'general'],
  '160-character precision for high-intent moments',
  E'SMS TYPES & TEMPLATES:

1. BACK IN STOCK
"[Product] is back. Limited restock of [X] bottles. [Link]"
(Focus on scarcity truth, not manufactured urgency)

2. ORDER UPDATE
"Your [Brand] order has shipped. Track: [link]. Arrives [date]."
(Information first, brand building through reliability)

3. FLASH OFFER (use sparingly)
"[Subscriber exclusive] [Offer]. Today only. [Link]"
(The offer must be genuinely exclusive)

4. NEW LAUNCH
"[New product] is live. First to know: [link]"
(Reward their subscription with early access)

5. CART REMINDER
"Still thinking about [Product]? It\'s waiting: [link]"
(Gentle, not pushy)

CHARACTER RULES:
• 160 characters standard
• Include brand name once
• Shorten links uniformly
• No caps lock enthusiasm
• One CTA per message

TONE:
• Brief ≠ cold
• Efficient ≠ robotic
• Maintain brand voice in miniature',
  E'SMS is where Reeves\' USP discipline becomes essential. You have 160 characters to be useful, on-brand, and respectful of someone\'s personal device. Hopkins reminds us that every claim needs justification—but in SMS, the justification IS the relevance. Only message when you have genuine value to offer. The moment you become noise, you\'re deleted.',
  NULL,
  false
),

-- T: Testimonial Integration
(
  'Testimonial Integration',
  'testimonial-integration',
  'T',
  'copy',
  'web',
  'convert',
  ARRAY['ogilvy', 'hopkins'],
  'product',
  ARRAY['general'],
  'Social proof weaving with credibility and specificity',
  E'GATHERING FRAMEWORK:

1. PROMPT QUESTIONS (for customers)
• "What were you using before [product]?"
• "What specific difference have you noticed?"
• "How would you describe [product] to a friend?"
• "What surprised you about it?"

2. SELECTION CRITERIA
Choose testimonials that include:
• Specific details (not just "I love it")
• Before/after context
• Unexpected benefits
• Professional relevance (if applicable)

INTEGRATION PATTERNS:

A. INLINE PROOF
Weave short quotes into product descriptions:
"What our customers call \'the 8-hour staying power\'..."

B. OBJECTION-SPECIFIC
Match testimonials to common concerns:
Concern: "Is it worth the price?"
Testimonial: "[Quote about value/quality]"

C. STORY FORMAT
Longer testimonials as micro-case-studies:
• Before state
• Discovery moment
• After state
• Specific results

D. EXPERT ENDORSEMENT
Industry professional perspectives.
Include credentials briefly.

AVOID:
• Cherry-picking only superlatives
• Editing away specificity
• Displaying without context
• Overwhelming with quantity',
  E'Ogilvy loved research because it provided proof. Hopkins demanded reason-why for every claim. Testimonials are where customers provide both—if we select and present them well. The key is specificity: "I love it" tells us nothing; "I finally found something that lasts through my 12-hour shifts" tells us everything. Your job is to prompt for specifics and then get out of the way.',
  NULL,
  false
),

-- W: Win-back Email
(
  'Win-back Email',
  'winback-email',
  'W',
  'copy',
  'email',
  'winback',
  ARRAY['schwartz', 'peterman'],
  'product',
  ARRAY['fragrance', 'skincare', 'general'],
  'Lapsed customer re-engagement with dignity',
  E'STRUCTURE:

1. SUBJECT LINE
Acknowledge time has passed without desperation:
"It\'s been a while" (not "We miss you!!!")
"What you might have missed"
"When you\'re ready"

2. OPENING
Acknowledge the gap respectfully.
No guilt, no false familiarity.
"We noticed it\'s been some time since your last visit."

3. WHAT''S NEW (Schwartz - Product Aware reminder)
If they loved you once, remind them why:
• New products they haven''t seen
• Improvements since they left
• Stories and developments

4. THE PETERMAN TOUCH
One small, human detail:
A snippet of what''s been happening.
Behind-the-scenes moment.

5. NO-PRESSURE CLOSE
Invitation, not demand.
"If your tastes have changed, we completely understand."
"We\'ll be here when it feels right."

6. EASY OPTIONS
Unsubscribe prominent
Preference update available
No hoops to jump through

AVOID:
• "We miss you!" (presumptuous)
• Discount as first resort
• Making them feel guilty
• Multiple CTAs',
  E'Win-back emails test your brand\'s character. The temptation is desperation: discounts, guilt trips, all-caps enthusiasm. But Schwartz reminds us these customers are product-aware—they know you exist, they\'ve purchased before. Something changed. Peterman shows us the path: be human, be dignified, and trust that if the relationship was genuine, space for reconnection exists. The best win-back email reads like a note from someone who respects the customer\'s autonomy.',
  NULL,
  false
);

-- ============================================================================
-- ADD MORE FEATURED FLAGS
-- ============================================================================

UPDATE librarian_frameworks
SET is_featured = true
WHERE slug IN ('abandoned-cart-recovery', 'collection-launch-announcement', 'email-sequence-5-part', 'homepage-hero', 'product-landing-page', 'product-description-marketplace');

-- ============================================================================
-- VERIFY INSERTION
-- ============================================================================

-- SELECT title, sort_letter, category, array_to_string(masters, ', ') as masters
-- FROM librarian_frameworks
-- ORDER BY sort_letter;

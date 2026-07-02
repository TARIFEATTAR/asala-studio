# Madison Studio - Project Reference Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Design System](#design-system)
3. [Feature Documentation](#feature-documentation)
4. [Content Type System](#content-type-system)
5. [Data Architecture](#data-architecture)
6. [UI/UX Patterns](#uiux-patterns)
7. [Brand Voice Guidelines](#brand-voice-guidelines)
8. [File Structure](#file-structure)
9. [Key Configuration Files](#key-configuration-files)
10. [Integration Points](#integration-points)

---

## Project Overview

### Project Identity
- **Name**: Madison Studio
- **Tagline**: Brand Intelligence Platform
- **Core Purpose**: AI-powered content creation system that enforces brand voice through uploaded brand guidelines

### Technology Stack
- **Frontend**: React 18.3.1 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Backend**: Supabase (via Lovable Cloud)
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v6
- **AI Integration**: Claude AI (Anthropic) via edge functions
- **Image Generation**: Nano image generation

### Design Philosophy
**"The Codex"** - A museum-quality, intimate luxury aesthetic inspired by David Ogilvy's editorial approach. Think leather-bound journals, brass accents, cream paper, and black ink. The design evokes traditional publishing houses with modern sophistication.

### Core Value Propositions
1. **Brand Consistency**: Upload brand guidelines once, enforce across all content
2. **Efficient Content Creation**: Generate master content, then repurpose into multiple formats
3. **Editorial Excellence**: AI-powered assistant helps refine and polish content
4. **Strategic Planning**: Calendar integration for content scheduling and campaign management

---

## Design System

### The Codex Design System
**Theme**: Black Books & Cream Paper

#### Color Palette

##### Neutrals Foundation
```css
--ink-black: #1A1816         /* Navigation, primary buttons, deep text */
--charcoal: #2F2A26          /* Body text, secondary buttons */
--warm-gray: #6B6560         /* Secondary text, muted elements */
--soft-gray: #A8A39E         /* Tertiary text, disabled states */
--stone: #D4CFC8             /* Borders, dividers */
--vellum-cream: #F5F1E8      /* Page background */
--parchment-white: #FFFCF5   /* Card backgrounds, input fields */
```

##### Brand Accents
```css
--aged-brass: #B8956A        /* Primary accent, CTA buttons */
--brass-glow: #D4AF37        /* Hover states, focus rings */
--antique-gold: #D4AF37      /* Secondary accent */
--deep-burgundy: #6B2C3E     /* Error states, destructive actions */
--forest-ink: #3A4A3D        /* Success states, confirmations */
--midnight-blue: #2C3E50     /* Info states, secondary CTAs */
```

##### Derivative Type Colors
```css
--email: #3B82F6             /* Email content (Blue) */
--instagram: #A855F7         /* Instagram posts (Purple) */
--twitter: #0EA5E9           /* Twitter threads (Sky blue) */
--product: #FB923C           /* Product descriptions (Orange) */
--sms: #22C55E               /* SMS messages (Green) */
--linkedin: #3B82F6          /* LinkedIn posts (Professional blue) */
--visual: #EC4899            /* Visual assets (Pink) */
```

#### Typography System

##### Font Families
- **Serif**: `Cormorant Garamond` - Headlines, editorial elements, display text
- **Sans**: `Lato` - Body text, UI elements, labels
- **Accent**: `Crimson Text` - Editorial quotes, italicized emphasis

##### Type Scale
```css
/* Display (h1) */
font-size: 48px
font-weight: 600
letter-spacing: -0.02em
line-height: 1.2

/* Section Headers (h2) */
font-size: 36px
font-weight: 600
letter-spacing: -0.01em
line-height: 1.3

/* Card Titles (h3) */
font-size: 24px
font-weight: 500
line-height: 1.4

/* Subsections (h4) */
font-size: 20px
font-weight: 500
line-height: 1.5

/* Body Large */
font-size: 18px
line-height: 1.7

/* Body Regular */
font-size: 16px
line-height: 1.6

/* Body Small */
font-size: 14px
line-height: 1.5

/* Label Tiny */
font-size: 12px
font-weight: 500
text-transform: uppercase
letter-spacing: 0.03em
```

#### Shadow System

```css
/* Level 1 - Resting cards */
--shadow-sm: 0 2px 4px rgba(26, 24, 22, 0.1)

/* Level 2 - Hover states */
--shadow-md: 0 4px 12px rgba(26, 24, 22, 0.15)

/* Level 3 - Modals, dropdowns */
--shadow-lg: 0 8px 24px rgba(26, 24, 22, 0.2)

/* Level 4 - High elevation */
--shadow-xl: 0 16px 48px rgba(26, 24, 22, 0.25)

/* Brass Glow - Primary actions, focused inputs */
--shadow-brass: 0 0 0 3px rgba(212, 175, 55, 0.3)
```

#### Gradient System

```css
/* Brass Gradient - Primary buttons, accents */
--gradient-brass: linear-gradient(135deg, #B8956A 0%, #D4AF37 100%)

/* Paper Gradient - Subtle backgrounds */
--gradient-paper: linear-gradient(180deg, #FFFCF5 0%, #F5F1E8 100%)

/* Ink Gradient - Dark overlays */
--gradient-ink: linear-gradient(180deg, rgba(26, 24, 22, 0) 0%, rgba(26, 24, 22, 0.8) 100%)
```

#### Component Patterns

##### Cards
```css
.card-luxury {
  background: var(--parchment-white);
  border: 1px solid var(--stone);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
  transition: all 0.3s ease;
}

.card-editorial {
  background: var(--parchment-white);
  border-left: 4px solid var(--aged-brass);
  padding: 24px;
}
```

##### Buttons
```css
.btn-primary-luxury {
  background: var(--ink-black);
  color: var(--parchment-white);
  border: 2px solid var(--aged-brass);
  transition: all 0.3s ease;
}

.btn-brass-luxury {
  background: linear-gradient(135deg, #B8956A 0%, #D4AF37 100%);
  color: var(--ink-black);
  font-weight: 600;
}

.btn-secondary-luxury {
  background: transparent;
  color: var(--charcoal);
  border: 2px solid var(--stone);
}
```

##### Badges
```css
.badge-luxury {
  background: rgba(184, 149, 106, 0.15);
  color: var(--aged-brass);
  border: 1px solid rgba(184, 149, 106, 0.3);
  backdrop-filter: blur(8px);
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
```

##### Inputs
```css
.input-luxury {
  background: var(--parchment-white);
  border: 2px solid var(--stone);
  color: var(--charcoal);
  font-size: 16px;
  transition: all 0.3s ease;
}

.input-luxury:focus {
  border-color: var(--aged-brass);
  box-shadow: var(--shadow-brass);
}

.input-manuscript {
  background: var(--vellum-cream);
  border: none;
  font-family: 'Crimson Text', serif;
  font-size: 18px;
  line-height: 1.8;
}
```

##### Dividers
```css
.brass-divider {
  height: 2px;
  background: linear-gradient(90deg, transparent 0%, var(--aged-brass) 50%, transparent 100%);
  margin: 32px 0;
  position: relative;
}

.brass-divider::after {
  content: '◆';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  background: var(--vellum-cream);
  padding: 0 16px;
  color: var(--aged-brass);
}
```

---

## Feature Documentation

### 1. Library (The Archives / Reservoir)

**Purpose**: Central repository for all created content, both master pieces and derivative assets.

**Key Features**:
- Browse master content and generated outputs
- Filter by content type, collection, DIP week
- Search functionality with real-time results
- Archive/unarchive content
- View density toggle (comfortable/compact)
- Sort options (newest, oldest, recently updated, A-Z)
- Date grouping (Today, This Week, Last Week, Earlier)

**User Flows**:
1. **Browse Content**: User lands on grid view of all content
2. **Filter Content**: Use sidebar to filter by type, collection, week
3. **View Details**: Click card to open full modal with content preview
4. **Archive**: Move old content to archive to declutter main view
5. **Search**: Type to filter results in real-time

**Components**:
- `src/pages/Reservoir.tsx` - Main library page
- `src/components/library/ContentGrid.tsx` - Grid layout
- `src/components/library/ContentDetailModal.tsx` - Full content view
- `src/components/library/ViewDensityToggle.tsx` - Density control
- `src/components/library/SortDropdown.tsx` - Sort options
- `src/components/library/DateGroupHeader.tsx` - Date grouping headers

---

### 2. Composer (The Editorial Desk / Forge)

**Purpose**: AI-powered content creation workspace with two distinct modes.

#### Mode 1: Single Content Generation
Generate individual content pieces directly without creating master content first.

**Content Types**:
- Blog posts (Philosophy, Educational, Announcement)
- Email newsletters
- Product stories
- Brand announcements
- Visual assets (AI image generation)

**Blog Post Options**:
- **Post Type**: Philosophy, Educational, Announcement
- **Word Count**: 500, 750, 1000, 1250, 1500+ words
- **Subject**: Main topic
- **Themes**: Supporting themes (comma-separated)
- **Takeaway**: Key message for reader

**User Flow**:
1. Select "Single Content" mode
2. Choose content type
3. Fill in content details (product, subject, themes, etc.)
4. Add custom instructions
5. Click "Generate with Claude"
6. Review output with quality rating
7. Use Editorial Assistant to refine
8. Save to library

#### Mode 2: Master Content Generation
Create long-form master content designed to be repurposed into multiple derivative formats.

**Master Content Types**:
- Blog posts (500-1000+ words)
- Email newsletters
- Product stories (100-300 words)
- Brand announcements

**User Flow**:
1. Select "Master Content" mode
2. Choose master content type
3. Fill in all content details
4. Generate with Claude
5. Review and refine with Editorial Assistant
6. Save as master content
7. Navigate to Amplify to repurpose

**Components**:
- `src/pages/Forge.tsx` - Main composer page
- `src/components/forge/BlogPostForm.tsx` - Blog-specific form
- `src/components/forge/MasterContentForm.tsx` - Master content form
- `src/components/forge/VisualAssetForm.tsx` - Image generation form
- `src/components/forge/ContentOutput.tsx` - Generated content display
- `src/components/forge/ProductSelector.tsx` - Product selection
- `src/components/assistant/EditorialAssistant.tsx` - AI refinement panel
- `src/components/QualityRating.tsx` - 1-5 star rating

**Editorial Assistant Features**:
- Ask questions about the content
- Request specific revisions
- Check brand voice alignment
- Suggest improvements
- Refine tone and style

---

### 3. Amplify (The Syndicate / Repurpose)

**Purpose**: Transform master content into derivative assets optimized for specific channels.

**Derivative Types**:

1. **Email**
   - Single adapted email
   - 3-part email sequence
   - 5-part email sequence  
   - 7-part email sequence

2. **Instagram**
   - Carousel posts (multiple slides)
   - Optimized for visual platform

3. **Twitter**
   - Thread format
   - Character-optimized

4. **Product**
   - Short sales-focused descriptions
   - E-commerce optimized

5. **SMS**
   - 160 character limit
   - Direct, concise messaging

6. **LinkedIn**
   - Professional tone
   - Industry-appropriate

**User Flow**:
1. Select master content from library
2. View master content in left panel
3. Browse derivative type folders
4. Click folder to expand and see generated derivatives
5. Click derivative card to view full content
6. Approve or regenerate as needed
7. Schedule to calendar or download

**Organization**:
- Folder-based UI grouped by derivative type
- Each folder shows count of derivatives
- Cards show preview, status (draft/approved), and metadata
- Full modal view with edit capabilities

**Components**:
- `src/pages/Repurpose.tsx` - Main amplify page
- `src/components/amplify/MasterContentSwitcher.tsx` - Master content selector
- `src/components/amplify/MasterContentLibrarySection.tsx` - Master content display
- `src/components/amplify/DerivativeTypeFolder.tsx` - Folder UI
- `src/components/amplify/DerivativeFolderSidebar.tsx` - Type list sidebar
- `src/components/amplify/DerivativeGridCard.tsx` - Derivative cards
- `src/components/amplify/DerivativeFullModal.tsx` - Full content view

---

### 4. Prompt Library

**Purpose**: Store and manage proven prompt templates for consistent content generation.

**Features**:
- Save successful prompts for reuse
- Organize by content type
- Filter by collection
- Mark favorites
- Template-only view
- Load directly into Composer

**Sidebar Filters**:
- Content types (with counts)
- Collections (Humanities, Reserve, Purity, Elemental)
- Favorites only
- Templates only
- Clear all filters

**User Flow**:
1. Browse prompt library
2. Filter by content type or collection
3. Click prompt card to view details
4. Load prompt into Composer
5. Modify and generate new content

**Components**:
- `src/pages/PromptLibrary.tsx` - Main prompt library page
- `src/components/prompt-library/EnhancedPromptCard.tsx` - Prompt cards
- `src/components/prompt-library/PromptDetailModal.tsx` - Full prompt view
- `src/components/prompt-library/PromptLibrarySidebar.tsx` - Filter sidebar

---

### 5. Calendar (The Planner)

**Purpose**: Strategic content planning and scheduling with Google Calendar integration.

**Views**:
- **Month View**: High-level overview with event dots
- **Week View**: Detailed weekly schedule with time slots

**Features**:
- Google Calendar two-way sync
- Schedule content from Amplify
- Add manual events
- Task management per day
- Notes panel for each day
- DIP week tracking badges
- Color-coded events by type

**User Flow**:
1. View calendar in month or week mode
2. Click date to open schedule modal
3. Add content, events, or tasks
4. Sync with Google Calendar
5. View and edit notes for each day
6. Track DIP week progression

**Components**:
- `src/pages/Calendar.tsx` - Main calendar page
- `src/components/calendar/MonthView.tsx` - Monthly calendar
- `src/components/calendar/WeekView.tsx` - Weekly schedule
- `src/components/calendar/CalendarHeader.tsx` - Navigation controls
- `src/components/calendar/ScheduleModal.tsx` - Event creation/editing
- `src/components/calendar/GoogleCalendarConnect.tsx` - OAuth integration
- `src/components/calendar/TasksList.tsx` - Daily tasks
- `src/components/calendar/NotesPanel.tsx` - Day notes

**Google Calendar Integration**:
- OAuth2 authentication flow
- Sync scheduled content to Google Calendar
- Two-way sync (view Google events in app)
- Automatic refresh

---

### 6. Settings

**Purpose**: Configure brand identity, products, and organization settings.

**Tabs**:

#### Brand Guidelines
- **Logo Upload**: Primary brand logo
- **Color Palette**: Brand colors with hex codes
- **Typography**: Font families and usage
- **Voice & Tone**: Brand voice guidelines
- **Brand Document**: Upload comprehensive brand guide PDF

#### Products Management
- **CSV Upload**: Bulk product import
- **Manual Entry**: Add individual products
- **Product Fields**:
  - Title
  - Category
  - Description
  - Price
  - Image URL
  - Additional metadata

#### Organization
- Organization name
- Industry
- Target audience
- Website URL
- Social media profiles

**Components**:
- `src/pages/Settings.tsx` - Main settings page
- `src/components/settings/BrandGuidelinesTab.tsx` - Brand config
- `src/components/settings/ProductsTab.tsx` - Product management

---

## Content Type System

### Master Content Types
Created in **Composer**, designed for long-form original content that can be repurposed.

| Type | Internal Name | Description | Word Count |
|------|---------------|-------------|------------|
| Blog Post | `blog_post` | Long-form narrative content | 500-1500+ words |
| Email Newsletter | `email_newsletter` | Original newsletter piece | 400-800 words |
| Product Story | `product_story` | Product narrative | 100-300 words |
| Brand Announcement | `brand_announcement` | Important updates | 200-500 words |

### Derivative Asset Types
Generated in **Amplify**, optimized for specific distribution channels.

| Type | Internal Name | Description | Format |
|------|---------------|-------------|---------|
| Email (Single) | `email` | Adapted single email | Plain text/HTML |
| Email 3-Part | `email_3part` | 3-email sequence | Series |
| Email 5-Part | `email_5part` | 5-email sequence | Series |
| Email 7-Part | `email_7part` | 7-email sequence | Series |
| Instagram | `instagram` | Carousel post | Multi-slide |
| Twitter | `twitter` | Twitter thread | Thread format |
| Product | `product` | Short sales copy | 50-150 words |
| SMS | `sms` | Text message | 160 chars max |
| LinkedIn | `linkedin` | Professional post | LinkedIn format |

### Single Content Types
Generated directly in **Composer**, standalone pieces not designed for repurposing.

| Type | Internal Name | Description |
|------|---------------|-------------|
| Visual Asset | `visual` | AI-generated image | Image file |

### Content Type Mapping

**File**: `src/utils/contentTypeMapping.ts`

```typescript
export const contentTypeDisplayNames: Record<string, string> = {
  blog_post: "Blog Post",
  email_newsletter: "Email Newsletter",
  product_story: "Product Story",
  brand_announcement: "Brand Announcement",
  email: "Email",
  email_3part: "Email 3-Part Series",
  email_5part: "Email 5-Part Series",
  email_7part: "Email 7-Part Series",
  instagram: "Instagram",
  twitter: "Twitter",
  product: "Product",
  sms: "SMS",
  linkedin: "LinkedIn",
  visual: "Visual Asset"
};
```

---

## Data Architecture

### Database Schema

#### Core Tables

**organizations**
```sql
- id (uuid, primary key)
- name (text)
- created_at (timestamp)
- updated_at (timestamp)
- brand_colors (jsonb)
- brand_fonts (jsonb)
- brand_voice (text)
- logo_url (text)
```

**profiles**
```sql
- id (uuid, primary key)
- user_id (uuid, references auth.users)
- display_name (text)
- organization_id (uuid, references organizations)
- created_at (timestamp)
- updated_at (timestamp)
```

**master_content**
```sql
- id (uuid, primary key)
- organization_id (uuid, references organizations)
- title (text)
- content (text)
- content_type (text) -- blog_post, email_newsletter, etc.
- product_id (uuid, references products)
- collection_id (uuid, references collections)
- metadata (jsonb) -- subject, themes, takeaway, etc.
- created_at (timestamp)
- updated_at (timestamp)
- archived_at (timestamp, nullable)
```

**derivative_assets**
```sql
- id (uuid, primary key)
- master_content_id (uuid, references master_content)
- organization_id (uuid, references organizations)
- title (text)
- content (text)
- derivative_type (text) -- email, instagram, twitter, etc.
- status (text) -- draft, approved, published
- scheduled_date (timestamp, nullable)
- metadata (jsonb)
- created_at (timestamp)
- updated_at (timestamp)
```

**prompts**
```sql
- id (uuid, primary key)
- organization_id (uuid, references organizations)
- title (text)
- prompt_text (text)
- content_type (text)
- collection_id (uuid, references collections)
- is_favorite (boolean)
- is_template (boolean)
- created_at (timestamp)
- updated_at (timestamp)
```

**outputs**
```sql
- id (uuid, primary key)
- organization_id (uuid, references organizations)
- title (text)
- content (text)
- content_type (text)
- quality_rating (integer) -- 1-5 stars
- metadata (jsonb)
- created_at (timestamp)
- updated_at (timestamp)
- archived_at (timestamp, nullable)
```

**products**
```sql
- id (uuid, primary key)
- organization_id (uuid, references organizations)
- title (text)
- category (text)
- description (text)
- price (numeric)
- image_url (text)
- metadata (jsonb)
- created_at (timestamp)
- updated_at (timestamp)
```

**collections**
```sql
- id (uuid, primary key)
- name (text) -- Humanities, Reserve, Purity, Elemental
- description (text)
- icon (text)
- color (text)
- created_at (timestamp)
```

**scheduled_content**
```sql
- id (uuid, primary key)
- organization_id (uuid, references organizations)
- content_id (uuid) -- References either master_content or derivative_assets
- content_type (text) -- master or derivative
- scheduled_date (timestamp)
- event_title (text)
- notes (text)
- google_calendar_event_id (text, nullable)
- created_at (timestamp)
- updated_at (timestamp)
```

### Collections System

**The Four Product Line Collections**:

1. **Humanities**
   - Icon: Sparkles
   - Theme: Accessible sophistication
   - Positioning: Everyday luxury that makes fine fragrance approachable
   - Legacy Name: Cadence

2. **Reserve**
   - Icon: Crown
   - Theme: Premium exclusivity
   - Positioning: Limited edition, high-end products for discerning customers

3. **Purity**
   - Icon: Droplet
   - Theme: Clean, minimalist elegance
   - Positioning: Simple formulations with transparent ingredient sourcing

4. **Elemental**
   - Icon: Home
   - Theme: Raw, foundational beauty
   - Positioning: Essential products celebrating natural ingredients
   - Legacy Name: Sacred Space

**Note**: Collections represent product line groupings, not content categories. See `COLLECTIONS_TERMINOLOGY.md` for detailed reference.

### DIP Week System

**DIP = Distillation in Progress**

A 4-week content production cycle:

- **Week 1**: Planning and ideation (Purple badge)
- **Week 2**: Creation and drafting (Blue badge)
- **Week 3**: Refinement and editing (Yellow badge)
- **Week 4**: Publication and distribution (Green badge)

**Implementation**:
- Custom hook: `src/hooks/useDipWeekCalculation.ts`
- Tracks week number since a defined start date
- Displays colored badge on calendar
- Helps teams stay on production schedule

---

## UI/UX Patterns

### Navigation Structure

**Top Navigation** (Sticky):
- Black background with brass accents
- Logo on left
- Main sections: Library, Prompts, Composer, Amplify, Planner, Settings
- Logout button on right
- Active state: Brass underline
- Component: `src/components/Navigation.tsx`

### Editorial Aesthetic Patterns

**Terminology**:
- "The Archives" instead of "Library"
- "The Editorial Desk" instead of "Composer"
- "The Syndicate" instead of "Amplify"
- "The Planner" instead of "Calendar"
- "Edition:" labels for type selectors
- "Master Manuscript" for master content
- "Derivative Editions" for repurposed content

**Visual Elements**:
- Left-aligned layouts (David Ogilvy editorial style)
- Brass dividers with diamond ornaments
- Paper texture overlay on backgrounds
- Dark cards with light text for premium feel
- Generous whitespace
- Editorial quotes in Crimson Text italic
- "Published:" timestamps with pen icon

**Background Treatment**:
```css
/* Subtle paper texture */
.paper-overlay {
  background-image: 
    linear-gradient(45deg, transparent 48%, rgba(184, 149, 106, 0.03) 50%, transparent 52%),
    linear-gradient(-45deg, transparent 48%, rgba(184, 149, 106, 0.03) 50%, transparent 52%);
  background-size: 8px 8px;
}
```

### Interaction Patterns

**Hover States**:
- Cards: Lift with shadow increase and brass border
- Buttons: Brass glow shadow
- Links: Brass underline slide-in
- Transition: `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`

**Modal Animations**:
- Scale in: `scale(0.95)` to `scale(1)`
- Fade in: `opacity-0` to `opacity-100`
- Duration: 300ms
- Backdrop blur: 8px

**Loading States**:
- Shimmer effect on skeleton screens
- Brass spinner for primary actions
- Subtle pulse on loading cards
- Loading text: "Generating with Claude..."

**Toast Notifications**:
- Position: Bottom right
- Style: Dark background, brass accent border
- Auto-dismiss: 3-5 seconds
- Actions: Success (green), Error (burgundy), Info (blue)

**Accordion Behavior**:
- Smooth expand/collapse
- Arrow rotation indicator
- Single item open by default
- Brass accent when active

---

## Brand Voice Guidelines

### Writing Principles

**Do's**:
- Use sophisticated fragrance terminology
- Maintain editorial, magazine-quality tone
- Reference specific product details
- Employ storytelling techniques
- Include sensory descriptions
- Cite traditional distillation methods
- Mention ethical sourcing practices
- Write in clear, concise sentences
- Use active voice predominantly

**Don'ts**:
- Avoid generic marketing clichés
- Don't overuse emojis (1-2 max per piece)
- Skip vague descriptions like "amazing" or "incredible"
- Avoid ALL CAPS (except brand names)
- Don't use excessive exclamation points
- Skip clickbait language
- Avoid jargon without explanation

### Forbidden Marketing Clichés

- "Game-changer"
- "Revolutionary"
- "One-of-a-kind"
- "Like no other"
- "Best kept secret"
- "You won't believe"
- "Mind-blowing"

### Approved Vocabulary

**Fragrance Terms**:
- Top notes, heart notes, base notes
- Sillage, longevity, projection
- Accords, blends, compositions
- Distillation, extraction, infusion

**Editorial Phrases**:
- "Thoughtfully crafted"
- "Carefully curated"
- "Mindfully sourced"
- "Expertly blended"
- "Traditionally distilled"

### Tone Guidelines

**Brand Personality**:
- Sophisticated yet approachable
- Knowledgeable without pretension
- Warm and inviting
- Confident but not arrogant
- Educational without being preachy

**Voice Attributes**:
- Authoritative
- Elegant
- Warm
- Authentic
- Refined

---

## File Structure

```
scriptora/
│
├── public/
│   ├── logo-full.png              # Full brand logo
│   ├── logo.png                   # Icon logo
│   ├── products_cleaned.csv       # Sample product data
│   └── robots.txt                 # SEO configuration
│
├── src/
│   ├── assets/                    # Static images and icons
│   │   ├── hero-pen.jpeg
│   │   ├── pen-hero.jpg
│   │   ├── scriptora-logo.png
│   │   └── [icon files].png
│   │
│   ├── components/
│   │   ├── ui/                    # Base shadcn components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   └── [other UI primitives]
│   │   │
│   │   ├── amplify/               # Repurpose feature components
│   │   │   ├── MasterContentSwitcher.tsx
│   │   │   ├── DerivativeTypeFolder.tsx
│   │   │   ├── DerivativeGridCard.tsx
│   │   │   └── DerivativeFullModal.tsx
│   │   │
│   │   ├── assistant/             # Editorial assistant components
│   │   │   ├── EditorialAssistant.tsx
│   │   │   ├── EditorialAssistantPanel.tsx
│   │   │   └── AssistantTrigger.tsx
│   │   │
│   │   ├── calendar/              # Calendar feature components
│   │   │   ├── MonthView.tsx
│   │   │   ├── WeekView.tsx
│   │   │   ├── ScheduleModal.tsx
│   │   │   ├── GoogleCalendarConnect.tsx
│   │   │   └── TasksList.tsx
│   │   │
│   │   ├── forge/                 # Composer feature components
│   │   │   ├── BlogPostForm.tsx
│   │   │   ├── MasterContentForm.tsx
│   │   │   ├── ContentOutput.tsx
│   │   │   ├── ProductSelector.tsx
│   │   │   └── VisualAssetForm.tsx
│   │   │
│   │   ├── library/               # Library feature components
│   │   │   ├── ContentGrid.tsx
│   │   │   ├── ContentDetailModal.tsx
│   │   │   ├── ViewDensityToggle.tsx
│   │   │   └── SortDropdown.tsx
│   │   │
│   │   ├── prompt-library/        # Prompt library components
│   │   │   ├── EnhancedPromptCard.tsx
│   │   │   ├── PromptDetailModal.tsx
│   │   │   └── PromptLibrarySidebar.tsx
│   │   │
│   │   ├── settings/              # Settings components
│   │   │   ├── BrandGuidelinesTab.tsx
│   │   │   └── ProductsTab.tsx
│   │   │
│   │   ├── onboarding/            # Onboarding flow
│   │   │   ├── WelcomeModal.tsx
│   │   │   ├── BrandKnowledgeCenter.tsx
│   │   │   └── CompleteBrandBanner.tsx
│   │   │
│   │   ├── ContentEditor.tsx      # Rich text editor
│   │   ├── ErrorBoundary.tsx      # Error handling
│   │   ├── Navigation.tsx         # Main navigation
│   │   ├── QualityRating.tsx      # Star rating component
│   │   └── [other shared components]
│   │
│   ├── config/
│   │   ├── blogPostGuidelines.ts  # Blog generation rules
│   │   └── imagePromptGuidelines.ts # Image generation templates
│   │
│   ├── hooks/
│   │   ├── useAuth.tsx            # Authentication hook
│   │   ├── useCollections.tsx     # Collections data hook
│   │   ├── useProducts.tsx        # Products data hook
│   │   ├── useOnboarding.tsx      # Onboarding state hook
│   │   ├── useDipWeekCalculation.ts # DIP week logic
│   │   ├── useGoogleCalendarConnection.tsx # Google Calendar
│   │   ├── useKeyboardShortcuts.tsx # Keyboard shortcuts
│   │   ├── use-mobile.tsx         # Mobile detection
│   │   └── use-toast.ts           # Toast notifications
│   │
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts          # Supabase client (auto-generated)
│   │       └── types.ts           # Database types (auto-generated)
│   │
│   ├── pages/
│   │   ├── Auth.tsx               # Login/signup page
│   │   ├── Landing.tsx            # Public landing page
│   │   ├── Index.tsx              # Dashboard/home
│   │   ├── Forge.tsx              # Composer page
│   │   ├── Reservoir.tsx          # Library page
│   │   ├── Repurpose.tsx          # Amplify page
│   │   ├── PromptLibrary.tsx      # Prompt library page
│   │   ├── Calendar.tsx           # Calendar page
│   │   ├── Settings.tsx           # Settings page
│   │   └── NotFound.tsx           # 404 page
│   │
│   ├── utils/
│   │   ├── contentTypeMapping.ts  # Content type display names
│   │   ├── contentTypeHelpers.ts  # Content type utilities
│   │   ├── contentSubtypeLabels.ts # Subtype labels
│   │   ├── collectionIcons.ts     # Collection icon mapping
│   │   ├── dateGrouping.ts        # Date grouping logic
│   │   ├── forgeHelpers.ts        # Composer utilities
│   │   └── [other utilities]
│   │
│   ├── App.tsx                    # Main app component
│   ├── main.tsx                   # App entry point
│   ├── index.css                  # Design system CSS
│   └── vite-env.d.ts              # Vite type definitions
│
├── supabase/
│   ├── functions/                 # Edge functions
│   │   ├── generate-with-claude/  # Claude AI integration
│   │   ├── repurpose-content/     # Content repurposing
│   │   ├── generate-madison-image/  # Image generation (multi-provider: OpenAI/Gemini/Freepik)
│   │   ├── google-calendar-oauth/ # Google OAuth
│   │   ├── sync-to-google-calendar/ # Calendar sync
│   │   ├── process-brand-document/ # Brand doc processing
│   │   └── scrape-brand-website/  # Website scraping
│   │
│   ├── migrations/                # Database migrations (auto-generated)
│   └── config.toml                # Supabase config (auto-generated)
│
├── .env                           # Environment variables (auto-generated)
├── tailwind.config.ts             # Tailwind configuration
├── vite.config.ts                 # Vite configuration
├── tsconfig.json                  # TypeScript configuration
├── package.json                   # Dependencies
└── README.md                      # Project documentation
```

---

## Key Configuration Files

### 1. Design System CSS
**File**: `src/index.css`

Contains all CSS custom properties for the design system:
- Color palette variables
- Typography scale
- Shadow definitions
- Gradient presets
- Component utility classes
- Animation definitions

**Key Sections**:
- Lines 1-115: Color palette and theme variables
- Lines 121-227: Typography hierarchy and base styles
- Lines 232-949: Component styles and utilities

### 2. Tailwind Configuration
**File**: `tailwind.config.ts`

Extends Tailwind with custom design tokens:
- Custom color mappings to CSS variables
- Font family definitions
- Border radius presets
- Shadow utilities
- Animation configurations

### 3. Content Type Utilities
**File**: `src/utils/contentTypeMapping.ts`

```typescript
export const contentTypeDisplayNames: Record<string, string> = {
  blog_post: "Blog Post",
  email_newsletter: "Email Newsletter",
  // ... all content type mappings
};

export function getContentTypeDisplayName(type: string): string {
  return contentTypeDisplayNames[type] || type;
}
```

**File**: `src/utils/contentTypeHelpers.ts`

Contains:
- Master content type identifiers
- Derivative asset type identifiers
- Type checking functions
- Content type grouping logic

### 4. Blog Post Guidelines
**File**: `src/config/blogPostGuidelines.ts`

Defines the AI generation rules for blog posts:
- Philosophy post structure
- Educational post structure
- Announcement post structure
- Word count targets
- Formatting requirements
- Voice and tone guidelines

### 5. Image Prompt Guidelines
**File**: `src/config/imagePromptGuidelines.ts`

Templates for AI image generation:
- Product photography styles
- Brand imagery guidelines
- Composition rules
- Color palette preferences
- Lighting and mood instructions

### 6. Supabase Client
**File**: `src/integrations/supabase/client.ts` (Auto-generated - DO NOT EDIT)

Pre-configured Supabase client:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**Usage in Components**:
```typescript
import { supabase } from "@/integrations/supabase/client";

// Query data
const { data, error } = await supabase
  .from('master_content')
  .select('*')
  .eq('organization_id', orgId);
```

---

## Integration Points

### 1. Lovable Cloud / Supabase

**What It Provides**:
- PostgreSQL database
- Row Level Security (RLS)
- Authentication (email, Google, etc.)
- Real-time subscriptions
- File storage
- Edge functions (serverless)

**Configuration**:
- Project ID: `likkskifwsrvszxdvufw`
- Auto-configured via Lovable Cloud
- Environment variables in `.env` (auto-generated)

**Key Features Used**:
- User authentication with `auth.users`
- Database tables with RLS policies
- Edge functions for AI processing
- Storage buckets for images/documents

### 2. Claude AI Integration

**Model**: Claude 3 (Anthropic)

**Edge Function**: `supabase/functions/generate-with-claude/index.ts`

**Capabilities**:
- Blog post generation
- Email content creation
- Product story writing
- Content repurposing
- Brand voice enforcement

**Request Format**:
```typescript
const { data, error } = await supabase.functions.invoke('generate-with-claude', {
  body: {
    prompt: generatedPrompt,
    contentType: 'blog_post',
    organizationId: orgId
  }
});
```

**Response**:
```typescript
{
  content: string,      // Generated text
  usage: object,        // Token usage stats
  model: string         // Model used
}
```

### 3. Google Calendar Integration

**OAuth Flow**: `supabase/functions/google-calendar-oauth/index.ts`

**Sync Function**: `supabase/functions/sync-to-google-calendar/index.ts`

**Features**:
- Two-way calendar sync
- Event creation from scheduled content
- OAuth2 authentication
- Refresh token handling

**User Flow**:
1. User clicks "Connect Google Calendar"
2. OAuth flow initiated
3. User authorizes in Google
4. Tokens stored securely in database
5. Calendar events auto-sync

### 4. Image Generation

**Service**: Madison Image Generation (multi-provider)

**Edge Function**: `supabase/functions/generate-madison-image/index.ts`

**Capabilities**:
- Product photography
- Brand imagery
- Marketing visuals
- Custom prompt-based generation

**Request**:
```typescript
const { data, error } = await supabase.functions.invoke('generate-madison-image', {
  body: {
    prompt: imagePrompt,
    style: 'product_photography',
    aspectRatio: '16:9'
  }
});
```

**Response**:
```typescript
{
  imageUrl: string,     // Generated image URL
  prompt: string,       // Prompt used
  metadata: object      // Generation details
}
```

### 5. Brand Document Processing

**Edge Function**: `supabase/functions/process-brand-document/index.ts`

**Purpose**: Extract brand guidelines from uploaded PDF documents

**Process**:
1. User uploads brand guidelines PDF
2. Document parsed and analyzed
3. Brand colors, fonts, voice extracted
4. Stored in organization settings
5. Used to inform AI generation

### 6. Website Scraping

**Edge Function**: `supabase/functions/scrape-brand-website/index.ts`

**Purpose**: Extract brand information from existing website

**Data Extracted**:
- Color palette from CSS
- Font families
- Logo and imagery
- Tone and voice from copy
- Product catalog

---

## Development Workflow

### Local Development

```bash
# Clone repository
git clone <repo-url>
cd scriptora

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to localhost:8080
```

### Environment Variables

**File**: `.env` (auto-generated by Lovable Cloud)

```bash
VITE_SUPABASE_URL=https://likkskifwsrvszxdvufw.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...
VITE_SUPABASE_PROJECT_ID=likkskifwsrvszxdvufw
```

### Deployment

Lovable automatically deploys on every commit to main branch.

**Manual Deployment**:
1. Click "Publish" in Lovable editor
2. App deployed to `<project-name>.lovable.app`

**Custom Domain**:
1. Navigate to Project > Settings > Domains
2. Click "Connect Domain"
3. Follow DNS configuration steps

---

## Common Patterns & Best Practices

### 1. Fetching Data with React Query

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const { data, isLoading, error } = useQuery({
  queryKey: ['master-content', organizationId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('master_content')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }
});
```

### 2. Authenticated Requests

```typescript
import { useAuth } from "@/hooks/useAuth";

const { user, profile } = useAuth();

// Use profile.organization_id for queries
const { data } = await supabase
  .from('master_content')
  .select('*')
  .eq('organization_id', profile.organization_id);
```

### 3. Toast Notifications

```typescript
import { useToast } from "@/hooks/use-toast";

const { toast } = useToast();

toast({
  title: "Content saved!",
  description: "Your master content has been saved to the library.",
});

// Error toast
toast({
  title: "Error",
  description: "Failed to generate content.",
  variant: "destructive",
});
```

### 4. Modal Patterns

```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const [open, setOpen] = useState(false);

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-4xl">
    <DialogHeader>
      <DialogTitle>Content Details</DialogTitle>
    </DialogHeader>
    {/* Modal content */}
  </DialogContent>
</Dialog>
```

### 5. Form Handling

```typescript
import { useForm } from "react-hook-form";

const form = useForm({
  defaultValues: {
    title: "",
    content: "",
  }
});

const onSubmit = async (values: any) => {
  // Handle form submission
};

<form onSubmit={form.handleSubmit(onSubmit)}>
  {/* Form fields */}
</form>
```

---

## Keyboard Shortcuts

**Implemented in**: `src/hooks/useKeyboardShortcuts.tsx`

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Open command palette |
| `Ctrl/Cmd + N` | New content |
| `Ctrl/Cmd + S` | Save content |
| `Ctrl/Cmd + /` | Open search |
| `Esc` | Close modals |

---

## Troubleshooting

### Common Issues

**1. Authentication Issues**
- Check if user is logged in: `useAuth()` hook
- Verify RLS policies allow the operation
- Check organization_id is correctly passed

**2. Content Not Appearing**
- Verify filters are not hiding content
- Check if content is archived
- Ensure organization_id matches

**3. AI Generation Failing**
- Check edge function logs in Supabase
- Verify API keys are configured
- Check prompt is properly formatted

**4. Calendar Sync Issues**
- Re-authenticate Google Calendar
- Check OAuth tokens are not expired
- Verify edge function has correct permissions

---

## Future Enhancements

### Planned Features
- Multi-user collaboration
- Content approval workflows
- Advanced analytics dashboard
- Content performance tracking
- A/B testing capabilities
- Integrations with social media platforms
- Content version history
- AI-powered content suggestions
- Custom brand voice training
- Bulk content generation

### Technical Improvements
- Real-time collaboration with WebSockets
- Offline mode with service workers
- Progressive Web App (PWA) support
- Advanced caching strategies
- Performance optimizations
- Accessibility enhancements (WCAG 2.1 AA)

---

## Glossary

**Master Content**: Original long-form content created in Composer, designed to be repurposed into multiple derivative formats.

**Derivative Asset**: Repurposed content optimized for a specific channel (email, Instagram, etc.), generated from master content in Amplify.

**Collection**: Product line grouping system (Humanities, Reserve, Purity, Elemental). Represents themes and positioning for product categories.

**DIP Week**: 4-week content production cycle tracking (Distillation in Progress).

**The Codex**: Design system name inspired by luxury editorial aesthetic.

**Editorial Assistant**: AI-powered refinement tool for improving generated content.

**Quality Rating**: 1-5 star rating system for generated content pieces.

**Amplify**: Feature for repurposing master content into derivative assets (formerly "The Syndicate").

**Forge**: Content creation workspace (formerly "The Editorial Desk").

**Reservoir**: Content library (formerly "The Archives").

---

## Contact & Support

For questions, feature requests, or bug reports:

1. Check this reference documentation first
2. Review the code comments and component documentation
3. Consult the Lovable documentation at https://docs.lovable.dev/
4. Check the Supabase documentation at https://supabase.com/docs

---

**Last Updated**: 2025-10-08  
**Version**: 1.0  
**Maintained by**: Madison Studio Development Team

# Madison Studio - Complete Master Reference Document
## For GPT/ChatGPT Programming & Internal Team Reference

**Version**: 1.0  
**Last Updated**: January 2025  
**Purpose**: Comprehensive reference for building GPT assistants, help centers, and team documentation  
**Status**: Living Document - Update as features evolve

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview & Vision](#2-product-overview--vision)
3. [Complete Feature List](#3-complete-feature-list)
4. [Technical Architecture](#4-technical-architecture)
5. [Database Schema & Data Models](#5-database-schema--data-models)
6. [Design System: The Codex](#6-design-system-the-codex)
7. [Brand Voice & Content Guidelines](#7-brand-voice--content-guidelines)
8. [User Flows & Workflows](#8-user-flows--workflows)
9. [Content Type System](#9-content-type-system)
10. [AI & Integrations](#10-ai--integrations)
11. [Edge Functions & Backend](#11-edge-functions--backend)
12. [UI Components & Patterns](#12-ui-components--patterns)
13. [Onboarding & User Journey](#13-onboarding--user-journey)
14. [Marketplace Features](#14-marketplace-features)
15. [Image Studio System](#15-image-studio-system)
16. [Settings & Configuration](#16-settings--configuration)
17. [Calendar & Scheduling](#17-calendar--scheduling)
18. [Help Center & Support](#18-help-center--support)
19. [Known Issues & Limitations](#19-known-issues--limitations)
20. [Future Roadmap](#20-future-roadmap)
21. [Glossary & Terminology](#21-glossary--terminology)

---

## 1. Executive Summary

### 1.1 What is Madison Studio?

**Madison Studio** is an AI-powered brand intelligence platform that enables businesses to create consistent, on-brand content at scale. The platform combines:

- **Brand Knowledge Absorption**: Upload brand guidelines, documents, and websites to teach the AI your brand voice
- **AI-Powered Content Generation**: Create master content pieces using Claude AI (Anthropic)
- **Intelligent Repurposing**: Transform one master content piece into 10+ channel-specific formats
- **Strategic Planning**: Integrated calendar with Google Calendar sync for content scheduling
- **Brand Consistency Enforcement**: All generated content automatically adheres to uploaded brand guidelines

### 1.2 Core Value Propositions

1. **Brand Consistency**: Upload brand guidelines once, enforce across all content automatically
2. **Content Efficiency**: Create master content, then repurpose into 6+ channel-specific formats
3. **Editorial Excellence**: AI-powered assistant (Madison) refines and polishes content to match brand voice
4. **Strategic Planning**: Integrated calendar for content scheduling and campaign management
5. **Time Savings**: Reduce content creation time by 70% through intelligent repurposing

### 1.3 Target Users

**Primary Audience**:
- Small to medium-sized businesses (SMBs) with 1-50 employees
- E-commerce brands managing multiple products
- Content marketing teams (2-10 people)
- Brand managers and marketing directors
- Solo entrepreneurs and solopreneurs

**Secondary Audience**:
- Marketing agencies managing multiple client brands
- Fragrance and luxury goods brands (initial vertical focus)
- E-commerce sellers (Etsy, Shopify, TikTok Shop)

### 1.4 Technology Stack

**Frontend**:
- React 18.3.1 with TypeScript
- Vite 5.x for build tooling
- Tailwind CSS with custom design system ("The Codex")
- shadcn/ui component library (Radix UI primitives)
- React Router v6 for navigation
- TanStack Query (React Query) for data fetching and caching
- Framer Motion for animations

**Backend**:
- Supabase (via Lovable Cloud)
- PostgreSQL database with Row-Level Security (RLS)
- Edge Functions (Deno runtime) for serverless functions
- Storage buckets for file uploads
- Real-time subscriptions (available, not fully utilized)

**AI & External Integrations**:
- Anthropic Claude API (`claude-sonnet-4-20250514`) - Primary AI generation
- Google Calendar API (OAuth + sync)
- Lovable AI Gateway (Google Gemini 2.5 Flash) - Available but not active
- Nano Image Generation - AI image creation
- Shopify API - E-commerce integration
- Klaviyo API - Email marketing integration

---

## 2. Product Overview & Vision

### 2.1 Vision Statement

To become the definitive brand intelligence platform that empowers businesses to maintain perfect brand consistency across all customer touchpoints, powered by AI that understands and enforces their unique voice.

### 2.2 Design Philosophy: "The Codex"

Madison Studio's design philosophy draws inspiration from traditional luxury publishing houses and David Ogilvy's editorial approach. The aesthetic evokes:

- **Leather-bound journals** - Timeless, premium quality
- **Brass accents** - Craftsmanship and attention to detail
- **Cream paper and black ink** - Classic editorial excellence
- **Museum-quality interfaces** - Intimate luxury experience

This creates a sophisticated yet approachable experience that positions content creation as a craft, not a commodity.

### 2.3 Competitive Positioning

| Competitor | Strength | Our Advantage |
|------------|----------|---------------|
| Copy.ai | Fast generation | Brand voice enforcement through uploaded guidelines |
| Jasper | Template variety | Master-to-derivative workflow, strategic repurposing |
| ChatGPT | General AI power | Industry-specific templates, editorial quality control |
| Later/Buffer | Social scheduling | Integrated content creation + scheduling in one platform |

**Unique Differentiation**: Madison Studio is the only platform that combines brand guideline ingestion, master content creation, intelligent multi-channel repurposing, and calendar scheduling in a single unified workflow.

### 2.4 Editorial Terminology

The interface uses publishing-inspired terminology to elevate the experience:

| Standard Term | Madison Studio Term |
|---------------|----------------|
| Library | The Archives |
| Composer | The Editorial Desk / Forge |
| Amplify | The Syndicate / Multiply |
| Calendar | The Planner / Schedule |
| Content Types | Editions |
| Master Content | Master Manuscript |
| Derivatives | Derivative Editions |

---

## 3. Complete Feature List

### 3.1 Core Features Overview

Madison Studio consists of **10 core feature areas**:

1. **Dashboard** - Central hub with getting started checklist, brand health, content pipeline
2. **Create (Forge)** - AI-powered content creation workspace
3. **Multiply (Amplify)** - Multi-channel content repurposing
4. **Library (The Archives)** - Content repository and management
5. **Image Studio** - AI image generation and editing
6. **Calendar (The Planner)** - Content scheduling and planning
7. **Prompt Library (The Reservoir)** - Template management and reusable prompts
8. **Marketplace** - E-commerce listing generation (Etsy, Shopify, TikTok Shop)
9. **Settings** - Brand configuration and product management
10. **Brand Builder** - Brand DNA setup and health scoring

### 3.2 Feature 1: Dashboard

**Purpose**: Central hub providing overview, guidance, and quick access to all features.

**Key Components**:
- **Getting Started Checklist**: 5 essential tasks for new users
- **Brand Health Score**: Percentage-based brand completeness indicator
- **Content Pipeline**: Visual flow of content from creation to publication
- **Recent Activity**: Latest content created, edited, or scheduled
- **Quick Actions**: Fast access to common tasks
- **Editorial Stats**: Content creation metrics and trends
- **Weekly Stats**: Performance overview
- **Upcoming Schedule**: Next scheduled content items

**User Flows**:
1. User lands on dashboard after login
2. Sees getting started checklist (if new user)
3. Views brand health score and recommendations
4. Reviews recent activity and content pipeline
5. Uses quick actions to create or schedule content

**Technical Details**:
- Component: `src/pages/DashboardNew.tsx`
- Uses React Query for data fetching
- Real-time updates via Supabase subscriptions
- Responsive design with mobile optimization

### 3.3 Feature 2: Create (Forge / The Editorial Desk)

**Purpose**: AI-powered content creation workspace with two distinct generation modes.

#### Mode 1: Single Content Generation
Generate individual content pieces directly without creating master content first.

**Content Types**:
- Blog Posts (Philosophy, Educational, Announcement)
- Visual Assets (AI-generated images)
- Single Emails
- Product Stories

**Form Fields** (Blog Post Example):
- Post Type: Philosophy, Educational, Announcement
- Word Count: 500, 750, 1000, 1250, 1500+
- Product: Link to product from catalog (optional)
- Collection: Humanities, Reserve, Purity, Elemental (required)
- Subject: Main topic (required)
- Themes: Supporting themes (comma-separated, optional)
- Takeaway: Key message for reader (required)
- Custom Instructions: Additional AI instructions (optional)

**Generation Flow**:
1. User selects "Single Content" mode
2. Chooses content type from dropdown
3. Fills in all required fields
4. Adds custom instructions (optional)
5. Clicks "Generate with Claude"
6. Loading state: "Crafting your content..."
7. Output appears in right panel
8. Quality rating displayed (AI-generated)
9. Can refine with Editorial Assistant
10. Clicks "Save to Library"

#### Mode 2: Master Content Generation
Create long-form master content designed to be repurposed into multiple derivative formats.

**Master Content Types**:
- Blog Posts (500-1500+ words)
- Email Newsletters (400-800 words)
- Product Stories (100-300 words)
- Brand Announcements (200-500 words)

**Generation Flow**:
1. User selects "Master Content" mode
2. Chooses master content type
3. Fills in comprehensive form
4. Clicks "Generate with Claude"
5. AI generates long-form master content
6. Quality rating displayed
7. User reviews and refines
8. Clicks "Save as Master Content"
9. Content saved to library
10. Banner appears: "Ready to repurpose? Go to Amplify →"

**Editorial Assistant Features**:
- Conversational interface (chat-style)
- Contextual awareness of current content
- Brand voice check
- Content refinement suggestions
- Structural changes
- Tone adjustments
- Factual questions

**Components**:
- `src/pages/Create.tsx` - Main composer page
- `src/components/forge/BlogPostForm.tsx` - Blog-specific form
- `src/components/forge/MasterContentForm.tsx` - Master content form
- `src/components/forge/VisualAssetForm.tsx` - Image generation form
- `src/components/forge/ContentOutput.tsx` - Generated content display
- `src/components/assistant/EditorialAssistant.tsx` - AI refinement panel

### 3.4 Feature 3: Multiply (Amplify / The Syndicate)

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
   - Character limit: 2200

3. **Twitter**
   - Thread format
   - Character-optimized
   - Character limit: 280 per tweet

4. **Product**
   - Short sales-focused descriptions
   - E-commerce optimized
   - 50-150 words

5. **SMS**
   - 160 character limit
   - Direct, concise messaging

6. **LinkedIn**
   - Professional tone
   - Industry-appropriate
   - Long-form post format

7. **Pinterest**
   - Visual-first content
   - SEO-optimized descriptions

8. **TikTok**
   - Short-form video scripts
   - Hook-focused openings

9. **YouTube**
   - Video script outlines
   - Long-form content structure

10. **Podcast**
    - Episode outlines
    - Show notes format

11. **Visual Asset**
    - Image generation prompts
    - Visual content descriptions

**User Flow**:
1. User selects master content from library
2. View master content in left panel
3. Browse derivative type folders
4. Click folder to expand and see generated derivatives
5. Click derivative card to view full content
6. Approve or regenerate as needed
7. Schedule to calendar or download
8. Export to PDF/DOCX

**Organization**:
- Folder-based UI grouped by derivative type
- Each folder shows count of derivatives
- Cards show preview, status (draft/approved), and metadata
- Full modal view with edit capabilities

**Components**:
- `src/pages/Multiply.tsx` - Main amplify page
- `src/components/amplify/MasterContentSwitcher.tsx` - Master content selector
- `src/components/amplify/DerivativeTypeFolder.tsx` - Folder UI
- `src/components/amplify/DerivativeGridCard.tsx` - Derivative cards
- `src/components/amplify/DerivativeFullModal.tsx` - Full content view

### 3.5 Feature 4: Library (The Archives)

**Purpose**: Central repository for all created content, both master pieces and derivative assets.

**Core Functionality**:

**Browse & Filter**:
- Grid view of all master content and generated outputs
- Filter by content type (blog, email, product story, etc.)
- Filter by collection (Humanities, Reserve, Purity, Elemental)
- Filter by DIP week (Week 1-4 production cycle)
- Real-time search across titles and content
- Archive/unarchive content management

**View Modes**:
- Comfortable density: Large cards with previews
- Compact density: Smaller cards, more per row
- Date grouping: Today, This Week, Last Week, Earlier

**Sort Options**:
- Newest first (default)
- Oldest first
- Recently updated
- Alphabetical A-Z

**Content Card Display**:
Each content card shows:
- Content title
- Content type badge (with color coding)
- Collection icon and name
- Creation date with "Published:" label
- Content preview (first 150 characters)
- Quality rating (1-5 stars, if rated)
- Word count
- Archive status badge

**Detail Modal**:
Clicking a card opens full content view:
- Complete content text with formatting
- Full metadata display
- Quality rating
- Edit capabilities
- Archive/restore button
- Schedule to calendar
- Delete option
- Export to PDF/DOCX

**Components**:
- `src/pages/Library.tsx` - Main library page
- `src/components/library/ContentGrid.tsx` - Grid layout
- `src/components/library/ContentDetailModal.tsx` - Full content view
- `src/components/library/ViewDensityToggle.tsx` - Density control
- `src/components/library/SortDropdown.tsx` - Sort options

### 3.6 Feature 5: Image Studio

**Purpose**: AI-powered image generation and editing for brand visuals.

**Key Features**:
- **AI Image Generation**: Create images using Nano image generation
- **Use Case-Based Categories**: E-commerce, Social Media, Editorial, Flat Lay, Lifestyle, Creative
- **Shot Types**: Product on White, Reflective Surface, Lifestyle Scene, Natural Setting, Editorial Luxury, Flat Lay
- **Text Overlay**: Add text to generated images
- **Image Editing**: Basic editing capabilities
- **Image Library**: Save and organize generated images
- **Template System**: Save successful image prompts as templates

**Use Case Categories**:
1. **E-commerce**: Product listings for online stores (Shopify, Etsy, Amazon)
2. **Social Media**: Content for social platforms (Instagram, Facebook, TikTok)
3. **Editorial**: Magazine, blog, press content
4. **Flat Lay**: Overhead compositions
5. **Lifestyle**: Brand storytelling with people
6. **Creative & Artistic**: Artistic, conceptual, experimental

**User Flow**:
1. Navigate to Image Studio
2. Select use case category
3. Choose shot type
4. Enter product or subject
5. Add style preferences
6. Generate image
7. Edit or add text overlay
8. Save to library

**Components**:
- `src/pages/ImageEditor.tsx` - Main image editor page
- `src/components/image-editor/UseCaseSelector.tsx` - Category selection
- `src/components/image-editor/ImageGenerationPanel.tsx` - Generation interface
- `src/components/image-editor/ImageEditorCanvas.tsx` - Editing canvas

### 3.7 Feature 6: Calendar (The Planner)

**Purpose**: Strategic content planning and scheduling with Google Calendar integration.

**Views**:
- **Month View**: High-level overview with event dots
- **Week View**: Detailed weekly schedule with time slots
- **Agenda View**: List view of upcoming events

**Features**:
- Google Calendar two-way sync
- Schedule content from Amplify
- Add manual events
- Task management per day
- Notes panel for each day
- DIP week tracking badges
- Color-coded events by type
- Drag-and-drop scheduling

**Google Calendar Integration**:
- OAuth2 authentication flow
- Sync scheduled content to Google Calendar
- Two-way sync (view Google events in app)
- Automatic refresh
- Encrypted token storage

**User Flow**:
1. View calendar in month or week mode
2. Click date to open schedule modal
3. Add content, events, or tasks
4. Connect Google Calendar (OAuth flow)
5. Sync with Google Calendar
6. View and edit notes for each day
7. Track DIP week progression

**Components**:
- `src/pages/Calendar.tsx` - Main calendar page
- `src/components/calendar/MonthView.tsx` - Monthly calendar
- `src/components/calendar/WeekView.tsx` - Weekly schedule
- `src/components/calendar/AgendaView.tsx` - Agenda list
- `src/components/calendar/ScheduleModal.tsx` - Event creation/editing
- `src/components/calendar/GoogleCalendarConnect.tsx` - OAuth integration

### 3.8 Feature 7: Prompt Library (The Reservoir)

**Purpose**: Store, organize, and reuse prompt templates with performance tracking.

**Features**:
- Save successful prompts for reuse
- Organize by content type
- Filter by collection
- Mark favorites
- Template-only view
- Load directly into Composer
- Usage statistics tracking
- Quality rating aggregation
- AI-powered prompt refinement

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
6. Save new prompts for future use

**Components**:
- `src/pages/Reservoir.tsx` - Main prompt library page
- `src/components/prompt-library/EnhancedPromptCard.tsx` - Prompt cards
- `src/components/prompt-library/PromptDetailModal.tsx` - Full prompt view
- `src/components/prompt-library/PromptLibrarySidebar.tsx` - Filter sidebar

### 3.9 Feature 8: Marketplace

**Purpose**: Generate compliant, SEO-optimized listings for e-commerce marketplaces.

**Supported Platforms**:
1. **Etsy**
   - Title optimization (140 characters)
   - Description with SEO keywords
   - Tags and categories
   - Compliance with Etsy's AI-generated content policies
   - Craftsmanship story requirements

2. **Shopify**
   - Product descriptions
   - SEO meta descriptions
   - Product tags
   - Collection assignments

3. **TikTok Shop**
   - Short-form product descriptions
   - Video script suggestions
   - Hashtag recommendations

**Features**:
- Product selection from catalog
- Platform-specific optimization
- Compliance validation
- SEO keyword suggestions
- Template library for listings
- Bulk generation support

**User Flow**:
1. Navigate to Marketplace
2. Select platform (Etsy, Shopify, TikTok Shop)
3. Choose product from catalog
4. Review and customize listing
5. Generate listing content
6. Export or save to library

**Components**:
- `src/pages/Marketplace.tsx` - Main marketplace page
- `src/pages/marketplace/CreateEtsyListing.tsx` - Etsy listing creator
- `src/pages/marketplace/CreateShopifyListing.tsx` - Shopify listing creator
- `src/pages/marketplace/CreateTikTokShopListing.tsx` - TikTok Shop creator

### 3.10 Feature 9: Settings

**Purpose**: Configure brand identity, products, collections, team management, and integrations.

**Tabs**:

#### Brand Guidelines
- Logo Upload: Primary brand logo
- Color Palette: Brand colors with hex codes
- Typography: Font families and usage
- Voice & Tone: Brand voice guidelines
- Brand Document: Upload comprehensive brand guide PDF
- Website URL: For brand scraping
- Industry Type: Business classification

#### Products Management
- CSV Upload: Bulk product import
- Manual Entry: Add individual products
- Product Fields:
  - Title
  - Category (personal fragrance, home fragrance, body care, etc.)
  - Description
  - Price
  - Image URL
  - Collection assignment
  - Category-specific fields (scent notes, materials, etc.)

#### Collections
- Manage four core collections: Humanities, Reserve, Purity, Elemental
- Collection descriptions and positioning
- Collection icons and colors

#### Team
- Invite team members
- Role management (Owner, Admin, Member)
- Remove team members

#### Integrations
- Shopify connection
- Klaviyo connection
- Google Calendar connection status

**Components**:
- `src/pages/Settings.tsx` - Main settings page
- `src/components/settings/BrandGuidelinesTab.tsx` - Brand config
- `src/components/settings/ProductsTab.tsx` - Product management
- `src/components/settings/CollectionsTab.tsx` - Collection management
- `src/components/settings/TeamTab.tsx` - Team management

### 3.11 Feature 10: Brand Builder

**Purpose**: Guided brand DNA setup and brand health scoring.

**Essential 5 Fields**:
1. **Who You Help**: Target audience definition
2. **Your Voice**: Brand voice and tone
3. **Your Story**: Brand narrative and positioning
4. **Your Values**: Core brand values
5. **Your Mission**: Brand mission statement

**Brand Health Score**:
- Calculated based on completion of Essential 5
- Additional factors: Products added, Collections configured, Documents uploaded
- Score ranges: 0-100%
- Recommendations provided for improvement

**User Flow**:
1. Navigate to Brand Builder
2. Complete Essential 5 fields
3. View brand health score
4. Follow recommendations to improve score
5. Upload brand documents for deeper intelligence

**Components**:
- `src/pages/BrandBuilder.tsx` - Main brand builder page
- `src/components/brand-builder/Essential5Card.tsx` - Essential 5 form
- `src/pages/BrandHealth.tsx` - Brand health dashboard

### 3.12 Additional Features

**Think Mode**:
- Advanced AI conversation interface
- Streaming responses
- Context-aware assistance
- File upload support

**Help Center**:
- Video tutorials
- Feature guides
- Learning paths
- Interactive help

**Meet Madison**:
- Introduction to the AI assistant
- Capabilities overview
- Usage examples

---

## 4. Technical Architecture

### 4.1 Frontend Architecture

**Framework**: React 18.3.1 with TypeScript

**State Management**:
- TanStack Query (React Query) for server state
- React Context for global app state (Auth, Sidebar)
- Local component state with useState/useReducer

**Routing**:
- React Router v6
- Protected routes with authentication guards
- Route-based code splitting

**Styling**:
- Tailwind CSS with custom design system
- CSS custom properties for theming
- Responsive breakpoints
- Dark mode support (if enabled)

**Component Library**:
- shadcn/ui (Radix UI primitives)
- Custom components built on top
- Consistent design patterns

### 4.2 Backend Architecture

**Database**: Supabase PostgreSQL

**Key Features**:
- Row-Level Security (RLS) for data isolation
- Organization-based multi-tenancy
- Real-time subscriptions (available)
- Automatic backups

**Edge Functions**: Deno runtime serverless functions

**Storage**:
- Brand documents bucket
- Brand assets bucket
- Madison training docs bucket
- Worksheet uploads bucket

### 4.3 Data Flow

```
User Action
    ↓
React Component
    ↓
TanStack Query Hook
    ↓
Supabase Client
    ↓
PostgreSQL Database (with RLS)
    OR
Edge Function (for AI/processing)
    ↓
External API (Claude, Google Calendar, etc.)
    ↓
Response
    ↓
React Query Cache
    ↓
Component Update
```

### 4.4 Authentication & Authorization

**Authentication**:
- Supabase Auth with email/password
- Auto-confirm email signups enabled
- Session management with secure tokens

**Authorization**:
- Role-based access: Owner, Admin, Member
- RLS policies on all tables
- Organization-scoped data isolation
- Super admin role for Madison training

**Data Protection**:
- Encrypted token storage for Google Calendar
- Secure edge function execution
- API key management via Supabase secrets

---

## 5. Database Schema & Data Models

### 5.1 Core Tables

#### organizations
```sql
- id (uuid, primary key)
- name (text)
- created_at (timestamp)
- updated_at (timestamp)
- brand_config (jsonb) -- Brand voice, colors, fonts, industry, etc.
- brand_colors (jsonb)
- brand_fonts (jsonb)
- brand_voice (text)
- logo_url (text)
- industry_type (text)
- business_model (text)
- target_audience_type (text)
```

#### profiles
```sql
- id (uuid, primary key)
- user_id (uuid, references auth.users)
- display_name (text)
- organization_id (uuid, references organizations)
- created_at (timestamp)
- updated_at (timestamp)
```

#### master_content
```sql
- id (uuid, primary key)
- organization_id (uuid, references organizations)
- title (text)
- content (text)
- content_type (text) -- blog_post, email_newsletter, etc.
- product_id (uuid, references brand_products)
- collection_id (uuid, references brand_collections)
- metadata (jsonb) -- subject, themes, takeaway, etc.
- quality_rating (integer) -- 1-5 stars
- word_count (integer)
- status (text) -- draft, published, archived
- created_at (timestamp)
- updated_at (timestamp)
- archived_at (timestamp, nullable)
- created_by (uuid, references auth.users)
```

#### derivative_assets
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
- quality_rating (integer) -- 1-5 stars
- platform_specs (jsonb) -- character limits, slide counts, etc.
- created_at (timestamp)
- updated_at (timestamp)
- created_by (uuid, references auth.users)
```

#### prompts
```sql
- id (uuid, primary key)
- organization_id (uuid, references organizations)
- title (text)
- prompt_text (text)
- content_type (text)
- collection_id (uuid, references brand_collections)
- is_favorite (boolean)
- is_template (boolean)
- usage_count (integer)
- avg_quality_rating (numeric)
- created_at (timestamp)
- updated_at (timestamp)
- created_by (uuid, references auth.users)
```

#### outputs
```sql
- id (uuid, primary key)
- organization_id (uuid, references organizations)
- title (text)
- content (text)
- content_type (text)
- quality_rating (integer) -- 1-5 stars
- metadata (jsonb)
- prompt_id (uuid, references prompts)
- created_at (timestamp)
- updated_at (timestamp)
- archived_at (timestamp, nullable)
- created_by (uuid, references auth.users)
```

#### brand_products
```sql
- id (uuid, primary key)
- organization_id (uuid, references organizations)
- title (text)
- category (text) -- personal_fragrance, home_fragrance, body_care, etc.
- description (text)
- price (numeric)
- image_url (text)
- collection_id (uuid, references brand_collections)
- metadata (jsonb) -- category-specific fields
- bottle_type (text) -- for fragrance products
- created_at (timestamp)
- updated_at (timestamp)
```

#### brand_collections
```sql
- id (uuid, primary key)
- organization_id (uuid, references organizations)
- name (text) -- Humanities, Reserve, Purity, Elemental
- description (text)
- icon (text)
- color (text)
- created_at (timestamp)
```

#### scheduled_content
```sql
- id (uuid, primary key)
- organization_id (uuid, references organizations)
- content_id (uuid) -- References either master_content or derivative_assets
- content_type (text) -- master or derivative
- scheduled_date (timestamp)
- event_title (text)
- notes (text)
- google_calendar_event_id (text, nullable)
- sync_status (text) -- pending, synced, failed
- created_at (timestamp)
- updated_at (timestamp)
```

#### brand_knowledge
```sql
- id (uuid, primary key)
- organization_id (uuid, references organizations)
- knowledge_type (text) -- voice, tone, values, forbidden_phrases, etc.
- content (text)
- source (text) -- document, website, manual
- metadata (jsonb)
- created_at (timestamp)
- updated_at (timestamp)
```

#### brand_documents
```sql
- id (uuid, primary key)
- organization_id (uuid, references organizations)
- file_name (text)
- file_url (text)
- file_type (text) -- pdf, docx, etc.
- processing_status (text) -- pending, processing, completed, error
- extracted_knowledge (jsonb)
- created_at (timestamp)
- updated_at (timestamp)
```

#### generated_images
```sql
- id (uuid, primary key)
- organization_id (uuid, references organizations)
- image_url (text)
- prompt (text)
- category (text) -- ecommerce, social_media, editorial, etc.
- shot_type (text) -- product_on_white, lifestyle_scene, etc.
- metadata (jsonb)
- saved (boolean)
- created_at (timestamp)
```

#### subscriptions
```sql
- id (uuid, primary key)
- organization_id (uuid, references organizations)
- stripe_subscription_id (text)
- stripe_customer_id (text)
- status (text) -- active, canceled, past_due
- plan_tier (text) -- starter, professional, enterprise
- current_period_start (timestamp)
- current_period_end (timestamp)
- created_at (timestamp)
- updated_at (timestamp)
```

### 5.2 Collections System

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

### 5.3 DIP Week System

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

## 6. Design System: The Codex

### 6.1 Color Palette

#### Neutrals Foundation
```css
--ink-black: #1A1816         /* Navigation, primary buttons, deep text */
--charcoal: #2F2A26          /* Body text, secondary buttons */
--warm-gray: #6B6560         /* Secondary text, muted elements */
--soft-gray: #A8A39E         /* Tertiary text, disabled states */
--stone: #D4CFC8             /* Borders, dividers */
--vellum-cream: #F5F1E8      /* Page background */
--parchment-white: #FFFCF5   /* Card backgrounds, input fields */
```

#### Brand Accents
```css
--aged-brass: #B8956A        /* Primary accent, CTA buttons */
--brass-glow: #D4AF37        /* Hover states, focus rings */
--antique-gold: #D4AF37      /* Secondary accent */
--deep-burgundy: #6B2C3E     /* Error states, destructive actions */
--forest-ink: #3A4A3D        /* Success states, confirmations */
--midnight-blue: #2C3E50     /* Info states, secondary CTAs */
```

#### Derivative Type Colors
```css
--email: #3B82F6             /* Email content (Blue) */
--instagram: #A855F7         /* Instagram posts (Purple) */
--twitter: #0EA5E9           /* Twitter threads (Sky blue) */
--product: #FB923C           /* Product descriptions (Orange) */
--sms: #22C55E               /* SMS messages (Green) */
--linkedin: #3B82F6          /* LinkedIn posts (Professional blue) */
--visual: #EC4899            /* Visual assets (Pink) */
```

### 6.2 Typography System

#### Font Families
- **Serif**: `Cormorant Garamond` - Headlines, editorial elements, display text
- **Sans**: `Lato` - Body text, UI elements, labels
- **Accent**: `Crimson Text` - Editorial quotes, italicized emphasis

#### Type Scale
```css
Display (h1)         48px, weight 600, -0.02em tracking, 1.2 line-height
Section Headers (h2) 36px, weight 600, -0.01em tracking, 1.3 line-height
Card Titles (h3)     24px, weight 500, 1.4 line-height
Subsections (h4)     20px, weight 500, 1.5 line-height
Body Large           18px, 1.7 line-height
Body Regular         16px, 1.6 line-height
Body Small           14px, 1.5 line-height
Label Tiny           12px, weight 500, uppercase, 0.03em tracking
```

### 6.3 Shadow System

```css
Level 1 (Resting cards)    0 2px 4px rgba(26, 24, 22, 0.1)
Level 2 (Hover states)     0 4px 12px rgba(26, 24, 22, 0.15)
Level 3 (Modals)           0 8px 24px rgba(26, 24, 22, 0.2)
Level 4 (High elevation)   0 16px 48px rgba(26, 24, 22, 0.25)
Brass Glow (Focus)         0 0 0 3px rgba(212, 175, 55, 0.3)
```

### 6.4 Component Patterns

**Cards**:
- Background: Parchment white (#FFFCF5)
- Border: 1px solid Stone
- Border radius: 12px
- Hover: Lift with shadow increase + brass border

**Buttons**:
- Primary: Ink black background, parchment text, brass border
- Brass: Brass gradient background, ink black text
- Secondary: Transparent, charcoal text, stone border
- Transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1)

**Inputs**:
- Background: Parchment white
- Border: 2px solid Stone
- Focus: Brass border + brass glow shadow
- Manuscript style: Vellum cream background, Crimson Text font

---

## 7. Brand Voice & Content Guidelines

### 7.1 Writing Principles

**Do's**:
✓ Use sophisticated fragrance terminology  
✓ Maintain editorial, magazine-quality tone  
✓ Reference specific product details  
✓ Employ storytelling techniques  
✓ Include sensory descriptions  
✓ Cite traditional distillation methods  
✓ Mention ethical sourcing practices  
✓ Write in clear, concise sentences  
✓ Use active voice predominantly  

**Don'ts**:
✗ Avoid generic marketing clichés  
✗ Don't overuse emojis (1-2 max per piece)  
✗ Skip vague descriptions like "amazing" or "incredible"  
✗ Avoid ALL CAPS (except brand names)  
✗ Don't use excessive exclamation points  
✗ Skip clickbait language  
✗ Avoid jargon without explanation  

### 7.2 Forbidden Marketing Clichés

❌ "Game-changer"  
❌ "Revolutionary"  
❌ "One-of-a-kind"  
❌ "Like no other"  
❌ "Best kept secret"  
❌ "You won't believe"  
❌ "Mind-blowing"  

### 7.3 Approved Vocabulary

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

### 7.4 Tone Attributes

- **Sophisticated** yet approachable
- **Knowledgeable** without pretension
- **Warm** and inviting
- **Confident** but not arrogant
- **Educational** without being preachy
- **Authoritative** and elegant
- **Authentic** and refined

### 7.5 Madison AI Core Principles

Madison integrates FOUR legendary copywriting masters:

1. **DAVID OGILVY – SPECIFICITY & PROOF**
   - "The more you tell, the more you sell."
   - Replace vague claims with concrete details
   - Use numbers, origins, measurements, timeframes

2. **CLAUDE HOPKINS – REASON-WHY**
   - Every claim must be justified
   - Follow benefits with clear "because…" explanation
   - Explain the mechanism

3. **ROSSER REEVES – UNIQUE SELLING PROPOSITION (USP)**
   - Each brand needs a claim no one else can credibly make
   - Make uniqueness explicit early in copy

4. **EUGENE SCHWARTZ – AWARENESS STRATEGY**
   - Match content to reader's awareness stage
   - Unaware → Problem-aware → Solution-aware → Product-aware → Most aware

---

## 8. User Flows & Workflows

### 8.1 First-Time User Journey

```
1. Sign Up / Login
   ↓
2. Onboarding Welcome Modal
   ↓
3. Brand DNA Setup (3 steps)
   - Basic brand information
   - Website scan (optional)
   - Document upload (optional)
   ↓
4. Dashboard
   - Getting Started Checklist appears
   - Brand Health Score: 40%
   ↓
5. Complete Essential 5 Tasks
   - Create Your First Content
   - Explore Your Library
   - Schedule a Post
   - Customize Your Brand
   - Try Content Multiplication
   ↓
6. Brand Health Score: 85%
   - All features unlocked
   - Active user state
```

### 8.2 Content Creation Workflow

```
1. Navigate to Create (Forge)
   ↓
2. Select Mode (Single Content or Master Content)
   ↓
3. Choose Content Type
   ↓
4. Fill in Form Fields
   - Subject, themes, takeaway
   - Product selection (optional)
   - Collection assignment
   ↓
5. Generate with Claude
   - Loading state
   - Streaming response
   ↓
6. Review Generated Content
   - Quality rating displayed
   - Use Editorial Assistant to refine
   ↓
7. Save to Library
   - Auto-saved to The Archives
   - Ready for repurposing (if master content)
```

### 8.3 Content Repurposing Workflow

```
1. Navigate to Multiply (Amplify)
   ↓
2. Select Master Content
   - Browse from library
   - View in left panel
   ↓
3. Browse Derivative Types
   - Email, Instagram, Twitter, etc.
   - Click folder to expand
   ↓
4. Generate Derivatives
   - Select multiple types
   - Batch generation
   ↓
5. Review Generated Derivatives
   - Click card to view full content
   - Approve or regenerate
   ↓
6. Schedule or Export
   - Schedule to calendar
   - Export to PDF/DOCX
   - Save to library
```

### 8.4 Scheduling Workflow

```
1. Navigate to Calendar (The Planner)
   ↓
2. Select Date
   - Click on calendar
   - Open schedule modal
   ↓
3. Add Content
   - Select from library
   - Or create new event
   ↓
4. Set Details
   - Date and time
   - Platform/channel
   - Notes
   ↓
5. Connect Google Calendar (optional)
   - OAuth flow
   - Authorize access
   ↓
6. Sync to Google Calendar
   - Automatic sync
   - Two-way updates
```

---

## 9. Content Type System

### 9.1 Master Content Types

Created in **Create (Forge)**, designed for long-form original content that can be repurposed.

| Type | Internal Name | Description | Word Count |
|------|---------------|-------------|------------|
| Blog Post | `blog_post` | Long-form narrative content | 500-1500+ words |
| Email Newsletter | `email_newsletter` | Original newsletter piece | 400-800 words |
| Product Story | `product_story` | Product narrative | 100-300 words |
| Brand Announcement | `brand_announcement` | Important updates | 200-500 words |

### 9.2 Derivative Asset Types

Generated in **Multiply (Amplify)**, optimized for specific distribution channels.

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
| Pinterest | `pinterest` | Visual-first content | SEO-optimized |
| TikTok | `tiktok` | Short-form video script | Hook-focused |
| YouTube | `youtube` | Video script outline | Long-form structure |
| Podcast | `podcast` | Episode outline | Show notes format |
| Visual | `visual` | Image generation prompt | Visual description |

### 9.3 Single Content Types

Generated directly in **Create (Forge)**, standalone pieces not designed for repurposing.

| Type | Internal Name | Description |
|------|---------------|-------------|
| Visual Asset | `visual` | AI-generated image | Image file |

---

## 10. AI & Integrations

### 10.1 Anthropic Claude Integration

**Model**: `claude-sonnet-4-20250514`

**Edge Function**: `supabase/functions/generate-with-claude/index.ts`

**Capabilities**:
- Blog post generation
- Email content creation
- Product story writing
- Content repurposing
- Brand voice enforcement
- Editorial refinement

**Request Format**:
```typescript
const { data, error } = await supabase.functions.invoke('generate-with-claude', {
  body: {
    prompt: generatedPrompt,
    contentType: 'blog_post',
    organizationId: orgId,
    mode: 'generate' // or 'consult'
  }
});
```

**Response**:
```typescript
{
  content: string,      // Generated text
  usage: object,       // Token usage stats
  model: string        // Model used
}
```

**Retry Logic**:
- Exponential backoff for 500 errors
- 3 attempts with 1-2-4 second delays
- Handles API instability gracefully

### 10.2 Google Calendar Integration

**OAuth Flow**: `supabase/functions/google-calendar-oauth/index.ts`

**Sync Function**: `supabase/functions/sync-to-google-calendar/index.ts`

**Features**:
- Two-way calendar sync
- Event creation from scheduled content
- OAuth2 authentication
- Refresh token handling
- Encrypted token storage

**User Flow**:
1. User clicks "Connect Google Calendar"
2. OAuth flow initiated
3. User authorizes in Google
4. Tokens stored securely in database
5. Calendar events auto-sync

### 10.3 Image Generation (Nano)

**Service**: Nano Image Generation

**Edge Function**: `supabase/functions/generate-image-with-nano/index.ts`

**Capabilities**:
- Product photography
- Brand imagery
- Marketing visuals
- Custom prompt-based generation

**Request**:
```typescript
const { data, error } = await supabase.functions.invoke('generate-image-with-nano', {
  body: {
    prompt: imagePrompt,
    style: 'product_photography',
    aspectRatio: '16:9'
  }
});
```

### 10.4 Shopify Integration

**Edge Functions**:
- `connect-shopify/index.ts` - OAuth connection
- `sync-shopify-products/index.ts` - Product sync
- `update-shopify-product/index.ts` - Product updates

**Features**:
- Product catalog sync
- Listing generation
- Product description updates
- Encrypted token storage

### 10.5 Klaviyo Integration

**Edge Functions**:
- `connect-klaviyo/index.ts` - API connection
- `fetch-klaviyo-lists/index.ts` - Audience lists
- `fetch-klaviyo-campaigns/index.ts` - Campaign data
- `publish-to-klaviyo/index.ts` - Email publishing

**Features**:
- Email campaign creation
- Audience selection
- Campaign management
- Performance tracking

---

## 11. Edge Functions & Backend

### 11.1 Complete Edge Function List

1. **generate-with-claude** - Primary AI content generation
2. **repurpose-content** - Transform master content into derivatives
3. **think-mode-chat** - Advanced AI conversation interface
4. **generate-image-with-nano** - AI image generation
5. **generate-madison-image** - Madison-specific image generation
6. **process-brand-document** - Extract brand knowledge from PDFs
7. **scrape-brand-website** - Extract brand info from websites
8. **extract-brand-knowledge** - Structure brand intelligence
9. **google-calendar-oauth** - Google Calendar OAuth flow
10. **sync-to-google-calendar** - Calendar event synchronization
11. **connect-shopify** - Shopify OAuth connection
12. **sync-shopify-products** - Sync Shopify product catalog
13. **update-shopify-product** - Update Shopify product listings
14. **connect-klaviyo** - Klaviyo API connection
15. **fetch-klaviyo-lists** - Get Klaviyo audience lists
16. **fetch-klaviyo-campaigns** - Get Klaviyo campaigns
17. **publish-to-klaviyo** - Publish emails to Klaviyo
18. **marketplace-assistant** - E-commerce listing assistance
19. **refine-prompt-template** - AI-powered prompt improvement
20. **analyze-brand-consistency** - Check content brand alignment
21. **analyze-brand-health** - Calculate brand health score
22. **analyze-brand-dna** - Extract brand DNA from documents
23. **suggest-brand-knowledge** - Suggest brand knowledge gaps
24. **parse-content-worksheet** - Parse uploaded content worksheets
25. **add-text-to-image** - Add text overlays to images
26. **create-checkout-session** - Stripe checkout creation
27. **create-portal-session** - Stripe customer portal
28. **get-subscription** - Get subscription status
29. **stripe-webhook** - Handle Stripe webhooks
30. **send-team-invitation** - Send team member invitations
31. **check-auth** - Authentication verification
32. **log-shot-type** - Image shot type analytics
33. **mark-generated-image-saved** - Mark images as saved
34. **competitive-intelligence** - Competitive analysis (future)
35. **analyze-amplify-fit** - Analyze content repurposing fit

### 11.2 Shared Utilities

**Location**: `supabase/functions/_shared/`

**Files**:
- `aiProviders.ts` - AI provider abstractions
- `authorProfiles.ts` - Copywriting master profiles
- `geminiClient.ts` - Google Gemini client (available)
- `petermanStyleEngine.ts` - Peterman style transformations
- `photographyOntology.ts` - Image categorization system
- `productFieldFilters.ts` - Product field filtering

---

## 12. UI Components & Patterns

### 12.1 Component Structure

**Base UI Components** (`src/components/ui/`):
- shadcn/ui primitives (Button, Card, Dialog, Input, etc.)
- Custom extensions and variants
- Design system tokens

**Feature Components**:
- `src/components/forge/` - Content creation
- `src/components/amplify/` - Content repurposing
- `src/components/library/` - Content library
- `src/components/calendar/` - Calendar and scheduling
- `src/components/assistant/` - Editorial assistant
- `src/components/image-editor/` - Image generation
- `src/components/settings/` - Settings and configuration
- `src/components/dashboard/` - Dashboard widgets
- `src/components/onboarding/` - Onboarding flow

### 12.2 Common Patterns

**Data Fetching**:
```typescript
import { useQuery } from "@tanstack/react-query";

const { data, isLoading, error } = useQuery({
  queryKey: ['master-content', organizationId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('master_content')
      .select('*')
      .eq('organization_id', organizationId);
    if (error) throw error;
    return data;
  }
});
```

**Toast Notifications**:
```typescript
import { useToast } from "@/hooks/use-toast";

const { toast } = useToast();

toast({
  title: "Content saved!",
  description: "Your content has been saved to the library.",
});
```

**Modal Patterns**:
```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-4xl">
    <DialogHeader>
      <DialogTitle>Content Details</DialogTitle>
    </DialogHeader>
    {/* Modal content */}
  </DialogContent>
</Dialog>
```

### 12.3 Navigation Structure

**Sidebar Navigation** (`src/components/AppSidebar.tsx`):
- Dashboard
- Schedule
- Studio (Create, Multiply, Image Studio)
- Library (The Archives, Image Library)
- Marketplace (if e-commerce enabled)
- Help (Meet Madison, Video Tutorials)
- Settings

**Top Navigation** (when needed):
- Logo
- Main sections
- User menu
- Logout

---

## 13. Onboarding & User Journey

### 13.1 Onboarding Flow

**Step 1: Welcome Modal**
- Enhanced welcome experience
- 3-step process overview
- Time estimate: 5 minutes

**Step 2: Brand DNA Setup**
- Basic brand information
- Organization name
- Industry selection
- Brand description

**Step 3: Website Scan (Optional)**
- Enter website URL
- Automatic brand extraction
- Progress indicators
- Knowledge extraction

**Step 4: Document Upload (Optional)**
- Upload brand guidelines PDF
- Document processing
- Knowledge extraction
- Status tracking

**Step 5: Onboarding Complete**
- Brand Health Score: 40%
- Getting Started Checklist appears
- Dashboard access granted

### 13.2 Getting Started Checklist

**5 Essential Tasks**:
1. **Create Your First Content**
   - Navigate to Create
   - Generate first piece
   - Save to library

2. **Explore Your Library**
   - View The Archives
   - Understand organization
   - Search functionality

3. **Schedule a Post**
   - Navigate to Calendar
   - Schedule content
   - Understand planning

4. **Customize Your Brand**
   - Navigate to Brand Builder
   - Complete Essential 5
   - Improve brand health

5. **Try Content Multiplication**
   - Navigate to Multiply
   - Select master content
   - Generate derivatives

**Completion Rewards**:
- Brand Health Score: 85%
- All features unlocked
- Active user status

### 13.3 Contextual Tooltips

**Tooltip System**:
- Appears at key interaction points
- Contextual guidance
- Non-intrusive
- Dismissible
- Analytics tracked

**Tooltip Locations**:
1. Editor - Content refinement guidance
2. Library - Search and filter help
3. Calendar - Scheduling guidance
4. Brand Builder - Voice customization
5. Multiply - Content repurposing

---

## 14. Marketplace Features

### 14.1 Etsy Listing Generation

**Features**:
- Title optimization (140 characters)
- Description with SEO keywords
- Tags and categories
- Compliance validation
- Craftsmanship story requirements
- AI-generated content disclosure

**User Flow**:
1. Select product from catalog
2. Choose Etsy listing type
3. Generate listing content
4. Review and customize
5. Export or save

**Components**:
- `src/pages/marketplace/CreateEtsyListing.tsx`

### 14.2 Shopify Listing Generation

**Features**:
- Product descriptions
- SEO meta descriptions
- Product tags
- Collection assignments
- Variant descriptions

**User Flow**:
1. Connect Shopify store
2. Sync products
3. Select product
4. Generate listing
5. Update in Shopify

**Components**:
- `src/pages/marketplace/CreateShopifyListing.tsx`

### 14.3 TikTok Shop Listing Generation

**Features**:
- Short-form product descriptions
- Video script suggestions
- Hashtag recommendations
- Platform-specific optimization

**Components**:
- `src/pages/marketplace/CreateTikTokShopListing.tsx`

---

## 15. Image Studio System

### 15.1 Use Case-Based Categorization

**Primary Categories**:
1. **E-commerce** 🛍️
   - Product listings for online stores
   - Shot Types: Product on White, Reflective Surface

2. **Social Media** 📱
   - Content for social platforms
   - Shot Types: Lifestyle Scene, Natural Setting

3. **Editorial** 📰
   - Magazine, blog, press content
   - Shot Types: Editorial Luxury

4. **Flat Lay** 📐
   - Overhead compositions
   - Shot Types: Flat Lay

5. **Lifestyle** ✨
   - Brand storytelling with people
   - Shot Types: (Future expansion)

6. **Creative & Artistic** 🎨
   - Artistic, conceptual, experimental
   - Shot Types: (Future expansion)

### 15.2 Image Generation Flow

1. Select use case category
2. Choose shot type
3. Enter product/subject
4. Add style preferences
5. Generate image
6. Edit or add text overlay
7. Save to library

### 15.3 Image Library

**Features**:
- Browse generated images
- Filter by category
- Search functionality
- Save favorites
- Download images
- Use in content

---

## 16. Settings & Configuration

### 16.1 Brand Guidelines Tab

**Configuration Options**:
- Logo upload
- Color palette definition
- Typography settings
- Voice & tone guidelines
- Brand document upload
- Website URL for scraping

### 16.2 Products Tab

**Product Management**:
- CSV bulk import
- Manual product entry
- Category-specific fields
- Collection assignment
- Product editing
- Product deletion

**Product Categories**:
- Personal Fragrance
- Home Fragrance
- Body Care
- Skincare
- Jewelry
- Fashion
- Other

### 16.3 Collections Tab

**Collection Management**:
- Humanities configuration
- Reserve configuration
- Purity configuration
- Elemental configuration
- Descriptions and positioning
- Icons and colors

### 16.4 Team Tab

**Team Management**:
- Invite team members
- Role assignment (Owner, Admin, Member)
- Remove team members
- View team activity

### 16.5 Integrations Tab

**Available Integrations**:
- Shopify connection status
- Klaviyo connection status
- Google Calendar connection status
- API key management

---

## 17. Calendar & Scheduling

### 17.1 Calendar Views

**Month View**:
- High-level overview
- Event dots on dates
- DIP week badges
- Color-coded events

**Week View**:
- Detailed weekly schedule
- Time slots
- Event details
- Task list

**Agenda View**:
- List of upcoming events
- Chronological order
- Event details
- Quick actions

### 17.2 Scheduling Features

**Content Scheduling**:
- Schedule from library
- Schedule from Multiply
- Manual event creation
- Recurring events (future)

**Event Management**:
- Edit scheduled events
- Delete events
- Add notes
- Set reminders

**Google Calendar Sync**:
- Two-way synchronization
- Automatic updates
- Event creation
- Conflict detection

### 17.3 Task Management

**Features**:
- Daily task lists
- Task completion tracking
- Due dates
- Priority levels
- Notes per task

---

## 18. Help Center & Support

### 18.1 Help Center Features

**Video Tutorials**:
- Feature walkthroughs
- Use case examples
- Best practices
- Tips and tricks

**Learning Paths**:
- Getting started path
- Advanced features path
- Brand building path
- Content creation path

**Interactive Help**:
- Contextual tooltips
- In-app guidance
- Feature discovery
- Quick tips

### 18.2 Meet Madison

**Purpose**: Introduction to the AI assistant

**Content**:
- Madison capabilities overview
- Usage examples
- Best practices
- FAQ

**Components**:
- `src/pages/MeetMadison.tsx`

---

## 19. Known Issues & Limitations

### 19.1 AI Generation Stability

**Issue**: Anthropic Claude API occasionally returns 500 Internal Server Errors.

**Impact**: Users experience "Communication error: Unable to reach Editorial Director."

**Mitigation**: Implemented exponential backoff retry logic (3 attempts).

**Long-term solution**: Consider migration to Lovable AI Gateway for better reliability.

### 19.2 Content Editor Concurrency

**Issue**: Previous "ON CONFLICT" errors when multiple users edited same content.

**Impact**: Save failures, potential data loss.

**Mitigation**: Implemented three-step save routine (resolve → validate → save).

**Limitation**: Edge cases with rapid concurrent edits may still occur.

### 19.3 Derivative Generation

**Issue**: Multiply page sometimes reverts content when switching between derivative types.

**Impact**: User frustration, need to re-select master content.

**Status**: Under investigation, may be state management issue.

### 19.4 Library Scheduling Limitations

**Issue**: Scheduling flow from Library may not persist calendar selections.

**Impact**: Users need to re-enter scheduling details.

**Status**: Needs QA testing and potential fix.

### 19.5 Google Calendar Sync - Token Expiry

**Issue**: Refresh tokens can expire if not used within 7 days (Google policy).

**Impact**: Users need to re-authenticate periodically.

**Mitigation**: Token refresh logic in place, but cannot prevent Google-side expiry.

### 19.6 Performance with Large Organizations

**Issue**: Organizations with 500+ products or 1000+ content items may experience slow queries.

**Impact**: Delayed loading in Library and filtering.

**Mitigation**: Pagination and lazy loading (partially implemented).

**Long-term solution**: Query optimization and caching strategies.

---

## 20. Future Roadmap

### 20.1 Planned Features

**Etsy Listing Generator (In Progress)**:
- Add `etsy_listing` derivative type
- Implement Etsy-specific validation
- Create transformation prompt with 2025 compliance rules
- Add craftsmanship story field

**Migration to Lovable AI Gateway**:
- Transition from Anthropic Claude to Google Gemini 2.5 Flash
- Better reliability
- No external API key management
- Cost optimization

**ERP Integration**:
- Sync product catalog with Shopify, WooCommerce
- Inventory management
- Order fulfillment

**Analytics & Performance Dashboard**:
- Track content performance metrics
- Engagement rates
- A/B testing for derivative variations
- Prompt effectiveness scoring
- ROI tracking

**Testimonial Sync**:
- Automatically pull customer reviews
- Generate social proof content
- Product description enhancements

**Real-Time Collaboration**:
- Live cursors in Content Editor
- Presence indicators
- Collaborative commenting
- Instant updates

**Advanced Prompt Wizard**:
- Guided prompt creation
- Template builder
- Variable suggestion
- A/B testing
- Automatic optimization

**Mobile App (PWA)**:
- Progressive Web App
- Lightweight content review
- Push notifications
- Quick edits
- Voice-to-text

### 20.2 Technical Improvements

- Real-time collaboration with WebSockets
- Offline mode with service workers
- Advanced caching strategies
- Performance optimizations
- Accessibility enhancements (WCAG 2.1 AA)

---

## 21. Glossary & Terminology

### 21.1 Core Terms

**Master Content**: Original long-form content created in Create (Forge), designed to be repurposed into multiple derivative formats.

**Derivative Asset**: Repurposed content optimized for a specific channel (email, Instagram, etc.), generated from master content in Multiply (Amplify).

**Collection**: Product line grouping system (Humanities, Reserve, Purity, Elemental). Represents themes and positioning for product categories.

**DIP Week**: 4-week content production cycle tracking (Distillation in Progress).

**The Codex**: Design system name inspired by luxury editorial aesthetic.

**Editorial Assistant**: AI-powered refinement tool for improving generated content (Madison).

**Quality Rating**: 1-5 star rating system for generated content pieces.

**Amplify**: Feature for repurposing master content into derivative assets (also called "The Syndicate" or "Multiply").

**Forge**: Content creation workspace (also called "The Editorial Desk" or "Create").

**The Archives**: Content library (also called "Library" or "Reservoir").

**The Planner**: Calendar and scheduling feature (also called "Calendar" or "Schedule").

**Brand Health Score**: Percentage-based indicator of brand completeness and configuration.

**Essential 5**: Five core brand fields required for optimal brand health (Who You Help, Your Voice, Your Story, Your Values, Your Mission).

### 21.2 Technical Terms

**RLS**: Row-Level Security - Database security feature ensuring users only access their organization's data.

**Edge Function**: Serverless function running on Supabase edge network (Deno runtime).

**TanStack Query**: React library for data fetching, caching, and synchronization (formerly React Query).

**shadcn/ui**: Component library built on Radix UI primitives with Tailwind CSS.

**The Codex**: Madison Studio's custom design system with luxury editorial aesthetic.

### 21.3 Content Terms

**Content Type**: Classification of content (blog_post, email_newsletter, etc.).

**Derivative Type**: Classification of repurposed content (email, instagram, twitter, etc.).

**Shot Type**: Specific image generation style (product_on_white, lifestyle_scene, etc.).

**Use Case Category**: Broad image categorization by intended use (ecommerce, social_media, editorial, etc.).

**Master Manuscript**: Alternative term for master content.

**Derivative Editions**: Alternative term for derivative assets.

---

## Appendix A: Quick Reference

### A.1 Key Routes

- `/` - Dashboard (redirects to `/dashboard`)
- `/dashboard` - Main dashboard
- `/create` - Content creation (Forge)
- `/multiply` - Content repurposing (Amplify)
- `/library` - Content library (The Archives)
- `/image-editor` - Image Studio
- `/calendar` or `/schedule` - Calendar (The Planner)
- `/templates` - Image library / Prompt templates
- `/marketplace` - Marketplace listing generation
- `/settings` - Settings and configuration
- `/brand-builder` - Brand DNA setup
- `/brand-health` - Brand health dashboard
- `/meet-madison` - Madison AI introduction
- `/help-center` - Video tutorials and help
- `/think-mode` - Advanced AI conversation
- `/auth` - Authentication
- `/onboarding` - Brand setup wizard

### A.2 Key Database Tables

- `organizations` - Organization data and brand config
- `profiles` - User profiles linked to organizations
- `master_content` - Original long-form content
- `derivative_assets` - Repurposed channel-specific content
- `brand_products` - Product catalog
- `brand_collections` - Product line collections
- `prompts` - Saved prompt templates
- `outputs` - Generated content outputs
- `scheduled_content` - Calendar events
- `brand_knowledge` - Extracted brand intelligence
- `generated_images` - AI-generated images
- `subscriptions` - Stripe subscription data

### A.3 Key Edge Functions

- `generate-with-claude` - Primary AI generation
- `repurpose-content` - Content repurposing
- `think-mode-chat` - Advanced AI chat
- `generate-image-with-nano` - Image generation
- `process-brand-document` - Brand document processing
- `scrape-brand-website` - Website scraping
- `sync-to-google-calendar` - Calendar sync

### A.4 Support Resources

- **Documentation**: This master reference document
- **Code Comments**: Inline code documentation
- **Component Docs**: `docs/` directory
- **PRD**: `docs/MADISON-PRD.md` and `docs/PRODUCT-REQUIREMENTS-DOCUMENT.md`
- **User Journey**: `USER_JOURNEY_MAP.md`
- **Project Reference**: `docs/PROJECT-REFERENCE.md`

---

## Document Maintenance

**Update Frequency**: This document should be updated whenever:
- New features are added
- Database schema changes
- New integrations are added
- Major workflows change
- Design system updates

**Version History**:
- v1.0 (January 2025) - Initial comprehensive master reference

**Contributors**: Madison Studio Development Team

**Questions or Updates**: Update this document and notify the team

---

**END OF MADISON MASTER REFERENCE DOCUMENT**


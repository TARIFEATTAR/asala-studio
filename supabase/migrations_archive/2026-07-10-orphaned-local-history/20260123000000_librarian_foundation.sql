-- ============================================================================
-- THE LIBRARIAN - Framework Knowledge Base
-- Madison Studio's curated marketing methodology library
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- LIBRARIAN FRAMEWORKS TABLE
-- Stores curated marketing frameworks and prompt methodologies
-- ============================================================================

CREATE TABLE IF NOT EXISTS librarian_frameworks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Core identification
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  sort_letter CHAR(1) NOT NULL,

  -- Categorization
  category TEXT NOT NULL CHECK (category IN ('copy', 'image', 'video')),
  channel TEXT NOT NULL CHECK (channel IN (
    'email', 'social', 'web', 'marketplace', 'sms', 'video',
    'blog', 'instagram', 'linkedin', 'twitter', 'print'
  )),
  intent TEXT NOT NULL CHECK (intent IN ('launch', 'nurture', 'convert', 'retain', 'winback')),

  -- Madison's Masters methodology
  masters TEXT[] NOT NULL DEFAULT '{}',

  -- Schwartz Awareness Stages
  awareness_stage TEXT NOT NULL CHECK (awareness_stage IN (
    'unaware', 'problem', 'solution', 'product', 'most'
  )),

  -- Industry targeting
  industries TEXT[] NOT NULL DEFAULT '{}',

  -- Content
  short_description TEXT, -- One-liner for card preview
  framework_content TEXT NOT NULL, -- The actual prompt structure with placeholders
  madison_note TEXT NOT NULL, -- Her annotation in British voice
  example_output TEXT, -- Sample of what this produces

  -- Metadata
  usage_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_librarian_sort_letter ON librarian_frameworks(sort_letter);
CREATE INDEX idx_librarian_category ON librarian_frameworks(category);
CREATE INDEX idx_librarian_channel ON librarian_frameworks(channel);
CREATE INDEX idx_librarian_intent ON librarian_frameworks(intent);
CREATE INDEX idx_librarian_awareness ON librarian_frameworks(awareness_stage);
CREATE INDEX idx_librarian_active ON librarian_frameworks(is_active) WHERE is_active = true;
CREATE INDEX idx_librarian_featured ON librarian_frameworks(is_featured) WHERE is_featured = true;

-- Full-text search index
CREATE INDEX idx_librarian_search ON librarian_frameworks
  USING gin(to_tsvector('english', title || ' ' || COALESCE(short_description, '') || ' ' || framework_content || ' ' || madison_note));

-- GIN index for array searches
CREATE INDEX idx_librarian_masters ON librarian_frameworks USING gin(masters);
CREATE INDEX idx_librarian_industries ON librarian_frameworks USING gin(industries);

-- ============================================================================
-- LIBRARIAN USAGE LOG
-- Tracks how users interact with frameworks
-- ============================================================================

CREATE TABLE IF NOT EXISTS librarian_usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  framework_id UUID REFERENCES librarian_frameworks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- Action tracking
  action TEXT NOT NULL CHECK (action IN ('view', 'expand', 'copy', 'drag', 'search')),

  -- Context: where they accessed from
  context TEXT, -- 'forge', 'dark_room', 'multiply', 'library'

  -- Additional metadata
  search_query TEXT, -- If action was from search

  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for analytics
CREATE INDEX idx_usage_framework ON librarian_usage_log(framework_id);
CREATE INDEX idx_usage_user ON librarian_usage_log(user_id);
CREATE INDEX idx_usage_org ON librarian_usage_log(organization_id);
CREATE INDEX idx_usage_action ON librarian_usage_log(action);
CREATE INDEX idx_usage_context ON librarian_usage_log(context);
CREATE INDEX idx_usage_created ON librarian_usage_log(created_at);

-- ============================================================================
-- AGENT SUGGESTIONS LOG
-- Tracks Madison's proactive suggestions
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_suggestions_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- Suggestion details
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN (
    'idle_prompt', 'post_generation', 'framework_recommend',
    'brand_health', 'welcome_back', 'onboarding_help'
  )),
  suggestion_content TEXT NOT NULL, -- The actual message shown

  -- Context that triggered it
  trigger_context JSONB, -- What triggered this suggestion

  -- Framework reference (if suggesting a framework)
  framework_id UUID REFERENCES librarian_frameworks(id) ON DELETE SET NULL,

  -- User response
  accepted BOOLEAN,
  dismissed BOOLEAN,

  -- Timestamps
  shown_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for analytics
CREATE INDEX idx_agent_user ON agent_suggestions_log(user_id);
CREATE INDEX idx_agent_org ON agent_suggestions_log(organization_id);
CREATE INDEX idx_agent_type ON agent_suggestions_log(suggestion_type);
CREATE INDEX idx_agent_framework ON agent_suggestions_log(framework_id);
CREATE INDEX idx_agent_accepted ON agent_suggestions_log(accepted);
CREATE INDEX idx_agent_shown ON agent_suggestions_log(shown_at);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Librarian frameworks are public read (curated content)
ALTER TABLE librarian_frameworks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active frameworks" ON librarian_frameworks;
CREATE POLICY "Anyone can view active frameworks" ON librarian_frameworks
  FOR SELECT USING (is_active = true);

-- Usage log is per-user
ALTER TABLE librarian_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can log their own usage" ON librarian_usage_log;
CREATE POLICY "Users can log their own usage" ON librarian_usage_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own usage" ON librarian_usage_log;
CREATE POLICY "Users can view their own usage" ON librarian_usage_log
  FOR SELECT USING (auth.uid() = user_id);

-- Agent suggestions are per-user
ALTER TABLE agent_suggestions_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own suggestions" ON agent_suggestions_log;
CREATE POLICY "Users can insert their own suggestions" ON agent_suggestions_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own suggestions" ON agent_suggestions_log;
CREATE POLICY "Users can view their own suggestions" ON agent_suggestions_log
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own suggestions" ON agent_suggestions_log;
CREATE POLICY "Users can update their own suggestions" ON agent_suggestions_log
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to increment usage count
CREATE OR REPLACE FUNCTION increment_framework_usage(framework_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE librarian_frameworks
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE id = framework_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search frameworks
CREATE OR REPLACE FUNCTION search_librarian_frameworks(
  search_query TEXT,
  category_filter TEXT DEFAULT NULL,
  channel_filter TEXT DEFAULT NULL,
  intent_filter TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 50
)
RETURNS SETOF librarian_frameworks AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM librarian_frameworks
  WHERE is_active = true
    AND (search_query IS NULL OR to_tsvector('english', title || ' ' || COALESCE(short_description, '') || ' ' || framework_content) @@ plainto_tsquery('english', search_query))
    AND (category_filter IS NULL OR category = category_filter)
    AND (channel_filter IS NULL OR channel = channel_filter)
    AND (intent_filter IS NULL OR intent = intent_filter)
  ORDER BY
    CASE WHEN search_query IS NOT NULL THEN
      ts_rank(to_tsvector('english', title || ' ' || COALESCE(short_description, '') || ' ' || framework_content), plainto_tsquery('english', search_query))
    ELSE 0 END DESC,
    usage_count DESC,
    title ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_librarian_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS librarian_frameworks_updated_at ON librarian_frameworks;
CREATE TRIGGER librarian_frameworks_updated_at
  BEFORE UPDATE ON librarian_frameworks
  FOR EACH ROW
  EXECUTE FUNCTION update_librarian_updated_at();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON librarian_frameworks TO authenticated;
GRANT SELECT ON librarian_frameworks TO anon;
GRANT INSERT, SELECT ON librarian_usage_log TO authenticated;
GRANT INSERT, SELECT, UPDATE ON agent_suggestions_log TO authenticated;

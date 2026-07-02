-- Deterministic generation: persist the seed and the full generation recipe
-- so any render can be reproduced or debugged after the fact.
--
-- generation_seed: the seed the edge function used for this render. Passed to
--   providers that accept one (Gemini, Freepik) and used to key prompt-level
--   variation (lighting/composition rotation) for all providers, including
--   OpenAI gpt-image-2 which has no seed parameter.
-- generation_settings: JSONB recipe — seed source, provider requested/used,
--   aspect ratio, resolution, prompt mode, art-direction preset ids — enough
--   to re-issue the same request.
ALTER TABLE generated_images
  ADD COLUMN IF NOT EXISTS generation_seed bigint,
  ADD COLUMN IF NOT EXISTS generation_settings jsonb;

COMMENT ON COLUMN generated_images.generation_seed IS
  'Seed used for this render (provider seed where supported + prompt-variation key). Same seed + same inputs → reproducible output on seed-capable providers.';
COMMENT ON COLUMN generated_images.generation_settings IS
  'Full generation recipe (seed source, provider, model, aspect ratio, resolution, prompt mode, preset ids) for reproduce/debug.';

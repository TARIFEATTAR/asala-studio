-- Immutable, organization-scoped component and family-release ledger for the
-- Paper-Doll Rig. Client sessions are read-only; server/service-role code is
-- the only writer. No production data is seeded by this migration.

CREATE TABLE public.paper_doll_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  component_key TEXT NOT NULL CHECK (length(btrim(component_key)) > 0),
  geometry_family_id TEXT NOT NULL CHECK (length(btrim(geometry_family_id)) > 0),
  slot TEXT NOT NULL CHECK (slot IN ('body','cap','roller','sprayer','overcap','pump')),
  display_name TEXT NOT NULL CHECK (length(btrim(display_name)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_components_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_components_key_org_unique UNIQUE (organization_id, component_key)
);

CREATE TABLE public.paper_doll_component_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  component_id UUID NOT NULL,
  version_key TEXT NOT NULL CHECK (length(btrim(version_key)) > 0),
  material_variant TEXT NOT NULL CHECK (length(btrim(material_variant)) > 0),
  image_path TEXT NOT NULL CHECK (length(btrim(image_path)) > 0),
  image_sha256 TEXT NOT NULL CHECK (image_sha256 ~ '^[a-f0-9]{64}$'),
  geometry_mask_path TEXT,
  geometry_mask_sha256 TEXT CHECK (
    geometry_mask_sha256 IS NULL OR geometry_mask_sha256 ~ '^[a-f0-9]{64}$'
  ),
  width_px INTEGER NOT NULL CHECK (width_px > 0),
  height_px INTEGER NOT NULL CHECK (height_px > 0),
  alpha_bounds JSONB NOT NULL CHECK (
    alpha_bounds ?& ARRAY['left','top','right','bottom']
  ),
  mount_axis_x_px NUMERIC NOT NULL,
  seat_y_px NUMERIC NOT NULL,
  approval_status TEXT NOT NULL CHECK (
    approval_status IN ('candidate','blocked','approved','rejected')
  ),
  provenance JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_component_versions_mask_pair CHECK (
    (geometry_mask_path IS NULL) = (geometry_mask_sha256 IS NULL)
  ),
  CONSTRAINT paper_doll_component_versions_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_component_versions_component_version_unique
    UNIQUE (component_id, version_key),
  CONSTRAINT paper_doll_component_versions_component_org_fk
    FOREIGN KEY (component_id, organization_id)
    REFERENCES public.paper_doll_components(id, organization_id)
    ON DELETE CASCADE
);

CREATE TABLE public.paper_doll_qa_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  component_version_id UUID NOT NULL,
  gate_key TEXT NOT NULL CHECK (length(btrim(gate_key)) > 0),
  gate_version TEXT NOT NULL CHECK (length(btrim(gate_version)) > 0),
  qa_status TEXT NOT NULL CHECK (qa_status IN ('passed','failed','advisory','blocked')),
  blocking BOOLEAN NOT NULL,
  calibrated_with TEXT[] NOT NULL CHECK (cardinality(calibrated_with) > 0),
  measurements JSONB NOT NULL DEFAULT '{}'::JSONB,
  issues TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_qa_results_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_qa_results_component_version_org_fk
    FOREIGN KEY (component_version_id, organization_id)
    REFERENCES public.paper_doll_component_versions(id, organization_id)
    ON DELETE RESTRICT
);

CREATE TABLE public.paper_doll_family_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  family_key TEXT NOT NULL CHECK (length(btrim(family_key)) > 0),
  release_version TEXT NOT NULL CHECK (length(btrim(release_version)) > 0),
  release_status TEXT NOT NULL CHECK (
    release_status IN ('draft','validating','blocked','ready','published','superseded')
  ),
  canvas_width_px INTEGER NOT NULL CHECK (canvas_width_px = 2080),
  canvas_height_px INTEGER NOT NULL CHECK (canvas_height_px = 2288),
  background_hex TEXT NOT NULL CHECK (background_hex = '#F5F3EF'),
  manifest JSONB NOT NULL,
  manifest_sha256 TEXT NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  source_git_commit TEXT NOT NULL CHECK (length(btrim(source_git_commit)) > 0),
  renderer_version TEXT NOT NULL CHECK (length(btrim(renderer_version)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_family_releases_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_family_releases_family_version_unique
    UNIQUE (organization_id, family_key, release_version)
);

CREATE TABLE public.paper_doll_family_release_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  release_id UUID NOT NULL,
  component_version_id UUID NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('body','cap','roller','sprayer','overcap','pump')),
  variant_key TEXT NOT NULL CHECK (length(btrim(variant_key)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_family_release_assets_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_family_release_assets_membership_unique
    UNIQUE (release_id, slot, variant_key),
  CONSTRAINT paper_doll_family_release_assets_release_org_fk
    FOREIGN KEY (release_id, organization_id)
    REFERENCES public.paper_doll_family_releases(id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT paper_doll_family_release_assets_component_version_org_fk
    FOREIGN KEY (component_version_id, organization_id)
    REFERENCES public.paper_doll_component_versions(id, organization_id)
    ON DELETE RESTRICT
);

CREATE TABLE public.paper_doll_publish_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  release_id UUID NOT NULL,
  destination TEXT NOT NULL CHECK (length(btrim(destination)) > 0),
  publish_status TEXT NOT NULL CHECK (publish_status IN ('dry_run','success','failed','blocked')),
  request_sha256 TEXT CHECK (request_sha256 IS NULL OR request_sha256 ~ '^[a-f0-9]{64}$'),
  result JSONB NOT NULL DEFAULT '{}'::JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_publish_runs_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_publish_runs_release_org_fk
    FOREIGN KEY (release_id, organization_id)
    REFERENCES public.paper_doll_family_releases(id, organization_id)
    ON DELETE RESTRICT
);

CREATE INDEX paper_doll_components_org_slot_idx
  ON public.paper_doll_components (organization_id, slot);
CREATE INDEX paper_doll_components_geometry_family_idx
  ON public.paper_doll_components (organization_id, geometry_family_id);
CREATE INDEX paper_doll_component_versions_org_status_idx
  ON public.paper_doll_component_versions (organization_id, approval_status);
CREATE INDEX paper_doll_component_versions_component_idx
  ON public.paper_doll_component_versions (component_id);
CREATE INDEX paper_doll_qa_results_component_created_idx
  ON public.paper_doll_qa_results (component_version_id, created_at DESC);
CREATE INDEX paper_doll_qa_results_org_status_idx
  ON public.paper_doll_qa_results (organization_id, qa_status);
CREATE INDEX paper_doll_family_releases_org_status_idx
  ON public.paper_doll_family_releases (organization_id, release_status);
CREATE INDEX paper_doll_family_releases_family_version_idx
  ON public.paper_doll_family_releases (organization_id, family_key, release_version);
CREATE INDEX paper_doll_family_release_assets_component_idx
  ON public.paper_doll_family_release_assets (component_version_id);
CREATE INDEX paper_doll_publish_runs_org_created_idx
  ON public.paper_doll_publish_runs (organization_id, created_at DESC);
CREATE INDEX paper_doll_publish_runs_release_created_idx
  ON public.paper_doll_publish_runs (release_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.paper_doll_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.paper_doll_lock_approved_component_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.approval_status = 'approved'
    AND ROW(
      OLD.organization_id, OLD.component_id, OLD.version_key,
      OLD.material_variant, OLD.image_path, OLD.image_sha256,
      OLD.geometry_mask_path, OLD.geometry_mask_sha256,
      OLD.width_px, OLD.height_px, OLD.alpha_bounds,
      OLD.mount_axis_x_px, OLD.seat_y_px, OLD.approval_status, OLD.provenance
    ) IS DISTINCT FROM ROW(
      NEW.organization_id, NEW.component_id, NEW.version_key,
      NEW.material_variant, NEW.image_path, NEW.image_sha256,
      NEW.geometry_mask_path, NEW.geometry_mask_sha256,
      NEW.width_px, NEW.height_px, NEW.alpha_bounds,
      NEW.mount_axis_x_px, NEW.seat_y_px, NEW.approval_status, NEW.provenance
    )
  THEN
    RAISE EXCEPTION 'Approved paper-doll component versions are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.paper_doll_reject_qa_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Paper-doll QA evidence is append-only';
END;
$$;

CREATE OR REPLACE FUNCTION public.paper_doll_lock_release_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.release_status IN ('ready', 'published')
    AND ROW(
      OLD.organization_id, OLD.family_key, OLD.release_version,
      OLD.canvas_width_px, OLD.canvas_height_px, OLD.background_hex,
      OLD.manifest, OLD.manifest_sha256, OLD.source_git_commit, OLD.renderer_version
    ) IS DISTINCT FROM ROW(
      NEW.organization_id, NEW.family_key, NEW.release_version,
      NEW.canvas_width_px, NEW.canvas_height_px, NEW.background_hex,
      NEW.manifest, NEW.manifest_sha256, NEW.source_git_commit, NEW.renderer_version
    )
  THEN
    RAISE EXCEPTION 'Ready and published paper-doll release identities are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER paper_doll_components_touch_updated_at
  BEFORE UPDATE ON public.paper_doll_components
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_touch_updated_at();

CREATE TRIGGER paper_doll_component_versions_lock_approved
  BEFORE UPDATE ON public.paper_doll_component_versions
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_lock_approved_component_version();

CREATE TRIGGER paper_doll_component_versions_touch_updated_at
  BEFORE UPDATE ON public.paper_doll_component_versions
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_touch_updated_at();

CREATE TRIGGER paper_doll_qa_results_append_only
  BEFORE UPDATE OR DELETE ON public.paper_doll_qa_results
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_reject_qa_mutation();

CREATE TRIGGER paper_doll_family_releases_lock_identity
  BEFORE UPDATE ON public.paper_doll_family_releases
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_lock_release_identity();

CREATE TRIGGER paper_doll_family_releases_touch_updated_at
  BEFORE UPDATE ON public.paper_doll_family_releases
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_touch_updated_at();

CREATE TRIGGER paper_doll_publish_runs_touch_updated_at
  BEFORE UPDATE ON public.paper_doll_publish_runs
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_touch_updated_at();

ALTER TABLE public.paper_doll_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_component_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_qa_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_family_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_family_release_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_publish_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY paper_doll_components_select_org_members
  ON public.paper_doll_components FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_component_versions_select_org_members
  ON public.paper_doll_component_versions FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_qa_results_select_org_members
  ON public.paper_doll_qa_results FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_family_releases_select_org_members
  ON public.paper_doll_family_releases FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_family_release_assets_select_org_members
  ON public.paper_doll_family_release_assets FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_publish_runs_select_org_members
  ON public.paper_doll_publish_runs FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));

REVOKE ALL ON TABLE public.paper_doll_components FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_component_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_qa_results FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_family_releases FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_family_release_assets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_publish_runs FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.paper_doll_components TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_component_versions TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_qa_results TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_family_releases TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_family_release_assets TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_publish_runs TO authenticated;

GRANT ALL ON TABLE public.paper_doll_components TO service_role;
GRANT ALL ON TABLE public.paper_doll_component_versions TO service_role;
GRANT ALL ON TABLE public.paper_doll_qa_results TO service_role;
GRANT ALL ON TABLE public.paper_doll_family_releases TO service_role;
GRANT ALL ON TABLE public.paper_doll_family_release_assets TO service_role;
GRANT ALL ON TABLE public.paper_doll_publish_runs TO service_role;

COMMENT ON TABLE public.paper_doll_components IS
  'Logical paper-doll components; variants live in immutable component-version rows.';
COMMENT ON TABLE public.paper_doll_component_versions IS
  'Versioned image, geometry-mask, placement, material, and provenance evidence for a component.';
COMMENT ON TABLE public.paper_doll_qa_results IS
  'Append-only, calibrated QA evidence for paper-doll component versions.';
COMMENT ON TABLE public.paper_doll_family_releases IS
  'Versioned family manifests locked after ready status; Release v1 uses the 2080x2288 Bone canvas.';
COMMENT ON TABLE public.paper_doll_family_release_assets IS
  'Exact component-version membership for each family release slot and variant.';
COMMENT ON TABLE public.paper_doll_publish_runs IS
  'Server-side dry-run and publication attempt history for an immutable family release.';

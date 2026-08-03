import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ComponentSourceIntakeRequestSchema } from "./componentSourceContract";

const organizationId = "10000000-0000-4000-8000-000000000001";
const sha = "a".repeat(64);
const asset = (name: string) => ({
  bucket: "paper-doll-sources" as const,
  path: `${organizationId}/CYL-9ML/${name}/${sha}.png`,
  sha256: sha,
  contentType: "image/png",
  byteSize: 100,
});

const request = {
  organizationId, familyKey: "CYL-9ML" as const, slot: "cap" as const,
  componentKey: "closure__17-415__rollon-cap__shn-sl",
  geometryFamilyId: "closure__17-415__rollon-overcap__v1",
  displayName: "17-415 shiny silver roll-on cap", variantKey: "SHN-SL",
  versionKey: "proposed-source-v1", materialVariant: "vacuum-metallized mirror chrome on moulded phenolic plastic",
  originalFilename: "SHN-SL source.png", source: asset("source"), authorityMask: asset("mask"),
  alphaBounds: { left: 859, top: 640, right: 1221, bottom: 1002 },
  mountAxisXPx: 1040, seatYPx: 1002, registrarDisplayName: "Jordan Richter",
  intakeNote: "First cap family source",
  normalization: { targetVisibleWidthPx: 363, removedDetachedIslands: 0, sourceVisibleBounds: { left: 10, top: 20, right: 372, bottom: 382 } },
};

test("generic component intake accepts canonical caps and other non-body fitments", () => {
  assert.equal(ComponentSourceIntakeRequestSchema.parse(request).slot, "cap");
  assert.equal(ComponentSourceIntakeRequestSchema.parse({ ...request, slot: "pump", variantKey: "LOTION-WHT" }).slot, "pump");
  assert.equal(ComponentSourceIntakeRequestSchema.safeParse({ ...request, slot: "body" }).success, false);
});

test("component intake SQL is service-written, append-only, and release-neutral", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20260803000703_paper_doll_release_cut_v1.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE public\.paper_doll_component_source_intakes/i);
  assert.match(sql, /paper_doll_component_source_intakes_append_only/i);
  assert.match(sql, /GRANT EXECUTE[\s\S]*register_paper_doll_component_source[\s\S]*TO service_role/i);
  assert.match(sql, /'releaseChanged', false, 'geometryLocked', false/i);
});

test("component intake Edge verifies JWT, downloaded SHA, and exact canvas before registration", () => {
  const source = readFileSync(new URL("../../../supabase/functions/register-paper-doll-component-source/index.ts", import.meta.url), "utf8");
  assert.match(source, /auth\.getUser/);
  assert.match(source, /sha256\(sourceBytes\)/);
  assert.match(source, /width !== 2080 \|\| size\.height !== 2288/);
  assert.match(source, /register_paper_doll_component_source/);
});


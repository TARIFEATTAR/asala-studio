import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const migrationUrl = new URL(
  "../../migrations/20260715010000_best_bottles_material_pilot.sql",
  import.meta.url,
);

describe("Best Bottles material pilot telemetry schema", () => {
  it("creates run, attempt, and blinded review ledgers", () => {
    const sql = readFileSync(migrationUrl, "utf8");
    assert.match(
      sql,
      /CREATE TABLE IF NOT EXISTS public\.best_bottles_material_pilot_runs/i,
    );
    assert.match(
      sql,
      /CREATE TABLE IF NOT EXISTS public\.best_bottles_material_pilot_attempts/i,
    );
    assert.match(
      sql,
      /CREATE TABLE IF NOT EXISTS public\.best_bottles_material_pilot_reviews/i,
    );
    assert.match(sql, /reference_manifest JSONB NOT NULL/i);
    assert.match(sql, /transform_recipe JSONB/i);
    assert.match(sql, /estimated_cost_usd NUMERIC/i);
    assert.match(sql, /actual_cost_usd NUMERIC/i);
  });

  it("quarantines every benchmark attempt from publishing", () => {
    const sql = readFileSync(migrationUrl, "utf8");
    assert.match(
      sql,
      /publish_eligible BOOLEAN NOT NULL DEFAULT FALSE[\s\S]*CHECK \(publish_eligible = FALSE\)/i,
    );
    assert.match(
      sql,
      /ALTER TABLE public\.best_bottles_material_pilot_attempts ENABLE ROW LEVEL SECURITY/i,
    );
    assert.doesNotMatch(
      sql,
      /REFERENCES public\.best_bottles_pipeline_sku_images/i,
    );
  });

  it("uses organization-scoped policies and immutable identity fields", () => {
    const sql = readFileSync(migrationUrl, "utf8");
    assert.match(sql, /organization_members/i);
    assert.match(sql, /canonical_truth_hash TEXT NOT NULL/i);
    assert.match(sql, /prompt_hash TEXT NOT NULL/i);
    assert.match(sql, /renderer_id TEXT NOT NULL/i);
    assert.match(sql, /asset_role TEXT NOT NULL/i);
  });

  it("updates run counters atomically through dedicated functions", () => {
    const sql = readFileSync(migrationUrl, "utf8");
    assert.match(
      sql,
      /FUNCTION public\.best_bottles_material_pilot_mark_attempt_launched/i,
    );
    assert.match(sql, /launched_attempts = launched_attempts \+ 1/i);
    assert.match(
      sql,
      /FUNCTION public\.best_bottles_material_pilot_mark_attempt_completed/i,
    );
    assert.match(sql, /completed_attempts = completed_attempts \+ 1/i);
  });
});

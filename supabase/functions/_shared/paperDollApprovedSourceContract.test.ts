import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

function approvedSourceMigration(): string {
  const migrationsUrl = new URL("../../migrations/", import.meta.url);
  const fileName = readdirSync(migrationsUrl)
    .find((name) => name.endsWith("_register_paper_doll_approved_source.sql"));
  assert.ok(fileName, "approved-source registration migration must exist");
  return readFileSync(new URL(fileName, migrationsUrl), "utf8");
}

test("approved-source registration is service-role only, transactional, and idempotence-locked", () => {
  const sql = approvedSourceMigration();

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.register_paper_doll_approved_source/i);
  assert.match(sql, /SECURITY INVOKER/i);
  assert.match(sql, /auth\.role\(\)[\s\S]*service_role/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /ON CONFLICT \(organization_id, component_key\) DO NOTHING/i);
  assert.match(sql, /Existing approved component version identity differs/i);
  assert.match(sql, /Existing approved-source QA identity differs/i);
  assert.match(sql, /REVOKE ALL[\s\S]*FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /GRANT EXECUTE[\s\S]*TO service_role/i);
});

test("approved-source registration cannot mutate a release or publish to Sanity", () => {
  const sql = approvedSourceMigration();

  assert.doesNotMatch(sql, /INSERT INTO public\.paper_doll_family_release/i);
  assert.doesNotMatch(sql, /INSERT INTO public\.paper_doll_publish_runs/i);
  assert.match(sql, /'releaseMutation', false/i);
  assert.match(sql, /'sanityPublished', false/i);
});

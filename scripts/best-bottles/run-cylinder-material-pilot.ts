#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-net
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  compileCylinderMaterialPilotManifest,
  type MaterialPilotReferenceConditioningEvidence,
  type PilotCompiledReference,
} from "./cylinder-material-pilot.ts";
import {
  classifyMaterialPilotGatewayFailure,
  type MaterialPilotAttemptMetric,
  summarizeMaterialPilotAttempts,
} from "../../supabase/functions/_shared/bestBottlesMaterialPilot.ts";

const DEFAULT_PLAN =
  "tmp/best-bottles-reference-production/cylinder-lane-locked-remediation-v3/e2a3cce30e6f529ca6d1ee6a4e3570a2af989aa738fa3f62bd3df8a7c9a813cd/cylinder-lane-locked-remediation-plan.json";
const command = Deno.args[0] ?? "compile";
const valueAfter = (flag: string) => {
  const index = Deno.args.indexOf(flag);
  return index >= 0 ? Deno.args[index + 1] : undefined;
};
const planPath = valueAfter("--plan") ?? DEFAULT_PLAN;
const outputPath = valueAfter("--output") ??
  "tmp/best-bottles-reference-production/cylinder-material-pilot-v1/manifest.json";
const conditioningRecordPath = valueAfter("--conditioning-record");

async function hashBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    Uint8Array.from(bytes).buffer,
  );
  return [...new Uint8Array(digest)].map((part) =>
    part.toString(16).padStart(2, "0")
  ).join("");
}

async function compile() {
  const source = JSON.parse(await Deno.readTextFile(planPath));
  let conditionedReferences:
    | Record<string, MaterialPilotReferenceConditioningEvidence>
    | undefined;
  if (conditioningRecordPath) {
    const record = JSON.parse(
      await Deno.readTextFile(conditioningRecordPath),
    ) as MaterialPilotReferenceConditioningEvidence;
    conditionedReferences = { [record.websiteSku]: record };
  }
  return compileCylinderMaterialPilotManifest(source, {
    conditionedReferences,
  });
}

async function writeJson(path: string, value: unknown) {
  await Deno.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  await Deno.writeTextFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is required for '${command}'.`);
  return value;
}

async function execute() {
  const manifest = await compile();
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const userToken = Deno.env.get("SUPABASE_USER_ACCESS_TOKEN")?.trim();
  const actorToken = userToken || serviceKey;
  const organizationId = requiredEnv("BEST_BOTTLES_ORGANIZATION_ID");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? serviceKey;
  const client = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = userToken
    ? await client.auth.getUser(userToken)
    : { data: { user: null }, error: null };
  if (userToken && (userError || !userData.user)) {
    throw new Error("SUPABASE_USER_ACCESS_TOKEN is invalid.");
  }
  const priceCard = {
    "openai-gpt-image-2": {
      estimated_cost_usd: Number(
        Deno.env.get("PILOT_OPENAI_ESTIMATED_COST_USD") ?? 0,
      ),
    },
    "google-nano-banana-2": {
      estimated_cost_usd: Number(
        Deno.env.get("PILOT_GOOGLE_ESTIMATED_COST_USD") ?? 0,
      ),
    },
  };
  const { data: run, error: runError } = await client.from(
    "best_bottles_material_pilot_runs",
  ).insert({
    organization_id: organizationId,
    family: "Cylinder",
    status: "draft",
    cohort_version: manifest.version,
    cohort_manifest: manifest.products,
    renderer_ids: ["openai-gpt-image-2", "google-nano-banana-2"],
    prompt_version: "role-clean-material-pilot-v1",
    prompt_hash: "per-attempt",
    canonical_truth_hash: manifest.sourcePlanHash,
    code_version: Deno.env.get("GIT_COMMIT_SHA") ?? null,
    price_card_version: Deno.env.get("PILOT_PRICE_CARD_VERSION") ??
      "unpriced-local-v1",
    price_card: priceCard,
    planned_attempts: manifest.attempts.length,
    created_by: userData.user?.id ?? null,
  }).select("id").single();
  if (runError) throw runError;

  const prepared = new Map<string, { url: string; sha256: string }>();
  const prepareReference = async (reference: PilotCompiledReference) => {
    const cached = prepared.get(reference.sha256);
    if (cached) return cached;
    if (/^https:\/\//i.test(reference.locator)) {
      const ready = { url: reference.locator, sha256: reference.sha256 };
      prepared.set(reference.sha256, ready);
      return ready;
    }
    const bytes = await Deno.readFile(reference.locator);
    if (await hashBytes(bytes) !== reference.sha256.toLowerCase()) {
      throw new Error(`Local reference hash mismatch: ${reference.locator}`);
    }
    const path = `best-bottles/material-pilot/evidence/${reference.sha256}.png`;
    const upload = await client.storage.from("reference-images").upload(
      path,
      bytes,
      { contentType: "image/png", upsert: false },
    );
    if (
      upload.error && !/already exists|duplicate/i.test(upload.error.message)
    ) throw upload.error;
    const ready = {
      url: client.storage.from("reference-images").getPublicUrl(path).data
        .publicUrl,
      sha256: reference.sha256,
    };
    prepared.set(reference.sha256, ready);
    return ready;
  };

  const rendererFilter = valueAfter("--renderer");
  const websiteSkuFilter = valueAfter("--website-sku");
  const limit = Number(valueAfter("--limit") ?? manifest.attempts.length);
  const selectedAttempts = manifest.attempts
    .filter((attempt) =>
      (!rendererFilter || attempt.rendererId === rendererFilter) &&
      (!websiteSkuFilter || attempt.websiteSku === websiteSkuFilter)
    )
    .slice(
      0,
      Number.isFinite(limit) && limit > 0
        ? Math.floor(limit)
        : manifest.attempts.length,
    );
  const results = [];
  for (const attempt of selectedAttempts) {
    const references = [];
    for (const reference of attempt.references) {
      const ready = await prepareReference(reference);
      references.push({
        role: reference.role,
        ...ready,
        ...(reference.conditioning
          ? { conditioning: reference.conditioning }
          : {}),
      });
    }
    const response = await fetch(
      `${supabaseUrl}/functions/v1/generate-bestbottles-material-pilot`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${actorToken}`,
          apikey: anonKey,
          "Content-Type": "application/json",
          ...(userToken ? {} : { "x-material-pilot-automation": "service" }),
        },
        body: JSON.stringify({
          runId: run.id,
          organizationId,
          jobKey: attempt.jobKey,
          websiteSku: attempt.websiteSku,
          graceSku: attempt.graceSku,
          family: attempt.family,
          assetRole: attempt.assetRole,
          rendererId: attempt.rendererId,
          attemptOrdinal: attempt.attemptOrdinal,
          prompt: attempt.prompt,
          promptHash: attempt.promptHash,
          promptVersion: attempt.promptVersion,
          canonicalTruth: attempt.canonicalTruth,
          canonicalTruthHash: attempt.canonicalTruthHash,
          scaleContract: attempt.scaleContract,
          references,
          codeVersion: Deno.env.get("GIT_COMMIT_SHA") ?? null,
        }),
      },
    );
    const result = await response.json();
    const gatewayFailure = classifyMaterialPilotGatewayFailure(
      response.status,
      result,
    );
    if (gatewayFailure) {
      const { data: stranded } = await client.from(
        "best_bottles_material_pilot_attempts",
      ).select("id").eq("run_id", run.id).eq("job_key", attempt.jobKey)
        .eq("renderer_id", attempt.rendererId).eq(
          "attempt_ordinal",
          attempt.attemptOrdinal,
        ).eq("status", "running").order("created_at", {
          ascending: false,
        }).limit(1).maybeSingle();
      if (stranded?.id) {
        await client.from("best_bottles_material_pilot_attempts").update({
          status: "failed",
          failure_stage: gatewayFailure.failureStage,
          failure_code: gatewayFailure.failureCode,
          failure_reasons: gatewayFailure.failureReasons,
          error_message: gatewayFailure.errorMessage,
          duration_ms: gatewayFailure.durationMs,
          provider_completed_at: new Date().toISOString(),
          automated_decision: "reject",
        }).eq("id", stranded.id).eq("status", "running");
      }
    }
    results.push({
      status: response.status,
      rendererId: attempt.rendererId,
      jobKey: attempt.jobKey,
      attemptOrdinal: attempt.attemptOrdinal,
      result,
    });
    console.log(
      `${
        response.ok ? "OK" : "FAIL"
      } ${attempt.rendererId} ${attempt.jobKey} #${attempt.attemptOrdinal}`,
    );
  }
  await writeJson(outputPath.replace(/manifest\.json$/, `run-${run.id}.json`), {
    runId: run.id,
    results,
  });
}

async function report() {
  const runId = requiredEnv("BEST_BOTTLES_MATERIAL_PILOT_RUN_ID");
  const client = createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
  const { data: attempts, error } = await client.from(
    "best_bottles_material_pilot_attempts",
  )
    .select(
      "renderer_id,job_key,attempt_ordinal,status,failure_reasons,duration_ms,estimated_cost_usd,native_bone_qa,best_bottles_material_pilot_reviews(decision)",
    )
    .eq("run_id", runId);
  if (error) throw error;
  interface ReportRow {
    renderer_id: MaterialPilotAttemptMetric["rendererId"];
    job_key: string;
    attempt_ordinal: number;
    status: MaterialPilotAttemptMetric["providerStatus"];
    failure_reasons: string[] | null;
    duration_ms: number | null;
    estimated_cost_usd: number | string | null;
    native_bone_qa: { pass?: boolean } | null;
    best_bottles_material_pilot_reviews:
      | { decision?: MaterialPilotAttemptMetric["humanDecision"] }
      | Array<{ decision?: MaterialPilotAttemptMetric["humanDecision"] }>
      | null;
  }
  const metrics: MaterialPilotAttemptMetric[] =
    ((attempts ?? []) as ReportRow[]).map((row) => ({
      rendererId: row.renderer_id,
      jobKey: row.job_key,
      attemptOrdinal: row.attempt_ordinal,
      providerStatus: row.status,
      humanDecision:
        (Array.isArray(row.best_bottles_material_pilot_reviews)
          ? row.best_bottles_material_pilot_reviews[0]?.decision
          : row.best_bottles_material_pilot_reviews?.decision) ?? null,
      failureReasons: row.failure_reasons ?? [],
      durationMs: row.duration_ms ?? 0,
      estimatedCostUsd: Number(row.estimated_cost_usd ?? 0),
      nativeBonePass: row.native_bone_qa?.pass ?? null,
    }));
  const summary = summarizeMaterialPilotAttempts(metrics);
  const reportDir = `docs/audits/best-bottles-material-pilot/${runId}`;
  await writeJson(`${reportDir}/metrics.json`, summary);
  const lines = [
    `# Best Bottles Cylinder Material Pilot — ${runId}`,
    "",
    "Benchmark outputs are quarantined and not publish eligible.",
    "",
    "| Renderer | Attempts | Approved | Approval rate | First-pass | Bone pass | Median time | Cost / approved |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...summary.byRenderer.map((row) =>
      `| ${row.rendererId} | ${row.totalAttempts} | ${row.approvedAttempts} | ${
        row.approvalRate === null
          ? "n/a"
          : `${(row.approvalRate * 100).toFixed(1)}%`
      } | ${
        row.firstPassApprovalRate === null
          ? "n/a"
          : `${(row.firstPassApprovalRate * 100).toFixed(1)}%`
      } | ${
        row.nativeBonePassRate === null
          ? "n/a"
          : `${(row.nativeBonePassRate * 100).toFixed(1)}%`
      } | ${row.medianDurationMs ?? "n/a"} ms | ${
        row.costPerApprovedImageUsd === null
          ? "n/a"
          : `$${row.costPerApprovedImageUsd.toFixed(4)}`
      } |`
    ),
    "",
    "## Failure reasons",
    "",
    ...summary.byRenderer.flatMap((row) =>
      Object.entries(row.failureReasonCounts).map(([reason, count]) =>
        `- ${row.rendererId}: ${reason} — ${count}`
      )
    ),
    "",
  ];
  await Deno.writeTextFile(`${reportDir}/REPORT.md`, lines.join("\n"));
}

if (import.meta.main) {
  if (command === "compile") {
    const manifest = await compile();
    await writeJson(outputPath, manifest);
    console.log(
      `Compiled ${manifest.attempts.length} attempts to ${outputPath}; no API calls made.`,
    );
  } else if (command === "execute") await execute();
  else if (command === "report") await report();
  else throw new Error("Use compile, execute, or report.");
}

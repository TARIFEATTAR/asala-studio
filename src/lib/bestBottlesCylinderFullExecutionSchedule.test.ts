import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const scheduleModulePath = "./bestBottlesCylinderFullExecutionSchedule";
const cliModulePath = "../../scripts/best-bottles/build-cylinder-full-execution-schedule";

async function loadApi(): Promise<any> {
  try {
    return await import(scheduleModulePath);
  } catch {
    return {};
  }
}

async function loadLocalInput(): Promise<any> {
  try {
    const cli = await import(cliModulePath);
    assert.equal(
      typeof cli.loadCylinderFullExecutionScheduleInputFromLocalFiles,
      "function",
      "local-only schedule input loader must exist",
    );
    return cli.loadCylinderFullExecutionScheduleInputFromLocalFiles();
  } catch (error) {
    assert.fail(`local-only schedule input loader is unavailable: ${String(error)}`);
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function commandFor(batch: any): string {
  return `npx tsx scripts/best-bottles/run-cylinder-dual-role-remediation.ts --execute --allowlist '${batch.jobs.map((job: any) => job.jobId).join(",")}' --count ${batch.jobs.length}`;
}

function resealJsonFileBytes(input: any): void {
  for (const lane of [input.plan, input.compileAll, input.pilot, input.nextCohort]) {
    lane.actualFileSha256 = createHash("sha256")
      .update(`${JSON.stringify(lane.document, null, 2)}\n`)
      .digest("hex");
  }
}

function zshLexicalTokens(command: string): string[] {
  const parsed = spawnSync("zsh", ["-f", "-c", "print -r -l -- ${(Q)${(z)1}}", "_", command], {
    encoding: "utf8",
  });
  assert.equal(parsed.status, 0, parsed.stderr);
  return parsed.stdout.trimEnd().split("\n");
}

describe("Best Bottles full bounded Cylinder execution schedule", () => {
  it("exposes the local-only schedule authority API", async () => {
    const api = await loadApi();
    assert.equal(typeof api.buildCylinderFullExecutionSchedule, "function");
    assert.equal(typeof api.validateCylinderFullExecutionSchedule, "function");
    assert.equal(typeof api.serializeCylinderFullExecutionSchedule, "function");
    assert.equal(typeof api.renderCylinderFullExecutionScheduleHtml, "function");
  });

  it("builds the exact unpaid population and prepared first batch", async () => {
    const api = await loadApi();
    assert.equal(typeof api.buildCylinderFullExecutionSchedule, "function");
    const input = await loadLocalInput();
    const artifact = api.buildCylinderFullExecutionSchedule(input);

    assert.equal(artifact.summary.sealedRoleJobCount, 328);
    assert.equal(artifact.summary.scheduledJobCount, 326);
    assert.equal(artifact.summary.scheduledIdentityCount, 191);
    assert.equal(artifact.summary.blockerIdentityCount, 11);
    assert.equal(artifact.summary.vialHandoffCount, 2);
    assert.equal(artifact.pilot.jobs.length, 2);
    assert.equal(artifact.pilot.disposition, "rendered-review-pending");
    assert.equal(artifact.pilot.humanVisualApproval, "not-recorded");
    assert.equal(artifact.pilot.promotionStatus, "not-promoted");
    assert.deepEqual(
      artifact.batches[0].jobs.map((job: any) => job.jobId),
      input.nextCohort.document.jobs.map((job: any) => job.jobId),
    );
    assert.equal(artifact.generationStatus, "not-started");
    assert.equal(artifact.humanVisualApproval, "not-recorded");
    assert.equal(artifact.promotionStatus, "not-promoted");
    assert.equal(artifact.externalWriteCount, 0);
  });

  it("is byte-idempotent and renders a local-link disabled command ledger", async () => {
    const api = await loadApi();
    assert.equal(typeof api.buildCylinderFullExecutionSchedule, "function");
    const input = await loadLocalInput();
    const first = api.buildCylinderFullExecutionSchedule(input);
    const second = api.buildCylinderFullExecutionSchedule(input);
    const firstJson = api.serializeCylinderFullExecutionSchedule(first);
    const secondJson = api.serializeCylinderFullExecutionSchedule(second);
    const firstHtml = api.renderCylinderFullExecutionScheduleHtml(first);
    const secondHtml = api.renderCylinderFullExecutionScheduleHtml(second);

    assert.equal(firstJson, secondJson);
    assert.equal(firstHtml, secondHtml);
    assert.match(firstHtml, /Schedule sealed — 326 jobs not started — pilot approval required/);
    assert.match(firstHtml, /disabled-not-run/);
    assert.match(firstHtml, /npx tsx scripts\/best-bottles\/run-cylinder-dual-role-remediation\.ts/);
    assert.doesNotMatch(firstHtml, /(?:src|href)="(?:https?:|file:|\/)/);
  });

  it("writes byte-idempotent addressed output and rejects occupied mismatched bytes", async () => {
    const api = await loadApi();
    const cli = await import(cliModulePath);
    const input = await loadLocalInput();
    const artifact = api.buildCylinderFullExecutionSchedule(input);
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "cylinder-full-schedule-"));
    try {
      const first = await cli.writeAddressedCylinderFullExecutionSchedule(temporaryRoot, artifact);
      const second = await cli.writeAddressedCylinderFullExecutionSchedule(temporaryRoot, artifact);
      assert.deepEqual(first, second);
      assert.equal(
        await readFile(first.manifestPath, "utf8"),
        api.serializeCylinderFullExecutionSchedule(artifact),
      );
      assert.equal(
        await readFile(first.htmlPath, "utf8"),
        api.renderCylinderFullExecutionScheduleHtml(artifact),
      );

      await writeFile(first.manifestPath, "mutated\n");
      await assert.rejects(
        () => cli.writeAddressedCylinderFullExecutionSchedule(temporaryRoot, artifact),
        /existing addressed JSON bytes/i,
      );
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("shell-quotes every allowlist as one zsh argument with no unquoted metacharacters", async () => {
    const api = await loadApi();
    const input = await loadLocalInput();
    const artifact = api.buildCylinderFullExecutionSchedule(input);

    for (const batch of artifact.batches) {
      const tokens = zshLexicalTokens(batch.command);
      assert.deepEqual(tokens.slice(0, 5), [
        "npx",
        "tsx",
        "scripts/best-bottles/run-cylinder-dual-role-remediation.ts",
        "--execute",
        "--allowlist",
      ]);
      assert.equal(tokens[5], batch.jobs.map((job: any) => job.jobId).join(","));
      assert.deepEqual(tokens.slice(6), ["--count", String(batch.jobCount)]);
      assert.match(batch.command, /--allowlist '[^']+' --count/);
      const outsideSingleQuotes = batch.command.replace(/'[^']*'/g, "");
      assert.doesNotMatch(outsideSingleQuotes, /[|;&<>`$()]/);
    }
  });

  it("enforces every batch invariant and exact command allowlist", async () => {
    const api = await loadApi();
    assert.equal(typeof api.buildCylinderFullExecutionSchedule, "function");
    const input = await loadLocalInput();
    const artifact = api.buildCylinderFullExecutionSchedule(input);
    assert.doesNotThrow(() => api.validateCylinderFullExecutionSchedule(input, artifact));

    for (const scenario of [
      {
        name: "identity split",
        mutate(value: any) {
          const source = value.batches.find((batch: any) =>
            batch.batchNumber > 1 && batch.route === "approved-detached-dual-role" && batch.identityCount > 1
          );
          const target = value.batches.find((batch: any) =>
            batch.batchNumber !== source.batchNumber && batch.route === source.route && batch.jobCount <= 6
          );
          const moved = source.jobs.pop();
          source.jobCount = source.jobs.length;
          target.jobs.push(moved);
          target.jobCount = target.jobs.length;
          target.identityCount = new Set(target.jobs.map((job: any) => job.canonicalIdentityKey)).size;
          source.command = commandFor(source);
          target.command = commandFor(target);
        },
        error: /identity.*split|batch invariant/i,
      },
      {
        name: "role crossing",
        mutate(value: any) {
          const batch = value.batches.find((entry: any) => entry.jobs.length >= 2);
          [batch.jobs[0], batch.jobs[1]] = [batch.jobs[1], batch.jobs[0]];
          batch.command = commandFor(batch);
        },
        error: /role.*order|batch invariant/i,
      },
      {
        name: "batch over eight",
        mutate(value: any) {
          const batch = value.batches.find((entry: any) => entry.jobs.length === 8);
          batch.jobs.push(clone(batch.jobs[0]));
          batch.jobCount = 9;
        },
        error: /eight|duplicate|batch invariant/i,
      },
      {
        name: "command mismatch",
        mutate(value: any) { value.batches[0].command += ",extra-job"; },
        error: /command|allowlist/i,
      },
      {
        name: "route mixing",
        mutate(value: any) { value.batches[1].jobs[0].route = "approved-topology-exception"; },
        error: /route|batch invariant/i,
      },
      {
        name: "scheduled blocker",
        mutate(value: any) { value.batches[0].jobs[0].canonicalIdentityKey = value.blockers[0].canonicalIdentityKey; },
        error: /blocker|identity|authority/i,
      },
      {
        name: "scheduled Vial handoff",
        mutate(value: any) { value.batches[0].jobs[0].canonicalIdentityKey = value.vialHandoffs[0].canonicalIdentityKey; },
        error: /Vial|identity|authority/i,
      },
    ]) {
      const mutated = clone(artifact);
      scenario.mutate(mutated);
      assert.throws(
        () => api.validateCylinderFullExecutionSchedule(input, mutated),
        scenario.error,
        scenario.name,
      );
    }
  });

  it("fails closed on every mutated authority lane", async () => {
    const api = await loadApi();
    assert.equal(typeof api.buildCylinderFullExecutionSchedule, "function");
    const valid = await loadLocalInput();
    const pilotJobId = valid.pilot.document.roles[0].jobId;

    for (const scenario of [
      {
        name: "missing job",
        mutate(input: any) { input.compileAll.document.jobs.pop(); },
        error: /328|missing|population/i,
      },
      {
        name: "extra job",
        mutate(input: any) {
          input.compileAll.document.jobs.push({
            ...clone(input.compileAll.document.jobs[0]),
            jobId: `${input.compileAll.document.jobs[0].jobId}|extra`,
          });
        },
        error: /328|extra|population/i,
      },
      {
        name: "duplicate job",
        mutate(input: any) { input.compileAll.document.jobs[1] = clone(input.compileAll.document.jobs[0]); },
        error: /duplicate|population/i,
      },
      {
        name: "pilot leakage",
        mutate(input: any) { input.pilot.document.roles[0].jobId = input.compileAll.document.jobs[0].jobId; },
        error: /pilot|identity|role/i,
      },
      {
        name: "mutated plan",
        mutate(input: any) { input.plan.document.rows[0].canonical.capacityMl = "999"; },
        error: /plan.*SHA|semantic/i,
      },
      {
        name: "mutated prompt",
        mutate(input: any) { input.compileAll.document.jobs[0].prompt += " mutated"; },
        error: /prompt SHA/i,
      },
      {
        name: "mutated geometry",
        mutate(input: any) {
          input.compileAll.document.jobs[0].canonicalGeometrySha256 = "f".repeat(64);
        },
        error: /geometry SHA/i,
      },
      {
        name: "mutated reference bytes",
        mutate(input: any) { input.references[0].actualSha256 = "f".repeat(64); },
        error: /reference.*SHA|byte/i,
      },
      {
        name: "mutated canonical truth",
        mutate(input: any) {
          const job = input.compileAll.document.jobs[0];
          const row = input.canonicalProductTruth.rows.find((candidate: any) =>
            candidate.websiteSku === job.websiteSku && candidate.graceSku === job.graceSku
          );
          row.capColor = `${row.capColor} mutated`;
        },
        error: /canonical.*record SHA|product[- ]truth/i,
      },
      {
        name: "mutated pilot artifact",
        mutate(input: any) {
          input.pilot.document.roles.find((role: any) => role.jobId === pilotJobId).machineStatus = "fail";
        },
        error: /pilot.*machine|machine.*pass/i,
      },
      {
        name: "mutated pilot output bytes",
        mutate(input: any) { input.pilotOutputProofs[0].actualSha256 = "f".repeat(64); },
        error: /pilot.*output|output.*SHA/i,
      },
      {
        name: "mutated next-cohort artifact",
        mutate(input: any) { input.nextCohort.document.jobs.reverse(); },
        error: /next cohort|next-cohort|order|Batch 1/i,
      },
    ]) {
      const input = clone(valid);
      scenario.mutate(input);
      resealJsonFileBytes(input);
      assert.throws(
        () => api.buildCylinderFullExecutionSchedule(input),
        scenario.error,
        scenario.name,
      );
    }
  });
});

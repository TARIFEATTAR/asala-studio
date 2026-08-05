#!/usr/bin/env tsx
/**
 * Paper-doll candidate worker loop.
 *
 * The processor (process-paper-doll-candidate.ts) is intentionally per-job and
 * auditable. This watcher supplies the missing daemon: poll the queue, spawn
 * the processor for each queued job, repeat. Run alongside the studio so
 * Edit Lab imports and generations process without operator intervention:
 *
 *   npx tsx --env-file=.env scripts/paper-doll/run-candidate-worker.ts
 */
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const POLL_MS = 15_000;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const client = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

function processJob(jobId: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(
      "npx",
      ["tsx", "--env-file=.env", "scripts/paper-doll/process-paper-doll-candidate.ts", "--job", jobId],
      { stdio: "inherit" },
    );
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function tick(): Promise<void> {
  const { data, error } = await client
    .from("paper_doll_candidate_jobs")
    .select("id,status,created_at")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(3);
  if (error) {
    console.error(`[worker-loop] poll error: ${error.message}`);
    return;
  }
  for (const job of data ?? []) {
    console.log(`[worker-loop] processing ${job.id}`);
    const code = await processJob(job.id);
    console.log(`[worker-loop] job ${job.id} exited ${code}`);
  }
}

async function main(): Promise<void> {
  console.log(`[worker-loop] watching paper_doll_candidate_jobs every ${POLL_MS / 1000}s`);
  for (;;) {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

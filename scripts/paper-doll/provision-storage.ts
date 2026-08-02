import { createClient } from "@supabase/supabase-js";

import { provisionPaperDollBuckets } from "../../src/lib/paperDoll/storageProvisioning.node";

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Never expose the service-role key to Vite or browser code.",
    );
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const result = await provisionPaperDollBuckets(client);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Paper-doll Storage provisioning failed: ${message}\n`);
  process.exitCode = 1;
});

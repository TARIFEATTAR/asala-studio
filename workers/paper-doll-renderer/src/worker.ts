import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const WORKER_ROOT = fileURLToPath(new URL("..", import.meta.url));

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}.`);
  return value;
}

async function run(): Promise<void> {
  if (!process.argv.includes("--render-pack")) {
    process.stdout.write("paper-doll-renderer ready; pass --render-pack for the deterministic CYL-9ML fixture\n");
    return;
  }

  const scene = path.resolve(arg(
    "--scene",
    path.join(WORKER_ROOT, "fixtures/cyl9-rollon-scene.json"),
  ));
  const stoneLayout = path.resolve(arg(
    "--stone-layout",
    path.join(WORKER_ROOT, "../../docs/paper-doll-rig/cyl9-rollon-stone-layout.json"),
  ));
  const output = path.resolve(arg("--output", "/work/output"));
  const script = path.join(WORKER_ROOT, "blender/cyl9_rollon_overcap.py");
  const blender = process.env.BLENDER_BIN || "blender";

  await new Promise<void>((resolve, reject) => {
    const child = spawn(blender, [
      "--background",
      "--factory-startup",
      "--python",
      script,
      "--",
      "--config",
      scene,
      "--stone-layout",
      stoneLayout,
      "--output",
      output,
    ], { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0
      ? resolve()
      : reject(new Error(`Blender exited with ${code}.`)));
  });
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

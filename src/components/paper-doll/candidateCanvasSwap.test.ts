import assert from "node:assert/strict";
import test from "node:test";

test("a canvas swap becomes ready only after every replacement layer has loaded", async () => {
  const swapModule = await import("./candidateCanvasSwap").catch(() => ({}));
  const prepare = (swapModule as {
    prepareCandidateCanvasSwap?: <T>(items: readonly string[], load: (item: string) => Promise<T>) => Promise<T[]>;
  }).prepareCandidateCanvasSwap;
  assert.equal(typeof prepare, "function");

  const resolvers = new Map<string, (value: string) => void>();
  const pending = prepare!(["body", "roller"], (item) => new Promise<string>((resolve) => {
    resolvers.set(item, resolve);
  }));
  let settled = false;
  void pending.then(() => { settled = true; });

  resolvers.get("roller")?.("roller-image");
  await Promise.resolve();
  assert.equal(settled, false);

  resolvers.get("body")?.("body-image");
  assert.deepEqual(await pending, ["body-image", "roller-image"]);
});

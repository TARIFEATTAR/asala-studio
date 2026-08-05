import assert from "node:assert/strict";
import test from "node:test";

import { downloadImageLibraryCandidate } from "./libraryCandidateSource";

test("downloads a selected Image Library image without rewriting its supplied name", async () => {
  const file = await downloadImageLibraryCandidate(
    { url: "https://images.example/roller.png", name: "plastic roller master" },
    async () => new Response(new Uint8Array([137, 80, 78, 71]), {
      headers: { "content-type": "image/png" },
    }),
  );

  assert.equal(file.name, "plastic roller master.png");
  assert.equal(file.type, "image/png");
  assert.equal(file.size, 4);
});

test("preserves an Image Library filename that already has the verified extension", async () => {
  const file = await downloadImageLibraryCandidate(
    { url: "https://images.example/roller.png", name: "Rollers / 17-415 Natural Roller FINAL.png" },
    async () => new Response(new Uint8Array([137, 80, 78, 71]), {
      headers: { "content-type": "image/png" },
    }),
  );

  assert.equal(file.name, "Rollers / 17-415 Natural Roller FINAL.png");
});

test("rejects a library selection that does not resolve to an image", async () => {
  await assert.rejects(
    () => downloadImageLibraryCandidate(
      { url: "https://images.example/error", name: "bad image" },
      async () => new Response("not found", { status: 404, headers: { "content-type": "text/plain" } }),
    ),
    /could not be downloaded/i,
  );
});

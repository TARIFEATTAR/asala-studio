import assert from "node:assert/strict";

import { generateImage } from "./openaiProvider.ts";

Deno.test("GPT Image 2 sends product and material references as ordered multipart edit inputs", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = Deno.env.get("OPENAI_API_KEY");
  let capturedUrl = "";
  let capturedBody: FormData | null = null;

  Deno.env.set("OPENAI_API_KEY", "offline-contract-test-key");
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(input);
    assert.equal(init?.method, "POST");
    assert.ok(init?.body instanceof FormData);
    capturedBody = init.body;
    return new Response(
      JSON.stringify({ data: [{ b64_json: btoa("generated-image") }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const result = await generateImage({
      prompt: "Image 1 controls geometry. Image 2 controls glass material.",
      model: "gpt-image-2",
      size: "2080x2288",
      quality: "high",
      background: "opaque",
      referenceImages: [
        { data: btoa("product-reference"), mimeType: "image/png" },
        { data: btoa("material-reference"), mimeType: "image/png" },
      ],
    });

    assert.equal(capturedUrl, "https://api.openai.com/v1/images/edits");
    assert.ok(capturedBody);
    const body = capturedBody as FormData;
    const images = body.getAll("image[]");
    assert.equal(images.length, 2);
    assert.deepEqual(
      images.map((image) => image instanceof File ? image.name : null),
      ["reference-0.png", "reference-1.png"],
    );
    assert.equal(body.get("model"), "gpt-image-2");
    assert.match(String(body.get("prompt")), /Image 2 controls glass material/);
    assert.equal(result.endpoint, "edits");
    assert.equal(result.model, "gpt-image-2");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) Deno.env.delete("OPENAI_API_KEY");
    else Deno.env.set("OPENAI_API_KEY", originalApiKey);
  }
});

Deno.test("GPT Image 2 sends one reviewed cavity mask only on a masked edit", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = Deno.env.get("OPENAI_API_KEY");
  let capturedBody: FormData | null = null;

  Deno.env.set("OPENAI_API_KEY", "offline-contract-test-key");
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    assert.ok(init?.body instanceof FormData);
    capturedBody = init.body;
    return new Response(
      JSON.stringify({ data: [{ b64_json: btoa("generated-image") }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    await generateImage({
      prompt: "Add liquid only inside the reviewed cavity.",
      model: "gpt-image-2",
      size: "2080x2288",
      referenceImages: [
        { data: btoa("approved-empty-parent"), mimeType: "image/png" },
      ],
      editMask: {
        data: btoa("reviewed-cavity-mask"),
        mimeType: "image/png",
      },
    });

    assert.ok(capturedBody);
    const body = capturedBody as FormData;
    assert.equal(body.getAll("image[]").length, 1);
    const mask = body.get("mask");
    assert.ok(mask instanceof File);
    assert.equal(mask.name, "reviewed-cavity-mask.png");
    assert.equal(mask.type, "image/png");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) Deno.env.delete("OPENAI_API_KEY");
    else Deno.env.set("OPENAI_API_KEY", originalApiKey);
  }
});

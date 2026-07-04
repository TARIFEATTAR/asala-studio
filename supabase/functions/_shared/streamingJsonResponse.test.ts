import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { withHeartbeatJsonResponse } from "./streamingJsonResponse";

const HEADERS = { "Access-Control-Allow-Origin": "*" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("withHeartbeatJsonResponse", () => {
  it("returns fast handler responses verbatim, preserving non-2xx status", async () => {
    const res = await withHeartbeatJsonResponse(
      async () => jsonResponse({ error: "missing precompiled prompt" }, 400),
      HEADERS,
      { deferMs: 200, heartbeatMs: 50 },
    );

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "missing precompiled prompt");
  });

  it("returns a real 500 for fast handler rejections", async () => {
    const res = await withHeartbeatJsonResponse(
      async () => {
        throw new Error("boom");
      },
      HEADERS,
      { deferMs: 200, heartbeatMs: 50 },
    );

    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.error, "boom");
  });

  it("switches to streaming for slow handlers: whitespace heartbeats then parseable JSON", async () => {
    const res = await withHeartbeatJsonResponse(
      async () => {
        await delay(180);
        return jsonResponse({ imageUrl: "https://x/y.png", savedImageId: "abc" });
      },
      HEADERS,
      { deferMs: 40, heartbeatMs: 30 },
    );

    // Streaming mode always reports 200 with JSON content type.
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "application/json");
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");

    const text = await res.text();
    // Leading whitespace keepalives followed by the real body.
    assert.match(text, /^\s+\{/);
    assert.ok(text.trimStart().startsWith("{"), "body after heartbeats is JSON");
    // At least defer(40) + ~4 heartbeats over 180ms: expect >=2 whitespace bytes.
    const padding = text.length - text.trimStart().length;
    assert.ok(padding >= 2, `expected >=2 heartbeat bytes, got ${padding}`);
    // This is exactly what supabase-js invoke does: JSON.parse of the full body.
    const parsed = JSON.parse(text);
    assert.equal(parsed.imageUrl, "https://x/y.png");
    assert.equal(parsed.savedImageId, "abc");
  });

  it("surfaces slow-handler errors in the body (status stays 200)", async () => {
    const res = await withHeartbeatJsonResponse(
      async () => {
        await delay(120);
        throw new Error("provider exploded");
      },
      HEADERS,
      { deferMs: 30, heartbeatMs: 25 },
    );

    assert.equal(res.status, 200);
    const parsed = JSON.parse(await res.text());
    assert.equal(parsed.error, "provider exploded");
    assert.equal(parsed.errorType, "streaming_wrapper_handler_error");
  });

  it("passes through slow non-2xx handler bodies so callers can read data.error", async () => {
    const res = await withHeartbeatJsonResponse(
      async () => {
        await delay(120);
        return jsonResponse({ error: "OpenAI 500", errorType: "provider" }, 500);
      },
      HEADERS,
      { deferMs: 30, heartbeatMs: 25 },
    );

    assert.equal(res.status, 200);
    const parsed = JSON.parse(await res.text());
    assert.equal(parsed.error, "OpenAI 500");
  });
});

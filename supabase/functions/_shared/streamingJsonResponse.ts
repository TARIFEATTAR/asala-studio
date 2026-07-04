/**
 * Deferred-heartbeat JSON response wrapper.
 *
 * The Supabase edge gateway kills any request that transfers no bytes for 150s
 * (`{"code":"IDLE_TIMEOUT"}`). gpt-image-2 edits at 2080×2288 quality=high
 * routinely take 120–155s, so ~1/3 of Best Bottles generations died at the
 * gateway (measured 2026-07-04).
 *
 * Strategy: race the real handler against a defer timer.
 *  - Handler finishes within `deferMs` → return its Response verbatim
 *    (status code and headers preserved — all fast validation 4xx paths keep
 *    their exact contract).
 *  - Handler still running at `deferMs` → return a 200 streaming response
 *    immediately and emit one whitespace byte every `heartbeatMs` to keep the
 *    gateway connection alive, then append the handler's JSON body and close.
 *    `JSON.parse` ignores leading whitespace, so supabase-js `invoke()` parses
 *    the final body exactly as before.
 *
 * Contract consequence: any response produced AFTER the defer switchover
 * arrives with HTTP status 200 even if the handler failed — failures are
 * visible only as an `error` field in the JSON body. Callers must check
 * `data.error` in addition to the invoke-level non-2xx error. (Fast failures —
 * anything under `deferMs`, which covers every validation gate — still return
 * their real 4xx/5xx status.)
 *
 * Pure web APIs (Response/ReadableStream/TextEncoder) — no Deno imports — so
 * this module is unit-testable under the repo's node `tsx --test` runner.
 */

export interface HeartbeatJsonResponseOptions {
  /** How long to wait for the handler before switching to streaming mode. */
  deferMs?: number;
  /** Whitespace keepalive interval once in streaming mode. */
  heartbeatMs?: number;
}

const DEFAULT_DEFER_MS = 20_000;
const DEFAULT_HEARTBEAT_MS = 20_000;

const DEFER_SENTINEL = Symbol("heartbeat-defer-elapsed");

function errorBody(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return JSON.stringify({
    error: message,
    errorType: "streaming_wrapper_handler_error",
  });
}

export async function withHeartbeatJsonResponse(
  handler: () => Promise<Response>,
  responseHeaders: Record<string, string>,
  options: HeartbeatJsonResponseOptions = {},
): Promise<Response> {
  const deferMs = options.deferMs ?? DEFAULT_DEFER_MS;
  const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;

  // Hold the handler promise once so a rejection is never unhandled.
  const pending = handler().catch((error: unknown) => error);

  let deferTimer: ReturnType<typeof setTimeout> | undefined;
  const deferElapsed = new Promise<typeof DEFER_SENTINEL>((resolve) => {
    deferTimer = setTimeout(() => resolve(DEFER_SENTINEL), deferMs);
  });

  const first = await Promise.race([pending, deferElapsed]);
  if (first !== DEFER_SENTINEL) {
    clearTimeout(deferTimer);
    if (first instanceof Response) return first;
    // Handler rejected quickly: preserve a real 500 status for fast failures.
    return new Response(errorBody(first), {
      status: 500,
      headers: { ...responseHeaders, "Content-Type": "application/json" },
    });
  }

  // Defer window elapsed — switch to streaming keepalive mode.
  const encoder = new TextEncoder();
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const safeEnqueue = (chunk: Uint8Array): boolean => {
        try {
          controller.enqueue(chunk);
          return true;
        } catch {
          // Client disconnected; stop pumping.
          return false;
        }
      };

      // First byte immediately — the defer window already consumed part of the
      // gateway's idle budget.
      safeEnqueue(encoder.encode(" "));
      heartbeatTimer = setInterval(() => {
        if (!safeEnqueue(encoder.encode(" "))) {
          clearInterval(heartbeatTimer);
        }
      }, heartbeatMs);

      void pending.then(async (settled) => {
        clearInterval(heartbeatTimer);
        try {
          if (settled instanceof Response) {
            const text = await settled.text();
            safeEnqueue(encoder.encode(text));
          } else {
            safeEnqueue(encoder.encode(errorBody(settled)));
          }
        } catch (error) {
          safeEnqueue(encoder.encode(errorBody(error)));
        }
        try {
          controller.close();
        } catch {
          // Already closed/cancelled.
        }
      });
    },
    cancel() {
      clearInterval(heartbeatTimer);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { ...responseHeaders, "Content-Type": "application/json" },
  });
}

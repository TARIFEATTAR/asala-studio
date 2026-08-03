import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

import { runPaperDollAction } from "./paperDollEdge.ts";
import { PaperDollActionError } from "./paperDollLifecycle.ts";

Deno.test("HTTP action failures always return stable code, message, and issues", async () => {
  const response = await runPaperDollAction(
    new Request("http://localhost/action", { method: "POST" }),
    () =>
      Promise.reject(
        new PaperDollActionError(
          422,
          "named_approver_required",
          "Named approver is required.",
          [{ field: "approvedByName", message: "Named approver is required." }],
        ),
      ),
  );
  assertEquals(response.status, 422);
  assertEquals(await response.json(), {
    code: "named_approver_required",
    message: "Named approver is required.",
    issues: [{
      field: "approvedByName",
      message: "Named approver is required.",
    }],
  });
});

Deno.test("non-POST functions return the same stable error envelope", async () => {
  const response = await runPaperDollAction(
    new Request("http://localhost/action", { method: "GET" }),
    () => Promise.resolve(new Response("unreachable")),
  );
  assertEquals(response.status, 405);
  const body = await response.json();
  assertEquals(Object.keys(body).sort(), ["code", "issues", "message"]);
  assertEquals(body.code, "method_not_allowed");
});

import assert from "node:assert/strict";
import { createWritingAttachment, generateWriting } from "./writingAi.ts";
import {
  getWritingConnection,
  writingAiContext,
  type WritingConnection,
} from "./writingAiContext.ts";
import { validateWritingSettings } from "./writingAiContract.ts";
const connection: WritingConnection = {
  provider: "openai",
  model: "gpt-5-mini",
  apiKey: "offline-test-key",
  keySource: "managed",
};
const options = {
  messages: [{ role: "user" as const, content: "Write an email." }],
};
function responder(data: unknown, status = 200) {
  return async () => new Response(JSON.stringify(data), { status });
}
Deno.test("OpenAI preserves system instructions and multimodal content; extracts text after reasoning", async () => {
  const result = await generateWriting(
    {
      messages: [{ role: "system", content: "Brand voice" }, {
        role: "user",
        content: [{ type: "text", text: "Describe" }, {
          type: "image_url",
          image_url: { url: "data:image/png;base64,abcd" },
        }],
      }],
      systemPrompt: "Madison rules",
      temperature: 0.7,
    },
    connection,
    (async (url, init) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      const body = JSON.parse(String((init as { body?: unknown })?.body));
      assert.equal(body.instructions, "Madison rules\n\nBrand voice");
      assert.equal(body.store, false);
      assert.equal(body.temperature, undefined);
      assert.deepEqual(body.reasoning, { effort: "low" });
      assert.equal(body.input[0].content[1].type, "input_image");
      return responder({
        status: "completed",
        output: [{ type: "reasoning" }, {
          type: "message",
          content: [{ type: "output_text", text: "An email." }],
        }],
      })();
    }) as typeof fetch,
  );
  assert.equal(result.text, "An email.");
});
Deno.test("non-reasoning OpenAI models receive temperature", async () => {
  await generateWriting(
    options,
    { ...connection, model: "gpt-4.1-mini" },
    (async (_url, init) => {
      const body = JSON.parse(String((init as { body?: unknown })?.body));
      assert.equal(body.temperature, 0.7);
      assert.equal(body.reasoning, undefined);
      return responder({
        output: [{
          type: "message",
          content: [{ type: "output_text", text: "OK" }],
        }],
      })();
    }) as typeof fetch,
  );
});
Deno.test("Gemini sends key in header, preserves system prompt, excludes thinking text", async () => {
  const result = await generateWriting(
    { ...options, systemPrompt: "Brand", thinkingBudget: 0 },
    { ...connection, provider: "gemini", model: "gemini-2.5-flash" },
    (async (url, init) => {
      assert.ok(!String(url).includes("offline-test-key"));
      assert.equal(
        (init as { headers: Record<string, string> }).headers["x-goog-api-key"],
        connection.apiKey,
      );
      const body = JSON.parse(String((init as { body?: unknown })?.body));
      assert.equal(body.systemInstruction.parts[0].text, "Brand");
      assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 0);
      return responder({
        candidates: [{
          finishReason: "STOP",
          content: {
            parts: [{ thought: true, text: "hidden" }, { text: "visible" }],
          },
        }],
      })();
    }) as typeof fetch,
  );
  assert.equal(result.text, "visible");
});
Deno.test("free routing enforces zero token prices and never sends alternate models", async () => {
  await generateWriting(
    options,
    { ...connection, provider: "openrouter", model: "openrouter/free" },
    (async (_url, init) => {
      const body = JSON.parse(String((init as { body?: unknown })?.body));
      assert.deepEqual(body.provider.max_price, { prompt: 0, completion: 0 });
      assert.equal(body.models, undefined);
      assert.equal(body.model, "openrouter/free");
      return responder({
        choices: [{
          message: { content: "Free response" },
          finish_reason: "stop",
        }],
      })();
    }) as typeof fetch,
  );
});
Deno.test("paid OpenRouter models fail before a network request", async () => {
  let requests = 0;
  await assert.rejects(
    generateWriting(
      options,
      { ...connection, provider: "openrouter", model: "openai/gpt-5" },
      (async () => {
        requests++;
        return new Response();
      }) as typeof fetch,
    ),
    /Only free/,
  );
  assert.equal(requests, 0);
});
Deno.test("rate limits do not trigger another paid provider or leak payloads", async () => {
  let requests = 0;
  await assert.rejects(
    generateWriting(
      options,
      connection,
      (async () => {
        requests++;
        return new Response("private prompt and key", { status: 429 });
      }) as typeof fetch,
    ),
    (e) => /usage limit/.test(String(e)) && !String(e).includes("private"),
  );
  assert.equal(requests, 1);
});
Deno.test("provider errors never echo credentials", async () => {
  await assert.rejects(
    generateWriting(
      options,
      connection,
      responder({ error: { message: "offline-test-key" } }, 401),
    ),
    (e) =>
      /rejected/.test(String(e)) && !String(e).includes("offline-test-key"),
  );
});
Deno.test("truncation is retained for content adequacy retries", async () => {
  const result = await generateWriting(
    options,
    connection,
    responder({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output: [{
        type: "message",
        content: [{ type: "output_text", text: "Partial" }],
      }],
    }),
  );
  assert.equal(result.finishReason, "MAX_TOKENS");
});
Deno.test("empty or refused output fails instead of saving empty content", async () => {
  await assert.rejects(
    generateWriting(
      options,
      connection,
      responder({
        output: [{
          type: "message",
          content: [{ type: "refusal", refusal: "No" }],
        }],
      }),
    ),
    /no usable text/,
  );
});
Deno.test("simultaneous organizations retain separate provider credentials", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const a = writingAiContext.run(connection, async () => {
    await gate;
    assert.equal(getWritingConnection().apiKey, "offline-test-key");
  });
  const b = writingAiContext.run({
    ...connection,
    provider: "gemini",
    apiKey: "other-org-key",
  }, async () => {
    release();
    await Promise.resolve();
    assert.equal(getWritingConnection().apiKey, "other-org-key");
  });
  await Promise.all([a, b]);
  assert.throws(() => getWritingConnection(), /missing/);
});
Deno.test("settings reject unknown providers, invalid models and paid free-mode selections", () => {
  for (
    const value of [{ provider: "unknown", model: "x", keySource: "custom" }, {
      provider: "openrouter",
      model: "openrouter/auto",
      keySource: "managed",
    }, {
      provider: "openai",
      model: "https://example.com",
      keySource: "managed",
    }, { provider: "gemini", model: "gemini-image", keySource: "custom" }]
  ) assert.throws(() => validateWritingSettings(value));
  assert.equal(
    validateWritingSettings({
      provider: "openrouter",
      model: "vendor/model:free",
      keySource: "custom",
    }).model,
    "vendor/model:free",
  );
});

Deno.test("PDF brand scans use native OpenAI file inputs", async () => {
  await generateWriting(
    {
      messages: [{
        role: "user",
        content: [{ type: "text", text: "Extract brand JSON." }, {
          type: "file",
          filename: "brand.pdf",
          data: "data:application/pdf;base64,abcd",
        }],
      }],
    },
    connection,
    (async (_url, init) => {
      const body = JSON.parse(String((init as { body?: unknown })?.body));
      assert.deepEqual(body.input[0].content[1], {
        type: "input_file",
        filename: "brand.pdf",
        file_data: "data:application/pdf;base64,abcd",
      });
      return responder({
        output: [{
          type: "message",
          content: [{ type: "output_text", text: "{}" }],
        }],
      })();
    }) as typeof fetch,
  );
});
Deno.test("free PDF requests fail explicitly before any paid parsing or model call", async () => {
  let called = false;
  await assert.rejects(
    generateWriting(
      {
        messages: [{
          role: "user",
          content: [{
            type: "file",
            filename: "brand.pdf",
            data: "data:application/pdf;base64,abcd",
          }],
        }],
      },
      { ...connection, provider: "openrouter", model: "openrouter/free" },
      (async () => {
        called = true;
        return new Response();
      }) as typeof fetch,
    ),
    /PDF scans require/,
  );
  assert.equal(called, false);
});

Deno.test("worksheet PDF attachments use native file inputs and reject free PDF routing", async () => {
  const attachment = createWritingAttachment(
    "data:application/pdf;base64,JVBERi0=",
    "brief.pdf",
  );
  const worksheetOptions = {
    messages: [{ role: "user" as const, content: [attachment] }],
  };
  for (const provider of ["openai", "gemini"] as const) {
    await generateWriting(
      worksheetOptions,
      {
        ...connection,
        provider,
        model: provider === "gemini" ? "gemini-2.5-flash" : "gpt-5-mini",
      },
      (async (_url, init) => {
        const body = JSON.parse(String((init as { body?: unknown })?.body));
        if (provider === "openai") {
          assert.equal(body.input[0].content[0].type, "input_file");
          assert.equal(body.input[0].content[0].filename, "brief.pdf");
        } else {
          assert.equal(
            body.contents[0].parts[0].inlineData.mimeType,
            "application/pdf",
          );
        }
        return responder(
          provider === "openai"
            ? {
              output: [{
                type: "message",
                content: [{ type: "output_text", text: "{}" }],
              }],
            }
            : {
              candidates: [{
                finishReason: "STOP",
                content: { parts: [{ text: "{}" }] },
              }],
            },
        )();
      }) as typeof fetch,
    );
  }
  let calls = 0;
  await assert.rejects(
    generateWriting(
      worksheetOptions,
      { ...connection, provider: "openrouter", model: "openrouter/free" },
      (async () => {
        calls++;
        return new Response();
      }) as typeof fetch,
    ),
    /PDF scans require/,
  );
  assert.equal(calls, 0);
});
Deno.test("worksheet image attachments retain image payloads", () => {
  assert.deepEqual(
    createWritingAttachment("data:image/png;base64,abcd", "brief.png"),
    {
      type: "image_url",
      image_url: { url: "data:image/png;base64,abcd" },
    },
  );
});

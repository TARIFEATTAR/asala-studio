import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import sharp from "sharp";

import {
  PSD_EVIDENCE_EXTRACTOR_VERSION,
  inspectPsdEvidence,
  runEvidencePool,
  type PsdSourceEvidence,
} from "./psd-cap-state-evidence";

async function makePreview(input: {
  width?: number;
  height?: number;
  rectangles?: Array<{ left: number; top: number; width: number; height: number }>;
} = {}): Promise<Buffer> {
  const width = input.width ?? 100;
  const height = input.height ?? 100;
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  }).composite((input.rectangles ?? [{ left: 20, top: 10, width: 20, height: 40 }]).map((rectangle) => ({
    input: {
      create: {
        width: rectangle.width,
        height: rectangle.height,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    },
    left: rectangle.left,
    top: rectangle.top,
  }))).png().toBuffer();
}

function sourceSha(): string {
  return createHash("sha256").update("immutable-psd").digest("hex");
}

function mockMagick(preview: Buffer, sceneCount = 1) {
  return async (args: readonly string[]): Promise<Buffer> => {
    if (args[0] !== "identify") return preview;
    if (args[3]?.endsWith("[0]")) {
      return Buffer.from('{"width":100,"height":100,"opaque":"True","sceneCount":1}');
    }
    return Buffer.from(String(sceneCount));
  };
}

function readyCachedEvidence(preview: Buffer): PsdSourceEvidence {
  const previewPath = `/audit/previews/${sourceSha()}.png`;
  return {
    extractorVersion: PSD_EVIDENCE_EXTRACTOR_VERSION,
    status: "ok",
    cacheStatus: "generated",
    sourcePath: "/archive/Original.psd",
    sourceRelativePath: "Original.psd",
    sourceSha256: sourceSha(),
    sourceBytes: 13,
    sourceMtimeBefore: 900,
    sourceMtimeAfter: 900,
    sourceSizeBefore: 13,
    sourceSizeAfter: 13,
    previewPath,
    evidencePath: `/audit/evidence/${sourceSha()}.json`,
    composite: {
      width: 100,
      height: 100,
      opaque: true,
      sceneCount: 4,
      foregroundBounds: { left: 20, top: 10, width: 20, height: 40 },
      largeForegroundComponentCount: 1,
      whiteCornerCount: 4,
      minimumSafeMarginPct: 10,
      previewPath,
      evidenceSha256: createHash("sha256").update(preview).digest("hex"),
      previewWidth: 100,
      previewHeight: 100,
      cornerSamples: [
        { corner: "top-left", x: 0, y: 0, rgb: [255, 255, 255], white: true },
        { corner: "top-right", x: 99, y: 0, rgb: [255, 255, 255], white: true },
        { corner: "bottom-left", x: 0, y: 99, rgb: [255, 255, 255], white: true },
        { corner: "bottom-right", x: 99, y: 99, rgb: [255, 255, 255], white: true },
      ],
    },
    proposedClassification: "ambiguous-manual-review",
    routingHints: [],
    error: null,
  };
}

describe("immutable PSD evidence extraction", () => {
  it("hashes source bytes before rendering scene zero and leaves source metadata unchanged", async () => {
    const events: string[] = [];
    const writes: Array<{ target: string; data: Buffer }> = [];
    const preview = await makePreview();
    let statCalls = 0;

    const result = await inspectPsdEvidence({
      sourcePath: "/archive/WebA.psd",
      sourceRelativePath: "Cylinder/WebA.psd",
      outputRoot: "/audit",
      readSource: async () => {
        events.push("read-source");
        return Buffer.from("immutable-psd");
      },
      statSource: async () => {
        statCalls += 1;
        events.push(`stat-${statCalls}`);
        return { size: 13, mtimeMs: 1000 };
      },
      runMagick: async (args) => {
        events.push(`magick-${args[0]}`);
        const sourceArgument = args.find((arg) => arg.startsWith("/archive/"));
        if (args[0] === "identify" && args[2] === "%n\n") {
          assert.equal(sourceArgument, "/archive/WebA.psd");
          return Buffer.from("4\n4\n4\n4\n");
        }
        assert.equal(sourceArgument, "/archive/WebA.psd[0]");
        if (args[0] === "identify") {
          assert.equal(args[1], "-format");
          return Buffer.from('{"width":1000,"height":1600,"opaque":"True","sceneCount":4}');
        }
        assert.deepEqual(args, [
          "/archive/WebA.psd[0]",
          "-background", "white",
          "-alpha", "remove",
          "-alpha", "off",
          "-colorspace", "sRGB",
          "-resize", "900x1200>",
          "png:-",
        ]);
        return preview;
      },
      writeArtifact: async (target, data) => {
        events.push(`write-${target}`);
        writes.push({ target, data });
      },
      readCachedEvidence: async () => null,
    });

    assert.equal(result.status, "ok");
    assert.equal(result.sourceSha256, sourceSha());
    assert.equal(result.sourceMtimeBefore, result.sourceMtimeAfter);
    assert.equal(result.sourceSizeBefore, result.sourceSizeAfter);
    assert.equal(events.indexOf("read-source") < events.findIndex((event) => event.startsWith("magick-")), true);
    assert.equal(events.findIndex((event) => event.startsWith("write-")) > events.indexOf("stat-2"), true);
    assert.deepEqual(writes.map(({ target }) => target), [
      `/audit/previews/${sourceSha()}.png`,
      `/audit/evidence/${sourceSha()}.json`,
    ]);
    assert.deepEqual(writes[0].data, preview);
    assert.equal(JSON.parse(writes[1].data.toString("utf8")).sourceSha256, sourceSha());
  });

  it("records composite metadata, white corners, bounds, margins, and large components", async () => {
    const preview = await makePreview();
    const result = await inspectPsdEvidence({
      sourcePath: "/archive/WebA.psd",
      sourceRelativePath: "Cylinder/WebA.psd",
      outputRoot: "/audit",
      readSource: async () => Buffer.from("immutable-psd"),
      statSource: async () => ({ size: 13, mtimeMs: 1000 }),
      runMagick: async (args) => args[0] !== "identify" ? preview
        : args[3]?.endsWith("[0]")
          ? Buffer.from('{"width":1000,"height":1600,"opaque":"True","sceneCount":1}')
          : Buffer.from("4"),
      writeArtifact: async () => undefined,
      readCachedEvidence: async () => null,
    });

    assert.equal(result.status, "ok");
    assert.deepEqual(result.composite.foregroundBounds, { left: 20, top: 10, width: 20, height: 40 });
    assert.equal(result.composite.width, 1000);
    assert.equal(result.composite.height, 1600);
    assert.equal(result.composite.previewWidth, 100);
    assert.equal(result.composite.previewHeight, 100);
    assert.equal(result.composite.opaque, true);
    assert.equal(result.composite.sceneCount, 4);
    assert.equal(result.composite.largeForegroundComponentCount, 1);
    assert.equal(result.composite.whiteCornerCount, 4);
    assert.deepEqual(result.composite.cornerSamples.map((sample) => sample.rgb), [
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
    ]);
    assert.equal(result.composite.minimumSafeMarginPct, 10);
    assert.equal(result.composite.evidenceSha256, createHash("sha256").update(preview).digest("hex"));
    assert.equal(result.proposedClassification, "ambiguous-manual-review");
  });

  it("attaches routing hints without making a cap-state decision", async () => {
    const preview = await makePreview({
      rectangles: [
        { left: 10, top: 10, width: 20, height: 30 },
        { left: 65, top: 55, width: 20, height: 30 },
      ],
    });
    const result = await inspectPsdEvidence({
      sourcePath: "/archive/Uncapped Components/WebA.psd",
      sourceRelativePath: "Uncapped Components/WebA.psd",
      outputRoot: "/audit",
      readSource: async () => Buffer.from("immutable-psd"),
      statSource: async () => ({ size: 13, mtimeMs: 1000 }),
      runMagick: async (args) => args[0] !== "identify" ? preview
        : args[3]?.endsWith("[0]")
          ? Buffer.from('{"width":100,"height":100,"opaque":"False","sceneCount":1}')
          : Buffer.from("2"),
      writeArtifact: async () => undefined,
      readCachedEvidence: async () => null,
    });

    assert.equal(result.status, "ok");
    assert.equal(result.proposedClassification, "ambiguous-manual-review");
    assert.deepEqual(result.routingHints, [
      "folder_hint:uncapped",
      "multiple_large_components",
      "component_path_hint",
    ]);
  });

  it("uses a capped folder name only as a routing hint", async () => {
    const preview = await makePreview();
    const result = await inspectPsdEvidence({
      sourcePath: "/archive/Capped/WebA.psd",
      sourceRelativePath: "Capped/WebA.psd",
      outputRoot: "/audit",
      readSource: async () => Buffer.from("immutable-psd"),
      statSource: async () => ({ size: 13, mtimeMs: 1000 }),
      runMagick: mockMagick(preview, 1),
      writeArtifact: async () => undefined,
      readCachedEvidence: async () => null,
    });

    assert.equal(result.proposedClassification, "ambiguous-manual-review");
    assert.deepEqual(result.routingHints, ["folder_hint:capped"]);
  });

  it("reuses evidence only when source hash and extractor version match", async () => {
    let magickCalls = 0;
    let writeCalls = 0;
    const preview = await makePreview();
    const cached = readyCachedEvidence(preview);

    const result = await inspectPsdEvidence({
      sourcePath: "/archive/WebA copy.psd",
      sourceRelativePath: "Cylinder/WebA copy.psd",
      outputRoot: "/audit",
      readSource: async () => Buffer.from("immutable-psd"),
      statSource: async () => ({ size: 13, mtimeMs: 1000 }),
      runMagick: async () => {
        magickCalls += 1;
        return Buffer.alloc(0);
      },
      writeArtifact: async () => {
        writeCalls += 1;
      },
      readCachedEvidence: async (target) => {
        assert.equal(target, `/audit/evidence/${sourceSha()}.json`);
        return cached;
      },
      readArtifact: async () => preview,
    });

    assert.equal(result.status, "ok");
    assert.equal(result.cacheStatus, "reused");
    assert.equal(result.sourcePath, "/archive/WebA copy.psd");
    assert.equal(result.sourceRelativePath, "Cylinder/WebA copy.psd");
    assert.equal(result.sourceMtimeBefore, 1000);
    assert.equal(result.sourceMtimeAfter, 1000);
    assert.equal(magickCalls, 0);
    assert.equal(writeCalls, 0);
  });

  it("recomputes cached path hints while preserving pixel-derived hints", async () => {
    const preview = await makePreview();
    const cached = readyCachedEvidence(preview);
    if (cached.status === "ok") {
      cached.composite.largeForegroundComponentCount = 2;
      cached.routingHints = [
        "folder_hint:capped",
        "multiple_large_components",
        "component_path_hint",
      ];
    }

    const result = await inspectPsdEvidence({
      sourcePath: "/archive/Uncapped/WebA.psd",
      sourceRelativePath: "Uncapped/WebA.psd",
      outputRoot: "/audit",
      readSource: async () => Buffer.from("immutable-psd"),
      statSource: async () => ({ size: 13, mtimeMs: 1000 }),
      runMagick: async () => {
        throw new Error("cache should avoid ImageMagick");
      },
      writeArtifact: async () => {
        throw new Error("cache should avoid writes");
      },
      readCachedEvidence: async () => cached,
      readArtifact: async () => preview,
    });

    assert.deepEqual(result.routingHints, [
      "folder_hint:uncapped",
      "multiple_large_components",
    ]);
  });

  it("ignores a cache entry when either extractor version or source hash differs", async () => {
    const preview = await makePreview();
    for (const cached of [
      { extractorVersion: "old-version", sourceSha256: sourceSha() },
      { extractorVersion: PSD_EVIDENCE_EXTRACTOR_VERSION, sourceSha256: "f".repeat(64) },
    ]) {
      let magickCalls = 0;
      const result = await inspectPsdEvidence({
        sourcePath: "/archive/WebA.psd",
        sourceRelativePath: "Cylinder/WebA.psd",
        outputRoot: "/audit",
        readSource: async () => Buffer.from("immutable-psd"),
        statSource: async () => ({ size: 13, mtimeMs: 1000 }),
        runMagick: async (args) => {
          magickCalls += 1;
          return mockMagick(preview, 1)(args);
        },
        writeArtifact: async () => undefined,
        readCachedEvidence: async () => cached as PsdSourceEvidence,
      });
      assert.equal(result.status, "ok");
      assert.equal(result.cacheStatus, "generated");
      assert.equal(magickCalls, 3);
    }
  });

  it("regenerates incomplete, path-mismatched, missing, and tampered cached previews", async () => {
    const preview = await makePreview();
    const valid = readyCachedEvidence(preview);
    assert.equal(valid.status, "ok");
    if (valid.status !== "ok") return;
    const cases: Array<{ cached: PsdSourceEvidence; readArtifact: () => Promise<Buffer> }> = [
      { cached: { ...valid, composite: { ...valid.composite, previewWidth: 0 } }, readArtifact: async () => preview },
      { cached: { ...valid, previewPath: "/audit/previews/wrong.png" }, readArtifact: async () => preview },
      { cached: valid, readArtifact: async () => { throw Object.assign(new Error("missing"), { code: "ENOENT" }); } },
      { cached: valid, readArtifact: async () => Buffer.from("tampered-preview") },
    ];
    for (const testCase of cases) {
      let magickCalls = 0;
      const result = await inspectPsdEvidence({
        sourcePath: "/archive/WebA.psd",
        sourceRelativePath: "Cylinder/WebA.psd",
        outputRoot: "/audit",
        readSource: async () => Buffer.from("immutable-psd"),
        statSource: async () => ({ size: 13, mtimeMs: 1000 }),
        runMagick: async (args) => {
          magickCalls += 1;
          return mockMagick(preview, 4)(args);
        },
        writeArtifact: async () => undefined,
        readCachedEvidence: async () => testCase.cached,
        readArtifact: testCase.readArtifact,
      });
      assert.equal(result.cacheStatus, "generated");
      assert.equal(magickCalls, 3);
    }
  });

  it("rejects a source size or mtime change before writing artifacts", async () => {
    const preview = await makePreview();
    for (const after of [
      { size: 14, mtimeMs: 1000 },
      { size: 13, mtimeMs: 1001 },
    ]) {
      let statCalls = 0;
      let writeCalls = 0;
      await assert.rejects(() => inspectPsdEvidence({
        sourcePath: "/archive/WebA.psd",
        sourceRelativePath: "Cylinder/WebA.psd",
        outputRoot: "/audit",
        readSource: async () => Buffer.from("immutable-psd"),
        statSource: async () => (++statCalls === 1 ? { size: 13, mtimeMs: 1000 } : after),
        runMagick: mockMagick(preview, 1),
        writeArtifact: async () => {
          writeCalls += 1;
        },
        readCachedEvidence: async () => null,
      }), /Source changed during PSD evidence extraction: \/archive\/WebA\.psd/);
      assert.equal(writeCalls, 0);
    }
  });
});

describe("PSD evidence pool", () => {
  it("attempts the after stat and retains known stat evidence when source reading fails", async () => {
    let statCalls = 0;
    const [result] = await runEvidencePool({
      sources: [{
        sourcePath: "/archive/WebA.psd",
        sourceRelativePath: "Cylinder/WebA.psd",
      }],
      outputRoot: "/audit",
      readSource: async () => {
        throw new Error("source read failed exactly");
      },
      statSource: async () => {
        statCalls += 1;
        return { size: 13, mtimeMs: 1000 };
      },
      runMagick: async () => {
        throw new Error("ImageMagick must not run");
      },
      writeArtifact: async () => {
        throw new Error("artifacts must not be written");
      },
      readCachedEvidence: async () => {
        throw new Error("cache must not be read");
      },
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.error, "source read failed exactly");
    assert.equal(result.sourceSha256, null);
    assert.equal(result.sourceBytes, null);
    assert.equal(result.sourceMtimeBefore, 1000);
    assert.equal(result.sourceMtimeAfter, 1000);
    assert.equal(result.sourceSizeBefore, 13);
    assert.equal(result.sourceSizeAfter, 13);
    assert.equal(statCalls, 2);
  });

  it("retains hashed source evidence and verifies immutability when ImageMagick fails", async () => {
    let statCalls = 0;
    const [result] = await runEvidencePool({
      sources: [{
        sourcePath: "/archive/WebA.psd",
        sourceRelativePath: "Cylinder/WebA.psd",
      }],
      outputRoot: "/audit",
      readSource: async () => Buffer.from("immutable-psd"),
      statSource: async () => {
        statCalls += 1;
        return { size: 13, mtimeMs: 1000 };
      },
      runMagick: async () => {
        throw new Error("identify failed exactly");
      },
      writeArtifact: async () => undefined,
      readCachedEvidence: async () => null,
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.error, "identify failed exactly");
    assert.equal(result.sourceSha256, sourceSha());
    assert.equal(result.sourceBytes, 13);
    assert.equal(result.sourceMtimeBefore, 1000);
    assert.equal(result.sourceMtimeAfter, 1000);
    assert.equal(statCalls, 2);
  });

  it("single-flights concurrent duplicate bytes and rebinds each source record", async () => {
    const preview = await makePreview({
      rectangles: [
        { left: 10, top: 10, width: 20, height: 30 },
        { left: 65, top: 55, width: 20, height: 30 },
      ],
    });
    let magickCalls = 0;
    const writes: string[] = [];

    const results = await runEvidencePool({
      sources: [
        {
          sourcePath: "/archive/Capped Components/WebA.psd",
          sourceRelativePath: "Capped Components/WebA.psd",
        },
        {
          sourcePath: "/archive/Uncapped/WebA-copy.psd",
          sourceRelativePath: "Uncapped/WebA-copy.psd",
        },
      ],
      outputRoot: "/audit",
      readSource: async () => Buffer.from("immutable-psd"),
      statSource: async () => ({ size: 13, mtimeMs: 1000 }),
      runMagick: async (args) => {
        magickCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return mockMagick(preview, 1)(args);
      },
      writeArtifact: async (target) => {
        writes.push(target);
      },
      readCachedEvidence: async () => null,
    });

    assert.equal(magickCalls, 3);
    assert.deepEqual(writes, [
      `/audit/previews/${sourceSha()}.png`,
      `/audit/evidence/${sourceSha()}.json`,
    ]);
    assert.deepEqual(results.map(({ sourceRelativePath }) => sourceRelativePath), [
      "Capped Components/WebA.psd",
      "Uncapped/WebA-copy.psd",
    ]);
    assert.equal(results[0].status, "ok");
    assert.equal(results[1].status, "ok");
    if (results[0].status === "ok" && results[1].status === "ok") {
      assert.deepEqual(results[0].routingHints, [
        "folder_hint:capped",
        "multiple_large_components",
        "component_path_hint",
      ]);
      assert.deepEqual(results[1].routingHints, [
        "folder_hint:uncapped",
        "multiple_large_components",
      ]);
      assert.equal(results[0].cacheStatus, "generated");
      assert.equal(results[1].cacheStatus, "reused");
    }
  });

  it("evicts a failed flight so a same-hash follower can retry from its own path", async () => {
    const preview = await makePreview();
    let usableMagickCalls = 0;

    const results = await runEvidencePool({
      sources: [
        {
          sourcePath: "/archive/broken/WebA.psd",
          sourceRelativePath: "broken/WebA.psd",
        },
        {
          sourcePath: "/archive/usable/WebA-copy.psd",
          sourceRelativePath: "usable/WebA-copy.psd",
        },
      ],
      outputRoot: "/audit",
      readSource: async () => Buffer.from("immutable-psd"),
      statSource: async () => ({ size: 13, mtimeMs: 1000 }),
      runMagick: async (args) => {
        const sourceArgument = args.find((arg) => arg.startsWith("/archive/"));
        if (sourceArgument?.startsWith("/archive/broken/")) {
          throw new Error("broken source path exactly");
        }
        usableMagickCalls += 1;
        return mockMagick(preview, 1)(args);
      },
      writeArtifact: async () => undefined,
      readCachedEvidence: async () => null,
    });

    assert.equal(results[0].status, "blocked");
    assert.equal(results[0].error, "broken source path exactly");
    assert.equal(results[1].status, "ok");
    assert.equal(usableMagickCalls, 3);
  });

  it("defaults to four concurrent rows and preserves row-scoped failures", async () => {
    const sources = Array.from({ length: 9 }, (_, index) => ({
      sourcePath: `/archive/${index}.psd`,
      sourceRelativePath: `${index}.psd`,
    }));
    let active = 0;
    let maximumActive = 0;

    const results = await runEvidencePool({
      sources,
      outputRoot: "/audit",
      inspectEvidence: async (input) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        if (input.sourceRelativePath === "3.psd") {
          throw new Error("identify failed exactly");
        }
        return {
          extractorVersion: PSD_EVIDENCE_EXTRACTOR_VERSION,
          status: "ok",
          cacheStatus: "generated",
          sourcePath: input.sourcePath,
          sourceRelativePath: input.sourceRelativePath,
          sourceSha256: String(input.sourceRelativePath[0]).repeat(64),
          sourceBytes: 1,
          sourceMtimeBefore: 1,
          sourceMtimeAfter: 1,
          sourceSizeBefore: 1,
          sourceSizeAfter: 1,
        } as PsdSourceEvidence;
      },
    });

    assert.equal(maximumActive, 4);
    assert.equal(results.length, sources.length);
    assert.deepEqual(results.map((result) => result.sourceRelativePath), sources.map((source) => source.sourceRelativePath));
    const blocked = results[3];
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.error, "identify failed exactly");
    assert.equal(results.filter((result) => result.status === "ok").length, 8);
    assert.ok(results.every((result) => result.proposedClassification === "ambiguous-manual-review"));
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any, no-restricted-syntax -- fixture mutates intentionally partial JSON documents and creates literal-color raster evidence */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import sharp from "sharp";

import {
  buildCylinder81ReviewRenderPlan,
  inspectCylinder81ReviewInputs,
  promoteCylinder81ReviewOutputs,
  renderCylinder81TypeReview,
  type Cylinder81ReviewRenderDimensions,
} from "./render-cylinder-81-type-review";

const INPUT_NAMES = [
  "cylinder-81-type-review-manifest.json",
  "cylinder-216-blocker-report.json",
  "cylinder-six-collapse-candidates.json",
] as const;

const OUTPUT_NAMES = [
  "cylinder-81-annotated-review.png",
  "cylinder-41-ready-long.png",
  "cylinder-216-blocker-report.png",
  "cylinder-six-collapse-review.png",
  "render-manifest.json",
  "index.html",
] as const;

const SUMMARY = {
  canonicalIdentityCount: 377,
  typeCount: 81,
  readyTypeCount: 41,
  blockedTypeCount: 40,
  blockedIdentityCount: 216,
  collapseCandidateCount: 6,
  appliedCollapseCount: 0,
  externalWriteCount: 0,
} as const;

const TEST_DIMENSIONS: Cylinder81ReviewRenderDimensions = {
  overviewColumns: 9,
  overviewCardWidth: 220,
  overviewCardHeight: 260,
  overviewHeaderHeight: 160,
  lineupSlotWidth: 220,
  lineupHeight: 520,
  lineupHeaderHeight: 90,
  lineupBaselineY: 330,
  lineupScaleReferenceHeight: 260,
  blockerColumns: 6,
  blockerCardWidth: 240,
  blockerCardHeight: 150,
  blockerHeaderHeight: 150,
  collapseColumns: 2,
  collapseSectionWidth: 600,
  collapseSectionHeight: 550,
  collapseHeaderHeight: 150,
};

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function summaryEnvelope<T extends object>(payload: T): T & {
  version: string;
  provenance: object;
  summary: typeof SUMMARY;
} {
  return {
    version: "fixture-v1",
    provenance: {},
    summary: { ...SUMMARY },
    ...payload,
  };
}

function canonicalType(index: number, capStyle = `cap-${index}`) {
  if (index === 40) {
    return {
      family: "cylinder",
      capacityMl: 9,
      bodyHeightMm: 79.4,
      widthAxisMm: 20,
      secondAxisMm: 20,
      neckThreadSize: "18-400",
      applicator: "glass rod",
      capStyle: "tall",
    };
  }
  return {
    family: "cylinder",
    capacityMl: index < 10 ? 9 : index < 25 ? 50 : 100,
    bodyHeightMm: 70 + index,
    widthAxisMm: 20 + (index % 4),
    secondAxisMm: 20 + (index % 4),
    neckThreadSize: index < 10 ? "17-415" : "18-415",
    applicator: `applicator-${index}`,
    capStyle,
  };
}

function canonicalIdentity(identityIndex: number, canonical: ReturnType<typeof canonicalType>) {
  return {
    websiteSku: `Website${identityIndex}`,
    graceSku: `GRACE-${identityIndex}`,
    productGroupSlug: `fixture-${identityIndex}`,
    family: "Cylinder",
    capacityMl: String(canonical.capacityMl),
    canon_bodyHeightMm: String(canonical.bodyHeightMm),
    canon_widthAxisMm: String(canonical.widthAxisMm),
    canon_secondAxisMm: String(canonical.secondAxisMm),
    canon_heightWithCapMm: String(canonical.bodyHeightMm + 10),
    neckThreadSize: canonical.neckThreadSize,
    applicator: canonical.applicator,
    capStyle: canonical.capStyle,
  };
}

function fixtureDocuments(previewPath: string, previewSha256: string) {
  let identityIndex = 0;
  const readyTypes = Array.from({ length: 41 }, (_, typeIndex) => {
    const canonical = canonicalType(typeIndex);
    const readyIdentityCount = typeIndex < 38 ? 4 : 3;
    const identities = Array.from({ length: readyIdentityCount }, (_, memberIndex) => {
      const current = identityIndex++;
      const canonicalRow = canonicalIdentity(current, canonical);
      if (typeIndex === 40) canonicalRow.canon_heightWithCapMm = "50";
      const canonicalIdentityKey = typeIndex === 40 && memberIndex === 0
        ? "GB09BLACKCAPAPP|GBCYLCLR9MLT01"
        : `WEBSITE${current}|GRACE${current}`;
      return {
        canonicalIdentityKey,
        canonical: canonicalRow,
        referenceReady: true,
        blockers: [],
        approvedReferences: [],
        primaryReference: null,
      };
    });
    const representativeIdentity = identities[0];
    const representative = {
      sourcePath: `/fixture/source-${typeIndex}.psd`,
      sourceRelativePath: `source-${typeIndex}.psd`,
      sourceSha256: `${typeIndex}`.padStart(64, "0"),
      previewPath,
      previewSha256,
      classification: "assembled-cap-on",
      reviewUnitKey: `review-${typeIndex}`,
      canonicalIdentityKey: representativeIdentity.canonicalIdentityKey,
      foregroundBounds: { left: 20, top: 10, width: 60, height: 180 },
      compositeWidth: 100,
      compositeHeight: 200,
      opaque: true,
    };
    representativeIdentity.approvedReferences = [representative];
    representativeIdentity.primaryReference = representative;
    return {
      typeKey: `ready-type-${String(typeIndex).padStart(2, "0")}`,
      status: "ready",
      canonical,
      identities,
      representative,
      approvedReferenceProvenance: [{ ...representative, selected: true }],
      scale: typeIndex === 40
        ? {
          contractVersion: "best-bottles-catalog-scale-v1",
          status: "blocked",
          blocker: "canonical-with-cap-below-body",
          canonical: {
            capacityMl: canonical.capacityMl,
            bodyHeightMm: canonical.bodyHeightMm,
            widthAxisMm: canonical.widthAxisMm,
            secondAxisMm: canonical.secondAxisMm,
            heightWithCapMm: 50,
          },
          placement: null,
        }
        : {
          contractVersion: "best-bottles-catalog-scale-v1",
          status: "ready",
          blocker: null,
          canonical: {
            capacityMl: canonical.capacityMl,
            bodyHeightMm: canonical.bodyHeightMm,
            widthAxisMm: canonical.widthAxisMm,
            secondAxisMm: canonical.secondAxisMm,
            heightWithCapMm: canonical.bodyHeightMm + 10,
          },
          placement: { assembledHeightPct: 56 + (typeIndex % 24), bodyToAssembledRatio: 0.9 },
        },
    };
  });

  const blockedIdentities: any[] = [];
  const blockedTypes = Array.from({ length: 40 }, (_, typeIndex) => {
    const canonical = canonicalType(100 + typeIndex);
    const memberCount = typeIndex < 16 ? 6 : 5;
    const identities = Array.from({ length: memberCount }, () => {
      const current = identityIndex++;
      const blockers = typeIndex % 3 === 0
        ? ["no-approved-exact-reference"]
        : typeIndex % 3 === 1
          ? ["ambiguous-canonical-body-geometry"]
          : ["ambiguous-canonical-body-geometry", "no-approved-exact-reference"];
      const identity = {
        canonicalIdentityKey: `WEBSITE${current}|GRACE${current}`,
        canonical: canonicalIdentity(current, canonical),
        referenceReady: false,
        blockers,
        approvedReferences: [],
        primaryReference: null,
      };
      blockedIdentities.push({
        canonicalIdentityKey: identity.canonicalIdentityKey,
        typeKey: `blocked-type-${String(typeIndex).padStart(2, "0")}`,
        canonical: identity.canonical,
        blockers,
      });
      return identity;
    });
    return {
      typeKey: `blocked-type-${String(typeIndex).padStart(2, "0")}`,
      status: "blocked",
      canonical,
      identities,
      representative: null,
      approvedReferenceProvenance: [],
      scale: {
        contractVersion: "best-bottles-catalog-scale-v1",
        status: "unavailable",
        blocker: "no-reference-ready-representative",
        canonical: {
          capacityMl: canonical.capacityMl,
          bodyHeightMm: canonical.bodyHeightMm,
          widthAxisMm: canonical.widthAxisMm,
          secondAxisMm: canonical.secondAxisMm,
          heightWithCapMm: canonical.bodyHeightMm + 10,
        },
        placement: null,
      },
    };
  });
  assert.equal(identityIndex, 377);
  assert.equal(blockedIdentities.length, 216);

  const collapseCandidates = Array.from({ length: 6 }, (_, candidateIndex) => {
    const left = readyTypes[candidateIndex * 2];
    const right = readyTypes[candidateIndex * 2 + 1];
    right.canonical = { ...left.canonical, capStyle: `right-cap-${candidateIndex}` };
    for (const identity of right.identities) {
      identity.canonical = {
        ...identity.canonical,
        capacityMl: String(right.canonical.capacityMl),
        canon_bodyHeightMm: String(right.canonical.bodyHeightMm),
        canon_widthAxisMm: String(right.canonical.widthAxisMm),
        canon_secondAxisMm: String(right.canonical.secondAxisMm),
        canon_heightWithCapMm: String(right.canonical.bodyHeightMm + 10),
        neckThreadSize: right.canonical.neckThreadSize,
        applicator: right.canonical.applicator,
        capStyle: right.canonical.capStyle,
      };
    }
    right.scale.canonical = { ...left.scale.canonical };
    return {
      candidateId: `candidate-${candidateIndex + 1}`,
      leftTypeKey: left.typeKey,
      rightTypeKey: right.typeKey,
      sharedCanonical: {
        family: left.canonical.family,
        capacityMl: left.canonical.capacityMl,
        bodyHeightMm: left.canonical.bodyHeightMm,
        widthAxisMm: left.canonical.widthAxisMm,
        secondAxisMm: left.canonical.secondAxisMm,
        neckThreadSize: left.canonical.neckThreadSize,
        applicator: left.canonical.applicator,
      },
      capStyles: [left.canonical.capStyle, right.canonical.capStyle],
      decision: "pending-human-review",
      applied: false,
    };
  });

  const manifest = summaryEnvelope({
    scaleContractVersion: "best-bottles-catalog-scale-v1",
    types: [...readyTypes, ...blockedTypes],
    blockedIdentities,
    collapseCandidates,
  });
  const blockerReport = summaryEnvelope({ blockedIdentities: clone(blockedIdentities) });
  const collapseReport = summaryEnvelope({ collapseCandidates: clone(collapseCandidates) });
  return { manifest, blockerReport, collapseReport };
}

async function makeFixture(options?: { alpha?: boolean }) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "bb-cylinder-81-render-"));
  const root = path.join(temporaryRoot, "cylinder-81-type-review-v1");
  await mkdir(root);
  const previewPath = path.join(temporaryRoot, "fixture-preview.png");
  const channels = options?.alpha ? 4 : 3;
  const background = options?.alpha
    ? { r: 255, g: 255, b: 255, alpha: 0.5 }
    : { r: 255, g: 255, b: 255 };
  await sharp({ create: { width: 100, height: 200, channels, background } })
    .composite([{ input: { create: { width: 40, height: 160, channels: 3, background: "#333333" } }, left: 30, top: 20 }])
    .png()
    .toFile(previewPath);
  const previewBytes = await readFile(previewPath);
  const documents = fixtureDocuments(previewPath, sha256(previewBytes));
  await Promise.all([
    writeFile(path.join(root, INPUT_NAMES[0]), `${JSON.stringify(documents.manifest, null, 2)}\n`),
    writeFile(path.join(root, INPUT_NAMES[1]), `${JSON.stringify(documents.blockerReport, null, 2)}\n`),
    writeFile(path.join(root, INPUT_NAMES[2]), `${JSON.stringify(documents.collapseReport, null, 2)}\n`),
  ]);
  return { temporaryRoot, root, previewPath, documents };
}

async function sourceHashes(root: string, previewPath: string) {
  const values = await Promise.all([
    ...INPUT_NAMES.map(async (name) => [name, sha256(await readFile(path.join(root, name)))] as const),
    [previewPath, sha256(await readFile(previewPath))] as const,
  ]);
  return Object.fromEntries(values);
}

describe("Cylinder canonical 81-type render plan", () => {
  it("preserves all 81 slots, 216 exact blockers, and six unapplied review pairs", async () => {
    const fixture = await makeFixture();
    const inspection = await inspectCylinder81ReviewInputs({
      root: fixture.root,
      dimensions: TEST_DIMENSIONS,
    });
    const plan = buildCylinder81ReviewRenderPlan(inspection.validated);

    assert.equal(plan.slots.length, 81);
    assert.equal(plan.slots.filter((slot) => slot.status === "ready").length, 41);
    assert.equal(plan.slots.filter((slot) => slot.status === "blocked").length, 40);
    assert.ok(plan.slots.filter((slot) => slot.status === "blocked")
      .every((slot) => slot.placeholderLabel.startsWith("BLOCKED")));
    assert.equal(plan.blockerCards.length, 216);
    assert.equal(new Set(plan.blockerCards.map((card) => card.canonicalIdentityKey)).size, 216);
    assert.equal(plan.collapseSections.length, 6);
    assert.ok(plan.collapseSections.every((section) => (
      section.decision === "pending-human-review" && section.applied === false
    )));
    assert.equal(plan.readyLineup.length, 41);
    const scaleBlocked = plan.readyLineup.filter((slot) => slot.scaleStatus === "blocked");
    assert.equal(scaleBlocked.length, 1);
    assert.equal(scaleBlocked[0].comparativePlacement, null);
    assert.match(scaleBlocked[0].scaleWarning ?? "", /^SCALE BLOCKED/);
    assert.ok(Object.values(plan.outputDimensions)
      .every(({ width, height }) => width * height < 268_402_689));
  });

  it("fails before outputs on hash, alpha, crop, summary, or candidate mismatch", async () => {
    const cases: Array<{
      name: string;
      mutate: (fixture: Awaited<ReturnType<typeof makeFixture>>) => Promise<void>;
      message: RegExp;
      alpha?: boolean;
    }> = [{
      name: "preview hash",
      mutate: async ({ root }) => {
        const manifest = JSON.parse(await readFile(path.join(root, INPUT_NAMES[0]), "utf8"));
        manifest.types.find((type: any) => type.status === "ready").representative.previewSha256 = "0".repeat(64);
        await writeFile(path.join(root, INPUT_NAMES[0]), `${JSON.stringify(manifest)}\n`);
      },
      message: /preview SHA-256 mismatch/i,
    }, {
      name: "alpha preview",
      alpha: true,
      mutate: async () => undefined,
      message: /must be opaque/i,
    }, {
      name: "out-of-bounds crop",
      mutate: async ({ root }) => {
        const manifest = JSON.parse(await readFile(path.join(root, INPUT_NAMES[0]), "utf8"));
        manifest.types.find((type: any) => type.status === "ready").representative.foregroundBounds.left = 99;
        await writeFile(path.join(root, INPUT_NAMES[0]), `${JSON.stringify(manifest)}\n`);
      },
      message: /crop.*bounds/i,
    }, {
      name: "summary mismatch",
      mutate: async ({ root }) => {
        const manifest = JSON.parse(await readFile(path.join(root, INPUT_NAMES[0]), "utf8"));
        manifest.summary.readyTypeCount = 40;
        await writeFile(path.join(root, INPUT_NAMES[0]), `${JSON.stringify(manifest)}\n`);
      },
      message: /readyTypeCount=41/i,
    }, {
      name: "candidate mismatch",
      mutate: async ({ root }) => {
        const report = JSON.parse(await readFile(path.join(root, INPUT_NAMES[2]), "utf8"));
        report.collapseCandidates[0].rightTypeKey = "missing-type";
        await writeFile(path.join(root, INPUT_NAMES[2]), `${JSON.stringify(report)}\n`);
      },
      message: /collapse candidate report does not equal/i,
    }, {
      name: "scale contract mismatch",
      mutate: async ({ root }) => {
        const manifest = JSON.parse(await readFile(path.join(root, INPUT_NAMES[0]), "utf8"));
        manifest.scaleContractVersion = "unapproved-scale";
        await writeFile(path.join(root, INPUT_NAMES[0]), `${JSON.stringify(manifest)}\n`);
      },
      message: /must use scale contract best-bottles-catalog-scale-v1/i,
    }, {
      name: "invalid ready placement",
      mutate: async ({ root }) => {
        const manifest = JSON.parse(await readFile(path.join(root, INPUT_NAMES[0]), "utf8"));
        manifest.types.find((type: any) => type.scale.status === "ready").scale.placement.assembledHeightPct = null;
        await writeFile(path.join(root, INPUT_NAMES[0]), `${JSON.stringify(manifest)}\n`);
      },
      message: /valid approved comparative placement/i,
    }, {
      name: "second scale blocker",
      mutate: async ({ root }) => {
        const manifest = JSON.parse(await readFile(path.join(root, INPUT_NAMES[0]), "utf8"));
        const second = manifest.types.find((type: any) => type.scale.status === "ready");
        second.scale = {
          ...second.scale,
          status: "blocked",
          blocker: "canonical-with-cap-below-body",
          placement: null,
        };
        await writeFile(path.join(root, INPUT_NAMES[0]), `${JSON.stringify(manifest)}\n`);
      },
      message: /exactly one scale-blocked ready glass-rod type/i,
    }];

    for (const testCase of cases) {
      const fixture = await makeFixture({ alpha: testCase.alpha });
      await testCase.mutate(fixture);
      await assert.rejects(
        inspectCylinder81ReviewInputs({ root: fixture.root, dimensions: TEST_DIMENSIONS }),
        testCase.message,
        testCase.name,
      );
      assert.deepEqual((await readdir(fixture.root)).sort(), [...INPUT_NAMES].sort());
    }
  });
});

describe("Cylinder canonical 81-type integration renderer", () => {
  it("writes exactly six local outputs without changing any input or approved preview bytes", async () => {
    const fixture = await makeFixture();
    const before = await sourceHashes(fixture.root, fixture.previewPath);
    const result = await renderCylinder81TypeReview({
      root: fixture.root,
      dimensions: TEST_DIMENSIONS,
      generatedAt: "2026-07-12T00:00:00.000Z",
    });
    const after = await sourceHashes(fixture.root, fixture.previewPath);

    assert.deepEqual(after, before);
    assert.deepEqual(
      (await readdir(fixture.root)).filter((name) => !INPUT_NAMES.includes(name as any)).sort(),
      [...OUTPUT_NAMES].sort(),
    );
    assert.deepEqual(Object.keys(result.artifactPaths).sort(), [...OUTPUT_NAMES].sort());

    for (const pngName of OUTPUT_NAMES.filter((name) => name.endsWith(".png"))) {
      const metadata = await sharp(path.join(fixture.root, pngName)).metadata();
      assert.equal(metadata.hasAlpha, false, pngName);
      assert.equal(metadata.channels, 3, pngName);
      assert.ok((metadata.width ?? 0) * (metadata.height ?? 0) < 268_402_689, pngName);
      assert.deepEqual(
        { width: metadata.width, height: metadata.height },
        result.renderManifest.outputs[pngName].dimensions,
      );
    }

    const indexHtml = await readFile(path.join(fixture.root, "index.html"), "utf8");
    assert.ok(OUTPUT_NAMES.filter((name) => name.endsWith(".png"))
      .every((name) => indexHtml.includes(`src="${name}"`)));
    assert.doesNotMatch(indexHtml, /(?:src|href)="(?:file:|\/)/);
    assert.match(indexHtml, /81 count remains canonical/i);

    const renderManifestBytes = await readFile(path.join(fixture.root, "render-manifest.json"));
    const renderManifest = JSON.parse(renderManifestBytes.toString("utf8"));
    assert.equal(renderManifest.selfHashStatus, "excluded-self-referential");
    assert.equal(renderManifest.selfPath, path.join(fixture.root, "render-manifest.json"));
    assert.deepEqual(renderManifest.summary, SUMMARY);
    assert.equal(renderManifest.previews.length, 41);
    for (const [name, output] of Object.entries<any>(renderManifest.outputs)) {
      assert.equal(output.sha256, sha256(await readFile(path.join(fixture.root, name))), name);
    }
    assert.equal(renderManifest.externalWriteCount, 0);
  });

  it("restores the complete previous output set when promotion fails midway", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bb-cylinder-81-promotion-"));
    const stagedDirectory = path.join(root, ".render-stage");
    await mkdir(stagedDirectory);
    for (const name of OUTPUT_NAMES) {
      await writeFile(path.join(root, name), `previous:${name}`);
      await writeFile(path.join(stagedDirectory, name), `replacement:${name}`);
    }
    let promotionCount = 0;
    await assert.rejects(
      promoteCylinder81ReviewOutputs({
        root,
        stagedDirectory,
        renameOutput: async (source, target) => {
          promotionCount += 1;
          if (promotionCount === 4) throw new Error("injected mid-promotion failure");
          await rename(source, target);
        },
      }),
      /injected mid-promotion failure/,
    );
    for (const name of OUTPUT_NAMES) {
      assert.equal(await readFile(path.join(root, name), "utf8"), `previous:${name}`);
    }
    assert.ok((await readdir(root)).every((name) => !name.startsWith(".render-backup-")));
  });

  it("preserves recovery backups when rollback itself is incomplete", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bb-cylinder-81-recovery-"));
    const stagedDirectory = path.join(root, ".render-stage");
    await mkdir(stagedDirectory);
    for (const name of OUTPUT_NAMES) {
      await writeFile(path.join(root, name), `previous:${name}`);
      await writeFile(path.join(stagedDirectory, name), `replacement:${name}`);
    }
    let promotionCount = 0;
    let restoreCount = 0;
    await assert.rejects(
      promoteCylinder81ReviewOutputs({
        root,
        stagedDirectory,
        renameOutput: async (source, target) => {
          promotionCount += 1;
          if (promotionCount === 4) throw new Error("injected promotion failure");
          await rename(source, target);
        },
        restoreOutput: async (source, target) => {
          restoreCount += 1;
          if (restoreCount === 1) throw new Error("injected restore failure");
          await rename(source, target);
        },
      }),
      /rollback was incomplete.*recovery backup preserved at/i,
    );
    const backupNames = (await readdir(root)).filter((name) => name.startsWith(".render-backup-"));
    assert.equal(backupNames.length, 1);
    assert.equal(
      await readFile(path.join(root, backupNames[0], OUTPUT_NAMES[2]), "utf8"),
      `previous:${OUTPUT_NAMES[2]}`,
    );
  });
});

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildCyl9CatalogCrosswalk,
  type Cyl9CatalogProduct,
} from "../../src/lib/paperDoll/cyl9CatalogCrosswalk";

const root = process.cwd();
const sourceCatalogPath = "public/data/best-bottles-catalog-lite.json";
const outputPath = "docs/paper-doll-rig/cyl9-catalog-crosswalk.json";
const sourceBuffer = await readFile(path.join(root, sourceCatalogPath));
const source = JSON.parse(sourceBuffer.toString("utf8")) as { products: Cyl9CatalogProduct[] };
const sourceCatalogSha256 = createHash("sha256").update(sourceBuffer).digest("hex");
const crosswalk = buildCyl9CatalogCrosswalk(
  source.products,
  sourceCatalogPath,
  sourceCatalogSha256,
);

await writeFile(
  path.join(root, outputPath),
  `${JSON.stringify(crosswalk, null, 2)}\n`,
  "utf8",
);

console.log(
  `Wrote ${crosswalk.mappings.length} CYL-9ML mappings and ${crosswalk.reviewIssues.length} review issues to ${outputPath}.`,
);

import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:4174/production-route-visual-harness.html";
const outputDir = "/Users/jordanrichter/Desktop/AI-OS/07 Outputs/Best Bottles/Madison Production Route Verification — 2026-08-19";
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];

const inspectScroller = async (locator, expectedLastText) => locator.evaluate((element, expected) => {
  const wrapper = element.parentElement;
  if (!wrapper) throw new Error("Scroller wrapper missing");
  const ancestors = [];
  let cursor = wrapper;
  for (let depth = 0; cursor && depth < 6; depth += 1, cursor = cursor.parentElement) {
    const rect = cursor.getBoundingClientRect();
    const style = getComputedStyle(cursor);
    ancestors.push({
      tag: cursor.tagName,
      className: cursor.className,
      width: rect.width,
      minWidth: style.minWidth,
      maxWidth: style.maxWidth,
      display: style.display,
      overflowX: style.overflowX,
    });
  }
  const before = {
    overflowX: getComputedStyle(wrapper).overflowX,
    scrollWidth: wrapper.scrollWidth,
    clientWidth: wrapper.clientWidth,
  };
  wrapper.scrollLeft = wrapper.scrollWidth;
  const last = element.lastElementChild?.getBoundingClientRect();
  const wrap = wrapper.getBoundingClientRect();
  return {
    ...before,
    scrollLeft: wrapper.scrollLeft,
    lastText: element.lastElementChild?.textContent?.trim(),
    expectedLastText: expected,
    lastVisible: Boolean(last && last.left >= wrap.left && last.right <= wrap.right),
    wrapperBox: { left: wrap.left, right: wrap.right, width: wrap.width },
    ancestors,
  };
}, expectedLastText);

try {
  for (const viewport of [
    { name: "mobile", width: 390, height: 844 },
    { name: "tablet", width: 768, height: 1024 },
  ]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Production Route" }).waitFor();

    const routeList = page.locator('ol[aria-label="Nine-stage production route"]');
    const routeStageCount = await page.getByRole("button", { name: /^Open evidence for/ }).count();
    const routeScroller = await inspectScroller(routeList, "09Publish + VerifyNot started");
    const initialOverflow = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    await page.screenshot({ path: `${outputDir}/${viewport.name}-route-end.png`, fullPage: false });

    await page.getByRole("button", { name: "SOURCE & BUILD" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    await page.waitForTimeout(600);
    const dialogBox = await dialog.boundingBox();
    const proxyBoundaryVisible = await dialog.getByText("Visual evidence · review proxies").isVisible();
    const authorityBoundaryVisible = await dialog.getByText(/containment receipt remain evidence authority/).isVisible();
    await page.screenshot({ path: `${outputDir}/${viewport.name}-source-build.png`, fullPage: false });
    await page.getByRole("button", { name: "Close" }).click();
    await page.waitForTimeout(400);

    await page.getByRole("button", { name: "MATRIX" }).click();
    const table = page.getByRole("table");
    await table.waitFor();
    const matrix = await table.evaluate((element) => {
      const wrapper = element.parentElement;
      const section = wrapper?.parentElement;
      if (!wrapper || !section) throw new Error("Matrix wrapper missing");
      const before = {
        overflowX: getComputedStyle(wrapper).overflowX,
        scrollWidth: wrapper.scrollWidth,
        clientWidth: wrapper.clientWidth,
        sectionClientWidth: section.clientWidth,
        sectionBox: section.getBoundingClientRect().width,
      };
      wrapper.scrollLeft = wrapper.scrollWidth;
      const headers = Array.from(element.querySelectorAll("th"));
      const last = headers.at(-1)?.getBoundingClientRect();
      const wrap = wrapper.getBoundingClientRect();
      return {
        ...before,
        scrollLeft: wrapper.scrollLeft,
        lastHeader: headers.at(-1)?.textContent?.trim(),
        lastHeaderVisible: Boolean(last && last.left >= wrap.left && last.right <= wrap.right),
        wrapperBox: { left: wrap.left, right: wrap.right, width: wrap.width },
      };
    });
    await page.screenshot({ path: `${outputDir}/${viewport.name}-matrix-end.png`, fullPage: false });

    results.push({
      viewport,
      routeStageCount,
      routeScroller,
      initialOverflow,
      dialogBox,
      proxyBoundaryVisible,
      authorityBoundaryVisible,
      matrix,
      checks: {
        nineStages: routeStageCount === 9,
        noDocumentOverflow: initialOverflow.documentWidth === initialOverflow.viewportWidth,
        routeScrollable: routeScroller.overflowX === "auto" && routeScroller.scrollWidth > routeScroller.clientWidth,
        routeEndReachable: routeScroller.scrollLeft > 0 && routeScroller.lastVisible,
        dialogContained: Boolean(dialogBox && dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= viewport.width + 1),
        proxyBoundaryVisible: proxyBoundaryVisible && authorityBoundaryVisible,
        matrixScrollable: matrix.overflowX === "auto" && matrix.scrollWidth > matrix.clientWidth,
        matrixEndReachable: matrix.scrollLeft > 0 && matrix.lastHeader === "Live release" && matrix.lastHeaderVisible,
      },
    });

    await page.close();
  }
} finally {
  await browser.close();
}

const failures = results.flatMap((result) =>
  Object.entries(result.checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `${result.viewport.name}: ${check}`),
);

console.log(JSON.stringify({ results, failures }, null, 2));
if (failures.length) process.exitCode = 1;

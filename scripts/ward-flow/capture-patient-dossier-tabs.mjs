/** Local-only screenshots and browser checks for the polished Patient Now dossier. */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
const [baseUrl, outputDir] = process.argv.slice(2);
if (!baseUrl || !outputDir)
  throw new Error("Usage: node scripts/ward-flow/capture-patient-dossier-tabs.mjs <ensure-url> <output-dir>");
const base = new URL(baseUrl);
if (!["localhost", "127.0.0.1"].includes(base.hostname)) throw new Error("Local server required");
const identity = await (await fetch(new URL("/api/local-project-id", base))).json();
if (identity.appName !== "Ward Flow") throw new Error("Wrong local project");
await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.FLIGHT_DECK_CHROMIUM ? { executablePath: process.env.FLIGHT_DECK_CHROMIUM } : {}),
  args: ["--no-sandbox"],
});
const captures = [],
  checks = [],
  errors = [];
async function top(page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    for (const el of document.querySelectorAll('[class*="ward-flow-layout_shellContent"]')) el.scrollTop = 0;
  });
  await page.waitForTimeout(220);
}
async function capture(page, name, width, tab, mode = "live", workspace = false) {
  await top(page);
  console.log(`Capturing ${width} ${name}`);
  checks.push({ width, name, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
  const file = `${width}-${name}.png`;
  await page.screenshot({ path: path.join(outputDir, file), fullPage: false });
  captures.push({ name, width, tab, mode, file, kind: "viewport" });
  if (workspace && width === 1440) {
    const workspaceFile = `${width}-${name}-workspace.png`;
    await page.locator('[class*="patient-now_pnGrid"]').screenshot({ path: path.join(outputDir, workspaceFile) });
    captures.push({ name, width, tab, mode, file: workspaceFile, kind: "workspace" });
  }
  const style = await page.addStyleTag({
    content: `html,body{height:auto!important;overflow:visible!important}[class*="ward-flow-layout_shellRow"]{height:auto!important;max-height:none!important;overflow:visible!important}[class*="ward-flow-layout_shellContent"]{height:auto!important;overflow:visible!important}[class*="patient-now_pnGrid"]>:first-child{max-height:none!important;overflow:visible!important;position:static!important}`,
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  const fullFile = `${width}-${name}-full.png`;
  await page.screenshot({ path: path.join(outputDir, fullFile), fullPage: true });
  captures.push({ name, width, tab, mode, file: fullFile, kind: "full" });
  await style.evaluate((el) => el.remove());
}
async function tab(page, label) {
  await page.getByRole("tab", { name: new RegExp(`^${label}`) }).click();
  await page.waitForTimeout(200);
}
try {
  for (const width of [1440, 820, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1200 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(new URL("/mockups/ward-flow/people/WF-012", base).href, { waitUntil: "networkidle" });
    const shortlist = page.getByRole("region", { name: "Network ward shortlist" });
    await shortlist.getByRole("checkbox").first().check();
    await page.getByLabel("Ward placement reason").selectOption({ index: 1 });
    await page.getByLabel("Placement checked with the ward").check();
    await page.getByRole("button", { name: "Refer to selected wards", exact: true }).click();
    await page.getByRole("button", { name: "Accept bed", exact: true }).click();
    await page.getByRole("button", { name: "Pull patient into bed", exact: true }).click();
    await page.getByRole("button", { name: "Record transport booking", exact: true }).click();
    await page.getByLabel("Transport provider").selectOption("Ambulance service");
    await page.getByLabel("CAD number").fill("CAD-SYNTHETIC-42");
    await page.getByLabel("Quoted ETA (minutes from now)").fill("45");
    await page.getByLabel("Transport legal status").selectOption("involuntary");
    await page.getByLabel("Clinical escort required?").selectOption("yes");
    await page.getByRole("button", { name: "Save booking", exact: true }).click();
    await page.getByRole("button", { name: "Mark handover ready · sending team", exact: true }).click();
    await page.getByRole("button", { name: "Provider accepted job", exact: true }).click();
    await page.getByRole("button", { name: "Vehicle en route", exact: true }).click();
    await page.getByRole("button", { name: "Mark moving · patient collected", exact: true }).click();
    await page.getByRole("button", { name: "Clinical overview", exact: true }).click();
    await page.getByRole("button", { name: "Record treating-team clearance", exact: true }).click();
    await capture(page, "clearance-dialog", width, "clinical");
    await page.getByLabel("Treating-team clearance outcome").selectOption("cleared");
    await page.getByRole("dialog").getByRole("checkbox").check();
    await page.getByRole("button", { name: "Save clearance outcome", exact: true }).click();
    await tab(page, "Documents");
    await page.getByRole("button", { name: "Record document details", exact: true }).click();
    await page.locator("#form-type-select").selectOption("Clinical Transfer Summary");
    await page.getByLabel("Upload document file").setInputFiles({
      name: "synthetic-transfer-summary.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nSynthetic demonstration only.\n%%EOF"),
    });
    await page.getByTestId("confirm-upload-form-button").click();
    for (const label of ["Now", "History", "Community", "Details", "Documents"]) {
      await tab(page, label);
      if (label === "Now") await page.getByRole("button", { name: "Transit operations", exact: true }).click();
      await capture(page, `live-${label.toLowerCase()}`, width, label.toLowerCase(), "live", true);
      await page.addScriptTag({ path: path.resolve("node_modules/axe-core/axe.min.js") });
      const violations = await page.evaluate(async () => {
        const r = await axe.run("#main-content", {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        });
        return r.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        }));
      });
      checks.push({ width, tab: label, mode: "live", violations });
    }
    await tab(page, "Now");
    await page.getByRole("button", { name: "Clinical overview", exact: true }).click();
    await capture(page, "live-clinical", width, "clinical", "live", true);
    await tab(page, "History");
    for (const filter of ["Emergency", "Inpatient"]) {
      await page
        .getByRole("group", { name: "History filter" })
        .getByRole("button", { name: filter, exact: true })
        .click();
      await capture(page, `history-${filter.toLowerCase()}`, width, "history");
    }
    await page.getByRole("textbox", { name: "Search presentation history" }).fill("no-matching-record");
    await capture(page, "history-search-empty", width, "history");
    await tab(page, "Details");
    await page.getByRole("button", { name: "Missing information", exact: true }).click();
    await capture(page, "details-missing-information", width, "details");
    await tab(page, "Documents");
    for (const filter of ["Legal authority", "Transfer documents"]) {
      await page
        .getByRole("group", { name: "Document filter" })
        .getByRole("button", { name: filter, exact: true })
        .click();
      await capture(page, `documents-${filter.toLowerCase().replaceAll(" ", "-")}`, width, "documents");
    }
    await page.locator("#pnpane-documents").getByText("Clinical Transfer Summary", { exact: true }).click();
    await capture(page, "document-metadata-expanded", width, "documents");
    await page.goto(new URL("/mockups/ward-flow/people/PT-005", base).href, { waitUntil: "networkidle" });
    for (const label of ["Now", "History", "Community", "Details", "Documents"]) {
      await tab(page, label);
      await capture(page, `inactive-${label.toLowerCase()}`, width, label.toLowerCase(), "inactive", true);
      await page.addScriptTag({ path: path.resolve("node_modules/axe-core/axe.min.js") });
      const violations = await page.evaluate(async () => {
        const r = await axe.run("#main-content", {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        });
        return r.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        }));
      });
      checks.push({ width, tab: label, mode: "inactive", violations });
    }
    await context.close();
  }
} finally {
  await browser.close();
  await fs.writeFile(
    path.join(outputDir, "evidence.json"),
    JSON.stringify({ identity, captures, checks, errors }, null, 2),
  );
}
if (errors.length || checks.some((c) => c.overflow || c.violations?.length))
  throw new Error("Screenshot QA failed; inspect evidence.json");
console.log(
  JSON.stringify({
    states: captures.filter((c) => c.kind === "viewport").length,
    images: captures.length,
    errors: errors.length,
    axeChecks: checks.filter((c) => c.violations).length,
  }),
);

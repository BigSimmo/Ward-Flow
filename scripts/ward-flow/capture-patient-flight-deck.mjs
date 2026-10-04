/** Local-only visual evidence. Run ensure first and pass its verified URL. */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
const [baseUrl, outputDir, mode] = process.argv.slice(2);
if (!baseUrl || !outputDir)
  throw new Error("Usage: node scripts/ward-flow/capture-patient-flight-deck.mjs <ensure-url> <output-dir>");
const base = new URL(baseUrl);
if (!["localhost", "127.0.0.1"].includes(base.hostname)) throw new Error("Local URL required.");
const identity = await (await fetch(new URL("/api/local-project-id", base))).json();
if (identity.appName !== "Ward Flow") throw new Error("Wrong local project.");
await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.FLIGHT_DECK_CHROMIUM ? { executablePath: process.env.FLIGHT_DECK_CHROMIUM } : {}),
  args: ["--no-sandbox"],
});
const previous =
  mode === "supplement" ? JSON.parse(await fs.readFile(path.join(outputDir, "evidence.json"), "utf8")) : undefined;
const captures = previous?.captures ?? [];
const checks = previous?.checks ?? [];
const errors = previous?.errors ?? [];
async function capture(page, name, width, { full = true } = {}) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    for (const el of document.querySelectorAll('[class*="ward-flow-layout_shellContent"]')) el.scrollTop = 0;
  });
  await page.waitForTimeout(180);
  console.log(`Capturing ${width} ${name}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  checks.push({ view: name, width, horizontalOverflow: overflow });
  const filename = `${width}-${name}.png`;
  await page.screenshot({ path: path.join(outputDir, filename), fullPage: true });
  captures.push({ name, width, file: filename, kind: "viewport" });
  if (full) {
    // Expand only scroll containers for a second image of the entire view; viewport evidence above is unmodified.
    await page
      .addStyleTag({
        content: `html,body{height:auto!important;overflow:visible!important} [class*="ward-flow-layout_shellRow"]{height:auto!important;max-height:none!important;overflow:visible!important} [class*="ward-flow-layout_shellContent"]{height:auto!important;overflow:visible!important} [class*="patient-now_pnGrid"]>:first-child{max-height:none!important;overflow:visible!important;position:static!important} [class*="patient-transit-operations_candidates"]{max-height:none!important;overflow:visible!important}`,
      })
      .then(async (style) => {
        await page.evaluate(() => window.scrollTo(0, 0));
        const allFile = `${width}-${name}-full.png`;
        await page.screenshot({ path: path.join(outputDir, allFile), fullPage: true });
        captures.push({ name, width, file: allFile, kind: "full view" });
        await style.evaluate((el) => el.remove());
      });
  }
}
try {
  for (const width of mode === "supplement" ? [] : [1440, 820, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 } });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(new URL("/mockups/ward-flow/people/WF-009", base).href, { waitUntil: "networkidle" });
    await capture(page, "clinical-overview", width);
    for (const tab of ["History", "Community", "Details", "Documents"]) {
      await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
      await capture(page, tab.toLowerCase(), width);
    }
    await page.getByRole("button", { name: "Coordinate placement", exact: true }).click();
    for (const filter of ["Eligible", "All wards", "Referred"]) {
      await page
        .getByRole("group", { name: "Ward shortlist filter" })
        .getByRole("button", { name: filter, exact: true })
        .click();
      await capture(page, `transit-${filter.toLowerCase().replaceAll(" ", "-")}`, width);
    }
    await page.getByText("Additional workflow controls", { exact: false }).first().click();
    await capture(page, "additional-workflow", width);
    await page.goto(new URL("/mockups/ward-flow/people/WF-004", base).href, { waitUntil: "networkidle" });
    await capture(page, "accepted-patient-clinical", width);
    await page.getByRole("button", { name: "Coordinate placement", exact: true }).click();
    await capture(page, "accepted-patient-transit", width);
    await page.getByText("Step back with recorded reason", { exact: true }).click();
    await capture(page, "step-back-form", width);
    await page.goto(new URL("/mockups/ward-flow/movements/WF-004", base).href, { waitUntil: "networkidle" });
    if ((await page.getByRole("button", { name: "Coordinate placement", exact: true }).count()) !== 1)
      throw new Error("Legacy movement route failed");
    await capture(page, "legacy-movement-route", width);
    await page.goto(new URL("/mockups/ward-flow/people/WF-012", base).href, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Coordinate placement", exact: true }).click();
    const shortlist = page.getByRole("region", { name: "Network ward shortlist" });
    await shortlist.getByRole("checkbox").first().check();
    await capture(page, "ward-placement-check", width);
    await page.getByLabel("Ward placement reason").selectOption({ index: 1 });
    await page.getByLabel("Placement checked with the ward").check();
    await page.getByRole("button", { name: "Refer to selected wards", exact: true }).click();
    await page.getByRole("button", { name: "Accept bed", exact: true }).click();
    await capture(page, "bed-accepted", width);
    await page.getByRole("button", { name: "Pull patient into bed", exact: true }).click();
    await capture(page, "bed-pulled", width);
    await page.getByRole("button", { name: "Record transport booking", exact: true }).click();
    await capture(page, "transport-booking-form", width);
    await page.getByLabel("Transport provider").selectOption("Ambulance service");
    await page.getByLabel("CAD number").fill("CAD-SYNTHETIC-42");
    await page.getByLabel("Quoted ETA (minutes from now)").fill("45");
    await page.getByLabel("Transport legal status").selectOption("involuntary");
    await page.getByLabel("Clinical escort required?").selectOption("yes");
    await page.getByRole("button", { name: "Save booking", exact: true }).click();
    await capture(page, "transport-booked", width);
    await page.getByRole("button", { name: "Mark handover ready · sending team", exact: true }).click();
    await capture(page, "handover-ready", width);
    await page.getByRole("button", { name: "Provider accepted job", exact: true }).click();
    await page.getByRole("button", { name: "Vehicle en route", exact: true }).click();
    await page.getByRole("button", { name: "Mark moving · patient collected", exact: true }).click();
    await capture(page, "patient-moving", width);
    await page.getByRole("button", { name: "Confirm arrival · receiving ward", exact: true }).click();
    await capture(page, "patient-arrived", width);
    await context.close();
    console.log(`Captured ${width}px views and completed referral-to-arrival workflow.`);
  }
  // Record accordion, filter, dialog and governed-dossier views as well as the primary workflow.
  for (const width of [1440, 820, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 } });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(new URL("/mockups/ward-flow/people/WF-009", base).href, { waitUntil: "networkidle" });
    for (const stage of [
      "placement_requested",
      "destination_review",
      "accepted_awaiting_bed",
      "pulled",
      "handover_ready",
      "moving",
      "arrived",
    ]) {
      const button = page.getByTestId(`ward-patient-stage-btn-${stage}`);
      if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
      await capture(page, `journey-${stage.replaceAll("_", "-")}`, width);
    }
    await page.getByRole("tab", { name: /^History/ }).click();
    for (const filter of ["Emergency", "Inpatient"]) {
      await page
        .getByRole("group", { name: "History filter" })
        .getByRole("button", { name: filter, exact: true })
        .click();
      await capture(page, `history-${filter.toLowerCase()}`, width);
    }
    await page.goto(new URL("/mockups/ward-flow/people/WF-004", base).href, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Update Arrival Time", exact: true }).click();
    await capture(page, "arrival-plan-dialog", width, { full: false });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Record transport document details", exact: true }).click();
    await capture(page, "transport-documents-dialog", width, { full: false });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Coordinate placement", exact: true }).click();
    await page.getByText("Release bed pull", { exact: true }).click();
    await capture(page, "release-pull-form", width);
    await page.goto(new URL("/mockups/ward-flow/people/WF-012", base).href, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Coordinate placement", exact: true }).click();
    await page.getByText("Withdraw referral", { exact: true }).first().click();
    await capture(page, "withdraw-referral-form", width);
    await page.getByText("Eligibility breakdown", { exact: false }).first().click();
    await capture(page, "eligibility-gates", width);
    await page.goto(new URL("/mockups/ward-flow/people/WF-012?view=governed", base).href, { waitUntil: "networkidle" });
    await capture(page, "governed-dossier", width);
    await context.close();
  }
  await fs.writeFile(
    path.join(outputDir, "evidence.json"),
    JSON.stringify({ identity, captures, checks, errors }, null, 2),
  );
  const rows = captures
    .filter((c) => c.kind === "viewport")
    .map(
      (c) =>
        `<article data-width="${c.width}"><h2>${c.name.replaceAll("-", " ")} <small>${c.width}px</small></h2><a href="${c.file}"><img src="${c.file}" loading="lazy" alt="Ward Flow ${c.name} at ${c.width} pixels"></a><p><a href="${captures.some((item) => item.file === c.file.replace(".png", "-full.png")) ? c.file.replace(".png", "-full.png") : c.file}">Open entire view</a></p></article>`,
    )
    .join("\n");
  await fs.writeFile(
    path.join(outputDir, "index.html"),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ward Flow · Unified Patient Now</title><style>body{margin:0;background:#edf1f5;color:#18202a;font:15px system-ui}header{padding:32px;max-width:1200px;margin:auto}h1{font-size:32px;letter-spacing:-1px}p{color:#526071;line-height:1.6}nav{display:flex;gap:8px}button{padding:12px 18px;border:1px solid #b9c5d1;background:white;border-radius:8px;cursor:pointer;min-height:44px}main{max-width:1400px;margin:auto;padding:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}article{background:white;border:1px solid #d5dde4;border-radius:10px;overflow:hidden}h2{font-size:16px;text-transform:capitalize;padding:16px;margin:0}small{float:right;color:#64748b}img{display:block;width:100%;height:330px;object-fit:contain;object-position:top;background:#eef2f6}article p{padding:0 16px}a{color:#2d516b}[hidden]{display:none}</style><header><p>WARD FLOW / SYNTHETIC PROTOTYPE</p><h1>One patient. One clinical flight deck.</h1><p>Patient Now keeps the dossier and seven-stage journey, with local ward review, bed reservations and transit controls. Click a screenshot to inspect it, or open the entire view.</p><nav aria-label="Viewport filter"><button type="button" onclick="filter('all')">All sizes</button><button type="button" onclick="filter('1440')">Desktop · 1440</button><button type="button" onclick="filter('820')">Tablet · 820</button><button type="button" onclick="filter('390')">Mobile · 390</button></nav></header><main>${rows}</main><script>function filter(w){document.querySelectorAll('article').forEach(e=>e.hidden=w!=='all'&&e.dataset.width!==w)}</script></html>`,
  );
  if (errors.length || checks.some((c) => c.horizontalOverflow))
    throw new Error("Browser evidence has errors or overflow; inspect evidence.json");
} finally {
  await browser.close();
}

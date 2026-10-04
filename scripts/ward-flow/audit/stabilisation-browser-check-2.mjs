/**
 * Follow-up browser checks: bed-alert totals, community team transport, tasks filters, ED waits.
 */
import { chromium } from "playwright";
import { resolveAuditTarget } from "../local-audit-target.mjs";

const BASE = (await resolveAuditTarget()).url;
const log = (m) => console.log(m);

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // --- Bed alerts ---
  await page.goto(`${BASE}/mockups/ward-flow`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(1000);
  const live = await page
    .locator(".shiftLiveTz, text=AWST")
    .first()
    .evaluate((el) => {
      const row = el.closest("div") || el.parentElement;
      return row?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    })
    .catch(() => "");
  log(`live clock row: ${JSON.stringify(live)}`);
  const handover = await page.locator('[aria-label*="Handover countdown"]').first().getAttribute("aria-label");
  log(`handover aria-label: ${JSON.stringify(handover)}`);

  await page.locator('[data-testid="ward-rail-capacity-alerts-trigger"]').click();
  await page.waitForTimeout(500);
  const panel = page.locator('[role="dialog"][aria-label="WA Health Service Bed State Alerts"]');
  const panelVisible = await panel.isVisible();
  log(`bed alerts panel visible: ${panelVisible}`);
  if (panelVisible) {
    const header = await panel
      .locator(".alertsTotalBadge, [class*='alertsTotalBadge']")
      .textContent()
      .catch(async () => {
        return (await panel.locator("text=/Free Beds/i").first().textContent()) ?? "";
      });
    log(`header free beds badge: ${JSON.stringify(header?.replace(/\s+/g, " ").trim())}`);
    const headerNum = Number((header || "").match(/(\d+)\s*Free Beds/i)?.[1] ?? NaN);
    const rowFree = await panel.locator("text=/\\d+ free \\(/").allTextContents();
    log(`row free texts: ${JSON.stringify(rowFree)}`);
    const sum = rowFree.reduce((acc, t) => acc + Number((t.match(/(\d+)\s*free/) || [])[1] || 0), 0);
    log(`headerNum=${headerNum} rowSum=${sum} equal=${headerNum === sum}`);
    const metro = await page.locator('[data-testid="ward-rail-capacity-alerts-trigger"]').innerText();
    log(`metro strip text: ${JSON.stringify(metro.replace(/\s+/g, " ").trim())}`);
    const body = await panel.innerText();
    log(`has 96.4%: ${/\b96\.4%\b/.test(body)}`);
    log(`panel first 400 chars: ${JSON.stringify(body.slice(0, 400))}`);
  }

  // --- ED waits ---
  // Discover ED routes from rail or hub
  const edHrefs = await page
    .locator('a[href*="/mockups/ward-flow/ed/"]')
    .evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")).filter(Boolean))]);
  log(`ED hrefs on hub: ${JSON.stringify(edHrefs.slice(0, 8))}`);
  const edHref = edHrefs.find((h) => /ed\//.test(h)) || "/mockups/ward-flow/ed/fsh-ed";
  await page.goto(edHref.startsWith("http") ? edHref : `${BASE}${edHref}`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.waitForTimeout(1200);
  log(`ED page: ${page.url()}`);
  // Look for duration-like waiting displays
  const edText = await page.locator("body").innerText();
  const durationHits = [...edText.matchAll(/\b\d+h\s*\d+m\b|\b\d+\s*min(?:ute)?s?\b|\b\d+:\d{2}\b/gi)]
    .map((m) => m[0])
    .slice(0, 12);
  log(`ED duration-like strings: ${JSON.stringify(durationHits)}`);
  const waitLines = edText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /wait/i.test(l))
    .slice(0, 10);
  log(`ED lines with wait: ${JSON.stringify(waitLines)}`);

  // --- Community teams: walk until book/cancel found ---
  await page.goto(`${BASE}/mockups/ward-flow/community`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(800);
  const teamHrefs = await page
    .locator('a[href*="/mockups/ward-flow/community/"]')
    .evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")).filter(Boolean))]);
  log(`community team hrefs: ${JSON.stringify(teamHrefs.slice(0, 15))} (total ${teamHrefs.length})`);

  let found = null;
  for (const href of teamHrefs.slice(0, 20)) {
    await page.goto(href.startsWith("http") ? href : `${BASE}${href}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(700);
    const book = await page.locator('[data-testid^="ward-community-book-transport-"]').count();
    const cancel = await page.locator('[data-testid^="ward-community-cancel-transport-"]').count();
    const booked = await page.locator('[data-testid^="ward-community-transport-booked-"]').count();
    if (book + cancel + booked > 0) {
      found = { href: page.url(), book, cancel, booked };
      log(`FOUND transport on ${JSON.stringify(found)}`);
      break;
    }
  }
  if (!found) {
    // Try known slugs directly
    const tryIds = ["albany", "alma-street", "alma-street-fremantle", "bentley", "armitage", "midland"];
    for (const id of tryIds) {
      await page.goto(`${BASE}/mockups/ward-flow/community/${id}`, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
      await page.waitForTimeout(800);
      const book = await page.locator('[data-testid^="ward-community-book-transport-"]').count();
      const cancel = await page.locator('[data-testid^="ward-community-cancel-transport-"]').count();
      const booked = await page.locator('[data-testid^="ward-community-transport-booked-"]').count();
      log(`try ${id}: book=${book} cancel=${cancel} booked=${booked} url=${page.url()}`);
      if (book + cancel + booked > 0) {
        found = { href: page.url(), book, cancel, booked };
        break;
      }
    }
  }

  if (found?.book > 0) {
    await page.locator('[data-testid^="ward-community-book-transport-"]').first().click();
    await page.waitForTimeout(400);
    const dlg = page.locator('[data-testid^="ward-community-book-transport-dialog-"]');
    log(`book dialog visible: ${await dlg.isVisible().catch(() => false)}`);
    log(`book dialog text: ${JSON.stringify(((await dlg.textContent()) || "").slice(0, 280))}`);
    await page.keyboard.press("Escape");
  } else if (found?.cancel > 0) {
    await page.locator('[data-testid^="ward-community-cancel-transport-"]').first().click();
    await page.waitForTimeout(400);
    const dlg = page.locator('[data-testid^="ward-community-cancel-transport-dialog-"]');
    log(`cancel dialog visible: ${await dlg.isVisible().catch(() => false)}`);
    await page.keyboard.press("Escape");
  } else {
    log("NO community transport controls found on sampled teams");
  }

  // --- Activity + Tasks ---
  await page.goto(`${BASE}/mockups/ward-flow`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(800);

  // Open Activity from top bar
  const activityTrigger = page.locator('button:has-text("Activity")').first();
  await activityTrigger.click();
  await page.waitForTimeout(500);
  const allChip = page.locator('[data-testid="ward-bar-activity-filter-all"]');
  const escChip = page.locator('[data-testid="ward-bar-activity-filter-escalation"]');
  log(`activity chips visible: all=${await allChip.isVisible()} esc=${await escChip.isVisible()}`);
  // Prefer activity sheet content
  const sheet = page.locator('[role="dialog"], [class*="sheet"], [class*="drawer"]').filter({ hasText: "All" }).first();
  const beforeText = await sheet.innerText().catch(() => "");
  await escChip.click();
  await page.waitForTimeout(400);
  const afterEsc = await sheet.innerText().catch(() => "");
  log(`activity filter changed content: ${beforeText !== afterEsc}`);
  log(`escalations chip pressed?: ${await escChip.getAttribute("aria-pressed")}`);
  log(`afterEsc sample: ${JSON.stringify(afterEsc.slice(0, 250))}`);

  // Close and open Tasks
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const tasksTrigger = page.locator('button:has-text("Tasks")').first();
  await tasksTrigger.click();
  await page.waitForTimeout(600);
  const filterGroup = page.locator('[aria-label="Filter tasks by status"]');
  log(`tasks filter group visible: ${await filterGroup.isVisible().catch(() => false)}`);
  if (await filterGroup.isVisible().catch(() => false)) {
    const tabs = await filterGroup.locator("button").allTextContents();
    log(`tasks filter tabs: ${JSON.stringify(tabs.map((t) => t.replace(/\s+/g, " ").trim()))}`);
    const listBefore = await page.locator('[data-testid^="ward-task-"]').count();
    await filterGroup.locator("button").nth(1).click();
    await page.waitForTimeout(400);
    const listAfter = await page.locator('[data-testid^="ward-task-"]').count();
    log(`tasks visible before=${listBefore} after critical filter=${listAfter}`);
  } else {
    const body = await page.locator("body").innerText();
    log(`tasks drawer open? ${/Outstanding|Breach \/ Critical|Review Due/.test(body)}`);
    log(`body sample around Tasks: ${JSON.stringify(body.match(/Tasks[\s\S]{0,200}/)?.[0] ?? null)}`);
  }

  await browser.close();
  log("DONE2");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * One-shot browser verification for Ward Flow stabilisation (section 5).
 * Uses Playwright against the ensure URL. Does not commit or mutate app state beyond UI clicks.
 */
import { chromium } from "playwright";

const BASE = process.env.WARD_URL || "http://localhost:3605";
const out = [];
const log = (msg) => {
  out.push(msg);
  console.log(msg);
};

async function main() {
  const idRes = await fetch(`${BASE}/api/local-project-id`);
  const id = await idRes.json();
  log(`projectId=${id.projectId} url=${BASE}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // --- Hub / sidebar ---
  await page.goto(`${BASE}/mockups/ward-flow`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(1500);

  const liveClock = await page.locator("text=AWST").first().textContent().catch(() => null);
  const handover = await page
    .locator('[aria-label*="Handover countdown"], a[title*="handover" i]')
    .first()
    .textContent()
    .catch(() => null);
  const handoverBadge = await page
    .locator("text=Handover Countdown")
    .locator("..")
    .textContent()
    .catch(() => null);
  log(`sidebar liveClock nearby: ${JSON.stringify(liveClock)}`);
  log(`handover aria/link: ${JSON.stringify(handover)}`);
  log(`handover row text: ${JSON.stringify(handoverBadge)}`);

  // Bed alerts panel
  const alertTrigger = page
    .locator('[data-testid*="bed-alert"], button:has-text("Free"), button:has-text("%"), [aria-label*="Bed" i]')
    .first();
  const alertOpened = await alertTrigger
    .click({ timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  log(`bed-alert trigger clicked: ${alertOpened}`);
  await page.waitForTimeout(500);

  const panelText = await page
    .locator('[role="dialog"], [data-testid*="bed-alert"], [class*="servicePanel"], [class*="alertPanel"]')
    .first()
    .textContent()
    .catch(() => null);
  log(`bed-alert panel snippet: ${JSON.stringify(panelText?.slice(0, 500) ?? null)}`);

  // Collect free-bed numbers from service rows if present
  const bodyText = await page.locator("body").innerText();
  const hasFake338 = /\b3h 38m\b/.test(bodyText);
  const hasFake964 = /\b96\.4%\b/.test(bodyText);
  const has18Free = /\b18 Free Beds\b/i.test(bodyText);
  log(`fake markers present: 3h38m=${hasFake338} 96.4%=${hasFake964} 18 Free Beds=${has18Free}`);

  // --- ED route ---
  await page.goto(`${BASE}/mockups/ward-flow/ed/fsh`, { waitUntil: "networkidle", timeout: 120_000 }).catch(async () => {
    // try listing available ED links from hub
    await page.goto(`${BASE}/mockups/ward-flow`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  });
  await page.waitForTimeout(1000);
  const edUrl = page.url();
  log(`ED url after navigate: ${edUrl}`);
  const waitText = await page
    .locator("text=/wait(ing)?/i")
    .first()
    .textContent()
    .catch(() => null);
  const edBody = await page.locator("body").innerText();
  const waitMatch = edBody.match(/(\d+\s*(h|hr|hrs|m|min|mins)?\s*){1,3}wait/i) || edBody.match(/wait(?:ing)?[^\n]{0,40}/i);
  log(`ED wait snippet: ${JSON.stringify(waitText)}`);
  log(`ED wait match: ${JSON.stringify(waitMatch?.[0] ?? null)}`);

  // Find a real ED link if needed
  if (!edUrl.includes("/ed/")) {
    await page.goto(`${BASE}/mockups/ward-flow`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const edLink = page.locator('a[href*="/mockups/ward-flow/ed/"]').first();
    if (await edLink.count()) {
      const href = await edLink.getAttribute("href");
      log(`opening ED link: ${href}`);
      await page.goto(href.startsWith("http") ? href : `${BASE}${href}`, {
        waitUntil: "networkidle",
        timeout: 120_000,
      });
      await page.waitForTimeout(1000);
      const edBody2 = await page.locator("body").innerText();
      const waitMatch2 =
        edBody2.match(/(\d+[hm])\s*[·•\-–]\s*\d/i) || edBody2.match(/wait(?:ing)?[^\n]{0,60}/i);
      log(`ED wait match2: ${JSON.stringify(waitMatch2?.[0] ?? null)}`);
      log(`ED url2: ${page.url()}`);
    } else {
      log("no ED links found on hub");
    }
  }

  // --- Community ---
  await page.goto(`${BASE}/mockups/ward-flow/community`, { waitUntil: "networkidle", timeout: 120_000 }).catch(() => null);
  await page.waitForTimeout(800);
  let communityUrl = page.url();
  if (!communityUrl.includes("/community")) {
    await page.goto(`${BASE}/mockups/ward-flow`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const cLink = page.locator('a[href*="/mockups/ward-flow/community/"]').first();
    if (await cLink.count()) {
      const href = await cLink.getAttribute("href");
      log(`opening community link: ${href}`);
      await page.goto(href.startsWith("http") ? href : `${BASE}${href}`, {
        waitUntil: "networkidle",
        timeout: 120_000,
      });
    }
  }
  communityUrl = page.url();
  log(`community url: ${communityUrl}`);

  const bookBtns = page.locator('[data-testid^="ward-community-book-transport-"]');
  const cancelBtns = page.locator('[data-testid^="ward-community-cancel-transport-"]');
  const bookedLabels = page.locator('[data-testid^="ward-community-transport-booked-"]');
  const bookCount = await bookBtns.count();
  const cancelCount = await cancelBtns.count();
  const bookedCount = await bookedLabels.count();
  log(`community transport controls: book=${bookCount} cancel=${cancelCount} booked=${bookedCount}`);

  if (bookCount > 0) {
    await bookBtns.first().click();
    await page.waitForTimeout(500);
    const dialog = page.locator('[data-testid^="ward-community-book-transport-dialog-"]');
    const dialogVisible = await dialog.isVisible().catch(() => false);
    log(`book dialog opened: ${dialogVisible}`);
    if (dialogVisible) {
      const dialogText = (await dialog.textContent())?.slice(0, 300);
      log(`book dialog snippet: ${JSON.stringify(dialogText)}`);
      await page.keyboard.press("Escape");
    }
  } else if (cancelCount > 0) {
    await cancelBtns.first().click();
    await page.waitForTimeout(500);
    const dialog = page.locator('[data-testid^="ward-community-cancel-transport-dialog-"]');
    const dialogVisible = await dialog.isVisible().catch(() => false);
    log(`cancel dialog opened: ${dialogVisible}`);
    await page.keyboard.press("Escape");
  } else {
    // Try to find admitted/holding table text
    const body = await page.locator("body").innerText();
    const pulled = (body.match(/pulled|holding|admitted/gi) || []).slice(0, 8);
    log(`no book/cancel controls; keywords: ${JSON.stringify(pulled)}`);
  }

  // --- Activity + Tasks filters ---
  await page.goto(`${BASE}/mockups/ward-flow`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(800);

  const activityBtn = page.locator('button:has-text("Activity"), [data-testid*="activity"]').first();
  await activityBtn.click({ timeout: 8000 }).catch(() => null);
  await page.waitForTimeout(600);
  const activityFilters = page.locator('[data-testid^="ward-bar-activity-filter-"]');
  const filterCount = await activityFilters.count();
  log(`activity filter chips found: ${filterCount}`);
  if (filterCount > 0) {
    const labels = [];
    for (let i = 0; i < filterCount; i++) {
      labels.push((await activityFilters.nth(i).innerText()).replace(/\s+/g, " ").trim());
    }
    log(`activity filter labels: ${JSON.stringify(labels)}`);
    const before = await page.locator('[data-testid*="activity"], [class*="activity"]').first().innerText().catch(() => "");
    await activityFilters.nth(Math.min(1, filterCount - 1)).click();
    await page.waitForTimeout(400);
    const after = await page.locator('[data-testid*="activity"], [class*="activity"]').first().innerText().catch(() => "");
    log(`activity list changed after chip click: ${before.slice(0, 120) !== after.slice(0, 120)}`);
  }

  const tasksBtn = page.locator('button:has-text("Tasks"), button:has-text("Outstanding"), [data-testid*="tasks"]').first();
  await tasksBtn.click({ timeout: 8000 }).catch(() => null);
  await page.waitForTimeout(600);
  const taskFilters = page.locator(
    '[data-testid^="ward-tasks-filter-"], button:has-text("Breach"), button:has-text("Review Due"), button:has-text("All (")',
  );
  // Prefer dedicated testids if present
  const taskFilterTestids = page.locator('[data-testid^="ward-tasks-filter-"]');
  const taskFilterCount = (await taskFilterTestids.count()) || (await taskFilters.count());
  log(`tasks filter chips found: ${taskFilterCount}`);
  if (await taskFilterTestids.count()) {
    const labels = [];
    const n = await taskFilterTestids.count();
    for (let i = 0; i < n; i++) {
      labels.push((await taskFilterTestids.nth(i).innerText()).replace(/\s+/g, " ").trim());
    }
    log(`tasks filter labels: ${JSON.stringify(labels)}`);
    await taskFilterTestids.nth(Math.min(1, n - 1)).click();
    await page.waitForTimeout(400);
    log("tasks filter chip clicked");
  }

  await browser.close();
  log("DONE");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

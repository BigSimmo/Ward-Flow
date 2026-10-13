import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const artifactDir = "C:/Users/joshs/.gemini/antigravity/brain/32c08f4c-df07-44de-8c3b-18854eb5645b";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  const consoleLogs = [];
  page.on("console", (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => consoleLogs.push(`[PAGE ERROR] ${err.message}`));

  console.log("Loading live interactive referrals...");
  await page.goto("http://localhost:4467/mockups/ward-flow/referrals", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Take screenshot of initial state
  await page.screenshot({ path: path.join(artifactDir, "diag_live_initial.png"), fullPage: true });

  // Click on a referral
  const cardBtn = page.locator('[data-testid="ward-referral-board-card-select-RF-RD06"]');
  if (await cardBtn.isVisible()) {
    await cardBtn.click();
  } else {
    await page.locator('[data-testid="ward-referral-board-select-RF-RD06"]').click({ force: true });
  }
  await page.waitForTimeout(600);

  await page.screenshot({ path: path.join(artifactDir, "diag_live_drawer_open.png"), fullPage: true });

  // Test toggling each tier: collapse all tiers
  console.log("Collapsing all tiers...");
  const t1Btn = page.locator('button:has-text("Available Beds")');
  if (await t1Btn.isVisible()) await t1Btn.click();
  await page.waitForTimeout(300);

  const t2Btn = page.locator('button:has-text("Capacity Pending")');
  // check if tier 2 is open
  const t2Body = page.locator('#referral-match-tier-2-body');
  if (await t2Body.isVisible()) await t2Btn.click();

  const t3Btn = page.locator('button:has-text("Ineligible Units")');
  const t3Body = page.locator('#referral-match-tier-3-body');
  if (await t3Body.isVisible()) await t3Btn.click();
  await page.waitForTimeout(300);

  // Screenshot with all closed
  const detail = page.locator('.registerDetail, [class*="registerDetail"]').first();
  await detail.screenshot({ path: path.join(artifactDir, "diag_live_all_closed.png") });

  // Now check the standalone mockup
  console.log("Checking mockup page...");
  const mockupLogs = [];
  const mockupPage = await context.newPage();
  mockupPage.on("console", (msg) => mockupLogs.push(`[${msg.type()}] ${msg.text()}`));
  mockupPage.on("pageerror", (err) => mockupLogs.push(`[PAGE ERROR] ${err.message}`));

  await mockupPage.goto("http://localhost:4467/referral-inspector-mockup.html", { waitUntil: "networkidle" });
  await mockupPage.waitForTimeout(1000);
  await mockupPage.screenshot({ path: path.join(artifactDir, "diag_mockup_full.png"), fullPage: true });

  fs.writeFileSync(
    path.join(artifactDir, "diag_logs.json"),
    JSON.stringify({ live: consoleLogs, mockup: mockupLogs }, null, 2)
  );

  console.log("Diagnostic complete.");
  await browser.close();
}

main().catch(console.error);

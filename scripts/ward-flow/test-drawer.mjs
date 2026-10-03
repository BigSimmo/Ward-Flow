import { chromium } from "playwright";
import { resolveAuditTarget } from "./local-audit-target.mjs";
import { newestPreinstalledChromiumHeadlessShell } from "../playwright-browser-preflight.mjs";
import path from "node:path";

const browsersRoot = path.join(process.env.LOCALAPPDATA || "C:/Users/joshs/AppData/Local", "ms-playwright");
const BROWSER_PATH = newestPreinstalledChromiumHeadlessShell(browsersRoot);

async function run() {
  const base = (await resolveAuditTarget()).url;
  const browser = await chromium.launch({ executablePath: BROWSER_PATH, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${base}/mockups/ward-flow/statistics`);
  await page.waitForTimeout(500);

  const toolsBtn = await page.$("button:has-text('Tools')");
  if (toolsBtn) {
    console.log("Clicking Tools drawer trigger...");
    await toolsBtn.click();
    await page.waitForTimeout(400);

    const drawerOpen = await page.evaluate(() => {
      const dialog = document.querySelector("[role='dialog'], [class*='drawer'], [data-state='open']");
      return !!dialog;
    });
    console.log("Drawer opened:", drawerOpen);

    console.log("Pressing Escape...");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    const drawerClosed = await page.evaluate(() => {
      const dialog = document.querySelector("[role='dialog'], [data-state='open']");
      return !dialog;
    });
    console.log("Drawer closed via Escape:", drawerClosed);
  }

  // Also test tabs on statistics hub
  console.log("\nTesting tabs on statistics hub...");
  const tabs = ["tab-wards", "tab-emergency", "tab-community", "tab-referrals", "tab-overview"];
  for (const t of tabs) {
    const tabEl = await page.$(`#${t}`);
    if (tabEl) {
      await tabEl.click();
      await page.waitForTimeout(200);
      const isSelected = await page.evaluate((id) => document.getElementById(id)?.getAttribute("aria-selected"), t);
      console.log(`Tab ${t} clicked, aria-selected: ${isSelected}`);
    }
  }

  await browser.close();
}
run();

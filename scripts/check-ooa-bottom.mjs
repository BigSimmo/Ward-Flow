import { chromium } from "playwright";
import path from "node:path";

const artifactDir = "C:/Users/joshs/.gemini/antigravity/brain/c6dc2bdc-bd3b-44bc-b36c-1bac489d7dce";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();
  await page.goto("http://localhost:4467/mockups/ward-flow/out-of-area", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2000);

  // Scroll to bottom
  await page.evaluate(() => {
    const scroller = document.querySelector('[class*="shellContent"]');
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });
  await page.waitForTimeout(600);

  const shot = path.join(artifactDir, "screenshot_out_of_area_bottom.png");
  await page.screenshot({ path: shot });
  console.log(`Captured ${shot}`);

  // Inspect the bottom elements of out of area
  const ooaInfo = await page.evaluate(() => {
    const table = document.querySelector('table');
    const lastRow = table ? table.querySelector('tbody tr:last-child') : null;
    const panel = table ? table.closest('[class*="panel"]') : null;
    const lastCells = lastRow ? Array.from(lastRow.querySelectorAll('td')) : [];

    return {
      panelBorderRadius: panel ? window.getComputedStyle(panel).borderRadius : null,
      panelOverflow: panel ? window.getComputedStyle(panel).overflow : null,
      lastRowCells: lastCells.map(td => ({
        borderRadius: window.getComputedStyle(td).borderRadius,
        borderBottom: window.getComputedStyle(td).borderBottom,
        background: window.getComputedStyle(td).background,
      }))
    };
  });
  console.log(JSON.stringify(ooaInfo, null, 2));

  await browser.close();
}

main().catch(console.error);

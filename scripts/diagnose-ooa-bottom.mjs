import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const artifactDir = "C:/Users/joshs/.gemini/antigravity/brain/c6dc2bdc-bd3b-44bc-b36c-1bac489d7dce";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
  });

  await page.goto("http://localhost:4467/mockups/ward-flow/out-of-area", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  // Scroll to see the bottom of the table
  await page.evaluate(() => {
    const scroller = document.querySelector('[class*="shellContent"]');
    if (scroller) scroller.scrollTop = 650;
  });
  await page.waitForTimeout(600);

  // Take screenshot of the bottom of the card
  const panel = await page.$('[class*="registerColumn"] [class*="panel"]');
  const table = await page.$('table');
  const lastRow = await page.$('tbody tr:last-child');

  // Let's get detailed computed styles of the bottom elements
  const details = await page.evaluate(() => {
    const tableEl = document.querySelector('table');
    const tableWrap = document.querySelector('[class*="tableWrap"]');
    const panelEl = tableEl ? tableEl.closest('[class*="panel"]') : null;
    const lastRowEl = tableEl ? tableEl.querySelector('tbody tr:last-child') : null;
    const tds = lastRowEl ? Array.from(lastRowEl.children) : [];

    function getStyles(el) {
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        className: el.className,
        rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height },
        borderRadius: cs.borderRadius,
        borderBottomLeftRadius: cs.borderBottomLeftRadius,
        borderBottomRightRadius: cs.borderBottomRightRadius,
        overflow: cs.overflow,
        border: cs.border,
        borderBottom: cs.borderBottom,
        boxShadow: cs.boxShadow,
        backgroundColor: cs.backgroundColor,
      };
    }

    return {
      panel: getStyles(panelEl),
      tableWrap: getStyles(tableWrap),
      table: getStyles(tableEl),
      lastRow: getStyles(lastRowEl),
      tds: tds.map(getStyles),
    };
  });

  fs.writeFileSync(path.join(artifactDir, "ooa_bottom_diagnostics.json"), JSON.stringify(details, null, 2));
  console.log("Diagnostics written to ooa_bottom_diagnostics.json");

  // Screenshot of the panel bottom
  if (lastRow) {
    const rowBox = await lastRow.boundingBox();
    console.log("Last row box:", rowBox);
    await page.screenshot({
      path: path.join(artifactDir, "ooa_bottom_zoomed.png"),
      clip: {
        x: rowBox.x - 20,
        y: rowBox.y - 40,
        width: rowBox.width + 40,
        height: rowBox.height + 60,
      }
    });
    console.log("Saved ooa_bottom_zoomed.png");
  }

  await browser.close();
}

main().catch(console.error);

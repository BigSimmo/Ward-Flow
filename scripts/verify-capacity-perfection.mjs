import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto("http://localhost:4467/mockups/ward-flow/capacity", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });
  await page.waitForTimeout(1500);

  const artifactDir = "C:\\Users\\joshs\\.gemini\\antigravity\\brain\\c6dc2bdc-bd3b-44bc-b36c-1bac489d7dce";

  // 1. Full page
  await page.screenshot({
    path: `${artifactDir}\\screenshot_capacity_perfected_full.png`,
    fullPage: true,
  });

  // 2. Top bar crop
  const header = page.locator('header[data-testid="ward-bar"]');
  if (await header.count() > 0) {
    await header.screenshot({
      path: `${artifactDir}\\screenshot_topbar_perfected.png`,
    });
  }

  // 3. Search input & icon close-up
  const searchWrap = page.locator('[class*="searchWrap"]');
  if (await searchWrap.count() > 0) {
    await searchWrap.screenshot({
      path: `${artifactDir}\\screenshot_search_perfected.png`,
    });
  }

  // 4. Scroll to bottom of table and capture table bottom + panel
  const panel = page.locator('section:has([data-testid="ward-capacity-network-table"])');
  await panel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // Evaluate table scroll and panel metrics
  const metrics = await page.evaluate(() => {
    const tableScroll = document.querySelector('[data-testid="ward-capacity-network-table"]');
    const table = tableScroll ? tableScroll.querySelector('table') : null;
    const panelEl = tableScroll ? tableScroll.closest('[data-ward-primitive="panel"]') : null;
    const lastRow = table ? table.querySelector('tbody:last-of-type tr:last-child') : null;

    function getBox(el) {
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        rect: { top: r.top, bottom: r.bottom, height: r.height, width: r.width },
        borderRadius: cs.borderRadius,
        border: cs.border,
        borderBottom: cs.borderBottom,
        boxShadow: cs.boxShadow,
        overflow: cs.overflow,
        maxHeight: cs.maxHeight,
      };
    }

    return {
      table: getBox(table),
      tableScroll: getBox(tableScroll),
      panel: getBox(panelEl),
      lastRowText: lastRow ? lastRow.innerText.trim().replace(/\n+/g, ' ') : null,
    };
  });

  console.log("METRICS:", JSON.stringify(metrics, null, 2));

  // Screenshot of the bottom section of the panel
  // Scroll down so the bottom of the panel is in view
  await page.evaluate(() => {
    const p = document.querySelector('section:has([data-testid="ward-capacity-network-table"])');
    if (p) {
      p.scrollIntoView({ block: 'end' });
    }
  });
  await page.waitForTimeout(500);

  await page.screenshot({
    path: `${artifactDir}\\screenshot_capacity_table_perfected_bottom.png`,
  });

  await browser.close();
}

main().catch(console.error);

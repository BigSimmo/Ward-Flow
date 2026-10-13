import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto("http://localhost:4467/mockups/ward-flow/capacity", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(1000);

  const analysis = await page.evaluate(() => {
    const tableScroll = document.querySelector('[data-testid="ward-capacity-network-table"]');
    const table = tableScroll ? tableScroll.querySelector('table') : null;
    const panel = tableScroll ? tableScroll.closest('[data-ward-primitive="panel"]') : null;
    const networkBody = tableScroll ? tableScroll.closest('[class*="networkBody"]') : null;
    const capacityGrid = tableScroll ? tableScroll.closest('[class*="capacityGrid"]') : null;
    const main = document.querySelector('main');
    const footer = document.querySelector('[data-testid="ward-capacity-governance"]');

    function getBox(el) {
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        className: el.className,
        rect: { top: r.top, bottom: r.bottom, height: r.height, width: r.width },
        borderRadius: cs.borderRadius,
        border: cs.border,
        borderBottom: cs.borderBottom,
        overflow: cs.overflow,
        overflowX: cs.overflowX,
        overflowY: cs.overflowY,
        margin: cs.margin,
        marginBottom: cs.marginBottom,
        padding: cs.padding,
        paddingBottom: cs.paddingBottom,
        maxHeight: cs.maxHeight,
        boxShadow: cs.boxShadow,
      };
    }

    // Also get last row of table
    const lastRow = table ? table.querySelector('tbody:last-of-type tr:last-child') : null;
    const lastRowCells = lastRow ? Array.from(lastRow.querySelectorAll('th, td')).map(c => {
      const cs = window.getComputedStyle(c);
      return {
        tag: c.tagName,
        borderBottom: cs.borderBottom,
        borderRadius: cs.borderRadius,
        background: cs.background,
      };
    }) : [];

    return {
      table: getBox(table),
      tableScroll: getBox(tableScroll),
      networkBody: getBox(networkBody),
      panel: getBox(panel),
      capacityGrid: getBox(capacityGrid),
      main: getBox(main),
      footer: getBox(footer),
      lastRowCells,
    };
  });

  console.log(JSON.stringify(analysis, null, 2));
  await browser.close();
}

main().catch(console.error);

import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto("http://localhost:4467/mockups/ward-flow/out-of-area", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(1000);

  const analysis = await page.evaluate(() => {
    const table = document.querySelector('table');
    const tableScroll = table ? table.closest('[class*="tableScroll"], [class*="tableWrap"]') : null;
    const panel = table ? table.closest('[class*="panel"]') : null;
    const main = document.querySelector('main');

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
        padding: cs.padding,
        boxShadow: cs.boxShadow,
      };
    }

    return {
      table: getBox(table),
      tableScroll: getBox(tableScroll),
      panel: getBox(panel),
    };
  });

  console.log(JSON.stringify(analysis, null, 2));
  await browser.close();
}

main().catch(console.error);

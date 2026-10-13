import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto("http://localhost:4467/mockups/ward-flow/out-of-area");
  await page.waitForTimeout(1000);

  const data = await page.evaluate(() => {
    const table = document.querySelector("table");
    const wrap = table ? table.parentElement : null;
    const panel = table ? table.closest('[class*="panel"]') : null;
    const col = panel ? panel.parentElement : null;

    function summarize(el) {
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        className: el.className,
        rect: { top: r.top, bottom: r.bottom, height: r.height, width: r.width },
        borderRadius: cs.borderRadius,
        overflow: cs.overflow,
        border: cs.border,
        borderBottom: cs.borderBottom,
        boxShadow: cs.boxShadow,
        background: cs.backgroundColor,
        padding: cs.padding,
        margin: cs.margin,
      };
    }

    const lastTr = table ? table.querySelector("tbody tr:last-child") : null;
    const lastTdFirst = lastTr ? lastTr.querySelector("td:first-child") : null;
    const lastTdLast = lastTr ? lastTr.querySelector("td:last-child") : null;

    return {
      table: summarize(table),
      wrap: summarize(wrap),
      panel: summarize(panel),
      col: summarize(col),
      lastTr: summarize(lastTr),
      lastTdFirst: summarize(lastTdFirst),
      lastTdLast: summarize(lastTdLast),
    };
  });

  console.log(JSON.stringify(data, null, 2));
  await browser.close();
}

main().catch(console.error);

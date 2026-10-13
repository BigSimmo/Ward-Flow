import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto("http://localhost:4467/mockups/ward-flow/capacity", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(1000);

  const searchDetails = await page.evaluate(() => {
    const input = document.querySelector('header input');
    const controlBox = input ? input.closest('[class*="controlBox"]') : null;
    const icon = controlBox ? controlBox.querySelector('svg') : null;
    const shortcut = controlBox ? controlBox.querySelector('[class*="shortcut"]') : null;
    const drawerTriggers = Array.from(document.querySelectorAll('header [class*="drawerTrigger"]'));

    function cs(el) {
      if (!el) return null;
      const s = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        className: el.className,
        rect: { width: r.width, height: r.height, x: r.x, y: r.y },
        borderRadius: s.borderRadius,
        border: s.border,
        background: s.background,
        color: s.color,
        fontSize: s.fontSize,
        padding: s.padding,
        gap: s.gap,
        boxShadow: s.boxShadow,
      };
    }

    return {
      input: cs(input),
      controlBox: cs(controlBox),
      icon: cs(icon),
      shortcut: cs(shortcut),
      drawerTriggers: drawerTriggers.map(t => {
        const svg = t.querySelector('svg');
        const badge = t.querySelector('[class*="badge"], [class*="alarmBadge"]');
        const dot = t.querySelector('[class*="dot"]');
        return {
          text: t.innerText,
          box: cs(t),
          svg: cs(svg),
          badge: cs(badge),
          dot: cs(dot),
        };
      })
    };
  });

  console.log(JSON.stringify(searchDetails, null, 2));
  await browser.close();
}

main().catch(console.error);

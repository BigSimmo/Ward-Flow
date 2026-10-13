import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto("http://localhost:4467/mockups/ward-flow/capacity", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  const scrollers = await page.evaluate(() => {
    let el = document.querySelector('section:has([data-testid="ward-capacity-network-table"])');
    const result = [];
    while (el) {
      const cs = window.getComputedStyle(el);
      if (cs.overflowY === "auto" || cs.overflowY === "scroll" || el === document.body || el === document.documentElement) {
        result.push({
          tag: el.tagName,
          className: el.className,
          id: el.id,
          overflowY: cs.overflowY,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        });
      }
      el = el.parentElement;
    }
    return result;
  });

  console.log("SCROLLERS:", JSON.stringify(scrollers, null, 2));

  // Scroll the actual scroller to bottom
  await page.evaluate(() => {
    const scroller = document.querySelector('[class*="shellContent"]') || document.querySelector('main') || document.documentElement;
    scroller.scrollTop = scroller.scrollHeight;
  });
  await page.waitForTimeout(500);

  const artifactDir = "C:/Users/joshs/.gemini/antigravity/brain/c6dc2bdc-bd3b-44bc-b36c-1bac489d7dce";
  await page.screenshot({
    path: `${artifactDir}/screenshot_capacity_scrolled_to_bottom.png`,
  });

  await browser.close();
}

main().catch(console.error);

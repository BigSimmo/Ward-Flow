import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const artifactDir = "C:/Users/joshs/.gemini/antigravity/brain/c6dc2bdc-bd3b-44bc-b36c-1bac489d7dce";
const publicScreenshotsDir = "d:/Repos/Ward-Flow/public/screenshots";
if (!fs.existsSync(publicScreenshotsDir)) {
  fs.mkdirSync(publicScreenshotsDir, { recursive: true });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  // 1. Capacity page
  console.log("Navigating to capacity page...");
  await page.goto("http://localhost:4467/mockups/ward-flow/capacity", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2000);

  const cap1 = path.join(artifactDir, "screenshot_capacity_full.png");
  await page.screenshot({ path: cap1, fullPage: true });
  console.log(`Captured ${cap1}`);

  // Inspect tables and panels on capacity page
  const tableInfo = await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('[data-ward-primitive="panel"], section, table, [data-ward-primitive="table"]'));
    return panels.map(el => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        className: el.className,
        testId: el.getAttribute("data-testid"),
        borderRadius: style.borderRadius,
        borderBottomLeftRadius: style.borderBottomLeftRadius,
        borderBottomRightRadius: style.borderBottomRightRadius,
        overflow: style.overflow,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        boxShadow: style.boxShadow,
        rect: { width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom }
      };
    });
  });

  fs.writeFileSync(path.join(artifactDir, "capacity_dom_info.json"), JSON.stringify(tableInfo, null, 2));

  // Inspect the top bar
  const headerInfo = await page.evaluate(() => {
    const header = document.querySelector('header[data-testid="ward-bar"]');
    if (!header) return null;
    const searchBox = header.querySelector('input, [class*="search"], [class*="controlBox"]');
    const triggers = Array.from(header.querySelectorAll('button'));
    return {
      headerRect: header.getBoundingClientRect(),
      searchBox: searchBox ? {
        className: searchBox.className,
        rect: searchBox.getBoundingClientRect(),
        computed: {
          borderRadius: window.getComputedStyle(searchBox).borderRadius,
          height: window.getComputedStyle(searchBox).height,
          border: window.getComputedStyle(searchBox).border,
          boxShadow: window.getComputedStyle(searchBox).boxShadow,
        }
      } : null,
      buttons: triggers.map(b => ({
        text: b.innerText,
        testId: b.getAttribute('data-testid'),
        ariaLabel: b.getAttribute('aria-label'),
        rect: b.getBoundingClientRect(),
        borderRadius: window.getComputedStyle(b).borderRadius,
        height: window.getComputedStyle(b).height,
      }))
    };
  });

  fs.writeFileSync(path.join(artifactDir, "header_dom_info.json"), JSON.stringify(headerInfo, null, 2));

  // 2. Out of area page screenshot
  console.log("Navigating to out of area page...");
  await page.goto("http://localhost:4467/mockups/ward-flow/out-of-area", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2000);

  const ooa1 = path.join(artifactDir, "screenshot_out_of_area_full.png");
  await page.screenshot({ path: ooa1, fullPage: true });
  console.log(`Captured ${ooa1}`);

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

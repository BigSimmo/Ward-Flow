import { chromium } from "playwright";
import { newestPreinstalledChromiumHeadlessShell } from "../playwright-browser-preflight.mjs";
import path from "node:path";

const browsersRoot = path.join(process.env.LOCALAPPDATA || "C:/Users/joshs/AppData/Local", "ms-playwright");
const BROWSER_PATH = newestPreinstalledChromiumHeadlessShell(browsersRoot);

async function run() {
  const browser = await chromium.launch({ executablePath: BROWSER_PATH, headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  for (const url of [
    "http://localhost:3605/mockups/ward-flow/statistics",
    "http://localhost:3605/mockups/ward-flow/statistics/overview",
    "http://localhost:3605/mockups/ward-flow/statistics/compare",
    "http://localhost:3605/mockups/ward-flow/statistics/service/North%20Metro",
    "http://localhost:3605/mockups/ward-flow/statistics/ward/rph-adult-secure",
    "http://localhost:3605/mockups/ward-flow/statistics/ed/fsh-ed",
    "http://localhost:3605/mockups/ward-flow/statistics/community/midland"
  ]) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const smalls = await page.evaluate(() => {
      const interactives = Array.from(document.querySelectorAll("button, a, input, select, [role='button'], [role='tab']"));
      const list = [];
      for (const el of interactives) {
        if (!el.offsetParent) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          if (rect.width < 44 || rect.height < 44) {
            list.push({
              tag: el.tagName,
              text: (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 30),
              w: Math.round(rect.width),
              h: Math.round(rect.height),
              cls: el.className
            });
          }
        }
      }
      return list;
    });
    console.log(url, "Small targets (<44px) count:", smalls.length);
    if (smalls.length > 0) {
      console.log("  Samples:", smalls.slice(0, 5));
    }
  }
  await browser.close();
}
run();

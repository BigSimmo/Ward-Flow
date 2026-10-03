import { chromium } from "playwright";
import { resolveAuditTarget } from "./local-audit-target.mjs";
import { newestPreinstalledChromiumHeadlessShell } from "../playwright-browser-preflight.mjs";
import path from "node:path";

const browsersRoot = path.join(process.env.LOCALAPPDATA || "C:/Users/joshs/AppData/Local", "ms-playwright");
const BROWSER_PATH = newestPreinstalledChromiumHeadlessShell(browsersRoot);

async function run() {
  const base = (await resolveAuditTarget()).url;
  const browser = await chromium.launch({ executablePath: BROWSER_PATH, headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  for (const url of [
    "/mockups/ward-flow/statistics",
    "/mockups/ward-flow/statistics/overview",
    "/mockups/ward-flow/statistics/compare",
    "/mockups/ward-flow/statistics/service/North%20Metro",
    "/mockups/ward-flow/statistics/ward/rph-adult-secure",
    "/mockups/ward-flow/statistics/ed/fsh-ed",
    "/mockups/ward-flow/statistics/community/midland",
  ]) {
    await page.goto(base + url, { waitUntil: "domcontentloaded" });
    const smalls = await page.evaluate(() => {
      const interactives = Array.from(
        document.querySelectorAll("button, a, input, select, [role='button'], [role='tab']"),
      );
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
              cls: el.className,
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

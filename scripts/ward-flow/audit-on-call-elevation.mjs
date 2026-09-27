import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { newestPreinstalledChromiumHeadlessShell } from "../playwright-browser-preflight.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const browsersRoot = path.join(process.env.LOCALAPPDATA || "C:/Users/joshs/AppData/Local", "ms-playwright");
const BROWSER_PATH = newestPreinstalledChromiumHeadlessShell(browsersRoot);

const BASE_URL = "http://localhost:3605";
const SCREENSHOT_DIR = path.resolve(projectRoot, ".audit-reports/on-call-elevation");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { id: "desktop-1440", width: 1440, height: 900, isMobile: false },
  { id: "tablet-820", width: 820, height: 1180, isMobile: false },
  { id: "mobile-390", width: 390, height: 844, isMobile: true },
];

const THEMES = ["light", "dark"];

async function main() {
  console.log("Launching Chromium from:", BROWSER_PATH);
  const browser = await chromium.launch({
    executablePath: BROWSER_PATH,
    headless: true,
  });

  const auditResults = {
    viewports: {},
    interactiveTests: {},
    fatalFlaws: {
      ff1ClippedText: 0,
      ff4HorizontalOverflow: 0,
      mobileTouchTargetDefects: 0,
      ff8DisclosureBannerPresent: false,
    },
  };

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: "light",
    });

    const page = await context.newPage();
    const consoleErrors = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const txt = msg.text();
        if (!txt.includes("favicon")) consoleErrors.push(txt);
      }
    });

    console.log("Navigating to on-call screen...");
    const res = await page.goto(`${BASE_URL}/mockups/ward-flow/on-call`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    console.log(`Page status: ${res?.status()}`);
    await page.waitForTimeout(1000);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(200);

      for (const theme of THEMES) {
        const vpKey = `${vp.id}__${theme}`;
        console.log(`\n--- Inspecting ${vpKey} ---`);

        // Set theme
        await page.evaluate((th) => {
          document.documentElement.setAttribute("data-theme", th);
          if (th === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        }, theme);

        await page.waitForTimeout(200);

        // Screenshot
        const screenshotPath = path.join(SCREENSHOT_DIR, `on-call__${vpKey}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`Screenshot saved: ${screenshotPath}`);

        // Measure Horizontal Overflow
        const overflow = await page.evaluate(() => {
          const docEl = document.documentElement;
          return {
            scrollWidth: docEl.scrollWidth,
            clientWidth: docEl.clientWidth,
            hasOverflow: docEl.scrollWidth > docEl.clientWidth,
          };
        });
        console.log(`Overflow: scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}, hasOverflow=${overflow.hasOverflow}`);
        if (overflow.hasOverflow) auditResults.fatalFlaws.ff4HorizontalOverflow++;

        // Measure Clipped Text
        const clippedText = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll("h1, h2, h3, h4, p, span, td, th, label, dt, dd, button"));
          const clipped = [];
          for (const el of elements) {
            if (!el.offsetParent) continue;
            // Ignore screen-reader only elements and 0/1-dimension items
            if (el.clientWidth <= 1 || el.clientHeight <= 1 || el.classList.contains("sr-only") || el.getAttribute("aria-hidden") === "true") continue;
            const style = window.getComputedStyle(el);
            if (style.overflow === "hidden" && style.textOverflow !== "ellipsis") {
              if (el.scrollWidth > el.clientWidth + 2) {
                clipped.push({
                  tag: el.tagName,
                  text: (el.innerText || "").slice(0, 30),
                  scrollWidth: el.scrollWidth,
                  clientWidth: el.clientWidth,
                });
              }
            }
          }
          return clipped;
        });
        console.log(`Clipped text elements: ${clippedText.length}`, clippedText);
        if (clippedText.length > 0) auditResults.fatalFlaws.ff1ClippedText += clippedText.length;

        // Check Touch Targets on Mobile
        if (vp.isMobile) {
          const smallTargets = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll("button, a, input, select, summary"));
            const small = [];
            for (const b of buttons) {
              if (!b.offsetParent) continue;
              const rect = b.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                if (rect.height < 44 && rect.width < 44) {
                  small.push({
                    text: (b.innerText || b.getAttribute("aria-label") || b.tagName).trim().slice(0, 25),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                  });
                }
              }
            }
            return small;
          });
          console.log(`Mobile small touch targets (<44px): ${smallTargets.length}`, smallTargets);
          if (smallTargets.length > 0) auditResults.fatalFlaws.mobileTouchTargetDefects += smallTargets.length;
        }

        // Check Invariant FF8: Prototype Disclosure Banner
        const disclosure = await page.evaluate(() => {
          const text = document.body.innerText || "";
          return (
            text.includes("Roles and shifts are invented") &&
            text.includes("Contact details are not held")
          );
        });
        if (disclosure) auditResults.fatalFlaws.ff8DisclosureBannerPresent = true;

        auditResults.viewports[vpKey] = {
          overflow,
          clippedCount: clippedText.length,
          consoleErrors,
        };
      }
    }

    // Now test Interactive States on Desktop
    console.log("\n--- Testing Interactive States ---");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "light");
      document.documentElement.classList.remove("dark");
    });
    await page.waitForTimeout(200);

    // 1. Test Rule D4 action feedback
    const connectButtons = await page.$$("button:has-text('Connect'), button:has-text('Direct Connect')");
    console.log(`Found ${connectButtons.length} Connect buttons.`);
    if (connectButtons.length > 0) {
      await connectButtons[0].click();
      await page.waitForTimeout(300);
      const toastText = await page.evaluate(() => {
        const t = document.querySelector("[data-testid='ward-on-call-toast']") || document.querySelector("[role='status']");
        return t ? (t.innerText || t.textContent) : null;
      });
      console.log(`Toast text on Connect click: "${toastText}"`);
      auditResults.interactiveTests.ruleD4Feedback = toastText?.includes("Not wired in this prototype.") ?? false;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "interactive__toast.png") });
    }

    // 2. Test Tier 3 Escalation Modal + Escape Dismissal + Focus Restoration
    const escalationButton = await page.$("button:has-text('! Trigger Tier 3 Escalation')");
    if (escalationButton) {
      await escalationButton.focus();
      await escalationButton.click();
      await page.waitForTimeout(300);

      const isModalVisible = await page.evaluate(() => {
        const dialog = document.querySelector("[role='dialog']");
        return dialog !== null && window.getComputedStyle(dialog).display !== "none";
      });
      console.log(`Modal visible after trigger: ${isModalVisible}`);
      auditResults.interactiveTests.modalOpen = isModalVisible;

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "interactive__modal.png") });

      // Press Escape
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);

      const isModalClosed = await page.evaluate(() => {
        const dialog = document.querySelector("[role='dialog']");
        return dialog === null;
      });
      console.log(`Modal closed after Escape: ${isModalClosed}`);
      auditResults.interactiveTests.modalEscapeDismiss = isModalClosed;

      const isFocusRestored = await page.evaluate(() => {
        return document.activeElement?.textContent?.includes("Trigger Tier 3 Escalation") ?? false;
      });
      console.log(`Focus restored to trigger button: ${isFocusRestored}`);
      auditResults.interactiveTests.focusRestored = isFocusRestored;
    }

    // 3. Test Service Filter and Search
    const northFilterBtn = await page.$("button:has-text('North Metro')");
    if (northFilterBtn) {
      await northFilterBtn.click();
      await page.waitForTimeout(300);
      const rowCount = await page.evaluate(() => {
        return document.querySelectorAll("[data-testid^='ward-on-call-role-']").length;
      });
      console.log(`Role count after North Metro filter: ${rowCount}`);
      auditResults.interactiveTests.filterWorks = rowCount === 2;
    }

    // 4. Test Search
    const searchInput = await page.$("input[type='search']");
    if (searchInput) {
      await searchInput.fill("consultant");
      await page.waitForTimeout(300);
      const searchRowCount = await page.evaluate(() => {
        return document.querySelectorAll("[data-testid^='ward-on-call-role-']").length;
      });
      console.log(`Role count after searching 'consultant': ${searchRowCount}`);
      auditResults.interactiveTests.searchWorks = searchRowCount > 0;
    }

    await context.close();

    console.log("\n========================================================");
    console.log("AUDIT RESULTS SUMMARY:");
    console.log(JSON.stringify(auditResults, null, 2));
    console.log("========================================================\n");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Audit script failed:", err);
  process.exit(1);
});

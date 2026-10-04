#!/usr/bin/env node
/**
 * 🔴 ADVERSARIAL VISUAL AUDIT & STRUCTURAL QUALITY INSPECTION (HIGH-SPEED OPTIMIZED)
 */

import { chromium } from "playwright";
import { resolveAuditTarget } from "./local-audit-target.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { newestPreinstalledChromiumHeadlessShell } from "../playwright-browser-preflight.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const browsersRoot = path.join(process.env.LOCALAPPDATA || "C:/Users/joshs/AppData/Local", "ms-playwright");
const BROWSER_PATH = newestPreinstalledChromiumHeadlessShell(browsersRoot);

const BASE_URL = (await resolveAuditTarget({ root: projectRoot })).url;
const OUTPUT_DIR = path.resolve(projectRoot, ".audit-reports");
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "screenshots");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { id: "desktop-1440", width: 1440, height: 900, isMobile: false },
  { id: "tablet-820", width: 820, height: 1180, isMobile: false },
  { id: "mobile-390", width: 390, height: 844, isMobile: true },
];

const THEMES = ["light", "dark"];

const SCREENS = [
  // Ward Flow core operational screens
  { name: "ward-flow-coordinator", path: "/mockups/ward-flow" },
  { name: "ward-flow-delays", path: "/mockups/ward-flow/delays" },
  { name: "ward-flow-movements", path: "/mockups/ward-flow/movements" },
  { name: "ward-flow-capacity", path: "/mockups/ward-flow/capacity" },
  { name: "ward-flow-ward-unit", path: "/mockups/ward-flow/ward/rph-adult-secure" },
  { name: "ward-flow-wards-directory", path: "/mockups/ward-flow/wards" },
  { name: "ward-flow-bed-board", path: "/mockups/ward-flow/board/rph-adult-secure" },
  { name: "ward-flow-ed", path: "/mockups/ward-flow/ed/peel-ed" },
  { name: "ward-flow-community", path: "/mockups/ward-flow/community/midland" },
  { name: "ward-flow-search", path: "/mockups/ward-flow/search" },
  { name: "ward-flow-patient-now", path: "/mockups/ward-flow/people/WF-014" },
  { name: "ward-flow-search-hub", path: "/mockups/ward-flow/hub" },
  { name: "ward-flow-raise-referral", path: "/mockups/ward-flow/referrals/new" },
  { name: "ward-flow-stats-overview", path: "/mockups/ward-flow/statistics/overview" },
  { name: "ward-flow-stats-ward", path: "/mockups/ward-flow/statistics/ward/rph-adult-secure" },
  { name: "ward-flow-stats-community", path: "/mockups/ward-flow/statistics/community/midland" },
  { name: "ward-flow-stats-ed", path: "/mockups/ward-flow/statistics/ed/peel-ed" },
  { name: "ward-flow-network", path: "/mockups/ward-flow/network" },
  { name: "ward-flow-governance", path: "/mockups/ward-flow/governance" },
  { name: "ward-flow-handover", path: "/mockups/ward-flow/handover" },
  { name: "ward-flow-discharges", path: "/mockups/ward-flow/discharges" },
  { name: "ward-flow-out-of-area", path: "/mockups/ward-flow/out-of-area" },
  { name: "ward-flow-on-call", path: "/mockups/ward-flow/on-call" },
  { name: "ward-flow-alerts", path: "/mockups/ward-flow/alerts" },
  { name: "ward-flow-transport-officer", path: "/mockups/ward-flow/transport/officer" },
  { name: "ward-flow-legal-forms", path: "/mockups/ward-flow/legal-forms" },
  { name: "ward-flow-add-patient", path: "/mockups/ward-flow/people/new" },
  { name: "ward-flow-referrals", path: "/mockups/ward-flow/referrals" },
  { name: "ward-flow-settings", path: "/mockups/ward-flow/settings" },
  { name: "ward-flow-statistics", path: "/mockups/ward-flow/statistics" },
  { name: "ward-flow-statistics-compare", path: "/mockups/ward-flow/statistics/compare" },
  { name: "ward-flow-statistics-service", path: "/mockups/ward-flow/statistics/service/North%20Metro" },
  { name: "ward-flow-sign-in", path: "/mockups/ward-flow-sign-in" },
  { name: "ward-flow-ward-answer", path: "/mockups/ward-flow/ward/rph-adult-secure/answer" },
  // Companion applications (the PsychSift home and applications screens went with PsychSift)
  { name: "caring-contacts", path: "/caring-contacts" },
  { name: "safety-plan", path: "/safety-plan" },
];

async function runPass1(browser) {
  console.log("\n========================================================");
  console.log("PASS 1: MULTI-VIEWPORT STRUCTURAL & VISUAL INTEGRITY SCAN");
  console.log("========================================================\n");

  const findings = [];
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const txt = msg.text();
      if (!txt.includes("favicon") && !txt.includes("form field element should have an id")) {
        consoleErrors.push(txt);
      }
    }
  });

  for (let i = 0; i < SCREENS.length; i++) {
    const screen = SCREENS[i];
    console.log(`[${i + 1}/${SCREENS.length}] Auditing ${screen.name} (${screen.path})...`);
    consoleErrors.length = 0;

    try {
      // 1. Initial navigation (allow up to 60s for compiler warmup)
      const res = await page.goto(`${BASE_URL}${screen.path}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      const status = res ? res.status() : 0;
      if (status >= 400) {
        findings.push({
          screen: screen.name,
          path: screen.path,
          type: "HTTP_ERROR",
          severity: "CRITICAL",
          message: `HTTP response status ${status}`,
        });
        continue;
      }

      await page.waitForTimeout(300);

      // Check React crash
      const reactCrash = await page.evaluate(() => {
        const txt = document.body.innerText || "";
        if (
          txt.includes("Application error: a client-side exception has occurred") ||
          txt.includes("Unhandled Runtime Error")
        ) {
          return txt.slice(0, 300);
        }
        return null;
      });

      if (reactCrash) {
        findings.push({
          screen: screen.name,
          path: screen.path,
          type: "REACT_CRASH",
          severity: "CRITICAL",
          message: `React error boundary triggered: ${reactCrash}`,
        });
      }

      // Check Console errors from initial load
      if (consoleErrors.length > 0) {
        findings.push({
          screen: screen.name,
          path: screen.path,
          type: "CONSOLE_ERROR",
          severity: "HIGH",
          message: consoleErrors.slice(0, 3).join(" | "),
        });
      }

      // 2. Iterate through Viewports & Themes via DOM manipulation & resize (very fast!)
      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(100);

        for (const theme of THEMES) {
          const key = `${screen.name}__${vp.id}__${theme}`;

          await page.evaluate((th) => {
            document.documentElement.setAttribute("data-theme", th);
            if (th === "dark") {
              document.documentElement.classList.add("dark");
            } else {
              document.documentElement.classList.remove("dark");
            }
          }, theme);
          await page.waitForTimeout(100);

          // Check Overflow
          const overflow = await page.evaluate(() => {
            const docEl = document.documentElement;
            return {
              scrollWidth: docEl.scrollWidth,
              clientWidth: docEl.clientWidth,
              hasOverflow: docEl.scrollWidth > docEl.clientWidth + 1,
            };
          });

          if (overflow.hasOverflow) {
            findings.push({
              key,
              screen: screen.name,
              path: screen.path,
              viewport: vp.id,
              theme,
              type: "HORIZONTAL_OVERFLOW",
              severity: "HIGH",
              message: `Page scrolls horizontally: scrollWidth (${overflow.scrollWidth}px) > clientWidth (${overflow.clientWidth}px)`,
            });
          }

          // DOM anomaly scan
          const domAnomalies = await page.evaluate((isMobile) => {
            const issues = [];
            // Text clipping without ellipsis
            const textNodes = Array.from(document.querySelectorAll("h1, h2, h3, h4, p, span, td, th, label"));
            for (const el of textNodes) {
              if (!el.offsetParent) continue;
              const style = window.getComputedStyle(el);
              if (style.overflow === "hidden" && style.textOverflow !== "ellipsis") {
                if (el.scrollWidth > el.clientWidth + 6) {
                  issues.push({
                    type: "CLIPPED_TEXT",
                    tag: el.tagName,
                    text: (el.innerText || "").slice(0, 40),
                    detail: `scrollWidth ${el.scrollWidth}px > clientWidth ${el.clientWidth}px without ellipsis`,
                  });
                  if (issues.length >= 3) break;
                }
              }
            }

            // Small touch targets on mobile (< 30px)
            if (isMobile) {
              const buttons = Array.from(document.querySelectorAll("button, a[role='button']"));
              for (const btn of buttons) {
                if (!btn.offsetParent) continue;
                const rect = btn.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && (rect.width < 28 || rect.height < 28)) {
                  issues.push({
                    type: "SMALL_TOUCH_TARGET",
                    text: (btn.innerText || btn.getAttribute("aria-label") || "unlabeled").trim().slice(0, 25),
                    detail: `${Math.round(rect.width)}x${Math.round(rect.height)}px touch target (< 28px)`,
                  });
                  if (issues.length >= 4) break;
                }
              }
            }

            return issues;
          }, vp.isMobile);

          for (const anomaly of domAnomalies) {
            findings.push({
              key,
              screen: screen.name,
              path: screen.path,
              viewport: vp.id,
              theme,
              type: anomaly.type,
              severity: anomaly.type === "SMALL_TOUCH_TARGET" ? "MEDIUM" : "HIGH",
              message: `${anomaly.text ? `"${anomaly.text}": ` : ""}${anomaly.detail}`,
            });
          }

          // Capture screenshots for key representative configurations
          const shouldScreenshot =
            (vp.id === "desktop-1440" && theme === "light") ||
            (vp.id === "desktop-1440" && theme === "dark") ||
            (vp.id === "mobile-390" && theme === "light") ||
            overflow.hasOverflow ||
            reactCrash;

          if (shouldScreenshot) {
            const shotPath = path.join(SCREENSHOT_DIR, `${key}.png`);
            await page.screenshot({ path: shotPath, fullPage: false });
          }
        }
      }
    } catch (err) {
      findings.push({
        screen: screen.name,
        path: screen.path,
        type: "EXCEPTION",
        severity: "CRITICAL",
        message: err.message,
      });
      console.log(`  ❌ Error auditing ${screen.name}: ${err.message}`);
    }
  }

  await context.close();
  return findings;
}

async function runPass2(browser) {
  console.log("\n========================================================");
  console.log("PASS 2: INTERACTIVE ADVERSARIAL STRESS TESTING");
  console.log("========================================================\n");

  const interactiveFindings = [];

  const interactiveTests = [
    {
      screen: "ward-flow-coordinator",
      path: "/mockups/ward-flow",
      name: "Global Search / Typeahead Input",
      action: async (page) => {
        const searchInput = await page.$(
          "input[type='search'], input[placeholder*='Search'], input[aria-label*='Search']",
        );
        if (searchInput) {
          await searchInput.fill("David");
          await page.waitForTimeout(400);
          return { success: true, detail: "Typed query into search input" };
        }
        return { success: false, detail: "Search input not found" };
      },
    },
    {
      screen: "ward-flow-bed-board",
      path: "/mockups/ward-flow/board/rph-adult-secure",
      name: "Bed Board Filter Buttons",
      action: async (page) => {
        const buttons = await page.$$("button");
        let clicked = 0;
        for (const btn of buttons.slice(0, 6)) {
          const text = await btn.innerText();
          if (text && !text.includes("Sign out") && !text.includes("Delete")) {
            try {
              await btn.click({ timeout: 1000 });
              clicked++;
              await page.waitForTimeout(100);
            } catch {}
          }
        }
        return { success: true, detail: `Exercised ${clicked} buttons on Bed Board` };
      },
    },
    {
      screen: "ward-flow-patient-now",
      path: "/mockups/ward-flow/people/WF-014",
      name: "Patient Now Tab Switching",
      action: async (page) => {
        const tabs = await page.$$(
          "[role='tab'], button:has-text('Overview'), button:has-text('Clinical'), button:has-text('Timeline'), button:has-text('Legal')",
        );
        let switched = 0;
        for (const tab of tabs) {
          try {
            await tab.click({ timeout: 1000 });
            switched++;
            await page.waitForTimeout(150);
          } catch {}
        }
        return { success: true, detail: `Switched through ${switched} patient tabs` };
      },
    },
    {
      screen: "ward-flow-add-patient",
      path: "/mockups/ward-flow/people/new",
      name: "Add Patient Form Submit Validation",
      action: async (page) => {
        const submitBtn = await page.$(
          "button[type='submit'], button:has-text('Add Patient'), button:has-text('Save'), button:has-text('Submit')",
        );
        if (submitBtn) {
          await submitBtn.click();
          await page.waitForTimeout(300);
          return { success: true, detail: "Triggered validation on empty Add Patient submission" };
        }
        return { success: false, detail: "Submit button not found on Add Patient" };
      },
    },
    {
      screen: "ward-flow-delays",
      path: "/mockups/ward-flow/delays",
      name: "Delays Filter Pills",
      action: async (page) => {
        const filterPills = await page.$$(
          "button[role='radio'], [data-filter], button:has-text('All'), button:has-text('NDIS'), button:has-text('Housing')",
        );
        let clicked = 0;
        for (const pill of filterPills.slice(0, 4)) {
          try {
            await pill.click({ timeout: 1000 });
            clicked++;
            await page.waitForTimeout(100);
          } catch {}
        }
        return { success: true, detail: `Clicked ${clicked} delay filter pills` };
      },
    },
  ];

  for (const test of interactiveTests) {
    console.log(`Running interactive test: ${test.name} on ${test.screen}...`);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: "light",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    try {
      await page.goto(`${BASE_URL}${test.path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(300);
      const res = await test.action(page);

      // Take interactive snapshot
      const shotPath = path.join(
        SCREENSHOT_DIR,
        `interactive__${test.screen}__${test.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}.png`,
      );
      await page.screenshot({ path: shotPath });

      if (errors.length > 0) {
        interactiveFindings.push({
          test: test.name,
          screen: test.screen,
          type: "INTERACTION_RUNTIME_ERROR",
          severity: "HIGH",
          message: errors.join(" | "),
          screenshot: shotPath,
        });
      } else {
        interactiveFindings.push({
          test: test.name,
          screen: test.screen,
          type: "SUCCESS",
          severity: "INFO",
          message: res.detail,
          screenshot: shotPath,
        });
      }
    } catch (err) {
      interactiveFindings.push({
        test: test.name,
        screen: test.screen,
        type: "INTERACTION_FAILURE",
        severity: "CRITICAL",
        message: err.message,
      });
    } finally {
      await context.close();
    }
  }

  return interactiveFindings;
}

async function main() {
  console.log("Launching headless browser at:", BROWSER_PATH);
  const browser = await chromium.launch({
    executablePath: BROWSER_PATH,
  });

  try {
    const pass1 = await runPass1(browser);
    const pass2 = await runPass2(browser);

    const report = {
      timestamp: new Date().toISOString(),
      baseUrl: BASE_URL,
      pass1Findings: pass1,
      pass2Findings: pass2,
      criticalCount:
        pass1.filter((f) => f.severity === "CRITICAL").length + pass2.filter((f) => f.severity === "CRITICAL").length,
      highCount: pass1.filter((f) => f.severity === "HIGH").length + pass2.filter((f) => f.severity === "HIGH").length,
      mediumCount: pass1.filter((f) => f.severity === "MEDIUM").length,
      screenshots: fs.readdirSync(SCREENSHOT_DIR),
    };

    const reportFile = path.join(OUTPUT_DIR, "adversarial-audit-report.json");
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), "utf8");

    console.log("\n========================================================");
    console.log("AUDIT COMPLETE");
    console.log(`Total Critical: ${report.criticalCount}`);
    console.log(`Total High: ${report.highCount}`);
    console.log(`Total Medium: ${report.mediumCount}`);
    console.log(`Screenshots Captured: ${report.screenshots.length}`);
    console.log(`Report written to: ${reportFile}`);
    console.log("========================================================\n");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Fatal audit error:", err);
  process.exit(1);
});

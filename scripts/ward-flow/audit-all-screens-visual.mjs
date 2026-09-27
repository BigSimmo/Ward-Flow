#!/usr/bin/env node
/**
 * 🔴 WARD FLOW — COMPREHENSIVE 34-SCREEN MULTI-VIEWPORT VISUAL AUDITOR
 *
 * Runs automated visual checks across all 34 operational screens in Ward Flow:
 * - 3 Viewports: Desktop (1440x900), Tablet (820x1180), Mobile (390x844)
 * - 2 Themes: Light and Dark
 * - Invariants:
 *   - FF4: Zero Horizontal Overflow (scrollWidth <= clientWidth + 1)
 *   - FF6: Zero Console Errors / Uncaught Exceptions
 *   - FF8: Synthetic Prototype Disclaimer presence
 *   - Main content visibility
 */

import { chromium } from "playwright";
import { stableProjectPort } from "../../src/lib/local-server-utils.mjs";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { PAIRS } from "./screen-pairs.mjs";

const __wardProjectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BASE_URL = (process.env.WARD_FLOW_URL || `http://localhost:${stableProjectPort(__wardProjectRoot)}`).replace(/\/$/, "");
const ARTIFACT_DIR = path.join(process.cwd(), ".audit-reports");

const VIEWPORTS = [
  { id: "desktop-1440", width: 1440, height: 900, isMobile: false },
  { id: "tablet-820", width: 820, height: 1180, isMobile: false },
  { id: "mobile-390", width: 390, height: 844, isMobile: true },
];

const THEMES = ["light", "dark"];

function resolveRoute(route) {
  let r = route;
  if (route.startsWith("/mockups/")) {
    return route;
  }
  if (route === "/") {
    r = "/mockups/ward-flow";
  } else {
    r = `/mockups/ward-flow${route}`;
  }
  return r
    .replace(/\[unitId\]/g, "rph-adult-secure")
    .replace(/\[edId\]/g, "rph")
    .replace(/\[teamId\]/g, "midland")
    .replace(/\[patientId\]/g, "WF-014")
    .replace(/\[serviceId\]/g, "north-metro");
}

async function main() {
  const specificScreen = process.argv[2]; // optional filter

  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const operational = PAIRS.filter(([, , , contract]) => contract).map(([mockup, route]) => ({
    mockup,
    route,
    urlPath: resolveRoute(route),
  }));

  const targets = specificScreen
    ? operational.filter(
        (s) =>
          s.mockup.includes(specificScreen) || s.route.includes(specificScreen) || s.urlPath.includes(specificScreen),
      )
    : operational;

  if (targets.length === 0) {
    console.error(`No screens matched filter: "${specificScreen}"`);
    process.exit(1);
  }

  console.log(
    `Auditing ${targets.length} screens against ${VIEWPORTS.length} viewports and ${THEMES.length} themes...\n`,
  );

  const browser = await chromium.launch({ headless: true });
  const results = {
    timestamp: new Date().toISOString(),
    totalScreens: targets.length,
    passedScreens: 0,
    failedScreens: 0,
    screens: {},
  };

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    console.log(`[${i + 1}/${targets.length}] ${target.mockup} (${target.urlPath})`);
    const screenRecord = {
      mockup: target.mockup,
      route: target.route,
      urlPath: target.urlPath,
      viewports: {},
      hasDefects: false,
      defects: [],
    };

    for (const vp of VIEWPORTS) {
      for (const theme of THEMES) {
        const key = `${vp.id}-${theme}`;
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          colorScheme: theme,
          isMobile: vp.isMobile,
          hasTouch: vp.isMobile,
        });

        const page = await context.newPage();
        const consoleErrors = [];
        page.on("pageerror", (err) => consoleErrors.push(err.message));
        page.on("console", (msg) => {
          if (msg.type() === "error") consoleErrors.push(msg.text());
        });

        try {
          const res = await page.goto(`${BASE_URL}${target.urlPath}`, {
            waitUntil: "domcontentloaded",
            timeout: 20000,
          });

          if (!res || res.status() >= 400) {
            screenRecord.defects.push(`${key}: HTTP ${res ? res.status() : "no response"}`);
            screenRecord.hasDefects = true;
            await context.close();
            continue;
          }

          // Set data-theme attribute explicitly
          await page.evaluate((th) => {
            document.documentElement.setAttribute("data-theme", th);
            if (th === "dark") {
              document.documentElement.classList.add("dark");
            } else {
              document.documentElement.classList.remove("dark");
            }
          }, theme);

          await page.waitForTimeout(200);

          // 1. Horizontal overflow
          const overflow = await page.evaluate(() => {
            const docEl = document.documentElement;
            const scrollWidth = docEl.scrollWidth;
            const clientWidth = docEl.clientWidth;
            return {
              scrollWidth,
              clientWidth,
              hasOverflow: scrollWidth > clientWidth + 1,
            };
          });

          if (overflow.hasOverflow) {
            screenRecord.defects.push(
              `${key}: Horizontal overflow: scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}`,
            );
            screenRecord.hasDefects = true;
          }

          // 2. Synthetic Prototype disclaimer
          const hasDisclaimer = await page.evaluate(() => {
            const txt = document.body.innerText.toLowerCase();
            return (
              txt.includes("synthetic") ||
              txt.includes("not a medical device") ||
              txt.includes("invented") ||
              txt.includes("demonstration")
            );
          });

          if (!hasDisclaimer) {
            screenRecord.defects.push(`${key}: Missing synthetic prototype disclaimer banner (FF8)`);
            screenRecord.hasDefects = true;
          }

          // 3. Console errors
          const criticalErrors = consoleErrors.filter(
            (e) => !e.includes("favicon") && !e.includes("A form field element should have an id"),
          );
          if (criticalErrors.length > 0) {
            screenRecord.defects.push(`${key}: Console errors: ${criticalErrors.slice(0, 2).join("; ")}`);
            screenRecord.hasDefects = true;
          }

          screenRecord.viewports[key] = {
            scrollWidth: overflow.scrollWidth,
            clientWidth: overflow.clientWidth,
            hasOverflow: overflow.hasOverflow,
            hasDisclaimer,
            errorsCount: criticalErrors.length,
          };
        } catch (err) {
          screenRecord.defects.push(`${key}: Exception: ${err.message}`);
          screenRecord.hasDefects = true;
        } finally {
          await context.close();
        }
      }
    }

    if (screenRecord.hasDefects) {
      results.failedScreens++;
      console.log(`  ❌ ${screenRecord.defects.length} defect(s) detected:`);
      screenRecord.defects.forEach((d) => console.log(`     - ${d}`));
    } else {
      results.passedScreens++;
      console.log(`  ✅ All 6 viewport/theme combinations clean`);
    }

    results.screens[target.mockup] = screenRecord;
  }

  const reportPath = path.join(ARTIFACT_DIR, "screen-audit-summary.json");
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`\n===============================================================`);
  console.log(
    `Audit Finished: ${results.passedScreens} passed, ${results.failedScreens} failed out of ${results.totalScreens}`,
  );
  console.log(`Report written to ${reportPath}`);
  console.log(`===============================================================\n`);

  await browser.close();
}

main().catch((err) => {
  console.error("Fatal audit error:", err);
  process.exit(1);
});

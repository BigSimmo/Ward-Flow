import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { newestPreinstalledChromiumHeadlessShell } from "../playwright-browser-preflight.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const browsersRoot = path.join(process.env.LOCALAPPDATA || "C:/Users/joshs/AppData/Local", "ms-playwright");
const BROWSER_PATH = newestPreinstalledChromiumHeadlessShell(browsersRoot);

const BASE_URL = "http://localhost:3605";

// The 7 target URLs given in prompt
const TARGET_SCREENS = [
  { name: "Executive Statistics Hub", url: `${BASE_URL}/mockups/ward-flow/statistics` },
  { name: "Statewide Capacity & Network Overview", url: `${BASE_URL}/mockups/ward-flow/statistics/overview` },
  { name: "Ward & Emergency Department Comparisons", url: `${BASE_URL}/mockups/ward-flow/statistics/compare` },
  { name: "Health Service Intersite Transfers", url: `${BASE_URL}/mockups/ward-flow/statistics/service/North%20Metro` },
  { name: "Ward Unit Inpatient Statistics", url: `${BASE_URL}/mockups/ward-flow/statistics/ward/ward-4a` },
  { name: "Emergency Department Statistics", url: `${BASE_URL}/mockups/ward-flow/statistics/ed/fsh-ed` },
  { name: "Community Mental Health Team Statistics", url: `${BASE_URL}/mockups/ward-flow/statistics/community/fremantle` },
];

// Valid working screen URLs for comparison/investigation
const VALID_SCREENS = [
  { name: "Health Service (North Metro)", url: `${BASE_URL}/mockups/ward-flow/statistics/service/North%20Metro` },
  { name: "Ward Unit (Ward 2K / rph-adult-secure)", url: `${BASE_URL}/mockups/ward-flow/statistics/ward/rph-adult-secure` },
  { name: "Community Team (midland or Fremantle)", url: `${BASE_URL}/mockups/ward-flow/statistics/community/midland` },
];

const VIEWPORTS = [
  { id: "desktop-1440", width: 1440, height: 900, isMobile: false },
  { id: "tablet-820", width: 820, height: 1180, isMobile: false },
  { id: "mobile-390", width: 390, height: 844, isMobile: true }
];

const THEMES = ["light", "dark"];

async function main() {
  console.log("Launching headless browser at:", BROWSER_PATH);
  const browser = await chromium.launch({
    executablePath: BROWSER_PATH,
    headless: true
  });

  const page = await browser.newPage();
  const results = [];

  for (const screen of [...TARGET_SCREENS, ...VALID_SCREENS]) {
    console.log(`\n==================================================`);
    console.log(`Auditing: ${screen.name} (${screen.url})`);
    console.log(`==================================================`);

    const screenResult = {
      name: screen.name,
      url: screen.url,
      httpStatus: 0,
      consoleErrors: [],
      pageErrors: [],
      notFoundOrRefusal: false,
      notFoundMessage: "",
      viewports: {}
    };

    page.on("console", msg => {
      if (msg.type() === "error") {
        screenResult.consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", err => {
      screenResult.pageErrors.push(err.message);
    });

    try {
      const resp = await page.goto(screen.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      screenResult.httpStatus = resp ? resp.status() : 0;
      await page.waitForTimeout(500);

      // Check not found or refusal
      const notFoundInfo = await page.evaluate(() => {
        const h1 = document.querySelector("h1")?.innerText || "";
        const notFoundEl = document.querySelector("[data-testid*='unresolved'], [class*='notFound']");
        const disclosureBanner = !!document.querySelector("[data-testid*='disclosure'], [data-testid*='disclaimer'], [class*='disclosure'], [class*='disclaimer'], [class*='prototypeDisclaimer'], [class*='syntheticBanner'], footer");
        return {
          h1,
          isNotFound: h1.toLowerCase().includes("not found"),
          notFoundText: notFoundEl?.innerText || "",
          hasDisclosure: disclosureBanner
        };
      });

      screenResult.notFoundOrRefusal = notFoundInfo.isNotFound;
      screenResult.notFoundMessage = notFoundInfo.notFoundText;
      screenResult.hasDisclosure = notFoundInfo.hasDisclosure;

      for (const vp of VIEWPORTS) {
        screenResult.viewports[vp.id] = {};
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(200);

        for (const theme of THEMES) {
          await page.evaluate(t => {
            document.documentElement.setAttribute("data-theme", t);
            if (t === "dark") document.documentElement.classList.add("dark");
            else document.documentElement.classList.remove("dark");
          }, theme);
          await page.waitForTimeout(100);

          // Evaluate document scroll overflow & layout metrics
          const metrics = await page.evaluate((isMobile) => {
            const doc = document.documentElement;
            const body = document.body;
            const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
            const clientWidth = doc.clientWidth;
            const hasHorizontalOverflow = scrollWidth > clientWidth + 1;

            // Text clipping check
            const textNodes = Array.from(document.querySelectorAll("h1, h2, h3, h4, p, span, td, th, label, a, button"));
            const clipped = [];
            for (const el of textNodes) {
              if (!el.offsetParent) continue;
              const s = window.getComputedStyle(el);
              if (s.overflow === "hidden" && s.textOverflow !== "ellipsis") {
                if (el.scrollWidth > el.clientWidth + 4) {
                  clipped.push({
                    tag: el.tagName,
                    text: (el.innerText || "").slice(0, 30),
                    diff: el.scrollWidth - el.clientWidth
                  });
                }
              }
            }

            // Small touch targets (<48px for mobile/tablet per prompt rubric)
            const smallTargets = [];
            if (isMobile) {
              const interactives = Array.from(document.querySelectorAll("button, a, input, select, [role='button'], [role='tab']"));
              for (const el of interactives) {
                if (!el.offsetParent) continue;
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  if (rect.width < 44 || rect.height < 44) {
                    smallTargets.push({
                      tag: el.tagName,
                      text: (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 30),
                      w: Math.round(rect.width),
                      h: Math.round(rect.height)
                    });
                  }
                }
              }
            }

            // Check hardcoded colors / non-variable CSS
            return {
              scrollWidth,
              clientWidth,
              hasHorizontalOverflow,
              clippedCount: clipped.length,
              clippedExamples: clipped.slice(0, 3),
              smallTargetCount: smallTargets.length,
              smallTargetExamples: smallTargets.slice(0, 4)
            };
          }, vp.isMobile);

          screenResult.viewports[vp.id][theme] = metrics;
        }
      }

      console.log(`  Status: ${screenResult.httpStatus}, NotFound: ${screenResult.notFoundOrRefusal}`);
      if (screenResult.notFoundOrRefusal) {
        console.log(`  H1: ${notFoundInfo.h1} | Text: ${screenResult.notFoundMessage}`);
      }
      for (const vp of VIEWPORTS) {
        const mLight = screenResult.viewports[vp.id]["light"];
        console.log(`  ${vp.id} [light]: overflow=${mLight.hasHorizontalOverflow} (scroll: ${mLight.scrollWidth} / client: ${mLight.clientWidth}), clipped=${mLight.clippedCount}, smallTargets=${mLight.smallTargetCount}`);
      }

    } catch (e) {
      console.error(`  Error auditing ${screen.name}:`, e.message);
      screenResult.error = e.message;
    }

    results.push(screenResult);
  }

  await browser.close();
  console.log("\nFinished audit. Summary written to memory.");
}

main().catch(err => {
  console.error("Fatal audit runner error:", err);
  process.exit(1);
});

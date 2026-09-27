// Usage (from the repository root): node docs/ward-flow/mockups/third-edition-kit/check.mjs <file.html> <fontcss:platinum|premium>
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
const file = process.argv[2],
  css = process.argv[3] || "platinum";
// The Cloud sandbox keeps Chromium at /opt/pw-browsers/chromium. Anywhere else (a Windows or
// macOS checkout) that path does not exist, so the launch falls back to the Chromium Playwright
// installed for itself. WARD_FLOW_CHROMIUM names another executable explicitly.
const launchOptions = () => {
  const exe = process.env.WARD_FLOW_CHROMIUM || "/opt/pw-browsers/chromium";
  return fs.existsSync(exe) ? { executablePath: exe } : {};
};
const b = await chromium.launch(launchOptions());
// Font fixtures are optional and are resolved beside this script rather than from the
// caller's working directory. When a fixture is absent the request goes to the network
// instead of throwing, so the harness runs from a fresh checkout.
const kitDir = path.dirname(fileURLToPath(import.meta.url));
const fontDir = process.env.WARD_FLOW_FONT_DIR || path.join(kitDir, "fonts");
let stubbedFonts = null;
const fontFixture = (name) => {
  try {
    return fs.readFileSync(path.join(fontDir, name));
  } catch {
    return null;
  }
};
const route = async (p) => {
  await p.route(/fonts\.googleapis\.com/, (r) => {
    const body = fontFixture(`${css}.css`);
    if (stubbedFonts === null) stubbedFonts = body !== null;
    return body ? r.fulfill({ contentType: "text/css", body }) : r.continue();
  });
  await p.route(/fonts\.gstatic\.com/, (r) => {
    const body = fontFixture(path.basename(new URL(r.request().url()).pathname));
    return body ? r.fulfill({ contentType: "font/woff2", body }) : r.continue();
  });
};
const audit = () => {
  const lum = (c) => {
    const m = c.match(/[\d.]+/g);
    if (!m) return null;
    const [r, g, bb] = m
      .slice(0, 3)
      .map(Number)
      .map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bb;
  };
  const alpha = (c) => {
    const m = c.match(/[\d.]+/g);
    return m && m[3] !== undefined ? +m[3] : m ? 1 : 0;
  };
  const bgOf = (el) => {
    let e = el;
    while (e && e !== document.documentElement) {
      const cs = getComputedStyle(e);
      if (alpha(cs.backgroundColor) > 0.9) return cs.backgroundColor;
      e = e.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  };
  // Every visible text element on the page, reached by scrolling the window and every scrolling
  // region in viewport-height steps, so a row below the fold counts. The first cut sampled only
  // what the first window showed. SVG text is still skipped: its fill sits on a drawn node, not a
  // CSS background, and is reported by count so nobody reads the sweep as covering it.
  const seen = new Set();
  const scrollers = [document.scrollingElement, ...document.querySelectorAll("*")].filter(
    (el) =>
      el &&
      el.clientHeight >= 40 &&
      el.scrollHeight > el.clientHeight + 1 &&
      /(auto|scroll)/.test(getComputedStyle(el).overflowY),
  );
  const visibleText = () =>
    [...document.querySelectorAll("body *")].filter((e) => {
      if (seen.has(e) || e.closest("svg")) return false;
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.9) return false;
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) return false;
      return [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    });
  const els = [];
  let steps = 0;
  for (const sc of scrollers) {
    const max = sc.scrollHeight - sc.clientHeight;
    for (let y = 0; y <= max; y += Math.max(sc.clientHeight, 1)) {
      sc.scrollTop = y;
      steps++;
      for (const e of visibleText()) {
        seen.add(e);
        els.push(e);
      }
    }
    sc.scrollTop = 0;
  }
  if (!scrollers.length) for (const e of visibleText()) els.push(e);
  const svgTextCount = document.querySelectorAll("svg text").length;
  let low = [],
    minFont = 99,
    n = 0,
    small = [];
  for (const e of els) {
    const cs = getComputedStyle(e);
    const size = parseFloat(cs.fontSize);
    if (size < minFont) minFont = size;
    if (size < 12) small.push([e.className || e.tagName, size]);
    const bold = +cs.fontWeight >= 700;
    // WCAG large text is 18pt regular or 14pt bold: 24px, or 56/3 px at 700 and above. The first
    // cut used the point figures as pixels and relaxed the floor for text it should have held.
    const large = size >= 24 || (size >= 56 / 3 && bold);
    const a = lum(cs.color),
      c = lum(bgOf(e));
    if (a == null || c == null) continue;
    n++;
    const r = (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
    const need = large ? 3 : 4.5;
    if (r < need) low.push([e.className || e.tagName, +r.toFixed(2), size, e.textContent.trim().slice(0, 30)]);
  }
  const svgT = [...document.querySelectorAll("svg text")].map((t) => parseFloat(getComputedStyle(t).fontSize));
  const minSvg = svgT.length ? Math.min(...svgT) : null;
  const diag = document.getElementById("diagWrap") || document.querySelector(".diagWrap");
  const fonts = [...document.fonts]
    .filter((f) => f.status === "loaded")
    .map((f) => f.family)
    .filter((v, i, a) => a.indexOf(v) === i);
  const weights = [
    ...new Set(
      [...document.querySelectorAll("body *")].map(
        (e) => getComputedStyle(e).fontFamily.split(",")[0].replace(/"/g, "") + " " + getComputedStyle(e).fontWeight,
      ),
    ),
  ].filter((w) => /Geist (100|200|300|800|900)|Geist Mono (100|200|300|700|800|900)/.test(w));
  return {
    fonts,
    badWeights: weights,
    isCommand: /Ward Flow Command/i.test(document.title),
    reconcile: Array.isArray(window.__commandCheck) ? window.__commandCheck.length : "absent",
    ovx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    minFont,
    minSvg,
    sampled: n,
    steps,
    svgTextCount,
    lowCount: low.length,
    low: low.slice(0, 10),
    small: small.slice(0, 10),
    diagH: diag ? diag.clientHeight : null,
    diagOvx: diag ? diag.scrollWidth - diag.clientWidth : null,
  };
};
let ok = true;
const say = (k, pass, detail) => {
  ok = ok && pass;
  console.log((pass ? "PASS" : "FAIL") + "  " + k + (detail ? "  " + detail : ""));
};
for (const scheme of ["light", "dark"]) {
  for (const vp of [
    [1920, 1080],
    [1600, 1000],
    [1440, 900],
    [1280, 800],
    [1200, 900],
    [1100, 800],
    [390, 844],
    [320, 568],
  ]) {
    const p = await b.newPage({
      viewport: { width: vp[0], height: vp[1] },
      colorScheme: scheme,
      isMobile: vp[0] < 500,
    });
    await route(p);
    const errs = [];
    p.on("pageerror", (e) => errs.push(String(e)));
    await p.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(600);
    const r = await p.evaluate(audit);
    const tag = `${scheme} ${vp[0]}x${vp[1]}`;
    if (vp[0] === 1920) {
      say(`fonts ${tag}`, r.fonts.length >= 2, r.fonts.join(", "));
      say(`weights ${tag}`, r.badWeights.length === 0, r.badWeights.join(", ") || "all loaded");
    }
    say(`errors ${tag}`, errs.length === 0, errs.join(" | "));
    if (r.isCommand) say(`reconcile ${tag}`, r.reconcile === 0, String(r.reconcile));
    else say(`reconcile ${tag}`, r.reconcile === "absent", `not a Command page (${r.reconcile})`);
    say(`overflow ${tag}`, r.ovx === 0, r.ovx + "px");
    {
      say(
        `typefloor ${tag}`,
        r.minFont >= 12 && (r.minSvg === null || r.minSvg >= 10.5),
        `min ${r.minFont}px html, ${r.minSvg}px svg` + (r.small.length ? " small: " + JSON.stringify(r.small) : ""),
      );
      say(
        `contrast ${tag}`,
        r.lowCount === 0,
        `${r.lowCount} low of ${r.sampled} in ${r.steps} scroll steps, ${r.svgTextCount} svg text nodes not sampled` +
          (r.low.length ? " " + JSON.stringify(r.low) : ""),
      );
    }
    if (vp[0] === 1440 && r.isCommand)
      say(`diagram ${tag}`, (r.diagH || 0) >= 260, `${r.diagH}px tall, sideways overflow ${r.diagOvx}px`);
    await p.close();
  }
}
// appearance control: first click from a dark machine
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, colorScheme: "dark" });
await route(p);
await p.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: "load" });
await p.waitForTimeout(500);
const bg0 = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
let btn = (await p.$(".apBtn >> text=Light")) || (await p.$("#themeToggle"));
// A page whose appearance control lives in the Tools drawer (build sheet 9.6) shows no .apBtn
// until the drawer is open, so open it first rather than time out, as check-preview.mjs does.
if (!(btn && (await btn.isVisible())) && (await p.$("#toolsMenu summary"))) {
  await p.click("#toolsMenu summary");
  await p.waitForTimeout(300);
  btn = await p.$(".apBtn >> text=Light");
  if (btn) await btn.scrollIntoViewIfNeeded();
}
if (btn) {
  await btn.click();
  await p.waitForTimeout(300);
  const bg1 = await p.evaluate(() => [
    getComputedStyle(document.body).backgroundColor,
    document.documentElement.getAttribute("data-theme"),
  ]);
  say("appearance first click", bg1[0] !== bg0 && bg1[1] === "light", `${bg0} -> ${bg1[0]} data-theme=${bg1[1]}`);
} else say("appearance control present", false, "no .apBtn or #themeToggle");
await p.keyboard.press("Tab");
await p.keyboard.press("Tab");
await p.keyboard.press("Tab");
const f = await p.evaluate(() => {
  const e = document.activeElement;
  const cs = getComputedStyle(e);
  return { cls: e.className, ring: cs.boxShadow !== "none" || cs.outlineStyle !== "none" };
});
say("keyboard focus ring", f.ring, f.cls);
await p.close();
await b.close();
console.log(stubbedFonts ? `fonts stubbed from ${fontDir}` : "fonts loaded from the network (no local fixtures)");
console.log(ok ? "ALL GREEN" : "SOME CHECKS FAILED");
process.exit(ok ? 0 : 1);

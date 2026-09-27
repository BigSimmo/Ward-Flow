// Enumerate every rendered font-size below 12px across the ward module, by BFS over internal links.
// Usage: node enumerate.mjs http://localhost:3290 <out.json>
import { createRequire } from "node:module";
const require = createRequire("D:/Repos/Database/.claude/worktrees/ward-flow-phase-5-resume-166ecb/package.json");
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("@playwright/test"));
}
import { writeFileSync } from "node:fs";

const base = process.argv[2];
const out = process.argv[3];
const seed = process.env.SEED
  ? process.env.SEED.split(",")
  : [
      "/mockups/ward-flow",
      "/mockups/ward-flow/network",
      "/mockups/ward-flow/delays",
      "/mockups/ward-flow/capacity",
      "/mockups/ward-flow/movements",
      "/mockups/ward-flow/governance",
      "/mockups/ward-flow/statistics",
      "/mockups/ward-flow/wards",
      "/mockups/ward-flow/community",
      "/mockups/ward-flow/ward/rph-adult-secure",
      "/mockups/ward-flow/board/rph-adult-secure",
      "/mockups/ward-flow/transport/officer",
      "/mockups/ward-flow/ed/peel-ed",
      "/mockups/ward-flow/handover",
      "/mockups/ward-flow/search",
      "/mockups/ward-flow/hub",
      "/mockups/ward-flow/discharges",
      "/mockups/ward-flow/referrals",
      "/mockups/ward-flow/referrals/new",
      "/mockups/ward-flow/out-of-area",
      "/mockups/ward-flow/statistics/overview",
      "/mockups/ward-flow/statistics/compare",
      "/mockups/ward-flow/statistics/ed/peel-ed",
      "/mockups/ward-flow/statistics/ward/rph-adult-secure",
      "/mockups/ward-flow/constellation",
      "/mockups/ward-flow/escalation",
      "/mockups/ward-flow/exceptions",
      "/mockups/ward-flow/morning",
      "/mockups/ward-flow/queue",
      "/mockups/ward-flow/transport",
      "/mockups/ward-flow/people/new",
    ];

const enumerate = () => {
  const agg = new Map();
  const links = new Set();
  let min = 99;
  for (const el of document.body.querySelectorAll("*")) {
    if (el.tagName === "A") {
      const h = el.getAttribute("href");
      if (h && h.startsWith("/mockups/ward-flow")) links.add(h.split("#")[0].split("?")[0]);
    }
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    let t = "";
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.textContent;
    t = t.replace(/\s+/g, " ").trim();
    if (!t) continue;
    const px = parseFloat(cs.fontSize);
    if (!(px < 12)) continue;
    if (px < min) min = px;
    const r = el.getBoundingClientRect();
    const zero = r.width < 1 || r.height < 1;
    const sr =
      cs.clip === "rect(0px, 0px, 0px, 0px)" ||
      cs.clipPath === "inset(50%)" ||
      (r.width <= 1 && r.height <= 1 && cs.overflow === "hidden");
    const L = t.replace(/[^A-Za-z]/g, "");
    const up = cs.textTransform === "uppercase" || (L.length >= 3 && L === L.toUpperCase());
    const cn = el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className;
    const cls = String(cn || "")
      .replace(/-module__[A-Za-z0-9_-]+?__/g, ".")
      .slice(0, 70);
    const k = [
      el.tagName.toLowerCase(),
      cls,
      px,
      up ? "U" : "",
      sr ? "SR" : "",
      zero ? "Z" : "",
      el.closest("svg") ? "SVG" : "",
    ].join("|");
    const e = agg.get(k);
    if (e) {
      e.n++;
      if (e.s.length < 3) e.s.push(t.slice(0, 40));
    } else agg.set(k, { k, n: 1, s: [t.slice(0, 40)] });
  }
  return {
    items: [...agg.values()],
    links: [...links],
    min: min === 99 ? null : min,
    vw: innerWidth,
    title: document.title,
    path: location.pathname,
  };
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
const seen = new Set(seed);
const seenFam = new Set([
  "/mockups/ward-flow/ward/:id",
  "/mockups/ward-flow/board/:id",
  "/mockups/ward-flow/ed/:id",
  "/mockups/ward-flow/statistics/ed/:id",
  "/mockups/ward-flow/statistics/ward/:id",
]);
const queue = [...seed];
const results = {};
let visited = 0;
while (queue.length && visited < 60) {
  const p = queue.shift();
  visited++;
  try {
    await page.goto(base + p, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(800);
    const r = await page.evaluate(enumerate);
    for (const l of r.links) {
      if (process.env.SEED || seen.has(l)) continue;
      const fam = l
        .replace(/\/(WF|PT|RF|AD)-[A-Za-z0-9-]+$/, "/:id")
        .replace(/\/(ward|board|ed|community|service|people|movements)\/[^/]+$/, "/$1/:id");
      if (fam !== l) {
        if (seenFam.has(fam)) {
          seen.add(l);
          continue;
        }
        seenFam.add(fam);
      }
      seen.add(l);
      queue.push(l);
    }
    results[p] = r;
    console.error(`${p}  groups=${r.items.length} min=${r.min} final=${r.path}`);
  } catch (e) {
    results[p] = { error: String(e).slice(0, 200) };
    console.error(`${p}  ERROR ${String(e).slice(0, 80)}`);
  }
}
await browser.close();
writeFileSync(out, JSON.stringify({ base, viewport: 1600, when: new Date().toISOString(), results }, null, 1));
console.error(`done: ${Object.keys(results).length} routes, ${queue.length} left in queue`);

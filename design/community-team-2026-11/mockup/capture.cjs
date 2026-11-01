// Renders the real Midland community page from the local app, rebuilds it with transform.js,
// and saves one self-contained HTML file. Also pulls the ward page's CSS so ward classes render.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const dir = __dirname;
const BASE = "http://localhost:3377";

async function collectCss(p) {
  return p.evaluate(() => {
    const parts = [];
    const walk = (rules, acc) => {
      for (const r of rules) {
        if (r instanceof CSSMediaRule) {
          const t = r.conditionText || r.media.mediaText;
          if (/width|height|orientation|aspect/.test(t)) {
            if (matchMedia(t).matches) walk(r.cssRules, acc);
          } else {
            const inner = [];
            walk(r.cssRules, inner);
            acc.push(`@media ${t}{${inner.join("\n")}}`);
          }
        } else if (r.cssRules && !(r instanceof CSSStyleRule) && r.cssRules.length) {
          const pre = r.cssText.slice(0, r.cssText.indexOf("{"));
          const inner = [];
          walk(r.cssRules, inner);
          acc.push(`${pre}{${inner.join("\n")}}`);
        } else acc.push(r.cssText);
      }
    };
    for (const s of document.styleSheets) {
      try { walk(s.cssRules, parts); } catch (e) {}
    }
    return parts.join("\n");
  });
}

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: process.env.SCHEME || "light" });
  // 1. Ward page: CSS and a few fragments.
  const w = await ctx.newPage();
  await w.goto(`${BASE}/ward-flow/ward/rph-adult-secure`, { waitUntil: "networkidle", timeout: 240000 });
  await w.waitForSelector("nav.ward_tabBarWrap__dNWCB", { timeout: 120000 });
  await w.waitForTimeout(1500);
  const wardCss = await collectCss(w);
  const W = await w.evaluate(() => {
    const g = (t) => document.querySelector(`svg[data-wf-glyph="${t}"]`)?.outerHTML || "";
    const sw = document.querySelector("[data-testid=ward-switch-btn]");
    const live = document.querySelector(".live_group__fUtHC");
    const heroWarn = document.querySelector(".hero_label__lDwwB svg:last-child");
    return {
      glyph: { danger: g("danger"), warning: g("warning"), success: g("success"), neutral: g("neutral"), info: g("info") },
      switchCls: sw ? sw.className : "",
      live: live ? live.outerHTML : "",
      heroWarnSvg: heroWarn ? heroWarn.outerHTML : "",
    };
  });
  await w.close();
  // 2. Community page.
  const p = await ctx.newPage();
  await p.goto(`${BASE}/ward-flow/community/midland`, { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForSelector("section.hero_hero__6AGeu", { timeout: 120000 });
  await p.waitForTimeout(2500);
  const commCss = await collectCss(p);
  W.xIcon = await p.evaluate(() => document.querySelector("[data-testid=wf-checking-foot] svg")?.outerHTML || "");
  W.glyph.heroWarn = "";
  console.log("glyphs", Object.fromEntries(Object.entries(W.glyph).map(([k, v]) => [k, v.length])), "switch", W.switchCls, "live", W.live.length);
  await p.evaluate((W) => { window.__W = W; }, W);
  await p.evaluate(fs.readFileSync(path.join(dir, "transform.js"), "utf8"));
  let css = commCss + "\n" + wardCss;
  const out = await p.evaluate(async (css) => {
    const urls = [...new Set([...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((m) => m[1]))].filter((u) => !u.startsWith("data:") && !u.startsWith("#"));
    for (const u of urls) {
      try {
        const res = await fetch(new URL(u, location.href));
        const blob = await res.blob();
        const data = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });
        css = css.split(u).join(data);
      } catch (e) {}
    }
    document.querySelectorAll("script, link, noscript, style, nextjs-portal, next-route-announcer, template").forEach((e) => e.remove());
    return { css, html: document.documentElement.outerHTML, htmlAttrs: [...document.documentElement.attributes].map((a) => `${a.name}="${a.value}"`).join(" ") };
  }, css);
  const notes = fs.readFileSync(path.join(dir, "notes.html"), "utf8");
  const body = out.html.replace(/^<html[^>]*>/, "").replace(/<\/html>$/, "");
  const page = `<!doctype html>
<html ${out.htmlAttrs}>
<!-- Ward Flow mock-up: Midland community team page, rendered from the local app with synthetic data, then rebuilt. Not the live site. -->
${body
  .replace("<head>", () => `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Community team page</title><meta name="claude:viewport-fit-sides" content="cover"><style>${out.css}</style><style>${fs.readFileSync(path.join(dir, "mk.css"), "utf8")}</style>`)
  .replace("</body>", () => `${notes}<script>${fs.readFileSync(path.join(dir, "mk.js"), "utf8")}</script></body>`)}
</html>`;
  fs.writeFileSync(path.join(dir, "community-team-mockup.html"), page);
  console.log("bytes", page.length);
  await b.close();
})();

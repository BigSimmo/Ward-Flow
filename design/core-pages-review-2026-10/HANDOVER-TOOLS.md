# Redesign mock-ups: helper scripts

_Updated 2026-10-30 - the helper scripts, the build-notes script and the parallel helper brief, kept for a new chat; Design owns._

These lived in the session's scratch folder, which does not survive. Copy them into a scratch folder
(not the repository) and change the paths at the top of each. None of them is a repository script; none
touches a provider.

- `fork.py`: copies a screen file to `src/components/ward-redesign/` and turns its relative imports into
  `@/components/...` imports. Run from the repository root.
- `register.py`: adds a slug to `_preview/built-pages.ts` and `_preview/screen-components.tsx`. By default it
  also writes a `<slug>-page.tsx` wrapper with no props, which the registry's types need.
- `prune_imports.py`: removes imports ESLint reports as unused (use after splitting a fork in two).
- `snap.js`, `shot.sh`, `split.py`: full-page or viewport screenshots of a mock-up page, and splitting tall ones
  into parts for viewing. Use the default `node` with `NODE_PATH=$(npm root -g)` for Playwright.
- `qa.js`: a full-page shot plus a rough report of cut-off text, text under 12 px, small phone targets and
  content off the edge. The report is noisy; looking at the shot is the real check.
- `probe.js`: runs one JavaScript expression in a page and prints the result (finding class names and
  sizes before writing a scoped stylesheet).

### `fork.py`

```python
# usage: python3 fork.py <src relative to repo> <dest relative to repo>
import os, re, sys
root = "/home/user/Ward-Flow"
src, dest = sys.argv[1], sys.argv[2]
srcdir = os.path.dirname(src)
text = open(os.path.join(root, src)).read()
def absolute(m):
    q, rel = m.group(1), m.group(2)
    path = os.path.normpath(os.path.join(srcdir, rel))
    assert path.startswith("src/"), path
    return f'{q}@/{path[4:]}{q}'
text = re.sub(r'(?<=from )(["\'])(\.\.?/[^"\']+)\1', absolute, text)
text = re.sub(r'(?<=import\()(["\'])(\.\.?/[^"\']+)\1', absolute, text)
text = re.sub(r'(?<=^import )(["\'])(\.\.?/[^"\']+)\1', absolute, text, flags=re.M)
os.makedirs(os.path.dirname(os.path.join(root, dest)), exist_ok=True)
open(os.path.join(root, dest), "w").write(text)
print("forked", src, "->", dest, "remaining relative:", len(re.findall(r'["\']\.\.?/', text)))
```

### `register.py`

```python
# usage: python3 register.py <slug> <Component> <import path @/components/ward-redesign/...> [nowrap]
# Writes <dir>/<slug>-page.tsx wrapping the component with no props, and registers the wrapper.
import re, sys, os
slug, comp, path = sys.argv[1:4]
wrap = len(sys.argv) < 5
p = "/home/user/Ward-Flow/src/app/mockups/ward-flow-redesign/_preview/"
if wrap:
    d = os.path.dirname(path.replace("@/", "/home/user/Ward-Flow/src/"))
    page = "".join(w.capitalize() for w in slug.split("-")) + "Page"
    fname = f"{d}/{slug}-page.tsx"
    base = os.path.basename(path)
    open(fname, "w").write(f'''"use client";

import {{ {comp} }} from "./{base}";

/** The {slug.replace("-", " ")} mock-up as its app address opens, with nothing chosen. */
export function {page}() {{
  return <{comp} />;
}}
''')
    comp, path = page, os.path.dirname(path) + f"/{slug}-page"
s = open(p + "built-pages.ts").read()
if f'"{slug}"' not in s:
    s = s.replace("] as const;", f', "{slug}"] as const;').replace(",\n,", ",")
    open(p + "built-pages.ts", "w").write(s)
s = open(p + "screen-components.tsx").read()
key = slug if re.fullmatch(r"[a-z]+", slug) else f'"{slug}"'
s = re.sub(r"\n  " + re.escape(key) + r": \w+,", "", s)
s = re.sub(r'import \{ \w+ \} from "' + re.escape(path.rsplit("/", 1)[0]) + r'/[^"]+";\n', "", s) if False else s
s = s.replace("} satisfies Record", f"  {key}: {comp},\n}} satisfies Record")
if f"import {{ {comp} }}" not in s:
    s = s.replace('\nimport type { BuiltPageSlug }', f'import {{ {comp} }} from "{path}";\n\nimport type {{ BuiltPageSlug }}', 1)
open(p + "screen-components.tsx", "w").write(s)
print("registered", slug, comp, path)
```

### `prune_imports.py`

```python
# usage: python3 prune_imports.py <file>  -- removes unused named imports reported by eslint (no-unused-vars)
import json, re, subprocess, sys, os
f = sys.argv[1]
env = dict(os.environ, PATH="/opt/node24/bin:" + os.environ["PATH"])
out = subprocess.run(["npx", "eslint", "-f", "json", f], cwd="/home/user/Ward-Flow", capture_output=True, text=True, env=env).stdout
msgs = json.loads(out)[0]["messages"]
unused = set()
for m in msgs:
    if m.get("ruleId") == "@typescript-eslint/no-unused-vars":
        g = re.match(r"'([^']+)' is defined but never used", m["message"])
        if g: unused.add(g.group(1))
src = open(f).read()
def fix(block):
    m = re.match(r"(import\s+(type\s+)?)\{([^}]*)\}(\s+from\s+\"[^\"]+\";)", block, re.S)
    if not m:
        m2 = re.match(r"import\s+(\w+)\s+from\s+\"[^\"]+\";", block)
        if m2 and m2.group(1) in unused: return ""
        return block
    names = [n.strip() for n in m.group(3).split(",") if n.strip()]
    keep = [n for n in names if re.sub(r"^type\s+", "", n).split(" as ")[-1].strip() not in unused]
    if not keep: return ""
    return m.group(1) + "{ " + ", ".join(keep) + " }" + m.group(4)
new = re.sub(r"import\s+(?:type\s+)?(?:\{[^}]*\}|\w+)\s+from\s+\"[^\"]+\";\n?", lambda mm: (fix(mm.group(0).rstrip("\n")) + "\n") if fix(mm.group(0).rstrip("\n")) else "", src)
open(f, "w").write(new)
print("removed", sorted(unused))
```

### `snap.js`

```js
// usage: node snap.js <url> <out.png> <width> [fullPage]
const { chromium } = require("playwright");
(async () => {
  const [, , url, out, w = "1440", full = "1"] = process.argv;
  const width = +w;
  const b = await chromium.launch();
  const ctx = await b.newContext({
    viewport: { width, height: width <= 430 ? 844 : width <= 800 ? 1024 : 900 },
    isMobile: width <= 430,
    hasTouch: width <= 800,
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror " + e.message.slice(0, 3000)));
  p.on("console", (m) => {
    if (m.type() === "error") errs.push("console " + m.text().slice(0, 3000));
  });
  await p.goto(url, { waitUntil: "networkidle", timeout: 180000 });
  await p
    .waitForFunction(() => (document.querySelector("main")?.innerText || "").length > 40, null, { timeout: 90000 })
    .catch(() => console.log("WARN main empty"));
  await p.waitForTimeout(1500);
  if (full === "1")
    await p.evaluate(() => {
      for (const el of document.querySelectorAll("*")) {
        const cs = getComputedStyle(el);
        if (
          (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
          el.scrollHeight > el.clientHeight + 40 &&
          el.clientWidth > innerWidth * 0.5
        ) {
          el.style.overflow = "visible";
          el.style.height = "auto";
          el.style.maxHeight = "none";
          let q = el.parentElement;
          while (q) {
            q.style.height = "auto";
            q.style.maxHeight = "none";
            q.style.overflow = "visible";
            q = q.parentElement;
          }
        }
      }
    });
  await p.waitForTimeout(300);
  await p.screenshot({ path: out, fullPage: full === "1" });
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log("ok", out, "h=" + (await p.evaluate(() => document.documentElement.scrollHeight)), "xover=" + ov);
  errs.slice(0, 8).forEach((e) => console.log(e));
  await b.close();
})();
```

### `shot.sh`

```bash
#!/bin/bash
# usage: shot.sh <slug[?query]> <name> <width> [full=0|1]
S=/tmp/claude-0/-home-user/2e381ac5-305a-55a1-8f9d-f16ae72cd209/scratchpad
export PATH=/usr/local/bin:/usr/bin:/bin
cd $S && NODE_PATH=$(npm root -g) timeout 240 node snap.js "http://localhost:3377/mockups/ward-flow-redesign/$1" "$S/out/$2-$3.png" "$3" "${4:-0}" | tail -4
```

### `split.py`

```python
import sys
from PIL import Image
for p in sys.argv[1:]:
    im=Image.open(p); W,H=im.size; step=1500 if W>500 else 1800
    n=(H+step-1)//step
    for i in range(n): im.crop((0,i*step,W,min(H,(i+1)*step))).save(p.replace('.png',f'.p{i}.png'))
    print(p.split('/')[-1],H,n)
```

### `qa.js`

```js
// usage: node qa.js <slug> <width> [theme]  -> full-page shot + report of clipped text, tiny text, small targets, off-screen
const { chromium } = require("playwright");
(async () => {
  const [, , slug, w, theme = "light"] = process.argv;
  const width = +w;
  const S = "/tmp/claude-0/-home-user/2e381ac5-305a-55a1-8f9d-f16ae72cd209/scratchpad";
  const b = await chromium.launch();
  const ctx = await b.newContext({
    viewport: { width, height: width <= 430 ? 844 : width <= 900 ? 1180 : 900 },
    isMobile: width <= 430,
    hasTouch: width <= 900,
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror " + e.message.slice(0, 300)));
  await p.goto(`http://localhost:3377/mockups/ward-flow-redesign/${slug}?theme=${theme}`, {
    waitUntil: "networkidle",
    timeout: 180000,
  });
  await p
    .waitForFunction(() => (document.querySelector("main")?.innerText || "").length > 40, null, { timeout: 90000 })
    .catch(() => errs.push("main empty"));
  await p.waitForTimeout(1500);
  const report = await p.evaluate((phone) => {
    const out = { clipped: [], tiny: [], small: [], off: [] };
    const vis = (e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return (
        r.width > 0 &&
        r.height > 0 &&
        cs.visibility !== "hidden" &&
        cs.display !== "none" &&
        !e.closest('[aria-hidden="true"],.sr-only,[hidden]')
      );
    };
    const label = (e) => (e.innerText || e.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 50);
    for (const e of document.querySelectorAll("main *, header *, nav *")) {
      if (!vis(e)) continue;
      const cs = getComputedStyle(e);
      const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (own && parseFloat(cs.fontSize) < 12 && cs.position !== "absolute")
        out.tiny.push(cs.fontSize + " " + label(e));
      if (
        own &&
        (cs.textOverflow === "ellipsis" || cs.overflow === "hidden" || cs.webkitLineClamp !== "none") &&
        (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2) &&
        e.clientWidth > 0
      )
        out.clipped.push(label(e));
      const r = e.getBoundingClientRect();
      if (
        r.right > innerWidth + 1 &&
        r.width < innerWidth &&
        !e.closest('[style*="overflow"], [class*="scroll"], [class*="Scroll"]')
      ) {
        let q = e.parentElement,
          inScroller = false;
        while (q) {
          const s = getComputedStyle(q);
          if (/(auto|scroll|hidden)/.test(s.overflowX) && q.scrollWidth > q.clientWidth) {
            inScroller = true;
            break;
          }
          q = q.parentElement;
        }
        if (!inScroller) out.off.push(Math.round(r.right) + " " + e.tagName + " " + label(e));
      }
      if (
        phone &&
        (e.tagName === "BUTTON" || e.tagName === "A" || e.getAttribute("role") === "button") &&
        (r.height < 44 || r.width < 32) &&
        label(e)
      )
        out.small.push(Math.round(r.width) + "x" + Math.round(r.height) + " " + label(e));
    }
    for (const k of Object.keys(out)) out[k] = [...new Set(out[k])].slice(0, 25);
    return out;
  }, width <= 430);
  await p.evaluate(() => {
    for (const el of document.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      if (
        (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight + 40 &&
        el.clientWidth > innerWidth * 0.5
      ) {
        el.style.overflow = "visible";
        el.style.height = "auto";
        el.style.maxHeight = "none";
        let q = el.parentElement;
        while (q) {
          q.style.height = "auto";
          q.style.maxHeight = "none";
          q.style.overflow = "visible";
          q = q.parentElement;
        }
      }
    }
  });
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${S}/qa/${slug}-${width}-${theme}.png`, fullPage: true });
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  console.log(
    `== ${slug} ${width} ${theme} h=${h} xover=${await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)}`,
  );
  for (const [k, v] of Object.entries(report)) if (v.length) console.log(" " + k + ": " + v.join(" | "));
  errs.forEach((e) => console.log(" ERR " + e));
  await b.close();
})();
```

### `today-capture.js`

Pictures of today's app for the viewer's Today switch. One browser, widths 1440, 1280, 820 and 390,
light, full page, JPEG. Write them into `output/redesign-preview/today/` (not committed) and publish
them with the shareable copy's `files` map.

```bash
mkdir -p output/redesign-preview/today
node today-capture.js output/redesign-preview/today home=/ward-flow capacity=/ward-flow/capacity movements=/ward-flow/movements waiting=/ward-flow/waiting eds=/ward-flow/ed referrals=/ward-flow/referrals handover=/ward-flow/handover ward=/ward-flow/ward/rph-adult-secure stays=/ward-flow/board/rph-adult-secure ed-board=/ward-flow/ed/peel-ed transport=/ward-flow/transport/officer patients=/ward-flow/search discharges=/ward-flow/discharges wards=/ward-flow/wards statistics=/ward-flow/statistics alerts=/ward-flow/alerts legal-forms=/ward-flow/legal-forms out-of-area=/ward-flow/out-of-area on-call=/ward-flow/on-call seclusion=/ward-flow/seclusion governance=/ward-flow/governance places=/ward-flow/hub community=/ward-flow/community patient=/ward-flow/people/196zcp24w5t0 add-patient=/ward-flow/people/new settings=/ward-flow/settings sign-in=/ward-flow-sign-in statistics-compare=/ward-flow/statistics/compare statistics-list=/ward-flow/statistics/wards statistics-weekly=/ward-flow/statistics/weekly new-referral=/ward-flow/referrals/new bed-meeting-tv=/ward-flow/bed-meeting agenda=/ward-flow/bed-meeting/agenda downtime=/ward-flow/reports/downtime chronology=/ward-flow/reports/chronology community-team=/ward-flow/community/midland ward-answer=/ward-flow/ward/rph-adult-secure/answer statistics-unit=/ward-flow/statistics/ward/fsh-adult-secure
```

```js
// usage: node today-capture.js <outDir> <slug=appPath>... ; widths 1440 1280 820 390, light, full page, JPEG.
// Visits one mock-up first so the same origin marks the tour, What's new and hints as seen (coordinator desk).
const { chromium } = require("playwright");
const BASE = "http://localhost:3377";
const WIDTHS = (process.env.WIDTHS || "1440 1280 820 390").split(" ").map(Number);
(async () => {
  const [, , outDir, ...pairs] = process.argv;
  const b = await chromium.launch();
  for (const width of WIDTHS) {
    const ctx = await b.newContext({
      viewport: { width, height: width <= 430 ? 844 : width <= 820 ? 1180 : 900 },
      isMobile: width <= 430,
      hasTouch: width <= 820,
      colorScheme: "light",
    });
    const p = await ctx.newPage();
    await p
      .goto(BASE + "/mockups/ward-flow-redesign/home", { waitUntil: "networkidle", timeout: 300000 })
      .catch(() => {});
    await p.waitForTimeout(3000);
    for (const pair of pairs) {
      const [slug, path] = pair.split("=");
      const out = `${outDir}/${slug}-${width}.jpg`;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await p.goto(BASE + path, { waitUntil: "networkidle", timeout: 300000 });
          await p.waitForFunction(
            () => (document.querySelector("main")?.innerText || document.body.innerText || "").length > 40,
            null,
            { timeout: 90000 },
          );
          await p.waitForTimeout(1500);
          await p.evaluate(() => {
            for (const el of document.querySelectorAll("*")) {
              const cs = getComputedStyle(el);
              if (
                (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
                el.scrollHeight > el.clientHeight + 40 &&
                el.clientWidth > innerWidth * 0.5
              ) {
                for (let q = el; q; q = q.parentElement) {
                  q.style.height = "auto";
                  q.style.maxHeight = "none";
                  q.style.overflow = "visible";
                }
              }
            }
          });
          await p.waitForTimeout(300);
          await p.screenshot({ path: out, fullPage: true, type: "jpeg", quality: 72 });
          console.log("ok", out);
          break;
        } catch (e) {
          console.log("retry", attempt, slug, width, String(e).slice(0, 120));
          await p.waitForTimeout(30000);
        }
      }
    }
    await ctx.close();
  }
  await b.close();
})();
```

### `probe.js`

```js
const { chromium } = require("playwright");
(async () => {
  const [, , url, js, w = "1440"] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: 900 } });
  await p.goto(url, { waitUntil: "networkidle", timeout: 180000 });
  await p.waitForTimeout(1500);
  console.log(await p.evaluate(js));
  await b.close();
})();
```

### `add_notes.py`

Adds build notes for several slugs at once from a JSON file of `{slug: [notes]}`.

```python
# usage: python3 add_notes.py <notes.json>  -- inserts {slug: [notes]} before the first existing entry
import json, sys
f = "/home/user/Ward-Flow/src/app/mockups/ward-flow-redesign/_preview/build-notes.ts"
notes = json.load(open(sys.argv[1]))
t = open(f).read()
anchor = "export const BUILD_NOTES: Readonly<Record<string, readonly string[]>> = {\n"
assert anchor in t
block = ""
for slug, lines in notes.items():
    key = slug if slug.isidentifier() else json.dumps(slug)
    assert f"\n  {key}: [" not in t, slug
    block += f"  {key}: [\n" + "".join(f"    {json.dumps(l, ensure_ascii=False)},\n" for l in lines) + "  ],\n"
t = t.replace(anchor, anchor + block, 1)
open(f, "w").write(t)
print("added", list(notes))
```

Copy the brief below into the scratch folder as `BRIEF.md`, replace `<scratch>` with that folder's
path, and point each helper at it. It was written for pages; for popups, change "page" to "popup", the
folder to `src/components/ward-redesign/pop-<name>/`, and say which page or shell control opens it.

### Helper brief (for parallel helper agents)

You are one of several helpers building React mock-ups in parallel in ONE shared checkout at
`/home/user/Ward-Flow` (branch `claude/core-pages-design-review-f5vf4g`). The coordinator commits and
pushes. Ward Flow is a psychiatric bed-flow prototype on 100% synthetic data.

#### Hard limits (break none)

- Edit ONLY files inside your own page folders: `src/components/ward-redesign/<slug>/` for the slugs
  you were given. Never edit anything else: not `_preview/*`, not `src/components/ward-management/*`
  (the real app, which must not change), not package files, not other helpers' folders.
- No git commands at all (no add, commit, stash, checkout, reset). No network, no providers.
- Never stop or restart processes you did not start, except: if `http://localhost:3377` is down, run
  `cd /home/user/Ward-Flow && PATH=/opt/node24/bin:$PATH npm run ensure` once.
- Synthetic data only. Do not invent figures: every number comes from the real app state.
- Do not change on-screen safeguard wording (legal, privacy, "not for clinical use", operational-only
  notices) and never compute legal deadlines or countdowns from recorded legal times (show times as typed).

#### How the mock-ups work

- Viewer: `http://localhost:3377/mockups/ward-flow-redesign/<slug>` (add `?theme=dark` for dark). It
  mounts the real `WardFlowProvider` (clock fixed at 10:42), the real rail and app bar, and draws the
  component registered for the slug. Each of your slugs is already registered to the export in
  `src/components/ward-redesign/<slug>/<slug>-page.tsx` (currently a placeholder). KEEP that file name
  and export name; make it render your redesigned page (with no props).
- Each slug's app address is in `src/app/mockups/ward-flow-redesign/_preview/screens.ts` (`appPath`).
  Find the real screen from `src/app/<appPath>/page.tsx` (dynamic segments are folders like
  `[unitId]`). Look at today's screen at `http://localhost:3377<appPath>`.
- The review notes for each slug (what is wrong, the fixes, what to keep) are in
  `src/app/mockups/ward-flow-redesign/_preview/review-notes.json` under the slug. Follow them.
- Owner rules beat the notes: surname first everywhere ("Surname, First": use the resolved patient's
  `formalName` instead of `displayName`, D-83); one filled (primary) button per row or panel; no empty
  panels (open on the first useful item); long lists (> ~8 rows) show the first rows then "Show more";
  text never under 12 px (use `--wf-fs-12` and up); phone controls at least 48 px tall at 390 px wide;
  real wiring (buttons keep working as in the app).

#### Building a page ("fork")

1. Copy the real screen file into your folder and turn its relative imports into `@/components/...`:
   `python3 <scratch>/fork.py <src rel to repo> <dest rel to repo>`
   (run from `/home/user/Ward-Flow`). Rename the export (e.g. `HubScreen` -> `HubRedesign`), then apply
   the design changes. Copy its CSS module too if you restyle it, and point the import at your copy.
   Comparing the fork with the original must show exactly the design change, so keep unrelated code as is.
2. Alternative for a screen that only needs light restyling: render the real screen inside a wrapper
   div with a scoped CSS module that overrides its classes with attribute selectors like
   `.scope [class*="_rowName__"] { ... }` (module class names keep `_name__` in them).
3. Your `<slug>-page.tsx` must render a page with a `<main id="main-content">` (most real screens
   already have one) and keep the synthetic-data footer the real screen shows
   (`WardPrototypeFooter` from `@/components/ward-management/shell/ward-prototype-footer`).
4. Do not export anything nothing imports (knip): only the `<slug>-page.tsx` export is imported from outside.
5. Files over 1,500 lines: allowed for forks (owner approved). If a file passes 1,500 lines, say so in
   your report with its path and line count; ignore only that one `max-lines` lint error.

#### Checks you must run (from /home/user/Ward-Flow, `export PATH=/opt/node24/bin:$PATH`)

- `npx prettier --write src/components/ward-redesign/<slug>`
- `npx eslint --max-warnings 0 src/components/ward-redesign/<slug>` (must be clean, except a max-lines note above)
- Typecheck only if you changed types heavily: `npm run typecheck` is slow and shared, so prefer
  relying on eslint plus the browser; the coordinator runs the full typecheck.
- Look at the page in a browser at 1440, 820 and 390 px, light, plus 1440 dark. Helper (uses the
  system Node and Playwright; run exactly like this):
  `cd <scratch> && PATH=/usr/local/bin:/usr/bin:/bin NODE_PATH=$(PATH=/usr/local/bin:/usr/bin:/bin npm root -g) timeout 250 node qa.js <slug> <width> [dark]`
  It writes `qa/<slug>-<width>-<theme>.png` (full page) and prints a rough report (cut-off text, tiny
  text, small phone targets, off-screen). Ignore report lines about the app bar ("Board time",
  "Synthetic prototype", "Search", "Statewide", nav counts). View the PNG with the Read tool; tall
  shots can be split with `python3 split.py qa/<file>.png` (writes `.p0.png`, `.p1.png`...).
  Use your OWN filenames for any extra scripts (prefix with your slug) so helpers do not clash.
- Fix what looks wrong: overlaps, content under the phone dock, cut-off text, horizontal scroll.
- The dev server compiles on first load, so the first request can take a minute or return a 500 once;
  retry once before diagnosing.

#### Your final report (keep it short; it is all the coordinator sees)

For each slug:

- `files`: the files you created or changed (all inside your folders).
- `build_notes`: 3 to 6 short markdown strings in this house style (plain Australian English, no
  jargon), like: "**Built from a copy of today's X screen**, so A, B and C work as now.",
  "**New:** ...", "**Kept:** ...", "**Still open:** ..." (anything you could not do, or a question for Josh).
- `checked`: which widths/themes you looked at and anything left imperfect.
- Any file over 1,500 lines (path, count). Anything you were unsure about.

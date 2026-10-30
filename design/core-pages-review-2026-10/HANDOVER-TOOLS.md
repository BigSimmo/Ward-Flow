# Redesign mock-ups: helper scripts

_Updated 2026-10-30 - the helper scripts behind the React redesign mock-ups, kept for a new chat; Design owns._

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

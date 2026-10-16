// Usage (from the wardflow directory): node merged/shots.mjs <file.html> <outprefix> <fontcss>
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
const file = process.argv[2],
  out = process.argv[3] || "merged/shot",
  css = process.argv[4] || "platinum";
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
const shots = {};
for (const scheme of ["light", "dark"]) {
  for (const dsf of [1, 2]) {
    const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, colorScheme: scheme, deviceScaleFactor: dsf });
    await route(p);
    await p.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(600);
    const buf = await p.screenshot();
    fs.writeFileSync(`${out}-${scheme}@${dsf}x.png`, buf);
    if (dsf === 1) shots[scheme] = buf.toString("base64");
    await p.close();
  }
}
const q = await b.newPage({ viewport: { width: 1920, height: 100 } });
await q.setContent(
  `<style>body{margin:0;background:#0c0d0f;font:600 16px system-ui;color:#e8e8e8}.w{display:grid;gap:14px;padding:16px}.c{display:grid;gap:8px}.c span{padding:0 4px;font-weight:500;color:#aaa}img{width:100%;display:block;border-radius:8px}</style><div class="w"><div class="c"><span>Light</span><img src="data:image/png;base64,${shots.light}"></div><div class="c"><span>Dark</span><img src="data:image/png;base64,${shots.dark}"></div></div>`,
);
await q.waitForTimeout(300);
await q.screenshot({ path: `${out}-pair.png`, fullPage: true });
await q.close();
await b.close();
console.log("wrote", `${out}-{light,dark}@{1,2}x.png`, `${out}-pair.png`);

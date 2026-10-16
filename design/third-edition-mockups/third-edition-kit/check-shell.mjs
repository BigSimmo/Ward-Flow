// Usage (from the repository root): node docs/ward-flow/mockups/third-edition-kit/check-shell.mjs <command.html> <fontcss:platinum|premium>
//
// Drives the shell's behaviours in a real browser and fails on the ones a screenshot cannot show:
// Escape never clears the service, a search pick never widens it and offers the way back, a drawer
// is a dialog with inert surroundings and a Tab that wraps, a press on an unbuilt screen opens the
// live tally, the prototype mark is visible at every width, and the Activity line says snapshot.
// Each of these was a finding on 9 September 2026; this is the catcher for all of them.
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
const file = process.argv[2] || "docs/ward-flow/mockups/command-third-edition.html",
  css = process.argv[3] || "platinum";
const launchOptions = () => {
  const exe = process.env.WARD_FLOW_CHROMIUM || "/opt/pw-browsers/chromium";
  return fs.existsSync(exe) ? { executablePath: exe } : {};
};
const kitDir = path.dirname(fileURLToPath(import.meta.url));
const fontDir = process.env.WARD_FLOW_FONT_DIR || path.join(kitDir, "fonts");
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
    return body ? r.fulfill({ contentType: "text/css", body }) : r.continue();
  });
  await p.route(/fonts\.gstatic\.com/, (r) => {
    const body = fontFixture(path.basename(new URL(r.request().url()).pathname));
    return body ? r.fulfill({ contentType: "font/woff2", body }) : r.continue();
  });
};
let ok = true;
const say = (k, pass, detail) => {
  ok = ok && pass;
  console.log((pass ? "PASS" : "FAIL") + "  " + k + (detail ? "  " + detail : ""));
};
const b = await chromium.launch(launchOptions());
const url = pathToFileURL(path.resolve(file)).href;
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, colorScheme: "light" });
await route(p);
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
await p.goto(url, { waitUntil: "load" });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(500);
const filterBar = () => p.evaluate(() => (document.querySelector(".filterBar") || {}).textContent || "");
const live = () => p.evaluate(() => document.getElementById("live").textContent);

// 1. Choose a service.
await p.click("#svcMenu > summary");
await p.click('.menuItem[data-svc="south"]');
await p.waitForTimeout(150);
say("service chosen", /in South Metropolitan/.test(await filterBar()), (await filterBar()).trim().slice(0, 80));

// 2. Escape, many times, never clears it.
for (let i = 0; i < 10; i++) await p.keyboard.press("Escape");
await p.waitForTimeout(150);
const afterEsc = await filterBar();
say(
  "escape keeps the service",
  /in South Metropolitan/.test(afterEsc) && /Nothing more to clear/.test(await live()),
  (await live()).trim().slice(0, 110),
);

// 3. A person outside the service: the hit says so, the pick moves the service to theirs, the bar offers the way back.
await p.fill("#q", "Flint");
await p.waitForTimeout(200);
const hit = await p.evaluate(() => {
  const h = document.querySelector('.qHit[data-hit="patient"]');
  return h ? h.textContent : "";
});
say(
  "hit says the service will change",
  /Outside South Metropolitan\. Opens in East Metropolitan\./.test(hit),
  hit.trim().slice(0, 120),
);
await p.click('.qHit[data-hit="patient"]');
await p.waitForTimeout(200);
const afterPick = await filterBar();
say(
  "pick moves the service to the person's, never to all",
  /in East Metropolitan/.test(afterPick) && !/all services/.test(afterPick),
  afterPick.trim().slice(0, 100),
);
say(
  "the way back is offered",
  (await p.$("[data-restore-svc]")) !== null,
  await p.evaluate(() => (document.querySelector("[data-restore-svc]") || {}).textContent || "absent"),
);
say(
  "the pick is announced with the way back",
  /this person's service, from South Metropolitan/.test(await live()),
  (await live()).trim().slice(0, 160),
);
await p.click("[data-restore-svc]");
await p.waitForTimeout(150);
say(
  "restore returns to the previous service",
  /in South Metropolitan/.test(await filterBar()) && (await p.$("[data-restore-svc]")) === null,
  (await filterBar()).trim().slice(0, 80),
);

// 4. A drawer is a dialog: role, inert surroundings, Tab wraps, Escape restores focus and lifts inert.
await p.click("#activityMenu > summary");
await p.waitForTimeout(200);
const dlg = await p.evaluate(() => {
  const panel = document.querySelector("#activityMenu .menuPanel");
  return {
    role: panel.getAttribute("role"),
    modal: panel.getAttribute("aria-modal"),
    railInert: document.querySelector("nav.rail").hasAttribute("inert"),
    liveInert: document.getElementById("live").hasAttribute("inert"),
    focusInside: panel.contains(document.activeElement),
  };
});
say("drawer is a dialog", dlg.role === "dialog" && dlg.modal === "true", JSON.stringify(dlg));
say("surroundings are inert, the live region is not", dlg.railInert && !dlg.liveInert);
say("focus starts inside", dlg.focusInside);
let escaped = 0;
for (let i = 0; i < 40; i++) {
  await p.keyboard.press(i % 7 === 6 ? "Shift+Tab" : "Tab");
  const inside = await p.evaluate(() =>
    document.querySelector("#activityMenu .menuPanel").contains(document.activeElement),
  );
  if (!inside) escaped++;
}
say(
  "tab wraps inside the drawer",
  escaped === 0,
  escaped ? escaped + " presses left the drawer" : "40 presses stayed inside",
);
await p.keyboard.press("Escape");
await p.waitForTimeout(150);
const closed = await p.evaluate(() => ({
  open: document.getElementById("activityMenu").open,
  railInert: document.querySelector("nav.rail").hasAttribute("inert"),
  onSummary: document.activeElement === document.querySelector("#activityMenu > summary"),
}));
say(
  "escape closes it, lifts inert and returns focus",
  !closed.open && !closed.railInert && closed.onSummary,
  JSON.stringify(closed),
);

// 5. A press on an unbuilt screen opens the tally on its figures.
await p.click('.railLink[data-page="capacity"]');
await p.waitForTimeout(300);
const tally = await p.evaluate(() => {
  const d = document.getElementById("activityMenu");
  const part = d.querySelector('.part[data-part="tally"]');
  return { open: d.open, tallyShown: part && !part.hidden, live: document.getElementById("live").textContent };
});
say(
  "an unbuilt screen opens the live tally",
  tally.open &&
    tally.tallyShown &&
    /Capacity is not part of this prototype\. Its figures are in the live tally, now open\./.test(tally.live),
  tally.live.trim().slice(0, 120),
);
const head = await p.evaluate(() => (document.querySelector("#activityMenu .fresh") || {}).textContent || "");
say(
  "the activity line carries its own provenance, never live",
  /Invented figures, reconciled with each other, as at \d\d:\d\d/.test(head) && !/^Live/.test(head.trim()),
  head.trim().slice(0, 90),
);
await p.keyboard.press("Escape");
say("no page errors", errs.length === 0, errs.join(" | ") || "none");
await p.close();

// 6. The prototype mark is visible at every width the ladder names.
for (const w of [1920, 1440, 1280, 1200, 1100, 1000, 768, 390, 320]) {
  const q = await b.newPage({ viewport: { width: w, height: 900 }, colorScheme: "light", isMobile: w < 500 });
  await route(q);
  await q.goto(url, { waitUntil: "load" });
  await q.waitForTimeout(300);
  const m = await q.evaluate(() => {
    const el = document.querySelector(".hdr1 .chip.mark");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      text: el.textContent.trim(),
      ovx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  say(
    `prototype mark visible at ${w}`,
    !!m && m.w > 0 && m.h > 0 && m.ovx === 0,
    m ? `${m.w}x${m.h} "${m.text}", overflow ${m.ovx}px` : "no mark",
  );
  await q.close();
}
// 7. Words never shrink and never clip: every word in the closed strip fits, and no rail state line,
//    pressure card line or pinned name is clipped by its ellipsis at 1920 and at 1280.
for (const w of [1920, 1280]) {
  const q = await b.newPage({ viewport: { width: w, height: 900 }, colorScheme: "light" });
  await route(q);
  await q.goto(url, { waitUntil: "load" });
  await q.evaluate(() => document.fonts.ready);
  await q.waitForTimeout(300);
  const clipped = () =>
    q.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((e) => getComputedStyle(e).textOverflow === "ellipsis" && e.scrollWidth > e.clientWidth + 1)
        .map((e) => (e.className || e.tagName) + ": " + e.textContent.trim().slice(0, 40)),
    );
  const openClipped = await clipped();
  say(
    `nothing clipped with the rail open at ${w}`,
    openClipped.length === 0,
    openClipped.length ? JSON.stringify(openClipped.slice(0, 6)) : "none",
  );
  await q.keyboard.press("[");
  await q.waitForTimeout(400);
  const strip = await q.evaluate(() => {
    const rail = document.querySelector("nav.rail");
    const words = [...rail.querySelectorAll(".railLink .railText, .railLink .word, .railLink span")].filter(
      (el) => el.offsetParent !== null && el.textContent.trim().length > 0,
    );
    return {
      closed: rail.classList.contains("closed") || document.documentElement.getAttribute("data-rail") === "closed",
      railOvx: rail.scrollWidth - rail.clientWidth,
      width: rail.getBoundingClientRect().width,
      tooWide: words.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent.trim()),
    };
  });
  say(
    `closed strip words fit at ${w}`,
    strip.closed && strip.railOvx === 0 && strip.tooWide.length === 0,
    `${Math.round(strip.width)}px wide, sideways overflow ${strip.railOvx}px` +
      (strip.tooWide.length ? ", too wide: " + strip.tooWide.join(", ") : ""),
  );
  const closedClipped = await clipped();
  say(
    `nothing clipped with the rail closed at ${w}`,
    closedClipped.length === 0,
    closedClipped.length ? JSON.stringify(closedClipped.slice(0, 6)) : "none",
  );
  await q.keyboard.press("[");
  await q.close();
}
await b.close();
console.log(ok ? "ALL GREEN" : "SOME CHECKS FAILED");
process.exit(ok ? 0 : 1);

const { chromium } = require("playwright");
(async () => {
  const [,, scheme] = process.argv;
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: scheme || "light" });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + __dirname + "/community-team-mockup.html");
  await p.addStyleTag({content:".ward-flow-layout_shellContent__jg7kj,.ward-flow-layout_shellRow__YrZX5,.ward-shell_shell__Zu5ai{overflow:visible!important;height:auto!important;max-height:none!important}"});
  await p.click('[data-tab="referrals"]'); await p.waitForTimeout(200);
  await p.screenshot({ path: `r-panel-${scheme||"light"}.png`, fullPage: true });
  await p.click('.mk-detail:not([hidden]) .mk-docsLink'); await p.waitForTimeout(200);
  await p.screenshot({ path: `r-page-${scheme||"light"}.png`, fullPage: true });
  await p.click('[data-refpage="r1"] .mk-viewDoc'); await p.waitForTimeout(200); await p.screenshot({ path: `r-doc-${scheme||"light"}.png` }); await p.keyboard.press("Escape"); await p.click('[data-refpage="r1"] .mk-rpStep:not([disabled])'); await p.waitForTimeout(200);
  await p.click('[data-refpage="r2"] .mk-accept'); await p.waitForTimeout(200);
  await p.screenshot({ path: `r-page2-${scheme||"light"}.png`, fullPage: false });
  console.log("errors", errs);
  await b.close();
})();

const { chromium } = require("playwright");
(async () => {
  const [,, out, tab, scheme, w] = process.argv;
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const p = await b.newPage({ viewport: { width: +(w||1440), height: 900 }, colorScheme: scheme || "light" });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + __dirname + "/community-team-mockup.html");
  await p.addStyleTag({content:".ward-flow-layout_shellContent__jg7kj,.ward-flow-layout_shellRow__YrZX5,.ward-shell_shell__Zu5ai{overflow:visible!important;height:auto!important;max-height:none!important}"});await p.waitForTimeout(500);
  if (tab && tab !== "home") await p.click(`[data-tab="${tab}"]`);
  await p.waitForTimeout(200);
  await p.screenshot({ path: out, fullPage: true });
  console.log("errors", errs);
  await b.close();
})();

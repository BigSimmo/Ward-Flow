import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1360, height: 950 }, deviceScaleFactor: 2 });
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  await page.goto("http://127.0.0.1:4467/mockups/ward-flow/delays", { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Look for the buttons in viewSwitcherSeg
  const switcher = page.locator('[aria-label="Executive Overview Mode"]');
  console.log("Switcher count:", await switcher.count());

  const buttons = switcher.locator('button');
  console.log("Buttons in switcher count:", await buttons.count());
  // Click Action Runway
  console.log("Clicking Action Runway...");
  await page.getByRole('button', { name: 'Action Runway' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "public/screenshots/screenshot_delays_runway.png" });

  // Click Catchment Pressure
  console.log("Clicking Catchment Pressure...");
  await page.getByRole('button', { name: 'Catchment Pressure' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "public/screenshots/screenshot_delays_catchment.png" });

  // Click Crisis Radar
  console.log("Clicking Crisis Radar...");
  await page.getByRole('button', { name: 'Crisis Radar' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "public/screenshots/screenshot_delays_radar.png" });

  // Click Summary Cards
  console.log("Clicking Summary Cards...");
  await page.getByRole('button', { name: 'Summary Cards' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "public/screenshots/screenshot_delays_cards.png" });

  // Click Combined
  console.log("Clicking Combined...");
  await page.getByRole('button', { name: 'Combined' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "public/screenshots/screenshot_delays_combined.png" });

  // Click Tobias Wren to test patient inspection drawer
  console.log("Clicking patient Tobias Wren...");
  const wrenButton = page.locator('button:has-text("Wren, Tobias")').first();
  if (await wrenButton.count() > 0) {
    await wrenButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "public/screenshots/screenshot_delays_drawer.png" });
  }

  await browser.close();
  console.log("Done checking view switcher!");
}

main().catch(console.error);

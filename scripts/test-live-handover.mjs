import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function test() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  console.log('Navigating to handover page...');
  await page.goto('http://localhost:4467/mockups/ward-flow/handover', { waitUntil: 'networkidle', timeout: 60000 });
  console.log('Page loaded! Waiting for selector...');
  await page.waitForSelector('[data-testid="ward-handover-page"]', { timeout: 30000 });
  
  // Wait 1s for any transitions
  await page.waitForTimeout(1000);

  // Take screenshot of the flightdeck card
  const flightdeck = page.locator('[class*="commandHorizonCard"]');
  if (await flightdeck.count() > 0) {
    await flightdeck.first().screenshot({ path: 'public/screenshots/live-flightdeck-card.png' });
    console.log('Captured live-flightdeck-card.png');
  }

  await page.screenshot({ path: 'public/screenshots/live-handover-page.png' });
  console.log('Captured live-handover-page.png');
  
  // copy to artifact directory
  const artifactDir = 'C:/Users/joshs/.gemini/antigravity/brain/bd5ee870-daeb-4ff7-99d1-623d5fdcf3be';
  if (fs.existsSync('public/screenshots/live-flightdeck-card.png')) {
    fs.copyFileSync('public/screenshots/live-flightdeck-card.png', path.join(artifactDir, 'live-flightdeck-card.png'));
  }
  fs.copyFileSync('public/screenshots/live-handover-page.png', path.join(artifactDir, 'live-handover-page.png'));

  await browser.close();
  console.log('Done!');
}
test().catch(e => {
  console.error(e);
  process.exit(1);
});

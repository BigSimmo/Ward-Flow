import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function verifyLive() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  
  console.log('Navigating to http://localhost:4467/mockups/ward-flow/handover ...');
  await page.goto('http://localhost:4467/mockups/ward-flow/handover', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('[data-testid="ward-handover-page"]', { timeout: 30000 });
  await page.waitForTimeout(1000);

  // Check what headers exist on the page
  const hasOldTopBar = await page.locator('.topBarWrap').count();
  const hasOldHud = await page.locator('.topHudWrap').count();
  const hasCommandHorizon = await page.locator('[class*="commandHorizonCard"]').count();
  
  console.log('DOM check results:');
  console.log('- hasOldTopBar:', hasOldTopBar);
  console.log('- hasOldHud:', hasOldHud);
  console.log('- hasCommandHorizon:', hasCommandHorizon);

  // Take fresh full-page screenshot with unique timestamp name
  const screenshotName = 'handover-fullview-verified.png';
  await page.screenshot({ path: path.join('public/screenshots', screenshotName), fullPage: false });

  const artifactDir = 'C:/Users/joshs/.gemini/antigravity/brain/bd5ee870-daeb-4ff7-99d1-623d5fdcf3be';
  fs.copyFileSync(path.join('public/screenshots', screenshotName), path.join(artifactDir, screenshotName));
  console.log(`Saved fresh screenshot to ${screenshotName}`);

  await browser.close();
}

verifyLive().catch(err => {
  console.error(err);
  process.exit(1);
});

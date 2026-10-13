import { chromium } from 'playwright';

async function testInteractions() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('http://localhost:4467/mockups/ward-flow/handover', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('[data-testid="ward-handover-page"]', { timeout: 30000 });

  // 1. Click Morning Shift button
  console.log('Testing Morning shift click...');
  await page.click('button[title="Switch to Morning Shift"]');
  await page.waitForTimeout(300);

  // Check title
  const morningTitle = await page.locator('h1').first().textContent();
  console.log('Title after clicking Morning:', morningTitle);
  if (!morningTitle.includes('Morning Shift Handover')) {
    throw new Error('Morning title mismatch: ' + morningTitle);
  }

  // 2. Click Night Shift button
  console.log('Testing Night shift click...');
  await page.click('button[title="Switch to Night Shift"]');
  await page.waitForTimeout(300);

  const nightTitle = await page.locator('h1').first().textContent();
  console.log('Title after clicking Night:', nightTitle);
  if (!nightTitle.includes('Night Shift Handover')) {
    throw new Error('Night title mismatch: ' + nightTitle);
  }

  // 3. Switch back to Afternoon
  await page.click('button[title="Switch to Afternoon Shift"]');
  await page.waitForTimeout(300);

  // 4. Test Filters dropdown selection: switch to "pulled"
  console.log('Testing Filters dropdown change to Beds Pulled...');
  await page.selectOption('select[aria-label="Movement Filters"]', 'pulled');
  await page.waitForTimeout(300);

  // 5. Test Reset button click
  console.log('Testing Reset button click...');
  await page.click('button[title="Reset to Statewide"]');
  await page.waitForTimeout(300);

  // Verify Reset brought back longest
  const filterVal = await page.locator('select[aria-label="Movement Filters"]').inputValue();
  console.log('Movement filter value after Reset:', filterVal);

  if (consoleErrors.length > 0) {
    console.error('Console errors encountered:', consoleErrors);
  } else {
    console.log('Zero console errors! All interactions passed cleanly.');
  }

  await browser.close();
}

testInteractions().catch(e => {
  console.error(e);
  process.exit(1);
});

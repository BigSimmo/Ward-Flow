import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("http://localhost:4467/mockups/ward-flow/delays");
  await page.waitForTimeout(2000);

  // Click Catchment Pressure
  const catchmentBtn = page.locator('button:has-text("Catchment Pressure")');
  await catchmentBtn.click();
  await page.waitForTimeout(500);

  // Inspect the first card header
  const header = page.locator('button[aria-label*="Filter by South Metropolitan"]').first();
  const html = await header.innerHTML();
  console.log("CARD INNER HTML:\n", html);

  const headerClass = await header.locator('> div').first().getAttribute('class');
  console.log("FIRST DIV CLASS:", headerClass);

  await browser.close();
}

main().catch(console.error);

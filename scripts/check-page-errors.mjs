import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto("http://localhost:4467/mockups/ward-flow/delays");
  await page.waitForTimeout(2000);

  // Check the error overlay
  const issueBtn = page.locator('button:has-text("Issue")');
  if (await issueBtn.count() > 0) {
    await issueBtn.click();
    await page.waitForTimeout(1000);
    const dialog = await page.locator('body').innerText();
    console.log("PAGE TEXT AFTER CLICKING ISSUE:\n", dialog.slice(0, 1500));
  }

  await browser.close();
}

main();

import { expect, type Page } from "playwright/test";

import { securityWord } from "@/components/ward-management/ward-model-vocabulary";

/**
 * L31 (3 Nov 2026): the ED "Ask for a bed" questions and the inbox decline reason are kit choices,
 * not browser drop-downs. A few answers are a segmented control (its group carries the test id and
 * `data-value`), a longer list is the kit list picker (the test id is on its field button, and its
 * hidden input, named after the test id, holds the value). `value` is the stored value, as the old
 * `<select>` options carried it. The browser twin of `chooseEdChoice` in `ed-raise-into-movement.tsx`.
 */
export async function chooseEdKitChoice(page: Page, testId: string, value: string): Promise<void> {
  const field = page.getByTestId(testId);
  if ((await field.getAttribute("data-value")) !== null) {
    const label = SEGMENT_LABELS[testId]?.(value) ?? value;
    await field.getByRole("radio", { name: label, exact: true }).click();
    return;
  }
  await field.click();
  await page.locator(`[role="option"][data-value="${value}"]`).click();
}

/** The stored value of a kit choice, checked the way `toHaveValue` checked the old select. */
export async function expectEdKitChoice(page: Page, testId: string, value: string): Promise<void> {
  const field = page.getByTestId(testId);
  if ((await field.getAttribute("data-value")) !== null) {
    await expect(field).toHaveAttribute("data-value", value);
    return;
  }
  await expect(page.locator(`input[type="hidden"][name="${testId}"]`)).toHaveValue(value);
}

const SEGMENT_LABELS: Record<string, (value: string) => string> = {
  "ward-ed-referral-security": (value) => securityWord(value),
};

import { expect, type Page } from "playwright/test";

/**
 * Closes every notice on screen before a click aimed at a control the notice could sit over (the
 * officer's pinned next step sits where desktop toasts stack). A notice that closes itself is left
 * to its timer with the pointer parked away, because a hovered notice never times out.
 */
export async function clearToasts(page: Page) {
  await page.mouse.move(0, 0);
  const toasts = page.getByTestId("toast");
  for (let guard = 0; guard < 8; guard += 1) {
    const close = toasts.getByRole("button", { name: /^Dismiss/u }).first();
    if (!(await close.isVisible())) break;
    await close.click();
  }
  await expect(toasts).toHaveCount(0, { timeout: 15_000 });
}

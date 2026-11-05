import { expect, type Page } from "playwright/test";

/**
 * Closes every notice on screen before a click aimed at a control the notice could sit over (the
 * officer's pinned next step sits where desktop toasts stack). A notice that closes itself is left
 * to its timer with the pointer parked away, because a hovered notice never times out.
 */
export async function clearToasts(page: Page) {
  await page.mouse.move(0, 0);
  const toasts = page.getByTestId("toast");
  for (let guard = 0; guard < 12; guard += 1) {
    const close = toasts.getByRole("button", { name: /^Dismiss/u }).first();
    if (!(await close.isVisible())) break;
    // A notice still sliding in (or replaced mid-click) is never "stable": a bare click retried until
    // the 2 minute test timeout (release gate, 5 Nov 2026). Give each try 2 s and look again.
    await close.click({ timeout: 2_000 }).catch(() => undefined);
  }
  await expect(toasts).toHaveCount(0, { timeout: 15_000 });
}

import {
  expect,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Locator,
  type Page,
} from "playwright/test";
import { homeFlowCard, showAllFlowRows, showEveryoneWaitingOn } from "./ward-home-page";

const supabaseOrigin = process.env.WARD_E2E_SUPABASE_ORIGIN ?? "";
const authOrigin = process.env.WARD_E2E_AUTH_ORIGIN ?? "";
export const accounts: { email: string; password: string }[] = JSON.parse(process.env.WARD_E2E_ACCOUNTS ?? "[]");

/** The shared status line both desks show while connected and idle. */
export const READY = "Coordinator · shared synthetic workspace";
/** The client polls every SHARED_REFRESH_MS (3 s); allow a few polls before calling it missed. */
export const POLL = { timeout: 15_000 };
/**
 * A seeded accepted movement with transport booked, so it cannot be referred. Wait order (Audit 1,
 * D-71) can put it past the queue's first rows, so `revealRow` opens "Show all" when needed.
 */
export const MOVEMENT = "WF-030";

export type Desk = { context: BrowserContext; page: Page };

/**
 * One signed-in desk. The browser may reach this app and the local backend only. The approved
 * Supabase origin is fixed in the client and its CSP, so its sign-in calls are answered by the
 * fake service the runner started; everything else is refused, so nothing leaves the machine.
 */
export async function openDesk(
  browser: Browser,
  account: { email: string; password: string },
  clock = false,
  options: BrowserContextOptions = {},
) {
  // The runner creates a self-signed certificate only for its loopback HTTPS backend.
  const context = await browser.newContext({ ...options, ignoreHTTPSErrors: true });
  await context.route(
    (url) => !["localhost", "127.0.0.1"].includes(url.hostname),
    (route) => route.abort("blockedbyclient"),
  );
  await context.route(`${supabaseOrigin}/**`, async (route) => {
    const response = await route.fetch({ url: route.request().url().replace(supabaseOrigin, authOrigin) });
    await route.fulfill({ response });
  });
  // A signed-in desk's tour starts on its own once, over the home screen. These journeys are about
  // the shared workspace, so every desk's tour is marked seen before the page loads.
  await context.addInitScript(() => {
    window.localStorage.setItem(
      "ward_flow_choice_tour_seen",
      "coordinator,ward,ed,community,officer,bed_manager,executive,admin",
    );
  });
  const page = await context.newPage();
  // A desk whose poll the clash test must hold back runs on Playwright's clock: it keeps real time
  // until paused, and while paused the 3 s poll timer cannot fire.
  if (clock) await page.clock.install();
  await page.goto("/ward-flow", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(sharedStatus(page)).toContainText(READY, { timeout: 30_000 });
  return { context, page } satisfies Desk;
}

export function sharedStatus(page: Page): Locator {
  // Recovery moves inside an open drawer's focus trap. Only that surface announces while
  // the global bar is aria-hidden; unrelated live freshness announcements are separate.
  return page.locator(
    '[data-testid="ward-shared-status-bar"]:not([aria-hidden="true"]), [data-testid="ward-shared-recovery"]',
  );
}

export function placement(page: Page): Locator {
  return page.getByRole("complementary", { name: "Placement", exact: true });
}

export function queueRow(page: Page, movement = MOVEMENT): Locator {
  return homeFlowCard(page).getByTestId(`ward-queue-row-${movement}`);
}

/**
 * Placement is the patient drawer over Home on every screen size (H7, Josh 3 Nov 2026), so a drawer
 * left open by an earlier step covers the queue. Close it, as a coordinator would, before choosing.
 */
export async function closePlacement(page: Page) {
  const close = page.getByRole("button", { name: "Close placement and clear selection" });
  if ((await close.count()) === 0) return;
  await close.click();
  await expect(placement(page)).toHaveCount(0);
}

/** Show the movement's Flow row, opening each stage's "Show all N" when the row is past its first rows. */
export async function revealRow(page: Page, movement = MOVEMENT): Promise<Locator> {
  await closePlacement(page);
  await showEveryoneWaitingOn(page);
  const queue = homeFlowCard(page);
  const row = queueRow(page, movement);
  await expect(queue.locator('[data-testid^="ward-queue-row-"]').first()).toBeVisible();
  if (!(await row.isVisible())) await showAllFlowRows(queue);
  await expect(row).toBeVisible();
  return row;
}

/** Select the movement on the queue, so Placement is about it whatever is now top of the queue. */
export async function selectMovement(page: Page, movement = MOVEMENT): Promise<Locator> {
  const row = await revealRow(page, movement);
  await row.click();
  await expect(placement(page)).toHaveAttribute("data-subject-movement", movement);
  return placement(page);
}

/** Open Placement's Change urgency form for the movement; returns its tier picker. */
export async function openUrgencyForm(page: Page, movement = MOVEMENT): Promise<Locator> {
  const panel = await selectMovement(page, movement);
  // Both are toggles that keep their state across a save, so open them only when closed.
  const update = panel.locator("details", { has: page.locator("summary", { hasText: "Update record" }) });
  if (!(await update.evaluate((element) => (element as HTMLDetailsElement).open)))
    await update.locator("summary").click();
  const change = panel.getByRole("button", { name: "Change urgency" });
  if ((await change.getAttribute("aria-expanded")) !== "true") await change.click();
  return panel.getByRole("combobox", { name: /^Urgency tier for / });
}

/** The tier the queue row shows for the movement ("1", "2" or "3"). */
export async function shownTier(page: Page, movement = MOVEMENT): Promise<string> {
  return /^Tier (\d)/u.exec((await queueRow(page, movement).textContent()) ?? "")?.[1] ?? "";
}

/**
 * Choose, with a reason, a tier other than the one this desk's queue shows (and other than
 * `avoid`); returns the option's label. The picker's own value is the form's state, not the record.
 */
export async function chooseOtherTier(page: Page, tier: Locator, avoid?: string, movement = MOVEMENT): Promise<string> {
  const current = await shownTier(page, movement);
  const options = await tier
    .locator("option")
    .evaluateAll((list) =>
      list.map((option) => ({ value: (option as HTMLOptionElement).value, label: option.textContent ?? "" })),
    );
  // "Urgent" heads the picker (finding 156) but raises the urgent flag, not a tier, and asks its own reason.
  const next = options.find(
    (option) => option.value !== "urgent" && option.value !== current && option.label !== avoid,
  )!;
  await tier.selectOption(next.value);
  await placement(page).getByRole("combobox", { name: "Reason" }).selectOption({ label: "Reassessed" });
  return next.label;
}

/** A queued movement other than MOVEMENT, for a second record to change. */
export async function anotherMovement(page: Page): Promise<string> {
  await closePlacement(page);
  await showEveryoneWaitingOn(page);
  const rows = homeFlowCard(page).locator('[data-testid^="ward-queue-row-"]');
  await expect(rows.first()).toBeVisible();
  const ids = await rows.evaluateAll((list) =>
    list.map((row) => row.getAttribute("data-testid")!.replace("ward-queue-row-", "")),
  );
  const other = ids.find((id) => id !== MOVEMENT);
  expect(other, "the queue needs a second movement").toBeTruthy();
  return other!;
}

/** The shared board's command request, and its revision, for one desk's next save. */
export function nextCommand(page: Page) {
  return page.waitForRequest(
    (request) => request.method() === "POST" && new URL(request.url()).pathname.endsWith("/v1/workspace/commands"),
  );
}

/** Whether Placement sits in the part of the board that goes inert while changes are disabled. */
export function placementInert(page: Page): Promise<boolean> {
  return placement(page).evaluate((panel) => panel.closest("[inert]") !== null);
}

// A full page load would reset the board and hide whether the desk caught up on its own, so the
// recovery test plants a value in the page and checks it survived (as the release-gate helpers do).
export const SENTINEL = "ward-shared-mode-no-reload";

export async function plantSentinel(page: Page) {
  await page.evaluate((value) => {
    (window as unknown as Record<string, string>).__wardSharedModeSentinel = value;
  }, SENTINEL);
}

export async function expectNoReloadSince(page: Page, step: string) {
  const survived = await page.evaluate(
    () => (window as unknown as Record<string, string | undefined>).__wardSharedModeSentinel,
  );
  expect(survived, `the page reloaded during "${step}"`).toBe(SENTINEL);
}

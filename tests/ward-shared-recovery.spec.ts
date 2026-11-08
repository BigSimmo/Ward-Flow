import { expect, test, type BrowserContextOptions, type Page, type TestInfo } from "playwright/test";
import { expectAccessible, isPhoneLayout } from "./helpers/ward-release-gate";
import {
  accounts,
  openDesk,
  READY,
  POLL,
  type Desk,
  sharedStatus,
  placement,
  revealRow,
  openUrgencyForm,
  chooseOtherTier,
  nextCommand,
} from "./helpers/ward-shared-desk";

/** These journeys run through the real local backend, PostgreSQL and synthetic Auth runner. */
let desk: Desk;

function deviceOptions(info: TestInfo): BrowserContextOptions {
  const { viewport, deviceScaleFactor, isMobile, hasTouch, userAgent } = info.project.use;
  return { viewport, deviceScaleFactor, isMobile, hasTouch, userAgent };
}

async function ready(page: Page) {
  await expect(sharedStatus(page)).toHaveText(new RegExp(`^${READY}`, "u"), { timeout: 30_000 });
}

async function showPhoneBeds(page: Page) {
  const more = page.getByRole("button", { name: /^Show \d+ more beds?$/u });
  if (await more.count()) await more.click();
  return page.getByTestId("ward-phone-round-list");
}

test.beforeEach(async ({ browser }, info) => {
  expect(accounts, "run through tests/support/ward-shared-mode-run.mjs").toHaveLength(2);
  // Install before the first app script creates its freshness and poll timers. Installing after
  // ready would leave those native timers outside fastForward's clock.
  desk = await openDesk(browser, accounts[0]!, true, deviceOptions(info));
});

test.afterEach(async ({}, info) => {
  if (desk?.page && info.status !== info.expectedStatus)
    await info.attach("failure: shared recovery", {
      body: await desk.page.screenshot({ fullPage: true, animations: "disabled" }).catch(() => Buffer.alloc(0)),
      contentType: "image/png",
    });
  await desk?.context.close();
});

test("offline recovery: a save accepted before reload is checked by receipt and is never replayed", async ({}, info) => {
  const { page } = desk;
  const tier = await openUrgencyForm(page);
  const chosen = await chooseOtherTier(page, tier);
  const sent: string[] = [];
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  let accepted!: () => void;
  const committed = new Promise<void>((resolve) => {
    accepted = resolve;
  });
  await page.route("**/v1/workspace/commands", async (route) => {
    sent.push(route.request().postDataJSON().commandId);
    // Commit once through the real HTTP handler, then lose only its reply to this desk.
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    accepted();
    await hold;
    await route.fulfill({ response }).catch(() => {});
  });
  try {
    await placement(page).getByRole("button", { name: "Record urgency change" }).click();
    await committed;
    const journal = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("wardflow:pending-commands-v2") ?? "null"),
    );
    expect(journal).toEqual({ version: 2, entries: [expect.objectContaining({ commandId: sent[0], phase: "sent" })] });
    expect(Object.keys(journal.entries[0]).sort()).toEqual(["commandId", "expiresAt", "phase", "receiptScope"]);
    await expectAccessible(page, info, "accepted reply lost, metadata-only recovery held");
    page.once("dialog", (dialog) => void dialog.accept());
    const receipt = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/v1/workspace/receipt" && response.url().includes(sent[0]!),
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    expect((await receipt).status()).toBe(200);
    await ready(page);
    await expect(
      page.getByText("The previous uncertain save was accepted. Review the refreshed board before acting again.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(await revealRow(page)).toContainText(chosen);
    expect(sent).toHaveLength(1);
    expect(await page.evaluate(() => sessionStorage.getItem("wardflow:pending-commands-v2"))).toBeNull();
    await expectAccessible(page, info, "receipt checked, saved tier visible after reload");
    await page.getByRole("button", { name: "Dismiss", exact: true }).click();
    await expect(page.getByRole("list", { name: "Recovered changes" })).toHaveCount(0);
    await expect(page.getByTestId("ward-shared-recovery-outcome")).toBeFocused();
    await expectAccessible(page, info, "recovery outcomes dismissed with focus retained");
  } finally {
    release();
    await page.unroute("**/v1/workspace/commands");
  }
});

test("stale board: five minutes without a successful refresh shows its time and one keyboard retry", async ({}, info) => {
  const { page } = desk;
  await page.goto("/ward-flow/capacity", { waitUntil: "domcontentloaded" });
  await ready(page);
  let mode: "fail" | "hold" = "fail";
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  let attempts = 0;
  await page.route("**/v1/workspace?*", async (route) => {
    attempts++;
    if (mode === "fail") return route.abort("connectionfailed");
    await hold;
    await route.continue().catch(() => {});
  });
  try {
    const beforeJump = await page.evaluate(() => Date.now());
    await page.clock.fastForward(4_000);
    await expect(sharedStatus(page)).toContainText("Connection unavailable", POLL);
    await page.clock.fastForward(300_001);
    expect((await page.evaluate(() => Date.now())) - beforeJump).toBeGreaterThanOrEqual(304_001);
    await expect(sharedStatus(page)).toContainText(/Stale\. Last updated at \d{2}:\d{2}/u);
    await expectAccessible(page, info, "five-minute stale board with last good refresh time");
    mode = "hold";
    const before = attempts;
    const retry = sharedStatus(page).getByRole("button", { name: "Retry", exact: true });
    await retry.focus();
    await page.keyboard.press("Enter");
    await expect(sharedStatus(page)).toContainText("Retrying");
    await expect(sharedStatus(page).getByRole("button", { name: "Retry", exact: true })).toHaveCount(0);
    expect(await sharedStatus(page).evaluate((status) => status === document.activeElement)).toBe(true);
    await expect.poll(() => attempts).toBe(before + 1);
    release();
    await ready(page);
    await expect(sharedStatus(page)).not.toContainText("Stale");
    await expectAccessible(page, info, "keyboard retry refreshed the existing board");
  } finally {
    release();
    await page.unroute("**/v1/workspace?*");
    await page.clock.resume();
  }
});

test("Activity Undo: a desk reviews its own bed closure and waits for the server to confirm the inverse", async ({}, info) => {
  const { page } = desk;
  await page.goto("/ward-flow/ward/rph-adult-secure", { waitUntil: "domcontentloaded" });
  await ready(page);
  const phone = isPhoneLayout(page);
  let bedId: string | null = null;
  let phoneReadyName: RegExp | undefined;
  // Follow each device's real bed controls, choosing an actual empty bed in the fixture.
  if (phone) {
    const rows = await showPhoneBeds(page);
    // The row is named by the words it shows, in order ("Bed 07 Ready"), with no aria-label (axe 4.14).
    const bed = rows.getByRole("button", { name: /^Bed \d+ Ready\b/u }).first();
    await expect(bed).toBeVisible();
    const number = /Bed\s*(\d+)/u.exec((await bed.textContent()) ?? "")?.[1];
    expect(number).toBeDefined();
    phoneReadyName = new RegExp(`^Bed ${number} Ready\\b`, "u");
    await bed.click();
    await page.getByRole("button", { name: "Update this bed", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "Full bed list", exact: true }).click();
    const bed = page.locator('[data-testid^="ward-bed-card-"][data-state="ready"]').first();
    await expect(bed).toBeVisible();
    bedId = await bed.getAttribute("data-testid");
    await bed.click();
  }
  const request = nextCommand(page);
  await page.getByTestId("ward-drawer-close-bed").click();
  const command = await request;
  expect((await command.response())?.status()).toBe(200);
  const commandId = command.postDataJSON().commandId as string;
  await ready(page);
  if (phone) await expect(page.getByTestId("ward-drawer-reopen-bed")).toBeVisible();
  else await expect(page.getByTestId(bedId!)).toHaveAttribute("data-state", "closed");
  await page.getByRole("button", { name: "Close bed drawer", exact: true }).click();
  // Josh, 8 Nov 2026: the coordinator's phone dock carries Tools in Activity's place, so a phone
  // opens Activity from the Menu's Activity row. On a ward page Back stands in the Menu's place,
  // and Back follows this shared desk's history from earlier tests, so the phone goes Home from the
  // dock instead (a client-side step, so this desk's own commands stay in memory). Activity is one
  // panel on every page, so the closure still shows there.
  if (phone) {
    const menu = page.getByTestId("ward-bar-phone-menu");
    if (!(await menu.isVisible())) {
      await page.getByTestId("ward-phone-dock-link").filter({ hasText: /^Home/u }).click();
      await expect(page).toHaveURL(/\/ward-flow\/?(?:\?.*)?$/u);
      await ready(page);
    }
    await expect(menu).toBeVisible();
    await menu.click();
    await page.getByTestId("ward-phone-menu-activity-row").click();
  } else {
    await page
      .getByRole("button", { name: /^Activity(?:\b|$)/u })
      .filter({ visible: true })
      .first()
      .click();
  }
  const activity = page.getByTestId("ward-bar-activity-sheet");
  await activity.getByRole("tab", { name: /^Recent/u }).click();
  const own = activity.locator(`[data-own-command-id="${commandId}"]`);
  await expect(own).toHaveCount(1);
  await own.getByRole("button", { name: "Review your change", exact: true }).click();
  await expect(own.getByRole("button", { name: "Undo this change", exact: true })).toBeEnabled();
  await expectAccessible(page, info, "own command identified with eligible Undo");
  const inverse = nextCommand(page);
  await own.getByRole("button", { name: "Undo this change", exact: true }).click();
  expect((await (await inverse).response())?.status()).toBe(200);
  await expect(own).toContainText("Undone. The shared board confirmed the change.");
  await expect(own).not.toContainText("A later change replaced this one");
  await expectAccessible(page, info, "Activity reports the confirmed inverse");
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page);
  if (phone) {
    const rows = await showPhoneBeds(page);
    await expect(rows.getByRole("button", { name: phoneReadyName! })).toBeVisible();
  } else await expect(page.getByTestId(bedId!)).toHaveAttribute("data-state", "ready");
});

test("sign-out return: cancelling preserves a waiting change and confirmed sign-out returns only to the authorised screen", async ({}, info) => {
  const { page } = desk;
  await page.goto("/ward-flow/capacity", { waitUntil: "domcontentloaded" });
  await ready(page);
  await page.evaluate(() => history.replaceState(history.state, "", "/ward-flow/capacity?display=ignored#ignored"));
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/v1/workspace/commands", async (route) => {
    await hold;
    await route.abort("connectionfailed").catch(() => {});
  });
  try {
    const request = nextCommand(page);
    await page
      .getByRole("region", { name: "Bed counts confirmed" })
      .getByRole("button", { name: /^Ask .+ to confirm its beds$/u })
      .click();
    await request;
    const status = page.getByTestId("ward-shared-status-bar");
    await status.getByRole("button", { name: "Sign out", exact: true }).click();
    const confirm = page.getByRole("alertdialog", { name: "Sign out with changes waiting?" });
    await expect(confirm).toContainText("A change already sent may still have been saved");
    await confirm.getByRole("button", { name: "Stay here", exact: true }).click();
    await expect(confirm).toBeHidden();
    await expect(status).toContainText("Not confirmed yet");
    await expectAccessible(page, info, "voluntary sign-out cancelled, pending command retained");
    await status.getByRole("button", { name: "Sign out", exact: true }).click();
    await confirm.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByLabel("Email")).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem("wardflow:pending-commands-v2"))).toBeNull();
    release();
    await page.unroute("**/v1/workspace/commands");
    await page.getByLabel("Email").fill(accounts[0]!.email);
    await page.getByLabel("Password", { exact: true }).fill(accounts[0]!.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await ready(page);
    await expect(page).toHaveURL(/\/ward-flow\/capacity$/u);
    await expect(page.getByTestId("ward-capacity-screen")).toBeVisible();
    await expectAccessible(page, info, "signed in on authorised screen without record, query or fragment");
  } finally {
    release();
    await page.unroute("**/v1/workspace/commands");
  }
});

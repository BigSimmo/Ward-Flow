import { expect, test, type Page } from "playwright/test";
import { communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import { homeHrefFor, type WardAccess } from "@/components/ward-management/ward-role-access";

/**
 * How do I… (Josh, 30 Oct 2026, D-90): every common task in Help launches Show me, which opens the
 * screen the job is done on and lights each control in turn. A walkthrough whose first control no
 * longer matches would show only a card and a "not on the screen" note, and no unit test would
 * notice (as HF-03 found for the tour), so this signs in each desk on a desktop and a phone, runs
 * the desk's own tasks and fails when a first step that should light shows no spotlight.
 *
 * The lists hold the tasks a browser sweep proved lit on 30 Oct 2026 (synthetic data, clock fixed).
 * A later step often needs the person to open a record first, which Show me never does for them, so
 * only first steps are asserted. Computer-only tasks (print, TV, downtime pack) are left out on a
 * phone, where Help says they are done on a computer.
 */

type Desk = { role: string; scope: Record<string, unknown> };

const DESKS: Record<string, Desk> = {
  coordinator: { role: "coordinator", scope: { kind: "statewide" } },
  ward: { role: "ward", scope: { kind: "ward", unitIds: ["fsh-adult-secure"] } },
  ed: { role: "ed", scope: { kind: "ed", edId: "fsh-ed" } },
  officer: { role: "officer", scope: { kind: "jobs" } },
  bed_manager: { role: "bed_manager", scope: { kind: "site", siteCode: "FSH" } },
};

/** The desk's own jobs whose first Show me step must light, by device. */
const LIT: Record<"desk" | "phone", Record<string, readonly string[]>> = {
  desk: {
    coordinator: [
      "release-pulled-bed",
      "decide-referral",
      "pull-bed",
      "ask-more-wards",
      "log-call",
      "new-referral",
      "cancel-transport",
      "sign-off-handover",
      "statistics",
      "search-patient",
    ],
    ward: ["confirm-numbers", "answer-ward-referrals", "bed-board", "new-referral", "sign-off-handover", "tv"],
    ed: ["ed-raise", "new-referral", "find-bed", "search-patient"],
    officer: ["transport-job", "alerts"],
    bed_manager: ["tv", "sign-off-handover", "statistics", "service-in-view"],
  },
  phone: {
    coordinator: ["release-pulled-bed", "decide-referral", "pull-bed", "ask-more-wards", "log-call", "new-referral"],
    ward: ["confirm-numbers", "answer-ward-referrals", "bed-board", "new-referral"],
    ed: ["ed-raise", "new-referral", "find-bed"],
    officer: ["transport-job", "alerts"],
    bed_manager: ["statistics", "service-in-view"],
  },
};

async function signIn(page: Page, desk: Desk): Promise<void> {
  await page.addInitScript((access) => {
    window.sessionStorage.setItem("wardflow:access-desk-v1", JSON.stringify(access));
  }, desk);
  const home = homeHrefFor(desk as WardAccess, communityTeamSlug);
  // CI serves a production build, where help-ask (Show me) is off by default (D-91), so switch it on here.
  await page.goto(`${home}?flags=role-access:on,help-ask:on`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
}

/** Starts the task's Show me the way How do I… does, and reports whether its first step lit. */
async function firstStepLit(page: Page, id: string): Promise<boolean> {
  const card = page.getByTestId("ward-show-me-card");
  await expect(async () => {
    await page.evaluate((task) => {
      window.dispatchEvent(new CustomEvent("ward-flow-open-help", { detail: { showMe: task } }));
    }, id);
    await expect(card).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  const lit = await expect
    // Show me may first open another screen; a cold page takes a while to draw on a dev server.
    .poll(() => page.getByTestId("ward-show-me-spot").count(), { timeout: 20_000 })
    .toBe(1)
    .then(
      () => true,
      () => false,
    );
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  return lit;
}

for (const device of ["desk", "phone"] as const) {
  test.describe(`Show me targets on a ${device} @mockup`, () => {
    if (device === "phone") test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
    else test.use({ viewport: { width: 1440, height: 1024 } });

    for (const [name, desk] of Object.entries(DESKS)) {
      test(`${name} tasks light the first control they name`, async ({ page }) => {
        test.setTimeout(420_000);
        await signIn(page, desk);
        const dark: string[] = [];
        for (const id of LIT[device][name] ?? []) {
          if (!(await firstStepLit(page, id))) dark.push(id);
        }
        expect(dark, `${name} ${device}: Show me lit nothing for these tasks`).toEqual([]);
      });
    }
  });
}

/** Use Help's real task action rather than invoking the player directly. */
async function startTask(page: Page, id: string) {
  const row = page.getByTestId(`ward-help-task-answer-${id}`);
  await expect(async () => {
    await page.evaluate(
      (task) =>
        window.dispatchEvent(
          new CustomEvent("ward-flow-open-help", {
            detail: { view: "tasks", task },
          }),
        ),
      id,
    );
    await expect(row).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 30000 });
  await row.getByTestId("ward-help-task-show-me").click();
  await expect(page.getByTestId("ward-show-me-card")).toBeVisible();
}

test.describe("Complete Help guides @mockup", () => {
  test.use({ viewport: { width: 1440, height: 1024 } });
  test.beforeEach(async ({ page }) => {
    await page.route("**/*", (route) => {
      const host = new URL(route.request().url()).hostname;
      return ["localhost", "127.0.0.1", "[::1]"].includes(host) ? route.continue() : route.abort();
    });
  });

  for (const input of ["pointer", "keyboard"] as const) {
    test(`guide continues from a movement list to its real action with ${input}`, async ({ page }) => {
      await signIn(page, DESKS.coordinator);
      await startTask(page, "pull-bed");
      await expect(page).toHaveURL(/\/ward-flow\/movements$/);
      await expect(page.getByTestId("ward-show-me-spot")).toBeVisible();
      await page.getByTestId("ward-show-me-try").click();
      await expect(page.getByTestId("ward-show-me-card")).toBeHidden();
      expect(await page.locator("#main-content").evaluate((element) => Boolean(element.closest("[inert]")))).toBe(
        false,
      );
      const movement = page
        .locator('#main-content a[href^="/ward-flow/movements/"]')
        .filter({ hasText: "Pull the bed" })
        .first();
      if (input === "keyboard") {
        await expect(movement).toBeFocused();
        await page.keyboard.press("Enter");
      } else await movement.click();
      await expect(page).toHaveURL(/\/ward-flow\/movements\/[^/?]+$/, { timeout: 45000 });
      const bedDetails = page
        .getByTestId("ward-patient-gate-bed")
        .getByRole("button", { name: "Pull the bed", exact: true });
      await expect(bedDetails).toBeVisible();
      if (input === "keyboard") await page.keyboard.press("Alt+ArrowRight");
      else await page.getByTestId("ward-show-me-continue").click();
      await expect(page.getByRole("dialog", { name: "Open the bed details" })).toBeVisible();
      await expect(page.getByTestId("ward-show-me-spot")).toBeVisible();
      await page.getByTestId("ward-show-me-try").click();
      await bedDetails.click();
      await expect(page.locator("button[data-placement-action]").filter({ hasText: "Pull the bed" })).toBeVisible();
      await page.getByTestId("ward-show-me-continue").click();
      await expect(page.getByRole("dialog", { name: "Confirm the bed pull" })).toBeVisible();
      await expect(page.getByTestId("ward-show-me-spot")).toBeVisible();
      await expect(page.getByTestId("ward-show-me-done")).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("ward-show-me-card")).toBeHidden();
      // Merely walking the guide never performs the pull.
      await expect(page.locator("button[data-placement-action]").filter({ hasText: "Pull the bed" })).toBeVisible();
    });
  }

  for (const device of ["desk", "phone"] as const) {
    test(`guide resumes above an open referral form on a ${device}`, async ({ page }) => {
      if (device === "phone") await page.setViewportSize({ width: 390, height: 844 });
      await signIn(page, DESKS.coordinator);
      await startTask(page, "new-referral");
      await page.getByTestId("ward-show-me-try").click();
      const create = page.getByTestId(device === "phone" ? "ward-phone-create" : "ward-bar-primary-action");
      await create.click();
      if (device === "phone")
        await page
          .getByRole("dialog", { name: "Create", exact: true })
          .getByRole("button", { name: "New referral", exact: true })
          .click();
      await expect(
        page.getByTestId(device === "phone" ? "ward-referral-phone-continue" : "ward-referral-summary-rail"),
      ).toBeVisible();
      // Pointer resume must remain above the newly opened modal too.
      await page.getByTestId("ward-show-me-continue").click();
      await expect(page.getByRole("dialog", { name: "Destinations, then send" })).toBeVisible();
      await expect(page.getByTestId("ward-show-me-spot")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("ward-show-me-card")).toBeHidden();
      await expect(
        page.getByTestId(device === "phone" ? "ward-referral-phone-continue" : "ward-referral-summary-rail"),
      ).toBeVisible();
    });
  }

  test("phone Statistics guide completes without offering a missing export control", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, DESKS.coordinator);
    await startTask(page, "statistics");
    await expect(page.getByTestId("ward-show-me-spot")).toBeVisible();
    await expect(page.getByTestId("ward-show-me-card")).toContainText("Step 1 of 1");
    await expect(page.getByTestId("ward-show-me-card")).not.toContainText("Export the figures");
    await page.getByTestId("ward-show-me-done").click();
    await expect(page.getByTestId("ward-show-me-card")).toBeHidden();
  });
});

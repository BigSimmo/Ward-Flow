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

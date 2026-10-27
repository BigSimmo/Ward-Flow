import { expect, test, type Page } from "playwright/test";

/**
 * HF-04 (help and tour audit, 26 Oct 2026): every desk's tour, walked on its real home screen,
 * lights the controls it talks about. Four coordinator steps lost their spotlight when Home's labels
 * changed and no check noticed (HF-03), so this walks each desk on a desktop and a phone and fails
 * when a step that should point at a control shows only a card in the middle of the screen.
 *
 * Each desk is signed in the way `?flags=role-access:on` signs one in locally: its role and place
 * ids in session storage. The config marks every tour seen, so none starts by itself; the test opens
 * it the way Help's Take the tour does. Steps whose control only shows with data (an empty list) are
 * left out of the lists below, as the tour allows.
 */

type Desk = { role: string; scope: Record<string, unknown> };

const DESKS: Record<string, Desk> = {
  coordinator: { role: "coordinator", scope: { kind: "statewide" } },
  ward: { role: "ward", scope: { kind: "ward", unitIds: ["fsh-adult-secure"] } },
  ed: { role: "ed", scope: { kind: "ed", edId: "fsh-ed" } },
  community: { role: "community", scope: { kind: "team", teamName: "Albany" } },
  officer: { role: "officer", scope: { kind: "jobs" } },
  bed_manager: { role: "bed_manager", scope: { kind: "site", siteCode: "FSH" } },
  executive: { role: "executive", scope: { kind: "statewide" } },
  admin: { role: "admin", scope: { kind: "statewide" } },
};

/**
 * The steps that must light a control on the desk's home, by device. A desk's welcome opens centred
 * since the desk banner shows only in a preview (Josh, 27 Oct 2026), so only the coordinator's lights one.
 */
const LIT: Record<"desk" | "phone", Record<string, readonly string[]>> = {
  desk: {
    coordinator: [
      "welcome",
      "shift",
      "menu",
      "pressure",
      "eds",
      "shortlist",
      "new-referral",
      "search",
      "tasks",
      "tools",
    ],
    ward: ["you", "hero", "checking", "confirm", "beds", "answer", "decisions", "raise", "brief", "pin"],
    ed: ["you", "card", "row", "form", "next", "raise", "find-bed"],
    community: ["you", "hero", "actions", "contact", "raise", "menu"],
    officer: ["you", "summary", "jobs", "next", "stepper", "alerts"],
    bed_manager: ["menu", "hero", "mismatch", "meeting", "map", "help"],
    executive: ["hero", "tabs", "export", "trends"],
    admin: ["review"],
  },
  phone: {
    coordinator: ["welcome", "chips", "eds", "queue", "create", "dock", "search", "menu", "help"],
    ward: ["hero", "confirm", "tabs", "answer", "create", "dock", "pin", "help"],
    ed: ["card", "raise", "row", "create", "dock", "find-bed", "help"],
    community: ["hero", "chips", "tabs", "create", "dock", "help"],
    officer: ["hero", "next", "jobs", "dock", "help"],
    bed_manager: ["hero", "tabs", "mismatch", "dock", "help"],
    executive: ["hero", "tabs", "trends", "dock", "help"],
    admin: ["review", "dock", "help"],
  },
};

async function signIn(page: Page, desk: Desk): Promise<void> {
  await page.addInitScript((access) => {
    window.sessionStorage.setItem("wardflow:access-desk-v1", JSON.stringify(access));
  }, desk);
  await page.goto("/ward-flow?flags=role-access:on", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
}

/** Opens the tour, lets it reach the desk's home, and returns each step with whether it was lit. */
async function walkTour(page: Page): Promise<Map<string, boolean>> {
  const card = page.getByTestId("ward-tour-card");
  await expect(async () => {
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("ward-flow-open-help", { detail: { view: "tour" } })),
    );
    await expect(card).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  // The tour goes to the desk's home first. Let that page settle before reading the first step.
  await page.waitForLoadState("networkidle");
  const seen = new Map<string, boolean>();
  for (let index = 0; index < 20; index++) {
    const id = (await card.getAttribute("data-step")) ?? "";
    const lit = await expect
      .poll(() => page.getByTestId("ward-tour-spot").count(), { timeout: 8_000 })
      .toBe(1)
      .then(
        () => true,
        () => false,
      );
    seen.set(id, lit);
    const next = page.getByTestId("ward-tour-next");
    if ((await next.count()) === 0) break;
    await next.click();
    await expect(card).not.toHaveAttribute("data-step", id);
  }
  return seen;
}

for (const device of ["desk", "phone"] as const) {
  test.describe(`tour targets on a ${device} @mockup`, () => {
    if (device === "phone") test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
    else test.use({ viewport: { width: 1440, height: 1024 } });

    for (const [name, desk] of Object.entries(DESKS)) {
      test(`${name} tour lights each control it names`, async ({ page }) => {
        test.setTimeout(120_000);
        await signIn(page, desk);
        const seen = await walkTour(page);
        expect(seen.get("can-do"), "the tour ends with what the desk can do").toBeDefined();
        const walked = JSON.stringify(Object.fromEntries(seen));
        for (const id of LIT[device][name] ?? []) {
          expect(seen.has(id), `${name} ${device}: step ${id} is in the tour ${walked}`).toBe(true);
          expect(seen.get(id), `${name} ${device}: step ${id} lights its control ${walked}`).toBe(true);
        }
      });
    }
  });
}

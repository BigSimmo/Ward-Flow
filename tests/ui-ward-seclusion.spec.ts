import { expect, test, type Locator } from "playwright/test";

/**
 * Front-end audit, 5 Nov 2026 ("main flows with no end-to-end interaction"): seclusion and
 * restraint is a legal record, and until now no browser journey recorded one. Only the axe sweep
 * opened the Forms view. This journey starts an episode for a synthetic patient, checks the typed
 * time rules (nothing pre-selected, an end before the start is refused) and records its end, in
 * the real app. Times are typed or taken with Now, as the D5 rule asks. No duration or legal limit is
 * worked out, so none is asserted.
 */
const SECLUSION = "/ward-flow/legal-forms?view=seclusion";

/** HH:MM five minutes before a typed HH:MM, wrapping past midnight. */
function fiveMinutesBefore(clock: string): string {
  const [hours, minutes] = clock.split(":").map(Number);
  const total = (hours * 60 + minutes - 5 + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

async function pressNow(dialog: Locator, label: string) {
  await dialog
    .getByRole("group", { name: `${label}: quick times` })
    .getByRole("button", { name: "Now" })
    .click();
}

test.describe("@mockup seclusion and restraint record", () => {
  test("starts an episode for a patient and records its end, refusing an end before the start", async ({ page }) => {
    await page.goto(SECLUSION, { waitUntil: "load" });
    const view = page.getByTestId("seclusion-forms-view");
    await expect(view).toBeVisible({ timeout: 20_000 });
    const liveRows = page.getByTestId("seclusion-live-row");
    const before = await liveRows.count();

    const start = page.getByTestId("seclusion-start-dialog");
    // The first press can land before React hydrates the page (seen in CI on 9 Nov 2026), so press
    // again until the dialog opens, as the statistics journey does.
    await expect(async () => {
      if (!(await start.isVisible())) await page.getByTestId("seclusion-start-open").click();
      await expect(start).toBeVisible({ timeout: 3_000 });
    }, "Start an episode never opened its dialog").toPass({ timeout: 30_000 });
    const record = start.getByRole("button", { name: "Record start" });
    // Nothing is pre-selected: no patient, no practice and no time.
    await expect(record).toHaveAttribute("aria-disabled", "true");
    await expect(start.getByRole("radio", { checked: true })).toHaveCount(0);
    await expect(start.getByTestId("seclusion-start-time")).toHaveValue("");

    // Find a synthetic patient on a ward in view who has nothing recorded as in use yet.
    const inUse = (await liveRows.allTextContents()).join("\n");
    await start.getByRole("searchbox", { name: "Find the patient" }).fill("a");
    const matches = start.getByTestId("seclusion-start-matches").getByRole("button");
    await expect(matches.first()).toBeVisible();
    let patient = "";
    for (const match of await matches.all()) {
      const name = (await match.locator("span").first().textContent())?.trim() ?? "";
      if (name && !inUse.includes(name)) {
        patient = name;
        await match.click();
        break;
      }
    }
    expect(patient, "a match with nothing in use yet").not.toBe("");
    await expect(start.getByTestId("seclusion-start-chosen")).toContainText(patient);
    await expect(record).toHaveAttribute("aria-disabled", "true");

    await start.getByRole("radio", { name: "Seclusion" }).click();
    await expect(record).toHaveAttribute("aria-disabled", "true");
    await pressNow(start, "Started at");
    const startedAt = await start.getByTestId("seclusion-start-time").inputValue();
    expect(startedAt).toMatch(/^\d{2}:\d{2}$/);
    await expect(record).not.toHaveAttribute("aria-disabled", "true");
    await record.click();
    await expect(start).toBeHidden();

    const episode = liveRows.filter({ hasText: patient });
    await expect(liveRows).toHaveCount(before + 1);
    await expect(episode).toHaveCount(1);
    await expect(episode).toContainText("Seclusion");
    await expect(episode).toContainText(startedAt);

    await episode.getByTestId("seclusion-end-open").click();
    const end = page.getByTestId("seclusion-end-dialog");
    await expect(end).toBeVisible();
    const save = end.getByRole("button", { name: "Save end time" });
    await expect(save).toHaveAttribute("aria-disabled", "true");
    await end.getByTestId("seclusion-end-time").fill(fiveMinutesBefore(startedAt));
    await expect(save).toHaveAttribute("aria-disabled", "true");
    await expect(save).toHaveAccessibleDescription(/cannot be before the start time/);
    await end.getByTestId("seclusion-end-time").fill("");
    await pressNow(end, "Ended at");
    await expect(save).not.toHaveAttribute("aria-disabled", "true");
    await save.click();
    await expect(end).toBeHidden();

    await expect(liveRows.filter({ hasText: patient })).toHaveCount(0);
    await expect(liveRows).toHaveCount(before);
  });
});

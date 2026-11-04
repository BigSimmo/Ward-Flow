import { expect, test, type Page, type TestInfo } from "playwright/test";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { demoDayZero, PERTH_UTC_OFFSET_MS } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WARD_FLOW_STORED_STATE_VERSION } from "@/components/ward-management/ward-flow-demo-storage-constants";

const HOME = "/ward-flow";

async function settled(page: Page) {
  await expect(page.locator("html[data-wf-bar-ready]")).toHaveCount(1);
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0);
  await page.waitForLoadState("networkidle");
}

async function navigate(page: Page, route: string) {
  if (route === "/settings") {
    // DK1 (3 Nov 2026): Settings lives in the account menu on the person card, not as a rail link.
    await page.getByTestId("ward-rail-persona-trigger").click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
  } else {
    const link = page.locator(`a[href="${HOME}${route}"]:visible`).first();
    // B1 (19 Oct 2026): the rail lists the desk's own pages; the rest are under More.
    if ((await link.count()) === 0) await page.getByTestId("ward-rail-more").click();
    await link.click();
  }
  await expect(page).toHaveURL(new RegExp(`${HOME}${route}$`));
  await settled(page);
}

/**
 * Kit (lane C, 31 Oct 2026): the unsaved-changes question is the styled confirm, not the browser's
 * own box. Back or Forward is undone first, then the dialog asks; `prompts` keeps counting browser
 * boxes, which must stay at 0.
 */
async function answerLeave(page: Page, choice: "Keep editing" | "Leave without saving") {
  const ask = page.getByTestId("wf-confirm-dialog");
  await expect(ask).toBeVisible();
  await expect(ask.getByRole("heading", { name: "Leave this page?" })).toBeVisible();
  await ask.getByRole("button", { name: choice }).click();
  await expect(ask).toBeHidden();
}

async function exerciseBoardPrint(page: Page, testInfo: TestInfo, bedCount: number, expectedPages: number) {
  const fixedTime = new Date("2026-11-04T04:42:00.000Z");
  const now = 12 * 60 + 42;
  // Validate the actual JSON value the restore reads. In-memory seeds contain optional keys
  // with undefined values; those keys do not exist in a stored JSON document.
  const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(now - NOW_ANCHOR))) as ReturnType<
    typeof seedWardFlowStateAt
  >;
  const unit = state.units.find((candidate) => candidate.id === "rph-adult-secure")!;
  const addedBeds = bedCount - unit.beds;
  unit.beds = bedCount;
  unit.empty.value += addedBeds;
  unit.allocatable.value += addedBeds;
  // A real saved-state fixture, admitted by the same validation used on reload. Extra synthetic
  // Ready beds exercise pagination without inventing records or editing printed DOM.
  expect(isValidStoredWardFlowState(state)).toBe(true);
  const payload = JSON.stringify({
    version: WARD_FLOW_STORED_STATE_VERSION,
    dayZero: demoDayZero(fixedTime).getTime(),
    worldGeneration: state.worldGeneration,
    now,
    savedAtAbsolute: Math.floor((fixedTime.getTime() + PERTH_UTC_OFFSET_MS) / 60_000),
    state,
  });
  await page.clock.install({ time: fixedTime });
  await page.addInitScript((saved) => sessionStorage.setItem("ward-flow-demo-state-v1", saved), payload);
  await page.goto(`${HOME}/board/rph-adult-secure`);
  await settled(page);
  const output = page.locator("[data-ward-board-print]");
  await expect(output.getByTestId("ward-board-print-bed")).toHaveCount(bedCount);
  await expect(output.getByTestId("ward-board-print-page")).toHaveCount(expectedPages);
  await expect(output).toBeHidden();
  await page.setViewportSize({ width: 1062, height: 733 });
  await page.emulateMedia({ media: "print" });
  await expect(output).toBeVisible();
  await expect(output.getByTestId("ward-board-print-time")).toHaveText(
    Array.from({ length: expectedPages }, () => "Wed, 4 Nov 2026, 12:42 AWST"),
  );
  expect(
    await output.locator("li").evaluateAll((beds) =>
      beds.every((bed) => {
        const style = getComputedStyle(bed);
        return (
          Number.parseFloat(style.fontSize) >= 12 &&
          bed.scrollWidth <= bed.clientWidth &&
          bed.scrollHeight <= bed.clientHeight + 1
        );
      }),
    ),
  ).toBe(true);
  const pdf = await page.pdf({
    path: testInfo.outputPath(`bed-board-${bedCount}.pdf`),
    preferCSSPageSize: true,
    printBackground: false,
    displayHeaderFooter: false,
  });
  await testInfo.attach(`${bedCount}-bed A4 landscape board`, { body: pdf, contentType: "application/pdf" });
  await testInfo.attach(`${bedCount}-bed board print preview`, {
    body: await output.screenshot({ path: testInfo.outputPath(`bed-board-${bedCount}.png`) }),
    contentType: "image/png",
  });
  expect(pdf.toString("latin1").match(/\/Type\s*\/Page(?:\s|\/|>)/g)).toHaveLength(expectedPages);
}

test.use({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block", screenshot: "off", trace: "off" });

test.describe("native history and handover print @mockup", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
    );
  });

  test.afterEach(async ({ page }) => {
    await page.close(); // Keep automatic failure context free of synthetic patient rows.
  });

  test("30-bed board prints one readable A4 landscape sheet with actual Perth provenance", async ({
    page,
  }, testInfo) => {
    await exerciseBoardPrint(page, testInfo, 30, 1);
  });

  test("31-bed board prints every bed across two readable A4 landscape sheets", async ({ page }, testInfo) => {
    await exerciseBoardPrint(page, testInfo, 31, 2);
  });

  test("pre-hydration scripts preserve rail preference and client navigation without script errors", async ({
    page,
    context,
  }) => {
    const scriptErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /script tag|scripts inside React components/i.test(message.text()))
        scriptErrors.push(message.text());
    });
    await context.addInitScript(() => localStorage.setItem("ward-flow-rail", "closed"));
    await page.goto(HOME);
    await settled(page);
    await expect(page.getByTestId("ward-rail")).toHaveAttribute("data-rail", "closed");
    await page.evaluate(() => document.documentElement.setAttribute("data-review-navigation", "same-document"));
    expect(scriptErrors).toEqual([]);
    await navigate(page, "/capacity");
    await expect(page.locator("html")).toHaveAttribute("data-review-navigation", "same-document");
    await navigate(page, "/referrals");
    await expect(page.locator("html")).toHaveAttribute("data-review-navigation", "same-document");
    expect(scriptErrors).toEqual([]);
  });

  test("phone Keep draft closes through native history and reopens the referral from memory", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 568 });
    await page.goto(`${HOME}/waiting`);
    await settled(page);
    const originalIndex = await page.evaluate(() => window.history.state.__wfHistoryIndex);
    expect(typeof originalIndex).toBe("number");
    let prompts = 0;
    page.on("dialog", async (dialog) => {
      prompts += 1;
      await dialog.dismiss();
    });
    const toolsTrigger = page.getByTestId("ward-bar-phone-menu");
    const openReferral = async () => {
      await toolsTrigger.click();
      await page.getByTestId("ward-phone-menu-tools").click();
      await page
        .getByRole("dialog", { name: "Tools", exact: true })
        .getByRole("button", { name: /New referral/u })
        .click();
      const referral = page.getByRole("dialog", { name: "Referrals", exact: true });
      await referral
        .getByRole("group", { name: "Referral sections" })
        .getByRole("button", { name: "Referral", exact: true })
        .click();
      return referral;
    };
    let referral = await openReferral();
    await referral.locator("#refDocInput").fill("Draft-recovery marker clinician");
    await referral.getByRole("button", { name: "Close step", exact: true }).click();
    await page.keyboard.press("Escape");
    await page
      .getByRole("alertdialog", { name: "Keep this referral as a draft?" })
      .getByRole("button", { name: "Keep draft and close", exact: true })
      .click();
    await expect(referral).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.history.state.__wfHistoryIndex)).toBe(originalIndex);
    await expect(toolsTrigger).toBeFocused();
    expect(prompts).toBe(0);
    referral = await openReferral();
    // Keep assertion output free of the typed fixture value. The marker must stay unique: the seeded
    // referrals carry referrer names such as "Synthetic clinician 1", so a shared prefix would match them.
    expect(
      await referral
        .locator("#refDocInput")
        .evaluate((input) => (input as HTMLInputElement).value === "Draft-recovery marker clinician"),
    ).toBe(true);
    // D-67 (17 Oct 2026): the synthetic referral drawer may keep a session-scoped `wf-draft:v2:`
    // recovery copy. Typed text must appear nowhere else: no other session key, never localStorage.
    expect(
      await page.evaluate(() =>
        [
          ...Object.entries(sessionStorage).filter(([key]) => !key.startsWith("wf-draft:v2:")),
          ...Object.entries(localStorage),
        ].some(([, value]) => value.includes("Draft-recovery marker clinician")),
      ),
    ).toBe(false);
    const recovery = await page.evaluate(() => {
      const entries = Object.entries(sessionStorage).filter(
        ([key, raw]) => key.startsWith("wf-draft:v2:") && raw.includes("Draft-recovery marker clinician"),
      );
      if (entries.length !== 1) return false;
      const [key, raw] = entries[0]!;
      const envelope = JSON.parse(raw);
      const projection = JSON.parse(envelope.value);
      return (
        key.split(":").length === 7 &&
        envelope.version === 1 &&
        envelope.expiresAt > Date.now() &&
        envelope.expiresAt - envelope.savedAt <= 12 * 60 * 60_000 &&
        projection.doctorNote === "Draft-recovery marker clinician" &&
        projection.documentation.charts.length === 0
      );
    });
    expect(recovery).toBe(true);
    expect(prompts).toBe(0);
  });

  for (const direction of ["back", "forward"] as const) {
    test(`native ${direction} retains a cancelled booking draft and leaves only after acceptance`, async ({ page }) => {
      await page.goto(HOME);
      await settled(page);
      await navigate(page, "/capacity");
      await navigate(page, "/settings");
      await navigate(page, "/referrals");
      await page.goBack();
      await settled(page);
      await page.goBack();
      await settled(page);
      await expect(page).toHaveURL(new RegExp(`${HOME}/capacity$`));
      await page.getByTestId("ward-planned-book").click();
      await page.getByTestId("ward-planned-stay").fill("9");

      let prompts = 0;
      const dismiss = async (dialog: import("playwright/test").Dialog) => {
        prompts += 1;
        await dialog.dismiss();
      };
      page.on("dialog", dismiss);
      await page.evaluate((move) => window.history[move](), direction);
      await answerLeave(page, "Keep editing");
      expect(prompts).toBe(0);
      await expect(page).toHaveURL(new RegExp(`${HOME}/capacity$`));
      await expect(page.getByTestId("ward-planned-stay")).toHaveValue("9");
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByTestId("ward-planned-stay")).toBeFocused();
      page.off("dialog", dismiss);
      await page.evaluate((move) => window.history[move](), direction);
      await answerLeave(page, "Leave without saving");
      await expect(page).toHaveURL(new RegExp(`${HOME}${direction === "back" ? "" : "/settings"}$`));
      await expect(page.getByTestId("ward-planned-stay")).toHaveCount(0);
    });
  }

  test("cancels Forward into a real Next entry without our index metadata", async ({ page }) => {
    // Emulate entries from the previous build: retain Next's own real state, omit only our new
    // numeric metadata at the browser boundary. No fabricated router tree or history indices.
    await page.addInitScript(() => {
      for (const key of ["pushState", "replaceState"] as const) {
        const original = History.prototype[key];
        History.prototype[key] = function (data: unknown, title: string, url?: string | URL | null) {
          const state = data && typeof data === "object" ? { ...data } : data;
          if (state && typeof state === "object") delete (state as Record<string, unknown>).__wfHistoryIndex;
          return original.call(this, state, title, url);
        };
      }
    });
    await page.goto(HOME);
    await settled(page);
    await navigate(page, "/capacity");
    await navigate(page, "/settings");
    await navigate(page, "/referrals");
    await page.goBack();
    await settled(page);
    await page.goBack();
    await settled(page);
    expect(await page.evaluate(() => window.history.state.__wfHistoryIndex)).toBeUndefined();
    expect(await page.evaluate(() => window.history.state.__NA)).toBe(true);
    await page.getByTestId("ward-planned-book").click();
    await page.getByTestId("ward-planned-stay").fill("8");
    let prompts = 0;
    page.on("dialog", async (dialog) => {
      prompts += 1;
      await dialog.dismiss();
    });
    await page.evaluate(() => window.history.go(2));
    await answerLeave(page, "Keep editing");
    expect(prompts).toBe(0);
    await expect(page).toHaveURL(new RegExp(`${HOME}/capacity$`));
    await expect(page.getByTestId("ward-planned-stay")).toHaveValue("8");
  });

  test("indexed fallback restores a skipped Forward traversal without Navigation API", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window, "navigation", { value: undefined }));
    await page.goto(HOME);
    await settled(page);
    await navigate(page, "/capacity");
    await navigate(page, "/settings");
    await navigate(page, "/referrals");
    await page.goBack();
    await settled(page);
    await page.goBack();
    await settled(page);
    expect(await page.evaluate(() => typeof window.history.state.__wfHistoryIndex)).toBe("number");
    await page.getByTestId("ward-planned-book").click();
    await page.getByTestId("ward-planned-stay").fill("7");
    let prompts = 0;
    page.on("dialog", async (dialog) => {
      prompts += 1;
      await dialog.dismiss();
    });
    await page.evaluate(() => window.history.go(2));
    await answerLeave(page, "Keep editing");
    expect(prompts).toBe(0);
    await expect(page).toHaveURL(new RegExp(`${HOME}/capacity$`));
    await expect(page.getByTestId("ward-planned-stay")).toHaveValue("7");
  });

  test("unindexed legacy fallback without Navigation API keeps the form and restores its URL", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "navigation", { value: undefined });
      for (const key of ["pushState", "replaceState"] as const) {
        const original = History.prototype[key];
        History.prototype[key] = function (data: unknown, title: string, url?: string | URL | null) {
          const state = data && typeof data === "object" ? { ...data } : data;
          if (state && typeof state === "object") delete (state as Record<string, unknown>).__wfHistoryIndex;
          return original.call(this, state, title, url);
        };
      }
    });
    await page.goto(HOME);
    await settled(page);
    await navigate(page, "/capacity");
    await navigate(page, "/settings");
    await navigate(page, "/referrals");
    await page.goBack();
    await settled(page);
    await page.goBack();
    await settled(page);
    await page.getByTestId("ward-planned-book").click();
    await page.getByTestId("ward-planned-stay").fill("6");
    let prompts = 0;
    page.on("dialog", async (dialog) => {
      prompts += 1;
      await dialog.dismiss();
    });
    await page.evaluate(() => window.history.go(2));
    await answerLeave(page, "Keep editing");
    expect(prompts).toBe(0);
    await expect(page).toHaveURL(new RegExp(`${HOME}/capacity$`));
    await expect(page.getByTestId("ward-planned-stay")).toHaveValue("6");
    await expect(page.getByTestId("ward-planned-stay")).toBeFocused();
    expect(await page.evaluate(() => window.history.state.__NA)).toBe(true);
    expect(await page.evaluate(() => window.history.state.__wfHistoryUncertain)).toBe(true);
    // Once the cursor is uncertain, a second cancellation must also restore the form safely.
    await page.evaluate(() => window.history.back());
    await answerLeave(page, "Keep editing");
    expect(prompts).toBe(0);
    await expect(page).toHaveURL(new RegExp(`${HOME}/capacity$`));
    await expect(page.getByTestId("ward-planned-stay")).toHaveValue("6");
  });

  test("native hash changes keep a booking form without a false leave prompt", async ({ page }) => {
    await page.goto(`${HOME}/capacity`);
    await settled(page);
    await page.getByTestId("ward-planned-book").click();
    await page.getByTestId("ward-planned-stay").fill("5");
    let prompts = 0;
    page.on("dialog", async (dialog) => {
      prompts += 1;
      await dialog.dismiss();
    });
    await page.evaluate(() => {
      window.location.hash = "booking-control";
    });
    await expect(page).toHaveURL(new RegExp(`${HOME}/capacity#booking-control$`));
    await page.evaluate(() => window.history.back());
    await expect(page).toHaveURL(new RegExp(`${HOME}/capacity$`));
    await expect(page.getByTestId("ward-planned-stay")).toHaveValue("5");
    expect(prompts).toBe(0);
  });

  test("indexed fallback restores a multi-step traversal across a native hash entry", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window, "navigation", { value: undefined }));
    await page.goto(HOME);
    await settled(page);
    await navigate(page, "/capacity");
    await page.evaluate(() => {
      window.location.hash = "booking-control";
    });
    await expect(page).toHaveURL(new RegExp(`${HOME}/capacity#booking-control$`));
    await navigate(page, "/settings");
    await navigate(page, "/referrals");
    await page.evaluate(() => window.history.go(-3));
    await expect(page).toHaveURL(new RegExp(`${HOME}/capacity$`));
    await settled(page);
    await page.getByTestId("ward-planned-book").click();
    await page.getByTestId("ward-planned-stay").fill("4");
    let prompts = 0;
    page.on("dialog", async (dialog) => {
      prompts += 1;
      await dialog.dismiss();
    });
    await page.evaluate(() => window.history.go(3));
    await answerLeave(page, "Keep editing");
    expect(prompts).toBe(0);
    await expect(page).toHaveURL(new RegExp(`${HOME}/capacity$`));
    await expect(page.getByTestId("ward-planned-stay")).toHaveValue("4");
  });

  test("long scoped desk attribution fits portrait handover pages", async ({ page }) => {
    await page.addInitScript(() =>
      sessionStorage.setItem(
        "wardflow:access-desk-v1",
        JSON.stringify({
          role: "ward",
          scope: { kind: "ward", unitIds: ["brm-adult-secure"] },
        }),
      ),
    );
    await page.goto(`${HOME}/handover?flags=role-access:on`);
    await settled(page);
    // 1 Nov 2026 redesign: Print handover is the sheet bar's one primary button.
    await page.getByTestId("ward-handover-print").click();
    await page.getByRole("radio", { name: "A4 portrait" }).click();
    await page.emulateMedia({ media: "print" });
    for (const paper of await page.locator("[data-wf-print-stack] article").all()) {
      const stamp = paper.getByTestId("ward-print-attribution");
      await expect(stamp).toBeVisible();
      await expect(stamp).toContainText("Nurse in charge, Mabu Liyan / Broome Mental Health Unit");
      expect(
        await stamp.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const page = element.closest("article")!.getBoundingClientRect();
          return element.scrollWidth <= element.clientWidth && box.left >= page.left && box.right <= page.right;
        }),
      ).toBe(true);
      expect(await paper.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
    }
  });

  test("every isolated handover page prints its desk and place attribution", async ({ page }) => {
    await page.goto(`${HOME}/handover?flags=role-access:on`);
    await settled(page);
    // 1 Nov 2026 redesign: Print handover is the sheet bar's one primary button.
    await page.getByTestId("ward-handover-print").click();
    await page.emulateMedia({ media: "print" });
    const pages = page.locator("[data-wf-print-stack] article");
    expect(await pages.count()).toBeGreaterThan(1);
    for (const paper of await pages.all()) {
      const attribution = paper.getByTestId("ward-print-attribution");
      await expect(attribution).toBeVisible();
      // Nothing has been prepared yet (Print was not pressed), so the sheet says it is a preview.
      await expect(attribution).toContainText("Preview opened by Bed coordinator, Statewide, at");
      await expect(attribution).toContainText("Synthetic data.");
      expect(await paper.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
    }
  });

  test("Waiting board prints the Legal column's form chips", async ({ page }) => {
    await page.goto(`${HOME}/waiting`);
    await settled(page);
    const chip = page.getByTestId("delays-legal-chip").first();
    await expect(chip).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(chip).toBeVisible();
    await page.emulateMedia({ media: "screen" });
  });

  // Q217 (Josh, 2 Nov 2026): the kit Card's own display once beat the hide class, so all four tables
  // showed at once under the tabs. On screen only the chosen tab's table shows; print holds all four.
  for (const width of [1440, 820]) {
    test(`Downtime pack shows one table per tab on screen and all four in print at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${HOME}/reports/downtime`);
      await settled(page);
      const panels = ["beds", "ed", "moves", "forms"].map((id) => page.locator(`#downtime-panel-${id}`));
      await expect(panels[0]).toBeVisible();
      for (const other of panels.slice(1)) await expect(other).toBeHidden();
      await page.getByRole("tab", { name: "ED queue" }).click();
      await expect(panels[1]).toBeVisible();
      for (const other of [panels[0], panels[2], panels[3]]) await expect(other).toBeHidden();
      await page.emulateMedia({ media: "print" });
      for (const panel of panels) await expect(panel).toBeVisible();
      await page.emulateMedia({ media: "screen" });
    });
  }
});

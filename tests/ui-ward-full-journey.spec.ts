import { expect, test, type Locator, type Page } from "playwright/test";

import { wardSites } from "@/components/ward-management/ward-sites";

/**
 * PR 46 ("Coordinator Shortlist Panel & Action Compaction") defaults the shortlist's Candidates
 * section and its Eligibility checks disclosure to closed. Open both before reading or clicking
 * inside them; idempotent, so it is safe after every queue selection.
 */
async function openShortlistSections(shortlist: Locator) {
  const toggle = shortlist.getByTestId("ward-shortlist-candidates-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const checks = shortlist.locator('details[aria-label="Eligibility checks"]');
  if ((await checks.count()) > 0 && !(await checks.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await checks.locator("summary").click();
  }
}

/**
 * The core Ward Flow journey, walked once, role by role, in one browser window.
 *
 * This is deliberately a BREADTH proof, not a duplicate of the per-screen journeys elsewhere in
 * this suite (`ui-ward-referrals.spec.ts`, `ui-ward-discharges.spec.ts`, `ui-ward-roles.spec.ts`'s
 * "Role switcher" case): those already prove each step's own detail. This proves the steps
 * CONNECT — that a coordinator can go from "a team raises a referral" to "a discharge is planned"
 * without a dead end, using only the app's own navigation (the shell rail's real `<Link>`s and the
 * role switcher's real `<Link>`s), and never a typed URL after the first one.
 *
 * Desktop width throughout (1440px), deliberately: at that width every rail destination is inline
 * (the owner-requested grouped rail, `shell/ward-rail.tsx`'s `RAIL_GROUPS`, collapses most of them
 * behind a "More pages" sheet only below 1000px), so this journey needs no "is it behind a menu"
 * branching and can concentrate on whether each step's destination actually opens the next one.
 *
 * Every rail jump below matches by `href`, never by visible label text: `RAIL_GROUPS` carries its
 * own presentation labels independent of `WARD_VIEWS` (e.g. "Movement" singular where the data
 * model says "Movements" — see `ui-ward-management.spec.ts`'s own note on the same drift), so an
 * href is the one fact both layers still agree on.
 *
 * The two "entry" steps (community, then ED) are two independent referrals for two different
 * synthetic people — there is no seeded referral a community team is currently waiting to decide
 * on, and the community screen itself has no "raise" control of its own, only "accept"/"decline"
 * on a referral naming that team. So step 1 proves the community-sourced entry path exists and
 * reaches the coordinator's board (a referral CAN be raised naming a community team as its
 * source); step 2's ED-raised referral is the one that continues, unbroken, through every
 * remaining step to discharge planning. Both are real, wired mechanisms — neither is invented for
 * this spec.
 */

const SENTINEL = "ward-flow-full-journey-sentinel";

async function plantSentinel(page: Page) {
  await page.evaluate((value) => {
    (window as unknown as Record<string, string>).__wardFlowJourneySentinel = value;
  }, SENTINEL);
}

/**
 * The intake's yes/no questions are segmented toggles since f997ac75a1 (2026-09-22): each radio is
 * visually hidden (`srOnlyRadio` — 1px, clipped, opacity 0) inside the `<label>` a person taps.
 * `.check()` aims at the 1px radio, so the wrapping label takes the hit and Playwright refuses the
 * click ("<label …toggleOption> intercepts pointer events", batch-2 run, full journey :140). So tap
 * the label — the control a person actually touches — and prove the radio took the answer. Not a
 * softening: `force: true` would skip the tappability check; this keeps it and adds a checked-state
 * assertion `.check()` only implied.
 */
async function answerToggle(page: Page, testId: string) {
  const radio = page.getByTestId(testId);
  await page.locator("label", { has: radio }).click();
  await expect(radio).toBeChecked();
}

/** Proves every step below is client-side navigation, never a full reload that would reseed the
 *  reducer back to the fixture and silently make every "the next step still shows the same
 *  record" assertion vacuous. Same discipline as `ui-ward-referrals.spec.ts`'s own sentinel. */
async function expectNoReloadSince(page: Page, step: string) {
  const survived = await page.evaluate(
    () => (window as unknown as Record<string, string | undefined>).__wardFlowJourneySentinel,
  );
  expect(survived, `the page reloaded during "${step}" — the reducer's live state was reset`).toBe(SENTINEL);
}

async function waitForScreen(page: Page, testId: string) {
  // The React-streaming staging-copy guard every other ward spec in this suite uses: the server
  // sends a hidden duplicate of the whole screen first, so a testid can resolve to two elements
  // for a moment even on a genuine, correct render.
  await expect(
    page.locator('div[hidden][id^="S:"]'),
    "React's streamed content is still staged, so the whole screen is duplicated in the document",
  ).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByTestId(testId)).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

/** Jump via the shell rail's own `<Link>`, matched by `href` — see this file's header comment on
 *  why href, not label text. */
async function goViaRail(page: Page, href: string, screenTestId: string) {
  const rail = page.getByTestId("ward-rail");
  await expect(rail, "the shell rail must be mounted on this route").toBeVisible();
  await rail.locator(`[data-testid="ward-rail-link"][href="${href}"]`).click();
  await waitForScreen(page, screenTestId);
}

/**
 * The role switcher lives inside `WardBar`'s Tools drawer (Task 8, 2026-09-11) — opening it is a
 * precondition for reaching "Change view" at all. Mirrors `ui-ward-roles.spec.ts`'s own
 * `ensureToolsOpen`/`ensureToolsClosed`, which that file's comments record the exact failure shape
 * for (the drawer covers its own trigger, so closing by re-clicking the trigger is intercepted by
 * the drawer it opened).
 */
async function ensureToolsOpen(page: Page) {
  const trigger = page.getByTestId("ward-bar-tools-trigger");
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
  await page
    .getByRole("dialog", { name: "Tools" })
    .getByRole("group", { name: "Tools sections" })
    .getByRole("button", { name: "Shift desk", exact: true })
    .click();
}

async function ensureToolsClosed(page: Page) {
  const trigger = page.getByTestId("ward-bar-tools-trigger");
  if ((await trigger.getAttribute("aria-expanded")) === "true") {
    await page.getByRole("dialog", { name: "Tools" }).getByRole("button", { name: "Close", exact: true }).click();
  }
}

/** Switches role via the real role-switcher `<Link>`s inside the Tools drawer's "Change view"
 *  menu, never a typed URL. `locator` narrows to the menu group ("Ward", "Emergency department")
 *  or the always-present item ("Coordinator", "Officer") the caller wants. */
async function switchView(page: Page, pick: (menu: Locator) => Locator, screenTestId: string) {
  await ensureToolsOpen(page);
  await page.getByRole("button", { name: /^Change view/ }).click();
  const menu = page.getByRole("menu", { name: "Change view" });
  await expect(menu).toBeVisible();
  const item = pick(menu);
  const href = await item.getAttribute("href");
  await item.click();
  // Let the navigation commit before closing the drawer. Closing it calls history.back() while the
  // drawer's own history entry is still current, so under load (a slow route fetch) an early Close
  // undid the pending navigation and the journey stayed on the previous screen (full-journey:126,
  // trace 26 September 2026).
  if (href) {
    const target = new URL(href, page.url()).pathname;
    await page.waitForURL((url) => url.pathname === target, { timeout: 15_000 });
  }
  await ensureToolsClosed(page);
  await waitForScreen(page, screenTestId);
}

test.describe("@mockup Ward Flow full journey — referral to discharge planning, one browser window", () => {
  test.describe.configure({ timeout: 120_000 });

  test("walks community intake, the ED bed request, coordinator placement, ward acceptance, transport and discharge planning without a dead end", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });

    // --- Step 1: a community team raises a referral. ---
    //
    // "Midland" is a real S2015-catchment clinic name (`ward-movements.ts` raises referrals
    // against it by that exact string, e.g. `destination: { kind: "community_team", teamName:
    // "Midland" }`), so its slug is a genuine, routable team page — not an invented id.
    await page.goto("/mockups/ward-flow/community/midland", { waitUntil: "load" });
    await waitForScreen(page, "ward-community-screen");
    await plantSentinel(page);
    await expect(page.getByText("Midland", { exact: false }).first()).toBeVisible();

    await goViaRail(page, "/mockups/ward-flow/referrals/new", "ward-referral-intake-screen");
    await expectNoReloadSince(page, "community team -> new referral");

    await page.getByTestId("ward-referral-intake-ageBand").selectOption("Adult");
    await page.getByTestId("ward-referral-intake-sex").selectOption("Female");
    // Gender ("decides which bed", T11/T10, owner answer 17 September 2026) is a separate required
    // question from Sex above it, added to REQUIRED_FIELDS after this spec was first written.
    await page.getByTestId("ward-referral-intake-gender").selectOption("Female");
    await page.getByTestId("ward-referral-intake-homeRegion").selectOption("Perth Metropolitan");
    // The source this step is actually proving: a community team raising the referral, per this
    // file's own header comment on why "raises" (not "receives") is the real, wired mechanism.
    await page.getByTestId("ward-referral-intake-source").selectOption("community");
    await page.getByTestId("ward-referral-intake-urgency").selectOption("3");
    await page.getByTestId("ward-referral-intake-originSiteCode").selectOption(wardSites[0].code);
    await answerToggle(page, "ward-referral-intake-secureBedNeeded-no");
    await answerToggle(page, "ward-referral-intake-involuntaryBedNeeded-no");
    await answerToggle(page, "ward-referral-intake-highAcuityNursingNeeded-no");
    await answerToggle(page, "ward-referral-intake-transportNeeded-no");
    await page.getByTestId("ward-referral-intake-destination-psychiatric_ward").check();
    await page.getByTestId("ward-referral-intake-suburb").selectOption("Albany");
    await page
      .getByTestId("ward-referral-intake-history")
      .fill("Known to the community team; family reports declining self-care over one week.");
    await expect(page.getByTestId("ward-referral-intake-submit")).not.toHaveAttribute("aria-disabled", "true");

    await page.getByTestId("ward-referral-intake-submit").click();
    await expect(page.getByTestId("ward-referral-intake-confirmation")).toBeVisible();
    await expect(page.getByTestId("ward-referral-intake-rejection")).toHaveCount(0);
    await expectNoReloadSince(page, "submitting the community-sourced referral");
    // Since 22 September sending opens a "Referral recorded locally" receipt, a modal dialog over
    // the whole screen. A person reads it and closes it before using the rail, so the journey does
    // the same: the receipt must appear, and must actually close.
    const receipt = page.getByRole("dialog", { name: "Referral recorded locally" });
    await expect(receipt).toBeVisible();
    await receipt.getByRole("button", { name: "Close", exact: true }).click();
    await expect(receipt).toHaveCount(0);

    await goViaRail(page, "/mockups/ward-flow/referrals", "ward-referral-board-screen");
    await expectNoReloadSince(page, "new referral -> referral board");
    // The board is what "reaches the coordinator" means here — real cards, not a table (the
    // "served register" rework, `referrals.module.css`, keeps the table mounted only for print;
    // `ward-referral-board-queued-cards` is the live representation at every width now).
    await expect(page.getByTestId("ward-referral-board-queued-cards")).toBeVisible();

    // --- Step 2: the ED raises the bed request — the referral that continues through every
    // remaining step. Peel Health Campus ED is the rail's own fixed example department, so this
    // is a real `<Link>` jump, not a typed id. ---
    await goViaRail(page, "/mockups/ward-flow/ed/peel-ed", "ward-ed-screen");
    await expectNoReloadSince(page, "referral board -> Peel ED");

    // `ward-ed-outbox-row-*` is the WRONG list to watch here: `outbox` is `patients.filter((m) =>
    // m.acceptedUnitId !== undefined)` (`ed-screen.tsx`), so a movement only appears there once a
    // ward has already accepted it — several steps after this one. The movement `RAISE_REFERRAL`
    // creates immediately shows up as a `ward-ed-patient-*` row instead: that row is keyed on
    // `filteredPatients`, which with the board's default "all" filter is just `patients` —
    // everything with this ED as `originEdId` that has not yet arrived or closed, no acceptance
    // required. Discovered by running this spec and reading the actual failure rather than assumed
    // from the source alone.
    const patientRowsBefore = new Set(
      await page
        .locator('[data-testid^="ward-ed-patient-"]')
        .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-testid") ?? "")),
    );

    await page.getByTestId("ward-ed-raise-referral-toggle").click();
    await page.getByTestId("ward-ed-referral-cohort").selectOption("Adult");
    await page.getByTestId("ward-ed-referral-security").selectOption("Open");
    await page.getByTestId("ward-ed-referral-sex").selectOption("Male");
    // Gender ("decides which bed", T11/T10, owner answer 17 September 2026) is a separate required
    // question from Sex above it, added to this form after this spec was first written.
    await page.getByTestId("ward-ed-referral-gender").selectOption("Male");
    await page.getByTestId("ward-ed-referral-legal-status").selectOption("Voluntary");
    await page.getByTestId("ward-ed-referral-urgency").selectOption("3");
    await page.getByTestId("ward-ed-referral-specialling-not-required").click();
    await page.getByTestId("ward-ed-referral-high-acuity-not-required").click();
    await page.getByTestId("ward-ed-referral-submit").click();

    const patientRowsAfter = await page
      .locator('[data-testid^="ward-ed-patient-"]')
      .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-testid") ?? ""));
    const raisedPatientIds = patientRowsAfter.filter((id) => !patientRowsBefore.has(id));
    expect(raisedPatientIds, "exactly one new movement must appear on the ED's own patient board").toHaveLength(1);
    // `ward-ed-patient-${id}` — the movement id is everything after the last hyphen-joined prefix;
    // recovered by stripping the known prefix rather than assumed from position.
    const movementId = raisedPatientIds[0]!.replace("ward-ed-patient-", "");
    expect(movementId, "the raised movement id must not be empty").not.toBe("");
    await expectNoReloadSince(page, "raising the ED referral");

    // --- Step 3: the coordinator refers it to a ward. ---
    await switchView(page, (menu) => menu.getByRole("menuitem", { name: "Coordinator" }), "ward-coordinator");
    await expectNoReloadSince(page, "ED -> coordinator");

    await page.locator(`[data-testid="ward-queue-row-${movementId}"]`).click();
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });
    await openShortlistSections(shortlist);
    await expect(shortlist).toHaveAttribute("data-subject-movement", movementId);

    const eligibleCandidate = shortlist
      .locator('[data-testid^="ward-shortlist-candidate-"][data-eligible="true"]')
      .first();
    await expect(
      eligibleCandidate,
      "no eligible ward candidate for the raised movement — the demographics chosen in step 2 must match at least one unit",
    ).toBeVisible();
    const candidateTestId = await eligibleCandidate.getAttribute("data-testid");
    const unitId = (candidateTestId ?? "").replace("ward-shortlist-candidate-", "");
    expect(unitId, "could not recover the candidate unit id from its testid").not.toBe("");

    await eligibleCandidate.click();
    const referButton = shortlist.getByTestId("ward-shortlist-refer");
    await expect(referButton).not.toHaveAttribute("aria-disabled", "true");
    await referButton.click();
    await expect(shortlist).toContainText(`Parallel referral:`);
    await expectNoReloadSince(page, "referring to a ward");

    // --- Step 4: the ward accepts. Reached via the role switcher's own real <Link>, which now
    // offers this exact unit because REFER_TO_UNITS just set it as one of this movement's
    // `referredUnitIds`. ---
    await switchView(
      page,
      (menu) => menu.locator(`a[role="menuitem"][href="/mockups/ward-flow/ward/${unitId}"]`),
      "ward-unit-screen",
    );
    await expectNoReloadSince(page, "coordinator -> ward");

    // Read via the chip's own `data-state="occupied"` attribute and its `<strong>` figure, not by
    // parsing the whole `ward-unit-beds` grid's `innerText`: the label ("Occupied") and the figure
    // sit in separate elements (`<span>Occupied</span> <strong>{capacity.occupied}</strong>`), and
    // `innerText` inserts a line break rather than a space between flex-item chips — discovered by
    // running this spec and finding a real "Occupied (\d+)" match impossible against the actual
    // rendered text, not assumed from the source alone.
    const wardScreen = page.getByTestId("ward-unit-screen");
    const occupiedChip = wardScreen.getByTestId("ward-unit-beds").locator('[data-state="occupied"] strong');
    const occupiedBeforeText = await occupiedChip.innerText();
    const occupiedBeforeCount = Number(occupiedBeforeText.trim());
    expect(
      Number.isNaN(occupiedBeforeCount),
      `could not read the ward's own Occupied figure before admission (got "${occupiedBeforeText}")`,
    ).toBe(false);

    // v6 ward home: Awaiting your answer is its own card beside Every bed, always shown (no switch).
    const acceptButton = wardScreen.getByTestId(`ward-accept-${movementId}`);
    await expect(acceptButton).toBeVisible();
    await expect(acceptButton).not.toHaveAttribute("aria-disabled", "true");
    await acceptButton.click();

    // --- Step 5: the ward pulls the patient (the app's own bed-pull action — see this file's
    // header comment on "receives or raises": here too, the real mechanism is what this spec
    // follows even where the brief's plain-English step name suggests a different role). The pull
    // control sits outside the "Update ward figures and bed records" disclosure (unlike the
    // capacity-confirmation and bed-release forms `ui-ward-discharges.spec.ts`/
    // `ui-ward-roles.spec.ts` open first), so no extra click is needed to reach it. ---
    await page.locator("#tabBtn-coming").click();
    const pullButton = wardScreen.getByTestId(`ward-pull-${movementId}`);
    await expect(pullButton).toBeVisible();
    await expect(pullButton).not.toHaveAttribute("aria-disabled", "true");
    await pullButton.click();
    await expect(pullButton).toHaveCount(0);
    await expectNoReloadSince(page, "the ward accepting and pulling");

    // --- Step 6: transport is booked (by the ED — `BOOK_TRANSPORT`'s only real dispatch site),
    // then the officer accepts, departs (en route) and arrives. ---
    await switchView(
      page,
      (menu) => menu.getByRole("group", { name: "Emergency department" }).getByRole("menuitem"),
      "ward-ed-screen",
    );
    await expectNoReloadSince(page, "ward -> ED for transport booking");

    const edScreen = page.getByTestId("ward-ed-screen");
    const unfoldEd = edScreen.getByTestId(`ward-ed-unfold-${movementId}`);
    if (await unfoldEd.isVisible()) await unfoldEd.click();
    await edScreen.getByTestId(`ward-ed-book-transport-toggle-${movementId}`).click();
    await page.getByTestId(`ward-ed-transport-provider-${movementId}`).selectOption("Patient transport service");
    await page.getByTestId(`ward-ed-transport-escort-no-${movementId}`).click();
    // Owner's third ruling, 2026-09-17: the three facts logged from the phone call, required and
    // never defaulted — the popup's whole reason to exist.
    await page.getByTestId(`ward-ed-transport-cad-number-${movementId}`).fill("CAD-JOURNEY-0001");
    await page.getByTestId(`ward-ed-transport-legal-status-voluntary-${movementId}`).click();
    await page.getByTestId(`ward-ed-transport-estimated-time-${movementId}`).fill("14:30");
    await page.getByTestId(`ward-ed-book-transport-confirm-${movementId}`).click();

    const handoverButton = edScreen.getByTestId(`ward-ed-handover-${movementId}`);
    await expect(handoverButton).not.toHaveAttribute("aria-disabled", "true");
    if ((await unfoldEd.getAttribute("aria-expanded")) !== "true") await unfoldEd.click();
    await handoverButton.click();
    await expectNoReloadSince(page, "booking transport and marking handover ready");

    await switchView(page, (menu) => menu.getByRole("menuitem", { name: "Officer" }), "ward-officer-screen");
    await expectNoReloadSince(page, "ED -> officer");

    const officerScreen = page.getByTestId("ward-officer-screen");
    const jobCard = officerScreen.getByTestId(`ward-officer-job-${movementId}`);
    await expect(jobCard, "the booked job must appear in the officer's own list").toBeVisible();
    await officerScreen.getByTestId(`ward-officer-select-${movementId}`).click();

    const acceptTransport = jobCard.getByTestId(`ward-officer-accept-${movementId}`);
    await expect(acceptTransport).not.toHaveAttribute("aria-disabled", "true");
    await acceptTransport.click();

    const enRoute = jobCard.getByTestId(`ward-officer-enroute-${movementId}`);
    await expect(enRoute).not.toHaveAttribute("aria-disabled", "true");
    await enRoute.click();

    const collected = jobCard.getByTestId(`ward-officer-collect-${movementId}`);
    await expect(collected).not.toHaveAttribute("aria-disabled", "true");
    await collected.click();

    const arrived = jobCard.getByTestId(`ward-officer-arrive-${movementId}`);
    await expect(arrived).not.toHaveAttribute("aria-disabled", "true");
    await arrived.click();
    await expectNoReloadSince(page, "the officer's transport steps");

    // --- Step 7: the patient is admitted on the ward. `PATIENT_ARRIVED` closes the movement's
    // record — "the bed shows as occupied in the grid above, not as a card" (`ward-screen.tsx`'s
    // own comment on `accepted`) — so the proof is the ward's own Occupied figure moving, not a
    // card that (correctly) stops existing.
    //
    // This cannot be one direct role-switcher hop from the officer screen. Owner answer 38
    // (2026-09-17, `ward-role-switcher.tsx`): the switcher's "Ward" group only names a candidate
    // ward — and only renders a real `<Link>` for one — while the CURRENT route is a coordinator
    // route (`wardChromeRole(pathname) === "coordinator"`); everywhere else, including the
    // officer's own screen, it shows a disabled placeholder pointing back at the coordinator view
    // instead. Discovered by running this spec: the direct hop timed out waiting for a menu item
    // that this same ruling means never renders off the coordinator route. So this step goes
    // through the coordinator first — a real intermediate hop, not a shortcut around the ruling —
    // then on to the ward from there, exactly like step 4 did. ---
    await switchView(page, (menu) => menu.getByRole("menuitem", { name: "Coordinator" }), "ward-coordinator");
    await expectNoReloadSince(page, "officer -> coordinator, on the way to the ward");

    await switchView(
      page,
      (menu) => menu.locator(`a[role="menuitem"][href="/mockups/ward-flow/ward/${unitId}"]`),
      "ward-unit-screen",
    );
    await expectNoReloadSince(page, "coordinator -> ward for admission");

    const wardScreenAfterArrival = page.getByTestId("ward-unit-screen");
    await expect(wardScreenAfterArrival.getByTestId(`ward-pull-${movementId}`)).toHaveCount(0);
    await expect(wardScreenAfterArrival.getByTestId("ward-unit-beds")).toContainText(
      `Occupied ${occupiedBeforeCount + 1}`,
    );

    // --- Step 8: a discharge is planned — the ward flags a bed coming free, the real, wired
    // "plan a discharge" mechanism (the discharges board's own "+ Plan departure" button is
    // explicitly unwired: `title="Not wired in this prototype."`, D4). The bed-release form sits
    // on the ward screen's Decisions tab (3ac951fcd1 split the screen into tabs; 53105ca6ea removed
    // the old "Update ward figures" disclosure), opened the way `ui-ward-discharges.spec.ts`'s
    // `openBedRecordsTab` does. ---
    // 🔴 CHANGED 25 September 2026 (Josh chose "Refuse"): a bed release must name the patient whose
    // stay it belongs to, and this form has no patient picker yet, so planning a discharge here is
    // refused with a plain message and records nothing. When the picker lands, restore: choose the
    // patient, submit, and exactly one new bed-release row appears.
    const releaseRows = wardScreenAfterArrival.locator('[data-testid^="ward-today-release-"]');
    const releaseCountBefore = await releaseRows.count();

    const decisionsTab = page.getByRole("tab", { name: "Decisions (Ward record)" });
    await decisionsTab.click();
    await expect(decisionsTab).toHaveAttribute("aria-selected", "true");
    await expect(wardScreenAfterArrival.getByRole("heading", { name: "Staffing", exact: true })).toBeVisible();
    await expect(wardScreenAfterArrival.locator("#ward-bed-release-waiting-on")).toHaveCount(0);
    await expect(wardScreenAfterArrival.getByTestId("ward-flag-bed-release-submit")).toHaveCount(0);
    await expect(page.getByText("Choose the patient whose bed is coming free. Nothing was recorded.")).toHaveCount(0);
    await expect(releaseRows, "opening Decisions records no bed release").toHaveCount(releaseCountBefore);
    await expectNoReloadSince(page, "planning the discharge");
  });
});

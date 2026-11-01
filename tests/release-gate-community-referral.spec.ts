import { expect, test, type Locator, type Page } from "playwright/test";

import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import { unitHasOpenBeds } from "@/components/ward-management/ward-bed-designation";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { unitById, wardSites } from "@/components/ward-management/ward-sites";

import {
  expectAccessible,
  expectNoReloadSince,
  goToDesk,
  goViaNav,
  isPhoneLayout,
  openWardList,
  plantSentinel,
  waitForScreen,
  wardDesk,
} from "./helpers/ward-release-gate";
import { showEveryoneWaitingOn } from "./helpers/ward-home-page";
import { wardChoiceName } from "./helpers/ward-choice-name";

/**
 * Release gate: a community mental health team refers a person for a bed from its own desk.
 *
 * The team (Midland) opens the referral slide-out from its own page with "Refer from team", which
 * names the team as the referring community service. It addresses one ward and records that no
 * transport is needed (patient or carer accompanied). The coordinator sees the referral on Home,
 * "sent by" the team, and on the Referral board, where the ward the team asked is shown to accept
 * it. The ward answers from its own desk: on its Bed board it picks the referral up and places it
 * in a free bed, which accepts the referral and holds that bed. The coordinator's board then lists
 * it as accepted at that ward, and the team's own desk is unchanged: the referral went to a ward,
 * so it never joins the team's own "waiting for your answer" queue.
 *
 * D-76 (fix plan item 15): the accepting ward then starts the journey from its own desk. It starts
 * at the referring team, with no ED. The coordinator's Movements board names the team, and the
 * ward pulls the bed and confirms arrival. The team recorded that a carer brings the patient, so
 * no transport is booked. Acceptance alone still moves nobody, as the board's note says.
 *
 * What this journey cannot drive, because the product does not have it (source, not taste):
 * - No coordinator "ask wards" act for a referral. The referrer names the wards in the slide-out;
 *   `REFER_TO_UNITS` works on movements only. The coordinator reviews the named ward here.
 * - The team's own "Referrals we have made" list (fix plan item 17) is covered by unit and DOM
 *   tests (`tests/ward-community-sent-referrals.test.ts`, `tests/ward-community-hub.dom.test.tsx`),
 *   not by this journey yet.
 *
 * Runs on the release-gate projects (desktop Chrome 1440px, phone WebKit 390x844) with an axe WCAG
 * 2.1 AA check at each key step. One typed URL, then only the app's own links, drawers and desks,
 * so every later screen reads the same live state. Synthetic data only.
 */

// The journey runs from referral to arrival across five desks, so it gets more time than one screen.
test.describe.configure({ timeout: 300_000 });

/** The team page the journey starts from: a clinic the catchment table names. */
const TEAM_ID = "midland";
/** The ward the team asks: an Adult unit with open (unlocked) beds, so the slide-out offers it. */
const UNIT_ID = "scgh-adult-open";
/** The synthetic person, registered inside the slide-out. */
const PERSON = { familyName: "Communitygate", givenName: "Synthetic", umrn: "UM990741" } as const;

/** Every referral the app starts with, so the one this journey raises is found by difference. */
const SEEDED_REFERRAL_IDS = new Set(seedWardFlowState().referrals.map((referral) => referral.id));

/**
 * The slide-out's radios and checkboxes sit inside the label a person taps, several visually
 * hidden behind a segmented or tile face. Tap the label and prove the control took the answer.
 */
async function tapChoice(control: Locator) {
  await control.locator("xpath=ancestor::label[1]").click();
  await expect(control).toBeChecked();
}

/** A tiny synthetic PDF: the slide-out checks only the type and size. */
function syntheticChart(name: string) {
  return { name, mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.7\nSynthetic demo chart: ${name}\n`) };
}

/** Opens one section of the slide-out. On a phone an open section is closed first. */
async function openReferralStep(sheet: Locator, name: string) {
  const close = sheet.getByRole("button", { name: "Close step", exact: true });
  if (await close.isVisible()) await close.click();
  await sheet.getByRole("group", { name: "Referral sections" }).getByRole("button", { name, exact: true }).click();
}

/**
 * How many referrals wait for this team's own answer, as its desk shows it: the Referrals count in
 * the team's section row, a tab on desktop (locked design, 1 Nov 2026) and a section-track radio on
 * the Midland phone page (Q155).
 */
async function teamWaitingCount(page: Page): Promise<number> {
  const screen = page.getByTestId("ward-community-screen");
  const control = screen.getByRole(isPhoneLayout(page) ? "radio" : "tab", { name: /^Referrals/u });
  await expect(control).toBeVisible();
  const text = (await control.innerText()).trim();
  const match = /(\d+)/u.exec(text);
  return match ? Number(match[1]) : 0;
}

/** The ids of the referrals in the coordinator Home's Referrals queue. */
async function homeReferralIds(page: Page): Promise<string[]> {
  return page
    .locator('[data-testid^="ward-referral-row-"]')
    .evaluateAll((rows) =>
      rows.map((row) => (row.getAttribute("data-testid") ?? "").replace("ward-referral-row-", "")),
    );
}

test("Community referral: a community team refers from its own desk, the ward it asked accepts into a held bed, and the coordinator's board and the team's desk agree", async ({
  page,
}, testInfo) => {
  const team = communityTeamById(TEAM_ID);
  expect(team, `fixture assumption: ${TEAM_ID} is a community team page`).not.toBeNull();
  const unit = unitById(UNIT_ID);
  expect(unit?.cohort, `fixture assumption: ${UNIT_ID} is an Adult unit`).toBe("Adult");
  expect(unitHasOpenBeds(unit!), `fixture assumption: ${UNIT_ID} has an open bed`).toBe(true);
  const teamName = team!.name;
  const unitName = unit!.name;

  // --- The community team's own desk: the one typed URL. ---
  await page.goto(`/ward-flow/community/${TEAM_ID}`, { waitUntil: "load" });
  await waitForScreen(page, "ward-community-screen");
  await plantSentinel(page);
  const teamUrl = page.url();
  const waitingBefore = await teamWaitingCount(page);
  await expectAccessible(page, testInfo, "community team desk");

  // --- The team refers from its own desk. The slide-out opens over the team page. ---
  // On the Midland phone page (Q155) Refer from team is the Referrals section's hero action.
  if (isPhoneLayout(page))
    await page
      .getByTestId("ward-community-screen")
      .getByRole("radio", { name: /^Referrals/u })
      .click();
  await page.getByRole("button", { name: "Refer from team", exact: true }).click();
  const sheet = page.getByTestId("ward-bar-referral-sheet");
  await expect(sheet).toBeVisible({ timeout: 15_000 });
  expect(page.url(), "opening the referral slide-out must not leave the team page").toBe(teamUrl);

  await sheet.getByTestId("ward-referral-refer-to-ward").click();
  await expect(sheet.getByTestId("ward-referral-refer-to-ward")).toHaveAttribute("aria-pressed", "true");

  await openReferralStep(sheet, "Patient");
  await sheet.getByTestId("ward-referral-new-patient-toggle").click();
  const newPatient = sheet.getByTestId("ward-referral-new-patient");
  await newPatient.getByLabel("Family name", { exact: true }).fill(PERSON.familyName);
  await newPatient.getByLabel("Given name", { exact: true }).fill(PERSON.givenName);
  await newPatient.getByLabel("Date of birth", { exact: true }).fill("1990-01-02");
  await newPatient.getByLabel("UMRN", { exact: true }).fill(PERSON.umrn);
  await newPatient.getByLabel("Suburb", { exact: true }).fill("Albany");
  await newPatient.getByRole("button", { name: "Add patient" }).click();
  await expect(newPatient).toHaveCount(0);
  await expect(sheet).toContainText(`${PERSON.familyName}, ${PERSON.givenName}`);
  await sheet.getByLabel("Age band", { exact: true }).selectOption("Adult");
  await sheet.getByLabel("Home region", { exact: true }).selectOption("Perth Metropolitan");
  await sheet.getByRole("button", { name: "Confirm catchment" }).click();

  // The team's desk opened the slide-out as a community referral naming this team.
  await openReferralStep(sheet, "Referral");
  await expect(
    sheet.getByRole("group", { name: "Source" }).getByRole("button", { name: "Community", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(sheet.getByLabel("Referring community service", { exact: true })).toHaveValue(teamName);
  await sheet.getByLabel("Referring service location", { exact: true }).selectOption(wardSites[0].code);
  await sheet.getByLabel("Legal status", { exact: true }).selectOption("Voluntary");
  await tapChoice(sheet.getByRole("group", { name: "Bed security" }).getByRole("radio", { name: "Open", exact: true }));
  await tapChoice(sheet.getByRole("radio", { name: urgencyTierLabel(3), exact: true }));
  await sheet.getByLabel("Recorded sex", { exact: true }).selectOption("Male");
  await sheet.getByLabel("Gender identity", { exact: true }).selectOption("Male");
  await expect(sheet.getByRole("switch", { name: "High-acuity nursing" })).toHaveAttribute("aria-checked", "false");
  await sheet
    .getByLabel("Patient story", { exact: true })
    .fill("Synthetic story: known to the community team, relapse over two weeks.");

  await openReferralStep(sheet, "Clearance");
  await tapChoice(
    sheet.getByRole("group", { name: "Has the patient been medically cleared?" }).getByRole("radio", { name: "Yes" }),
  );
  await tapChoice(sheet.getByRole("group", { name: "Triage and RAMP completed" }).getByRole("radio", { name: "Yes" }));
  await sheet.getByLabel("Medication chart", { exact: true }).setInputFiles(syntheticChart("medication-chart.pdf"));
  await sheet.getByLabel("Observation chart", { exact: true }).setInputFiles(syntheticChart("observation-chart.pdf"));
  await expect(sheet.getByRole("button", { name: "Replace" })).toHaveCount(2);
  await tapChoice(sheet.getByRole("group", { name: "Anything else to attach?" }).getByRole("radio", { name: "No" }));

  // The ward the team asks, and no transport needed: the patient or a carer brings them.
  await openReferralStep(sheet, "Wards");
  const wards = sheet.getByRole("list", { name: "Placement Destination Options" });
  await tapChoice(wards.getByRole("checkbox", { name: wardChoiceName(UNIT_ID) }));
  await sheet.getByLabel("Transport", { exact: true }).selectOption("Family or carer");
  await expectAccessible(page, testInfo, "referral slide-out, ward and transport chosen");

  await sheet.getByRole("button", { name: "Send referral", exact: true }).click();
  await expect(sheet.getByRole("heading", { name: "Confirm and send" })).toBeVisible();
  // The sheet moves focus to this heading a frame later. A fill that starts first loses its text when it lands.
  await expect(sheet.getByRole("heading", { name: "Confirm and send" })).toBeFocused();
  await sheet.getByLabel("Your name", { exact: true }).fill("Synthetic Referrer");
  await sheet.getByLabel("Email address", { exact: true }).fill("referrer@example.org");
  await sheet.getByLabel("Phone number", { exact: true }).fill("0412345678");
  await sheet.getByLabel("Your role", { exact: true }).fill("Community mental health nurse");
  await sheet.getByLabel("Location or service", { exact: true }).fill(teamName);
  // Every contact field still holds what was typed, and the send is live, before it is pressed.
  await expect(sheet.getByLabel("Your name", { exact: true })).toHaveValue("Synthetic Referrer");
  await expect(sheet.getByLabel("Email address", { exact: true })).toHaveValue("referrer@example.org");
  await expect(sheet.getByLabel("Phone number", { exact: true })).toHaveValue("0412345678");
  await expect(sheet.getByLabel("Your role", { exact: true })).toHaveValue("Community mental health nurse");
  await expect(sheet.getByLabel("Location or service", { exact: true })).toHaveValue(teamName);
  const confirmSend = sheet.getByRole("button", { name: "Confirm and send", exact: true });
  await expect(confirmSend).toBeEnabled();
  await expect(confirmSend).not.toHaveAttribute("aria-disabled", "true");
  await confirmSend.click();
  // A refusal renders as the footer's alert, a separate element from the sent heading. Wait for
  // either, so a refusal fails here with its own words rather than as a missing heading.
  const sentHeading = sheet.getByRole("heading", { name: "Referral sent" });
  const refusal = sheet.getByRole("alert");
  await expect(sentHeading.or(refusal).first()).toBeVisible({ timeout: 15_000 });
  expect(await refusal.allInnerTexts(), "the send must not be refused").toEqual([]);
  await expect(sentHeading).toBeVisible();
  await expectAccessible(page, testInfo, "referral sent receipt");
  await sheet.getByRole("button", { name: "Done", exact: true }).click();
  await expect(sheet).toHaveCount(0);
  expect(page.url(), "sending must leave the team on its own page").toBe(teamUrl);
  await expectNoReloadSince(page, "the team sending its referral");

  // --- The coordinator's Home: the referral is queued, sent by the team. ---
  await goToDesk(page, (drawer) => drawer.getByTestId("workstation-open-coordinator"), "ward-coordinator");
  // Home v7 (Josh, 22 Oct 2026): Home opens on My list; the queue's Referrals tab is under
  // Everyone waiting.
  await showEveryoneWaitingOn(page);
  await page.getByRole("radio", { name: /^Referrals/u }).click();
  await expect
    .poll(async () => (await homeReferralIds(page)).filter((id) => !SEEDED_REFERRAL_IDS.has(id)), {
      message: "exactly one new referral must reach the coordinator's Referrals queue",
    })
    .toHaveLength(1);
  const referralId = (await homeReferralIds(page)).find((id) => !SEEDED_REFERRAL_IDS.has(id))!;
  const homeRow = page.getByTestId(`ward-referral-row-${referralId}`);
  await expect(homeRow).toContainText(`sent by ${teamName}`);
  await expect(homeRow).toContainText("Adult · Perth Metropolitan");
  await expectAccessible(page, testInfo, "coordinator Home with the team's referral queued");
  await homeRow.click();
  const placement = page.getByTestId(`ward-referral-placement-${referralId}`);
  await expect(placement).toBeVisible();
  await expect(placement).toContainText(PERSON.umrn);
  await expectAccessible(page, testInfo, "coordinator referral placement");
  // On a phone the panel is a bottom sheet over the page; close it, as a coordinator would.
  if (isPhoneLayout(page)) {
    await page.getByRole("button", { name: "Close shortlist and clear selection" }).click();
    await expect(placement).toHaveCount(0);
  }

  // --- The Referral board: queued, no transport asked for, and the asked ward accepts it. ---
  await goViaNav(page, "/ward-flow/referrals", "ward-referral-board-screen");
  const boardEntry = page
    .locator(
      `[data-testid="ward-referral-board-row-${referralId}"], [data-testid="ward-referral-board-card-select-${referralId}"]`,
    )
    .filter({ visible: true });
  await expect(boardEntry).toHaveCount(1);
  await expect(boardEntry).toContainText(`${PERSON.familyName}, ${PERSON.givenName}`);
  // Desktop names each recorded need ("Transport requested"); the phone card counts them.
  await expect(boardEntry).not.toContainText(/Transport requested|\d+ needs?\b/u);
  await expectAccessible(page, testInfo, "referral board with the team's referral queued");
  await boardEntry.click();
  await expectAccessible(page, testInfo, "referral board, the team's referral open");
  // Both layouts list the ward as a "Fits" candidate in the one decision list (D-77).
  await expect(page.getByTestId("ward-referral-match-panel")).toBeVisible();
  await expect(page.getByTestId(`ward-referral-match-phone-cand-${UNIT_ID}`)).toHaveAttribute("data-kind", "yes");
  const closeDetail = page.getByRole("button", { name: "Close referral detail (Esc)" });
  if (await closeDetail.isVisible()) await closeDetail.click();
  await expectNoReloadSince(page, "the coordinator reviewing the referral");

  // --- The ward answers from its own desk: accept into a held bed on its Bed board. ---
  await goToDesk(page, wardDesk(UNIT_ID, unitName), "ward-unit-screen");
  const inbox = page.getByRole("region", { name: "Ward referral inbox" });
  const inboxEntry = inbox.locator("article").filter({ hasText: PERSON.umrn });
  await expect(inboxEntry).toContainText("Awaiting review");
  await expectAccessible(page, testInfo, "ward desk with the team's referral in its inbox");
  await page.getByTestId("ward-open-bed-board").click();
  const pick = page.getByTestId(`ward-board-pick-${referralId}`);
  await expect(pick).toBeVisible();
  await pick.click();
  await expect(pick).toHaveAttribute("aria-pressed", "true");
  const freeBed = page.locator('[data-testid^="ward-board-bed-"][data-fits="true"]').first();
  await expect(freeBed, `${unitName} must have a free bed that fits the referral`).toBeVisible();
  const bedTestId = (await freeBed.getAttribute("data-testid"))!;
  await expectAccessible(page, testInfo, "ward Bed board with the referral picked up");
  await freeBed.click();
  await expect(page.getByTestId("ward-board-say")).toContainText("Referral accepted.");
  await expect(page.getByTestId(bedTestId)).toHaveAttribute("data-state", "held");
  // H-0893: an answered referral folds behind "Show N answered" below the waiting ones.
  await inbox.getByRole("button", { name: /^Show \d+ answered$/ }).click();
  await expect(inboxEntry).toContainText("Accepted");
  await expectAccessible(page, testInfo, "ward Bed board after accepting into a held bed");
  await expectNoReloadSince(page, "the ward accepting into a held bed");

  // --- The coordinator's board shows the ward's answer. ---
  await goToDesk(page, (drawer) => drawer.getByTestId("workstation-open-coordinator"), "ward-coordinator");
  await goViaNav(page, "/ward-flow/referrals", "ward-referral-board-screen");
  await page
    .getByTestId("ward-referral-board-screen")
    .getByRole("tab", { name: /^History/u })
    .click();
  const decided = page
    .locator(
      `[data-testid="ward-referral-board-decided-row-${referralId}"], [data-testid="ward-referral-board-decided-card-${referralId}"]`,
    )
    .filter({ visible: true });
  await expect(decided).toHaveCount(1);
  await expect(decided).toContainText("Accepted");
  await expect(decided).toContainText(unitName);
  // Acceptance records the decision only: the ward starts the journey as its own step (see the header).
  const decidedNote = page.getByTestId("ward-referral-board-decided-note");
  await expect(decidedNote).toContainText("No bed is pulled");
  await expect(decidedNote).toContainText("no transport is arranged");
  await expectAccessible(page, testInfo, "referral board history with the ward's acceptance");
  await expectNoReloadSince(page, "returning to the referral board");

  // --- Back at the team's desk: nothing claims the referral waits on the team. ---
  await goToDesk(page, wardDesk(TEAM_ID, teamName), "ward-community-screen");
  expect(page.url(), "the desk drawer must bring the team back to its own page").toBe(teamUrl);
  expect(await teamWaitingCount(page), "a referral sent to a ward never joins the team's own answer queue").toBe(
    waitingBefore,
  );
  await expectAccessible(page, testInfo, "community team desk after the ward's acceptance");
  await expectNoReloadSince(page, "returning to the team's desk");

  // --- D-76: the ward starts the journey from the team, pulls the bed and confirms arrival. ---
  await goToDesk(page, wardDesk(UNIT_ID, unitName), "ward-unit-screen");
  await page.getByTestId("ward-open-bed-board").click();
  const awaiting = page.getByRole("region", { name: "Accepted referrals awaiting placement" });
  await expect(awaiting).toContainText(`${PERSON.givenName} ${PERSON.familyName}`);
  // No ED is named, so the ward's own desk may start it: never "Ask the flow coordinator".
  await expect(awaiting.getByTestId("ward-accepted-placement-coordinator")).toHaveCount(0);
  await expectAccessible(page, testInfo, "ward board with the accepted community referral to start");
  await awaiting.getByRole("button", { name: "Start placement", exact: true }).click();
  await awaiting.getByRole("combobox", { name: /^Legal status/u }).selectOption("Voluntary");
  await awaiting.getByRole("combobox", { name: /^Legal form/u }).selectOption("none");
  await awaiting.getByRole("combobox", { name: /^Observation level/u }).selectOption("general");
  await awaiting.getByRole("button", { name: "Confirm and start placement", exact: true }).click();
  await expect(awaiting).toHaveCount(0);
  await expectNoReloadSince(page, "the ward starting the community journey");

  await openWardList(page, "Admissions");
  const wardScreen = page.getByTestId("ward-unit-screen");
  const pull = wardScreen.locator('[data-testid^="ward-pull-"]').filter({ visible: true });
  await expect(pull, "the started journey is the ward's one bed to pull").toHaveCount(1);
  const movementId = ((await pull.getAttribute("data-testid")) ?? "").replace("ward-pull-", "");
  expect(movementId).not.toBe("");
  await expectAccessible(page, testInfo, "ward admissions with the community journey to pull");
  await pull.click();
  await expect(page.getByTestId(`ward-pull-${movementId}`)).toHaveCount(0);
  await expectNoReloadSince(page, "the ward pulling the bed");

  // The coordinator's Movements board names the team as where the journey starts.
  await goToDesk(page, (drawer) => drawer.getByTestId("workstation-open-coordinator"), "ward-coordinator");
  await goViaNav(page, "/ward-flow/movements", "ward-movements-page");
  // The worklist search reads the origin as the board names it: exactly this journey matches.
  const board = page.getByTestId("ward-movements-page");
  await board.getByRole("searchbox", { name: "Find movements by name, UMRN or ED" }).fill(`${teamName} (community)`);
  await expect(board.getByText(/^1 of \d+ match, highlighted$/u).first()).toBeVisible();
  await expectAccessible(page, testInfo, "movements board with the community journey");
  await expectNoReloadSince(page, "opening the movements board");

  // The carer brings the patient, so the ward confirms arrival straight from the pulled bed.
  await goToDesk(page, wardDesk(UNIT_ID, unitName), "ward-unit-screen");
  await openWardList(page, "Admissions");
  const arrive = page.getByTestId(`ward-confirm-arrival-${movementId}`);
  await expect(arrive).not.toHaveAttribute("aria-disabled", "true");
  await arrive.click();
  // With no fit-to-travel record the ward is asked why, and records a reason. Never blocked.
  const arriveCheck = page.getByTestId("ward-arrive-check");
  if (
    await arriveCheck
      .waitFor({ state: "visible", timeout: 2_000 })
      .then(() => true)
      .catch(() => false)
  ) {
    await page.getByTestId("ward-arrive-check-reason").selectOption({ index: 1 });
    await arriveCheck.getByRole("button", { name: /record reason/u }).click();
  } else {
    // Walk-through WT-11: with nothing open, the ward still checks the name and UMRN first.
    await page.getByTestId("ward-arrival-identity").getByRole("button", { name: "Confirm arrival" }).click();
  }
  await expect(arrive).toHaveCount(0);
  await expectAccessible(page, testInfo, "ward admissions after the community arrival");
  await expectNoReloadSince(page, "confirming the community arrival");
});

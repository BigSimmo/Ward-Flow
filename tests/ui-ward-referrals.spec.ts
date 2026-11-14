import { expect, test, type Locator, type Page } from "playwright/test";

import {
  NOT_RECORDED_LABEL,
  SYNTHETIC_TRAVEL_TIMES_NOTICE,
  TRAVEL_BAND_LABELS,
  travelBand,
} from "@/components/ward-management/ward-distance";
import { unitHasOpenBeds } from "@/components/ward-management/ward-bed-designation";
import { HOME_REGIONS, type UrgencyLevel } from "@/components/ward-management/ward-model";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { referrals } from "@/components/ward-management/ward-movements";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import {
  RECENTLY_DECIDED_DISPLAY_LIMIT,
  recentlyDecidedReferrals,
  referralQueueOrder,
} from "@/components/ward-management/ward-referrals";
import { allUnits, unitById, wardSites } from "@/components/ward-management/ward-sites";
import { wardChoiceName } from "./helpers/ward-choice-name";
import { openPhoneMenuMorePages } from "./helpers/ward-release-gate";

/**
 * Task 7 (Phase 7, "The front door"). One journey: a referral is raised at PHONE WIDTH in the
 * referral slide-out (`ward-bar-referral-sheet`, the one place a referral is written since 8 October
 * 2026, when the full-page intake form was retired), appears on the coordinator's board
 * (`/ward-flow/referrals`), is matched against the whole network, and is accepted — and
 * the board reflects every one of those steps on the very next render, with **no `page.goto()`
 * anywhere after the first navigation**.
 *
 * The no-reload rule is the whole point, and it is the same one `ui-ward-discharges.spec.ts`
 * states for its own journey: a `goto` is a full page load that re-mounts `WardFlowProvider`
 * (mounted once in `src/app/ward-flow/layout.tsx`, above every ward route) and resets
 * every referral back to the seed fixture. Every assertion below would then pass whether or not
 * the slide-out's `RECEIVE_REFERRAL` ever reached the coordinator's board at all. Because
 * "I did not call `goto`" is a claim about the test rather than about the browser, the journey
 * also plants `__wardFlowJourneySentinel` on `window` immediately after the single navigation and
 * re-checks it after each route change: a full document load clears it, so an accidentally
 * reintroduced reload fails loudly here rather than silently making the journey vacuous.
 *
 * Navigation is the app's own, never a typed URL — the board's "New referral" `<Link>`
 * (`referral-board.tsx`), which the shell bar opens as the slide-out in place, on the way in, and
 * the coordinator's own navigation rail on the way back.
 *
 * ⚠️ **WHAT "THE RAIL" MEANS AT PHONE WIDTH CHANGED ON 2026-09-11.** It used to be `ClinicalRail`'s
 * phone bar — an "Open Ward Flow menu" button and the drawer it opened — with the desktop icon rail
 * and the expanded sidebar panel both still in the DOM at 375px, CSS-hidden, which is why every
 * rail assertion here was scoped to the drawer's `role="dialog"`. `ClinicalRail` is mounted nowhere
 * in `src/` any more. `shell/ward-rail.tsx` mounts once in the ward layout and below 1000px reflows
 * to a wrapping row of the same links, visible on the page, so the journeys tap the link directly
 * and scope to `ward-rail` — of which there is now provably exactly one
 * (`tests/ui-ward-chrome-header.spec.ts`).
 *
 * Phone width throughout, deliberately (spec D12): a police or ambulance officer raising a
 * referral is standing in someone's living room, not sitting at a desk. At 375px the board's two
 * sections render their card lists and hide their tables (`referrals.module.css`'s
 * `@media (max-width: 40rem)` swap), so this journey drives the CARD controls — the ones a phone
 * user can actually touch — never the table rows, which are `display: none` here.
 */

/** The referral this journey raises. Adult / Male, needing neither a secure bed nor one that can
 *  hold someone involuntarily, at the most urgent tier. Chosen so the dimension that decides the
 *  outcome below is the interesting one — sex designation — rather than security or legal status,
 *  which would exclude most of the network before that was reached.
 *
 *  Since 8 October 2026 the referral is raised in the referral slide-out (`ward-referral-drawer.tsx`),
 *  the one place a referral is written. Its source is Community: the slide-out offers Emergency or
 *  Community, and the retired form's "police" source has no control there. */
const RAISED = {
  ageBand: "Adult",
  sex: "Male",
  // T11/T10 (owner answer 17 September 2026): a separate question from Sex, answered in the
  // slide-out's own "Gender identity" select rather than left to the patient record.
  gender: "Male",
  homeRegion: "Perth Metropolitan",
  urgency: "1",
} as const;

/**
 * The slide-out's radios and switches sit inside the `<label>` a person taps, and several are
 * visually hidden behind a segmented or tile face. So tap the label — the control a person
 * actually touches — and prove the control took the answer. Not a softening: `force: true` would
 * skip the tappability check; this keeps it and adds the checked-state assertion.
 */
async function tapChoice(control: Locator) {
  // The nearest enclosing label, found from the control itself: a `has:` filter would re-resolve
  // the control's whole chain (from the sheet) inside each label and match nothing.
  await control.locator("xpath=ancestor::label[1]").click();
  await expect(control).toBeChecked();
}

/** A tiny synthetic PDF: the slide-out reads the bytes and checks only the type and size. */
function syntheticChart(name: string) {
  return { name, mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.7\nSynthetic demo chart: ${name}\n`) };
}

type SlideOutReferral = {
  /** A synthetic person registered inside the slide-out ("Add patient"), so the age band is the
   *  journey's own choice rather than the one a sample movement already carries. */
  patient: { familyName: string; givenName: string; umrn: string };
  ageBand: string;
  homeRegion: string;
  sex: string;
  gender: string;
  urgency: UrgencyLevel;
  bedSecurity: "Open" | "Secure";
  highAcuityNursing: boolean;
  /** Mental Health Transport needs transport; Family or carer does not. */
  transport: "Mental Health Transport" | "Family or carer";
  /** The wards the referral is addressed to, in the order they are ticked. */
  unitIds: readonly string[];
  /** Units the Wards step must NOT offer for this person (asserted before ticking). */
  notOffered?: readonly string[];
};

/**
 * Raises one referral to named wards through the referral slide-out, answering every question its
 * Send checks — patient, catchment, home region, source, urgency, legal status, bed security, bed
 * requirements, clearance, triage, both charts and the attachments question — then confirms with
 * the sender's contact details. Ends on "Referral sent" and closes the slide-out with Done.
 *
 * Each answer is chosen here rather than inherited from a sample patient, for the reason the
 * retired intake helper gave: a journey that leans on defaults is pinned to behaviour nobody chose.
 */
/**
 * v10 phone (11 Oct 2026): a step opens as a sheet over the step list, so the next step is chosen
 * after closing the open one ("Close step"), as a person does. Above the phone the steps sit beside
 * the form and there is nothing to close.
 */
async function openReferralStep(sheet: Locator, name: string) {
  const close = sheet.getByRole("button", { name: "Close step", exact: true });
  if (await close.isVisible()) await close.click();
  await sheet.getByRole("group", { name: "Referral sections" }).getByRole("button", { name, exact: true }).click();
}

async function raiseReferralInSlideOut(page: Page, referral: SlideOutReferral) {
  const sheet = page.getByTestId("ward-bar-referral-sheet");
  await expect(sheet).toBeVisible({ timeout: 15_000 });

  // Refer to: a ward. That names the last two steps Clearance and Wards.
  await sheet.getByTestId("ward-referral-refer-to-ward").click();
  await expect(sheet.getByTestId("ward-referral-refer-to-ward")).toHaveAttribute("aria-pressed", "true");

  // Patient: register a new synthetic person and give the age band.
  await openReferralStep(sheet, "Patient");
  await sheet.getByTestId("ward-referral-new-patient-toggle").click();
  const newPatient = sheet.getByTestId("ward-referral-new-patient");
  await newPatient.getByLabel("Family name", { exact: true }).fill(referral.patient.familyName);
  await newPatient.getByLabel("Given name", { exact: true }).fill(referral.patient.givenName);
  await newPatient.getByLabel("Date of birth", { exact: true }).fill("02/01/1990");
  await newPatient.getByLabel("UMRN", { exact: true }).fill(referral.patient.umrn);
  // A real suburb from the catchment table, so the slide-out suggests its catchment team.
  await newPatient.getByLabel("Suburb", { exact: true }).fill("Albany");
  await newPatient.getByRole("button", { name: "Add and use for this referral" }).click();
  await expect(newPatient).toHaveCount(0);
  await expect(sheet).toContainText(`${referral.patient.familyName}, ${referral.patient.givenName}`);
  await sheet.getByLabel("Age band", { exact: true }).selectOption(referral.ageBand);
  // RF1 (3 Nov 2026): Albany points to one country team, so no region is suggested and the region
  // field shows. Once a region is chosen the card offers the whole catchment as one suggestion.
  await sheet.getByLabel("Home region", { exact: true }).selectOption(referral.homeRegion);
  await sheet.getByTestId("ward-referral-use-catchment").click();
  await expect(sheet.getByTestId("ward-referral-use-catchment")).toHaveCount(0);
  await expect(sheet.getByText(/Catchment confirmed/u).first()).toBeVisible();

  // Referral: from a community service, voluntary, the bed security, the urgency and bed needs.
  await openReferralStep(sheet, "Referral");
  await sheet.getByRole("group", { name: "Source" }).getByRole("button", { name: "Community", exact: true }).click();
  await sheet.getByLabel("Referring service location", { exact: true }).selectOption(wardSites[0].code);
  await sheet.getByLabel("Referring community service", { exact: true }).fill("Synthetic community mental health team");
  await sheet.getByLabel("Legal status", { exact: true }).selectOption("Voluntary");
  await tapChoice(
    sheet
      .getByRole("group", { name: "Bed security" })
      .getByRole("radio", { name: referral.bedSecurity === "Secure" ? "Locked" : referral.bedSecurity, exact: true }),
  );
  await tapChoice(sheet.getByRole("radio", { name: urgencyTierLabel(referral.urgency), exact: true }));
  await sheet.getByLabel("Recorded sex", { exact: true }).selectOption(referral.sex);
  await sheet.getByLabel("Gender identity", { exact: true }).selectOption(referral.gender);
  const acuity = sheet.getByRole("switch", { name: "High-acuity nursing" });
  if ((await acuity.getAttribute("aria-checked")) !== String(referral.highAcuityNursing)) await acuity.click();
  await expect(acuity).toHaveAttribute("aria-checked", String(referral.highAcuityNursing));

  // Clearance: cleared, triaged, both charts attached, nothing else to attach.
  await openReferralStep(sheet, "Clearance");
  await tapChoice(
    sheet.getByRole("group", { name: "Has the patient been medically cleared?" }).getByRole("radio", { name: "Yes" }),
  );
  await tapChoice(sheet.getByRole("group", { name: "Triage and RAMP completed" }).getByRole("radio", { name: "Yes" }));
  await sheet.getByLabel("Medication chart", { exact: true }).setInputFiles(syntheticChart("medication-chart.pdf"));
  await sheet.getByLabel("Observation chart", { exact: true }).setInputFiles(syntheticChart("observation-chart.pdf"));
  await expect(sheet.getByRole("button", { name: "Replace" })).toHaveCount(2);
  await tapChoice(sheet.getByRole("group", { name: "Anything else to attach?" }).getByRole("radio", { name: "No" }));

  // Wards: the named wards, then the transport for the arrival plan.
  await openReferralStep(sheet, "Wards");
  const wards = sheet.getByRole("list", { name: "Destinations" });
  await expect(wards).toBeVisible();
  for (const unitId of referral.notOffered ?? []) {
    await expect(wards.getByRole("checkbox", { name: wardChoiceName(unitId) })).toHaveCount(0);
  }
  for (const unitId of referral.unitIds) {
    await tapChoice(wards.getByRole("checkbox", { name: wardChoiceName(unitId) }));
  }
  await sheet.getByLabel("Transport", { exact: true }).selectOption(referral.transport);

  // Send, then confirm with the sender's contact details. Nothing is sent before Confirm and send.
  await sheet.getByRole("button", { name: "Send referral", exact: true }).click();
  await expect(sheet.getByRole("heading", { name: "Confirm and send" })).toBeVisible();
  await sheet.getByLabel("Your name", { exact: true }).fill("Synthetic Referrer");
  await sheet.getByLabel("Email address", { exact: true }).fill("referrer@example.org");
  await sheet.getByLabel("Phone number", { exact: true }).fill("0412345678");
  await sheet.getByLabel("Your role", { exact: true }).fill("Community mental health nurse");
  await sheet.getByLabel("Location or service", { exact: true }).fill("Synthetic community mental health team");
  await sheet.getByRole("button", { name: "Confirm and send", exact: true }).click();
  await expect(sheet.getByRole("heading", { name: "Referral sent" })).toBeVisible();
  // A refusal renders as the footer's `role="alert"`; the sent heading and a refusal are separate
  // elements, so asserting only the first would pass on a screen showing both.
  await expect(sheet.getByRole("alert")).toHaveCount(0);
  await sheet.getByRole("button", { name: "Done", exact: true }).click();
  await expect(sheet).toHaveCount(0);
}

/** The unit this journey accepts at: the first ADULT unit in the site table's own order that the
 *  referral slide-out offers for an open bed — Mental Health Unit (Sir Charles Gairdner).
 *
 *  It was Dabakarn (`rph-adult-secure`), the first unit in site order, until 8 October 2026. The
 *  slide-out lists only wards whose beds match the chosen bed security, and Dabakarn has no open
 *  bed (all locked), so a referral needing an open bed — `RAISED` needs no secure bed — can no
 *  longer be addressed to it. Checked by name in the fixture-assumption block. */
const ACCEPT_UNIT_ID = "scgh-adult-open";
const ACCEPT_UNIT_NAME = "Mental Health Unit";

/** Units that must NOT accept this referral, one per reason, named individually so a rule that
 *  quietly stopped excluding anything cannot pass this journey.
 *  The forensic example (Broome) is gone: owner ruling 2026-09-25 (answer 1A), Broome's Mabu Liyan
 *  is not forensic, so the sample network has no forensic ward and this built-app journey cannot
 *  show that refusal. The forensic rule is proven where a made-up forensic ward can be put in
 *  (`tests/helpers/ward-made-up-forensic-ward.ts`): its wording in `tests/ward-eligibility.test.ts`,
 *  and the refusal on screen in `tests/ward-referral-screens.dom.test.tsx`. */
//
// Since 8 October 2026 these are met in two places. The slide-out lists only wards of the person's
// own age band, so the wrong-age unit is never OFFERED (asserted at its Wards step); the female-only
// unit IS offered, the referral is addressed to it alongside the accepting unit, and the match view
// gives its reason when the coordinator reviews that recipient.
const FEMALE_ONLY_UNIT_ID = "ger-adult-open";
const FEMALE_ONLY_UNIT_NAME = "Geraldton Adult Open";
const WRONG_AGE_UNIT_ID = "rph-older-adult";

/**
 * The seed's own queued/decided split (`referrals` in `ward-movements.ts`), counted the way the
 * board's two sections count it rather than the way the fixture reads.
 *
 * `referralQueueOrder` keeps a referral whose destinations include none that accepted and are not
 * all declined; `recentlyDecidedReferrals` takes every other one. `referralState` checks
 * acceptance FIRST, so a referral holding one queued destination AND one accepted destination is
 * decided, not queued — which is why neither number can be counted by eye off the fixture's
 * `state:` lines, and why both are re-derived from `referrals` in the fixture-assumption block at
 * the top of the first journey below.
 *
 * That guard is the point of this pair. The version of this comment that stood here until now
 * enumerated the queued ids in prose instead, and stated a count no assertion read. When RF-009
 * joined the fixture as a queued referral on 2026-08-30 the prose silently became false and the
 * two board assertions below silently became wrong; the browser suite has been red ever since,
 * unnoticed, because `tests/ward-*` selects only the Vitest files. A count written where nothing
 * can fail is the defect, not the number.
 */
// Six since 2026-09-11, not four: RF-014 and RF-015 joined the seed as queued referrals on
// 2026-09-07 (see `SEEDED_QUEUED_IDS` below for which two and why) and this count went stale for
// four days before anybody ran the browser suite. Cross-checked against `SEEDED_QUEUED_IDS` right
// after that set is declared, so the two hand-authored facts cannot drift apart in silence again.
//
// SEVEN from 2026-09-22 (RF-RD06 arrived with the rulings-demo overlay), and SIX again since
// A16-14 (13 Nov 2026): the overlay's worked examples are off by default and switched on by the
// presenter, so the ordinary day the browser loads holds no RF-RD06.
const SEEDED_QUEUED = 6;
// Seven since 2026-09-01, not six: RF-007 was split into a ward-only referral and RF-010, a
// community-only one accepted by a clinic 24 days before the anchor. So the decided section gained
// a row and the queued section did not. Updated deliberately here rather than found later —
// `tests/ward-*` selects only the Vitest files, and these two constants are exactly the kind that
// has already gone silently false in this file once, for a whole fixture change.
//
// NINE since 2026-09-04, not seven. `11c5d2029` (ruling R-2026-09-04-D, the front-door link) added
// RF-012 and RF-013 as the authored ORIGINS of WF-002 and WF-009, taking the fixture from 11
// referrals to 13; both are decided, so the decided section gained two rows and the queued section
// gained none. The measured set is RF-006, RF-007, RF-002, RF-003, RF-004, RF-008, RF-012, RF-013,
// RF-010 — nine, still under `RECENTLY_DECIDED_DISPLAY_LIMIT` (10), so the board shows all of them.
//
// ⚠️ **THE PIN WORKED AND IT IS NOT THE DEFECT — DO NOT "FIX" IT BY DERIVING THIS NUMBER.** When the
// seed grew, this failed by name, before any journey step ran, saying exactly what had moved. That
// is what the block below was built to do. Deriving the expectation from `referrals` with the same
// selector the assertion calls would make it true by construction and absorb the next fixture change
// in silence — the identical trap the `NETWORK_UNITS` comment refuses two constants down, and a
// count that can never fail is what this file's own comment above calls the defect.
//
// The real failure here was that nothing RAN it: the six Playwright ward journeys sit outside every
// required gate, so this stood red for five hours after `11c5d2029`. The repair for that is running
// them, not weakening the pin.
//
// ⚠️ Counted from the function's own returned array in the failing run, not from the fixture text.
//
// ⚠️ **CORRECTION, 2026-09-04 — an earlier version of this comment claimed a structural count gives
// TEN against the function's nine, and explained it as a queued referral holding a decided
// destination beside a pending one. THAT WAS WRONG AND IS WITHDRAWN.** There is no such referral:
// referrals holding a mix of queued and non-queued destinations number ZERO, independently measured
// by a reviewer who could not reproduce my figure and said so.
//
// **What actually produced the ten: my structural count matched the string `decidedAt` inside a DOC
// COMMENT.** RF-011's prose explains "`decidedAt` on each ED arm is the moment its movement opened";
// both its destinations are `queued`. Strip comments first and the structural count is NINE, naming
// the same nine ids the function returns. **The proxy and the property agree — the proxy was reading
// the file's explanation of itself.**
//
// Two things worth keeping. The habit was still right: taking the number from the function's own
// returned array is correct whatever a text scan says. And the failure is one I had already avoided
// once the same night — an extraction of user-facing strings from a console component stripped
// comments FIRST, precisely because that file quotes its own strings in prose. I knew the technique
// and did not apply it here.
/*
 * 🔴 **2026-09-06: THIS STOPPED BEING ONE NUMBER, AND BUMPING IT WOULD HAVE HIDDEN WHY.** The seed
 * grew from 9 structurally-decided referrals to 18 — a second family of site-coded ids
 * (`RF-RGHS-01`, `RF-ARMA-02`, …) alongside the original `RF-0NN` set. All 18 ids are distinct;
 * this is a real fixture addition, not a duplication, which is the first thing checked because 9 to
 * 18 is exactly double.
 *
 * ⚠️ **AND IN GROWING, THE SEED CROSSED THE BOARD'S DISPLAY CAP.** `recentlyDecidedReferrals`
 * `.slice(0, RECENTLY_DECIDED_DISPLAY_LIMIT)` at 10 (owner ruling, 2026-09-02), so the two
 * quantities this file used to conflate are now genuinely different: **18 referrals have been
 * decided, and the board shows 10.** One constant cannot serve both, and the old single
 * `SEEDED_DECIDED` was only ever correct because 9 was below the cap.
 *
 * 🔴 **2026-09-17: THE GUARD BELOW CAUGHT THE NEXT FIXTURE GROWTH, AS DESIGNED.** The 17 September
 * sample-data addition raised the seed from 18 to 24 structurally-decided referrals. Re-read: the
 * shown count stays pinned at the cap (`Math.min(24, 10)` is still 10, exactly as it was at 18), so
 * only this constant needed to move — neither `SEEDED_DECIDED_SHOWN`'s derivation nor either
 * assertion below needed a separate edit.
 *
 * 2026-11-04: the demo example rows (plan 2d) raised it from 24 to 29. Still above the cap, so the
 * shown count stays 10 and only this constant moves. The queued seed is unchanged at 7.
 */
const SEEDED_DECIDED_STRUCTURAL = 29;

/**
 * What the board actually renders in its heading — `decided.length` on the CAPPED list. Derived
 * from the limit rather than hardcoded as 10, because the relationship is the point: once the seed
 * exceeds the cap, the heading shows the cap.
 *
 * ⚠️ **NOT true by construction.** It is computed from `RECENTLY_DECIDED_DISPLAY_LIMIT` and
 * `SEEDED_DECIDED_STRUCTURAL` — a constant and a locally cross-checked count — and shares no code
 * with `recentlyDecidedReferrals`, which is the function these assertions exist to test. If the cap
 * changes, this follows; if the SELECTION changes, the assertions still fail.
 */
const SEEDED_DECIDED_SHOWN = Math.min(SEEDED_DECIDED_STRUCTURAL, RECENTLY_DECIDED_DISPLAY_LIMIT);

/*
 * 🔴 IT WENT STALE AGAIN, EXACTLY AS THE COMMENT ABOVE PREDICTED, AND NOTHING CAUGHT IT.
 *
 * `11c5d2029` ("feat(ward-flow): rulings C and D", 2026-09-04 04:02) added RF-012 and RF-013 — the
 * front-door referrals authored as the origins of WF-002 and WF-009 — and did not touch this file.
 * `git show --stat 11c5d2029 -- tests/ui-ward-referrals.spec.ts` is empty. This spec went red five
 * hours later, on the first manual run anybody had given it, and every required gate stayed green
 * throughout: the six `ui-ward-*` journeys execute only under `test:e2e:mockups` and CI's
 * `continue-on-error` advisory lane, and this branch has never been pushed.
 *
 * So the previous comment's diagnosis was right — "a count written where nothing can fail is the
 * defect, not the number" — and bumping the number a second time would repeat the mistake it names.
 * The count is now CROSS-CHECKED against the seed below, so the next fixture change fails here with
 * a message naming the new total instead of failing silently until somebody runs the browser suite.
 *
 * ⚠️ Deliberately NOT derived by calling the board's own `recentlyDecidedReferrals`: that is the
 * function these assertions exist to test, and re-deriving the expected number from it would make
 * them true by construction — the reason the original author hardcoded, and still correct. The
 * predicate below is written here, over the raw seed, and shares nothing with the board.
 */
/**
 * The referrals the board actually starts from: the fixture PLUS the rulings-demo overlay, which
 * `6e4ba553f3` (2026-09-22, owner-kept) merged into `seedWardFlowState` — the one door the provider
 * seeds through. The overlay adds RF-RD06 (queued, tier 2, source psychiatric_ward). Counting the raw
 * `referrals` fixture counted a seed no screen renders: the board said "Queued (7)" while this file
 * expected 6. `referrals` stays imported only for the print test below, which asks for any queued id.
 */
const BOARD_SEED_REFERRALS = seedWardFlowState().referrals;

const decidedInTheSeed = BOARD_SEED_REFERRALS.filter((referral) =>
  referral.destinations.some((destination) => destination.state !== "queued"),
).length;
if (decidedInTheSeed !== SEEDED_DECIDED_STRUCTURAL) {
  throw new Error(
    `SEEDED_DECIDED_STRUCTURAL is ${SEEDED_DECIDED_STRUCTURAL} and the seed now holds ${decidedInTheSeed} ` +
      `decided referrals. Update the constant AND re-read the THREE assertions that depend on it — the ` +
      `length check, the board heading, and the post-decision heading — because a fixture change is exactly ` +
      `what made this stale twice before. ⚠️ And check the cap: the board shows ` +
      `min(structural, ${RECENTLY_DECIDED_DISPLAY_LIMIT}), so whether the heading MOVES when a referral is ` +
      `decided depends on which side of ${RECENTLY_DECIDED_DISPLAY_LIMIT} the seed now sits.`,
  );
}

/*
 * ⚠️ THE OTHER SIDE OF THIS MERGE ARGUED AGAINST DERIVING THE NUMBER AT ALL, AND ITS PRINCIPLE IS
 * KEPT EVEN THOUGH ITS SIDE WAS NOT. Verbatim: "deriving the expectation from `referrals` with the
 * same selector the assertion calls would make it true by construction and absorb the next fixture
 * change in silence." **That is correct and it is why the cross-check above is written locally over
 * the raw seed rather than by calling `recentlyDecidedReferrals`** — the assertion and the guard
 * share no code, so the guard cannot make the assertion true.
 *
 * 🔴 ONE CLAIM FROM THAT SIDE DID NOT SURVIVE MEASUREMENT AND IS RECORDED SO NOBODY RE-DERIVES IT.
 * It stated that a structural count gives TEN, because "one queued referral holds a decided
 * destination alongside a pending one". Two independent measurements found no such referral: the
 * predicate above returns 9, and a separate reviewer reported 9 under every structural definition
 * it could construct, with zero referrals holding a mix. **If a predicate ever does give ten, this
 * guard is wrong and the comment above it is the place to say so.**
 *
 * And its diagnosis of the real failure is the one worth keeping: the pin WORKED — it failed by
 * name, before any journey step ran. What failed was that nothing ran it for five hours. The repair
 * for that is running the journeys, not weakening the pin.
 */

/** Every unit in the network, and — below — how many units the match view weighs for the referral
 *  raised above and how many of those accept it. All hardcoded rather than recomputed from
 *  `referralEligibility`: re-deriving the expected number with the very function under test would
 *  make this assertion true by construction whatever the matching rules did. The fixture
 *  assumptions guarded at the top of the test are what keep a hardcoded number honest — if the
 *  network changes, this fails at the assumption, by name. */
// 22 since 26 Sept 2026 (confirmed ward facts: Kununurra's ward removed; allUnits() on the seed
// returns 22).
const NETWORK_UNITS = 22;
/*
 * 🔴 **8 OCTOBER 2026: "13 OF 22" BECAME "1 OF 1", AND THE DESTINATION SHAPE IS WHY.** The retired
 * intake form sent a BROAD ward request (`psychiatric_ward` with no `unitId`), and the match view
 * weighed it against every unit: 13 of 22 accepted. The referral slide-out — now the one place a
 * referral is written — addresses NAMED wards only (`psychiatric_ward` with a `unitId`), and the
 * match view reviews one addressed ward at a time: `referralCandidates` keeps only the unit that
 * ward names. So the view lists exactly one unit, and the accepting unit accepts.
 *
 * Still hardcoded, not recomputed from `referralEligibility`, for the reason above. What keeps the
 * "1 accepts" honest is the fixture-assumption block: the accepting unit is Adult, undesignated, not
 * forensic, has an open bed and has an allocatable bed — the same facts that made it one of the 13.
 */
const REVIEWED_UNITS = 1;
const REVIEWED_ACCEPTING = 1;

/**
 * The seeded queued ids, so a referral this spec raises can be told apart from them without
 * depending on how the reducer mints an id.
 *
 * This must hold EVERY seeded queued referral, not merely enough of them. It is read by a
 * `.find(id => !SEEDED_QUEUED_IDS.has(id))` over the board's queued cards, so a seeded id missing
 * from this set is not caught — it is returned AS the raised referral, and the rest of that
 * journey then asserts against the wrong card. `SEEDED_QUEUED` above is what makes an omission
 * visible: the fixture-assumption block checks this set against the real queue, by name.
 *
 * Ordered as `referralQueueOrder` orders it (longest wait first, Decision D-32), matching the pin in
 * `tests/ward-referral-model.test.ts`, so the two files can be read against each other.
 */
// RF-011 appended 2026-09-03. It joined the seed as the one multi-destination referral, so
// FD-23 could be SEEN on the running app rather than only asserted in a unit test -- and this
// list was not extended with it, so the browser journey failed on a fixture assumption rather
// than a rendering fault. The order matches the pin in tests/ward-referral-model.test.ts,
// which the doc comment above says these two files should be readable against.
//
// RF-014 and RF-015 appended here 2026-09-11 as the two invented EXPECTS rows. Since Decision
// D-32 (6 October 2026) the queue runs longest wait first, so RF-015 (raised 4,500 minutes ago)
// leads and RF-005 (20 minutes) is last. This is not re-derived from `referrals` with
// `referralQueueOrder` itself, for the same reason `SEEDED_DECIDED_STRUCTURAL` above stays a
// literal — that would make the fixture-assumption assertion below true by construction against
// the very function it exists to check. The order is copied from the independent pin in
// `tests/ward-referral-model.test.ts` ("orders the real fixture's queued referrals by waiting
// time, longest first"), so a divergence between the two pins can be found by reading.
const SEEDED_QUEUED_IDS = new Set(["RF-015", "RF-014", "RF-011", "RF-001", "RF-009", "RF-005"]);
if (SEEDED_QUEUED_IDS.size !== SEEDED_QUEUED) {
  throw new Error(
    `SEEDED_QUEUED is ${SEEDED_QUEUED} and SEEDED_QUEUED_IDS now holds ${SEEDED_QUEUED_IDS.size} ids. Update ` +
      `SEEDED_QUEUED to match — it is the count the board's own "Queued (n)" heading and card list are checked ` +
      `against, and the two must name the same set or one of those checks is silently wrong.`,
  );
}

/**
 * D-181 item 7 (Josh, 13 Nov 2026; A16-04): travel times read "not recorded" until Josh supplies
 * checked times, so no (home region, unit) pair is out of area on screen and the far-acceptance
 * journey this file used to drive has nothing far to accept. Its replacement below takes a unit
 * with NO checked band from a home region and checks the screens say so.
 *
 * Forensic beds, sex-designated beds and wards with nothing allocatable are skipped, because each
 * would decline the referral for a reason that has nothing to do with distance. The accept control
 * is still read off the SCREEN, so the matching rules under test never compute their own
 * expectation. All this search fixes is which home region and age band get typed into the form.
 */
const UNCHECKED_PLACEMENT = (() => {
  for (const homeRegion of HOME_REGIONS) {
    for (const unit of allUnits()) {
      if (travelBand(homeRegion, unit.siteCode) !== undefined) continue;
      if (unit.forensic || unit.sexDesignation !== "Undesignated") continue;
      if (unit.allocatable.value <= 0) continue;
      return { homeRegion, unit };
    }
  }
  return undefined;
})();

const SENTINEL = "ward-flow-task-7-journey";

async function plantSentinel(page: Page) {
  await page.evaluate((value) => {
    (window as unknown as Record<string, string>).__wardFlowJourneySentinel = value;
  }, SENTINEL);
}

/**
 * Proves the last route change was a client-side navigation rather than a document load. A
 * `page.goto()`, a `location.assign`, a native form submit or any other full load discards the
 * `window` this was planted on, and with it every referral the reducer is holding.
 */
async function expectNoReloadSince(page: Page, step: string) {
  const survived = await page.evaluate(
    () => (window as unknown as Record<string, string | undefined>).__wardFlowJourneySentinel,
  );
  expect(survived, `the page reloaded during "${step}" — the reducer's referrals were reset`).toBe(SENTINEL);
}

/** The board's queued card list, in the order the board renders it (`referralQueueOrder`). */
function queuedCardIds(page: Page): Promise<string[]> {
  return page
    .getByTestId("ward-referral-board-queued-cards")
    .locator("button[data-testid^='ward-referral-board-card-select-']")
    .evaluateAll((buttons) =>
      buttons.map((button) =>
        (button.getAttribute("data-testid") ?? "").replace("ward-referral-board-card-select-", ""),
      ),
    );
}

/**
 * Opens the referral slide-out over the board: the board's own New referral where it shows, else
 * the phone menu's + (10 Oct 2026), whose New referral opens the same slide-out in place.
 */
async function openNewReferralFromBoard(page: Page) {
  // v10 (10 Oct 2026): the board's hero no longer repeats New referral; the header's is the one.
  const headerNew = page.getByTestId("ward-bar-primary-action");
  if (await headerNew.isVisible()) {
    // UX audit (21 Oct 2026): New referral opens the slide-out at once, set to a ward.
    await headerNew.click();
    return;
  }
  // Phone (device audit option A, 11 Oct 2026): New referral is behind the page dock's raised +.
  await page.getByTestId("ward-phone-create").click();
  await page.getByTestId("ward-phone-create-referral").click();
}

/** Back to the board through the coordinator's own rail, as a phone user reaches it.
 *
 * 🔴 **THE PHONE RAIL CHANGED SHAPE ENTIRELY ON 2026-09-11, AND THIS HELPER'S FIRST TWO LINES
 * WENT WITH IT.** It used to open `ClinicalRail`'s fixed phone bar (`getByRole("button", { name:
 * "Open Ward Flow menu" })`) and click inside the drawer that opened, scoping to the dialog
 * because the CSS-hidden desktop rail carried the same destination. **No `<ClinicalRail>` is
 * mounted anywhere in `src/` any more** — `src/app/ward-flow/layout.tsx` mounts
 * `shell/ward-rail.tsx` once instead — and the third-edition rail has no phone drawer at all:
 * below 1000px it reflows to a wrapping row of the same links, always visible, never behind a
 * menu button (standard §7.7, `ward-rail.module.css`'s own `max-width: 1000px` block). Left
 * unchanged, this waited 60 seconds for a button that no longer exists.
 *
 * **A phone user now reaches the board by tapping the link, because it is on the screen.** That is
 * one step rather than two, and the journey below is still a phone journey — the viewport is still
 * 375px and the link still has to be genuinely tappable for `.click()` to succeed. The dialog
 * scoping is gone because there is no longer a second, CSS-hidden copy of the rail to disambiguate
 * from: `tests/ui-ward-chrome-header.spec.ts` now asserts `ward-rail` appears exactly once.
 *
 * ⚠️ **MATCHED BY PREFIX, NOT EXACTLY, AND THAT IS THE POINT.** This helper used
 * `{ name: "Referral board", exact: true }` and went red on 2026-09-07 without the navigation
 * breaking at all: the link's accessible name had become *"Referral board, 5 awaiting a decision"*.
 * Several rungs carry a live count now — *"Delays, 3 at a time limit or with nowhere to go"*, *"Capacity, 27 beds
 * ready now"* — and announcing the count to a screen reader is an IMPROVEMENT. **An exact-name
 * selector makes that improvement look like a regression**, and the repair a reader is invited to
 * make is to delete the count. So the destination is matched by its stable prefix, and the count
 * is free to change.
 *
 * ⚠️ It is still anchored (`^`) rather than a bare substring: "Referral board" must be how the
 * name STARTS, so a future rung called "Old referral board archive" cannot satisfy it. */
/**
 * Opens the rail's "More pages" sheet if this width hides a page behind it, and says whether it
 * did. Since cc4deaecaf (23 Sept) the rail's links are hidden at 40rem and below and the rail's
 * "Menu" button opens the same sheet (as `tests/ui-ward-management.spec.ts` does), so a
 * "More pages" button that is present but hidden no longer counts as the door.
 */
async function openRailSheetIfNeeded(page: Page, rail: Locator): Promise<boolean> {
  const morePages = rail.getByRole("button", { name: /^All pages/iu });
  const menu = rail.getByRole("button", { name: "Menu", exact: true });
  // Phone (8 Oct 2026): at 48rem and below the rail is hidden and the header bar's Menu opens the sheet.
  const barMenu = page.getByTestId("ward-bar-phone-menu");
  const opener = (await morePages.isVisible())
    ? morePages
    : (await menu.isVisible())
      ? menu
      : (await barMenu.isVisible())
        ? barMenu
        : undefined;
  if (!opener) return false;
  await opener.click();
  // Phone (10 Oct 2026): the bar's Menu opens the phone menu rather than the rail's sheet.
  await expect(page.getByTestId("ward-rail-more-pages").or(page.getByTestId("ward-phone-menu"))).toBeVisible();
  // Phone Menu redesign (approved 31 Oct 2026): the other groups open in place from one "More
  // pages" row in the phone Menu, so open it too.
  await openPhoneMenuMorePages(page);
  return true;
}

async function goToBoardViaPhoneRail(page: Page) {
  const rail = page.getByTestId("ward-rail");
  await expect(
    rail.or(page.getByTestId("ward-bar-phone-menu")).filter({ visible: true }),
    "the shell rail or the bar's phone Menu must be on the phone screen",
  ).toHaveCount(1);
  // ⚠️ **TWO INDEPENDENT DRIFTS, BOTH FROM THE OWNER-REQUESTED GROUPED RAIL (2026-09-13,
  // `shell/ward-rail.tsx`'s `RAIL_GROUPS`).** First, the label is now "Referral Board" (capital
  // B, `RAIL_GROUPS`' own literal), not "Referral board" — a case-sensitive regex with no `i` flag
  // silently never matches. Second, and the one that actually hung this helper for 60s: "Referral
  // Board" lives in the "Care Coordination" group, which is no longer inline at phone width. Only
  // Command/Movement/Capacity (`NARROW_CORE_ENTRY_IDS`) plus the current route's own entry stay
  // inline below 1000px; everything else — Referral Board included — sits behind "More pages"
  // until that sheet is opened.
  // The sheet portals to `document.body` by default (`components/wf/sheet.tsx`'s `Sheet`), so its
  // content sits outside `rail`'s own DOM subtree once open — the target link is looked up from
  // `page`, unscoped, rather than from `rail`.
  // Josh, 8 Nov 2026: Referrals left the coordinator's phone dock for the Menu (the dock now holds
  // Home, Capacity, +, Alerts, Tools), so a phone opens the Menu and taps Referrals there.
  const phoneMenu = page.getByTestId("ward-bar-phone-menu");
  if (await phoneMenu.isVisible()) {
    const menu = page.getByTestId("ward-phone-menu");
    // Retried as one step: sending closes a sheet, and the Menu tap can land while it is closing.
    await expect(async () => {
      if (!(await menu.isVisible())) await phoneMenu.click();
      await expect(menu).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await menu.locator('a[href="/ward-flow/referrals"]').filter({ visible: true }).first().click();
  } else if (await openRailSheetIfNeeded(page, rail)) {
    await page
      .getByTestId("ward-rail-more-pages")
      .or(page.getByTestId("ward-phone-menu"))
      .getByRole("link", { name: /^Referrals\b/iu })
      .first()
      .click();
  } else {
    await rail.getByRole("link", { name: /^Referrals\b/iu }).click();
  }
  await expect(page.getByTestId("ward-referral-board-screen")).toBeVisible({ timeout: 15_000 });
}

test.describe("@mockup Ward referrals — the front door, phone to board to accepted", () => {
  test.describe.configure({ timeout: 60_000 });

  test("the New referral route is the Referrals board with the referral slide-out open over it", async ({ page }) => {
    await page.goto("/ward-flow/referrals/new?refer=community", { waitUntil: "load" });
    await expect(page.getByTestId("ward-bar-referral-sheet")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("ward-referral-refer-to-community")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("ward-referral-board-screen")).toBeAttached();
  });

  test("the header's New referral link opens the slide-out in place, without leaving the board", async ({ page }) => {
    await page.goto("/ward-flow/referrals", { waitUntil: "load" });
    await expect(page.getByTestId("ward-referral-board-screen")).toBeVisible({ timeout: 15_000 });
    await plantSentinel(page);
    // Triage and risk (7 Nov 2026): the bar's New offers Triage or Referral; Referral is today's slide-out.
    await page.getByTestId("ward-bar-primary-action").click();
    await page.getByTestId("ward-new-referral").click();
    await expect(page.getByTestId("ward-bar-referral-sheet")).toBeVisible();
    await expect(page).toHaveURL(/\/ward-flow\/referrals$/);
    await expectNoReloadSince(page, "board -> referral slide-out");
  });

  /*
   * Re-driven 8 October 2026: the referral is raised in the referral slide-out
   * (`ward-bar-referral-sheet`), which the board's "New referral" link opens in place over the
   * board. The full-page intake form this journey used before is retired. The board, match and
   * acceptance half stands as written, with the match counts re-derived for the slide-out's named
   * wards (see `REVIEWED_UNITS`).
   */
  test("a referral raised in the phone-width referral slide-out reaches the coordinator's board, matches against the wards it names, and is accepted — with the board reflecting every step without a reload", async ({
    page,
  }) => {
    // D12: referring is designed for a phone and adapted upward. The whole journey runs at phone
    // width, including the coordinator's half — the board must be usable there too.
    await page.setViewportSize({ width: 375, height: 812 });

    // Fixture assumptions, checked against the real data rather than assumed, so a fixture change
    // fails here by name instead of several steps later against a confusing downstream number.
    expect(allUnits(), "fixture assumption: the synthetic network holds 22 units").toHaveLength(NETWORK_UNITS);
    // The seed's queued/decided split, re-derived from `referrals` with the very selectors the
    // board renders from. Not a tautology against the assertions further down: those read the
    // COUNT OFF THE SCREEN, and this reads the model — a board that dropped, duplicated or
    // mis-sectioned a referral fails there while this passes. What this catches is the other
    // failure, the one that actually happened: the seed growing while the constants above stayed
    // still. Then it fails HERE, by name, before any journey step runs.
    expect(
      referralQueueOrder(BOARD_SEED_REFERRALS).map((referral) => referral.id),
      "fixture assumption: the seed's queued referrals, in the queue's own order",
    ).toEqual([...SEEDED_QUEUED_IDS]);
    expect(
      recentlyDecidedReferrals(BOARD_SEED_REFERRALS),
      "fixture assumption: the board shows min(decided, the display cap), NOT every decided referral",
    ).toHaveLength(SEEDED_DECIDED_SHOWN);
    // The referral this journey raises is newer than every seeded one, so under Decision D-32 it
    // joins the back of the queue. The assertion that it does (further down) only proves urgency
    // does not jump the queue while nothing seeded is as urgent — an urgency-first sort would then
    // put it at the front. Checked here so a seed that gained a tier-1 referral fails by name.
    // Written as "which ones break the rule", not "do all of them hold it": `.every()` on an empty
    // array is `true`, and this list being non-empty is already pinned by the assertion above.
    expect(
      referralQueueOrder(BOARD_SEED_REFERRALS)
        .filter((referral) => referral.urgency <= Number(RAISED.urgency))
        .map((referral) => referral.id),
      `fixture assumption: no seeded queued referral is as urgent as the tier-${RAISED.urgency} referral this journey raises`,
    ).toEqual([]);
    const acceptUnit = unitById(ACCEPT_UNIT_ID);
    expect(acceptUnit?.cohort, `fixture assumption: ${ACCEPT_UNIT_NAME} is an Adult unit`).toBe("Adult");
    expect(acceptUnit?.sexDesignation, `fixture assumption: ${ACCEPT_UNIT_NAME} is undesignated`).toBe("Undesignated");
    expect(acceptUnit?.forensic, `fixture assumption: ${ACCEPT_UNIT_NAME} is not a forensic bed`).toBe(false);
    expect(
      allUnits()
        .filter((unit) => unit.forensic)
        .map((unit) => unit.id),
      "fixture assumption: the sample network has no forensic ward (owner ruling 1A); if one returns, " +
        "add its refusal back to this journey",
    ).toEqual([]);
    expect(
      unitById(FEMALE_ONLY_UNIT_ID)?.sexDesignation,
      `fixture assumption: ${FEMALE_ONLY_UNIT_NAME} is female only`,
    ).toBe("Female only");
    // The slide-out lists only wards of the person's age band whose beds match the chosen bed
    // security (`ward-referral-drawer.tsx`'s `realTimeMatch`). `RAISED` needs an open bed, so both
    // addressed units must be Adult with an open bed, and the wrong-age unit must not be Adult.
    for (const [unitId, name] of [
      [ACCEPT_UNIT_ID, ACCEPT_UNIT_NAME],
      [FEMALE_ONLY_UNIT_ID, FEMALE_ONLY_UNIT_NAME],
    ] as const) {
      expect(unitById(unitId)?.cohort, `fixture assumption: ${name} is an Adult unit`).toBe(RAISED.ageBand);
      expect(unitHasOpenBeds(unitById(unitId)!), `fixture assumption: ${name} has an open bed`).toBe(true);
    }
    expect(
      acceptUnit!.allocatable.value,
      `fixture assumption: ${ACCEPT_UNIT_NAME} has an allocatable bed`,
    ).toBeGreaterThan(0);
    expect(unitById(WRONG_AGE_UNIT_ID)?.cohort, "fixture assumption: the wrong-age unit is not an Adult unit").not.toBe(
      RAISED.ageBand,
    );

    // --- The one and only navigation in this journey. ---
    //
    // The ward layout's `DeveloperAreaGate` is an async Server Component, so Next streams this
    // subtree: the server sends the whole screen inside a staging container `<div hidden id="S:0">`
    // and the client swaps it into the Suspense boundary afterwards. React 19 defers that reveal
    // (`$RC` schedules `$RV` on a frame/timer), so the swap outlives BOTH `load` and `networkidle`
    // — measured here, not assumed: this spec's first two runs failed at `domcontentloaded` and
    // then again after `networkidle`, each time on a strict-mode violation, because the board's
    // testid genuinely resolved to two elements while the staging copy was still in the document.
    //
    // Waiting for that container to go is therefore the correct wait, and it is asserted rather
    // than slept on. Relaxing every locator below to `.first()`/`.last()` would have made the
    // journey pass, and would have left it silently asserting against whichever copy came first —
    // possibly the inert server-rendered one, which no click ever reaches.
    await page.goto("/ward-flow/referrals", { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    await expect(
      page.locator('div[hidden][id^="S:"]'),
      "React's streamed content is still staged, so the whole screen is duplicated in the document",
    ).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId("ward-referral-board-screen")).toBeVisible({ timeout: 15_000 });
    await plantSentinel(page);

    // The seed, before anything is raised. Asserted so the counts below are a real change rather
    // than a number that happened to be right.
    await expect(page.getByTestId("ward-referral-board-queued")).toContainText(`Awaiting decision ${SEEDED_QUEUED}`);
    // 🔴 THE HEADING NAMES BOTH NUMBERS SINCE THE OWNER'S 2026-09-06 RULING, because it used to
    // print the display cap in the grammatical position of a total: "Recently decided (10)" while
    // eighteen had been decided. Asserted as two separate containments rather than as one pinned
    // sentence, so a rewording of the connecting words does not go red while a wrong NUMBER still
    // does. The scope is the <h2> alone — the cards below it are full of other digits.
    const decidedHeading = page.getByTestId("ward-referral-board-decided").locator("h2");
    await expect(decidedHeading).toContainText(String(SEEDED_DECIDED_SHOWN));
    await expect(decidedHeading).toContainText(String(SEEDED_DECIDED_STRUCTURAL));
    const queuedBefore = await queuedCardIds(page);
    expect(queuedBefore).toHaveLength(SEEDED_QUEUED);

    // --- Step 1: the referral slide-out, opened in place through the board's own "New referral"
    // <Link>. The board stays mounted underneath it; nothing navigates. ---
    await openNewReferralFromBoard(page);
    const sheet = page.getByTestId("ward-bar-referral-sheet");
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await expectNoReloadSince(page, "board -> referral slide-out");

    // --- Step 2: raise the referral. R2.1: nothing arrives answered — the footer names how many
    // answers are still needed until every one of them is given. Audit 11 Oct 2026: the footer now
    // counts in the Ready to send checklist's own unit ("5 of 9 items still needed"), so the two agree. ---
    await expect(sheet).toContainText(/[1-9][0-9]* of [0-9]+ items still needed/u);
    // High-acuity nursing answered "no" here and "yes" in the far-placement journey below, so the
    // acuity gate is exercised both ways somewhere in this file rather than only ever seeing "no".
    // Transport is needed (Mental Health Transport), as it was on the retired form.
    //
    // Addressed to two wards, accepting unit first: the accepting unit, and the female-only unit
    // the match view must refuse by name. The wrong-age unit is never offered for an adult, which
    // is asserted at the Wards step.
    await raiseReferralInSlideOut(page, {
      patient: { familyName: "Journeyfield", givenName: "Synthetic", umrn: "UM990701" },
      ageBand: RAISED.ageBand,
      homeRegion: RAISED.homeRegion,
      sex: RAISED.sex,
      gender: RAISED.gender,
      urgency: Number(RAISED.urgency) as UrgencyLevel,
      bedSecurity: "Open",
      highAcuityNursing: false,
      transport: "Mental Health Transport",
      unitIds: [ACCEPT_UNIT_ID, FEMALE_ONLY_UNIT_ID],
      notOffered: [WRONG_AGE_UNIT_ID],
    });
    await expectNoReloadSince(page, "sending from the referral slide-out");

    // --- Step 3: back to the board through the rail, and the referral is there. ---
    await goToBoardViaPhoneRail(page);
    await expectNoReloadSince(page, "referral slide-out -> board via the phone rail");

    await expect(page.getByTestId("ward-referral-board-queued")).toContainText(
      `Awaiting decision ${SEEDED_QUEUED + 1}`,
    );
    const queuedAfter = await queuedCardIds(page);
    expect(queuedAfter).toHaveLength(SEEDED_QUEUED + 1);

    // Identified by set difference, never by a hardcoded id or `.first()`/`.last()` — the same
    // discipline `ui-ward-roles.spec.ts` (ruling R24) holds every journey in this prototype to.
    const seen = new Set(queuedBefore);
    const raisedIds = queuedAfter.filter((id) => !seen.has(id));
    expect(raisedIds, "exactly one new referral must appear on the board").toHaveLength(1);
    const referralId = raisedIds[0];

    // Decision D-32: the queue runs longest wait first (`referralQueueOrder`). This referral was
    // raised last, so it joins the back of the queue even though it is more urgent than every
    // seeded queued referral (checked by name in the fixture-assumption block above).
    //
    // Ordering, not merely membership: a board that put it at the top would still "contain" it.
    expect(queuedAfter.at(-1), "the newest referral joins the back of the queue, whatever its tier").toBe(referralId);

    const raisedCard = page.getByTestId(`ward-referral-board-card-select-${referralId}`);
    await expect(raisedCard).toContainText("Tier 1");
    // v10 phone card (11 Oct 2026): age band and sex, then the count of bed needs; the home region
    // is on the referral itself, not repeated on the short card.
    await expect(raisedCard).toContainText(`${RAISED.ageBand} · ${RAISED.sex}`);
    // Length of wait is rendered on the card in its own right (D11), so the order the queue runs in
    // is never left implicit.
    await expect(page.getByTestId(`ward-referral-board-card-wait-${referralId}`)).toContainText("waiting");

    // --- Step 4: match it against the wards it names. ---
    await raisedCard.click();
    // v10 phone (11 Oct 2026): at phone width the decision is the board's one scrolling sheet of
    // fit groups, by design. The recipient choice, travel bands and acceptance this journey asserts
    // are the wider match panel, from 769px. No reload: only the viewport changes, with the
    // referral still selected.
    await page.setViewportSize({ width: 769, height: 900 });
    const matchPanel = page.getByTestId("ward-referral-match-panel");
    await expect(matchPanel).toBeVisible();
    // Two wards were named, so the coordinator chooses which recipient to review. It opens on the
    // first one ticked, the accepting unit.
    const reviewWard = matchPanel.getByLabel("Review recipient ward");
    await expect(reviewWard).toHaveValue(ACCEPT_UNIT_ID);
    // Review finding I1 / Task 8 finding B: the tier is its OWN element here, and the summary
    // line carries no tier at all. `toHaveText` is exact both times, so a component that put the
    // tier back inside the dot-separated run — the shape that printed a bare "Tier 2" directly
    // beneath the board's "Tier 2 · urgent" — fails on the summary assertion rather than passing
    // unnoticed. The tier text is `urgencyTierLabel`'s own output, never a second spelling of it
    // written out here.
    await expect(page.getByTestId("ward-referral-match-summary")).toHaveText(
      `${RAISED.ageBand} · ${RAISED.sex} · ${RAISED.homeRegion}`,
    );
    await expect(page.getByTestId("ward-referral-match-tier")).toHaveText(
      // `RAISED.urgency` is the `<select>` OPTION VALUE the form is driven with, so it is the
      // string "1"; `urgencyTierLabel` takes the tier itself.
      urgencyTierLabel(Number(RAISED.urgency) as UrgencyLevel),
    );
    // One addressed ward is reviewed at a time, so the count covers that ward alone (see
    // `REVIEWED_UNITS` for why this was "13 of 22" before 8 October 2026).
    await expect(page.getByTestId("ward-referral-match-accepting-count")).toHaveText(
      `${REVIEWED_ACCEPTING} of ${REVIEWED_UNITS} units accept this referral right now.`,
    );
    // Every unit under review is listed, never a shortlist (D10). D-77: desktop uses the phone's
    // one list of radio rows in three fit groups; "Show n more" opens the rest of the fits.
    async function showEveryWard() {
      const more = matchPanel.getByRole("button", { name: /^Show \d+ more with a bed ready$/ });
      if (await more.count()) await more.click();
    }
    await showEveryWard();
    const wardRows = matchPanel.locator('[data-testid^="ward-referral-match-phone-cand-"]');
    await expect(wardRows).toHaveCount(REVIEWED_UNITS);
    // The invented-travel-times sentence is on this screen, once, wherever a band is shown.
    await expect(page.getByTestId("ward-referral-match-synthetic-notice")).toBeVisible();

    // The bed accepted below, and one unit per reason it is not offered — each named, so a rule
    // that stopped excluding anything cannot pass unnoticed.
    await expect(page.getByTestId(`ward-referral-match-phone-cand-${ACCEPT_UNIT_ID}`)).toHaveAttribute(
      "data-kind",
      "yes",
    );
    // The other named recipient, reviewed by choosing it. The wrong-age unit was never offered in
    // the slide-out (asserted at its Wards step), so its refusal is not reached here.
    await reviewWard.selectOption(FEMALE_ONLY_UNIT_ID);
    await expect(page.getByTestId("ward-referral-match-accepting-count")).toHaveText(
      `0 of ${REVIEWED_UNITS} units accept this referral right now.`,
    );
    await showEveryWard();
    // M14(a) (D-210, Josh 14 Nov 2026): Clinical override is offered only for checks a recorded
    // reason can answer, and a gender designation is not one of them (`SUITABILITY_GATES`). So the
    // one button refuses this ward by name, stays focusable (aria-disabled, not disabled) and
    // carries the reason as its accessible description, rather than opening an override form.
    await page.getByTestId(`ward-referral-match-phone-cand-${FEMALE_ONLY_UNIT_ID}`).click();
    const refusedAccept = page.getByTestId("ward-referral-match-phone-accept");
    await expect(refusedAccept).toHaveText(`Cannot accept at ${FEMALE_ONLY_UNIT_NAME}`);
    await expect(refusedAccept).toHaveAttribute("aria-disabled", "true");
    // D7 (a forensic bed is never offered) is not shown here: the sample network has no forensic
    // ward since owner ruling 1A. See the note on the unit constants above for where it is proven.
    // D3 rule 3: a designated bed constrains who may occupy it. This is the one dimension whose
    // failure mode is invisible in review — written as an equality it would exclude every
    // referral from the network's many UNDESIGNATED beds while still excluding this one, so the
    // accepting count above and this line have to hold together to mean anything.
    // Wording changed 17 September 2026 (Opus review round 2, P2, privacy): the coordinator's own
    // console still names the sex designation and the unit, but no longer says "this referral's
    // sex" — see `genderDesignationResult` in `ward-eligibility.ts`.
    // The reason is `matchReason`'s gate detail plus the refusal sentence (`referral-match.tsx`).
    await expect(refusedAccept).toHaveAccessibleDescription(
      `${FEMALE_ONLY_UNIT_NAME} is female only and does not suit this patient. No recorded reason can override this.`,
    );
    // A unit that does not accept offers no accept control at all — the refusal is not merely
    // described, it is enforced in the UI.
    await expect(page.getByTestId(`ward-referral-match-accept-${FEMALE_ONLY_UNIT_ID}`)).toHaveCount(0);

    // --- Step 5: accept it. A human decides; nothing here allocated on its own (D10). ---
    await reviewWard.selectOption(ACCEPT_UNIT_ID);
    await showEveryWard();
    await page.getByTestId(`ward-referral-match-phone-cand-${ACCEPT_UNIT_ID}`).click();
    await page.getByTestId("ward-referral-match-phone-accept").click();
    await expect(page.getByTestId("ward-referral-match-rejection")).toHaveCount(0);
    await expect(page.getByTestId("ward-referral-match-decided")).toHaveText(`Accepted at ${ACCEPT_UNIT_NAME}.`);
    await expectNoReloadSince(page, "accepting the referral");

    // --- The board reflects the decision on the very next render: out of the queue, into
    // recently decided, with the outcome named. ---
    await expect(page.getByTestId("ward-referral-board-queued")).toContainText(`Awaiting decision ${SEEDED_QUEUED}`);
    /*
     * 🔴 **THIS HAS NOW BEEN WRONG IN BOTH DIRECTIONS, AND THE HEADING CHANGE IS WHY IT IS RIGHT
     * NOW.** It first read `SEEDED_DECIDED + 1`, which was true only while the seed sat below the
     * display cap. When the seed passed ten it became false and was pinned to the capped value
     * instead, with a comment saying the count no longer moves when a referral is decided.
     *
     * ⚠️ **THAT COMMENT WAS TRUE OF A HEADING THAT NAMED ONLY THE CAP.** Since the owner's
     * 2026-09-06 ruling the heading names the TOTAL as well, and the total moves: accepting one
     * more referral takes it from 18 to 19 while the shown count stays pinned at the cap. So both
     * halves are asserted, and they now assert opposite things on purpose — **the shown count must
     * NOT move and the total MUST** — which is a stronger statement than either version made.
     *
     * The card's presence is still asserted below; it was the only real check while the heading
     * could not distinguish these two quantities.
     */
    const decidedHeadingAfter = page.getByTestId("ward-referral-board-decided").locator("h2");
    await expect(decidedHeadingAfter).toContainText(String(SEEDED_DECIDED_SHOWN));
    await expect(decidedHeadingAfter).toContainText(String(SEEDED_DECIDED_STRUCTURAL + 1));
    expect(await queuedCardIds(page)).not.toContain(referralId);
    // Option A (9 Oct 2026): decided referrals live in the board's History tab. On a phone the
    // referral detail covers the board, so it is closed first.
    await page.getByRole("button", { name: "Close referral detail (Esc)" }).click();
    await page
      .getByTestId("ward-referral-board-screen")
      .getByRole("tab", { name: /^History/u })
      .click();
    const decidedCard = page.getByTestId(`ward-referral-board-decided-card-${referralId}`);
    await expect(decidedCard).toBeVisible();
    await expect(decidedCard).toContainText("Accepted");

    // D14, asserted rather than claimed (review finding M8). This comment used to say "no
    // handover is implied" above a lone `expectNoReloadSince`, which establishes nothing of the
    // sort — the structural property (ACCEPT_REFERRAL creates no `Movement`) is owned by
    // `tests/ward-referral-reducer.test.ts`, and what a BROWSER can check is what the board tells
    // the reader. So: the decided card names the unit the referral was accepted at, and the
    // board states plainly that nothing was held or moved.
    await expect(decidedCard).toContainText(ACCEPT_UNIT_NAME);
    // "held" -> "pulled": the same rename as the four sites the triage listed, in a place it did
    // not find. Read from referral-board.tsx:472, which renders "No bed is pulled, no patient is
    // moved and no transport is arranged." (R3, 2026-09-16 fix plan — "records the unit only" was
    // false for the ED and community arms, which never name a unit). ⚠️ NINETEENTH CAUSE — the
    // triage's six were derived from one run's failure list, and this test fails LATER in the same
    // journey, so its own failure was masked until the earlier ones were repaired. A failure list
    // is a snapshot of what fails FIRST.
    await expect(page.getByTestId("ward-referral-board-decided-note")).toContainText("No bed is pulled");
    await expect(page.getByTestId("ward-referral-board-decided-note")).toContainText("no patient is moved");

    await expectNoReloadSince(page, "the whole journey");
  });

  /**
   * Phase 8, Task 10. The one Chromium journey for the distance work, added to this spec rather
   * than to a new `ui-ward-*.spec.ts` file: a new ward spec has to be added by name to BOTH
   * hand-maintained alternations in `playwright.config.ts` AND to `scripts/ci-change-scope.mjs`,
   * and a spec absent from any of them silently never runs.
   *
   * D-181 item 7 (Josh, 13 Nov 2026; A16-04): only travel times someone has checked are shown, and
   * none is checked yet, so this journey no longer accepts at a "far" unit (there is none on
   * screen). It checks the not-recorded state instead: every accepting ward reads "Travel time not
   * recorded", no band label shows, and the out-of-area ledger lists nobody and says it is for want
   * of a travel time. When Josh supplies checked times this journey goes red by name and is
   * rewritten round them; the far-acceptance mechanism itself is covered by the unit tests that load
   * `tests/helpers/ward-test-travel-bands.ts`.
   *
   * Still true from D8-9: `ACCEPT_REFERRAL` creates no `Movement` and no `Admission`, so an
   * accepted referral is never on the ledger; nothing here pins a band to a place (D8-8 rule 2).
   * The ledger table's column and geometry checks that lived here need a ledger with rows; with no
   * checked band the table does not render, so they wait for checked times.
   */
  test("with no checked travel times, a referral's wards read not recorded and an accepted referral does not reach the out-of-area ledger", async ({
    page,
  }) => {
    expect(
      UNCHECKED_PLACEMENT,
      "fixture assumption: some acceptable unit has no checked travel band from some home region",
    ).toBeDefined();
    const { homeRegion, unit } = UNCHECKED_PLACEMENT!;

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/ward-flow/referrals", { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    await expect(
      page.locator('div[hidden][id^="S:"]'),
      "React's streamed content is still staged, so the whole screen is duplicated in the document",
    ).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId("ward-referral-board-screen")).toBeVisible({ timeout: 15_000 });
    await plantSentinel(page);

    // Raise a referral from the far home region, through the board's own "New referral" link,
    // which opens the slide-out in place over the board.
    await openNewReferralFromBoard(page);
    // Age band and home region are what this journey is actually about; the rest are answered
    // because R2.1 requires every question to be, and the `UNCHECKED_PLACEMENT` search has already
    // excluded sex-designated and forensic units, so none of them changes the acceptance below.
    // Answered "yes" here (the journey above answers "no"), so the acuity gate's other branch runs.
    //
    // The slide-out lists only wards whose beds match the chosen bed security, so the security is
    // read off the far unit itself: an open bed when it has one, otherwise a secure bed. No
    // transport is needed (patient or carer accompanied), as on the retired form's helper.
    await raiseReferralInSlideOut(page, {
      patient: { familyName: "Farfield", givenName: "Synthetic", umrn: "UM990702" },
      ageBand: unit.cohort,
      homeRegion,
      sex: RAISED.sex,
      gender: RAISED.gender,
      urgency: Number(RAISED.urgency) as UrgencyLevel,
      bedSecurity: unitHasOpenBeds(unit) ? "Open" : "Secure",
      highAcuityNursing: true,
      transport: "Family or carer",
      unitIds: [unit.id],
    });
    await expectNoReloadSince(page, "sending the far referral from the slide-out");

    await goToBoardViaPhoneRail(page);
    await expectNoReloadSince(page, "back to the board after raising the far referral");

    const raisedId = (await queuedCardIds(page)).find((id) => !SEEDED_QUEUED_IDS.has(id));
    expect(raisedId, "the referral raised in the slide-out never reached the board").toBeDefined();
    await page.getByTestId(`ward-referral-board-card-select-${raisedId}`).click();
    // v10 phone (11 Oct 2026): at phone width the match lists wards in fit groups, by design; the
    // travel-band groups this journey asserts are the wider view, from 769px. No reload: only the
    // viewport changes, with the referral still selected.
    await page.setViewportSize({ width: 769, height: 900 });

    // D-181 item 7: no checked travel time, so the panel says so once, and every ward that accepts
    // reads "Travel time not recorded" rather than a band.
    const panel = page.getByTestId("ward-referral-match-panel");
    await expect(page.getByTestId("ward-referral-match-synthetic-notice")).toHaveText(SYNTHETIC_TRAVEL_TIMES_NOTICE);
    const more = panel.getByRole("button", { name: /^Show \d+ more with a bed ready$/ });
    if (await more.count()) await more.click();
    const accepting = panel.locator('[data-testid^="ward-referral-match-phone-cand-"][data-kind="yes"]');
    await expect(accepting.first(), "no ward accepts this referral, so there is no acceptance to make").toBeVisible();
    for (const row of await accepting.all()) await expect(row).toContainText(NOT_RECORDED_LABEL);
    for (const label of Object.values(TRAVEL_BAND_LABELS)) await expect(panel).not.toContainText(label);

    await accepting.first().click();
    const accept = page.getByTestId("ward-referral-match-phone-accept");
    await expect(accept).toHaveText(/^Accept at .+/u);
    const acceptLabel = ((await accept.textContent()) ?? "").trim();
    expect(acceptLabel, "the accept control's label no longer names the unit").toMatch(/^Accept at .+/);
    const acceptedUnitName = acceptLabel.replace(/^Accept at /, "");
    await accept.click();
    await expect(page.getByTestId("ward-referral-match-rejection")).toHaveCount(0);
    await expect(page.getByTestId("ward-referral-match-decided")).toHaveText(`Accepted at ${acceptedUnitName}.`);
    await expectNoReloadSince(page, "accepting the referral");

    // A phone user closes the drawer with its own control before reaching for the rail.
    await page.getByRole("button", { name: "Close referral detail (Esc)", exact: true }).click();
    await expect(page.getByTestId("ward-referral-detail")).toHaveCount(0);

    // On to the ledger, through the coordinator's own rail rather than a typed URL (see
    // `goToBoardViaPhoneRail` for why one tap reaches it, and `openRailSheetIfNeeded` for More pages).
    await page.setViewportSize({ width: 375, height: 812 });
    const ledgerRail = page.getByTestId("ward-rail");
    await expect(
      ledgerRail.or(page.getByTestId("ward-bar-phone-menu")).filter({ visible: true }),
      "the shell rail or the bar's phone Menu must be on the phone screen",
    ).toHaveCount(1);
    if (await openRailSheetIfNeeded(page, ledgerRail)) {
      await page.getByRole("link", { name: /^Out of area\b/u }).click();
    } else {
      await ledgerRail.getByRole("link", { name: /^Out of area\b/u }).click();
    }
    await expect(page.getByTestId("ward-out-of-area-board")).toBeVisible({ timeout: 15_000 });
    await expectNoReloadSince(page, "navigating to the out-of-area ledger");

    // A16-04: with no checked travel time nobody is shown as far from home. Our referral has not
    // arrived, so it is not on the ledger either way. The phone lists nobody; from 769px the empty
    // list says that is for want of a travel time, never that nobody is far.
    await expect(page.locator('[data-testid^="ward-out-of-area-card-"]')).toHaveCount(0);
    await page.setViewportSize({ width: 769, height: 900 });
    await expect(page.getByTestId("ward-out-of-area-empty")).toHaveText(
      /^Nobody is shown as far from home\. \d+ (?:person has|people have) no travel time recorded\.$/u,
    );
    await expect(page.locator('[data-testid^="ward-out-of-area-row-"]')).toHaveCount(0);
    await expect(page.getByTestId("ward-out-of-area-table")).toHaveCount(0);
  });

  /**
   * Owner ruling, Answer 13 (second round, 2026-09-17): "The Tier cell goes back to bold, dark
   * text." The queued board's `<table>` (`.tierCell`) still carries that treatment, but that table
   * is `display: none` in this workspace — kept mounted only for its print contract — so it is
   * never what a coordinator reads. The card list (`ward-referral-board-queued-cards`) is the live,
   * visible representation, and its `.cardTier` span is what this test measures. As with the
   * original defect, the property under test is "inked differently from a plain field on the same
   * card" rather than a pinned colour: that survives a legitimate token rename and still catches
   * the exact specificity-loss failure this test is named for (see `.table td.tierCell`'s own
   * comment in `referrals.module.css` for the general shape of that trap).
   */
  test("the referral board's Tier card is inked differently from the plain fields on its own card", async ({
    page,
  }) => {
    // Option A (9 Oct 2026): the cards are the phone's queue, so this is measured at phone width.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/ward-flow/referrals", { waitUntil: "load" });
    await expect(
      page.locator('div[hidden][id^="S:"]'),
      "React's streamed content is still staged, so the whole screen is duplicated in the document",
    ).toHaveCount(0, { timeout: 15_000 });

    const cards = page.getByTestId("ward-referral-board-queued-cards");
    await expect(cards, "no queued referral cards rendered").toBeVisible();

    const firstCard = cards.locator("li").first();
    await expect(firstCard, "the queued board rendered no first card to measure").toBeVisible();

    const cardTestId = await firstCard
      .locator("[data-testid^='ward-referral-board-card-tier-']")
      .getAttribute("data-testid");
    expect(cardTestId, "no Tier field on the first queued card").not.toBeNull();
    const referralId = cardTestId!.replace("ward-referral-board-card-tier-", "");

    const tier = page.getByTestId(`ward-referral-board-card-tier-${referralId}`);
    const plain = page.getByTestId(`ward-referral-board-card-service-${referralId}`);
    await expect(tier, "the Tier field is not rendered on the queued card").toBeVisible();
    await expect(plain, "the comparison field is not rendered on the queued card").toBeVisible();

    const read = async (locator: typeof tier) =>
      locator.evaluate((el) => {
        const style = getComputedStyle(el);
        return { text: (el.textContent ?? "").trim(), color: style.color, weight: style.fontWeight };
      });
    const [tierStyle, plainStyle] = await Promise.all([read(tier), read(plain)]);

    expect(tierStyle.text.length, "the Tier field is empty, so its ink says nothing").toBeGreaterThan(0);
    expect(plainStyle.text.length, "the comparison field is empty, so its ink says nothing").toBeGreaterThan(0);

    expect(
      tierStyle.color,
      `the Tier field is inked ${tierStyle.color}, the same as the plain field beside it — its colour ` +
        "declaration is losing to another rule (or was reverted to the muted tone) and is inert",
    ).not.toBe(plainStyle.color);
    expect(tierStyle.weight, "the Tier field is no longer bolder than the plain field beside it").not.toBe(
      plainStyle.weight,
    );
  });

  /**
   * OVERFLOW IS PERMITTED — STANDARD §5.8 NAMES A TABLE WRAPPER AS A THING THAT MAY SCROLL SIDEWAYS
   * — BUT ONLY TOGETHER WITH ITS AFFORDANCE. A table off the screen with no cue and no sentence is
   * still a defect; this test's old form forbade overflow outright, which was STRICTER than the
   * standard permits and outlawed the standard's own sanctioned pattern.
   *
   * ⚠️ **D-9/archived D-10 (`docs/history/archive/dated-notes/owner-decisions-2026-09-1x.md`): only ONE overflow exists in the
   * whole 4-width × 2-table matrix this loop covers** — `ward-referral-board-queued-table` at
   * 641px, the "Home region" column (right edge 623 vs a 606px scroller). Nothing overflows at
   * 700/760/820px, and the decided table never overflows at any of the four. Fitting eight columns
   * into 641px would hide a clinical column outright or drop text below the type floor — both worse
   * than honest, signposted scrolling.
   *
   * **Archived D-10 overrides §5.8's own shade for this board**: `--edge-shade` does not resolve in this
   * stylesheet's (second-edition) token layer at all — it silently paints nothing — and this design
   * language has already rejected a gradient cue twice, in `ward-table.module.css` and
   * `coordinator.module.css`, because it degrades to nothing under `forced-colors: active`. So the
   * affordance here is the SENTENCE ("scroll sideways for the rest", in the section's own count
   * heading) as the mandatory, primary cue, plus the codebase's existing measured `data-overflowing`
   * border pattern (`flow-diagram.tsx`/`coordinator.module.css`) as its visual echo — never a new
   * design token.
   *
   * 🔴 **THE SENTENCE MUST BE TRUE ONLY WHILE THE TABLE GENUINELY OVERFLOWS RIGHT NOW.** A static
   * "this table can scroll" claim would be false on a wide screen — the difference between an
   * affordance and a decoration — so every NON-overflowing table in the matrix is asserted NOT to
   * carry the sentence, not just every overflowing one asserted TO carry it. Two mutations prove
   * this contract can actually fail: removing the measured border alone reddens the cue assertion
   * below, and restoring it and removing the sentence alone reddens the sentence assertion, each
   * naming the table and width.
   *
   * The floor first, and it is not decoration: a table rendering no header or first-row cell would
   * make every assertion below pass having measured nothing, at either table, at any of the four
   * widths this loop runs at.
   */
  test("the referral board's tables may overflow only together with the scroll-sideways affordance", async ({
    page,
  }) => {
    for (const width of [744, 760, 820, 1000]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/ward-flow/referrals", { waitUntil: "load" });
      // The same staging-copy wait the two journey tests above already use (see the comment before
      // their own `page.goto` for why `load`/`networkidle` alone are not enough: React 19 defers
      // the swap out of the streamed `<div hidden id="S:...">` staging container past both). This
      // test measured the board before that copy had cleared, which is a documented flake risk —
      // closed here, in the test being rewritten, rather than left for someone else to rediscover.
      await page.waitForLoadState("networkidle");
      await expect(
        page.locator('div[hidden][id^="S:"]'),
        "React's streamed content is still staged, so the whole screen is duplicated in the document",
      ).toHaveCount(0, { timeout: 15_000 });

      const scrollers = page.locator('[data-testid^="ward-referral-board-"][data-ward-primitive="table"]');
      expect(
        await scrollers.count(),
        `the referral board renders no table at ${width}px, so the containment check below would ` +
          "pass having measured nothing",
      ).toBeGreaterThan(0);

      const measured = await scrollers.evaluateAll((nodes) =>
        nodes.map((scroll) => {
          const right = scroll.getBoundingClientRect().right;
          const cells = [...scroll.querySelectorAll("thead th, tbody tr:first-child td")];
          // The affordance's two halves live one DOM hop apart: the section's own `<h2>` count
          // heading (never a nested `<section>` in between, on either table) and the scroller's
          // own computed border — `getComputedStyle`, not a class-name or attribute check, so the
          // assertion below proves the cue actually PAINTS rather than that a class was applied
          // and lost on specificity, the exact trap this board's Tier-cell test above exists for.
          const heading = scroll.closest("section")?.querySelector("h2") ?? null;
          const style = getComputedStyle(scroll);
          return {
            id: scroll.getAttribute("data-testid") ?? "(no testid)",
            cells: cells.length,
            clipped: cells
              .filter((cell) => cell.getBoundingClientRect().right > right + 1)
              .map(
                (cell) =>
                  `${(cell.textContent ?? "").trim()} (right edge ${Math.round(cell.getBoundingClientRect().right)} vs scroller ${Math.round(right)})`,
              ),
            headingFound: heading !== null,
            headingText: (heading?.textContent ?? "").trim(),
            borderTopWidth: parseFloat(style.borderTopWidth || "0"),
          };
        }),
      );

      for (const table of measured) {
        expect(
          table.cells,
          `${table.id} rendered no header or first-row cell at ${width}px — nothing was measured`,
        ).toBeGreaterThan(0);
        expect(
          table.headingFound,
          `${table.id}'s enclosing section has no <h2> count heading at ${width}px — nothing was ` +
            "measured for the sentence half of the affordance",
        ).toBe(true);

        const overflowing = table.clipped.length > 0;
        const hasSentence = table.headingText.includes("scroll sideways for the rest");
        const hasMeasuredCue = table.borderTopWidth > 0;

        if (overflowing) {
          expect(
            hasMeasuredCue,
            `column(s) of ${table.id} are off the screen at ${width}px (${table.clipped.join("; ")}) ` +
              `but its wrapper carries no measured border cue (border-top-width ${table.borderTopWidth}px) — ` +
              "overflow with no visible affordance",
          ).toBe(true);
          expect(
            hasSentence,
            `column(s) of ${table.id} are off the screen at ${width}px (${table.clipped.join("; ")}) ` +
              `but its section heading ("${table.headingText}") does not say so`,
          ).toBe(true);
        } else {
          expect(
            hasSentence,
            `${table.id} is not overflowing at ${width}px, so its heading ("${table.headingText}") must not ` +
              'read "scroll sideways for the rest" — a static claim would be false on a wide screen',
          ).toBe(false);
        }
      }
    }
  });
});

/**
 * 🔴 **PRINTING THE REFERRAL BOARD LOST EVERY REFERRAL'S IDENTIFIER, AND THE QUEUED CARDS ENTIRELY.**
 *
 * `globals.css:4725-4727` hides `header, nav, button` with `display: none !important` on paper. That
 * rule is right — the decline, confirm and reset controls on this board SHOULD vanish. But this
 * screen makes the whole table row and the whole queued card a real `<button>`, so a coordinator can
 * select by clicking anywhere on it. **That is the correct accessibility call, and it is exactly what
 * puts CONTENT inside an element the print sheet hides.**
 *
 * ⚠️ **The table half was the more dangerous of the two.** `.rowSelectButton` carries only the
 * referral id, and the refusal text is deliberately a SIBLING of it because a `<button>` takes
 * phrasing content only (`referral-board.tsx:411`). **So the answers printed and the identifier did
 * not** — a handover sheet of rows saying what was decided, with nothing saying which referral each
 * decision belonged to. The card half simply left the page.
 *
 * 🔴 **THIS TEST EXISTS BECAUSE NOTHING ELSE IN THE REPOSITORY CAN SEE IT.** jsdom evaluates no
 * `@media` query, so every unit and DOM test passes; the element is in the DOM the whole time, so a
 * query finds it and an ordinary screenshot shows it. **Only real print emulation renders the verdict.**
 * Found by Ward Verifier as the second instance of a class Ward Builder One hit on the search hub,
 * where all 41 rows vanished the same way — and the identical defect had already been diagnosed and
 * fixed on ONE screen (`ward-management-network.module.css:1044`) months of screens ago. **A written
 * diagnosis on one screen is not a sweep.**
 *
 * **Asserts the ID IS READABLE, never that the button exists** — a hidden button is still in the DOM,
 * and `toBeVisible()` on the control would pass against the very defect this is written to catch.
 */
test.describe("@mockup Referral board — what survives onto paper", () => {
  test("prints every queued referral's identifier, not just the answers given about it", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/ward-flow/referrals", { waitUntil: "load" });

    const firstQueued = referralQueueOrder(referrals)[0];
    expect(firstQueued, "no queued referral in the fixture — this test would prove nothing").toBeDefined();
    const id = firstQueued!.id;

    // On screen first, so a failure below separates "never rendered" from "lost to print".
    //
    // ⚠️ **THE CARD's TESTID, NOT THE TABLE's.** `referrals.module.css`'s "served register" rework
    // made `.tableScroll { display: none }` unconditional and `.cardList` the live representation
    // at every width, table kept mounted only "for its established print contract" — so
    // `ward-referral-board-select-${id}` (the table row's own button) is hidden on screen now,
    // at every width, not only the phone one this test resizes to further down for its own,
    // separate reason.
    // Option A (9 Oct 2026) shows the queue as a table on desktop again, so at this width the
    // table row's own button is the live one.
    // Next can retain a hidden route tree during navigation. Read this page's active main,
    // then its queued table, so an off-screen copy cannot make the patient locator ambiguous.
    const main = page.getByRole("main");
    const table = main.getByTestId("ward-referral-board-queued-table");
    const rowButton = table.getByTestId(`ward-referral-board-select-${id}`);
    await expect(rowButton).toBeVisible();
    // Option A names the row by the patient (D-39: a person, never an internal id), and that name
    // is the row button's own text.
    const rowName = ((await rowButton.textContent()) ?? "").trim();
    expect(rowName.length, `the queued row for ${id} names nobody on screen`).toBeGreaterThan(0);

    await page.emulateMedia({ media: "print" });

    /*
     * `getByText` rather than the testid: the testid is on the BUTTON, and the question is whether
     * its text reaches the page. Scoped to the table so the card's copy of the same name cannot
     * satisfy it — the two halves broke independently and must be provable independently.
     */
    await expect(
      table.getByText(rowName, { exact: true }).first(),
      `the patient named on ${id}'s row is not on the printed sheet — the row's select button is hiding its own content`,
    ).toBeVisible();

    /*
     * ⚠️ **THE CARD-SURVIVES-PRINT CHECK THIS COMMENT ONCE DESCRIBED IS REMOVED, 2026-09-17 — NOT
     * BECAUSE THE PROPERTY STOPPED MATTERING, BUT BECAUSE THE APP NOW MEETS IT A DIFFERENT WAY.**
     * The "served register" rework repointed printing at the TABLE instead of forcing the CARD to
     * survive it: `.screen[data-referral-view="register"] .cardList { display: none }` under
     * `@media print` now hides cards on paper deliberately (the table already carries the same
     * facts there, so printing both would duplicate the sheet), while the table itself flips from
     * `display: none` on screen to `display: block` for print. The identifier-survives-printing
     * property this whole test exists for is what the table assertion just above already proved —
     * asserting the card ALSO survives print now fights the current design rather than protecting
     * anything real.
     */
    // The controls that SHOULD go. Without this the fix could have been a blanket un-hiding of
    // every button, which would put decline/confirm actions on a paper handover sheet.
    const anyAction = page.locator('button:has-text("Decline"), button:has-text("Confirm")').first();
    if ((await anyAction.count()) > 0) {
      await expect(
        anyAction,
        "an action button printed — globals.css was relaxed instead of the screen fixed",
      ).toBeHidden();
    }
  });
});

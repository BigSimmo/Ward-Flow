import { expect, test, type Locator, type Page } from "playwright/test";

import { OUT_OF_AREA_BANDS, TRAVEL_BAND_LABELS, travelBand } from "@/components/ward-management/ward-distance";
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

/**
 * Task 7 (Phase 7, "The front door"). One journey: a referral is raised from the PHONE-WIDTH
 * intake form (`/mockups/ward-flow/referrals/new`), appears on the coordinator's board
 * (`/mockups/ward-flow/referrals`), is matched against the whole network, and is accepted — and
 * the board reflects every one of those steps on the very next render, with **no `page.goto()`
 * anywhere after the first navigation**.
 *
 * The no-reload rule is the whole point, and it is the same one `ui-ward-discharges.spec.ts`
 * states for its own journey: a `goto` is a full page load that re-mounts `WardFlowProvider`
 * (mounted once in `src/app/mockups/ward-flow/layout.tsx`, above every ward route) and resets
 * every referral back to the seed fixture. Every assertion below would then pass whether or not
 * the intake form's `RECEIVE_REFERRAL` ever reached the coordinator's board at all. Because
 * "I did not call `goto`" is a claim about the test rather than about the browser, the journey
 * also plants `__wardFlowJourneySentinel` on `window` immediately after the single navigation and
 * re-checks it after each route change: a full document load clears it, so an accidentally
 * reintroduced reload fails loudly here rather than silently making the journey vacuous.
 *
 * Navigation is the app's own, never a typed URL — the board's "New referral" `<Link>`
 * (`referral-board.tsx`, the intake form's only entry point, see `WARD_NAV_INTENTIONALLY_UNLISTED`
 * in `ward-nav.ts`) on the way in, and the coordinator's own navigation rail on the way back.
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
 *  hold someone involuntarily, at the most urgent tier. Chosen so the two dimensions that decide
 *  the outcome below are the interesting ones — sex designation and forensic — rather than
 *  security or legal status, which would exclude most of the network before those were reached. */
const RAISED = {
  ageBand: "Adult",
  sex: "Male",
  // T11/T10 (owner answer 17 September 2026): a separate required question from Sex above it. This
  // helper has now been missed four times when a new required question landed (see the comment
  // trail inside `answerEveryIntakeQuestion` below) — this is the fifth, and the fix is the same:
  // a real answer here, never a softened assertion in the helper.
  gender: "Male",
  homeRegion: "Perth Metropolitan",
  source: "police",
  urgency: "1",
} as const;

/**
 * Phase R2.1. The intake form no longer answers anything for the clinician, so every journey
 * below answers every question before Send becomes available.
 *
 * Both journeys used to lean on the defaults — one left the two need toggles and the origin site
 * untouched, the other left five of the eight questions untouched — and both submitted
 * successfully anyway. They were pinned to the behaviour this phase deliberately removes; each
 * now states the referral it is raising instead of inheriting one.
 *
 * The two need questions are answered "No" in both, which is exactly what the untouched
 * checkboxes used to send, so the acceptance arithmetic these journeys assert is unchanged — the
 * difference is that the "no" is now chosen rather than assumed. The origin site is taken from
 * the site table rather than typed, so no hospital code lives in this file.
 */
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

async function answerEveryIntakeQuestion(
  page: Page,
  answers: {
    ageBand: string;
    sex: string;
    gender: string;
    homeRegion: string;
    source: string;
    urgency: string;
    highAcuityNursingNeeded: "yes" | "no";
  },
) {
  // v6 (7 Oct 2026): Age band and Sex are segmented radio groups.
  await page
    .getByTestId("ward-referral-intake-ageBand")
    .locator("label")
    .filter({ has: page.getByRole("radio", { name: answers.ageBand, exact: true }) })
    .click();
  await page
    .getByTestId("ward-referral-intake-sex")
    .locator("label")
    .filter({ has: page.getByRole("radio", { name: answers.sex, exact: true }) })
    .click();
  // T11/T10 (owner answer 17 September 2026): a separate required question from Sex — the fifth
  // question this helper has been missed for (see the trail below on the ninth through twelfth).
  await page.getByTestId("ward-referral-intake-gender").selectOption(answers.gender);
  await page.getByTestId("ward-referral-intake-homeRegion").selectOption(answers.homeRegion);
  await page.getByTestId("ward-referral-intake-source").selectOption(answers.source);
  await page.getByTestId("ward-referral-intake-urgency").selectOption(answers.urgency);
  await page.getByTestId("ward-referral-intake-originSiteCode").selectOption(wardSites[0].code);
  await answerToggle(page, "ward-referral-intake-secureBedNeeded-no");
  await answerToggle(page, "ward-referral-intake-involuntaryBedNeeded-no");
  // The THIRTEENTH question, required since the owner's 2026-09-10 ruling that high-acuity nursing
  // need is marked by the REFERRING CLINICIAN, not defaulted — `UNANSWERED_VALUE` exists on this
  // field for exactly the reason this whole comment thread describes: a default of `false` would
  // record "no high-acuity nursing needed" for a referral nobody asked about, and the acuity gate
  // (`ward-eligibility.ts`, `referralEligibility`'s "acuity" gate) would silently never fire. This
  // helper answers it explicitly rather than defaulting it, and the caller chooses which way — see
  // each call site for why that journey answers "yes" or "no".
  await answerToggle(page, `ward-referral-intake-highAcuityNursingNeeded-${answers.highAcuityNursingNeeded}`);
  // The ninth question, on the owner's 2026-08-30 ruling ("Take all recommendations"): transport
  // is a yes/no group that starts unanswered, not a checkbox that starts at `false`. A journey
  // that skips it never gets an available Send, so it belongs here with the other eight.
  await answerToggle(page, "ward-referral-intake-transportNeeded-no");
  // The tenth question, added when `521888a23` made a destination required ("The referrer chooses
  // where to refer, and is shown why"). This spec was last touched seven hours earlier, so it went
  // on answering nine and then asserting an available Send — two journeys red on a requirement that
  // did not exist when they were written. The repair is a new ANSWER here, never a softened
  // assertion on line 89: that assertion is what makes a missed question fail loudly instead of
  // timing out on a click, and it did exactly its job.
  //
  // `psychiatric_ward` specifically, and that is a decision rather than the first option to hand.
  // Both journeys below accept the patient at a unit, and one asserts out-of-area ledger
  // arithmetic. An ED or community destination would satisfy Send just as well and would quietly
  // change what the rest of each journey is testing.
  await page.getByTestId("ward-referral-intake-destination-psychiatric_ward").check();
  // The ELEVENTH question, required since CM-4 (2026-08-30). ⚠️ THIS IS THE THIRD TIME THIS HELPER
  // HAS BEEN MISSED — the ninth and tenth are recorded above, in their own words, by the two people
  // who hit this before. Each time a required question landed, this helper went on answering the
  // old set and two journeys went red on a requirement that did not exist when they were written.
  // The repair is a new ANSWER here, never a softened assertion below: fixing the two call sites
  // instead would leave the helper wrong for the twelfth question.
  //
  // A real suburb from the catchment table rather than a typed string — the picker is built from
  // suburbOptions(), so an invented value would not be selectable. No assertion in this file
  // depends on WHICH suburb, only that the question is answered.
  await page.getByTestId("ward-referral-intake-suburb").selectOption("Albany");
  // The TWELFTH question, required since the written-history change (2026-09-05) — and this is the
  // FOURTH time this helper has been missed, exactly as the note above predicted. Three journeys
  // in this file and `ui-ward-discharges.spec.ts` went red the moment `historyWhyNow` became
  // required, and stayed red all day: no routine gate runs a `@mockup` spec, so nothing said so.
  //
  // ⚠️ THE REPAIR IS THIS ANSWER, NOT A SOFTENED ASSERTION BELOW — the instruction the previous
  // two people left here, followed rather than rediscovered. Only `historyWhyNow` is filled:
  // `historyBackground` and `historyRiskAndSafety` are genuinely optional and answering them here
  // would hide a future change that made either one required.
  //
  // Free text, so any non-blank string serves; the reducer stores it byte for byte and refuses
  // only a blank one. No assertion in this file depends on WHAT it says.
  await page
    .getByTestId("ward-referral-intake-history")
    .fill("Brought in by family after two days of not sleeping and increasing agitation at home.");
  // Send only becomes available once the last question is answered, so this is both a wait and an
  // assertion: a journey that had missed one would fail here rather than time out on a click.
  await expect(page.getByTestId("ward-referral-intake-submit")).not.toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("ward-referral-intake-unavailable")).toHaveCount(0);
}

/** Phase 8: the four travel bands plus the not-recorded group. Written out here rather than
 *  derived, for the same reason `tests/ward-travel-grouping.test.ts` writes its own copy out: a
 *  count derived from `TRAVEL_BANDS` moves with it and could not fail, so adding or removing a
 *  band stays a decision somebody takes in a test. It counts groups on a screen. */
const BAND_GROUP_COUNT = 5;

/** The unit this journey accepts at: the first unit in the site table's own order, and the order
 *  the match view lists every unit in (D10 — it never sorts, ranks or truncates). */
const ACCEPT_UNIT_ID = "rph-adult-secure";
const ACCEPT_UNIT_NAME = "Dabakarn";

/** Units that must NOT accept this referral, one per reason, named individually so a rule that
 *  quietly stopped excluding anything cannot pass this journey.
 *  The forensic example (Broome) is gone: owner ruling 2026-09-25 (answer 1A), Broome's Mabu Liyan
 *  is not forensic, so the sample network has no forensic ward and this built-app journey cannot
 *  show that refusal. The forensic rule is proven where a made-up forensic ward can be put in
 *  (`tests/helpers/ward-made-up-forensic-ward.ts`): its wording in `tests/ward-eligibility.test.ts`,
 *  and the refusal on screen in `tests/ward-referral-screens.dom.test.tsx`. */
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
// SEVEN since 2026-09-22: RF-RD06 arrives with the rulings-demo overlay (`BOARD_SEED_REFERRALS`
// below). Tier 2, raised 55 min before the anchor, so it leads tier 2 on longest wait.
const SEEDED_QUEUED = 7;
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
 */
const SEEDED_DECIDED_STRUCTURAL = 24;

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

/** Every unit in the network, and how many of them accept the referral raised above. Both are
 *  hardcoded rather than recomputed from `referralEligibility`: re-deriving the expected number
 *  with the very function under test would make this assertion true by construction whatever the
 *  matching rules did. The fixture assumptions guarded at the top of the test are what keep a
 *  hardcoded number honest — if the network changes, this fails at the assumption, by name. */
// 22 since 26 Sept 2026 (confirmed ward facts: Kununurra's ward removed; allUnits() on the seed
// returns 22). ACCEPTING_UNITS stays 13: the removed ward had no allocatable bed
// (allocatable.value 0), so it never passed the allocatable-bed gate and was never one of the 13.
const NETWORK_UNITS = 22;
const ACCEPTING_UNITS = 13;

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
 * Ordered as `referralQueueOrder` orders it (urgency tier, then longest wait), matching the pin in
 * `tests/ward-referral-model.test.ts`, so the two files can be read against each other.
 */
// RF-011 appended 2026-09-03. It joined the seed as the one multi-destination referral, so
// FD-23 could be SEEN on the running app rather than only asserted in a unit test -- and this
// list was not extended with it, so the browser journey failed on a fixture assumption rather
// than a rendering fault. The order matches the pin in tests/ward-referral-model.test.ts,
// which the doc comment above says these two files should be readable against.
//
// RF-014 and RF-015 appended here 2026-09-11, six hours after they joined the seed (2026-09-07)
// as the two invented EXPECTS rows (`ward-movements.ts`, "TWO EXPECTS — INVENTED"). Both are
// addressed to an emergency department, state "queued", urgency 3 (the lowest tier, following
// RF-011's precedent so an unrelated tier's order does not move) — which is exactly why they sort
// last, and why RF-015 (raised 4,500 minutes ago) precedes RF-014 (raised 150 minutes ago): longest
// wait first within a tier. This is not re-derived from `referrals` with `referralQueueOrder`
// itself, for the same reason `SEEDED_DECIDED_STRUCTURAL` above stays a literal rather than a call
// to `recentlyDecidedReferrals` — that would make the fixture-assumption assertion below true by
// construction against the very function it exists to check. The order is instead copied from the
// independent pin in `tests/ward-referral-model.test.ts` ("orders the real fixture's queued
// referrals by urgency, then by longest wait"), which this file's own doc comment above says these
// two files should be readable against — so a future divergence between the two pins is a
// discrepancy somebody can find by reading, not a silent one.
const SEEDED_QUEUED_IDS = new Set(["RF-RD06", "RF-001", "RF-009", "RF-005", "RF-015", "RF-014", "RF-011"]);
if (SEEDED_QUEUED_IDS.size !== SEEDED_QUEUED) {
  throw new Error(
    `SEEDED_QUEUED is ${SEEDED_QUEUED} and SEEDED_QUEUED_IDS now holds ${SEEDED_QUEUED_IDS.size} ids. Update ` +
      `SEEDED_QUEUED to match — it is the count the board's own "Queued (n)" heading and card list are checked ` +
      `against, and the two must name the same set or one of those checks is silently wrong.`,
  );
}

/**
 * Phase 8, Task 10. A (home region, unit) pair the synthetic table puts OUT OF AREA, searched out
 * of the fixture rather than named.
 *
 * Naming one would be a test asserting that a particular real hospital is a particular distance
 * from a particular real region — the exact thing D8-8 rule 2 forbids, because every value in
 * `SYNTHETIC_TRAVEL_BANDS` is an invented placeholder chosen mechanically by list position and the
 * owner must be able to replace them without a test going red. Searching means this either keeps
 * working across that replacement or fails loudly, by name, at the assertion in the journey.
 *
 * Forensic beds, sex-designated beds and wards with nothing allocatable are skipped, because each
 * would decline the referral for a reason that has nothing to do with distance. Everything past
 * that is read off the SCREEN rather than predicted here: the journey takes whichever accept
 * control the far group actually offers and names the unit from that control's own label, so the
 * matching rules under test are never used to compute the expectation they are being checked
 * against. All this search fixes is which home region and age band get typed into the form.
 */
const FAR_PLACEMENT = (() => {
  for (const homeRegion of HOME_REGIONS) {
    for (const unit of allUnits()) {
      const band = travelBand(homeRegion, unit.siteCode);
      if (!band || !OUT_OF_AREA_BANDS.includes(band)) continue;
      if (unit.forensic || unit.sexDesignation !== "Undesignated") continue;
      if (unit.allocatable.value <= 0) continue;
      return { homeRegion, unit, band };
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

/** Back to the board through the coordinator's own rail, as a phone user reaches it.
 *
 * 🔴 **THE PHONE RAIL CHANGED SHAPE ENTIRELY ON 2026-09-11, AND THIS HELPER'S FIRST TWO LINES
 * WENT WITH IT.** It used to open `ClinicalRail`'s fixed phone bar (`getByRole("button", { name:
 * "Open Ward Flow menu" })`) and click inside the drawer that opened, scoping to the dialog
 * because the CSS-hidden desktop rail carried the same destination. **No `<ClinicalRail>` is
 * mounted anywhere in `src/` any more** — `src/app/mockups/ward-flow/layout.tsx` mounts
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
  const opener = (await morePages.isVisible()) ? morePages : (await menu.isVisible()) ? menu : undefined;
  if (!opener) return false;
  await opener.click();
  await expect(page.getByTestId("ward-rail-more-pages")).toBeVisible();
  return true;
}

async function goToBoardViaPhoneRail(page: Page) {
  const rail = page.getByTestId("ward-rail");
  await expect(rail, "the shell rail must be on the phone screen").toBeVisible();
  // ⚠️ **TWO INDEPENDENT DRIFTS, BOTH FROM THE OWNER-REQUESTED GROUPED RAIL (2026-09-13,
  // `shell/ward-rail.tsx`'s `RAIL_GROUPS`).** First, the label is now "Referral Board" (capital
  // B, `RAIL_GROUPS`' own literal), not "Referral board" — a case-sensitive regex with no `i` flag
  // silently never matches. Second, and the one that actually hung this helper for 60s: "Referral
  // Board" lives in the "Care Coordination" group, which is no longer inline at phone width. Only
  // Command/Movement/Capacity (`NARROW_CORE_ENTRY_IDS`) plus the current route's own entry stay
  // inline below 1000px; everything else — Referral Board included — sits behind "More pages"
  // until that sheet is opened.
  // The sheet portals to `document.body` by default (`components/ui/sheet.tsx`'s `Sheet`), so its
  // content sits outside `rail`'s own DOM subtree once open — the target link is looked up from
  // `page`, unscoped, rather than from `rail`.
  if (await openRailSheetIfNeeded(page, rail)) {
    await page.getByRole("link", { name: /^Referrals\b/iu }).click();
  } else {
    await rail.getByRole("link", { name: /^Referrals\b/iu }).click();
  }
  await expect(page.getByTestId("ward-referral-board-screen")).toBeVisible({ timeout: 15_000 });
}

/**
 * Since 22 September (f997ac75a1) sending opens a modal "Referral recorded locally" receipt over
 * the whole screen. A person reads it and closes it before using the rail, so these journeys do the
 * same: the receipt must appear, and its footer "Close" (not the header "Close dialog") must close it.
 */
async function closeReferralReceipt(page: Page) {
  const receipt = page.getByRole("dialog", { name: "Referral recorded locally" });
  await expect(receipt).toBeVisible();
  await receipt.getByRole("button", { name: "Close", exact: true }).click();
  await expect(receipt).toHaveCount(0);
}

test.describe("@mockup Ward referrals — the front door, phone to board to accepted", () => {
  test.describe.configure({ timeout: 60_000 });

  test("a referral raised on the phone-width intake form reaches the coordinator's board, matches against the network, and is accepted — with the board reflecting every step without a reload", async ({
    page,
  }) => {
    // D12: the intake form is designed for a phone and adapted upward. The whole journey runs at
    // phone width, including the coordinator's half — the board must be usable there too.
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
    // The referral this journey raises leads the queue on urgency alone, and the assertion that it
    // does (further down) is only meaningful while nothing seeded is as urgent. Checked here so a
    // seed that gained a tier-1 referral fails by name, rather than as an unexplained ordering
    // failure two hundred lines later.
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
    await page.goto("/mockups/ward-flow/referrals", { waitUntil: "load" });
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

    // --- Step 1: into the intake form, through the board's own "New referral" <Link>. ---
    await page.getByTestId("ward-referral-board-new").click();
    await expect(page.getByTestId("ward-referral-intake-screen")).toBeVisible({ timeout: 15_000 });
    await expectNoReloadSince(page, "board -> intake form");

    // --- Step 2: raise the referral. Every control is a picker or a toggle; there is no free-text
    // input on this screen and there must never be one (binding constraint: no free text
    // anywhere, and no fact about the person beyond the permitted few). ---
    // R2.1: nothing on this form arrives answered, and Send stays unavailable — with the
    // outstanding questions named on screen — until every one of them has an answer.
    await expect(page.getByTestId("ward-referral-intake-submit")).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByTestId("ward-referral-intake-unavailable")).toBeVisible();
    // Answered "no" here: the acceptance arithmetic below (`ACCEPTING_UNITS`, `ACCEPT_UNIT_ID`) is
    // hardcoded, and every one of those 13 units is staffed for high-acuity nursing anyway — so
    // "no" is the answer that keeps this journey's counts exactly what they were before this
    // question existed. The far-placement journey below answers "yes" instead, so the acuity gate
    // is exercised both ways somewhere in this file rather than only ever seeing "no".
    await answerEveryIntakeQuestion(page, { ...RAISED, highAcuityNursingNeeded: "no" });
    await answerToggle(page, "ward-referral-intake-transportNeeded-yes");

    await page.getByTestId("ward-referral-intake-submit").click();
    await expect(page.getByTestId("ward-referral-intake-confirmation")).toBeVisible();
    // A refusal renders its own `role="alert"` instead (`ward-referral-intake-rejection`). The
    // confirmation and the rejection are separate elements, so asserting only the first would
    // pass on a screen showing both.
    await expect(page.getByTestId("ward-referral-intake-rejection")).toHaveCount(0);
    await expectNoReloadSince(page, "submitting the intake form");
    await closeReferralReceipt(page);

    // --- Step 3: back to the board through the rail, and the referral is there. ---
    await goToBoardViaPhoneRail(page);
    await expectNoReloadSince(page, "intake form -> board via the phone rail");

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

    // The queue ranks by urgency tier first (`referralQueueOrder`), and this referral was raised
    // at a more urgent tier than every seeded queued referral — so it leads the queue. That
    // relation is not asserted here in prose: the fixture-assumption block above checks it against
    // the real seed, so a fixture whose queue gained a tier-1 referral fails there by name rather
    // than here as a confusing off-by-one in the ordering.
    //
    // Ordering, not merely membership: a board that appended it at the bottom would still
    // "contain" it.
    expect(queuedAfter[0], "the most urgent referral leads the queue").toBe(referralId);

    const raisedCard = page.getByTestId(`ward-referral-board-card-select-${referralId}`);
    await expect(raisedCard).toContainText("Tier 1");
    await expect(raisedCard).toContainText(`${RAISED.ageBand} · ${RAISED.sex} · ${RAISED.homeRegion}`);
    // Length of wait is rendered on the card in its own right (D11) — the queue ranks by urgency,
    // but the wait is what carries the moral weight, so it is never left implicit.
    await expect(page.getByTestId(`ward-referral-board-card-wait-${referralId}`)).toContainText("waiting");

    // --- Step 4: match it against the network. ---
    await raisedCard.click();
    const matchPanel = page.getByTestId("ward-referral-match-panel");
    await expect(matchPanel).toBeVisible();
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
    await expect(page.getByTestId("ward-referral-match-accepting-count")).toHaveText(
      `${ACCEPTING_UNITS} of ${NETWORK_UNITS} units accept this referral right now.`,
    );
    // Every unit in the network is listed, never a shortlist (D10). Phase 8 groups those rows by
    // travel band, so they are spread across five `<details>` groups rather than one flat list —
    // the count is unchanged, which is the property this line has always pinned.
    await expect(page.getByTestId("ward-referral-match-list").locator("li")).toHaveCount(NETWORK_UNITS);

    // Phase 8, Task 4 (owner decision, 2026-08-29): the band groups are SHUT by default at phone
    // width, and this journey is phone width throughout. Nothing is hidden by that — every heading
    // and both of its counts are on the screen while shut, asserted here before anything is opened,
    // so "there is nothing available within an hour" is answerable without expanding a thing.
    const bandGroups = page
      .getByTestId("ward-referral-match-list")
      .locator('details[data-testid^="ward-referral-match-band-group-"]');
    await expect(bandGroups).toHaveCount(BAND_GROUP_COUNT);
    let unitsAcrossBands = 0;
    for (let index = 0; index < BAND_GROUP_COUNT; index += 1) {
      const summary = bandGroups.nth(index).locator(":scope > summary");
      await expect(summary).toBeVisible();
      // Scoped to the SUMMARY and reading its TEXT, both deliberately. A closed `<details>` paints
      // only its summary, so counts rendered one line below it would still be in the DOM, still
      // pass a document-wide query, and still leave a coordinator on a phone looking at five bare
      // bars. Asserting the box is visible does not catch that; asserting the numbers are inside
      // that box does.
      await expect(summary).toContainText(/[0-9]+ units? in this band/);
      await expect(summary).toContainText(/[0-9]+ accepts? this referral/);
      // A heading states composition, never operational temporality — "right now" belongs to the
      // accepting-count line above and must never migrate into a band heading.
      await expect(summary).not.toContainText(/right now/i);
      const text = (await summary.textContent()) ?? "";
      const units = Number(/([0-9]+) units? in this band/.exec(text)?.[1]);
      expect(Number.isNaN(units), `band heading ${index} states no unit count: ${text}`).toBe(false);
      unitsAcrossBands += units;
    }
    // The five shut headings between them account for the whole network, so nothing is hidden by
    // the fold: every bed is answered for before anything is opened.
    expect(unitsAcrossBands).toBe(NETWORK_UNITS);
    // The invented-travel-times sentence is on this screen, once, wherever a band is shown.
    await expect(page.getByTestId("ward-referral-match-synthetic-notice")).toBeVisible();
    // A coordinator on a phone opens the groups to reach the rows. Every group is expanded here so
    // the assertions below see the whole network exactly as they did before the grouping existed.
    for (let index = 0; index < BAND_GROUP_COUNT; index += 1) {
      await bandGroups.nth(index).locator(":scope > summary").click();
    }

    // The bed accepted below, and one unit per reason it is not offered — each named, so a rule
    // that stopped excluding anything cannot pass unnoticed.
    await expect(page.getByTestId(`ward-referral-match-accepts-${ACCEPT_UNIT_ID}`)).toBeVisible();
    // D7 (a forensic bed is never offered) is not shown here: the sample network has no forensic
    // ward since owner ruling 1A. See the note on the unit constants above for where it is proven.
    // D3 rule 3: a designated bed constrains who may occupy it. This is the one dimension whose
    // failure mode is invisible in review — written as an equality it would exclude every
    // referral from the network's many UNDESIGNATED beds while still excluding this one, so the
    // accepting count above and this line have to hold together to mean anything.
    // Wording changed 17 September 2026 (Opus review round 2, P2, privacy): the coordinator's own
    // console still names the sex designation and the unit, but no longer says "this referral's
    // sex" — see `genderDesignationResult` in `ward-eligibility.ts`.
    await expect(page.getByTestId(`ward-referral-match-reason-${FEMALE_ONLY_UNIT_ID}`)).toHaveText(
      `${FEMALE_ONLY_UNIT_NAME} is female only and does not suit this patient`,
    );
    await expect(page.getByTestId(`ward-referral-match-reason-${WRONG_AGE_UNIT_ID}`)).toHaveText(
      "Older adult unit does not match an adult referral",
    );
    // A unit that does not accept offers no accept control at all — the refusal is not merely
    // described, it is enforced in the UI.
    await expect(page.getByTestId(`ward-referral-match-accept-${FEMALE_ONLY_UNIT_ID}`)).toHaveCount(0);

    // --- Step 5: accept it. A human decides; nothing here allocated on its own (D10). ---
    await page.getByTestId(`ward-referral-match-accept-${ACCEPT_UNIT_ID}`).click();
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
   * WHERE THIS DEPARTS FROM THE BRIEF, and why. The brief asked for "accept at a far unit, record
   * its arrival, and see it on the out-of-area ledger". The middle and last steps are impossible
   * BY DESIGN, and asking for them predates the screens: `ACCEPT_REFERRAL` creates no `Movement`
   * and no `Admission` (the board says exactly that in its own words, asserted in the journey
   * above), and `OutOfAreaBoard` reads `wardAdmissions` — a seed no `WardFlowEvent` writes to. So
   * there is no arrival to record for a referral, and nothing done on these screens can add anyone
   * to that ledger. Rather than skip the step or fake it, this journey PINS that: the referral it
   * accepts at a far unit must NOT appear on the ledger afterwards, and the ledger must say why in
   * its own provenance sentence. An impossible step becomes a guarded property (D8-9).
   *
   * NOTHING HERE PINS A BAND TO A PLACE. D8-8 rule 2 forbids a test asserting that some named
   * hospital is three hours from some named region: every value in `SYNTHETIC_TRAVEL_BANDS` is an
   * invented placeholder, and a test pinning one would turn the owner's future correction into a
   * test failure. The far region and the far unit are therefore SEARCHED out of the fixture at
   * module scope and named nowhere. That search is SETUP, not assertion — the assertions it feeds
   * are absolute — and if the fixture ever holds no such pair this fails loudly by name instead of
   * quietly testing a near unit.
   */
  test("a referral accepted at a unit the fixture puts out of area does not reach the out-of-area ledger, which says why", async ({
    page,
  }) => {
    expect(
      FAR_PLACEMENT,
      "fixture assumption: no (home region, acceptable unit) pair in the synthetic table is out of area, so this journey cannot test a far acceptance at all",
    ).toBeDefined();
    const { homeRegion, unit, band } = FAR_PLACEMENT!;

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/mockups/ward-flow/referrals", { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    await expect(
      page.locator('div[hidden][id^="S:"]'),
      "React's streamed content is still staged, so the whole screen is duplicated in the document",
    ).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId("ward-referral-board-screen")).toBeVisible({ timeout: 15_000 });
    await plantSentinel(page);

    // Raise a referral from the far home region, through the board's own "New referral" link.
    await page.getByTestId("ward-referral-board-new").click();
    await expect(page.getByTestId("ward-referral-intake-screen")).toBeVisible({ timeout: 15_000 });
    // Age band and home region are what this journey is actually about; the rest are answered
    // because R2.1 requires every question to be, and the `FAR_PLACEMENT` search has already
    // excluded sex-designated and forensic units, so none of them changes the acceptance below.
    // Answered "yes" here (the journey above answers "no") — confirmed by re-running
    // `referralEligibility` for this exact (ageBand, homeRegion) pair with the acuity gate both
    // ways: `FAR_PLACEMENT.unit` (`arm-adult-open`) is staffed for high-acuity nursing
    // (`highAcuityCapacity: 2`) and remains the far band group's only accepting unit either way, so
    // "yes" exercises the gate's other branch without changing which unit this journey accepts at.
    await answerEveryIntakeQuestion(page, {
      ...RAISED,
      ageBand: unit.cohort,
      homeRegion,
      highAcuityNursingNeeded: "yes",
    });
    await page.getByTestId("ward-referral-intake-submit").click();
    await expect(page.getByTestId("ward-referral-intake-confirmation")).toBeVisible();
    await expect(page.getByTestId("ward-referral-intake-rejection")).toHaveCount(0);
    await closeReferralReceipt(page);

    await goToBoardViaPhoneRail(page);
    await expectNoReloadSince(page, "back to the board after raising the far referral");

    const raisedId = (await queuedCardIds(page)).find((id) => !SEEDED_QUEUED_IDS.has(id));
    expect(raisedId, "the referral raised on the intake form never reached the board").toBeDefined();
    await page.getByTestId(`ward-referral-board-card-select-${raisedId}`).click();

    // The five groups, and the sentence saying the times are invented, on the screen where the
    // acceptance is actually taken.
    await expect(
      page.getByTestId("ward-referral-match-list").locator('details[data-testid^="ward-referral-match-band-group-"]'),
    ).toHaveCount(BAND_GROUP_COUNT);
    await expect(page.getByTestId("ward-referral-match-synthetic-notice")).toBeVisible();

    // Open the far group by CLICK, the way a coordinator does. At 375px the groups mount shut, so
    // the accept control really is behind the disclosure here rather than already on screen — which
    // is the whole reason this step is worth doing in a browser. Its counts are visible while it is
    // still shut, which jsdom cannot show, because jsdom does not hide closed disclosure content.
    const farGroup = page.getByTestId(`ward-referral-match-band-group-${band}`);
    await expect(farGroup).toHaveJSProperty("open", false);
    /*
     * Phase 8, Task 10 fix round (F2). This replaces an
     * `expect(OUT_OF_AREA_BANDS).toContain(band)` that stood here and COULD NOT FAIL: `band`
     * reached that line only because the `FAR_PLACEMENT` search had already admitted it through
     * `OUT_OF_AREA_BANDS.includes(band)` a hundred lines earlier, so both sides of the comparison
     * were the same source. A check that cannot fail, added by the task whose subject is checks
     * that cannot fail.
     *
     * What is worth checking at this point has two genuinely different sources: the group the
     * screen mounted under THIS band's testid must also be showing THIS band's heading. The testid
     * comes from the grouping in `referral-match.tsx` and the heading from `travelBandGroupLabel`,
     * so a group rendered under one band's testid while headed with another band's label fails
     * here — which would mean the accept control taken out of it below belongs to a band the
     * coordinator was never shown. Stated precisely: this does not re-prove that the band is out of
     * area (the search settled that); it proves the screen agrees about which band this group is.
     */
    await expect(farGroup.locator(":scope > summary")).toContainText(TRAVEL_BAND_LABELS[band]);
    await expect(page.getByTestId(`ward-referral-match-band-counts-${band}`)).toBeVisible();
    await farGroup.locator(":scope > summary").click();
    await expect(farGroup).toHaveJSProperty("open", true);

    // The accept control is taken from INSIDE the far group, so "far" is a property of where the
    // button was found rather than a claim this test makes about a named hospital. The unit's name
    // then comes off that control's own label, so the acceptance message below is checked against
    // what the screen offered rather than against anything recomputed here.
    const farAccept = farGroup.locator("[data-testid^='ward-referral-match-accept-']").first();
    await expect(
      farAccept,
      `the ${band} group offers no unit that accepts this referral, so there is no far acceptance to make`,
    ).toBeVisible();
    const acceptLabel = ((await farAccept.textContent()) ?? "").trim();
    expect(acceptLabel, "the accept control's label no longer names the unit").toMatch(/^Accept at .+/);
    const acceptedUnitName = acceptLabel.replace(/^Accept at /, "");

    await farAccept.click();
    await expect(page.getByTestId("ward-referral-match-rejection")).toHaveCount(0);
    await expect(page.getByTestId("ward-referral-match-decided")).toHaveText(`Accepted at ${acceptedUnitName}.`);
    await expectNoReloadSince(page, "accepting at the far unit");

    // At 375px the referral opens as a full-screen slide-over above the rail (`referrals.module.css`,
    // max-width 63.9375rem, since 81553692fb). A phone user closes it with its own control before
    // reaching for the rail, and so does this journey — then proves it is gone.
    await page.getByRole("button", { name: "Close referral detail (Esc)", exact: true }).click();
    await expect(page.getByTestId("ward-referral-detail-backdrop")).toHaveCount(0);

    // On to the ledger, through the coordinator's own rail rather than a typed URL.
    //
    // 🔴 **ONE TAP, NOT THREE, SINCE 2026-09-11** — for the reason `goToBoardViaPhoneRail` above
    // records at length: `ClinicalRail`'s phone drawer (and its "Open Ward Flow menu" button) is
    // not mounted anywhere in `src/` any more, and the third-edition rail puts the same links on
    // the phone screen rather than behind a button. This still navigates by tapping a real rail
    // link at 375px, which is what "through the coordinator's own rail" was asserting.
    const ledgerRail = page.getByTestId("ward-rail");
    await expect(ledgerRail, "the shell rail must be on the phone screen").toBeVisible();
    // "Out of area" is in the "Oversight" group of the owner-requested grouped rail
    // (2026-09-13, `shell/ward-rail.tsx`'s `RAIL_GROUPS`), which is not inline below 1000px — see
    // `goToBoardViaPhoneRail`'s own comment on the same drift. Open "More pages" first if it is
    // there to open.
    // The sheet portals to `document.body` (`components/ui/sheet.tsx`'s `Sheet`, default
    // `portal={true}`), so its content sits outside `ledgerRail`'s own DOM subtree once open —
    // looked up from `page`, unscoped, once that is the case.
    if (await openRailSheetIfNeeded(page, ledgerRail)) {
      await page.getByRole("link", { name: /^Out of area\b/u }).click();
    } else {
      await ledgerRail.getByRole("link", { name: /^Out of area\b/u }).click();
    }
    await expect(page.getByTestId("ward-out-of-area-board")).toBeVisible({ timeout: 15_000 });
    await expectNoReloadSince(page, "navigating to the out-of-area ledger");

    // The invented-threshold sentence, WHOLE and on screen — not truncated, not behind a tooltip,
    // not a fragment.
    //
    // ⚠️ RETARGETED 2026-09-17. The third-edition visual upgrade (883ecfdfb4, 2026-09-16) rebuilt
    // this board's "Travel definition" panel with its OWN two-piece notice — a short threshold
    // sentence plus a nested `ward-out-of-area-synthetic-notice` disclaimer span — rather than
    // reusing the shared `INVENTED_OUT_OF_AREA_THRESHOLD_NOTICE` constant (that constant is still
    // rendered verbatim, unchanged, on the statistics-compare screen). Comparing against the
    // exact current text below, rather than the now-unrelated shared constant, so a future
    // rewording that silently drops the "invented and unvalidated" disclaimer is still caught —
    // and asserting on both the whole paragraph and the nested span keeps that non-substring
    // discipline the original comment called for.
    // In the clean functional view, explanatory and synthetic notices have been removed
    await expect(page.getByTestId("ward-out-of-area-threshold-notice")).toHaveCount(0);
    await expect(page.getByTestId("ward-out-of-area-synthetic-notice")).toHaveCount(0);

    // D8-9, and the reason the brief's "record its arrival" step does not exist: nothing done on
    // these screens reaches this ledger, and the ledger says so in its own words.
    /*
     * Phase 8, Task 10 fix round (F3). NON-VACUITY FLOOR, before the two absence pins below.
     *
     * `toHaveCount(0)` on `ward-out-of-area-row-<id>` proves nothing on its own: rename the
     * row/card testid scheme and it goes green having established only that a testid nobody uses
     * matches nothing. Same shape as the route-scan sanity check at the top of
     * `tests/ward-nav.test.ts` — pin what must be PRESENT before trusting what must be ABSENT.
     *
     * So: the ledger must be rendering rows and cards under exactly the prefixes the absence pins
     * use, and the two layouts must be showing the same set of people (the table above 40rem, the
     * cards below it — a coordinator on a phone sees only the second, so a floor that reached only
     * the table would leave half the assertion unfloored).
     */
    const ledgerRows = page.locator('[data-testid^="ward-out-of-area-row-"]');
    const ledgerCards = page.locator('[data-testid^="ward-out-of-area-card-"]');
    const ledgerRowCount = await ledgerRows.count();
    expect(
      ledgerRowCount,
      "the ledger renders no row under `ward-out-of-area-row-`, so the absence assertions below would pass against a testid scheme that no longer exists",
    ).toBeGreaterThan(0);
    await expect(ledgerCards, "the ledger's phone cards and its table are not showing the same people").toHaveCount(
      ledgerRowCount,
    );

    /*
     * And what the ledger renders is what the ledger promises. Every row's travel-time cell must
     * carry the label of one of `OUT_OF_AREA_BANDS` — the board is headed "People in a bed far
     * from home", and the constant is this prototype's whole definition of far. Two sources: the
     * board's own filter decides which people are listed, the exported list decides which bands
     * count as far. This is where `OUT_OF_AREA_BANDS` earns its place in this spec, replacing the
     * tautology removed above.
     */
    const outOfAreaLabels = OUT_OF_AREA_BANDS.map((b) => TRAVEL_BAND_LABELS[b]);
    const ledgerHeaderTexts = await page.getByTestId("ward-out-of-area-table").locator("thead th").allTextContents();
    const travelTimeColumn = ledgerHeaderTexts.findIndex((heading) => heading.trim() === "Travel time");
    expect(travelTimeColumn, "the ledger must label its travel-time column").toBeGreaterThanOrEqual(0);
    const renderedBands = await ledgerRows.evaluateAll(
      (rows, column) => rows.map((row) => (row.children[column]?.textContent ?? "").trim()),
      travelTimeColumn,
    );
    expect(
      [...new Set(renderedBands)].filter((b) => !outOfAreaLabels.includes(b)),
      "the out-of-area ledger is listing somebody whose travel band is not one this prototype calls out of area",
    ).toEqual([]);

    await expect(page.getByTestId(`ward-out-of-area-row-${raisedId}`)).toHaveCount(0);
    await expect(page.getByTestId(`ward-out-of-area-card-${raisedId}`)).toHaveCount(0);
    /*
     * ⚠️ THE SENTENCE CHANGED BECAUSE THE BEHAVIOUR DID, AND CHOOSING THE REPLACEMENT IS THE WHOLE
     * OF THIS EDIT.
     *
     * This pinned "Nothing done on these screens adds anyone to this list or takes anyone off it"
     * until 2026-08-30. That promise was retired at `74253c367`: the board now reads live state, so
     * a patient who ARRIVES during the session IS added straight away. The old sentence had become
     * false and the screen correctly stopped saying it.
     *
     * ⚠️ **The re-baseline trap, avoided deliberately.** The obvious repair is to paste whatever the
     * screen now prints, and the new copy offers a longer, more specific-sounding candidate — the
     * emergency-department pathway records no home region. **That sentence is true and it is not why
     * OUR referral is absent.** The referral raised by this journey is missing from the ledger
     * because it has NOT ARRIVED; nobody is in a bed. Pinning the home-region clause would leave a
     * green test asserting the wrong reason, which is worse than the red one, because nothing would
     * ever say so again.
     *
     * So the assertion pins the clause that carries "why" FOR THIS JOURNEY. The two counts above
     * prove the referral is absent; this proves the screen says why it is absent.
     *
     * ⚠️ RETARGETED AGAIN, 2026-09-17. The provenance paragraph was rewritten (same redesign that
     * restructured the out-of-area threshold notice above into its own two-piece form) to: "This is
     * not a live statewide count. It uses this prototype's seeded records. People who have left
     * their bed or have not arrived are excluded. A recorded arrival is added during the session;
     * arrivals from the emergency-department pathway have no home region and join the unbanded
     * count above." Avoiding the SAME re-baseline trap the paragraph above warns about: the new
     * copy's home-region/ED clause is true and is still not why OUR referral is missing — it has
     * not arrived, nobody is in a bed. "have not arrived are excluded" is the clause that carries
     * that specific reason in the new wording, so that is what is pinned, not the whole paragraph.
     */
    await expect(page.getByTestId("ward-out-of-area-provenance")).toHaveCount(0);

    /*
     * Phase 8, Task 10. The ledger's table, at the narrowest width it is ever used at.
     *
     * Found by looking, and invisible to every other check on this branch. Just above the 40rem
     * card/table swap, the table's own `min-width` was wider than the space the shell leaves it,
     * so `Since arrival` — this screen's second headline fact, and the one Task 5 reformatted from
     * an unreadable `5041h 30m` into days — sat entirely outside its `overflow-x: auto` scroller
     * with nothing on screen saying so. Measured before the fix at a 641px viewport: scroller
     * client width 499px against a table 608px wide, the last column's right edge at 715px against
     * the scroller's at 606px. Every DOM assertion passed throughout, because the cell was in the
     * document the whole time; it was simply not on the screen.
     *
     * A real browser is the only place this can be checked — jsdom has no layout, so no Vitest
     * suite here can tell a column that is off-screen from one that is not. Asserted as geometric
     * containment rather than as a stylesheet value, so it goes on holding whatever the table's
     * widths, the shell's padding or the icon rail become.
     */
    await page.setViewportSize({ width: 641, height: 900 });
    const tableScroll = page.getByTestId("ward-out-of-area-table");
    await expect(tableScroll, "the ledger is not showing its table at 641px").toBeVisible();

    /*
     * PRESENCE BEFORE CONTAINMENT — whole-branch review, W1.
     *
     * The geometric check below measures whether a column ESCAPES its scroller. It says nothing
     * about whether the column is there at all, and two ways of removing one pass it silently:
     * delete the `th`/`td` pair and there is simply less to measure, or set `display: none` on it
     * and the cell keeps a zero-sized rect whose `right` is 0, which can never exceed the
     * scroller's. `Since arrival` — this screen's second headline fact — was pinned nowhere in the
     * repository; a grep returned only the component and comments about it. F3's band-subset check
     * further up reads `row.children[2]`, which incidentally pins the first three columns'
     * positions, so column four was the unpinned one.
     *
     * `toHaveText` with an array pins the count, the order and the spelling in a single assertion.
     * It does NOT close the hiding case, and the per-header `toBeVisible` loop below is not
     * decoration: the review that raised this expected `toHaveText` to read only visible text, and
     * it does not — Playwright compares `textContent` unless told otherwise, so a `th` carrying
     * `display: none` still supplies its text. MEASURED, not assumed: with
     * `style={{ display: "none" }}` on a header of the sibling discharges table, the array
     * assertion alone passed. `toBeVisible` is the matcher that fails for `display: none`,
     * `visibility: hidden` and a zero-size box alike, which is the whole class the geometric check
     * below cannot see.
     *
     * Nothing below is relaxed to make room for these — together they close deletion, reordering,
     * renaming and hiding, and neither adds a matcher that could later be loosened.
     */
    const LEDGER_COLUMNS = ["Patient", "Home region", "Unit", "Travel time", "Since arrival"];
    const ledgerHeaders = tableScroll.locator("thead th");
    await expect(
      ledgerHeaders,
      "the out-of-area ledger's table no longer carries exactly these five columns, in this order",
    ).toHaveText(LEDGER_COLUMNS);
    for (const [index, column] of LEDGER_COLUMNS.entries()) {
      await expect(
        ledgerHeaders.nth(index),
        `the out-of-area ledger's \`${column}\` column is in the document but not on the screen`,
      ).toBeVisible();
    }

    const clipped = await tableScroll.evaluate((scroll) => {
      const right = scroll.getBoundingClientRect().right;
      return [...scroll.querySelectorAll("thead th, tbody tr:first-child td")]
        .filter((cell) => cell.getBoundingClientRect().right > right + 1)
        .map(
          (cell) =>
            `${(cell.textContent ?? "").trim()} (right edge ${Math.round(cell.getBoundingClientRect().right)} vs scroller ${Math.round(right)})`,
        );
    });
    expect(
      clipped,
      "column(s) of the out-of-area table are off the screen at 641px, reachable only by scrolling sideways inside the table",
    ).toEqual([]);
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
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/mockups/ward-flow/referrals", { waitUntil: "load" });

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
   * ⚠️ **D-9/D-10 (`docs/ward-flow/owner-decisions-2026-09-1x.md`): only ONE overflow exists in the
   * whole 4-width × 2-table matrix this loop covers** — `ward-referral-board-queued-table` at
   * 641px, the "Home region" column (right edge 623 vs a 606px scroller). Nothing overflows at
   * 700/760/820px, and the decided table never overflows at any of the four. Fitting eight columns
   * into 641px would hide a clinical column outright or drop text below the type floor — both worse
   * than honest, signposted scrolling.
   *
   * **D-10 overrides §5.8's own shade for this board**: `--edge-shade` does not resolve in this
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
    for (const width of [641, 700, 760, 820]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/mockups/ward-flow/referrals", { waitUntil: "load" });
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
    await page.goto("/mockups/ward-flow/referrals", { waitUntil: "load" });

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
    await expect(page.getByTestId(`ward-referral-board-card-select-${id}`)).toBeVisible();

    await page.emulateMedia({ media: "print" });

    /*
     * `getByText` rather than the testid: the testid is on the BUTTON, and the question is whether
     * its text reaches the page. Scoped to the table so the card's copy of the same id cannot
     * satisfy it — the two halves broke independently and must be provable independently.
     */
    const table = page.getByTestId("ward-referral-board-queued-table");
    await expect(
      table.getByText(id, { exact: true }).first(),
      `the referral id ${id} is not on the printed sheet — the row's select button is hiding its own content`,
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

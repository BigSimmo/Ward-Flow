import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { expectNeverSaysAgain, expectSays } from "./helpers/ward-caption";
import { vi } from "vitest";

// Same reason as every sibling dom suite (ward-discharge-board.dom.test.tsx,
// ward-handover.dom.test.tsx, ward-ed-screen.dom.test.tsx): `ClinicalRail` renders next/link
// anchors and this suite never checks routing, so a plain <a> avoids an App Router context
// jsdom cannot provide.
vi.mock("next/navigation", () => ({
  // The Ward Flow sidebar derives its role from the route (ward-nav-role-order.ts), so every
  // suite that renders a rail needs a pathname. A whole-module mock without one makes
  // `usePathname` undefined, which throws at render rather than returning a wrong answer.
  usePathname: () => "/mockups/ward-flow",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { OutOfAreaBoard } from "@/components/ward-management/out-of-area/out-of-area-board";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import {
  ReferralIntakeForm,
  REQUIRED_FIELD_NAMES,
  UNANSWERED_OPTION_LABEL,
  UNANSWERED_VALUE,
  HISTORY_FIELDS,
} from "@/components/ward-management/referrals/referral-intake";
import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import {
  COHORTS,
  HOME_REGIONS,
  REFERRAL_ADDRESSING_STATES,
  REFERRAL_GENDERS,
  REFERRAL_SOURCES,
  RECORDED_SEXES,
  SEXES,
  URGENCY_LEVELS,
  type CommunityDeclineReason,
  type Referral,
  type ReferralAddressing,
  type ReferralAddressingState,
  type ReferralDeclineReason,
  type ReferralDestination,
  type Unit,
} from "@/components/ward-management/ward-model";
import { referralEligibility } from "@/components/ward-management/ward-eligibility";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { referrals } from "@/components/ward-management/ward-movements";
import { rulingsDemoOverlay } from "@/components/ward-management/ward-rulings-demo";
import { WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";
import {
  NOT_RECORDED_LABEL,
  OUT_OF_AREA_BANDS,
  SYNTHETIC_TRAVEL_TIMES_NOTICE,
  travelBand,
  TRAVEL_BAND_LABELS,
  TRAVEL_BANDS,
  unitTravelBand,
  type TravelBand,
} from "@/components/ward-management/ward-distance";
import {
  COMMUNITY_DECLINE_REASON_LABELS,
  DECLINE_REASON_LABELS,
  acceptedAddressing,
  declinedAddressings,
  referralAddressingStateLabel,
  recentlyDecidedReferrals,
  referralState,
} from "@/components/ward-management/ward-referrals";
import { OVERRIDE_REASONS } from "@/components/ward-management/ward-change-reasons";
import { allEmergencyDepartments, allUnits, NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";
import { markBroomeForensicForThisFile } from "./helpers/ward-made-up-forensic-ward";
/**
 * Phase 8, Task 4. The order the match view renders units in once they are grouped by travel band:
 * the fixed band order (`TRAVEL_BANDS`, then not-recorded), and INSIDE each band the site table's
 * own order — the property spec D10 turns on, that a row never moves because it accepts the
 * referral.
 *
 * Derived from `unitTravelBand` directly and NEVER from `groupCandidatesByTravelBand`. An
 * expectation computed by calling the very derivation the screen calls would move with it, so a
 * screen that grouped by something else entirely would still agree with its own expectation.
 */
function expectedGroupedUnitIds(referral: Referral): string[] {
  const units = allUnits();
  const bandsInOrder: (TravelBand | undefined)[] = [...TRAVEL_BANDS, undefined];
  return bandsInOrder.flatMap((band) =>
    units.filter((unit) => unitTravelBand(referral, unit) === band).map((unit) => unit.id),
  );
}

/**
 * The words for one decline reason, whichever vocabulary it came from — O-16.6 widened
 * `ReferralAddressing.declineReason` to `ReferralDeclineReason | CommunityDeclineReason` (a
 * community team now declines in its own words), so a reason read back off a real addressing is
 * no longer provably a `DECLINE_REASON_LABELS` key by the type alone. Mirrors the exact fallback
 * shape `refusalLines()` (`referral-board.tsx`) and `referralAddressingStateLabel`
 * (`ward-referrals.ts`) already use for this identical problem, rather than inventing a third.
 * Every reason this suite actually looks up is a ward's own (`RF-004`), so this never falls
 * through past the first map in practice — the fallback exists only to satisfy the type honestly.
 */
function declineReasonLabelForTest(reason: ReferralDeclineReason | CommunityDeclineReason): string {
  return (
    (DECLINE_REASON_LABELS as Record<string, string>)[reason] ??
    (COMMUNITY_DECLINE_REASON_LABELS as Record<string, string>)[reason] ??
    reason
  );
}

/** Every unit id the match view actually rendered, in DOM order. Read with `querySelectorAll`
 *  rather than a role query on purpose: the band groups are `<details>`, and a role query would
 *  quietly return nothing for a shut group, turning a completeness assertion into a vacuous one. */
function renderedUnitIds(list: HTMLElement): string[] {
  return Array.from(list.querySelectorAll("li[data-testid]")).map((row) =>
    (row.getAttribute("data-testid") ?? "").replace(/^ward-referral-match-row-/, ""),
  );
}

/** The accept controls the match view rendered, found without a role query for the same reason. */
/**
 * ⚠️ SELECTED BY TEST ID, NOT BY LABEL TEXT, AND THE CHANGE OF METHOD IS THE POINT.
 *
 * This matched `/^Accept at /` on the button's own words. That worked only while an unsuitable
 * ward carried NO control at all — the owner's ruling that a clinician may accept anyway, with a
 * recorded reason, put a second button on exactly those rows, and any label beginning "Accept at"
 * would have been silently collected here as though the ward had accepted.
 *
 * The id names the unconditional accept control specifically, so this helper now says what it
 * always meant. It is narrower than the text match, not wider.
 */
function acceptButtons(list: HTMLElement): HTMLButtonElement[] {
  return Array.from(list.querySelectorAll<HTMLButtonElement>('button[data-testid^="ward-referral-match-accept-"]'));
}

/** The seeded referral behind a board row, so a test can compute the band order for the very
 *  referral the screen is showing rather than for one it assumes matches. */
function seededReferral(id: string): Referral {
  const found = referrals.find((referral) => referral.id === id);
  expect(found, `the seed no longer contains ${id} — this test can no longer prove anything`).toBeDefined();
  return found!;
}

/** Mirrors `ward-discharge-board.dom.test.tsx`'s own harness pattern: a real reducer-backed
 *  count, read off shared context, so a test can prove a dispatch actually happened (or did
 *  not) rather than only inspecting what the form's own DOM renders. */
function RejectionCount() {
  const { rejections } = useWardFlow();
  return <span data-testid="rejection-count">{rejections.length}</span>;
}

/** Phase R2.1. The two need answers as the REDUCER received them, so a test can prove the form
 *  sent the answer a clinician chose rather than one it inherited. Read off reducer state for the
 *  same reason `RejectionCount` is: what the form renders back to itself is not evidence about
 *  what it dispatched. */
function NewestReferralFacts() {
  const { referrals } = useWardFlow();
  const newest = referrals[referrals.length - 1];
  // The bed criteria live on the ward arm now, so they are read through it rather than off the
  // referral. `undefined` where a referral is addressed elsewhere -- printed as such, so a test
  // reading this span can tell "not a ward referral" from "false".
  const wardAddressing = newest?.destinations.find((addressing) => addressing.destination.kind === "psychiatric_ward");
  const ward = wardAddressing?.destination.kind === "psychiatric_ward" ? wardAddressing.destination : undefined;
  return (
    <>
      {/* The COUNT, not merely the newest record: the seed already holds eight referrals, so
       *  "is there a newest one" is true before this form has done anything at all and would make
       *  a did-nothing-happen assertion vacuous. A test captures this before acting and compares. */}
      <span data-testid="referral-count">{referrals.length}</span>
      {/*
       * R2 review finding C1. Every id the reducer currently holds, so a test can name THE
       * REFERRAL IT CREATED — the one id that was not there before it clicked — rather than
       * reasoning about "the newest record on screen".
       *
       * This exists because the facts span below was read with a substring matcher while the
       * seed's own last row (`RF-008` in `ward-movements.ts`) already carries
       * `secureBedNeeded: true, involuntaryBedNeeded: false`. A test asserting exactly that
       * string was therefore satisfied BEFORE its click and stayed satisfied after any dispatch,
       * right, wrong or absent. Reading the ids, and pinning the created one into the facts
       * string below, is what stops that shape returning: the seed cannot produce an id no
       * earlier render held.
       */}
      <span data-testid="referral-ids">{referrals.map((referral) => referral.id).join(",")}</span>
      <span data-testid="newest-referral-facts">
        {newest
          ? `id=${newest.id} secure=${String(ward?.secureBedNeeded)} involuntary=${String(ward?.involuntaryBedNeeded)} ageBand=${newest.ageBand} sex=${String(ward?.sex)} urgency=${String(newest.urgency)}`
          : "none"}
      </span>
    </>
  );
}

function referralCount(): string {
  return screen.getByTestId("referral-count").textContent ?? "";
}

/** Every referral id the reducer holds right now, in its own order. */
function referralIds(): string[] {
  const rendered = screen.getByTestId("referral-ids").textContent ?? "";
  return rendered === "" ? [] : rendered.split(",");
}

/** The newest referral's facts as the REDUCER holds them, read WHOLE. Compared with `toBe` at
 *  every call site and never with `toHaveTextContent`, which is a normalised substring match —
 *  see `referral-ids` above for what that cost. */
function newestReferralFacts(): string {
  return screen.getByTestId("newest-referral-facts").textContent ?? "";
}

/** The facts string a referral raised through `answerEveryQuestion()` must carry, given the id it
 *  was actually assigned and the two need answers chosen. Built from the very constants
 *  `REQUIRED_QUESTIONS` answers with, so a picker whose value never reached the reducer — or
 *  reached it as something else — fails here rather than being read past. */
function expectedFactsFor(createdId: string, secure: boolean, involuntary: boolean): string {
  return `id=${createdId} secure=${String(secure)} involuntary=${String(involuntary)} ageBand=${COHORTS[0]} sex=${SEXES[0]} urgency=${String(URGENCY_LEVELS[0])}`;
}

/** The one id that appeared between a captured "before" list and now: the referral this test
 *  created. Asserted to be exactly one, so "nothing happened" and "two things happened" both fail
 *  here instead of being read past. */
function theOneNewReferralId(idsBefore: readonly string[], why: string): string {
  const created = referralIds().filter((id) => !idsBefore.includes(id));
  expect(created, why).toHaveLength(1);
  return created[0];
}

function renderForm() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ReferralIntakeForm />
      <RejectionCount />
      <NewestReferralFacts />
    </WardFlowProvider>,
  );
}

const EXPECTED_FIELD_TESTIDS = [
  "ward-referral-intake-ageBand",
  "ward-referral-intake-sex",
  // T11 (after T10, item 8, owner answer 17 September 2026): the referral-facing gender question.
  "ward-referral-intake-gender",
  "ward-referral-intake-homeRegion",
  "ward-referral-intake-suburb",
  "ward-referral-intake-secureBedNeeded",
  "ward-referral-intake-involuntaryBedNeeded",
  "ward-referral-intake-source",
  "ward-referral-intake-urgency",
  "ward-referral-intake-originSiteCode",
  "ward-referral-intake-transportNeeded",
  // FD-21: the destination picker, added 2026-08-30. Its testid sits on the wrapping
  // `<fieldset>` like the three need questions above, and the loop below pins the real controls
  // inside it for the same reason it pins theirs.
  "ward-referral-intake-destinations",
];

/**
 * Phase R2.1. Every question the form now waits on, in form order: how a test answers it, the
 * name the unavailability note must call it, and — for the pickers — a value that is real.
 *
 * The names are WRITTEN OUT here rather than imported from the component, and one test below
 * pins the component's own `REQUIRED_FIELD_NAMES` against this list. An expectation derived from
 * the very array the screen renders from would move with it, so adding a tenth question or
 * renaming one would pass silently; written out, either is a decision somebody takes in a test.
 */
const REQUIRED_QUESTIONS: readonly { readonly name: string; readonly answer: () => void }[] = [
  { name: "Age band", answer: () => selectAnswer("ageBand", COHORTS[0]) },
  { name: "Sex", answer: () => selectAnswer("sex", SEXES[0]) },
  // T11 (item 8): a real `ReferralGender`, not `NOT_RECORDED_VALUE` — the generic loop below
  // proves "Raise referral" is blocked while THIS question alone is unanswered, so it must answer
  // it with one of the form's real choices, the same discipline every other question here holds
  // to. `NOT_RECORDED_VALUE`'s own behaviour (a real, non-blocking answer) is covered separately.
  { name: "Gender", answer: () => selectAnswer("gender", REFERRAL_GENDERS[0]) },
  { name: "Home region", answer: () => selectAnswer("homeRegion", HOME_REGIONS[0]) },
  // A real suburb from the catchment source, not a plausible-looking string: the reducer resolves
  // it against the table, so an invented name would be refused at the door and this helper would
  // stop answering every question it claims to.
  { name: "Suburb", answer: () => selectAnswer("suburb", "Armadale") },
  { name: "Referral source", answer: () => selectAnswer("source", REFERRAL_SOURCES[0]) },
  { name: "Urgency", answer: () => selectAnswer("urgency", String(URGENCY_LEVELS[0])) },
  { name: "Origin site", answer: () => selectAnswer("originSiteCode", wardSites[0].code) },
  { name: "Secure bed needed", answer: () => chooseNeed("secureBedNeeded", "no") },
  { name: "Involuntary bed needed", answer: () => chooseNeed("involuntaryBedNeeded", "no") },
  // 2026-09-10, with the acuity gate. Its POSITION matters: the assertion below pins this list
  // against the form's own `REQUIRED_FIELDS` in order, which is what stops the two drifting.
  { name: "High-acuity nursing needed", answer: () => chooseNeed("highAcuityNursingNeeded", "no") },
  { name: "Transport needed", answer: () => chooseNeed("transportNeeded", "no") },
  /*
   * ⚠️ THE WRITTEN HISTORY IS NOT IN THIS LIST, AND ITS ABSENCE IS NOW THE POINT.
   *
   * "Why now" was here, required, from 2026-09-05 until the owner ruled the same day: ONE story
   * box, OPTIONAL. This list drives a generated test per question — "will not send, and says so,
   * while <question> alone is unanswered" — so **leaving the story here would assert that a blank
   * story blocks Send, which is exactly the behaviour the ruling removed.** A test in this list is
   * a claim that the form waits for the answer.
   *
   * The story's own behaviour is covered separately: that it sends when blank, that it sends when
   * written, and that an over-long one is refused rather than trimmed.
   */
  // FD-21. One kind is enough to make Send available; the picker's own suite
  // (`ward-referral-destinations.dom.test.tsx`) is what proves several can be chosen in one act,
  // that the cap holds, and that no kind can be chosen twice.
  { name: "Destination", answer: () => chooseDestination("psychiatric_ward") },
];

/**
 * The one question on this form that does not always apply: an emergency-department destination
 * must name WHICH department, and nothing else on the form does.
 *
 * Kept OUT of `REQUIRED_QUESTIONS` above, because every loop over that list answers all but one
 * question and expects Send to stay unavailable on the one left — which is only a true
 * expectation for a
 * question that always applies. Answering a ward-only referral must not be made to wait on a
 * department it is not going to.
 *
 * Its own behaviour — that it appears when an ED is ticked, that Send waits on it then, that no
 * department is pre-chosen, and that what reaches the reducer is a real `edId` with the purpose the
 * flow implies — is asserted in `tests/ward-ed-psychiatry-hub.dom.test.tsx`, against what the form
 * actually sends rather than against this list.
 */
const CONDITIONAL_QUESTION_NAMES = ["Emergency department", "Community team", "Sending ward"] as const;

function selectAnswer(field: string, value: string) {
  fireEvent.change(screen.getByTestId(`ward-referral-intake-${field}`), { target: { value } });
}

/**
 * ⚠️ The union is spelled out rather than widened to `string` DELIBERATELY — a typo in a testid
 * would otherwise find no element and fail somewhere far from its cause. Note that vitest does not
 * typecheck, so a stale member here goes unnoticed by the suite: `highAcuityNursingNeeded` was
 * added on 2026-09-10 and every test using it PASSED while this union still refused it. Only
 * `tsc` saw it.
 */
function chooseNeed(
  field: "secureBedNeeded" | "involuntaryBedNeeded" | "highAcuityNursingNeeded" | "transportNeeded",
  answer: "yes" | "no",
) {
  fireEvent.click(screen.getByTestId(`ward-referral-intake-${field}-${answer}`));
}

/** Ticks one destination. A checkbox per kind, so this can never produce two of one kind — which
 *  is what `RECEIVE_REFERRAL` refuses rather than de-duplicates. */
function chooseDestination(kind: string) {
  fireEvent.click(screen.getByTestId(`ward-referral-intake-destination-${kind}`));
}

/** Answers every required question. `except`, when given, names the ONE left unanswered. */
function answerEveryQuestion(except?: string) {
  for (const question of REQUIRED_QUESTIONS) {
    if (question.name === except) continue;
    question.answer();
  }
}

function submitButton(): HTMLElement {
  return screen.getByTestId("ward-referral-intake-submit");
}

/**
 * Activate a control and assert it did NOT throw.
 *
 * FOUND BY MUTATION, and the reason this exists rather than a bare `fireEvent.click`: deleting
 * BOTH of the form's inertness guards left every test below green. With the guards gone
 * `handleSubmit` threw a TypeError before it could reach `dispatch`, jsdom reported it and
 * carried on, and the OUTCOME was identical to the guard working — no new referral, no rejection.
 * A crash and a guard are not the same thing, and nothing here could tell them apart.
 *
 * jsdom routes an exception thrown inside an event listener to the window's `error` event, so
 * capturing that around the click is what distinguishes them.
 */
function clickExpectingNoError(element: HTMLElement, why: string) {
  const thrown: string[] = [];
  const capture = (event: ErrorEvent) => {
    thrown.push(String(event.error ?? event.message));
  };
  window.addEventListener("error", capture);
  try {
    fireEvent.click(element);
  } finally {
    window.removeEventListener("error", capture);
  }
  expect(thrown, why).toEqual([]);
}

/**
 * The floor under `clickExpectingNoError` (R2 review finding M2).
 *
 * That helper is an ABSENCE pin: it proves a click threw nothing. An absence pin passes just as
 * happily when its mechanism has stopped working as when the property holds, and nothing in this
 * repository reproduced the capture. If a React or jsdom upgrade stops routing a listener's
 * exception to the window's `error` event, the helper silently becomes a bare `fireEvent.click`,
 * every inertness test above stays green, and the exact defect the helper was written for — a
 * crash indistinguishable from a guard — comes back unnoticed.
 *
 * So: throw on purpose, and require the helper to catch it. This test failing does not mean the
 * form is broken; it means the eight inertness tests above have quietly stopped proving anything.
 *
 * The outer listener is not decoration. jsdom reports an uncaught listener exception to the
 * virtual console unless the `error` event's default is prevented, and the runner turns that into
 * an unhandled error against this file. Registered before the helper's own listener, it marks the
 * deliberate failure handled without suppressing the helper's capture, which runs after it.
 */

// Broome is not forensic (owner ruling 2026-09-25); this file keeps testing the forensic refusal on a
// made-up forensic Broome, which is exactly the network these tests were written against.
markBroomeForensicForThisFile();

describe("clickExpectingNoError", () => {
  it("captures a handler that throws, so every inertness test below is standing on something", () => {
    function DeliberatelyThrowingControl() {
      return (
        <button
          type="button"
          data-testid="deliberately-throwing-control"
          onClick={() => {
            throw new Error("deliberate probe failure");
          }}
        >
          Throw
        </button>
      );
    }

    render(<DeliberatelyThrowingControl />);

    const markHandled = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener("error", markHandled);
    let captured: unknown;
    try {
      clickExpectingNoError(screen.getByTestId("deliberately-throwing-control"), "the probe's own why string");
    } catch (error) {
      captured = error;
    } finally {
      window.removeEventListener("error", markHandled);
    }

    expect(
      captured,
      "clickExpectingNoError let a handler that threw pass as a quiet no-op — its window `error` capture is inert, and every inertness assertion that relies on it now proves nothing",
    ).toBeInstanceOf(Error);
    expect(
      String((captured as Error).message),
      "clickExpectingNoError failed for some reason other than the error it was supposed to capture",
    ).toContain("deliberate probe failure");
  });
});

function optionValues(select: HTMLElement): string[] {
  return within(select)
    .getAllByRole("option")
    .map((option) => (option as HTMLOptionElement).value);
}

/**
 * The option values a picker offers BELOW its leading unanswered prompt, having first asserted
 * that the prompt is there and is first.
 *
 * Why every option-list assertion below now goes through this rather than comparing the whole
 * list: the six `toEqual(runtime array)` pins were exact, so a leading placeholder reddens all
 * six. Rewriting them this way keeps every one of them — this is the four-time defect class where
 * a hand-maintained option list silently drifts from the runtime one — and pins one property MORE
 * than before, namely that the unanswered state is first and is spelled the one way. A relaxation
 * would have been `toContain`, or dropping the length check; neither is what happens here.
 */
function answerOptionValues(select: HTMLElement): string[] {
  const options = within(select).getAllByRole("option") as HTMLOptionElement[];
  expect(options[0]?.value, "the first option is not the unanswered prompt").toBe(UNANSWERED_VALUE);
  expect(options[0]?.textContent).toBe(UNANSWERED_OPTION_LABEL);
  return optionValues(select).slice(1);
}

describe("ReferralIntakeForm", () => {
  it("renders exactly one control for every field the model permits, and nothing else", () => {
    renderForm();

    for (const testId of EXPECTED_FIELD_TESTIDS) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
    expect(screen.getByTestId("ward-referral-intake-submit")).toBeInTheDocument();

    /*
     * R2 review finding M3. Seven of the ids above sit on the control itself; the three need
     * questions carry theirs on the wrapping `<fieldset>` (R2.1 moved them there when the
     * checkboxes became radio pairs). For those two, the loop above is satisfied by a container
     * that need not contain a control at all — an empty fieldset passes it. Nothing is actually
     * unguarded today, because `answers nothing for the clinician` reads `.checked` off these
     * same inputs, but this test's own title says "renders exactly one control for every field",
     * and for two fields it had stopped checking that. Pin the real radios.
     */
    for (const field of ["secureBedNeeded", "involuntaryBedNeeded", "transportNeeded"]) {
      const group = screen.getByTestId(`ward-referral-intake-${field}`);
      for (const answer of ["yes", "no"]) {
        const radio = screen.getByTestId(`ward-referral-intake-${field}-${answer}`);
        expect(radio.tagName, `${field}'s "${answer}" is not an element you can answer with`).toBe("INPUT");
        expect(radio, `${field}'s "${answer}" is not a radio`).toHaveAttribute("type", "radio");
        expect(group, `${field}'s "${answer}" radio is outside the group its testid names`).toContainElement(radio);
      }
    }

    // Every data-testid on the page is unique — a duplicate is a guaranteed strict-mode
    // failure in the browser test (this already happened once this phase). getByTestId
    // itself throws on more than one match, so a bare call for each id above already proves
    // uniqueness for those; this asserts it for the DOM as a whole too.
    const { container } = renderForm();
    const ids = Array.from(container.querySelectorAll("[data-testid]")).map((el) => el.getAttribute("data-testid"));
    expect(new Set(ids).size).toBe(ids.length);
  });

  /*
   * ⚠️ THIS TEST USED TO ASSERT ZERO FREE-TEXT CONTROLS, AND IT WAS RIGHT UNTIL 2026-09-05.
   *
   * The owner asked for a written patient history, so the form has a textarea for it — three
   * until the ruling of 2026-09-05 collapsed them to one, optional. **The guard was NOT
   * deleted.** Deleting it would have left nothing watching the one boundary that
   * still matters — and a commit that removes a safety test reads, a year later, exactly like
   * somebody clearing an obstacle.
   *
   * It is now a BOUNDARY guard: free text exists in exactly the named history fields and nowhere
   * else on this form. That still catches everything the original caught — a stray text input for
   * a name, a `contenteditable` note box, a second history field nobody discussed.
   *
   * ⚠️ **FLOORED ON THE FIELDS WALKED, NOT ON THE VIOLATIONS FOUND.** The `HISTORY_FIELDS.length`
   * assertion is what makes DELETING the history go red rather than green. A guard written as
   * "no unexpected textareas" is satisfied by a form with no textareas at all, so it would pass
   * on the day somebody removed the feature — which is precisely when it most needs to speak.
   */
  it("has free text in exactly the named history fields and nowhere else on the form", () => {
    renderForm();

    const form = screen.getByTestId("ward-referral-intake-form");
    const freeTextControls = Array.from(
      form.querySelectorAll(
        'input[type="text"], input[type="search"], input[type="email"], input:not([type]), textarea, [contenteditable="true"]',
      ),
    );

    // The population, so an empty form cannot pass this by walking nothing. ⚠️ A FLOOR, NOT A
    // PINNED COUNT: it was `toBe(3)` and went red on the owner's ruling collapsing three boxes to
    // one — a guard failing on a legitimate design decision, which is how guards get deleted. What
    // it must catch is the history being REMOVED, so it asserts at least one.
    expect(HISTORY_FIELDS.length).toBeGreaterThan(0);

    /*
     * ⚠️ WIDENED BY EXACTLY ONE ON 2026-09-12, AND THE GUARD IS NARROWER AFTERWARDS, NOT WIDER.
     *
     * 🔴 This case's own doc comment above says it exists to catch "a stray text input for a name".
     * The owner then authorised precisely that: asked directly whether a referral should record
     * which team or service sent it, he answered "Yes it should", optional and free text. **So the
     * guard was firing on correct work — the shape that gets a guard deleted rather than fixed.**
     *
     * ✅ **The boundary is kept by ENUMERATING, not by relaxing.** The allowed set is spelled out
     * below, so a THIRD free-text control still reddens on the day it appears — which is the whole
     * property this case defends. What is NOT done is loosening the matcher to "text inputs are
     * fine now", which would retire the guard while leaving it green.
     *
     * 🔴 **AND THE CONTROL TYPE IS NOW PINNED PER FIELD, which the old blanket TEXTAREA assertion
     * could not express.** The history is a textarea because an account runs to paragraphs; the
     * sending team is a one-line input because a service's name is not prose. An input smuggled in
     * under a history id still fails, exactly as before.
     */
    const SENDING_TEAM_TESTID = "ward-referral-intake-sending-team";
    const SUBURB_FILTER_TESTID = "ward-referral-intake-suburb-filter";
    const historyTestIds = HISTORY_FIELDS.map((field) => `ward-referral-intake-${field.key}`);

    // Identity, not just count: controls with the wrong names would pass a count check.
    expect(freeTextControls.map((el) => el.getAttribute("data-testid")).sort()).toEqual(
      [...historyTestIds, SENDING_TEAM_TESTID, SUBURB_FILTER_TESTID].sort(),
    );

    for (const el of freeTextControls) {
      const testId = el.getAttribute("data-testid");
      const expectedTag = testId === SENDING_TEAM_TESTID || testId === SUBURB_FILTER_TESTID ? "INPUT" : "TEXTAREA";
      expect(
        el.tagName,
        `${testId} is a ${el.tagName} and must be a ${expectedTag}. A written account needs a ` +
          `textarea; a team's name is one line and must not offer a paragraph box, and neither may ` +
          `quietly become the other.`,
      ).toBe(expectedTag);
    }
  });

  /*
   * ⚠️ NO `maxLength` ON ANY OF THEM, AND THIS IS A SAFETY ASSERTION RATHER THAN A STYLE ONE.
   *
   * `maxLength` makes the browser swallow the keystroke past the limit. A referrer pasting a long
   * account would watch the end of it disappear with no message — a silent truncation, performed
   * by the browser rather than by anybody's decision. The form instead lets the text exceed the
   * limit, says so, and refuses to send. `Referral.history` forbids the reducer from trimming for
   * the same reason; this is the same rule one layer up.
   */
  it("puts no maxLength on any history box, so nothing is ever silently truncated as it is typed", () => {
    renderForm();

    // Floored, not pinned — see the boundary guard above for why a literal count is the wrong
    // shape here. Zero boxes must fail; one, or three, must not.
    expect(HISTORY_FIELDS.length).toBeGreaterThan(0);
    for (const field of HISTORY_FIELDS) {
      const box = screen.getByTestId(`ward-referral-intake-${field.key}`);
      expect(box.hasAttribute("maxlength"), `${field.key} carries maxLength and would truncate silently`).toBe(false);
    }
  });

  it("offers every age band from COHORTS — the four-time defect class this phase keeps hitting", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-ageBand");
    expect(answerOptionValues(select)).toEqual([...COHORTS]);
  });

  it("offers every home region from HOME_REGIONS", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-homeRegion");
    expect(answerOptionValues(select)).toEqual([...HOME_REGIONS]);
  });

  it("offers every referral source from REFERRAL_SOURCES", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-source");
    expect(answerOptionValues(select)).toEqual([...REFERRAL_SOURCES]);
  });

  it("offers every real network site as an origin option", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-originSiteCode");
    expect(answerOptionValues(select)).toEqual(wardSites.map((site) => site.code));
  });

  it("offers every sex from RECORDED_SEXES — Task 5's fix for the same defect class COHORTS already closed", () => {
    renderForm();

    // R7 (owner ruling, 2026-09-25): recorded sex is Female, Male, Another term or Not recorded.
    const select = screen.getByTestId("ward-referral-intake-sex");
    expect(answerOptionValues(select)).toEqual([...RECORDED_SEXES]);
  });

  /**
   * T11 (item 8): the gender picker offers every `REFERRAL_GENDERS` value plus one extra trailing
   * option `answerOptionValues` (which strips the leading `UNANSWERED_VALUE` prompt) still counts
   * — `NOT_RECORDED_VALUE`, "Not yet recorded". Both the real values and that fourth, deliberate
   * answer must be present; only the leading placeholder is stripped.
   */
  it("offers every gender from REFERRAL_GENDERS, plus the explicit not-yet-recorded answer", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-gender");
    expect(answerOptionValues(select)).toEqual([...REFERRAL_GENDERS, "not_recorded"]);
  });

  it("offers every urgency tier from URGENCY_LEVELS", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-urgency");
    expect(answerOptionValues(select)).toEqual(URGENCY_LEVELS.map(String));
  });

  /**
   * Phase 7 Task 8, found by looking at the screen rather than by any test. The picker rendered a
   * bare "1", "2", "3" while the referral board rendered "Tier 2 · urgent" for the very same
   * field — two screens describing one field in two different words, which is this project's most
   * expensive defect class. It matters most here: this is the one screen where a human CHOOSES
   * the value rather than reading it back, on a phone, possibly from a police car, and neither
   * the digit nor the direction of the scale is self-evident to someone meeting it for the first
   * time.
   *
   * The existing test above could not catch it: it reads each option's `value` attribute, which
   * was correct throughout and is deliberately still the bare tier. This one reads the TEXT.
   *
   * Asserted against `urgencyTierLabel` itself rather than against three hard-coded strings, so
   * the guard is "the picker and the boards use one spelling", not "the picker uses the spelling
   * this test happens to remember". Two copies agreeing is what failed here; one export is why it
   * cannot fail the same way again.
   */
  it("labels every urgency option with its direction, in the same words the boards use", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-urgency");
    // R2.1: the leading option is the unanswered prompt, pinned here as itself so that a picker
    // which lost the tier labels entirely cannot pass on a shorter array.
    const allOptionText = within(select)
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(allOptionText[0]).toBe(UNANSWERED_OPTION_LABEL);
    const optionText = allOptionText.slice(1);

    expect(optionText).toEqual(URGENCY_LEVELS.map((level) => urgencyTierLabel(level)));

    // Non-vacuity: the labels really do carry a direction, so a future `urgencyTierLabel`
    // returning the bare tier again would fail here even though the line above still matched.
    expect(optionText).toContain("Tier 1 · most urgent");
    expect(optionText).toContain("Tier 3 · least urgent");
  });

  /**
   * Review finding I4. Every `<select>` on this form used to sit inside a `<fieldset>` with a
   * `<legend>` — which names the fieldset's own `group` role and NOT the control inside it, so
   * all six announced as unnamed combo boxes. This is the phone-first screen spec D12 puts in
   * front of a police or ambulance officer, and the six unnamed controls carried the five
   * permitted facts about a person.
   *
   * `getByLabelText` is the assertion that matters: it resolves through the accessible name
   * only, so a `<legend>` (or a `<div>` that merely LOOKS like a label) cannot satisfy it. Each
   * name is then required to resolve to the very control the rest of this suite drives by
   * `data-testid`, so a label pointing at the wrong `id` — a real and silent failure mode of
   * `htmlFor` — fails here rather than reading as a pass.
   */
  it("gives every select a real accessible name, resolving to that same control", () => {
    renderForm();

    const named: [string, string][] = [
      ["Search or link a patient", "ward-referral-patient-search"],
      ["Age band", "ward-referral-intake-ageBand"],
      ["Sex", "ward-referral-intake-sex"],
      // T11 (item 8): `getByLabelText` matches EXACTLY by default, so this must be the whole
      // visible label, not a prefix — build plan §2's own exact wording, "Gender (decides which
      // bed)".
      ["Gender (decides which bed)", "ward-referral-intake-gender"],
      // T15 (item 12): the optional tentative-diagnosis picker. Opus review round 2, 17 September
      // 2026 (P2): relabelled to the plan's own exact wording, "Broad diagnosis category
      // (tentative)".
      ["Broad diagnosis category (tentative)", "ward-referral-intake-tentativeDiagnosis"],
      ["Home region", "ward-referral-intake-homeRegion"],
      ["Referral source", "ward-referral-intake-source"],
      ["Urgency", "ward-referral-intake-urgency"],
      ["Origin site", "ward-referral-intake-originSiteCode"],
      // The suburb picker, added 2026-08-30 so each destination can say whether it is in
      // catchment. Its answer is deliberately NOT recorded on the referral — see the form's own
      // comment — but it is still a control a police officer names on a phone, so it is named here
      // with the six that carry the permitted facts.
      ["Suburb", "ward-referral-intake-suburb"],
    ];
    for (const [name, testId] of named) {
      expect(screen.getByLabelText(name)).toBe(screen.getByTestId(testId));
    }

    // Non-vacuity: the list above must cover every combobox the form renders, so an eighth
    // picker added later without a name is caught rather than simply going unlisted here.
    expect(screen.getAllByRole("combobox")).toHaveLength(named.length);
  });

  it("describes the request, never the person, for the two need toggles", () => {
    renderForm();

    // The wording rule: "needs a secure bed", never "is a risk"; "needs a bed that can hold
    // someone involuntarily", never "is involuntary" — the requirement attaches to the
    // request, the word never attaches to the person.
    expect(screen.getByText(/needs a secure bed/i)).toBeInTheDocument();
    expect(screen.getByText(/needs a bed that can hold someone involuntarily/i)).toBeInTheDocument();
    expect(screen.queryByText(/\bis involuntary\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bis a risk\b/i)).not.toBeInTheDocument();
  });

  /**
   * Phase R2.1 REWROTE this test, and the rewrite is the change working rather than a weakened
   * guard.
   *
   * What it used to do: click Send having changed NOTHING AT ALL, and assert a queued referral
   * and a confirmation. It was the clearest statement anywhere in the repository of the defect
   * this phase removes — a form that submits successfully with no input, because `initialDraft()`
   * pre-answered every field. It was pinned to behaviour that has been deliberately deleted, so
   * it had to go red; the rewrite answers every question deliberately instead of inheriting the
   * defaults, and asserts exactly what it asserted before about the result.
   *
   * Nothing was loosened to get here: the zero-answer path it used to cover is now covered
   * harder, one question at a time, by the inertness tests below.
   */
  it("submits a well-formed referral with no rejection, using the fixed community role", () => {
    renderForm();

    answerEveryQuestion();
    fireEvent.click(submitButton());

    expect(screen.getByTestId("rejection-count")).toHaveTextContent("0");
    expect(screen.queryByTestId("ward-referral-intake-rejection")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-intake-confirmation")).toBeInTheDocument();
  });

  it("surfaces a visible Rejection, rather than swallowing it, when the reducer refuses the intake", () => {
    renderForm();

    // No option on the real network carries an empty code, so setting the origin site select
    // to a value with no matching <option> leaves the DOM's own resolved value at "" (per the
    // HTMLSelectElement value-setter algorithm: no matching option -> selectedIndex -1 ->
    // value ""). `siteByCode("")` then resolves to nothing, and RECEIVE_REFERRAL's own
    // membership check (ward-flow-reducer.ts) refuses the event — a real reducer refusal, not
    // a fabricated one.
    //
    // R2.1 added the first line below and nothing else. The refusal path is reached exactly as it
    // was: `""` is still a resolved ANSWER rather than the form's unanswered sentinel (which is
    // `UNANSWERED_VALUE`, deliberately not `""` — see that constant's own comment), so Send stays
    // available and the reducer still gets the event. Had `""` become the sentinel, Send would go
    // inert here and the reducer would never be reached, so this guard would have stopped
    // guarding.
    //
    // CORRECTED 2026-08-30 (R2 review finding M1): this used to end "...while still reporting
    // green", which is not true. The last assertion in this test requires `rejection-count` to
    // read "1"; with an inert Send nothing dispatches, the count stays "0", and the test goes red
    // on its own. The sentinel-is-not-`""` decision is right, and the pre-click assertion below
    // is worth keeping — but what it buys is a legible failure instead of a misleading one, not
    // the difference between catching the mutation and missing it.
    answerEveryQuestion();
    fireEvent.change(screen.getByTestId("ward-referral-intake-originSiteCode"), {
      target: { value: "no-such-site" },
    });
    //
    // Send being AVAILABLE here is the load-bearing assertion, and it is checked before the click
    // rather than inferred from the result: it is what proves this test still reaches the reducer.
    // (React re-selects the first option in the DOM when a controlled `<select>`'s value matches
    // none of them, so the control on screen now reads as the prompt while the draft holds `""`.
    // That is unreachable through ordinary use — no option carries `""` — and it is the draft, not
    // the rendered option, that is dispatched.)
    expect(
      submitButton(),
      "Send went inert, so this test never reaches the reducer and proves nothing about refusals",
    ).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(submitButton());

    expect(screen.getByTestId("rejection-count")).toHaveTextContent("1");
    const rejection = screen.getByTestId("ward-referral-intake-rejection");
    expect(rejection).toBeInTheDocument();
    expect(rejection).toHaveTextContent(/must resolve to a real site/i);
    expect(screen.queryByTestId("ward-referral-intake-confirmation")).not.toBeInTheDocument();
  });

  /* --------------------------------------------------------------------------------------------
   * Phase R2.1 — nothing is answered for the clinician, and Send says which questions are open.
   * ------------------------------------------------------------------------------------------ */

  /**
   * The defect this phase removes, stated as a property rather than as a story: `initialDraft()`
   * pre-answered every field, so one tap sent a complete-looking referral in which nothing
   * downstream could tell a default from an answer.
   *
   * Every assertion names its own field, so a default that comes back for ONE question fails
   * saying which one. "A referral was submitted successfully" would not.
   */
  it("answers nothing for the clinician — every question starts unanswered", () => {
    renderForm();

    for (const field of ["ageBand", "sex", "homeRegion", "source", "urgency", "originSiteCode"]) {
      const select = screen.getByTestId(`ward-referral-intake-${field}`) as HTMLSelectElement;
      expect(select.value, `${field} arrives pre-answered — a default is a wrong answer nobody chose`).toBe(
        UNANSWERED_VALUE,
      );
    }

    // The two need questions were checkboxes, and an untouched checkbox is not an open question:
    // it sent `false`, the definite clinical claim that this person needs neither a secure bed
    // nor a bed that can hold them involuntarily.
    //
    // `transportNeeded` joined them on the owner's 2026-08-30 ruling ("Take all recommendations").
    // It was the last checkbox on this form, and an untouched one sent `false` — which a ward
    // reads as "no transport needed" and plans around.
    for (const field of ["secureBedNeeded", "involuntaryBedNeeded", "transportNeeded"]) {
      for (const answer of ["yes", "no"]) {
        const radio = screen.getByTestId(`ward-referral-intake-${field}-${answer}`) as HTMLInputElement;
        expect(radio.checked, `${field} arrives already answered "${answer}" — nobody chose that`).toBe(false);
      }
    }
  });

  /**
   * Non-vacuity for the sentinel itself. Every assertion above compares a control's value against
   * `UNANSWERED_VALUE`, and all of them would still pass if that value happened to BE a real
   * answer — which the form would then send. The empty string is listed explicitly because it is
   * the obvious choice and the one value that must not be used: the refusal test above provokes a
   * genuine reducer refusal through an origin site of `""`, and a sentinel of `""` would make
   * Send inert there, so the reducer would never be reached and that proof would be lost.
   *
   * CORRECTED 2026-08-30 (R2 review finding M1): this used to add "while the test still passed
   * for a different reason". It would not have — that test's own `rejection-count` assertion goes
   * red under exactly that change. The mutation is caught either way; what is at stake is whether
   * the failure names the real cause. See the same correction on `UNANSWERED_VALUE` itself.
   */
  it("uses an unanswered sentinel no list on this form can offer, and that is not the empty string", () => {
    expect(UNANSWERED_VALUE).not.toBe("");
    expect([...COHORTS] as string[]).not.toContain(UNANSWERED_VALUE);
    expect([...SEXES] as string[]).not.toContain(UNANSWERED_VALUE);
    expect([...HOME_REGIONS] as string[]).not.toContain(UNANSWERED_VALUE);
    expect([...REFERRAL_SOURCES] as string[]).not.toContain(UNANSWERED_VALUE);
    expect(URGENCY_LEVELS.map(String)).not.toContain(UNANSWERED_VALUE);
    expect(wardSites.map((site) => site.code)).not.toContain(UNANSWERED_VALUE);
  });

  /**
   * The questions Send waits on and the names it calls them by, written out. `REQUIRED_QUESTIONS`
   * above is this suite's own list; this assertion is what keeps the component's list equal to it,
   * so a ninth question, a removed one, a renamed one or a reordered one is a decision somebody
   * takes here rather than something a diff reveals later.
   */
  it("waits on exactly these sixteen questions, named in the order the form asks them", () => {
    expect([...REQUIRED_FIELD_NAMES]).toEqual([
      "Age band",
      "Sex",
      // T11 (item 8, after T10, owner answer 17 September 2026): "gender at referral decides the
      // incoming bed check" — the referring clinician answers it, or actively says "Not yet
      // recorded"; only leaving it untouched blocks Send.
      "Gender",
      "Home region",
      // 2026-08-30, and it is the one entry here that used to be a NON-question: the control was on
      // the form, a clinician answered it, and the answer was read for the picker and then dropped
      // because `Referral` had nowhere to put it. It has somewhere now (`CM-4`), so the form stops
      // discarding it and starts waiting on it. Beside "Home region" because they are the two facts
      // about where a person is from, and neither is derived from the other.
      "Suburb",
      "Referral source",
      "Urgency",
      "Origin site",
      "Secure bed needed",
      "Involuntary bed needed",
      // 2026-09-10, with the acuity gate — the owner ruled that the REFERRING CLINICIAN marks
      // high-acuity need at referral, so the form has to ask. Placed here because it is a bed
      // criterion like the two directly above, and because that is where the form asks it. It
      // starts unanswered rather than defaulting to "no" for the reason the intake file records:
      // this answer is read by a gate, so a "no" nobody chose is not a record, it is a skipped
      // check.
      "High-acuity nursing needed",
      // Ninth on the owner's 2026-08-30 ruling ("Take all recommendations"), and last because
      // that is where the form asks it. Written out here like its eight siblings: a tenth
      // question, or this one quietly dropped back to a default, is a decision somebody takes in
      // this test rather than something a diff reveals later.
      "Transport needed",
      // ⚠️ THE WRITTEN HISTORY WAS TENTH IN THIS LIST FOR PART OF 2026-09-05, AS "Why now", AND
      // THE OWNER REMOVED IT THE SAME DAY: one story box, OPTIONAL. This list is the outstanding-
      // questions sentence, so a question here is a claim that Send waits for it. It does not.
      //
      // Recorded rather than deleted, because the mechanism it needed is still live for whoever
      // adds the next typed question: its blank state is `""` and NOT the sentinel, so it needed a
      // per-field `unanswered` predicate on `REQUIRED_FIELDS`. Widening the shared `isUnanswered`
      // to treat `""` as unanswered was the obvious alternative and would have reversed a recorded
      // decision — see `UNANSWERED_VALUE`, which states that an origin site of `""` remains an
      // ANSWER.
      // Eleventh, on FD-21: the referrer addresses the referral, choosing several destinations in one
      // act. Last because the picker shows what each destination looks like FOR THIS REQUEST — how
      // much of the network accepts it, which team the catchment table names — so every answer
      // above it is what makes the question answerable.
      "Destination",
      // Twelfth, 2026-08-30, when the emergency-department destination gained `edId`: an ED
      // destination must name WHICH department, and this form is where the referrer answers that.
      // It is the FIRST conditional question on the form — see `CONDITIONAL_QUESTION_NAMES`.
      CONDITIONAL_QUESTION_NAMES[0],
      // Thirteenth, 2026-08-31, when the community destination gained `teamName`: a community
      // destination must name WHICH team, because the owner ruled that association comes from the
      // team named on the referral and not from the patient's home region. The SECOND conditional
      // question, and the reason the constant above is a list rather than a single name.
      CONDITIONAL_QUESTION_NAMES[1],
      // Sixteenth, 2026-09-22: a psychiatric-ward source must name WHICH ward is sending (the
      // reducer refuses that source without `originUnitId`). The THIRD conditional question — it
      // only applies when the referrer picks "Inpatient psychiatric ward".
      CONDITIONAL_QUESTION_NAMES[2],
    ]);
    // `REQUIRED_QUESTIONS` drives the always-applicable ones. The conditional pair is deliberately
    // excluded
    // rather than added to it: it does not apply until an emergency department is ticked, so the
    // loops below — which answer every question but one and expect Send to stay unavailable —
    // would be asserting about a question the form is right not to be waiting on.
    //
    // Non-vacuity of that exclusion, spelled out because "the filter hid the failure" is exactly
    // how a guard stops guarding: if `appliesWhen` were dropped and the question became
    // unconditional, this assertion would still pass, and every one of the ten loops below would
    // go red instead, because Send would never become available with no department named.
    expect(REQUIRED_QUESTIONS.map((question) => question.name)).toEqual(
      REQUIRED_FIELD_NAMES.filter((name) => !(CONDITIONAL_QUESTION_NAMES as readonly string[]).includes(name)),
    );
  });

  /** The absolute pin on what the note says while nothing is answered: the whole sentence,
   *  written out. Never "complete the form" — the question a clinician has is WHICH questions are
   *  open, and the answer has to be readable without hovering and without colour. */
  it("names every outstanding question on a blank form, in words, below the button", () => {
    renderForm();

    /*
     * 🔴 EXPECTATION MOVED BY D-43 (2026-09-11), AND A TEST EXPECTATION LINE IS A RULING — so the
     * reason is here rather than in a commit message nobody reads at the point of conflict.
     *
     * This said "Not yet answered:". Three places on the referral screen reported the identical
     * state from the identical predicate (`fieldIsUnanswered` over applicable `REQUIRED_FIELDS`):
     * this Send reason, the summary rail ("Not answered yet") and the per-question chip
     * ("Outstanding"). **Two of those were the same three words reordered, and a coordinator saw
     * both at once** — one beside the question, one beside Send.
     *
     * D-32: one wording per state. `yet` is dropped because it is the word that forced the two
     * orderings and adds nothing a clinician acts on.
     *
     * ⚠️ NOT TO BE "TIDIED" TOWARDS THE HISTORY BOX'S WORDING. That box says "Nothing written —
     * that is a complete answer" and is a DIFFERENT state: the history is `required: false`, so
     * empty is COMPLETE, while an unanswered required question is INCOMPLETE. They differ in what
     * the coordinator must do, which is D-32's own test for whether two forms may merge.
     */
    const note = screen.getByTestId("ward-referral-intake-unavailable");
    expect(note.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "Not answered: Age band, Sex, Gender, Home region, Suburb, Referral source, Urgency, Origin site, " +
        "Secure bed needed, Involuntary bed needed, High-acuity nursing needed, " +
        "Transport needed, Destination. Send stays unavailable until each has an answer.",
    );

    // Below the button, never above it: the note appears and disappears as questions are answered,
    // and one above Send would move the control out from under a thumb already reaching for it.
    expect(submitButton().compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Reachable from the control itself, so a screen-reader user who tabs onto Send is told why it
    // is unavailable rather than meeting a control that silently does nothing.
    expect(submitButton()).toHaveAttribute("aria-describedby", note.getAttribute("id"));
  });

  /**
   * `aria-disabled` plus an inert handler, never native `disabled` — the native attribute removes
   * the tab stop, so the reason above could never be reached by keyboard. Asserted as the ABSENCE
   * of the native attribute rather than only the presence of the aria one, because the two
   * together behave exactly like `disabled` alone while looking as though they were thought about.
   */
  it("keeps Send reachable while it is unavailable, never natively disabled", () => {
    renderForm();

    expect(submitButton()).toHaveAttribute("aria-disabled", "true");
    expect(submitButton()).not.toHaveAttribute("disabled");
    expect(submitButton()).not.toBeDisabled();
  });

  /**
   * One test per question, so a default that returns for ONE of them fails by name.
   *
   * Each answers every question but one and proves three things about that state: Send is
   * unavailable, activating it dispatches NOTHING (read off reducer state, never off the form's
   * own DOM), and the note names exactly the question that is open — not a count, not "complete
   * the form", and not a list that still includes questions already answered.
   */
  for (const outstanding of REQUIRED_QUESTIONS) {
    it(`will not send, and says so, while ${outstanding.name} alone is unanswered`, () => {
      renderForm();

      answerEveryQuestion(outstanding.name);
      const referralsBefore = referralCount();

      expect(submitButton()).toHaveAttribute("aria-disabled", "true");
      const note = screen.getByTestId("ward-referral-intake-unavailable");
      expect(note.textContent?.replace(/\s+/g, " ").trim()).toBe(
        `Not answered: ${outstanding.name}. Send stays unavailable until each has an answer.`,
      );

      clickExpectingNoError(
        submitButton(),
        `activating Send while ${outstanding.name} was unanswered threw instead of quietly doing nothing`,
      );

      // Nothing reached the reducer at all: no new referral, and no rejection either. A rejection
      // would mean the sentinel had escaped the form and been refused downstream, which is the
      // one thing this design must never do.
      expect(referralCount(), `${outstanding.name} was unanswered and a referral was queued anyway`).toBe(
        referralsBefore,
      );
      expect(screen.getByTestId("rejection-count")).toHaveTextContent("0");
      expect(screen.queryByTestId("ward-referral-intake-confirmation")).not.toBeInTheDocument();
      expect(screen.queryByTestId("ward-referral-intake-rejection")).not.toBeInTheDocument();
    });
  }

  /** The other half of the pair above: answering the last outstanding question is what makes Send
   *  available, so the inertness cannot be something that never lifts. */
  it("makes Send available, and sends, once the last question is answered", () => {
    renderForm();

    const last = REQUIRED_QUESTIONS[REQUIRED_QUESTIONS.length - 1];
    answerEveryQuestion(last.name);
    expect(submitButton()).toHaveAttribute("aria-disabled", "true");

    last.answer();

    expect(submitButton()).not.toHaveAttribute("aria-disabled");
    expect(screen.queryByTestId("ward-referral-intake-unavailable")).not.toBeInTheDocument();

    fireEvent.click(submitButton());
    expect(screen.getByTestId("ward-referral-intake-confirmation")).toBeInTheDocument();
    expect(screen.getByTestId("rejection-count")).toHaveTextContent("0");
  });

  /**
   * The clinical point of making the two need questions unanswered: what reaches the reducer is
   * the answer somebody CHOSE, and a chosen "No" is a different fact from an untouched box.
   *
   * Both answers appear in one referral so this cannot pass on a form that sends a constant, and
   * both are read off reducer state, which is where they would matter.
   *
   * REWRITTEN 2026-08-30, R2 review finding C1 — this test could not fail. It read
   * `expect(screen.getByTestId("newest-referral-facts")).toHaveTextContent("secure=true
   * involuntary=false")`, and `toHaveTextContent` is a normalised SUBSTRING match against
   * whatever the newest referral happens to be. The provider seeds `structuredClone(referrals)`
   * and the seed's last row, `RF-008`, is already `secureBedNeeded: true,
   * involuntaryBedNeeded: false` — so that substring was on screen before the click, and
   * `RECEIVE_REFERRAL` appends, so it stayed on screen after a correct dispatch too. It passed
   * whether the dispatch was right, wrong or entirely absent, and it was the only test asserting
   * that a chosen need answer reaches the reducer at all.
   *
   * Two legs replace it, and neither is satisfiable by the fixture:
   *   1. the absolute before/after `referralCount()` comparison its eight siblings already use —
   *      absolute, not a ratio, because a file that fails to parse subtracts its own tests from
   *      the denominator and a ratio stays perfect; and
   *   2. an assertion about THE REFERRAL THIS TEST CREATED, found by the id that was not present
   *      before the click, compared WHOLE with `toBe`. The seed cannot supply an id no earlier
   *      render held, and it cannot supply this referral's age band, sex and urgency either.
   * Nothing was loosened to get here — the facts assertion is exact where it used to be a
   * substring, and it now pins five facts where it pinned two.
   */
  it("sends the need answers a clinician chose, both ways, rather than an inherited no", () => {
    renderForm();

    const idsBefore = referralIds();
    const referralsBefore = referralCount();

    answerEveryQuestion();
    chooseNeed("secureBedNeeded", "yes");
    fireEvent.click(submitButton());

    expect(referralCount(), "no referral was queued at all, so nothing this test asserts below is about the form").toBe(
      String(Number(referralsBefore) + 1),
    );

    const createdId = theOneNewReferralId(idsBefore, "the click created no new referral, or more than one");
    expect(newestReferralFacts(), "the chosen secure-bed answer did not reach the reducer").toBe(
      expectedFactsFor(createdId, true, false),
    );
  });

  /**
   * R2 review finding I1. The same property for the OTHER need question, which no test in this
   * repository had ever answered "Yes" — `chooseNeed(…, "yes")` appeared once, for
   * `secureBedNeeded`, so a mutation making the involuntary "Yes" control send `false` left the
   * whole suite green. Whether a bed must be able to hold someone involuntarily is the most
   * consequential single fact this form carries.
   *
   * Deliberately the mirror image of the test above rather than a second case of it: `secure`
   * false and `involuntary` true is a combination the seed does not contain at its last row
   * either, so both directions of both questions are now exercised through the radios.
   */
  it("sends a chosen 'Yes' to the involuntary-bed question, the answer no test had ever sent", () => {
    renderForm();

    const idsBefore = referralIds();
    const referralsBefore = referralCount();

    answerEveryQuestion();
    chooseNeed("involuntaryBedNeeded", "yes");
    fireEvent.click(submitButton());

    expect(referralCount(), "no referral was queued at all, so nothing this test asserts below is about the form").toBe(
      String(Number(referralsBefore) + 1),
    );

    const createdId = theOneNewReferralId(idsBefore, "the click created no new referral, or more than one");
    expect(newestReferralFacts(), "the chosen involuntary-bed answer did not reach the reducer").toBe(
      expectedFactsFor(createdId, false, true),
    );
  });

  /**
   * R2 review finding I2, owner ruling 2026-08-30: after a successful send the form starts the
   * next referral unanswered.
   *
   * Without the reset, referral #2 of a session inherits patient A's age band, sex, home region
   * and both need answers, with Send already available — one tap from raising a referral in which
   * five facts about a person belong to somebody else. That is worse than the defaults R2.1
   * removed, because the values look like answers a clinician chose.
   *
   * Both halves are asserted: that every control is genuinely back to unanswered, and that Send
   * is unavailable again — the second is what proves the first is not merely cosmetic, because a
   * blank-looking form whose draft still held the old answers would still send them.
   */
  it("starts the next referral unanswered rather than carrying the previous patient's answers", () => {
    renderForm();

    answerEveryQuestion();
    chooseNeed("secureBedNeeded", "yes");
    chooseNeed("involuntaryBedNeeded", "yes");
    chooseNeed("transportNeeded", "yes");
    fireEvent.click(submitButton());
    expect(
      screen.getByTestId("ward-referral-intake-confirmation"),
      "the first referral was never sent, so this test proves nothing about the second",
    ).toBeInTheDocument();

    for (const field of ["ageBand", "sex", "homeRegion", "source", "urgency", "originSiteCode"]) {
      const select = screen.getByTestId(`ward-referral-intake-${field}`) as HTMLSelectElement;
      expect(select.value, `${field} still holds the previous patient's answer`).toBe(UNANSWERED_VALUE);
    }
    for (const field of ["secureBedNeeded", "involuntaryBedNeeded", "transportNeeded"]) {
      for (const answer of ["yes", "no"]) {
        const radio = screen.getByTestId(`ward-referral-intake-${field}-${answer}`) as HTMLInputElement;
        expect(radio.checked, `${field} still holds the previous patient's "${answer}"`).toBe(false);
      }
    }

    // And it is genuinely unanswered rather than merely blank-looking: Send is unavailable again,
    // names the questions it is waiting on, and a bare second tap raises nothing.
    expect(submitButton()).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("ward-referral-intake-unavailable")).toBeInTheDocument();

    const referralsBeforeSecondTap = referralCount();
    clickExpectingNoError(
      submitButton(),
      "activating Send on the freshly reset form threw instead of quietly doing nothing",
    );
    expect(
      referralCount(),
      "a second tap on Send raised a duplicate referral carrying the previous patient's facts",
    ).toBe(referralsBeforeSecondTap);
    expect(screen.getByTestId("rejection-count")).toHaveTextContent("0");
  });

  /**
   * Owner ruling 2026-08-30: **keep it.** After a successful send the "Referral sent"
   * confirmation stays on screen above the freshly blank form and its "not yet answered" note.
   *
   * WHAT THIS TEST ADDS, AND ONLY THIS. The confirmation's PRESENCE after a send is already
   * pinned three times over — "submits a well-formed referral with no rejection", "makes Send
   * available, and sends, once the last question is answered", and the reset test directly above,
   * which already pairs that presence with a form that has reset. Not one of them says anything
   * about WHERE it sits. The ORDERING is the half of the ruling nothing pins, so the ordering is
   * the whole of what this test claims.
   *
   * Why the ordering is the ruling and not a detail: clearing the confirmation removes the only
   * evidence the send happened, and a clinician who looks away mid-task then either sends twice
   * or believes a referral went when it did not. A confirmation that has slipped BELOW the note
   * saying ten questions are unanswered reads as belonging to the blank form underneath it,
   * which is the same failure wearing a different hat.
   *
   * Stated exactly, so nothing here is overclaimed: the confirmation sits above the "not yet
   * answered" note. It does not sit above the pickers — they are higher up the form still — so
   * "above the freshly blank form" in the ruling is about that note, and this test says no more.
   */
  it("leaves the confirmation above the freshly blank form's outstanding-questions note", () => {
    renderForm();

    answerEveryQuestion();
    fireEvent.click(submitButton());

    const confirmation = screen.getByTestId("ward-referral-intake-confirmation");
    // Non-vacuity, both ways. The confirmation only exists because the send succeeded, and the
    // note only exists because the form then reset itself — so if either half of the pairing had
    // broken, this test fails on a missing element rather than passing on an ordering nobody can
    // see.
    const note = screen.getByTestId("ward-referral-intake-unavailable");

    expect(
      confirmation.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING,
      "the sent confirmation no longer precedes the blank form's outstanding-questions note — it now reads as belonging to the empty form beneath it",
    ).toBeTruthy();
  });

  /**
   * R2 review finding I2, the other half of the ruling: a REFUSED send keeps every answer.
   *
   * The reset lives in the success branch of the form's own effect and not in `handleSubmit`,
   * because `handleSubmit` does not yet know whether the reducer accepted the event. Resetting
   * there would wipe eight answers at the one moment a clinician most needs them — a refusal they
   * have to correct and re-send. Moving the reset earlier is the obvious simplification of this
   * code, and this is what stops it being taken silently.
   */
  it("keeps every answer when the reducer refuses the referral, so a refusal can be corrected", () => {
    renderForm();

    answerEveryQuestion();
    fireEvent.change(screen.getByTestId("ward-referral-intake-originSiteCode"), {
      target: { value: "no-such-site" },
    });
    fireEvent.click(submitButton());
    expect(
      screen.getByTestId("ward-referral-intake-rejection"),
      "the reducer did not refuse, so this test proves nothing about what a refusal keeps",
    ).toBeInTheDocument();

    for (const field of ["ageBand", "sex", "homeRegion", "source", "urgency"]) {
      const select = screen.getByTestId(`ward-referral-intake-${field}`) as HTMLSelectElement;
      expect(select.value, `a refusal threw away the ${field} answer`).not.toBe(UNANSWERED_VALUE);
    }
    expect(
      (screen.getByTestId("ward-referral-intake-secureBedNeeded-no") as HTMLInputElement).checked,
      "a refusal threw away the secure-bed answer",
    ).toBe(true);
    expect(
      (screen.getByTestId("ward-referral-intake-involuntaryBedNeeded-no") as HTMLInputElement).checked,
      "a refusal threw away the involuntary-bed answer",
    ).toBe(true);
  });
});

function renderBoard() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ReferralBoard />
    </WardFlowProvider>,
  );
}

describe("ReferralBoard", () => {
  it("renders exactly the real fixture's two queued referrals, in urgency-then-longest-wait order", () => {
    renderBoard();
    // RF-001 (raised 40 min ago) and RF-005 (raised 20 min ago) are both tier 2 in the real
    // fixture — RF-001 goes first because it has waited longer. See
    // tests/ward-referral-model.test.ts for the pure-function proof this table order is built on.
    // RF-011 (added 2026-09-02, FD-23's multi-destination demonstration fixture) is tier 3 and so
    // sorts last, after every tier-2 referral above.
    const table = screen.getByTestId("ward-referral-board-queued-table");
    const ids = within(table)
      .getAllByRole("row")
      .slice(1) // drop the header row
      .map((row) => row.querySelector("td button")?.textContent);
    // RF-014 and RF-015 joined 2026-09-07 as the seed's two EXPECTS — referred to an emergency
    // department and not yet arrived. Both took urgency 3, the lowest tier, following RF-011's
    // recorded precedent so the tier-2 order above is untouched; within that tier they sort by
    // wait, so RF-015 (4,500 minutes) precedes RF-014 (150), and both precede RF-011.
    expect(ids).toEqual(["RF-RD06", "RF-001", "RF-009", "RF-005", "RF-015", "RF-014", "RF-011"]);
  });

  /**
   * 🔴 **THE ORDERING IS CORRECT AND LOOKS BROKEN, SO THE BOARD HAS TO SAY WHY.** Every queued row
   * carries a prominent wait clock, and the queue sorts urgency FIRST — so the longest wait on the
   * whole board can render at the very bottom. A coordinator finding the biggest number last has
   * every reason to conclude the sort is broken and to work around it. Owner ruling, 2026-09-06:
   * explain it; do not reorder.
   *
   * ⚠️ **THE FIRST ASSERTION IS AN ANTI-VACUITY FLOOR ON THE CLAIM ITSELF, not on the wording.**
   * A sentence explaining an inversion is only honest if the fixture actually produces one, and a
   * fixture where urgency and wait happen to agree would make this whole guard — and the sentence
   * on the screen — describe nothing. So the inversion is measured from the rendered order before
   * the wording is checked at all.
   *
   * The wording itself goes through `expectSays`, so a redesign may rephrase freely; what it may
   * not do is stop naming both halves of the rule.
   */
  it("says why the longest wait can sit at the bottom, and only because it genuinely can", () => {
    renderBoard();
    const table = screen.getByTestId("ward-referral-board-queued-table");
    const rendered = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.querySelector("td button")?.textContent ?? "");

    const allReferrals = [...referrals, ...rulingsDemoOverlay(NOW_ANCHOR).referrals];
    const raisedAtOf = (id: string) => allReferrals.find((referral) => referral.id === id)?.raisedAt;
    const waits = rendered.map((id) => raisedAtOf(id));
    expect(
      waits.every((at) => at !== undefined),
      `a rendered row is not in the fixture: ${rendered.join(", ")}`,
    ).toBe(true);

    // An inversion: a row BELOW another one was raised EARLIER, i.e. has waited longer.
    const inverted = waits.some((at, index) => waits.slice(0, index).some((above) => above! > at!));
    expect(
      inverted,
      "no queued row waits longer than one above it, so the board's explanation of that case describes " +
        "nothing and this guard proves nothing. Restore a fixture where urgency and wait disagree.",
    ).toBe(true);

    const note = screen.getByTestId("ward-referral-board-order-note").textContent ?? "";
    // 🔴 WIDENED FROM ["urgent", "urgency"] 2026-09-09 — those were satisfied by a DIFFERENT CLAUSE.
    // The same paragraph ends "...so somebody who has waited longer can sit below somebody more
    // urgent." So the bare word survived removing the tier-ordering claim this site guards, and the
    // guard stayed silent. Proved by rewriting "the most urgent tier comes first" to "tier order is
    // applied first": no failure. The spellings now name the ORDERING RULE, not the topic.
    expectSays(note, "the queue-ordering note", ["urgent tier", "urgency tier", "most urgent", "highest urgency"]);
    expectSays(note, "the queue-ordering note", ["waited longer", "longest wait", "longer"]);
  });

  /**
   * Task 6. The intake form is deliberately absent from the rail (recorded against
   * `WARD_REFERRAL_INTAKE_HREF` in `WARD_NAV_INTENTIONALLY_UNLISTED`), which makes this board the
   * only way a coordinator reaches it. That makes the link load-bearing rather than decorative:
   * delete it and the intake route becomes unreachable from inside the running app while every
   * structural nav test stays green, because the exemption map still explains the absence.
   *
   * Asserted as an anchor with a real `href`, not merely as text: `router.push` from a click
   * handler would satisfy a "the words New referral appear" check while breaking middle-click,
   * hover preview and every static reachability scan.
   */
  it("offers the intake form as a real link, the only way into it now the rail deliberately omits it", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralBoard />
      </WardFlowProvider>,
    );
    const link = screen.getByTestId("ward-referral-board-new");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", WARD_REFERRAL_INTAKE_HREF);
    expect(link).toHaveAttribute("href", "/mockups/ward-flow/referrals/new");
    expect(link.textContent?.trim()).toBe("New referral");
  });

  // M1 (fix round C): the figure must be bound to its OWN referral, not merely present. The
  // previous `/waiting/i` matched "40m waiting", "20m waiting", "0m waiting" and the bare word,
  // so rendering `referralWaitLabel(queued[0], now)` on every row — RF-001's wait shown against
  // RF-005 — survived it untouched. The real fixture raises RF-001 at NOW_ANCHOR - 40 and RF-005
  // at NOW_ANCHOR - 20, and this is the board's headline requirement, so the values are pinned.
  it("renders each queued referral's own waiting figure, not just the word 'waiting'", () => {
    renderBoard();
    expect(screen.getByTestId("ward-referral-board-wait-RF-001")).toHaveTextContent("40m waiting");
    expect(screen.getByTestId("ward-referral-board-wait-RF-005")).toHaveTextContent("20m waiting");
  });

  /**
   * ⚠️ **THE CLOCK ON THIS BOARD USED TO BE UNABLE TO STOP.** It read `referralWaitLabel`, which is
   * `formatElapsed(minutesUntil(now, raisedAt))` and has no reference to `triagedAt` at all — so a
   * referral raised for somebody who was triaged into a department twenty minutes later went on
   * printing a growing wait for hours, in the same words as a wait somebody is actually serving.
   * `P9-D7` stops that clock at triage, and the board now reads it through `referralWaitLine`.
   *
   * The two figures above are the proof the RUNNING branch is unchanged — no queued seeded referral
   * has been triaged AFTER being referred, so no row on this board can currently show a stopped
   * clock, and the stopped wording is asserted directly in `tests/ward-referral-wait-line.test.ts`.
   * What is asserted here is the part of the change that IS visible on this screen: the column no
   * longer promises that every figure under it is a wait still running.
   */
  it("heads the wait column with what both forms of the figure measure from, not with 'Waiting'", () => {
    renderBoard();
    const table = screen.getByTestId("ward-referral-board-queued-table");
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent?.trim());

    expect(headers).toContain("Since referral");
    expect(
      headers,
      "the column is headed 'Waiting' again, over a cell that can now read '3h 00m referral to triage'",
    ).not.toContain("Waiting");
  });

  /**
   * ⚠️ No cell on this board may word a triage time as an arrival. A patient arrives, waits, and
   * is triaged some time later; triage is the closest instant the model records, so it is a proxy
   * and is only honest while every screen labels it as one.
   */
  it("words no figure on the board as an arrival", () => {
    renderBoard();
    expect(
      (screen.getByTestId("ward-referral-board-screen").textContent ?? "").toLowerCase(),
      "the referral board words a triage time as an arrival",
    ).not.toContain("arriv");
  });

  it("renders the real fixture's nine decided referrals, most recently decided first", () => {
    renderBoard();
    // Real fixture decidedAt offsets from NOW_ANCHOR: RF-002 -10, RF-003 -15, RF-004 -25,
    // RF-006 -5, RF-007 -8, RF-008 -45 (Phase 8 Task 2's added out-of-area seed) — most recent
    // (smallest offset) first.
    //
    // RF-010 sits last, and by a long way: it is the community-only referral split out of RF-007 on
    // 2026-09-01, accepted by a clinic 24 days before the anchor. It is DECIDED rather than queued
    // on purpose — the person it concerns has since been discharged to the community, and a
    // community destination left "queued" would put a live 24-day wait on the coordinator's bed
    // board, which is the exact defect `fa616d1c9` removed nine referrals for.
    //
    // RF-012 (-180) and RF-013 (-420) joined on 2026-09-04 (owner ruling R-2026-09-04-D): the two
    // referrals `WF-002` and `WF-009` were actually raised from. Both are ACCEPTED rather than
    // queued — each has a movement in the fixture proving its department answered — so they land
    // here, between RF-008 and RF-010, in the same decidedAt-descending order as everything else.
    //
    // 17 Sept sample-data addition, RF-016..RF-021, pushed the population past the ten-row display
    // cap for the first time — this now shows the top TEN, not all nine-turned-fifteen decided
    // referrals. New offsets: RF-016 -60, RF-017 -45, RF-018 -30, RF-019 -20, RF-020 -25,
    // RF-021 -35. RF-019(-20), RF-004/RF-020(tied -25, RF-004 wins the tie by original array
    // order), RF-018(-30) and RF-021(-35) all sit more recently than RF-008(-45), so they now
    // displace RF-012/RF-013/RF-010/RF-RGHS-01 off the visible cap entirely.
    const table = screen.getByTestId("ward-referral-board-decided-table");
    const ids = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.querySelector("td")?.textContent);
    expect(ids).toEqual([
      "RF-006",
      "RF-007",
      "RF-002",
      "RF-003",
      "RF-019",
      "RF-004",
      "RF-020",
      "RF-018",
      "RF-021",
      "RF-008",
    ]);
  });

  /**
   * M3 (fix round C): `QueuedSection` and `DecidedSection` each map their array TWICE — once into
   * a table (the desk view) and once into `.cardList` (the corridor view at narrow widths). Both
   * existing order tests read only the tables, so a mutation reversing just the card `.map()` was
   * invisible to the whole suite. The module's own CSS comment says "a table is right at a desk
   * and wrong in a corridor"; the corridor view was the untested one. Card testids are asserted
   * rather than text because the card's own markup interleaves the id with the tier qualifier.
   */
  it("renders the queued cards in the same order as the queued table, for the phone view", () => {
    const { container } = renderBoard();
    const cards = Array.from(container.querySelectorAll("[data-testid^='ward-referral-board-card-select-']"));
    expect(cards.map((card) => card.getAttribute("data-testid"))).toEqual([
      "ward-referral-board-card-select-RF-RD06",
      "ward-referral-board-card-select-RF-001",
      "ward-referral-board-card-select-RF-009",
      "ward-referral-board-card-select-RF-005",
      // The two seeded expects, 2026-09-07 — tier 3, ordered by wait between themselves.
      "ward-referral-board-card-select-RF-015",
      "ward-referral-board-card-select-RF-014",
      "ward-referral-board-card-select-RF-011",
    ]);
  });

  it("renders the decided cards in the same order as the decided table, for the phone view", () => {
    const { container } = renderBoard();
    const cards = Array.from(container.querySelectorAll("[data-testid^='ward-referral-board-decided-card-']"));
    // Mirrors the table test above: the 17 Sept sample-data addition (RF-016..RF-021) now fills
    // the ten-row display cap on its own, pushing RF-012/RF-013/RF-010/RF-RGHS-01 off entirely.
    expect(cards.map((card) => card.getAttribute("data-testid"))).toEqual([
      "ward-referral-board-decided-card-RF-006",
      "ward-referral-board-decided-card-RF-007",
      "ward-referral-board-decided-card-RF-002",
      "ward-referral-board-decided-card-RF-003",
      "ward-referral-board-decided-card-RF-019",
      "ward-referral-board-decided-card-RF-004",
      "ward-referral-board-decided-card-RF-020",
      "ward-referral-board-decided-card-RF-018",
      "ward-referral-board-decided-card-RF-021",
      "ward-referral-board-decided-card-RF-008",
    ]);
  });

  it("selecting a queued referral opens its match view, and none is open before that", () => {
    renderBoard();
    expect(screen.queryByTestId("ward-referral-match-panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-001"));
    const panel = screen.getByTestId("ward-referral-match-panel");
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveTextContent("RF-001");
  });

  /**
   * M7 (fix round C): the brief requires the "not a medical device" prose on BOTH screens. The
   * board's banner sits at the top of `<main>`, above two sections and two tables — the match
   * view mounts below all of it, so on a phone the coordinator taking the accept decision has
   * scrolled past it. Asserted on the match panel specifically, not on the document, so deleting
   * the match view's own copy cannot be masked by the board's.
   */
  it("the match view carries its own 'not a medical device' statement, where the decision is taken", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-001"));

    const panel = screen.getByTestId("ward-referral-match-panel");
    const governance = within(panel).getByTestId("ward-referral-match-governance");
    expect(governance).toHaveTextContent(/not a medical device/i);
    /*
     * WAS `/never ranks units by suitability/i` until 2026-09-04. Owner ruling: the product ranks
     * wards by fit TODAY, so a screen promising it never ranks is false, and "does not yet rank" is
     * equally false. The replacement gives a reason that survives matching shipping — the screen
     * places nobody, and a human decides each placement — so this pins the REASON, and pins the
     * withdrawn form as an absence so it cannot come back.
     */
    expect(governance).toHaveTextContent(/places nobody/i);
    expect(governance).toHaveTextContent(/one at a time/i);
    expect(governance.textContent ?? "").not.toMatch(/never ranks|never suggests|does not yet rank/i);
  });

  /**
   * M5 (fix round C): a `<button>`'s content model is phrasing content, and the queued card's
   * select button wrapped a `<div>` and a `<p>`. No sibling ward screen does this — the discharge
   * board's cards carry no button at all — so it was a new pattern rather than an inherited one.
   */
  it("the queued card's select button contains no flow content", () => {
    renderBoard();
    const button = screen.getByTestId("ward-referral-board-card-select-RF-001");
    expect(button.tagName).toBe("BUTTON");
    expect(button.querySelectorAll("div, p, ul, ol, section, h1, h2, h3")).toHaveLength(0);
  });

  it("every data-testid is unique, including with a match view open", () => {
    const { container } = renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-001"));
    const ids = Array.from(container.querySelectorAll("[data-testid]")).map((el) => el.getAttribute("data-testid"));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("RF-001's match view: no bed accepts, and every unit still carries a reason — never an empty list", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-001"));

    expect(screen.getByTestId("ward-referral-match-no-bed")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-match-structural-gap")).not.toBeInTheDocument();
    // M2: the denominator is pinned to the real network size. `/^0 of \d+ units/` also matched
    // "0 of 0 units", so a mutation rendering `{accepting.length} of {accepting.length}` — or one
    // excluding forensic beds from the denominator — passed it.
    expect(screen.getByTestId("ward-referral-match-accepting-count")).toHaveTextContent(
      `0 of ${allUnits().length} units accept this referral right now.`,
    );

    const list = screen.getByTestId("ward-referral-match-list");
    // I1 (fix round C, F4): the phase's headline clinical-safety property — every unit renders in
    // the network's own fixed order, and a row NEVER moves because it accepts the referral (spec
    // D10: an ordering that looked like a recommendation would be one). `referralCandidates`'
    // order preservation is well tested as a pure function; what this component RENDERS was not.
    // A row count alone survives sorting every accepting unit to the top, because the count, the
    // test ids, the reason strings and the uniqueness check are all unchanged by a reorder. This
    // one assertion pins order, completeness and non-truncation together, and subsumes the row
    // count it replaces.
    //
    // Phase 8, Task 4: the rows are now grouped by travel band, so the flat expectation became the
    // BAND order with the site table's order preserved inside each band — the same three
    // properties, restated for the layout that now renders them. `expectedGroupedUnitIds` is total
    // over the network (every unit falls in exactly one band bucket), asserted here so a helper
    // that silently dropped units could not make the comparison agree with itself.
    const expected = expectedGroupedUnitIds(seededReferral("RF-001"));
    expect(expected).toHaveLength(allUnits().length);
    expect(renderedUnitIds(list)).toEqual(expected);
    // ⚠️ NO UNCONDITIONAL ACCEPT CONTROL — which is what this line has always meant. It used to
    // count EVERY button, which was the same number only while an unsuitable ward had no control
    // whatsoever. Since the owner ruled that a clinician may accept anyway with a recorded reason,
    // every one of these 23 rows carries an override control, and counting all buttons would now
    // assert that the ruling had not been implemented.
    expect(acceptButtons(list)).toHaveLength(0);
    // And the other half of that ruling, asserted rather than assumed: not one of these wards is a
    // dead end. Every row that cannot accept offers a way to accept anyway.
    const overrideControls = list.querySelectorAll('button[data-testid^="ward-referral-match-override-accept-"]');
    expect(
      overrideControls,
      "a ward that cannot take this referral offers nothing at all — the explanation without the " +
        "decision, which is the defect the owner's ruling exists to close",
    ).toHaveLength(allUnits().length);
  });

  /**
   * I1 (fix round C, F4) — SECOND HALF, and the half that actually bites. The review proposed
   * this assertion on the RF-001 test alone. It was run against the mutation the review itself
   * names (sorting every accepting unit to the top of `referral-match.tsx`'s list) and the whole
   * suite stayed GREEN: RF-001 has ZERO accepting units, so an accepting-first sort is a no-op
   * there and the RF-001 assertion cannot see it. RF-005 has four accepting units, so the same
   * mutation genuinely reorders this list.
   *
   * The RF-001 assertion is kept — it still pins completeness and non-truncation for the
   * zero-accepting case — but this is the one that guards spec D10's headline property: a row
   * NEVER moves because it accepts the referral, because that ordering would read as a
   * recommendation.
   */
  it("RF-005's match view renders every unit in the network's own fixed order, accepting units NOT floated to the top", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-005"));

    const list = screen.getByTestId("ward-referral-match-list");
    const expected = expectedGroupedUnitIds(seededReferral("RF-005"));
    expect(expected).toHaveLength(allUnits().length);
    expect(renderedUnitIds(list)).toEqual(expected);
    // The guard is only meaningful if some unit DOES accept — otherwise an accepting-first sort
    // is a no-op and this test proves nothing, which is exactly how the RF-001 version failed.
    expect(acceptButtons(list).length).toBeGreaterThan(1);
    // Phase 8, Task 4: and only meaningful against the GROUPED layout if at least one band holds a
    // mixture, since a sort inside a single-verdict band is a no-op there too.
    const bandOfMixedVerdicts = [...TRAVEL_BANDS, "not_recorded"].find((band) => {
      const group = screen.getByTestId(`ward-referral-match-band-group-${band}`);
      const rows = Array.from(group.querySelectorAll("li[data-testid]"));
      // Same correction as `acceptButtons` above: "has a button" stopped meaning "accepts" the
      // moment unsuitable wards gained an override control.
      const accepts = rows.filter(
        (row) => row.querySelector('button[data-testid^="ward-referral-match-accept-"]') !== null,
      );
      return accepts.length > 0 && accepts.length < rows.length;
    });
    expect(
      bandOfMixedVerdicts,
      "no band holds both an accepting and a non-accepting unit — an accepting-first sort inside a band would be invisible",
    ).toBeDefined();
  });

  /**
   * ⚠️ THE OWNER'S RULING, ON THE SCREEN THE RULING IS ACTUALLY FOR.
   *
   * "It will send a refusal.. however... the referral can still be sent if the referrer gives a
   * reason. No referral locations are to be completely blocked!" This view already did the FIRST
   * half perfectly — every ward in the network listed, each unsuitable one carrying the exact
   * reason it cannot take the patient. The accept control and that reason were the two arms of one
   * ternary, so a ward was never shown both: the explanation was there and the button was not.
   *
   * ⚠️ WHAT THESE ASSERT IS DELIBERATELY THIS LAYER ONLY, AND THE OMISSION IS THE POINT. They do
   * NOT assert that the acceptance succeeds, because in this tree the reducer does not yet honour
   * the reason — asserting success would pin today's intermediate engine and go red the moment the
   * engine lands, blocking the very change it belongs to. And they do not assert that the reason
   * REACHES the reducer, because a DOM test cannot see a dispatch: that property is held by the
   * static guard over dispatch literals, which is a different instrument for a different question.
   * What is asserted here is what this screen owes a clinician, and it stays true either side of
   * the engine.
   */
  describe("an unsuitable ward is advised against, never made a dead end", () => {
    /** The first ward RF-001's view says cannot take the patient. RF-001 is the referral no bed
     *  accepts, so every row is one of these — which is what makes it the honest fixture here. */
    function firstUnsuitableUnitId(): string {
      renderBoard();
      fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-001"));
      const list = screen.getByTestId("ward-referral-match-list");
      expect(
        acceptButtons(list),
        "a ward accepts RF-001, so the rows below are not the unsuitable ones this describes",
      ).toHaveLength(0);
      const overrides = Array.from(
        list.querySelectorAll('button[data-testid^="ward-referral-match-override-accept-"]'),
      );
      expect(overrides.length, "no unsuitable ward is rendered, so nothing below is exercised").toBeGreaterThan(0);
      return overrides[0].getAttribute("data-testid")!.replace("ward-referral-match-override-accept-", "");
    }

    it("shows the reason AND a way to act on it, never one without the other", () => {
      const unitId = firstUnsuitableUnitId();
      expect(
        screen.getByTestId(`ward-referral-match-reason-${unitId}`).textContent,
        "the ward's own reason has been dropped in favour of the control — the advice half of the " +
          "ruling lost while adding the decision half",
      ).not.toBe("");
      expect(
        screen.getByTestId(`ward-referral-match-override-accept-${unitId}`),
        "a ward that cannot take this referral offers no way to accept anyway, so the screen " +
          "explains a refusal and leaves the clinician nothing to decide",
      ).toBeInTheDocument();
    });

    it("will not record an override until a reason is chosen, and says why rather than going quiet", () => {
      const unitId = firstUnsuitableUnitId();
      const button = screen.getByTestId(`ward-referral-match-override-accept-${unitId}`);

      expect(
        button.getAttribute("aria-disabled"),
        "the override can be pressed with no reason recorded, so a placement against a ward's own " +
          "assessment enters the record with nothing saying why",
      ).toBe("true");
      // ⚠️ NOT native `disabled`: that removes the tab stop, so a clinician moving by keyboard
      // never reaches the control and never hears the reason it is unavailable.
      expect(
        (button as HTMLButtonElement).disabled,
        "native disabled removes the tab stop, so the stated reason below can never be reached",
      ).toBe(false);
      expect(button.getAttribute("title") ?? "", "the control is unavailable and does not say why").not.toBe("");

      const select = screen.getByTestId(`ward-referral-match-override-reason-${unitId}`) as HTMLSelectElement;
      // ⚠️ STARTS UNCHOSEN. A pre-selected first option would file a clinical justification nobody
      // stated, on the record of a placement made against a ward's own assessment.
      expect(select.value, "a reason is pre-selected, so the software states the clinician's justification").toBe("");

      fireEvent.change(select, { target: { value: OVERRIDE_REASONS[0] } });
      expect(
        screen.getByTestId(`ward-referral-match-override-accept-${unitId}`).getAttribute("aria-disabled"),
        "a reason has been recorded and the control is still unavailable, so the way through the " +
          "refusal is advertised and cannot be walked",
      ).toBeNull();
    });
  });

  it("accepting an eligible unit for RF-005 moves it from queued to recently decided", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-005"));

    const list = screen.getByTestId("ward-referral-match-list");
    const acceptControls = acceptButtons(list);
    // I2 (fix round C, F5): RF-005 has FOUR accepting units, so `/^Accepted at /` alone matched
    // whichever ward the system happened to record. Making `handleAccept` ignore its `unitId`
    // argument and dispatch a different accepting unit kept the old assertion green while the
    // coordinator pressed "Accept at RPH Older Adult" and the record said Bentley. The clicked
    // button's own label is captured here so the decided text has to name THAT unit.
    expect(acceptControls.length).toBeGreaterThan(1);
    const clickedUnitName = acceptControls[0].textContent?.replace(/^Accept at /, "") ?? "";
    expect(clickedUnitName).not.toBe("");
    fireEvent.click(acceptControls[0]);

    expect(screen.queryByTestId("ward-referral-board-select-RF-005")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-board-decided-row-RF-005")).toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-match-decided")).toHaveTextContent(`Accepted at ${clickedUnitName}.`);
  });

  /**
   * Review finding I1 / Task 8 finding B: the branch's most embarrassing defect. The match view
   * rendered a bare `Tier 2` inline in its summary line while the board row directly above it —
   * same page, same field, same moment — read "Tier 2 · urgent". This asserts BOTH halves,
   * because either one alone can pass while the screen is still wrong: the tier element must
   * carry `urgencyTierLabel`'s own output, AND the summary line must no longer carry a tier at
   * all (substituting the shared label back into that dot-separated run would produce
   * "Adult · Female · Tier 2 · urgent · Perth Metropolitan", a worse screen, not a better one).
   *
   * Read against `urgencyTierLabel` itself, never a hard-coded string, so this is a guard on
   * "one spelling", not on the spelling this test happens to remember.
   */
  it("the match view spells the urgency tier exactly as the board does, and never inside the summary line", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-005"));

    const referral = referrals.find((candidate) => candidate.id === "RF-005")!;
    const expected = urgencyTierLabel(referral.urgency);
    expect(screen.getByTestId("ward-referral-match-tier")).toHaveTextContent(expected);

    // The very same spelling is on the board row above it — the two strings this defect had
    // disagreeing, asserted together rather than one at a time.
    expect(screen.getByTestId("ward-referral-board-row-RF-005")).toHaveTextContent(expected);

    // And the summary line carries no tier of any kind. Exact text, not `toContainText`: a
    // summary that put the tier back would still "contain" the three fields below.
    // Written out here rather than built from `referralPersonFacts` -- the screen renders that
    // function's output, so asserting against it would compare the helper with itself and pass
    // whatever it returned.
    const wardArm = referral.destinations.find(
      (addressing) => addressing.destination.kind === "psychiatric_ward",
    )?.destination;
    if (wardArm?.kind !== "psychiatric_ward") throw new Error(`${referral.id} is not a ward referral`);
    expect(screen.getByTestId("ward-referral-match-summary")).toHaveTextContent(
      `${referral.ageBand} · ${wardArm.sex} · ${referral.homeRegion}`,
    );
    expect(screen.getByTestId("ward-referral-match-summary").textContent).not.toMatch(/Tier/);
  });

  /**
   * Review finding I3, and spec D14's own Risks sentence: "An accepted referral goes nowhere
   * (D14). Deliberate, and the board must say so rather than implying a handover happened."
   * Nothing on either referral screen said so. `ACCEPT_REFERRAL` creates no `Movement`, holds no
   * bed and arranges no transfer — a colleague shown "RF-006 | Accepted" and nothing else could
   * reasonably conclude otherwise.
   */
  it("the decided section says plainly that an acceptance holds no bed, moves nobody and arranges no transport", () => {
    // R3 (`docs/ward-flow/plans/2026-09-16-fix-plan-referral-model.md`) replaced "records the unit
    // only" — false for the ED and community arms, which never name a unit at all — with a
    // sentence naming every consequence acceptance does NOT have: no bed, no patient movement, no
    // transport. Pinned wording, not merely a substring, so the retired phrase cannot sneak back in
    // as a synonym nobody wrote a test for.
    renderBoard();
    const note = screen.getByTestId("ward-referral-board-decided-note");
    expect(note).toHaveTextContent(
      "Acceptance records the decision only. No bed is pulled, no patient is moved and no transport is arranged.",
    );
    expect(note.textContent).not.toMatch(/records the unit only/i);
  });

  /**
   * The other half of I3: the decided rows named no unit and gave no reason, and the ONE screen
   * that carried either (the match view's decided panel) was reachable only in the moment
   * straight after deciding a referral you had selected — select anything else, or reload, and
   * it was gone for good. A decline reason that cannot be read back makes the fixed reason list,
   * the entire mechanism by which this phase justifies holding no free text, worthless here.
   *
   * Both outcome kinds, from the shipped fixture: RF-006 accepted (names its unit) and RF-004
   * declined `belongs_to_another_service` (names the reason, in `DECLINE_REASON_LABELS`' own
   * words).
   */
  it("every decided row names its accepting unit, or its decline reason", () => {
    renderBoard();

    const acceptedUnitId = acceptedAddressing(
      referrals.find((candidate) => candidate.id === "RF-006")!,
    )!.acceptedUnitId!;
    const acceptedUnitName = allUnits().find((unit) => unit.id === acceptedUnitId)!.name;
    expect(screen.getByTestId("ward-referral-board-decided-detail-RF-006")).toHaveTextContent(acceptedUnitName);

    const declineReason = declinedAddressings(referrals.find((candidate) => candidate.id === "RF-004")!)[0]!
      .declineReason!;
    expect(screen.getByTestId("ward-referral-board-decided-detail-RF-004")).toHaveTextContent(
      declineReasonLabelForTest(declineReason),
    );

    // Non-vacuity, and the phone view too: every decided referral carries a detail on both
    // renderings, so a row that silently lost one cannot hide behind these two named cases.
    //
    // ⚠️ **WALKED OVER WHAT THE BOARD RENDERS, NOT OVER THE WHOLE FIXTURE, AND THAT IS A REPAIR
    // RATHER THAN A RELAXATION.** This filtered the fixture until 2026-09-05, which was the same set
    // only because the seed held nine decided referrals and the board keeps ten. Once the Midland
    // demonstration referrals took the fixture past that limit, the loop began demanding a detail
    // element for rows the board had correctly truncated — a red test reporting nothing wrong. The
    // floor below is what keeps the narrowing honest.
    const decided = recentlyDecidedReferrals(referrals);
    expect(decided.length, "the decided board renders nothing to check").toBeGreaterThan(1);
    expect(
      referrals.filter((candidate) => referralState(candidate) !== "queued").length,
      "the fixture holds no decided referrals at all, so this sweep proves nothing",
    ).toBeGreaterThan(1);
    for (const referral of decided) {
      expect(screen.getByTestId(`ward-referral-board-decided-detail-${referral.id}`).textContent).not.toBe("");
      expect(screen.getByTestId(`ward-referral-board-decided-detail-card-${referral.id}`).textContent).not.toBe("");
    }
  });

  /**
   * ⚠️ THE ABSENCE, WHICH IS THE ONE THING THIS SUITE COULD NOT SEE.
   *
   * The decline control started on `REFERRAL_DECLINE_REASONS[0]` — `"no_suitable_bed"` — so a ward
   * that pressed Decline without touching it recorded THAT as its clinical reason for refusing a
   * patient. It is the sentence the coordinator then reads when choosing where to try next, it may
   * be untrue, and it is untrue in the direction that sounds most ordinary.
   *
   * ⚠️ NO TEST IN THIS FILE COULD EVER HAVE CAUGHT IT, and that is the point of this one. Both
   * existing decline tests set the reason explicitly before pressing the button (`:1557`, `:1588`),
   * so the default was never once exercised. A default is only wrong when it is OMITTED, and
   * nothing omitted it. This test omits it.
   */
  it("will not record a decline until the ward states its reason, and says why", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-005"));

    const select = screen.getByTestId("ward-referral-match-decline-reason") as HTMLSelectElement;
    expect(
      select.value,
      "a decline reason is pre-selected, so a ward that never touches this control is recorded as " +
        "having given a clinical reason it did not give",
    ).toBe("");

    const button = screen.getByTestId("ward-referral-match-decline");
    expect(button.getAttribute("aria-disabled"), "the referral can be declined with no reason stated").toBe("true");
    // Not native `disabled` — that removes the tab stop, so a ward moving by keyboard would never
    // reach the control and never hear why it is unavailable.
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(button.getAttribute("title") ?? "", "the control is unavailable and does not say why").not.toBe("");

    // ⚠️ AND THE ACTIVATION ITSELF IS REFUSED, NOT ONLY THE BUTTON DISCOURAGED. `aria-disabled`
    // deliberately keeps the control focusable, so it CAN still be activated — the record must not
    // be reachable by that route either.
    fireEvent.click(button);
    expect(
      screen.getByTestId("ward-referral-board-select-RF-005"),
      "the referral was declined despite no reason being stated, so a fabricated clinical " +
        "judgement has entered the record by way of a control that only looked unavailable",
    ).toBeInTheDocument();
    // ⚠️ AND THE DISCRIMINATOR, WHICH THE LINE ABOVE IS NOT ON ITS OWN. If the handler dispatched
    // anyway, the REDUCER would refuse the unrecognised reason and this panel would show that
    // refusal — the referral would stay queued either way, so the assertion above cannot tell "the
    // screen declined to send it" from "the engine caught it". Nothing must be sent at all.
    // Found by mutation: removing the handler guard left the assertion above green.
    expect(
      screen.queryByTestId("ward-referral-match-rejection"),
      "the screen dispatched a decline with no reason and the engine refused it — the record is " +
        "safe by luck rather than by this control, and a screen that relies on the engine to " +
        "catch it will stop being safe the day the engine changes",
    ).not.toBeInTheDocument();

    // And it becomes available the moment the ward states one.
    fireEvent.change(select, { target: { value: "belongs_to_another_service" } });
    expect(
      screen.getByTestId("ward-referral-match-decline").getAttribute("aria-disabled"),
      "a reason has been stated and the control is still unavailable, so a ward cannot decline at all",
    ).toBeNull();
  });

  it("declining a queued referral moves it to recently decided with the chosen reason", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-005"));

    fireEvent.change(screen.getByTestId("ward-referral-match-decline-reason"), {
      target: { value: "belongs_to_another_service" },
    });
    fireEvent.click(screen.getByTestId("ward-referral-match-decline"));

    expect(screen.queryByTestId("ward-referral-board-select-RF-005")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-board-decided-row-RF-005")).toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-match-decided")).toHaveTextContent(
      /^Declined — Belongs to another service\.$/,
    );
  });

  /**
   * ⚠️ **THE MATCH PANEL RENDERS NO RAW ADDRESSING STATE ANYWHERE A CLINICIAN READS.**
   *
   * The heading was `{referral.id} — {ward.state}`: the literal union member, lowercase and
   * unmapped, in an `<h2>` that applies no `text-transform`. A clinician read **"RF-006 —
   * cancelled"**. It was a FOURTH spelling of the state word and the only one bypassing
   * `referralAddressingStateLabel`, which exists to be the single home for these four sentences.
   *
   * ⚠️ **`cancelled` is the one state whose entire point is that NOBODY DECIDED IT** — the request
   * ended because somewhere else accepted first. A bare token is the worst possible place to lose
   * that sentence, because the word alone reads exactly like a decision somebody took.
   *
   * This asserts the ABSENCE of every raw token rather than the presence of one heading, so a
   * fifth spelling introduced anywhere in the panel goes red too — not only a regression of the
   * heading it was written for. Found by Ward Verifier walking the surfaces, 2026-09-02.
   */
  it("⚠️ shows no raw addressing-state token anywhere in the match panel — the state word has one home", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-005"));
    fireEvent.change(screen.getByTestId("ward-referral-match-decline-reason"), {
      target: { value: "belongs_to_another_service" },
    });
    fireEvent.click(screen.getByTestId("ward-referral-match-decline"));

    const panel = screen.getByTestId("ward-referral-match-panel");
    const rendered = panel.textContent ?? "";

    // Non-vacuity: the panel really did render the decided state, so the absence below means
    // something. Without this the assertions pass on an empty panel.
    expect(rendered, "the match panel rendered nothing about the decision, so this test proves nothing").toContain(
      "Declined —",
    );

    for (const token of REFERRAL_ADDRESSING_STATES) {
      expect(
        rendered,
        `the match panel renders the raw addressing-state token "${token}" instead of the sentence ` +
          "`referralAddressingStateLabel` exists to give it. A clinician reads the union member, not " +
          'words — and for "cancelled" that means a request nobody decided is shown as a bare ' +
          "decision word.",
      ).not.toContain(token);
    }
  });
});

/* ------------------------------------------------------------------------------------------- *
 * An acceptance does not erase a refusal (owner ruling, 2026-09-01).
 * ------------------------------------------------------------------------------------------- */

/** The ids the shipped fixture holds, so the harness below can find the referral it raised without
 *  depending on which id the reducer's own sequence happens to mint for it. */
const SEEDED_REFERRAL_IDS = new Set([
  ...referrals.map((referral) => referral.id),
  ...rulingsDemoOverlay(NOW_ANCHOR).referrals.map((referral) => referral.id),
]);

/** A real emergency department, read from the network rather than written down here: the reducer
 *  resolves `edId` against `allEmergencyDepartments()` and refuses an invented one, so a literal
 *  would be a value nobody chose that is correct only until the site table moves. */
const HARNESS_ED_ID = allEmergencyDepartments()[0]!.id;

/* ------------------------------------------------------------------------------------------- *
 * Recently decided caps at ten (owner ruling, 2026-09-02).
 * ------------------------------------------------------------------------------------------- */

/**
 * Raises and declines new referrals one at a time, so a test can build MORE decided referrals
 * than the shipped fixture holds on its own (seven) — needed to prove
 * `RECENTLY_DECIDED_DISPLAY_LIMIT` actually truncates the board's decided list, rather than
 * merely never being exceeded by coincidence.
 *
 * Each new referral carries a SINGLE `community_team` destination, so `raiseOne` then
 * `declineLatest` fully decides it in two dispatches with no unit-eligibility to satisfy — FD-21's
 * parallel-destination rules never enter into it. `now` is pinned by the test's `initialNow`, so
 * every referral declined this way shares one `decidedAt` (= `NOW_ANCHOR`) and ties for MOST
 * recent, ahead of every referral in the real fixture (whose `decidedAt` values are all in the
 * past). That is deliberate: it pins the fixture's own oldest decided referral, RF-010 (accepted
 * 24 days before the anchor — see the "seven decided referrals" test above), at the very bottom
 * of the combined list, so a correctly-sorted ten-item cap drops exactly RF-010 and nothing else —
 * a single, unambiguous row to assert against rather than an untraceable set difference.
 *
 * `decidedCount` is read straight off live context state — never off anything `ReferralBoard`
 * itself renders — so the test's own "there really are more than ten" premise cannot be satisfied
 * vacuously by the very display cap it exists to prove is working.
 */
function ManyDecidedHarness() {
  const { referrals: live, now, dispatch } = useWardFlow();
  const pending = live.find(
    (referral) => !SEEDED_REFERRAL_IDS.has(referral.id) && referralState(referral) === "queued",
  );
  const decidedCount = live.filter((referral) => referralState(referral) !== "queued").length;

  function raiseOne() {
    dispatch({
      type: "RECEIVE_REFERRAL",
      role: "community",
      now,
      ageBand: "Adult",
      destinations: [{ kind: "community_team", teamName: "Extra Capacity Clinic" }],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Cannington" },
      source: "ambulance",
      urgency: 3,
      originSiteCode: "RPH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    });
  }

  function declineLatest() {
    if (!pending) return;
    dispatch({
      type: "DECLINE_REFERRAL",
      role: "coordinator",
      now,
      referralId: pending.id,
      destinationKind: "community_team",
      // A real community reason (O-16.6) — `referred_elsewhere` is a bed-placement reason with
      // zero overlap in meaning with `COMMUNITY_DECLINE_REASONS` and the reducer now refuses it
      // for a `community_team` destination.
      reason: "outside_the_teams_catchment",
    });
  }

  return (
    <div>
      <button type="button" data-testid="harness-raise" onClick={raiseOne}>
        Raise
      </button>
      <button type="button" data-testid="harness-decline-latest" onClick={declineLatest}>
        Decline latest
      </button>
      <span data-testid="harness-decided-count">{decidedCount}</span>
      <ReferralBoard />
    </div>
  );
}

describe("ReferralBoard — recently decided caps at ten (owner ruling, 2026-09-02)", () => {
  it("shows exactly the ten most recently decided referrals, never the first ten in array order", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ManyDecidedHarness />
      </WardFlowProvider>,
    );

    // Build the decided population well past ten: the fixture's own decided referrals (grown by
    // the 17 Sept sample-data addition, RF-016..RF-021), plus four raised-and-declined here. Each
    // pair of clicks fully decides one new referral (raise, then decline the one just raised)
    // before the next pair starts.
    for (let i = 0; i < 4; i += 1) {
      fireEvent.click(screen.getByTestId("harness-raise"));
      fireEvent.click(screen.getByTestId("harness-decline-latest"));
    }

    // The premise, asserted directly off live state — not off the capped board — so this test
    // fails loudly rather than passing vacuously if the fixture or the harness above ever shrinks.
    expect(
      Number(screen.getByTestId("harness-decided-count").textContent),
      "the fixture set up by this test does not actually exceed ten decided referrals, so a passing " +
        "assertion below would prove nothing about the cap",
    ).toBeGreaterThan(10);

    const table = screen.getByTestId("ward-referral-board-decided-table");
    const rows = within(table).getAllByRole("row").slice(1); // drop the header row
    expect(rows).toHaveLength(10);

    // The four just raised-and-declined here are decided "now" (offset 0), so they lead. Behind
    // them, RF-006/RF-007/RF-002/RF-003 keep their old places, but the 17 Sept sample-data
    // addition also seats RF-019 (decidedAt -20) ahead of RF-004 (-25); RF-004 in turn ties the
    // new RF-020 (-25) and wins by original array order, landing the 10th and final slot — which
    // pushes RF-008 (-45) off the board here too, alongside RF-010 (-24 days, always dropped).
    expect(screen.queryByTestId("ward-referral-board-decided-row-RF-010")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("ward-referral-board-decided-row-RF-008"),
      "RF-008 (-45) no longer makes the top ten now that RF-016..RF-021 (17 Sept sample-data " +
        "addition) added several more-recently-decided referrals ahead of it",
    ).not.toBeInTheDocument();
    for (const id of ["RF-002", "RF-003", "RF-004", "RF-006", "RF-007", "RF-019"]) {
      expect(screen.getByTestId(`ward-referral-board-decided-row-${id}`)).toBeInTheDocument();
    }
  });
});

/**
 * Raises a REAL referral through `RECEIVE_REFERRAL` — addressed to all three destination kinds at
 * once (FD-21) — and exposes one button per answer, so a test can compose the state the shipped
 * fixture cannot produce: destinations that REFUSED, and then one that ACCEPTED.
 *
 * Every step goes through the live reducer rather than a hand-built `Referral`, so nothing here
 * can assemble a shape the application itself would refuse — the same property
 * `RaiseAndReviewForensicHarness` above exists for.
 *
 * ⚠️ **THE REFUSALS MUST LAND BEFORE THE ACCEPTANCE, AND THAT IS THE DOMAIN, NOT THE TEST'S
 * CONVENIENCE.** FD-22 cancels every still-queued destination at the moment of acceptance, and a
 * CANCELLED destination is not a refusal — nobody declined it. Answering in the other order would
 * quietly produce a referral with no refusals at all and a test that passed for the wrong reason.
 *
 * The community arm is answered as `coordinator` because `community_team` has no acting role yet
 * (`ward-flow-reducer.ts`'s `answerableBy`) and the coordinator is the role that sees the whole
 * picture; the ED arm is answered as `ed` and the ward arm as `ward`, so `decidedBy` records who
 * actually answered rather than a role that could not have.
 */
function RaiseRefuseThenAcceptHarness({ acceptedBy }: { acceptedBy: "psychiatric_ward" | "emergency_department" }) {
  const { referrals: live, units, now, dispatch } = useWardFlow();
  const created = live.find((referral) => !SEEDED_REFERRAL_IDS.has(referral.id));
  const wardArm = created?.destinations.find((addressing) => addressing.destination.kind === "psychiatric_ward");
  const wardDestination = wardArm?.destination.kind === "psychiatric_ward" ? wardArm.destination : undefined;
  // Searched, never named: a hard-coded unit id would go stale the day the seeded night changes
  // its bed counts, and would fail as "the reducer refused the acceptance" rather than as "no bed
  // in this network accepts an adult female voluntary referral".
  const acceptingUnit =
    created && wardDestination
      ? units.find((unit) => referralEligibility(created, wardDestination, unit, now).eligible)
      : undefined;

  function refuse(destinationKind: "emergency_department", reason: ReferralDeclineReason): void;
  function refuse(destinationKind: "community_team", reason: CommunityDeclineReason): void;
  function refuse(
    destinationKind: "emergency_department" | "community_team",
    reason: ReferralDeclineReason | CommunityDeclineReason,
  ) {
    if (!created) return;
    dispatch({
      type: "DECLINE_REFERRAL",
      role: destinationKind === "emergency_department" ? "ed" : "coordinator",
      now,
      referralId: created.id,
      destinationKind,
      reason,
    });
  }

  return (
    <div>
      <button
        type="button"
        data-testid="harness-raise"
        onClick={() =>
          dispatch({
            type: "RECEIVE_REFERRAL",
            role: "community",
            now,
            ageBand: "Adult",
            destinations: [
              {
                kind: "psychiatric_ward",
                sex: "Female",
                gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
                secureBedNeeded: false,
                involuntaryBedNeeded: false,
                highAcuityNursingNeeded: false,
              },
              { kind: "emergency_department", edId: HARNESS_ED_ID, purpose: "psychiatric_review" },
              { kind: "community_team", teamName: "Inner City Clinic" },
            ],
            homeRegion: "Perth Metropolitan",
            suburb: { kind: "named", name: "Cannington" },
            source: "ambulance",
            urgency: 2,
            originSiteCode: "RPH",
            transportNeeded: false,
            ...FIXTURE_HISTORY,
          })
        }
      >
        Raise
      </button>
      <button
        type="button"
        data-testid="harness-refuse-ed"
        onClick={() => refuse("emergency_department", "belongs_to_another_service")}
      >
        ED refuses
      </button>
      <button
        type="button"
        data-testid="harness-refuse-community"
        // A real community reason (O-16.6) — `referred_elsewhere` is a bed-placement reason with
        // zero overlap in meaning with `COMMUNITY_DECLINE_REASONS`, and the reducer now refuses it
        // for a `community_team` destination.
        onClick={() => refuse("community_team", "outside_the_teams_catchment")}
      >
        Community team refuses
      </button>
      <button
        type="button"
        data-testid="harness-refuse-ward"
        onClick={() =>
          created &&
          dispatch({
            type: "DECLINE_REFERRAL",
            role: "ward",
            now,
            referralId: created.id,
            destinationKind: "psychiatric_ward",
            reason: "no_suitable_bed",
          })
        }
      >
        Ward refuses
      </button>
      <button
        type="button"
        data-testid="harness-accept"
        onClick={() =>
          created &&
          dispatch({
            type: "ACCEPT_REFERRAL",
            role: acceptedBy === "psychiatric_ward" ? "ward" : "ed",
            now,
            referralId: created.id,
            destinationKind: acceptedBy,
            // Only a ward acceptance names a bed; sending a unit with any other arm is refused by
            // the reducer, which is the rule this board's own "the destination is the whole
            // answer" branch mirrors.
            unitId: acceptedBy === "psychiatric_ward" ? acceptingUnit?.id : undefined,
          })
        }
      >
        Accept
      </button>
      <span data-testid="harness-referral-id">{created?.id ?? ""}</span>
      <span data-testid="harness-accepting-unit">{acceptingUnit?.name ?? ""}</span>
      <ReferralBoard />
    </div>
  );
}

function renderHarness(acceptedBy: "psychiatric_ward" | "emergency_department") {
  const rendered = render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <RaiseRefuseThenAcceptHarness acceptedBy={acceptedBy} />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByTestId("harness-raise"));
  const referralId = screen.getByTestId("harness-referral-id").textContent ?? "";
  // Fails by name rather than as a confusing "element not found" three assertions later.
  expect(referralId, "RECEIVE_REFERRAL raised nothing — the harness's own referral is missing").not.toBe("");
  return { ...rendered, referralId };
}

/**
 * ⚠️ **THE DEFECT THIS SUITE EXISTS FOR.** `outcomeDetail` returned on the accepted branch and
 * never reached the declined one, so the moment ANY destination accepted, every refusal recorded
 * against that referral — and the reason the refusing clinician gave — disappeared from the only
 * screen that ever showed them. A ward accepted, and the emergency department's documented refusal
 * was erased. Owner ruling, 2026-09-01: "yes, keep the refusals visible on the board."
 *
 * The board's behaviour on an EMERGENCY-DEPARTMENT refusal was untested in both directions before
 * this: `psychiatric_ward` appeared eight times in this file and `emergency_department` zero, so
 * every existing decline assertion ran against a ward arm. Both tests below refuse an ED arm.
 */
describe("ReferralBoard — an acceptance does not erase a refusal", () => {
  it("shows the accepting unit as the outcome AND every refusal, with the refusing clinician's reason", () => {
    const { referralId } = renderHarness("psychiatric_ward");

    // Refusals first: FD-22 cancels a still-queued destination at the moment of acceptance, and a
    // cancelled destination is not a refusal.
    fireEvent.click(screen.getByTestId("harness-refuse-ed"));
    fireEvent.click(screen.getByTestId("harness-refuse-community"));
    const acceptingUnitName = screen.getByTestId("harness-accepting-unit").textContent ?? "";
    expect(
      acceptingUnitName,
      "no bed in this network accepts the harness's referral — the acceptance below could not be made",
    ).not.toBe("");
    fireEvent.click(screen.getByTestId("harness-accept"));

    // The outcome is still unmistakably the acceptance: the Outcome column says so, and the
    // detail cell LEADS with the unit that took the referral.
    const row = screen.getByTestId(`ward-referral-board-decided-row-${referralId}`);
    expect(row).toHaveTextContent("Accepted");
    const detail = screen.getByTestId(`ward-referral-board-decided-detail-${referralId}`);
    expect(detail.firstElementChild?.textContent).toBe(acceptingUnitName);

    // And both refusals are on the screen, each with the reason that was actually given — read
    // through `DECLINE_REASON_LABELS` rather than re-spelled here, so this asserts "one spelling"
    // rather than the spelling this test happens to remember. Exact text, not `toContainText`: a
    // rendering that dropped the second refusal, or that ran the two together with the unit name
    // into one undifferentiated run, would still "contain" every fragment below.
    const refusals = screen.getByTestId(`ward-referral-board-decided-refusals-${referralId}`);
    expect(refusals.textContent).toBe(
      `Also refused — Emergency department (For psychiatric review): ${DECLINE_REASON_LABELS.belongs_to_another_service}` +
        ` · Community team: ${COMMUNITY_DECLINE_REASON_LABELS.outside_the_teams_catchment}`,
    );
    // The refusals come AFTER the outcome, never before it — a coordinator scanning this column
    // reads what happened first.
    expect(detail.firstElementChild).not.toBe(refusals);
    expect(detail.textContent).toBe(`${acceptingUnitName}${refusals.textContent}`);

    // The phone view carries the same record. It had the identical defect and would have been the
    // half nobody looked at.
    expect(screen.getByTestId(`ward-referral-board-decided-refusals-card-${referralId}`).textContent).toBe(
      refusals.textContent,
    );
  });

  it("an ED acceptance names the destination, and the ward's refusal survives beside it", () => {
    const { referralId } = renderHarness("emergency_department");

    fireEvent.click(screen.getByTestId("harness-refuse-ward"));
    fireEvent.click(screen.getByTestId("harness-accept"));

    // The non-ward branch: the destination itself is the whole answer, and saying "Unit not
    // recorded" here would invent a gap. That choice is preserved, refusals or no refusals.
    const detail = screen.getByTestId(`ward-referral-board-decided-detail-${referralId}`);
    expect(detail.firstElementChild?.textContent).toBe("Emergency department (For psychiatric review)");
    expect(detail.textContent).not.toContain("Unit not recorded");

    expect(screen.getByTestId(`ward-referral-board-decided-refusals-${referralId}`).textContent).toBe(
      `Also refused — Psychiatric ward: ${DECLINE_REASON_LABELS.no_suitable_bed}`,
    );
  });

  /**
   * The other half of the rule, and the reason `alsoRefused` is empty when nothing accepted: on a
   * referral every destination declined, the refusals ARE the outcome. Repeating them under a
   * second "Also refused" heading would invent a distinction the record does not make — and a
   * second line on a row that has nothing else to say would read as a second, quieter outcome.
   */
  it("adds no second refusals line to a row whose refusals are already the outcome, or to one with none", () => {
    renderBoard();
    // RF-004 is the fixture's declined referral; every other decided row accepted with nothing
    // refused. Neither carries a refusals element, and the loop is what stops this passing on a
    // board that simply never renders one.
    const decided = referrals.filter((candidate) => referralState(candidate) !== "queued");
    expect(decided.length).toBeGreaterThan(1);
    expect(decided.some((candidate) => candidate.id === "RF-004")).toBe(true);
    for (const referral of decided) {
      expect(screen.queryByTestId(`ward-referral-board-decided-refusals-${referral.id}`)).not.toBeInTheDocument();
      expect(screen.queryByTestId(`ward-referral-board-decided-refusals-card-${referral.id}`)).not.toBeInTheDocument();
    }
    // RF-004's refusal is still the thing the detail cell says, exactly as before.
    const declineReason = declinedAddressings(referrals.find((candidate) => candidate.id === "RF-004")!)[0]!
      .declineReason!;
    expect(screen.getByTestId("ward-referral-board-decided-detail-RF-004").textContent).toBe(
      `Psychiatric ward: ${declineReasonLabelForTest(declineReason)}`,
    );
  });
});

/**
 * ⚠️ **OWNER RULING 8, 2026-09-01: "'Refused' and 'cancelled because somewhere else said yes' are
 * shown differently... Nobody refused that patient and the record must not imply anyone did."**
 *
 * `cancelledAddressings` (`ward-referrals.ts`) had zero consumers before this — a cancelled
 * destination was silently DROPPED from the board: not mislabelled, not counted, simply never
 * shown. This test drives a REAL cancelled state through the reducer: `harness-accept` is clicked
 * WITHOUT first clicking `harness-refuse-ed`, so FD-22 cancels the still-queued ED arm at the
 * moment the ward accepts — the exact mechanism every test in the describe block above
 * deliberately avoids (each one refuses ED before accepting, precisely so nothing becomes
 * cancelled; one of those tests says so in its own comment).
 *
 * The community arm is refused here rather than left queued, so a real refusal (community) and a
 * real cancellation (ED) land on the same decided row in the same run — proving not just that a
 * cancellation appears, but that it appears somewhere a genuine refusal ALSO appears, and the two
 * stay visibly apart.
 */
describe("ReferralBoard — a cancelled destination is shown, worded so it cannot be read as a refusal", () => {
  it("shows the cancelled ED arm separately from the community team's refusal, and the outcome, on the same row", () => {
    const { referralId } = renderHarness("psychiatric_ward");

    // Community refuses; ED is left queued on purpose — accepting below cancels it (FD-22). The
    // community carve-out (owner ruling, 2026-09-01: "a community referral means a patient is
    // about to be discharged") means the community arm is never auto-cancelled by the acceptance,
    // only this explicit refusal ends it — so this is a genuine decision, not a second automatic
    // closure.
    fireEvent.click(screen.getByTestId("harness-refuse-community"));
    const acceptingUnitName = screen.getByTestId("harness-accepting-unit").textContent ?? "";
    expect(
      acceptingUnitName,
      "no bed in this network accepts the harness's referral — the acceptance below could not be made",
    ).not.toBe("");
    fireEvent.click(screen.getByTestId("harness-accept"));

    const row = screen.getByTestId(`ward-referral-board-decided-row-${referralId}`);
    expect(row).toHaveTextContent("Accepted");
    const detail = screen.getByTestId(`ward-referral-board-decided-detail-${referralId}`);
    expect(detail.firstElementChild?.textContent).toBe(acceptingUnitName);

    // The refusal: community only. Emergency department is not here — it was never refused.
    const refusals = screen.getByTestId(`ward-referral-board-decided-refusals-${referralId}`);
    // ⚠️ ORDERED FIRST, FOR THE REASON THE I3 COMMENT FIFTEEN LINES BELOW ALREADY GIVES about the
    // cancelled block. This assertion used to sit AFTER the exact `.toBe` on the same
    // `textContent`, which made it unable to report anything: if the `.toBe` passes the text is
    // exactly the community sentence and this is trivially true, and if the `.toBe` fails
    // execution stops and this line never runs. Decoration, not coverage — before the ED label
    // changed and after it.
    //
    // ⚠️ The identical defect was found, fixed and EXPLAINED for the cancelled block below, and
    // this instance three lines above that explanation was left as it was. A written diagnosis
    // does not sweep the file it is written in.
    //
    // Ordered first, the named message is what a reader gets — "the cancelled ED arm must never
    // be listed among the refusals" — instead of a bare string diff.
    expect(refusals.textContent, "the cancelled ED arm must never be listed among the refusals").not.toContain(
      "Emergency department",
    );
    expect(refusals.textContent).toBe(
      `Also refused — Community team: ${COMMUNITY_DECLINE_REASON_LABELS.outside_the_teams_catchment}`,
    );

    // The cancellation: ED only, worded with the one reused sentence — never "Declined", and never
    // under the refusals' own lead word, because nobody at the ED looked at this referral at all.
    const cancelled = screen.getByTestId(`ward-referral-board-decided-cancelled-${referralId}`);
    // ⚠️ Fix round 1 (finding I3): this assertion runs FIRST and carries a custom message that
    // NAMES the harm in words — "a destination nobody refused must never render as though it
    // were declined" — rather than leaving that only implied by a bare string diff below. It
    // used to sit after the exact `.toBe`, which meant it never ran: `.toBe` already throws on
    // the exact mutation this exists to catch, so this line was decoration, not coverage.
    // Ordered first, it is the one that fires, and its failure message says what went wrong in
    // words a clinician — not just a diff-reader — can act on.
    expect(
      cancelled.textContent,
      "a destination nobody refused must never render as though it were declined",
    ).not.toContain("Declined");
    // ⚠️ THE SECOND ONE, AND THE I3 FIX ABOVE LEFT IT BEHIND. That fix moved ONE negative
    // assertion in front of the exact `.toBe` and explained at length why order decides whether
    // an assertion can report anything. This one sat AFTER the same `.toBe`, on the same value,
    // three lines below that explanation, and was dead for exactly the reason written there.
    //
    // ⚠️ A DIAGNOSIS DOES NOT SWEEP THE BLOCK IT IS WRITTEN IN. Third instance of this shape in
    // this one file; the other two were found by scanning for it rather than by reading.
    expect(cancelled.textContent, "a cancellation must never be filed under the refusals' own lead word").not.toContain(
      "Also refused",
    );
    expect(cancelled.textContent).toBe(
      "Also cancelled — Emergency department (For psychiatric review): Cancelled — this referral was accepted somewhere else.",
    );

    // All three parts sit on the row, in this order, and nowhere else — the same exactness the
    // describe block above holds `outcomeDetail` to.
    expect(detail.textContent).toBe(`${acceptingUnitName}${refusals.textContent}${cancelled.textContent}`);

    // The phone card view carries the identical record.
    expect(screen.getByTestId(`ward-referral-board-decided-cancelled-card-${referralId}`).textContent).toBe(
      cancelled.textContent,
    );
  });
});

/**
 * ⚠️ **THE DEFECT THIS SUITE EXISTS FOR.** `referralState()` reads "queued" while ANY destination
 * is still undecided (FD-24), so a referral where one destination has already refused and another
 * is still pending showed NOTHING at all — not the refusal, not the reason — until the last
 * destination answered. Owner ruling, 2026-09-01: "A refusal shows on the board as soon as it is
 * given... Somebody ringing round needs to know who has already said no." A coordinator working
 * the phones could ring a service that had already refused, because the board gave no sign it had.
 *
 * **The seed cannot exercise this state at all.** Every seeded referral (`RF-001`…`RF-010`) carries
 * exactly one destination, counted by hand — a queued referral with one destination already
 * refused cannot occur in the shipped fixture. So every test below drives a real, three-destination
 * referral through the live reducer with `RaiseRefuseThenAcceptHarness` and clicks refuse WITHOUT
 * ever clicking accept — the one thing every other test built on that harness deliberately avoids,
 * because it exists to prove the referral stays queued while carrying a real refusal.
 */
describe("ReferralBoard — a refusal shows on the board while the referral is still queued (owner ruling, 2026-09-01)", () => {
  it("shows the refusal and its reason on a still-queued referral, on the table row and the phone card alike", () => {
    const { referralId } = renderHarness("psychiatric_ward");
    // Only the ED arm refuses; the ward and community arms are left pending, so the referral
    // stays queued (FD-24) with a real refusal recorded against it.
    fireEvent.click(screen.getByTestId("harness-refuse-ed"));

    // ⚠️ Ordered FIRST, deliberately: the runner stops at the first failed assertion, so this is
    // the one a mutation must actually break to be caught, and its message names the harm in
    // words rather than leaving it to be inferred from a diff — the same discipline the sibling
    // "cancelled destination" test above holds its own first assertion to. `queryByTestId`, not
    // `getByTestId`: if the mutation removes the element entirely rather than only changing its
    // text, `getByTestId` throws its own generic "unable to find an element" error BEFORE this
    // assertion's message ever attaches — that failure would name nothing. Falling back to `""`
    // keeps both failure modes routed through this one message.
    const tableRefusalsText = screen.queryByTestId(`ward-referral-board-refusals-${referralId}`)?.textContent ?? "";
    expect(
      tableRefusalsText,
      "a coordinator ringing round must be able to see this destination has already refused, or they may ring a service that has already said no",
    ).toBe(
      `Already refused — Emergency department (For psychiatric review): ${DECLINE_REASON_LABELS.belongs_to_another_service}`,
    );

    // The referral is still queued, not decided — this ruling is about the state where nothing
    // has finished answering yet, which is exactly what makes it invisible today.
    expect(screen.getByTestId(`ward-referral-board-row-${referralId}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`ward-referral-board-decided-row-${referralId}`)).not.toBeInTheDocument();

    // The phone card carries the identical record — the coordinator on a phone screen sees the
    // same refusal a coordinator at a desk sees on the table. `queryByTestId`, not `getByTestId`:
    // the same reasoning as the table assertion above applies here too — if a mutation removes
    // the card's refusal element entirely, `getByTestId` throws testing-library's own generic
    // "unable to find an element" error before this message ever attaches, and the failure would
    // name nothing about the phone-screen harm it exists to catch.
    const cardRefusalsText = screen.queryByTestId(`ward-referral-board-card-refusals-${referralId}`)?.textContent ?? "";
    expect(
      cardRefusalsText,
      "a coordinator working from a phone must see the same refusal the table shows, or the phone view silently hides who has already said no",
    ).toBe(tableRefusalsText);

    // The trap this feature sits right next to: a `<button>`'s content model is phrasing content
    // only, and the queued table's select button carries no test of its own for that elsewhere in
    // this file. Asserted here on both select buttons, as the brief requires, rather than relying
    // on the pre-existing card-only test to still be true.
    expect(
      screen
        .getByTestId(`ward-referral-board-select-${referralId}`)
        .querySelectorAll("div, p, ul, ol, section, h1, h2, h3"),
    ).toHaveLength(0);
    expect(
      screen
        .getByTestId(`ward-referral-board-card-select-${referralId}`)
        .querySelectorAll("div, p, ul, ol, section, h1, h2, h3"),
    ).toHaveLength(0);
  });

  /**
   * A referral can have more than one refusal recorded against it while still queued (FD-24 lets
   * the referral stay live until every destination has answered). The decided section already
   * solves "how do several refusal lines join in one cell" — `outcomeDetail`'s own declined-only
   * branch, used when the refusals themselves are the outcome — and this reuses that exact joiner
   * (" · ") rather than inventing a second style for the queued case.
   */
  it("joins two refusals the way the decided section already joins multiples, when a second destination also refuses", () => {
    const { referralId } = renderHarness("psychiatric_ward");
    fireEvent.click(screen.getByTestId("harness-refuse-ed"));
    fireEvent.click(screen.getByTestId("harness-refuse-community"));

    expect(screen.getByTestId(`ward-referral-board-refusals-${referralId}`).textContent).toBe(
      `Already refused — Emergency department (For psychiatric review): ${DECLINE_REASON_LABELS.belongs_to_another_service}` +
        ` · Community team: ${COMMUNITY_DECLINE_REASON_LABELS.outside_the_teams_catchment}`,
    );
  });

  /**
   * The common case, and the seed's only case: a queued referral with no answers yet must look
   * exactly as it always has, with no refusal element anywhere on the board for it.
   */
  it("shows no refusal element at all on a queued referral with no answers yet", () => {
    renderBoard();
    const stillQueued = referrals.filter((candidate) => referralState(candidate) === "queued");
    expect(stillQueued.length).toBeGreaterThan(0);
    for (const referral of stillQueued) {
      expect(screen.queryByTestId(`ward-referral-board-refusals-${referral.id}`)).not.toBeInTheDocument();
      expect(screen.queryByTestId(`ward-referral-board-card-refusals-${referral.id}`)).not.toBeInTheDocument();
    }
  });
});

/**
 * The map is EXHAUSTIVE over `ReferralAddressingState`, proven here at compile time rather than
 * only at runtime. `addressingFixtureFor` below is its OWN exhaustive `switch` — independent of
 * `referralAddressingStateLabel`'s — with no `default`. If `ReferralAddressingState` ever grows a
 * fifth member, this function stops compiling (`tsc` fails on THIS file, not only on
 * `ward-referrals.ts`): TypeScript's "not all code paths return a value" check has no `default` to
 * fall back on. Two independent switches would both have to go wrong for a missing state to slip
 * through, which is the point — a source-only guard can be "fixed" by whoever forgets it exists;
 * this one is pinned by a test that fails loudly.
 *
 * Every expected label below is a literal, never a call back into `referralAddressingStateLabel`
 * or `DECLINE_REASON_LABELS`'s `belongs_to_another_service` entry — an expectation built from the
 * function under test would still match after the function was mutated, which is exactly the kind
 * of check that cannot fail.
 */
function addressingFixtureFor(state: ReferralAddressingState): ReferralAddressing {
  const destination: ReferralDestination = {
    kind: "emergency_department",
    edId: "ED-EXHAUSTIVE-TEST",
    purpose: "psychiatric_review",
  };
  switch (state) {
    case "queued":
      return { destination, state };
    case "accepted":
      return { destination, state, decidedAt: NOW_ANCHOR, decidedBy: "Flow coordinator" };
    case "declined":
      return {
        destination,
        state,
        decidedAt: NOW_ANCHOR,
        decidedBy: "Flow coordinator",
        declineReason: "belongs_to_another_service",
      };
    case "cancelled":
      // `decidedBy` deliberately absent — `ward-model.ts`: "nobody decided it: it is a
      // consequence of an acceptance, not an act."
      return { destination, state, decidedAt: NOW_ANCHOR };
  }
}

describe("referralAddressingStateLabel — exhaustive over ReferralAddressingState", () => {
  it("returns the one sentence for every state", () => {
    const labels = REFERRAL_ADDRESSING_STATES.map((state) => referralAddressingStateLabel(addressingFixtureFor(state)));
    expect(labels).toEqual([
      "Queued.",
      "Accepted.",
      "Declined — Belongs to another service.",
      "Cancelled — this referral was accepted somewhere else.",
    ]);
  });
});

/** A referral this suite constructs itself, so the structural-gap and rejection-surfacing tests
 *  below can control `units` directly rather than depending on the real fixture happening to
 *  contain the right shape of gap. */
const SYNTHETIC_YOUTH_REFERRAL: Referral = {
  id: "RF-TEST-STRUCTURAL",
  ageBand: "Youth",
  destinations: [
    {
      destination: {
        kind: "psychiatric_ward",
        sex: "Female",
        gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
      state: "queued",
    },
  ],
  homeRegion: "Perth Metropolitan",
  suburb: { kind: "named", name: "Armadale" },
  source: "community",
  raisedAt: NOW_ANCHOR - 10,
  urgency: 2,
  originSiteCode: "RPH",
  transportNeeded: false,
  ...FIXTURE_HISTORY,
};

/** `ReferralMatchView` takes `units`/`referral` as explicit props (never reading them from
 *  context itself, the same reason `ShortlistPanel` takes `units` as a prop) — this harness is
 *  what lets a test hand it a deliberately different `units` array from the provider's own live
 *  state, either to construct a structural gap the real fixture does not contain, or (in the
 *  rejection-surfacing suite below) to prove the reducer validates independently of what this
 *  component's own props believe. */
function MatchHarness({ referral, units }: { referral: Referral; units: Unit[] }) {
  const { now, dispatch, rejections } = useWardFlow();
  return <ReferralMatchView referral={referral} units={units} now={now} dispatch={dispatch} rejections={rejections} />;
}

function renderMatch(referral: Referral, units: Unit[]) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <MatchHarness referral={referral} units={units} />
    </WardFlowProvider>,
  );
}

describe("ReferralMatchView — structural vs operational gap", () => {
  it("an age band with no unit anywhere in the network reads as a structural fact, never 'no bed available'", () => {
    const unitsWithoutYouth = allUnits().filter((unit) => unit.cohort !== "Youth");
    renderMatch(SYNTHETIC_YOUTH_REFERRAL, unitsWithoutYouth);

    const banner = screen.getByTestId("ward-referral-match-structural-gap");
    // Widened 2026-09-09: a SINGLE spelling, RED on "This age band has no matching unit anywhere in
    // the network" — a faithful restatement. The element holds this one sentence and nothing else,
    // so the broader spellings cannot be satisfied by a neighbour.
    expectSays(banner, "the no-youth-unit notice", ["no youth unit", "no matching unit", "no unit"]);
    expect(banner).not.toHaveTextContent(/no bed available/i);
    expect(screen.queryByTestId("ward-referral-match-no-bed")).not.toBeInTheDocument();
    // I3 (fix round C, F6): the accepting-count paragraph used to render unconditionally, so this
    // screen read "No youth unit exists in this network." followed by "0 of 22 units accept this
    // referral right now." — and "right now" asserts that this may be different later, when there
    // is no youth bed anywhere to free up. That is the structural/operational distinction the
    // banner above exists to make, undone one line beneath it.
    expect(screen.queryByTestId("ward-referral-match-accepting-count")).not.toBeInTheDocument();
  });

  it("the same age band against the real, unmodified network shows no structural gap", () => {
    renderMatch(SYNTHETIC_YOUTH_REFERRAL, allUnits());
    expect(screen.queryByTestId("ward-referral-match-structural-gap")).not.toBeInTheDocument();
  });
});

/** Raises a fresh, real referral (via `RECEIVE_REFERRAL`, so it genuinely resolves inside the
 *  live reducer's `state.referrals`) and reviews it against a DECEIVED copy of `units` — every
 *  unit as this harness's own props see it, except the network's one forensic bed
 *  (`brm-adult-secure`), which this harness lies about (`forensic: false`) so the component's own
 *  rendering believes it is eligible and shows an Accept button for it. The live provider's real
 *  internal unit list is untouched, so `ACCEPT_REFERRAL`'s own `referralEligibility` check (inside
 *  the reducer) still sees the real forensic bed and refuses — proving the reducer validates
 *  independently of what the UI believes, the same property `referral-intake.tsx`'s own rejection
 *  test proves for `RECEIVE_REFERRAL`. */
function RaiseAndReviewForensicHarness() {
  const { referrals, units, now, dispatch, rejections } = useWardFlow();
  const created = referrals.find((referral) => referral.id === "RF-901");
  return (
    <div>
      <button
        type="button"
        data-testid="raise-forensic-test-referral"
        onClick={() =>
          dispatch({
            type: "RECEIVE_REFERRAL",
            role: "community",
            now,
            ageBand: "Adult",
            destinations: [
              {
                kind: "psychiatric_ward",
                sex: "Male",
                gender: "Male", // R7 (2026-09-25): record gender so the walk needs no coordinator review
                secureBedNeeded: false,
                involuntaryBedNeeded: false,
                highAcuityNursingNeeded: false,
              },
            ],
            homeRegion: "Kimberley",
            suburb: { kind: "named", name: "Broome" },
            source: "police",
            urgency: 2,
            originSiteCode: "BRM",
            transportNeeded: false,
            ...FIXTURE_HISTORY,
          })
        }
      >
        Raise
      </button>
      {created ? (
        <ReferralMatchView
          referral={created}
          units={units.map((unit) => (unit.id === "brm-adult-secure" ? { ...unit, forensic: false } : unit))}
          now={now}
          dispatch={dispatch}
          rejections={rejections}
        />
      ) : null}
    </div>
  );
}

describe("ReferralMatchView — reducer refusal surfaces visibly, never swallowed", () => {
  it("an acceptance the reducer refuses (forensic bed) surfaces as a visible Rejection naming the failing gate", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RaiseAndReviewForensicHarness />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("raise-forensic-test-referral"));

    fireEvent.click(screen.getByTestId("ward-referral-match-accept-brm-adult-secure"));

    const rejection = screen.getByTestId("ward-referral-match-rejection");
    expect(rejection).toBeInTheDocument();
    expect(rejection).toHaveTextContent(/forensic/i);
    // A refused acceptance never silently succeeds — the referral still reads as queued.
    expect(screen.getByTestId("ward-referral-match-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-match-decided")).not.toBeInTheDocument();
  });
});

/**
 * RB7, build plan item 27 (2026-09-17): the "Add a correction" control. Sources the referral LIVE
 * from `useWardFlow().referrals` rather than a synthetic prop-only object (contrast `MatchHarness`
 * above) — `ADD_REFERRAL_CORRECTION` is refused for a referral id the reducer's own state does not
 * hold, so this harness must dispatch against one that genuinely exists, and re-derive it fresh on
 * every render so the corrections list a successful dispatch writes is actually visible here.
 */
function CorrectionHarness() {
  const { referrals, units, now, dispatch, rejections } = useWardFlow();
  const referral = referrals[0];
  if (!referral) throw new Error("the seed must carry at least one referral");
  return <ReferralMatchView referral={referral} units={units} now={now} dispatch={dispatch} rejections={rejections} />;
}

describe("ReferralMatchView — RB7 correction notes (build plan item 27, 2026-09-17)", () => {
  it("typing a note and submitting adds it to the corrections list, with history unchanged", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CorrectionHarness />
      </WardFlowProvider>,
    );

    const historyTextBefore = screen.getByTestId("ward-referral-history-text").textContent;
    const note = "The escort arrived at 14:05, not 14:00 as first written.";
    const textarea = screen.getByTestId("ward-referral-correction-note") as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: note } });
    fireEvent.click(screen.getByTestId("ward-referral-add-correction"));

    const list = screen.getByTestId("ward-referral-corrections-list");
    expect(within(list).getByText(note)).toBeInTheDocument();
    // History is unchanged — the referrer's own written account, not touched by the correction.
    expect(screen.getByTestId("ward-referral-history-text")).toHaveTextContent(historyTextBefore ?? "");
    // The draft clears after a successful submit.
    expect(textarea.value).toBe("");
  });
});

/**
 * Phase 8, Task 4 — the match view's travel-band grouping, its collapse, and the optional
 * local-bed step.
 *
 * The same boundary `tests/ward-travel-bands.test.ts` and `tests/ward-travel-grouping.test.ts` set
 * for themselves applies to every test below, and for the same reason: every value in
 * `SYNTHETIC_TRAVEL_BANDS` is invented, sits beside REAL hospital names, and nobody has measured
 * one. So no test here asserts a specific band for a specific hospital. Where a test needs a home
 * region with a particular shape it SEARCHES the fixture for one and fails loudly by name if none
 * exists, so on the day the placeholders are replaced with checked values this file either stays
 * green or fails honestly.
 */
const BAND_GROUP_KEYS: string[] = [...TRAVEL_BANDS, "not_recorded"];

/** Written out as a literal on purpose — see `tests/ward-travel-grouping.test.ts` for the full
 *  reasoning. `BAND_GROUP_KEYS` is derived from `TRAVEL_BANDS`, so comparing its length against
 *  itself could not fail; pinning the count independently makes adding or removing a band a
 *  decision somebody takes in a test. It counts groups on a screen and is not a clinical, legal or
 *  measured figure. */
const EXPECTED_BAND_GROUP_COUNT = 5;

function bandReferral(overrides: Partial<Referral> = {}): Referral {
  return {
    id: "RF-TEST-BANDS",
    ageBand: "Adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          sex: "Female",
          gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "queued",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    raisedAt: NOW_ANCHOR - 30,
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
    ...overrides,
  };
}

/** The bands the fixture records across the whole network for one home region, read through
 *  `unitTravelBand` — never through the rendered screen, which is the thing under test. */
function bandsAcrossNetwork(homeRegion: Referral["homeRegion"]): (TravelBand | undefined)[] {
  const subject = bandReferral({ homeRegion });
  return allUnits().map((unit) => unitTravelBand(subject, unit));
}

function regionWhere(predicate: (bands: (TravelBand | undefined)[]) => boolean): Referral["homeRegion"] | null {
  return HOME_REGIONS.find((homeRegion) => predicate(bandsAcrossNetwork(homeRegion))) ?? null;
}

function bandGroup(band: string): HTMLElement {
  return screen.getByTestId(`ward-referral-match-band-group-${band}`);
}

/** The heading a coordinator reads for a group key, from the exported labels — never a second
 *  spelling written out in this file. */
function bandGroupHeading(band: string): string {
  return band === "not_recorded" ? NOT_RECORDED_LABEL : TRAVEL_BAND_LABELS[band as TravelBand];
}

describe("ReferralMatchView — travel bands are grouped, and every group is on the screen", () => {
  it("renders all five band headings, including the ones no unit sits in", () => {
    const emptyBandOf = (bands: (TravelBand | undefined)[]) => TRAVEL_BANDS.find((band) => !bands.includes(band));
    const homeRegion = regionWhere((bands) => emptyBandOf(bands) !== undefined);
    expect(
      homeRegion,
      "no home region in the fixture leaves a band empty — this test can no longer prove empty groups render",
    ).not.toBeNull();
    const emptyBand = emptyBandOf(bandsAcrossNetwork(homeRegion!))!;

    renderMatch(bandReferral({ homeRegion: homeRegion! }), allUnits());

    // Every group, in the grouping's own order, present on the screen.
    expect(BAND_GROUP_KEYS).toHaveLength(EXPECTED_BAND_GROUP_COUNT);
    const list = screen.getByTestId("ward-referral-match-list");
    const renderedGroups = Array.from(list.querySelectorAll("[data-testid^='ward-referral-match-band-group-']")).map(
      (group) => (group.getAttribute("data-testid") ?? "").replace(/^ward-referral-match-band-group-/, ""),
    );
    expect(renderedGroups).toEqual(BAND_GROUP_KEYS);

    // Each heading is the exported label, never a second spelling written here.
    for (const band of TRAVEL_BANDS) {
      expect(bandGroup(band)).toHaveTextContent(TRAVEL_BAND_LABELS[band]);
    }
    expect(bandGroup("not_recorded")).toHaveTextContent(NOT_RECORDED_LABEL);

    // The band no unit in the whole network sits in is a heading plus a plain line — never an
    // omitted section. "There is nothing available within an hour" is the answer a coordinator
    // came for, and a missing heading cannot give it; it reads as a rendering fault instead.
    const empty = bandGroup(emptyBand);
    expect(empty).toBeInTheDocument();
    expect(within(empty).getByTestId(`ward-referral-match-band-empty-${emptyBand}`)).toHaveTextContent(
      "No unit in this band.",
    );
    expect(empty.querySelectorAll("li")).toHaveLength(0);
  });

  it("carries both counts on every heading — shut, and for an empty group", () => {
    const emptyBandOf = (bands: (TravelBand | undefined)[]) => TRAVEL_BANDS.find((band) => !bands.includes(band));
    const homeRegion = regionWhere((bands) => emptyBandOf(bands) !== undefined);
    expect(homeRegion, "no home region leaves a band empty — the zero-count case is untestable").not.toBeNull();
    const emptyBand = emptyBandOf(bandsAcrossNetwork(homeRegion!))!;

    // The jsdom setup's default matchMedia stub reports no match, so the groups mount SHUT — the
    // phone default. This is the binding condition on collapsing at all: the heading and both
    // counts render whether the group is open or shut, including for an empty group.
    renderMatch(bandReferral({ homeRegion: homeRegion! }), allUnits());
    for (const group of BAND_GROUP_KEYS) {
      expect(bandGroup(group)).not.toHaveAttribute("open");
    }

    expect(screen.getByTestId(`ward-referral-match-band-counts-${emptyBand}`)).toHaveTextContent(
      "0 units in this band · 0 accept this referral",
    );

    // The five headings between them account for the whole network — a count that disagreed with
    // the rows beneath it, or a group quietly counting a narrowed list, breaks this.
    const total = BAND_GROUP_KEYS.reduce((running, band) => {
      const text = screen.getByTestId(`ward-referral-match-band-counts-${band}`).textContent ?? "";
      const units = Number(/^(\d+) units? in this band/.exec(text)?.[1]);
      expect(units, `heading for ${band} does not state a unit count: ${text}`).not.toBeNaN();
      return running + units;
    }, 0);
    expect(total).toBe(allUnits().length);
  });

  it("puts the heading and both counts INSIDE the summary, the only part a shut group paints", () => {
    // THE assertion the binding condition rests on, and the one that was missing. A closed
    // `<details>` paints its `<summary>` and nothing else — but jsdom does not model that, so every
    // other test in this file proves only that the counts are in the DOCUMENT. Move the counts span
    // one line down, below `</summary>`, and all of them stay green while a coordinator on a phone
    // sees five bare bars with no numbers at all: exactly the outcome the metro/rural toggle was
    // declined to prevent. Containment in the summary is the structural fact that rules it out, and
    // it is checkable where visibility is not.
    const emptyBandOf = (bands: (TravelBand | undefined)[]) => TRAVEL_BANDS.find((band) => !bands.includes(band));
    const homeRegion = regionWhere((bands) => emptyBandOf(bands) !== undefined);
    expect(homeRegion, "no home region leaves a band empty — the empty-group case is untestable").not.toBeNull();
    const emptyBand = emptyBandOf(bandsAcrossNetwork(homeRegion!))!;

    renderMatch(bandReferral({ homeRegion: homeRegion! }), allUnits());

    for (const band of BAND_GROUP_KEYS) {
      const group = bandGroup(band);
      expect(group).not.toHaveAttribute("open");
      const summary = group.querySelector("summary");
      expect(summary, `band group ${band} renders no summary — its heading would sit inside the fold`).not.toBeNull();
      // The heading itself.
      expect(summary!.textContent ?? "").toContain(bandGroupHeading(band));
      // And BOTH counts, as an element genuinely contained by the summary — not merely somewhere
      // inside the details.
      const counts = screen.getByTestId(`ward-referral-match-band-counts-${band}`);
      expect(summary).toContainElement(counts);
      expect(counts.textContent ?? "").toContain("in this band");
      expect(counts.textContent ?? "").toContain("this referral");
    }

    // Including the empty group, which is the case a coordinator most needs answered without
    // opening anything: "there is nothing available within an hour".
    const emptySummary = bandGroup(emptyBand).querySelector("summary");
    expect(emptySummary!.textContent ?? "").toContain("0 units in this band");
    expect(emptySummary!.textContent ?? "").toContain("0 accept this referral");

    // No heading may ever assert temporality: "right now" is what made the earlier global
    // accepting-count line an operational claim, and a band heading must never carry it.
    for (const band of BAND_GROUP_KEYS) {
      expect(bandGroup(band).querySelector("summary")!.textContent ?? "").not.toMatch(/right now/i);
    }
  });

  it("opens the groups at desktop width and keeps every heading and count in place", () => {
    installMatchMediaStub(true);
    renderMatch(bandReferral(), allUnits());

    for (const group of BAND_GROUP_KEYS) {
      expect(bandGroup(group)).toHaveAttribute("open");
      expect(screen.getByTestId(`ward-referral-match-band-counts-${group}`)).toBeInTheDocument();
    }
  });

  it("names an unrecorded band in words on the row itself, never as a blank", () => {
    // A blank cell in a distance column is read as "close", which is the one reading an unrecorded
    // pair must never produce.
    const homeRegion = regionWhere(
      (bands) => bands.some((band) => band === undefined) && bands.some((band) => band !== undefined),
    );
    expect(
      homeRegion,
      "no home region has both banded and unbanded units — the unrecorded row case is untestable",
    ).not.toBeNull();

    const subject = bandReferral({ homeRegion: homeRegion! });
    renderMatch(subject, allUnits());

    const unbanded = allUnits().filter((unit) => unitTravelBand(subject, unit) === undefined);
    expect(unbanded.length).toBeGreaterThan(0);
    const notRecordedGroup = bandGroup("not_recorded");
    for (const unit of unbanded) {
      const band = screen.getByTestId(`ward-referral-match-band-${unit.id}`);
      // The exact words, not merely "some text" — an empty string, a dash or a space would pass a
      // presence check while reading as a blank cell.
      expect(band.textContent).toBe(NOT_RECORDED_LABEL);
      expect(notRecordedGroup).toContainElement(band);
    }

    // And every banded unit carries its own band, so "not recorded" is never the screen's default.
    for (const unit of allUnits()) {
      const recorded = unitTravelBand(subject, unit);
      if (recorded === undefined) continue;
      expect(screen.getByTestId(`ward-referral-match-band-${unit.id}`).textContent).toBe(TRAVEL_BAND_LABELS[recorded]);
    }
  });

  it("states once, at the top of the list, when every candidate landed in the not-recorded group", () => {
    const homeRegion = regionWhere((bands) => bands.every((band) => band === undefined));
    expect(
      homeRegion,
      "no home region is unrecorded at every site — the whole-region-gap sentence is untestable",
    ).not.toBeNull();

    renderMatch(bandReferral({ homeRegion: homeRegion! }), allUnits());

    const sentence = screen.getByTestId("ward-referral-match-all-not-recorded");
    expect(sentence).toHaveTextContent(NOT_RECORDED_LABEL);
    expect(sentence).toHaveTextContent(
      "This prototype holds no travel time between this person's home region and these sites. That is a gap in the invented data, not a statement that these beds are far away.",
    );
    // Once for the whole list, never once per row.
    expect(screen.getAllByTestId("ward-referral-match-all-not-recorded")).toHaveLength(1);
  });

  it("does not state the whole-region gap when some candidate does carry a band", () => {
    const homeRegion = regionWhere((bands) => bands.some((band) => band !== undefined));
    expect(homeRegion, "no home region records any band at all").not.toBeNull();

    renderMatch(bandReferral({ homeRegion: homeRegion! }), allUnits());
    expect(screen.queryByTestId("ward-referral-match-all-not-recorded")).not.toBeInTheDocument();
  });

  it("renders the invented-travel-times notice exactly once, imported and not retyped", () => {
    renderMatch(bandReferral(), allUnits());

    const notices = screen.getAllByTestId("ward-referral-match-synthetic-notice");
    expect(notices).toHaveLength(1);
    expect(notices[0].textContent).toBe(SYNTHETIC_TRAVEL_TIMES_NOTICE);

    // A band is rendered on this screen, so the sentence must be on it — and exactly once, so a
    // second copy per group cannot creep in unnoticed.
    const panel = screen.getByTestId("ward-referral-match-panel");
    expect(screen.getAllByTestId(/^ward-referral-match-band-group-/)).toHaveLength(EXPECTED_BAND_GROUP_COUNT);
    const occurrences = (panel.textContent ?? "").split(SYNTHETIC_TRAVEL_TIMES_NOTICE).length - 1;
    expect(occurrences).toBe(1);
  });

  it("puts the structural-gap banner before every word of distance wording", () => {
    // A gap of the kind "no unit of this type exists anywhere in the network" is not a distance
    // problem and must never be dressed as one, so it is met first.
    const unitsWithoutYouth = allUnits().filter((unit) => unit.cohort !== "Youth");
    renderMatch(SYNTHETIC_YOUTH_REFERRAL, unitsWithoutYouth);

    const banner = screen.getByTestId("ward-referral-match-structural-gap");
    const notice = screen.getByTestId("ward-referral-match-synthetic-notice");
    const firstGroup = bandGroup(BAND_GROUP_KEYS[0]);
    const precedes = (first: Element, second: Element) =>
      Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(precedes(banner, notice)).toBe(true);
    expect(precedes(banner, firstGroup)).toBe(true);
    // The banner itself carries no distance wording of any kind.
    expect(banner.textContent).not.toMatch(/hour|travel|air|home/i);
  });

  it("uses no comparative proximity word anywhere on the screen", () => {
    renderMatch(bandReferral(), allUnits());
    const comparative =
      /nearest|closest|furthest|most remote|hardest to reach|\bbest\b|optimal|recommend|preferred|suggested/i;

    /*
     * ⚠️ THE CARVE-OUT IS GONE, AND THIS IS NOW STRICTLY STRONGER. Until 2026-09-04 this assertion
     * excluded exactly one paragraph — the governance disclaimer — because that disclaimer said the
     * view "never suggests which bed is best" and therefore contained the word "best". It denied a
     * comparative claim rather than making one, and excluding it was what let the rule be enforced
     * over everything else instead of abandoned.
     *
     * The owner withdrew that sentence: the product ranks wards by fit today, so a screen promising
     * it never does is false. Its replacement carries no comparative word at all, so the exception
     * it existed for no longer exists — and the rule now covers the WHOLE panel, disclaimer
     * included.
     *
     * Recorded rather than silently deleted, because an exception removed with no explanation is
     * how the next person reinstates it while "fixing" a red.
     */
    const panel = screen.getByTestId("ward-referral-match-panel");
    const governance = screen.getByTestId("ward-referral-match-governance").textContent ?? "";
    expect(
      governance,
      "the governance paragraph must no longer need an exemption from the comparative rule",
    ).not.toMatch(comparative);
    expect(panel.textContent ?? "").not.toMatch(comparative);

    // And named individually, so no group heading, count, band label or the local-bed offer can
    // ever carry one.
    for (const band of BAND_GROUP_KEYS) {
      expect(bandGroup(band).textContent ?? "").not.toMatch(comparative);
    }
    expect(screen.getByTestId("ward-referral-match-synthetic-notice").textContent ?? "").not.toMatch(comparative);
    expect(screen.getByTestId("ward-referral-match-local-bed").textContent ?? "").not.toMatch(comparative);
  });

  it("groups the WHOLE network — every unit in it reaches the screen", () => {
    // The gap `groupCandidatesByTravelBand` cannot close for itself: it groups whatever list it is
    // given and will happily group a truncated one. The derivation-level test proves grouping the
    // full unit list yields the full count; only a call-site assertion can prove this SCREEN passed
    // the full list. Without it, a later change handing it three units of many goes unnoticed.
    const units = allUnits();
    expect(
      units.length,
      "the network shrank — re-check that this floor still means 'every unit', not 'one site's worth'",
    ).toBeGreaterThanOrEqual(10);

    const subject = bandReferral();
    renderMatch(subject, units);

    const list = screen.getByTestId("ward-referral-match-list");
    const rendered = renderedUnitIds(list);
    expect(rendered).toHaveLength(units.length);
    expect(new Set(rendered).size).toBe(units.length);
    expect([...rendered].sort()).toEqual(units.map((unit) => unit.id).sort());
    // And in the grouped order, with the site table's order preserved inside each band.
    expect(rendered).toEqual(expectedGroupedUnitIds(subject));
  });
});

describe("ReferralMatchView — the optional local-bed step is never owed", () => {
  const COUNTRY_REGION: Referral["homeRegion"] = "Kimberley";
  const METRO_REGION: Referral["homeRegion"] = "Perth Metropolitan";

  it("renders no trace at all of the step's absence", () => {
    renderMatch(bandReferral({ homeRegion: COUNTRY_REGION }), allUnits());

    const region = screen.getByTestId("ward-referral-match-local-bed");
    // Rule 3: absence renders as NOTHING AT ALL. Not "Not recorded", not an empty checkbox, not a
    // grey placeholder, not a warning icon, not an amber row. A referral without the record must
    // look exactly like one that never needed it, because it may be one.
    expect(region.textContent ?? "").not.toMatch(/not recorded/i);
    expect(within(region).queryAllByRole("checkbox")).toHaveLength(0);
    expect(region.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(within(region).queryAllByRole("alert")).toHaveLength(0);
    expect(within(region).queryAllByRole("status")).toHaveLength(0);
    expect(within(region).queryAllByRole("img")).toHaveLength(0);
    expect(region.querySelectorAll("svg")).toHaveLength(0);
    // Rule 5: no figure anywhere counts what is missing — no completeness percentage, no
    // "12 of 40 are missing this step". The region holds no digit at all before the record exists.
    expect(region.textContent ?? "").not.toMatch(/\d/);
    // What IS there is the offer, and only the offer.
    expect(screen.getByTestId("ward-referral-match-local-bed-sought")).toHaveTextContent(
      "Record that a local bed was sought and none was suitable",
    );
    expect(screen.queryByTestId("ward-referral-match-local-bed-sought-record")).not.toBeInTheDocument();
  });

  it("offers the control on a metro referral exactly as on a country one", () => {
    // Rule 4. Offering it only on country referrals would assert that looking closer to home first
    // is a country practice — precisely the thing nobody has established.
    for (const homeRegion of [METRO_REGION, COUNTRY_REGION]) {
      const { unmount } = renderMatch(bandReferral({ homeRegion }), allUnits());
      expect(
        screen.getByTestId("ward-referral-match-local-bed-sought"),
        `the local-bed control is missing for a ${homeRegion} referral`,
      ).toHaveTextContent("Record that a local bed was sought and none was suitable");
      unmount();
    }
  });

  it("creates the record only when the control is taken, and then states it plainly", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-005"));

    expect(screen.queryByTestId("ward-referral-match-local-bed-sought-record")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ward-referral-match-local-bed-sought"));

    // The record now exists and the screen says so; the offer is gone because it is a one-shot.
    expect(screen.getByTestId("ward-referral-match-local-bed-sought-record")).toHaveTextContent(
      /^A local bed was sought and none was suitable, at \d{2}:\d{2}\.$/,
    );
    expect(screen.queryByTestId("ward-referral-match-local-bed-sought")).not.toBeInTheDocument();
    // Nothing was refused, and the referral is still queued — this step is not a decision.
    expect(screen.queryByTestId("ward-referral-match-rejection")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-board-select-RF-005")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------------------------------- *
 * Phase 8, Task 5: the out-of-area ledger screen.
 * ------------------------------------------------------------------------------------------- */

function renderLedger(admissions?: Admission[]) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      {admissions === undefined ? <OutOfAreaBoard /> : <OutOfAreaBoard admissions={admissions} />}
    </WardFlowProvider>,
  );
}

/**
 * Admissions the band table cannot place at all — built by asking `travelBand` directly, never by
 * calling `outOfAreaLedger`. An expectation computed from the very derivation the screen calls
 * would move with it, so a screen that classified by something else entirely would still agree
 * with its own expectation.
 *
 * This is also the fixture the seeded records cannot produce on their own: a screen where the
 * unclassified count is the only non-zero number. That is the state whose wording goes wrong most
 * easily, because there is nothing else on the page to anchor the reader against.
 */
function unclassifiableAdmissions(): Admission[] {
  const units = allUnits();
  return wardAdmissions.filter((admission) => {
    if (admission.state !== "occupied" || admission.arrivedAt === null) return false;
    const unit = units.find((candidate) => candidate.id === admission.unitId);
    // // Task 17 (2026-08-30) allowed `homeRegion` to be null for an admission created by an ED
    // arrival. Every admission this test reaches is a SEEDED one, which always carries a region,
    // so the guard states that promise rather than reaching past the type with a `!`.
    if (admission.homeRegion === null) return false;
    return unit !== undefined && travelBand(admission.homeRegion, unit.siteCode) === undefined;
  });
}

/** Admissions the band table places OUT of area, again asked of `travelBand` directly. */
function outOfAreaAdmissions(): Admission[] {
  const units = allUnits();
  return wardAdmissions.filter((admission) => {
    if (admission.state !== "occupied" || admission.arrivedAt === null) return false;
    const unit = units.find((candidate) => candidate.id === admission.unitId);
    if (unit === undefined || admission.homeRegion === null) return false;
    const band = travelBand(admission.homeRegion, unit.siteCode);
    return band !== undefined && OUT_OF_AREA_BANDS.includes(band);
  });
}

/**
 * The length of stay a given row MUST show, computed here from the seed's own `arrivedAt` and the
 * pinned clock the provider is rendered with.
 *
 * Never by calling `daysInBed`, and never by reading the ledger's `sinceArrival`: an expectation
 * taken from the code under test follows it wherever it goes, so a screen that computed a stay
 * from entirely the wrong instant would still agree with its own expectation. `WARD_ADMISSIONS_ANCHOR`
 * is pinned equal to `NOW_ANCHOR` by `tests/ward-travel-grouping.test.ts`, which is what makes the
 * clock here the same clock the fixture was authored against.
 */
function expectedStayLabel(admission: Admission): string {
  const days = Math.floor((NOW_ANCHOR - admission.arrivedAt!) / MINUTES_PER_DAY);
  if (days === 0) return "Under a day";
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function ledgerText(): string {
  return screen.getByTestId("ward-out-of-area-board").textContent ?? "";
}

describe("OutOfAreaBoard — the governance and disclaimer notices", () => {
  it("omits the threshold definition notice and invented-status warning", () => {
    renderLedger();
    expect(screen.queryByTestId("ward-out-of-area-threshold-notice")).not.toBeInTheDocument();
  });

  it("omits the unvalidated travel bands planning warning notice", () => {
    renderLedger();
    expect(screen.queryByTestId("ward-out-of-area-synthetic-notice")).not.toBeInTheDocument();
    expect(ledgerText()).not.toContain("travel bands are invented and unvalidated");
  });

  it("renders entries directly without disclaimer notices above them", () => {
    renderLedger();
    expect(screen.getByTestId("ward-out-of-area-entries")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-out-of-area-threshold-notice")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-out-of-area-synthetic-notice")).not.toBeInTheDocument();
  });

  it("omits the standing not-a-medical-device disclaimer banner on this board", () => {
    renderLedger();
    expect(screen.queryByTestId("ward-out-of-area-governance")).not.toBeInTheDocument();
  });
});

describe("OutOfAreaBoard — two counts that share no denominator", () => {
  it("states both numbers, each as its own sentence, on the seeded records", () => {
    renderLedger();
    const expectedOutOfArea = outOfAreaAdmissions().length;
    const expectedUnclassified = unclassifiableAdmissions().length;
    // The fixture's own shape is why this screen is dangerous: the unclassified count is far the
    // larger of the two. Asserted as a relation, never as a pinned total — pinning either would
    // pin a consequence of the invented band table.
    expect(expectedUnclassified).toBeGreaterThan(expectedOutOfArea);
    expect(expectedOutOfArea).toBeGreaterThan(0);

    expect(screen.getByTestId("ward-out-of-area-count-people")).toHaveTextContent(
      `${expectedOutOfArea} people are recorded as being in a bed far from home.`,
    );
    /*
     * ⚠️ **PINNED THE WHOLE SENTENCE INCLUDING ITS CAUSAL CLAUSE UNTIL 2026-09-07, AND WENT RED ON A
     * TRUTHFULNESS FIX.** The clause said the beds "could not be placed in a band because this
     * prototype holds no travel time for their home region" — one of the TWO reasons
     * `outOfAreaLedger` increments `notBanded`. The other is `homeRegion === null`, which this
     * prototype's own `PULL_PATIENT` produces on every admission created from an emergency
     * department. The sentence named the cause that was false for those people.
     *
     * This test's property is that BOTH NUMBERS ARE STATED, each as its own sentence — not which
     * explanation accompanies them. So it now pins the count and the claim, and leaves the causal
     * clause free to be corrected without a red. A test that pins prose it does not exist to defend
     * turns every honest rewording into a failure, and the fix for that is never to reword back.
     */
    expect(screen.getByTestId("ward-out-of-area-count-not-banded")).toHaveTextContent(
      `${expectedUnclassified} more could not be placed in a band`,
    );
  });

  it("still states the unclassified count when it is the only non-zero number", () => {
    // The state the seeded records cannot reach. A screen that rendered this count only alongside
    // entries would go silent exactly where the gap is total — and a silent gap reads as no gap.
    const unclassifiable = unclassifiableAdmissions();
    expect(unclassifiable.length).toBeGreaterThan(0);
    renderLedger(unclassifiable);

    // Count and claim, not the causal clause — see the note on the seeded-records case above. The
    // property here is that the figure is STATED AT ALL when it is the only non-zero number, since
    // a silent gap reads as no gap.
    expect(screen.getByTestId("ward-out-of-area-count-not-banded")).toHaveTextContent(
      `${unclassifiable.length} more could not be placed in a band`,
    );
    expect(screen.getByTestId("ward-out-of-area-count-people")).toHaveTextContent(
      "0 people are recorded as being in a bed far from home.",
    );
  });

  /*
   * ⚠️ **THE HALF NEITHER RESOLUTION OF THIS CONFLICT CARRIED, ADDED AT THE FOLD.**
   *
   * Two sessions fixed the two cases above independently, twenty minutes apart, and resolved them
   * differently. **Pinning the whole corrected sentence** catches a revert to the false one-cause
   * clause but reddens on any honest rewording — and a red here invites reverting the wording,
   * which restores a sentence that is false for every patient this prototype places from an
   * emergency department. **Pinning only the count and claim** (the resolution taken above, and the
   * better one) survives rewording but would NOT notice the false clause coming back, because
   * "more could not be placed in a band" is a substring of both the true sentence and the false one.
   *
   * So the regression guard is separate from the property test, which is what lets each be written
   * for its own job. `expectNeverSaysAgain` exists for exactly this and is weaker than it looks —
   * forbidding strings cannot stop the same claim returning in different words. It is a tripwire on
   * a known regression, not proof the claim is absent; the derivation test below is the real check.
   */
  it("never brings back the single-cause explanation that was retired as false", () => {
    renderLedger();
    const banner = screen.getByTestId("ward-out-of-area-count-not-banded");
    expect(banner.textContent ?? "").not.toEqual("");

    /*
     * 🔴 **THIS BAN READ THE BANNER, AND THE RETIRED SENTENCE COULD SIMPLY BE PUT SOMEWHERE ELSE
     * ON THE SCREEN. Measured 2026-09-10**, after the same defect was found three times in the
     * statistics range. Rendered *"Those people are here because this prototype holds no travel
     * time for their home region."* in a NEW element on this board — the retired single-cause
     * explanation, back on screen, verbatim — and **105 of 105 passed.**
     *
     * ⚠️ **It reads the BOARD now, not the banner.** A ban runs opposite to a positive claim:
     * narrowing what a positive claim reads is the sanctioned repair, and narrowing what a BAN
     * reads is what defeats it, because the forbidden phrase ANYWHERE is the defect.
     *
     * ⚠️ **This site was inside a range I had already reported as complete and handed over.** The
     * report's own correction section says I measured these bans' predicates and called them
     * guards; this is the site that correction did not reach. **A correction is scoped to what it
     * was written about, and does not sweep the class it names.**
     *
     * The floor is what stops a page-wide ban passing trivially on a render that produced nothing.
     * MEASURED rather than guessed: this board renders 2,600+ characters, so 500 is a tripwire on
     * a TOTAL render failure and cannot detect a partial one.
     */
    const board = screen.getByTestId("ward-out-of-area-board").textContent ?? "";
    expect(board.length).toBeGreaterThan(500);
    expectNeverSaysAgain(board, "the out-of-area board", [
      "because this prototype holds no travel time for their home region",
      "could not be placed in a band because this prototype",
    ]);
  });

  /*
   * 🔴 THE HALF OF THIS COUNT NOTHING TESTED, AND THE CAPTION HAD BEEN FALSE BECAUSE OF IT.
   *
   * `outOfAreaLedger` increments `notBanded` from TWO places: a null `homeRegion`, and a recorded
   * region the invented band table holds no travel time for. The screen's sentence named only the
   * second — "because this prototype holds no travel time for their home region" — and stopped
   * being true on 2026-08-30, when Task 17 let an ED arrival create an admission carrying no
   * region at all. Corrected in `c5b79df6e` to name both, and the two expectations above pinned
   * the old, narrower sentence until this fold.
   *
   * ⚠️ THE REASON IT SURVIVED IS IN THE FIXTURE, NOT IN THE SCREEN. `unclassifiableAdmissions()`
   * filters `homeRegion === null` OUT by construction, so every existing case here exercises the
   * second branch only. Delete the null-region branch from the derivation entirely and this whole
   * describe block stays green — a caption naming two causes, over a suite that can only ever
   * produce one, is a claim with no catcher behind half of it.
   *
   * So this case reaches the first branch on purpose, and asserts the person is COUNTED rather
   * than dropped: the failure Task 17's own comment warns about is a patient vanishing from the
   * tally, which looks identical to a smaller, tidier number.
   */
  it("counts an admission with no home region at all, rather than dropping the person", () => {
    const seeded = unclassifiableAdmissions();
    expect(seeded.length).toBeGreaterThan(0);

    // One region deliberately removed. Everything else is the seeded record, so any difference in
    // the rendered count is attributable to `homeRegion` and to nothing else.
    const [first, ...rest] = seeded;
    const withoutRegion: Admission[] = [{ ...first, homeRegion: null }, ...rest];
    expect(withoutRegion.filter((a) => a.homeRegion === null)).toHaveLength(1);

    renderLedger(withoutRegion);

    expect(screen.getByTestId("ward-out-of-area-count-not-banded")).toHaveTextContent(
      `${withoutRegion.length} more could not be placed in a band`,
    );
    // The band table cannot place a person with no home, so they must not appear as out of area
    // either — counted in one bucket, and only one.
    expect(screen.getByTestId("ward-out-of-area-count-people")).toHaveTextContent(
      "0 people are recorded as being in a bed far from home.",
    );
  });

  it("presents neither number as a share, a fraction or a percentage of the other", () => {
    renderLedger();
    const text = ledgerText();
    // No "18 of 235", no "18/235", no "7.7%", and no meter or progress element that would draw one
    // number inside the other. At the seeded ratio of roughly twelve to one, any of those would be
    // the dominant reading of the screen, and it would be false.
    expect(text).not.toMatch(/\d+\s*(?:of|out of|\/)\s*\d+/);
    expect(text).not.toContain("%");
    const board = screen.getByTestId("ward-out-of-area-board");
    expect(board.querySelector("progress")).toBeNull();
    expect(board.querySelector("[role='progressbar']")).toBeNull();
    expect(board.querySelector("[role='meter']")).toBeNull();
  });
});

describe("OutOfAreaBoard — what the screen says it is", () => {
  it("does not render the retired provenance explanation card", () => {
    renderLedger();
    expect(screen.queryByTestId("ward-out-of-area-provenance")).not.toBeInTheDocument();
    expect(ledgerText()).not.toContain("Where these figures come from");
  });

  it("never claims that nobody leaves this ledger", () => {
    /*
     * The sentence this task originally mandated, forbidden on 2026-08-29 (D8-9). An `Admission`
     * ends — `state: "departed"`, `leftAt` — and `outOfAreaLedger` excludes anybody not currently
     * holding a bed, so a screen saying otherwise would state something false as fact. This guard
     * is the only thing standing between a plausible-sounding sentence and a clinical screen,
     * because it is exactly the kind of claim a reader has no way to check.
     */
    renderLedger();
    const text = ledgerText().toLowerCase();
    for (const forbidden of [
      "no record of anyone leaving",
      "nobody ever leaves",
      "never leaves this ledger",
      "nobody leaves this ledger",
    ]) {
      expect(text, `the ledger screen must not claim "${forbidden}"`).not.toContain(forbidden);
    }
    expect(screen.getByTestId("ward-out-of-area-table")).toBeInTheDocument();
  });
});

describe("OutOfAreaBoard — the entries", () => {
  it("shows home region, unit and band for every out-of-area admission", () => {
    renderLedger();
    const expected = outOfAreaAdmissions();
    expect(expected.length).toBeGreaterThan(0);
    const units = allUnits();
    for (const admission of expected) {
      const row = screen.getByTestId(`ward-out-of-area-row-${admission.id}`);
      const unit = units.find((candidate) => candidate.id === admission.unitId)!;
      const region = admission.homeRegion;
      expect(region, `${admission.id} is a seeded admission and must carry a home region`).not.toBeNull();
      expect(row).toHaveTextContent(region!);
      expect(row).toHaveTextContent(unit.name);
      expect(row).toHaveTextContent(TRAVEL_BAND_LABELS[travelBand(region!, unit.siteCode)!]);
    }
  });

  it("renders the entries in the records' own order, ranking nobody", () => {
    /*
     * The expected order is taken from `wardAdmissions` itself, never from `outOfAreaLedger` — an
     * expectation read out of the derivation under test would follow it into any sort it grew.
     *
     * This is the phase's defining hazard in its sharpest form. A sort by elapsed time here would
     * be a ranking of people by how recently they were sent away, which reads as a repatriation
     * priority nobody has decided, and nothing on the screen would look wrong.
     */
    renderLedger();
    const expectedIds = outOfAreaAdmissions().map((admission) => admission.id);
    const renderedIds = Array.from(
      screen.getByTestId("ward-out-of-area-table").querySelectorAll("tr[data-testid]"),
    ).map((row) => (row.getAttribute("data-testid") ?? "").replace(/^ward-out-of-area-row-/, ""));
    expect(renderedIds).toEqual(expectedIds);
  });

  it("shows elapsed time and nothing that reads as a deadline", () => {
    // No countdown, no target, no "overdue", no "left". `formatElapsed` is not reused either: it
    // appends "waiting", and somebody in a bed far from home is not waiting for anything this
    // prototype has recorded.
    renderLedger();
    const entries = (screen.getByTestId("ward-out-of-area-entries").textContent ?? "").toLowerCase();
    for (const word of ["overdue", "target", "deadline", "breach", "waiting", "remaining", " left", " due"]) {
      expect(entries, `"${word.trim()}" reads as a deadline on a screen that has none`).not.toContain(word);
    }
    // And a real length of stay is rendered, so the absences above are not the absence of the
    // whole column.
    //
    // The floor this replaced was `/\d+ days?\b/` over this same region, and it did not do what
    // its comment claimed. `textContent` concatenates without separators, so a table cell reading
    // "34 days" is immediately followed by the next row's "South West" and there is NO word
    // boundary after "days"; only the card, which renders "34 days since arrival", ever satisfied
    // it. Proven by a mutation that emptied the table's cell and left this test green while only
    // the per-row walk failed. A plain `toContain` of a value computed from the seed has no such
    // dependence on where the string happens to sit.
    expect(entries).toContain(expectedStayLabel(outOfAreaAdmissions()[0]).toLowerCase());
  });

  it("renders the same four facts on the phone card, which is all a phone shows", () => {
    /*
     * `in the document` is not `on the screen`. Below 40rem `out-of-area.module.css` sets the
     * table's `.tableScroll` to `display: none` and swaps in `.cardList`, so every row assertion
     * above targets markup a phone never renders. Without this test the phone layout carries no
     * content assertion at all.
     *
     * jsdom applies no CSS module, so this checks the card's CONTENT, not its visibility. That is
     * the half that can silently go missing: a card that dropped its band or its length of stay
     * would leave the table — and every other test here — completely green.
     */
    renderLedger();
    const subject = outOfAreaAdmissions()[0];
    expect(subject, "the seed no longer holds an out-of-area admission; this test proves nothing").toBeDefined();
    const unit = allUnits().find((candidate) => candidate.id === subject.unitId)!;
    const card = screen.getByTestId(`ward-out-of-area-card-${subject.id}`);

    const subjectRegion = subject.homeRegion;
    expect(subjectRegion, "the seeded out-of-area subject must carry a home region").not.toBeNull();
    expect(card).toHaveTextContent(subjectRegion!);
    expect(card).toHaveTextContent(unit.name);
    expect(card).toHaveTextContent(TRAVEL_BAND_LABELS[travelBand(subjectRegion!, unit.siteCode)!]);
    expect(card.textContent ?? "").toMatch(/\d+ days? since arrival|Under a day since arrival/);
  });

  it("gives every length of stay in whole days, the way a stay is spoken about", () => {
    /*
     * The defect no assertion caught the first time. The seeded stays run from about a day to about
     * 210 days, and rendered through `splitDuration` that is everything from `25h 30m` to
     * `5041h 30m` — every figure correct, every figure unreadable, and the suite entirely green.
     * The number was never wrong; the FORMAT was.
     *
     * Checked over every rendered row rather than one, and asserted BOTH ways: no `h`/`m` duration
     * anywhere, and a day count on every single row. Either half alone would pass on a screen that
     * had regressed for half its entries.
     */
    renderLedger();
    const rows = Array.from(screen.getByTestId("ward-out-of-area-table").querySelectorAll("tr[data-testid]"));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const text = row.textContent ?? "";
      expect(text, `an hours-and-minutes duration is unreadable at this scale: ${text}`).not.toMatch(/\d+h \d{2}m/);
      expect(text, `no length of stay in days on this row: ${text}`).toMatch(/\d+ days?\b|Under a day/);
    }
  });

  it("gives each row that person's own length of stay, not a shape that looks like one", () => {
    /*
     * Format coverage is not value coverage, and this project has already shipped the difference.
     * In Phase 1 a past timestamp handed to a countdown formatter rendered "1h 35m overdue" on all
     * 48 movements, at seven call sites, one of them under a column headed "Wait". Forty-three
     * tests were green and three reviews had passed, because every assertion checked the shape of
     * the string and none checked the number in it.
     *
     * The three assertions above are that same shape check: all of them pass on a screen that
     * shows ONE constant figure for every person. So each row's number is checked here against
     * that row's OWN arrival, computed from the seed rather than from the code that renders it —
     * and the phone card is checked the same way for every row, not just for the first.
     */
    renderLedger();
    const subjects = outOfAreaAdmissions();
    expect(subjects.length).toBeGreaterThan(1);

    // Without at least two different day counts in the fixture, a constant could not be told apart
    // from the truth and this test would be decorative however carefully it were written.
    const distinct = new Set(subjects.map(expectedStayLabel));
    expect(
      distinct.size,
      "every seeded stay is now the same length, so a constant-per-row screen would pass this test",
    ).toBeGreaterThan(1);

    for (const admission of subjects) {
      const expected = expectedStayLabel(admission);
      const cells = screen.getByTestId(`ward-out-of-area-row-${admission.id}`).querySelectorAll("td");
      expect(cells[cells.length - 1]?.textContent, `${admission.id}'s row shows the wrong length of stay`).toBe(
        expected,
      );
      expect(
        screen.getByTestId(`ward-out-of-area-card-${admission.id}`).textContent ?? "",
        `${admission.id}'s phone card shows the wrong length of stay`,
      ).toContain(`${expected} since arrival`);
    }
  });

  it("says plainly that nobody is out of area rather than showing an empty region", () => {
    renderLedger([]);
    expect(screen.getByTestId("ward-out-of-area-empty")).toHaveTextContent(
      "Nobody on these records is in a bed far from home.",
    );
    expect(screen.queryByTestId("ward-out-of-area-table")).not.toBeInTheDocument();
  });
});

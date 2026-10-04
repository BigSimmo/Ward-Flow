import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";

// Same reason as every sibling dom suite (ward-screen.dom.test.tsx, ward-handover.dom.test.tsx,
// ward-governance.dom.test.tsx): `ClinicalRail` renders next/link anchors and this suite never
// checks routing, so a plain <a> avoids requiring an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { ExceptionDrawer } from "@/components/ward-management/coordinator/exception-drawer";
import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { HandoverPage, PulledBedsSection } from "@/components/ward-management/handover/handover-page";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { HandoverSnapshot } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { movementById } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
/**
 * ⚠️ **THE WORD, ON THE SCREEN — NOT THE IDENTIFIER.**
 *
 * Task 7 moved "hold" off the action it was never about. A HOLD is a bed kept for a patient who
 * already has it while they are away on leave; a PULL is reserving a bed for an incoming patient.
 * The rename touches an event, a stage, a field and a reason code — and **every one of those could
 * be renamed perfectly while a screen still says "hold" to a clinician**, because a label built
 * from fragments (`stageCopy[...].label.toLowerCase()`), a table column header, an `aria-label` and
 * a `<option>` text are all invisible to a grep for the old identifier.
 *
 * So this file asserts RENDERED TEXT and nothing else. Seven of the strings below had no test
 * asserting the word at all before this file existed: the handover page's section and column
 * header, the coordinator's release heading, "Hold released" in the change audit, "Bed hold
 * expired" in the action inbox, and the two ED sentences. They could have survived the rename with
 * the whole suite green.
 *
 * Each block additionally asserts the OLD word is absent from the container it just read, because
 * a screen that gained the new word while keeping the old one beside it is the half-landed rename
 * this file exists to catch. The absence is scoped to the container under test, never the whole
 * document: `Unit.held` legitimately keeps its own name ("empty but not yet offered" is a third
 * thing that is neither a hold nor a pull), and "Held up by" is a bed blocker.
 *
 * Fixture facts, read from `ward-movements.ts` rather than assumed, and asserted below so this
 * file fails loudly instead of silently proving nothing if the seed ever moves:
 *   - WF-003 sits at `accepted_awaiting_bed`, accepted at `rph-adult-secure` — the pull control.
 *   - WF-004 sits at `pulled`, accepted at `bty-adult-secure`, with an already-lapsed
 *     `pullExpiresAt` — the release controls and the expired-pull inbox item.
 */
const WF_003 = movementById("WF-003");
const WF_004 = movementById("WF-004");

it("fixture precondition: WF-003 awaits a bed at rph-adult-secure and WF-004 is pulled at bty-adult-secure", () => {
  expect(WF_003?.stage).toBe("accepted_awaiting_bed");
  expect(WF_003?.acceptedUnitId).toBe("rph-adult-secure");
  expect(WF_004?.stage).toBe("pulled");
  expect(WF_004?.acceptedUnitId).toBe("bty-adult-secure");
  expect(WF_004?.pullExpiresAt).toBeLessThan(NOW_ANCHOR);
});

function renderWard(unitId: string) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardScreen unitId={unitId} />
    </WardFlowProvider>,
  );
}

/**
 * Drives one movement's transport through en route, collected and arrived in a single click, then
 * renders `WardScreen` for the unit it was accepted at — used to reach a genuine empty "coming in"
 * state on a unit the 17 Sept sample-data addition gave an accepted movement to (see the comment on
 * the test below).
 */
function ArrivalDriverHarness({ movementId, unitId }: { movementId: string; unitId: string }) {
  const { dispatch, now } = useWardFlow();
  return (
    <>
      <button
        type="button"
        data-testid={`drive-arrival-${movementId}`}
        onClick={() => {
          dispatch({ type: "TRANSPORT_EN_ROUTE", role: "officer", now, movementId });
          dispatch({ type: "PATIENT_COLLECTED", role: "officer", now, movementId });
          dispatch({ type: "PATIENT_ARRIVED", role: "officer", now, movementId, actingUnitId: unitId });
        }}
      >
        drive to arrival
      </button>
      <WardScreen unitId={unitId} />
    </>
  );
}

describe("the ward screen says pull, never hold, about an incoming patient", () => {
  it("offers 'Pull a bed' on a movement that is accepted and still awaiting one", () => {
    renderWard("rph-adult-secure");
    const card = screen.getByTestId("ward-accepted-WF-003");
    expect(within(card).getByRole("button", { name: "Pull a bed" })).toBeInTheDocument();
    expect(card.textContent ?? "").not.toMatch(/hold/i);
  });

  /**
   * 🔴 **THE ANCHOR OF THIS FILE IS THE BUTTON AND THE THREE NEGATIVES, NOT THIS HEADING.**
   * Owner ruling D-20-REVISED. The clinical property this suite exists for — *the ward screen says
   * pull, never hold, about an incoming patient* — is carried by `getByRole("button", { name: "Pull a
   * bed" })` and by the three `not.toMatch(/hold|held/i)` negatives in the cases around this one.
   * **The heading was never the anchor**, which is why it could be renamed to the drawing's without
   * weakening anything. **Do not "restore" the old wording here to make this file look stricter.**
   *
   * ⚠️ **BOTH LAYERS ARE ASSERTED, AND BEFORE TODAY THEY DISAGREED** — `aria-label="Accepted, pulled
   * or en route"` sat over `<h2>Accepted, pulled or en route here</h2>`, the same words minus one.
   * The rename made them identical; this pins that they stay identical.
   */
  it("heads the list with the drawing's 'Coming in', in the heading and in the landmark label", () => {
    const { container } = renderWard("rph-adult-secure");
    expect(screen.getByRole("heading", { name: "Coming in" })).toBeInTheDocument();
    // The `aria-label` is a second, independent copy of the same words — a screen-reader user
    // reads it and no visible-text assertion can see it.
    const section = container.querySelector('section[aria-label="Coming in"]');
    expect(section).not.toBeNull();
  });

  it("explains the 'Closed' bed figure by contrast with the PULL, not with itself", () => {
    renderWard("rph-adult-secure");
    const disclosure = screen.getByText("What these bed figures mean", { selector: "summary" }).closest("details");
    expect(disclosure).not.toBeNull();
    expect(disclosure?.textContent?.replace(/\s+/gu, " ")).toContain(
      "Closed means empty but not offered; pulled means allocated to a patient who has not arrived yet",
    );
    expect(screen.getByRole("region", { name: "Coming in" })).toBeInTheDocument();
  });

  it("counts down the pull, offers its release, and names the reason list in the release form", () => {
    renderWard("bty-adult-secure");
    const card = screen.getByTestId("ward-accepted-WF-004");

    // The stage label itself, rendered from `stageCopy` — the fragment-built label an identifier
    // grep cannot see.
    expect(card.textContent ?? "").toContain("Bed pulled");
    expect(card.textContent ?? "").toContain("Bed pull ");

    fireEvent.click(within(card).getByRole("button", { name: "Release the pulled bed" }));
    expect(screen.getByLabelText(`Reason for releasing the pulled bed for ${seedPatientName("WF-004")}`)).toBeInTheDocument();
    // The reason OPTION text, which is a label-map lookup rather than a literal in this file's
    // component — a stale map key would render nothing here.
    expect(screen.getByRole("option", { name: "Pull made in error" })).toBeInTheDocument();
    expect(card.textContent ?? "").not.toMatch(/hold/i);
  });

  /**
   * 🔴 **THE EMPTY STATE IS COMPOSED, AND NOBODY DREW THESE WORDS.** Owner ruling D-20-REVISED,
   * logged under the plan's §5.0(2) as wording taken from neither side whole.
   *
   * The drawing renames this panel AND replaces its empty state with *"Nobody has been accepted to
   * this ward and nobody is on the way."* **That is not a trim, it is a weaker claim:** the app names
   * three states a coordinator distinguishes — accepted, pulled, en route — and the drawing names two,
   * folding *pulled* into *on the way*. A pulled bed and a patient en route are not the same thing on
   * this screen, and the bed note six hundred lines above says so in as many words.
   *
   * ⚠️ **But the drawing had the better second half and the app had none:** *"Absence here means none,
   * not that none was asked for."* That is this project's absence discipline written into an empty
   * state — the difference between *nobody is coming* and *we never asked*. The heading came from the
   * drawing; this sentence keeps the app's three states and carries the drawing's discipline.
   *
   * 🔴 **NO BRANCH. The previous version of this case branched on whether the placeholder rendered at
   * all, and the arm asserting the heading was DEAD** — `bty-youth` has no open movement accepted to
   * it, so the placeholder always rendered and that arm never ran. A dead arm is worse than no arm:
   * it held an assertion nobody had ever seen pass. **If a future seed gives `bty-youth` an accepted
   * movement this goes red — pick another empty unit, do not restore the branch.**
   *
   * 🔴 **THAT FUTURE SEED ARRIVED, 17 Sept 2026: WF-021 is now accepted at `bty-youth`
   * (`handover_ready`, transport already accepted).** Rather than hunt for a still-empty unit —
   * exactly the brittleness the comment above warns against, since any later sample-data pass can
   * repeat it — this drives WF-021 the rest of the way to arrival first, through the real reducer
   * events (`TRANSPORT_EN_ROUTE`, `PATIENT_COLLECTED`, `PATIENT_ARRIVED`). `isOpen` (`ward-screen.tsx`'s
   * own filter for this list) excludes an arrived movement, so this reaches a genuine empty state
   * — the one a coordinator sees once the one incoming patient has actually arrived — rather than a
   * unit nothing was ever seeded against. `bty-youth` has exactly one physically empty bed and WF-021
   * is the only movement contending for it (measured against the fixture directly), so the arrival is
   * not blocked by the floor guard.
   */
  it("keeps all three states in the empty text, and says absence means none rather than unasked", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ArrivalDriverHarness movementId="WF-021" unitId="bty-youth" />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("drive-arrival-WF-021"));
    // Owner ruled: once the rulings-demo seed overlay is applied, this placeholder renders twice on
    // the "Coming in" section — leave the duplicate rather than tightening the screen to render it
    // once. Check every match rather than assuming exactly one.
    const placeholders = screen.getAllByText(/No patient is currently accepted, pulled or en route/);
    expect(placeholders.length).toBeGreaterThan(0);
    for (const placeholder of placeholders) {
      const text = placeholder.textContent ?? "";
      expect(text, "the empty state no longer distinguishes accepted from pulled from en route").toContain(
        "accepted, pulled or en route",
      );
      expect(text, "the empty state lost the absence discipline the drawing supplied").toContain(
        "Absence here means none, not that none was asked for",
      );
      expect(text).not.toMatch(/held/i);
    }
  });
});

/** Mirrors `ShortlistHarness` in ward-shortlist.dom.test.tsx: the real provider state handed to
 *  the panel, so this reads the live reducer's own movement rather than a hand-built one. */
function ShortlistHarness({ movementId }: { movementId: string }) {
  const { movements, units, bedReleases, leaveBeds, referrals, now, dispatch, configuration } = useWardFlow();
  return (
    <ShortlistPanel
      movement={movements.find((candidate) => candidate.id === movementId)}
      now={now}
      units={units}
      bedReleases={bedReleases}
      leaveBeds={leaveBeds}
      admissions={wardAdmissions}
      referrals={referrals}
      selectedUnitId={undefined}
      onSelectUnit={() => {}}
      dispatch={dispatch}
      parallelReferralCap={configuration.parallelReferralCap}
    />
  );
}

describe("the coordinator's undo section says pull", () => {
  it("heads the section 'Release the pulled bed or cancel transport' and labels the control accordingly", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ShortlistHarness movementId="WF-004" />
      </WardFlowProvider>,
    );

    expect(screen.getByRole("heading", { name: "Release the pulled bed or cancel transport" })).toBeInTheDocument();
    const toggle = screen.getByTestId("ward-release-pull-toggle");
    expect(toggle).toHaveTextContent("Release the pulled bed");

    fireEvent.click(toggle);
    expect(screen.getByLabelText(`Reason for releasing the pulled bed for ${seedPatientName("WF-004")}`)).toBeInTheDocument();
    expect(screen.getByTestId("ward-release-pull").textContent ?? "").not.toMatch(/hold/i);
  });
});

describe("the handover sheet says pulled", () => {
  it("names the section 'Beds pulled' and the countdown column 'Pull'", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <HandoverPage />
      </WardFlowProvider>,
    );

    const section = screen.getByTestId("ward-handover-pulled-beds");
    expect(within(section).getByRole("heading", { name: "Beds pulled" })).toBeInTheDocument();
    expect(within(section).getByRole("columnheader", { name: "Pull" })).toBeInTheDocument();
    expect(section.textContent ?? "").not.toMatch(/hold/i);
  });

  it("says no bed is currently PULLED when the section is empty", () => {
    const emptySnapshot: HandoverSnapshot = {
      takenAt: NOW_ANCHOR,
      longestWaits: [],
      pulledBeds: [],
      inTransit: [],
      placementGoneWrong: [],
    };
    render(<PulledBedsSection snapshot={emptySnapshot} />);
    expect(screen.getByTestId("ward-handover-pulled-beds-empty")).toHaveTextContent(
      "None — no bed is currently pulled.",
    );
  });

  it("says 'No pull time recorded' rather than inventing an expiry for a row that has none", () => {
    // `handoverSnapshot` can never build this row — it filters on `pullExpiresAt !== undefined` —
    // so the branch is only reachable by handing the section a snapshot directly. It still renders
    // to a reader if the filter and this component ever disagree, which is exactly why it must say
    // the honest thing rather than a substituted time.
    const movement = { ...WF_004!, pullExpiresAt: undefined };
    const snapshot: HandoverSnapshot = {
      takenAt: NOW_ANCHOR,
      longestWaits: [],
      pulledBeds: [{ movement, unit: undefined, expired: false }],
      inTransit: [],
      placementGoneWrong: [],
    };
    render(<PulledBedsSection snapshot={snapshot} />);
    expect(screen.getByTestId("ward-handover-pulled-beds").textContent ?? "").toContain("No pull time recorded");
  });
});

describe("the emergency department's blocked-control reasons say pulled", () => {
  it("names the stage as 'bed pulled' in both the handover and the transport refusal", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="jhc-ed" />
      </WardFlowProvider>,
    );
    // Both sentences are built by lower-casing `stageCopy[...].label` and splicing it into prose,
    // so neither string exists whole in any source file — a grep for the old word finds nothing
    // and a green suite proves nothing unless something reads the rendered attribute.
    const page = screen.getByTestId("ward-ed-screen");
    const titles = [...page.querySelectorAll("[title]")].map((node) => node.getAttribute("title") ?? "");
    const reasons = [...page.querySelectorAll(".sr-only, p")].map((node) => node.textContent ?? "");
    const everything = [...titles, ...reasons].join(" | ");
    expect(everything).toMatch(/not bed pulled/);
    expect(everything).not.toMatch(/not bed held/);
  });
});

describe("the community hub says a bed is PULLED for somebody who has not arrived", () => {
  function admission(overrides: Partial<Admission>): Admission {
    return {
      id: "AD-PULL-01",
      unitId: "bty-adult-secure",
      specialling: false,
      highAcuity: false,
      referralId: null,
      movementId: null,
      patientId: null,
      sex: "Female",
      homeRegion: "Perth Metropolitan",
      tentativeDiagnosis: null,
      state: "pulled",
      pulledAt: NOW_ANCHOR - 30,
      arrivedAt: null,
      awayAtEmergencyDepartmentSince: null,
      expectedDischargeAt: null,
      dischargeDateMoves: 0,
      dischargeDateSetAt: null,
      dischargeDateSetBy: null,
      dischargeConfirmedAt: null,
      dischargeConfirmedBy: null,
      blockReason: null,
      leavingDestination: null,
      leftAt: null,
      followUp: null,
      ...overrides,
    };
  }

  const TEAM = COMMUNITY_TEAM_PAGES[0]!;

  it("labels the row and the count line with pulled, never held", () => {
    let state = seedWardFlowState();
    const before = state.referrals.length;
    state = wardFlowReducer(state, {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      ageBand: "Adult",
      destinations: [{ kind: "community_team", teamName: TEAM.name }],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "RPH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    });
    const referral = state.referrals.slice(before)[0];
    expect(referral, "the reducer refused the fixture referral").toBeTruthy();

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CommunityScreen
          teamId={TEAM.id}
          admissions={[admission({ referralId: referral!.id })]}
          referrals={[referral!]}
        />
      </WardFlowProvider>,
    );

    const page = document.body.textContent ?? "";
    expect(page).toContain("in a bed or have one pulled for them.");
    expect(page).toContain("A bed is pulled — not yet arrived");
    expect(page).not.toContain("have one held for them");
    expect(page).not.toContain("A bed is held");
  });
});

/** Raises a real RELEASE_PULL through the live reducer, so the change audit below reads a genuine
 *  unwind record rather than a hand-authored one. WF-004 is at stage `pulled`, which is the only
 *  stage the reducer accepts this event at. */
function PullReleaser({ movementId }: { movementId: string }) {
  const { now, dispatch } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "RELEASE_PULL",
          role: "coordinator",
          now,
          movementId,
          reason: "pull_made_in_error",
        })
      }
    >
      release the pull
    </button>
  );
}

describe("the coordinator's mode workspaces say pull", () => {
  /*
   * 🔴 **RETIRED 2026-09-05, DELIBERATELY, AND RECORDED IN `diff-integrity.json` — NOT DELETED
   * QUIETLY.** This case rendered `<WardModeWorkspace mode="exceptions" />`. MERGE 01 folded the
   * exceptions inbox into `DelaysScreen` and turned `/mockups/ward-flow/exceptions` into a
   * redirect, so it asserted two strings on a screen no coordinator can open.
   *
   * **Its two halves ended in different places, and only one of them survived the fold.**
   *
   * 1. `"Bed pull expired"` — the vocabulary rule itself. **Already carried onto the live screen**
   *    in `43c56d6c5`: `ward-delays-screen.dom.test.tsx` now pins it against `DelaysScreen`, with
   *    the positive claim doubling as an anti-vacuity floor and a control proving the mutation
   *    fails that one test by name. Re-asserting it here would be a second copy of a pin that
   *    already exists, which is worse than not having it — two guards over one fact drift apart
   *    and the weaker one teaches people the stronger one is redundant.
   *
   * 2. `"Reconfirm or release bed pull"` — the ACTION the old inbox offered about a lapsed
   *    reservation. `DelaysScreen` offers no per-item action at all, by design: its own footer
   *    reads *"Nothing on this screen decides anything."* So there is no control here whose wording
   *    could be wrong, and asserting the ABSENCE of one would fight the next redesign rather than
   *    guard a clinical fact.
   *
   * ⚠️ **THAT SECOND HALF IS A PRODUCT OBSERVATION, NOT A TEST PROBLEM, AND IT IS FLAGGED RATHER
   * THAN DECIDED.** The old inbox told a coordinator what to do about a lapsed pull; the screen
   * that replaced it names the delay and stops. Whether that capability should return is an owner
   * question — recorded for Ward Lead, not resolved here by choosing an assertion.
   */

  it("labels a released reservation 'Pull released' in the governance change audit", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardModeWorkspace mode="governance" />
        <PullReleaser movementId="WF-004" />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Legacy facts" }));
    const before = screen.getByTestId("ward-governance-change-audit");
    expect(before.textContent ?? "").not.toContain("Pull released");

    fireEvent.click(screen.getByRole("button", { name: "release the pull" }));

    const after = screen.getByTestId("ward-governance-change-audit");
    expect(after.textContent ?? "").toContain("Pull released");
    expect(after.textContent ?? "").toContain("Pull made in error");
    expect(after.textContent ?? "").not.toContain("Hold released");
  });

  /*
   * 🔴 **RE-POINTED FROM `mode="queue"` TO `mode="governance"` ON 2026-09-05 — and the substitution
   * is honest because the surface under test never belonged to the queue at all.**
   *
   * `roleFocusCopy` is rendered by `RoleFocus`, and `RoleFocus` sits in `WardModeWorkspace`'s own
   * shell above `ModeBody` — so every mode renders it, including `governance` and `network`, the
   * two modes that still have routes. The role selector this drives (`ModeHeader`) is in that same
   * shell. The queue was only ever the mode this test happened to name; MERGE 01 made it a
   * redirect, and `governance` shows the identical chrome from a route a coordinator can open.
   *
   * ⚠️ **ONE ASSERTION WAS DROPPED, AND NOT BECAUSE IT WAS INCONVENIENT.** This case also required
   * `"Accept and pull bed"`. That string is `roleTaskLabel.ward` (`ward-derivations.ts`), and its
   * ONLY consumer in the repository is `DecisionPanel` — which `QueueView` alone renders, so it is
   * unreachable along with the queue. Asserting it here would have been the very thing this whole
   * exercise exists to stop: a green statement about text no coordinator can see.
   *
   * **The clinical property behind it is not lost, and that was checked rather than assumed.** The
   * ward's own pull control is guarded in this same file by *"offers 'Pull a bed' on a movement
   * that is accepted and still awaiting one"*, against the live `WardScreen` — the screen where
   * `ACCEPT_IN_PRINCIPLE` and `PULL_PATIENT` are actually dispatched, as
   * `ward-management-modes.tsx`'s own comment on `roleTaskLabel` says.
   */
  it("names the coordinator's own focus as pulls, and the ward's as time-limited pulls", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardModeWorkspace mode="network" />
      </WardFlowProvider>,
    );

    const focus = screen.getByText(/Statewide coordination focus/u).closest("section") as HTMLElement;
    expect(focus.textContent ?? "").toContain("pulls and owned exceptions");
    expect(focus.textContent ?? "", "the coordinator's focus calls a bed reservation a hold").not.toContain("holds");

    fireEvent.change(screen.getByLabelText("Current role"), { target: { value: "ward" } });

    const wardFocus = screen.getByText(/Ward capacity focus/u).closest("section") as HTMLElement;
    expect(wardFocus.textContent ?? "").toContain("time-limited pulls");
    expect(wardFocus.textContent ?? "", "the ward's focus calls a bed reservation a hold").not.toContain(
      "time-limited holds",
    );
  });
});

describe("a refused pull says pull in the refusal a coordinator actually reads", () => {
  it("renders the reducer's own refusal text in the exceptions drawer", () => {
    // A closed movement can never be pulled to; WF-004 is closed here by recording an arrival
    // first is not available, so the refusal is raised against a movement the reducer refuses on
    // stage instead — the wording under test is the one that names the action, not the closure.
    let state = seedWardFlowState();
    state = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW_ANCHOR,
      movementId: "WF-001",
      unitId: "rph-adult-secure",
    });
    state = wardFlowReducer(state, {
      type: "RELEASE_PULL",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: "WF-001",
      reason: "pull_made_in_error",
    });
    expect(state.rejections.length, "the reducer accepted both events, so there is nothing to render").toBe(2);

    render(
      <ExceptionDrawer
        items={[]}
        rejections={state.rejections}
        overrides={[]}
        declines={[]}
        units={[]}
        now={NOW_ANCHOR}
        open
        onToggle={() => {}}
        onSelectMovement={() => {}}
      />,
    );

    const drawer = document.body.textContent ?? "";
    // ⚠️ THESE TWO ARE LOCATORS; THE RULING IS THE PAIR OF NEGATIVES BELOW, AND THEY ARE UNTOUCHED.
    // They pinned a whole clause ("…while the movement is"), which O-16.8's rewording broke while
    // leaving this file's actual subject — that the refusal says PULL, never HOLD — entirely
    // intact. Narrowed to the verb and object they exist to find, so a future recast of the
    // sentence around them does not redden a vocabulary guard that still holds.
    expect(drawer).toContain("cannot pull a bed");
    expect(drawer).toContain("cannot release a pull");
    expect(drawer).not.toContain("cannot hold a bed");
    expect(drawer).not.toContain("cannot release a hold");
  });
});

// Owner, 26 Sept 2026: labels name the patient, resolved from the seed register, not the WF number.
function seedPatientName(movementId: string): string {
  const seed = seedWardFlowState();
  return resolveSubjectPatient(seed.movements.find((movement) => movement.id === movementId), seed).displayName;
}

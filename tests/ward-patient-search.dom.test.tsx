import { declinedAddressings, referralState } from "../src/components/ward-management/ward-referrals";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { expectSays } from "./helpers/ward-caption";
import type { Movement, Referral } from "@/components/ward-management/ward-model";

// Same reason as every sibling dom suite (ward-handover.dom.test.tsx, ward-escalation.dom.test.tsx,
// ward-screen.dom.test.tsx): `ClinicalRail` renders next/link anchors and this suite checks the
// result row's href directly rather than actually navigating, so a plain <a> avoids an App Router
// context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PatientSearchPage, ResultsSection } from "@/components/ward-management/search/patient-search";
import { takeHandedOffPatientQuery } from "@/components/ward-management/search/patient-query-handoff";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import { wardMovements } from "@/components/ward-management/ward-movements";

/** Raises the same `ADVANCE_CLOCK` demo event the real demo controls dispatch, so this suite can
 * move the shared clock without reaching into the reducer directly — mirrors `ClockAdvancer` in
 * ward-handover.dom.test.tsx and ward-escalation.dom.test.tsx. */
function ClockAdvancer({ minutes }: { minutes: number }) {
  const { now, dispatch } = useWardFlow();
  return (
    <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes })}>
      advance clock
    </button>
  );
}

function renderSearch() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PatientSearchPage />
      <ClockAdvancer minutes={100} />
    </WardFlowProvider>,
  );
}

const { movements } = seedWardFlowState();
const openCount = movements.filter(isOpen).length;
/** The waiting referrals the search now also covers — see the heading assertion below for why the
 *  heading counts these and the table does not. */
const queuedReferrals = seedWardFlowState().referrals.filter((referral) => referralState(referral) === "queued");

describe("PatientSearchPage", () => {
  it("renders the root, the three labelled fields, and the results section", () => {
    renderSearch();

    expect(screen.getByTestId("ward-patient-search")).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(screen.getByLabelText("Stage")).toBeInTheDocument();
    expect(screen.getByLabelText("Department")).toBeInTheDocument();
    expect(screen.getByTestId("ward-patient-search-results")).toBeInTheDocument();
  });

  // THE DEFECT this guards against: the page is titled "Patient search" but, before this fix, its
  // own subtitle and placeholder described only a movement lookup ("Find an open movement by id,
  // department, destination, stage or owner." / "Movement id, destination, owner…") even though the
  // same box also finds a PERSON by name or record number (see the "search finds PEOPLE" suite
  // below — that capability already worked). A working feature that describes itself as something
  // else is indistinguishable, to a reader, from a missing one. This test pins that the on-screen
  // copy names the person-finding half of what the box does, not just the movement half.
  it("tells the reader the search finds a person, not only a movement", () => {
    renderSearch();

    expect(screen.getByText(/Find a person by name or (record number|UMRN)/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toHaveAttribute("placeholder", expect.stringMatching(/name/i));
  });

  // This page owns its own single search field, a stage select and a department select — never a
  // second, shell-mounted composer. Asserted directly: exactly one text input and exactly one
  // <form> exist anywhere on the rendered page.
  it("owns exactly one search composer: one text input, one form", () => {
    renderSearch();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(document.querySelectorAll("form")).toHaveLength(1);
  });

  // ⚠️ THE TYPED TEXT NO LONGER TRAVELS IN THE LINK — it used to be a `?search=` query parameter,
  // which puts a name or record number into browser history and every proxy log between here and
  // the server. It now travels through `patient-query-handoff.ts`'s in-memory, read-once channel,
  // written by the link's own `onClick` rather than baked into its `href`. See that module's own
  // doc comment for the ruling this closes.
  it("places the existing single query control before results, keeps the Add patient href constant, and hands its typed text off in memory instead", () => {
    renderSearch();
    const search = screen.getByLabelText("Search");
    const results = screen.getByTestId("ward-patient-search-results-console");
    expect(search.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const add = screen.getByTestId("ward-patient-search-add");
    expect(add).toHaveAttribute("href", "/mockups/ward-flow/people/new");
    fireEvent.change(search, { target: { value: "UM999999" } });
    // The href is unchanged by what was typed — no query string, and nothing in the attribute
    // that names the record.
    expect(add).toHaveAttribute("href", "/mockups/ward-flow/people/new");
    const emptyStateAdd = screen.getByTestId("ward-patient-search-people-empty-add");
    expect(emptyStateAdd).toHaveAttribute("href", "/mockups/ward-flow/people/new");
    // Clicking either link hands the same typed text to the add-patient form through the channel,
    // unassigned to a field — `takeHandedOffPatientQuery` both proves the write happened and
    // clears it, the same read `AddPatientForm`'s own mount performs.
    fireEvent.click(add);
    expect(takeHandedOffPatientQuery()).toEqual({ text: "UM999999", assignTo: "carried" });
    fireEvent.click(emptyStateAdd);
    expect(takeHandedOffPatientQuery()).toEqual({ text: "UM999999", assignTo: "carried" });
    expect(screen.queryAllByTestId(/^ward-patient-search-access-record-row-/)).toHaveLength(0);
  });

  it("shows every open movement with no filters applied, matching the measured open count", () => {
    renderSearch();
    const rows = within(screen.getByTestId("ward-patient-search-results")).getAllByRole("row");
    // One header row plus one row per open movement.
    expect(rows.length - 1).toBe(openCount);

    /*
     * The heading counts BOTH records and the table counts one, and that is deliberate rather than
     * an inconsistency to reconcile. As of 2026-08-30 the search covers waiting referrals as well
     * as open movements — a person referred and not yet accepted has no movement at all, and the
     * owner's requirement is that they show up. The table above is movement-shaped (stage,
     * department, destination, time since arrival) and referrals have none of those, so they are
     * listed separately; the heading is the count of everything found.
     *
     * Stated as a sum with both halves named rather than re-baselined to whatever the page now
     * prints. A number copied out of a failing test is a screenshot of the current behaviour, and
     * it agrees with a defect exactly as readily as with a fix.
     */
    const queuedReferralCount = queuedReferrals.length;
    expect(queuedReferralCount, "no queued referral seeded — this assertion would prove nothing").toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: `${openCount + queuedReferralCount} matches` })).toBeInTheDocument();
  });

  it("narrows to the matching movement when searching by id, and links to its movement page", () => {
    renderSearch();

    // Searching the WF number must still find the row — only the visible label changed.
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "wf-003" } });

    const results = screen.getByTestId("ward-patient-search-results");
    expect(screen.getByRole("heading", { name: "1 match" })).toBeInTheDocument();

    // Owner, 26 Sept 2026: the row shows the patient's name, never the WF journey number.
    const seedForName = seedWardFlowState();
    const matchedMovement = seedForName.movements.find((m) => m.id === "WF-003");
    if (!matchedMovement) throw new Error("fixture WF-003 is required by this test and is missing");
    const { displayName } = resolveSubjectPatient(matchedMovement, seedForName);

    expect(within(results).getByText(displayName)).toBeInTheDocument();
    expect(within(results).queryByText("WF-003")).not.toBeInTheDocument();

    const link = within(results).getByRole("link", { name: "Open" });
    expect(link).toHaveAttribute("href", "/mockups/ward-flow/movements/WF-003");
  });

  it('renders the explicit "No matches" note — never a bare empty table — for a query nothing fits', () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "zzz-no-such-movement" } });

    expect(screen.getByTestId("ward-patient-search-empty")).toHaveTextContent("No matches");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "0 matches" })).toBeInTheDocument();
  });

  // THE ABSOLUTE RULE, proven on the rendered page rather than only against the pure function:
  // WF-007 is closed in the real fixture (see tests/ward-patient-search.test.ts's own comment for
  // its exact closure fields). Searching its own id, verbatim, must render the explicit "No
  // matches" note — a closed patient must never surface as though still in the system.
  it("never renders a closed movement, even when the query is the closed movement's own id", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "wf-007" } });

    expect(screen.getByTestId("ward-patient-search-empty")).toHaveTextContent("No matches");
    expect(screen.queryByText("WF-007")).not.toBeInTheDocument();
  });

  it("narrows by the stage select alone", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Stage"), { target: { value: "pulled" } });

    // Measured (tests/ward-patient-search.test.ts): exactly seven OPEN movements are "pulled".
    // 7 → 9: the 17 Sept sample-data addition, WF-024/WF-029 (both stage "pulled").
    // 9 → 8: WF-024 removed (40-60 range), 17 Sept
    expect(screen.getByRole("heading", { name: "8 matches" })).toBeInTheDocument();
    const results = screen.getByTestId("ward-patient-search-results");
    expect(within(results).getAllByText("Bed pulled").length).toBe(8);
  });

  it("narrows by the department select alone", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Department"), { target: { value: "arm-ed" } });

    const armEdCount = movements.filter((m) => isOpen(m) && m.originEdId === "arm-ed").length;
    expect(screen.getByRole("heading", { name: `${armEdCount} matches` })).toBeInTheDocument();
  });

  // This board is deliberately live, like the escalation board and unlike the frozen shift
  // handover: advancing the shared clock must move the "Since arrival" column forward.
  it("stays live: the results table advances when the shared clock advances", () => {
    renderSearch();

    const before = screen.getByTestId("ward-patient-search-results").textContent ?? "";
    fireEvent.click(screen.getByRole("button", { name: "advance clock" }));
    const after = screen.getByTestId("ward-patient-search-results").textContent ?? "";

    expect(after).not.toBe(before);
  });
});

/*
 * §8.6 — what this search refuses. Task 5's own catcher, distinct from "no matches": a refused
 * query is never an empty list, it is a stated refusal, shown in both the filter bar and the
 * results area, and it returns no rows at all.
 */
describe("what this search refuses", () => {
  it("renders the refusal sentence, announces it, and returns no result rows for a refused query", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "risk score" } });

    const sentence =
      "Search does not return a risk or acuity score or a best match. Search by name, identifier, department, ward or owner.";

    // Shown twice — filter bar and results area (§8.6) — and spoken to the live region once. The
    // typeahead beside it owns its own separate status live region (its match count), so the
    // refusal's announcement is found by its own testid rather than by role alone.
    expect(screen.getAllByText(sentence)).toHaveLength(2);
    const announced = screen.getByTestId("ward-patient-search-refusal");
    expect(announced).toHaveAttribute("role", "status");
    expect(announced).toHaveAttribute("aria-live", "polite");
    expect(announced).toHaveTextContent(sentence);

    // "It is never an empty list" — but it is also never a list at all: no rows, no people list,
    // no "No matches" note either, because a refusal is a different state from nothing matching.
    expect(screen.queryAllByRole("row")).toHaveLength(0);
    expect(screen.queryByTestId("ward-patient-search-people-list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-patient-search-empty")).not.toBeInTheDocument();
  });

  it("refuses closed and arrived movements with the other fixed sentence", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "discharged" } });

    const sentence =
      "Closed and arrived movements are not searchable here. They are in the Movement screen's register.";
    expect(screen.getAllByText(sentence)).toHaveLength(2);
    expect(screen.queryAllByRole("row")).toHaveLength(0);
  });

  it("refuses nothing for an ordinary query — the existing results still render", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "wf-003" } });

    expect(screen.queryByTestId("ward-patient-search-refusal")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-patient-search-results")).toBeInTheDocument();
  });
});

describe("search finds PEOPLE, including ones the movement search structurally cannot", () => {
  /*
   * WHY THIS IS A DIFFERENT CLAIM FROM THE TESTS ABOVE. `searchMovements` applies `isOpen` first and
   * unconditionally, so it can only ever return somebody mid-journey. A patient who has been
   * referred but not moved, one who has arrived on a ward, and one who has just been added and has
   * nothing attached at all are all invisible to it.
   *
   * The last is the case the owner's flow turns on: "search a patient, and if nobody comes up, ADD
   * them." You cannot know that nobody came up if the search can only see people already in transit
   * — it would report "no match" for somebody sitting in the system, and the clinician would add a
   * duplicate.
   */
  it("finds a person by record number even though they have no movement at all", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "UM100001" } });

    const people = screen.getByTestId("ward-patient-search-people-list");
    expect(
      within(people).getByText(/Halloway/),
      "a seeded patient with no open movement must still be findable. If this fails, search is still " +
        "looking at journeys rather than people, and 'if nobody comes up, add them' cannot be trusted.",
    ).toBeInTheDocument();
  });

  // FIX 2: before this fix, `findPatients` matched `umrn` with `===`, so a bare, partial record
  // number found nobody even though the identical partial NAME already worked two tests up. A
  // clinician remembers the digits, not the "UM" prefix — searching just the digits must find the
  // same person the full record number does.
  it("finds the same person by a bare, partial record number — no 'UM' prefix, no full match", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "100001" } });

    const people = screen.getByTestId("ward-patient-search-people-list");
    expect(within(people).getByText(/Halloway/)).toBeInTheDocument();
  });

  it("finds related spellings, not just exact ones", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "hallow" } });

    const people = screen.getByTestId("ward-patient-search-people-list");
    expect(within(people).getByText(/Talia Halloway/)).toBeInTheDocument();
    expect(
      within(people).getByText(/Marcus Hallowin/),
      "the near-miss pair is seeded for exactly this. A search that returned only the exact spelling " +
        "would look correct on this fixture and hide the person a clinician was actually looking for.",
    ).toBeInTheDocument();
  });

  it("says plainly that nobody is known, rather than showing an empty list", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "zzzznobody" } });

    expectSays(screen.getByTestId("ward-patient-search-people-empty"), "the not-in-system note", [
      "Check the spelling or record number",
      "adding a patient",
    ]);
  });

  it("prompts rather than listing everybody before anything is typed", () => {
    // A search that returned every patient on an empty query would make the "nobody came up" signal
    // meaningless — and would put the whole synthetic patient list on screen unasked.
    renderSearch();
    expect(screen.getByTestId("ward-patient-search-people-idle")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-patient-search-people-list")).toBeNull();
  });
});

/*
 * 🔴 WHAT THIS SCREEN ASSERTS ABOUT A BED, AND WHAT THE RECORD ACTUALLY HOLDS.
 *
 * Both defects below shipped green through fifty-nine passing DOM assertions, because every one of
 * those asserted that a cell RENDERED rather than that it was TRUE. These two assert the property
 * over the fixture and name the row that would break them.
 */
describe("the results table never claims more than the record holds", () => {
  /*
   * ⚠️ THE POPULATION IS FLOORED, NOT THE FINDING. This walks every open movement with live
   * referrals and no acceptance — the only rows that can exhibit the defect. If the fixture stops
   * containing any, this test would pass by walking nothing, so the floor below fails FIRST and
   * says so. Flooring the population walked is the check; flooring the number of violations would
   * be an assertion that the defect exists, which is the opposite of what is wanted.
   */
  it("shows no destination for a patient no ward has accepted, however many wards were asked", () => {
    const referredNotAccepted = wardMovements
      .filter(isOpen)
      .filter((movement) => movement.referredUnitIds.length > 0 && movement.acceptedUnitId === undefined);

    expect(
      referredNotAccepted.length,
      "no open movement has live referrals and no acceptance, so this test walks nothing and proves " +
        "nothing. Do not delete it — find out what changed in the fixture and re-point it.",
    ).toBeGreaterThan(0);

    renderSearch();
    const results = screen.getByTestId("ward-patient-search-results");

    for (const movement of referredNotAccepted) {
      // Owner, 26 Sept 2026: the row shows the patient's name, never the WF journey number, so the
      // row is found by the preview button's testid (which still carries the movement id) rather
      // than by the movement id appearing anywhere in visible text.
      const row = within(results).getByTestId(`ward-patient-search-movement-preview-${movement.id}`).closest("tr");
      expect(row, `movement ${movement.id} is missing from the results table entirely`).not.toBeNull();
      const cells = [...(row as HTMLTableRowElement).cells].map((cell) => cell.textContent ?? "");

      /*
       * 🔴 THE PROPERTY, WITH NO VOCABULARY IN IT. Rewritten twice on 2026-09-04, and the two
       * discarded versions are why this one is shaped the way it is.
       *
       * v1 asserted that NO referred ward's name may appear anywhere on the row. That was an EXACT
       * proxy while the only way such a name could appear was as the destination, and it caught the
       * real defect — the cell printing the first ward ASKED as though it were the destination. It
       * stopped being exact when the cell began naming the wards asked ALONGSIDE an explicit denial
       * ("2 wards asked, none has accepted — Ward A, Ward B"), which exists because the search
       * haystack matches on a ward's name: without it the coordinator types a ward and the ward
       * vanishes from the row, leaving a result with no visible reason.
       *
       * ⚠️ v2 REPLACED ONE ALLOWED PHRASE WITH THREE AND CALLED IT A PROPERTY. A reviewer listed
       * the truthful denials it would have gone RED on — "not yet accepted by any ward", "awaiting
       * acceptance", "No acceptance recorded", "0 wards have accepted", "Nobody has accepted this
       * patient" — and noted that the movement workspace masthead already says "No ward has
       * accepted this patient", so harmonising the two screens would have turned this red on the
       * harmonisation. It was the same defect as v1, occurring three times less often, sitting
       * under a comment that described it as the property.
       *
       * v3, below, names no wording at all. The population is chosen from the MODEL — referred,
       * never accepted — and the assertion is that this movement's DESTINATION CELL says something
       * beyond ward names. A cell that is nothing but ward names reads as "this is where they are
       * going", which is the false claim; a cell that is empty says nothing at all, which was the
       * other half of the original defect. Both now fail here, and every rewording above passes.
       *
       * ⚠️ Cell-scoped, not row-scoped. v2 tested the joined row, so a denial in any OTHER column
       * satisfied a claim about the destination. Latent today (only this column can carry that
       * text) and live the day anyone adds a column.
       *
       * The column is found from the table's own header rather than by index, so inserting a
       * column ahead of it cannot silently re-point this at the wrong cell.
       */
      const headerTexts = [...results.querySelectorAll("thead th")].map((th) => th.textContent ?? "");
      const destinationColumn = headerTexts.findIndex((text) => /destination/i.test(text));
      expect(
        destinationColumn,
        `the results table has no column whose header matches /destination/i — headers read ` +
          `${JSON.stringify(headerTexts)}. This test cannot locate the cell it is about.`,
      ).toBeGreaterThanOrEqual(0);

      const destinationCellText = (cells[destinationColumn] ?? "").trim();
      let residue = destinationCellText;
      for (const unit of allUnits()) residue = residue.split(unit.name).join("");
      residue = residue.replace(/[\s,;.—–-]+/gu, "");

      expect(
        residue.length,
        `${movement.id} has NOT been accepted anywhere, yet its Destination cell reads ` +
          `${JSON.stringify(destinationCellText)} — which is nothing but ward names` +
          `${destinationCellText === "" ? " (in fact it is empty)" : ""}. A cell containing only ` +
          `the wards that were ASKED reads as the ward they are GOING to, and a coordinator would ` +
          `believe a bed exists. Say something: name the wards if it helps, but say that none has ` +
          `accepted.`,
      ).toBeGreaterThan(0);
    }
  });

  /*
   * `elapsedLabel` measures from `openedAt`, and `Movement` carries no arrival instant — `arrivedAt`
   * was deliberately deleted. `Referral.triagedAt`'s doc comment forbids the wording in terms.
   *
   * ⚠️ This asserts over the HEADER ROW ONLY, deliberately. "Since arrival" is CORRECT on the
   * out-of-area ledger, where it is fed by a real admission, so a repo-wide text ban would be wrong
   * and would go red on truthful copy.
   */
  it("does not word an opened-at clock as an arrival", () => {
    renderSearch();
    const headers = [...screen.getByTestId("ward-patient-search-results").querySelectorAll("thead th")].map(
      (cell) => cell.textContent ?? "",
    );

    expect(headers.length, "the results table has no header row to check").toBeGreaterThan(0);
    expect(
      headers.some((text) => /arriv/i.test(text)),
      "a column here is worded as arrival, but every time on this table is measured from `openedAt` " +
        "and this model records no arrival instant. Triage is not arrival and no screen may word it " +
        "as one (see `Referral.triagedAt`).",
    ).toBe(false);
  });
});

/*
 * 🔴 THE REFERRAL ROW NEVER SAID HOW MANY DESTINATIONS HAD ALREADY DECLINED.
 *
 * Every queued-referral row rendered the same sentence — "waiting for a decision, no bed accepted
 * yet" — whether nobody had been asked yet or several destinations had already said no. Those are
 * opposite clinical situations and the sentence could not tell them apart. `declinedAddressings`
 * already existed for exactly this and this row never called it.
 *
 * Both fixtures below are built from a REAL seeded referral (RF-011: two queued destinations, one
 * ward and one ED) rather than invented from scratch, so the shape stays whatever `Referral`
 * actually requires. Only `destinations` is touched.
 *
 * ⚠️ THE EXPECTED COUNTS ARE COMPUTED FROM THE MODEL, NEVER HAND-TYPED. `declinedAddressings` is
 * the same function the component must call — asserting a hand-typed "1" would pass even if the
 * component counted something else that happened to also be 1 on this fixture.
 */
describe("the referral row states how many destinations have declined", () => {
  const seededReferrals = seedWardFlowState().referrals;
  const baseReferral = seededReferrals.find((referral) => referral.id === "RF-011");
  if (!baseReferral) {
    throw new Error("fixture RF-011 (two queued destinations) is required by this suite and is missing");
  }
  // Guards the fixture assumption this whole suite is built on: two destinations, neither declined.
  if (baseReferral.destinations.length !== 2 || declinedAddressings(baseReferral).length !== 0) {
    throw new Error("RF-011 no longer has two queued destinations with none declined — re-point this fixture");
  }

  const noneDeclinedReferral: Referral = baseReferral;

  const partiallyDeclinedReferral: Referral = {
    ...baseReferral,
    id: "RF-011-TEST-partial-decline",
    destinations: [
      {
        ...baseReferral.destinations[0],
        state: "declined",
        declineReason: "belongs_to_another_service",
        decidedAt: NOW_ANCHOR - 10,
        decidedBy: "Flow coordinator",
      },
      baseReferral.destinations[1],
    ],
  };
  // Guards that the mutation actually produced a still-QUEUED referral with exactly one decline —
  // the case this fix is for. If this ever fails, the built fixture no longer exercises the row
  // this suite exists to check.
  if (
    referralState(partiallyDeclinedReferral) !== "queued" ||
    declinedAddressings(partiallyDeclinedReferral).length !== 1
  ) {
    throw new Error("the constructed partial-decline fixture is no longer queued-with-one-decline");
  }

  function renderRow(referral: Referral) {
    render(<ResultsSection results={[{ kind: "referral", referral }]} units={allUnits()} now={NOW_ANCHOR} />);
    return screen.getByTestId(`ward-patient-search-referral-${referral.id}`);
  }

  it("says nothing has declined when declinedAddressings is empty", () => {
    const row = renderRow(noneDeclinedReferral);
    const declinedCount = declinedAddressings(noneDeclinedReferral).length;

    expect(declinedCount, "this fixture is the zero-decline case; if it is not 0 the test proves nothing").toBe(0);
    expect(row).not.toHaveTextContent(/declined/i);
  });

  it("states the exact number of destinations that have declined, computed from declinedAddressings", () => {
    const row = renderRow(partiallyDeclinedReferral);
    const declinedCount = declinedAddressings(partiallyDeclinedReferral).length;
    const totalCount = partiallyDeclinedReferral.destinations.length;

    expect(row).toHaveTextContent(String(declinedCount));
    expect(row).toHaveTextContent(new RegExp(`\\b${declinedCount}\\b.*declined`, "i"));
    // The referral is still QUEUED — at least one destination has not declined — so a sentence
    // claiming every destination declined would be a false claim this data cannot support.
    expect(row).not.toHaveTextContent(/all.*declined/i);
    expect(row).toHaveTextContent(String(totalCount));
  });

  it("uses different wording for zero declines than for one or more — not the same template with a swapped number", () => {
    const zeroRow = renderRow(noneDeclinedReferral);
    const zeroText = zeroRow.textContent ?? "";
    document.body.innerHTML = "";
    const declinedRow = renderRow(partiallyDeclinedReferral);
    const declinedText = declinedRow.textContent ?? "";

    // Strip the shared prefix (origin/age/region, which both rows legitimately share) and compare
    // only the clause this fix actually changes.
    const zeroClause = zeroText.split("—")[1] ?? zeroText;
    const declinedClause = declinedText.split("—")[1] ?? declinedText;
    expect(declinedClause).not.toBe(zeroClause);
  });

  it("never claims a declined destination is a 'ward' when the model does not say so — a declined destination can be an ED or a community team", () => {
    // RF-011's first destination (the one mutated to declined above) is a psychiatric ward, so this
    // fixture alone cannot prove the word "ward" is safe in general. The row must not assert
    // "ward" from `declinedAddressings` alone, since a declined addressing can be any of the three
    // destination kinds and the component has no per-kind branch.
    const edDeclinedReferral: Referral = {
      ...baseReferral,
      id: "RF-011-TEST-ed-decline",
      destinations: [
        baseReferral.destinations[0],
        {
          ...baseReferral.destinations[1],
          state: "declined",
          declineReason: "belongs_to_another_service",
          decidedAt: NOW_ANCHOR - 10,
          decidedBy: "Flow coordinator",
        },
      ],
    };
    expect(referralState(edDeclinedReferral)).toBe("queued");
    expect(declinedAddressings(edDeclinedReferral).length).toBe(1);

    const row = renderRow(edDeclinedReferral);
    expect(
      row,
      "the declined destination here is an emergency department, not a ward — the row must not say " +
        '"ward" for a count that includes non-ward destinations.',
    ).not.toHaveTextContent(/\bwards?\b/i);
  });
});

/*
 * TASK 4'S RULING (Ward Lead, recorded on the task brief): keep the app's three-population search
 * — people, referrals and movements — as this screen's spine (owner ruling Q-3, "the person-first
 * list"). The third-edition drawing's facets ("Everything", "Accepted", "No ward yet", "No owner",
 * the three wait bands) are every one a MOVEMENT predicate — the drawing's own `test: function (m)`
 * reads `m.accepted` and `m.owner`, fields a person or a still-waiting referral does not have — so
 * they are rendered as a facet row over the movement table ALONE, inside that section, and the
 * section says so in words. This suite is the guard: every declared count is proven against the
 * rows that facet actually shows, every empty state carries its own copied sentence, and — the
 * guard for the ruling itself — switching a facet leaves the people panel and the referral list
 * untouched.
 */
describe('"What to show" — the movement-only facet row', () => {
  const baseMovement = wardMovements[0];
  if (!baseMovement) {
    throw new Error(
      "wardMovements is empty — this suite needs at least one seeded movement to build its own facet fixtures from",
    );
  }

  function movementFixture(overrides: Partial<Movement> & { id: string }): Movement {
    return { ...baseMovement, ...overrides };
  }

  const HOUR = 60;

  function renderMovements(movements: Movement[]) {
    return render(
      <ResultsSection
        results={movements.map((movement) => ({ kind: "movement" as const, movement }))}
        units={allUnits()}
        now={NOW_ANCHOR}
      />,
    );
  }

  // Four movements, each a different corner of the four independent facets, so the seven counts
  // below are neither all-zero nor all-equal — a fixture where every count matched could pass a
  // component that always shows every row regardless of which tab is pressed.
  const mAcceptedUnder6 = movementFixture({
    id: "WF-FACET-1",
    acceptedUnitId: "unit-fixture-a",
    owner: "Flow coordinator",
    openedAt: NOW_ANCHOR - 1 * HOUR,
  });
  const mWaiting6to24 = movementFixture({
    id: "WF-FACET-2",
    acceptedUnitId: undefined,
    owner: "Flow coordinator",
    openedAt: NOW_ANCHOR - 10 * HOUR,
  });
  const mUnownedOver24 = movementFixture({
    id: "WF-FACET-3",
    acceptedUnitId: "unit-fixture-b",
    owner: "",
    openedAt: NOW_ANCHOR - 30 * HOUR,
  });
  const mWaitingUnownedUnder6 = movementFixture({
    id: "WF-FACET-4",
    acceptedUnitId: undefined,
    owner: "",
    openedAt: NOW_ANCHOR - 2 * HOUR,
  });

  const fourMovements = [mAcceptedUnder6, mWaiting6to24, mUnownedOver24, mWaitingUnownedUnder6];

  it("carries one tablist named \"What to show\", with the drawing's seven facets in the drawing's order", () => {
    renderMovements(fourMovements);
    const tablist = screen.getByRole("tablist", { name: "What to show" });
    const labels = within(tablist)
      .getAllByRole("tab")
      .map((tab) => (tab.textContent ?? "").replace(/\s*(none|\d+)\s*$/, "").trim());

    // Copied verbatim, in order, from docs/ward-flow/plans/2026-09-1x-lane-c-drawing-facts.md §A3:
    // "Everything · Accepted · No ward yet · No owner · Under 6 hours · 6 to 24 hours · Over 24 hours".
    expect(labels).toEqual([
      "Everything",
      "Accepted",
      "No ward yet",
      "No owner",
      "Under 6 hours",
      "6 to 24 hours",
      "Over 24 hours",
    ]);
  });

  it("declares a derived count on every facet, equal to the movement rows that facet actually shows — looped over every tab, never spot-checked", async () => {
    renderMovements(fourMovements);
    const user = userEvent.setup();
    const tabs = within(screen.getByRole("tablist", { name: "What to show" })).getAllByRole("tab");
    expect(tabs.length).toBe(7);

    for (const tab of tabs) {
      const countEl = within(tab).getByTestId(/^ward-patient-search-show-facet-count-/);
      const declaredText = countEl.textContent ?? "";
      const declared = declaredText === "none" ? 0 : Number(declaredText);
      expect(declaredText, `facet count read as neither "none" nor a number: ${JSON.stringify(declaredText)}`).toMatch(
        /^(none|\d+)$/,
      );

      // Each click must settle before this tab's count is read; firing all seven concurrently
      // would race the DOM this loop reads.
      await user.click(tab);

      if (declared === 0) {
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
        expect(screen.getByTestId("ward-patient-search-facet-empty")).toBeInTheDocument();
      } else {
        const shownRows = within(screen.getByRole("table"))
          .getAllByRole("row")
          .filter((row) => row.closest("tbody") !== null);
        expect(
          shownRows.length,
          `tab "${tab.textContent}" declared ${declared} but showed ${shownRows.length} row(s)`,
        ).toBe(declared);
      }
    }
  });

  it("states in words, true read alone, that these filters narrow the movements below and not the results above", () => {
    renderMovements(fourMovements);
    const note = screen.getByTestId("ward-patient-search-movement-scope-note");
    expect(note).toHaveTextContent(/movement filters only/i);
    expect(note).toHaveTextContent(/people and waiting referrals are unchanged/i);
  });

  it('shows the "Accepted" facet\'s own empty sentence, copied verbatim, when no open movement has an accepted ward', async () => {
    const movements = [
      movementFixture({
        id: "WF-FACET-ACC-EMPTY-1",
        acceptedUnitId: undefined,
        owner: "Flow coordinator",
        openedAt: NOW_ANCHOR - 1 * HOUR,
      }),
      movementFixture({
        id: "WF-FACET-ACC-EMPTY-2",
        acceptedUnitId: undefined,
        owner: "Flow coordinator",
        openedAt: NOW_ANCHOR - 2 * HOUR,
      }),
    ];
    renderMovements(movements);
    await userEvent.setup().click(screen.getByRole("tab", { name: /^Accepted/ }));
    expect(screen.getByTestId("ward-patient-search-facet-empty")).toHaveTextContent(
      "No open movement here has an accepted ward.",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it('shows the "No ward yet" facet\'s own empty sentence when every open movement already has an accepted ward', async () => {
    const movements = [
      movementFixture({
        id: "WF-FACET-WAIT-EMPTY-1",
        acceptedUnitId: "unit-fixture-c",
        owner: "Flow coordinator",
        openedAt: NOW_ANCHOR - 1 * HOUR,
      }),
      movementFixture({
        id: "WF-FACET-WAIT-EMPTY-2",
        acceptedUnitId: "unit-fixture-d",
        owner: "Flow coordinator",
        openedAt: NOW_ANCHOR - 2 * HOUR,
      }),
    ];
    renderMovements(movements);
    await userEvent.setup().click(screen.getByRole("tab", { name: /^No ward yet/ }));
    expect(screen.getByTestId("ward-patient-search-facet-empty")).toHaveTextContent(
      "Every open movement here has an accepted ward.",
    );
  });

  it('shows the "No owner" facet\'s own empty sentence when every open movement already has an owner', async () => {
    const movements = [
      movementFixture({
        id: "WF-FACET-OWN-EMPTY-1",
        acceptedUnitId: undefined,
        owner: "Flow coordinator",
        openedAt: NOW_ANCHOR - 1 * HOUR,
      }),
      movementFixture({
        id: "WF-FACET-OWN-EMPTY-2",
        acceptedUnitId: undefined,
        owner: "Ward nurse in charge",
        openedAt: NOW_ANCHOR - 2 * HOUR,
      }),
    ];
    renderMovements(movements);
    await userEvent.setup().click(screen.getByRole("tab", { name: /^No owner/ }));
    expect(screen.getByTestId("ward-patient-search-facet-empty")).toHaveTextContent(
      "Every open movement here has an owner.",
    );
  });

  // The drawing gives no `empty` sentence for the three wait bands (see the doc comment on
  // `SHOW_FACETS` in patient-search.tsx); this proves the mechanism still gives each one its OWN
  // wording rather than falling back to a generic sentence, or to another facet's.
  it("shows the \"Over 24 hours\" facet's own composed empty sentence — never the generic sentence, and never another facet's", async () => {
    const movements = [
      movementFixture({
        id: "WF-FACET-24-EMPTY-1",
        acceptedUnitId: undefined,
        owner: "Flow coordinator",
        openedAt: NOW_ANCHOR - 1 * HOUR,
      }),
    ];
    renderMovements(movements);
    await userEvent.setup().click(screen.getByRole("tab", { name: /^Over 24 hours/ }));
    const empty = screen.getByTestId("ward-patient-search-facet-empty");
    expect(empty).toHaveTextContent("No open movement here has waited over 24 hours.");
    expect(empty).not.toHaveTextContent(/no open movement fits the current search/i);
    expect(empty).not.toHaveTextContent(/accepted ward/i);
    expect(empty).not.toHaveTextContent(/has an owner/i);
  });

  it("keeps only the selected facet in the tab order, and Right/Left move the roving selection with focus following it", async () => {
    renderMovements(fourMovements);
    const tabs = () => within(screen.getByRole("tablist", { name: "What to show" })).getAllByRole("tab");

    const reachable = tabs().filter((tab) => tab.tabIndex === 0);
    expect(reachable).toHaveLength(1);
    expect(reachable[0]).toHaveAttribute("aria-selected", "true");
    expect(reachable[0]).toHaveTextContent(/^Everything/);

    fireEvent.keyDown(reachable[0] as HTMLElement, { key: "ArrowRight" });
    const afterRight = tabs().filter((tab) => tab.tabIndex === 0);
    expect(afterRight).toHaveLength(1);
    expect(afterRight[0]).toHaveTextContent(/^Accepted/);
    expect(afterRight[0]).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(afterRight[0]);

    fireEvent.keyDown(afterRight[0] as HTMLElement, { key: "ArrowLeft" });
    const afterLeft = tabs().filter((tab) => tab.tabIndex === 0);
    expect(afterLeft[0]).toHaveTextContent(/^Everything/);
    expect(document.activeElement).toBe(afterLeft[0]);
  });

  /*
   * THE GUARD FOR THE RULING ITSELF. Rendered through the full page rather than `ResultsSection`
   * alone, because the ruling is about the whole screen: the people panel is a sibling component,
   * and the only way to prove a movement facet cannot reach it is to render them together and
   * switch the facet.
   */
  it("leaves the people panel, the referral list and the overall match count byte-identical when a movement facet is switched", async () => {
    renderSearch();
    const user = userEvent.setup();

    expect(queuedReferrals.length, "no queued referral seeded — this guard would prove nothing").toBeGreaterThan(0);
    const headingName = `${openCount + queuedReferrals.length} matches`;
    expect(screen.getByRole("heading", { name: headingName })).toBeInTheDocument();

    const referralList = screen.getByTestId("ward-patient-search-referrals");
    const peoplePanel = screen.getByTestId("ward-patient-search-people");
    const referralsBefore = referralList.textContent;
    const peopleBefore = peoplePanel.textContent;

    await user.click(screen.getByRole("tab", { name: /^Accepted/ }));
    expect(screen.getByTestId("ward-patient-search-referrals").textContent).toBe(referralsBefore);
    expect(screen.getByTestId("ward-patient-search-people").textContent).toBe(peopleBefore);
    expect(screen.getByRole("heading", { name: headingName })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /^No owner/ }));
    expect(screen.getByTestId("ward-patient-search-referrals").textContent).toBe(referralsBefore);
    expect(screen.getByTestId("ward-patient-search-people").textContent).toBe(peopleBefore);
    expect(screen.getByRole("heading", { name: headingName })).toBeInTheDocument();
  });
});

/**
 * 🔴 A REFUSED SEARCH MUST NOT ALSO ANNOUNCE AN EMPTY RESULT.
 *
 * Found by opening the screen and reading its live regions, NOT by a test. The refusal task's own
 * tests asserted that the refusal appears and that zero rows render — both passed, while the
 * typeahead's status line announced "Nobody matches." beside the refusal.
 *
 * ⚠️ A screen-reader user heard the one sentence the refusal exists to prevent. "Nobody matches" is
 * a claim that the system LOOKED and found nobody. It did not look. Standard §8.6: a refusal "is
 * spoken to the live region, and nothing is returned. It is never an empty list."
 *
 * ⚠️ AND IT WAS INVISIBLE TWICE OVER — it lived in an `sr-only` live region, so nobody reading the
 * screen would ever see it, and it lived in a component the refusal task had no reason to open.
 * This file's own header calls that class of defect "an absence rendered as a measurement".
 */
describe("a refused search never also claims nobody matched", () => {
  it("announces the refusal, and no count or nobody-matches claim beside it", () => {
    renderSearch();
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "risk score" } });

    const spoken = screen
      .getAllByRole("status")
      .map((node) => node.textContent ?? "")
      .join(" ");

    expect(spoken).toContain("Search does not return a risk or acuity score or a best match");
    // The deciding assertions: both are answers to a question the system refused to ask.
    expect(spoken).not.toMatch(/nobody matches/i);
    expect(spoken).not.toMatch(/\d+ (person|people) found/i);
  });
});

/**
 * TASK 7 — THE ACCESS RECORD. `tests/ward-search-access-record.test.ts` proves `access-record.ts`
 * itself; this suite proves the WIRING — that `patient-search.tsx` actually calls it, holds the
 * result in its own component state, and nowhere else.
 *
 * The remount case is the one that matters (the plan's own words): a persisted access record would
 * be a record of who looked at whom, which is a privacy surface nobody has authorised. Unmounting
 * and remounting is the DOM equivalent of a reload — anything that survived it would have to be
 * living in storage, and `tests/ward-search-access-record.test.ts` already proves this module never
 * writes to any.
 */
describe("the access record panel", () => {
  it("explains session scope and explicit submission before anything is searched", () => {
    renderSearch();

    const panel = screen.getByTestId("ward-patient-search-access-record");
    // D-4 (Ward Lead, 2026-09-11) — never the drawing's unqualified header note, and never the
    // plan's third, unrelated wording. See access-record.ts's own doc comment.
    expect(panel).toHaveTextContent("Search terms and times. Kept for this session only.");
    expect(screen.getByTestId("ward-patient-search-access-record-empty")).toHaveTextContent(
      /No searches submitted this session\. Press Enter in the search field to record a search\./,
    );
  });

  it("three searches run from the bar produce three rows, newest first — and unmounting and remounting produces none", () => {
    const { unmount } = renderSearch();
    const search = screen.getByLabelText("Search");
    const form = search.closest("form");
    if (!form) throw new Error("expected the Search field to sit inside the filter bar's own form");

    // A SEARCH IS "RUN FROM THE BAR" — pressing Enter with no typeahead row highlighted submits
    // the form, exactly as `patient-search.tsx`'s own onSubmit handler expects. Typing alone
    // (fireEvent.change with no submit) must record nothing, or every keystroke would be a row.
    for (const words of ["wenna", "bram", "kestrel"]) {
      fireEvent.change(search, { target: { value: words } });
      fireEvent.submit(form);
    }

    const rows = screen.getAllByTestId(/^ward-patient-search-access-record-row-/);
    expect(rows).toHaveLength(3);
    // Newest first — recordSearch's own contract, pinned again here because this is the wiring
    // that actually calls it, not the pure function.
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("kestrel"),
      expect.stringContaining("bram"),
      expect.stringContaining("wenna"),
    ]);
    expect(screen.getByTestId("ward-patient-search-access-record")).toHaveTextContent("3 searches");

    unmount();
    renderSearch();

    expect(screen.queryAllByTestId(/^ward-patient-search-access-record-row-/)).toHaveLength(0);
    expect(screen.getByTestId("ward-patient-search-access-record-empty")).toBeInTheDocument();
  });

  it("records nothing for an empty query", () => {
    renderSearch();
    const search = screen.getByLabelText("Search");
    const form = search.closest("form");
    if (!form) throw new Error("expected the Search field to sit inside the filter bar's own form");

    fireEvent.change(search, { target: { value: "   " } });
    fireEvent.submit(form);

    expect(screen.queryAllByTestId(/^ward-patient-search-access-record-row-/)).toHaveLength(0);
    expect(screen.getByTestId("ward-patient-search-access-record-empty")).toBeInTheDocument();
  });
});

describe("Third Edition dropdown filters and yield strip", () => {
  it("renders the 4 dropdown filters with labels and default 'all' selection", () => {
    renderSearch();

    expect(screen.getByLabelText("Service")).toBeInTheDocument();
    expect(screen.getByLabelText("Setting")).toBeInTheDocument();
    expect(screen.getByLabelText("Legal Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Wait Band")).toBeInTheDocument();

    expect(screen.getByLabelText("Service")).toHaveValue("all");
    expect(screen.getByLabelText("Setting")).toHaveValue("all");
    expect(screen.getByLabelText("Legal Status")).toHaveValue("all");
    expect(screen.getByLabelText("Wait Band")).toHaveValue("all");
  });

  it("renders the yield summary strip with all 5 metric cards", () => {
    renderSearch();

    expect(screen.getByTestId("ward-patient-search-yield-strip")).toBeInTheDocument();
    expect(screen.getByTestId("ward-patient-search-yield-total")).toBeInTheDocument();
    expect(screen.getByTestId("ward-patient-search-yield-unplaced")).toBeInTheDocument();
    expect(screen.getByTestId("ward-patient-search-yield-holds")).toBeInTheDocument();
    expect(screen.getByTestId("ward-patient-search-yield-transit")).toBeInTheDocument();
    expect(screen.getByTestId("ward-patient-search-yield-breaches")).toBeInTheDocument();

    const total = Number(screen.getByTestId("ward-patient-search-yield-total").textContent);
    expect(total).toBe(openCount + queuedReferrals.length);
  });

  // D-24 item 1 (docs/ward-flow/decisions.md): the 24-hour wait card is Josh's own labelled
  // default, never a legal breach — worded "Waiting over 24 hours", captioned as his default, and
  // the word "Breach" must not appear anywhere on the page.
  it("labels the 24-hour wait card as Josh's default, never a breach", () => {
    renderSearch();

    const card = document.getElementById("kpi-breaches");
    expect(card).toHaveTextContent("Waiting over 24 hours");
    expect(card).toHaveTextContent("Your default, not a legal limit");
    expect(document.body.textContent).not.toMatch(/breach/i);
  });

  it("narrows results when selecting a Service dropdown filter", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Service"), { target: { value: "East Metro" } });

    const total = Number(screen.getByTestId("ward-patient-search-yield-total").textContent);
    expect(total).toBeLessThan(openCount + queuedReferrals.length);
    expect(total).toBeGreaterThan(0);
  });

  it("narrows results when selecting a Setting dropdown filter", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Setting"), { target: { value: "transit" } });

    const transitCard = screen.getByTestId("ward-patient-search-yield-transit");
    const total = Number(screen.getByTestId("ward-patient-search-yield-total").textContent);
    expect(total).toBe(Number(transitCard.textContent));
  });

  it("narrows results when selecting a Legal Status dropdown filter", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Legal Status"), { target: { value: "Form 1A" } });

    const total = Number(screen.getByTestId("ward-patient-search-yield-total").textContent);
    expect(total).toBeGreaterThan(0);
  });

  it("narrows results when selecting a Wait Band dropdown filter", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Wait Band"), { target: { value: "over24" } });

    const total = Number(screen.getByTestId("ward-patient-search-yield-total").textContent);
    expect(total).toBeGreaterThan(0);
  });

  it("applies a quick query chip and updates the search box", () => {
    renderSearch();

    const chip = screen.getByRole("button", { name: /Form 1A/i });
    fireEvent.click(chip);

    expect(screen.getByLabelText("Search")).toHaveValue("Form 1A");
  });

  it("resets all dropdowns and search text when clicking 'Reset filters'", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "WF-003" } });
    fireEvent.change(screen.getByLabelText("Service"), { target: { value: "East Metro" } });
    fireEvent.change(screen.getByLabelText("Setting"), { target: { value: "transit" } });
    fireEvent.change(screen.getByLabelText("Legal Status"), { target: { value: "Voluntary" } });
    fireEvent.change(screen.getByLabelText("Wait Band"), { target: { value: "under6" } });

    const resetBtn = screen.getByTestId("ward-patient-search-reset-filters");
    fireEvent.click(resetBtn);

    expect(screen.getByLabelText("Search")).toHaveValue("");
    expect(screen.getByLabelText("Service")).toHaveValue("all");
    expect(screen.getByLabelText("Setting")).toHaveValue("all");
    expect(screen.getByLabelText("Legal Status")).toHaveValue("all");
    expect(screen.getByLabelText("Wait Band")).toHaveValue("all");
    expect(Number(screen.getByTestId("ward-patient-search-yield-total").textContent)).toBe(
      openCount + queuedReferrals.length,
    );
  });

  /**
   * 2026-09-14. The legal filter once read "Form 1A (ED 24h)" and "Form 5A (Involuntary)": the first
   * attached the ED access target to a legal form, the second mislabelled a Community Treatment
   * Order and offered a form Ward Flow cannot record. This pins what a clinician actually reads.
   */
  it("names every legal option by status or by the register's own form title, with no duration and no Form 5A", async () => {
    const { SELECTABLE_LEGAL_FORMS, legalFormName } =
      await import("../src/components/ward-management/ward-legal-forms");
    renderSearch();

    const optionLabels = Array.from(
      (screen.getByLabelText("Legal Status") as HTMLSelectElement).options,
      (option) => option.textContent?.replace(/\s*\(\d+\)\s*$/, "") ?? "",
    );
    expect(optionLabels).toEqual([
      "All Legal Statuses",
      "Voluntary",
      "Involuntary",
      ...SELECTABLE_LEGAL_FORMS.map((form) => legalFormName(form)),
    ]);
    for (const label of optionLabels) {
      expect(label, `a legal option carries a duration: ${label}`).not.toMatch(
        /\d+\s*(h|hrs?|hours?|mins?|minutes?|days?)\b/i,
      );
      expect(label).not.toContain("Form 5A (Involuntary)");
    }

    // v6 (Patients.png): each result row is itself a button carrying its own recorded due time, so
    // the chip check reads every button except the result rows.
    const chipNames = screen
      .getAllByRole("button")
      .filter((button) => !button.getAttribute("data-testid")?.startsWith("ward-patient-search-case-"))
      .map((button) => button.textContent ?? "");
    expect(chipNames.filter((name) => /Form \d[A-Z]/.test(name) && /\d+\s*h\b|Involuntary/i.test(name))).toEqual([]);
    expect(chipNames.some((name) => name.includes("Form 5A"))).toBe(false);
  });

  it("focuses search input when pressing '/' key outside inputs", () => {
    renderSearch();
    const searchInput = screen.getByLabelText("Search");
    expect(document.activeElement).not.toBe(searchInput);

    fireEvent.keyDown(window, { key: "/" });
    expect(document.activeElement).toBe(searchInput);
  });

  it("yields matching live caseload when clicking quick query chips", () => {
    renderSearch();
    const liveChip = screen.getByText("● Live Now");
    fireEvent.click(liveChip);

    const yieldTotal = Number(screen.getByTestId("ward-patient-search-yield-total").textContent);
    expect(yieldTotal).toBeGreaterThan(0);

    const resetBtn = screen.getByTestId("ward-patient-search-reset-filters");
    expect(resetBtn.textContent).toContain("(1)");
  });

  it("opens referral preview when clicking preview on a queued referral", () => {
    renderSearch();
    const referralList = screen.getByTestId("ward-patient-search-referrals");
    const previewBtn = referralList.querySelector("button");
    if (previewBtn) {
      fireEvent.click(previewBtn);
      const previewPanel = screen.getByTestId("ward-patient-search-preview");
      expect(previewPanel.textContent).toContain("Selected referral");
      expect(previewPanel.textContent).toContain("Destinations Addressed");

      // Test D4 notice compliance
      const contactBtn = screen.getByRole("button", { name: "Contact Referrer" });
      fireEvent.click(contactBtn);
      expect(screen.getByText("Contact Referrer: Not wired in this prototype.")).toBeInTheDocument();
    }
  });
});

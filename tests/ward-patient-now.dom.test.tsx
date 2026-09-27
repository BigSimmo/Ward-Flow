import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { Fact, PersonScreen } from "@/components/ward-management/patients/person-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { PatientId } from "@/components/ward-management/ward-patients";

/**
 * TASK 9 — "Patient — the person now, and the verdict", AND WHY THIS FILE IS SMALLER THAN THAT
 * TITLE PROMISES.
 *
 * The task asked for three things on the Patient screen: (a) identity, every optional field shown
 * as a stated absence, gender's own D-6 wording included; (b) the person's CURRENT movement,
 * found through `referrals.patientId → movement.referralId`; (c) the eligibility verdict for that
 * movement, read through `eligibility()`/`candidateReason()` (`ward-eligibility.ts`).
 *
 * 🔴 **(b) AND (c) ARE NOT BUILT, AND IT IS A STOP-AND-HAND-BACK, NOT AN OMISSION.** Both need
 * `person-screen.tsx` to read `movements`, `referrals` and `units` from `useWardFlow()`. This
 * file's sibling, `tests/ward-person-screen.dom.test.tsx`, has a case titled *"AND THE SCREEN
 * CANNOT REACH REFERRALS AT ALL — the guard that survives the link landing"* that pins this
 * screen's `useWardFlow()` destructure to exactly `["patients", "dayZero", "now"]`, and its own
 * failure message reads: *"showing a person's referrals, movements or destinations here is the
 * exact 'helpful' addition the ledger warns a later reader will make. Take it to the owner before
 * widening this list."* Building (b)/(c) needs exactly that widening. This task's own files list
 * bars weakening any case in that test file, and its own closing instruction is to stop and hand
 * back a decision the brief does not cover rather than choose one — so the movement/verdict half
 * is handed back rather than built around, or built by finding some other path to the same state
 * that the guard's checked file does not happen to cover. `person-screen.tsx`'s own header comment
 * (the paragraph beginning "THE THIRD-EDITION DRAWING'S 'THE PERSON NOW' PANEL ALSO SHOWS…")
 * records the same finding at the point a future reader will actually meet it.
 *
 * So this file proves the part that IS built: (a), specifically the two absence wordings D-6
 * requires, which the previous build of this screen did not yet carry (it showed `Sex` only —
 * `Gender` was not rendered at all).
 */
describe("the person now — identity absences (D-6)", () => {
  function renderPerson(id: PatientId) {
    return render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PersonScreen patientId={id} />
      </WardFlowProvider>,
    );
  }

  // `Fact` proved directly, without needing a seeded fixture for every branch — the real seed
  // (`ward-patients-seed.ts`) has exactly one patient with any optional field unset (PT-007,
  // missing `gender`), so a DOM-only test could prove gender's own absence wording but nothing
  // about the other nine's default, which nothing in the seed exercises.
  describe("Fact's two absence wordings", () => {
    it("defaults to the flat 'Not recorded' when no absentLabel is given — the nine ordinary fields", () => {
      render(<Fact label="Suburb" value={undefined} />);
      expect(screen.getByText("Not recorded")).toBeInTheDocument();
    });

    it("renders the caller's own wording when one is given — gender's 'Not yet recorded' (D-6)", () => {
      render(<Fact label="Gender" value={undefined} absentLabel="Not yet recorded" />);
      expect(screen.getByText("Not yet recorded")).toBeInTheDocument();
      // The two forms are not synonyms (D-6) — asserted as an absence of the OTHER wording, not
      // merely the presence of this one, so a component that rendered both strings at once would
      // still fail here.
      expect(screen.queryByText("Not recorded")).not.toBeInTheDocument();
    });

    it("renders the recorded value, never an absence wording, once a value is present", () => {
      render(<Fact label="Gender" value="Female" absentLabel="Not yet recorded" />);
      expect(screen.getByText("Female")).toBeInTheDocument();
      expect(screen.queryByText(/not.*recorded/i)).not.toBeInTheDocument();
    });
  });

  describe("on the real screen", () => {
    const withoutGender = seedWardFlowState().patients.find((patient) => patient.gender === undefined);
    const withGender = seedWardFlowState().patients.find((patient) => patient.gender !== undefined);

    it("has a seeded person on each side of the gender split, or the two cases below are vacuous", () => {
      expect(withoutGender, "no seeded person has an unrecorded gender").toBeDefined();
      expect(withGender, "no seeded person has a recorded gender").toBeDefined();
    });

    it("an unrecorded gender reads 'Not yet recorded', matching the model's own comment and the gate's own detail sentence", () => {
      renderPerson(withoutGender!.id);
      const placement = within(screen.getByTestId("ward-person-placement-details"));
      expect(placement.getByText("Gender")).toBeInTheDocument();
      expect(placement.getByText("Not yet recorded")).toBeInTheDocument();
      // The other eight optional fields this seeded person DOES carry must still read their own
      // recorded values, not be swept into the same wording — proving the override is scoped to
      // gender alone rather than applied panel-wide.
      expect(placement.queryByText("Not recorded")).not.toBeInTheDocument();
    });

    it("a recorded gender shows the value itself, and the screen states no bed claim about it", () => {
      renderPerson(withGender!.id);
      const placement = within(screen.getByTestId("ward-person-placement-details"));
      // Scoped to the Gender row specifically, not a bare text search — `sex` and `gender` are
      // deliberately allowed to hold the same literal value (PT-001 does), so a search for the
      // value alone would pass whether or not the Gender row itself rendered it.
      const genderRow = placement.getByText("Gender").closest("div");
      expect(genderRow).not.toBeNull();
      expect(within(genderRow!).getByText(withGender!.gender!)).toBeInTheDocument();
      expect(placement.queryByText("Not yet recorded")).not.toBeInTheDocument();
      // Owner ruling: gender decides the bed, but that gate is not wired into the live verdict
      // pipeline (`genderEligibility`'s own doc comment). This screen must never say or imply a
      // bed decision follows from the fact it states.
      const shown = screen.getByTestId("ward-person-screen").textContent ?? "";
      expect(shown).not.toMatch(/gender.{0,40}(decides|determines|accepts|matches).{0,20}bed/i);
    });
  });
});

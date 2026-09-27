import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same mock as tests/ward-screen.dom.test.tsx: `ClinicalRail` renders next/link anchors and this
// suite never checks routing itself, so a plain <a> avoids requiring an App Router context jsdom
// cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { leaveBeds } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Owner ruling (Josh, 26 Sept 2026, "go ahead with all your recommendations"): the Beds tab must
 * show "On Leave" only for people who actually have a leave record on this ward, and its bed
 * numbers are positions, not records.
 *
 * The bug this suite pins: `bedsList` (ward-screen.tsx) used to place occupants into numbered
 * beds strictly BY POSITION, so whichever occupied admission happened to come first filled the
 * "On Leave" slot — never the admission the ward's own leave record actually names. On
 * `rph-adult-secure` ("Ward 2K") this showed a confirmed discharge (AD-RPHS-01, "Alaric
 * Ferrowmoor") as "On Leave", while the real leave record (`WL-001`, admission `AD-RPHS-11`,
 * Luke Daviecroft) rendered as an ordinary "Inpatient" bed instead.
 *
 * `ExposeWardFlowFacts` reads the real leave records and resolves each one's patient name through
 * the SAME `resolvePatientIdentity` the screen itself uses — so this suite never hardcodes a
 * display name, only the stable, hand-authored fixture id `AD-RPHS-11` (`ward-movements.ts`'s own
 * comment: "Luke Daviecroft (PT-036) is on leave from Ward 2K").
 */
function ExposeWardFlowFacts({ unitId }: { unitId: string }) {
  const { leaveBeds: liveLeaveBeds, admissions, resolvePatientIdentity } = useWardFlow();
  const unitLeave = liveLeaveBeds.filter((bed) => bed.unitId === unitId);
  return (
    <div data-testid="expose-ward-flow-facts" style={{ display: "none" }}>
      {unitLeave.map((leaveBed) => {
        const admission = admissions.find((a) => a.id === leaveBed.admissionId);
        const name = admission ? resolvePatientIdentity(admission).displayName : undefined;
        return (
          <span key={leaveBed.id} data-testid={`expected-leave-name-${leaveBed.id}`}>
            {name ?? "NO MATCHING ADMISSION"}
          </span>
        );
      })}
    </div>
  );
}

const RPH_ADULT_SECURE = "rph-adult-secure";
// `ward-movements.ts`'s own seed comment: "Luke Daviecroft (PT-036) is on leave from Ward 2K."
const LUKE_DAVIECROFT_ADMISSION_ID = "AD-RPHS-11";

describe("ward screen Beds tab places On Leave from the ward's leave records, not by position", () => {
  it("fixture assumption: rph-adult-secure carries at least one real leave record", () => {
    const unitLeave = leaveBeds.filter((bed) => bed.unitId === RPH_ADULT_SECURE);
    expect(unitLeave.length).toBeGreaterThan(0);
    expect(unitLeave.some((bed) => bed.admissionId === LUKE_DAVIECROFT_ADMISSION_ID)).toBe(true);
  });

  it("(a) every 'On Leave' bed shows a person whose admission has a leave record on this ward, and (b) the number of 'On Leave' beds equals the ward's leave records", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ExposeWardFlowFacts unitId={RPH_ADULT_SECURE} />
        <WardScreen unitId={RPH_ADULT_SECURE} />
      </WardFlowProvider>,
    );

    const unitLeave = leaveBeds.filter((bed) => bed.unitId === RPH_ADULT_SECURE);
    const expectedNames = unitLeave.map(
      (leaveBed) => screen.getByTestId(`expected-leave-name-${leaveBed.id}`).textContent,
    );
    // Anti-vacuity: a leave record that failed to resolve to any admission would let every
    // assertion below pass on an empty or garbage name.
    for (const name of expectedNames) {
      expect(name, "every leave record must resolve to a real admitted patient").not.toBe("NO MATCHING ADMISSION");
    }

    const bedsTab = document.getElementById("tab-beds")!;
    const leaveCards = within(bedsTab).getAllByRole("button", { name: /\bOn Leave\b/ });

    // (b) the count of "On Leave" beds is exactly the ward's own leave-record count — never
    // hard-coded to one, so this still holds if the fixture ever carries more than one.
    expect(leaveCards).toHaveLength(unitLeave.length);

    // (a) every "On Leave" card names somebody who actually holds one of this ward's leave
    // records — never an occupant standing in by position.
    for (const card of leaveCards) {
      const label = card.getAttribute("aria-label") ?? "";
      expect(expectedNames.some((name) => name && label.includes(name))).toBe(true);
    }
  });

  it("(c) the person with the leave record is never also shown as Inpatient", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ExposeWardFlowFacts unitId={RPH_ADULT_SECURE} />
        <WardScreen unitId={RPH_ADULT_SECURE} />
      </WardFlowProvider>,
    );

    const lukeName = screen.getByTestId(`expected-leave-name-WL-001`).textContent;
    expect(lukeName).not.toBe("NO MATCHING ADMISSION");

    const bedsTab = document.getElementById("tab-beds")!;
    const inpatientCards = within(bedsTab).getAllByRole("button", { name: /\bInpatient\b/ });
    const lukeShownAsInpatient = inpatientCards.some((card) =>
      (card.getAttribute("aria-label") ?? "").includes(lukeName!),
    );
    expect(lukeShownAsInpatient).toBe(false);

    // And the reverse of (a)/(b) above, restated concretely for this one named record: Luke's own
    // bed card reads "On Leave", not something else.
    const leaveCards = within(bedsTab).getAllByRole("button", { name: /\bOn Leave\b/ });
    expect(leaveCards.some((card) => (card.getAttribute("aria-label") ?? "").includes(lukeName!))).toBe(true);
  });

  it("(d) the Beds tab carries a caption saying its bed numbers are positions, not records", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={RPH_ADULT_SECURE} />
      </WardFlowProvider>,
    );

    const bedsTab = document.getElementById("tab-beds")!;
    const caption = within(bedsTab).getByTestId("ward-beds-position-caption");
    expect(caption).toHaveTextContent(/position/i);
    expect(caption).toHaveTextContent(/no bed number is recorded/i);
  });

  /**
   * Bonus regression, same fix: an incoming (not-yet-admitted) person must show only their own
   * facts. Before the fix, the "Inbound" bed slot borrowed whichever occupied admission next came
   * up by position for its length-of-stay and specialling flag — on `rph-adult-secure` this handed
   * Keira Pellingworth (WF-003, incoming) the length-of-stay of Anselm Heronvale (AD-RPHS-02, an
   * ordinary inpatient). An incoming referral has no admission at this ward yet, so it must show
   * neither figure.
   */
  it("an incoming (not-yet-admitted) bed shows no length-of-stay or specialling flag borrowed from someone else", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={RPH_ADULT_SECURE} />
      </WardFlowProvider>,
    );

    const bedsTab = document.getElementById("tab-beds")!;
    const incomingCards = within(bedsTab).getAllByRole("button", { name: /\bInbound\b/ });
    expect(incomingCards.length).toBeGreaterThan(0);
    for (const card of incomingCards) {
      expect(card.textContent ?? "").not.toMatch(/LOS \d/);
    }
  });

  it("scgh-adult-open's own leave record (a second ward) is also placed from its leave record, not by position", () => {
    const SCGH_ADULT_OPEN = "scgh-adult-open";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ExposeWardFlowFacts unitId={SCGH_ADULT_OPEN} />
        <WardScreen unitId={SCGH_ADULT_OPEN} />
      </WardFlowProvider>,
    );

    const unitLeave = leaveBeds.filter((bed) => bed.unitId === SCGH_ADULT_OPEN);
    expect(unitLeave.length).toBeGreaterThan(0);
    const expectedNames = unitLeave.map(
      (leaveBed) => screen.getByTestId(`expected-leave-name-${leaveBed.id}`).textContent,
    );

    const bedsTab = document.getElementById("tab-beds")!;
    const leaveCards = within(bedsTab).getAllByRole("button", { name: /\bOn Leave\b/ });
    expect(leaveCards).toHaveLength(unitLeave.length);
    for (const card of leaveCards) {
      const label = card.getAttribute("aria-label") ?? "";
      expect(expectedNames.some((name) => name && label.includes(name))).toBe(true);
    }
  });
});

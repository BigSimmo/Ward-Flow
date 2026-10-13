import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// The ward screen renders next/link anchors and jsdom cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/ui/toast";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { bedReleases, leaveBeds } from "@/components/ward-management/ward-movements";
import { wardPatients } from "@/components/ward-management/ward-patients-seed";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { layoutBedNumbers, seatStays } from "@/components/ward-management/ward/ward-bed-layout";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

/**
 * Audit A1-1 (13 Oct 2026): a stay keeps its bed number. Recording one departure or one absence
 * used to renumber other people's beds, because a bed's number was its place in a list sorted by
 * state. Audit A1-12: "Has left" names its destination and offers Undo, like Move bed.
 */

const RELEASE = bedReleases.find((release) => {
  const admission = wardAdmissions.find((candidate) => candidate.id === release.admissionId);
  const patient = wardPatients.find((candidate) => candidate.id === admission?.patientId);
  return release.state === "expected" && release.blocker === null && patient?.legalStatus === "Voluntary";
})!;
const UNIT = RELEASE.unitId;
const OTHER = wardAdmissions.find(
  (admission) =>
    admission.unitId === UNIT &&
    admission.state === "occupied" &&
    admission.id !== RELEASE.admissionId &&
    !leaveBeds.some((leaveBed) => leaveBed.admissionId === admission.id),
)!;

function Probe() {
  const { dispatch, admissions } = useWardFlow();
  const named = admissions.find((admission) => admission.id === RELEASE.admissionId);
  return (
    <>
      <output data-testid="named-state">{named?.state}</output>
      <button
        type="button"
        onClick={() =>
          dispatch({
            type: "RECORD_ABSENT_WITHOUT_LEAVE",
            role: "ward",
            now: NOW_ANCHOR,
            admissionId: OTHER.id,
            actingUnitId: UNIT,
          })
        }
      >
        Mark synthetic absence
      </button>
    </>
  );
}

function renderWard() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ToastProvider>
        <Probe />
        <WardScreen unitId={UNIT} />
      </ToastProvider>
    </WardFlowProvider>,
  );
}

/** Every stay shown on the bed cards, and the bed number it sits in. */
function bedsByStay(): Map<string, string> {
  return new Map(
    Array.from(document.querySelectorAll<HTMLElement>("[data-testid^='ward-bed-card-'][data-admission-id]")).map(
      (card) => [card.dataset.admissionId!, card.dataset.testid!.replace("ward-bed-card-", "")],
    ),
  );
}

function expectNobodyElseMoved(before: Map<string, string>, except: string) {
  const after = bedsByStay();
  for (const [admissionId, bed] of before) {
    if (admissionId === except || !after.has(admissionId)) continue;
    expect(after.get(admissionId), `stay ${admissionId} keeps bed ${bed}`).toBe(bed);
  }
}

describe("stable bed numbers (audit A1-1)", () => {
  it("seats each stay in the lowest bed free when it took one, so a later departure moves nobody", () => {
    const stays = [
      { id: "a", state: "occupied", pulledAt: 10, arrivedAt: 20, leftAt: null },
      { id: "b", state: "occupied", pulledAt: 30, arrivedAt: 40, leftAt: null },
      { id: "c", state: "occupied", pulledAt: 50, arrivedAt: 60, leftAt: null },
    ];
    expect([...seatStays(4, stays)]).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
    const afterDeparture = seatStays(4, [{ ...stays[0], state: "departed", leftAt: 100 }, stays[1], stays[2]]);
    expect([...afterDeparture]).toEqual([
      ["b", 2],
      ["c", 3],
    ]);
    // A new pull takes the bed the departure freed.
    const withPull = seatStays(4, [
      { ...stays[0], state: "departed", leftAt: 100 },
      stays[1],
      stays[2],
      { id: "d", state: "pulled", pulledAt: 120, arrivedAt: null, leftAt: null },
    ]);
    expect(withPull.get("d")).toBe(1);
  });

  it("reserves a recorded bed for its stay, so an unrecorded stay is never seated in it", () => {
    const stays = [
      { id: "a", state: "occupied", pulledAt: 10, arrivedAt: 20, leftAt: null },
      { id: "r", state: "occupied", pulledAt: 30, arrivedAt: 40, leftAt: null, bedNumber: 1 },
    ];
    // Without the reservation "a" would be seated in bed 1 and later jump when "r" leaves.
    expect(seatStays(3, stays).get("a")).toBe(2);
    expect(seatStays(3, stays).get("r")).toBe(1);
    const afterRecordedLeaves = seatStays(3, [stays[0], { ...stays[1], state: "departed", leftAt: 100 }]);
    expect(afterRecordedLeaves.get("a")).toBe(2);
    // A stay moved on the Bed board (recorded bed 3) keeps its replay seat, so nobody else reflows,
    // and a later unrecorded stay is not seated in bed 3 either.
    const moved = seatStays(4, [
      { id: "m", state: "occupied", pulledAt: 10, arrivedAt: 20, leftAt: null, bedNumber: 3 },
      { id: "b", state: "occupied", pulledAt: 30, arrivedAt: 40, leftAt: null },
      { id: "n", state: "pulled", pulledAt: 50, arrivedAt: null, leftAt: null },
    ]);
    expect([...moved]).toEqual([
      ["m", 1],
      ["b", 2],
      ["n", 4],
    ]);
  });

  it("lays a seated stay in its seat whatever its tile's place in the state-sorted list", () => {
    const items = [
      { free: true },
      { free: true },
      { stayAdmissionId: "b", free: false },
      { stayAdmissionId: "c", free: false },
    ];
    const seats = new Map([
      ["b", 2],
      ["c", 3],
    ]);
    expect(
      layoutBedNumbers(
        items,
        () => undefined,
        [],
        (id) => seats.get(id),
      ),
    ).toEqual([1, 4, 2, 3]);
  });

  it("keeps every other stay in its bed when one person is marked absent", () => {
    renderWard();
    const before = bedsByStay();
    expect(before.size).toBeGreaterThan(3);
    fireEvent.click(screen.getByRole("button", { name: "Mark synthetic absence" }));
    expectNobodyElseMoved(before, "");
    expect(bedsByStay().get(OTHER.id)).toBe(before.get(OTHER.id));
  });

  it("keeps every other stay in its bed when one person leaves, and Undo puts them back", () => {
    renderWard();
    const before = bedsByStay();
    const card = document.querySelector(`[data-admission-id="${RELEASE.admissionId}"]`);
    fireEvent.click(card as HTMLElement);
    // The destination is shown plainly before it is recorded.
    expect(document.getElementById("drawer-leaving-summary")).toHaveTextContent(/Going to Discharged to the community/);
    fireEvent.click(screen.getByRole("button", { name: /Record that they have left/i }));
    expect(screen.getByTestId("named-state")).toHaveTextContent("departed");
    expectNobodyElseMoved(before, RELEASE.admissionId);

    const toast = screen.getByTestId("toast");
    expect(toast).toHaveTextContent(/has left the ward \(discharged to the community\)/);
    act(() => {
      fireEvent.click(within(toast).getByRole("button", { name: /^Undo/ }));
    });
    expect(screen.getByTestId("named-state")).toHaveTextContent("occupied");
    expect(bedsByStay().get(RELEASE.admissionId)).toBe(before.get(RELEASE.admissionId));
    expectNobodyElseMoved(before, "");
  });
});

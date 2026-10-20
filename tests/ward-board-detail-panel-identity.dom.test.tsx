// Audit 1, Josh 20 Oct 2026 (CS-09): the ward board slide-out carries the chosen bed's
// "name · UMRN · Bed n" line into its departure confirm, as the shift-tile path does. Synthetic only.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WardBoardDetailPanel } from "@/components/ward-management/board/ward-board-detail-panel";
import { buildOccupants, type Tile } from "@/components/ward-management/board/ward-board-model";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

type Props = Parameters<typeof WardBoardDetailPanel>[0];

const UNIT = allUnits().find((unit) =>
  buildOccupants(unit, wardAdmissions, NOW_ANCHOR).some((occupant) => occupant.awayAtEdHours === null),
)!;
const OCCUPANT = buildOccupants(UNIT, wardAdmissions, NOW_ANCHOR).find((occupant) => occupant.awayAtEdHours === null)!;

function renderPanel(identity: string | undefined, testId = "ward-board-record-leaving-submit") {
  const setPendingConfirm = vi.fn();
  const props = {
    admissions: wardAdmissions,
    blockedTileCount: 0,
    closeDetail: vi.fn(),
    closedTileCount: 0,
    constraint: null,
    dateEdit: null,
    dayZero: new Date(NOW_ANCHOR),
    dialogTriggerRef: { current: null },
    dispatchAndReport: vi.fn(),
    emptyTileCount: 0,
    identity,
    leavingDestination: "discharged-to-the-community",
    movements: [],
    nameFor: () => "Synthetic Person",
    now: NOW_ANCHOR,
    patients: [],
    raise: vi.fn(),
    recordDepartureAndReport: vi.fn(),
    recordWardDeparture: vi.fn(),
    requireConfirmation: true,
    resolvePatientIdentity: () => ({
      displayName: "Synthetic Person",
      formalName: "PERSON, Synthetic",
      initials: "SP",
      umrn: "UM000001",
    }),
    selectedOccupant: OCCUPANT,
    selectedTile: { kind: "occupied", key: OCCUPANT.key, who: "Synthetic Person" } as unknown as Tile,
    setBlockerDialogItem: vi.fn(),
    setDateEdit: vi.fn(),
    setLeavingDestination: vi.fn(),
    setPendingConfirm,
    setSelectedBlocker: vi.fn(),
    unit: UNIT,
  } as unknown as Props;
  render(<WardBoardDetailPanel {...props} />);
  fireEvent.click(screen.getByTestId(testId));
  return setPendingConfirm;
}

describe("ward board slide-out departure confirm (CS-09)", () => {
  it("passes the identity line to the confirm when the parent gives one", () => {
    const set = renderPanel("PERSON, Synthetic · UM000001 · Bed 3");
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "leaving", identity: "PERSON, Synthetic · UM000001 · Bed 3" }),
    );
  });

  it("passes it to the ED-transfer confirm too", () => {
    const set = renderPanel("PERSON, Synthetic · UM000001 · Bed 3", "ward-board-record-away-submit");
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "away_at_ed", identity: "PERSON, Synthetic · UM000001 · Bed 3" }),
    );
  });

  it("still opens the confirm without one", () => {
    const set = renderPanel(undefined);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ kind: "leaving", identity: undefined }));
  });
});

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderEdRowFacts } from "@/components/ward-management/ed/ed-screen-row-facts";
import { EdReferredPanel } from "@/components/ward-management/ed/ed-screen-referred";
import type { EdBoardRowModel } from "@/components/ward-management/ed/ed-screen-board-row";
import type { EdScreenContext } from "@/components/ward-management/ed/ed-screen-context";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { createReadmissionIndex } from "@/components/ward-management/ward-readmission";
import type { Movement } from "@/components/ward-management/ward-model";

const state = seedWardFlowState();
const original = state.movements.find((m) => m.stage === "pulled")!;
const withoutBooking: Movement = {
  ...original,
  transport: undefined,
  transportNeed: { needed: false, at: NOW_ANCHOR - 10 },
};
const withBooking: Movement = { ...withoutBooking, transport: state.movements.find((m) => m.transport)!.transport };
afterEach(cleanup);
function Facts({ movement }: { movement: Movement }) {
  const row = { movement } as EdBoardRowModel;
  return renderEdRowFacts(row, {
    now: NOW_ANCHOR,
    units: state.units,
    readmissionIndex: createReadmissionIndex(state),
  } as EdScreenContext).patientFactsTail;
}
function Outbox({ movement }: { movement: Movement }) {
  const ctx = {
    now: NOW_ANCHOR,
    department: { name: "Synthetic ED" },
    movements: [movement],
    outbox: [movement],
    units: state.units,
    referrals: state.referrals,
    registryPatients: state.patients,
    departmentListTab: "referred",
    answeredAll: [],
    answered: [],
    genderRecordDraft: {},
  } as unknown as EdScreenContext;
  return <EdReferredPanel ctx={ctx} />;
}
describe.each([Facts, Outbox])("ED booking replaces the old no-transport guidance", (View) => {
  it("removes the negative fact as soon as a live booking arrives", () => {
    const page = render(<View movement={withoutBooking} />);
    expect(screen.getByText("No transport needed")).toBeInTheDocument();
    page.rerender(<View movement={withBooking} />);
    expect(screen.queryByText("No transport needed")).toBeNull();
  });
});

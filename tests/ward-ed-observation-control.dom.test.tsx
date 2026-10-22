import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * PR #533 (owner decision 22 Oct 2026): ED changes a waiting patient's observation level from the
 * patient record with the ward drawer's own control, recorded as RECORD_OBSERVATION_LEVEL against
 * the open movement.
 */
function MovementProbe({ id }: { id: () => string | undefined }) {
  const { movements } = useWardFlow();
  const movement = movements.find((m) => m.id === id());
  return (
    <p data-testid="probe">
      {movement
        ? `${movement.observation.level}|${movement.observation.intervalMinutes ?? "none"}|${movement.observationChanges?.length ?? 0}`
        : "none"}
    </p>
  );
}

function openFirstPatient() {
  const name = screen.getAllByTestId(/^ward-ed-row-name-/u)[0];
  const id = name.getAttribute("data-testid")!.replace("ward-ed-row-name-", "");
  fireEvent.click(name);
  // The person sheet's "Open patient" opens the patient record.
  fireEvent.click(
    within(screen.getByTestId(`ward-ed-phone-sheet-${id}`)).getByRole("button", { name: "Open patient" }),
  );
  return id;
}

describe("ED patient record — observation level", () => {
  it("records a new level, interval and review time against the waiting patient's movement", async () => {
    const picked: { id?: string } = {};
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="sjgm-ed" />
        <MovementProbe id={() => picked.id} />
      </WardFlowProvider>,
    );
    picked.id = openFirstPatient();
    const section = screen.getByTestId("ward-ed-observation");
    // The control loads after the first paint; it is the ward drawer's own control.
    fireEvent.click(await within(section).findByTestId("ward-observation-change"));
    fireEvent.change(within(section).getByTestId("ward-observation-level"), { target: { value: "intermittent" } });
    fireEvent.change(within(section).getByTestId("ward-observation-interval"), { target: { value: "30" } });
    fireEvent.change(within(section).getByTestId("ward-observation-review-time"), { target: { value: "23:30" } });
    fireEvent.click(within(section).getByTestId("ward-observation-save"));
    expect(screen.getByTestId("probe")).toHaveTextContent("intermittent|30|1");
    expect(within(screen.getByTestId("ward-ed-observation")).getByTestId("ward-observation-current")).toHaveTextContent(
      /Intermittent, every 30 minutes\. Review/u,
    );
  });
});

describe("ED observation control — phone script budget", () => {
  it("loads the ward control lazily, never as a static import on the ED page", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of ["ed-screen-patient-dialog.tsx", "ed-observation-control.tsx"]) {
      const source = readFileSync(`src/components/ward-management/ed/${file}`, "utf8");
      expect(source).not.toMatch(/^import[^;]*ward-observation-control"/mu);
    }
  });
});

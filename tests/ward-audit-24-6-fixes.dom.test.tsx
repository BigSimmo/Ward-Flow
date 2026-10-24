// Audit 24-6 (time and clocks), fixes C: TC-03, TC-07 and TC-08 on screen. All data synthetic.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { downloadCsv } = vi.hoisted(() => ({ downloadCsv: vi.fn() }));
vi.mock("@/components/ward-management/statistics/statistics-csv", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/statistics/statistics-csv")>()),
  downloadCsv,
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import { RecordFormSheet, type RecordDraft } from "@/components/ward-management/legal-forms/legal-forms-sheets";
import { WardBroadcastBanner } from "@/components/ward-management/shell/ward-broadcast-banner";
import { PersonEntry } from "@/components/ward-management/board/ward-board-person-entry";
import { buildOccupants } from "@/components/ward-management/board/ward-board-model";
import { CommunityIndex } from "@/components/ward-management/community/community-index";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { perthMidnight, type Instant } from "@/components/ward-management/ward-clock";
import type { WardBroadcastAlert } from "@/components/ward-management/alerts/ward-broadcast-model";

const DAY = 1440;
const dayZero = perthMidnight(2026, 9, 24);

afterEach(() => {
  cleanup();
  downloadCsv.mockReset();
});

describe("TC-03: Record a form takes the date written on the form", () => {
  const movement = seedWardFlowState().movements.find(isOpen)!;
  function Harness({ now, onSave }: { now: Instant; onSave: (writtenAt: Instant) => void }) {
    const [draft, setDraft] = useState<RecordDraft>({ form: "1A", movement: "" });
    return (
      <RecordFormSheet
        open
        onClose={() => {}}
        draft={draft}
        onDraft={setDraft}
        openMovements={[movement]}
        labelOf={() => "Synthetic movement"}
        now={now}
        onSaveForm={({ writtenAt }) => {
          onSave(writtenAt);
          return true;
        }}
      />
    );
  }
  function renderAt(now: Instant, onSave: (writtenAt: Instant) => void) {
    render(
      <WardFlowProvider initialNow={now} initialDayZero={dayZero.getTime()}>
        <Harness now={now} onSave={onSave} />
      </WardFlowProvider>,
    );
    const sheet = screen.getByTestId("ward-legal-record");
    fireEvent.change(within(sheet).getByLabelText("Movement"), { target: { value: movement.id } });
    return sheet;
  }

  it("at day 1 00:10, date day 0 and time 23:50 records day 0 23:50", () => {
    const saved: Instant[] = [];
    const sheet = renderAt(DAY + 10, (at) => saved.push(at));
    fireEvent.change(within(sheet).getByLabelText("Time on form"), { target: { value: "23:50" } });
    // The button remounts as its block reason comes and goes, so it is read afresh each time.
    const save = () => screen.getByTestId("ward-legal-forms-register-confirm");
    // Blank date means today, and today's 23:50 has not happened yet.
    expect(save()).toHaveAttribute("aria-disabled", "true");
    fireEvent.change(screen.getByTestId("ward-legal-forms-new-date"), { target: { value: "2026-10-24" } });
    expect(save()).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(save());
    expect(saved).toEqual([23 * 60 + 50]);
  });

  it("still refuses a date and time after now", () => {
    const saved: Instant[] = [];
    const sheet = renderAt(DAY + 10, (at) => saved.push(at));
    fireEvent.change(within(sheet).getByLabelText("Time on form"), { target: { value: "09:00" } });
    fireEvent.change(screen.getByTestId("ward-legal-forms-new-date"), { target: { value: "2026-10-25" } });
    const save = screen.getByTestId("ward-legal-forms-register-confirm");
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveAttribute("title", "Enter the date and time written on the form, no later than now.");
    fireEvent.click(save);
    expect(saved).toEqual([]);
  });
});

describe("TC-07: the board clock's date, not the device's", () => {
  it("reads a person's age on the board date when no date is passed", () => {
    const state = seedWardFlowState();
    const [admission, occupant] = state.units
      .flatMap((unit) => buildOccupants(unit, state.admissions, 0))
      .map((entry) => [state.admissions.find((candidate) => candidate.id === entry.key), entry] as const)
      .find(
        ([candidate]) =>
          candidate !== undefined &&
          resolveSubjectPatient(candidate, { patients: state.patients, movements: state.movements }).patient,
      )!;
    const resolved = resolveSubjectPatient(admission!, { patients: state.patients, movements: state.movements });
    const patient = { ...resolved.patient!, dateOfBirth: "2000-06-01" };
    render(
      <WardFlowProvider initialNow={0} initialDayZero={perthMidnight(2040, 0, 1).getTime()}>
        <PersonEntry
          occupant={occupant}
          idPrefix="ward-board-selected-person"
          resolvedPatient={{ ...resolved, patient }}
        />
      </WardFlowProvider>,
    );
    // 39 on 1 Jan 2040; the device's real date would give a different age.
    expect(screen.getByText("39 yrs")).toBeInTheDocument();
  });

  it("stamps the community team CSV with the board clock's time", () => {
    render(
      <WardFlowProvider initialNow={600} initialDayZero={perthMidnight(2030, 0, 1).getTime()}>
        <CommunityIndex teams={[]} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("community-action-catchment-guide"));
    fireEvent.click(screen.getByRole("button", { name: "Export team list" }));
    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const provenance = downloadCsv.mock.calls[0]![2] as { asAt: string };
    expect(provenance.asAt).toContain("2030");
    expect(provenance.asAt).toContain("10:00 AWST");
  });
});

describe("TC-08: controlled banner reads an Instant expiry against the board clock", () => {
  const alert = {
    id: "synthetic-alert",
    severity: "warning",
    status: "active",
    message: "Synthetic test alert",
    expiresAt: 700,
  } as unknown as WardBroadcastAlert;

  it("shows the alert while the board clock is before its expiry", () => {
    render(
      <WardFlowProvider initialNow={600}>
        <WardBroadcastBanner activeAlert={alert} />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-broadcast-banner")).toBeInTheDocument();
  });

  it("hides it once the board clock passes its expiry", () => {
    render(
      <WardFlowProvider initialNow={701}>
        <WardBroadcastBanner activeAlert={alert} />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("ward-broadcast-banner")).toBeNull();
  });
});

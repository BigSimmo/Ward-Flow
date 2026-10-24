import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  usePathname: () => "/ward-flow/movements/x",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import type { BedMeetingSubject } from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import { MeetingActionsDue } from "@/components/ward-management/bed-meeting/meeting-actions-due";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import {
  resetWardAccessStoreForTests,
  setWardAccess,
  startAccessPreview,
} from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Overall review, 20 Oct 2026: the owner of a bed meeting action marks it done on the record they
 * land on, not only the coordinator on the agenda. Another desk sees nothing.
 */
const seed = seedWardFlowState();
const [ownerWard, otherWard] = seed.units.map((unit) => unit.id);
const MOVEMENT: BedMeetingSubject = { kind: "movement", id: "WF-009" };
const ADMISSION: BedMeetingSubject = { kind: "admission", id: seed.admissions[0]!.id };

/** The chair records the action first, as the agenda does. Test set-up only, never a screen. */
function RecordAtMeeting({
  subject,
  owner,
  action = "book_transport",
  testId = "record",
}: {
  subject: BedMeetingSubject;
  owner: "ward" | "ed";
  action?: "book_transport" | "chase_ndis";
  testId?: string;
}) {
  const { dispatch, rejections } = useWardFlowSelect("dispatch", "rejections");
  return (
    <>
      <button
        type="button"
        data-testid={testId}
        onClick={() =>
          dispatch({
            type: "RECORD_BED_MEETING_ACTION",
            role: "coordinator",
            now: NOW_ANCHOR,
            subject,
            action,
            owner,
            ...(owner === "ward" ? { unitId: ownerWard } : {}),
            dueAt: NOW_ANCHOR + 240,
          })
        }
      />
      <span data-testid="refusals">{rejections.length}</span>
    </>
  );
}

function asDesk(access: WardAccess) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(access);
  });
}

function recordAction() {
  fireEvent.click(screen.getByTestId("record"));
  expect(screen.getByTestId("refusals")).toHaveTextContent("0");
}

afterEach(() => {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    setWardFeatureFlagOnDevice("bed-meeting-actions", null);
    resetWardAccessStoreForTests();
  });
});

describe("bed meeting actions due on a record", () => {
  it("shows the owning ward its action on the bed request's record, and marks it done", () => {
    asDesk({ role: "ward", scope: { kind: "ward", unitIds: [ownerWard!] } });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RecordAtMeeting subject={MOVEMENT} owner="ward" />
        <PatientNowScreen movementId={MOVEMENT.id} />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("meeting-actions-due")).not.toBeInTheDocument();
    recordAction();

    const card = screen.getByTestId("meeting-actions-due");
    expect(card).toHaveTextContent("Book transport");
    expect(card).toHaveTextContent(/Due \d{2}:\d{2}/);
    fireEvent.click(screen.getByRole("button", { name: "Mark done: Book transport" }));

    expect(screen.getByTestId("refusals")).toHaveTextContent("0");
    expect(screen.queryByTestId("meeting-actions-due")).not.toBeInTheDocument();
  });

  it("shows another ward nothing", () => {
    asDesk({ role: "ward", scope: { kind: "ward", unitIds: [otherWard!] } });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RecordAtMeeting subject={MOVEMENT} owner="ward" />
        <PatientNowScreen movementId={MOVEMENT.id} />
      </WardFlowProvider>,
    );
    recordAction();
    expect(screen.queryByTestId("meeting-actions-due")).not.toBeInTheDocument();
  });

  it("shows a stay's action to its owner and the coordinator, not to another desk", () => {
    asDesk({ role: "community", scope: { kind: "team", teamName: "Synthetic team" } });
    const { unmount } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RecordAtMeeting subject={ADMISSION} owner="ed" />
        <MeetingActionsDue subject={ADMISSION} />
      </WardFlowProvider>,
    );
    recordAction();
    expect(screen.queryByTestId("meeting-actions-due")).not.toBeInTheDocument();
    unmount();

    asDesk({ role: "coordinator", scope: { kind: "statewide" } });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RecordAtMeeting subject={ADMISSION} owner="ed" />
        <MeetingActionsDue subject={ADMISSION} />
      </WardFlowProvider>,
    );
    recordAction();
    fireEvent.click(screen.getByTestId("meeting-action-mark-done"));
    expect(screen.getByTestId("refusals")).toHaveTextContent("0");
    expect(screen.queryByTestId("meeting-actions-due")).not.toBeInTheDocument();
  });

  it("closes only the tapped action on a double click (Audit 7 NB-02)", () => {
    asDesk({ role: "coordinator", scope: { kind: "statewide" } });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RecordAtMeeting subject={ADMISSION} owner="ed" />
        <RecordAtMeeting subject={ADMISSION} owner="ed" action="chase_ndis" testId="record-second" />
        <MeetingActionsDue subject={ADMISSION} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("record"));
    fireEvent.click(screen.getByTestId("record-second"));
    expect(screen.getAllByTestId("meeting-action-mark-done")).toHaveLength(2);

    fireEvent.click(screen.getAllByTestId("meeting-action-mark-done")[0]!, { detail: 1 });
    // The row has gone, so the second click of the pair lands on the other action's button.
    fireEvent.click(screen.getAllByTestId("meeting-action-mark-done")[0]!, { detail: 2 });
    fireEvent.click(screen.getAllByTestId("meeting-action-mark-done")[0]!, { detail: 1 });
    expect(screen.getAllByTestId("meeting-action-mark-done")).toHaveLength(1);
  });

  it("shows nothing while the coordinator previews the owning ward, because a preview is read only", () => {
    asDesk({ role: "coordinator", scope: { kind: "statewide" } });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RecordAtMeeting subject={MOVEMENT} owner="ward" />
        <MeetingActionsDue subject={MOVEMENT} />
      </WardFlowProvider>,
    );
    recordAction();
    expect(screen.getByTestId("meeting-actions-due")).toBeInTheDocument();
    act(() => startAccessPreview({ role: "ward", scope: { kind: "ward", unitIds: [ownerWard!] } }));
    expect(screen.queryByTestId("meeting-actions-due")).not.toBeInTheDocument();
  });

  it("lets the site bed manager mark a ward's action done, and shows another site's nothing (D-80)", () => {
    const site = seed.units.find((unit) => unit.id === ownerWard)!.siteCode;
    const otherSite = seed.units.find((unit) => unit.siteCode !== site)!.siteCode;
    asDesk({ role: "bed_manager", scope: { kind: "site", siteCode: otherSite } });
    const { unmount } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RecordAtMeeting subject={MOVEMENT} owner="ward" />
        <MeetingActionsDue subject={MOVEMENT} />
      </WardFlowProvider>,
    );
    recordAction();
    expect(screen.queryByTestId("meeting-actions-due")).not.toBeInTheDocument();
    unmount();

    asDesk({ role: "bed_manager", scope: { kind: "site", siteCode: site } });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RecordAtMeeting subject={MOVEMENT} owner="ward" />
        <MeetingActionsDue subject={MOVEMENT} />
      </WardFlowProvider>,
    );
    recordAction();
    fireEvent.click(screen.getByRole("button", { name: "Mark done: Book transport" }));
    expect(screen.getByTestId("refusals")).toHaveTextContent("0");
    expect(screen.queryByTestId("meeting-actions-due")).not.toBeInTheDocument();
  });

  it("shows nothing while the bed meeting actions switch is off", () => {
    act(() => setWardFeatureFlagOnDevice("bed-meeting-actions", false));
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RecordAtMeeting subject={MOVEMENT} owner="ward" />
        <MeetingActionsDue subject={MOVEMENT} />
      </WardFlowProvider>,
    );
    recordAction();
    expect(screen.queryByTestId("meeting-actions-due")).not.toBeInTheDocument();
  });
});

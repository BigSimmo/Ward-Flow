import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  WardNotificationCenter,
  type WardNotificationCenterProps,
} from "@/components/ward-management/ward/ward-notification-center";
import { type Movement, type Notice } from "@/components/ward-management/ward-model";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";
import {
  getAudioBuzzPreference,
  setAudioBuzzPreference,
  playSyntheticUrgentChime,
  triggerUrgentBuzzAlert,
} from "@/components/ward-management/shell/ward-sound-store";
import { GENERAL_OBSERVATION } from "../src/components/ward-management/ward-observation";

const BASE_MOVEMENT: Movement = {
  id: "WF-001",
  originEdId: "ED-001",
  openedAt: 300,
  flaggedUrgent: false,
  urgency: 2,
  cohort: "Adult",
  security: "Open",
  sex: "Female",
  observation: GENERAL_OBSERVATION,
  highAcuity: false,
  legalStatus: "Voluntary",
  statusChanges: [],
  urgencyChanges: [],
  overrides: [],
  stage: "accepted_awaiting_bed",
  owner: "coordinator",
  referredUnitIds: [],
  declines: [],
  unwinds: [],
  stageChanges: [],
  withdrawnReferrals: [],
  blocker: "None",
};

function makeMovement(partial: Partial<Movement> & { patientName?: string }): Movement {
  return { ...BASE_MOVEMENT, ...partial };
}

const BASE_NOTICE: Notice = {
  id: "NT-001",
  raisedAt: 400,
  to: { role: "ward", placeId: "ward-alpha" },
  about: { unitId: "ward-alpha" },
  kind: "referral_accepted_ward",
  sentence: "New referral received for acute bed",
};

function makeNotice(partial: Partial<Notice>): Notice {
  return { ...BASE_NOTICE, ...partial };
}

describe("WardNotificationCenter DOM Component", () => {
  const defaultProps: WardNotificationCenterProps = {
    unitId: "ward-alpha",
    unitName: "Ward Alpha",
    now: 700, // 11:40
    movements: [],
    notices: [],
    refreshRequests: [],
  };

  it("renders coordinator buzzes with acknowledge action", () => {
    const onDismissBuzz = vi.fn();
    const refreshRequests = [
      {
        unitId: "ward-alpha",
        at: 540, // 09:00
        byRole: "coordinator",
        message: "Please review pending discharges immediately",
        urgent: true,
      },
      {
        unitId: "ward-beta", // Other ward
        at: 550,
        byRole: "coordinator",
        message: "Bed review for Beta",
      },
      {
        unitId: "ward-alpha",
        at: 570, // 09:30
        byRole: "coordinator",
        // No message -> default "Capacity refresh requested"
      },
    ];

    render(
      <WardNotificationCenter {...defaultProps} refreshRequests={refreshRequests} onDismissBuzz={onDismissBuzz} />,
    );

    // Shows buzzes for Ward Alpha
    expect(screen.getByText("Please review pending discharges immediately")).toBeInTheDocument();
    expect(screen.getByText("Capacity refresh requested")).toBeInTheDocument();
    // Role displayed as Bed coordinator
    expect(screen.getAllByText("Bed coordinator")).toHaveLength(2);
    // Urgent is said on the urgent buzz's own row, and that row comes first
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Please review pending discharges immediately");
    expect(rows[0]).toHaveTextContent("Urgent buzz");
    // Time formatted
    expect(screen.getByText("09:00")).toBeInTheDocument();
    expect(screen.getByText("09:30")).toBeInTheDocument();

    // Does NOT show buzz for Ward Beta
    expect(screen.queryByText("Bed review for Beta")).not.toBeInTheDocument();

    // Click acknowledge button on first buzz
    const acknowledgeButtons = screen.getAllByRole("button", { name: "Acknowledge" });
    expect(acknowledgeButtons).toHaveLength(2);

    fireEvent.click(acknowledgeButtons[0]);
    expect(onDismissBuzz).toHaveBeenCalledTimes(1);
    expect(onDismissBuzz).toHaveBeenCalledWith(
      "ward-alpha:540:coordinator:Please review pending discharges immediately:true#0",
    );

    fireEvent.click(acknowledgeButtons[1]);
    expect(onDismissBuzz).toHaveBeenCalledTimes(2);
    expect(onDismissBuzz).toHaveBeenCalledWith("ward-alpha:570:coordinator::false#0");
  });

  it("keeps identical repeat buzzes as separate acknowledgements", () => {
    const onDismissBuzz = vi.fn();
    const buzz = { unitId: "ward-alpha", at: 540, byRole: "coordinator", message: "Same buzz" };
    render(
      <WardNotificationCenter {...defaultProps} refreshRequests={[buzz, { ...buzz }]} onDismissBuzz={onDismissBuzz} />,
    );
    // Phone notices (20 Oct 2026): the repeat shows as one card, and each buzz is still its own
    // acknowledgement under Show each.
    expect(screen.getByTestId("ward-buzz-group")).toHaveTextContent("×2");
    fireEvent.click(screen.getByRole("button", { name: "Show each" }));
    // The message has a space; aria-controls must still name one element that exists.
    const controls = screen.getByRole("button", { name: "Hide each" }).getAttribute("aria-controls") ?? "";
    expect(controls).not.toMatch(/\s/);
    expect(document.getElementById(controls)).not.toBeNull();
    const acknowledgeButtons = screen.getAllByRole("button", { name: "Acknowledge" });
    expect(acknowledgeButtons).toHaveLength(2);
    fireEvent.click(acknowledgeButtons[1]);
    expect(onDismissBuzz).toHaveBeenCalledWith("ward-alpha:540:coordinator:Same buzz:false#1");
  });

  it("acknowledges a run of repeat buzzes at once, and keeps different buzzes apart", () => {
    const onDismissBuzz = vi.fn();
    const buzz = { unitId: "ward-alpha", at: 540, byRole: "coordinator", message: "Same buzz" };
    render(
      <WardNotificationCenter
        {...defaultProps}
        refreshRequests={[buzz, { ...buzz, at: 550 }, { ...buzz, message: "Other buzz" }]}
        onDismissBuzz={onDismissBuzz}
      />,
    );
    expect(screen.getAllByTestId("ward-buzz-group")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Acknowledge" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge all 2" }));
    expect(onDismissBuzz).toHaveBeenCalledTimes(2);
    expect(onDismissBuzz).toHaveBeenCalledWith("ward-alpha:540:coordinator:Same buzz:false#0");
    expect(onDismissBuzz).toHaveBeenCalledWith("ward-alpha:550:coordinator:Same buzz:false#0");
  });

  it("orders the filter Act now before Coordinator, and leaves the title and close to a sheet", () => {
    render(<WardNotificationCenter {...defaultProps} inSheet onClose={vi.fn()} />);
    const filters = screen
      .getAllByRole("button", { pressed: false })
      .concat(screen.getAllByRole("button", { pressed: true }))
      .map((button) => button.textContent ?? "");
    expect(filters.findIndex((t) => t.startsWith("Act now"))).toBeLessThan(
      filters.findIndex((t) => t.startsWith("Coordinator")),
    );
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-notification-close-btn")).not.toBeInTheDocument();
  });

  it("renders 09:30 overdue census banner with confirm callback", () => {
    const onConfirmMorningRollup = vi.fn();

    const { rerender } = render(
      <WardNotificationCenter
        {...defaultProps}
        morningRollupDeadlinePassed={true}
        morningRollupConfirmed={false}
        onConfirmMorningRollup={onConfirmMorningRollup}
      />,
    );

    // Notices option A: a short title, the due time and how late, one action
    const row = screen.getByTestId("ward-census-overdue");
    expect(row).toHaveTextContent("Morning numbers not confirmed");
    expect(row).toHaveTextContent("Due 09:30");
    expect(row).toHaveTextContent("2h 10m"); // 11:40 less 09:30
    // Redesign (31 Oct 2026): a ward's own daily time is "Late"; "Overdue" is kept for legal form times.
    expect(row).toHaveTextContent("Late");

    const confirmButton = screen.getByRole("button", { name: "Confirm numbers" });
    expect(confirmButton).toBeInTheDocument();

    fireEvent.click(confirmButton);
    expect(onConfirmMorningRollup).toHaveBeenCalledTimes(1);

    // When confirmed, banner should disappear
    rerender(
      <WardNotificationCenter
        {...defaultProps}
        morningRollupDeadlinePassed={true}
        morningRollupConfirmed={true}
        onConfirmMorningRollup={onConfirmMorningRollup}
      />,
    );
    expect(screen.queryByTestId("ward-census-overdue")).not.toBeInTheDocument();
  });

  it("renders overdue inbound arrival alerts", () => {
    const now = 700; // 11:40
    const movements = [
      // Overdue: eta 600 (10:00). 700 > 600 + 60 (660).
      makeMovement({
        id: "WF-001" as Movement["id"],
        acceptedUnitId: "ward-alpha",
        patientName: "Jane Doe",
        arrivalDetails: {
          estimatedArrivalAt: 600,
          recordedAt: 500,
          mode: "mental_health_transport",
          recordedBy: "coordinator",
        },
      }),
      // Not overdue: eta 650. 700 is NOT > 650 + 60 (710).
      makeMovement({
        id: "WF-002" as Movement["id"],
        acceptedUnitId: "ward-alpha",
        patientName: "John Connor",
        arrivalDetails: {
          estimatedArrivalAt: 650,
          recordedAt: 550,
          mode: "mental_health_transport",
          recordedBy: "coordinator",
        },
      }),
      // Overdue but for different unit
      makeMovement({
        id: "WF-003" as Movement["id"],
        acceptedUnitId: "ward-beta",
        patientName: "Sarah Connor",
        arrivalDetails: {
          estimatedArrivalAt: 500,
          recordedAt: 400,
          mode: "mental_health_transport",
          recordedBy: "coordinator",
        },
      }),
    ];

    render(<WardNotificationCenter {...defaultProps} now={now} movements={movements} />);

    const overdue = screen.getAllByRole("listitem").filter((row) => row.textContent?.includes("Late arrival"));
    expect(overdue).toHaveLength(1);
    expect(overdue[0]).toHaveTextContent("Jane Doe");
    expect(overdue[0]).toHaveTextContent("Expected 10:00.");
    expect(overdue[0]).toHaveTextContent("More than 60 minutes late.");

    // Does not display alert for non-overdue or other ward
    // John Connor is still listed under "Medical clearance not recorded" (CS-14), just not as overdue.
    expect(overdue[0]).not.toHaveTextContent("John Connor");
    expect(screen.queryByText(/Sarah Connor/)).not.toBeInTheDocument();
  });

  it("renders missing pre-admission medical clearance alerts", () => {
    const movements = [
      makeMovement({
        id: "WF-010" as Movement["id"],
        acceptedUnitId: "ward-alpha",
        patientName: "Thomas Anderson",
        medicalClearance: { cleared: false, at: 500 },
      }),
      makeMovement({
        id: "WF-011" as Movement["id"],
        acceptedUnitId: "ward-alpha",
        patientName: "Agent Smith",
        medicalClearance: { cleared: true, at: 500 },
      }),
    ];

    render(<WardNotificationCenter {...defaultProps} movements={movements} />);

    expect(screen.getByText("Medical clearance not given")).toBeInTheDocument();
    expect(screen.getByText("The transfer cannot go ahead until it is signed off.")).toBeInTheDocument();
    expect(screen.getByText(/Thomas Anderson/)).toBeInTheDocument();

    // Agent Smith was cleared, so no clearance alert
    expect(screen.queryByText(/Agent Smith/)).not.toBeInTheDocument();
  });

  it("lists incoming patients with no clearance recorded, and never says no urgent tasks then (CS-14)", () => {
    const movements = [
      makeMovement({
        id: "WF-020" as Movement["id"],
        acceptedUnitId: "ward-alpha",
        patientName: "Synthetic Unrecorded",
      }),
      makeMovement({
        id: "WF-021" as Movement["id"],
        acceptedUnitId: "ward-alpha",
        patientName: "Synthetic Cleared",
        medicalClearance: { cleared: true, at: 500 },
      }),
      makeMovement({
        id: "WF-022" as Movement["id"],
        acceptedUnitId: "ward-alpha",
        patientName: "Synthetic Closed",
        closure: { at: 600, outcome: "did_not_proceed", reason: "Synthetic withdrawal" },
      }),
    ];

    render(<WardNotificationCenter {...defaultProps} movements={movements} />);

    const row = screen.getByTestId("ward-clearance-not-recorded");
    expect(row).toHaveTextContent("Medical clearance not recorded");
    expect(row).toHaveTextContent("Synthetic Unrecorded");
    expect(row).toHaveTextContent("before arrival");
    expect(row).not.toHaveTextContent("Synthetic Cleared");
    expect(row).not.toHaveTextContent("Synthetic Closed");
    expect(screen.queryByText(/Nothing needs attention/)).not.toBeInTheDocument();
    // Option A: the row has an action. Accepted here, so it opens the transfer.
    expect(screen.getByRole("link", { name: "Open transfer" })).toHaveAttribute("href", movementHref("WF-020"));
    // The row counts, so the heading never reads zero beside it.
    expect(screen.getByTestId("ward-notification-count")).toHaveTextContent("1 open");
  });

  it("opens the request this ward is answering when clearance is missing before acceptance", () => {
    const onClose = vi.fn();
    const movements = [
      makeMovement({
        id: "WF-030" as Movement["id"],
        stage: "placement_requested",
        referredUnitIds: ["ward-alpha"],
        patientName: "Synthetic Waiting",
      }),
    ];
    render(<WardNotificationCenter {...defaultProps} movements={movements} onClose={onClose} />);
    const link = screen.getByRole("link", { name: "Open request" });
    // The link names the request, so the Answer view opens on this patient (Codex P1 on #585).
    expect(link).toHaveAttribute("href", `/ward-flow/ward/ward-alpha/answer?movement=${encodeRecordAddress("WF-030")}`);
    expect(screen.getByTestId("ward-clearance-not-recorded")).toHaveTextContent("before you accept");
    fireEvent.click(link);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders direct ward notices and allows acknowledging unread notices", () => {
    const onAcknowledgeNotice = vi.fn();
    const notices = [
      makeNotice({
        id: "NT-001",
        sentence: "Bed request cancelled by coordinator",
        to: { role: "ward", placeId: "ward-alpha" },
        raisedAt: 450,
      }),
      makeNotice({
        id: "NT-002",
        sentence: "Patient transfer in progress",
        to: { role: "ward", placeId: "ward-alpha" },
        raisedAt: 500,
        readAt: 520,
      }),
      makeNotice({
        id: "NT-003",
        sentence: "Notice for other unit",
        to: { role: "ward", placeId: "ward-other" },
        raisedAt: 450,
      }),
    ];

    render(<WardNotificationCenter {...defaultProps} notices={notices} onAcknowledgeNotice={onAcknowledgeNotice} />);

    // Displays notices for ward-alpha
    expect(screen.getByText("Bed request cancelled by coordinator")).toBeInTheDocument();
    expect(screen.getByText("Patient transfer in progress")).toBeInTheDocument();
    expect(screen.queryByText("Notice for other unit")).not.toBeInTheDocument();

    // Read notice displays Read indicator and no acknowledge button
    expect(screen.getByText("Read")).toBeInTheDocument();

    // Unread notice displays acknowledge button
    const ackButton = screen.getByRole("button", { name: "Acknowledge" });
    fireEvent.click(ackButton);
    expect(onAcknowledgeNotice).toHaveBeenCalledWith("NT-001");
  });

  it("filters between Act now, Check and Coordinator", () => {
    const refreshRequests = [
      {
        unitId: "ward-alpha",
        at: 540,
        byRole: "coordinator",
        message: "Coordinator buzz message",
      },
    ];

    const movements = [
      makeMovement({
        id: "WF-001" as Movement["id"],
        acceptedUnitId: "ward-alpha",
        patientName: "Jane Doe",
        medicalClearance: { cleared: true, at: 500 },
        arrivalDetails: {
          estimatedArrivalAt: 600,
          recordedAt: 500,
          mode: "mental_health_transport",
          recordedBy: "coordinator",
        },
      }),
      makeMovement({
        id: "WF-002" as Movement["id"],
        acceptedUnitId: "ward-alpha",
        patientName: "Synthetic Unrecorded",
      }),
    ];

    const notices = [
      makeNotice({
        id: "NT-001",
        sentence: "Direct ward notice message",
        to: { role: "ward", placeId: "ward-alpha" },
        raisedAt: 400,
      }),
    ];

    render(
      <WardNotificationCenter
        {...defaultProps}
        now={700}
        refreshRequests={refreshRequests}
        movements={movements}
        notices={notices}
      />,
    );

    const filter = (name: RegExp) => screen.getByRole("button", { name });
    // "All" is pressed by default and everything shows; its count is every row (2 + 1 + 1)
    expect(filter(/^All 4/)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Coordinator buzz message")).toBeInTheDocument();
    expect(screen.getByText("Late arrival")).toBeInTheDocument();
    expect(screen.getByText("Medical clearance not recorded")).toBeInTheDocument();
    expect(screen.getByText("Direct ward notice message")).toBeInTheDocument();

    fireEvent.click(filter(/^Coordinator/));
    expect(filter(/^Coordinator/)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Coordinator buzz message")).toBeInTheDocument();
    expect(screen.getByText("Direct ward notice message")).toBeInTheDocument();
    expect(screen.queryByText("Late arrival")).not.toBeInTheDocument();

    fireEvent.click(filter(/^Act now/));
    expect(screen.getByText("Late arrival")).toBeInTheDocument();
    expect(screen.queryByText("Medical clearance not recorded")).not.toBeInTheDocument();
    expect(screen.queryByText("Coordinator buzz message")).not.toBeInTheDocument();

    fireEvent.click(filter(/^Check/));
    expect(screen.getByText("Medical clearance not recorded")).toBeInTheDocument();
    expect(screen.queryByText("Late arrival")).not.toBeInTheDocument();
    expect(screen.queryByText("Direct ward notice message")).not.toBeInTheDocument();

    fireEvent.click(filter(/^All/));
    expect(screen.getByText("Coordinator buzz message")).toBeInTheDocument();
    expect(screen.getByText("Late arrival")).toBeInTheDocument();
  });

  it("says nothing needs attention in one line rather than empty boxes", () => {
    render(<WardNotificationCenter {...defaultProps} />);
    expect(screen.getByText("Nothing needs attention on Ward Alpha.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("meets accessibility requirements: role=region, one polite summary live region, and a pressed filter group", () => {
    render(
      <WardNotificationCenter {...defaultProps} morningRollupDeadlinePassed={true} morningRollupConfirmed={false} />,
    );

    const region = screen.getByRole("region", {
      name: "Notices for Ward Alpha",
    });
    expect(region).toBeInTheDocument();
    // Only the atomic summary announces; the panel itself is not a live region.
    expect(region).not.toHaveAttribute("aria-live");
    expect(screen.getByTestId("ward-notification-live-summary")).toHaveAttribute("aria-live", "polite");

    const group = screen.getByRole("group", { name: "Filter notices" });
    expect(within(group).getAllByRole("button")).toHaveLength(4);
    expect(within(group).getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("marks the panel with data-urgent-buzz='true' when urgent buzz is present", () => {
    // 1. Without urgent buzz
    const { rerender } = render(
      <WardNotificationCenter
        {...defaultProps}
        refreshRequests={[
          {
            unitId: "ward-alpha",
            at: 540,
            byRole: "coordinator",
            message: "Standard refresh ask",
            urgent: false,
          },
        ]}
      />,
    );

    const panel = screen.getByTestId("ward-notification-center");
    expect(panel).toHaveAttribute("data-urgent-buzz", "false");

    // 2. With urgent buzz for this ward
    rerender(
      <WardNotificationCenter
        {...defaultProps}
        refreshRequests={[
          {
            unitId: "ward-alpha",
            at: 540,
            byRole: "coordinator",
            message: "Urgent bed review requested",
            urgent: true,
          },
        ]}
      />,
    );

    expect(panel).toHaveAttribute("data-urgent-buzz", "true");

    // 3. Urgent buzz for other ward does not set data-urgent-buzz
    rerender(
      <WardNotificationCenter
        {...defaultProps}
        refreshRequests={[
          {
            unitId: "ward-other",
            at: 540,
            byRole: "coordinator",
            message: "Urgent for other unit",
            urgent: true,
          },
        ]}
      />,
    );

    expect(panel).toHaveAttribute("data-urgent-buzz", "false");
  });

  it("toggles sound preference when clicking the audio toggle button", () => {
    setAudioBuzzPreference(true);

    render(<WardNotificationCenter {...defaultProps} />);

    const toggleBtn = screen.getByTestId("ward-buzz-audio-toggle");
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute("aria-pressed", "true");
    expect(toggleBtn).toHaveTextContent("Buzz sound on");

    // Click to mute
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-pressed", "false");
    expect(toggleBtn).toHaveTextContent("Buzz sound off");
    expect(getAudioBuzzPreference()).toBe(false);

    // Click to unmute
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-pressed", "true");
    expect(getAudioBuzzPreference()).toBe(true);
  });

  it("handles Web Audio synthetic chime player cleanly in jsdom", () => {
    // In jsdom where AudioContext is undefined, playSyntheticUrgentChime returns without error
    expect(() => playSyntheticUrgentChime()).not.toThrow();

    // triggerUrgentBuzzAlert also returns without error
    setAudioBuzzPreference(true);
    expect(() => triggerUrgentBuzzAlert()).not.toThrow();

    // When audio preference is disabled, triggerUrgentBuzzAlert is a no-op
    setAudioBuzzPreference(false);
    expect(() => triggerUrgentBuzzAlert()).not.toThrow();
  });

  it("resolves patient display name from patients collection when movement lacks patientName", () => {
    const patients = [
      {
        id: "PT-001" as const,
        givenName: "John",
        familyName: "Doe",
        sex: "Male" as const,
        dateOfBirth: "1985-05-15",
        umrn: "UM100001",
        suburb: "Perth",
      },
    ];
    const movements = [
      makeMovement({
        id: "WF-001",
        acceptedUnitId: "ward-alpha",
        patientId: "PT-001",
        arrivalDetails: {
          estimatedArrivalAt: 600,
          recordedAt: 500,
          mode: "ambulance",
          recordedBy: "coordinator",
        },
      }),
    ];

    render(<WardNotificationCenter {...defaultProps} now={700} movements={movements} patients={patients} />);

    // Surname first (redesign approved 31 Oct 2026).
    expect(screen.getAllByText("Doe, John").length).toBeGreaterThan(0);
    expect(screen.getAllByText("UM100001").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Name not recorded/)).not.toBeInTheDocument();
  });
});

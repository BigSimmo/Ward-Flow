import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  WardNotificationCenter,
  type WardNotificationCenterProps,
} from "@/components/ward-management/ward/ward-notification-center";
import { type Movement, type Notice } from "@/components/ward-management/ward-model";
import {
  getAudioBuzzPreference,
  setAudioBuzzPreference,
  playSyntheticUrgentChime,
  triggerUrgentBuzzAlert,
} from "@/components/ward-management/shell/ward-sound-store";

const BASE_MOVEMENT: Movement = {
  id: "WF-001",
  originEdId: "ED-001",
  openedAt: 300,
  flaggedUrgent: false,
  urgency: 2,
  cohort: "Adult",
  security: "Open",
  sex: "Female",
  specialling: false,
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
    // Role displayed as State Bed Flow Coordinator
    expect(screen.getAllByText("State Bed Flow Coordinator")).toHaveLength(2);
    // Urgent badge rendered for the urgent buzz
    expect(screen.getByText("Urgent")).toBeInTheDocument();
    // Time formatted
    expect(screen.getByText("09:00")).toBeInTheDocument();
    expect(screen.getByText("09:30")).toBeInTheDocument();

    // Does NOT show buzz for Ward Beta
    expect(screen.queryByText("Bed review for Beta")).not.toBeInTheDocument();

    // Click acknowledge button on first buzz
    const acknowledgeButtons = screen.getAllByRole("button", { name: "Acknowledge Buzz" });
    expect(acknowledgeButtons).toHaveLength(2);

    fireEvent.click(acknowledgeButtons[0]);
    expect(onDismissBuzz).toHaveBeenCalledTimes(1);
    expect(onDismissBuzz).toHaveBeenCalledWith(0);

    fireEvent.click(acknowledgeButtons[1]);
    expect(onDismissBuzz).toHaveBeenCalledTimes(2);
    expect(onDismissBuzz).toHaveBeenCalledWith(2);
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

    // Banner is rendered with exact text
    expect(
      screen.getByText("09:30 Morning Census Overdue — Confirm discharges and allocatable beds"),
    ).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: "Confirm Now" });
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
    expect(
      screen.queryByText("09:30 Morning Census Overdue — Confirm discharges and allocatable beds"),
    ).not.toBeInTheDocument();
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

    // Displays exact format: "Overdue Inbound Arrival: {patientName} (ETA was {ETA}, >60m overdue)"
    expect(screen.getByText("Overdue Inbound Arrival: Jane Doe (ETA was 10:00, >60m overdue)")).toBeInTheDocument();

    // Does not display alert for non-overdue or other ward
    expect(screen.queryByText(/John Connor/)).not.toBeInTheDocument();
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

    expect(screen.getByText("Pending Medical Clearance: Transfer cannot proceed until signed off")).toBeInTheDocument();
    expect(screen.getByText(/Thomas Anderson/)).toBeInTheDocument();

    // Agent Smith was cleared, so no clearance alert
    expect(screen.queryByText(/Agent Smith/)).not.toBeInTheDocument();
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
    const ackButton = screen.getByRole("button", { name: "Acknowledge Notice" });
    fireEvent.click(ackButton);
    expect(onAcknowledgeNotice).toHaveBeenCalledWith("NT-001");
  });

  it("filters correctly between tabs", () => {
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
        arrivalDetails: {
          estimatedArrivalAt: 600,
          recordedAt: 500,
          mode: "mental_health_transport",
          recordedBy: "coordinator",
        },
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

    // "All" tab is active by default: all 3 sections are rendered
    expect(screen.getByText("Coordinator buzz message")).toBeInTheDocument();
    expect(screen.getByText("Overdue Inbound Arrival: Jane Doe (ETA was 10:00, >60m overdue)")).toBeInTheDocument();
    expect(screen.getByText("Direct ward notice message")).toBeInTheDocument();

    // Switch to Coordinator Buzzes tab
    const buzzTab = screen.getByRole("tab", { name: /coordinator buzzes/i });
    fireEvent.click(buzzTab);
    expect(buzzTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Coordinator buzz message")).toBeInTheDocument();
    expect(screen.queryByText(/Overdue Inbound Arrival/)).not.toBeInTheDocument();
    expect(screen.queryByText("Direct ward notice message")).not.toBeInTheDocument();

    // Switch to Urgent Tasks tab
    const urgentTab = screen.getByRole("tab", { name: /urgent tasks/i });
    fireEvent.click(urgentTab);
    expect(urgentTab).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("Coordinator buzz message")).not.toBeInTheDocument();
    expect(screen.getByText("Overdue Inbound Arrival: Jane Doe (ETA was 10:00, >60m overdue)")).toBeInTheDocument();
    expect(screen.queryByText("Direct ward notice message")).not.toBeInTheDocument();

    // Switch to Notices tab
    const noticeTab = screen.getByRole("tab", { name: /notices/i });
    fireEvent.click(noticeTab);
    expect(noticeTab).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("Coordinator buzz message")).not.toBeInTheDocument();
    expect(screen.queryByText(/Overdue Inbound Arrival/)).not.toBeInTheDocument();
    expect(screen.getByText("Direct ward notice message")).toBeInTheDocument();

    // Switch back to All tab
    const allTab = screen.getByRole("tab", { name: /^all/i });
    fireEvent.click(allTab);
    expect(allTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Coordinator buzz message")).toBeInTheDocument();
    expect(screen.getByText("Overdue Inbound Arrival: Jane Doe (ETA was 10:00, >60m overdue)")).toBeInTheDocument();
    expect(screen.getByText("Direct ward notice message")).toBeInTheDocument();
  });

  it("meets accessibility requirements: role=region, aria-live=polite, and tabpanel semantics", () => {
    render(
      <WardNotificationCenter {...defaultProps} morningRollupDeadlinePassed={true} morningRollupConfirmed={false} />,
    );

    const region = screen.getByRole("region", {
      name: "Ward notification and buzzer centre for Ward Alpha",
    });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("aria-live", "polite");

    const tablist = screen.getByRole("tablist", { name: "Notification filters" });
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);

    const tabpanel = screen.getByRole("tabpanel");
    expect(tabpanel).toBeInTheDocument();
    expect(tabpanel).toHaveAttribute("tabindex", "0");
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
    expect(toggleBtn).toHaveAttribute("aria-label", "Mute urgent buzzer audio");

    // Click to mute
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-label", "Enable urgent buzzer audio");
    expect(getAudioBuzzPreference()).toBe(false);

    // Click to unmute
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-label", "Mute urgent buzzer audio");
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
});

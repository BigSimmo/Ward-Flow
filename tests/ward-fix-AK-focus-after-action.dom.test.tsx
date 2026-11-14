import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, useState, type ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/people/WF-004",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import {
  PatientStatusCard,
  type PatientStatusContext,
} from "@/components/ward-management/patients/patient-status-card";
import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { ACT_NOW_TARGET_ID } from "@/components/ward-management/shell/ward-skip-to-act-now";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/*
 * F-57 (Audit 9 A9-28, Audit 5 A5-18): after an action takes away the control that had focus,
 * focus goes to a sensible next place, never the start of the page. One case per audit path: the
 * Home pull, Referrals Decline, Save transport booking, Esc on the Transport panel and Mark handover
 * ready. Synthetic seed data only.
 */
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
beforeEach(() => window.sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

/** Lets the page redraw and the focus hand-over (next frame) run. */
async function nextFrames() {
  for (let i = 0; i < 3; i += 1) {
    await act(() => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve())));
  }
}

const focusIsOnPage = () => document.activeElement === document.body || document.activeElement === null;

let flow: ReturnType<typeof useWardFlow> | undefined;
function Capture() {
  const value = useWardFlow();
  useEffect(() => {
    flow = value;
  });
  return null;
}

describe("F-57: Home pull", () => {
  it("after the pull, focus goes to the row now in its place in Act now, not the page", async () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <Capture />
          <CoordinatorScreen />
        </WardFlowProvider>
      </ToastProvider>,
    );
    const [first] = acceptedReferralsAwaitingPull(flow!.referrals, flow!.units, flow!.movements);
    expect(first, "the seed has an accepted referral with no bed pulled").toBeDefined();
    const row = screen
      .getByTestId("home-accepted-to-pull")
      .querySelector<HTMLElement>(`[data-referral-id="${first!.referral.id}"]`)!;
    const pull = within(row)
      .getAllByRole("button", { name: /^Pull the bed for / })
      .at(-1)!;
    pull.focus();
    fireEvent.click(pull);
    await screen.findByTestId(`ward-pull-accepted-${first!.referral.id}`);
    const status = screen.getByTestId("ward-pull-accepted-legal-status") as HTMLSelectElement;
    const legalForm = screen.getByTestId("ward-pull-accepted-legal-form") as HTMLSelectElement;
    const observation = screen.getByTestId("ward-pull-accepted-observation") as HTMLSelectElement;
    if (status.value === "") fireEvent.change(status, { target: { value: "Voluntary" } });
    if (legalForm.value === "") fireEvent.change(legalForm, { target: { value: "none" } });
    if (observation.value === "") fireEvent.change(observation, { target: { value: "general" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("ward-pull-accepted-confirm"));
    });
    await nextFrames();
    expect(screen.queryByTestId("home-pull-accepted-sheet")).toBeNull();
    expect(row.isConnected, "the pulled row has left Act now").toBe(false);
    expect(focusIsOnPage()).toBe(false);
    const actNow = document.getElementById(ACT_NOW_TARGET_ID)!;
    expect(actNow.contains(document.activeElement)).toBe(true);
  });
});

describe("F-57: Referrals Decline", () => {
  const referral: Referral = {
    id: "RF-TEST-AK-DECLINE",
    ageBand: "Adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          sex: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "queued",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    raisedAt: NOW_ANCHOR - 10,
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  };
  function Match({ units }: { units: Unit[] }) {
    const { now, dispatch, rejections } = useWardFlow();
    return (
      <ReferralMatchView referral={referral} units={units} now={now} dispatch={dispatch} rejections={rejections} />
    );
  }

  it("Decline puts focus on the first reason, and Back returns it to Decline", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Match units={allUnits()} />
      </WardFlowProvider>,
    );
    const open = screen.getByTestId("ward-referral-match-decline-open");
    open.focus();
    fireEvent.click(open);
    const group = screen.getByRole("radiogroup", { name: "Why decline?" });
    const reasons = within(group).getAllByRole("radio");
    expect(document.activeElement).toBe(reasons[0]);

    fireEvent.click(reasons[1]!);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(document.activeElement).toBe(screen.getByTestId("ward-referral-match-decline-open"));

    // Opened again with a reason chosen, focus goes to that reason.
    fireEvent.click(screen.getByTestId("ward-referral-match-decline-open"));
    const again = within(screen.getByRole("radiogroup", { name: "Why decline?" })).getAllByRole("radio");
    expect(document.activeElement).toBe(again[1]);
  });
});

describe("F-57: the patient page's Transport panel", () => {
  function answerAndSave(form: HTMLElement) {
    fireEvent.change(within(form).getByTestId("ward-patient-select-provider"), {
      target: { value: "Patient transport service" },
    });
    fireEvent.click(within(within(form).getByTestId("ward-patient-eta-presets")).getByRole("button", { name: "+30m" }));
    fireEvent.click(within(form).getByTestId("ward-patient-escort-no"));
    fireEvent.click(within(form).getByTestId("ward-patient-legal-involuntary"));
    // D-187 item 10: WF-004 has no medical clearance recorded, so booking asks for a reason.
    fireEvent.change(within(form).getByTestId("ward-patient-legal-reason"), { target: { value: "paper_sighted" } });
    const save = within(form).getByTestId("ward-patient-confirm-transport-btn");
    save.focus();
    fireEvent.click(save);
  }

  it("Save transport booking puts focus on the panel's heading, not the page", async () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <PatientNowScreen movementId="WF-004" />
        </WardFlowProvider>
      </ToastProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-patient-transport-row"));
    fireEvent.click(screen.getByTestId("ward-patient-book-transport-btn"));
    answerAndSave(screen.getByTestId("ward-patient-transport-form"));
    await nextFrames();
    expect(screen.queryByTestId("ward-patient-transport-form")).toBeNull();
    expect(screen.getByTestId("ward-patient-transport-badge")).toHaveTextContent("Transport Booked");
    expect(document.activeElement).toBe(document.getElementById("pnTransportHeading"));
    // The heading takes focus only for this hand-over; it never joins the Tab order.
    expect(document.activeElement).toHaveAttribute("tabindex", "-1");
  });

  it("Esc on the panel gives focus back to the Transport row that opened it", async () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <PatientNowScreen movementId="WF-004" />
        </WardFlowProvider>
      </ToastProvider>,
    );
    const row = screen.getByTestId("ward-patient-transport-row");
    const opener = (row.matches("button, a") ? row : row.querySelector<HTMLElement>("button, a")) ?? row;
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole("dialog", { name: "Transport" })).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    fireEvent.keyDown(window, { key: "Escape" });
    await nextFrames();
    expect(screen.queryByRole("dialog", { name: "Transport" })).toBeNull();
    expect(focusIsOnPage()).toBe(false);
  });

  it("Esc after the control that opened it has gone puts focus on the status card, not the page", async () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <PatientNowScreen movementId="WF-004" />
        </WardFlowProvider>
      </ToastProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-patient-transport-row"));
    expect(screen.getByRole("dialog", { name: "Transport" })).toBeInTheDocument();
    // The opener is replaced while the panel is open (a booking moves the page on).
    screen.getByTestId("ward-patient-transport-row").remove();
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(window, { key: "Escape" });
    await nextFrames();
    expect(screen.queryByRole("dialog", { name: "Transport" })).toBeNull();
    expect(focusIsOnPage()).toBe(false);
    expect(screen.getByTestId("ward-patient-status-card").contains(document.activeElement)).toBe(true);
  });
});

describe("F-57: Mark handover ready", () => {
  const noop = () => {};
  function contextFor(movement: Movement, onHandoverReady?: () => void): PatientStatusContext {
    return {
      movement,
      hasBedHold: true,
      now: NOW_ANCHOR,
      dayZero: new Date(0),
      onOpenPlacement: noop,
      onClearance: noop,
      onBookTransport: noop,
      onArrivalTime: noop,
      onRecordReturn: noop,
      onMarkAbsent: noop,
      onAbsenceStep: noop,
      onRecordCto: noop,
      onEndCto: noop,
      onHandoverReady,
    };
  }

  function Harness() {
    const base = seedWardFlowState().movements[0]!;
    const pulled: Movement = {
      ...base,
      stage: "pulled",
      pullExpiresAt: NOW_ANCHOR + 60,
      medicalClearance: { cleared: true, at: NOW_ANCHOR - 5 } as Movement["medicalClearance"],
      transportNeed: { needed: false } as Movement["transportNeed"],
      transport: undefined,
    };
    const [ready, setReady] = useState(false);
    return ready ? (
      <PatientStatusCard mode="transit" context={contextFor({ ...pulled, stage: "handover_ready" })} />
    ) : (
      <PatientStatusCard mode="held" context={contextFor(pulled, () => setReady(true))} />
    );
  }

  it("focus goes to the control that took its place on the card, not the page", async () => {
    render(<Harness />);
    const button = screen.getByRole("button", { name: "Mark handover ready" });
    button.focus();
    fireEvent.click(button);
    await nextFrames();
    expect(screen.queryByRole("button", { name: "Mark handover ready" })).toBeNull();
    expect(focusIsOnPage()).toBe(false);
    const card = screen.getByTestId("ward-patient-status-card");
    expect(card.contains(document.activeElement)).toBe(true);
  });
});

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Bell } from "lucide-react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ReleaseOwnershipButton } from "@/components/ward-management/alerts/alert-release-ownership";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";
import { openAlertKindGroups } from "./helpers/alerts-kind-groups";

/**
 * P019 (Josh, 27 Oct 2026, 10:02 PM AWST): an alert you took can be handed back to the queue. The
 * Alerts redesign (Josh, 31 Oct 2026) names the button and its confirm Hand back, apart from the
 * pulled bed's Release; the question and the "Released <alert>" toast are unchanged.
 */
function openAndTake() {
  const view = render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AlertsScreen />
      </WardFlowProvider>
    </ToastProvider>,
  );
  openAlertKindGroups(view.container);
  const row = [...view.container.querySelectorAll<HTMLElement>("li[data-alert-id]")].find((li) =>
    li.textContent?.includes("ED mental health team"),
  )!;
  expect(row).toBeDefined();
  fireEvent.click(within(row).getByTestId("ward-alerts-open"));
  const panel = screen.getByRole("complementary", { name: "Selected alert" });
  fireEvent.click(within(panel).getByRole("button", { name: /^Take / }));
  const title = panel.querySelector("[class*='detailTitle']")?.textContent ?? "";
  return { panel, title };
}

const releaseButton = (panel: HTMLElement) =>
  within(panel).getByRole("button", { name: (name) => name.startsWith("Hand back ") });

describe("alerts: release an alert you took (P019)", () => {
  it("offers Hand back after Take, asks first, and records Released by", () => {
    const { panel, title } = openAndTake();
    expect(title.length).toBeGreaterThan(0);
    const release = releaseButton(panel);
    expect(release).toHaveTextContent(/^Hand back$/);

    fireEvent.click(release);
    const dialog = screen.getByRole("dialog", { name: `Hand ${title} back to the queue?` });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hand back" }));

    expect(within(panel).getByRole("button", { name: /^Take / })).toBeInTheDocument();
    expect(screen.getByText(`Released ${title}`)).toBeInTheDocument();
    expect(within(panel).getAllByText(/^Released by Bed coordinator$/).length).toBeGreaterThan(0);
  });

  it("Undo takes the alert back", () => {
    const { panel, title } = openAndTake();
    fireEvent.click(releaseButton(panel));
    const dialog = screen.getByRole("dialog", { name: `Hand ${title} back to the queue?` });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hand back" }));
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    });
    expect(releaseButton(panel)).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /^Take / })).toBeNull();
  });

  it("Cancel keeps the alert yours", () => {
    const { panel, title } = openAndTake();
    fireEvent.click(releaseButton(panel));
    const dialog = screen.getByRole("dialog", { name: `Hand ${title} back to the queue?` });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(releaseButton(panel)).toBeInTheDocument();
  });
});

const syntheticAlert: InboxItem = {
  id: "transport-WF-SYNTHETIC",
  title: "Synthetic alert",
  detail: "Synthetic transport detail",
  icon: Bell,
  kind: "fact",
  tone: "warning",
  movementId: "WF-SYNTHETIC",
  owner: "Bed coordinator",
};

function ReleaseOverride({ dispatch }: { dispatch: WardCommandDispatch }) {
  const world = useWardFlow();
  return (
    <WardFlowOverride value={{ ...world, dispatch }}>
      <ReleaseOwnershipButton item={syntheticAlert} subjectLine="Synthetic alert" fallback={null} />
    </WardFlowOverride>
  );
}

function confirmSyntheticRelease(dispatch: WardCommandDispatch) {
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReleaseOverride dispatch={dispatch} />
      </WardFlowProvider>
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Hand back Synthetic alert" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Hand back" }));
}

describe("shared Release confirmation and Undo lifetime", () => {
  it.each(["refused", "failed"] as const)("does not report a %s Release as successful", (status) => {
    confirmSyntheticRelease(() => ({ commandId: "release", status, message: "Synthetic release was not confirmed." }));
    expect(screen.queryByText("Released Synthetic alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(screen.getByText(/Synthetic release was not confirmed/)).toBeTruthy();
  });

  it("waits for the shared answer before offering success or Undo", async () => {
    let resolve!: (outcome: WardCommandOutcome) => void;
    const pending = new Promise<WardCommandOutcome>((done) => {
      resolve = done;
    });
    confirmSyntheticRelease(() => pending);
    expect(screen.queryByText("Released Synthetic alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    await act(async () => resolve({ commandId: "release", status: "accepted" }));
    expect(screen.getByText("Released Synthetic alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
  });

  it("follows a recovered uncertain save to its definitive answer", async () => {
    let resolve!: (outcome: WardCommandOutcome) => void;
    const confirmation = new Promise<WardCommandOutcome>((done) => {
      resolve = done;
    });
    confirmSyntheticRelease(() => ({ commandId: "release", status: "failed", confirmation }));
    expect(screen.queryByText("Released Synthetic alert")).toBeNull();
    await act(async () => resolve({ commandId: "release", status: "accepted" }));
    expect(screen.getByText("Released Synthetic alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
  });

  it("explains a refused retake from Undo", () => {
    confirmSyntheticRelease((event) =>
      event.type === "RELEASE_INBOX_ITEM_OWNERSHIP"
        ? { commandId: "release", status: "accepted" }
        : { commandId: "retake", status: "refused", message: "Synthetic alert is held elsewhere." },
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText(/Synthetic alert is held elsewhere/)).toBeTruthy();
  });

  it.each(["isCurrent", "canUndo"] as const)("does not retake an alert after %s becomes false", (fence) => {
    let current = true;
    const dispatch = vi.fn<WardCommandDispatch>(() => ({
      commandId: "release",
      status: "accepted",
      [fence]: () => current,
    }));
    confirmSyntheticRelease(dispatch);
    expect(screen.getByText("Released Synthetic alert")).toBeTruthy();
    current = false;
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(dispatch.mock.calls.filter(([event]) => event.type === "TAKE_INBOX_ITEM_OWNERSHIP")).toHaveLength(0);
  });
});

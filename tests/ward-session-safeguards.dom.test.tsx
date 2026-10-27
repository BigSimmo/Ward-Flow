import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { WardIdleLock, recordViewFor } from "@/components/ward-management/shell/ward-access";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import { screenForPath } from "@/components/ward-management/ward-role-access";
import { WARD_BED_MEETING_TV_HREF } from "@/components/ward-management/ward-nav";
import { resetWardAccessStoreForTests } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { SharedSessionContext } from "@/components/ward-management/shell/ward-shared-session-context";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";

const IDLE_MS = CLINICAL_VALUES.idleLock.value * 60_000;

const route = vi.hoisted(() => ({ pathname: null as string | null }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => route.pathname,
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  route.pathname = null;
  resetWardAccessStoreForTests();
  setWardFeatureFlagOnDevice("role-access", null);
  vi.useRealTimers();
});

it("covers the screen after the idle time even with role access switched off (review item 8)", () => {
  setWardFeatureFlagOnDevice("role-access", false);
  render(<WardIdleLock />);
  act(() => vi.advanceTimersByTime(IDLE_MS - 1_000));
  expect(screen.queryByRole("dialog")).toBeNull();
  // Use restarts the clock.
  fireEvent.keyDown(window, { key: "a" });
  act(() => vi.advanceTimersByTime(IDLE_MS - 1_000));
  expect(screen.queryByRole("dialog")).toBeNull();
  act(() => vi.advanceTimersByTime(2_000));
  expect(
    screen.getByRole("dialog", { name: `Locked after ${CLINICAL_VALUES.idleLock.value} minutes without use` }),
  ).toBeVisible();
  fireEvent.click(screen.getByTestId("ward-idle-unlock"));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("leaves the bed meeting TV running, and locks again once the TV page is left (audit F-18)", () => {
  const signOut = vi.fn();
  route.pathname = WARD_BED_MEETING_TV_HREF;
  const tree = () => (
    <SharedSessionContext.Provider value={{ signOut, logRecordView: vi.fn() }}>
      <WardIdleLock />
    </SharedSessionContext.Provider>
  );
  const { rerender } = render(tree());
  act(() => vi.advanceTimersByTime(IDLE_MS * 3));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(signOut).not.toHaveBeenCalled();
  route.pathname = "/ward-flow/coordinator";
  rerender(tree());
  act(() => vi.advanceTimersByTime(IDLE_MS));
  expect(signOut).toHaveBeenCalledTimes(1);
});

it("locks on the TV page when TV views are switched off, since it shows only a notice", () => {
  setWardFeatureFlagOnDevice("bed-meeting-tv", false);
  route.pathname = WARD_BED_MEETING_TV_HREF;
  try {
    render(<WardIdleLock />);
    act(() => vi.advanceTimersByTime(IDLE_MS + 1_000));
    expect(
      screen.getByRole("dialog", { name: `Locked after ${CLINICAL_VALUES.idleLock.value} minutes without use` }),
    ).toBeVisible();
  } finally {
    setWardFeatureFlagOnDevice("bed-meeting-tv", null);
  }
});

it("signs out of the shared workspace when it locks, so the next person needs the password", () => {
  const signOut = vi.fn();
  render(
    <SharedSessionContext.Provider value={{ signOut, logRecordView: vi.fn() }}>
      <WardIdleLock />
    </SharedSessionContext.Provider>,
  );
  act(() => vi.advanceTimersByTime(IDLE_MS));
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("dialog", { name: `Signed out after ${CLINICAL_VALUES.idleLock.value} minutes without use` }),
  ).toBeVisible();
  expect(screen.getByTestId("ward-idle-unlock")).toHaveTextContent("Sign in again");
});

it("asks 'Still there?' for the last minute before an idle sign-out, and says why it signed out (A4-04, A4-05)", () => {
  const signOut = vi.fn();
  render(
    <SharedSessionContext.Provider value={{ signOut, logRecordView: vi.fn() }}>
      <WardIdleLock />
    </SharedSessionContext.Provider>,
  );
  act(() => vi.advanceTimersByTime(IDLE_MS - 60_000));
  expect(screen.getByRole("alertdialog", { name: "Still there?" })).toBeVisible();
  act(() => vi.advanceTimersByTime(20_000));
  expect(screen.getByTestId("ward-idle-countdown")).toHaveTextContent("signed out in 40 seconds");
  fireEvent.click(screen.getByTestId("ward-idle-still-here"));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  act(() => vi.advanceTimersByTime(IDLE_MS - 61_000));
  expect(signOut).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(61_000));
  expect(signOut).toHaveBeenCalledWith(
    `Signed out after ${CLINICAL_VALUES.idleLock.value} minutes without use. Sign in again to carry on.`,
  );
});

it("lets the person at the desk sign out at once from the 'Still there?' prompt", () => {
  const signOut = vi.fn();
  render(
    <SharedSessionContext.Provider value={{ signOut, logRecordView: vi.fn() }}>
      <WardIdleLock />
    </SharedSessionContext.Provider>,
  );
  act(() => vi.advanceTimersByTime(IDLE_MS - 60_000));
  fireEvent.click(screen.getByRole("button", { name: "Sign out now" }));
  // No reason: a deliberate sign-out, in every tab, as the menu's Sign out does.
  expect(signOut).toHaveBeenCalledWith();
});

it("signs out, not rearms, when activity comes after the idle deadline (a woken laptop)", () => {
  const signOut = vi.fn();
  render(
    <SharedSessionContext.Provider value={{ signOut, logRecordView: vi.fn() }}>
      <WardIdleLock />
    </SharedSessionContext.Provider>,
  );
  // The clock moves on while the timers are held, as when a laptop sleeps.
  vi.setSystemTime(Date.now() + IDLE_MS + 5_000);
  fireEvent.keyDown(window, { key: "a" });
  expect(signOut).toHaveBeenCalledTimes(1);
});

it("logs the person a patient or movement page shows, and nothing on other pages (review item 9)", () => {
  const movements = [{ id: "WF-012", patientId: "PT-0042" as const }];
  expect(recordViewFor(screenForPath(patientHref("PT-0001")), movements)).toEqual({
    patientId: "PT-0001",
    surface: "patient",
  });
  // A movement is traced to its patient, on either page.
  expect(recordViewFor(screenForPath(movementHref("WF-012")), movements)).toEqual({
    patientId: "PT-0042",
    surface: "movement",
  });
  expect(recordViewFor(screenForPath(patientHref("WF-012")), movements)).toEqual({
    patientId: "PT-0042",
    surface: "patient",
  });
  expect(recordViewFor(screenForPath("/ward-flow/capacity"), movements)).toBeUndefined();
});

it("says '1 second', and signs out at once when woken after the deadline (audit 24-3 SM-5)", () => {
  const signOut = vi.fn();
  const tree = (
    <SharedSessionContext.Provider value={{ signOut, logRecordView: vi.fn() }}>
      <WardIdleLock />
    </SharedSessionContext.Provider>
  );
  const { unmount } = render(tree);
  act(() => vi.advanceTimersByTime(IDLE_MS - 1_000));
  expect(screen.getByTestId("ward-idle-countdown")).toHaveTextContent(/signed out in 1 second\.$/);
  unmount();
  render(tree);
  vi.setSystemTime(Date.now() + IDLE_MS + 5_000);
  act(() => vi.advanceTimersByTime(IDLE_MS - 60_000));
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId("ward-idle-countdown")).toBeNull();
});

it("stays unlocked after 'Carry on' and the next tap, then locks again after a new idle time", () => {
  render(<WardIdleLock />);
  act(() => vi.advanceTimersByTime(IDLE_MS + 1_000));
  fireEvent.click(screen.getByTestId("ward-idle-unlock"));
  fireEvent.pointerDown(window);
  expect(screen.queryByRole("dialog")).toBeNull();
  act(() => vi.advanceTimersByTime(IDLE_MS + 1_000));
  expect(
    screen.getByRole("dialog", { name: `Locked after ${CLINICAL_VALUES.idleLock.value} minutes without use` }),
  ).toBeVisible();
});

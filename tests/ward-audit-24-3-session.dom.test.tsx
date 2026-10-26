import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { endWardFlowTabSession } from "@/components/ward-management/ward-browser-data";
import { WardSharedSaveStatus } from "@/components/ward-management/ward-shared-save-status";
import type { WardSharedConnection } from "@/components/ward-management/ward-shared-access";

// Audit 24-3 SM-4: one consistent message, by whether the board itself is current.
const status = (boardCurrent: boolean, error: string) =>
  render(
    <WardSharedSaveStatus
      deskLabel="Coordinator"
      connection={{ status: "unavailable", error, boardCurrent, retry: () => {} } as unknown as WardSharedConnection}
    />,
  );

it("drops 'Connection unavailable' when only a save waits on Retry (SM-4)", () => {
  const { unmount } = status(
    true,
    "Your last change was not confirmed. The board is up to date. Press Retry to send it.",
  );
  expect(screen.getAllByRole("status")[0]).toHaveTextContent(
    /^Your last change was not confirmed\. The board is up to date\. Press Retry to send it\./,
  );
  expect(screen.queryByText(/Connection unavailable/)).toBeNull();
  unmount();
  status(false, "The shared board could not be refreshed. Reconnect before making changes.");
  expect(screen.getAllByRole("status")[0]).toHaveTextContent(
    /^Connection unavailable, so changes are switched off\. Press Retry/,
  );
});

it("a this-tab-only sign-out sweeps this tab's session storage and leaves shared local storage (SM-1)", () => {
  window.sessionStorage.setItem("ward-flow:auth:zakzoemeedfepxcstsou:v1", "{}");
  window.sessionStorage.setItem("wf-draft:synthetic", "draft");
  window.localStorage.setItem("ward-flow-shared-test", "kept");
  endWardFlowTabSession();
  expect(window.sessionStorage.getItem("ward-flow:auth:zakzoemeedfepxcstsou:v1")).toBeNull();
  expect(window.sessionStorage.getItem("wf-draft:synthetic")).toBeNull();
  expect(window.localStorage.getItem("ward-flow-shared-test")).toBe("kept");
  window.localStorage.removeItem("ward-flow-shared-test");
});

it("SM-1: a this-tab-only sign-out keeps My wards pins, which the other tab shares", async () => {
  const { MY_WARDS_STORAGE_KEY } = await import("@/components/ward-management/shell/ward-my-wards-store");
  window.localStorage.setItem(MY_WARDS_STORAGE_KEY, JSON.stringify(["alb-adult-open"]));
  endWardFlowTabSession();
  expect(window.localStorage.getItem(MY_WARDS_STORAGE_KEY)).toBe(JSON.stringify(["alb-adult-open"]));
  window.localStorage.removeItem(MY_WARDS_STORAGE_KEY);
});

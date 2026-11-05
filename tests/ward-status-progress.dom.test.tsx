import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { publishLiveRefresh } from "../src/components/wf/live";
import { WardSharedSaveStatus } from "../src/components/ward-management/ward-shared-save-status";
import type { WardSharedConnection } from "../src/components/ward-management/ward-shared-access";

afterEach(() => {
  publishLiveRefresh(undefined);
  vi.useRealTimers();
});
it("labels five-minute-old data stale using the actual last successful refresh", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-04T03:00:00Z"));
  const receivedAt = Date.now() - 300_001;
  publishLiveRefresh({ unavailable: false, receivedAt, staleAfterMs: 6000 });
  render(
    <WardSharedSaveStatus
      deskLabel="Coordinator"
      connection={
        {
          enabled: true,
          status: "ready",
          receivedAt,
          retry: () => {},
          signOut: () => {},
        } as unknown as WardSharedConnection
      }
    />,
  );
  await act(async () => {});
  expect(screen.getByTestId("ward-shared-status-bar")).toHaveTextContent(/Stale.*last updated/i);
});
it("shows retry progress and prevents a second retry until the first attempt settles", async () => {
  let complete!: () => void;
  const retry = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  render(
    <WardSharedSaveStatus
      deskLabel="Coordinator"
      connection={
        {
          enabled: true,
          status: "unavailable",
          receivedAt: 0,
          retry,
          signOut: () => {},
        } as unknown as WardSharedConnection
      }
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(screen.getByTestId("ward-shared-status-bar")).toHaveTextContent(/Retrying/);
  expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  await act(async () => complete());
  expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  expect(retry).toHaveBeenCalledTimes(1);
});

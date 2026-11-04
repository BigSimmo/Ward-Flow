import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ broken: true }));
vi.mock("../src/components/ward-management/alerts/broadcast-live-card", () => ({
  BroadcastLiveCard: () => <p>Live broadcast</p>,
  EarlierBroadcasts: () => {
    if (state.broken) throw new Error("SYNTHETIC_PRIVATE_SENTINEL");
    return <p>Earlier broadcast</p>;
  },
}));
import { AlertsBroadcastsPanel } from "../src/components/ward-management/alerts/alerts-tab-panels";
import type { BroadcastAlert } from "../src/components/ward-management/alerts/ward-broadcast-model";

afterEach(() => {
  state.broken = true;
  vi.restoreAllMocks();
});
it("keeps live broadcast actions usable when the earlier list fails, then retries that list", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const onLive = vi.fn();
  render(
    <AlertsBroadcastsPanel
      live={<button onClick={onLive}>Live action</button>}
      anyLive
      pastBroadcasts={[{ id: "synthetic" } as BroadcastAlert]}
      units={[]}
      movements={[]}
      now={0}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Earlier broadcasts could not be shown");
  fireEvent.click(screen.getByRole("button", { name: "Live action" }));
  expect(onLive).toHaveBeenCalledOnce();
  state.broken = false;
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(screen.getByText("Earlier broadcast")).toBeVisible();
  expect(screen.getByRole("button", { name: "Live action" })).toBeVisible();
});

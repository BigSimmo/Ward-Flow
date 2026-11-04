import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { requestFrontDoorPass } from "../src/components/ward-management/front-door/front-door-pass-client";
import { FrontDoorPage } from "../src/components/ward-management/front-door/front-door-page";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("bounds a pending demo sign-in and allows retry without late navigation", async () => {
  vi.useFakeTimers();
  let resolveOld!: (response: Response) => void;
  const replace = vi.fn();
  vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, replace } as Location);
  const fetcher = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveOld = resolve;
        }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetcher);
  render(<FrontDoorPage next="/ward-flow/discharges" mode="demo-code" tv={false} />);
  fireEvent.change(screen.getByLabelText("Demo code"), { target: { value: "SYNTHETIC-CODE" } });
  fireEvent.click(screen.getByRole("button", { name: "Open the demo" }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15_001);
  });
  expect(screen.getByRole("button", { name: "Open the demo" })).toBeEnabled();
  expect(screen.getByText("No connection.")).toBeVisible();
  await act(async () => {
    resolveOld(new Response(null, { status: 204 }));
  });
  expect(replace).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Open the demo" }));
  await act(async () => {});
  expect(replace).toHaveBeenCalledExactlyOnceWith("/ward-flow/discharges");
});

it("describes same-tab persistence instead of promising reload resets", () => {
  render(<FrontDoorPage next="/ward-flow" mode="demo-code" tv={false} />);
  expect(screen.queryByText(/Changes reset when you reload/)).not.toBeInTheDocument();
  expect(screen.getByText(/Changes are kept in this tab/)).toBeVisible();
});

it("also bounds a response whose headers arrive but whose body never completes", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(async () => new Response(new ReadableStream({ start() {} }), { status: 503 }));
  vi.stubGlobal("fetch", fetcher);
  const result = requestFrontDoorPass({ demoCode: "SYNTHETIC-CODE" });
  await vi.advanceTimersByTimeAsync(15_001);
  expect(await result).toBeNull();
});

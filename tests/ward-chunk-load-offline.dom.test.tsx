import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AppShellErrorBoundary from "@/app/error";
import { WardFlowErrorPanel } from "@/app/ward-flow/ward-flow-error-panel";
import { isChunkLoadError as hostIsChunkLoadError } from "@/lib/chunk-load-error";
import { isChunkLoadError as wardIsChunkLoadError } from "@/components/ward-management/ward-chunk-load-error";

/**
 * Design re-score DR-01 (24 Oct 2026): going offline while a page was still loading made a late
 * script or style file fail, and the app-wide boundary said "an unexpected error occurred in the
 * application shell" and stayed that way after the connection came back. A failed file load now
 * shows the connection message and reloads the page once when the connection returns.
 */

function chunkError(): Error {
  const error = new Error("Loading chunk 482 failed.\n(error: https://example.test/_next/static/chunks/482.js)");
  error.name = "ChunkLoadError";
  return error;
}

let reload: ReturnType<typeof vi.fn>;

beforeEach(() => {
  reload = vi.fn();
  vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload } as Location);
  vi.spyOn(console, "error").mockImplementation(() => {});
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

function goOnline() {
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
  act(() => {
    window.dispatchEvent(new Event("online"));
  });
}

describe("recognising a failed page file", () => {
  it.each([
    ["webpack ChunkLoadError", chunkError()],
    ["CSS chunk", new Error("Loading CSS chunk 17 failed. (https://example.test/_next/static/css/17.css)")],
    ["dynamic import", new TypeError("Failed to fetch dynamically imported module: https://example.test/a.js")],
    ["Safari module script", new TypeError("Importing a module script failed.")],
    ["failed <link> or <script> event", new Event("error")],
  ])("treats a %s as a load failure (host and ward copies agree)", (_label, error) => {
    expect(hostIsChunkLoadError(error)).toBe(true);
    expect(wardIsChunkLoadError(error)).toBe(true);
  });

  it.each([
    ["ordinary error", new Error("Cannot read properties of undefined")],
    ["guard message", new Error("unhandled movement stage")],
    ["non-error event", new Event("click")],
    ["nothing", undefined],
  ])("leaves an %s alone", (_label, error) => {
    expect(hostIsChunkLoadError(error)).toBe(false);
    expect(wardIsChunkLoadError(error)).toBe(false);
  });
});

describe("the application shell boundary", () => {
  it("shows the offline message for a failed file and reloads once when the connection returns", () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    render(<AppShellErrorBoundary error={chunkError()} retry={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("You are offline");
    expect(screen.getByRole("alert").textContent).toContain("reload by itself when the connection returns");
    expect(screen.queryByText(/unexpected error occurred in the application shell/)).toBeNull();
    expect(reload).not.toHaveBeenCalled();

    goOnline();
    expect(reload).toHaveBeenCalledTimes(1);

    // A second online event (or a flapping connection) never reloads again.
    goOnline();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("asks for a reload, without reloading by itself, when the file failed while online", () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
    render(<AppShellErrorBoundary error={chunkError()} retry={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Part of this page did not load");
    expect(reload).not.toHaveBeenCalled();
  });

  it("keeps the shell message for any other error and never reloads on reconnect", () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    render(<AppShellErrorBoundary error={new Error("boom")} retry={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Something went wrong");
    expect(screen.getByText(/unexpected error occurred in the application shell/)).toBeTruthy();

    goOnline();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("the ward flow boundary panel", () => {
  const props = {
    retry: vi.fn(),
    title: "This ward screen could not be shown",
    description: "Try again keeps the same prototype state.",
    logLabel: "ward:",
    testId: "ward-flow-error-boundary",
  };

  it("shows the offline message for a failed file and reloads once when the connection returns", () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    render(<WardFlowErrorPanel {...props} error={chunkError()} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("You are offline");
    goOnline();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("keeps its own title for any other error", () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    render(<WardFlowErrorPanel {...props} error={new Error("boom")} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(props.title);
    goOnline();
    expect(reload).not.toHaveBeenCalled();
  });
});

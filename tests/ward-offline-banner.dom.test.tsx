import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardOfflineBanner } from "@/components/ward-management/shell/ward-offline-banner";

function setOnline(value: boolean) {
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(value);
}

describe("WardOfflineBanner", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows nothing while the browser is online", () => {
    setOnline(true);
    render(<WardOfflineBanner />);
    expect(screen.queryByTestId("ward-offline-banner")).toBeNull();
  });

  it("appears on the offline event and goes away on the online event", () => {
    setOnline(true);
    render(<WardOfflineBanner />);
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByRole("status").textContent).toMatch(/^Offline\./);
    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByTestId("ward-offline-banner")).toBeNull();
  });

  it("writes nothing to browser storage", () => {
    setOnline(false);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(<WardOfflineBanner />);
    expect(setItem).not.toHaveBeenCalled();
  });
});

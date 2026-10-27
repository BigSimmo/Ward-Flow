import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/wf/toast-provider";
import { WardOfflineLinks } from "@/components/ward-management/shell/ward-offline-links";
import { WARD_OFFLINE_SAVED_NOTE } from "@/components/ward-management/ward-offline-copy";

/*
 * P133 (approved by Josh, 27 Oct 2026): the offline link notice says plainly that the page
 * will open once the connection is back. The body line is the existing text, unchanged.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

describe("P133: offline link notice wording", () => {
  it("shows the approved title and keeps the existing body", () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    render(
      <ToastProvider offlineNote={WARD_OFFLINE_SAVED_NOTE}>
        <WardOfflineLinks />
        <a href="/ward-flow/elsewhere">Elsewhere</a>
      </ToastProvider>,
    );
    const link = screen.getByRole("link", { name: "Elsewhere" });
    act(() => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });
    const toast = screen.getByTestId("toast");
    expect(toast).toHaveTextContent("You're offline. This page will open when the connection is back.");
    expect(toast).toHaveTextContent("This page keeps working.");
  });
});

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
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
  expect(screen.getAllByRole("status")[0]).toHaveTextContent(/^Connection unavailable — changes are disabled\./);
});

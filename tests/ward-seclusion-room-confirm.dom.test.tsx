import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SeclusionScreen } from "@/components/ward-management/restrictive-practice/seclusion-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** P090 (Josh, 27 Oct 2026, option A): both seclusion room status buttons ask before they save. */
function renderScreen() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <SeclusionScreen />
    </WardFlowProvider>,
  );
}

function wardName(): string {
  const picker = screen.getByTestId("seclusion-ward") as HTMLSelectElement;
  return picker.options[picker.selectedIndex]!.text;
}

afterEach(cleanup);

describe("P090 seclusion room confirm", () => {
  it("asks before marking the room out of service, and Cancel saves nothing", () => {
    renderScreen();
    const before = screen.getByTestId("seclusion-room-status").textContent;
    fireEvent.click(screen.getByTestId("seclusion-room-out-of-service"));
    const dialog = screen.getByRole("dialog", { name: "Mark seclusion room out of service?" });
    expect(dialog).toHaveTextContent(
      `${wardName()}'s seclusion room will show as out of service to everyone until it is marked available again.`,
    );
    expect(screen.getByTestId("seclusion-room-status").textContent).toBe(before);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("seclusion-room-status").textContent).toBe(before);
  });

  it("saves out of service, then asks before marking it available", () => {
    renderScreen();
    fireEvent.click(screen.getByTestId("seclusion-room-out-of-service"));
    const first = screen.getByRole("dialog", { name: "Mark seclusion room out of service?" });
    fireEvent.click(within(first).getByRole("button", { name: "Mark out of service" }));
    expect(screen.getByTestId("seclusion-room-status")).toHaveTextContent(/^Out of service · recorded by/);

    fireEvent.click(screen.getByTestId("seclusion-room-available"));
    const second = screen.getByRole("dialog", { name: "Mark seclusion room available?" });
    expect(second).toHaveTextContent(`${wardName()}'s seclusion room will show as available to everyone.`);
    fireEvent.click(within(second).getByRole("button", { name: "Mark available" }));
    expect(screen.getByTestId("seclusion-room-status")).toHaveTextContent(/^Available · recorded by/);
  });
});

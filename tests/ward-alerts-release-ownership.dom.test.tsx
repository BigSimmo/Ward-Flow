import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

/** P019 (Josh, 27 Oct 2026, 10:02 PM AWST): an alert you took can be handed back to the queue. */
function openAndTake() {
  const view = render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AlertsScreen />
      </WardFlowProvider>
    </ToastProvider>,
  );
  const row = [...view.container.querySelectorAll<HTMLElement>("li[data-alert-id]")].find((li) =>
    li.textContent?.includes("ED mental health team"),
  )!;
  expect(row).toBeDefined();
  fireEvent.click(within(row).getByTestId("ward-alerts-open"));
  const panel = screen.getByRole("complementary", { name: "Selected alert" });
  fireEvent.click(within(panel).getByRole("button", { name: /^Take / }));
  const title = panel.querySelector("[class*='detailTitle']")?.textContent ?? "";
  return { panel, title };
}

const releaseButton = (panel: HTMLElement) =>
  within(panel).getByRole("button", { name: (name) => name.startsWith("Release ") && !name.includes("pulled bed") });

describe("alerts: release an alert you took (P019)", () => {
  it("offers Release after Take, asks first, and records Released by", () => {
    const { panel, title } = openAndTake();
    expect(title.length).toBeGreaterThan(0);
    const release = releaseButton(panel);
    expect(release).toHaveTextContent(/^Release$/);

    fireEvent.click(release);
    const dialog = screen.getByRole("dialog", { name: `Hand ${title} back to the queue?` });
    fireEvent.click(within(dialog).getByRole("button", { name: "Release" }));

    expect(within(panel).getByRole("button", { name: /^Take / })).toBeInTheDocument();
    expect(screen.getByText(`Released ${title}`)).toBeInTheDocument();
    expect(within(panel).getAllByText(/^Released by Bed coordinator$/).length).toBeGreaterThan(0);
  });

  it("Undo takes the alert back", () => {
    const { panel, title } = openAndTake();
    fireEvent.click(releaseButton(panel));
    const dialog = screen.getByRole("dialog", { name: `Hand ${title} back to the queue?` });
    fireEvent.click(within(dialog).getByRole("button", { name: "Release" }));
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    });
    expect(releaseButton(panel)).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /^Take / })).toBeNull();
  });

  it("Cancel keeps the alert yours", () => {
    const { panel, title } = openAndTake();
    fireEvent.click(releaseButton(panel));
    const dialog = screen.getByRole("dialog", { name: `Hand ${title} back to the queue?` });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(releaseButton(panel)).toBeInTheDocument();
  });
});

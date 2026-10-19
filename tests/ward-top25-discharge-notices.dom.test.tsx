import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { WardDischargeNotices } from "@/components/ward-management/ward/ward-discharge-notices";
import type { SupportServiceType } from "@/components/ward-management/ward-support-notifications";

/** Top 25 item 1: confirming a discharge offers the support notices once sending is connected. */
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

function confirmFirstRelease() {
  const state = seedWardFlowStateAt(0);
  const unit = state.units.find((candidate) =>
    state.bedReleases.some((release) => release.unitId === candidate.id && release.state === "expected"),
  )!;
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardScreen unitId={unit.id} />
    </WardFlowProvider>,
  );
  const confirm = screen.getAllByRole("button", { name: "Confirm Ready", hidden: true })[0];
  fireEvent.click(confirm);
}

describe("discharge support notices", () => {
  it("confirms the discharge without offering notices nobody can send", () => {
    confirmFirstRelease();
    const card = screen.getByTestId("ward-discharge-notices");
    expect(card).toHaveTextContent("Discharge confirmed");
    expect(within(card).queryByRole("button", { name: "Send notice" })).toBeNull();
    expect(within(card).queryByText(/not wired/iu)).toBeNull();
    fireEvent.click(within(card).getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("ward-discharge-notices")).toBeNull();
  });

  it("shows sent status only after the caller supplies the confirmed service", () => {
    const onSendService = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <WardDischargeNotices bedLabel="Bed 1" dueSoonHours={null} onSendService={onSendService} onClose={onClose} />,
    );
    const card = screen.getByTestId("ward-discharge-notices");
    fireEvent.click(within(card).getAllByRole("button", { name: "Send notice" })[0]!);
    expect(onSendService).toHaveBeenCalledExactlyOnceWith("pharmacy");
    expect(within(card).queryByText("Sent")).toBeNull();
    expect(within(card).queryByRole("button", { name: "Notice sent" })).toBeNull();

    rerender(
      <WardDischargeNotices
        bedLabel="Bed 1"
        dueSoonHours={null}
        sentServices={new Set<SupportServiceType>(["pharmacy"])}
        onSendService={onSendService}
        onClose={onClose}
      />,
    );
    expect(within(card).getByText("Sent")).toBeTruthy();
    const sentButton = within(card).getByRole("button", { name: "Notice sent" });
    expect(sentButton).toHaveAttribute("aria-pressed", "true");
    expect(sentButton).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(sentButton);
    expect(onSendService).toHaveBeenCalledTimes(1);
  });
});

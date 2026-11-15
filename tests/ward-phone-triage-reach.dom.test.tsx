// Triage on the phone (Josh, 15 Nov 2026, D-NNN): the bed coordinator's phone reaches Start a triage
// from the Menu, straight after Referrals, and from the + sheet as a full row with how many referrals
// await triage, not a quiet link at the sheet's foot. All data here is synthetic.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { NextPhoneMenu } from "@/components/ward-management/shell-next/next-phone-menu";
import { openWardMenu } from "@/components/ward-management/shell/ward-drawer-bus";
import { resetWardAccessStoreForTests } from "@/components/ward-management/shell/ward-access-store";
import { ToastProvider } from "@/components/wf/toast-provider";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

afterEach(() => {
  cleanup();
  resetWardAccessStoreForTests();
  installMatchMediaStub(false);
});

function renderPhoneMenu() {
  installMatchMediaStub(true);
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <NextPhoneMenu
          returnFocusRef={createRef<HTMLButtonElement>()}
          tasksCount={0}
          activityUnread={0}
          onOpenDrawer={() => {}}
          onNewReferral={() => {}}
        />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

describe("triage on the coordinator's phone (D-NNN)", () => {
  it("lists Start a triage in the Menu straight after Referrals", async () => {
    renderPhoneMenu();
    act(() => openWardMenu(null));
    const triage = await screen.findByRole("link", { name: /^Start a triage/u }, { timeout: 15_000 });
    expect(triage).toHaveAttribute("href", "/ward-flow/triage/new");
    const referrals = screen.getByRole("link", { name: /^Referrals/u });
    expect(referrals.closest("li")?.nextElementSibling).toContainElement(triage);
  });

  it("names triage on the + and leads its sheet with a New triage row", async () => {
    renderPhoneMenu();
    const plus = await screen.findByTestId("ward-phone-create", {}, { timeout: 15_000 });
    expect(plus).toHaveAccessibleName("Create: new referral, triage, delay, bed or patient");
    fireEvent.click(plus);
    const sheet = await screen.findByTestId("ward-phone-create-sheet", {}, { timeout: 15_000 });
    const rows = within(within(sheet).getByTestId("ward-phone-create-coordinator")).getAllByRole("listitem");
    const triage = within(sheet).getByTestId("ward-phone-create-triage");
    expect(rows[0]).toContainElement(triage);
    expect(triage).toHaveAttribute("href", "/ward-flow/triage/new");
    expect(triage).toHaveTextContent(/New triage \d+ awaiting triage/u);
    expect(within(sheet).getAllByRole("link", { name: /New triage/u })).toHaveLength(1);
  });
});

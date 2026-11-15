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
import {
  CREATE_SHEET_STORAGE_KEY,
  parseCreateSheet,
  resetCreateSheetForTests,
  resolveCreateLayout,
} from "@/components/ward-management/shell/ward-create-sheet-store";
import { ToastProvider } from "@/components/wf/toast-provider";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

afterEach(() => {
  cleanup();
  resetWardAccessStoreForTests();
  resetCreateSheetForTests();
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

async function openCreate() {
  renderPhoneMenu();
  fireEvent.click(await screen.findByTestId("ward-phone-create", {}, { timeout: 15_000 }));
  return screen.findByTestId("ward-phone-create-sheet", {}, { timeout: 15_000 });
}

const pinnedLabels = (sheet: HTMLElement) =>
  within(within(sheet).getByTestId("ward-phone-create-coordinator"))
    .getAllByRole("listitem")
    .map((row) => row.textContent ?? "");

describe("Edit the coordinator's + sheet (Josh, 15 Nov 2026)", () => {
  it("pins a quick link as a full row and keeps it on this device", async () => {
    const sheet = await openCreate();
    expect(within(within(sheet).getByTestId("ward-phone-create-links")).getByText("Update a bed")).toBeInTheDocument();
    fireEvent.click(within(sheet).getByTestId("ward-phone-create-edit"));
    expect(within(sheet).getByTestId("ward-phone-create-edit")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(sheet).getByRole("button", { name: "Pin Update a bed" }));
    expect(within(sheet).getByRole("button", { name: "Unpin Update a bed" })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByTestId("ward-phone-create-edit"));
    expect(pinnedLabels(sheet).at(-1)).toMatch(/^Update a bed/u);
    expect(parseCreateSheet(window.localStorage.getItem(CREATE_SHEET_STORAGE_KEY))?.pinned).toContain("wards");
  });

  it("unpins a row to the quick links and moves rows up and down", async () => {
    const sheet = await openCreate();
    fireEvent.click(within(sheet).getByTestId("ward-phone-create-edit"));
    expect(within(sheet).getByRole("button", { name: "Move New triage up" })).toBeDisabled();
    fireEvent.click(within(sheet).getByRole("button", { name: "Move Log a call up" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Unpin Remind me" }));
    fireEvent.click(within(sheet).getByTestId("ward-phone-create-edit"));
    expect(pinnedLabels(sheet)[0]).toMatch(/^Log a call/u);
    expect(pinnedLabels(sheet)[1]).toMatch(/^New triage/u);
    expect(pinnedLabels(sheet).some((label) => label.startsWith("Remind me"))).toBe(false);
    expect(
      within(within(sheet).getByTestId("ward-phone-create-links")).getByRole("button", { name: "Remind me" }),
    ).toBeInTheDocument();
  });

  it("resets to the standard sheet", async () => {
    const sheet = await openCreate();
    fireEvent.click(within(sheet).getByTestId("ward-phone-create-edit"));
    expect(within(sheet).queryByTestId("ward-phone-create-reset")).toBeNull();
    fireEvent.click(within(sheet).getByRole("button", { name: "Unpin New triage" }));
    fireEvent.click(within(sheet).getByTestId("ward-phone-create-reset"));
    expect(window.localStorage.getItem(CREATE_SHEET_STORAGE_KEY)).toBeNull();
    fireEvent.click(within(sheet).getByTestId("ward-phone-create-edit"));
    expect(pinnedLabels(sheet)[0]).toMatch(/^New triage/u);
  });
});

describe("the + sheet arrangement store", () => {
  it("keeps known ids once each and reads anything else as the standard sheet", () => {
    expect(parseCreateSheet("not json")).toBeNull();
    expect(parseCreateSheet(JSON.stringify(["triage"]))).toBeNull();
    expect(
      parseCreateSheet(JSON.stringify({ pinned: ["triage", "triage", "<b>"], links: ["triage", "wards"] })),
    ).toEqual({
      pinned: ["triage"],
      links: ["wards"],
    });
  });

  it("puts a start the person never placed in its standard group, and drops one this desk cannot start", () => {
    const layout = resolveCreateLayout(
      { pinned: ["wards", "remind"], links: ["call-log"] },
      new Set(["wards", "call-log", "triage", "add-patient"] as const),
    );
    expect(layout).toEqual({ pinned: ["wards", "triage"], links: ["call-log", "add-patient"] });
  });
});

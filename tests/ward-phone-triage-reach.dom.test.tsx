// Triage on the phone (Josh, 15 Nov 2026, D-247): the bed coordinator's phone reaches Start a triage
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
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
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
  act(() => setWardFeatureFlagOnDevice("role-access", null));
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

describe("triage on the coordinator's phone (D-247)", () => {
  it("lists Start a triage in the Menu straight after Referrals", async () => {
    renderPhoneMenu();
    act(() => openWardMenu(null));
    const triage = await screen.findByRole("link", { name: /^Start a triage/u }, { timeout: 15_000 });
    expect(triage).toHaveAttribute("href", "/ward-flow/triage/new");
    const referrals = screen.getByRole("link", { name: /^Referrals/u });
    expect(referrals.closest("li")?.nextElementSibling).toContainElement(triage);
  });

  // Review on PR #1691: these desks carry Referrals in the dock, so the Menu has no Referrals row.
  it.each([
    ["ward", { role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } }],
    ["ED", { role: "ed", scope: { kind: "ed", edId: "fsh-ed" } }],
    ["community", { role: "community", scope: { kind: "team", teamName: "Albany" } }],
  ] as const)("lists Start a triage in the %s desk's Menu too", async (_desk, access) => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess(access as never);
    });
    renderPhoneMenu();
    act(() => openWardMenu(null));
    const triage = await screen.findByRole("link", { name: /^Start a triage/u }, { timeout: 15_000 });
    expect(triage).toHaveAttribute("href", "/ward-flow/triage/new");
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
    expect(within(sheet).queryByRole("button", { name: "Move New triage up" })).toBeNull();
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
      hidden: [],
    });
  });

  it("puts a start the person never placed in its standard group, and drops one this desk cannot start", () => {
    const layout = resolveCreateLayout(
      { pinned: ["wards", "remind"], links: ["call-log"] },
      new Set(["wards", "call-log", "triage", "add-patient"] as const),
    );
    expect(layout).toEqual({
      primary: null,
      pinned: ["wards", "triage"],
      links: ["call-log", "add-patient"],
      hidden: [],
    });
  });

  // More starts (Josh, 16 Nov 2026): the extra Tools starts stay off the sheet until added.
  it("keeps the extra starts under Not shown, and New referral as the big button, until chosen", () => {
    const layout = resolveCreateLayout(null, new Set(["referral", "triage", "bed-finder", "contacts"] as const));
    expect(layout).toEqual({ primary: "referral", pinned: ["triage"], links: [], hidden: ["bed-finder", "contacts"] });
  });

  it("reads a chosen big button, never listing it twice, and puts New referral back in the list", () => {
    const stored = parseCreateSheet(
      JSON.stringify({ primary: "triage", pinned: ["triage", "call-log"], links: [], hidden: ["<b>"] }),
    );
    expect(stored).toEqual({ primary: "triage", pinned: ["call-log"], links: [], hidden: [] });
    expect(resolveCreateLayout(stored, new Set(["referral", "triage", "call-log"] as const))).toEqual({
      primary: "triage",
      pinned: ["referral", "call-log"],
      links: [],
      hidden: [],
    });
    // A big button this desk cannot start now falls back to New referral.
    expect(resolveCreateLayout(stored, new Set(["referral", "call-log"] as const)).primary).toBe("referral");
  });
});

describe("Customise the + sheet (Josh, 16 Nov 2026)", () => {
  it("adds an extra start, takes one off, and says Customise", async () => {
    const sheet = await openCreate();
    fireEvent.click(within(sheet).getByTestId("ward-phone-create-edit"));
    expect(within(sheet).getByRole("heading", { name: "Customise" })).toBeInTheDocument();
    const notShown = within(sheet).getByTestId("ward-phone-create-edit-hidden");
    expect(within(notShown).getByRole("button", { name: "Add Find a bed" })).toBeInTheDocument();
    fireEvent.click(within(notShown).getByRole("button", { name: "Add Find a bed" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Remove Remind me" }));
    fireEvent.click(within(sheet).getByTestId("ward-phone-create-edit"));
    const links = within(sheet).getByTestId("ward-phone-create-links");
    expect(within(links).getByRole("button", { name: "Find a bed" })).toBeInTheDocument();
    expect(within(sheet).queryByTestId("ward-phone-create-remind")).toBeNull();
    expect(parseCreateSheet(window.localStorage.getItem(CREATE_SHEET_STORAGE_KEY))?.hidden).toContain("remind");
  });

  it("makes New triage the big button and moves New referral into the list", async () => {
    const sheet = await openCreate();
    expect(within(sheet).getByTestId("ward-phone-create-referral")).toHaveTextContent("New referral");
    fireEvent.click(within(sheet).getByTestId("ward-phone-create-edit"));
    fireEvent.click(within(sheet).getByTestId("ward-phone-create-main-change"));
    const choices = within(sheet).getByTestId("ward-phone-create-main-choices");
    expect(within(choices).getByRole("button", { name: "New referral" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(choices).getByRole("button", { name: "New triage" }));
    fireEvent.click(within(sheet).getByTestId("ward-phone-create-edit"));
    expect(pinnedLabels(sheet)[0]).toMatch(/^New referral/u);
    const triage = within(sheet).getByTestId("ward-phone-create-triage");
    expect(triage).toHaveAttribute("href", "/ward-flow/triage/new");
    expect(triage.closest("ul")).toBeNull();
    expect(parseCreateSheet(window.localStorage.getItem(CREATE_SHEET_STORAGE_KEY))?.primary).toBe("triage");
  });
});

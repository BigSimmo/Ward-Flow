import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef, useEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { openWardMenu } from "@/components/ward-management/shell/ward-drawer-bus";
import { WardPhoneMenu } from "@/components/ward-management/shell/ward-phone-menu";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { findPatients, patientListName, type Patient } from "@/components/ward-management/ward-patients";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

let seeded: readonly Patient[] = [];
function Probe() {
  const { patients } = useWardFlow();
  useEffect(() => {
    seeded = patients;
  }, [patients]);
  return null;
}

function openMenu() {
  installMatchMediaStub(true);
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Probe />
        <WardPhoneMenu
          returnFocusRef={createRef<HTMLButtonElement>()}
          tasksCount={0}
          activityUnread={0}
          onOpenDrawer={() => {}}
          onNewReferral={() => {}}
        />
      </WardFlowProvider>
    </ToastProvider>,
  );
  act(() => openWardMenu(null));
  return screen.getByTestId("ward-phone-menu-search");
}

afterEach(() => installMatchMediaStub(false));

describe("phone menu search", () => {
  it("explains when the menu returns only the first 40 people", () => {
    const input = openMenu();
    expect(findPatients(seeded, "a").length).toBeGreaterThan(40);
    fireEvent.change(input, { target: { value: "a" } });
    const people = screen.getByRole("region", { name: "People" });
    const button = within(people).getByRole("button", { name: "Show first 40" });
    expect(within(people).getByText("First 40 matches. Refine your search to see other matches.")).toBeInTheDocument();
    fireEvent.click(button);
    expect(within(people).getAllByRole("link")).toHaveLength(40);
    expect(within(people).queryByRole("button", { name: /Show all/ })).not.toBeInTheDocument();
  });
  it("finds a patient by name, not only page names", () => {
    const input = openMenu();
    const patient = seeded[0];
    fireEvent.change(input, { target: { value: patient.familyName } });
    const people = screen.getByRole("region", { name: "People" });
    const link = within(people)
      .getAllByRole("link")
      .find((row) => row.textContent?.includes(patientListName(patient)));
    expect(link).toBeDefined();
  });

  it("still lists matching pages first", () => {
    const input = openMenu();
    fireEvent.change(input, { target: { value: "Referrals" } });
    expect(screen.getByRole("region", { name: "Pages" })).toHaveTextContent("Referrals");
  });

  it("lists Waiting once, not again as its Escalation alias", () => {
    const input = openMenu();
    fireEvent.change(input, { target: { value: "delays" } });
    const delays = screen.getAllByRole("link").filter((row) => row.textContent?.startsWith("Waiting"));
    expect(delays).toHaveLength(1);
  });

  it("says so plainly when nothing matches", () => {
    const input = openMenu();
    fireEvent.change(input, { target: { value: "zzqqxx" } });
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
  });
});

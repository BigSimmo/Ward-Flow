import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { toldAgo } from "@/components/ward-management/movements/support-notification-checklist";
import { AddPatientForm } from "@/components/ward-management/patients/add-patient";
import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { useDeviceChoice } from "@/components/ward-management/shell/use-device-choice";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Smart features idea 9 (19 Oct 2026): defaults a person can see and change, never legal ones. */

afterEach(() => {
  cleanup();
  discardReferralDraft();
  resetWardAccessStoreForTests();
  setWardFeatureFlagOnDevice("role-access", null);
  window.localStorage.clear();
});

function atDesk(access: WardAccess) {
  setWardFeatureFlagOnDevice("role-access", true);
  setWardAccess(access);
}

function openReferral() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardReferralDrawer onClose={vi.fn()} initialCategory="ward" />
    </WardFlowProvider>,
  );
  fireEvent.click(
    within(screen.getByRole("group", { name: "Referral sections" })).getByRole("button", { name: "Referral" }),
  );
}

describe("a referral starts from the desk's own place", () => {
  it("an ED desk refers from its own ED, and can change it", () => {
    atDesk({ role: "ed", scope: { kind: "ed", edId: "rph-ed" } });
    openReferral();
    const origin = screen.getByLabelText(/Referring emergency department/) as HTMLSelectElement;
    expect(origin.value).toBe("RPH");
    fireEvent.change(origin, { target: { value: "" } });
    expect(origin.value).toBe("");
  });

  it("a community desk refers from its own team", () => {
    atDesk({ role: "community", scope: { kind: "team", teamName: "Bentley" } });
    openReferral();
    expect((screen.getByLabelText(/Referring community service/) as HTMLInputElement).value).toBe("Bentley");
  });

  it("the whole-network view starts blank", () => {
    openReferral();
    const origin = screen.queryByLabelText(/Referring emergency department/) as HTMLSelectElement | null;
    const team = screen.queryByLabelText(/Referring community service/) as HTMLInputElement | null;
    expect(origin?.value ?? team?.value ?? "").toBe("");
  });
});

describe("adding a patient at an ED desk", () => {
  it("names the desk's own ED as the presenting facility", () => {
    atDesk({ role: "ed", scope: { kind: "ed", edId: "rph-ed" } });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AddPatientForm />
      </WardFlowProvider>,
    );
    expect((screen.getByLabelText(/Presenting facility/) as HTMLSelectElement).value).toBe("rph-ed");
  });
});

describe("told a little while ago", () => {
  it("fills the time and the day, across midnight too", () => {
    const now = NOW_ANCHOR as Instant;
    expect(toldAgo(now, 15).time).toBe(formatInstant((now - 15) as Instant));
    const justAfterMidnight = (Math.floor(now / 1440) * 1440 + 10) as Instant;
    expect(toldAgo(justAfterMidnight, 30)).toEqual({ time: "23:40", day: "1" });
    expect(toldAgo(justAfterMidnight, 5)).toEqual({ time: "00:05", day: "0" });
  });
});

function Arrangement() {
  const [order, setOrder] = useDeviceChoice("ward_flow_choice_test_order", ["longest", "most"] as const, "longest");
  return (
    <button type="button" onClick={() => setOrder("most")}>
      {order}
    </button>
  );
}

describe("a screen's arrangement is remembered on this device", () => {
  it("keeps the last choice, and ignores a stored value off the list", () => {
    const first = render(<Arrangement />);
    expect(screen.getByRole("button")).toHaveTextContent("longest");
    act(() => fireEvent.click(screen.getByRole("button")));
    expect(screen.getByRole("button")).toHaveTextContent("most");
    first.unmount();
    render(<Arrangement />);
    expect(screen.getByRole("button")).toHaveTextContent("most");
    cleanup();
    window.localStorage.setItem("ward_flow_choice_test_order", "a typed name");
    render(<Arrangement />);
    expect(screen.getByRole("button")).toHaveTextContent("longest");
  });
});

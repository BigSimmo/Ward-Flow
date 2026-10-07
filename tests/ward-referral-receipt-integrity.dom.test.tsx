import React, { type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/referrals/new",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
import { ReferralIntakeForm } from "@/components/ward-management/referrals/referral-intake";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";
import { COHORTS, SEXES, REFERRAL_GENDERS, HOME_REGIONS } from "@/components/ward-management/ward-model";
function Latest() {
  const { referrals } = useWardFlow();
  return <output data-testid="latest">{JSON.stringify(referrals.at(-1))}</output>;
}
describe("accepted referral receipt", () => {
  it("retains the accepted urgency and bed request after resetting the next draft", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralIntakeForm />
        <Latest />
      </WardFlowProvider>,
    );
    // v6 (7 Oct 2026): Age band and Sex are segmented radio groups; the rest are still selects.
    const select = (name: string, value: string) => {
      const control = screen.getByTestId(`ward-referral-intake-${name}`);
      const radio = control.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`);
      if (radio) fireEvent.click(radio);
      else fireEvent.change(control, { target: { value } });
    };
    select("ageBand", COHORTS[0]);
    select("sex", SEXES[0]);
    select("gender", REFERRAL_GENDERS[0]);
    select("homeRegion", HOME_REGIONS[0]);
    select("suburb", "Armadale");
    select("source", "community");
    select("urgency", "1");
    select("originSiteCode", wardSites[0].code);
    for (const name of ["secureBedNeeded", "highAcuityNursingNeeded", "transportNeeded"])
      fireEvent.click(screen.getByTestId(`ward-referral-intake-${name}-no`));
    fireEvent.click(screen.getByTestId("ward-referral-intake-involuntaryBedNeeded-yes"));
    fireEvent.click(screen.getByTestId("ward-referral-intake-destination-psychiatric_ward"));
    fireEvent.change(screen.getByTestId("ward-referral-intake-history"), {
      target: { value: "Synthetic receipt regression scenario." },
    });
    const submit = screen.getByTestId("ward-referral-intake-submit");
    expect(submit).not.toHaveAttribute("aria-disabled");
    submit.focus();
    fireEvent.click(submit);
    const dialog = screen.getByRole("dialog");
    const accepted = JSON.parse(screen.getByTestId("latest").textContent!);
    expect(dialog.querySelector("#receiptRefId")).toHaveTextContent(accepted.id);
    expect(dialog.querySelector("#receiptUrgency")).toHaveTextContent(/1/);
    expect(dialog.querySelector("#receiptLegal")).toHaveTextContent("Yes");
    expect(screen.getByTestId("ward-referral-intake-history")).toHaveValue("");
    expect(dialog).not.toHaveTextContent(/Form 1A|transmitted|dispatched/i);
    expect(within(dialog).getByRole("heading", { name: "Referral recorded locally" })).toBeInTheDocument();
    expect(dialog).toHaveTextContent("No external transmission");
    expect(dialog.contains(document.activeElement)).toBe(true);
    const last = within(dialog).getByRole("link", { name: "View Active Referrals" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(last);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(submit).toHaveFocus();
  });
});

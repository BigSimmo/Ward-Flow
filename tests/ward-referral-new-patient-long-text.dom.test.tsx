// Long names and suburbs warn, never block (Josh, 5 Nov 2026), in the referral sheet's new-patient
// form as on Add a patient. Synthetic data only.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/ed/rph-ed",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  discardReferralDraft();
  window.sessionStorage.clear();
});

it("keeps every character of a long name or suburb and warns instead of capping", () => {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardReferralDrawer onClose={vi.fn()} />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByTestId("ward-referral-new-patient-toggle"));
  const form = within(screen.getByTestId("ward-referral-new-patient"));
  const family = form.getByLabelText(/Family name/) as HTMLInputElement;
  const given = form.getByLabelText(/Given name/) as HTMLInputElement;
  const suburb = form.getByLabelText(/Suburb/) as HTMLInputElement;

  fireEvent.change(family, { target: { value: "Synthetic".padEnd(100, "x") } });
  expect(form.queryByText("Long name. Check it is right.")).not.toBeInTheDocument();

  const longName = "Synthetic".padEnd(101, "x");
  const longSuburb = "Testville".padEnd(120, "y");
  fireEvent.change(family, { target: { value: longName } });
  fireEvent.change(given, { target: { value: longName } });
  fireEvent.change(suburb, { target: { value: longSuburb } });

  for (const input of [family, given, suburb]) expect(input).not.toHaveAttribute("maxlength");
  expect(family.value).toBe(longName);
  expect(suburb.value).toBe(longSuburb);
  expect(form.getAllByText("Long name. Check it is right.")).toHaveLength(2);
  expect(form.getByText("Long suburb. Check it is right.")).toBeInTheDocument();
  expect(family).toHaveAccessibleDescription(expect.stringContaining("Long name. Check it is right."));
  expect(suburb).toHaveAccessibleDescription(expect.stringContaining("Long suburb. Check it is right."));
  expect(form.getByRole("button", { name: "Add and use for this referral" })).toBeEnabled();

  // The warning never blocks: the long record is added and used for the referral.
  fireEvent.change(form.getByLabelText(/Date of birth/), { target: { value: "15/05/1991" } });
  fireEvent.change(form.getByLabelText(/UMRN/), { target: { value: "UM999101" } });
  fireEvent.click(form.getByRole("button", { name: "Add and use for this referral" }));
  expect(screen.queryByTestId("ward-referral-new-patient")).not.toBeInTheDocument();
  expect(screen.getAllByText(new RegExp(`^${longName}, ${longName}`)).length).toBeGreaterThan(0);
});

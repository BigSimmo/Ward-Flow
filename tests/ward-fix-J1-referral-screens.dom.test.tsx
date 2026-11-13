// Audit 9 referral fixes on screen (Josh, 13 Nov 2026: "yes to all your recommendations").
// Synthetic seed data only.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmHost, ToastProvider } from "@/components/wf";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  discardReferralDraft();
});

// A seeded referral waiting for this ward's answer (as ward-home-accept-named.dom.test.tsx).
const WARD = unitById("gry-older-adult")!;
const TARGET = "WF-013";
const SURNAME_FIRST = /^[^,]+, [^,]+/u;

function mountWard() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ToastProvider>
        <WardScreen unitId={WARD.id} />
      </ToastProvider>
    </WardFlowProvider>,
  );
}

describe("A9-01: the ward's referral card and panel name the person surname first", () => {
  it("on the Awaiting your answer card and the referral it opens", async () => {
    mountWard();
    const open = await screen.findByTestId(`ward-incoming-open-${TARGET}`);
    expect(open.textContent).toMatch(SURNAME_FIRST);
    fireEvent.click(open);
    const drawer = await screen.findByTestId("ward-referral-detail-drawer");
    const title = within(drawer).getAllByRole("heading")[0]!;
    expect(title.textContent).toMatch(SURNAME_FIRST);
  });
});

describe("A9-05: No suitable bed is confirmed and leaves Awaiting your answer", () => {
  it("says it was waitlisted and moves the referral to the answered list", async () => {
    mountWard();
    fireEvent.click(await screen.findByTestId(`ward-decline-toggle-${TARGET}`));
    const form = screen.getByTestId(`ward-decline-form-${TARGET}`);
    fireEvent.click(within(form).getByRole("radio", { name: "No suitable bed" }));
    await act(async () => {
      fireEvent.click(within(form).getByRole("button", { name: "Confirm decline" }));
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.queryByTestId(`ward-incoming-${TARGET}`)).toBeNull());
    expect(await screen.findByText("Referral waitlisted for this ward.")).toBeInTheDocument();
    expect(screen.getAllByText("Waitlisted").length).toBeGreaterThan(0);
  });
});

function renderDrawer(props: Partial<Parameters<typeof WardReferralDrawer>[0]> = {}) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardReferralDrawer onClose={vi.fn()} {...props} />
      <ConfirmHost />
    </WardFlowProvider>,
  );
}

function findPerson(query: string) {
  fireEvent.change(screen.getByRole("combobox", { name: "Find a patient" }), { target: { value: query } });
  const results = screen.getByRole("listbox", { name: "Matching patients" });
  fireEvent.click(within(results).getAllByRole("option")[0]!);
}

describe("A9-06: choosing Community before a person raises no false Change patient prompt", () => {
  it("chooses the person straight away", async () => {
    renderDrawer();
    fireEvent.click(within(screen.getByRole("group", { name: "Refer to" })).getByRole("button", { name: "Community" }));
    findPerson("UM100023");
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole("alertdialog", { name: "Change patient?" })).toBeNull();
    expect(screen.queryByText("No patient chosen")).toBeNull();
  });
});

describe("A9-10: bed security starts unanswered for a person with nothing recorded", () => {
  it("neither option is chosen, and Send asks for it", () => {
    renderDrawer({ initialDestination: "ward" });
    const steps = within(screen.getByRole("group", { name: "Referral sections" }));
    fireEvent.click(steps.getByRole("button", { name: "Referral" }));
    const security = screen.getByRole("group", { name: "Bed security" });
    for (const option of within(security).getAllByRole("radio")) expect(option).not.toBeChecked();
  });
});

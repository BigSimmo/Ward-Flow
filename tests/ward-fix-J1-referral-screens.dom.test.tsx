// Audit 9 referral fixes on screen (Josh, 13 Nov 2026: "yes to all your recommendations").
// Synthetic seed data only.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/wf";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

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

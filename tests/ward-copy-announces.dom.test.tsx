import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const announce = vi.hoisted(() => vi.fn());
vi.mock("@/components/ward-management/shell/ward-live-region", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/shell/ward-live-region")>()),
  announceToWardShell: announce,
}));

import { useLegalFormsCopy } from "@/components/ward-management/legal-forms/use-legal-forms-copy";
import { BedMeetingSheet, type ScopedMeetingRow } from "@/components/ward-management/referrals/bed-meeting-sheet";
import { bedsReadySummary } from "@/components/ward-management/referrals/referral-board-parts";
import { IsbarSheet } from "@/components/ward-management/referrals/referral-board-sheets";
import { ReferralSummarySheet } from "@/components/ward-management/referrals/referral-summary-sheet";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Design audit (Josh, 1 Nov 2026): a copy button says its result aloud through the kit's one
 * announcer, as well as on the button, and a refused copy is visible rather than looking as if
 * nothing happened. Synthetic seed data only.
 */

const COPIED = "Copied to the clipboard.";
const FAILED = "Could not copy. Check clipboard access and try again.";
const state = seedWardFlowState();
const referral = referralQueueOrder(state.referrals)[0]!;

function clipboard(works: boolean) {
  const writeText = works ? vi.fn().mockResolvedValue(undefined) : vi.fn().mockRejectedValue(new Error("denied"));
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  // The fallback path refuses too, so a failed write really fails.
  Object.defineProperty(document, "execCommand", { value: () => false, configurable: true });
}

const sheets: [string, () => ReactNode, string][] = [
  [
    "ISBAR summary",
    () => (
      <IsbarSheet
        open
        onClose={() => undefined}
        referral={referral}
        name="SMITH, Alex"
        umrn="UM100001"
        demographics="34 F"
        now={NOW_ANCHOR}
      />
    ),
    "Copy summary",
  ],
  [
    "Referral summary",
    () => (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralSummarySheet
          open
          onClose={() => undefined}
          referral={referral}
          name="SMITH, Alex"
          umrn="UM100001"
          demographics="34 F"
          now={NOW_ANCHOR}
        />
      </WardFlowProvider>
    ),
    "Copy summary",
  ],
  [
    "Bed meeting list",
    () => {
      const rows: ScopedMeetingRow[] = [{ referral, name: "SMITH, Alex", umrn: "UM100001", restricted: false }];
      return (
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <BedMeetingSheet
            open
            onClose={() => undefined}
            rows={rows}
            scopeLabel="Statewide"
            now={NOW_ANCHOR}
            summary={bedsReadySummary(state.units, state.admissions, state.bedReleases, NOW_ANCHOR)}
          />
        </WardFlowProvider>
      );
    },
    "Copy 1",
  ],
];

beforeEach(() => {
  announce.mockClear();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copy buttons announce their result", () => {
  it.each(sheets)("%s: a copy says Copied, on the button and aloud", async (_name, sheet, label) => {
    clipboard(true);
    render(<>{sheet()}</>);
    fireEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() => expect(announce).toHaveBeenCalledWith(COPIED));
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it.each(sheets)("%s: a refused copy shows Could not copy and says why", async (_name, sheet, label) => {
    clipboard(false);
    render(<>{sheet()}</>);
    fireEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() => expect(announce).toHaveBeenCalledWith(FAILED));
    expect(screen.getByRole("button", { name: "Could not copy" })).toBeInTheDocument();
    expect(announce).not.toHaveBeenCalledWith(COPIED);
  });

  it("Legal forms: a copy is announced, and a refused copy is announced when no toast region is there", async () => {
    clipboard(true);
    const { result } = renderHook(() => useLegalFormsCopy());
    await act(() => result.current.copyText("summary", "Synthetic text"));
    expect(result.current.copied).toBe("summary");
    expect(announce).toHaveBeenCalledWith(COPIED);

    clipboard(false);
    await act(() => result.current.copyText("summary", "Synthetic text"));
    expect(result.current.copyNotice).toBe(FAILED);
    expect(announce).toHaveBeenCalledWith(FAILED);
  });
});

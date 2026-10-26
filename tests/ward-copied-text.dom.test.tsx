import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { WardLiveRegion } from "@/components/ward-management/shell/ward-live-region";
import { LAST_LOOK_STORAGE_KEY, takeLastLookSnapshot } from "@/components/ward-management/coordinator/since-last-look";
import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { bedsReadySummary, type MeetingRow } from "@/components/ward-management/referrals/referral-board-parts";
import { BedMeetingSheet, IsbarSheet } from "@/components/ward-management/referrals/referral-board-sheets";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WF_PHONE_QUERY } from "@/components/wf/use-is-phone";

/**
 * D-71 item 7 (Josh, 21 Oct 2026): every Ward Flow copy goes through `copyTextToClipboard`, so a
 * pasted copy always opens with the synthetic line and never carries a record number or date of
 * birth. These render the real screens, press the real copy button and read what reached the
 * clipboard, so a screen that bypasses the helper, or a helper that stops stripping, fails here.
 */

const NOW = NOW_ANCHOR;
const UMRN = /UM\d{6}/;

let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

beforeEach(() => {
  writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The one text the copy put on the clipboard, after the button's promise settles. */
async function copied(): Promise<string> {
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  return writeText.mock.calls[0]![0];
}

function expectSafeCopy(text: string) {
  const lines = text.split("\n");
  expect(lines[0]).toBe("Synthetic prototype.");
  // Anti-vacuity: the copy carries more than the synthetic line.
  expect(lines.slice(1).join("").trim().length).toBeGreaterThan(0);
  expect(text).not.toMatch(UMRN);
  for (const line of lines) expect(line).not.toMatch(/^\s*(UMRN|DOB)/i);
}

describe("copied text from Ward Flow screens opens with the synthetic line and carries no UMRN", () => {
  it("Discharges: Copy summary", async () => {
    render(
      <WardFlowProvider initialNow={NOW}>
        <DischargeBoard />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-discharge-copy"));
    const text = await copied();
    expectSafeCopy(text);
    expect(text).toMatch(/^Discharges, /m);
  });

  it("Home on a phone: the Since you looked sheet's Copy as handover text", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === WF_PHONE_QUERY,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    // A remembered look missing one referral and one ready bed, so the hero shows the pill.
    const state = seedWardFlowState();
    const snapshot = takeLastLookSnapshot(
      {
        scenario: state.scenario,
        referrals: state.referrals,
        movements: state.movements,
        units: state.units,
        bedReleases: state.bedReleases,
      },
      NOW,
      DEFAULT_DUE_SOON_THRESHOLDS,
    );
    const droppedReferral = snapshot.referralIds[snapshot.referralIds.length - 1]!;
    const unitId = Object.keys(snapshot.readyByUnit).find((id) => snapshot.readyByUnit[id]! > 0)!;
    window.sessionStorage.setItem(
      LAST_LOOK_STORAGE_KEY,
      JSON.stringify({
        ...snapshot,
        at: NOW - 60,
        referralIds: snapshot.referralIds.filter((id) => id !== droppedReferral),
        readyByUnit: { ...snapshot.readyByUnit, [unitId]: snapshot.readyByUnit[unitId]! - 1 },
      }),
    );

    render(
      <WardFlowProvider initialNow={NOW}>
        <WardLiveRegion />
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /(new since|since you looked at) \d\d:\d\d/ }));
    const sheet = await screen.findByTestId("ward-home-since-sheet");
    fireEvent.click(within(sheet).getByRole("button", { name: "Copy as handover text" }));
    const text = await copied();
    expectSafeCopy(text);
    expect(text.split("\n")[1]).toMatch(/^Since you looked: /);
    // H-0346: the copy is announced, in the Handover page's words.
    await waitFor(() =>
      expect(screen.getByTestId("ward-live-region").textContent).toContain("Changes copied as handover text."),
    );
  });

  describe("Referral board sheets", () => {
    const state = seedWardFlowState();
    const resolverState = { patients: state.patients, referrals: state.referrals, movements: state.movements };
    const queued = referralQueueOrder(state.referrals);
    const rows: MeetingRow[] = queued.map((referral) => {
      const person = resolveSubjectPatient(referral, resolverState);
      return { referral, name: person.displayName, umrn: person.umrn };
    });

    it("Bed meeting list: Copy list", async () => {
      expect(rows.length).toBeGreaterThan(0);
      // Anti-vacuity: the seeded rows really carry record numbers for the copy to leave out.
      expect(rows.some((row) => UMRN.test(row.umrn))).toBe(true);
      render(
        <BedMeetingSheet
          open
          onClose={() => undefined}
          rows={rows}
          now={NOW}
          summary={bedsReadySummary(state.units, state.bedReleases, state.leaveBeds, NOW)}
        />,
      );
      expect(screen.getByTestId("ward-referral-meeting-table")).toHaveTextContent(UMRN);
      fireEvent.click(screen.getByRole("button", { name: "Copy list" }));
      const text = await copied();
      expectSafeCopy(text);
      expect(text.split("\n")[1]).toMatch(/^1\. T\d /);
    });

    it("ISBAR summary: Copy summary leaves out the UMRN the sheet still shows", async () => {
      const referral = queued[0]!;
      render(
        <IsbarSheet
          open
          onClose={() => undefined}
          referral={referral}
          name={rows[0]!.name}
          umrn="UM100001"
          demographics="34 F"
          now={NOW}
        />,
      );
      expect(screen.getByRole("dialog")).toHaveTextContent("UM100001");
      fireEvent.click(screen.getByRole("button", { name: "Copy summary" }));
      const text = await copied();
      expectSafeCopy(text);
      expect(text).not.toContain("UM100001");
      expect(text).toContain(`Identify: ${rows[0]!.name}, 34 F.`);
      expect(text).toMatch(/^Recommendation: /m);
    });
  });
});

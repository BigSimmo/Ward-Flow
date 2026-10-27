// B3 P170 (27 Oct 2026): an activity row that names a patient links to that patient's record.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/ward/rph-adult-secure",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return {
    ...actual,
    useWardFlow: () => mockContext,
    useWardFlowSelect: () => mockContext,
    useOptionalWardFlowSelect: () => mockContext,
    useUnscopedWardFlow: () => mockContext,
    useDueSoonThresholds: () => dueSoonThresholdsOf(mockContext?.configuration),
    useWardNetwork: () => activeWardNetwork(),
    useWardFlowClock: () => mockContext.now,
  };
});

import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { deriveCommandActivity } from "@/components/ward-management/shell/ward-command-activity";
import type { WardActivityContent } from "@/components/ward-management/shell/ward-shell-types";
import { patientChronologyHref } from "@/components/ward-management/reports/report-routes";
import { dueSoonThresholdsOf, DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { activeWardNetwork, NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";

const seeded = seedWardFlowState();
const mockContext = {
  ...seeded,
  notices: [],
  now: NOW_ANCHOR,
  dayZero: new Date(0),
  dispatch: vi.fn(),
  focusMovementId: undefined,
  setFocusMovementId: vi.fn(),
};

describe("activity rows link to the record (P170)", () => {
  it("gives a referral row the patient's record link", () => {
    const result = deriveCommandActivity({
      ...seeded,
      now: NOW_ANCHOR,
      sites: wardSites,
      thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
    });
    const row = result.content.changes.find((change) => change.id.startsWith("referral-raised:"));
    expect(row).toBeDefined();
    const referral = seeded.referrals.find((item) => row!.id === `referral-raised:${item.id}`)!;
    const patientId = resolveSubjectPatient(referral, seeded).patient?.id;
    expect(patientId).toBeDefined();
    expect(row!.href).toBe(patientChronologyHref(patientId!));
  });

  it("renders a linked row as a link and an unlinked row as plain text", async () => {
    const activity: WardActivityContent = {
      pageTitle: "Ward 2K",
      tiles: [],
      changes: [
        {
          id: "a",
          time: "09:00",
          text: "UM100001 triaged.",
          category: "referral",
          href: patientChronologyHref("PT-1"),
        },
        { id: "b", time: "09:01", text: "Capacity refresh requested.", category: "other" },
      ],
    };
    if (typeof window.requestAnimationFrame !== "function") {
      window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
    }
    const user = userEvent.setup();
    render(<WardBar activity={activity} />);
    await user.click(screen.getByTestId("ward-bar-activity-trigger"));
    expect(screen.getByRole("link", { name: "UM100001 triaged." })).toHaveAttribute(
      "href",
      patientChronologyHref("PT-1"),
    );
    expect(screen.queryByRole("link", { name: "Capacity refresh requested." })).toBeNull();
    expect(screen.getByText("Capacity refresh requested.")).toBeInTheDocument();
  });
});

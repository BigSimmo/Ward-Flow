import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Admission } from "@/components/ward-management/ward-admissions";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { LeaveBed } from "@/components/ward-management/ward-model";
import { SAMPLE_OBSERVATION_MIX_LABEL } from "@/components/ward-management/ward-sample-choices";
import { NOW_ANCHOR, STANDARD_WARD_SITES } from "@/components/ward-management/ward-sites";
import { WardHomeTab } from "@/components/ward-management/ward/ward-home-tab";
import { WardIndex } from "@/components/ward-management/wards/ward-index";

// The independent clinical review's R2 (the ward home's Act now row) and question 8 (All wards'
// observation staff), drawn on screen in place of reading the source as text (CQ-10). Synthetic data only.

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/wards",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// All wards shows Observation staff in use on the phone's ward sheet.
const device = vi.hoisted(() => ({ phone: false }));
vi.mock("@/components/wf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/wf")>()),
  useIsPhone: () => device.phone,
}));

afterEach(() => {
  cleanup();
  device.phone = false;
});

const unit = STANDARD_WARD_SITES.flatMap((site) => site.units).find(
  (candidate) => candidate.id === "rph-adult-secure",
)!;

const props: ComponentProps<typeof WardHomeTab> = {
  unit,
  units: [unit],
  capacity: { available: 2, occupied: 18 },
  accepted: [],
  incoming: [],
  withdrawn: [],
  overridesHere: [],
  now: NOW_ANCHOR,
  shiftSheetOpen: true,
  presentation: "overview",
  activeAnswerIndex: 0,
  setAnswerIndex: vi.fn(),
  visibleIncoming: [],
  declineOpenFor: null,
  toggleDecline: vi.fn(),
  declineReason: undefined,
  setDeclineReason: vi.fn(),
  submitDecline: vi.fn(),
  priorRejectionCountRef: { current: 0 },
  rejections: [],
  dispatch: vi.fn(),
  setCheckToken: vi.fn(),
  recentAnswers: [],
  breakdown: { confirmedToday: 0, expectedToday: 0, onLeave: 0 },
  pendingBedReleasesCount: 0,
  unitLeaveBedsCount: 0,
  resolvePatientIdentity: vi.fn(),
  lastActionRejection: null,
  overrideReasonForm: vi.fn(),
  liveFormAlerts: [],
};

describe('R2: the ward home\'s Act now row no longer says "order stays in force" (D-187 item 8)', () => {
  it("states only that the person is missing and since when", () => {
    const absence = {
      leaveBed: { id: "LB-SYN-R2", admissionId: "ADM-SYN-R2", absentWithoutLeave: { since: NOW_ANCHOR - 30 } },
      admission: { id: "ADM-SYN-R2" },
    } as unknown as { leaveBed: LeaveBed & { absentWithoutLeave: { since: number } }; admission: Admission };
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardHomeTab {...props} absencesOnOrder={[absence as never]} />
      </WardFlowProvider>,
    );
    const title = screen.getAllByText("Absent without leave on an order")[0]!;
    const row = title.closest("li") ?? title.parentElement!;
    expect(row).toHaveTextContent(/missing since /u);
    expect(document.body).not.toHaveTextContent("order stays in force");
  });
});

describe("Question 8: All wards labels Observation staff in use as the sample (D-189 item 2)", () => {
  it("names the sample observation mix beside the figure on a ward's phone sheet", () => {
    device.phone = true;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardIndex />
      </WardFlowProvider>,
    );
    const row = screen.getAllByRole("button").find((button) => button.getAttribute("aria-haspopup") === "dialog")!;
    fireEvent.click(row);
    const sheet = within(screen.getByTestId("ward-index-phone-sheet"));
    const facts = sheet.getByText("Observation staff in use").nextElementSibling!;
    expect(within(facts as HTMLElement).getByTestId("ward-index-obs-sample")).toHaveTextContent(
      SAMPLE_OBSERVATION_MIX_LABEL,
    );
  });
});

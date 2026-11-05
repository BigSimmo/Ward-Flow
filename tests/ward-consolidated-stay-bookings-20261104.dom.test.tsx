import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { act } from "react";
import { BellRing } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/ward/fre-adult-open",
  useSearchParams: () => new URLSearchParams("bookings=1"),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { INBOX_CATEGORIES } from "@/components/ward-management/ward-flow-reducer";
import { supportNotificationTaskId } from "@/components/ward-management/ward-support-notifications";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { HomePlacementDrawer } from "@/components/ward-management/coordinator/home-placement-drawer";
import type { QueueEntry } from "@/components/ward-management/alerts/alerts-queue";
import { alertActionFor } from "@/components/ward-management/alerts/alerts-model";
import { dischargeHref, unitHref } from "@/components/ward-management/shell/ward-facade";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { setWardAccess, resetWardAccessStoreForTests } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { ROLE_SCREENS } from "@/components/ward-management/ward-role-access";
const seed = seedWardFlowState();
afterEach(() => {
  resetWardAccessStoreForTests();
  window.localStorage.clear();
});
describe("ward bookings and departed stay task destinations", () => {
  it("keeps a departed-stay task's own action when its original movement still exists", () => {
    const movement = seed.movements[0]!;
    const admissionId = "AD-SYNTHETIC-DEPARTED";
    const item: QueueEntry["item"] = {
      id: supportNotificationTaskId("discharge", admissionId),
      kind: INBOX_CATEGORIES.support_notification_discharge.kind,
      tone: "warning",
      icon: BellRing,
      title: "Discharge notifications to record",
      detail: "Carer not recorded",
      owner: "Ward",
      movementId: movement.id,
      admissionId,
    };
    const subject = {
      displayName: "Synthetic person",
      from: "Synthetic ward",
      patientHref: "/ward-flow/people/synthetic",
    } as QueueEntry["subject"];
    const action = alertActionFor(item, subject);
    const entry = {
      item,
      movement,
      subject,
      action,
      group: "wait",
      owner: "Ward",
      mine: false,
      highlighted: false,
    } as QueueEntry;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <HomePlacementDrawer
          subject={{ kind: "alert", entry }}
          now={NOW_ANCHOR}
          onClose={vi.fn()}
          selectedUnitId={undefined}
          onSelectUnit={vi.fn()}
          onRefer={vi.fn()}
        />
      </WardFlowProvider>,
    );
    expect(screen.getByRole("link", { name: "Record notifications" })).toHaveAttribute(
      "href",
      dischargeHref(admissionId),
    );
    expect(screen.queryByTestId("ward-shortlist")).toBeNull();
  });
  it("takes wards to a permitted own-ward booking list and lets them record an arrival", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: ["fre-adult-open"] } });
    });
    const booking = seed.plannedAdmissions!.find((entry) => entry.id === "PA-SEED-03")!;
    const item = {
      id: INBOX_CATEGORIES.planned_arrival_overdue.idPrefix + booking.id,
      plannedAdmission: booking,
    } as QueueEntry["item"];
    expect(alertActionFor(item, {} as QueueEntry["subject"])).toMatchObject({
      href: unitHref(booking.unitId) + "?bookings=1",
    });
    for (const role of ["ward", "bed_manager", "coordinator"] as const) expect(ROLE_SCREENS[role].ward).toBeDefined();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardAccessScope>
          <WardScreen unitId="fre-adult-open" />
        </WardAccessScope>
      </WardFlowProvider>,
    );
    const row = await screen.findByTestId("ward-planned-PA-SEED-03");
    expect(screen.queryByTestId("ward-planned-PA-SEED-01")).toBeNull();
    fireEvent.click(within(row).getByRole("button", { name: "Arrived" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm arrival" }));
    await waitFor(() => expect(screen.queryByTestId("ward-planned-PA-SEED-03")).toBeNull());
  });
});

/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { BellRing } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/discharges",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import type { QueueEntry } from "@/components/ward-management/alerts/alerts-queue";
import { alertActionFor } from "@/components/ward-management/alerts/alerts-model";
import { SupportNotificationChecklist } from "@/components/ward-management/movements/support-notification-checklist";
import { dischargeHref } from "@/components/ward-management/shell/ward-facade";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { INBOX_CATEGORIES, seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { screenDecision, screenForPath, type WardAccess } from "@/components/ward-management/ward-role-access";
import { canDispatch } from "@/components/ward-management/ward-role-permissions";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { supportNotificationTaskId } from "@/components/ward-management/ward-support-notifications";

afterEach(() => {
  cleanup();
});

/**
 * WF-J13 (8 Nov 2026): the owning ward's own route for a departed stay's notification task. The ward
 * desk opens the task from its Alerts, lands on that exact stay's discharge record, and may record
 * the notification there. Synthetic seed data only.
 */
describe("departed stay notification task on the ward's own route (WF-J13)", () => {
  const seed = seedWardFlowState();
  const stay = seed.admissions.find((admission) => admission.id === "AD-LEFT-01")!;
  const wardDesk: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [stay.unitId] } };

  it("opens the exact stay's discharge record, which the ward desk may open", () => {
    const item = {
      id: supportNotificationTaskId("discharge", stay.id),
      kind: INBOX_CATEGORIES.support_notification_discharge.kind,
      tone: "warning",
      icon: BellRing,
      title: "Discharge notifications to record",
      detail: "Carer not recorded",
      owner: "Ward",
      admissionId: stay.id,
    } as QueueEntry["item"];
    const action = alertActionFor(item, {} as QueueEntry["subject"]);
    expect(action).toEqual({ kind: "link", label: "Record notifications", href: dischargeHref(stay.id) });
    const href = action.kind === "link" ? action.href : "";
    expect(screenDecision(wardDesk, screenForPath(href), wardPlaceLookup(seed.units)).open).toBe(true);
  });

  it("lets the ward desk record the notification on that record", async () => {
    expect(canDispatch("ward", "RECORD_SUPPORT_NOTIFICATION")).toBe(true);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SupportNotificationChecklist admissionId={stay.id} role="ward" />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Record Carer" }));
    const form = screen.getByRole("form", { name: "Record Carer" });
    fireEvent.click(within(form).getByRole("radio", { name: "Told" }));
    fireEvent.change(within(form).getByLabelText("Who was told"), { target: { value: "Synthetic carer" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Change Carer" })).toBeInTheDocument());
  });
});

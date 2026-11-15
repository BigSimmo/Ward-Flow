import { describe, expect, it } from "vitest";

import {
  alertActionFor,
  alertKindLabel,
  isQueueItem,
  type AlertSubject,
} from "@/components/ward-management/alerts/alerts-model";
import { alertsNowFigures } from "@/components/ward-management/ward-alerts-figures";
import {
  leaveBedReminderInboxItems,
  silentWardReminderInboxItems,
} from "@/components/ward-management/ward-act-now-items";
import { inboxItemIsActNow } from "@/components/ward-management/ward-inbox-reducer";
import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";
import {
  LEAVE_BED_OPEN_WARNING_MINUTES,
  SILENT_WARD_SECOND_REMINDER_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";
import type { LeaveBed, Referral, Unit } from "@/components/ward-management/ward-model";

const NOW = 1_000_000;
const units = [{ id: "u1", name: "Synthetic Ward" }] as unknown as Unit[];
const referral = (askedMinutesAgo: number) =>
  ({
    id: "ref-1",
    raisedAt: NOW - askedMinutesAgo,
    destinations: [
      { state: "queued", destination: { kind: "psychiatric_ward", unitId: "u1" }, referredAt: NOW - askedMinutesAgo },
    ],
  }) as unknown as Referral;
const leaveBed = (awayMinutes: number) =>
  ({ id: "lb-1", unitId: "u1", admissionId: "a1", confirmedAt: NOW - awayMinutes }) as unknown as LeaveBed;

describe("timed reminders are on the shared alert list (R-HOME-10)", () => {
  const configuration = defaultWardConfiguration();
  it("raises the no-reply reminder at the signed 4 hour time and not before", () => {
    const at = (m: number) => silentWardReminderInboxItems({ units, configuration, referrals: [referral(m)] }, NOW);
    expect(at(SILENT_WARD_SECOND_REMINDER_MINUTES - 1)).toHaveLength(0);
    const [row] = at(SILENT_WARD_SECOND_REMINDER_MINUTES);
    expect(row?.id).toBe("silent-ward-reminder-ref-1");
    expect(row?.tone).toBe("warning");
  });
  it("raises the leave bed prompt at the signed 24 hour time and not before", () => {
    const at = (m: number) => leaveBedReminderInboxItems({ units, leaveBeds: [leaveBed(m)] }, NOW);
    expect(at(LEAVE_BED_OPEN_WARNING_MINUTES - 1)).toHaveLength(0);
    expect(at(LEAVE_BED_OPEN_WARNING_MINUTES)[0]?.id).toBe("leave-bed-reminder-lb-1");
  });
  it("counts as waiting, never as Act now, so the Act now figure is unchanged", () => {
    const ids = ["silent-ward-reminder-ref-1", "leave-bed-reminder-lb-1"];
    for (const id of ids) expect(inboxItemIsActNow(id)).toBe(false);
    expect(
      alertsNowFigures(
        ids.map((id) => ({ id })),
        0,
      ),
    ).toMatchObject({ actNow: 0, waiting: 2, outstanding: 2 });
  });
  it("reaches the Alerts queue and Home's list, with its own label and next step (PR #1685 review)", () => {
    const [silent] = silentWardReminderInboxItems(
      { units, configuration, referrals: [referral(SILENT_WARD_SECOND_REMINDER_MINUTES)] },
      NOW,
    );
    const [leave] = leaveBedReminderInboxItems({ units, leaveBeds: [leaveBed(LEAVE_BED_OPEN_WARNING_MINUTES)] }, NOW);
    expect(silent && isQueueItem(silent)).toBe(true);
    expect(leave && isQueueItem(leave)).toBe(true);
    expect(alertKindLabel(silent!.id)).toBe("No reply from a ward");
    expect(alertKindLabel(leave!.id)).toBe("Leave bed held 24 hours");
    expect(alertActionFor(silent!, {} as AlertSubject)).toMatchObject({ kind: "link", label: "Chase the ward" });
    expect(alertActionFor(leave!, {} as AlertSubject)).toMatchObject({
      kind: "link",
      label: "Open leave",
      href: "/ward-flow/leave",
    });
  });
});

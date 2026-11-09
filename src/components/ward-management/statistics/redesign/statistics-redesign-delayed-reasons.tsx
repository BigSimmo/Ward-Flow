"use client";

/**
 * Weekly operations: "Delayed bed days by reason" (item 5, Josh, 9 Nov 2026). Days counted from each
 * stay's "clinically ready since" day, under the one reason the ward recorded for it. Every figure
 * comes from `delayedBedDaysByReason`; nothing here calculates.
 */
import { DELAYED_DISCHARGE_REASON_SHORT } from "@/components/ward-management/ward-admissions";
import type { DelayedBedDaysByReason } from "@/components/ward-management/ward-delayed-discharge";

import { DataTable, Foot, StatCardR, redesignStyles as s } from "./statistics-redesign-parts";

function daysText(value: number): string {
  return value.toLocaleString("en-AU", { maximumFractionDigits: 1 });
}

export function DelayedReasonsCard({
  data,
  wardName,
}: {
  data: DelayedBedDaysByReason;
  wardName: (unitId: string) => string;
}) {
  const rows = data.network.rows.filter((row) => row.stays > 0);
  const wards = data.wards
    .filter((ward) => ward.stays > 0)
    .sort((a, b) => b.bedDays - a.bedDays || a.unitId.localeCompare(b.unitId));
  return (
    <StatCardR
      id="rd-delayed-reasons"
      title="Delayed bed days by reason"
      meta={`${daysText(data.network.bedDays)} bed days · from the clinically ready day`}
      data-testid="ward-weekly-delayed-reasons"
      foot={
        <Foot
          how={[
            "Counted from the day the ward recorded the person as clinically ready, to when they left or the end of the week.",
            "Each stay counts under the reason recorded now; earlier reasons are not kept.",
            "Recorded on the bed board.",
          ]}
        >
          Not the Delayed discharge figure above, which counts from the expected date.
        </Foot>
      }
    >
      {rows.length === 0 ? (
        <p className={s.empty}>No clinically ready stay was delayed in this week.</p>
      ) : (
        <>
          <DataTable
            cols={["Reason", ">Stays", ">Bed days"]}
            caption="Delayed bed days by reason in the week, network, synthetic"
            rows={[
              ...rows.map((row) => ({
                key: row.reason,
                cells: [DELAYED_DISCHARGE_REASON_SHORT[row.reason], String(row.stays), daysText(row.bedDays)],
              })),
              {
                key: "total",
                kind: "total" as const,
                cells: ["Network", String(data.network.stays), daysText(data.network.bedDays)],
              },
            ]}
          />
          <DataTable
            cols={["Ward", "Main reason", ">Bed days"]}
            caption="Delayed bed days by ward in the week, synthetic"
            rows={wards.map((ward) => {
              const main = ward.rows.reduce((best, row) => (row.bedDays > best.bedDays ? row : best));
              return {
                key: ward.unitId,
                cells: [wardName(ward.unitId), DELAYED_DISCHARGE_REASON_SHORT[main.reason], daysText(ward.bedDays)],
              };
            })}
          />
        </>
      )}
    </StatCardR>
  );
}

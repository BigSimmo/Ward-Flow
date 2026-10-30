"use client";

import { useState, type ReactNode } from "react";

import { WardDailySheetDialog } from "@/components/ward-management/board/ward-daily-sheet";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";

/** The ward the stays and ward mock-ups draw, so the brief matches the page behind it. */
const UNIT_ID = "rph-adult-secure";

/** The Shift brief mock-up, drawn over its page and opened on load. `page` is the page it opens over. */
export function PopShiftBrief({ page }: { page: ReactNode }) {
  const [open, setOpen] = useState(true);
  const { units } = useWardFlowSelect("units");
  const now = useWardFlowClock();
  const unit = units.find((candidate) => candidate.id === UNIT_ID) ?? units[0];
  return (
    <>
      {page}
      {open && unit ? <WardDailySheetDialog unit={unit} now={now} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

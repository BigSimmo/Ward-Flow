"use client";

import { useState, type ReactNode, type RefObject } from "react";

import { Button, ChipGroup, FilterChip, Sheet } from "@/components/wf";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import type { Instant } from "@/components/ward-management/ward-clock";

import {
  STAFF_REQUEST_COUNTS,
  STAFF_REQUEST_REASON_LABELS,
  STAFF_REQUEST_REASONS,
  STAFF_REQUEST_SHIFT_LABELS,
  STAFF_REQUEST_SHIFTS,
  openStaffRequests,
  staffCountLabel,
  staffRequestShiftWord,
  type StaffRequestCount,
  type StaffRequestReason,
  type StaffRequestRecord,
  type StaffRequestShift,
} from "./staff-requests";
import styles from "./staffing.module.css";

function Group({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={styles.group}>
      <span className={styles.groupLabel}>
        {label}
        {hint ? <span className={styles.groupHint}> {hint}</span> : null}
      </span>
      <ChipGroup label={label} className={styles.chipsWrap}>
        {children}
      </ChipGroup>
    </div>
  );
}

/**
 * Feature 10: log that this ward needs more staff to meet current patient demand. Chosen values
 * only, no typed text. One filled button, unavailable with its reason until each choice is made.
 */
export function StaffNeededSheet({
  open,
  onClose,
  unitId,
  unitName,
  now,
  records,
  raise,
  actingUnitId,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  unitId: string;
  unitName: string;
  now: Instant;
  records: readonly StaffRequestRecord[];
  raise: WardRaise;
  actingUnitId?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const [shift, setShift] = useState<StaffRequestShift | null>(null);
  const [count, setCount] = useState<StaffRequestCount | null>(null);
  const [reasons, setReasons] = useState<StaffRequestReason[]>([]);
  const save = useWardFormSave(`staff-request:${unitId}`);
  const mine = openStaffRequests({ staffRequests: records }, now).filter((record) => record.unitId === unitId);
  const existing = shift
    ? mine.find(
        (record) => staffRequestShiftWord(record, now) === (shift === "this_shift" ? "this shift" : "next shift"),
      )
    : undefined;
  const missing = [shift ? null : "the shift", count ? null : "how many", reasons.length ? null : "why"].filter(
    (item): item is string => item !== null,
  );
  const reason = save.pending
    ? "Saving"
    : missing.length
      ? `Choose ${missing.join(", ").replace(/, ([^,]*)$/u, " and $1")}`
      : undefined;
  // Held open while a save is in flight, so a reopened sheet cannot send a second request over it.
  const close = () => {
    if (!save.pending) onClose();
  };
  const toggleReason = (value: StaffRequestReason) =>
    setReasons((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  return (
    <Sheet
      open={open}
      onClose={close}
      title="Staff needed"
      description={`${unitName}. Log that this ward needs more staff to meet current patient demand.`}
      placement="responsive-right"
      mobilePlacement="bottom"
      returnFocusRef={returnFocusRef}
      testId="ward-staff-needed-sheet"
      footer={
        <div className={styles.footer}>
          {save.error ? (
            <span className={styles.status} role="alert">
              {save.error}
            </span>
          ) : null}
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="pri"
            disabledReason={reason}
            reasonDisplay="tooltip"
            data-testid="ward-staff-needed-submit"
            onClick={() => {
              if (!shift || !count || reasons.length === 0) return;
              save.submit(
                () =>
                  raise("REQUEST_WARD_STAFF", {
                    unitId,
                    ...(actingUnitId ? { actingUnitId } : {}),
                    shift,
                    count,
                    reasons,
                  }),
                onClose,
              );
            }}
          >
            {existing ? "Update staff request" : "Log staff request"}
          </Button>
        </div>
      }
    >
      <Group label="For">
        {STAFF_REQUEST_SHIFTS.map((value) => (
          <FilterChip key={value} pressed={shift === value} onPressedChange={() => setShift(value)}>
            {STAFF_REQUEST_SHIFT_LABELS[value]}
          </FilterChip>
        ))}
      </Group>
      <Group label="How many extra staff">
        {STAFF_REQUEST_COUNTS.map((value) => (
          <FilterChip key={value} pressed={count === value} onPressedChange={() => setCount(value)}>
            {staffCountLabel(value)}
          </FilterChip>
        ))}
      </Group>
      <Group label="Why" hint="(one or more)">
        {STAFF_REQUEST_REASONS.map((value) => (
          <FilterChip key={value} pressed={reasons.includes(value)} onPressedChange={() => toggleReason(value)}>
            {STAFF_REQUEST_REASON_LABELS[value]}
          </FilterChip>
        ))}
      </Group>
      <p className={styles.note}>
        {existing
          ? `This ward already asked for ${staffCountLabel(existing.count)} for ${staffRequestShiftWord(existing, now)}. Logging again updates that request.`
          : "Every desk sees the request until it is arranged or withdrawn. It does not change bed numbers."}
      </p>
    </Sheet>
  );
}

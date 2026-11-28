"use client";

import { useState, type ReactNode } from "react";

import { Button, StatusGlyph } from "@/components/wf";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import { useWardShellPublic } from "@/components/ward-management/shell/ward-shell-public-context";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { WARD_FLOW_ROLE_LABELS, type WardFlowRole } from "@/components/ward-management/ward-flow-roles";

import { checkIsDue, lastCheckText, notCheckedNote, type LastCheck } from "./on-call-checks";
import type { DirectoryEntry } from "./on-call-directory";
import styles from "./on-call.module.css";
import own from "./on-call-check-foot.module.css";

/** Mark checked now: the button and its one status line ("Check recorded." or the error). */
export function useMarkChecked(
  entry: DirectoryEntry,
  role: WardFlowRole,
  /** The contact drawer's foot draws it at the size of its other quiet buttons. */
  size: "sm" | "md" = "sm",
): { button: ReactNode; status: ReactNode } {
  const raise = useWardRaise(role);
  const [done, setDone] = useState(false);
  const save = useWardFormSave(`directory-check:${entry.id}`);
  const button = (
    <Button
      size={size}
      variant="sec"
      aria-label={`Mark checked now: ${entry.name}`}
      data-testid="ward-on-call-mark-checked"
      disabledReason={save.pending ? "Saving" : undefined}
      onClick={() => {
        setDone(false);
        save.submit(
          () => raise("RECORD_DIRECTORY_CHECK", { entryId: entry.id }),
          () => setDone(true),
        );
      }}
    >
      Mark checked now
    </Button>
  );
  const status = save.error ? (
    <span className={own.status} role="alert">
      {save.error}
    </span>
  ) : done ? (
    <span className={own.status} role="status">
      Check recorded.
    </span>
  ) : null;
  return { button, status };
}

function MarkChecked({ entry, role }: { entry: DirectoryEntry; role: WardFlowRole }) {
  const { button, status } = useMarkChecked(entry, role);
  return (
    <>
      {button}
      {status}
    </>
  );
}

/**
 * The desk that may record a check on this entry, or null: only desks the event permits (not the
 * executive or the access admin), and only inside a provider (a hand-built sheet only reads). The
 * key resets the check's saved state when the session, entry or desk changes.
 */
export function useCheckRecorder(entry: DirectoryEntry): { role: WardFlowRole | null; key: string } {
  const access = useEffectiveWardAccess();
  const lifetime = useWardShellPublic()?.accessLifetime;
  const role = (EVENT_ROLE.RECORD_DIRECTORY_CHECK as readonly string[]).includes(access.role)
    ? (access.role as WardFlowRole)
    : null;
  const canRecord = useOptionalWardFlowSelect("dispatch") !== null && role !== null;
  return { role: canRecord ? role : null, key: JSON.stringify([lifetime, entry.id, role]) };
}

/**
 * Closing-the-loop (package E): the contact card's foot. When the entry was last checked and by which
 * desk, the factual "Not checked in over N days" note past the directory's threshold, and a button to
 * record a check now. The entry's figures already carry any recorded check (`withRecordedChecks`).
 * `showMark` false (the contact drawer) draws it as quiet text only: the drawer's foot holds Mark
 * checked now.
 */
export function CheckFoot({ entry, showMark = true }: { entry: DirectoryEntry; showMark?: boolean }) {
  const { role, key } = useCheckRecorder(entry);
  const check: LastCheck = { at: 0, by: entry.checkedBy, daysAgo: entry.checkedDaysAgo, recorded: false };
  const due = checkIsDue(check);
  const note = notCheckedNote(check);
  return (
    <div className={`${styles.recordFoot} ${own.foot}`} data-testid="ward-on-call-check-foot">
      <StatusGlyph tone={due ? "warning" : "success"} size={10} />
      <span className={styles.recordText}>Synthetic · {lastCheckText(check)}</span>
      {note ? (
        <span className={own.note} data-testid="ward-on-call-not-checked">
          {note}
        </span>
      ) : null}
      {/* Escalation calls (item 3, D-133): who fixes this entry when its number is stale. Quiet text. */}
      <span className={own.owner} data-testid="ward-on-call-owner">
        Kept up to date by {WARD_FLOW_ROLE_LABELS[entry.ownerRole]}
      </span>
      {showMark && role !== null ? <MarkChecked key={key} entry={entry} role={role} /> : null}
    </div>
  );
}

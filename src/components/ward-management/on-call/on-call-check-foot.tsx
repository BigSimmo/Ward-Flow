"use client";

import { useState } from "react";

import { Badge, Button, StatusGlyph } from "@/components/wf";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";

import { checkIsDue, lastCheckText, notCheckedNote, type LastCheck } from "./on-call-checks";
import type { DirectoryEntry } from "./on-call-directory";
import styles from "./on-call.module.css";
import own from "./on-call-check-foot.module.css";

/**
 * Closing-the-loop (package E): the contact card's foot. When the entry was last checked and by which
 * desk, the factual "Not checked in over N days" note past the directory's threshold, and a button to
 * record a check now. The entry's figures already carry any recorded check (`withRecordedChecks`).
 */
function MarkChecked({ entry, role }: { entry: DirectoryEntry; role: WardFlowRole }) {
  const raise = useWardRaise(role);
  const [done, setDone] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="sec"
        aria-label={`Mark ${entry.name} as checked now`}
        data-testid="ward-on-call-mark-checked"
        onClick={() => {
          raise("RECORD_DIRECTORY_CHECK", { entryId: entry.id });
          setDone(true);
        }}
      >
        Mark checked now
      </Button>
      {done ? (
        <span className={own.status} role="status">
          Check recorded.
        </span>
      ) : null}
    </>
  );
}

export function CheckFoot({ entry }: { entry: DirectoryEntry }) {
  const access = useEffectiveWardAccess();
  // Rendered outside a provider (a hand-built sheet), the foot reads only; there is nothing to record into.
  // Only desks the event permits (not the executive or the access admin) see the button.
  const role = (EVENT_ROLE.RECORD_DIRECTORY_CHECK as readonly string[]).includes(access.role)
    ? (access.role as WardFlowRole)
    : null;
  const canRecord = useOptionalWardFlowSelect("dispatch") !== null && role !== null;
  const check: LastCheck = { at: 0, by: entry.checkedBy, daysAgo: entry.checkedDaysAgo, recorded: false };
  const due = checkIsDue(check);
  const note = notCheckedNote(check);
  return (
    <div className={`${styles.recordFoot} ${own.foot}`} data-testid="ward-on-call-check-foot">
      <StatusGlyph tone={due ? "warning" : "success"} size={10} />
      <span className={styles.recordText}>Synthetic · {lastCheckText(check)}</span>
      <Badge size="sm" variant="plain">
        Not verified
      </Badge>
      {note ? (
        <span className={own.note} data-testid="ward-on-call-not-checked">
          {note}
        </span>
      ) : null}
      {canRecord && role !== null ? <MarkChecked entry={entry} role={role} /> : null}
    </div>
  );
}

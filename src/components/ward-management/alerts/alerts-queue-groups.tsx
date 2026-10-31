"use client";

// The Alerts queue's owner menu and same-kind groups (Alerts redesign, approved by Josh 31 Oct 2026).
// Split from `alerts-screen.tsx` for the line cap.
import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { Instant } from "@/components/ward-management/ward-clock";
import { Select, SrOnly, StatusGlyph, type WfTone } from "@/components/wf";

import { alertKindOf, minutesText, shownAgeFrom } from "./alerts-model";
import type { LinkedQueueItem } from "./alert-linked-groups";
import type { QueueEntry } from "./alerts-queue";
import styles from "./alerts-screen-parts.module.css";

/**
 * The owner highlight as one menu instead of a row of chips that ran off the panel. A desk whose
 * alerts have no owner (the transport officer) has nothing to pick, so no menu shows.
 */
export function OwnerMenu({
  owners,
  value,
  onChange,
  labelFor,
  countFor,
}: {
  owners: readonly string[];
  value: string | null;
  onChange: (owner: string | null) => void;
  labelFor: (owner: string) => string;
  countFor: (owner: string) => number;
}) {
  if (owners.length === 0) return null;
  return (
    <Select
      aria-label="Highlight by owner"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
      boxClassName={styles.ownerMenu}
    >
      <option value="">Any owner</option>
      {owners.map((owner) => (
        <option key={owner} value={owner}>
          {labelFor(owner)} ({countFor(owner)})
        </option>
      ))}
    </Select>
  );
}

type KindGroupItem = { kind: "kind"; key: string; title: string; entries: QueueEntry[] };

/** Same-kind rows grouped when there are at least this many in a row. */
const KIND_GROUP_MIN = 3;

/**
 * Point 17: runs of three or more alerts of one recorded kind in a row ("Transport awaiting
 * departure" five times) become one group row. It groups by the alert's recorded kind only, never
 * by wording, and claims nothing about the people being linked: each alert keeps its own row,
 * action and order inside the group, and section counts still count alerts.
 */
export function groupSameKind(
  items: readonly LinkedQueueItem<QueueEntry>[],
): (LinkedQueueItem<QueueEntry> | KindGroupItem)[] {
  const out: (LinkedQueueItem<QueueEntry> | KindGroupItem)[] = [];
  let run: QueueEntry[] = [];
  let runKind: string | undefined;
  const flush = () => {
    if (run.length >= KIND_GROUP_MIN && runKind !== undefined) {
      out.push({ kind: "kind", key: `kind:${runKind}:${run[0]!.item.id}`, title: run[0]!.item.title, entries: run });
    } else {
      out.push(...run.map((entry) => ({ kind: "single" as const, entry })));
    }
    run = [];
    runKind = undefined;
  };
  for (const item of items) {
    const kind = item.kind === "single" ? alertKindOf(item.entry.item.id) : undefined;
    if (item.kind === "single" && kind !== undefined && kind === runKind) {
      run.push(item.entry);
      continue;
    }
    flush();
    if (item.kind === "single" && kind !== undefined) {
      run = [item.entry];
      runKind = kind;
    } else {
      out.push(item);
    }
  }
  flush();
  return out;
}

/** One group row ("Transport awaiting departure · 5 people") that opens to each alert's own row. */
export function KindGroup({
  group,
  now,
  listClassName,
  renderEntry,
}: {
  group: KindGroupItem;
  now: Instant;
  listClassName: string;
  renderEntry: (entry: QueueEntry) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // The group row reads like its members: their glyph first, the oldest wait on the right.
  const first = group.entries[0];
  const tone: WfTone =
    first?.item.tone === "danger"
      ? "danger"
      : first?.group === "act"
        ? "danger"
        : first?.group === "wait"
          ? "warning"
          : "neutral";
  // A passed legal form adds no age here: its time reads as typed (D-93).
  const raised = group.entries.flatMap((entry) => {
    const from = shownAgeFrom(entry.item, entry.raised);
    return from === undefined ? [] : [from];
  });
  const oldest = raised.length > 0 ? Math.min(...raised) : undefined;
  return (
    <li className={styles.kindGroup} data-testid="ward-alerts-kind-group">
      <button type="button" className={styles.kindHead} aria-expanded={open} onClick={() => setOpen((on) => !on)}>
        <span className={styles.kindGlyph}>
          <StatusGlyph tone={tone} />
        </span>
        <span className={styles.kindText}>
          <span className={styles.kindTitle}>
            <b>{group.title}</b>
            <span className={styles.kindCount}>{group.entries.length} people</span>
          </span>
          <span className={styles.kindNames}>
            {group.entries.map((entry) => entry.subject.displayName).join(" · ")}
          </span>
        </span>
        {oldest === undefined ? null : (
          <span className={styles.kindAge}>
            <SrOnly>Oldest open </SrOnly>
            {minutesText(Math.max(0, now - oldest))}
          </span>
        )}
        <span className={styles.kindOpen}>
          <span className={styles.kindOpenWord}>{open ? "Hide" : "Show each"}</span>
          <ChevronDown size={14} aria-hidden="true" className={open ? styles.flip : undefined} />
        </span>
      </button>
      {open ? <ul className={listClassName}>{group.entries.map(renderEntry)}</ul> : null}
    </li>
  );
}

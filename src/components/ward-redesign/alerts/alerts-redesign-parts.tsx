"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

import { alertKindOf, minutesText } from "@/components/ward-management/alerts/alerts-model";
import type { LinkedQueueItem } from "@/components/ward-management/alerts/alert-linked-groups";
import type { QueueEntry } from "@/components/ward-management/alerts/alerts-queue";
import type { Instant } from "@/components/ward-management/ward-clock";
import { Select, SrOnly, StatusGlyph, type WfTone } from "@/components/wf";

import styles from "./alerts-redesign.module.css";

/**
 * The Checking strip as one dashed chip ("6 flagged · 7 clear"; Round 2: "raised" already means alerts raised) that opens today's list in
 * place. Every check is still there, one press away; thirteen counters, most of them 0, no longer
 * take two lines of the header.
 */
export function ChecksChip({ checks, children }: { checks: readonly { n: number }[]; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const raised = checks.filter((check) => check.n > 0).length;
  return (
    <div className={styles.checks}>
      <button type="button" className={styles.checksChip} aria-expanded={open} onClick={() => setOpen((on) => !on)}>
        <span className={styles.checksLabel}>Checking</span>
        <b>{raised}</b> flagged · <b>{checks.length - raised}</b> clear
        <ChevronDown size={14} aria-hidden="true" className={open ? styles.flip : undefined} />
      </button>
      {open ? <div className={styles.checksList}>{children}</div> : null}
    </div>
  );
}

/** The owner highlight as one menu instead of a row of chips that ran off the panel. */
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

export type KindGroupItem = { kind: "kind"; key: string; title: string; entries: QueueEntry[] };

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
  // Round 2: the group row reads like its members: their glyph first, the oldest wait on the right.
  const first = group.entries[0];
  const tone: WfTone =
    first?.item.tone === "danger"
      ? "danger"
      : first?.group === "act"
        ? "danger"
        : first?.group === "wait"
          ? "warning"
          : "neutral";
  const raised = group.entries.flatMap((entry) => (entry.raised === undefined ? [] : [entry.raised]));
  const oldest = raised.length > 0 ? Math.min(...raised) : undefined;
  return (
    <li className={styles.kindGroup} data-testid="redesign-alerts-kind-group">
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

import Link from "next/link";
import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";

import { ShowMoreRow, foldHidden, foldLimit } from "@/components/wf";

import { dischargeHref, movementHref } from "@/components/ward-management/shell/ward-facade";

import type { ChangesSinceLastLook } from "./since-last-look";
import styles from "./since-last-look-links.module.css";

/**
 * Closing-the-loop features (24 Oct 2026, package E): the record links under "acceptance withdrawn"
 * and "discharge date moved". Each names the ward and the synthetic record id, never a person.
 */
export type SinceRecordLink = {
  href: string;
  label: string;
  /** The ward the record is on: links that carry one list as one row per ward (audit three #7). */
  group?: string;
};

export function acceptanceWithdrawnLinks(changes: ChangesSinceLastLook): SinceRecordLink[] {
  return (changes.acceptanceWithdrawn ?? []).map((row) => ({
    href: movementHref(row.movementId),
    label: `${row.unitName ?? "Ward not recorded"}, ${row.movementId}`,
  }));
}

export function dischargeMovedLinks(changes: ChangesSinceLastLook): SinceRecordLink[] {
  return (changes.dischargeDatesMoved ?? []).map((row) => ({
    href: dischargeHref(row.admissionId),
    label: row.admissionId,
    group: row.unitName ?? row.unitId,
  }));
}

/** States B review: about two lines of links show; the rest wait behind "Show all N". */
const LINKS_SHOWN = 4;

export function SinceRecordLinks({ links, label }: { links: readonly SinceRecordLink[]; label: string }) {
  return links.some((link) => link.group) ? (
    <SinceWardGroups links={links} label={label} />
  ) : (
    <SinceLinkList links={links} label={label} />
  );
}

function SinceLinkList({ links, label }: { links: readonly SinceRecordLink[]; label: string }) {
  const [all, setAll] = useState(false);
  const listId = useId();
  if (links.length === 0) return null;
  const hidden = foldHidden(links.length, LINKS_SHOWN);
  const shown = all ? links : links.slice(0, foldLimit(links.length, LINKS_SHOWN));
  return (
    <>
      <ul id={listId} className={styles.links} aria-label={label}>
        {shown.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={styles.link}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <ShowMoreRow onClick={() => setAll((open) => !open)} expanded={all} controls={listId} total={links.length} />
      ) : null}
    </>
  );
}

/**
 * Audit three #7 (Josh, 28 Nov 2026): a long list of moved dates reads as one row per ward with its
 * count, most first. A row opens to that ward's records; the rest stay folded behind "Show all N".
 */
function SinceWardGroups({ links, label }: { links: readonly SinceRecordLink[]; label: string }) {
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const listId = useId();
  const byWard = new Map<string, SinceRecordLink[]>();
  for (const link of links) {
    const ward = link.group ?? "Ward not recorded";
    byWard.set(ward, [...(byWard.get(ward) ?? []), link]);
  }
  const wards = [...byWard.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const hidden = foldHidden(wards.length, LINKS_SHOWN);
  const shown = all ? wards : wards.slice(0, foldLimit(wards.length, LINKS_SHOWN));
  return (
    <>
      <ul id={listId} className={styles.wards} aria-label={label}>
        {shown.map(([ward, records]) => {
          const expanded = open === ward;
          const recordsId = `${listId}-${ward.replace(/\W+/g, "-")}`;
          return (
            <li key={ward}>
              <button
                type="button"
                className={styles.wardRow}
                aria-expanded={expanded}
                aria-controls={recordsId}
                onClick={() => setOpen(expanded ? null : ward)}
              >
                <ChevronRight aria-hidden="true" size={14} className={styles.wardCaret} />
                <span className={styles.wardName}>{ward}</span>
                <span className={styles.wardCount}>{records.length}</span>
              </button>
              {expanded ? (
                <ul id={recordsId} className={styles.links} aria-label={`${ward}: records`}>
                  {records.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={styles.link}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
      {hidden > 0 ? (
        <ShowMoreRow onClick={() => setAll((value) => !value)} expanded={all} controls={listId} total={wards.length} />
      ) : null}
    </>
  );
}

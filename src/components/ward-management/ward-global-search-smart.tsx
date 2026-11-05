"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

import type { Census } from "@/components/ward-management/search/patient-census";
import { answerQuestion } from "@/components/ward-management/search/search-answers";
import {
  communityStatisticsHref,
  edStatisticsHref,
  patientHref,
  wardStatisticsHref,
} from "@/components/ward-management/shell/ward-facade";
import type { Patient } from "@/components/ward-management/ward-patients";
import styles from "./ward-global-search.module.css";
import type { SearchResultGroup, SearchResultItem } from "./ward-global-search-groups";

/*
 * SEARCH IMPROVEMENTS (Josh, 3 Nov 2026, "reduce friction and improve functionality"): Try asking,
 * the Go to row, the phone preview sheet and the quick patient action. Split from
 * `ward-global-search.tsx`, which keeps the keyboard contract and every navigation guard.
 */

/** Kinds that open the phone preview sheet on a tap rather than leaving the page. */
export const SHEET_KINDS: ReadonlySet<string> = new Set(["person", "movement", "referral", "task", "stay"]);

/** The common questions offered before anything is typed, as label and the phrase it asks. */
const TRY_ASKING: readonly (readonly [string, string])[] = [
  ["Waiting over 24 hours", "waiting over 24 hours"],
  ["No bed yet", "no bed yet"],
  ["On a form", "on a form"],
  ["Transport not booked", "transport not booked"],
  ["Due home today", "due today"],
];

/** Each chip's count comes from the Patients page's own census, so the two never disagree. */
export function TryAsking({ census, onAsk }: { census: Census; onAsk: (phrase: string) => void }) {
  return (
    <div className={styles.askRow}>
      <span className={styles.group}>Try asking</span>
      <div className={styles.askChips}>
        {TRY_ASKING.map(([label, phrase]) => (
          <button key={phrase} type="button" className={styles.askChip} onClick={() => onAsk(phrase)}>
            {label}
            <span className={styles.kindCount}>{answerQuestion(phrase, census, 1)?.total ?? 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * GO TO: a screen or place whose name starts with what was typed (or has a word starting with
 * it, from three letters), or a record with that exact UMRN, leads the list. The caller makes it the
 * active row, so Enter opens it. Never a near spelling of a name: a person only leads it
 * by their exact UMRN.
 */
export function withGoTo(
  groups: SearchResultGroup[],
  allGroups: readonly SearchResultGroup[],
  query: string,
): SearchResultGroup[] {
  const q = query.toLowerCase();
  const lead = allGroups
    .flatMap((group) => group.items)
    .find((item) =>
      ["view", "ward", "ed", "community"].includes(item.kind)
        ? item.title.toLowerCase().startsWith(q) || (q.length >= 3 && item.title.toLowerCase().includes(` ${q}`))
        : (item.umrn ?? item.subjectUmrn)?.toLowerCase() === q,
    );
  if (!lead) return groups;
  return [
    { key: "goto", heading: "Go to", items: [lead] },
    ...groups.map((group) => ({ ...group, items: group.items.filter((item) => item !== lead) })),
  ].filter((group) => group.items.length > 0);
}

/** The patient behind a movement, referral or task row: its own link, else its exact UMRN. */
export function quickPatientHref(item: SearchResultItem, patients: readonly Patient[]): string | undefined {
  if (item.kind !== "movement" && item.kind !== "referral" && item.kind !== "task") return undefined;
  if (item.personId) return patientHref(item.personId);
  const umrn = item.subjectUmrn;
  const patient = umrn ? patients.find((candidate) => candidate.umrn === umrn) : undefined;
  return patient ? patientHref(patient.id) : undefined;
}

/**
 * The row being looked at offers its patient straight away. Pointer only: the keyboard has the
 * preview's own Open patient beside it, and a listbox may hold only options.
 */
export function QuickPatient({
  href,
  canOpenHref,
  onClick,
}: {
  href: string | undefined;
  canOpenHref: (href: string) => boolean;
  onClick: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  if (!href || !canOpenHref(href)) return null;
  return (
    <Link
      href={href}
      className={styles.quickAction}
      tabIndex={-1}
      aria-hidden="true"
      onClick={(event) => onClick(event, href)}
      data-testid="ward-global-search-quick-patient"
    >
      Open patient
    </Link>
  );
}

/** The phone has no preview pane, so a tap on a record shows its preview as a sheet first. */
export function PhoneSheet({
  title,
  inert,
  onClose,
  children,
}: {
  title: string;
  inert: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className={styles.sheetLayer} data-testid="ward-global-search-sheet">
      <button type="button" className={styles.sheetScrim} aria-label="Close preview" onClick={onClose} />
      <div className={styles.sheet} role="dialog" aria-label={title} inert={inert || undefined}>
        <span className={styles.sheetHandle} aria-hidden="true" />
        {children}
        <button type="button" className={styles.sheetBack} onClick={onClose}>
          Back to results
        </button>
      </div>
    </div>
  );
}

const allowSearchChoice = () => true;

/** Navigation permission never changes the catalogue or supplies a record entitlement. */
export function permittedSearchResult(
  item: SearchResultItem,
  canOpenHref: (href: string) => boolean,
  canRunAction: (action: "new-referral" | "add-patient" | "advance-clock") => boolean = allowSearchChoice,
): SearchResultItem[] {
  const href = canOpenHref(item.href)
    ? item.href
    : item.kind === "ward"
      ? wardStatisticsHref(item.id)
      : item.kind === "ed"
        ? edStatisticsHref(item.id)
        : item.kind === "community"
          ? communityStatisticsHref(item.id)
          : null;
  // A Help answer with nowhere to go opens Help itself, which every desk may open.
  if (item.kind === "help" && item.href === "") return [item];
  if (!href || !canOpenHref(href)) return [];
  if (item.kind === "action" && !canRunAction(item.id as "new-referral" | "add-patient")) return [];
  return [href === item.href ? item : { ...item, href }];
}

/** Nothing matched: somewhere useful to go next, never a near spelling of a name. */
export function EmptyTry({
  views,
  onClick,
}: {
  views: readonly { key: string; title: string; href: string }[];
  onClick: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  if (views.length === 0) return null;
  return (
    <div className={styles.emptyTry} data-testid="ward-global-search-empty-try">
      <span className={styles.emptyTryLabel}>Try</span>
      {views.map((view) => (
        <Link key={view.key} href={view.href} className={styles.askChip} onClick={(event) => onClick(event, view.href)}>
          {view.title}
        </Link>
      ))}
    </div>
  );
}

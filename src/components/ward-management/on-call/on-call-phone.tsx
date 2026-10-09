"use client";

import { useState } from "react";
import { ChevronDown, Copy, Mail, PhoneCall, Search, Star } from "lucide-react";
import { Button, Icon, Sheet, StatusGlyph, cx } from "@/components/wf";
import {
  SERVICE_META,
  availability,
  groupRows,
  hhmm,
  isAnswering,
  keyLineLabel,
  numberAt,
  type DirectoryEntry,
  type DirectoryTab,
} from "./on-call-directory";
import { ContactCard, ServiceTag, isWardRow, placeOf, type ContactActions } from "./on-call-parts";

import styles from "./on-call.module.css";

/**
 * Phone: its own layout, designed at 390 by 844 (owner, 9 October 2026: phone is never a trimmed
 * desktop). The job on the move is to find the right line and reach it, so the hero holds one focal
 * bed flow card, the directory is an inset grouped list with a call button on every row, and the
 * contact card rises as a bottom sheet with large action tiles.
 */

const FOCAL = [
  ["sw-bfc", "State"],
  ["nmhs-bfc", "NMHS"],
  ["emhs-bfc", "EMHS"],
  ["smhs-bfc", "SMHS"],
  ["cahs-bfc", "CAHS"],
  ["wachs-bfc", "WACHS"],
] as const;

function Until({ entry, minute }: { entry: DirectoryEntry; minute: number }) {
  const now = availability(entry, minute);
  if (now.kind === "on")
    return now.allDay ? (
      <span className={styles.phoneUntil}>
        <StatusGlyph tone="success" size={9} />
        24 hours
      </span>
    ) : (
      <span className={cx(styles.phoneUntil, now.soon && styles.untilSoon)}>
        <StatusGlyph tone={now.soon ? "warning" : "success"} size={9} />
        Until <b className={styles.mono}>{hhmm(now.until)}</b>
      </span>
    );
  if (now.kind === "off")
    return (
      <span className={cx(styles.phoneUntil, styles.untilOff)}>
        <StatusGlyph tone="neutral" size={9} />
        Opens <b className={styles.mono}>{hhmm(now.opens)}</b>
      </span>
    );
  return null;
}

function CallButton({ entry, actions, onHero }: { entry: DirectoryEntry; actions: ContactActions; onHero?: boolean }) {
  const number = numberAt(entry, actions.minute);
  const off = availability(entry, actions.minute).kind === "off";
  if (number)
    return (
      <button
        type="button"
        className={cx(styles.phoneCall, off && styles.phoneCallOff, onHero && styles.phoneCallHero)}
        aria-label={`Call ${entry.name}${entry.siteCode ? `, ${entry.siteCode}` : ""}, ${number}`}
        onClick={(event) => {
          event.stopPropagation();
          actions.onCall(entry);
        }}
      >
        <Icon icon={PhoneCall} size={20} />
      </button>
    );
  if (entry.email)
    return (
      <button
        type="button"
        className={cx(styles.phoneCall, onHero && styles.phoneCallHero)}
        aria-label={`Copy email for ${entry.name}`}
        onClick={(event) => {
          event.stopPropagation();
          actions.onCopy(entry.email!, "Email copied");
        }}
      >
        <Icon icon={Mail} size={20} />
      </button>
    );
  return <span />;
}

/** The hero's focal card: one service's bed flow line, its number large, and the crisis line under it. */
export function PhoneFocal({
  entries,
  actions,
  onOpen,
}: {
  entries: readonly DirectoryEntry[];
  actions: ContactActions;
  onOpen: (id: string) => void;
}) {
  const [focalId, setFocalId] = useState<string>("sw-bfc");
  const entry = entries.find((item) => item.id === focalId) ?? entries[0]!;
  const crisis = entries.find((item) => item.id === "sw-mherl");
  const now = availability(entry, actions.minute);
  const number = numberAt(entry, actions.minute);
  const then =
    now.kind === "on" && !now.allDay
      ? now.then
        ? `then ${now.then.label.toLowerCase()}`
        : "then closed"
      : now.kind === "off"
        ? "closed now"
        : "";
  return (
    <div className={styles.focalWrap}>
      <div className={styles.focalSeg} role="radiogroup" aria-label="Bed flow for">
        {FOCAL.map(([id, label]) => (
          <button key={id} type="button" role="radio" aria-checked={focalId === id} onClick={() => setFocalId(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className={styles.focal}>
        <span className={styles.focalLabel}>
          <ServiceTag service={entry.service} label="" />
          {keyLineLabel(entry)}
          <span className={styles.spacer} />
          <span>{now.kind === "on" ? now.line?.label : now.kind === "off" ? now.next?.label : ""}</span>
        </span>
        <span className={styles.focalNumber}>{number ?? "Not held"}</span>
        <span className={styles.focalUntil}>
          <Until entry={entry} minute={actions.minute} />
          <span>{then}</span>
        </span>
        <div className={styles.focalActions}>
          <Button variant="light" icon={PhoneCall} className={styles.focalCall} onClick={() => actions.onCall(entry)}>
            Call
          </Button>
          {number ? (
            <Button
              variant="onHero"
              icon={Copy}
              iconOnly
              aria-label="Copy number"
              onClick={() => actions.onCopy(number, "Number copied")}
            />
          ) : null}
          <Button variant="onHero" onClick={() => onOpen(entry.id)}>
            Details
          </Button>
        </div>
      </div>
      {crisis ? (
        <div className={styles.focalMini}>
          <button type="button" className={styles.focalMiniOpen} onClick={() => onOpen(crisis.id)}>
            <ServiceTag service={crisis.service} label="" />
            <b>MHERL crisis line</b>
            <span className={styles.spacer} />
            <span className={styles.mono}>{numberAt(crisis, actions.minute) ?? ""}</span>
          </button>
          <CallButton entry={crisis} actions={actions} onHero />
        </div>
      ) : null}
    </div>
  );
}

function PhoneRow({
  entry,
  actions,
  byRole,
  highlighted,
  onOpen,
}: {
  entry: DirectoryEntry;
  actions: ContactActions;
  byRole: boolean;
  highlighted: boolean;
  onOpen: (id: string) => void;
}) {
  const now = availability(entry, actions.minute);
  const number = numberAt(entry, actions.minute);
  const line = now.kind === "on" ? now.line : now.kind === "off" ? now.next : entry.lines[0];
  const name = byRole && entry.siteCode && !isWardRow(entry) ? entry.groupTitle : entry.name;
  const sub = isWardRow(entry)
    ? entry.place
    : byRole
      ? SERVICE_META[entry.service].short
      : (line?.label ?? entry.purpose);
  return (
    <li className={cx(styles.phoneRow, highlighted && styles.rowHighlight, now.kind === "off" && styles.phoneRowOff)}>
      <button type="button" className={styles.phoneRowOpen} onClick={() => onOpen(entry.id)}>
        <span className={styles.phoneRowName}>
          <b>
            {byRole ? <ServiceTag service={entry.service} label="" /> : null}
            {name}
          </b>
          <span>{sub}</span>
        </span>
        <span className={styles.phoneRowEnd}>
          {number ? <span className={styles.number}>{number}</span> : <span className={styles.cellSub}>Email</span>}
          <Until entry={entry} minute={actions.minute} />
        </span>
      </button>
      <CallButton entry={entry} actions={actions} />
    </li>
  );
}

/** Inset grouped list. One group opens at a time, and search opens every group with a match. */
export function PhoneDirectory({
  entries,
  rows,
  tab,
  groupBy,
  actions,
  isHighlighted,
  queryActive,
  hitCount,
  onClearQuery,
  onOpen,
}: {
  entries: readonly DirectoryEntry[];
  rows: readonly DirectoryEntry[];
  tab: DirectoryTab;
  groupBy: "place" | "role";
  actions: ContactActions;
  isHighlighted: (entry: DirectoryEntry) => boolean;
  queryActive: boolean;
  hitCount: number;
  onClearQuery: () => void;
  onOpen: (id: string) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const blocks = groupRows(entries, rows, tab, groupBy);
  const firstKey = blocks[0]?.groups[0]?.key;
  const byRole = (tab === "hospitals" && groupBy === "role") || tab === "mine";
  if (!rows.length)
    return <p className={styles.phoneEmpty}>Star any line to keep it here. My list stays in this browser.</p>;
  return (
    <div className={styles.phoneList}>
      {queryActive ? (
        <div className={styles.phoneHits}>
          <Icon icon={Search} size={14} />
          <span>
            <span className={styles.mono}>{hitCount}</span> matches highlighted below
          </span>
          <span className={styles.spacer} />
          <Button variant="ghost" size="sm" onClick={onClearQuery}>
            Clear
          </Button>
        </div>
      ) : null}
      {blocks.map((block) => (
        <div key={block.service ?? "all"} className={styles.phoneBlock}>
          {block.service ? (
            <div className={styles.phoneServiceHead}>
              <ServiceTag service={block.service} label={SERVICE_META[block.service].name} strong />
              <span className={styles.spacer} />
              <span className={cx(styles.cellSub, styles.mono)}>
                {block.groups.reduce(
                  (total, group) => total + group.rows.filter((entry) => isAnswering(entry, actions.minute)).length,
                  0,
                )}
                /{block.groups.reduce((total, group) => total + group.rows.length, 0)}
              </span>
            </div>
          ) : null}
          {block.groups.map((group) => {
            const open =
              tab === "mine" ||
              (openKey === null ? group.key === firstKey : openKey === group.key) ||
              (queryActive && group.rows.some(isHighlighted));
            const on = group.rows.filter((entry) => isAnswering(entry, actions.minute)).length;
            return (
              <section key={group.key} className={styles.phoneGroup}>
                {tab !== "mine" ? (
                  <button
                    type="button"
                    className={styles.phoneGroupHead}
                    aria-expanded={open}
                    onClick={() => setOpenKey(open ? "" : group.key)}
                  >
                    {group.code ? <span className={styles.code}>{group.code}</span> : null}
                    <b>{group.title}</b>
                    <span className={styles.spacer} />
                    <span className={cx(styles.cellSub, styles.mono)}>
                      {on}/{group.rows.length}
                    </span>
                    <Icon icon={ChevronDown} size={14} className={cx(styles.chevron, !open && styles.chevronShut)} />
                  </button>
                ) : null}
                {open ? (
                  <ul className={styles.phoneRows}>
                    {group.rows
                      .filter((entry) => entry.kind !== "referralInbox" || byRole || isHighlighted(entry))
                      .map((entry) => (
                        <PhoneRow
                          key={entry.id}
                          entry={entry}
                          actions={actions}
                          byRole={byRole}
                          highlighted={isHighlighted(entry)}
                          onOpen={onOpen}
                        />
                      ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** The contact card as a bottom sheet, led by four large action tiles. */
export function PhoneSheet({
  entry,
  actions,
  onClose,
}: {
  entry: DirectoryEntry;
  actions: ContactActions;
  onClose: () => void;
}) {
  const number = numberAt(entry, actions.minute);
  const starred = actions.favourites.includes(entry.id);
  return (
    <Sheet
      open
      onClose={onClose}
      title={entry.name}
      description={[
        SERVICE_META[entry.service].name,
        entry.place === SERVICE_META[entry.service].short ? null : placeOf(entry),
      ]
        .filter(Boolean)
        .join(", ")}
      contentClassName={styles.sheetSolid}
      mobilePlacement="bottom"
      mobileSize="viewport"
      testId="ward-on-call-sheet"
    >
      <div className={styles.sheetBody}>
        <div className={styles.actionTiles}>
          {number ? (
            <>
              <button
                type="button"
                className={cx(styles.actionTile, styles.actionTilePri)}
                onClick={() => actions.onCall(entry)}
              >
                <Icon icon={PhoneCall} size={20} />
                Call
              </button>
              <button
                type="button"
                className={styles.actionTile}
                onClick={() => actions.onCopy(number, "Number copied")}
              >
                <Icon icon={Copy} size={20} />
                Copy
              </button>
            </>
          ) : null}
          {entry.email ? (
            <button
              type="button"
              className={styles.actionTile}
              onClick={() => actions.onCopy(entry.email!, "Email copied")}
            >
              <Icon icon={Mail} size={20} />
              Email
            </button>
          ) : null}
          <button
            type="button"
            className={styles.actionTile}
            aria-pressed={starred}
            onClick={() => actions.onToggleFavourite(entry.id)}
          >
            <Icon icon={Star} size={20} />
            {starred ? "Starred" : "Star"}
          </button>
        </div>
        <ContactCard entry={entry} actions={actions} showHead={false} showCall={false} />
      </div>
    </Sheet>
  );
}

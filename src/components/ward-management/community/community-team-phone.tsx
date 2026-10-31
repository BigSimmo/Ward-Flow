"use client";

import { useRef, useState, type ReactNode, type RefObject } from "react";
import { Info, Phone, Plus, Shapes, Users, type LucideIcon } from "lucide-react";

import {
  Button,
  GroupHead,
  LiveChip,
  PhoneHero,
  PhoneListRow,
  PhoneSheet,
  ScrollRow,
  Segmented,
  ShowMoreRow,
  SrOnly,
  StatusGlyph,
  buttonClass,
  type PhoneRowAction,
  type WfTone,
  useWfBandBleed,
} from "@/components/wf";

import css from "./community-team-phone.module.css";
import wardPin from "../ward-pinned-switch.module.css";

/*
 * The community team page on a phone (v10 all-pages mockup, page "Community team", Phone; device
 * audit option A, Josh, 11 Oct 2026). Its own layout at 390 wide, never a reflow of desktop: the
 * compact band hero with Switch team; the Since you looked row (one quiet line when nothing
 * changed); tool chips that scroll sideways (How to reach and On duty open as bottom sheets, the
 * rest are the team's actions, Refer from team among them, since New referral in the header is the
 * page's one primary); then the caseload as the page: one switch with counts heading the lists,
 * which open on the first list with someone in it; Worth attention under the lists; and the
 * notices and provenance behind one closed "About this data". Desktop never renders any of this.
 * Every row and action reads the screen's own data and calls the screen's own handlers.
 */

export type CommunityPhoneListId = "sent" | "waiting" | "inBed" | "back" | "ctos";

type CommunityPhoneRow = {
  id: string;
  name: ReactNode;
  meta?: ReactNode;
  value?: ReactNode;
  time?: ReactNode;
  actNow?: boolean;
  onSelect?: () => void;
  action?: PhoneRowAction;
  /** A quiet line under the row (a transport note). */
  note?: ReactNode;
  /** Controls under the row, outside its button (D-80: a sent journey's urgency and legal status). */
  controls?: ReactNode;
  testId?: string;
};

type CommunityPhoneGroup = {
  id: string;
  /** Omit for the list's first, unnamed group. */
  title?: string;
  count?: number;
  tone?: WfTone;
  rows: CommunityPhoneRow[];
  /** Said in place of rows when there are none. */
  empty?: ReactNode;
  /** Controls above the rows (a filter). */
  before?: ReactNode;
  /** A quiet line or control under the rows. */
  after?: ReactNode;
};

export type CommunityPhoneList = {
  id: CommunityPhoneListId;
  label: string;
  groups: CommunityPhoneGroup[];
};

export type CommunityPhoneFigure = {
  id: CommunityPhoneListId;
  value: number;
  label: string;
  tone?: WfTone;
};

export type CommunityPhoneTool = {
  id: string;
  label: string;
  icon: LucideIcon;
  onPress: () => void;
};

type InfoSheet = "reach" | "duty" | "samples";

/** A long phone list shows its first eight rows, then Show more (redesign, approved 31 Oct 2026). */
const LIST_ROWS_SHOWN = 8;

/**
 * Josh, 31 Oct 2026 (12:09 UTC): a list folds only when two or more rows would be hidden, so it
 * never says "Show 1 more"; nine rows show in full.
 */
const FOLD_HIDES_AT_LEAST = 2;

/** How many items a list of `count` hides behind Show more when it shows `shown` (0 when it does not fold). */
function communityListHiddenCount(count: number, shown: number): number {
  const hidden = count - shown;
  return hidden >= FOLD_HIDES_AT_LEAST ? hidden : 0;
}

/** One list group's rows: the first eight, then Show more for the rest, so a long list stays short. */
function PhoneGroupRows({ rows, label }: { rows: CommunityPhoneRow[]; label: string }) {
  const [open, setOpen] = useState(false);
  const hidden = communityListHiddenCount(rows.length, LIST_ROWS_SHOWN);
  const shown = open || hidden === 0 ? rows : rows.slice(0, LIST_ROWS_SHOWN);
  return (
    <div className={css.card}>
      <ul className={css.attention}>
        {shown.map((row) => (
          <li key={row.id} className={css.rowItem} data-testid={row.testId}>
            <PhoneListRow
              name={row.name}
              meta={row.meta}
              value={row.value}
              time={row.time}
              actNow={row.actNow}
              onSelect={row.onSelect}
              action={row.action}
            />
            {row.note ? <p className={css.rowNote}>{row.note}</p> : null}
            {row.controls ? <div className={css.rowControls}>{row.controls}</div> : null}
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <ShowMoreRow expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? "Show fewer" : `Show ${hidden} more`} <SrOnly>in {label}</SrOnly>
        </ShowMoreRow>
      ) : null}
    </div>
  );
}

const ATTENTION_SHOWN = 2;

export function CommunityTeamPhone({
  teamName,
  caseload,
  sub,
  figures,
  list,
  onList,
  lists,
  onIntake,
  onSwitchTeam,
  switchTriggerRef,
  ownTeamOnly = false,
  since,
  notices,
  howToReach,
  onDuty,
  coverage,
  samples,
  actions,
  attention,
}: {
  teamName: string;
  caseload: number;
  sub: ReactNode;
  figures: CommunityPhoneFigure[];
  list: CommunityPhoneListId;
  onList: (id: CommunityPhoneListId) => void;
  lists: CommunityPhoneList[];
  onIntake: () => void;
  onSwitchTeam: () => void;
  switchTriggerRef: RefObject<HTMLButtonElement | null>;
  /** A community team desk opens its own team only, so its hero has no Switch team. */
  ownTeamOnly?: boolean;
  /** The shared SinceYouLooked, which folds to one row on a phone. */
  since: ReactNode;
  /** The team's notices with Mark as read, when there are any. Inside About this data. */
  notices: ReactNode;
  howToReach: ReactNode;
  onDuty: ReactNode;
  /** Provenance, coverage limits and team facts. Inside About this data. */
  coverage: ReactNode;
  samples: { id: string; label: string; onPress: () => void }[];
  /** The team's own actions, as chips after the two sheets (Record contact, CTO register, MDT). */
  actions: CommunityPhoneTool[];
  attention: ReactNode[];
}) {
  const bandRef = useRef<HTMLDivElement>(null);
  useWfBandBleed(bandRef, true);
  const [sheet, setSheet] = useState<InfoSheet | null>(null);
  const listsRef = useRef<HTMLDivElement>(null);
  const close = () => setSheet(null);

  const current = lists.find((entry) => entry.id === list) ?? lists[0]!;
  const countOf = (id: CommunityPhoneListId) => figures.find((figure) => figure.id === id)?.value;

  const sheetChips: CommunityPhoneTool[] = [
    { id: "reach", label: "How to reach", icon: Phone, onPress: () => setSheet("reach") },
    { id: "duty", label: "On duty", icon: Users, onPress: () => setSheet("duty") },
  ];
  const intakeChip: CommunityPhoneTool = { id: "intake", label: "Refer from team", icon: Plus, onPress: onIntake };
  const tailChips: CommunityPhoneTool[] = [
    { id: "samples", label: "Samples", icon: Shapes, onPress: () => setSheet("samples") },
  ];

  return (
    <div className={css.phone} data-testid="ward-community-phone">
      <div ref={bandRef} className={css.band} data-wf-hero="band">
        <PhoneHero
          level={1}
          className={css.teamHero}
          data-testid="ward-community-phone-hero"
          eyebrow={`Community team · ${teamName}`}
          // F-08 (phone review, Oct 2026): the standard Demo pill.
          chip={<LiveChip state="live" onHero />}
          title={`${caseload} on the caseload`}
          sub={sub}
          actions={
            // A community team desk opens its own team only, so it has no Switch team.
            ownTeamOnly ? undefined : (
              <>
                <Button
                  ref={switchTriggerRef}
                  variant="onHero"
                  iconOnly
                  icon={Users}
                  aria-label="Switch team"
                  title="Switch community team"
                  className={css.heroRound}
                  onClick={onSwitchTeam}
                  data-testid="ward-community-switch-team"
                />
              </>
            )
          }
        />
      </div>

      <div className={css.body}>
        {since}

        <ScrollRow className={css.chipsFrame} rowClassName={css.chips} role="group" aria-label="Team tools">
          {[...sheetChips, intakeChip, ...actions, ...tailChips].map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={buttonClass({ variant: "sec", className: css.chip })}
              onClick={chip.onPress}
              aria-haspopup={sheetChips.includes(chip) || tailChips.includes(chip) ? "dialog" : undefined}
              data-testid={`ward-community-phone-chip-${chip.id}`}
            >
              <chip.icon size={16} aria-hidden="true" />
              {chip.label}
            </button>
          ))}
        </ScrollRow>

        <div ref={listsRef} className={css.lists} id="ward-community-phone-lists">
          <Segmented<CommunityPhoneListId>
            label="Team lists"
            size="md"
            className={`${css.segmented} ${wardPin.pinnedSwitch} ${css.oneRow}`}
            value={list}
            onChange={onList}
            items={lists.map((entry) => ({ id: entry.id, label: entry.label, count: countOf(entry.id) }))}
          />
          <div role="region" aria-label={current.label} data-testid={`ward-community-phone-list-${current.id}`}>
            {current.groups.map((group) => (
              <section key={group.id} className={css.group} aria-label={group.title ?? current.label}>
                {group.title ? <GroupHead title={group.title} count={group.count} tone={group.tone} /> : null}
                {group.before}
                {group.rows.length === 0 ? (
                  group.empty ? (
                    <p className={css.empty}>{group.empty}</p>
                  ) : null
                ) : (
                  <PhoneGroupRows
                    key={`${current.id}:${group.id}`}
                    rows={group.rows}
                    label={group.title ?? current.label}
                  />
                )}
                {group.after}
              </section>
            ))}
          </div>
        </div>

        <CommunityWorthAttention items={attention} data-testid="ward-community-phone-attention" />

        <CommunityAboutThisData>
          {notices}
          {coverage}
        </CommunityAboutThisData>
      </div>

      <PhoneSheet open={sheet === "reach"} onClose={close} title="How to reach" description={teamName}>
        <div className={css.sheetBody}>{howToReach}</div>
      </PhoneSheet>
      <PhoneSheet open={sheet === "duty"} onClose={close} title="On duty today" description="Sample roster">
        <div className={css.sheetBody}>{onDuty}</div>
      </PhoneSheet>
      <PhoneSheet open={sheet === "samples"} onClose={close} title="Samples" description="Illustrative only">
        <div className={css.sheetBody}>
          <ul className={css.card}>
            {samples.map((sample) => (
              <li key={sample.id} className={css.rowItem}>
                <PhoneListRow
                  name={sample.label}
                  leading={<Shapes size={16} aria-hidden="true" />}
                  onSelect={() => {
                    close();
                    sample.onPress();
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      </PhoneSheet>
    </div>
  );
}

/** Worth attention: the first two items, then Show more. On the phone under the lists, on desktop in the rail. */
export function CommunityWorthAttention({
  items,
  "data-testid": testId,
}: {
  items: ReactNode[];
  "data-testid"?: string;
}) {
  const [open, setOpen] = useState(false);
  const hidden = communityListHiddenCount(items.length, ATTENTION_SHOWN);
  const shown = open || hidden === 0 ? items : items.slice(0, ATTENTION_SHOWN);
  return (
    <section className={css.section} aria-label="Worth attention" data-testid={testId}>
      <GroupHead title="Worth attention" count={items.length} className={css.plainHead} />
      {items.length === 0 ? (
        <p className={css.empty}>Nothing on this page stands out beyond what the lists show.</p>
      ) : (
        <div className={css.card}>
          <ul className={css.attention}>
            {shown.map((item, index) => (
              <li key={index} className={css.attentionItem}>
                <span className={css.attentionGlyph}>
                  <StatusGlyph tone={index === 0 ? "warning" : "neutral"} size={10} />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {hidden > 0 ? (
            <ShowMoreRow expanded={open} onClick={() => setOpen((value) => !value)}>
              {open ? "Show fewer" : `Show ${hidden} more`}
            </ShowMoreRow>
          ) : null}
        </div>
      )}
    </section>
  );
}

/**
 * One closed disclosure for the team's notices, provenance, coverage limits and team facts (device
 * audit option A, 11 Oct 2026). The shell keeps the one plain synthetic-data notice.
 */
export function CommunityAboutThisData({ children }: { children: ReactNode }) {
  return (
    <details className={css.about} data-testid="ward-community-about-this-data">
      <summary>
        <Info size={16} aria-hidden="true" />
        About this data
      </summary>
      <div className={css.aboutBody}>{children}</div>
    </details>
  );
}

/** Facts in a two-column grid for a phone sheet (Waiting, From, Priority, Home). */
export function CommunityPhoneFacts({ facts }: { facts: { label: string; value: ReactNode; tone?: WfTone }[] }) {
  return (
    <dl className={css.facts}>
      {facts.map((fact) => (
        <div key={fact.label} className={css.fact}>
          <dt>{fact.label}</dt>
          <dd>
            {fact.tone ? <StatusGlyph tone={fact.tone} size={10} /> : null}
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

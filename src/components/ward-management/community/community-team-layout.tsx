"use client";

import { useRef, useState, type ReactNode, type RefObject } from "react";
import { Info, Phone, Users } from "lucide-react";

import {
  Button,
  GroupHead,
  Hero,
  HeroStat,
  PhoneHero,
  PhoneListRow,
  PhoneSheet,
  ScrollRow,
  Segmented,
  StatusGlyph,
  useIsPhone,
  useIsTabletPortrait,
  useWfBandBleed,
} from "@/components/wf";
import type { WardPreviewOption } from "@/components/ward-management/preview/ward-preview-routes";

import type {
  CommunityPhoneFigure,
  CommunityPhoneGroup,
  CommunityPhoneList,
  CommunityPhoneListId,
} from "./community-team-phone";
import phoneCss from "./community-team-phone.module.css";
import css from "./community-team-layout.module.css";

/**
 * Community team body (device audit mockups, 11 Oct 2026, preview only). The same lists, rows,
 * sheets and handlers as the live phone page, laid out for every device so the caseload is the
 * page. Every option opens on the first list that has someone in it, uses one switch, keeps How to
 * reach and On duty as a rail or sheets, and puts provenance behind one "About this data".
 *   A - list first: the switch heads the list card, the rail holds reach, duty and attention.
 *   B - the hero figures are the switch: no tabs, one column, reach and duty open as sheets.
 *   C - one caseload: every list on one page under group heads, the switch jumps between them.
 */

type Sheet = "reach" | "duty" | null;

export type CommunityTeamLayoutProps = {
  option: WardPreviewOption;
  teamName: string;
  caseload: number;
  sub: ReactNode;
  /** One figure per list, in list order. */
  figures: CommunityPhoneFigure[];
  lists: CommunityPhoneList[];
  onSwitchTeam: () => void;
  switchTriggerRef: RefObject<HTMLButtonElement | null>;
  /** The shared SinceYouLooked card, or null when nothing changed (then one quiet line shows). */
  since: ReactNode | null;
  sinceWindow: string;
  howToReach: ReactNode;
  onDuty: ReactNode;
  attention: ReactNode[];
  /** Provenance, coverage limits, team facts and the team's notices. Closed by default. */
  about: ReactNode;
};

function firstNonEmpty(lists: CommunityPhoneList[]): CommunityPhoneListId {
  return lists.find((list) => list.groups.some((group) => group.rows.length > 0))?.id ?? lists[0]?.id ?? "waiting";
}

function Group({ group, fallbackTitle }: { group: CommunityPhoneGroup; fallbackTitle: string }) {
  return (
    <section className={phoneCss.group} aria-label={group.title ?? fallbackTitle}>
      {group.title ? <GroupHead title={group.title} count={group.count} tone={group.tone} /> : null}
      {group.before}
      {group.rows.length === 0 ? (
        group.empty ? (
          <p className={phoneCss.empty}>{group.empty}</p>
        ) : null
      ) : (
        <ul className={phoneCss.card}>
          {group.rows.map((row) => (
            <li key={row.id} className={phoneCss.rowItem} data-testid={row.testId}>
              <PhoneListRow
                name={row.name}
                meta={row.meta}
                value={row.value}
                time={row.time}
                actNow={row.actNow}
                onSelect={row.onSelect}
                action={row.action}
              />
              {row.note ? <p className={phoneCss.rowNote}>{row.note}</p> : null}
            </li>
          ))}
        </ul>
      )}
      {group.after}
    </section>
  );
}

function Attention({ items }: { items: ReactNode[] }) {
  return (
    <section className={css.side} aria-label="Worth attention">
      <GroupHead title="Worth attention" count={items.length} className={phoneCss.plainHead} />
      {items.length === 0 ? (
        <p className={phoneCss.empty}>Nothing on this page stands out beyond what the lists show.</p>
      ) : (
        <ul className={`${phoneCss.card} ${phoneCss.attention}`}>
          {items.map((item, index) => (
            <li key={index} className={phoneCss.attentionItem}>
              <span className={phoneCss.attentionGlyph}>
                <StatusGlyph tone={index === 0 ? "warning" : "neutral"} size={10} />
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CommunityTeamLayout({
  option,
  teamName,
  caseload,
  sub,
  figures,
  lists,
  onSwitchTeam,
  switchTriggerRef,
  since,
  sinceWindow,
  howToReach,
  onDuty,
  attention,
  about,
}: CommunityTeamLayoutProps) {
  const isPhone = useIsPhone();
  const isTabletPortrait = useIsTabletPortrait();
  const [list, setList] = useState<CommunityPhoneListId>(() => firstNonEmpty(lists));
  const [sheet, setSheet] = useState<Sheet>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  useWfBandBleed(bandRef, isPhone);
  const groupRefs = useRef<Partial<Record<CommunityPhoneListId, HTMLElement | null>>>({});
  const current = lists.find((entry) => entry.id === list) ?? lists[0];
  // A has a rail on desktop and landscape; everything narrower, and every B screen, uses sheets.
  const railed = option !== "B" && !isPhone && !isTabletPortrait;
  const countOf = (id: CommunityPhoneListId) => figures.find((figure) => figure.id === id)?.value ?? 0;

  const sinceLine = since ?? (
    <p className={css.quietLine}>
      <StatusGlyph tone="neutral" size={9} /> No changes since {sinceWindow}.
    </p>
  );

  const switchItems = lists.map((entry) => ({ id: entry.id, label: entry.label, count: countOf(entry.id) }));

  const teamButton = (
    <Button
      ref={switchTriggerRef}
      variant="onHero"
      icon={Users}
      onClick={onSwitchTeam}
      data-testid="ward-community-switch-team"
    >
      Team
    </Button>
  );
  const callButton = (
    <Button variant="onHero" icon={Phone} onClick={() => setSheet("reach")} aria-haspopup="dialog">
      Call team
    </Button>
  );
  const dutyButton = (
    <Button variant="onHero" icon={Users} onClick={() => setSheet("duty")} aria-haspopup="dialog">
      On duty
    </Button>
  );

  // Option B: the hero figures are the one switch (pressed = the list shown).
  const heroFigures =
    option === "B"
      ? figures.map((figure) => ({
          id: figure.id,
          value: figure.value,
          label: figure.label,
          tone: figure.tone,
          pressed: list === figure.id,
          onPress: () => setList(figure.id),
          actionLabel: `${figure.value} ${figure.label}, show the list`,
        }))
      : undefined;

  const hero = isPhone ? (
    <div ref={bandRef} className={phoneCss.band} data-wf-hero="band">
      <PhoneHero
        level={1}
        className={phoneCss.teamHero}
        eyebrow={`Community team · ${teamName}`}
        title={`${caseload} on the caseload`}
        sub={sub}
        figures={heroFigures?.slice(0, 3)}
        actions={
          <>
            {teamButton}
            {callButton}
            {dutyButton}
          </>
        }
      />
    </div>
  ) : (
    <Hero
      level={1}
      eyebrow={`Community team · ${teamName}`}
      title={`${caseload} on the caseload`}
      titleMeta={sub}
      stats={
        option === "B" ? (
          <>
            {figures.map((figure) => (
              <HeroStat
                key={figure.id}
                inline
                value={figure.value}
                label={figure.label}
                tone={figure.tone}
                pressed={list === figure.id}
                onToggle={() => setList(figure.id)}
              />
            ))}
          </>
        ) : undefined
      }
      aside={
        <span className={css.heroActions}>
          {teamButton}
          {railed ? null : callButton}
          {railed ? null : dutyButton}
        </span>
      }
    />
  );

  const listCard =
    option === "C" ? (
      <section className={css.main} aria-label="Caseload">
        <ScrollRow className={css.jumpFrame} rowClassName={css.jump} role="group" aria-label="Jump to a list">
          {lists.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={phoneCss.chip}
              onClick={() => groupRefs.current[entry.id]?.scrollIntoView({ block: "start", behavior: "smooth" })}
            >
              {entry.label}
              <span className={css.jumpCount}>{countOf(entry.id)}</span>
            </button>
          ))}
        </ScrollRow>
        {lists.map((entry) => {
          const empty = entry.groups.every((group) => group.rows.length === 0);
          return (
            <section
              key={entry.id}
              ref={(node) => {
                groupRefs.current[entry.id] = node;
              }}
              className={css.listBlock}
              aria-label={entry.label}
            >
              <GroupHead title={entry.label} count={countOf(entry.id)} className={css.stickyHead} />
              {empty ? (
                <p className={phoneCss.empty}>{entry.groups[0]?.empty ?? "No one on this list."}</p>
              ) : (
                entry.groups.map((group) => <Group key={group.id} group={group} fallbackTitle={entry.label} />)
              )}
            </section>
          );
        })}
      </section>
    ) : (
      <section className={css.main} aria-label="Caseload">
        {option === "A" ? (
          <div className={css.listHead}>
            <Segmented<CommunityPhoneListId>
              label="Team lists"
              size="md"
              className={css.segmented}
              value={list}
              onChange={setList}
              items={switchItems}
            />
          </div>
        ) : (
          <h2 className={css.listTitle}>
            {current.label} <span>{countOf(current.id)}</span>
          </h2>
        )}
        <div role="region" aria-label={current.label} data-testid={`ward-community-preview-list-${current.id}`}>
          {current.groups.map((group) => (
            <Group key={group.id} group={group} fallbackTitle={current.label} />
          ))}
        </div>
      </section>
    );

  const aboutBlock = (
    <details className={css.about}>
      <summary>
        <Info size={16} aria-hidden="true" />
        About this data
      </summary>
      <div className={css.aboutBody}>{about}</div>
    </details>
  );

  return (
    <div className={css.page} data-option={option} data-testid="ward-community-preview">
      {hero}
      <div className={css.body}>
        {sinceLine}
        <div className={railed ? css.columns : css.single}>
          <div className={css.mainColumn}>
            {option === "B" ? <Attention items={attention} /> : null}
            {listCard}
            {!railed && option !== "B" ? <Attention items={attention} /> : null}
          </div>
          {railed ? (
            <aside className={css.rail} aria-label="Team contacts" data-wf-rail>
              {option === "C" ? (
                <>
                  {howToReach}
                  {onDuty}
                  <Attention items={attention} />
                </>
              ) : (
                <>
                  <Attention items={attention} />
                  {howToReach}
                  {onDuty}
                </>
              )}
            </aside>
          ) : null}
        </div>
        {aboutBlock}
      </div>

      <PhoneSheet open={sheet === "reach"} onClose={() => setSheet(null)} title="How to reach" description={teamName}>
        <div className={phoneCss.sheetBody}>{howToReach}</div>
      </PhoneSheet>
      <PhoneSheet
        open={sheet === "duty"}
        onClose={() => setSheet(null)}
        title="On duty today"
        description="Sample roster"
      >
        <div className={phoneCss.sheetBody}>{onDuty}</div>
      </PhoneSheet>
    </div>
  );
}

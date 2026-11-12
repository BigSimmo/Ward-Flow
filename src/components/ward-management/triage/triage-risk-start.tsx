"use client";

/**
 * Triage and risk (built 7 Nov 2026): the Start a triage step, at `/ward-flow/triage/new`. Opened from
 * New, then Triage, in the app bar (New triage in the phone's Create sheet), or from the form's own
 * "Start a new triage". It asks who the triage is for: a search over the synthetic world's people, the
 * referrals still waiting for a triage, and Add patient for someone not found. Choosing a person
 * opens their form blank. Synthetic data only; the typed search stays in React and is never stored.
 *
 * Queue overhaul (mock-up approved by Josh, 9 Nov 2026): the search sits in the banner as the main
 * control, with a short at-a-glance line. The referrals awaiting triage are the page's main content,
 * one row each with source, wait, the urgency the referrer asked (never a suggested tier) and whether
 * it is a re-triage. Filter by source, sort by wait or by urgency asked, and open a referral's details
 * in the kit drawer without leaving the queue. The app bar already owns "/" (`search-shortcut.ts`),
 * so this search binds no key of its own.
 */
import { Check, ChevronRight, Ellipsis, FileText, UserPlus, UserRound } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHead,
  FolderTabs,
  FormalName,
  Hero,
  HeroAct,
  Icon,
  LiveChip,
  Menu,
  PanelDrawer,
  PillTabs,
  SearchField,
  ShowMoreRow,
  buttonClass,
  cx,
  folderTabClasses,
  foldHidden,
  foldLimit,
  useIsPhone,
} from "@/components/wf";
import { WARD_ADD_PERSON_HREF } from "@/components/ward-management/ward-nav";
import { splitDuration } from "@/components/ward-management/ward-clock";

import type { TriagePerson } from "./triage-risk-data";
import { legalLine, searchTriagePeople } from "./triage-risk-people";
import { TIER_LONG, TRIAGE_URGENCIES, type Tier } from "./triage-record";
import { useTriagePeople, type AwaitingTriage } from "./use-triage-people";
import pageTop from "../page-top-hero.module.css";
import styles from "./triage-risk-start.module.css";

const SORTS: { id: QueueSort; label: string }[] = [
  { id: "wait", label: "Longest waiting" },
  { id: "urgency", label: "Urgency asked" },
];

/** Rows the queue shows before Show all. */
const QUEUE_LIMIT = 8;
/** Signed triages the side column lists. */
const SIGNED_LIMIT = 5;

export type QueueSort = "wait" | "urgency";

const urgencyRank = (tier: Tier | null) => (tier ? TRIAGE_URGENCIES.indexOf(tier) : TRIAGE_URGENCIES.length);

/**
 * The queue in reading order. Longest waiting puts the oldest referral first; Urgency asked puts the
 * tier the referrer asked first (A first, none asked last), longest waiting within a tier.
 */
export function sortTriageQueue(rows: readonly AwaitingTriage[], sort: QueueSort): AwaitingTriage[] {
  return [...rows].sort((a, b) => {
    if (sort === "urgency") {
      const byTier = urgencyRank(a.referral.urgency) - urgencyRank(b.referral.urgency);
      if (byTier !== 0) return byTier;
    }
    return b.waitedMinutes - a.waitedMinutes;
  });
}

/** Sources on the queue with their counts, in first-seen order. */
export function triageQueueSources(rows: readonly AwaitingTriage[]): { from: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.referral.from, (counts.get(row.referral.from) ?? 0) + 1);
  return [...counts].map(([from, count]) => ({ from, count }));
}

/** The banner's at-a-glance line: "6 awaiting · oldest waiting 5h 12m · 2 asked B or sooner". */
export function triageQueueGlance(rows: readonly AwaitingTriage[]): string {
  if (rows.length === 0) return "Nothing awaiting triage";
  const oldest = Math.max(...rows.map((row) => row.waitedMinutes));
  const asked = rows.filter((row) => row.referral.urgency === "A" || row.referral.urgency === "B").length;
  const anyAsked = rows.some((row) => row.referral.urgency !== null);
  return [
    `${rows.length} awaiting`,
    `oldest waiting ${splitDuration(oldest)}`,
    // Only when a referrer asked a tier at all, so a queue with none asked shows no empty figure.
    anyAsked ? `${asked} asked B or sooner` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "Last triaged 07 Nov (C)" or "First triage". The tier is the code the last triage signed. */
export function retriageWords(person: TriagePerson): string {
  if (!person.last) return "First triage";
  const tier = person.last.urgencyText.split(" ")[0];
  return `Last triaged ${person.last.when}${tier ? ` (${tier})` : ""}`;
}

function PersonRow({ person, onChoose }: { person: TriagePerson; onChoose: () => void }) {
  return (
    <li>
      <button type="button" className={styles.person} onClick={onChoose} data-testid="triage-start-person">
        <span className={styles.chip} aria-hidden="true">
          <Icon icon={UserRound} size={16} />
        </span>
        <span className={styles.personText}>
          <span className={styles.personName}>
            <FormalName name={person.name} />
            <span className={styles.personMeta}>{person.meta}</span>
          </span>
          <span className={styles.personLine}>
            UMRN <b className={styles.mono}>{person.umrn}</b> · DOB <b className={styles.mono}>{person.dob}</b>
          </span>
          <span className={styles.personLine}>
            Now at {person.nowAt === "Not recorded" ? <i className={styles.quiet}>not recorded</i> : person.nowAt}
          </span>
          <span className={styles.personLine}>{legalLine(person)}</span>
          <span className={styles.tags}>
            {person.referral ? <Badge>Open referral · {person.referral.from}</Badge> : null}
            {person.last ? <Badge>Previous triage on record</Badge> : null}
          </span>
        </span>
        <Icon icon={ChevronRight} size={16} className={styles.chevron} />
      </button>
    </li>
  );
}

/**
 * One referral on the queue, as the app's one row pattern (redesign, 13 Nov 2026): the place in the
 * queue on a tinted chip, the name over one quiet line, the wait as a figure, and the actions on the
 * right edge. Every fact the row held before is still on it.
 */
function QueueRow({
  row,
  place,
  onChoose,
  onOpenReferral,
}: {
  row: AwaitingTriage;
  /** Where the referral sits in the queue as sorted, from 1. */
  place: number;
  onChoose: () => void;
  onOpenReferral: () => void;
}) {
  const { referral } = row;
  return (
    <li className={styles.row} data-testid="triage-start-referral-row">
      <span className={styles.chip} aria-hidden="true">
        {place}
      </span>
      <div className={styles.rowWho}>
        <span className={styles.personName}>
          <FormalName name={row.name} />
          <span className={styles.personMeta}>{row.meta}</span>
        </span>
        <span className={styles.rowLine}>
          <span>
            UMRN <b className={styles.mono}>{row.umrn}</b>
          </span>
          <span>{referral.from}</span>
          {referral.urgency ? <Badge>Asked {referral.urgency}</Badge> : null}
          <span className={styles.retriage}>{retriageWords(row)}</span>
        </span>
      </div>
      {referral.received ? (
        <span className={styles.wait}>
          Waiting <b className={styles.mono}>{splitDuration(row.waitedMinutes)}</b>
        </span>
      ) : null}
      <div className={styles.rowActions}>
        <Button
          size="sm"
          variant="ghost"
          icon={FileText}
          onClick={onOpenReferral}
          aria-haspopup="dialog"
          aria-label={`Referral details for ${row.name}`}
          data-testid="triage-start-referral-open"
        >
          Referral
        </Button>
        <Button
          size="sm"
          variant="tint"
          onClick={onChoose}
          aria-label={`Start triage for ${row.name}`}
          data-testid="triage-start-person"
        >
          Start triage
        </Button>
      </div>
    </li>
  );
}

/**
 * The side column (redesign, 13 Nov 2026): reference beside the queue. Waiting by source counts the
 * queue as it stands, with each source's longest wait; Signed triages lists the people this
 * workspace holds a signed triage for. Nothing here is new data, and nothing is a clinical judgement.
 */
function QueueSide({ awaiting, people }: { awaiting: readonly AwaitingTriage[]; people: readonly TriagePerson[] }) {
  const sources = triageQueueSources(awaiting).map(({ from, count }) => ({
    from,
    count,
    oldest: Math.max(...awaiting.filter((row) => row.referral.from === from).map((row) => row.waitedMinutes)),
  }));
  const signed = people.filter((person) => person.last);
  const shown = signed.slice(0, SIGNED_LIMIT);
  return (
    <aside className={styles.side} aria-label="Queue at a glance" data-testid="triage-start-side">
      <Card className={`${styles.card} ${styles.sources}`} aria-labelledby="triage-start-sources">
        <CardHead id="triage-start-sources" title="Waiting by source" meta={`${awaiting.length} awaiting`} />
        <CardBody flush>
          {sources.length ? (
            <ul className={styles.sideRows}>
              {sources.map(({ from, count, oldest }) => (
                <li key={from} className={styles.sideRow}>
                  <span className={styles.chip} aria-hidden="true">
                    {count}
                  </span>
                  <span className={styles.sideText}>
                    <span className={styles.sideTitle}>{from}</span>
                    <span className={styles.personLine}>
                      {count} awaiting · longest <b className={styles.mono}>{splitDuration(oldest)}</b>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.sideEmpty}>No referral is waiting for a triage.</p>
          )}
        </CardBody>
      </Card>
      <Card className={styles.card} aria-labelledby="triage-start-signed">
        <CardHead
          id="triage-start-signed"
          title="Signed triages"
          meta={signed.length ? `${signed.length} on this workspace` : undefined}
        />
        <CardBody flush>
          {shown.length ? (
            <ul className={styles.sideRows}>
              {shown.map((person) => (
                <li key={person.id} className={styles.sideRow}>
                  <span className={styles.chip} data-done="" aria-hidden="true">
                    <Icon icon={Check} size={16} />
                  </span>
                  <span className={styles.sideText}>
                    <span className={styles.sideTitle}>
                      <FormalName name={person.name} />
                    </span>
                    <span className={styles.personLine}>
                      {person.last!.when} · Urgency {person.last!.urgencyText} · {person.last!.outcome}
                    </span>
                  </span>
                  <Link
                    href={person.recordHref}
                    className={buttonClass({ variant: "ghost", size: "sm" })}
                    aria-label={`Open the record for ${person.name}`}
                  >
                    Record
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.sideEmpty}>No triage has been signed on this workspace yet.</p>
          )}
        </CardBody>
      </Card>
    </aside>
  );
}

function ReferralDrawer({
  row,
  onClose,
  onChoose,
}: {
  row: AwaitingTriage | null;
  onClose: () => void;
  onChoose: (person: TriagePerson) => void;
}) {
  const referral = row?.referral;
  const facts: [string, string][] = referral
    ? [
        ["From", referral.from],
        ["Referrer", referral.referrer ? `${referral.referrer.name}, ${referral.referrer.role}` : "Not recorded"],
        ["Urgency asked", referral.urgency ? `${referral.urgency} · ${TIER_LONG[referral.urgency]}` : "None asked"],
        ["Episode", referral.episode ?? "Not recorded"],
        ["Received", referral.received ?? "Not recorded"],
        ["Waiting", referral.received && row ? splitDuration(row.waitedMinutes) : "Not recorded"],
        ["Triage", row ? retriageWords(row) : ""],
      ]
    : [];
  return (
    <PanelDrawer
      open={row !== null}
      onClose={onClose}
      eyebrow="Referral"
      title={row ? <FormalName name={row.name} /> : ""}
      subtitle={row ? `${row.meta} · UMRN ${row.umrn}` : undefined}
      testId="triage-start-referral-drawer"
      bodyClassName={styles.drawerBody}
      foot={
        row ? (
          <Button variant="pri" onClick={() => onChoose(row)}>
            Start triage
          </Button>
        ) : null
      }
    >
      <dl className={styles.facts}>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.quiet}>From the synthetic referral. Fix errors at the source.</p>
    </PanelDrawer>
  );
}

export function TriageStart({ onChoose }: { onChoose: (person: TriagePerson) => void }) {
  const { people, awaiting } = useTriagePeople();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<string | null>(null);
  const [sort, setSort] = useState<QueueSort>("wait");
  const [showAll, setShowAll] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const matches = useMemo(() => searchTriagePeople(people, query), [people, query]);
  const searching = query.trim().length > 0;
  const isPhone = useIsPhone();
  const headingId = useId();
  const queueId = useId();

  const rowKey = (row: AwaitingTriage) => `${row.id}-${row.referral.id}`;
  const sources = useMemo(() => triageQueueSources(awaiting), [awaiting]);
  // A source that has left the queue no longer filters it.
  const activeSource = source && sources.some((s) => s.from === source) ? source : null;
  const queue = useMemo(
    () => sortTriageQueue(activeSource ? awaiting.filter((row) => row.referral.from === activeSource) : awaiting, sort),
    [awaiting, activeSource, sort],
  );
  const limit = foldLimit(queue.length, QUEUE_LIMIT);
  const hidden = foldHidden(queue.length, QUEUE_LIMIT);
  const shown = showAll ? queue : queue.slice(0, limit);
  const openRow = openKey ? (awaiting.find((row) => rowKey(row) === openKey) ?? null) : null;
  // The calm act row's referral: the longest waiting, whatever the tab or sort.
  const oldest = sortTriageQueue(awaiting, "wait")[0];

  return (
    <main id="main-content" className={styles.main} data-testid="triage-start">
      {/* Page tops (Josh, 9 Nov 2026): the headline is the job ("4 awaiting triage"), the search leads
          with Add patient beside it, and one calm act row names the oldest referral. */}
      <h1 className="sr-only">Start a triage</h1>
      <Hero
        className={cx(pageTop.hero, folderTabClasses.hero, styles.hero)}
        title={awaiting.length ? `${awaiting.length} awaiting triage` : "Nothing awaiting triage"}
        titleMeta={<span className={styles.forms}>SMHMR900 and SMHMR905</span>}
        aside={<LiveChip state="live" onHero />}
        testId="triage-start-hero"
      >
        <div className={styles.heroTop}>
          <div className={styles.searchRow}>
            <SearchField
              id="triage-start-search"
              className={styles.search}
              label="Search by name, UMRN or date of birth"
              placeholder={isPhone ? "Name, UMRN or DOB" : "Surname, given name, UMRN or DOB"}
              value={query}
              onValueChange={setQuery}
            />
            {/* Search comes first; Add patient sits beside it (an icon on a phone). */}
            <Link
              href={WARD_ADD_PERSON_HREF}
              className={cx(buttonClass({ variant: "onHero" }), styles.add)}
              aria-label="Not found? Add patient"
              data-testid="triage-start-add"
            >
              <Icon icon={UserPlus} size={16} />
              <span className={styles.addWords}>Not found? Add patient</span>
            </Link>
          </div>
          {oldest ? (
            <HeroAct
              tone="calm"
              testId="triage-start-oldest"
              title={
                <>
                  <span className={pageTop.titleSoft}>Oldest</span>{" "}
                  <b className={styles.mono}>{splitDuration(oldest.waitedMinutes)}</b>{" "}
                  <span className={pageTop.titleSoft}>·</span> {oldest.referral.from}
                </>
              }
              action={{
                label: "Start triage",
                phoneLabel: "Start",
                onClick: () => onChoose(oldest),
                testId: "triage-start-oldest-action",
              }}
            />
          ) : null}
        </div>
      </Hero>
      {awaiting.length ? (
        <FolderTabs
          label="Referrals awaiting triage by source"
          value={activeSource ?? "all"}
          testId="triage-start-tabs"
          className={styles.tabs}
          more={
            <Menu
              label="Sort referrals"
              align="end"
              items={SORTS.map((option) => ({
                id: option.id,
                label: option.label,
                checked: sort === option.id,
                checkable: "radio" as const,
                onSelect: () => setSort(option.id),
              }))}
              trigger={(props) => (
                <button
                  type="button"
                  {...props}
                  className={cx(buttonClass({ variant: "ghost", size: "sm" }), folderTabClasses.more, styles.sort)}
                  aria-label={`Sort referrals: ${SORTS.find((option) => option.id === sort)!.label}`}
                  data-testid="triage-start-sort"
                >
                  <Icon icon={Ellipsis} size={16} />
                  <span className={styles.sortWords}>{SORTS.find((option) => option.id === sort)!.label}</span>
                </button>
              )}
            />
          }
        >
          <PillTabs
            className={folderTabClasses.switch}
            label="Filter by source"
            value={activeSource ?? "all"}
            onChange={(id) => setSource(id === "all" ? null : id)}
            items={[
              { id: "all", label: "All", count: awaiting.length },
              ...sources.map(({ from, count }) => ({ id: from, label: from, count })),
            ]}
          />
        </FolderTabs>
      ) : null}

      {/* Redesign (13 Nov 2026): the app's 2:1 grid. The queue is the work; the side column is reference. */}
      <div className={styles.grid}>
        <div className={styles.mainCol}>
          {searching ? (
            <Card className={styles.card} aria-labelledby={headingId}>
              <CardHead id={headingId} title="Matching people" meta={`${matches.length} of ${people.length} people`} />
              <CardBody flush className={styles.body}>
                {matches.length ? (
                  <ul className={styles.list} aria-label="Matching people">
                    {matches.map((person) => (
                      <PersonRow key={person.id} person={person} onChoose={() => onChoose(person)} />
                    ))}
                  </ul>
                ) : (
                  <p className={styles.empty} data-testid="triage-start-no-match">
                    No synthetic person matches. Check the spelling, or add them.
                  </p>
                )}
              </CardBody>
            </Card>
          ) : null}

          <Card className={styles.card} aria-label="Referrals awaiting triage" data-testid="triage-start-queue">
            {awaiting.length ? (
              <CardHead
                title={activeSource ?? "All referrals"}
                meta={`${queue.length} awaiting`}
                aside={<span className={styles.order}>{SORTS.find((option) => option.id === sort)!.label} first</span>}
              />
            ) : null}
            <CardBody flush className={styles.body}>
              {awaiting.length ? (
                <>
                  <ul id={queueId} className={styles.queue} aria-label="Referrals awaiting triage">
                    {shown.map((row, index) => (
                      <QueueRow
                        key={rowKey(row)}
                        row={row}
                        place={index + 1}
                        onChoose={() => onChoose(row)}
                        onOpenReferral={() => setOpenKey(rowKey(row))}
                      />
                    ))}
                  </ul>
                  {hidden > 0 ? (
                    <ShowMoreRow onClick={() => setShowAll((all) => !all)} expanded={showAll} controls={queueId}>
                      {showAll ? "Show fewer" : `Show all (${queue.length})`}
                    </ShowMoreRow>
                  ) : null}
                </>
              ) : (
                <p className={styles.sideEmpty}>No referral is waiting for a triage.</p>
              )}
            </CardBody>
          </Card>
        </div>
        <QueueSide awaiting={awaiting} people={people} />
      </div>
      <p className={styles.footNote}>
        Ward Flow prototype. Synthetic people only. Not validated clinical decision support.
      </p>
      <ReferralDrawer row={openRow} onClose={() => setOpenKey(null)} onChoose={onChoose} />
    </main>
  );
}

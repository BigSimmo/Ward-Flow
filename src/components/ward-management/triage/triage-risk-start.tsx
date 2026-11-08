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
import { ChevronRight, FileText, Inbox, UserPlus } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHead,
  ChipGroup,
  FilterChip,
  FormalName,
  Hero,
  Icon,
  PanelDrawer,
  SearchField,
  Segmented,
  ShowMoreRow,
  buttonClass,
  foldHidden,
  foldLimit,
} from "@/components/wf";
import { WARD_ADD_PERSON_HREF } from "@/components/ward-management/ward-nav";
import { splitDuration } from "@/components/ward-management/ward-clock";

import type { TriagePerson } from "./triage-risk-data";
import { legalLine, searchTriagePeople } from "./triage-risk-people";
import { TIER_LONG, TRIAGE_URGENCIES, type Tier } from "./triage-record";
import { useTriagePeople, type AwaitingTriage } from "./use-triage-people";
import styles from "./triage-risk-start.module.css";

/** Rows the queue shows before Show all. */
const QUEUE_LIMIT = 8;

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
            {person.referral ? (
              <Badge>
                Open referral {person.referral.id} · {person.referral.from}
              </Badge>
            ) : null}
            {person.last ? <Badge>Previous triage on record</Badge> : null}
          </span>
        </span>
        <Icon icon={ChevronRight} size={16} className={styles.chevron} />
      </button>
    </li>
  );
}

function QueueRow({
  row,
  onChoose,
  onOpenReferral,
}: {
  row: AwaitingTriage;
  onChoose: () => void;
  onOpenReferral: () => void;
}) {
  const { referral } = row;
  return (
    <li className={styles.row} data-testid="triage-start-referral-row">
      <div className={styles.rowWho}>
        <span className={styles.personName}>
          <FormalName name={row.name} />
          <span className={styles.personMeta}>{row.meta}</span>
        </span>
        <span className={styles.personLine}>
          UMRN <b className={styles.mono}>{row.umrn}</b>
        </span>
      </div>
      <div className={styles.rowFacts}>
        <span className={styles.personLine}>
          {referral.from} · <span className={styles.mono}>{referral.id}</span>
        </span>
        <span className={styles.rowTags}>
          {referral.received ? (
            <span className={styles.wait}>
              Waiting <b className={styles.mono}>{splitDuration(row.waitedMinutes)}</b>
            </span>
          ) : null}
          {referral.urgency ? <Badge>Asked {referral.urgency}</Badge> : null}
          <span className={styles.retriage}>{retriageWords(row)}</span>
        </span>
      </div>
      <div className={styles.rowActions}>
        <Button
          size="sm"
          icon={FileText}
          onClick={onOpenReferral}
          aria-haspopup="dialog"
          aria-label={`Referral ${referral.id} details`}
          data-testid="triage-start-referral-open"
        >
          Referral
        </Button>
        <Button
          size="sm"
          variant="pri"
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
      eyebrow={referral ? `Referral ${referral.id}` : "Referral"}
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

  return (
    <main id="main-content" className={styles.main} data-testid="triage-start">
      <Hero
        level={1}
        eyebrow="Triage and risk · Synthetic"
        title="Start a triage"
        titleMeta="SMHMR900 and SMHMR905"
        bar={
          <div className={styles.heroSearch}>
            <div className={styles.searchRow}>
              <SearchField
                id="triage-start-search"
                className={styles.search}
                label="Search by name, UMRN or date of birth"
                placeholder="Surname, given name, UMRN or DOB"
                value={query}
                onValueChange={setQuery}
              />
              {/* Search comes first; Add patient sits beside it, or under it on a phone. */}
              <Link
                href={WARD_ADD_PERSON_HREF}
                className={buttonClass({ variant: "light", className: styles.add })}
                data-testid="triage-start-add"
              >
                <Icon icon={UserPlus} size={16} />
                Not found? Add patient
              </Link>
            </div>
            {/* The at-a-glance line sits in the bar, not the foot, so a phone keeps it too. */}
            <p className={styles.glance} data-testid="triage-start-glance">
              {triageQueueGlance(awaiting)}
            </p>
            <p className={styles.heroHint}>Choose who it is for. The form opens blank, with nothing pre-selected.</p>
          </div>
        }
      />

      {searching ? (
        <Card className={styles.card} aria-labelledby={headingId}>
          <CardHead id={headingId} title="Matching people" meta={`${matches.length} of ${people.length} people`} />
          <CardBody className={styles.body}>
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

      <Card className={styles.card} aria-labelledby={`${headingId}-awaiting`} data-testid="triage-start-queue">
        <CardHead
          id={`${headingId}-awaiting`}
          title="Referrals awaiting triage"
          icon={Inbox}
          iconPlain
          meta={`${awaiting.length}`}
        />
        <CardBody className={styles.body}>
          {awaiting.length ? (
            <>
              <div className={styles.tools}>
                <ChipGroup label="Filter by source" className={styles.chips}>
                  <FilterChip
                    pressed={activeSource === null}
                    onPressedChange={() => setSource(null)}
                    count={awaiting.length}
                  >
                    All
                  </FilterChip>
                  {sources.map(({ from, count }) => (
                    <FilterChip
                      key={from}
                      pressed={activeSource === from}
                      onPressedChange={(pressed) => setSource(pressed ? from : null)}
                      count={count}
                    >
                      {from}
                    </FilterChip>
                  ))}
                </ChipGroup>
                <Segmented<QueueSort>
                  label="Sort referrals"
                  value={sort}
                  onChange={setSort}
                  items={[
                    { id: "wait", label: "Longest waiting" },
                    { id: "urgency", label: "Urgency asked" },
                  ]}
                />
              </div>
              <ul id={queueId} className={styles.queue} aria-label="Referrals awaiting triage">
                {shown.map((row) => (
                  <QueueRow
                    key={rowKey(row)}
                    row={row}
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
            <p className={styles.quiet}>No referral is waiting for a triage.</p>
          )}
        </CardBody>
      </Card>
      <p className={styles.footNote}>
        Ward Flow prototype. Synthetic people only. Not validated clinical decision support.
      </p>
      <ReferralDrawer row={openRow} onClose={() => setOpenKey(null)} onChoose={onChoose} />
    </main>
  );
}

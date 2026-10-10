"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BedDouble, ChevronLeft, ChevronRight, Copy, House, Phone, Route, Search } from "lucide-react";

import { Button, Icon, Sheet, SrOnly, StatusGlyph, Tabs, TextInput, cx, type WfTone } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { TRAVEL_BAND_LABELS } from "@/components/ward-management/ward-distance";
import type { RepatriationRecord } from "@/components/ward-management/ward-flow-reducer";
import type { OutOfAreaEntry } from "@/components/ward-management/ward-referrals";

import {
  RETURN_STATUS_SHORT,
  TRAVEL_SHORT,
  dischargeShort,
  shortSiteName,
  type ReturnStatus,
} from "./out-of-area-model";
import { TravelIcon } from "./out-of-area-return-plan";
import styles from "./out-of-area-board.module.css";

/**
 * Out of area on a phone (option A, 9 Oct 2026). Its own layout from the phone plan rather than a
 * reflow of the desktop register: three hero tiles, a Needs you list first, everyone second and the
 * bed picture third, a glass action bar, a peek sheet for one person and the full return plan as a
 * full-screen sheet. It renders rows the page has already read and owns only which tab is open and
 * whether the sheet shows the summary or the plan.
 */

export type PhonePerson = {
  entry: OutOfAreaEntry;
  name: string;
  umrn: string;
  profileHref: string | null;
  daysLabel: string;
  offset: number | null;
  status: ReturnStatus;
  record: RepatriationRecord | undefined;
  highlighted: boolean;
  who: { who: string; what: string };
};

type PhoneTab = "needs" | "all" | "beds";

const STATUS_TONE: Record<ReturnStatus, WfTone> = {
  none: "closed",
  started: "neutral",
  not_agreed: "neutral",
  agreed: "neutral",
};

function PersonCard({
  person,
  withReason = false,
  first = false,
  testId,
  selected,
  onOpen,
}: {
  person: PhonePerson;
  withReason?: boolean;
  first?: boolean;
  testId?: string;
  selected: boolean;
  onOpen: () => void;
}) {
  const { entry } = person;
  const overdue = person.offset !== null && person.offset < 0;
  const reason = entry.admission.blockReason;
  return (
    <li
      className={cx(styles.phoneCard, person.highlighted && styles.phoneCardLit)}
      data-first={first || undefined}
      data-testid={testId}
      data-selected={selected || undefined}
    >
      {/* One button covers the card, so the profile link beside it is never nested inside a button. */}
      <button
        type="button"
        className={styles.phoneCardOpen}
        aria-current={selected || undefined}
        aria-label={`Open ${person.name} (${person.umrn}), ${entry.admission.homeRegion} in ${entry.unit.name}`}
        onClick={onOpen}
      />
      <span className={styles.pcLine1}>
        <b>{person.name}</b>
        {overdue ? (
          <span className={styles.pcDue}>
            <StatusGlyph tone="warning" size={9} />
            {dischargeShort(person.offset)}
          </span>
        ) : (
          <span className={styles.pcDays}>
            {person.daysLabel}
            <SrOnly> away</SrOnly>
          </span>
        )}
      </span>
      <span className={styles.pcLine2}>
        {person.profileHref ? (
          <Link
            href={person.profileHref}
            className={styles.umrnLink}
            title={`Open profile for ${person.name} (${person.umrn})`}
          >
            {person.umrn}
          </Link>
        ) : (
          <span className={styles.mono}>{person.umrn}</span>
        )}
        <span className={styles.pcDot} aria-hidden="true" />
        <span className={styles.truncate}>{entry.admission.homeRegion}</span>
        <span className={styles.pcTravel} title={TRAVEL_BAND_LABELS[entry.band]}>
          <TravelIcon entry={entry} />
          <span aria-hidden="true">{TRAVEL_SHORT[entry.band]}</span>
          <SrOnly>{TRAVEL_BAND_LABELS[entry.band]}</SrOnly>
        </span>
      </span>
      {withReason && reason ? (
        <span className={cx(styles.pcLine3, styles.inkWarning)}>{reason}</span>
      ) : (
        <span className={styles.pcLine3}>
          {entry.unit.name} · {shortSiteName(entry.unit.siteCode)}
        </span>
      )}
      <span className={styles.pcLine4}>
        <StatusGlyph tone={STATUS_TONE[person.status]} size={9} />
        <span>{RETURN_STATUS_SHORT[person.status]}</span>
        <span className={styles.pcEnd}>
          {overdue
            ? `${person.daysLabel} away`
            : person.offset === null
              ? "No discharge date"
              : `Discharge ${dischargeShort(person.offset).toLowerCase()}`}
        </span>
        <Icon icon={ChevronRight} size={14} />
      </span>
    </li>
  );
}

export function OutOfAreaPhone({
  people,
  totalAway,
  dueCount,
  noPlanCount,
  highlight,
  onHighlight,
  query,
  onQuery,
  anyHighlight,
  highlightedCount,
  onClear,
  readyIds,
  leavingToday,
  now,
  selectedId,
  onSelect,
  onClose,
  nextUpId,
  onCopy,
  toolNote,
  renderPlan,
  shift,
  beds,
}: {
  people: PhonePerson[];
  totalAway: number;
  dueCount: number;
  noPlanCount: number;
  highlight: string | null;
  onHighlight: (key: "due" | "noplan") => void;
  query: string;
  onQuery: (value: string) => void;
  anyHighlight: boolean;
  highlightedCount: number;
  onClear: () => void;
  readyIds: string[];
  leavingToday: RepatriationRecord[];
  now: Instant;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  nextUpId: string | undefined;
  onCopy: () => void;
  toolNote: string | null;
  renderPlan: (entry: OutOfAreaEntry) => ReactNode;
  shift: ReactNode;
  beds: ReactNode;
}) {
  const [tab, setTab] = useState<PhoneTab>("needs");
  const [mode, setMode] = useState<"peek" | "plan">("peek");
  const byId = new Map(people.map((person) => [person.entry.admission.id, person]));
  const leaving = [...leavingToday]
    .filter((record) => byId.has(record.admissionId))
    .sort((a, b) => a.estimatedAt - b.estimatedAt);
  const leavingIds = new Set(leaving.map((record) => record.admissionId));
  const ready = readyIds.filter((id) => !leavingIds.has(id)).map((id) => byId.get(id)!);
  // Each person appears in one Needs you list only, and "more" counts everyone not shown above.
  const soon = people.filter(
    (person) =>
      !leavingIds.has(person.entry.admission.id) && person.offset !== null && person.offset >= 0 && person.offset <= 2,
  );
  const more = Math.max(0, people.length - leavingIds.size - ready.length - soon.length);
  const selected = selectedId ? byId.get(selectedId) : undefined;
  const index = selected ? people.indexOf(selected) : -1;
  const nextUp = nextUpId ? byId.get(nextUpId) : undefined;

  const open = (id: string) => {
    setMode("peek");
    onSelect(id);
  };
  const stepTo = (delta: number) => {
    const next = people[index + delta];
    if (next) onSelect(next.entry.admission.id);
  };
  const close = () => {
    setMode("peek");
    onClose();
  };

  const stepButtons = (
    <span className={styles.sheetNav}>
      <Button
        variant="ghost"
        iconOnly
        icon={ChevronLeft}
        aria-label="Previous person"
        disabled={index <= 0}
        onClick={() => stepTo(-1)}
      />
      <span className={styles.mono}>
        {index + 1}/{people.length}
      </span>
      <Button
        variant="ghost"
        iconOnly
        icon={ChevronRight}
        aria-label="Next person"
        disabled={index < 0 || index >= people.length - 1}
        onClick={() => stepTo(1)}
      />
    </span>
  );

  return (
    <div className={styles.phone}>
      <section className={styles.phoneHero} aria-labelledby="ward-out-of-area-phone-title">
        <h1 id="ward-out-of-area-phone-title" className="sr-only">
          Out of area, {totalAway} away from home
        </h1>
        <button type="button" className={styles.phoneTile} onClick={() => setTab("all")}>
          <span className={styles.phoneTileValue}>{totalAway}</span>
          <span className={styles.phoneTileLabel}>Away from home</span>
        </button>
        <button
          type="button"
          className={styles.phoneTile}
          aria-pressed={highlight === "due"}
          onClick={() => onHighlight("due")}
        >
          <span className={styles.phoneTileValue}>{dueCount}</span>
          <span className={styles.phoneTileLabel}>
            <StatusGlyph tone="warning" size={9} />
            Date passed
          </span>
        </button>
        <button
          type="button"
          className={styles.phoneTile}
          aria-pressed={highlight === "noplan"}
          onClick={() => onHighlight("noplan")}
        >
          <span className={styles.phoneTileValue}>{noPlanCount}</span>
          <span className={styles.phoneTileLabel}>
            <StatusGlyph tone="closed" size={9} />
            No plan
          </span>
        </button>
      </section>

      <Tabs
        label="Out of area view"
        idPrefix="ward-out-of-area-phone"
        className={styles.phoneTabs}
        value={tab}
        onChange={setTab}
        items={[
          { id: "needs", label: "Needs you", count: ready.length + leaving.length },
          { id: "all", label: "Everyone", count: people.length },
          { id: "beds", label: "Beds" },
        ]}
      />

      {tab === "needs" ? (
        <div
          className={styles.phonePanel}
          role="tabpanel"
          id="ward-out-of-area-phone-panel-needs"
          aria-labelledby="ward-out-of-area-phone-tab-needs"
        >
          {leaving.length ? (
            <section className={styles.phoneSection} aria-label="Leaving today">
              <h2 className={styles.phoneSectionTitle}>
                <StatusGlyph tone="info" size={9} />
                Leaving today <span className={styles.count}>{leaving.length}</span>
              </h2>
              <ul className={styles.phoneList}>
                {leaving.map((record) => {
                  const person = byId.get(record.admissionId)!;
                  return (
                    <li key={record.admissionId}>
                      <button type="button" className={styles.phoneLeave} onClick={() => open(record.admissionId)}>
                        <span className={styles.phoneLeaveTime}>{formatInstantWithDay(record.estimatedAt, now)}</span>
                        <span className={styles.two}>
                          <b>{person.name}</b>
                          <span>
                            {shortSiteName(record.homeHospital)} · {record.mode === "road" ? "Road" : "Flight"} ·{" "}
                            {record.provider}
                          </span>
                        </span>
                        <StatusGlyph tone={record.receivingWardAgreed ? "success" : "neutral"} size={10} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
          <section className={styles.phoneSection} aria-label="Ready to go home">
            <h2 className={styles.phoneSectionTitle}>
              <StatusGlyph tone="warning" size={9} />
              Ready to go home <span className={styles.count}>{ready.length}</span>
            </h2>
            {ready.length ? (
              <ul className={styles.phoneList}>
                {ready.map((person, i) => (
                  <PersonCard
                    key={person.entry.admission.id}
                    person={person}
                    withReason
                    first={i === 0}
                    selected={person.entry.admission.id === selectedId}
                    onOpen={() => open(person.entry.admission.id)}
                  />
                ))}
              </ul>
            ) : (
              <p className={styles.emptyLine}>Nobody is past their discharge date</p>
            )}
          </section>
          {soon.length ? (
            <section className={styles.phoneSection} aria-label="Due in the next 2 days">
              <h2 className={styles.phoneSectionTitle}>
                Due in the next 2 days <span className={styles.count}>{soon.length}</span>
              </h2>
              <ul className={styles.phoneList}>
                {soon.map((person) => (
                  <PersonCard
                    key={person.entry.admission.id}
                    person={person}
                    selected={person.entry.admission.id === selectedId}
                    onOpen={() => open(person.entry.admission.id)}
                  />
                ))}
              </ul>
            </section>
          ) : null}
          <button type="button" className={styles.phoneMore} onClick={() => setTab("all")}>
            <StatusGlyph tone="closed" size={9} />
            <span>{more} more away from home</span>
            <span className={styles.sub}>Everyone</span>
            <Icon icon={ChevronRight} size={14} />
          </button>
        </div>
      ) : null}

      <div hidden={tab !== "all"}>
        <div
          className={styles.phonePanel}
          role="tabpanel"
          id="ward-out-of-area-phone-panel-all"
          aria-labelledby="ward-out-of-area-phone-tab-all"
        >
          <TextInput
            icon={Search}
            boxClassName={styles.phoneSearch}
            placeholder="Name, UMRN or ward"
            aria-label="Highlight people by name, UMRN or ward"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            onClear={() => onQuery("")}
          />
          {anyHighlight ? (
            <p className={styles.hlLine}>
              <span aria-live="polite">
                <b className={styles.mono}>{highlightedCount}</b> synthetic records highlighted
              </span>
              <Button variant="ghost" size="sm" onClick={onClear}>
                Clear
              </Button>
            </p>
          ) : null}
          <ul className={styles.phoneList} data-testid="ward-out-of-area-cards">
            {people.map((person) => (
              <PersonCard
                key={person.entry.admission.id}
                person={person}
                testId={`ward-out-of-area-card-${person.entry.admission.id}`}
                selected={person.entry.admission.id === selectedId}
                onOpen={() => open(person.entry.admission.id)}
              />
            ))}
          </ul>
        </div>
      </div>

      {tab === "beds" ? (
        <div
          className={styles.phonePanel}
          role="tabpanel"
          id="ward-out-of-area-phone-panel-beds"
          aria-labelledby="ward-out-of-area-phone-tab-beds"
        >
          {shift}
          {beds}
        </div>
      ) : null}

      <div className={styles.phoneBar}>
        {nextUp ? (
          <Button
            variant="pri"
            icon={Route}
            className={styles.phoneBarMain}
            onClick={() => open(nextUp.entry.admission.id)}
          >
            Plan next return <span className={styles.phoneBarName}>{nextUp.name.split(" ")[0]}</span>
          </Button>
        ) : (
          <Button
            variant="sec"
            className={styles.phoneBarMain}
            disabledReason="Everyone has a return plan."
            reasonDisplay="tooltip"
          >
            All planned
          </Button>
        )}
        <Button variant="sec" iconOnly icon={Copy} aria-label="Copy summary for the bed meeting" onClick={onCopy} />
      </div>
      {toolNote ? (
        <p className={styles.phoneToast} role="status">
          {toolNote}
        </p>
      ) : null}

      {selected && mode === "peek" ? (
        <Sheet
          open
          onClose={close}
          title={selected.name}
          description={selected.umrn}
          mobilePlacement="bottom"
          headerActions={stepButtons}
          testId="ward-out-of-area-peek"
        >
          <div className={styles.peek}>
            <dl className={styles.peekGrid}>
              <div>
                <dt>Away</dt>
                <dd className={styles.mono}>{selected.daysLabel}</dd>
              </div>
              <div>
                <dt>Discharge</dt>
                <dd className={selected.offset !== null && selected.offset < 0 ? styles.inkWarning : undefined}>
                  {selected.offset !== null && selected.offset < 0 ? <StatusGlyph tone="warning" size={9} /> : null}
                  {dischargeShort(selected.offset)}
                </dd>
              </div>
              <div>
                <dt>Travel home</dt>
                <dd title={TRAVEL_BAND_LABELS[selected.entry.band]}>
                  <TravelIcon entry={selected.entry} />
                  {TRAVEL_SHORT[selected.entry.band]}
                </dd>
              </div>
              <div>
                <dt>Return</dt>
                <dd>
                  <StatusGlyph tone={STATUS_TONE[selected.status]} size={9} />
                  {RETURN_STATUS_SHORT[selected.status]}
                </dd>
              </div>
            </dl>
            <p className={styles.peekLine}>
              <Icon icon={BedDouble} size={14} />
              <span className={styles.truncate}>
                <b>{selected.entry.unit.name}</b> · {shortSiteName(selected.entry.unit.siteCode)}
              </span>
            </p>
            <p className={styles.peekLine}>
              <Icon icon={House} size={14} />
              <span className={styles.truncate}>
                Home region <b>{selected.entry.admission.homeRegion}</b>
              </span>
            </p>
            {selected.entry.admission.blockReason ? (
              <p className={cx(styles.peekLine, styles.inkWarning)}>
                <StatusGlyph tone="warning" size={9} />
                <span className={styles.truncate}>{selected.entry.admission.blockReason}</span>
              </p>
            ) : null}
            <p className={cx(styles.whoStrip, styles.peekWho)}>
              <StatusGlyph tone="neutral" size={9} />
              <b>{selected.who.who}</b>
              <span>{selected.who.what}</span>
            </p>
            <div className={styles.peekActs}>
              <Button variant="pri" icon={Route} onClick={() => setMode("plan")}>
                {selected.record
                  ? "View recorded return"
                  : selected.status === "started"
                    ? "Continue return plan"
                    : "Plan return"}
              </Button>
              <Button variant="sec" icon={Phone} disabledReason="Not wired in this prototype." reasonDisplay="tooltip">
                Call ward
              </Button>
            </div>
          </div>
        </Sheet>
      ) : null}

      {selected && mode === "plan" ? (
        <Sheet
          open
          onClose={close}
          title={selected.name}
          description={`Return plan · ${selected.umrn}`}
          mobilePlacement="fullscreen"
          headerLeading={
            <Button
              variant="ghost"
              iconOnly
              icon={ChevronLeft}
              aria-label="Back to summary"
              onClick={() => setMode("peek")}
            />
          }
          headerActions={stepButtons}
          bodyClassName={styles.planSheetBody}
          testId="ward-out-of-area-phone-plan"
        >
          <div className={styles.planSheet} data-testid="ward-out-of-area-subject">
            {renderPlan(selected.entry)}
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

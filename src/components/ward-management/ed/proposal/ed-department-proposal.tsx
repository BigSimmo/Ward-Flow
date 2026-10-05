"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { formatInstantWithDay, splitDuration } from "@/components/ward-management/ward-clock";
import { designationSummary } from "@/components/ward-management/ward-bed-designation";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { stageCopy, unitCapacity, wardServiceOrder } from "@/components/ward-management/ward-derivations";
import type { HealthService } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { edArrivedFor, edExpectsFor } from "@/components/ward-management/ward-referrals";
import { allEmergencyDepartments, edById, siteByCode } from "@/components/ward-management/ward-sites";

import {
  attentionItems,
  initialsOf,
  bedsBeingPrepared,
  ED_STEPS,
  edCounts,
  edRows,
  hubRows,
  readyBeds,
  recentEvents,
  type EdEvent,
  type EdPatientRow,
} from "./ed-proposal-figures";
import { edProposalHref, KpiStrip, Panel, ProposalHeader, Tag, useEdProposalWorld } from "./ed-proposal-parts";
import styles from "./ed-proposal.module.css";

const NOT_WIRED = "Not wired in this prototype.";

type Filter = "everyone" | "not_reviewed" | "no_bed" | "under_form" | "past_target";
type Sort = "longest" | "urgency" | "step";

const FILTERS: { id: Filter; label: string; test: (row: EdPatientRow) => boolean }[] = [
  { id: "everyone", label: "Everyone", test: () => true },
  { id: "not_reviewed", label: "Not reviewed", test: (row) => !row.reviewed && row.step !== "closed_here" },
  { id: "no_bed", label: "No destination", test: (row) => row.step === "no_bed" },
  { id: "under_form", label: "Under a form", test: (row) => row.form !== undefined && row.step !== "closed_here" },
  { id: "past_target", label: "Past target", test: (row) => row.pastTarget },
];

const EXAMINATION_LABELS: Record<string, string> = {
  inpatient_order: "Inpatient treatment order",
  community_order: "Community treatment order",
  revoked: "Revoked, does not proceed",
  further_examination_ordered: "Further examination ordered",
};

const CLEARANCE_LABELS: Record<EdPatientRow["cleared"], string> = {
  cleared: "Cleared",
  not_cleared: "Not cleared",
  not_recorded: "Not recorded",
};

type ListTab = "review" | "clearance" | "expects" | "forms" | "referred";

const LIST_TABS: { id: ListTab; label: string }[] = [
  { id: "review", label: "Review" },
  { id: "clearance", label: "Med clear" },
  { id: "expects", label: "Expects" },
  { id: "forms", label: "Forms" },
  { id: "referred", label: "Referred" },
];

/** One department list: initials, a grey detail line and a quiet link to the record. */
function RowList({
  rows,
  detail,
  onOpen,
}: {
  rows: readonly EdPatientRow[];
  detail: (row: EdPatientRow) => string;
  onOpen: (movementId: string) => void;
}) {
  if (rows.length === 0)
    return (
      <div className={styles.panelBody}>
        <p className={styles.none}>None recorded.</p>
      </div>
    );
  return (
    <ul className={styles.list}>
      {rows.map((row) => (
        <li key={row.movement.id} className={styles.rowItem}>
          <span className={styles.who}>
            <span className={styles.whoName}>{row.initials}</span>
            <span className={styles.sub}>{detail(row)}</span>
          </span>
          <span className={`${styles.sub} ${styles.num}`}>{splitDuration(row.sinceReferral)}</span>
          <button type="button" className={styles.attentionOpen} onClick={() => onOpen(row.movement.id)}>
            View record<span className="sr-only">: {row.initials}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function shortName(name: string): string {
  return name.replace(" Emergency Department", "");
}

export function EdDepartmentProposal({ edId }: { edId: string }) {
  const router = useRouter();
  const { world, now, accessTarget, asAt } = useEdProposalWorld();
  const department = edById(edId);
  const [filter, setFilter] = useState<Filter>("everyone");
  const [listTab, setListTab] = useState<ListTab>("review");
  const [eventKind, setEventKind] = useState<"all" | EdEvent["kind"]>("all");
  const [service, setService] = useState<"all" | HealthService>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("longest");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const closeSheet = useCallback(() => setSelectedId(undefined), []);

  const rows = useMemo(
    () => (department ? edRows(department.id, world, now, accessTarget) : []),
    [department, world, now, accessTarget],
  );

  if (!department) {
    return (
      <main id="main-content" className={styles.page}>
        <ProposalHeader
          crumbs={[{ label: "ED Hub", href: edProposalHref() }]}
          title="Department not found"
          asAt={asAt}
        />
        <Panel title="No emergency department by that name">
          <p className={styles.none}>
            Choose a department from the{" "}
            <a className={styles.link} href={edProposalHref()}>
              ED Hub
            </a>
            .
          </p>
        </Panel>
      </main>
    );
  }

  const site = siteByCode(department.siteCode);
  const counts = edCounts(rows);
  const awaitingReview = edArrivedFor(world.referrals, department.id, "psychiatric_review");
  const expects = edExpectsFor(world.referrals, department.id, "psychiatric_review");
  const referralInitials = (referral: Parameters<typeof resolveSubjectPatient>[0]) =>
    initialsOf(resolveSubjectPatient(referral, world).displayName);
  const attention = attentionItems(rows, world.units, awaitingReview, now, referralInitials);
  const target = accessTarget % 60 === 0 ? `${accessTarget / 60}-hour` : splitDuration(accessTarget);
  const ready = readyBeds(world.units, world.bedReleases);
  const preparing = bedsBeingPrepared(world.units, world.bedReleases);
  const others = hubRows(world, now, accessTarget).filter((row) => row.ed.id !== department.id);
  const live = rows.filter((row) => row.step !== "closed_here");
  const notReviewed = live.filter((row) => !row.reviewed);
  const notCleared = live.filter((row) => row.cleared === "not_cleared");
  const underForm = live.filter((row) => row.form !== undefined);
  const stillToMove = rows.filter((row) => ["no_bed", "accepted", "pulled", "handover_ready"].includes(row.step));
  const listCounts: Record<ListTab, number> = {
    review: notReviewed.length,
    clearance: notCleared.length,
    expects: expects.length,
    forms: underForm.length,
    referred: stillToMove.length,
  };
  const events = recentEvents(rows, world.units, now);

  const filterTest = FILTERS.find((entry) => entry.id === filter)!.test;
  const needle = query.trim().toLowerCase();
  const visible = rows
    .filter(filterTest)
    .filter(
      (row) =>
        !needle ||
        row.initials.toLowerCase().includes(needle) ||
        row.umrn.toLowerCase().includes(needle) ||
        (row.destination ?? "").toLowerCase().includes(needle),
    )
    .sort((a, b) =>
      sort === "urgency"
        ? a.movement.urgency - b.movement.urgency || b.sinceReferral - a.sinceReferral
        : sort === "step"
          ? ED_STEPS.findIndex((s) => s.id === a.step) - ED_STEPS.findIndex((s) => s.id === b.step)
          : b.sinceReferral - a.sinceReferral,
    );
  const selected = rows.find((row) => row.movement.id === selectedId);

  const shownEvents = eventKind === "all" ? events : events.filter((event) => event.kind === eventKind);

  return (
    <main id="main-content" className={styles.page} data-testid="ed-department-proposal">
      <ProposalHeader
        crumbs={[{ label: "ED Hub", href: edProposalHref() }, { label: shortName(department.name) }]}
        title={shortName(department.name)}
        service={`${site?.service ?? "Service not identified"} · Emergency department`}
        asAt={asAt}
        actions={
          <>
            <label className="sr-only" htmlFor="ed-proposal-department">
              Choose department
            </label>
            <select
              id="ed-proposal-department"
              className={styles.select}
              value={department.id}
              onChange={(event) => router.push(edProposalHref(event.target.value))}
            >
              {allEmergencyDepartments().map((ed) => (
                <option key={ed.id} value={ed.id}>
                  {shortName(ed.name)}
                </option>
              ))}
            </select>
            <a className={styles.button} href="/mockups/ward-flow/referrals/new">
              Raise referral
            </a>
          </>
        }
      />

      <KpiStrip
        label="Department figures"
        items={[
          { label: "On the board", value: counts.onList, note: "Includes anyone who has left and is in transit" },
          {
            label: "Accepted, waiting to move",
            value: counts.steps.accepted + counts.steps.pulled,
            note: "A ward said yes; still here",
          },
          {
            label: "Review referrals",
            value: awaitingReview.length,
            note: "Referrals waiting for psychiatric review",
          },
          { label: "Expected", value: expects.length, note: "Referred here, not arrived" },
          { label: "Under a form", value: counts.underForm, note: "Form recorded on the movement" },
          {
            label: "Longest since referral",
            value: counts.longest === undefined ? "None" : splitDuration(counts.longest),
            note: counts.pastTarget
              ? `${counts.pastTarget} past the ${target} target, your default`
              : "Access clock, not time in the building",
            tone: counts.pastTarget ? "danger" : undefined,
          },
        ]}
      />

      <nav className={styles.otherEds} aria-label="Other emergency departments">
        <span className={styles.otherEdsLabel}>Other EDs</span>
        <ul>
          {others.map((other) => (
            <li key={other.ed.id}>
              <a className={styles.link} href={edProposalHref(other.ed.id)}>
                {shortName(other.ed.name)}
                <span className={styles.filterCount}>{other.counts.onList}</span>
                {other.counts.pastTarget ? (
                  <span className="sr-only">, {other.counts.pastTarget} past target</span>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.grid2}>
        <Panel title="Needs attention" meta={attention.length ? `${attention.length}` : "None recorded"} flush>
          {attention.length === 0 ? (
            <div className={styles.panelBody}>
              <p className={styles.none}>None recorded.</p>
            </div>
          ) : (
            <ul className={styles.attention}>
              {attention.map((item, index) => (
                <li key={index} className={styles.attentionItem}>
                  <div>
                    <p
                      className={`${styles.attentionTitle} ${item.tone === "danger" ? styles.toneDanger : item.tone === "warn" ? styles.toneWarn : ""}`}
                    >
                      {item.title}
                    </p>
                    <p className={styles.attentionWhy}>
                      {item.who} · {item.why}
                    </p>
                  </div>
                  {item.movementId ? (
                    <button
                      type="button"
                      className={styles.attentionOpen}
                      onClick={() => setSelectedId(item.movementId)}
                    >
                      View record
                    </button>
                  ) : (
                    <span />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Department lists" meta={`${notReviewed.length} awaiting review`} flush>
          <div className={styles.toolbar} role="group" aria-label="Choose a list">
            {LIST_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={styles.filter}
                aria-pressed={listTab === tab.id}
                onClick={() => setListTab(tab.id)}
              >
                {tab.label} <span className={styles.filterCount}>{listCounts[tab.id]}</span>
              </button>
            ))}
          </div>
          {listTab === "review" ? (
            <>
              {awaitingReview.length ? (
                <>
                  <p className={styles.sectionLabel}>Referrals · {awaitingReview.length}</p>
                  <ul className={styles.list}>
                    {awaitingReview.map(({ referral }) => (
                      <li key={referral.id} className={styles.listItem}>
                        <span className={styles.who}>
                          <span className={styles.whoName}>{referralInitials(referral)}</span>
                          <span className={styles.sub}>{urgencyTierLabel(referral.urgency)}</span>
                        </span>
                        <span className={styles.sub}>
                          {rows.some((row) => row.movement.referralId === referral.id && row.reviewed)
                            ? "Examination already recorded on the movement"
                            : referral.triagedAt !== undefined
                              ? `${splitDuration(Math.max(now - referral.triagedAt, 0))} since triage`
                              : "Triage not recorded"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              <p className={styles.sectionLabel}>Awaiting review · {notReviewed.length}</p>
              <RowList
                rows={notReviewed}
                detail={(row) => `${row.movement.cohort} · Examination not recorded`}
                onOpen={setSelectedId}
              />
            </>
          ) : listTab === "clearance" ? (
            <RowList rows={notCleared} detail={() => "Medically not cleared"} onOpen={setSelectedId} />
          ) : listTab === "expects" ? (
            expects.length === 0 ? (
              <div className={styles.panelBody}>
                <p className={styles.none}>No expected arrival is recorded.</p>
              </div>
            ) : (
              <ul className={styles.list}>
                {expects.map(({ referral }) => (
                  <li key={referral.id} className={styles.listItem}>
                    <span className={styles.who}>
                      <span className={styles.whoName}>{referralInitials(referral)}</span>
                      <span className={styles.sub}>
                        Referred {splitDuration(Math.max(now - referral.raisedAt, 0))} ago
                      </span>
                    </span>
                    <button
                      type="button"
                      className={styles.buttonQuiet}
                      onClick={() =>
                        world.dispatch({
                          type: "RECORD_ARRIVED_IN_DEPARTMENT",
                          role: "ed",
                          now,
                          referralId: referral.id,
                        })
                      }
                    >
                      Mark arrived
                      <span className="sr-only"> (changes the shared synthetic record)</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : listTab === "forms" ? (
            <RowList rows={underForm} detail={(row) => `Form ${row.form}`} onOpen={setSelectedId} />
          ) : (
            <RowList
              rows={stillToMove}
              detail={(row) => ED_STEPS.find((entry) => entry.id === row.step)!.label}
              onOpen={setSelectedId}
            />
          )}
        </Panel>
      </div>

      <Panel
        title="ED psychiatry board"
        question="Oldest referral first. Select a person to see their record."
        meta={`${visible.length} of ${rows.length}`}
        flush
      >
        <div className={styles.toolbar}>
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={styles.filter}
              aria-pressed={filter === entry.id}
              onClick={() => setFilter(entry.id)}
            >
              {entry.label} <span className={styles.filterCount}>{rows.filter(entry.test).length}</span>
            </button>
          ))}
          <label className="sr-only" htmlFor="ed-proposal-search">
            Find by initials, UMRN or destination
          </label>
          <input
            id="ed-proposal-search"
            className={styles.search}
            type="search"
            placeholder="Find by initials, UMRN or destination"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <label className="sr-only" htmlFor="ed-proposal-sort">
            Sort
          </label>
          <select
            id="ed-proposal-sort"
            className={styles.select}
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
          >
            <option value="longest">Longest since referral</option>
            <option value="urgency">Most urgent</option>
            <option value="step">Step</option>
          </select>
        </div>
        {visible.length === 0 ? (
          <div className={styles.panelBody}>
            <p className={styles.none}>
              {rows.length === 0
                ? "Nobody is on this department's board. This means none is recorded, not that the department is empty."
                : "Nobody matches these filters."}
            </p>
          </div>
        ) : (
          <div className={styles.tableScroll} role="region" aria-label="ED psychiatry board table" tabIndex={0}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Patient</th>
                  <th scope="col" className={styles.num}>
                    Since referral
                  </th>
                  <th scope="col">Form</th>
                  <th scope="col">Medically cleared</th>
                  <th scope="col">Presentation</th>
                  <th scope="col">Next step</th>
                  <th scope="col">Destination</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.movement.id}
                    className={styles.row}
                    data-selected={row.movement.id === selectedId ? "true" : undefined}
                    onClick={() => setSelectedId(row.movement.id)}
                  >
                    <td>
                      <span className={styles.who}>
                        <button
                          type="button"
                          className={styles.rowButton}
                          onClick={() => setSelectedId(row.movement.id)}
                        >
                          {row.initials}
                          <span className="sr-only">: open record</span>
                        </button>
                        <span className={styles.sub}>
                          {row.movement.cohort} · Tier {row.movement.urgency}
                        </span>
                      </span>
                    </td>
                    <td className={`${styles.num} ${row.pastTarget ? styles.toneDanger : ""}`}>
                      {splitDuration(row.sinceReferral)}
                      {row.pastTarget ? <span className={styles.sub}> past target</span> : null}
                    </td>
                    <td>{row.form ? `Form ${row.form}` : <span className={styles.sub}>None recorded</span>}</td>
                    <td>
                      {row.cleared === "cleared" ? (
                        <Tag tone="good">Cleared</Tag>
                      ) : (
                        <span className={styles.sub}>{CLEARANCE_LABELS[row.cleared]}</span>
                      )}
                    </td>
                    <td>
                      <span className={styles.who}>
                        <span>{row.reviewed ? "Examination recorded" : "Awaiting review"}</span>
                        <span className={styles.sub}>{ED_STEPS.find((s) => s.id === row.step)!.label}</span>
                      </span>
                    </td>
                    <td>
                      <Tag tone={row.next.tone}>{row.next.label}</Tag>
                    </td>
                    <td>{row.destination ?? <span className={styles.sub}>None yet</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Seen in the last 24 hours"
        question="What was recorded for this department's board, newest first. Not everything that happened."
        meta={`${events.length} ${events.length === 1 ? "event" : "events"}`}
        flush
      >
        <div className={styles.toolbar} role="group" aria-label="Filter events">
          {(["all", "Referral", "Review", "Bed search", "Movement"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              className={styles.filter}
              aria-pressed={eventKind === kind}
              onClick={() => setEventKind(kind)}
            >
              {kind === "all" ? "All events" : kind}{" "}
              <span className={styles.filterCount}>
                {kind === "all" ? events.length : events.filter((event) => event.kind === kind).length}
              </span>
            </button>
          ))}
        </div>
        {shownEvents.length === 0 ? (
          <div className={styles.panelBody}>
            <p className={styles.none}>Nothing was recorded in the last 24 hours.</p>
          </div>
        ) : (
          <ol className={styles.timeline}>
            {shownEvents.map((event, index) => (
              <li key={`${event.at}-${index}`} className={styles.timelineItem}>
                <span className={styles.time}>{formatInstantWithDay(event.at, now)}</span>
                <span className={styles.sub}>{event.kind}</span>
                <span>
                  <strong>{event.who}</strong> {event.text}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <Panel
        title={`Statewide capacity · ${world.units.length} units`}
        question="Ward-confirmed capacity for context. Read-only; the same source as Capacity."
        meta={`${ready} beds ready now${preparing ? ` · ${preparing} still being made ready` : ""}`}
        flush
      >
        <div className={styles.toolbar} role="group" aria-label="Filter units by health service">
          {(["all", ...wardServiceOrder] as const).map((entry) => (
            <button
              key={entry}
              type="button"
              className={styles.filter}
              aria-pressed={service === entry}
              onClick={() => setService(entry)}
            >
              {entry === "all" ? "All services" : entry}{" "}
              <span className={styles.filterCount}>
                {entry === "all"
                  ? world.units.length
                  : world.units.filter((unit) => siteByCode(unit.siteCode)?.service === entry).length}
              </span>
            </button>
          ))}
        </div>
        <div className={styles.tableScroll} role="region" aria-label="Statewide capacity table" tabIndex={0}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Unit</th>
                <th scope="col">Cohort</th>
                <th scope="col">Security</th>
                <th scope="col" className={styles.num}>
                  Ready
                </th>
                <th scope="col" className={styles.num}>
                  Beds
                </th>
                <th scope="col">
                  <span className="sr-only">Share of beds in use</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {wardServiceOrder
                .filter((entry) => service === "all" || entry === service)
                .flatMap((entry) =>
                  world.units
                    .filter((unit) => siteByCode(unit.siteCode)?.service === entry)
                    .map((unit) => {
                      const capacity = unitCapacity(unit, world.bedReleases);
                      const pending = bedsPendingPreparation(unit.id, world.bedReleases);
                      return (
                        <tr key={unit.id} className={styles.row}>
                          <th scope="row">
                            <span className={styles.who}>
                              <span className={styles.whoName}>{unit.name}</span>
                              <span className={styles.sub}>{entry}</span>
                            </span>
                          </th>
                          <td>{unit.cohort}</td>
                          <td className={styles.sub}>{designationSummary(unit)}</td>
                          <td className={styles.num}>
                            {capacity.available}
                            {pending ? <span className={styles.sub}> · {pending} being made ready</span> : null}
                          </td>
                          <td className={styles.num}>{unit.beds}</td>
                          <td aria-hidden="true">
                            <span className={styles.hbarTrack}>
                              <span
                                className={styles.hbar}
                                style={{
                                  width: `${Math.min(100, Math.round(((unit.beds - capacity.available) / Math.max(unit.beds, 1)) * 100))}%`,
                                }}
                              />
                            </span>
                          </td>
                        </tr>
                      );
                    }),
                )}
            </tbody>
          </table>
        </div>
      </Panel>

      <p className={styles.footer}>Synthetic prototype · Emergency department census · Not a medical device</p>

      {selected ? (
        <PatientDrawer row={selected} now={now} edId={department.id} units={world.units} onClose={closeSheet} />
      ) : null}
    </main>
  );
}

function PatientDrawer({
  row,
  now,
  edId,
  units,
  onClose,
}: {
  row: EdPatientRow;
  now: number;
  edId: string;
  units: readonly { id: string; name: string }[];
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const m = row.movement;
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    // The page behind the sheet is unreachable while it is open, by Tab and by screen reader.
    const behind = document.getElementById("main-content");
    behind?.setAttribute("inert", "");
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !sheetRef.current) return;
      // Keep focus inside the sheet while it is open.
      const focusable = sheetRef.current.querySelectorAll<HTMLElement>("button, a[href], [tabindex='0']");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      behind?.removeAttribute("inert");
      opener?.focus();
    };
  }, [onClose]);
  const journey = [
    { at: m.openedAt, text: "Referral received" },
    ...(m.examination
      ? [
          {
            at: m.examination.at,
            text: `Examination: ${EXAMINATION_LABELS[m.examination.outcome] ?? "outcome recorded"}`,
          },
        ]
      : []),
    ...m.declines.map((d) => ({
      at: d.at,
      text: `${units.find((u) => u.id === d.unitId)?.name ?? "A ward"} declined`,
    })),
    ...m.stageChanges
      .filter((c) => c.to !== "placement_requested")
      .map((c) => ({ at: c.at, text: stageCopy[c.to].label })),
  ].sort((a, b) => b.at - a.at);
  return createPortal(
    <div className={styles.scrim} onClick={onClose}>
      <div
        ref={sheetRef}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ed-proposal-drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.drawerHead}>
          <div>
            <h2 id="ed-proposal-drawer-title" className={styles.panelTitle}>
              <span className="sr-only">Patient record: </span>
              {row.initials}
            </h2>
            <p className={styles.sub}>
              {row.umrn} · {m.cohort} · {m.sex} · {urgencyTierLabel(m.urgency)}
            </p>
          </div>
          <button ref={closeRef} type="button" className={styles.buttonQuiet} onClick={onClose}>
            Close
          </button>
        </div>
        <div className={styles.drawerBody}>
          <div>
            <p className={styles.sectionLabel}>Next step</p>
            <Tag tone={row.next.tone}>{row.next.label}</Tag>
          </div>
          <dl className={styles.facts}>
            <dt>Step</dt>
            <dd>{ED_STEPS.find((s) => s.id === row.step)!.label}</dd>
            <dt>Since referral</dt>
            <dd>
              {splitDuration(row.sinceReferral)} (received {formatInstantWithDay(m.openedAt, now)})
            </dd>
            <dt>Destination</dt>
            <dd>{row.destination ?? "None yet"}</dd>
            <dt>Wards asked</dt>
            <dd>
              {m.referredUnitIds.length} waiting · {m.declines.length} declined
            </dd>
            <dt>Legal status</dt>
            <dd>{m.legalStatus}</dd>
            <dt>Recorded form</dt>
            <dd>
              {m.legalForm
                ? `Form ${m.legalForm.code}${m.legalForm.dueAt !== undefined ? `, deadline written on the form ${formatInstantWithDay(m.legalForm.dueAt, now)}` : ", no deadline recorded"}`
                : "None recorded"}
            </dd>
            <dt>Medically cleared</dt>
            <dd>{CLEARANCE_LABELS[row.cleared]}</dd>
            <dt>Psychiatric review</dt>
            <dd>
              {m.examination ? (EXAMINATION_LABELS[m.examination.outcome] ?? "Outcome recorded") : "Not recorded"}
            </dd>
          </dl>
          <div>
            <p className={styles.sectionLabel}>Journey</p>
            <ol className={styles.timeline}>
              {journey.map((entry, index) => (
                <li key={index} className={styles.timelineItem}>
                  <span className={styles.time}>{formatInstantWithDay(entry.at, now)}</span>
                  <span>{entry.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className={styles.drawerFoot}>
          <button
            type="button"
            className={styles.button}
            aria-disabled="true"
            onClick={ignoreUnavailableActivation}
            aria-describedby="ed-proposal-not-wired"
          >
            {row.next.label}
          </button>
          <a className={styles.buttonQuiet} href={`/mockups/ward-flow/ed/${edId}`}>
            Act on the current screen
          </a>
          <p id="ed-proposal-not-wired" className={styles.notWired}>
            {NOT_WIRED}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { formatInstantWithDay, splitDuration } from "@/components/ward-management/ward-clock";
import { stageCopy } from "@/components/ward-management/ward-derivations";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { edArrivedFor, edExpectsFor } from "@/components/ward-management/ward-referrals";
import { allEmergencyDepartments, edById, siteByCode } from "@/components/ward-management/ward-sites";

import {
  attentionItems,
  bedsBeingPrepared,
  ED_STEPS,
  edCounts,
  edRows,
  fittingWards,
  readyBeds,
  recentEvents,
  type EdPatientRow,
  type EdStep,
} from "./ed-proposal-figures";
import { Answer, edProposalHref, KpiStrip, Panel, ProposalHeader, Tag, useEdProposalWorld } from "./ed-proposal-parts";
import styles from "./ed-proposal.module.css";

const NOT_WIRED = "Not wired in this prototype.";

type Filter = "everyone" | "not_reviewed" | "no_bed" | "under_form" | "past_target";
type Sort = "longest" | "urgency" | "step";

const FILTERS: { id: Filter; label: string; test: (row: EdPatientRow) => boolean }[] = [
  { id: "everyone", label: "Everyone", test: () => true },
  { id: "not_reviewed", label: "Not reviewed", test: (row) => !row.reviewed && row.step !== "closed_here" },
  { id: "no_bed", label: "No bed yet", test: (row) => row.step === "no_bed" },
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

function shortName(name: string): string {
  return name.replace(" Emergency Department", "");
}

export function EdDepartmentProposal({ edId }: { edId: string }) {
  const router = useRouter();
  const { world, now, accessTarget, asAt } = useEdProposalWorld();
  const department = edById(edId);
  const [filter, setFilter] = useState<Filter>("everyone");
  const [step, setStep] = useState<EdStep | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("longest");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

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
  const referralInitials = (referral: Parameters<typeof resolveSubjectPatient>[0]) => {
    const name = resolveSubjectPatient(referral, world).displayName;
    return name === "Unknown Patient"
      ? "Not linked"
      : name
          .split(/[\s,]+/)
          .filter(Boolean)
          .map((part) => `${part[0]}.`)
          .join(" ");
  };
  const attention = attentionItems(rows, world.units, awaitingReview, now, referralInitials);
  const target = splitDuration(accessTarget);
  const ready = readyBeds(world.units, world.bedReleases);
  const preparing = bedsBeingPrepared(world.units, world.bedReleases);
  const waitingCohorts = rows.filter((row) => row.step === "no_bed").map((row) => row.movement.cohort);
  const fits = fittingWards(world.units, world.bedReleases, waitingCohorts);
  const events = recentEvents(rows, world.units, now);

  const filterTest = FILTERS.find((entry) => entry.id === filter)!.test;
  const needle = query.trim().toLowerCase();
  const visible = rows
    .filter(filterTest)
    .filter((row) => (step ? row.step === step : true))
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

  const lead =
    counts.onList === 0
      ? `Nobody from ${shortName(department.name)} is on the psychiatry list.`
      : `${counts.onList} ${counts.onList === 1 ? "person is" : "people are"} on the psychiatry list: ${counts.noBed} with no bed yet, ${counts.bedFound} with a bed found but still here.`;
  const sub =
    attention.length === 0
      ? "Nothing needs action right now."
      : `${attention.length} ${attention.length === 1 ? "thing needs" : "things need"} action now${
          counts.pastTarget ? `, including ${counts.pastTarget} past the ${target} access target` : ""
        }.`;

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

      <Answer lead={lead} sub={sub} />

      <KpiStrip
        label="Department figures"
        items={[
          { label: "On the list", value: counts.onList, note: "Psychiatry patients still here" },
          {
            label: "No bed yet",
            value: counts.noBed,
            note: "No ward has accepted",
            tone: counts.noBed ? "warn" : undefined,
          },
          { label: "Bed found, still here", value: counts.bedFound, note: "Accepted, pulled or handover ready" },
          { label: "Not yet reviewed", value: counts.notReviewed, note: "No examination recorded" },
          {
            label: "Past access target",
            value: counts.pastTarget,
            note: `Over ${target} since referral (your default)`,
            tone: counts.pastTarget ? "danger" : undefined,
          },
          {
            label: "Longest since referral",
            value: counts.longest === undefined ? "None" : splitDuration(counts.longest),
            note: "Access clock, not time in the building",
          },
        ]}
      />

      <div className={styles.grid2}>
        <Panel
          title="Where everyone is up to"
          question="Each person is in exactly one step. Choose a step to filter the list below."
          meta={`${counts.onList} people`}
          flush
        >
          <div className={styles.steps}>
            {ED_STEPS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={styles.stepButton}
                aria-pressed={step === entry.id}
                disabled={counts.steps[entry.id] === 0}
                onClick={() => setStep((current) => (current === entry.id ? undefined : entry.id))}
              >
                <span className={styles.stepCount}>{counts.steps[entry.id]}</span>
                <span className={styles.stepLabel}>{entry.label}</span>
                <span className={styles.stepHint}>{entry.hint}</span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Needs action now" meta={attention.length ? `${attention.length}` : "None"} flush>
          {attention.length === 0 ? (
            <div className={styles.panelBody}>
              <p className={styles.none}>Nothing needs action now.</p>
            </div>
          ) : (
            <ul className={styles.attention}>
              {attention.map((item, index) => (
                <li key={index} className={styles.attentionItem}>
                  <Tag tone={item.tone}>{item.who}</Tag>
                  <div>
                    <p className={styles.attentionTitle}>{item.title}</p>
                    <p className={styles.attentionWhy}>{item.why}</p>
                  </div>
                  {item.movementId ? (
                    <button
                      type="button"
                      className={styles.attentionOpen}
                      onClick={() => setSelectedId(item.movementId)}
                    >
                      Open
                    </button>
                  ) : (
                    <span />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Psychiatry list"
        question="Oldest referral first. Select a person to see their record and next step."
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
            Find by initials, UMRN or ward
          </label>
          <input
            id="ed-proposal-search"
            className={styles.search}
            type="search"
            placeholder="Find by initials, UMRN or ward"
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
                ? "Nobody is on this department's psychiatry list. This means none is recorded, not that the department is empty."
                : "Nobody matches these filters."}
            </p>
          </div>
        ) : (
          <div className={styles.tableScroll} role="region" aria-label="Psychiatry list table" tabIndex={0}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Patient</th>
                  <th scope="col" className={styles.num}>
                    Since referral
                  </th>
                  <th scope="col">Step</th>
                  <th scope="col">Destination</th>
                  <th scope="col">Form</th>
                  <th scope="col">Medically cleared</th>
                  <th scope="col">Next step</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.movement.id}
                    className={styles.row}
                    tabIndex={0}
                    aria-selected={row.movement.id === selectedId}
                    aria-label={`${row.initials}, ${row.umrn}. Open record`}
                    onClick={() => setSelectedId(row.movement.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(row.movement.id);
                      }
                    }}
                  >
                    <td>
                      <span className={styles.who}>
                        <span className={styles.whoName}>{row.initials}</span>
                        <span className={styles.sub}>
                          {row.umrn} · {row.movement.cohort} · Tier {row.movement.urgency}
                        </span>
                      </span>
                    </td>
                    <td className={`${styles.num} ${row.pastTarget ? styles.toneDanger : ""}`}>
                      {splitDuration(row.sinceReferral)}
                      {row.pastTarget ? <span className={styles.sub}> past target</span> : null}
                    </td>
                    <td>{ED_STEPS.find((s) => s.id === row.step)!.label}</td>
                    <td>{row.destination ?? <span className={styles.sub}>None yet</span>}</td>
                    <td>{row.form ? `Form ${row.form}` : <span className={styles.sub}>None recorded</span>}</td>
                    <td>
                      {row.cleared === "cleared" ? (
                        <Tag tone="good">Cleared</Tag>
                      ) : (
                        <span className={styles.sub}>{CLEARANCE_LABELS[row.cleared]}</span>
                      )}
                    </td>
                    <td>
                      <Tag tone={row.next.tone}>{row.next.label}</Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className={styles.grid2}>
        <div className={styles.stack}>
          <Panel
            title="Recorded in the last 24 hours"
            question="What was recorded for this department's list, newest first."
            flush
          >
            <details className={styles.details}>
              <summary>
                {events.length} recorded {events.length === 1 ? "event" : "events"}:{" "}
                {(["Referral", "Review", "Bed search", "Movement"] as const)
                  .map((kind) => `${kind} ${events.filter((e) => e.kind === kind).length}`)
                  .join(" · ")}
              </summary>
              {events.length === 0 ? (
                <div className={styles.panelBody}>
                  <p className={styles.none}>Nothing was recorded in the last 24 hours.</p>
                </div>
              ) : (
                <ol className={styles.timeline}>
                  {events.map((event, index) => (
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
            </details>
          </Panel>
        </div>
        <div className={styles.stack}>
          <Panel
            title="Referrals waiting for review"
            question="In the department, triaged, no psychiatric review answer yet."
            meta={awaitingReview.length || "None"}
            flush
          >
            {awaitingReview.length === 0 ? (
              <div className={styles.panelBody}>
                <p className={styles.none}>No referral is waiting for review.</p>
              </div>
            ) : (
              <ul className={styles.list}>
                {awaitingReview.map(({ referral }) => (
                  <li key={referral.id} className={styles.listItem}>
                    <span className={styles.who}>
                      <span className={styles.whoName}>
                        {referral.id} · {referralInitials(referral)}
                      </span>
                      <span className={styles.sub}>
                        {referral.ageBand} · {urgencyTierLabel(referral.urgency)}
                      </span>
                    </span>
                    {rows.some((row) => row.movement.referralId === referral.id && row.reviewed) ? (
                      <Tag tone="quiet">Examination already recorded on the movement</Tag>
                    ) : null}
                    <span className={styles.sub}>
                      {referral.triagedAt !== undefined
                        ? `${splitDuration(Math.max(now - referral.triagedAt, 0))} since triage`
                        : "Triage not recorded"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Expected arrivals"
            question="Referred to this department and not here yet."
            meta={expects.length || "None"}
            flush
          >
            {expects.length === 0 ? (
              <div className={styles.panelBody}>
                <p className={styles.none}>No arrivals are expected. This means none is recorded.</p>
              </div>
            ) : (
              <ul className={styles.list}>
                {expects.map(({ referral }) => (
                  <li key={referral.id} className={styles.listItem}>
                    <span className={styles.who}>
                      <span className={styles.whoName}>
                        {referral.id} · {referralInitials(referral)}
                      </span>
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
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Beds that fit who is waiting"
            question={
              waitingCohorts.length
                ? `Ready now for ${[...new Set(waitingCohorts)].join(" or ").toLowerCase()} patients with no bed yet.`
                : "Nobody here is waiting for a bed."
            }
            meta={`${ready} ready statewide · ${preparing} still being made ready`}
            flush
            foot={
              <>
                <span>Ward-confirmed capacity; the same source as Capacity.</span>
                <a className={styles.link} href="/mockups/ward-flow/capacity">
                  Capacity ›
                </a>
              </>
            }
          >
            {fits.length === 0 ? (
              <div className={styles.panelBody}>
                <p className={styles.none}>
                  {waitingCohorts.length ? "No ward has a ready bed for these cohorts." : "No match needed."}
                </p>
              </div>
            ) : (
              <ul className={styles.list}>
                {fits.slice(0, 6).map((fit) => (
                  <li key={fit.unit.id} className={styles.listItem}>
                    <span className={styles.who}>
                      <span className={styles.whoName}>{fit.unit.name}</span>
                      <span className={styles.sub}>
                        {fit.service} · {fit.unit.cohort}
                      </span>
                    </span>
                    <span className={styles.num}>
                      {fit.ready} ready
                      {fit.pendingPreparation > 0 ? (
                        <span className={styles.sub}> · {fit.pendingPreparation} still being made ready</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <p className={styles.footer}>
        Synthetic prototype · Not a medical device · Figures are not live clinical records
      </p>

      {selected ? (
        <PatientDrawer
          row={selected}
          now={now}
          edId={department.id}
          units={world.units}
          onClose={() => setSelectedId(undefined)}
        />
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
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const journey = [
    { at: m.openedAt, text: "Referral received" },
    ...(m.examination
      ? [{ at: m.examination.at, text: `Examination: ${EXAMINATION_LABELS[m.examination.outcome]}` }]
      : []),
    ...m.declines.map((d) => ({
      at: d.at,
      text: `${units.find((u) => u.id === d.unitId)?.name ?? d.unitId} declined`,
    })),
    ...m.stageChanges
      .filter((c) => c.to !== "placement_requested")
      .map((c) => ({ at: c.at, text: stageCopy[c.to].label })),
  ].sort((a, b) => b.at - a.at);
  return (
    <div className={styles.scrim} onClick={onClose}>
      <div
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ed-proposal-drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.drawerHead}>
          <div>
            <h2 id="ed-proposal-drawer-title" className={styles.panelTitle}>
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
            <dd>{m.examination ? EXAMINATION_LABELS[m.examination.outcome] : "Not recorded"}</dd>
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
    </div>
  );
}

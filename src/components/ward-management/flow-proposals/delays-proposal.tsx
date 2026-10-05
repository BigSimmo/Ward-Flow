"use client";

import { useMemo, useState } from "react";

import { lastRecordedActivity, type DelayOwnerId } from "@/components/ward-management/delays/delays-derivations";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { ESCALATION_CONTACTS } from "@/components/ward-management/ward-change-reasons";
import { formatInstant, formatRemaining } from "@/components/ward-management/ward-clock";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import {
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
  LONG_WAIT_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";

import { delayFigures, needsAttention, OWNER_LABELS, type DelayRow } from "./flow-proposal-figures";
import {
  edName,
  KpiStrip,
  NOT_WIRED,
  Panel,
  PreviewBar,
  ProposalHeader,
  useFlowProposal,
  wait,
} from "./flow-proposal-parts";
import styles from "./flow-proposal.module.css";

type Filter = "all" | "attention" | "over8" | "over24" | "escalated" | `owner:${DelayOwnerId}`;

const PAGE = 12;

function matches(row: DelayRow, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "attention") return needsAttention(row);
  if (filter === "over8") return row.waitMinutes >= ED_SEVERE_PRESSURE_WAIT_MINUTES;
  if (filter === "over24") return row.waitMinutes >= LONG_WAIT_MINUTES;
  if (filter === "escalated") return row.escalated;
  return row.owner === filter.slice("owner:".length);
}

function tone(row: DelayRow): "danger" | "warn" | "accent" | undefined {
  if (row.cause === "legal_breached" || (row.formDueMinutes !== undefined && row.formDueMinutes < 0)) return "danger";
  if (needsAttention(row)) return "warn";
  if (row.waitMinutes >= LONG_WAIT_MINUTES) return "accent";
  return undefined;
}

export function DelaysProposal() {
  const { world, now, scoped, asAt, initialsOf } = useFlowProposal();
  const { units, dispatch } = world;
  const figures = useMemo(() => delayFigures(scoped, units, now), [scoped, units, now]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const yours = figures.owners.find((owner) => owner.id === "yours")?.count ?? 0;
  const maxOwner = Math.max(1, ...figures.owners.map((owner) => owner.count));
  const maxCatchment = Math.max(1, ...figures.catchments.map((entry) => entry.total));

  const needle = query.trim().toLowerCase();
  const listed = figures.rows.filter(
    (row) =>
      matches(row, filter) &&
      (needle === "" ||
        initialsOf(row.movement).toLowerCase().includes(needle) ||
        edName(row.movement).toLowerCase().includes(needle) ||
        row.causeTitle.toLowerCase().includes(needle)),
  );
  const visible = showAll ? listed : listed.slice(0, PAGE);
  const selected =
    figures.rows.find((row) => row.movement.id === selectedId) ?? figures.attention[0] ?? figures.rows[0];

  const choose = (next: Filter) => {
    setFilter((current) => (current === next ? "all" : next));
    setShowAll(false);
  };

  const escalate = (row: DelayRow) => {
    dispatch({
      type: "RECORD_ESCALATION",
      role: "coordinator",
      now,
      movementId: row.movement.id,
      triedUnitIds: row.movement.declines.map((decline) => decline.unitId),
      contact: ESCALATION_CONTACTS[0],
    });
    setNotice(`Escalation to ${ESCALATION_CONTACTS[0]} recorded for ${initialsOf(row.movement)}.`);
  };

  const longest = figures.longest;

  return (
    <>
      <PreviewBar active="delays" />
      <main className={styles.page} id="main-content" data-testid="delays-proposal">
        <ProposalHeader
          crumb="Operations › Delays"
          title="Delays"
          asAt={asAt}
          answer={
            figures.waiting === 0 ? (
              <>Nobody is waiting in this scope.</>
            ) : (
              <>
                <strong>{figures.waiting} people are waiting</strong>; {yours} need a coordinator decision.{" "}
                {figures.attention.length > 0 ? (
                  <strong>{figures.attention.length} need attention now.</strong>
                ) : (
                  "Nothing is flagged for attention now."
                )}{" "}
                {longest ? (
                  <>
                    Longest wait: {initialsOf(longest.movement)}, {wait(longest.waitMinutes)} at{" "}
                    {edName(longest.movement)}.
                  </>
                ) : null}
              </>
            )
          }
        />

        <KpiStrip
          label="Delay figures. Each one filters the list."
          selected={filter}
          onSelect={(id) => choose(id as Filter)}
          items={[
            { id: "all", label: "Waiting", value: figures.waiting, note: "Every open movement" },
            {
              id: "attention",
              label: "Attention now",
              value: figures.attention.length,
              tone: figures.attention.length > 0 ? "danger" : "good",
              note: "Form due, no bed, or escalated",
            },
            { id: "owner:yours", label: "On you", value: yours, note: "Coordinator decision" },
            {
              id: "over8",
              label: "Over 8 h",
              value: figures.over8,
              tone: figures.over8 > 0 ? "warn" : undefined,
              note: "Since the journey opened",
            },
            {
              id: "over24",
              label: "Over 24 h",
              value: figures.over24,
              tone: figures.over24 > 0 ? "danger" : undefined,
              note: "Since the journey opened",
            },
            { id: "escalated", label: "Escalated", value: figures.escalated, note: "Recorded escalations" },
          ]}
        />

        <div className={styles.grid2}>
          <div className={styles.stack}>
            <Panel
              title="Needs attention now"
              question="A recorded form due time passed or under an hour away, no suitable bed anywhere, or escalated."
              meta={`${figures.attention.length} of ${figures.waiting}`}
              flush
            >
              {figures.attention.length === 0 ? (
                <p className={styles.empty}>Nothing meets these conditions now. The full list is below.</p>
              ) : (
                <ul className={styles.actList}>
                  {figures.attention.slice(0, 6).map((row) => (
                    <li key={row.movement.id} className={styles.actItem}>
                      <span className={styles.edge} data-tone={tone(row) ?? "accent"} aria-hidden="true" />
                      <div>
                        <p className={styles.actTitle}>
                          {initialsOf(row.movement)} · {row.causeTitle}
                        </p>
                        <p className={styles.actMeta}>
                          {edName(row.movement)} · waiting {wait(row.waitMinutes)}
                          {row.formDueMinutes !== undefined
                            ? ` · recorded form due time ${formatRemaining(row.formDueMinutes)}`
                            : ""}
                          {row.escalated ? " · escalated" : ""}
                        </p>
                      </div>
                      <div className={styles.actions}>
                        <button type="button" className={styles.btn} onClick={() => setSelectedId(row.movement.id)}>
                          Open
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel
              title="Where people wait"
              question="By the health service of the referring ED. Each person counted once."
              flush={false}
            >
              <div className={styles.bars} role="list">
                {figures.catchments.map((entry) => (
                  <div
                    key={entry.origin}
                    className={styles.barRow}
                    role="listitem"
                    aria-label={`${entry.origin}: ${entry.total} waiting, ${entry.over8} over 8 hours, ${entry.over24} over 24 hours`}
                  >
                    <span className={styles.barLabel}>
                      {entry.origin === "unrecorded" ? "No ED recorded" : entry.origin}
                    </span>
                    <span className={styles.track} aria-hidden="true">
                      <span
                        className={styles.fillDanger}
                        style={{
                          width: `${(entry.over24 / maxCatchment) * 100}%`,
                          display: entry.over24 ? undefined : "none",
                        }}
                      />
                      <span
                        className={styles.fillWarn}
                        style={{
                          width: `${((entry.over8 - entry.over24) / maxCatchment) * 100}%`,
                          display: entry.over8 - entry.over24 ? undefined : "none",
                        }}
                      />
                      <span
                        className={styles.fill}
                        style={{
                          width: `${((entry.total - entry.over8) / maxCatchment) * 100}%`,
                          display: entry.total - entry.over8 ? undefined : "none",
                        }}
                      />
                    </span>
                    <span className={styles.barValue}>{entry.total}</span>
                  </div>
                ))}
              </div>
              <p className={styles.legend}>
                <span>
                  <span className={styles.key} style={{ background: "var(--danger)" }} aria-hidden="true" /> Over 24 h
                </span>
                <span>
                  <span className={styles.key} style={{ background: "var(--warn)" }} aria-hidden="true" /> 8 to 24 h
                </span>
                <span>
                  <span className={styles.key} style={{ background: "var(--accent)" }} aria-hidden="true" /> Under 8 h
                </span>
              </p>
            </Panel>
          </div>

          <div className={styles.stack}>
            <Panel
              title="Who it waits on"
              question="Select a row to filter the list."
              meta={`${figures.waiting} people`}
            >
              <div className={styles.bars}>
                {figures.owners.map((owner) => (
                  <button
                    key={owner.id}
                    type="button"
                    className={styles.barRow}
                    aria-pressed={filter === `owner:${owner.id}`}
                    onClick={() => choose(`owner:${owner.id}`)}
                    aria-label={`${owner.label}: ${owner.count}. ${owner.causes.map((c) => `${c.title} ${c.count}`).join(", ") || owner.subLine}`}
                  >
                    <span className={styles.barLabel}>
                      {owner.label}
                      <small>{owner.causes[0]?.title ?? "None waiting"}</small>
                    </span>
                    <span className={styles.track} aria-hidden="true">
                      {owner.count > 0 ? (
                        <span className={styles.fill} style={{ width: `${(owner.count / maxOwner) * 100}%` }} />
                      ) : null}
                    </span>
                    <span className={styles.barValue}>{owner.count}</span>
                  </button>
                ))}
              </div>
            </Panel>
          </div>
        </div>

        {notice ? (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        ) : null}

        <div className={styles.grid2}>
          <Panel
            title="Everyone waiting"
            question="Longest wait first. Select a person to see why they are waiting."
            meta={`Showing ${visible.length} of ${listed.length}${filter !== "all" ? " (filtered)" : ""}`}
            flush
            foot={
              <>
                <span>Wait is time since the journey opened. Synthetic records.</span>
                {listed.length > PAGE ? (
                  <button type="button" className={styles.btn} onClick={() => setShowAll((value) => !value)}>
                    {showAll ? "Show fewer" : `Show all ${listed.length}`}
                  </button>
                ) : null}
              </>
            }
          >
            <div className={styles.panelBody}>
              <div className={styles.chipRow}>
                <label className={styles.srOnly} htmlFor="delays-proposal-search">
                  Find by initials, ED or reason
                </label>
                <input
                  id="delays-proposal-search"
                  className={styles.search}
                  type="search"
                  placeholder="Find by initials, ED or reason"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {filter !== "all" ? (
                  <button type="button" className={styles.chipBtn} onClick={() => setFilter("all")}>
                    Clear filter
                  </button>
                ) : null}
              </div>
            </div>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Person</th>
                    <th scope="col">Referring ED</th>
                    <th scope="col">Waiting</th>
                    <th scope="col">Why</th>
                    <th scope="col">Waits on</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={styles.empty}>
                        Nobody matches this filter.
                      </td>
                    </tr>
                  ) : (
                    visible.map((row) => (
                      <tr
                        key={row.movement.id}
                        className={styles.row}
                        tabIndex={0}
                        aria-selected={selected?.movement.id === row.movement.id}
                        onClick={() => setSelectedId(row.movement.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedId(row.movement.id);
                          }
                        }}
                      >
                        <td>
                          <span className={styles.person}>{initialsOf(row.movement)}</span>
                          <span className={styles.sub}>{urgencyTierLabel(row.movement.urgency)}</span>
                        </td>
                        <td>{edName(row.movement)}</td>
                        <td className={styles.num}>{wait(row.waitMinutes)}</td>
                        <td>
                          {row.causeTitle}
                          {row.escalated ? (
                            <>
                              {" "}
                              <span className={styles.tag} data-tone="accent">
                                Escalated
                              </span>
                            </>
                          ) : null}
                        </td>
                        <td>
                          <span className={styles.tag} data-tone={tone(row)}>
                            {figures.owners.find((owner) => owner.id === row.owner)?.label}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className={styles.detail}>
            {selected ? (
              <DelayDetail
                row={selected}
                initials={initialsOf(selected.movement)}
                now={now}
                onEscalate={escalate}
                onNotWired={() => setNotice(NOT_WIRED)}
              />
            ) : (
              <Panel title="Nobody selected">
                <p className={styles.footNote}>Nobody is waiting.</p>
              </Panel>
            )}
          </div>
        </div>

        <Panel
          title="Delays with no named person"
          question="Ward closures, fleet and staffing holds recorded across the network."
          meta="None recorded"
        >
          <p className={styles.footNote}>
            No network-wide hold is recorded. Recording one is not wired in this prototype.
          </p>
        </Panel>

        <WardPrototypeFooter testId="delays-proposal-footer" />
      </main>
    </>
  );
}

function DelayDetail({
  row,
  initials,
  now,
  onEscalate,
  onNotWired,
}: {
  row: DelayRow;
  initials: string;
  now: number;
  onEscalate: (row: DelayRow) => void;
  onNotWired: () => void;
}) {
  const latest = lastRecordedActivity(row.movement, now);
  const form = row.movement.legalForm;
  return (
    <Panel
      title={`${initials} · ${row.causeTitle}`}
      question={`${edName(row.movement)} · waiting ${wait(row.waitMinutes)}`}
      foot={
        <a className={styles.link} href={movementHref(row.movement.id)}>
          Open the movement record ›
        </a>
      }
    >
      <dl className={styles.dl}>
        <dt>Waits on</dt>
        <dd>{OWNER_LABELS[row.owner]}</dd>
        <dt>Urgency</dt>
        <dd>{urgencyTierLabel(row.movement.urgency)}</dd>
        <dt>Bed type</dt>
        <dd>{row.movement.security ?? "Not recorded"}</dd>
        <dt>Form</dt>
        <dd>
          {form ? legalFormName(form) : "None recorded"}
          {row.formDueMinutes !== undefined ? (
            <span className={styles.sub}>Recorded due time: {formatRemaining(row.formDueMinutes)}</span>
          ) : null}
        </dd>
        <dt>Last recorded</dt>
        <dd>
          {latest
            ? `${latest.what.charAt(0).toUpperCase()}${latest.what.slice(1)}, ${formatInstant(latest.at)}`
            : "Nothing recorded"}
          {latest ? <span className={styles.sub}>Nothing newer for {wait(now - latest.at)}</span> : null}
        </dd>
        <dt>Escalation</dt>
        <dd>
          {row.movement.escalation
            ? `${row.movement.escalation.contact}, ${formatInstant(row.movement.escalation.at)}`
            : "None recorded"}
        </dd>
      </dl>
      <div className={styles.actions} style={{ justifyContent: "flex-start" }}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={row.escalated}
          onClick={() => onEscalate(row)}
        >
          {row.escalated ? "Already escalated" : "Record escalation"}
        </button>
        <button type="button" className={styles.btn} onClick={onNotWired} title={NOT_WIRED}>
          Message the ward
        </button>
      </div>
    </Panel>
  );
}

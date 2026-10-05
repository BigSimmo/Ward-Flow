"use client";

import { useMemo, useState } from "react";

import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import { formatInstant, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import {
  groupedResults,
  hubCounts,
  hubEntries,
  needsAttention,
  readyByService,
  searchHub,
  unauthorisedWards,
  type HubEntry,
  type HubKind,
} from "@/components/ward-management/hub/hub-derivations";
import { toggleHubPin, usePinnedHubIds } from "@/components/ward-management/hub/hub-browser-memory";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import { hubSummary } from "./people-proposal-figures";
import { Panel, PeopleProposalBar, ProposalHeader, plural } from "./people-proposal-parts";
import styles from "./people-proposal.module.css";

const KINDS: { id: HubKind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ward", label: "Wards" },
  { id: "ed", label: "EDs" },
  { id: "community", label: "Community teams" },
];

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill={filled ? "currentColor" : "none"}>
      <path
        d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EntryRow({ entry, pinned }: { entry: HubEntry; pinned: boolean }) {
  const sub =
    entry.kind === "community"
      ? "Community mental health team"
      : [entry.site, entry.service, entry.kind === "ward" ? entry.security : undefined].filter(Boolean).join(" · ");
  return (
    <li className={styles.rowWithPin}>
      <a className={styles.row} href={entry.href}>
        <span className={styles.rowMain}>
          <span className={styles.rowTitle}>{entry.name}</span>
          <span className={styles.rowSub}>{sub}</span>
        </span>
        {entry.kind === "ward" ? (
          <span className={styles.rowEnd}>
            {entry.stale ? <span className={styles.warnText}>Confirmation stale</span> : null}
            {(entry.pendingPreparation ?? 0) > 0 ? (
              <span className={styles.mutedText}>
                {entry.pendingPreparation} {BED_STATE_LABELS.beingMadeReady.toLowerCase()}
              </span>
            ) : null}
            <span className={`${styles.readyNum} ${(entry.ready ?? 0) === 0 ? styles.zero : ""}`}>
              {entry.ready ?? 0}
            </span>
            <span className={styles.unit}>ready</span>
          </span>
        ) : (
          <span className={styles.mutedText}>Open ›</span>
        )}
      </a>
      <button
        type="button"
        className={styles.pin}
        aria-pressed={pinned}
        aria-label={pinned ? `Unpin ${entry.name}` : `Pin ${entry.name}`}
        onClick={() => toggleHubPin(entry.id)}
      >
        <PinIcon filled={pinned} />
      </button>
    </li>
  );
}

/** Proposed Search hub: answer first, one bed row that adds up, flat grouped list, plain reasons. */
export function HubProposal() {
  const { units, bedReleases, admissions, leaveBeds } = useWardFlow();
  const now = useWardFlowClock();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<HubKind | "all">("ward");
  const [readyOnly, setReadyOnly] = useState(false);
  const pinnedIds = usePinnedHubIds();

  const entries = useMemo(
    () => hubEntries({ units, bedReleases, admissions, leaveBeds, now }),
    [units, bedReleases, admissions, leaveBeds, now],
  );
  const summary = hubSummary(entries);
  const counts = hubCounts(entries, query);
  const results = searchHub(entries, query, kind).filter(
    (entry) => !readyOnly || (entry.kind === "ward" && (entry.ready ?? 0) > 0),
  );
  const groups = groupedResults(results);
  const pinned = entries.filter((entry) => pinnedIds.includes(entry.id));
  const attention = needsAttention(entries);
  const stale = attention.filter((row) => row.entry.stale === true).length;
  const noReady = attention.filter((row) => row.entry.ready === 0).length;
  const byService = readyByService(entries);
  const maxService = Math.max(1, ...byService.map((row) => row.ready));
  const unauthorised = unauthorisedWards(entries);

  return (
    <div className={styles.screen}>
      <PeopleProposalBar active="hub" />
      <main id="main-content" className={styles.page} data-testid="hub-proposal">
        <ProposalHeader title="Search hub" asAt={`${formatInstant(now)} AWST`} />

        <p className={styles.answer} data-testid="hub-proposal-answer">
          <b>{summary.ready}</b> {summary.ready === 1 ? "bed is" : "beds are"} ready to admit across{" "}
          <b>{summary.wardsWithReady}</b> of <b>{summary.wards}</b> {summary.wards === 1 ? "ward" : "wards"}.{" "}
          {stale > 0
            ? `${plural(stale, "ward has", "wards have")} an out-of-date bed confirmation, so ring before relying on ${stale === 1 ? "its figure" : "their figures"}.`
            : "Every ward's bed confirmation is current."}
          {noReady > 0 ? ` ${plural(noReady, "ward has", "wards have")} no ready bed.` : ""}
        </p>

        <section className={styles.figures} aria-label="Beds across the network">
          {[
            { label: BED_STATE_LABELS.ready, value: summary.ready, key: styles.keyReady, note: "Can be filled now" },
            {
              label: BED_STATE_LABELS.pulled,
              value: summary.pulled,
              key: styles.keyPulled,
              note: "Given to someone not yet arrived",
            },
            {
              label: BED_STATE_LABELS.closed,
              value: summary.closed,
              key: styles.keyClosed,
              note: "Empty, not offered",
            },
            {
              label: BED_STATE_LABELS.occupied,
              value: summary.occupied,
              key: styles.keyOccupied,
              note: "Patient admitted, including on leave",
            },
          ].map((figure) => (
            <div className={styles.figure} key={figure.label}>
              <p className={styles.figureLabel}>
                <span className={`${styles.key} ${figure.key}`} aria-hidden="true" />
                {figure.label}
              </p>
              <p className={styles.figureValue}>{figure.value}</p>
              <p className={styles.figureNote}>{figure.note}</p>
            </div>
          ))}
        </section>
        <div
          className={styles.bedBar}
          role="img"
          aria-label={`Network beds: ${summary.ready} ready, ${summary.pulled} pulled, ${summary.closed} closed, ${summary.occupied} occupied, of ${summary.beds}.`}
          data-testid="hub-proposal-bed-bar"
        >
          {[
            { key: "ready", value: summary.ready, className: styles.keyReady },
            { key: "pulled", value: summary.pulled, className: styles.keyPulled },
            { key: "closed", value: summary.closed, className: styles.keyClosed },
            { key: "occupied", value: summary.occupied, className: styles.keyOccupied },
          ].map((segment) => (
            <span
              key={segment.key}
              className={`${styles.bedSegment} ${segment.className}`}
              style={{ flexGrow: segment.value }}
            />
          ))}
        </div>
        <p className={styles.sumLine} data-testid="hub-proposal-sum">
          {summary.ready} + {summary.pulled} + {summary.closed} + {summary.occupied} = <b>{summary.boxesTotal}</b> beds
          in {summary.wards} wards. Ready and Closed are never added together: a closed bed cannot be filled.
        </p>

        <div className={styles.split}>
          <Panel title="Find a ward, ED or community team" meta={`${results.length} of ${entries.length}`}>
            <div className={styles.toolbar}>
              <label className={styles.srOnly} htmlFor="hub-proposal-search">
                Search wards, emergency departments and community teams
              </label>
              <input
                id="hub-proposal-search"
                className={styles.input}
                type="search"
                placeholder="Search by name, hospital or health service"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className={styles.segment} role="radiogroup" aria-label="Show">
                {KINDS.map((option) => (
                  <label key={option.id}>
                    <input
                      type="radio"
                      name="hub-proposal-kind"
                      checked={kind === option.id}
                      onChange={() => setKind(option.id)}
                    />
                    <span>
                      {option.label} <span className={styles.count}>{counts[option.id]}</span>
                    </span>
                  </label>
                ))}
              </div>
              <label className={styles.toggle}>
                <input type="checkbox" checked={readyOnly} onChange={(event) => setReadyOnly(event.target.checked)} />
                Wards with a ready bed only
              </label>
            </div>

            {pinned.length > 0 && query === "" && !readyOnly ? (
              <>
                <p className={styles.groupLabel}>
                  <span>Pinned</span>
                  <span>{pinned.length}</span>
                </p>
                <ul className={styles.list}>
                  {pinned.map((entry) => (
                    <EntryRow key={`pin-${entry.id}`} entry={entry} pinned />
                  ))}
                </ul>
              </>
            ) : null}

            {groups.length === 0 ? (
              <div className={styles.empty} data-testid="hub-proposal-empty">
                <span>
                  Nothing matches {query.trim() === "" ? "these filters" : `“${query.trim()}”`}. Try a hospital or
                  health service name.
                </span>
                <button
                  type="button"
                  className={styles.textLink}
                  onClick={() => {
                    setQuery("");
                    setKind("ward");
                    setReadyOnly(false);
                  }}
                >
                  Clear search and filters
                </button>
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.key}>
                  {group.subgroups.length > 0 ? (
                    group.subgroups.map((sub) => (
                      <div key={sub.label}>
                        <p className={styles.groupLabel}>
                          <span>
                            {group.label} · {sub.label}
                          </span>
                          <span>{sub.entries.reduce((sum, entry) => sum + (entry.ready ?? 0), 0)} ready</span>
                        </p>
                        <ul className={styles.list}>
                          {sub.entries.map((entry) => (
                            <EntryRow key={entry.id} entry={entry} pinned={pinnedIds.includes(entry.id)} />
                          ))}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <>
                      <p className={styles.groupLabel}>
                        <span>{group.label}</span>
                        <span>{group.entries.length}</span>
                      </p>
                      <ul className={styles.list}>
                        {group.entries.map((entry) => (
                          <EntryRow key={entry.id} entry={entry} pinned={pinnedIds.includes(entry.id)} />
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              ))
            )}
          </Panel>

          <div className={styles.stack}>
            <Panel
              title="Wards that need a check"
              question="No ready bed, or a bed confirmation that is out of date. Ring the ward before relying on its figure."
              meta={attention.length}
            >
              {attention.length === 0 ? (
                <p className={styles.empty}>Every ward has a ready bed and a current confirmation.</p>
              ) : (
                attention.map((row) => (
                  <div className={styles.attention} key={row.entry.id}>
                    <div className={styles.attentionHead}>
                      <a className={styles.textLink} href={row.entry.href}>
                        {row.entry.name}
                      </a>
                      {row.entry.confirmedAt !== undefined ? (
                        <span className={styles.mutedText}>
                          Confirmed{" "}
                          <span className={styles.num}>{formatInstantWithDay(row.entry.confirmedAt, now)}</span>
                        </span>
                      ) : null}
                    </div>
                    <span className={row.severity === 2 ? styles.warnText : styles.mutedText}>{row.reason}</span>
                  </div>
                ))
              )}
            </Panel>

            <Panel title="Ready beds by health service" meta={`${summary.ready} total`}>
              <div className={styles.serviceList}>
                {byService.map((row) => (
                  <div className={styles.serviceRow} key={row.service}>
                    <span>{row.service}</span>
                    <span className={styles.bar} aria-hidden="true">
                      <span className={styles.barFill} style={{ width: `${(row.ready / maxService) * 100}%` }} />
                    </span>
                    <span className={`${styles.serviceNum} ${row.ready === 0 ? styles.zero : ""}`}>{row.ready}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              title="Not authorised for involuntary patients"
              question="These wards cannot take a patient on an involuntary order."
              meta={unauthorised.length}
            >
              {unauthorised.length === 0 ? (
                <p className={styles.empty}>Every ward is authorised.</p>
              ) : (
                <ul className={styles.list}>
                  {unauthorised.map((entry) => (
                    <li key={entry.id}>
                      <a className={styles.row} href={entry.href}>
                        <span className={styles.rowMain}>
                          <span className={styles.rowTitle}>{entry.name}</span>
                          <span className={styles.rowSub}>{entry.site}</span>
                        </span>
                        <span className={styles.mutedText}>{entry.ready ?? 0} ready</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
        <WardPrototypeFooter />
      </main>
    </div>
  );
}

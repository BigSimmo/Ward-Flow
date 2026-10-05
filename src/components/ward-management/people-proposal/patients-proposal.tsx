"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { calendarDateOf, formatInstant } from "@/components/ward-management/ward-clock";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import {
  LONG_WAIT_HOURS,
  PATIENT_FILTERS,
  filterCounts,
  matchesText,
  patientRows,
  type PatientRow,
  type PatientRowFilter,
} from "./people-proposal-figures";
import { Panel, PeopleProposalBar, ProposalHeader } from "./people-proposal-parts";
import styles from "./people-proposal.module.css";

type SortKey = "wait" | "tier" | "umrn";

const SORTS: { id: SortKey; label: string; compare: (a: PatientRow, b: PatientRow) => number }[] = [
  { id: "wait", label: "Longest wait first", compare: (a, b) => b.waitedHours - a.waitedHours },
  { id: "tier", label: "Most urgent tier first", compare: (a, b) => a.tier - b.tier || b.waitedHours - a.waitedHours },
  { id: "umrn", label: "Record number", compare: (a, b) => a.umrn.localeCompare(b.umrn) },
];

function waited(hours: number): string {
  const minutes = Math.max(0, Math.round(hours * 60));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 48 * 60) return `${(minutes / 60).toFixed(1)} h`;
  return `${Math.floor(minutes / 1440)} d ${Math.floor((minutes % 1440) / 60)} h`;
}

/** Proposed Patients screen: answer first, figures that are the filters, one flat sortable list. */
export function PatientsProposal() {
  const { movements, referrals, units, patients, dayZero } = useWardFlow();
  const now = useWardFlowClock();
  const router = useRouter();
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<PatientRowFilter>("all");
  const [sort, setSort] = useState<SortKey>("wait");

  const rows = useMemo(
    () => patientRows({ movements, referrals, units, patients, now, today: calendarDateOf(now, dayZero) }),
    [movements, referrals, units, patients, now, dayZero],
  );
  const counts = filterCounts(rows);
  const openJourneys = rows.filter((row) => row.kind === "movement").length;
  const activeFilter = PATIENT_FILTERS.find((entry) => entry.id === filter) ?? PATIENT_FILTERS[0];
  const shown = rows
    .filter(activeFilter.test)
    .filter((row) => matchesText(row, text))
    .sort((SORTS.find((entry) => entry.id === sort) ?? SORTS[0]).compare);

  return (
    <div className={styles.screen}>
      <PeopleProposalBar active="patients" />
      <main id="main-content" className={styles.page} data-testid="patients-proposal">
        <ProposalHeader title="Patients" asAt={`${formatInstant(now)} AWST`}>
          <Link className={styles.primary} href="/mockups/ward-flow/people/new/proposal">
            Add a patient
          </Link>
        </ProposalHeader>

        <p className={styles.answer} data-testid="patients-proposal-answer">
          <b>{rows.length}</b> people are waiting in the bed-flow system: <b>{openJourneys}</b> open journeys and{" "}
          <b>{counts.referral}</b> referrals awaiting a decision. <b>{counts["no-ward"]}</b> have no ward yet and{" "}
          <b>{counts["long-wait"]}</b> have waited over {LONG_WAIT_HOURS} hours.
        </p>

        <section className={styles.figures} aria-label="Filter the list">
          {PATIENT_FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={styles.filter}
              aria-pressed={filter === entry.id}
              onClick={() => setFilter(entry.id)}
              data-testid={`patients-proposal-filter-${entry.id}`}
            >
              <span className={styles.figureLabel}>{entry.label}</span>
              <span
                className={`${styles.figureValue} ${entry.id === "long-wait" && counts[entry.id] > 0 ? styles.warnValue : ""}`}
              >
                {counts[entry.id]}
              </span>
            </button>
          ))}
        </section>

        <Panel
          title={activeFilter.id === "all" ? "Everyone waiting" : activeFilter.label}
          meta={`${shown.length} of ${counts[activeFilter.id]}`}
          foot="Initials and record number only in this list, so names are not readable over a shoulder. Open a patient to see their full name."
        >
          <div className={styles.toolbar}>
            <label className={styles.srOnly} htmlFor="patients-proposal-search">
              Search patients
            </label>
            <input
              id="patients-proposal-search"
              className={styles.input}
              type="search"
              placeholder="Search by name, record number, ED, ward or stage"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <label className={styles.srOnly} htmlFor="patients-proposal-sort">
              Sort
            </label>
            <select
              id="patients-proposal-sort"
              className={styles.select}
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
            >
              {SORTS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>

          {shown.length === 0 ? (
            <div className={styles.empty} data-testid="patients-proposal-empty">
              <span>
                {rows.length === 0
                  ? "No one is waiting in the bed-flow system."
                  : text.trim() === ""
                    ? "No one in this group right now."
                    : `No one matches “${text.trim()}”. Check the spelling or the record number.`}
              </span>
              <button
                type="button"
                className={styles.textLink}
                onClick={() => {
                  setText("");
                  setFilter("all");
                }}
              >
                Clear search and filter
              </button>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Patient</th>
                  <th scope="col">In</th>
                  <th scope="col">Legal status</th>
                  <th scope="col">Tier</th>
                  <th scope="col">Stage</th>
                  <th scope="col">Ward</th>
                  <th scope="col">Waited</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.id} onClick={() => router.push(row.href)}>
                    <td>
                      <span className={styles.personCell}>
                        <span className={styles.avatar} aria-hidden="true">
                          {row.initials}
                        </span>
                        <span className={styles.rowMain}>
                          <a href={row.href} aria-label={`Open patient ${row.initials}, ${row.umrn}`}>
                            {row.initials} <span className={styles.num}>{row.umrn}</span>
                          </a>
                          <span className={styles.rowSub}>
                            {row.age === null ? "Age not recorded" : `${row.age} y`} · {row.sex ?? "sex not recorded"}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className={styles.rowMain}>
                        <span>{row.from}</span>
                        <span className={styles.rowSub}>{row.service}</span>
                      </span>
                    </td>
                    <td>{row.legal}</td>
                    <td>
                      <span className={`${styles.tier} ${row.tier === 1 ? styles.tier1 : ""}`}>Tier {row.tier}</span>
                    </td>
                    <td>{row.stage}</td>
                    <td>{row.ward ?? <span className={styles.mutedText}>No ward yet</span>}</td>
                    <td>
                      <span className={styles.rowMain}>
                        <span className={styles.num}>{waited(row.waitedHours)}</span>
                        {row.waitedHours >= LONG_WAIT_HOURS ? (
                          <span className={styles.warnText}>Over {LONG_WAIT_HOURS} h</span>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <WardPrototypeFooter />
      </main>
    </div>
  );
}

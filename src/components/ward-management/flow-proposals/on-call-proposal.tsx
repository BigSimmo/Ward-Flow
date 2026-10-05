"use client";

import { Fragment, useMemo, useState } from "react";

import { edHref } from "@/components/ward-management/shell/ward-facade";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { formatInstant, minuteOfDay } from "@/components/ward-management/ward-clock";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";

import { onCallFigures, type RosterRow } from "./flow-proposal-figures";
import { KpiStrip, Panel, PreviewBar, ProposalHeader, useFlowProposal } from "./flow-proposal-parts";
import styles from "./flow-proposal.module.css";

/** Copied from the current on-call screen for the preview; moves to on-call-roster.ts on approval. */
const ROLE_PURPOSES: Record<string, string> = {
  "Bed coordinator": "Statewide bed placement",
  "Governance lead": "Senior operational escalation",
  "Coordinator on call": "Placement and transfers in this service",
  "Duty consultant": "Specialist psychiatry advice",
};

const SERVICES = ["Statewide Network", ...HEALTH_SERVICES] as const;
type ServiceFilter = "all" | (typeof SERVICES)[number];

export function OnCallProposal() {
  const { now, asAt } = useFlowProposal();
  const figures = useMemo(() => onCallFigures(minuteOfDay(now)), [now]);
  const [service, setService] = useState<ServiceFilter>("all");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const onNow = figures.rows.filter((row) => row.status === "on");
  const nextStart = figures.rows
    .filter((row) => row.status === "later" && row.startsAt)
    .map((row) => row.startsAt as string)
    .sort()[0];

  const rowMatches = (row: RosterRow) =>
    needle === "" || `${row.role} ${row.service} ${ROLE_PURPOSES[row.role] ?? ""}`.toLowerCase().includes(needle);
  const shownServices = SERVICES.filter((entry) => service === "all" || service === entry);

  const departments = allEmergencyDepartments()
    .map((department) => ({ department, site: siteByCode(department.siteCode) }))
    .filter(({ department, site }) => {
      const svc = site?.service;
      if (service !== "all" && service !== "Statewide Network" && svc !== service) return false;
      return needle === "" || `${site?.name ?? department.name} ${department.siteCode}`.toLowerCase().includes(needle);
    });

  return (
    <>
      <PreviewBar active="on-call" />
      <main className={styles.page} id="main-content" data-testid="on-call-proposal">
        <ProposalHeader
          crumb="Oversight › On-call and contacts"
          title="On-call and contacts"
          asAt={asAt}
          answer={
            <>
              At {formatInstant(now)},{" "}
              <strong>
                {onNow.length} of {figures.roles} recorded roles {onNow.length === 1 ? "is" : "are"} on shift
              </strong>
              {onNow.length > 0
                ? ` (${onNow.map((row) => `${row.service} ${row.role.toLowerCase()}`).join(", ")})`
                : ""}
              .{nextStart ? ` The next shift starts at ${nextStart}.` : ""}{" "}
              {figures.servicesWithNone.length > 0
                ? `${figures.servicesWithNone.join(" and ")} have no role recorded here; use the hospital switchboard.`
                : ""}
            </>
          }
        />

        <KpiStrip
          label="On-call figures"
          items={[
            { id: "roles", label: "Roles recorded", value: figures.roles, note: "Invented shifts, no names held" },
            {
              id: "now",
              label: "On shift now",
              value: onNow.length,
              tone: onNow.length === 0 ? "warn" : undefined,
              note: "By recorded shift times",
            },
            { id: "consultants", label: "Duty consultants", value: figures.consultants, note: "Specialist advice" },
            {
              id: "none",
              label: "Services with no role",
              value: figures.servicesWithNone.length,
              tone: figures.servicesWithNone.length > 0 ? "warn" : "good",
              note: figures.servicesWithNone.join(", ") || "Every service has one",
            },
            {
              id: "eds",
              label: "EDs listed",
              value: allEmergencyDepartments().length,
              note: "Local liaison via switchboard",
            },
          ]}
        />

        <div className={styles.chipRow} role="group" aria-label="Filter by service">
          {(["all", ...SERVICES] as ServiceFilter[]).map((entry) => (
            <button
              key={entry}
              type="button"
              className={styles.chipBtn}
              aria-pressed={service === entry}
              onClick={() => setService(entry)}
            >
              {entry === "all" ? "All services" : entry}
            </button>
          ))}
          <label className={styles.srOnly} htmlFor="on-call-proposal-search">
            Find a role, service or hospital
          </label>
          <input
            id="on-call-proposal-search"
            className={styles.search}
            type="search"
            placeholder="Find a role, service or hospital"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <Panel
          title="Who to call"
          question="Roles and shifts are invented. No names or numbers are held. Confirm current cover through the switchboard."
          meta="Shift times AWST"
          flush
        >
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col">Call for</th>
                  <th scope="col">Recorded shift</th>
                  <th scope="col">Now</th>
                  <th scope="col">Reach via</th>
                </tr>
              </thead>
              <tbody>
                {shownServices.map((entry) => {
                  const rows = figures.rows.filter((row) => row.service === entry && rowMatches(row));
                  if (rows.length === 0 && needle !== "") return null;
                  return (
                    <Fragment key={entry}>
                      <tr>
                        <th scope="rowgroup" colSpan={5} className={styles.groupHead}>
                          {entry}
                        </th>
                      </tr>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className={styles.muted}>
                            No role recorded for this service. Ask the hospital switchboard.
                          </td>
                        </tr>
                      ) : (
                        rows.map((row) => (
                          <tr key={row.id}>
                            <td className={styles.person}>{row.role}</td>
                            <td>{ROLE_PURPOSES[row.role] ?? "Not recorded"}</td>
                            <td>{row.shift}</td>
                            <td>
                              {row.status === "on" ? (
                                <span className={styles.tag} data-tone="good">
                                  On shift now
                                </span>
                              ) : row.status === "later" ? (
                                <span className={styles.tag}>Starts {row.startsAt}</span>
                              ) : (
                                <span className={styles.tag}>Shift not readable</span>
                              )}
                            </td>
                            <td>
                              <a
                                className={styles.link}
                                href={row.id === "bed-coordinator" ? "#reach-bed-desk" : "#reach-switchboard"}
                              >
                                {row.id === "bed-coordinator" ? "Bed coordination desk" : "Hospital switchboard"}
                              </a>
                            </td>
                          </tr>
                        ))
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className={styles.grid2}>
          <Panel
            title="ED mental health liaison"
            question="Reach each department's liaison team through its own directory."
            meta={`${departments.length} departments`}
            flush
          >
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Emergency department</th>
                    <th scope="col">Service</th>
                    <th scope="col">Workspace</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.length === 0 ? (
                    <tr>
                      <td colSpan={3} className={styles.empty}>
                        No department matches.
                      </td>
                    </tr>
                  ) : (
                    departments.map(({ department, site }) => (
                      <tr key={department.id}>
                        <td>
                          <span className={styles.person}>{site?.name ?? department.name}</span>
                          <span className={styles.sub}>{department.siteCode} ED</span>
                        </td>
                        <td>{site?.service ?? "Not recorded"}</td>
                        <td>
                          <a className={styles.btn} href={edHref(department.id)}>
                            Open ED
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="How to reach a role" question="This prototype holds no phone numbers.">
            <dl className={styles.dl}>
              <dt id="reach-switchboard">Hospital switchboard</dt>
              <dd>Ask for the on-call role by title and confirm who is covering this shift.</dd>
              <dt id="reach-bed-desk">Bed coordination desk</dt>
              <dd>Use the current bed coordination directory. Have the movement reference ready.</dd>
              <dt>ED liaison</dt>
              <dd>Use the hospital&apos;s directory to reach its mental health liaison team.</dd>
              <dt>If nobody answers</dt>
              <dd>
                Follow the facility&apos;s urgent escalation procedure. No service-specific fallback is recorded here.
              </dd>
              <dt>Before you call</dt>
              <dd>
                Movement reference, referring site, reason, urgency, and the receiving ward if agreed. Record the
                outcome.
              </dd>
            </dl>
          </Panel>
        </div>

        <WardPrototypeFooter
          testId="on-call-proposal-footer"
          note="Roles and shifts are synthetic · No names or contact details are held · Not a medical device"
        />
      </main>
    </>
  );
}

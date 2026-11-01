"use client";

/*
 * Caseload and In hospital (locked design, design/community-team-2026-11, screenshots
 * tab-caseload.png and tab-hospital.png). Midland demo data, ported from the mock-up (Q126, Q132).
 * Only "Not seen in 4 weeks" and "No case manager" carry a warning mark; at most one row (the
 * follow-up due today) takes the soft danger tint.
 */

import { useMemo, useState } from "react";
import { BedDouble, ChevronDown, House, Users } from "lucide-react";
import { Button, Card, CardHead, Segmented, SrOnly, StatusGlyph } from "@/components/wf";
import home from "@/components/ward-management/ward/ward-home-tab.module.css";
import { CLIENTS, DEMO_FIGURES, DISCHARGED, INPATIENTS, IN_BED, STAFF, shortName } from "./midland-demo";
import { CaseManagerCell, Initials, Person, SeenCell, Tag } from "./parts";
import wt from "@/components/ward-management/ward-table/ward-table.module.css";
import t from "./team-2026.module.css";

type CaseFilter = "all" | "hosp" | "cto" | "ctoDue" | "notSeen" | "unalloc";

export function TeamCaseload({
  caseManager,
  setCaseManager,
}: {
  caseManager: string;
  setCaseManager: (id: string) => void;
}) {
  const [filter, setFilter] = useState<CaseFilter>("all");
  const f = DEMO_FIGURES;
  const rows = useMemo(
    () =>
      CLIENTS.filter((c) => {
        if (filter !== "all" && !(c.flags ?? []).includes(filter)) return false;
        if (caseManager === "psych") return Boolean(c.psychOnly);
        if (caseManager) return c.cm === caseManager;
        return true;
      }),
    [filter, caseManager],
  );
  return (
    <Card className={home.v6Card}>
      <CardHead
        icon={Users}
        title="Caseload"
        aside={
          <span className={t.meta}>
            {f.caseload} clients · {f.inHospital} in hospital
          </span>
        }
      />
      <div className={t.filters}>
        <Segmented
          label="Show"
          size="sm"
          value={filter}
          onChange={setFilter}
          items={[
            { id: "all", label: "All", count: f.caseload },
            { id: "hosp", label: "In hospital", count: f.inHospital },
            { id: "cto", label: "On a CTO", count: f.onCto },
            { id: "ctoDue", label: "CTO review due", count: f.ctoReviewsDue },
            { id: "notSeen", label: "Not seen in 4 weeks", count: f.notSeen4Weeks },
            { id: "unalloc", label: "No case manager", count: f.unallocated },
          ]}
        />
        <label className={t.select}>
          <SrOnly>Case manager</SrOnly>
          <select className={t.ctl} value={caseManager} onChange={(event) => setCaseManager(event.target.value)}>
            <option value="">Any case manager</option>
            {STAFF.filter((s) => s.load).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="psych">Psychiatrist only</option>
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </label>
      </div>
      <div className={`${wt.tableScroll} ${t.tableWrap}`}>
        <table className={`${wt.table} ${t.table}`}>
          <thead>
            <tr>
              <th scope="col">Client</th>
              <th scope="col">Case manager</th>
              <th scope="col">Psychiatrist</th>
              <th scope="col">Legal</th>
              <th scope="col">Where now</th>
              <th scope="col" className={t.n}>
                Last seen
              </th>
              <th scope="col">Next</th>
              <th scope="col">
                <SrOnly>Action</SrOnly>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.u}>
                <td>
                  <Person name={c.n} umrn={c.u} sub={c.a} />
                </td>
                <td>
                  <CaseManagerCell client={c} />
                </td>
                <td>{shortName(c.dr)}</td>
                <td>
                  {c.legal === "CTO" ? (
                    <>
                      <span className={t.strong}>CTO</span>
                      <span className={t.sub}>{c.legalD}</span>
                    </>
                  ) : (
                    <span>{c.legal}</span>
                  )}
                </td>
                <td>
                  {c.w === "h" ? (
                    <span className={t.where}>
                      <BedDouble size={14} aria-hidden="true" />
                      <span>{c.where}</span>
                    </span>
                  ) : (
                    <span className={t.muted}>Community</span>
                  )}
                </td>
                <td className={t.n}>
                  <SeenCell client={c} />
                </td>
                <td>
                  <span className={t.nextT}>{c.next}</span>
                  {c.nextD ? <span className={t.sub}>{c.nextD}</span> : null}
                </td>
                <td className={t.actCell}>
                  <Button size="sm">
                    Open<SrOnly> {c.n}</SrOnly>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={t.tableFoot}>
        <span className={t.shown}>
          {filter === "all" && !caseManager
            ? `Showing ${rows.length} of ${f.caseload}`
            : `${rows.length} shown in this sample`}
        </span>
        <Button variant="ghost" size="sm">
          Show all {f.caseload}
        </Button>
      </div>
    </Card>
  );
}

export function TeamHospital() {
  return (
    <>
      <Card className={home.v6Card}>
        <CardHead
          icon={BedDouble}
          title="In hospital now"
          aside={
            <span className={t.meta}>
              {DEMO_FIGURES.inHospital} clients · {DEMO_FIGURES.datesPassed} discharge dates passed
            </span>
          }
        />
        <div className={`${wt.tableScroll} ${t.tableWrap}`}>
          <table className={`${wt.table} ${t.table}`}>
            <thead>
              <tr>
                <th scope="col">Client</th>
                <th scope="col">Ward</th>
                <th scope="col">Case manager</th>
                <th scope="col">Legal</th>
                <th scope="col" className={t.n}>
                  In bed
                </th>
                <th scope="col">Expected out</th>
                <th scope="col">Team contact</th>
                <th scope="col">Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {INPATIENTS.map((c) => {
                const b = IN_BED[c.n]!;
                return (
                  <tr key={c.u}>
                    <td>
                      <Person name={c.n} umrn={c.u} sub={c.a} />
                    </td>
                    <td>{c.where}</td>
                    <td>
                      <CaseManagerCell client={c} />
                    </td>
                    <td>{c.legal}</td>
                    <td className={t.n}>{b.bed}d</td>
                    <td>
                      {b.passed ? (
                        <span className={t.strong}>
                          <StatusGlyph tone="warning" size={12} />
                          {b.out}
                        </span>
                      ) : b.out === "Not set" ? (
                        <span className={t.muted}>Not set</span>
                      ) : (
                        <>
                          <span>{b.out}</span>
                          <span className={t.sub}>{b.outIn}</span>
                        </>
                      )}
                    </td>
                    <td>
                      {b.none ? (
                        <span className={t.strong}>
                          <StatusGlyph tone="warning" size={12} />
                          No team contact
                        </span>
                      ) : (
                        b.contact
                      )}
                    </td>
                    <td>
                      {b.fu ? (
                        <>
                          <Tag tone="success">Booked</Tag>
                          <span className={t.sub}>{b.fu}</span>
                        </>
                      ) : b.out === "Not set" ? (
                        <span className={t.muted}>Not needed yet</span>
                      ) : (
                        <Button size="sm">
                          Book<SrOnly> follow-up for {c.n}</SrOnly>
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className={home.v6Card}>
        <CardHead
          icon={House}
          title="Back home: 7-day follow-up"
          aside={<span className={t.meta}>Discharged in the last 14 days · seen within 7 days of leaving</span>}
        />
        <div className={`${wt.tableScroll} ${t.tableWrap}`}>
          <table className={`${wt.table} ${t.table}`}>
            <thead>
              <tr>
                <th scope="col">Client</th>
                <th scope="col">Left from</th>
                <th scope="col">Left</th>
                <th scope="col">Case manager</th>
                <th scope="col">7-day contact</th>
                <th scope="col">
                  <SrOnly>Action</SrOnly>
                </th>
              </tr>
            </thead>
            <tbody>
              {DISCHARGED.map((d) => (
                <tr key={d.u} className={d.state === "due" ? t.urgent : undefined}>
                  <td>
                    <Person name={d.n} umrn={d.u} />
                  </td>
                  <td>{d.from}</td>
                  <td>{d.left}</td>
                  <td>
                    <span className={t.cm}>
                      <Initials id={d.cm} />
                      {shortName(d.cm)}
                    </span>
                  </td>
                  <td>
                    <Tag
                      tone={
                        d.state === "seen"
                          ? "success"
                          : d.state === "booked"
                            ? "neutral"
                            : d.state === "due"
                              ? "danger"
                              : "warning"
                      }
                    >
                      {d.label}
                    </Tag>
                    <span className={t.sub}>{d.detail}</span>
                  </td>
                  <td className={t.actCell}>
                    {d.state === "seen" ? (
                      <span className={t.muted}>Done</span>
                    ) : (
                      <Button variant={d.state === "due" ? "pri" : "sec"} size="sm">
                        {d.state === "booked" ? "Open" : d.state === "due" ? "Record contact" : "Book"}
                        <SrOnly> {d.n}</SrOnly>
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

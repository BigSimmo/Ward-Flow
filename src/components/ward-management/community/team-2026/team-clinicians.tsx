"use client";

/*
 * Clinicians (locked design, design/community-team-2026-11, screenshot tab-clinicians.png).
 * Midland demo data, ported from the mock-up (Q126, Q132): today's cover, the week, rooms and cars,
 * and the clinician list with what each person is doing today.
 */

import { useState } from "react";
import { CalendarDays, MapPin, Phone, Stethoscope } from "lucide-react";
import { Button, Card, CardHead, Segmented, SrOnly } from "@/components/wf";
import home from "@/components/ward-management/ward/ward-home-tab.module.css";
import { STAFF, TODAY, type DemoStaff } from "./midland-demo";
import { Tag } from "./parts";
import wt from "@/components/ward-management/ward-table/ward-table.module.css";
import t from "./team-2026.module.css";

type StaffFilter = "all" | "in" | "field" | "away";

function shows(filter: StaffFilter, today: string): boolean {
  if (filter === "all") return true;
  if (filter === "field") return today === "field";
  if (filter === "away") return today === "leave";
  return today !== "leave" && today !== "field";
}

function LoadCell({ s }: { s: DemoStaff }) {
  if (s.load) {
    return (
      <span className={t.loadCell}>
        <span className={`${t.track} ${t.trackSm}`} aria-hidden="true">
          <span style={{ width: `${(s.load / 20) * 100}%` }} />
          <i style={{ left: `${((s.cap ?? 20) / 20) * 100}%` }} />
        </span>
        <span className={t.loadN}>
          <b>{s.load}</b> of {s.cap}
        </span>
      </span>
    );
  }
  if (s.med) {
    return (
      <span className={t.loadN}>
        <b>{s.med}</b> medical
      </span>
    );
  }
  if (s.co) {
    return (
      <span className={t.loadN}>
        <b>{s.co}</b> shared
      </span>
    );
  }
  return <span className={t.muted}>—</span>;
}

export function TeamClinicians({ find = "" }: { find?: string }) {
  const [filter, setFilter] = useState<StaffFilter>("all");
  const needle = find.trim().toLowerCase();
  const count = (key: StaffFilter) => STAFF.filter((s) => shows(key, s.today)).length;
  return (
    <>
      <div className={t.three}>
        <Card className={home.v6Card}>
          <CardHead icon={CalendarDays} title="Today's cover" aside={<span className={t.meta}>Mon 2 Nov</span>} />
          <dl className={t.dl}>
            <div>
              <dt>Duty officer</dt>
              <dd>
                Byrne, T. · <span className={t.mono}>4105</span>
              </dd>
            </div>
            <div>
              <dt>Intake</dt>
              <dd>
                Vance, K. · <span className={t.mono}>4104</span>
              </dd>
            </div>
            <div>
              <dt>Doctor of the day</dt>
              <dd>
                Petrov, Dr L. · <span className={t.mono}>4103</span>
              </dd>
            </div>
            <div>
              <dt>Leave cover</dt>
              <dd>Mallard, J. for Walsh, E.</dd>
            </div>
          </dl>
        </Card>
        <Card className={home.v6Card}>
          <CardHead icon={CalendarDays} title="This week" />
          <ul className={t.week}>
            {[
              ["Mon", "Allocation meeting 13:30"],
              ["Tue", "Clozapine clinic 09:00"],
              ["Wed", "Team review 14:00"],
              ["Thu", "Depot clinic 09:00"],
              ["Fri", "CTO reviews, Dr Hartwell"],
            ].map(([day, what]) => (
              <li key={day}>
                <b>{day}</b>
                <span>{what}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className={home.v6Card}>
          <CardHead icon={MapPin} title="Rooms and cars" aside={<span className={t.meta}>Sample</span>} />
          <dl className={t.dl}>
            <div>
              <dt>Interview rooms</dt>
              <dd>2 of 4 free</dd>
            </div>
            <div>
              <dt>Cars</dt>
              <dd>1 of 3 at base · next back 12:30</dd>
            </div>
            <div>
              <dt>Depot fridge</dt>
              <dd>Checked 08:40 · Doyle, M.</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card className={home.v6Card}>
        <CardHead
          icon={Stethoscope}
          title="Clinicians"
          aside={
            <Segmented
              label="Show clinicians"
              size="sm"
              value={filter}
              onChange={setFilter}
              items={[
                { id: "all", label: "All", count: count("all") },
                { id: "in", label: "At base", count: count("in") },
                { id: "field", label: "In the field", count: count("field") },
                { id: "away", label: "Away", count: count("away") },
              ]}
            />
          }
        />
        <div className={`${wt.tableScroll} ${t.tableWrap}`}>
          <table className={`${wt.table} ${t.table}`}>
            <thead>
              <tr>
                <th scope="col">Clinician</th>
                <th scope="col">Role</th>
                <th scope="col">Today</th>
                <th scope="col">Caseload</th>
                <th scope="col">Ext</th>
                <th scope="col">
                  <SrOnly>Action</SrOnly>
                </th>
              </tr>
            </thead>
            <tbody>
              {STAFF.filter((s) => shows(filter, s.today) && (!needle || s.name.toLowerCase().includes(needle))).map((s) => {
                const [tone, label] = TODAY[s.today] ?? ["neutral", s.today];
                return (
                  <tr key={s.id}>
                    <td>
                      <span className={`${t.cm} ${t.cmLg}`}>
                        <span className={t.av}>{s.ini}</span>
                        <span className={t.name}>{s.name}</span>
                      </span>
                    </td>
                    <td>
                      <span>{s.role}</span>
                      {s.note ? <span className={t.sub}>{s.note}</span> : null}
                    </td>
                    <td>
                      <Tag tone={tone}>{label}</Tag>
                      <span className={t.sub}>{s.where}</span>
                    </td>
                    <td>
                      <LoadCell s={s} />
                    </td>
                    <td className={t.mono}>{s.ext}</td>
                    <td className={t.actCell}>
                      <Button size="sm" icon={Phone}>
                        Call<SrOnly> {s.name}</SrOnly>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

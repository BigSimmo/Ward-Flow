"use client";

/*
 * The Midland demo team on a phone (Community team phone design, approved by Josh 1 Nov 2026, Q155).
 * The same demo data as the desktop sections (Q126, Q132), drawn with the shared phone parts: the
 * band hero with three figures, the section track, phone rows and the bottom sheet. Nothing is saved.
 */

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronRight, FileText, Phone, Plus, Search } from "lucide-react";
import {
  Button,
  LiveChip,
  PhoneHero,
  PhoneListRow,
  PhoneSheet,
  ScrollRow,
  Segmented,
  SrOnly,
  StatusGlyph,
  buttonClass,
  useWfBandBleed,
} from "@/components/wf";
import phone from "../community-team-phone.module.css";
import type { CommunityTeamSection } from "../community-screen-hero";
import {
  CLIENTS,
  DEMO_FIGURES,
  DISCHARGED,
  INPATIENTS,
  IN_BED,
  REFERRALS,
  SENT,
  ANSWERED,
  STAFF,
  TODAY,
  shortName,
} from "./midland-demo";
import { ReferralPage, useAnswer } from "./team-referrals";
import { useRegisterWardBarPlaceSwitch } from "@/components/ward-management/shell/ward-bar-place-switch";
import p from "./midland-phone.module.css";

const f = DEMO_FIGURES;
const SHOWN = 8;
/** HOW-WE-WORK D4: an unconnected control says exactly this. */
const NOT_WIRED = "Not wired in this prototype.";

const SECTIONS: { id: CommunityTeamSection; label: string; count?: number }[] = [
  { id: "home", label: "Home" },
  { id: "caseload", label: "Caseload", count: f.caseload },
  { id: "hospital", label: "In hospital", count: f.inHospital },
  { id: "referrals", label: "Referrals", count: f.referrals },
  { id: "clinicians", label: "Clinicians", count: f.clinicians },
];

type Figure = { id: string; value: ReactNode; label: string; tone?: "danger" | "warning" | "info" };
const FIGURES: Record<CommunityTeamSection, Figure[]> = {
  home: [
    { id: "act", value: f.actNow, label: "Act now", tone: "danger" },
    { id: "answer", value: f.referrals, label: "To answer", tone: "warning" },
    { id: "home", value: f.homeIn7Days, label: "Home in 7 days", tone: "info" },
  ],
  caseload: [
    { id: "all", value: f.caseload, label: "On the caseload" },
    { id: "cto", value: f.onCto, label: "On a CTO" },
    { id: "seen", value: f.notSeen4Weeks, label: "Not seen 4 wk", tone: "warning" },
  ],
  hospital: [
    { id: "in", value: f.inHospital, label: "In hospital" },
    { id: "home", value: f.homeIn7Days, label: "Home in 7 days" },
    { id: "passed", value: f.datesPassed, label: "Dates passed", tone: "warning" },
  ],
  referrals: [
    { id: "answer", value: f.referrals, label: "To answer" },
    { id: "past", value: f.pastTime, label: "Past its time", tone: "warning" },
    { id: "oldest", value: f.oldestReferral, label: "Oldest" },
  ],
  clinicians: [
    { id: "working", value: f.working, label: "Working today" },
    { id: "field", value: STAFF.filter((s) => s.today === "field").length, label: "In the field" },
    { id: "away", value: STAFF.filter((s) => s.today === "leave").length, label: "Away" },
  ],
};

function Card({ title, aside, children }: { title?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className={p.card} aria-label={title}>
      {title ? (
        <div className={p.cardHead}>
          <h2 className={p.cardTitle}>{title}</h2>
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function GroupHead({ title, hint, danger }: { title: string; hint?: string; danger?: boolean }) {
  return (
    <p className={p.groupHead}>
      {danger ? <StatusGlyph tone="danger" size={12} /> : null}
      <span>{title}</span>
      {hint ? <span className={p.hint}>{hint}</span> : null}
    </p>
  );
}

function Name({ n, u }: { n: string; u: string }) {
  return (
    <>
      {n} <span className={p.mono}>{u}</span>
    </>
  );
}

function More({
  shown,
  total,
  open,
  onToggle,
  what,
}: {
  shown: number;
  total: number;
  open: boolean;
  onToggle: () => void;
  what?: string;
}) {
  if (total <= shown) return null;
  return (
    <button type="button" className={p.more} aria-expanded={open} onClick={onToggle}>
      {open ? "Show fewer" : `Show ${total - shown} ${what ?? "more"}`}
    </button>
  );
}

function HomeSection({
  go,
  onRecord,
  note,
}: {
  go: (s: CommunityTeamSection) => void;
  onRecord: () => void;
  note: (t: string) => void;
}) {
  const [week, setWeek] = useState(false);
  const [allCms, setAllCms] = useState(false);
  const cms = STAFF.filter((s) => s.load);
  const duty = STAFF.find((s) => s.today === "duty")!;
  const actNow = [
    {
      id: "fu",
      what: "7-day follow-up due today",
      n: "Thornbury, Cleo",
      u: "UM200288",
      meta: "left RGH Adult Secure · Byrne, T.",
      when: "Day 7",
      action: "Record",
      act: true,
      run: onRecord,
    },
    {
      id: "ref",
      what: "Referral past its answer time",
      n: "Sallowfield, June",
      u: "UM200322",
      meta: "from GP · psychiatrist review",
      when: "3d 1h",
      action: "Answer",
      run: () => go("referrals"),
    },
    {
      id: "book",
      what: "Leaving hospital, no follow-up booked",
      n: "Greymantle, Ottoline",
      u: "UM100095",
      meta: "Moodjar · Mallard, J.",
      when: "Wed 4 Nov",
      action: "Book",
      run: () => note(NOT_WIRED),
    },
  ];
  const thisWeek = [
    {
      id: "alloc",
      what: "Waiting for a case manager",
      n: "Elmsworth, Kai",
      u: "UM200152",
      meta: "+4 more · accepted Thu 29 Oct",
      when: "4d",
      action: "Allocate",
    },
    {
      id: "cto",
      what: "CTO review due",
      n: "Jessop, Rowan",
      u: "UM200204",
      meta: "+2 more · Doyle, M. · ends 9 Nov",
      when: "Wed 4 Nov",
      action: "Open",
    },
    {
      id: "seen",
      what: "Not seen in 4 weeks",
      n: "Dunmore, Felicity",
      u: "UM200140",
      meta: "+1 more · Mallard, J.",
      when: "31d",
      action: "Open",
    },
    {
      id: "nocm",
      what: "Admitted with no case manager",
      n: "Emberfall, Cassia",
      u: "UM100093",
      meta: "SJGM Adult Open · discharge date passed",
      when: "20d",
      action: "Allocate",
    },
  ];
  return (
    <>
      <section className={`${p.card} ${p.reach}`} aria-label="Duty officer">
        <Phone size={20} aria-hidden="true" className={p.quiet} />
        <div className={p.reachText}>
          <b>{duty.name}</b> <span className={p.mono}>ext {duty.ext}</span>
          <span className={p.small}>
            Duty officer today · {f.working} of {f.clinicians} working
          </span>
        </div>
        <Button size="sm" onClick={() => note(NOT_WIRED)}>
          Call<SrOnly> {duty.name}</SrOnly>
        </Button>
      </section>

      <Card title="Team list" aside={<span className={p.tag}>To do {actNow.length + thisWeek.length}</span>}>
        <GroupHead title={`Act now ${actNow.length}`} hint="needs someone today" danger />
        <ul className={p.rows}>
          {actNow.map((r) => (
            <PhoneListRow
              key={r.id}
              as="li"
              actNow={r.act}
              leading={<StatusGlyph tone={r.act ? "danger" : "warning"} size={12} />}
              name={r.what}
              meta={
                <>
                  <Name n={r.n} u={r.u} /> · {r.meta}
                </>
              }
              value={r.when}
              action={{ label: r.action, onAction: r.run }}
            />
          ))}
        </ul>
        {week ? (
          <>
            <GroupHead title={`This week ${thisWeek.length}`} hint="oldest first" />
            <ul className={p.rows}>
              {thisWeek.map((r) => (
                <PhoneListRow
                  key={r.id}
                  as="li"
                  leading={<StatusGlyph tone="neutral" size={12} />}
                  name={r.what}
                  meta={
                    <>
                      <Name n={r.n} u={r.u} /> · {r.meta}
                    </>
                  }
                  value={r.when}
                  action={{
                    label: r.action,
                    onAction: () =>
                      go(r.action === "Allocate" || r.id === "seen" || r.id === "cto" ? "caseload" : "home"),
                  }}
                />
              ))}
            </ul>
          </>
        ) : null}
        <More shown={0} total={thisWeek.length} open={week} onToggle={() => setWeek(!week)} what="for this week" />
      </Card>

      <section className={`${p.card} ${p.tiles}`} aria-label="Team figures">
        {[
          {
            id: "caseload" as const,
            value: f.caseload,
            label: "Caseload",
            line: `${f.managed} managed · ${f.unallocated} unallocated`,
            bar: [
              [f.managed, "d1"],
              [f.psychiatristOnly, "d2"],
              [f.unallocated, "dw"],
            ],
          },
          {
            id: "hospital" as const,
            value: f.inHospital,
            label: "In hospital",
            line: `${f.homeIn7Days} home in 7 days · ${f.datesPassed} dates passed`,
            bar: [
              [4, "d1"],
              [3, "d2"],
              [2, "dw"],
            ],
          },
          {
            id: "referrals" as const,
            value: f.referrals,
            label: "Referrals",
            line: `${f.pastTime} past its time · ${f.dueThisWeek} due this week`,
            bar: [
              [1, "dw"],
              [2, "d1"],
            ],
          },
          {
            id: "hospital" as const,
            value: f.followUps,
            label: "Follow-up",
            line: "1 due today · 1 not booked",
            bar: [
              [2, "d1"],
              [1, "dw"],
              [1, "dk"],
            ],
          },
        ].map((tile) => {
          const total = tile.bar.reduce((sum, [n]) => sum + Number(n), 0);
          return (
            <button key={tile.label} type="button" className={p.tile} onClick={() => go(tile.id)}>
              <span className={p.tileHead}>
                <b className={p.mono}>{tile.value}</b> {tile.label}
              </span>
              <span className={p.bar} aria-hidden="true">
                {tile.bar.map(([n, c], i) => (
                  <i key={i} className={p[String(c)]} style={{ width: `${(Number(n) / total) * 100}%` }} />
                ))}
              </span>
              <span className={p.small}>{tile.line}</span>
            </button>
          );
        })}
      </section>

      <Card title="Caseload by case manager" aside={<span className={p.small}>of agreed limit</span>}>
        <ul className={p.rows}>
          {(allCms ? cms : cms.slice(0, 4)).map((s) => (
            <li key={s.id} className={p.cmRow}>
              <span>
                <b>{s.name}</b>
                <span className={p.small}>{s.role.replace(" case manager", "")}</span>
              </span>
              <span className={p.limit} aria-hidden="true">
                <i style={{ width: `${((s.load ?? 0) / (s.cap ?? 20)) * 100}%` }} />
              </span>
              <span className={p.mono}>
                {s.load}/{s.cap}
              </span>
            </li>
          ))}
        </ul>
        <More shown={4} total={cms.length} open={allCms} onToggle={() => setAllCms(!allCms)} />
      </Card>
    </>
  );
}

type CaseFilter = "all" | "hosp" | "cto" | "ctoDue" | "notSeen" | "unalloc";

function CaseloadSection() {
  const [filter, setFilter] = useState<CaseFilter>("all");
  const [find, setFind] = useState("");
  const [cm, setCm] = useState("");
  const [all, setAll] = useState(false);
  const rows = CLIENTS.filter((c) => {
    if (filter !== "all" && !(c.flags ?? []).includes(filter)) return false;
    if (cm === "psych" && !c.psychOnly) return false;
    if (cm && cm !== "psych" && c.cm !== cm) return false;
    return !find || c.n.toLowerCase().includes(find.trim().toLowerCase());
  });
  const chips: { id: CaseFilter; label: string; n: number }[] = [
    { id: "all", label: "All", n: f.caseload },
    { id: "hosp", label: "In hospital", n: f.inHospital },
    { id: "cto", label: "On a CTO", n: f.onCto },
    { id: "ctoDue", label: "CTO review due", n: f.ctoReviewsDue },
    { id: "notSeen", label: "Not seen in 4 weeks", n: f.notSeen4Weeks },
    { id: "unalloc", label: "No case manager", n: f.unallocated },
  ];
  return (
    <>
      <ScrollRow rowClassName={p.chips} role="group" aria-label="Show">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            className={p.chip}
            aria-pressed={filter === c.id}
            onClick={() => setFilter(c.id)}
          >
            <b className={p.mono}>{c.n}</b>
            {c.label}
          </button>
        ))}
      </ScrollRow>
      <div className={p.two}>
        <label className={p.field}>
          <Search size={16} aria-hidden="true" />
          <SrOnly>Find a client</SrOnly>
          <input type="search" placeholder="Find a client" value={find} onChange={(e) => setFind(e.target.value)} />
        </label>
        <label className={p.field}>
          <SrOnly>Case manager</SrOnly>
          <select value={cm} onChange={(e) => setCm(e.target.value)}>
            <option value="">Case manager</option>
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
      <Card>
        <GroupHead
          title="Surname A to Z"
          hint={filter === "all" && !cm && !find ? `${f.caseload} clients` : `${rows.length} shown in this sample`}
        />
        <ul className={p.rows}>
          {(all ? rows : rows.slice(0, SHOWN)).map((c) => {
            const warn = (c.flags ?? []).includes("notSeen") || (!c.cm && !c.psychOnly);
            const who = c.cm ? shortName(c.cm) : c.psychOnly ? "Psychiatrist only" : "No case manager yet";
            return (
              <PhoneListRow
                key={c.u}
                as="li"
                leading={<StatusGlyph tone={warn ? "warning" : "neutral"} size={12} />}
                name={<Name n={c.n} u={c.u} />}
                meta={`${c.a} · ${who} · ${c.w === "h" ? `In ${c.where}` : c.legal === "CTO" ? `On a CTO, ${c.legalD?.replace(/^Ends/u, "ends")}` : c.legal}`}
                value={c.seen == null ? "Not yet" : `${c.seen}d`}
                time={c.nextD ? `Next ${c.nextD}` : c.next}
              />
            );
          })}
        </ul>
        {rows.length === 0 ? <p className={p.empty}>No one in this sample matches.</p> : null}
        <More shown={SHOWN} total={rows.length} open={all} onToggle={() => setAll(!all)} />
      </Card>
    </>
  );
}

function HospitalSection({ note, onRecord }: { note: (t: string) => void; onRecord: () => void }) {
  return (
    <>
      <Card title="In hospital now" aside={<span className={p.small}>{f.datesPassed} dates passed</span>}>
        <ul className={p.rows}>
          {INPATIENTS.map((c) => {
            const b = IN_BED[c.n]!;
            return (
              <PhoneListRow
                key={c.u}
                as="li"
                leading={<StatusGlyph tone={b.passed || b.none ? "warning" : "neutral"} size={12} />}
                name={<Name n={c.n} u={c.u} />}
                meta={`${c.where} · ${c.cm ? shortName(c.cm) : "No case manager"} · ${b.none ? "No team contact" : b.contact}`}
                value={`${b.bed}d`}
                time={b.out === "Not set" ? "Out not set" : b.out.startsWith("Passed") ? b.out : `Out ${b.out}`}
              />
            );
          })}
        </ul>
      </Card>
      <Card title="Back home: 7-day follow-up">
        <ul className={p.rows}>
          {DISCHARGED.map((d) => (
            <PhoneListRow
              key={d.u}
              as="li"
              actNow={d.state === "due"}
              leading={
                <StatusGlyph
                  tone={d.state === "due" ? "danger" : d.state === "seen" ? "success" : "neutral"}
                  size={12}
                />
              }
              name={<Name n={d.n} u={d.u} />}
              meta={`Left ${d.from} ${d.left} · ${shortName(d.cm)} · ${d.label}`}
              action={
                d.state === "seen"
                  ? undefined
                  : {
                      label: d.state === "booked" ? "Open" : d.state === "due" ? "Record" : "Book",
                      onAction: () => (d.state === "due" ? onRecord() : note(NOT_WIRED)),
                    }
              }
            />
          ))}
        </ul>
      </Card>
    </>
  );
}

function ReferralsSection({ open }: { open: (index: number) => void }) {
  const [pane, setPane] = useState<"q" | "s" | "h">("q");
  return (
    <>
      <Segmented
        label="Referrals"
        size="md"
        className={phone.segmented}
        value={pane}
        onChange={setPane}
        items={[
          { id: "q", label: "To answer", count: REFERRALS.length },
          { id: "s", label: "Sent", count: SENT.length },
          { id: "h", label: "Answered", count: f.answeredThisMonth },
        ]}
      />
      {pane === "q" ? (
        <Card>
          <GroupHead title="Oldest first" hint="answer within 3 days" />
          <ul className={p.rows}>
            {REFERRALS.map((r, index) => (
              <li key={r.id} className={p.ref}>
                <div className={p.refHead}>
                  <span>
                    <b>{r.n}</b> <span className={p.mono}>{r.u}</span>
                    <span className={p.small}>
                      {r.a} · {r.lives}
                    </span>
                  </span>
                  <span className={r.over ? p.warnTime : p.mono}>
                    {r.over ? <StatusGlyph tone="warning" size={12} /> : null}
                    {r.since}
                  </span>
                </div>
                <div className={p.meta}>
                  <span>
                    <span className={p.lab}>From</span>
                    <b>{r.fromD}</b>
                    <span className={p.small}>{r.from}</span>
                  </span>
                  <span>
                    <span className={p.lab}>Asking for</span>
                    <b>{r.ask}</b>
                    <span className={p.small}>
                      {r.interp === "Not needed" ? `Needs ${r.needs.toLowerCase()}` : `Interpreter, ${r.interp}`}
                    </span>
                  </span>
                </div>
                <div className={p.refFoot}>
                  <span className={p.lab}>
                    {r.over ? `${r.over.replace(" overdue", "")} past its answer time` : `Answer by ${r.dueAt}`}
                  </span>
                  <Button size="sm" onClick={() => open(index)}>
                    Open<SrOnly> {r.n}</SrOnly>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card>
          <ul className={p.rows}>
            {(pane === "s"
              ? SENT.map((s) => ({ n: s.n, u: s.u, meta: s.to, value: s.state, time: s.when }))
              : ANSWERED.map((a) => ({ n: a.n, u: a.u, meta: `${a.ask} · ${a.by}`, value: a.ans, time: a.when }))
            ).map((row) => (
              <PhoneListRow
                key={row.u}
                as="li"
                name={<Name n={row.n} u={row.u} />}
                meta={row.meta}
                value={row.value}
                time={row.time}
              />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function CliniciansSection({ note }: { note: (t: string) => void }) {
  return (
    <>
      <Card title="Today's cover" aside={<span className={p.small}>Mon 2 Nov</span>}>
        <dl className={p.dl}>
          <div>
            <dt>Duty officer</dt>
            <dd>
              Byrne, T. · <span className={p.mono}>4105</span>
            </dd>
          </div>
          <div>
            <dt>Intake</dt>
            <dd>
              Vance, K. · <span className={p.mono}>4104</span>
            </dd>
          </div>
          <div>
            <dt>Doctor of the day</dt>
            <dd>
              Petrov, Dr L. · <span className={p.mono}>4103</span>
            </dd>
          </div>
          <div>
            <dt>Leave cover</dt>
            <dd>Mallard, J. for Walsh, E.</dd>
          </div>
        </dl>
      </Card>
      <Card title="Clinicians" aside={<span className={p.small}>{STAFF.length} on the team</span>}>
        <ul className={p.rows}>
          {STAFF.map((s) => {
            const [tone, label] = TODAY[s.today] ?? ["neutral", s.today];
            return (
              <PhoneListRow
                key={s.id}
                as="li"
                leading={<StatusGlyph tone={tone} size={12} />}
                name={s.name}
                meta={`${s.role} · ${label} · ${s.where}`}
                value={s.load ? `${s.load}/${s.cap}` : undefined}
                action={{ label: "Call", icon: Phone, onAction: () => note(NOT_WIRED) }}
              />
            );
          })}
        </ul>
      </Card>
    </>
  );
}

function ReferralSheet({
  index,
  onClose,
  openFull,
}: {
  index: number | null;
  onClose: () => void;
  openFull: () => void;
}) {
  const r = index === null ? null : REFERRALS[index]!;
  const { accept, say: note } = useAnswer(r?.n ?? "");
  return (
    <PhoneSheet
      open={r !== null}
      onClose={onClose}
      title={r?.n ?? "Referral"}
      description={r ? `${r.u} · ${r.a} · ${r.lives}, ${r.catch.toLowerCase()}` : undefined}
      height="tall"
      primary={{
        label: "Accept for Midland",
        onAction: () => {
          if (r) accept(`Accepted for Midland`);
          onClose();
        },
      }}
      secondary={{ label: "Decline", onAction: () => note(NOT_WIRED) }}
      data-testid="ward-community-phone-demo-referral"
    >
      {r ? (
        <div className={p.sheetBody}>
          <div className={p.timecard}>
            <div className={p.refHead}>
              <span>
                <b className={p.mono}>{r.since}</b> waiting
              </span>
              {r.over ? (
                <span className={p.warnTime}>
                  <StatusGlyph tone="warning" size={12} />
                  {r.over.replace("overdue", "past")}
                </span>
              ) : null}
              <span className={p.tag}>{r.urgency}</span>
            </div>
            <span className={p.prog} aria-hidden="true">
              <i style={{ width: `${r.pct}%` }} />
            </span>
            <div className={p.meta}>
              <span>
                <span className={p.lab}>Received</span>
                {r.received}
              </span>
              <span>
                <span className={p.lab}>Answer by</span>
                {r.dueAt}
              </span>
            </div>
          </div>
          <div className={p.facts}>
            <span>
              <span className={p.lab}>From</span>
              <b>{r.fromD}</b>
              <span className={p.small}>{r.from}</span>
            </span>
            <span>
              <span className={p.lab}>Asking for</span>
              <b>{r.ask}</b>
              <span className={p.small}>{r.urgency}</span>
            </span>
            <span>
              <span className={p.lab}>Lives in</span>
              <b>{r.lives}</b>
              <span className={p.ok}>
                <Check size={12} aria-hidden="true" /> {r.catch}
              </span>
            </span>
            <span>
              <span className={p.lab}>Needs</span>
              <b>{r.needs}</b>
              <span className={p.small}>{r.legal}</span>
            </span>
          </div>
          <p className={p.why}>{r.why}</p>
          <button type="button" className={p.linkRow} onClick={openFull}>
            <FileText size={16} aria-hidden="true" />
            <span>
              <b>Full referral</b> · handover, documents, contacts and timeline
            </span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          <label className={p.pick}>
            <span>Case manager</span>
            <span className={p.field}>
              <select defaultValue="">
                <option value="">Allocate later</option>
                {STAFF.filter((s) => s.load).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </span>
          </label>
          <p className={p.small}>{r.fromD} is told when you accept.</p>
        </div>
      ) : null}
    </PhoneSheet>
  );
}

/** The Midland phone page: the band hero, the five sections and the referral sheet. */
export function MidlandPhone({
  section,
  open,
  onRecordContact,
  onReferFromTeam,
  onSwitchTeam,
}: {
  section: CommunityTeamSection;
  open: (section: CommunityTeamSection) => void;
  onRecordContact: () => void;
  onReferFromTeam: () => void;
  /** Opens Switch team from the bar's place line (Q158). Absent for a desk that sees its own team only. */
  onSwitchTeam?: (open: boolean) => void;
}) {
  const [sheet, setSheet] = useState<number | null>(null);
  const [full, setFull] = useState<number | null>(null);
  const { say: note } = useAnswer("");
  const bandRef = useRef<HTMLDivElement>(null);
  useWfBandBleed(bandRef, full === null);
  const switchTeam = useCallback(() => onSwitchTeam?.(true), [onSwitchTeam]);
  useRegisterWardBarPlaceSwitch(
    onSwitchTeam ? { label: "East Metro · Adult", actionLabel: "Switch team", onPress: switchTeam } : null,
  );
  const figures = FIGURES[section];
  if (full !== null) {
    return (
      <div className={phone.phone} data-testid="ward-community-phone">
        <ReferralPage index={full} go={setFull} back={() => setFull(null)} />
      </div>
    );
  }
  return (
    <div className={phone.phone} data-testid="ward-community-phone">
      <div ref={bandRef} className={phone.band} data-wf-hero="band">
        <PhoneHero
          level={1}
          className={phone.teamHero}
          data-testid="ward-community-phone-hero"
          eyebrow="Midland · East Metro · Adult"
          chip={<LiveChip state="live" onHero />}
          title={
            section === "home" ? `${f.caseload} on the caseload` : <SrOnly>{`${f.caseload} on the caseload`}</SrOnly>
          }
          sub={
            section === "home" ? `${f.inHospital} in hospital · ${f.unallocated} waiting for a case manager` : undefined
          }
          figures={figures.map((fig) => ({ id: fig.id, value: fig.value, label: fig.label, tone: fig.tone }))}
          actions={
            section === "home" ? (
              <button
                type="button"
                className={buttonClass({ variant: "onHero", size: "md" })}
                onClick={onRecordContact}
              >
                <Phone size={16} aria-hidden="true" />
                Record contact
              </button>
            ) : section === "referrals" ? (
              <button
                type="button"
                className={buttonClass({ variant: "onHero", size: "md" })}
                onClick={onReferFromTeam}
              >
                <Plus size={16} aria-hidden="true" />
                Refer from team
              </button>
            ) : undefined
          }
        />
      </div>
      <div className={phone.body}>
        <Segmented
          label="Team sections"
          size="md"
          className={`${phone.segmented} ${p.track}`}
          value={section}
          onChange={open}
          items={SECTIONS}
        />
        {section === "home" ? <HomeSection go={open} onRecord={onRecordContact} note={note} /> : null}
        {section === "caseload" ? <CaseloadSection /> : null}
        {section === "hospital" ? <HospitalSection note={note} onRecord={onRecordContact} /> : null}
        {section === "referrals" ? <ReferralsSection open={setSheet} /> : null}
        {section === "clinicians" ? <CliniciansSection note={note} /> : null}
        <p className={p.foot}>
          <span className={p.footTag}>Synthetic prototype</span> Invented people and numbers
        </p>
      </div>
      <ReferralSheet
        index={sheet}
        onClose={() => setSheet(null)}
        openFull={() => {
          setFull(sheet);
          setSheet(null);
        }}
      />
    </div>
  );
}

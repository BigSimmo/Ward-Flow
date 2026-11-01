"use client";

/*
 * Team home (locked design, design/community-team-2026-11, screenshot tab-home.png): the summary
 * tiles, the Team list, caseload by case manager, the Team flow card and How to reach. Midland demo
 * data, ported from the mock-up as it stands (Q132).
 */

import { useState } from "react";
import { ArrowLeftRight, List, Phone, Users } from "lucide-react";
import { Button, Card, CardHead, Count, Segmented, SrOnly, StatusGlyph, type WfTone } from "@/components/wf";
import home from "@/components/ward-management/ward/ward-home-tab.module.css";
import { CLIENTS, DEMO_FIGURES, REFERRALS, SENT, STAFF, shortName } from "./midland-demo";
import { Initials } from "./parts";
import t from "./team-2026.module.css";

export type TeamGo = (
  section: "home" | "caseload" | "hospital" | "referrals" | "clinicians",
  caseManager?: string,
) => void;

type BarPart = readonly [number, string];

function Tile(props: {
  go: () => void;
  n: number;
  label: string;
  right: string;
  bar: readonly BarPart[];
  lines: readonly (readonly [WfTone | "", number, string])[];
}) {
  return (
    <button type="button" className={t.tile} onClick={props.go}>
      <span className={t.tileTop}>
        <b className={t.tileN}>{props.n}</b>
        <span className={t.tileL}>{props.label}</span>
        <span className={t.tileR}>{props.right}</span>
      </span>
      <span className={t.bar} aria-hidden="true">
        {props.bar.map(([flex, colour], index) => (
          <i key={index} style={{ flex, background: `var(${colour})` }} />
        ))}
      </span>
      <span className={t.tileLines}>
        {props.lines.map(([tone, n, text]) => (
          <span key={text}>
            {tone ? <StatusGlyph tone={tone} size={12} /> : null}
            <b>{n}</b> {text}
          </span>
        ))}
      </span>
    </button>
  );
}

function ListRow(props: {
  tone: WfTone;
  title: string;
  name: string;
  umrn: string;
  detail: string;
  when: string;
  whenSub: string;
  action: string;
  primary?: boolean;
  go: () => void;
}) {
  return (
    <li className={`${t.lr}${props.tone === "danger" ? ` ${t.urgent}` : ""}`}>
      <StatusGlyph tone={props.tone} size={12} />
      <span className={t.lrMain}>
        <span className={t.lrTitle}>{props.title}</span>
        <span className={t.lrDetail}>
          <b>{props.name}</b> <span className={t.mono}>{props.umrn}</span> · {props.detail}
        </span>
      </span>
      <span className={t.lrWhen}>
        <b className={t.mono}>{props.when}</b>
        <span>{props.whenSub}</span>
      </span>
      <Button variant={props.primary ? "pri" : "sec"} size="sm" onClick={props.go}>
        {props.action}
        <SrOnly> {props.name}</SrOnly>
      </Button>
    </li>
  );
}

function ListGroup(props: { tone: WfTone; title: string; hint: string; children: React.ReactNode[] }) {
  return (
    <section className={t.lg}>
      <div className={t.lgHead}>
        <StatusGlyph tone={props.tone} size={12} />
        <h3>{props.title}</h3>
        <Count n={props.children.length} />
        <span className={t.lgHint}>{props.hint}</span>
      </div>
      <ul className={t.lgList}>{props.children}</ul>
    </section>
  );
}

const TODAY_LOG = [
  ["10:31", "Contact recorded", "Calderbrook, Jonah · clozapine bloods taken · Doyle, M."],
  ["10:05", "Referral received", "Rendlesham, Otto · from Moodjar ward"],
  ["09:40", "Follow-up booked", "Yarrowdale, Ben · Tue 3 Nov 10:00 · Nair, P."],
  ["09:12", "Admitted", "Brackwater, Meredith · RGH Adult Secure"],
  ["08:55", "Referral accepted", "Pembury, Ada · case manager Kuroki, H."],
  ["08:40", "Depot fridge checked", "Doyle, M."],
] as const;

function FlowRow(props: { title: string; detail: string; when: string; tone: WfTone; action: string; go: () => void }) {
  return (
    <li className={home.flowRow}>
      <StatusGlyph tone={props.tone} size={10} />
      <span className={home.flowMain}>
        <span className={home.flowTitleLine}>
          <span className={home.flowTitle}>{props.title}</span>
          <span className={home.flowWhen}>{props.when}</span>
        </span>
        <span className={home.flowDetail}>{props.detail}</span>
      </span>
      <Button size="sm" onClick={props.go}>
        {props.action}
        <SrOnly> {props.title}</SrOnly>
      </Button>
    </li>
  );
}

function FlowGroup({ title, children }: { title: string; children: React.ReactNode[] }) {
  return (
    <section className={home.flowGroup}>
      <div className={home.groupHead}>
        <h3 className={home.groupTitle}>{title}</h3>
        <Count n={children.length} />
      </div>
      <ul className={home.flowList}>{children}</ul>
    </section>
  );
}

const ADMITTED_THIS_WEEK = [
  "Marrowby, Ines",
  "Castleburn, Thaddeus",
  "Brackwater, Meredith",
  "Foxglenn, Marguerite",
  "Driftwood, Yolanda",
];

export function TeamHome({ go, now }: { go: TeamGo; now: string }) {
  const [list, setList] = useState<"todo" | "log">("todo");
  const [flow, setFlow] = useState<"ref" | "adm" | "dis">("ref");
  const f = DEMO_FIGURES;
  return (
    <>
      <Card className={`${home.v6Card} ${t.summary}`} aria-label="Team summary">
        <div className={t.tiles}>
          <Tile
            go={() => go("caseload")}
            n={f.caseload}
            label="Caseload"
            right="6 case managers"
            bar={[
              [f.managed, "--wf-data-1"],
              [f.psychiatristOnly, "--wf-data-2"],
              [f.unallocated, "--wf-warning"],
            ]}
            lines={[
              ["", f.managed, "managed"],
              ["", f.psychiatristOnly, "psychiatrist only"],
              ["warning", f.unallocated, "unallocated"],
            ]}
          />
          <Tile
            go={() => go("hospital")}
            n={f.inHospital}
            label="In hospital"
            right={`longest ${f.longestInBed}`}
            bar={[
              [4, "--wf-data-1"],
              [3, "--wf-data-2"],
              [2, "--wf-warning"],
            ]}
            lines={[
              ["", f.homeIn7Days, "home in 7 days"],
              ["warning", f.datesPassed, "dates passed"],
            ]}
          />
          <Tile
            go={() => go("referrals")}
            n={f.referrals}
            label="Referrals"
            right={`oldest ${f.oldestReferral}`}
            bar={[
              [2, "--wf-data-1"],
              [1, "--wf-warning"],
            ]}
            lines={[
              ["warning", f.pastTime, "past its time"],
              ["", f.dueThisWeek, "due this week"],
            ]}
          />
          <Tile
            go={() => go("hospital")}
            n={f.followUps}
            label="Follow-up"
            right="within 7 days"
            bar={[
              [1, "--wf-success"],
              [1, "--wf-data-1"],
              [1, "--wf-warning"],
              [1, "--wf-danger"],
            ]}
            lines={[
              ["danger", 1, "due today"],
              ["warning", 1, "not booked"],
            ]}
          />
        </div>
        <div className={t.key}>
          <span>
            <i style={{ background: "var(--wf-data-1)" }} />
            On track
          </span>
          <span>
            <i style={{ background: "var(--wf-data-2)" }} />
            Other
          </span>
          <span>
            <i style={{ background: "var(--wf-warning)" }} />
            Needs a look
          </span>
          <span className={t.keyNote}>Choose a figure to open its list.</span>
        </div>
      </Card>

      <div className={t.grid}>
        <div className={t.col}>
          <Card className={home.v6Card}>
            <CardHead
              icon={List}
              title="Team list"
              aside={
                <Segmented
                  label="Team list"
                  size="sm"
                  value={list}
                  onChange={setList}
                  items={[
                    { id: "todo", label: "To do", count: 7 },
                    { id: "log", label: "Today's log", count: TODAY_LOG.length },
                  ]}
                />
              }
            />
            {list === "todo" ? (
              <div>
                <ListGroup tone="danger" title="Act now" hint="needs someone today">
                  {[
                    <ListRow
                      key="a"
                      tone="danger"
                      title="7-day follow-up due today"
                      name="Thornbury, Cleo"
                      umrn="UM200288"
                      detail="left RGH Adult Secure · Byrne, T."
                      when="Day 7"
                      whenSub="of 7"
                      action="Record contact"
                      primary
                      go={() => go("hospital")}
                    />,
                    <ListRow
                      key="b"
                      tone="warning"
                      title="Referral past its answer time"
                      name="Sallowfield, June"
                      umrn="UM200322"
                      detail="from GP · psychiatrist review"
                      when="3d 1h"
                      whenSub="1h overdue"
                      action="Answer"
                      go={() => go("referrals")}
                    />,
                    <ListRow
                      key="c"
                      tone="warning"
                      title="Leaving hospital, no follow-up booked"
                      name="Greymantle, Ottoline"
                      umrn="UM100095"
                      detail="Moodjar · Mallard, J."
                      when="Wed 4 Nov"
                      whenSub="in 2 days"
                      action="Book"
                      go={() => go("hospital")}
                    />,
                  ]}
                </ListGroup>
                <ListGroup tone="neutral" title="This week" hint="oldest first">
                  {[
                    <ListRow
                      key="d"
                      tone="neutral"
                      title="Waiting for a case manager"
                      name="Elmsworth, Kai"
                      umrn="UM200152"
                      detail="+4 more · accepted Thu 29 Oct"
                      when="4d"
                      whenSub="oldest"
                      action="Allocate"
                      go={() => go("caseload")}
                    />,
                    <ListRow
                      key="e"
                      tone="neutral"
                      title="CTO review due"
                      name="Jessop, Rowan"
                      umrn="UM200204"
                      detail="+2 more · Doyle, M. · ends 9 Nov"
                      when="Wed 4 Nov"
                      whenSub="in 2 days"
                      action="Open"
                      go={() => go("caseload")}
                    />,
                    <ListRow
                      key="f"
                      tone="neutral"
                      title="Not seen in 4 weeks"
                      name="Dunmore, Felicity"
                      umrn="UM200140"
                      detail="+1 more · Mallard, J."
                      when="31d"
                      whenSub="since seen"
                      action="Open"
                      go={() => go("caseload")}
                    />,
                    <ListRow
                      key="g"
                      tone="neutral"
                      title="Admitted with no case manager"
                      name="Emberfall, Cassia"
                      umrn="UM100093"
                      detail="SJGM Adult Open · discharge date passed"
                      when="20d"
                      whenSub="in bed"
                      action="Allocate"
                      go={() => go("hospital")}
                    />,
                  ]}
                </ListGroup>
              </div>
            ) : (
              <ul className={t.log}>
                {TODAY_LOG.map(([when, what, detail]) => (
                  <li key={`${when}-${what}`}>
                    <span className={`${t.mono} ${t.logT}`}>{when}</span>
                    <span className={t.person}>
                      <span className={t.logA}>{what}</span>
                      <span className={t.sub}>{detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className={home.v6Card}>
            <CardHead
              icon={Users}
              title="Caseload by case manager"
              aside={
                <button type="button" className={home.keyLink} onClick={() => go("caseload")}>
                  Open caseload
                </button>
              }
            />
            <div className={t.loadList}>
              {STAFF.filter((s) => s.load).map((s) => (
                <button key={s.id} type="button" className={t.loadRow} onClick={() => go("caseload", s.id)}>
                  <span className={t.cm}>
                    <Initials id={s.id} />
                    <span className={t.loadName}>{s.name}</span>
                  </span>
                  <span className={t.loadRole}>
                    {s.role.replace(" case manager", "")}
                    {s.today === "leave" ? " · on leave" : ""}
                  </span>
                  <span className={t.track} aria-hidden="true">
                    <span style={{ width: `${((s.load ?? 0) / 20) * 100}%` }} />
                    <i style={{ left: `${((s.cap ?? 0) / 20) * 100}%` }} />
                  </span>
                  <span className={t.loadN}>
                    <b>{s.load}</b> of {s.cap}
                  </span>
                </button>
              ))}
              <div className={t.loadFoot}>
                <span>
                  <b>{f.psychiatristOnly}</b> psychiatrist only
                </span>
                <span>
                  <b>{f.unallocated}</b> waiting for a case manager
                </span>
                <span className={t.keyMark}>
                  <i /> agreed limit
                </span>
              </div>
            </div>
          </Card>
        </div>

        <div className={t.col}>
          <Card className={`${home.flowCard} ${home.v6Card} ${t.flowCard}`}>
            <CardHead icon={ArrowLeftRight} title="Team flow" aside={<span className={home.v6Meta}>{now}</span>} />
            <div className={`${home.flowSwitch} ${t.flowSwitch}`}>
              <Segmented
                label="Team flow"
                size="sm"
                value={flow}
                onChange={setFlow}
                items={[
                  { id: "ref", label: "Referrals", count: REFERRALS.length },
                  { id: "adm", label: "Admitted", count: ADMITTED_THIS_WEEK.length },
                  { id: "dis", label: "Leaving", count: 4 },
                ]}
              />
            </div>
            <div className={`${home.flowBody} ${t.flowBody}`}>
              {flow === "ref" ? (
                <>
                  <FlowGroup title="Awaiting your answer">
                    {REFERRALS.map((r) => (
                      <FlowRow
                        key={r.id}
                        title={r.n}
                        detail={`${r.from} · ${r.ask}`}
                        when={r.over ?? r.since}
                        tone={r.over ? "warning" : "neutral"}
                        action="Open"
                        go={() => go("referrals")}
                      />
                    ))}
                  </FlowGroup>
                  <FlowGroup title="Sent by the team">
                    {[
                      <FlowRow
                        key="sent"
                        title={SENT[0]!.n}
                        detail={SENT[0]!.to}
                        when={SENT[0]!.when}
                        tone="neutral"
                        action="Open"
                        go={() => go("referrals")}
                      />,
                    ]}
                  </FlowGroup>
                </>
              ) : flow === "adm" ? (
                <FlowGroup title="Admitted in the last 7 days">
                  {ADMITTED_THIS_WEEK.map((name) => {
                    const client = CLIENTS.find((c) => c.n === name);
                    return (
                      <FlowRow
                        key={name}
                        title={name}
                        detail={`${client?.where ?? ""} · ${client?.cm ? shortName(client.cm) : "no case manager"}`}
                        when="6 days ago"
                        tone="neutral"
                        action="Open"
                        go={() => go("hospital")}
                      />
                    );
                  })}
                </FlowGroup>
              ) : (
                <FlowGroup title="Leaving in the next 7 days">
                  {[
                    ["Greymantle, Ottoline", "Moodjar · follow-up not booked", "Wed 4 Nov", "warning", "Book"],
                    ["Marrowby, Ines", "Dabakarn · follow-up Thu 5 Nov", "Thu 5 Nov", "success", "Open"],
                    [
                      "Castleburn, Thaddeus",
                      "Mental Health Unit · follow-up not booked",
                      "Fri 6 Nov",
                      "neutral",
                      "Book",
                    ],
                    ["Foxglenn, Marguerite", "BTY Older Adult · follow-up not booked", "Mon 9 Nov", "neutral", "Book"],
                  ].map(([title, detail, when, tone, action]) => (
                    <FlowRow
                      key={title}
                      title={title!}
                      detail={detail!}
                      when={when!}
                      tone={tone as WfTone}
                      action={action!}
                      go={() => go("hospital")}
                    />
                  ))}
                </FlowGroup>
              )}
            </div>
            <div className={home.flowFoot}>
              <span>{f.datesPassed} discharge dates passed</span>
              <button type="button" className={home.keyLink} onClick={() => go("hospital")}>
                All in hospital
              </button>
            </div>
          </Card>

          <Card className={home.v6Card}>
            <CardHead icon={Phone} title="How to reach" aside={<span className={t.meta}>Invented for the demo</span>} />
            <dl className={t.dl}>
              <div>
                <dt>Intake</dt>
                <dd>
                  <span className={t.mono}>08 5550 0107</span>
                </dd>
              </div>
              <div>
                <dt>Duty officer</dt>
                <dd>
                  Byrne, T. · <span className={t.mono}>ext 4105</span>
                </dd>
              </div>
              <div>
                <dt>After hours</dt>
                <dd>Mental Health Emergency Response Line</dd>
              </div>
              <div>
                <dt>Referrals</dt>
                <dd>midland@example.health</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>281 Great Eastern Highway, Midland</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

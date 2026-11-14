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
import { DEMO_FIGURES, SENT, staffName } from "./midland-demo";
import { useMidlandDay, useMidlandDemo } from "./use-midland-demo";
import { perthClockTime } from "@/components/ward-management/ward-clock";
import { openReferrals, recordMidlandContact, todaysMidlandContacts, useMidlandDecisions } from "./midland-decisions";
// The team desk's rail badge reads the same figure (R-STRUCT-24, D-220).
import { teamReferralsToAnswer } from "./team-referral-count";
import { useMidlandBoardMoment } from "./use-midland-board-moment";
import { Initials } from "./parts";
import { MIDLAND_ACT_NOW_ATTR } from "./midland-top";
import t from "./team-2026.module.css";
import { referenceTeamDetail } from "@/components/ward-management/reference/ward-reference-teams";

/** The Midland team's generated reference record (invented number and mailbox, suburb only). */
const MIDLAND_CONTACT = referenceTeamDetail("Midland Community Mental Health Service");

export type TeamGo = (
  section: "home" | "caseload" | "hospital" | "referrals" | "clinicians",
  caseManager?: string,
) => void;

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
  const day = useMidlandDay();
  return (
    <li className={`${t.lr}${props.tone === "danger" ? ` ${t.urgent}` : ""}`}>
      <StatusGlyph tone={props.tone} size={12} />
      <span className={t.lrMain}>
        <span className={t.lrTitle}>{props.title}</span>
        <span className={t.lrDetail}>
          <b>{props.name}</b> <span className={t.mono}>{props.umrn}</span> · {day(props.detail)}
        </span>
      </span>
      <span className={t.lrWhen}>
        <b className={t.mono}>{day(props.when)}</b>
        <span>{props.whenSub}</span>
      </span>
      <Button variant={props.primary ? "pri" : "sec"} size="sm" onClick={props.go}>
        {props.action}
        <SrOnly> {props.name}</SrOnly>
      </Button>
    </li>
  );
}

function ListGroup(props: {
  tone: WfTone;
  title: string;
  hint: string;
  /** The act-now group: Show act now scrolls to and focuses its heading. */
  actNow?: boolean;
  children: React.ReactNode[];
}) {
  return (
    <section className={t.lg}>
      <div className={t.lgHead}>
        <StatusGlyph tone={props.tone} size={12} />
        <h3 {...(props.actNow ? { [MIDLAND_ACT_NOW_ATTR]: "", tabIndex: -1 } : {})}>{props.title}</h3>
        <Count n={props.children.length} />
        <span className={t.lgHint}>{props.hint}</span>
      </div>
      <ul className={t.lgList}>{props.children}</ul>
    </section>
  );
}

const TODAY_LOG = [
  ["10:31", "Contact recorded", "Calderbrook, Jonah · clozapine bloods taken · Doyle, Marcus"],
  ["10:05", "Referral received", "Rendlesham, Otto · from Moodjar ward"],
  ["09:40", "Follow-up booked", "Yarrowdale, Ben · Tue 3 Nov 10:00 · Nair, Priya"],
  ["09:12", "Admitted", "Brackwater, Meredith · RGH Adult Secure"],
  ["08:55", "Referral accepted", "Pembury, Ada · case manager Kuroki, Hana"],
  ["08:40", "Depot fridge checked", "Doyle, Marcus"],
] as const;

function FlowRow(props: { title: string; detail: string; when: string; tone: WfTone; action: string; go: () => void }) {
  const day = useMidlandDay();
  return (
    <li className={home.flowRow}>
      <StatusGlyph tone={props.tone} size={10} />
      <span className={home.flowMain}>
        <span className={home.flowTitleLine}>
          <span className={home.flowTitle}>{props.title}</span>
          <span className={home.flowWhen}>{day(props.when)}</span>
        </span>
        <span className={home.flowDetail}>{day(props.detail)}</span>
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
  const { CLIENTS, REFERRALS, STAFF } = useMidlandDemo();
  const day = useMidlandDay();
  const decisions = useMidlandDecisions();
  // Today's recorded contacts lead Today's log, with time and desk role; the Act-now row shows it is
  // done. A contact from an earlier day is not today's, so the follow-up comes back the next day.
  // The board's day, not the device's (time audit C5): a demo board on another day counts its own.
  const boardMoment = useMidlandBoardMoment();
  const contacts = todaysMidlandContacts(decisions, boardMoment);
  const cleoContact = contacts.find((c) => c.about === "a");
  // One open-referral set for the task list, the flow count and Awaiting your answer.
  const open = openReferrals(REFERRALS, decisions);
  const sallowfieldOpen = open.some(({ r }) => r.id === "r1");
  const log = [
    ...contacts.map(
      (c) =>
        [
          perthClockTime(new Date(c.at)),
          "Contact recorded",
          `${c.about === "a" ? "Thornbury, Cleo" : "Team contact"} · by Community`,
        ] as const,
    ),
    ...TODAY_LOG,
  ];
  const [list, setList] = useState<"todo" | "log">("todo");
  const [flow, setFlow] = useState<"ref" | "adm" | "dis">("ref");
  const f = DEMO_FIGURES;
  return (
    <>
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
                    { id: "todo", label: "To do", count: 7 - (cleoContact ? 1 : 0) - (sallowfieldOpen ? 0 : 1) },
                    { id: "log", label: "Today's log", count: log.length },
                  ]}
                />
              }
            />
            {list === "todo" ? (
              <div>
                <ListGroup tone="danger" title="Act now" hint="needs someone today" actNow>
                  {[
                    <ListRow
                      key="a"
                      tone={cleoContact ? "success" : "danger"}
                      title={
                        cleoContact
                          ? `Contact recorded at ${perthClockTime(new Date(cleoContact.at))}`
                          : "7-day follow-up due today"
                      }
                      name="Thornbury, Cleo"
                      umrn="UM200288"
                      detail="left RGH Adult Secure · Byrne, Tom"
                      when="Day 7"
                      whenSub="of 7"
                      action={cleoContact ? "Open" : "Record contact"}
                      primary={!cleoContact}
                      go={() => (cleoContact ? go("hospital") : recordMidlandContact("a", boardMoment))}
                    />,
                    // An answered referral leaves the task list, as it leaves Awaiting your answer.
                    ...(sallowfieldOpen
                      ? [
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
                        ]
                      : []),
                    <ListRow
                      key="c"
                      tone="warning"
                      title="Leaving hospital, no follow-up booked"
                      name="Greymantle, Ottoline"
                      umrn="UM100095"
                      detail="Moodjar · Mallard, Jodie"
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
                      detail="+2 more · Doyle, Marcus · ends 9 Nov"
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
                      detail="+1 more · Mallard, Jodie"
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
                {log.map(([when, what, detail], i) => (
                  <li key={`${i}-${when}-${what}`}>
                    <span className={`${t.mono} ${t.logT}`}>{when}</span>
                    <span className={t.person}>
                      <span className={t.logA}>{what}</span>
                      <span className={t.sub}>{day(detail)}</span>
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
                  { id: "ref", label: "Referrals", count: teamReferralsToAnswer(decisions) },
                  { id: "adm", label: "Admitted", count: ADMITTED_THIS_WEEK.length },
                  { id: "dis", label: "Leaving", count: 4 },
                ]}
              />
            </div>
            <div className={`${home.flowBody} ${t.flowBody}`}>
              {flow === "ref" ? (
                <>
                  <FlowGroup title="Awaiting your answer">
                    {open.map(({ r }) => (
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
                        detail={`${client?.where ?? ""} · ${client?.cm ? staffName(client.cm) : "no case manager"}`}
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
              {/* A15-16 and A15-18 (13 Nov 2026): intake line, mailbox and suburb come from the generated
                  reference record, never typed here. */}
              {MIDLAND_CONTACT?.publishedPhone ? (
                <div>
                  <dt>Intake</dt>
                  <dd>
                    <span className={t.mono}>{MIDLAND_CONTACT.publishedPhone}</span>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>Duty officer</dt>
                <dd>
                  Byrne, Tom · <span className={t.mono}>ext 4105</span>
                </dd>
              </div>
              <div>
                <dt>After hours</dt>
                <dd>Mental Health Emergency Response Line</dd>
              </div>
              {MIDLAND_CONTACT?.referralEmail ? (
                <div>
                  <dt>Referrals</dt>
                  <dd>{MIDLAND_CONTACT.referralEmail}</dd>
                </div>
              ) : null}
              {MIDLAND_CONTACT?.suburb ? (
                <div>
                  <dt>Suburb</dt>
                  <dd>{MIDLAND_CONTACT.suburb}</dd>
                </div>
              ) : null}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

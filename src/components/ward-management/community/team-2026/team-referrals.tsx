"use client";

/*
 * Referrals (locked design, design/community-team-2026-11, screenshots tab-referrals.png,
 * referral-page-light.png, referral-page-dark.png and referral-document-viewer.png): the queue with
 * To answer, Sent by team and Answered; the side panel for the chosen referral; and the full
 * referral page, modelled on the ward Answer page. Midland demo data, ported from the mock-up
 * (Q126, Q132). The team accepts as itself (Q125). Demo answers stay on this page and are not saved.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  History,
  Inbox,
  Phone,
  Pill,
  Send,
  ShieldCheck,
  Users,
  ChevronDown,
} from "lucide-react";
import {
  Button,
  Card,
  CardHead,
  Count,
  Dialog,
  Segmented,
  SrOnly,
  StatusGlyph,
  useOptionalToast,
} from "@/components/wf";
import home from "@/components/ward-management/ward/ward-home-tab.module.css";
import { ANSWERED, EXTRA, REFERRALS, SENT, STAFF, type DemoReferral } from "./midland-demo";
import { Person, Tag, initialsOf } from "./parts";
import wt from "@/components/ward-management/ward-table/ward-table.module.css";
import t from "./team-2026.module.css";

const fromKind = (r: DemoReferral) =>
  r.from === "GP" ? "General practice" : r.from === "ED" ? "Emergency department" : "Inpatient ward";

function TimeCard({ r }: { r: DemoReferral }) {
  return (
    <div className={`${t.timeCard}${r.over ? ` ${t.timeOver}` : ""}`}>
      <div className={t.tcTop}>
        <span>
          <b className={t.mono}>{r.since}</b> waiting
        </span>
        <span className={t.tcLeft}>
          {r.over ? (
            <>
              <StatusGlyph tone="warning" size={12} />
              <b>{r.over}</b>
            </>
          ) : (
            <>
              <b className={t.mono}>{(r.due ?? "").replace("Due in ", "")}</b> left
            </>
          )}
        </span>
      </div>
      <span className={t.tcBar} aria-hidden="true">
        <i style={{ width: `${r.pct}%` }} />
      </span>
      <div className={t.tcFoot}>
        <span>Received {r.received}</span>
        <span>Answer by {r.dueAt}</span>
      </div>
    </div>
  );
}

/** Accept turns the actions into one success line with Undo (the mock-up's behaviour). */
function useAnswer(name: string) {
  const toast = useOptionalToast();
  const [accepted, setAccepted] = useState<string | null>(null);
  const accept = (line: string) => {
    setAccepted(line);
    toast?.push({
      tone: "success",
      title: `Accepted ${name}`,
      body: "Demo data · not saved",
      action: { label: "Undo", onAction: () => setAccepted(null) },
    });
  };
  const say = (title: string) => toast?.push({ tone: "info", title });
  return { accepted, accept, undo: () => setAccepted(null), say };
}

function Done({ line, undo }: { line: string; undo: () => void }) {
  return (
    <div className={t.done} role="status">
      <StatusGlyph tone="success" size={12} />
      <span>{line}</span>
      <Button variant="ghost" size="sm" onClick={undo}>
        Undo
      </Button>
    </div>
  );
}

const ROOM = STAFF.filter((s) => s.load && s.today !== "leave");

function SidePanel({ r, openPage }: { r: DemoReferral; openPage: () => void }) {
  const [cm, setCm] = useState("");
  const { accepted, accept, undo, say } = useAnswer(r.n);
  return (
    <div className={t.detail}>
      <div className={t.dHead}>
        <span className={t.bigAv}>{initialsOf(r.n)}</span>
        <div className={t.person}>
          <span className={t.dName}>{r.n}</span>
          <span className={t.sub}>
            <span className={t.mono}>{r.u}</span> · {r.a}
          </span>
        </div>
        <Tag tone={r.urgency.startsWith("Urgent") ? "warning" : "neutral"} glyph={false}>
          {r.urgency.split(",")[0]}
        </Tag>
      </div>
      <TimeCard r={r} />
      <div className={t.facts}>
        <div>
          <span>From</span>
          <b>{r.fromD}</b>
          <em>{fromKind(r)}</em>
        </div>
        <div>
          <span>Asking for</span>
          <b>{r.ask}</b>
          <em>{r.urgency}</em>
        </div>
        <div>
          <span>Lives in</span>
          <b>{r.lives}</b>
          <em className={t.ok}>
            <StatusGlyph tone="success" size={12} />
            {r.catch}
          </em>
        </div>
        <div>
          <span>Needs</span>
          <b>{r.needs === "—" ? "Nothing extra" : r.needs}</b>
          <em>{r.legal}</em>
        </div>
      </div>
      <p className={t.dWhy}>{r.why}</p>
      <button type="button" className={t.docsLink} onClick={openPage}>
        <FileText size={16} aria-hidden="true" />
        <span>
          <b>Full referral</b> · handover, {r.docs.length} documents, contacts and timeline
        </span>
        <ChevronRight size={14} aria-hidden="true" />
      </button>
      {accepted ? (
        <Done line={accepted} undo={undo} />
      ) : (
        <>
          <label className={t.field}>
            <span>Case manager</span>
            <span className={t.select}>
              <select className={t.ctl} value={cm} onChange={(event) => setCm(event.target.value)}>
                <option value="">Allocate later</option>
                {ROOM.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} · {s.load} of {s.cap}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </span>
          </label>
          <div className={t.dActions}>
            <Button
              variant="pri"
              icon={Check}
              className={t.accept}
              onClick={() => accept(cm ? `Accepted. Case manager: ${cm}` : "Accepted, not allocated yet")}
            >
              Accept for Midland
            </Button>
            <Button onClick={() => say("Decline opens a reason list and where to send the person")}>Decline</Button>
          </div>
        </>
      )}
    </div>
  );
}

function DocViewer({ doc, onClose }: { doc: { name: string; meta: string; who: string } | null; onClose: () => void }) {
  const widths = [92, 100, 84, 96, 70, 0, 100, 88, 94, 60, 0, 98, 90, 76, 100, 52];
  return (
    <Dialog
      open={doc !== null}
      onClose={onClose}
      title={doc?.name ?? "Document"}
      description={doc ? `${doc.who} · PDF · ${doc.meta}` : undefined}
      size="lg"
      secondary={[{ label: "Download", onAction: () => undefined }]}
    >
      <div className={t.dvBody}>
        <div className={t.paper}>
          <h3>{doc?.name}</h3>
          <p>
            {doc?.who} · {doc?.meta}
          </p>
          {widths.map((w, index) =>
            w ? (
              <i key={index} style={{ width: `${w}%` }} />
            ) : (
              <i key={index} style={{ height: 0, margin: "0 0 22px" }} />
            ),
          )}
          <div className={t.wm}>SAMPLE · NOT A REAL RECORD</div>
        </div>
      </div>
    </Dialog>
  );
}

function Section({
  icon,
  title,
  aside,
  children,
  className,
}: {
  icon: Parameters<typeof CardHead>[0]["icon"];
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`${home.v6Card} ${className ?? ""}`}>
      <CardHead icon={icon} title={title} aside={aside} />
      {children}
    </Card>
  );
}

function ReferralPage({ index, go, back }: { index: number; go: (index: number) => void; back: () => void }) {
  const r = REFERRALS[index]!;
  const x = EXTRA[r.id]!;
  const n = REFERRALS.length;
  const prev = REFERRALS[index - 1];
  const next = REFERRALS[index + 1];
  const nameRef = useRef<HTMLHeadingElement>(null);
  const defaultPick = r.id === "r3" ? 2 : 0;
  const [pick, setPick] = useState<string>(
    x.picks[defaultPick]?.[3] !== undefined && x.picks[defaultPick]![3] < 1 ? x.picks[defaultPick]![0] : x.later,
  );
  const [first, setFirst] = useState(r.firstContact);
  const [doc, setDoc] = useState<{ name: string; meta: string; who: string } | null>(null);
  const { accepted, accept, undo, say } = useAnswer(r.n);
  const passN = r.checks.filter((c) => c[0] === "pass").length;
  const firstName = r.n.split(", ")[1] ?? r.n;
  const referrer = (r.contacts[0]?.[1] ?? "").replace(/^(\w+), (Dr )?(\w+)$/, "$2$3 $1");
  const people = [...x.people.slice(0, 1), ...r.contacts.slice(1), r.contacts[0]!, ...x.people.slice(1)];
  useEffect(() => {
    nameRef.current?.focus({ preventScroll: true });
  }, [index]);
  return (
    <div className={t.refPage}>
      <div className={t.rpBar}>
        <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={back}>
          Referrals
        </Button>
        <span className={t.rpSep} aria-hidden="true">
          /
        </span>
        <span className={t.rpCrumb}>{r.n}</span>
        <span className={t.rpNav} aria-label="Move between referrals">
          <span className={t.rpPos}>
            <b>{index + 1}</b> of {n} to answer
          </span>
          <Button
            size="sm"
            icon={ChevronLeft}
            className={t.icoBtn}
            disabled={!prev}
            aria-label={prev ? `Previous referral, ${prev.n}` : "Previous referral"}
            onClick={() => go(index - 1)}
          />
          <Button
            size="sm"
            icon={ChevronRight}
            className={t.icoBtn}
            disabled={!next}
            aria-label={next ? `Next referral, ${next.n}` : "Next referral"}
            onClick={() => go(index + 1)}
          />
        </span>
      </div>

      <Card className={`${home.v6Card} ${t.rpHead}`}>
        <div className={t.rpWho}>
          <span className={`${t.bigAv} ${t.av48}`}>{initialsOf(r.n)}</span>
          <div className={t.person}>
            <h2 className={t.rpName} tabIndex={-1} ref={nameRef}>
              {r.n} <span className={t.mono}>{r.u}</span>
            </h2>
            <span className={t.sub}>
              {r.a} · {r.lives}, {r.catch.toLowerCase()} · {r.known}
            </span>
          </div>
          <span className={t.rpTags}>
            <Tag tone={r.urgency.startsWith("Urgent") ? "warning" : "neutral"} glyph={r.urgency.startsWith("Urgent")}>
              {r.urgency}
            </Tag>
            <Tag tone="neutral" glyph={false}>
              {r.legal}
            </Tag>
          </span>
        </div>
        <dl className={t.rpStrip}>
          <div>
            <dt>Asking for</dt>
            <dd>{r.ask}</dd>
          </div>
          <div>
            <dt>From</dt>
            <dd>{r.fromD}</dd>
            <dd className={t.sub}>{r.from === "GP" ? "GP" : fromKind(r)}</dd>
          </div>
          <div>
            <dt>Interpreter</dt>
            <dd>{r.interp}</dd>
          </div>
          <div>
            <dt>Transport</dt>
            <dd>{r.needs === "Transport" ? "Needed" : "Not needed"}</dd>
            {r.needs === "Transport" ? <dd className={t.sub}>Does not drive</dd> : null}
          </div>
          <div>
            <dt>First contact asked</dt>
            <dd>{r.firstContact}</dd>
          </div>
        </dl>
      </Card>

      <div className={t.rpGrid}>
        <div className={t.col}>
          <Section
            icon={Inbox}
            title="Handover"
            aside={
              <span className={t.meta}>
                {r.contacts[0]?.[1]} · {r.received}
              </span>
            }
          >
            <dl className={t.isbar}>
              {r.isbar.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <div className={t.two}>
            <Section icon={ShieldCheck} title="Risk summary" aside={<span className={t.meta}>{x.riskBy}</span>}>
              <ul className={t.kv}>
                {x.risk.map(([k, level, note]) => (
                  <li key={k}>
                    <span className={t.kvK}>{k}</span>
                    <span className={t.kvV}>
                      {level === "Low" ? (
                        <span className={t.lvl}>{level}</span>
                      ) : (
                        <Tag tone="warning" glyph={false}>
                          {level}
                        </Tag>
                      )}
                      <span className={t.sub}>{note}</span>
                    </span>
                  </li>
                ))}
                <li>
                  <span className={t.kvK}>Safety</span>
                  <span className={t.kvV}>
                    <span className={t.kvT}>{x.safety}</span>
                  </span>
                </li>
              </ul>
            </Section>
            <Section icon={Pill} title="Treatment and health">
              <ul className={t.kv}>
                {x.treat.map(([k, v, s]) => (
                  <li key={k}>
                    <span className={t.kvK}>{k}</span>
                    <span className={t.kvV}>
                      <span className={t.kvT}>{v}</span>
                      {s ? <span className={t.sub}>{s}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          </div>

          <Section
            icon={FileText}
            title={
              <>
                Documents <Count n={r.docs.length} />
              </>
            }
            aside={
              <Button
                variant="ghost"
                size="sm"
                icon={Send}
                onClick={() => say("Ask for more opens a message to the referrer")}
              >
                Ask for more
              </Button>
            }
          >
            <ul className={t.docs}>
              {r.docs.map(([name, meta]) => (
                <li key={name}>
                  <span className={t.docIc}>
                    <FileText size={16} aria-hidden="true" />
                  </span>
                  <span className={t.person}>
                    <span className={t.docName}>{name}</span>
                    <span className={t.sub}>PDF · {meta}</span>
                  </span>
                  <Button size="sm" onClick={() => setDoc({ name: name!, meta: meta!, who: r.n })}>
                    View<SrOnly> {name}</SrOnly>
                  </Button>
                </li>
              ))}
            </ul>
          </Section>

          <Section icon={Users} title="People">
            <ul className={t.people}>
              {people.map(([role, name, sub, phone]) => (
                <li key={`${role}-${name}`}>
                  <span className={`${t.bigAv} ${t.avSm}`}>{initialsOf(name!)}</span>
                  <span className={t.person}>
                    <span className={t.docName}>{name}</span>
                    <span className={t.sub}>
                      {role} · {sub}
                    </span>
                  </span>
                  <span className={`${t.mono} ${t.ph}`}>{phone}</span>
                  <Button variant="ghost" size="sm" icon={Phone} className={t.icoBtn} aria-label={`Call ${name}`} />
                </li>
              ))}
            </ul>
          </Section>

          <Section icon={History} title="With this team before">
            {x.hist ? (
              <div className={t.hist}>
                <div>
                  <span className={`${t.histY} ${t.mono}`}>{x.hist.years}</span>
                  <span className={t.kvT}>{x.hist.what}</span>
                </div>
                <div className={t.histCm}>
                  <span className={t.av}>{initialsOf(x.hist.cm)}</span>
                  <span className={t.person}>
                    <span className={t.docName}>Case manager {x.hist.cm}</span>
                    <span className={t.sub}>{x.hist.cmNow}</span>
                  </span>
                </div>
              </div>
            ) : (
              <p className={`${t.hist} ${t.kvT}`}>New to mental health services. No earlier record found.</p>
            )}
          </Section>
        </div>

        <div className={t.col}>
          <Section
            icon={Check}
            title="Answer"
            className={t.rpDecide}
            aside={
              <span className={t.passChip}>
                <StatusGlyph tone="success" size={12} />
                {passN} checks pass
              </span>
            }
          >
            <div className={t.rpTime}>
              <TimeCard r={r} />
            </div>
            <ul className={t.checks}>
              {r.checks.map(([kind, title, detail]) => (
                <li key={title} data-k={kind}>
                  {kind === "pass" ? (
                    <span className={t.ckOk}>
                      <Check size={14} aria-hidden="true" />
                    </span>
                  ) : (
                    <span className={t.ckInfo} aria-hidden="true">
                      i
                    </span>
                  )}
                  <span className={t.person}>
                    <span className={t.ckT}>{title}</span>
                    <span className={t.sub}>{detail}</span>
                  </span>
                  {title === "Interpreter" ? (
                    <Button size="sm" onClick={() => say("Book an interpreter opens the interpreter booking")}>
                      Book
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className={t.decide}>
              {accepted ? (
                <Done line={accepted} undo={undo} />
              ) : (
                <>
                  <fieldset className={t.picks}>
                    <legend>{x.pickLabel}</legend>
                    {x.picks.map(([name, sub, flag, load]) => (
                      <label key={name} className={`${t.pick}${load >= 1 ? ` ${t.pickFull}` : ""}`}>
                        <input
                          type="radio"
                          name={`pick-${r.id}`}
                          value={name}
                          checked={pick === name}
                          onChange={() => setPick(name)}
                        />
                        <span className={t.person}>
                          <span className={t.pickN}>{name}</span>
                          <span className={t.sub}>{sub}</span>
                        </span>
                        {flag ? <span className={t.pickFlag}>{flag}</span> : null}
                      </label>
                    ))}
                    <label className={`${t.pick} ${t.pickLater}`}>
                      <input
                        type="radio"
                        aria-label={x.later}
                        name={`pick-${r.id}`}
                        value={x.later}
                        checked={pick === x.later}
                        onChange={() => setPick(x.later)}
                      />
                      <span className={t.person}>
                        <span className={t.pickN}>{x.later}</span>
                        <span className={t.sub}>Team leader allocates at Tuesday intake</span>
                      </span>
                    </label>
                  </fieldset>
                  <label className={t.field}>
                    <span>First contact</span>
                    <span className={t.select}>
                      <select className={t.ctl} value={first} onChange={(event) => setFirst(event.target.value)}>
                        {["Within 72 hours", "Within 7 days", "Within 14 days", "Before discharge"].map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} aria-hidden="true" />
                    </span>
                  </label>
                  <div className={t.dActions}>
                    <Button
                      variant="pri"
                      icon={Check}
                      className={t.accept}
                      onClick={() =>
                        accept(
                          /later/i.test(pick) ? "Accepted, not allocated yet" : `Accepted. ${x.pickLabel}: ${pick}`,
                        )
                      }
                    >
                      Accept for Midland
                    </Button>
                    <div className={t.dRow}>
                      <Button icon={Send} onClick={() => say("Ask for more opens a message to the referrer")}>
                        Ask for more
                      </Button>
                      <Button onClick={() => say("Decline opens a reason list and where to send the person")}>
                        Decline
                      </Button>
                    </div>
                  </div>
                  <p className={`${t.small} ${t.after}`}>
                    Accepting tells {referrer} and adds {firstName} to the caseload.
                  </p>
                </>
              )}
            </div>
          </Section>

          <Section icon={Clock} title="Timeline">
            <form
              className={t.note}
              onSubmit={(event) => {
                event.preventDefault();
                say("Note added for the team (demo data, not saved)");
              }}
            >
              <input className={t.ctl} placeholder="Add a note for the team" aria-label="Add a note for the team" />
              <Button type="submit" size="sm">
                Add
              </Button>
            </form>
            <ol className={t.tl}>
              {r.timeline.map(([when, what, who]) => (
                <li key={`${when}-${what}`}>
                  <span className={t.tlDot} />
                  <span className={t.person}>
                    <span className={t.tlA}>{what}</span>
                    <span className={t.sub}>
                      {when}
                      {who ? ` · ${who}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
      <DocViewer doc={doc} onClose={() => setDoc(null)} />
    </div>
  );
}

export function TeamReferrals() {
  const [pane, setPane] = useState<"q" | "s" | "h">("q");
  const [selected, setSelected] = useState(0);
  const [page, setPage] = useState<number | null>(null);
  const backRef = useRef<HTMLDivElement>(null);
  if (page !== null) {
    return (
      <ReferralPage
        index={page}
        go={setPage}
        back={() => {
          setPage(null);
          requestAnimationFrame(() =>
            backRef.current?.querySelector<HTMLElement>(`[data-ref="${REFERRALS[page]!.id}"]`)?.focus(),
          );
        }}
      />
    );
  }
  const chosen = REFERRALS[selected]!;
  return (
    <div className={t.refGrid} ref={backRef}>
      <Card className={home.v6Card}>
        <CardHead
          icon={Inbox}
          title="Referrals"
          aside={
            <Segmented
              label="Referrals"
              size="sm"
              value={pane}
              onChange={setPane}
              items={[
                { id: "q", label: "To answer", count: REFERRALS.length },
                { id: "s", label: "Sent by team", count: SENT.length },
                { id: "h", label: "Answered", count: 14 },
              ]}
            />
          }
        />
        {pane === "q" ? (
          <>
            <div className={`${wt.tableScroll} ${t.tableWrap}`}>
              <table className={`${wt.table} ${t.table} ${t.refTable}`}>
                <thead>
                  <tr>
                    <th scope="col">Client</th>
                    <th scope="col">Since referral</th>
                    <th scope="col">From</th>
                    <th scope="col">Asking for</th>
                    <th scope="col">
                      <SrOnly>Action</SrOnly>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {REFERRALS.map((r, index) => (
                    <tr
                      key={r.id}
                      className={`${t.refRow}${index === selected ? ` ${t.sel}` : ""}`}
                      onClick={() => setSelected(index)}
                    >
                      <td>
                        <button
                          type="button"
                          className={t.rowPick}
                          aria-pressed={index === selected}
                          onClick={() => setSelected(index)}
                        >
                          <Person name={r.n} umrn={r.u} sub={r.a} />
                        </button>
                      </td>
                      <td>
                        <span className={`${t.mono} ${t.strong}`}>{r.since}</span>
                        <span className={t.sub}>
                          {r.over ? (
                            <span className={t.overTxt}>
                              <StatusGlyph tone="warning" size={12} />
                              {r.over}
                            </span>
                          ) : (
                            r.due
                          )}
                        </span>
                      </td>
                      <td>
                        <span>{r.fromD}</span>
                        <span className={t.sub}>
                          {r.from === "GP" ? "GP" : fromKind(r)} · {r.lives}
                        </span>
                      </td>
                      <td>
                        <span>{r.ask}</span>
                        {r.needs === "—" ? null : (
                          <span className={t.sub}>Needs {r.needs.toLowerCase().replace("dari", "Dari")}</span>
                        )}
                      </td>
                      <td className={t.actCell}>
                        <Button size="sm" data-ref={r.id} onClick={() => setPage(index)}>
                          Open<SrOnly> full referral for {r.n}</SrOnly>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={t.tableFoot}>
              <span className={t.shown}>Answer within 3 days · oldest first</span>
            </div>
          </>
        ) : pane === "s" ? (
          <div className={`${wt.tableScroll} ${t.tableWrap}`}>
            <table className={`${wt.table} ${t.table}`}>
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Sent to</th>
                  <th scope="col">Answer</th>
                  <th scope="col">Sent</th>
                  <th scope="col">
                    <SrOnly>Action</SrOnly>
                  </th>
                </tr>
              </thead>
              <tbody>
                {SENT.map((s) => (
                  <tr key={s.u}>
                    <td>
                      <Person name={s.n} umrn={s.u} />
                    </td>
                    <td>{s.to}</td>
                    <td>
                      <Tag tone={s.state === "Accepted" ? "success" : "neutral"}>{s.state}</Tag>
                    </td>
                    <td>{s.when}</td>
                    <td className={t.actCell}>
                      <Button size="sm">
                        Open<SrOnly> {s.n}</SrOnly>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className={`${wt.tableScroll} ${t.tableWrap}`}>
              <table className={`${wt.table} ${t.table}`}>
                <thead>
                  <tr>
                    <th scope="col">Client</th>
                    <th scope="col">Asked for</th>
                    <th scope="col">Answer</th>
                    <th scope="col">Allocated to</th>
                    <th scope="col">By</th>
                  </tr>
                </thead>
                <tbody>
                  {ANSWERED.map((s) => (
                    <tr key={s.u}>
                      <td>
                        <Person name={s.n} umrn={s.u} />
                      </td>
                      <td>{s.ask}</td>
                      <td>
                        <Tag tone={s.ans === "Accepted" ? "success" : "neutral"}>{s.ans}</Tag>
                      </td>
                      <td>{s.to}</td>
                      <td>
                        {s.by} · {s.when}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={t.tableFoot}>
              <span className={t.shown}>Showing {ANSWERED.length} of 14 this month</span>
            </div>
          </>
        )}
      </Card>
      <Card className={`${home.v6Card} ${t.detailCard}`} aria-label={`Referral for ${chosen.n}`}>
        <SidePanel key={chosen.id} r={chosen} openPage={() => setPage(selected)} />
      </Card>
    </div>
  );
}

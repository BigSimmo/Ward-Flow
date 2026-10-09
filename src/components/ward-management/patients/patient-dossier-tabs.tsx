"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Clipboard,
  FileText,
  History,
  IdCard,
  List,
  MapPin,
  Phone,
  Scale,
  Search,
  Users,
  Wrench,
} from "lucide-react";
import { Button, Card, CardHead, StatusGlyph, cx, tableClasses, type WfTone } from "@/components/wf";
import type { Movement } from "../ward-model";
import type { Patient } from "../ward-patients";
import { edById } from "../ward-sites";
import { calendarDateOf } from "../ward-clock";
import { legalFormName } from "../ward-legal-forms";
import { LegalLimitsNotChecked } from "../legal-limits-not-checked";
import { clock, STAGES, type PatientNowRecord } from "./patient-now-records";
import legacy from "./patient-dossier-tabs.module.css";
import styles from "./patient-record-tabs.module.css";

/**
 * The record tabs, rebuilt to the gate board mockup (9 Oct 2026). Now holds the present; History,
 * Community, Details and Documents hold everything else. Every value comes from the record: a
 * field the record cannot hold yet is a dashed Preview card that says so, never a guess.
 */

function CopyFact({ value, label }: { value: string; label: string }) {
  const [message, setMessage] = useState("");
  return (
    <span className={styles.copy}>
      <Button
        size="sm"
        icon={Clipboard}
        onClick={async () => {
          try {
            if (!navigator.clipboard) throw new Error("Clipboard unavailable");
            await navigator.clipboard.writeText(value);
            setMessage("Copied to clipboard");
          } catch {
            setMessage("Clipboard is unavailable in this browser");
          }
        }}
      >
        {label}
      </Button>
      <span role="status">{message}</span>
    </span>
  );
}

function dayLabel(instant: number, dayZero: Date): string {
  return calendarDateOf(instant, dayZero).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "Australia/Perth",
  });
}

type LogEvent = { at: number; tone: WfTone; text: string };

/** The open episode's recorded events, newest first. Nothing is inferred between them. */
function movementEvents(movement: Movement, unitName: (id: string) => string | undefined): LogEvent[] {
  const events: LogEvent[] = [
    {
      at: movement.openedAt,
      tone: "neutral",
      text: `Opened at ${edById(movement.originEdId)?.name ?? "an origin not recorded"}`,
    },
  ];
  if (movement.examination)
    events.push({ at: movement.examination.at, tone: "success", text: "Psychiatric examination recorded" });
  const formAt = movement.legalFormReceivedAt ?? movement.formedAt;
  if (movement.legalForm && formAt !== undefined)
    events.push({ at: formAt, tone: "success", text: `Form ${movement.legalForm.code} recorded` });
  // No ward count: `referredUnitIds` shrinks as wards answer, so it cannot say how many were asked then.
  if (movement.referredAt !== undefined)
    events.push({ at: movement.referredAt, tone: "info", text: "Referred for a bed" });
  for (const decline of movement.declines)
    events.push({ at: decline.at, tone: "closed", text: `Declined, ${unitName(decline.unitId) ?? decline.unitId}` });
  if (movement.escalation)
    events.push({
      at: movement.escalation.at,
      tone: "info",
      text: `Escalated after ${movement.escalation.triedUnitIds.length} wards tried`,
    });
  if (movement.acceptedAt !== undefined && movement.acceptedUnitId)
    events.push({
      at: movement.acceptedAt,
      tone: "success",
      text: `Accepted for ${unitName(movement.acceptedUnitId) ?? movement.acceptedUnitId}`,
    });
  if (movement.medicalClearance)
    events.push({
      at: movement.medicalClearance.at,
      tone: movement.medicalClearance.cleared ? "success" : "danger",
      text: movement.medicalClearance.cleared ? "Cleared fit to travel" : "Not cleared to travel",
    });
  for (const change of movement.stageChanges)
    events.push({
      at: change.at,
      tone: "info",
      text: `${STAGES.find((s) => s.id === change.to)?.label ?? change.to}, by ${change.by}`,
    });
  const job = movement.transport;
  if (job?.acceptedAt !== undefined) events.push({ at: job.acceptedAt, tone: "info", text: "Transport accepted" });
  if (job?.enRouteAt !== undefined) events.push({ at: job.enRouteAt, tone: "info", text: "Transport en route" });
  if (job?.collectedAt !== undefined) events.push({ at: job.collectedAt, tone: "info", text: "Collected" });
  if (job?.arrivedAt !== undefined) events.push({ at: job.arrivedAt, tone: "success", text: "Arrived" });
  if (movement.closure)
    events.push({
      at: movement.closure.at,
      tone: movement.closure.outcome === "arrived" ? "success" : "closed",
      text: movement.closure.outcome === "arrived" ? "Closed on arrival" : "Closed, did not proceed",
    });
  return events.sort((a, b) => b.at - a.at);
}

export function PatientHistoryTab({
  record,
  movement,
  dayZero,
  unitName,
  open,
  onBackToNow,
}: {
  record: PatientNowRecord;
  movement?: Movement;
  dayZero: Date;
  unitName: (id: string) => string | undefined;
  /** True while something is open now, so the log offers Back to Now rather than Overview. */
  open: boolean;
  onBackToNow: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "emergency" | "inpatient">("all");
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState(true);
  const items = record.presentations
    .filter((p) => {
      const emergency =
        !!p.current ||
        p.where.includes("ED") ||
        p.where.includes("Emergency") ||
        p.los.includes("h") ||
        p.to.toLowerCase().includes("discharged from ed");
      return (
        (filter === "all" || (filter === "emergency" ? emergency : !emergency)) &&
        `${p.date} ${p.where} ${p.to} ${p.outcome} ${p.story ?? ""}`.toLowerCase().includes(query.toLowerCase().trim())
      );
    })
    .slice()
    .sort((a, b) => (recent ? b.year - a.year : a.year - b.year));
  const prior = record.presentations.filter((p) => !p.current);
  // Each event carries its day heading only when the day changes, worked out before render.
  const events = (movement ? movementEvents(movement, unitName) : []).map((event, i, list) => {
    const day = dayLabel(event.at, dayZero);
    const previous = i > 0 ? dayLabel(list[i - 1]!.at, dayZero) : undefined;
    return { ...event, heading: day !== previous ? day : null };
  });
  return (
    <section className={styles.pane} aria-label="Presentation history" data-layout="history">
      {/* The pattern first: counts the record holds, never an estimate. */}
      <Card>
        <div className={styles.cells}>
          <div className={styles.cell}>
            <span className={styles.cellLabel}>
              <History size={14} aria-hidden="true" />
              Presentations
            </span>
            <span className={styles.cellValue}>
              {record.presentations.length}
              {record.presentations.length > 0 ? (
                <span className={legacy.tag} data-testid="pn-history-example-label">
                  Example history
                </span>
              ) : null}
            </span>
            <span className={styles.cellSub}>Linked to this record</span>
          </div>
          <div className={styles.cell}>
            <span className={styles.cellLabel}>
              <CalendarDays size={14} aria-hidden="true" />
              Earlier presentations
            </span>
            <span className={styles.cellValue}>{prior.length}</span>
            <span className={styles.cellSub}>
              {prior.length === 0 ? "None earlier in this record" : "Closed, read only"}
            </span>
          </div>
          <div className={styles.cell}>
            <span className={styles.cellLabel}>
              <List size={14} aria-hidden="true" />
              Recorded events
            </span>
            <span className={styles.cellValue}>{events.length}</span>
            <span className={styles.cellSub}>
              {movement ? `${movement.stageChanges.length} stage changes` : "No linked movement"}
            </span>
          </div>
        </div>
      </Card>
      <div className={styles.cols}>
        <Card>
          <CardHead level={3} icon={List} title="Episodes" meta={`${items.length} shown`} />
          <div className={styles.bodyPad}>
            <div className={legacy.toolbar}>
              <label className={legacy.search}>
                <Search size={16} aria-hidden="true" />
                <input
                  aria-label="Search presentation history"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search place, outcome or episode"
                />
              </label>
              <Button size="sm" onClick={() => setRecent(!recent)}>
                {recent ? "Newest first" : "Oldest first"}
              </Button>
            </div>
            <div className={cx(legacy.filters, styles.filterRow)} role="group" aria-label="History filter">
              {(
                [
                  ["all", `All (${record.presentations.length})`],
                  ["emergency", "Emergency"],
                  ["inpatient", "Inpatient"],
                ] as const
              ).map(([key, label]) => (
                <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>
                  {label}
                </button>
              ))}
              <span role="status">{items.length} synthetic records shown</span>
            </div>
            <div className={legacy.episodes}>
              {items.map((p, i) => (
                <details
                  className={legacy.episode}
                  key={`${p.date}-${p.where}-${i}`}
                  open={p.current ? true : undefined}
                >
                  <summary>
                    <span className={legacy.episodeMark}>
                      <History size={18} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{p.date}</strong>
                      <small>{p.where}</small>
                    </span>
                    <span className={legacy.tag}>{p.current ? "Open now" : p.los}</span>
                  </summary>
                  <div className={legacy.episodeBody}>
                    <div className={legacy.route}>
                      <MapPin size={15} aria-hidden="true" />
                      <strong>{p.where}</strong>
                      <ArrowUpRight size={16} aria-hidden="true" />
                      <span>{p.to}</span>
                    </div>
                    <p>{p.outcome}</p>
                    {p.story && <p className={legacy.muted}>{p.story}</p>}
                    <dl className={legacy.facts}>
                      <dt>Duration</dt>
                      <dd>{p.losFull}</dd>
                      <dt>Legal authority</dt>
                      <dd>{p.legal}</dd>
                      <dt>Community team</dt>
                      <dd>{p.team}</dd>
                    </dl>
                    {p.asked.length > 0 && (
                      <details className={legacy.innerDetails}>
                        <summary>Ward responses, {p.asked.length}</summary>
                        {p.asked.map((a, j) => (
                          <p key={j}>
                            <strong>{a.ward}</strong>, {a.outcome}
                            {a.why ? `, ${a.why}` : ""}
                          </p>
                        ))}
                      </details>
                    )}
                  </div>
                </details>
              ))}
              {items.length === 0 && (
                <div className={legacy.empty}>
                  <History size={24} aria-hidden="true" />
                  <strong>
                    {query || filter !== "all" ? "No matching presentations" : "No presentation history available"}
                  </strong>
                  <p>
                    {query || filter !== "all"
                      ? "Change the search or filter to review other episodes."
                      : (record.presentationsAbsent ?? "Earlier clinical history is not recorded here.")}
                  </p>
                </div>
              )}
              {prior.length === 0 && items.length > 0 && (
                <p className={legacy.note}>No earlier presentation history is available in this record.</p>
              )}
            </div>
          </div>
        </Card>
        <Card aria-label="Journey event log">
          <CardHead
            level={3}
            icon={History}
            title="This presentation"
            aside={movement ? <span className={styles.chip}>{open ? "Open" : "Closed"}</span> : null}
            action={
              <Button size="sm" variant="ghost" onClick={onBackToNow}>
                {open ? "Back to Now" : "Back to Overview"}
              </Button>
            }
          />
          {movement ? (
            <ol className={styles.log}>
              {events.map((event, i) => {
                return (
                  <li key={i}>
                    {event.heading ? <div className={styles.day}>{event.heading}</div> : null}
                    <div className={styles.event}>
                      <time>{clock(event.at)}</time>
                      <StatusGlyph tone={event.tone} size={10} />
                      <span>{event.text}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className={cx(styles.bodyPad, legacy.muted)}>
              No linked movement events. Patient information remains available in Details.
            </p>
          )}
          <p className={cx(styles.bodyPad, legacy.note)}>
            Events are the ones recorded. Missing transitions are not inferred.
          </p>
        </Card>
      </div>
    </section>
  );
}

function Row({ k, children, action }: { k: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.k}>{k}</span>
      <span className={styles.v}>{children}</span>
      {action ?? <span />}
    </div>
  );
}

export function PatientCommunityTab({
  record,
  patient,
  movement,
  receivingWardName,
  stayOpen,
  onRecordCto,
  onEndCto,
}: {
  record: PatientNowRecord;
  patient?: Patient;
  movement?: Movement;
  receivingWardName?: string;
  /** True while a placement or stay is open, so community review is paused. */
  stayOpen: boolean;
  onRecordCto: () => void;
  onEndCto: () => void;
}) {
  const summary = `GP: ${patient?.generalPractitioner ?? "Not recorded"}\nCatchment: ${patient?.catchmentCommunityTeam ?? "Not recorded"}\nFollow-up: ${record.community.followUp}`;
  const order = patient?.communityTreatmentOrder;
  const notRecorded = <span className={styles.nr}>Not recorded</span>;
  return (
    <section className={styles.pane} aria-label="Community and care continuity" data-layout="community">
      <div className={styles.cols}>
        <div className={styles.col}>
          <Card aria-label="Recorded care directory">
            <CardHead
              level={3}
              icon={Users}
              title="Care team"
              meta={patient?.suburb ? `Lives in ${patient.suburb}` : undefined}
            />
            <div className={styles.rows}>
              <Row k="Catchment team">{patient?.catchmentCommunityTeam ?? notRecorded}</Row>
              <Row k="GP">{patient?.generalPractitioner ?? notRecorded}</Row>
              <Row k="Suburb">{patient?.suburb ?? notRecorded}</Row>
            </div>
            <p className={cx(styles.bodyPad, legacy.note)}>
              A recorded catchment does not confirm current case management or an active appointment.
            </p>
          </Card>
          <Card className={styles.dashed}>
            <CardHead
              level={3}
              icon={Users}
              title="Family and carers"
              aside={<span className={styles.preview}>Preview, not in the record yet</span>}
            />
            <div className={styles.rows}>
              <Row k="Next of kin">
                <span className={styles.nr}>Needs a record field</span>
              </Row>
              <Row k="Carer">
                <span className={styles.nr}>Needs a record field</span>
              </Row>
              <Row k="Guardian">
                <span className={styles.nr}>Needs a record field</span>
              </Row>
            </div>
          </Card>
        </div>
        <div className={styles.col}>
          <Card>
            <CardHead level={3} icon={CalendarDays} title="Community plan" />
            <div className={styles.rows}>
              <Row k="Follow-up">{record.community.followUp}</Row>
              <Row k="Next review">
                {stayOpen ? (
                  <span className={styles.nr}>Paused while a placement or stay is open</span>
                ) : (
                  <span className={styles.nr}>Not held in this prototype</span>
                )}
              </Row>
              <Row
                k="CTO"
                action={
                  patient ? (
                    order ? (
                      <Button size="sm" onClick={onEndCto}>
                        Record ended
                      </Button>
                    ) : (
                      <Button size="sm" onClick={onRecordCto}>
                        Record CTO
                      </Button>
                    )
                  ) : undefined
                }
              >
                {order ? (
                  <>
                    Form {order.form} in force <small>no lapse time shown</small>
                  </>
                ) : (
                  "None recorded"
                )}
              </Row>
            </div>
            <div className={styles.bodyPad}>
              <strong>Team allocation, {record.community.teams.length} linked</strong>
              {record.community.teams.length > 0 ? (
                <div className={legacy.teamRows}>
                  {record.community.teams.map((t, i) => (
                    <article key={i}>
                      <div>
                        <strong>{t.name}</strong>
                        <span className={legacy.tag}>{t.state}</span>
                      </div>
                      <p>{t.note}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={legacy.muted}>
                  {record.community.absent ?? "No community team allocation is established by this movement record."}
                </p>
              )}
              <CopyFact value={summary} label="Copy care links" />
            </div>
          </Card>
          {movement && (
            <Card>
              <CardHead level={3} icon={Phone} title="Transfer coordination contacts" meta="Service roles" />
              <div className={styles.rows}>
                <Row k="Sending location">{edById(movement.originEdId)?.name ?? notRecorded}</Row>
                <Row k="Receiving ward">
                  {movement.acceptedUnitId ? (receivingWardName ?? "Not recorded") : "Destination under review"}
                </Row>
                <Row k="Movement owner">{movement.owner?.trim() ? movement.owner : notRecorded}</Row>
              </div>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}

type Fact = [string, string | undefined];
export function PatientDetailsTab({
  patient,
  movement,
  displayName,
  preferredName,
}: {
  patient?: Patient;
  movement?: Movement;
  displayName: string;
  preferredName?: string;
}) {
  const [missingOnly, setMissingOnly] = useState(false);
  // Interpreter language and Aboriginal status sit in different groups, never side by side (the
  // placement rule in person-screen.tsx).
  const groups: { title: string; facts: Fact[] }[] = [
    {
      title: "Who",
      facts: [
        ["Name", displayName],
        ["Preferred name", preferredName],
        ["Record number", patient?.umrn],
        ["Date of birth", patient?.dateOfBirth],
        ["Sex", patient?.sex],
        ["Gender", patient?.gender],
      ],
    },
    {
      title: "Where they live",
      facts: [
        ["Address", patient?.address],
        ["Suburb", patient?.suburb],
        ["GP", patient?.generalPractitioner],
        ["Interpreter / preferred language", patient?.interpreterLanguage],
        ["Catchment community team", patient?.catchmentCommunityTeam],
      ],
    },
    {
      title: "Transfer context",
      facts: [
        ["Age band", movement?.cohort],
        ["Placement sex", movement?.sex],
        ["Placement gender", movement?.gender],
        ["Movement legal status", movement?.legalStatus],
        ["Owner", movement?.owner?.trim() || undefined],
      ],
    },
    {
      title: "Recorded identity context",
      facts: [
        ["Patient legal status", patient?.legalStatus],
        ["Aboriginal or Torres Strait Islander status", patient?.aboriginalOrTorresStraitIslanderStatus],
      ],
    },
  ];
  const all = groups.flatMap((g) => g.facts);
  const missing = all.filter(([, v]) => !v).length;
  const mismatch = Boolean(
    movement &&
    patient &&
    ((movement.sex && patient.sex && movement.sex !== patient.sex) ||
      (movement.gender && patient.gender && movement.gender !== patient.gender)),
  );
  return (
    <section className={styles.pane} aria-label="Patient details" data-layout="details">
      <Card>
        <CardHead
          level={3}
          icon={IdCard}
          title="Record details"
          aside={
            <span className={styles.chip}>
              <StatusGlyph tone={missing > 0 ? "neutral" : "success"} size={10} />
              {missing} not recorded
            </span>
          }
        />
        {/* Actions sit under the head so they wrap on a phone rather than run off the card. */}
        <div className={styles.bodyPad}>
          <span className={styles.headActions}>
            <meter
              className={legacy.completeness}
              min={0}
              max={all.length}
              value={all.length - missing}
              aria-label="Recorded patient and placement fields"
            />
            <Button size="sm" aria-pressed={missingOnly} onClick={() => setMissingOnly(!missingOnly)}>
              Missing information
            </Button>
            <CopyFact
              label="Copy patient identifiers"
              value={`${displayName}\nUMRN: ${patient?.umrn ?? "Not recorded"}\nDOB: ${patient?.dateOfBirth ?? "Not recorded"}`}
            />
          </span>
        </div>
      </Card>
      {mismatch && (
        <p className={legacy.attention} role="status">
          Patient sex or gender differs from the movement placement record. Both values are shown below for review.
        </p>
      )}
      <div className={styles.cols}>
        {groups.map((g, i) => (
          <Card key={g.title} data-testid={i === 0 ? "ward-person-placement-details" : undefined}>
            <CardHead level={3} title={g.title} />
            <dl className={styles.fields}>
              {g.facts
                .filter(([, v]) => !missingOnly || !v)
                .map(([label, value]) => (
                  <div className={styles.detailField} key={label}>
                    <dt>{label}</dt>
                    <dd data-missing={!value}>{value ?? "Not recorded"}</dd>
                  </div>
                ))}
            </dl>
            {missingOnly && g.facts.every(([, v]) => v) && (
              <p className={cx(styles.bodyPad, legacy.muted)}>All fields in this section are recorded.</p>
            )}
          </Card>
        ))}
        <Card className={styles.dashed}>
          <CardHead
            level={3}
            icon={Wrench}
            title="Not in the record yet"
            aside={<span className={styles.preview}>Preview</span>}
          />
          <dl className={styles.fields}>
            {["Next of kin", "Carer", "Guardian", "Advance health directive", "NDIS participant", "Alerts"].map(
              (label) => (
                <div className={styles.detailField} key={label}>
                  <dt>{label}</dt>
                  <dd data-missing="true">Needs a record field</dd>
                </div>
              ),
            )}
          </dl>
        </Card>
      </div>
      <p className={legacy.note}>
        Record completeness describes available fields; it is not a clinical safety assessment.
      </p>
    </section>
  );
}

type FormRow = {
  code: string;
  status: "Current" | "Continued" | "Closed";
  recorded?: string;
  by: string;
  due?: number;
};

export function PatientDocumentsTab({
  record,
  movement,
  movementInForce,
  patient,
  now,
  onRecordDocument,
}: {
  record: PatientNowRecord;
  movement?: Movement;
  /** False when the movement is closed or its stay has ended, so its forms are history. */
  movementInForce: boolean;
  patient?: Patient;
  now: number;
  onRecordDocument: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const files = movement?.uploadedForms ?? [];
  const rows = [
    ...record.documents.map((d, i) => ({
      id: `legal-${i}`,
      kind: "legal",
      title: d.name,
      code: d.code,
      from: d.from,
      by: d.by,
      when: d.when,
      status: d.status,
      file: undefined as string | undefined,
    })),
    ...files.map((d) => ({
      id: d.id,
      kind: "transport",
      title: d.formName,
      code: d.formType ?? "Record",
      from: "Transfer document metadata",
      by: d.uploadedBy,
      when: `${clock(d.uploadedAt)} AWST`,
      status: "Metadata recorded",
      file: d.fileName,
    })),
  ].filter(
    (d) =>
      (filter === "all" || d.kind === filter) &&
      `${d.title} ${d.code} ${d.from} ${d.file ?? ""}`.toLowerCase().includes(query.toLowerCase().trim()),
  );

  // The forms register: forms in force, as recorded. No lapse column (D5); a person-typed paper
  // expiry, where one exists, is shown beside its form as typed and marked not legally checked.
  const forms: FormRow[] = [];
  if (movement?.legalForm) {
    const recordedAt = movement.legalFormReceivedAt ?? movement.formedAt;
    const continued = movement.legalForm.continuedBy;
    if (continued)
      forms.push({
        code: continued.code,
        status: movementInForce ? "Current" : "Closed",
        recorded: clock(continued.recordedAt),
        by: continued.by,
      });
    forms.push({
      code: movement.legalForm.code,
      status: !movementInForce ? "Closed" : continued ? "Continued" : "Current",
      recorded: recordedAt !== undefined ? clock(recordedAt) : undefined,
      by: "Movement record",
      due: movement.legalForm.dueAt,
    });
  }
  if (patient?.communityTreatmentOrder)
    forms.push({
      code: patient.communityTreatmentOrder.form,
      status: "Current",
      recorded: clock(patient.communityTreatmentOrder.recordedAt),
      by: patient.communityTreatmentOrder.recordedBy,
    });
  for (const ended of patient?.communityTreatmentOrderHistory ?? [])
    forms.push({
      code: ended.form,
      status: "Closed",
      recorded: clock(ended.recordedAt),
      by: ended.recordedBy,
    });
  const current = forms.filter((f) => f.status === "Current").length;

  return (
    <section className={styles.pane} aria-label="Documents and legal authority" data-layout="documents">
      <Card>
        <CardHead
          level={3}
          icon={Scale}
          title="Legal forms"
          aside={<span className={styles.chip}>Current {current}</span>}
          meta={
            (movementInForce ? movement?.legalStatus : undefined) ?? patient?.legalStatus ?? "Legal status not recorded"
          }
        />
        {forms.length > 0 ? (
          <table className={tableClasses.table}>
            <thead>
              <tr>
                <th scope="col">Form</th>
                <th scope="col">Status</th>
                <th scope="col">Recorded</th>
                <th scope="col" className={styles.byCol}>
                  By
                </th>
              </tr>
            </thead>
            <tbody>
              {forms.map((f) => (
                <tr key={`${f.code}-${f.status}`}>
                  <td>
                    <span className={styles.form} data-off={f.status !== "Current"}>
                      Form {f.code}
                    </span>
                  </td>
                  <td className={styles.wrap}>
                    <span className={styles.state}>
                      <StatusGlyph tone={f.status === "Current" ? "success" : "closed"} size={10} />
                      {f.status}
                    </span>
                    {f.due !== undefined ? (
                      <span className={styles.cellSub}>
                        {" "}
                        Paper expiry typed {clock(f.due)}
                        {now >= f.due ? ", passed" : ""} <LegalLimitsNotChecked variant="tag" />
                      </span>
                    ) : null}
                  </td>
                  <td className={styles.mono}>{f.recorded ?? <span className={styles.nr}>Not recorded</span>}</td>
                  <td className={styles.byCol}>{f.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={cx(styles.bodyPad, legacy.muted)}>
            {movement ? "No legal form recorded." : "No active transfer authority."}
          </p>
        )}
        {movement?.legalForm ? (
          <p className={cx(styles.bodyPad, legacy.note)}>{legalFormName(movement.legalForm)}</p>
        ) : null}
      </Card>
      <Card>
        <CardHead
          level={3}
          icon={FileText}
          title="Documents"
          aside={<span className={styles.chip}>{rows.length}</span>}
          action={
            movement ? (
              <Button size="sm" variant="pri" onClick={onRecordDocument}>
                Record document details
              </Button>
            ) : undefined
          }
        />
        <div className={styles.bodyPad}>
          <div className={legacy.toolbar}>
            <label className={legacy.search}>
              <Search size={16} aria-hidden="true" />
              <input
                aria-label="Search patient documents"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search document, form or source"
              />
            </label>
          </div>
          <div className={cx(legacy.filters, styles.filterRow)} role="group" aria-label="Document filter">
            {[
              ["all", "All documents"],
              ["legal", "Legal authority"],
              ["transport", "Transfer documents"],
            ].map(([key, label]) => (
              <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>
                {label}
              </button>
            ))}
            <span role="status">{rows.length} synthetic records shown</span>
          </div>
          <div className={legacy.documentList}>
            {rows.map((d) => (
              <details className={legacy.document} key={d.id}>
                <summary>
                  <span className={legacy.docIcon}>
                    <FileText size={21} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{d.title}</strong>
                    <small>
                      {d.code}, {d.from}
                    </small>
                  </span>
                  <span className={legacy.tag}>{d.status}</span>
                </summary>
                <div className={legacy.documentBody}>
                  <dl className={legacy.facts}>
                    <dt>Recorded by</dt>
                    <dd>{d.by}</dd>
                    <dt>Date / time</dt>
                    <dd>{d.when}</dd>
                    {d.file && (
                      <>
                        <dt>File reference</dt>
                        <dd>{d.file}</dd>
                      </>
                    )}
                  </dl>
                  <p className={legacy.note}>
                    {d.file
                      ? "Document metadata only. No uploaded file or binary preview is stored in this prototype."
                      : "This entry records authority information. It is not a preview of a signed legal document."}
                  </p>
                </div>
              </details>
            ))}
            {rows.length === 0 && (
              <div className={legacy.empty}>
                <FileText size={24} aria-hidden="true" />
                <strong>{query || filter !== "all" ? "No matching document records" : "No documents recorded"}</strong>
                <p>{query || filter !== "all" ? "Change the search or document filter." : record.documentsAbsent}</p>
              </div>
            )}
          </div>
        </div>
      </Card>
      <p className={legacy.note}>
        A document entry does not establish medical clearance, travel fitness or a completed handover.
      </p>
    </section>
  );
}

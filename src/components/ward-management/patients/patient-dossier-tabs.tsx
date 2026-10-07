"use client";

import { useState } from "react";
import { ArrowUpRight, Clipboard, FileText, History, MapPin, Search, ShieldCheck, Users, Contact } from "lucide-react";
import type { Movement } from "../ward-model";
import type { Patient } from "../ward-patients";
import { edById } from "../ward-sites";
import { legalFormName } from "../ward-legal-forms";
import { LegalLimitsNotChecked } from "../legal-limits-not-checked";
import { clock, STAGES, type PatientNowRecord } from "./patient-now-records";
import styles from "./patient-dossier-tabs.module.css";

function CopyFact({ value, label }: { value: string; label: string }) {
  const [message, setMessage] = useState("");
  return (
    <div className={styles.copy}>
      <button
        type="button"
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
        <Clipboard size={15} aria-hidden="true" />
        {label}
      </button>
      <span role="status">{message}</span>
    </div>
  );
}
function Heading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className={styles.heading}>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

export function PatientHistoryTab({ record, movement }: { record: PatientNowRecord; movement?: Movement }) {
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
  return (
    <section className={styles.pane} aria-label="Presentation history" data-layout="history">
      <Heading
        eyebrow="LONGITUDINAL CONTEXT"
        title="Presentations"
        description="Episodes, outcomes and recorded journey events."
      />
      <div className={styles.summaryStrip}>
        <div>
          <span>Linked episodes</span>
          <strong>{record.presentations.length}</strong>
        </div>
        <div>
          <span>Earlier presentations</span>
          <strong>{prior.length}</strong>
        </div>
        <div>
          <span>Recorded stage changes</span>
          <strong>{movement?.stageChanges.length ?? 0}</strong>
        </div>
        {record.presentations.length > 0 && (
          <span className={styles.tag} data-testid="pn-history-example-label">
            Example history
          </span>
        )}
      </div>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Search presentation history"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search place, outcome or episode…"
          />
        </label>
        <button type="button" className={styles.sort} onClick={() => setRecent(!recent)}>
          {recent ? "Newest first ↓" : "Oldest first ↑"}
        </button>
      </div>
      <div className={styles.filters} role="group" aria-label="History filter">
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
      <div className={styles.historyGrid}>
        <div className={styles.episodes}>
          {items.map((p, i) => (
            <details className={styles.episode} key={`${p.date}-${p.where}-${i}`} open={p.current ? true : undefined}>
              <summary>
                <span className={styles.episodeMark}>
                  <History size={18} aria-hidden="true" />
                </span>
                <span>
                  <strong>{p.date}</strong>
                  <small>{p.where}</small>
                </span>
                <span className={styles.tag}>{p.current ? "Linked journey" : p.los}</span>
              </summary>
              <div className={styles.episodeBody}>
                <div className={styles.route}>
                  <MapPin size={15} aria-hidden="true" />
                  <strong>{p.where}</strong>
                  <ArrowUpRight size={16} aria-hidden="true" />
                  <span>{p.to}</span>
                </div>
                <p>{p.outcome}</p>
                {p.story && <p className={styles.muted}>{p.story}</p>}
                <dl className={styles.facts}>
                  <dt>Duration</dt>
                  <dd>{p.losFull}</dd>
                  <dt>Legal authority</dt>
                  <dd>{p.legal}</dd>
                  <dt>Community team</dt>
                  <dd>{p.team}</dd>
                </dl>
                {p.asked.length > 0 && (
                  <details className={styles.innerDetails}>
                    <summary>Ward responses · {p.asked.length}</summary>
                    {p.asked.map((a, j) => (
                      <p key={j}>
                        <strong>{a.ward}</strong> · {a.outcome}
                        {a.why ? ` · ${a.why}` : ""}
                      </p>
                    ))}
                  </details>
                )}
              </div>
            </details>
          ))}
          {items.length === 0 && (
            <div className={styles.empty}>
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
            <p className={styles.note}>No earlier presentation history is available in this record.</p>
          )}
        </div>
        <aside className={styles.surface} aria-label="Journey event log">
          <div className={styles.cardTitle}>
            <span className={styles.icon}>
              <History size={18} aria-hidden="true" />
            </span>
            <h3>Journey event log</h3>
          </div>
          {movement ? (
            <ol className={styles.events}>
              {movement.stageChanges
                .slice()
                .reverse()
                .map((change, i) => (
                  <li key={i}>
                    <time>{clock(change.at)} AWST</time>
                    <strong>{STAGES.find((s) => s.id === change.to)?.label ?? change.to}</strong>
                    <span>
                      Recorded by {change.by}
                      {change.reason ? ` · ${change.reason}` : ""}
                    </span>
                  </li>
                ))}
              <li>
                <time>{clock(movement.openedAt)} AWST</time>
                <strong>Journey opened</strong>
                <span>{edById(movement.originEdId)?.name ?? "Origin not recorded"}</span>
              </li>
            </ol>
          ) : (
            <p className={styles.muted}>No linked movement events. Patient information remains available in Details.</p>
          )}
          <p className={styles.note}>
            Stage events reflect recorded transitions. Missing transitions are not inferred.
          </p>
        </aside>
      </div>
    </section>
  );
}

export function PatientCommunityTab({
  record,
  patient,
  movement,
  receivingWardName,
}: {
  record: PatientNowRecord;
  patient?: Patient;
  movement?: Movement;
  receivingWardName?: string;
}) {
  const summary = `GP: ${patient?.generalPractitioner ?? "Not recorded"}\nCatchment: ${patient?.catchmentCommunityTeam ?? "Not recorded"}\nFollow-up: ${record.community.followUp}`;
  return (
    <section className={styles.pane} aria-label="Community and care continuity" data-layout="community">
      <Heading
        eyebrow="CARE CONTINUITY"
        title="Care & community"
        description="Care links, follow-up and transfer contacts."
      />
      <div className={styles.careDirectory}>
        <section className={styles.careLinks} aria-label="Recorded care directory">
          <h3>Care directory</h3>
          <div className={styles.serviceRow}>
            <span className={styles.icon}>
              <Users size={18} aria-hidden="true" />
            </span>
            <div>
              <span>Community catchment</span>
              <strong>{patient?.catchmentCommunityTeam ?? "Not recorded"}</strong>
              <small>Catchment link · current team involvement unconfirmed</small>
            </div>
          </div>
          <div className={styles.serviceRow}>
            <span className={styles.icon}>
              <Contact size={18} aria-hidden="true" />
            </span>
            <div>
              <span>General practitioner</span>
              <strong>{patient?.generalPractitioner ?? "Not recorded"}</strong>
            </div>
          </div>
          <div className={styles.serviceRow}>
            <span className={styles.icon}>
              <MapPin size={18} aria-hidden="true" />
            </span>
            <div>
              <span>Residential area</span>
              <strong>{patient?.suburb ?? "Not recorded"}</strong>
            </div>
          </div>
          <p className={styles.note}>
            A recorded catchment does not confirm current case management or an active appointment.
          </p>
        </section>
        <section className={styles.continuity}>
          <div className={styles.cardTitle}>
            <Clipboard size={18} aria-hidden="true" />
            <h3>Follow-up record</h3>
          </div>
          <p className={styles.prose}>{record.community.followUp}</p>
          <div className={styles.cardTitle}>
            <h3>Team allocation</h3>
            <span className={styles.tag}>{record.community.teams.length} linked</span>
          </div>
          {record.community.teams.length > 0 ? (
            <div className={styles.teamRows}>
              {record.community.teams.map((t, i) => (
                <article key={i}>
                  <div>
                    <strong>{t.name}</strong>
                    <span className={styles.tag}>{t.state}</span>
                  </div>
                  <p>{t.note}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.muted}>
              {record.community.absent ?? "No community team allocation is established by this movement record."}
            </p>
          )}
          <CopyFact value={summary} label="Copy care links" />
        </section>
      </div>
      {movement && (
        <section className={styles.surface}>
          <div className={styles.cardTitle}>
            <h3>Transfer coordination contacts</h3>
            <span className={styles.tag}>Service roles</span>
          </div>
          <div className={styles.grid}>
            <div className={styles.contact}>
              <span>SENDING LOCATION</span>
              <strong>{edById(movement.originEdId)?.name ?? "Not recorded"}</strong>
              <small>Referring emergency department</small>
            </div>
            <div className={styles.contact}>
              <span>RECEIVING WARD</span>
              <strong>
                {movement.acceptedUnitId ? (receivingWardName ?? "Not recorded") : "Destination under review"}
              </strong>
              <small>
                {movement.owner?.trim() ? `Movement owner: ${movement.owner}` : "Movement owner not recorded"}
              </small>
            </div>
          </div>
        </section>
      )}
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
      <Heading
        eyebrow="PATIENT RECORD"
        title="Patient details"
        description="Patient identity, ongoing care and placement context."
      />
      <div className={styles.detailsToolbar}>
        <div>
          <strong>
            {all.length - missing} / {all.length}
          </strong>
          <span> fields recorded · {missing} unrecorded</span>
          <meter
            className={styles.completeness}
            min={0}
            max={all.length}
            value={all.length - missing}
            aria-label="Recorded patient and placement fields"
          />
        </div>
        <button type="button" aria-pressed={missingOnly} onClick={() => setMissingOnly(!missingOnly)}>
          Missing information {missingOnly ? "✓" : ""}
        </button>
      </div>
      {mismatch && (
        <p className={styles.attention} role="status">
          Patient sex or gender differs from the movement placement record. Both values are shown below for review.
        </p>
      )}
      <div className={styles.grid}>
        {groups.map((g, i) => (
          <section
            className={styles.surface}
            key={g.title}
            data-testid={i === 0 ? "ward-person-placement-details" : undefined}
          >
            <div className={styles.cardTitle}>
              <h3>{g.title}</h3>
            </div>
            <dl className={styles.facts}>
              {g.facts
                .filter(([, v]) => !missingOnly || !v)
                .map(([label, value]) => (
                  <div className={styles.factRow} key={label}>
                    <dt>{label}</dt>
                    <dd data-missing={!value}>{value ?? "Not recorded"}</dd>
                  </div>
                ))}
            </dl>
            {missingOnly && g.facts.every(([, v]) => v) && (
              <p className={styles.muted}>All fields in this section are recorded.</p>
            )}
          </section>
        ))}
      </div>
      <CopyFact
        label="Copy patient identifiers"
        value={`${displayName}\nUMRN: ${patient?.umrn ?? "Not recorded"}\nDOB: ${patient?.dateOfBirth ?? "Not recorded"}`}
      />
      <p className={styles.note}>
        Record completeness describes available fields; it is not a clinical safety assessment.
      </p>
    </section>
  );
}

export function PatientDocumentsTab({
  record,
  movement,
  now,
  onRecordDocument,
}: {
  record: PatientNowRecord;
  movement?: Movement;
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
  const due = movement?.legalForm?.dueAt;
  const expired = due !== undefined && now >= due;
  return (
    <section className={styles.pane} aria-label="Documents and legal authority" data-layout="documents">
      <Heading
        eyebrow="TRANSFER EVIDENCE"
        title="Documents & legal authority"
        description="Current authority and the transfer document register."
      />
      <div className={styles.documentSummary}>
        <section className={`${styles.surface} ${styles.tinted}`}>
          <div className={styles.cardTitle}>
            <ShieldCheck size={20} aria-hidden="true" />
            <h3>Current transfer authority</h3>
          </div>
          <strong className={styles.lead}>
            {movement?.legalForm
              ? legalFormName(movement.legalForm)
              : movement
                ? "No legal form recorded"
                : "No active transfer authority"}
          </strong>
          <p>{movement?.legalStatus ?? "Legal status not recorded for a movement"}</p>
        </section>
        <section className={styles.surface} data-attention={expired}>
          <span className={styles.label}>PAPER EXPIRY</span>
          <strong className={styles.lead}>
            {due === undefined ? (
              "Not recorded"
            ) : (
              <>
                {`${clock(due)} AWST`} <LegalLimitsNotChecked variant="tag" />
              </>
            )}
          </strong>
          <p className={styles.muted}>
            {due === undefined
              ? "No expiry has been entered; validity is not inferred."
              : expired
                ? "Recorded expiry has passed. Review authority before progressing."
                : "Recorded expiry is shown without inferring legal validity."}
          </p>
          {due !== undefined ? <LegalLimitsNotChecked /> : null}
        </section>
      </div>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Search patient documents"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search document, form or source…"
          />
        </label>
        {movement && (
          <button type="button" className={styles.primary} onClick={onRecordDocument}>
            Record document details
          </button>
        )}
      </div>
      <div className={styles.filters} role="group" aria-label="Document filter">
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
      <div className={styles.documentList}>
        {rows.map((d) => (
          <details className={styles.document} key={d.id}>
            <summary>
              <span className={styles.docIcon}>
                <FileText size={21} aria-hidden="true" />
              </span>
              <span>
                <strong>{d.title}</strong>
                <small>
                  {d.code} · {d.from}
                </small>
              </span>
              <span className={styles.tag}>{d.status}</span>
            </summary>
            <div className={styles.documentBody}>
              <dl className={styles.facts}>
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
              <p className={styles.note}>
                {d.file
                  ? "Document metadata only. No uploaded file or binary preview is stored in this prototype."
                  : "This entry records authority information. It is not a preview of a signed legal document."}
              </p>
            </div>
          </details>
        ))}
        {rows.length === 0 && (
          <div className={styles.empty}>
            <FileText size={24} aria-hidden="true" />
            <strong>{query || filter !== "all" ? "No matching document records" : "No documents recorded"}</strong>
            <p>{query || filter !== "all" ? "Change the search or document filter." : record.documentsAbsent}</p>
          </div>
        )}
      </div>
      <p className={styles.note}>
        A document entry does not establish medical clearance, travel fitness or a completed handover.
      </p>
    </section>
  );
}

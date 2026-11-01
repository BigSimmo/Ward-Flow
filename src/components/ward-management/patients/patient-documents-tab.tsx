"use client";

import { useState } from "react";
import {
  Ambulance,
  DoorOpen,
  FilePlus,
  FileText,
  Scale,
  Send,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  Button,
  Card,
  CardHead,
  ChipGroup,
  Count,
  FilterChip,
  Icon,
  SearchField,
  Segmented,
  StatusGlyph,
  cx,
  useIsPhone,
  type WfTone,
} from "@/components/wf";
import type { ReferralChart } from "@/components/ward-management/referrals/referral-submission";
import { formTitleForCode } from "@/lib/form-register";
import { LegalLimitsNotChecked } from "../legal-limits-not-checked";
import { formProgression } from "../legal-forms/legal-form-progression";
import { clockStanding, standingWord, STANDING_TONE } from "../legal-forms/legal-forms-view";
import { fieldsMatchEveryWord } from "../search/search-text";
import {
  calendarDateOf,
  demoDayZero,
  formatInstant,
  dayOf,
  isClockBreached,
  perthDateLabel,
  type Instant,
} from "../ward-clock";
import { useDueSoonThresholds, useOptionalWardFlowSelect } from "../ward-flow-provider";
import { WARD_FLOW_ROLE_LABELS, type WardFlowRole } from "../ward-flow-roles";
import type { Movement } from "../ward-model";
import type { Patient } from "../ward-patients";
import { edById } from "../ward-sites";
import { uploadedFileLabel, uploadedFileTypeOf } from "../ward-uploaded-file";
import {
  CATEGORY_ORDER,
  compareRows,
  episodeGroupFor,
  isQuietStatus,
  parseShownDate,
  sameDocumentKey,
  shownDate,
  type DocStatus,
  type RegisterRow,
} from "./patient-documents-register";
import { isOwnStay } from "./patient-now-adapter";
import type { PatientNowRecord } from "./patient-now-records";
import { recordExtrasFor, type DocumentCategory } from "./patient-record-extras";
import styles from "./patient-documents-tab.module.css";

/**
 * Documents (patient overhaul round 2, 1 Nov 2026): ONE register of every legal form and document
 * the record holds, searchable and grouped by episode or by type. Legal status and every form time
 * read exactly as typed (D-93): the time written on the form, never when it was entered here, and
 * never a countdown, "due in", "left" or "ago". Ward Flow checks no Mental Health Act period
 * (D5, D-70), so a typed end carries the "limits not legally checked" tag.
 */

const STATUS_TONE: Record<DocStatus, WfTone> = {
  "In force": "success",
  "To record": "warning",
  Continued: "neutral",
  Current: "info",
  Filed: "neutral",
  Ended: "closed",
  Superseded: "closed",
};

const CATEGORY_ICON: Record<DocumentCategory, LucideIcon> = {
  Legal: Scale,
  Referral: Send,
  Clinical: Stethoscope,
  Community: Users,
  Discharge: DoorOpen,
  Transport: Ambulance,
};

type GroupBy = "episode" | "type";

function roleName(by: string | undefined): string | undefined {
  if (!by) return undefined;
  return Object.hasOwn(WARD_FLOW_ROLE_LABELS, by) ? WARD_FLOW_ROLE_LABELS[by as WardFlowRole] : by;
}

/** "10:37" today, or "Sun 1 Nov 10:37" on any other day. Never "yesterday", "in 2 days" or "ago". */
function moment(at: Instant, now: Instant, dayZero: Date): string {
  if (dayOf(at) === dayOf(now)) return formatInstant(at);
  const day = perthDateLabel(at, dayZero, { weekday: "short", day: "numeric", month: "short" });
  return `${day.replace(",", "")} ${formatInstant(at)}`;
}

/** A record status word from the older store, in the register's words. */
function recordStatus(status: string, statutory: boolean): { status: DocStatus; note?: string } {
  if (status === "Active") return { status: statutory ? "In force" : "Current" };
  if (status === "Closed") return { status: "Ended" };
  if (status.startsWith("Runs to")) return { status: "In force", note: status };
  return { status: "Filed" };
}

export function PatientDocumentsTab({
  record,
  movement,
  movementInForce,
  patient,
  now,
  onRecordDocument,
  referralCharts = [],
}: {
  record: PatientNowRecord;
  movement?: Movement;
  /** False when the movement is closed or its stay has ended, so its forms are history. */
  movementInForce: boolean;
  patient?: Patient;
  now: number;
  onRecordDocument: () => void;
  /** WT-06: the charts the referrer attached, by type and size. */
  referralCharts?: readonly ReferralChart[];
}) {
  const thresholds = useDueSoonThresholds();
  const isPhone = useIsPhone();
  const flow = useOptionalWardFlowSelect("dayZero", "admissions");
  const dayZero = flow?.dayZero ?? demoDayZero(new Date(0));
  const at = (instant: Instant) => moment(instant, now, dayZero);
  const msOf = (instant: Instant) => calendarDateOf(instant, dayZero).getTime();
  const extras = recordExtrasFor(patient?.id);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<DocumentCategory | "All">("All");
  const [groupBy, setGroupBy] = useState<GroupBy>("episode");

  // Active is the gate board's reading (as Details): an open movement, or an occupied bed.
  const openMovement = Boolean(movement && !movement.closure && movement.stage !== "arrived");
  const occupied = Boolean(
    flow?.admissions.some(
      (admission) =>
        admission.state === "occupied" &&
        ((patient !== undefined && isOwnStay(admission, patient.id)) ||
          (movement?.admissionId !== undefined && admission.id === movement.admissionId)),
    ),
  );
  const active = openMovement || occupied || (!flow && movement !== undefined && !movement.closure);

  const legalForm = movement?.legalForm;
  // The movement's own form already arrives in `record.documents` as "the presentation open now";
  // the register row below carries it, so that entry is folded in rather than listed twice.
  const openNow = record.documents.find(
    (d) => legalForm !== undefined && d.code === legalForm.code && d.from.startsWith("The presentation open now"),
  );
  const openNowBy = openNow && openNow.by !== "Author not recorded here" ? openNow.by : undefined;

  // The same reading as Legal now (audit S-6): after an inpatient order at the examination, or an
  // arrival on an order, the movement's form has ended and Form 6A is the one form to record next.
  const progression = formProgression(movement);
  const formSource = edById(movement?.originEdId)?.name;

  // ── Live rows: the movement's forms, the order, the record's own documents, uploads, charts ──
  const live: RegisterRow[] = [];
  const legalRow = (row: Omit<RegisterRow, "category" | "live" | "title"> & { code: string }): RegisterRow => ({
    ...row,
    title: formTitleForCode(row.code) ?? `Form ${row.code}`,
    category: "Legal",
    live: true,
  });
  if (movement && legalForm) {
    const continued = legalForm.continuedBy;
    if (continued)
      live.push(
        legalRow({
          key: `continued-${continued.code}`,
          code: continued.code,
          episode: "current",
          source: formSource,
          dateText: at(continued.startedAt),
          sortAt: msOf(continued.startedAt),
          by: roleName(continued.by),
          status: movementInForce ? "In force" : "Ended",
          typedEndAt: legalForm.dueAt,
          standing: movementInForce,
        }),
      );
    const examinedAt =
      progression?.endedWhen === "at the examination" && movement.examination ? movement.examination.at : undefined;
    live.push(
      legalRow({
        key: `movement-${legalForm.code}`,
        code: legalForm.code,
        episode: "current",
        source: formSource,
        // The time written on the form, as typed; never when it was entered in Ward Flow.
        dateText: movement.formedAt !== undefined ? at(movement.formedAt) : undefined,
        sortAt: movement.formedAt !== undefined ? msOf(movement.formedAt) : Number.NaN,
        by: openNowBy,
        status: progression || !movementInForce ? "Ended" : continued ? "Continued" : "In force",
        statusNote: progression
          ? `${progression.endedWhen.charAt(0).toUpperCase()}${progression.endedWhen.slice(1)}${
              examinedAt !== undefined ? `, ${at(examinedAt)}` : ""
            }`
          : undefined,
        typedEndAt: progression ? undefined : continued ? continued.continuedFormDueAt : legalForm.dueAt,
        standing: !progression && movementInForce && !continued,
      }),
    );
    if (progression)
      live.push(
        legalRow({
          key: `to-record-${progression.nextCode}`,
          code: progression.nextCode,
          episode: "current",
          sortAt: Number.NaN,
          status: "To record",
          pending: true,
        }),
      );
    for (const earlier of legalForm.earlierContinuations ?? [])
      live.push(
        legalRow({
          key: `earlier-continuation-${earlier.code}-${earlier.recordedAt}`,
          code: earlier.code,
          episode: "current",
          source: formSource,
          dateText: at(earlier.startedAt),
          sortAt: msOf(earlier.startedAt),
          by: roleName(earlier.by),
          status: "Superseded",
          typedEndAt: earlier.continuedFormDueAt,
        }),
      );
    for (const earlier of legalForm.earlierForms ?? [])
      live.push(
        legalRow({
          key: `earlier-form-${earlier.code}-${earlier.at}`,
          code: earlier.code,
          episode: "current",
          source: formSource,
          dateText: earlier.writtenAt !== undefined ? at(earlier.writtenAt) : undefined,
          sortAt: earlier.writtenAt !== undefined ? msOf(earlier.writtenAt) : Number.NaN,
          by: roleName(earlier.by),
          status: "Superseded",
          typedEndAt: earlier.dueAt,
        }),
      );
  }
  if (patient?.communityTreatmentOrder) {
    const order = patient.communityTreatmentOrder;
    // No time written is held for an order: only when it was recorded here, so that goes underneath.
    live.push(
      legalRow({
        key: `cto-${order.recordedAt}`,
        code: order.form,
        sub: `Recorded ${at(order.recordedAt)}`,
        episode: "community",
        sortAt: msOf(order.recordedAt),
        by: roleName(order.recordedBy),
        status: order.endedAt === undefined ? "In force" : "Ended",
        statusNote: order.endedAt !== undefined ? `Ended ${at(order.endedAt)}` : undefined,
      }),
    );
    // D-40: orders that ended before this one stay listed.
    for (const ended of order.earlier ?? [])
      live.push(
        legalRow({
          key: `cto-${ended.recordedAt}`,
          code: ended.form,
          sub: `Recorded ${at(ended.recordedAt)}`,
          episode: "community",
          sortAt: msOf(ended.recordedAt),
          by: roleName(ended.recordedBy),
          status: "Ended",
          statusNote: `Ended ${at(ended.endedAt)}`,
        }),
      );
  }
  for (const [i, d] of record.documents.entries()) {
    if (d === openNow) continue;
    const title = formTitleForCode(d.code);
    const statutory = title !== null;
    const { status, note } = recordStatus(d.status, statutory);
    const episode = d.from.startsWith("The presentation open now")
      ? "current"
      : d.from === "Community intake" || d.code === "CM"
        ? "community"
        : d.from;
    live.push({
      key: `record-${i}`,
      code: statutory ? d.code : undefined,
      title: title ?? d.name,
      category: statutory ? "Legal" : d.code === "REF" ? "Referral" : d.code === "CM" ? "Community" : "Clinical",
      episode,
      source: episode === "current" ? undefined : d.from,
      dateText: shownDate(d.when),
      sortAt: parseShownDate(d.when)?.ms ?? Number.NaN,
      by: d.by === "Author not recorded here" ? undefined : d.by,
      status,
      statusNote: note,
      live: true,
    });
  }
  for (const d of movement?.uploadedForms ?? [])
    live.push({
      key: d.id,
      title: d.formName,
      sub: [d.formType, uploadedFileLabel(d)].filter(Boolean).join(" · ") || undefined,
      category: "Transport",
      episode: "current",
      source: "Transfer document",
      dateText: at(d.uploadedAt),
      sortAt: msOf(d.uploadedAt),
      by: roleName(d.uploadedBy),
      status: "Filed",
      live: true,
    });
  for (const [index, chart] of referralCharts.entries())
    live.push({
      key: `referral-chart-${index}`,
      title:
        chart.kind === "medication" ? "Medication chart" : chart.kind === "observation" ? "Observation chart" : "Chart",
      sub: uploadedFileLabel({ fileType: uploadedFileTypeOf(chart.name, chart.mimeType), sizeBytes: chart.sizeBytes }),
      category: "Clinical",
      episode: "current",
      source: "Attached to the referral",
      dateText: "At Send",
      sortAt: Number.NaN,
      by: "Referrer",
      status: "Current",
      live: true,
    });

  // ── The extras register, folded in without duplicates: a live row wins and borrows what it lacks ──
  const byKey = new Map(live.map((row) => [sameDocumentKey(row), row] as const));
  const rows: RegisterRow[] = [...live];
  for (const d of extras?.documents ?? []) {
    const row: RegisterRow = {
      key: d.id,
      code: d.code,
      title: d.title,
      sub: d.meta,
      category: d.category,
      episode: d.episode,
      source: d.source,
      dateText: shownDate(d.date),
      sortAt: parseShownDate(d.date)?.ms ?? Number.NaN,
      by: d.by,
      status: d.status,
    };
    const twin = byKey.get(sameDocumentKey(row));
    if (twin) {
      if (!twin.pending) {
        twin.by ??= row.by;
        twin.sub ??= row.sub;
      }
      continue;
    }
    byKey.set(sameDocumentKey(row), row);
    rows.push(row);
  }

  // ── At a glance ──
  const inForce = live.find((r) => r.category === "Legal" && r.status === "In force" && r.code);
  const toRecord = live.find((r) => r.status === "To record");
  const typedStatus =
    (movementInForce ? movement?.legalStatus : undefined) ?? patient?.legalStatus ?? (undefined as string | undefined);
  const legalStatus = typedStatus ? (active ? typedStatus : `Last recorded: ${typedStatus}`) : undefined;
  const standing = movement && movementInForce ? clockStanding(movement, now, thresholds) : undefined;
  const warned = standing === "passed" || standing === "urgent" || standing === "soon";
  // A form still to record is not a recorded document, so it does not count.
  const recorded = rows.filter((r) => !r.pending);
  const total = recorded.length;
  const episodeCount = new Set(recorded.map((r) => r.episode)).size;
  const legalCount = rows.filter((r) => r.category === "Legal").length;

  // ── Search, category and grouping ──
  const searched = query.trim()
    ? rows.filter((r) =>
        fieldsMatchEveryWord(query, [
          r.title,
          r.code ? `Form ${r.code}` : "",
          r.source ?? "",
          r.by ?? "",
          r.sub ?? "",
          r.category,
        ]),
      )
    : rows;
  const categoryCounts = new Map<DocumentCategory, number>();
  for (const r of searched) if (!r.pending) categoryCounts.set(r.category, (categoryCounts.get(r.category) ?? 0) + 1);
  const categories = CATEGORY_ORDER.filter((c) => rows.some((r) => r.category === c));
  const shown = category === "All" ? searched : searched.filter((r) => r.category === category);
  const filtering = query.trim().length > 0 || category !== "All";

  const groups = (() => {
    if (groupBy === "type")
      return CATEGORY_ORDER.map((c) => ({
        key: c,
        label: c,
        aside: undefined as string | undefined,
        icon: CATEGORY_ICON[c],
        rows: shown.filter((r) => r.category === c).sort(compareRows),
      })).filter((g) => g.rows.length > 0);
    const keys = [...new Set(shown.map((r) => r.episode))];
    return keys
      .map((key) => episodeGroupFor(key, extras, { active, hasMovement: movement !== undefined }))
      .sort((a, b) => b.sortAt - a.sortAt)
      .map((g) => ({
        ...g,
        icon: undefined as LucideIcon | undefined,
        rows: shown.filter((r) => r.episode === g.key).sort(compareRows),
      }));
  })();

  // The one action: card head right on desktop, pinned at the card foot on a phone.
  const recordButton = movement ? (
    <Button icon={FilePlus} onClick={onRecordDocument}>
      Record document details
    </Button>
  ) : undefined;

  const clearAll = () => {
    setQuery("");
    setCategory("All");
  };

  const statusCell = (r: RegisterRow) => {
    const strong = r.status === "In force" || r.status === "To record";
    const typed =
      r.typedEndAt !== undefined
        ? `${isClockBreached(r.typedEndAt, now) ? "Ended" : "Ends"} ${at(r.typedEndAt)} as typed`
        : undefined;
    return (
      <span className={styles.statusCell}>
        <span className={cx(styles.status, strong && styles.statusStrong)} data-tone={STATUS_TONE[r.status]}>
          <StatusGlyph tone={STATUS_TONE[r.status]} size={9} />
          {r.status}
        </span>
        {r.statusNote ? <span className={styles.note}>{r.statusNote}</span> : null}
        {typed && r.standing ? (
          <span className={styles.ends} data-testid="dossier-paper-expiry-time-left">
            <span>{typed}</span>
            {warned && standing ? (
              <span className={styles.standing}>
                <StatusGlyph tone={STANDING_TONE[standing]} size={9} />
                {standingWord(standing, thresholds)}
              </span>
            ) : null}{" "}
            <LegalLimitsNotChecked variant="tag" />
          </span>
        ) : typed ? (
          <span className={styles.note}>{typed}</span>
        ) : r.standing && r.status === "In force" ? (
          <span className={styles.note}>No end time typed</span>
        ) : null}
      </span>
    );
  };

  const codeChip = (r: RegisterRow) =>
    r.code ? (
      <span className={cx(styles.code, r.pending && styles.codePending)} aria-label={`Form ${r.code}`}>
        {r.code}
      </span>
    ) : (
      <span className={styles.codeIcon} aria-label={r.category} role="img">
        <Icon icon={CATEGORY_ICON[r.category]} size={14} />
      </span>
    );

  const notes = [
    legalCount > 0
      ? "This entry records authority information. It is not a preview of a signed legal document."
      : typedStatus && typedStatus !== "Voluntary"
        ? "Legal status alone does not establish an order document."
        : undefined,
    rows.some((r) => r.category !== "Legal")
      ? "Document metadata only. No uploaded file or binary preview is stored in this prototype."
      : undefined,
    "A document entry does not establish medical clearance, travel fitness or a completed handover.",
  ].filter(Boolean);

  return (
    <section className={styles.pane} aria-label="Documents and legal authority" data-layout="documents">
      <Card>
        <CardHead level={2} icon={FileText} title="Documents" action={!isPhone ? recordButton : undefined} />

        <dl className={styles.strip}>
          <div className={styles.fact}>
            <dt>Legal status</dt>
            <dd>{legalStatus ?? <span className={styles.quiet}>Not recorded</span>}</dd>
          </div>
          <div className={styles.fact}>
            <dt>Form in force</dt>
            <dd>
              {inForce ? (
                <span className={styles.inForce}>
                  <StatusGlyph tone="success" size={9} />
                  <span>
                    Form {inForce.code}
                    <span className={styles.formTitle}> {inForce.title}</span>
                  </span>
                </span>
              ) : toRecord ? (
                <span className={styles.inForce}>
                  <StatusGlyph tone="warning" size={9} />
                  <span>
                    None in force
                    <span className={styles.formTitle}> · Form {toRecord.code} to record</span>
                  </span>
                </span>
              ) : (
                <span className={styles.quiet}>None recorded</span>
              )}
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>On file</dt>
            <dd>
              {total > 0 ? (
                <>
                  {total} <span className={styles.formTitle}>{total === 1 ? "document" : "documents"}</span>
                  {episodeCount > 1 ? <span className={styles.formTitle}> · {episodeCount} episodes</span> : null}
                </>
              ) : (
                <span className={styles.quiet}>None</span>
              )}
            </dd>
          </div>
        </dl>

        {rows.length === 0 ? (
          <p className={styles.emptyAll}>No documents recorded</p>
        ) : (
          <>
            <div className={styles.toolbar}>
              <SearchField
                className={styles.search}
                label="Search documents"
                placeholder="Title, form, source or who recorded it"
                value={query}
                onValueChange={setQuery}
              />
              {categories.length > 1 ? (
                <ChipGroup label="Category" className={styles.chips}>
                  <FilterChip
                    pressed={category === "All"}
                    onPressedChange={() => setCategory("All")}
                    count={searched.filter((r) => !r.pending).length}
                  >
                    All
                  </FilterChip>
                  {categories.map((c) => (
                    <FilterChip
                      key={c}
                      pressed={category === c}
                      onPressedChange={(pressed) => setCategory(pressed ? c : "All")}
                      count={categoryCounts.get(c) ?? 0}
                    >
                      {c}
                    </FilterChip>
                  ))}
                </ChipGroup>
              ) : null}
              <Segmented
                className={styles.groupBy}
                label="Group documents"
                value={groupBy}
                onChange={setGroupBy}
                items={[
                  { id: "episode", label: "By episode" },
                  { id: "type", label: "By type" },
                ]}
              />
            </div>

            {shown.length === 0 ? (
              <p className={styles.noMatch} role="status">
                <span>No documents match.</span>
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  Clear search
                </Button>
              </p>
            ) : (
              <table className={styles.table} aria-label="Document register">
                <thead>
                  <tr>
                    <th scope="col" className={styles.chipCol}>
                      <span className={styles.srOnly}>Form or type</span>
                    </th>
                    <th scope="col">Document</th>
                    <th scope="col">Source</th>
                    <th scope="col">Date</th>
                    <th scope="col">Recorded by</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                {groups.map((g) => (
                  <tbody key={g.key}>
                    <tr className={styles.groupRow}>
                      <th scope="rowgroup" colSpan={6}>
                        <span className={styles.groupHead}>
                          {g.icon ? <Icon icon={g.icon} size={14} /> : null}
                          <span className={styles.groupTitle}>{g.label}</span>
                          <Count n={g.rows.length} />
                          {g.aside ? <span className={styles.groupAside}>{g.aside}</span> : null}
                        </span>
                      </th>
                    </tr>
                    {g.rows.map((r) => (
                      <tr
                        key={r.key}
                        className={styles.row}
                        data-quiet={isQuietStatus(r.status) || undefined}
                        data-urgent={(r.standing && (standing === "passed" || standing === "urgent")) || undefined}
                      >
                        <td className={styles.chipCell}>{codeChip(r)}</td>
                        <th scope="row" className={styles.titleCell}>
                          <span className={styles.title}>{r.title}</span>
                          {r.sub ? <span className={styles.sub}>{r.sub}</span> : null}
                        </th>
                        <td className={styles.sourceCell}>{r.source ?? <span className={styles.quiet}>—</span>}</td>
                        <td className={styles.dateCell}>
                          {r.pending ? (
                            <span className={styles.quiet}>—</span>
                          ) : (
                            (r.dateText ?? <span className={styles.quiet}>Not recorded</span>)
                          )}
                        </td>
                        <td className={styles.byCell}>
                          {r.pending ? (
                            <span className={styles.quiet}>—</span>
                          ) : (
                            (r.by ?? <span className={styles.quiet}>Not recorded</span>)
                          )}
                        </td>
                        <td className={styles.statusTd}>{statusCell(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            )}
            {filtering && shown.length > 0 ? (
              <p className={styles.countLine} aria-live="polite">
                {shown.length} of {rows.length} shown
              </p>
            ) : null}
          </>
        )}

        <p className={styles.notes}>
          {notes.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </p>
        {isPhone && recordButton ? <div className={styles.phoneAction}>{recordButton}</div> : null}
      </Card>
    </section>
  );
}

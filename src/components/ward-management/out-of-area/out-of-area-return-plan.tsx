"use client";

import { legalFormNameLabelFirst } from "@/components/ward-management/ward-legal-forms";
import Link from "next/link";
import type { ReactNode } from "react";
import { BedDouble, Car, Check, Clock, House, Plane } from "lucide-react";

import {
  Button,
  Field,
  Icon,
  Select,
  SrOnly,
  StatusGlyph,
  StatusLine,
  TextInput,
  buttonClass,
  cx,
} from "@/components/wf";
import type { Instant } from "@/components/ward-management/ward-clock";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { TRAVEL_BAND_LABELS } from "@/components/ward-management/ward-distance";
import type { RepatriationRecord } from "@/components/ward-management/ward-flow-reducer";
import {
  BOOKABLE_TRANSPORT_PROVIDERS,
  TRANSPORT_LEGAL_STATUSES,
  type TransportLegalStatus,
  type TravelMode,
} from "@/components/ward-management/ward-model";
import type { OutOfAreaEntry } from "@/components/ward-management/ward-referrals";
import { siteByCode, siteDirectory } from "@/components/ward-management/ward-sites";

import {
  PLAN_STEPS,
  TRAVEL_SHORT,
  confirmedAgeText,
  dischargeShort,
  missingAnswers,
  shortSiteName,
  type BedOption,
  type RepatDraft,
} from "./out-of-area-model";
import styles from "./out-of-area-board.module.css";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { cadNumberProblem } from "@/components/ward-management/ward-cad-number";
import { HomeServiceReturnPanel } from "./home-service-return-panel-lazy";

export function returnPlanMissingToSend(draft: RepatDraft, now: Instant = 0): string[] {
  return missingAnswers(draft, now).filter((answer) => answer !== "ward agreement");
}

export function canSendReturnPlan(draft: RepatDraft, now: Instant = 0): boolean {
  return returnPlanMissingToSend(draft, now).length === 0;
}

export function returnPlanBlockReason(draft: RepatDraft, now: Instant = 0): string | undefined {
  const missing = returnPlanMissingToSend(draft, now);
  return missing.length ? `Answer the ${missing.length} left first.` : undefined;
}

export type PlanPatient = {
  displayName: string;
  umrn: string;
  profileHref: string | null;
  /** Audit A3-18: the short legal word ("Form 6A", "Voluntary"), and whether they are on an order. */
  legal?: string;
  onOrder?: boolean;
};

const WA_SERVICE_ORDER = ["North Metro", "South Metro", "East Metro", "WACHS", "CAHS", "Private"] as const;

const SERVICE_DISPLAY_NAMES: Record<string, string> = {
  "North Metro": "North Metropolitan Health Service (NMHS)",
  "South Metro": "South Metropolitan Health Service (SMHS)",
  "East Metro": "East Metropolitan Health Service (EMHS)",
  WACHS: "WA Country Health Service (WACHS)",
  CAHS: "Child and Adolescent Health Service (CAHS)",
  Private: "Authorised Private Services",
};

const LEGAL_LABELS: Record<TransportLegalStatus, string> = { voluntary: "Voluntary", involuntary: "Involuntary" };

function hospitalGroups() {
  const groups = new Map<string, { service: string; sites: { code: string; name: string }[] }>();
  for (const service of WA_SERVICE_ORDER) groups.set(service, { service, sites: [] });
  for (const site of siteDirectory) {
    if (!groups.has(site.service)) groups.set(site.service, { service: site.service, sites: [] });
    groups.get(site.service)!.sites.push({ code: site.code, name: site.name });
  }
  return [...groups.values()].filter((group) => group.sites.length > 0);
}

export function TravelIcon({ entry, size = 14 }: { entry: OutOfAreaEntry; size?: 14 | 16 }) {
  return <Icon icon={entry.band === "air_transport_only" ? Plane : Car} size={size} />;
}

/**
 * Pill radios built on native inputs, so each answer keeps its label, its keyboard behaviour and
 * its place in the form. The input is visually hidden; the label is the pill.
 */
function ChoicePills<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  testId,
}: {
  legend: string;
  name: string;
  value: T | undefined;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  testId?: string;
}) {
  return (
    <fieldset className={styles.formRow} data-testid={testId}>
      <legend className={styles.formLabel}>{legend}</legend>
      <span className={styles.choice}>
        {options.map((option) => (
          <label key={option.value} className={styles.choiceItem}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </span>
    </fieldset>
  );
}

/** #177: the plan's warning when Form 4C is not confirmed or the escort is not answered. */
function involuntaryWarning(form4CReceived: boolean | undefined, escortRequired: boolean | undefined): string {
  const form4C = form4CReceived === false ? "Form 4C not received" : "Form 4C not confirmed";
  if (form4CReceived !== true && escortRequired === undefined) return `${form4C} and escort not answered`;
  return form4CReceived !== true ? form4C : "Escort not answered";
}

function StepHead({ n, title, left }: { n: number; title: string; left: string[] }) {
  return (
    <div className={styles.stepHead}>
      {left.length === 0 ? (
        <span className={cx(styles.stepN, styles.stepDone)} aria-hidden="true">
          <Icon icon={Check} size={14} />
        </span>
      ) : (
        <span className={styles.stepN} aria-hidden="true">
          {n}
        </span>
      )}
      <h4 className={styles.stepTitle}>{title}</h4>
      <span className={styles.stepLeft} title={left.length ? `Still needed: ${left.join(", ")}` : undefined}>
        {left.length ? `${left.length} to answer` : "Done"}
      </span>
    </div>
  );
}

/** Whose move it is, in one line. Facts from the record and the draft only. */
export function whoseMove(draft: RepatDraft, record: RepatriationRecord | undefined): { who: string; what: string } {
  if (record?.receivingWardAgreed) {
    return { who: "Bed coordinator", what: `places the return at ${shortSiteName(record.homeHospital)}` };
  }
  if (record) return { who: "Receiving ward", what: `to agree the return to ${shortSiteName(record.homeHospital)}` };
  if (!draft.homeHospital)
    return { who: "Bed coordinator", what: "to choose a receiving bed and confirm ward agreement" };
  if (draft.receivingWardAgreed !== true)
    return { who: "Receiving ward", what: "to confirm ward agreement, then book transport" };
  return { who: "Bed coordinator", what: "to book transport and record the return" };
}

export type ReturnPlanProps = {
  entry: OutOfAreaEntry;
  patient: PlanPatient;
  daysLabel: string;
  dischargeOffset: number | null;
  now: Instant;
  draft: RepatDraft;
  onDraft: (update: Partial<RepatDraft>) => void;
  record: RepatriationRecord | undefined;
  returnMovementId: string | undefined;
  options: BedOption[];
  notice: string | null;
  onDismissNotice: () => void;
  onRecord: () => void;
  onSendToWard?: () => void;
  onMarkWardAgreed?: () => void;
  /** The plan's own header (desktop card head, or nothing inside the phone sheet). */
  header?: ReactNode;
  /** Keeps radio group names unique if the plan is ever mounted twice. */
  idPrefix: string;
  /** Phone: show the person's name and UMRN inside the facts, since the sheet header carries them. */
  compactIdentity?: boolean;
};

/**
 * The selected person's return plan: who moves next, the facts, then three steps that end in one
 * `RECORD_REPATRIATION`. The page owns the draft and the dispatch; this component only renders.
 */
export function ReturnPlan({
  entry,
  patient,
  daysLabel,
  dischargeOffset,
  now,
  draft,
  onDraft,
  record,
  returnMovementId,
  options,
  notice,
  onDismissNotice,
  onRecord,
  onSendToWard,
  onMarkWardAgreed,
  header,
  idPrefix,
  compactIdentity = false,
}: ReturnPlanProps) {
  const site = siteByCode(entry.unit.siteCode);
  const missing = missingAnswers(draft, now);
  // A typed CAD number the rule refuses is named beside the field; blank stays a plain "missing".
  const cadProblem = draft.cadNumber.trim() ? cadNumberProblem(draft.cadNumber) : undefined;
  const cadError = cadProblem ? `${cadProblem.charAt(0).toUpperCase()}${cadProblem.slice(1)}.` : undefined;
  const move = whoseMove(draft, record);
  const isAir = entry.band === "air_transport_only";
  const optionCodes = new Set(options.map((option) => option.siteCode));
  const groups = hospitalGroups();
  const overdue = dischargeOffset !== null && dischargeOffset < 0;

  return (
    <>
      {header}
      <p className={styles.whoStrip} data-testid="ward-out-of-area-subject-caveat">
        <StatusGlyph tone={record?.receivingWardAgreed || draft.homeHospital ? "neutral" : "closed"} size={9} />
        <b>{move.who}</b>
        <span>{move.what}</span>
      </p>
      <div data-testid="ward-out-of-area-subject-facts" className={styles.planFacts}>
        <p className={cx(styles.planIdentity, compactIdentity ? undefined : "sr-only")}>
          <b>{patient.displayName}</b>
          {patient.profileHref ? (
            <Link href={patient.profileHref} className={styles.umrnLink}>
              {patient.umrn}
            </Link>
          ) : (
            <span className={styles.mono}>{patient.umrn}</span>
          )}
        </p>
        <dl className={styles.facts}>
          <div>
            <dt>Away</dt>
            <dd className={styles.factFigure}>{daysLabel}</dd>
          </div>
          <div>
            <dt>Travel</dt>
            <dd title={TRAVEL_BAND_LABELS[entry.band]}>
              <TravelIcon entry={entry} />
              <span aria-hidden="true">{TRAVEL_SHORT[entry.band]}</span>
              <SrOnly>{TRAVEL_BAND_LABELS[entry.band]}</SrOnly>
            </dd>
          </div>
          <div>
            <dt>Legal</dt>
            <dd data-testid="ward-out-of-area-plan-legal">{patient.legal ?? "Not recorded"}</dd>
          </div>
          <div>
            <dt>Discharge</dt>
            <dd className={overdue ? styles.inkWarning : undefined}>
              {overdue ? <StatusGlyph tone="warning" size={9} /> : null}
              {dischargeShort(dischargeOffset)}
            </dd>
          </div>
        </dl>
        <dl className={styles.placeLine}>
          <dt>
            <Icon icon={BedDouble} size={14} />
            <SrOnly>Current placement</SrOnly>
          </dt>
          <dd className={styles.placeUnit} title={`${entry.unit.name}, ${site?.name ?? "site not recorded"}`}>
            <b>{entry.unit.name}</b> · {site ? shortSiteName(site.code) : "Site not recorded"}
          </dd>
          <dt>
            <Icon icon={House} size={14} />
            <SrOnly>Home region</SrOnly>
          </dt>
          <dd>
            <b>{entry.admission.homeRegion}</b>
          </dd>
        </dl>
        {entry.admission.blockReason ? (
          <p className={styles.placeLine}>
            <StatusGlyph tone="warning" size={9} />
            <span className={styles.inkWarning}>{entry.admission.blockReason}</span>
            <span className={styles.placeNote}>From the ward</span>
          </p>
        ) : null}
      </div>

      {notice ? (
        <div className={styles.notice} data-testid="ward-out-of-area-repat-notice">
          <StatusLine
            tone="success"
            title={notice}
            actions={
              <Button variant="ghost" size="sm" onClick={onDismissNotice} aria-label="Dismiss notice">
                Dismiss
              </Button>
            }
          />
        </div>
      ) : null}

      {/* Closing-the-loop (package E): return requested vs home service agreed, recorded apart. */}
      <HomeServiceReturnPanel
        key={entry.admission.id}
        admissionId={entry.admission.id}
        presetHospital={record?.homeHospital ?? (draft.homeHospital || undefined)}
      />

      {record ? (
        <RecordedReturn
          record={record}
          returnMovementId={returnMovementId}
          now={now}
          onMarkWardAgreed={onMarkWardAgreed}
        />
      ) : (
        <>
          <div className={styles.steps}>
            <section className={styles.planStep} aria-label="Step 1, receiving bed">
              <StepHead
                n={1}
                title={PLAN_STEPS[0].title}
                left={missing.filter((m) => PLAN_STEPS[0].answers.includes(m as never))}
              />
              {options.length ? (
                <fieldset className={styles.options}>
                  <legend className={styles.optionsLegend}>Shorter travel recorded, same cohort</legend>
                  {options.map((option) => (
                    <label key={option.unit.id} className={styles.option}>
                      <input
                        type="radio"
                        name={`${idPrefix}-receiving`}
                        value={option.siteCode}
                        checked={draft.homeHospital === option.siteCode}
                        onChange={() => onDraft({ homeHospital: option.siteCode })}
                      />
                      <span className={styles.two}>
                        <b>{shortSiteName(option.siteCode)}</b>
                        <span>
                          {option.unit.name} · {TRAVEL_SHORT[option.band]}
                        </span>
                      </span>
                      <span className={styles.optionBeds}>
                        <span className={styles.count}>{option.beds}</span>
                        {option.beds === 1 ? "bed" : "beds"}
                        <span className={cx(styles.mono, option.stale && styles.inkWarning)}>
                          {option.stale ? "stale " : ""}
                          {confirmedAgeText(option.ageMinutes)}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                <p className={styles.planHint}>
                  <StatusGlyph tone="closed" size={9} />
                  {entry.band === "air_transport_only"
                    ? "Air only placement, travel times are not compared"
                    : `No shorter travel recorded for ${entry.admission.homeRegion}`}
                </p>
              )}
              <Field label={options.length ? "Other" : "Hospital"} className={styles.formRow}>
                <Select
                  data-testid="ward-out-of-area-repat-home-hospital"
                  value={optionCodes.has(draft.homeHospital) ? "" : draft.homeHospital}
                  onChange={(event) => onDraft({ homeHospital: event.target.value })}
                >
                  <option value="">{options.length ? "Other hospital" : "Choose the receiving hospital"}</option>
                  {groups.map((group) => (
                    <optgroup key={group.service} label={SERVICE_DISPLAY_NAMES[group.service] ?? group.service}>
                      {group.sites.map((hospital) => (
                        <option key={hospital.code} value={hospital.code}>
                          {hospital.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </Field>
              <ChoicePills
                legend="Ward agreed"
                name={`${idPrefix}-agreed`}
                testId="ward-out-of-area-repat-ward-agreed"
                value={draft.receivingWardAgreed === undefined ? undefined : draft.receivingWardAgreed ? "yes" : "no"}
                options={[
                  { value: "yes", label: "Agreed" },
                  { value: "no", label: "Not yet" },
                ]}
                onChange={(value) => onDraft({ receivingWardAgreed: value === "yes" })}
              />
            </section>

            <section className={styles.planStep} aria-label="Step 2, transport">
              <StepHead
                n={2}
                title={PLAN_STEPS[1].title}
                left={missing.filter((m) => PLAN_STEPS[1].answers.includes(m as never))}
              />
              <ChoicePills
                legend="Travel by"
                name={`${idPrefix}-mode`}
                testId="ward-out-of-area-repat-mode"
                value={draft.mode || undefined}
                options={[
                  { value: "road", label: "Road" },
                  { value: "flight", label: "Flight" },
                ]}
                onChange={(mode) => onDraft({ mode })}
              />
              {isAir && draft.mode === "road" ? (
                <p className={cx(styles.planHint, styles.inkWarning)}>
                  <StatusGlyph tone="warning" size={9} />
                  The recorded band is air only for this trip
                </p>
              ) : null}
              <Field label="Provider" className={styles.formRow}>
                <Select
                  data-testid="ward-out-of-area-repat-provider"
                  value={draft.provider ?? ""}
                  onChange={(event) => {
                    const next = event.target.value;
                    onDraft({
                      provider: BOOKABLE_TRANSPORT_PROVIDERS.includes(next as TravelMode)
                        ? (next as TravelMode)
                        : undefined,
                    });
                  }}
                >
                  <option value="">Choose the provider</option>
                  {BOOKABLE_TRANSPORT_PROVIDERS.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </Select>
              </Field>
              <ChoicePills
                legend="Legal status"
                name={`${idPrefix}-legal`}
                testId="ward-out-of-area-repat-legal"
                value={draft.transportLegalStatus}
                // Audit S-4: a patient on an order returns as involuntary; the record refuses Voluntary.
                options={TRANSPORT_LEGAL_STATUSES.filter((status) => !patient.onOrder || status === "involuntary").map(
                  (status) => ({ value: status, label: LEGAL_LABELS[status] }),
                )}
                onChange={(transportLegalStatus) => onDraft({ transportLegalStatus })}
              />
              {patient.onOrder ? (
                <p className={styles.legalNeed} data-testid="ward-out-of-area-plan-needs-form">
                  On an order: needs {legalFormNameLabelFirst({ code: "4C" })}
                </p>
              ) : null}
              {/* #177 (Josh, 27 Oct 2026): an involuntary return asks for Form 4C and the escort.
                  Both open blank and are saved on the return. Unanswered is a warning, never a block. */}
              {patient.onOrder || draft.transportLegalStatus === "involuntary" ? (
                <>
                  <ChoicePills
                    legend="Form 4C received?"
                    name={`${idPrefix}-form-4c`}
                    testId="ward-out-of-area-repat-form-4c"
                    value={draft.form4CReceived === undefined ? undefined : draft.form4CReceived ? "yes" : "no"}
                    options={[
                      { value: "yes", label: "Yes" },
                      { value: "no", label: "No" },
                    ]}
                    onChange={(answer) => onDraft({ form4CReceived: answer === "yes" })}
                  />
                  <ChoicePills
                    legend="Escort needed for the journey?"
                    name={`${idPrefix}-escort`}
                    testId="ward-out-of-area-repat-escort"
                    value={draft.escortRequired === undefined ? undefined : draft.escortRequired ? "yes" : "no"}
                    options={[
                      { value: "yes", label: "Escort required" },
                      { value: "no", label: "No escort required" },
                    ]}
                    onChange={(answer) => onDraft({ escortRequired: answer === "yes" })}
                  />
                  {draft.form4CReceived !== true || draft.escortRequired === undefined ? (
                    <p
                      className={cx(styles.planHint, styles.inkWarning)}
                      data-testid="ward-out-of-area-repat-involuntary-warning"
                    >
                      <StatusGlyph tone="warning" size={9} />
                      {involuntaryWarning(draft.form4CReceived, draft.escortRequired)}
                    </p>
                  ) : null}
                </>
              ) : null}
            </section>

            <section className={styles.planStep} aria-label="Step 3, dispatch">
              <StepHead
                n={3}
                title={PLAN_STEPS[2].title}
                left={missing.filter((m) => PLAN_STEPS[2].answers.includes(m as never))}
              />
              <Field label="CAD number" className={styles.formRow} error={cadError}>
                <TextInput
                  data-testid="ward-out-of-area-repat-cad"
                  className={styles.mono}
                  placeholder="CAD number"
                  autoComplete="off"
                  value={draft.cadNumber}
                  onChange={(event) => onDraft({ cadNumber: event.target.value })}
                />
              </Field>
              <Field label="Depart" className={styles.formRow}>
                <TextInput
                  icon={Clock}
                  inputMode="numeric"
                  placeholder="HH:MM"
                  className={styles.mono}
                  data-testid="ward-out-of-area-repat-estimated-time"
                  value={draft.estimatedTime}
                  onChange={(event) => onDraft({ estimatedTime: event.target.value })}
                />
              </Field>
              <ChoicePills
                legend="Depart day"
                name={`${idPrefix}-day`}
                testId="ward-out-of-area-repat-estimated-day"
                value={draft.estimatedDay}
                options={[
                  { value: "today", label: "Today" },
                  { value: "tomorrow", label: "Tomorrow" },
                ]}
                onChange={(estimatedDay) => onDraft({ estimatedDay })}
              />
            </section>
          </div>
          <div className={styles.planFoot}>
            <span className={styles.need} title={missing.length ? `Still needed: ${missing.join(", ")}` : undefined}>
              {missing.length ? (
                <>
                  <span className={styles.count}>{missing.length}</span> to answer
                </>
              ) : (
                <>
                  <StatusGlyph tone="success" size={10} /> Ready to record
                </>
              )}
            </span>
            <Button
              variant="sec"
              size="sm"
              data-testid="ward-out-of-area-repat-send"
              disabledReason={returnPlanBlockReason(draft, now)}
              title={returnPlanBlockReason(draft, now)}
              reasonDisplay="tooltip"
              onClick={onSendToWard}
            >
              Record sent to ward
            </Button>
            <Button
              variant="pri"
              size="sm"
              data-testid="ward-out-of-area-repat-submit"
              disabledReason={missing.length ? `Answer the ${missing.length} left first.` : undefined}
              reasonDisplay="tooltip"
              onClick={onRecord}
            >
              Record return
            </Button>
          </div>
        </>
      )}
    </>
  );
}

function RecordedReturn({
  record,
  returnMovementId,
  now,
  onMarkWardAgreed,
}: {
  record: RepatriationRecord;
  returnMovementId: string | undefined;
  now: Instant;
  onMarkWardAgreed?: () => void;
}) {
  return (
    <div className={styles.doneBox} data-testid="ward-out-of-area-recorded">
      <p className={styles.doneHead}>
        <StatusGlyph tone="success" size={10} />
        <b>Return recorded</b>
        <span className={styles.mono}>{formatInstantWithDay(record.at, now)}</span>
        <span className={styles.placeNote}>Coordinator</span>
      </p>
      <dl className={styles.kv}>
        <dt>Receiving</dt>
        <dd>{siteByCode(record.homeHospital)?.name ?? record.homeHospital}</dd>
        <dt>Ward</dt>
        <dd>{record.receivingWardAgreed ? "Agreed" : "Not yet agreed"}</dd>
        <dt>Transport</dt>
        <dd>
          {record.mode === "road" ? "Road" : "Flight"} · {record.provider}
        </dd>
        <dt>Legal status</dt>
        <dd>{LEGAL_LABELS[record.transportLegalStatus]}</dd>
        {record.transportLegalStatus === "involuntary" ? (
          <>
            <dt>Form 4C</dt>
            <dd data-testid="ward-out-of-area-recorded-form-4c">
              {record.form4CReceived === undefined
                ? "Not answered"
                : record.form4CReceived
                  ? "Received"
                  : "Not received"}
            </dd>
            <dt>Escort</dt>
            <dd data-testid="ward-out-of-area-recorded-escort">
              {record.escortRequired === undefined
                ? "Not answered"
                : record.escortRequired
                  ? "Escort required"
                  : "No escort required"}
            </dd>
          </>
        ) : null}
        <dt>CAD</dt>
        <dd className={styles.mono}>{record.cadNumber}</dd>
        <dt>Depart</dt>
        <dd className={styles.mono}>{formatInstantWithDay(record.estimatedAt, now)}</dd>
      </dl>
      <div className={styles.planFoot}>
        {record.receivingWardAgreed ? (
          <>
            <span className={styles.need}>
              <StatusGlyph tone="neutral" size={10} /> Movement opened
            </span>
            {returnMovementId ? (
              <Link className={buttonClass({ variant: "sec", size: "sm" })} href={movementHref(returnMovementId)}>
                Open movement
              </Link>
            ) : null}
          </>
        ) : (
          <>
            <span className={styles.need}>
              <StatusGlyph tone="neutral" size={10} /> Awaiting the receiving ward
            </span>
            <Button variant="sec" size="sm" data-testid="ward-out-of-area-mark-ward-agreed" onClick={onMarkWardAgreed}>
              Mark ward agreed
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";

import {
  destinationOptions,
  communityTeamOptionsForSuburb,
  suburbOptions,
} from "@/components/ward-management/referrals/referral-destination-options";
import {
  NOT_RECORDED_VALUE,
  NO_DIAGNOSIS_VALUE,
  SOURCE_LABELS,
  UNANSWERED_VALUE,
  answeredDraft,
  answeredProgress,
  initialDraft,
  patientDraftPrefill,
  unansweredFieldNames,
  urgencyWindowLabel,
  wardAndCommunityBothChosen,
  type ReferralDraft,
} from "@/components/ward-management/referrals/referral-intake";
import { formatSheetMoment } from "@/components/ward-management/ward-clock";
import { TENTATIVE_DIAGNOSIS_BLOCKS, type TentativeDiagnosisBlock } from "@/components/ward-management/ward-diagnosis";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import {
  COHORTS,
  HOME_REGIONS,
  RECORDED_SEXES,
  REFERRAL_GENDERS,
  REFERRAL_HISTORY_LIMITS,
  REFERRAL_SOURCES,
  SUBURB_UNKNOWN_REASONS,
  URGENCY_LEVELS,
  suburbUnknownLabels,
  type ReferralDestinationKind,
  type WardReferralDestination,
} from "@/components/ward-management/ward-model";
import type { PatientId } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { allEmergencyDepartments, wardSites } from "@/components/ward-management/ward-sites";

import { Panel, PreviewBar, PROPOSAL_ROUTES, ProposalHeader, plural } from "./flow-proposal-parts";
import styles from "./flow-proposal.module.css";

const SUBURBS = suburbOptions();

/** The shared destination figures say "referral(s)"; this screen says it properly. */
function readableFigure(figure: string): string {
  return figure.replace(/\b1 referral\(s\) are\b/, "1 referral is").replace(/referral\(s\)/g, "referrals");
}
const UNKNOWN_SUBURB = SUBURB_UNKNOWN_REASONS[0];

function Step({
  number,
  title,
  done,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <section className={styles.panel} aria-labelledby={`intake-step-${number}`}>
      <div className={styles.panelHead}>
        <div className={styles.stepHead}>
          <span className={`${styles.stepNumber} ${done ? styles.stepDone : ""}`} aria-hidden="true">
            {done ? "✓" : number}
          </span>
          <h2 id={`intake-step-${number}`} className={styles.panelTitle}>
            {title}
          </h2>
        </div>
        <span className={styles.panelMeta}>{done ? "Answered" : "Still to answer"}</span>
      </div>
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}

function YesNo({
  name,
  label,
  hint,
  value,
  onChange,
}: {
  name: string;
  label: string;
  hint: string;
  value: boolean | typeof UNANSWERED_VALUE;
  onChange: (next: boolean) => void;
}) {
  return (
    <fieldset className={styles.formField}>
      <legend>{label}</legend>
      <p className={styles.fieldHint}>{hint}</p>
      <div className={styles.choices}>
        {[false, true].map((option) => (
          <label key={String(option)} className={styles.choice}>
            <input type="radio" name={name} checked={value === option} onChange={() => onChange(option)} />
            {option ? "Yes" : "No"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Proposed "Make a referral" screen. The same draft, the same completeness rule and the same
 * `RECEIVE_REFERRAL` event as the current form (`referral-intake.tsx`, whose helpers are reused
 * rather than copied), laid out as four short steps with a live checklist beside them, so the
 * person raising it always sees what is still needed before Send works.
 */
export function ReferralIntakeProposal() {
  const { units, referrals, patients = [], movements, rejections, dispatch, dayZero } = useWardFlow();
  const now = useWardFlowClock();
  const [draft, setDraft] = useState<ReferralDraft>(() => initialDraft());
  const [umrn, setUmrn] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const pending = useRef<{ rejections: number; referrals: number } | null>(null);

  const set = <K extends keyof ReferralDraft>(key: K, value: ReferralDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const linked = useMemo(
    () => patients.find((patient) => patient.umrn.toLowerCase() === umrn.trim().toLowerCase()),
    [patients, umrn],
  );
  const linkedInfo = linked
    ? resolveSubjectPatient({ patientId: linked.id }, { patients, referrals, movements })
    : undefined;

  const answered = answeredDraft(draft);
  const missing = unansweredFieldNames(draft);
  const { answered: done, applicable: total } = answeredProgress(draft);

  const wardNeed: WardReferralDestination | null =
    draft.sex !== UNANSWERED_VALUE &&
    draft.secureBedNeeded !== UNANSWERED_VALUE &&
    draft.involuntaryBedNeeded !== UNANSWERED_VALUE &&
    draft.highAcuityNursingNeeded !== UNANSWERED_VALUE
      ? {
          kind: "psychiatric_ward",
          sex: draft.sex,
          gender: draft.gender === UNANSWERED_VALUE || draft.gender === NOT_RECORDED_VALUE ? undefined : draft.gender,
          secureBedNeeded: draft.secureBedNeeded,
          involuntaryBedNeeded: draft.involuntaryBedNeeded,
          highAcuityNursingNeeded: draft.highAcuityNursingNeeded,
        }
      : null;
  const suburbForCatchment =
    draft.suburb === UNANSWERED_VALUE || (SUBURB_UNKNOWN_REASONS as readonly string[]).includes(draft.suburb)
      ? null
      : draft.suburb;
  const options = destinationOptions({
    suburb: suburbForCatchment,
    ward: wardNeed,
    ageBand: draft.ageBand === UNANSWERED_VALUE ? null : draft.ageBand,
    units,
    referrals,
    now,
  });
  const teams = communityTeamOptionsForSuburb(suburbForCatchment);
  const site = wardSites.find((candidate) => candidate.code === draft.originSiteCode);
  const bothRefused = wardAndCommunityBothChosen(draft.destinationKinds);

  useEffect(() => {
    if (!pending.current) return;
    const before = pending.current;
    pending.current = null;
    if (rejections.length > before.rejections)
      setSent(`Not sent: ${rejections.at(-1)?.reason ?? "the referral was refused"}.`);
    else if (referrals.length > before.referrals) {
      setSent("Referral sent. It is now on the referral board, waiting for a decision.");
      setDraft(initialDraft());
      setUmrn("");
    }
  }, [rejections, referrals]);

  function toggleDestination(kind: ReferralDestinationKind) {
    setDraft((current) => ({
      ...current,
      destinationKinds: current.destinationKinds.includes(kind)
        ? current.destinationKinds.filter((entry) => entry !== kind)
        : [...current.destinationKinds, kind],
    }));
  }

  function linkPatient(next: string) {
    setUmrn(next);
    const match = patients.find((patient) => patient.umrn.toLowerCase() === next.trim().toLowerCase());
    if (!match) return;
    setDraft((current) => ({ ...current, ...patientDraftPrefill(match) }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answered) return;
    pending.current = { rejections: rejections.length, referrals: referrals.length };
    setSent(null);
    dispatch({
      type: "RECEIVE_REFERRAL",
      role: answered.source === "ed_medical" ? "ed" : "community",
      now,
      patientId: linked ? (linked.id as PatientId) : undefined,
      ageBand: answered.ageBand,
      suburb: answered.suburb,
      destinations: answered.destinations,
      homeRegion: answered.homeRegion,
      source: answered.source,
      sendingTeamName: draft.sendingTeamName.trim() === "" ? undefined : draft.sendingTeamName.trim(),
      urgency: answered.urgency,
      originSiteCode: answered.originSiteCode,
      originUnitId: answered.originUnitId,
      transportNeeded: answered.transportNeeded,
      tentativeDiagnosis: answered.tentativeDiagnosis,
      history: draft.history,
    });
  }

  const step1 =
    draft.ageBand !== UNANSWERED_VALUE &&
    draft.sex !== UNANSWERED_VALUE &&
    draft.gender !== UNANSWERED_VALUE &&
    draft.homeRegion !== UNANSWERED_VALUE &&
    draft.suburb !== UNANSWERED_VALUE;
  const step2 =
    draft.source !== UNANSWERED_VALUE &&
    draft.originSiteCode !== UNANSWERED_VALUE &&
    draft.urgency !== UNANSWERED_VALUE &&
    (draft.source !== "psychiatric_ward" || draft.originUnitId !== UNANSWERED_VALUE);
  const step3 = wardNeed !== null && draft.transportNeeded !== UNANSWERED_VALUE;
  const step4 =
    draft.destinationKinds.length > 0 &&
    !bothRefused &&
    missing.every((name) => name !== "Emergency department" && name !== "Community team");

  return (
    <>
      <PreviewBar screen="intake" />
      <main id="main-content" className={styles.page} data-testid="flow-proposal-intake">
        <ProposalHeader
          crumbs={[{ label: "Care coordination" }, { label: "Make a referral" }]}
          title="Make a referral"
          asAt={`As at ${formatSheetMoment(now, dayZero)}`}
          actions={
            <a className={styles.buttonQuiet} href={PROPOSAL_ROUTES.board.href}>
              Open the referral board
            </a>
          }
        />

        <form className={styles.formGrid} onSubmit={submit} noValidate>
          <div className={styles.stack}>
            <Panel
              title="The person"
              question="Link a patient record if there is one. A referral can also be sent without one."
            >
              <div className={styles.fields}>
                <div className={styles.formField}>
                  <label htmlFor="intake-umrn">Record number (UMRN)</label>
                  <input
                    id="intake-umrn"
                    className={styles.input}
                    value={umrn}
                    onChange={(event) => linkPatient(event.target.value)}
                    placeholder="e.g. UM100044"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <p className={styles.fieldHint} role="status" style={{ alignSelf: "end" }}>
                  {linkedInfo
                    ? `Linked to ${linkedInfo.initials} (${linkedInfo.umrn}). Sex and gender filled from the record.`
                    : umrn.trim()
                      ? "No record has that number."
                      : "No record linked."}
                </p>
              </div>
            </Panel>

            <Step number={1} title="Who the referral is about" done={step1}>
              <div className={styles.fields}>
                <fieldset className={`${styles.formField} ${styles.fieldWide}`}>
                  <legend>Age band</legend>
                  <div className={styles.choices}>
                    {COHORTS.map((cohort) => (
                      <label key={cohort} className={styles.choice}>
                        <input
                          type="radio"
                          name="intake-age"
                          checked={draft.ageBand === cohort}
                          onChange={() => set("ageBand", cohort)}
                        />
                        {cohort}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className={styles.formField}>
                  <legend>Sex</legend>
                  <div className={styles.choices}>
                    {RECORDED_SEXES.map((sex) => (
                      <label key={sex} className={styles.choice}>
                        <input
                          type="radio"
                          name="intake-sex"
                          checked={draft.sex === sex}
                          onChange={() => set("sex", sex)}
                        />
                        {sex}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className={styles.formField}>
                  <label htmlFor="intake-gender">Gender</label>
                  <select
                    id="intake-gender"
                    className={styles.fieldSelect}
                    value={draft.gender}
                    onChange={(event) => set("gender", event.target.value as ReferralDraft["gender"])}
                  >
                    <option value={UNANSWERED_VALUE}>Choose one</option>
                    {REFERRAL_GENDERS.map((gender) => (
                      <option key={gender} value={gender}>
                        {gender}
                      </option>
                    ))}
                    <option value={NOT_RECORDED_VALUE}>Not yet recorded</option>
                  </select>
                  <p className={styles.fieldHint}>Decides which beds are offered. Never chosen for you.</p>
                </div>
                <div className={styles.formField}>
                  <label htmlFor="intake-region">Home region</label>
                  <select
                    id="intake-region"
                    className={styles.fieldSelect}
                    value={draft.homeRegion}
                    onChange={(event) => set("homeRegion", event.target.value as ReferralDraft["homeRegion"])}
                  >
                    <option value={UNANSWERED_VALUE}>Choose one</option>
                    {HOME_REGIONS.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formField}>
                  <label htmlFor="intake-suburb">Suburb</label>
                  <input
                    id="intake-suburb"
                    className={styles.input}
                    list="intake-suburbs"
                    value={
                      draft.suburb === UNANSWERED_VALUE
                        ? ""
                        : draft.suburb === UNKNOWN_SUBURB
                          ? suburbUnknownLabels[UNKNOWN_SUBURB]
                          : draft.suburb
                    }
                    onChange={(event) => {
                      const value = event.target.value;
                      const named = SUBURBS.find((suburb) => suburb.toLowerCase() === value.trim().toLowerCase());
                      set(
                        "suburb",
                        value === suburbUnknownLabels[UNKNOWN_SUBURB]
                          ? UNKNOWN_SUBURB
                          : (named ?? (value.trim() === "" ? UNANSWERED_VALUE : value)),
                      );
                    }}
                    placeholder="Start typing a suburb"
                    autoComplete="off"
                  />
                  <datalist id="intake-suburbs">
                    <option value={suburbUnknownLabels[UNKNOWN_SUBURB]} />
                    {SUBURBS.map((suburb) => (
                      <option key={suburb} value={suburb} />
                    ))}
                  </datalist>
                  <p className={styles.fieldHint}>
                    Used for the catchment check. Choose “{suburbUnknownLabels[UNKNOWN_SUBURB]}” when it is not known.
                  </p>
                </div>
              </div>
            </Step>

            <Step number={2} title="Where the referral comes from, and how urgent" done={step2}>
              <div className={styles.fields}>
                <div className={styles.formField}>
                  <label htmlFor="intake-source">Who is referring</label>
                  <select
                    id="intake-source"
                    className={styles.fieldSelect}
                    value={draft.source}
                    onChange={(event) => set("source", event.target.value as ReferralDraft["source"])}
                  >
                    <option value={UNANSWERED_VALUE}>Choose one</option>
                    {REFERRAL_SOURCES.map((source) => (
                      <option key={source} value={source}>
                        {SOURCE_LABELS[source]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formField}>
                  <label htmlFor="intake-site">Where the person is now</label>
                  <select
                    id="intake-site"
                    className={styles.fieldSelect}
                    value={draft.originSiteCode}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        originSiteCode: event.target.value,
                        originUnitId: UNANSWERED_VALUE,
                      }))
                    }
                  >
                    <option value={UNANSWERED_VALUE}>Choose one</option>
                    {wardSites.map((candidate) => (
                      <option key={candidate.code} value={candidate.code}>
                        {candidate.name}
                      </option>
                    ))}
                  </select>
                </div>
                {draft.source === "psychiatric_ward" ? (
                  <div className={styles.formField}>
                    <label htmlFor="intake-unit">Sending ward</label>
                    <select
                      id="intake-unit"
                      className={styles.fieldSelect}
                      value={draft.originUnitId}
                      onChange={(event) => set("originUnitId", event.target.value)}
                    >
                      <option value={UNANSWERED_VALUE}>Choose one</option>
                      {units
                        .filter((unit) => unit.siteCode === site?.code)
                        .map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.name}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : null}
                <div className={styles.formField}>
                  <label htmlFor="intake-team">Sending team or service (optional)</label>
                  <input
                    id="intake-team"
                    className={styles.input}
                    value={draft.sendingTeamName}
                    onChange={(event) => set("sendingTeamName", event.target.value)}
                    placeholder="As the team would write it"
                  />
                </div>
                <fieldset className={`${styles.formField} ${styles.fieldWide}`}>
                  <legend>Urgency</legend>
                  <div className={styles.choices}>
                    {URGENCY_LEVELS.map((tier) => (
                      <label key={tier} className={`${styles.choice} ${styles.choiceCard}`}>
                        <input
                          type="radio"
                          name="intake-urgency"
                          checked={draft.urgency === tier}
                          onChange={() => set("urgency", tier)}
                        />
                        {urgencyTierLabel(tier)}
                        <small>{urgencyWindowLabel(tier)}</small>
                      </label>
                    ))}
                  </div>
                  <p className={styles.fieldHint}>
                    The hours are this service&apos;s own defaults for a reply, not legal time limits.
                  </p>
                </fieldset>
              </div>
            </Step>

            <Step number={3} title="What kind of bed and help they need" done={step3}>
              <div className={styles.fields}>
                <YesNo
                  name="intake-secure"
                  label="Needs a secure (locked) bed"
                  hint="A ward with a locked perimeter."
                  value={draft.secureBedNeeded}
                  onChange={(value) => set("secureBedNeeded", value)}
                />
                <YesNo
                  name="intake-involuntary"
                  label="Needs a bed that can hold someone involuntarily"
                  hint="A ward authorised to hold a person who is not there by choice."
                  value={draft.involuntaryBedNeeded}
                  onChange={(value) => set("involuntaryBedNeeded", value)}
                />
                <YesNo
                  name="intake-acuity"
                  label="Needs high-acuity nursing"
                  hint="One-to-one or two-to-one observation."
                  value={draft.highAcuityNursingNeeded}
                  onChange={(value) => set("highAcuityNursingNeeded", value)}
                />
                <YesNo
                  name="intake-transport"
                  label="Needs transport"
                  hint="A transfer booking will be needed."
                  value={draft.transportNeeded}
                  onChange={(value) => set("transportNeeded", value)}
                />
                <div className={`${styles.formField} ${styles.fieldWide}`}>
                  <label htmlFor="intake-diagnosis">Broad diagnosis group (optional, tentative)</label>
                  <select
                    id="intake-diagnosis"
                    className={styles.fieldSelect}
                    value={draft.tentativeDiagnosis}
                    onChange={(event) =>
                      set(
                        "tentativeDiagnosis",
                        event.target.value as TentativeDiagnosisBlock | typeof NO_DIAGNOSIS_VALUE,
                      )
                    }
                  >
                    <option value={NO_DIAGNOSIS_VALUE}>Not recorded</option>
                    {TENTATIVE_DIAGNOSIS_BLOCKS.map((block) => (
                      <option key={block.code} value={block.code}>
                        {block.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Step>

            <Step number={4} title="Where to send it" done={step4}>
              <p className={styles.fieldHint} style={{ marginBottom: "0.75rem" }}>
                Choose up to three. They are asked at the same time, and the first to accept takes the referral.
              </p>
              <ul className={styles.candidates}>
                {options.map((option) => {
                  const chosen = draft.destinationKinds.includes(option.kind);
                  return (
                    <li
                      key={option.kind}
                      className={styles.candidate}
                      style={
                        chosen
                          ? { borderColor: "var(--accent)", boxShadow: "inset 0 0 0 1px var(--accent)" }
                          : undefined
                      }
                    >
                      <label style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={chosen}
                          onChange={() => toggleDestination(option.kind)}
                          style={{ width: "1.25rem", height: "1.25rem", marginTop: "0.125rem" }}
                        />
                        <span>
                          <span className={styles.candidateName} style={{ display: "block" }}>
                            {option.label}
                            {option.suggested ? <span className={styles.count}>Serves this suburb</span> : null}
                          </span>
                          {option.figures.map((figure) => (
                            <span key={figure} className={styles.candidateLine} style={{ display: "block" }}>
                              {readableFigure(figure)}
                            </span>
                          ))}
                          <span className={styles.candidateLine} style={{ display: "block", color: "var(--muted)" }}>
                            {option.catchment.sentence}
                          </span>
                        </span>
                      </label>
                      <span />
                      {chosen && option.kind === "emergency_department" ? (
                        <div className={`${styles.formField} ${styles.fieldWide}`} style={{ gridColumn: "1 / -1" }}>
                          <label htmlFor="intake-ed">Which emergency department</label>
                          <select
                            id="intake-ed"
                            className={styles.fieldSelect}
                            value={draft.edId}
                            onChange={(event) => set("edId", event.target.value)}
                          >
                            <option value={UNANSWERED_VALUE}>Choose one</option>
                            {allEmergencyDepartments().map((ed) => (
                              <option key={ed.id} value={ed.id}>
                                {ed.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                      {chosen && option.kind === "community_team" ? (
                        <div className={`${styles.formField} ${styles.fieldWide}`} style={{ gridColumn: "1 / -1" }}>
                          <label htmlFor="intake-community">Which community team</label>
                          <select
                            id="intake-community"
                            className={styles.fieldSelect}
                            value={draft.teamName}
                            onChange={(event) => set("teamName", event.target.value)}
                          >
                            <option value={UNANSWERED_VALUE}>Choose one</option>
                            {teams.map((team) => (
                              <option key={team} value={team}>
                                {team}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {bothRefused ? (
                <p className={`${styles.callout} ${styles.calloutWarn}`} role="alert">
                  A ward bed and a community team cannot be asked in the same referral. Choose one of them.
                </p>
              ) : null}
            </Step>

            <Panel
              title="History (optional)"
              question="What has happened, what has changed, and what has been tried. As much or as little as you have."
            >
              <label className={styles.fieldHint} htmlFor="intake-history">
                Sent exactly as written to every destination chosen.
              </label>
              <textarea
                id="intake-history"
                className={styles.textarea}
                value={draft.history}
                maxLength={REFERRAL_HISTORY_LIMITS.history}
                onChange={(event) => set("history", event.target.value)}
                rows={6}
                spellCheck={false}
              />
              <p className={styles.fieldHint}>
                {draft.history.length} of {REFERRAL_HISTORY_LIMITS.history} characters
              </p>
            </Panel>
          </div>

          <aside className={styles.sticky} aria-label="Ready to send">
            <Panel title="Ready to send?" meta={`${done} of ${total} answered`}>
              <div className={styles.progress} aria-hidden="true">
                <div className={styles.progressFill} style={{ width: `${(done / total) * 100}%` }} />
              </div>
              {missing.length ? (
                <>
                  <p className={styles.note}>
                    Send works once {plural(missing.length, "question")} {missing.length === 1 ? "has" : "have"} an
                    answer:
                  </p>
                  <ul className={styles.checklist} style={{ marginTop: "0.5rem" }}>
                    {missing.map((name) => (
                      <li key={name}>
                        <span>{name}</span>
                        <span className={styles.checkTodo}>Not answered</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : bothRefused ? (
                <p className={`${styles.callout} ${styles.calloutWarn}`}>
                  Choose a ward bed or a community team, not both.
                </p>
              ) : (
                <p className={styles.callout}>Every question has an answer. Check the summary, then send.</p>
              )}
              <button
                type="submit"
                className={styles.buttonPrimary}
                onClick={(event) => {
                  // aria-disabled keeps the button reachable; this keeps it inert until every answer is in.
                  if (!answered) event.preventDefault();
                }}
                aria-disabled={answered ? undefined : "true"}
                aria-describedby="intake-send-reason"
                style={{ width: "100%", marginTop: "1rem" }}
              >
                Send referral
              </button>
              <p id="intake-send-reason" className={styles.status} role="status" aria-live="polite">
                {sent ?? (answered ? "Ready to send." : "Not ready yet.")}
              </p>
              {sent?.startsWith("Referral sent") ? (
                <a className={styles.link} href={PROPOSAL_ROUTES.board.href}>
                  Open the referral board ›
                </a>
              ) : null}
            </Panel>
          </aside>
        </form>
      </main>
    </>
  );
}

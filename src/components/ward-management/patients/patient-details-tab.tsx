"use client";

import type { ReferralSafetyFacts } from "./patient-referral-safety";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Clipboard } from "lucide-react";
import { Badge, Button, Card, StatusGlyph, cx, type WfTone } from "@/components/wf";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import {
  activeCommunityTreatmentOrder,
  cohortFitsAge,
  formatDateOfBirth,
  patientAgeYears,
  patientCohort,
  type Patient,
} from "../ward-patients";
import { genderReviewNeeded, SEX_DESIGNATIONS, type Movement, type RecordedSex } from "../ward-model";
import { sexDesignationAccepts } from "../ward-eligibility";
import { legalStatusTextIsInvoluntary } from "../ward-support-notifications";
import { currentLegalPosition } from "../ward-legal-form-progression";
import {
  hasCurrentLegalMismatch,
  LEGAL_MISMATCH_WARNING,
  LEGAL_STATUSES_DIFFER,
  legalStatusesDiffer,
} from "../ward-stay-legal";
import { calendarDateOf } from "../ward-clock";
import { isEdOriginJourney } from "../ward-ed-presence";
import { monthIndexOfShort } from "@/components/ward-management/ward-month-names";
import { useOptionalWardFlowSelect } from "../ward-flow-provider";
import { communityTeamById, communityTeamSlug } from "../community/community-derivations";
import { isOwnStay } from "./patient-now-adapter";
import { recordExtrasFor, type PastEpisode } from "./patient-record-extras";
import styles from "./patient-details-tab.module.css";

/**
 * Details: the person's record on one card (patient overhaul round 2, 1 Nov 2026). Small uppercase
 * group labels down the left, dense label-over-value facts in a four-column grid on the right.
 * Every value comes from the record or its extras. A core record field the person can hold but does
 * not reads "Not recorded" in place; an optional or proposed field that is absent is left out.
 *
 * Kept from the 21 Oct 2026 audit: a fact the movement and the patient share shows once, and both
 * show, named apart, only when they differ. Interpreter language and Aboriginal status sit in
 * different groups, never side by side (R-2026-09-04-A, the placement rule in person-screen.tsx).
 * No copy for UMRN or date of birth: the clipboard strips them (D-71 item 7). Legal status is shown
 * as typed, never as a countdown (D-93).
 */

type Fact = {
  label: string;
  value?: ReactNode;
  /** Quiet ink after the value, such as the age after a date of birth. */
  aside?: ReactNode;
  /** Glyph before the value, for the one fact that carries a rule. */
  tone?: WfTone;
  mono?: boolean;
  wide?: boolean;
};

function FactGrid({ facts }: { facts: Fact[] }) {
  return (
    <dl className={styles.facts}>
      {facts.map((fact) => (
        <div className={styles.fact} key={fact.label} data-wide={fact.wide || undefined}>
          <dt>{fact.label}</dt>
          {fact.value ? (
            <dd className={cx(fact.mono && styles.mono, fact.tone && styles.toned)}>
              {fact.tone ? <StatusGlyph tone={fact.tone} size={11} /> : null}
              <span>
                {fact.value}
                {fact.aside ? <span className={styles.aside}> · {fact.aside}</span> : null}
              </span>
            </dd>
          ) : (
            <dd className={styles.missing}>Not recorded</dd>
          )}
        </div>
      ))}
    </dl>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.label}>{title}</h2>
      <div className={styles.body}>{children}</div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}

/** A status tag: the kit Badge at its small size, shared by every record tab. */
function Tag({ tone, children }: { tone?: WfTone; children: ReactNode }) {
  return (
    <Badge tone={tone} size="sm">
      {children}
    </Badge>
  );
}

/** One copy button for the care links, anchored at the section's right. Service names only. */
function CopyCareLinks({ value }: { value: string }) {
  const [message, setMessage] = useState("");
  return (
    <span className={styles.copy}>
      <span role="status" className={styles.copyStatus}>
        {message}
      </span>
      <Button
        size="sm"
        icon={Clipboard}
        onClick={async () => {
          try {
            await copyTextToClipboard(value);
            setMessage("Copied");
          } catch {
            setMessage("Clipboard unavailable");
          }
        }}
      >
        Copy
      </Button>
    </span>
  );
}

/** Splices the suburb into the address unless the address already names it. */
function addressLine(patient?: Patient): string | undefined {
  const address = patient?.address?.trim();
  const suburb = patient?.suburb?.trim();
  if (!address) return suburb || undefined;
  if (!suburb || address.toLowerCase().includes(suburb.toLowerCase())) return address;
  return `${address}, ${suburb}`;
}

/** "6 Aug 2026" as typed in the extras, written DD/MM/YYYY like every other date here. Anything
 *  else (such as "Jan 2026") stays exactly as typed. */
function typedDate(value: string): string {
  const match = /^(\d{1,2}) ([A-Z][a-z]{2,3}) (\d{4})$/u.exec(value.trim());
  const month = match ? monthIndexOfShort(match[2]!) : -1;
  if (!match || month < 0) return value;
  return `${match[1]!.padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${match[3]}`;
}

/**
 * Which bed designations this person's gender fits, read through the bed check's own rules:
 * `sexDesignationAccepts` for a female or male gender, and `genderReviewNeeded` (R7) when gender or
 * sex is anything else or not recorded, which needs a coordinator's recorded review on every ward.
 */
function bedDesignationFact(
  gender: Patient["gender"],
  sex: string | undefined,
  placementRecorded: boolean,
): Pick<Fact, "value" | "tone"> {
  const recordedSex: RecordedSex = sex === "Female" || sex === "Male" ? sex : "Not recorded";
  if ((gender !== "Female" && gender !== "Male") || genderReviewNeeded(gender, recordedSex)) {
    return placementRecorded
      ? { value: "Coordinator placement recorded" }
      : { value: "Coordinator review first", tone: "warning" };
  }
  const fits = SEX_DESIGNATIONS.filter((designation) => sexDesignationAccepts(designation, gender));
  const single = fits.filter((designation) => designation !== "Undesignated");
  return { value: [...single, ...(fits.includes("Undesignated") ? ["undesignated"] : [])].join(" or ") };
}

function episodeCounts(episodes: PastEpisode[]): string | undefined {
  const admissions = episodes.filter((episode) => episode.kind === "admission").length;
  const ed = episodes.filter((episode) => episode.kind === "ed").length;
  const community = episodes.filter((episode) => episode.kind === "community").length;
  const parts = [
    admissions ? `${admissions} admission${admissions === 1 ? "" : "s"}` : undefined,
    ed ? `${ed} ED` : undefined,
    community ? `${community} community` : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

export function PatientDetailsTab({
  foot,
  patient,
  movement,
  displayName,
  preferredName,
  referralSafety,
  referralWhen,
}: {
  /** Redesign (12 Nov 2026): the Record added in error card, at the foot of Details only. */
  foot?: ReactNode;
  patient?: Patient;
  movement?: Movement;
  /** PT1 H10: what the one referral behind this placement or stay says, read in
   *  `patient-referral-safety.ts` and only when this desk can see that referral. */
  referralSafety?: ReferralSafetyFacts;
  /** The referral's day in words ("Sun 1 Nov"), always shown beside what it says. */
  referralWhen?: string;
  displayName: string;
  preferredName?: string;
}) {
  // Age is derived from the date of birth on the demo clock's Perth day, never stored (ward-patients).
  // Outside a provider (unit tests) there is no clock, so the age is left out rather than guessed.
  const flow = useOptionalWardFlowSelect("now", "dayZero", "admissions");
  const today = flow ? calendarDateOf(flow.now, flow.dayZero) : undefined;
  const age = patient?.dateOfBirth && today ? patientAgeYears(patient, today) : undefined;
  const extras = recordExtrasFor(patient?.id);

  // Active means the gate board's order (patient-mode.ts): an open movement, or an occupied bed.
  // Outside a provider only the movement can say, so an open movement counts as active.
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
  const placement = active ? movement : undefined;

  // UX audit (21 Oct 2026): the placement copy and the patient's own legal status appear only when
  // they differ. One side recorded and the other not is a difference too.
  const sexDiffers = placement !== undefined && placement.sex !== patient?.sex;
  const genderDiffers = placement !== undefined && placement.gender !== patient?.gender;
  // The one rule the TV wall reads too (D-210 (Josh, 14 Nov 2026), ruling 5).
  const legalDiffers = legalStatusesDiffer(movement, patient);
  const mismatch = Boolean(
    placement &&
    patient &&
    ((placement.sex && patient.sex && placement.sex !== patient.sex) ||
      (placement.gender && patient.gender && placement.gender !== patient.gender)),
  );

  // Note 3 (Josh, 8 Nov 2026): an administrative detail shows only once it is recorded.
  const recorded = (label: string, value: string | undefined, more: Partial<Fact> = {}): Fact[] =>
    value?.trim() ? [{ label, value, ...more }] : [];

  // ── Identity ───────────────────────────────────────────────────────────────────────────────
  const identity: Fact[] = [
    { label: "Name", value: displayName },
    ...(preferredName ? [{ label: "Preferred name", value: preferredName }] : []),
    { label: "UMRN", value: patient?.umrn, mono: true },
    {
      label: "Date of birth",
      value: patient?.dateOfBirth ? formatDateOfBirth(patient.dateOfBirth) : undefined,
      aside: age !== undefined ? `${age} y` : undefined,
    },
    { label: "Sex", value: patient?.sex },
    { label: "Gender", value: patient?.gender },
    {
      label: "Aboriginal or Torres Strait Islander status",
      value: patient?.aboriginalOrTorresStraitIslanderStatus,
      wide: true,
    },
    ...recorded("Country of birth", patient?.countryOfBirth),
    ...recorded("Marital status", patient?.maritalStatus),
  ];

  // ── Contact ────────────────────────────────────────────────────────────────────────────────
  const contact: Fact[] = [
    ...(extras?.phone ? [{ label: "Phone", value: extras.phone, mono: true }] : []),
    ...recorded("Mobile", patient?.mobilePhone, { mono: true }),
    ...recorded("Other phone", patient?.otherPhone, { mono: true }),
    ...recorded("Email", patient?.email),
    {
      label: "Address",
      value: addressLine(patient) ?? (patient?.postcode?.trim() || undefined),
      aside: addressLine(patient) ? patient?.postcode : undefined,
    },
    { label: "Interpreter / preferred language", value: patient?.interpreterLanguage, wide: true },
    ...recorded("Interpreter needed", patient?.interpreterRequired),
  ];
  const kin: Fact[] = [
    // Each detail can be added on its own, so a part without its companion still shows.
    ...(patient?.nextOfKinName?.trim()
      ? recorded("Next of kin", patient.nextOfKinName, { aside: patient.nextOfKinRelationship })
      : recorded("Next of kin relationship", patient?.nextOfKinRelationship)),
    ...recorded("Next of kin phone", patient?.nextOfKinPhone, { mono: true }),
    ...(patient?.supportPersonName?.trim()
      ? recorded(patient.supportPersonRole?.trim() || "Support person", patient.supportPersonName)
      : recorded("Support person", patient?.supportPersonRole)),
    ...recorded("Support person phone", patient?.supportPersonPhone, { mono: true }),
  ];
  const medicareMore = [
    patient?.medicareReference?.trim() && `IRN ${patient.medicareReference.trim()}`,
    patient?.medicareExpiry?.trim(),
  ]
    .filter(Boolean)
    .join(" · ");
  const funding: Fact[] = [
    ...(patient?.medicareNumber?.trim()
      ? recorded("Medicare", patient.medicareNumber, { mono: true, aside: medicareMore || undefined })
      : recorded("Medicare (number not recorded)", medicareMore)),
    ...recorded("Funding", patient?.healthFund),
    ...recorded("DVA file number", patient?.dvaFileNumber, { mono: true }),
    ...recorded("Pension or concession card", patient?.concessionCard, { mono: true }),
    ...recorded("Advance health directive", patient?.advanceHealthDirective),
    ...recorded("Enduring guardian", patient?.enduringGuardian),
  ];

  // ── Support people (MHA 2014 WA roles) ─────────────────────────────────────────────────────
  const supports = extras?.supports ?? [];
  const legalNow = movement?.legalStatus ?? patient?.legalStatus;
  const involuntary =
    active && (legalStatusTextIsInvoluntary(legalNow) || legalStatusTextIsInvoluntary(patient?.legalStatus));
  const noNominatedPerson =
    extras !== undefined && involuntary && !supports.some((person) => /nominated person/iu.test(person.role));

  // ── Care links ─────────────────────────────────────────────────────────────────────────────
  const catchment = patient?.catchmentCommunityTeam?.trim() || undefined;
  const activeEpisode = extras?.community?.find((episode) => episode.status === "active");
  const confirmedHere = Boolean(activeEpisode && catchment && activeEpisode.team === catchment);
  const teamLink = (name: string) => {
    const slug = communityTeamSlug(name);
    return communityTeamById(slug) ? (
      <Link className={styles.link} href={`/ward-flow/community/${slug}`}>
        {name}
      </Link>
    ) : (
      name
    );
  };
  const care: Fact[] = [
    { label: "GP", value: patient?.generalPractitioner },
    ...recorded("Practice phone", patient?.gpPhone, { mono: true }),
    ...(activeEpisode && !confirmedHere
      ? [
          {
            label: "Community team",
            value: (
              <>
                {teamLink(activeEpisode.team)} <Tag tone="success">Care confirmed</Tag>
              </>
            ),
            wide: true,
          },
        ]
      : []),
    {
      label: "Catchment community team",
      value: catchment ? (
        <>
          {teamLink(catchment)} {confirmedHere ? <Tag tone="success">Care confirmed</Tag> : <Tag>Catchment only</Tag>}
        </>
      ) : undefined,
      wide: true,
    },
  ];
  const careCopy = [
    patient?.generalPractitioner ? `GP: ${patient.generalPractitioner}` : undefined,
    catchment ? `Catchment community team: ${catchment}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  // ── Legal and placement ────────────────────────────────────────────────────────────────────
  const legalValue = (status: string | undefined) =>
    status ? (active ? status : `Last recorded: ${status}`) : undefined;
  const cto = activeCommunityTreatmentOrder(patient);
  const bandMismatch =
    placement?.cohort && patient?.dateOfBirth && today && !cohortFitsAge(placement.cohort, patient.dateOfBirth, today)
      ? patientCohort(patient.dateOfBirth, today)
      : undefined;
  // A16-09 and 1.1 (Josh, 13 Nov 2026): the first row reads the one current legal position, so the
  // Details tab reads as every other view; the stay's (the movement's) status wins over the patient
  // record's own. D-187 item 1 (Q19, later the same evening) keeps both statuses: when they differ,
  // the patient record's status shows as a second, plainly named row and a warning says so.
  const legal: Fact[] = [
    // D-187 item 1 (Q19): both statuses are kept, named plainly. A movement from a ward or the
    // community is not an ED stay, so it reads "This move".
    {
      label: legalDiffers ? (movement && isEdOriginJourney(movement) ? "This ED stay" : "This move") : "Legal status",
      value: legalValue(currentLegalPosition(movement, patient?.legalStatus).status),
      wide: !active,
    },
    ...(legalDiffers ? [{ label: "Patient record", value: legalValue(patient?.legalStatus) }] : []),
    ...(cto ? [{ label: "Community treatment order", value: `Form ${cto.form} in force` }] : []),
    // Placement facts exist only with an active movement; otherwise they are left out.
    ...(placement
      ? [
          {
            label: "Age band",
            value: placement.cohort,
            tone: bandMismatch ? ("warning" as const) : undefined,
            aside: bandMismatch ? `DOB gives ${bandMismatch}` : undefined,
          },
          ...(sexDiffers ? [{ label: "Placement sex", value: placement.sex }] : []),
          ...(genderDiffers ? [{ label: "Placement gender", value: placement.gender }] : []),
        ]
      : []),
    {
      label: "Bed designation",
      ...bedDesignationFact(
        placement?.gender ?? patient?.gender,
        placement?.sex ?? patient?.sex,
        (placement?.genderPlacements?.length ?? 0) > 0,
      ),
    },
    ...(placement ? [{ label: "Owner", value: placement.owner?.trim() || undefined }] : []),
  ];

  // ── Diagnosis (PT1, Josh 3 Nov 2026) ─────────────────────────────────────────────────────────
  // Diagnosis left the first screen and lives here. It is the referral's working diagnosis, as
  // the referrer wrote it: the record itself still holds no diagnosis (R-2026-09-04-A).
  const diagnosisNotShared = referralSafety?.kind === "not_shared";
  const diagnosis = referralSafety?.kind === "shown" ? referralSafety.diagnosisAsWritten : undefined;

  // ── Record ─────────────────────────────────────────────────────────────────────────────────
  const episodes = extras?.episodes ?? [];
  const lastDischarge = episodes.find((episode) => episode.kind === "admission" && episode.end);
  const record: Fact[] = [
    { label: "Earlier episodes", value: String(episodes.length), aside: episodeCounts(episodes) },
    ...(lastDischarge?.end
      ? [{ label: "Last discharge", value: typedDate(lastDischarge.end), aside: lastDischarge.where, wide: true }]
      : []),
  ];

  return (
    <section className={styles.pane} aria-label="Patient details" data-layout="details">
      {mismatch && (
        <p className={styles.attention} role="status">
          <StatusGlyph tone="warning" size={12} />
          <span>Patient sex or gender differs from the movement placement record. Both are shown below.</span>
        </p>
      )}
      {/* Redesign (12 Nov 2026): two level cards on a wide screen, the person on the left and their
          care and legal facts on the right, so nothing stretches across the page. */}
      <div className={styles.dash}>
        <Card className={styles.card} data-testid="ward-person-placement-details">
          <Section title="Identity">
            <FactGrid facts={identity} />
          </Section>

          <Section title="Contact">
            <FactGrid facts={contact} />
          </Section>

          {kin.length > 0 ? (
            <Section title="Next of kin and carer">
              <FactGrid facts={kin} />
            </Section>
          ) : null}

          {funding.length > 0 ? (
            <Section title="Funding and planning">
              <FactGrid facts={funding} />
            </Section>
          ) : null}

          {supports.length > 0 || noNominatedPerson ? (
            <Section title="Support people">
              {supports.length > 0 ? (
                <ul className={styles.people}>
                  {supports.map((person) => (
                    <li className={styles.person} key={`${person.name}-${person.role}`}>
                      <span className={styles.personName}>{person.name}</span>
                      <span className={styles.personRole}>{person.role}</span>
                      <span className={styles.personQuiet}>
                        {person.relationship}
                        {person.relationship && person.phone ? " · " : null}
                        {person.phone ? <span className={styles.mono}>{person.phone}</span> : null}
                      </span>
                      <span className={styles.personEnd}>
                        {person.notify ? <Tag tone="info">Tell on transfer</Tag> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {noNominatedPerson ? <p className={styles.quiet}>No nominated person recorded.</p> : null}
            </Section>
          ) : null}
        </Card>
        <Card className={styles.card} data-testid="ward-person-care-details">
          <Section title="Care links" action={careCopy ? <CopyCareLinks value={careCopy} /> : undefined}>
            <FactGrid facts={care} />
          </Section>

          <Section title="Diagnosis">
            <FactGrid
              facts={[
                {
                  label: "Working diagnosis",
                  value: diagnosisNotShared ? "Not shared with this desk" : diagnosis,
                  aside: diagnosis
                    ? referralWhen
                      ? `As written on the referral, ${referralWhen}`
                      : "As written on the referral"
                    : undefined,
                  wide: true,
                },
              ]}
            />
          </Section>

          <Section title={placement ? "Legal and placement" : "Legal"}>
            {/* D-187 item 1 (Q19): a warning, never a block (D-186 item 5). Only while the stay is
                current: once it has ended, the record is expected to move on from it. */}
            {/* Master stress test D1a-E-2 (14 Nov 2026): a recorded legal mismatch, a warning only (D-16). */}
            {placement && hasCurrentLegalMismatch(placement) ? (
              <p className={styles.attention} role="status" data-testid="ward-person-legal-mismatch">
                <StatusGlyph tone="warning" size={12} />
                <span>{LEGAL_MISMATCH_WARNING}</span>
              </p>
            ) : null}
            {legalDiffers && active ? (
              <p className={styles.attention} role="status" data-testid="ward-person-legal-differs">
                <StatusGlyph tone="warning" size={12} />
                <span>{LEGAL_STATUSES_DIFFER}</span>
              </p>
            ) : null}
            <FactGrid facts={legal} />
          </Section>

          {extras && extras.alerts.length > 0 ? (
            <Section title="Health alerts">
              <ul className={styles.tags} aria-label="Health alerts">
                {extras.alerts.map((alert) => (
                  <li key={alert}>
                    <Tag>{alert}</Tag>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {episodes.length > 0 ? (
            <Section title="Record">
              <FactGrid facts={record} />
            </Section>
          ) : null}
        </Card>
      </div>
      {foot}
    </section>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Clipboard } from "lucide-react";
import { Button, Card, StatusGlyph, cx, type WfTone } from "@/components/wf";
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
import { calendarDateOf } from "../ward-clock";
import { useOptionalWardFlowSelect } from "../ward-flow-provider";
import { communityTeamById, communityTeamSlug } from "../community/community-derivations";
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

function Tag({ tone, children }: { tone?: WfTone; children: ReactNode }) {
  return (
    <span className={styles.tag}>
      {tone ? <StatusGlyph tone={tone} size={9} /> : null}
      {children}
    </span>
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "6 Aug 2026" as typed in the extras, written DD/MM/YYYY like every other date here. Anything
 *  else (such as "Jan 2026") stays exactly as typed. */
function typedDate(value: string): string {
  const match = /^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})$/u.exec(value.trim());
  const month = match ? MONTHS.indexOf(match[2]!) : -1;
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
        ((patient !== undefined && admission.patientId === patient.id) ||
          (movement?.admissionId !== undefined && admission.id === movement.admissionId)),
    ),
  );
  const active = openMovement || occupied || (!flow && movement !== undefined && !movement.closure);
  const placement = active ? movement : undefined;

  // UX audit (21 Oct 2026): the placement copy and the patient's own legal status appear only when
  // they differ. One side recorded and the other not is a difference too.
  const sexDiffers = placement !== undefined && placement.sex !== patient?.sex;
  const genderDiffers = placement !== undefined && placement.gender !== patient?.gender;
  const legalDiffers = movement !== undefined && patient !== undefined && movement.legalStatus !== patient.legalStatus;
  const mismatch = Boolean(
    placement &&
    patient &&
    ((placement.sex && patient.sex && placement.sex !== patient.sex) ||
      (placement.gender && patient.gender && placement.gender !== patient.gender)),
  );

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
  ];

  // ── Contact ────────────────────────────────────────────────────────────────────────────────
  const contact: Fact[] = [
    ...(extras?.phone ? [{ label: "Phone", value: extras.phone, mono: true }] : []),
    { label: "Address", value: addressLine(patient) },
    { label: "Interpreter / preferred language", value: patient?.interpreterLanguage, wide: true },
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
  const legal: Fact[] = [
    {
      label: legalDiffers ? "Movement legal status" : "Legal status",
      value: legalValue(movement?.legalStatus ?? patient?.legalStatus),
      wide: !active,
    },
    ...(legalDiffers ? [{ label: "Patient legal status", value: legalValue(patient?.legalStatus) }] : []),
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
      <Card className={styles.card} data-testid="ward-person-placement-details">
        <Section title="Identity">
          <FactGrid facts={identity} />
        </Section>

        <Section title="Contact">
          <FactGrid facts={contact} />
        </Section>

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

        <Section title="Care links" action={careCopy ? <CopyCareLinks value={careCopy} /> : undefined}>
          <FactGrid facts={care} />
        </Section>

        <Section title={placement ? "Legal and placement" : "Legal"}>
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
    </section>
  );
}

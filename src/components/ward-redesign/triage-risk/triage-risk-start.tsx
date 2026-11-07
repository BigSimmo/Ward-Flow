"use client";

/**
 * Triage and risk mock-up: the Start a triage step (7 Nov 2026). Opened from New, then Triage, in the
 * app bar (`?start=new`), or from the form's own "Start a new triage". It asks who the triage is for:
 * a search over the preview world's synthetic people, the referrals still waiting for a triage, and
 * Add patient for someone not found. Choosing a person opens the form blank. Synthetic data only;
 * the typed search stays in React and is never stored.
 */
import { ChevronRight, Inbox, UserPlus } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { Badge, Card, CardBody, CardHead, FormalName, Hero, Icon, SearchField, buttonClass } from "@/components/wf";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { referralState } from "@/components/ward-management/ward-referrals";
import { patientKeyFor, sampleProfile } from "@/components/ward-management/referrals/ward-referral-drawer-model";
import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";
import type { Referral } from "@/components/ward-management/ward-model";

import { PATIENT, type TriagePerson, type TriageReferral } from "./triage-risk-data";
import { legalLine, searchTriagePeople, startPeople, triagePersonFromWorld } from "./triage-risk-people";
import styles from "./triage-risk-start.module.css";

const SOURCE_WORDS: Readonly<Record<string, string>> = {
  community: "Community team",
  crisis_service: "Crisis service",
  ambulance: "Ambulance",
  inter_hospital: "Another hospital",
  ed_medical: "ED medical team",
  gp: "GP",
  psychiatric_ward: "A ward",
};

const asReferral = (referral: Referral): TriageReferral => ({
  id: referral.id,
  from: SOURCE_WORDS[referral.source] ?? "Not recorded",
  // A world referral asks for a bed urgency, not a triage tier, so the referrer asked none here.
  urgency: null,
  episode: null,
  // The world's referrals do not name a referrer person, so the form asks for one.
  referrer: null,
  received: null,
});

/** Still waiting for an answer and not yet triaged. */
const awaitingTriage = (referral: Referral) => referral.triagedAt === undefined && referralState(referral) === "queued";

/** The preview world's synthetic people as the banner reads them, and the referrals awaiting triage. */
function useWorldPeople(): { people: TriagePerson[]; awaiting: TriagePerson[] } {
  const { patients, movements, referrals, now, dayZero } = useWardFlowSelect(
    "patients",
    "movements",
    "referrals",
    "now",
    "dayZero",
  );
  return useMemo(() => {
    const record = { movements, patients, referrals, dayZero };
    const openReferral = new Map<string, Referral>();
    for (const referral of referrals)
      if (referral.patientId && !openReferral.has(referral.patientId) && referralState(referral) === "queued")
        openReferral.set(referral.patientId, referral);
    const byId = new Map<string, TriagePerson>();
    const people = patients.map((patient) => {
      const key = patientKeyFor(patient.id, record) ?? `patient:${patient.id}`;
      const profile = sampleProfile(key, record, now);
      const open = openReferral.get(patient.id);
      const person = triagePersonFromWorld({
        patientId: patient.id,
        name: profile.name,
        age: profile.age,
        gender: profile.gender,
        umrn: patient.umrn,
        dob: patient.dateOfBirth,
        origin: profile.origin,
        legalStatus: profile.legalStatus,
        recordAddress: encodeRecordAddress(key.startsWith("WF-") ? key : patient.id),
        openReferral: open ? asReferral(open) : null,
      });
      byId.set(patient.id, person);
      return person;
    });
    const awaiting = referrals
      .filter((referral) => referral.patientId && awaitingTriage(referral))
      .flatMap((referral) => {
        const person = byId.get(referral.patientId!);
        return person ? [{ ...person, referral: asReferral(referral) }] : [];
      });
    // The worked Example's synthetic referral R-1182 is first: the one with a previous triage.
    return { people: startPeople(people), awaiting: [PATIENT, ...awaiting].slice(0, 5) };
  }, [patients, movements, referrals, now, dayZero]);
}

function PersonRow({
  person,
  onChoose,
  showReferral,
}: {
  person: TriagePerson;
  onChoose: () => void;
  showReferral: boolean;
}) {
  return (
    <li>
      <button type="button" className={styles.person} onClick={onChoose} data-testid="triage-start-person">
        <span className={styles.personText}>
          <span className={styles.personName}>
            <FormalName name={person.name} />
            <span className={styles.personMeta}>{person.meta}</span>
          </span>
          <span className={styles.personLine}>
            UMRN <b className={styles.mono}>{person.umrn}</b> · DOB <b className={styles.mono}>{person.dob}</b>
          </span>
          <span className={styles.personLine}>
            Now at {person.nowAt === "Not recorded" ? <i className={styles.quiet}>not recorded</i> : person.nowAt}
          </span>
          <span className={styles.personLine}>{legalLine(person)}</span>
          <span className={styles.tags}>
            {showReferral && person.referral ? (
              <Badge>
                Open referral {person.referral.id} · {person.referral.from}
              </Badge>
            ) : null}
            {person.lastTriage ? <Badge>Previous triage on record</Badge> : null}
          </span>
        </span>
        <Icon icon={ChevronRight} size={16} className={styles.chevron} />
      </button>
    </li>
  );
}

export function TriageStart({ onChoose }: { onChoose: (person: TriagePerson) => void }) {
  const { people, awaiting } = useWorldPeople();
  const [query, setQuery] = useState("");
  const matches = useMemo(() => searchTriagePeople(people, query), [people, query]);
  const searching = query.trim().length > 0;
  const headingId = useId();
  return (
    <main id="main-content" className={styles.main} data-testid="triage-start">
      <Hero
        level={1}
        eyebrow="Triage and risk · Synthetic"
        title="Start a triage"
        titleMeta="SMHMR900 and SMHMR905"
        lead="Choose who it is for. The form opens blank, with nothing pre-selected."
      />
      <div className={styles.grid}>
        <Card className={styles.card} aria-labelledby={headingId}>
          <CardHead id={headingId} title="Who is this triage for?" meta="Synthetic people" />
          <CardBody className={styles.body}>
            <SearchField
              id="triage-start-search"
              label="Search by name, UMRN or date of birth"
              placeholder="Surname, given name, UMRN or DOB"
              value={query}
              onValueChange={setQuery}
              count={searching ? { shown: matches.length, total: people.length, noun: "people" } : undefined}
            />
            {searching ? (
              matches.length ? (
                <ul className={styles.list} aria-label="Matching people">
                  {matches.map((person) => (
                    <PersonRow key={person.id} person={person} onChoose={() => onChoose(person)} showReferral />
                  ))}
                </ul>
              ) : (
                <p className={styles.empty} data-testid="triage-start-no-match">
                  No synthetic person matches. Check the spelling, or add them.
                </p>
              )
            ) : (
              <p className={styles.quiet}>
                Type a surname, UMRN or date of birth. Surnames that start with it come first.
              </p>
            )}
            <Link href="/ward-flow/people/new" className={buttonClass({ variant: "sec", className: styles.add })}>
              <Icon icon={UserPlus} size={16} />
              Not found? Add patient
            </Link>
          </CardBody>
        </Card>
        <Card className={styles.card} aria-labelledby={`${headingId}-awaiting`}>
          <CardHead
            id={`${headingId}-awaiting`}
            title="Referrals awaiting triage"
            icon={Inbox}
            iconPlain
            meta={`${awaiting.length}`}
          />
          <CardBody className={styles.body}>
            <ul className={styles.list} aria-label="Referrals awaiting triage">
              {awaiting.map((person) => (
                <PersonRow
                  key={`${person.id}-${person.referral?.id}`}
                  person={person}
                  onChoose={() => onChoose(person)}
                  showReferral
                />
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
      <p className={styles.footNote}>
        Ward Flow prototype. Synthetic people only. Not validated clinical decision support. This mock-up keeps nothing
        after you leave the page.
      </p>
    </main>
  );
}

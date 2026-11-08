"use client";

/**
 * Triage banner pop-outs (Josh approved, 9 Nov 2026): Contacts and Community team open in place
 * from the patient banner, so the clinician never leaves the form. They read the same synthetic
 * record extras the patient record uses; anything missing says so and is never invented.
 */
import { Copy, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button, Popover, phoneRows, useOptionalToast } from "@/components/wf";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import { recordExtrasFor } from "@/components/ward-management/patients/patient-record-extras";

import formStyles from "./triage-risk-form.module.css";
import styles from "./triage-risk-pops.module.css";

type Extras = NonNullable<ReturnType<typeof recordExtrasFor>>;
type Engagement = NonNullable<Extras["community"]>[number];

/** The person's community team: an active one first, else the most recent ended one. */
function communityFor(patientId: string): Engagement | null {
  const community = recordExtrasFor(patientId)?.community ?? [];
  return community.find((c) => c.status === "active") ?? community[community.length - 1] ?? null;
}

function contactsFor(patientId: string): Extras["supports"] {
  return recordExtrasFor(patientId)?.supports ?? [];
}

function PhoneLine({ phone, who }: { phone?: string; who: string }) {
  const toast = useOptionalToast();
  if (!phone) return <span className={styles.popQuiet}>No phone on the record</span>;
  return (
    <span className={styles.popPhone}>
      <span className={formStyles.mono}>{phone}</span>
      <Button
        variant="ghost"
        size="sm"
        icon={Copy}
        aria-label={`Copy phone for ${who}`}
        onClick={() =>
          copyTextToClipboard(phone).then(
            () => toast?.push({ tone: "info", title: "Phone copied." }),
            () => toast?.push({ tone: "info", title: "Copy not allowed here. Select the number instead." }),
          )
        }
      >
        Copy
      </Button>
    </span>
  );
}

function Panel({ title, children, recordHref }: { title: ReactNode; children: ReactNode; recordHref: string }) {
  return (
    <div className={styles.popPanel}>
      <h2 className={styles.popTitle}>{title}</h2>
      {children}
      <Link className={styles.popLink} href={recordHref}>
        Open the patient record
      </Link>
    </div>
  );
}

/** Contacts: carer, close family, nominated person, next of kin, with a copy for each phone. */
export function ContactsPop({ patientId, recordHref }: { patientId: string; recordHref: string }) {
  const contacts = contactsFor(patientId);
  return (
    <Popover
      label="Contacts"
      align="end"
      trigger={(props) => (
        <Button {...props} variant="onHero" size="sm" icon={Users} className={phoneRows.heroPill}>
          Contacts
          {contacts.length ? <span className={formStyles.heroCount}> {contacts.length}</span> : null}
        </Button>
      )}
    >
      {() => (
        <Panel title="Contacts" recordHref={recordHref}>
          {contacts.length ? (
            <ul className={styles.popList}>
              {contacts.map((c, index) => (
                <li key={`${index}-${c.name}-${c.role}`} className={styles.popItem}>
                  <span>
                    <b>{c.name}</b> · {c.role}
                    {c.relationship ? `, ${c.relationship.toLowerCase()}` : ""}
                    {c.notify ? <span className={styles.popTag}>Must be told</span> : null}
                  </span>
                  <PhoneLine phone={c.phone} who={c.name} />
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.popQuiet}>No contacts on the synthetic record.</p>
          )}
        </Panel>
      )}
    </Popover>
  );
}

/** The community team in the banner: its name opens the team, case manager and contacts. */
export function TeamPop({ patientId, recordHref }: { patientId: string; recordHref: string }) {
  const team = communityFor(patientId);
  if (!team) return <b>Not recorded</b>;
  const active = team.status === "active";
  const rows: [string, ReactNode][] = [
    ["Program", `${team.program}, since ${team.since}${team.ended ? `, ended ${team.ended}` : ""}`],
    [
      "Case manager",
      <span key="cm" className={styles.popStack}>
        <span>
          {team.caseManager.name} · {team.caseManager.role}
        </span>
        <PhoneLine phone={team.caseManager.phone} who={team.caseManager.name} />
      </span>,
    ],
  ];
  if (team.psychiatrist) rows.push(["Psychiatrist", `${team.psychiatrist.name} · ${team.psychiatrist.role}`]);
  if (team.lastContact) rows.push(["Last contact", team.lastContact]);
  if (team.nextContact) rows.push(["Next contact", team.nextContact]);
  return (
    <Popover
      label="Community team"
      trigger={(props) => (
        <button {...props} type="button" className={styles.teamLink}>
          {team.team} · {active ? "active" : "ended"}
        </button>
      )}
    >
      {() => (
        <Panel
          title={
            <>
              {team.team} <span className={styles.popTag}>{active ? "Active" : "Ended"}</span>
            </>
          }
          recordHref={recordHref}
        >
          <dl className={styles.popFacts}>
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      )}
    </Popover>
  );
}

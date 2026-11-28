"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { ShowMoreRow, cx, foldHidden, foldLimit } from "@/components/wf";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { createPatientResolver } from "@/components/ward-management/ward-patient-resolver";

import { placePeople } from "./hub-place-people";
import styles from "./hub.module.css";

const PANEL_LIST_LIMIT = 6;

/**
 * Find (mock-up, 26 Nov 2026): the old Places preview's "Heading here" list, as a section of the
 * ward's own side panel: the people whose open movement has been accepted by this ward, longest wait
 * first, each opening the person. Same derivation (`placePeople`) and the same list look as Places.
 */
export function HeadingHere({ unitId }: { unitId: string }) {
  const { movements, patients, referrals, plannedAdmissions } = useWardFlowSelect(
    "movements",
    "patients",
    "referrals",
    "plannedAdmissions",
  );
  const resolve = useMemo(
    () => createPatientResolver({ patients, referrals, movements, plannedAdmissions }),
    [patients, referrals, movements, plannedAdmissions],
  );
  const people = placePeople({ id: unitId, kind: "ward" }, movements, resolve);
  const [open, setOpen] = useState(false);
  const shown = open ? people : people.slice(0, foldLimit(people.length, PANEL_LIST_LIMIT));
  return (
    <section className={cx(styles.detailSection, styles.listSection)} aria-label="Heading here">
      <h3>Heading here</h3>
      {people.length === 0 ? (
        <p className={styles.absent}>Nobody is heading here.</p>
      ) : (
        <>
          <ul className={styles.peopleList}>
            {shown.map((person) => (
              <li key={person.key}>
                {person.href === undefined ? person.name : <Link href={person.href}>{person.name}</Link>}
              </li>
            ))}
          </ul>
          {foldHidden(people.length, PANEL_LIST_LIMIT) > 0 ? (
            <ShowMoreRow expanded={open} onClick={() => setOpen((value) => !value)}>
              {open ? "Show fewer" : `Show ${foldHidden(people.length, PANEL_LIST_LIMIT)} more`}
            </ShowMoreRow>
          ) : null}
        </>
      )}
    </section>
  );
}

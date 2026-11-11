"use client";

import { useId, useMemo } from "react";
import { Hospital } from "lucide-react";

import { Card, CardBody, CardHead } from "@/components/wf";
import { recordExtrasFor } from "@/components/ward-management/patients/patient-record-extras";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { CommunityTeam } from "./community-derivations";
import { homeTeamHeadsUps, homeTeamHeadsUpWho, type CommunityEpisodesOf, type UmrnOf } from "./home-team-heads-up";
import styles from "../out-of-area/return-early-alerts.module.css";
import headsUpStyles from "./home-team-heads-up.module.css";

/** The patient record's community team episodes (the record's own list; mock-up data for now). */
const recordedEpisodes: CommunityEpisodesOf = (patientId) => recordExtrasFor(patientId)?.community;

/**
 * Home team heads-up (item 46, D-133): this team's patients with an open episode who are in an
 * emergency department now. The UMRN (D-141), the ED name and the time only: no name, reason,
 * diagnosis, risk or typed text. Renders nothing when there are none.
 */
export function HomeTeamHeadsUpCard({ team, now }: { team: CommunityTeam; now: Instant }) {
  const headingId = useId();
  const source = useOptionalWardFlowSelect("movements", "patients");
  const patients = source?.patients;
  const umrnOf = useMemo<UmrnOf>(() => {
    const byId = new Map((patients ?? []).map((patient) => [patient.id as string, patient.umrn]));
    return (patientId) => byId.get(patientId);
  }, [patients]);
  if (!source) return null;
  const items = homeTeamHeadsUps(source.movements, team, recordedEpisodes, now, umrnOf);
  if (items.length === 0) return null;
  return (
    <Card aria-labelledby={headingId} data-testid="ward-community-heads-up">
      <CardHead
        id={headingId}
        icon={Hospital}
        iconPlain
        title="Your patients in ED"
        meta={`${items.length} ${items.length === 1 ? "patient" : "patients"}`}
      />
      <CardBody>
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.key} className={styles.row} data-testid="ward-community-heads-up-item">
              <span>
                {item.umrn ? <span className={headsUpStyles.umrn}>{item.umrn}</span> : homeTeamHeadsUpWho(item)} is in{" "}
                {item.edName} since {formatInstantWithDay(item.since, now)}
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

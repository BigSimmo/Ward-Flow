"use client";

import { useId } from "react";
import { Hospital } from "lucide-react";

import { Card, CardBody, CardHead } from "@/components/wf";
import { recordExtrasFor } from "@/components/ward-management/patients/patient-record-extras";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { CommunityTeam } from "./community-derivations";
import { homeTeamHeadsUps, homeTeamHeadsUpSentence, type CommunityEpisodesOf } from "./home-team-heads-up";
import styles from "../out-of-area/return-early-alerts.module.css";

/** The patient record's community team episodes (the record's own list; mock-up data for now). */
const recordedEpisodes: CommunityEpisodesOf = (patientId) => recordExtrasFor(patientId)?.community;

/**
 * Home team heads-up (item 46, D-133): this team's patients with an open episode who are in an
 * emergency department now. ED name and time only. Renders nothing when there are none.
 */
export function HomeTeamHeadsUpCard({ team, now }: { team: CommunityTeam; now: Instant }) {
  const headingId = useId();
  const source = useOptionalWardFlowSelect("movements");
  if (!source) return null;
  const items = homeTeamHeadsUps(source.movements, team, recordedEpisodes, now);
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
              <span>{homeTeamHeadsUpSentence(item, formatInstantWithDay(item.since, now))}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

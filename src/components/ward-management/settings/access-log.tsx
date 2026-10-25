"use client";

/**
 * **THE ACCESS LOG — who opened which person's record (D-80 item 14, Josh's go 25 Oct 2026).**
 *
 * Part of the Access tab, for the access admin and the statewide coordinator: the two desks the
 * server answers. Each row is one opening of a patient record, a movement or a referral's full
 * detail, newest first. A record is shown by its id only: this desk sees no patient names, and the
 * filter runs here in the page, so nothing typed leaves it.
 *
 * The shared workspace reads the server's log (`useSharedRecordViews`). The local demo has no
 * server log, so it shows a few made-up openings by the demo staff, said so on the card.
 */
import { useContext, useMemo, useState } from "react";
import { History } from "lucide-react";

import { Card, CardBody, CardHead, Field, TextInput } from "@/components/wf";
import { ACCESS_ROLE_LABELS } from "@/components/ward-management/ward-role-access";
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import type { Unit } from "@/components/ward-management/ward-model";
import { useUnscopedWardFlow } from "@/components/ward-management/shell/ward-access";
import { accessPlaceLabel } from "@/components/ward-management/shell/ward-access-labels";
import { demoStaffLabel } from "@/components/ward-management/shell/ward-access-admin-store";
import { SharedAccessContext } from "../shell/ward-shared-access-context";
import { useSharedRecordViews, type RecordOpening } from "./access-shared-source";

import styles from "./access-settings.module.css";

/** The screen each kind of opening happened on, in words. */
const OPENED_ON: Record<string, string> = {
  patient: "Patient record",
  movement: "Movement",
  referral: "Referral detail",
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** "3 hours ago", on the demo clock. */
function agoText(at: Instant | null, now: Instant): string {
  if (at === null) return "time not sent";
  const minutes = Math.max(0, now - at);
  if (minutes < 1) return "just now";
  const amount =
    minutes >= MINUTES_PER_DAY
      ? plural(Math.round(minutes / MINUTES_PER_DAY), "day")
      : minutes >= 60
        ? plural(Math.round(minutes / 60), "hour")
        : plural(minutes, "minute");
  return `${amount} ago`;
}

/** Made-up openings for the local demo, placed around `now`, by the demo staff in the roles list. */
function demoOpenings(now: Instant): RecordOpening[] {
  const desks: Pick<RecordOpening, "actorId" | "access" | "surface">[] = [
    {
      actorId: "demo-staff-a",
      access: { role: "ward", scope: { kind: "ward", unitIds: ["fsh-adult-secure"] } },
      surface: "referral",
    },
    { actorId: "demo-staff-b", access: { role: "ed", scope: { kind: "ed", edId: "fsh-ed" } }, surface: "patient" },
    {
      actorId: "demo-staff-c",
      access: { role: "bed_manager", scope: { kind: "site", siteCode: "FSH" } },
      surface: "movement",
    },
    {
      actorId: "demo-staff-d",
      access: { role: "coordinator", scope: { kind: "service", service: "South Metro" } },
      surface: "patient",
    },
  ];
  // Made-up record ids that name no record in the demo: no patient is joined to anyone (D-14).
  const ids = ["PT-DEMO-1", "PT-DEMO-2", "PT-DEMO-3"];
  return [12, 47, 95, 180, 410, 1500].map((minutesAgo, index) => ({
    ...desks[index % desks.length],
    id: `demo-opening-${index}`,
    recordId: ids[index % ids.length],
    at: now - minutesAgo,
  }));
}

/** The Access log card. */
export function AccessLog() {
  const { units, now } = useUnscopedWardFlow();
  const shared = useSharedRecordViews(useContext(SharedAccessContext), now, true);
  const demo = useMemo(() => (shared ? [] : demoOpenings(now)), [shared, now]);
  const openings = shared ? shared.openings : demo;
  const label = shared ? shared.label : demoStaffLabel;
  const [filter, setFilter] = useState("");
  const wanted = filter.trim().toLowerCase();
  const shown = wanted
    ? openings.filter(
        (opening) =>
          opening.recordId.toLowerCase().includes(wanted) || label(opening.actorId).toLowerCase().includes(wanted),
      )
    : openings;

  return (
    <Card data-testid="ward-access-log">
      <CardHead title="Access log" icon={History} meta={plural(shown.length, "opening")} />
      <CardBody flush>
        <p className={styles.empty}>
          {shared
            ? "Who opened which person's record, newest first: patient records, movements and referral details. The server lists its newest 200 openings by desks inside your place. A record is shown by its id only."
            : "Demo only: made-up openings by the demo staff, held for this tab only. In the shared workspace this list comes from the server's log."}
        </p>
        <div className={styles.form}>
          <Field label="Find a record id or account">
            <TextInput
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </div>
        {shared?.problem ? (
          <p className={styles.empty} role="alert">
            The access log could not be read from the server. Nothing is shown in its place. Open this tab again to
            retry.
          </p>
        ) : null}
        {shared?.loading ? (
          <p className={styles.empty} role="status">
            Reading from the server.
          </p>
        ) : shown.length === 0 && !shared?.problem ? (
          <p className={styles.empty}>{wanted ? "No opening matches." : "No record openings to show."}</p>
        ) : (
          <ul className={styles.list}>
            {shown.map((opening) => (
              <li key={opening.id} className={styles.row} data-testid="ward-access-log-row">
                <span className={styles.who}>
                  <span className={styles.name}>
                    {opening.recordId}, {OPENED_ON[opening.surface] ?? "Record"}
                  </span>
                  <span className={styles.meta}>
                    {label(opening.actorId)}
                    {opening.access ? `, ${deskText(opening.access, units)}` : ""}. {agoText(opening.at, now)}.
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function deskText(access: NonNullable<RecordOpening["access"]>, units: readonly Unit[]): string {
  return `${ACCESS_ROLE_LABELS[access.role]}, ${accessPlaceLabel(access, units)}`;
}

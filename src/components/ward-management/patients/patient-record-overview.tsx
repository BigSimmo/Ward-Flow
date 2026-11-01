import { ArrowUpRight, FileText, History, IdCard, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatDateOfBirth, type Patient } from "@/components/ward-management/ward-patients";
import type { PatientNowRecord } from "./patient-now-records";
import { hasCommunityEngagement, recordExtrasFor } from "./patient-record-extras";
import styles from "./patient-record-overview.module.css";

type RecordTab = "history" | "community" | "details" | "documents";

/**
 * Redesign (Josh, 1 Nov 2026): for a record with nothing open, Now says "Not currently active" in
 * the status card above, and this row is the way into the record: one container, four tiles, each
 * opening its tab. A recorded catchment is never treated as proof of active community care.
 */
export function PatientRecordOverview({
  patient,
  record,
  onOpen,
}: {
  patient?: Patient;
  record: PatientNowRecord;
  onOpen: (tab: RecordTab) => void;
}) {
  // Round 2 (1 Nov 2026): the tiles read the fuller record (earlier episodes, community engagement,
  // the document register), and Community appears only when engagement is noted, as its tab does.
  const extras = recordExtrasFor(patient?.id);
  const episodes = extras?.episodes ?? [];
  const presentations = record.presentations.length + episodes.length;
  const documents = record.documents.length + (extras?.documents.length ?? 0);
  const lastDischarge = episodes.find((episode) => episode.kind === "admission" && episode.end);
  const engagement = extras?.community?.find((item) => item.status === "active") ?? extras?.community?.[0];
  const showCommunity = hasCommunityEngagement(patient?.id, patient?.communityTreatmentOrder);
  const tiles: { tab: RecordTab; icon: LucideIcon; label: string; value: string; sub: string }[] = [
    {
      tab: "history",
      icon: History,
      label: "History",
      value: presentations === 0 ? "None" : String(presentations),
      sub: lastDischarge?.end
        ? `episodes · last discharged ${lastDischarge.end}`
        : presentations === 1
          ? "episode recorded"
          : "episodes recorded",
    },
    ...(showCommunity
      ? [
          {
            tab: "community" as const,
            icon: Users,
            label: "Community",
            value: engagement ? (engagement.status === "active" ? "Active" : "Ended") : "CTO",
            sub: engagement
              ? `${engagement.team.replace(/ Community Team$/, "")} · ${engagement.caseManager.name}`
              : "community treatment order on record",
          },
        ]
      : []),
    {
      tab: "details",
      icon: IdCard,
      label: "Details",
      value: patient?.umrn ?? "Not recorded",
      sub: patient ? `DOB ${formatDateOfBirth(patient.dateOfBirth)}` : "Demographics not recorded",
    },
    {
      tab: "documents",
      icon: FileText,
      label: "Documents",
      value: documents === 0 ? "None" : String(documents),
      sub: documents === 1 ? "document on record" : "documents on record",
    },
  ];
  return (
    <section className={styles.hub} aria-label="Patient record">
      <h2 className={styles.label}>The record</h2>
      <div className={styles.row} data-count={tiles.length}>
        {tiles.map((tile) => (
          <button key={tile.tab} type="button" className={styles.tile} onClick={() => onOpen(tile.tab)}>
            <span className={styles.tileHead}>
              <span className={styles.chip} aria-hidden="true">
                <tile.icon size={15} aria-hidden="true" />
              </span>
              {tile.label}
              <ArrowUpRight size={15} aria-hidden="true" className={styles.go} />
            </span>
            <strong className={styles.value}>{tile.value}</strong>
            <span className={styles.sub}>{tile.sub}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

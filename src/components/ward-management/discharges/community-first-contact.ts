/**
 * Community first contact date (item 22) on the ward's discharge record: "Community team first saw
 * them: 12 Nov", once the community team has recorded it. Read from the contacts the team already
 * records on the stay's care journey (`RECORD_ADMISSION_CARE`, D-122 item 4); nothing new is stored.
 * A date only: no overdue colour and no count of days.
 */
import { careRecordedByLabel, type CareJourney } from "@/components/ward-management/ward-care-journey";
import { perthDateLabel, type Instant } from "@/components/ward-management/ward-clock";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";

/** The earliest completed contact the community team recorded, or null until there is one. */
export function communityFirstContactAt(record: { readonly careJourney?: CareJourney }): Instant | null {
  let first: Instant | null = null;
  for (const contact of record.careJourney?.contacts ?? []) {
    if (contact.outcome !== "completed") continue;
    if (careRecordedByLabel(contact.recordedBy) !== WARD_FLOW_ROLE_LABELS.community) continue;
    if (!Number.isFinite(contact.contactedAt)) continue;
    if (first === null || contact.contactedAt < first) first = contact.contactedAt;
  }
  return first;
}

/** "Community team first saw them: 12 Nov", or null while nothing is recorded. */
export function communityFirstContactWords(
  record: { readonly careJourney?: CareJourney },
  dayZero: Date,
): string | null {
  const at = communityFirstContactAt(record);
  return at === null
    ? null
    : `Community team first saw them: ${perthDateLabel(at, dayZero, { day: "numeric", month: "short" })}`;
}

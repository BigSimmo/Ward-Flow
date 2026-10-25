import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease } from "@/components/ward-management/ward-model";

/**
 * A pending named discharge follows the stay's current plan after rescheduling. An undated or
 * missing stay falls back to the ward's release estimate. Completed releases retain their history.
 * This is a projection only: the release and its reporting provenance are never changed.
 */
export function forecastReleaseAt(release: BedRelease, admission: Admission | undefined): Instant {
  return release.state === "discharged" ? release.expectedAt : (admission?.expectedDischargeAt ?? release.expectedAt);
}

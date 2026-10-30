// Role view (executive) only: no source file. Stands in for `PlannedAdmissionsPanel`, which lists
// each booking with its legal status and reason; the executive desk gets the counts alone.
import { Card, CardHead } from "@/components/wf";
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import styles from "@/components/ward-redesign/capacity/capacity-redesign.module.css";

export function PlannedCounts({ now }: { now: Instant }) {
  const { plannedAdmissions } = useWardFlowSelect("plannedAdmissions");
  const booked = (plannedAdmissions ?? []).filter((booking) => booking.state === "booked");
  const overdue = booked.filter((booking) => booking.expectedArrivalAt < now).length;
  const nextDay = booked.filter(
    (booking) => booking.expectedArrivalAt >= now && booking.expectedArrivalAt < now + MINUTES_PER_DAY,
  ).length;
  const later = booked.length - overdue - nextDay;
  return (
    <Card aria-labelledby="as-executive-planned-title" data-testid="as-executive-planned-counts">
      <CardHead
        id="as-executive-planned-title"
        title="Planned admissions"
        meta={`${booked.length} booked · counts only`}
      />
      <div className={styles.sideBody}>
        {booked.length === 0 ? (
          <p className={styles.small}>No planned admission is booked.</p>
        ) : (
          <ul className={styles.kvList}>
            <li>
              <span>Expected in the next 24 hours</span>
              <b>{nextDay}</b>
            </li>
            <li>
              <span>Expected later</span>
              <b>{later}</b>
            </li>
            <li>
              <span>Past the expected time, arrival not recorded</span>
              <b>{overdue}</b>
            </li>
          </ul>
        )}
      </div>
    </Card>
  );
}

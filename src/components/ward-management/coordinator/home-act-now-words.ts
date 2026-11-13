/**
 * Home's Act now answer (A9-04, Josh 13 Nov 2026). Home's Act now counts act-now alerts plus
 * accepted referrals with no bed pulled (`alertsNowFigures`), which have no movement and so are not
 * on Handover's Act now (people on the move, `handover-glance.tsx`). When there are any, the answer
 * names both parts, so "4 need a person now" here and "3 act now" on Handover never read as a
 * disagreement.
 */
export function homeActNowAnswer(actNow: number, awaitingPull: number, scope = ""): string {
  const head = `${actNow} ${actNow === 1 ? "needs" : "need"} a person now${scope}`;
  if (awaitingPull <= 0) return head;
  const alerts = actNow - awaitingPull;
  const parts = [
    ...(alerts > 0 ? [`${alerts} ${alerts === 1 ? "alert" : "alerts"}`] : []),
    `${awaitingPull} accepted with no bed pulled`,
  ];
  return `${head}: ${parts.join(", ")}`;
}

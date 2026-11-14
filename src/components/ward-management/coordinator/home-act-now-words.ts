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

/**
 * Wave 4 Home (D-191, notes item 4): the act box says the head on its own line ("4 need a person
 * now") and the parts on the next ("3 alerts, 1 accepted with no bed pulled"), so the head never
 * runs into an ellipsis on a phone. Same words as `homeActNowAnswer`, split in two.
 */
export function homeActNowParts(
  actNow: number,
  awaitingPull: number,
  scope = "",
): { head: string; detail: string | undefined } {
  const whole = homeActNowAnswer(actNow, awaitingPull, scope);
  const split = whole.indexOf(": ");
  return split < 0
    ? { head: whole, detail: undefined }
    : { head: whole.slice(0, split), detail: whole.slice(split + 2) };
}

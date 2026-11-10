/**
 * M43 (master audit list, 10 Nov 2026; absorbs M73 stuck and ageing work): a support check for quiet
 * failures. It reads one saved Ward Flow state (a local synthetic save or a support export) and flags:
 *
 * - referrals still waiting for an answer past a set age (default 24 hours since raised), and
 *   accepted referrals with no journey started past the same age;
 * - refusals rising: denied audit rows in the latest window against the window before it.
 *
 *     node scripts/run-tsx.mjs scripts/ward-flow/stuck-work-check.ts <state.json> [--now <minutes>]
 *       [--max-age-hours 24] [--window-hours 6]
 *
 * It prints record ids, ages and counts only: never a name, UMRN or typed text. Exit code 1 when
 * anything is flagged, so a scheduled job can alert on it. Offline only: it reads a file and touches
 * no database, network or provider. Running it on a schedule against the hosted workspace is a
 * separate, provider-backed step that needs Josh's yes (see docs/ward-flow/evidence/stuck-saves-drill-2026-11-10.md).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { referralState } from "../../src/components/ward-management/ward-referrals";
import type { WardFlowState } from "../../src/components/ward-management/ward-flow-reducer";

export type StuckWorkOptions = {
  /** Minutes a referral may wait in one state before it is flagged. */
  referralMaxAgeMinutes: number;
  /** Width, in minutes, of each refusal window compared. */
  refusalWindowMinutes: number;
};

export const DEFAULT_STUCK_WORK_OPTIONS: StuckWorkOptions = {
  referralMaxAgeMinutes: 24 * 60,
  refusalWindowMinutes: 6 * 60,
};

export type StuckReferral = {
  referralId: string;
  state: "waiting for an answer" | "accepted, no journey";
  ageMinutes: number;
};

export type StuckWorkReport = {
  stuckReferrals: StuckReferral[];
  refusals: { latestWindow: number; previousWindow: number; rising: boolean };
  flagged: boolean;
};

type CheckedState = Pick<WardFlowState, "referrals" | "movements" | "auditEvents">;

export function stuckWorkReport(
  state: CheckedState,
  now: number,
  options: StuckWorkOptions = DEFAULT_STUCK_WORK_OPTIONS,
): StuckWorkReport {
  const stuckReferrals: StuckReferral[] = [];
  for (const referral of state.referrals) {
    const ageMinutes = now - referral.raisedAt;
    if (!Number.isFinite(ageMinutes) || ageMinutes <= options.referralMaxAgeMinutes) continue;
    // A referral the referrer took back is settled, not stuck.
    if (referral.destinations.every((arm) => arm.withdrawnAt !== undefined)) continue;
    const status = referralState(referral);
    if (status === "queued") {
      stuckReferrals.push({ referralId: referral.id, state: "waiting for an answer", ageMinutes });
      continue;
    }
    // A ward accepted, but no journey to that ward was ever started.
    const wardAccepted = referral.destinations.some(
      (arm) => arm.state === "accepted" && arm.destination.kind === "psychiatric_ward",
    );
    if (
      status === "accepted" &&
      wardAccepted &&
      !state.movements.some((movement) => movement.referralId === referral.id)
    )
      stuckReferrals.push({ referralId: referral.id, state: "accepted, no journey", ageMinutes });
  }
  stuckReferrals.sort((a, b) => b.ageMinutes - a.ageMinutes);

  const window = options.refusalWindowMinutes;
  // A row whose time could not be read (`at: null`) is left out rather than guessed.
  const denied = state.auditEvents.flatMap((row) => (row.outcome === "denied" && row.at !== null ? [row.at] : []));
  const latestWindow = denied.filter((at) => at > now - window && at <= now).length;
  const previousWindow = denied.filter((at) => at > now - 2 * window && at <= now - window).length;
  // Rising: more than the window before, and at least three, so one stray refusal is not an alert.
  const rising = latestWindow >= 3 && latestWindow > previousWindow;

  return {
    stuckReferrals,
    refusals: { latestWindow, previousWindow, rising },
    flagged: stuckReferrals.length > 0 || rising,
  };
}

function readFlag(args: string[], name: string): number | undefined {
  const at = args.indexOf(name);
  if (at < 0) return undefined;
  const value = Number(args[at + 1]);
  if (!Number.isFinite(value)) throw new Error(`${name} needs a number`);
  return value;
}

function main(args: string[]) {
  // Skip the value after each value flag, so a dated state file such as 2026-11-10-state.json is kept.
  const valueFlags = new Set(["--now", "--max-age-hours", "--window-hours"]);
  const file = args.find((arg, index) => !arg.startsWith("--") && !valueFlags.has(args[index - 1] ?? ""));
  if (!file) {
    console.error("Usage: stuck-work-check.ts <state.json> [--now <minutes>] [--max-age-hours 24] [--window-hours 6]");
    process.exit(2);
  }
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { state?: CheckedState } & Partial<CheckedState>;
  const state = (parsed.state ?? parsed) as CheckedState;
  const latestAudit = Math.max(0, ...(state.auditEvents ?? []).map((row) => row.at ?? 0));
  const now = readFlag(args, "--now") ?? latestAudit;
  const report = stuckWorkReport(
    { referrals: state.referrals ?? [], movements: state.movements ?? [], auditEvents: state.auditEvents ?? [] },
    now,
    {
      referralMaxAgeMinutes: (readFlag(args, "--max-age-hours") ?? 24) * 60,
      refusalWindowMinutes: (readFlag(args, "--window-hours") ?? 6) * 60,
    },
  );
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.flagged ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main(process.argv.slice(2));

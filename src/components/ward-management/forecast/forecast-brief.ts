// src/components/ward-management/forecast/forecast-brief.ts
//
// "Brief for this meeting" on the bed meeting screen (forecasting build, Josh, 23 Oct 2026,
// screen 5). Four fixed sentence templates filled with counts already on screen. Nothing is
// generated, ranked by a model or worded freely, so the brief can never say more than the records.
import type { BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import type { EdAccessRisk } from "./ed-access-risk";
import { BED_KIND_LABEL, kindRangeWord, type ForecastByKind } from "./forecast-by-kind";
import { shortBlocker, type ForecastLever } from "./forecast-levers";

export type BriefLine = { label: string; text: string };

export function forecastBrief(
  tomorrow: ForecastByKind,
  levers: readonly ForecastLever[],
  risk: EdAccessRisk,
  edName: (edId: string) => string,
): BriefLine[] {
  return [
    { label: "Tightest", text: tightest(tomorrow) },
    { label: "Biggest blocker", text: biggestBlocker(levers) },
    { label: "ED waits", text: edRisk(risk, edName) },
    { label: "Biggest lever", text: bestAction(levers) },
  ];
}

function tightest(tomorrow: ForecastByKind): string {
  const worst = [...tomorrow.kinds].sort((a, b) => a.likely - b.likely)[0];
  if (!worst || worst.likely >= 0) return "No bed type is short tomorrow on what wards have recorded.";
  return `${BED_KIND_LABEL[worst.id]} beds. ${worst.waiting} waiting, ${worst.bedsThatFit} fit now, likely ${kindRangeWord(worst.likely)} tomorrow.`;
}

function biggestBlocker(levers: readonly ForecastLever[]): string {
  const held = levers.find((lever) => lever.kind === "clear_held_up");
  if (!held || held.kind !== "clear_held_up") return "No release due tomorrow is held up.";
  const named = held.reasons.slice(0, 2).map((entry) => `${entry.count} for ${reasonWord(entry.reason)}`);
  const list = named.length === 2 ? `${named[0]} and ${named[1]}` : named[0];
  return `${held.beds} ${held.beds === 1 ? "release" : "releases"} held up, ${list}.`;
}

function edRisk(risk: EdAccessRisk, edName: (edId: string) => string): string {
  const hours = Math.round(risk.targetMinutes / 60);
  const first = [...risk.byEd].sort(
    (a, b) => b.atRisk - a.atRisk || (a.firstMinutesLeft ?? 0) - (b.firstMinutesLeft ?? 0),
  )[0];
  if (!first || first.atRisk === 0) {
    return risk.alreadyOver > 0
      ? `${risk.alreadyOver} ${risk.alreadyOver === 1 ? "person has" : "people have"} already passed ${hours} hours in ED.`
      : `No one in ED will pass ${hours} hours in the next day on what is recorded.`;
  }
  const people = first.atRisk === 1 ? "1 person" : `${first.atRisk} people`;
  const verb = first.atRisk === 1 ? "passes" : "pass";
  return `${people} at ${edName(first.edId)} ${verb} ${hours} hours before a suitable bed is due.`;
}

function bestAction(levers: readonly ForecastLever[]): string {
  const top = levers[0];
  if (!top) return "Nothing on record would move tomorrow's figure.";
  const upTo = `Up to ${top.beds} ${top.beds === 1 ? "bed" : "beds"}.`;
  switch (top.kind) {
    case "confirm_dates":
      return `Ask ${top.wards.length} ${top.wards.length === 1 ? "ward" : "wards"} to confirm tomorrow's discharges. ${upTo}`;
    case "clear_held_up":
      return `Clear held-up releases, starting with ${reasonWord(top.reasons[0]!.reason)}. ${upTo}`;
    case "review_overdue":
      return `Check ${top.beds} overdue ${top.beds === 1 ? "release" : "releases"} with wards. It widens the range only.`;
  }
}

/** A blocker as it reads after "held up for": "a clean", "transport". */
function reasonWord(reason: BedReleaseBlocker): string {
  if (reason === "Awaiting clean") return "a clean";
  return shortBlocker(reason).toLowerCase();
}

"use client";

// Gaps by site: which forms and notifications each site has yet to record, and the pill that shows
// one cell. Split out of `governance-registers.tsx` (18 October 2026) to keep it under the line cap.

import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowContextValue } from "./ward-flow-provider";
import { movementHref, unitHref } from "./shell/ward-facade";
import { isOpen } from "./ward-derivations";
import { edById, edShortName } from "./ward-sites";
import { resolveSubjectPatient } from "./ward-patient-resolver";
import {
  SUPPORT_NOTIFICATION_OCCASION_LABELS,
  SUPPORT_NOTIFICATION_PARTY_SHORT,
  type SupportNotificationParty,
} from "./ward-support-notifications";
import { recentTellSubjects, recordedFacts, type RecordGap } from "./legal-forms/legal-forms-view";
import { Frac, type WfTone } from "@/components/wf";
import thirdEdition from "./governance-third-edition.module.css";
import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";
import { FORMS_HREF } from "./governance-shared";
import { communityOriginLabel } from "@/components/ward-management/ward-movement-origin";

type GapKey = RecordGap | SupportNotificationParty;
export const GAP_KEYS: GapKey[] = ["written", "received", "examination", "carer", "personal_support_person", "mhas"];
export const GAP_LABEL: Record<GapKey, string> = {
  written: "Time written",
  received: "Received",
  examination: "Examined",
  carer: "Carer",
  personal_support_person: "PSP",
  mhas: "MHAS",
};
type GapCell = { done: number; total: number };
export type SiteGap = {
  id: string;
  name: string;
  kind: "ed" | "ward";
  cells: Record<GapKey, GapCell>;
  gaps: number;
  people: { key: string; name: string; umrn: string; detail: string; missing: string[]; href: string }[];
};

function emptyCells(): Record<GapKey, GapCell> {
  return {
    written: { done: 0, total: 0 },
    received: { done: 0, total: 0 },
    examination: { done: 0, total: 0 },
    carer: { done: 0, total: 0 },
    personal_support_person: { done: 0, total: 0 },
    mhas: { done: 0, total: 0 },
  };
}

/**
 * Gaps by site. Emergency departments carry the recorded facts on the form for their open moves;
 * wards carry carer, PSP and MHAS records for their recent arrivals and discharges. A cell reads
 * done of applicable, and a dash where nothing applies.
 */
export function siteGaps(flow: WardFlowContextValue | null, now: Instant): SiteGap[] {
  if (!flow) return [];
  const sites = new Map<string, SiteGap>();
  const site = (id: string, name: string, kind: SiteGap["kind"]) => {
    const existing = sites.get(id);
    if (existing) return existing;
    const created: SiteGap = { id, name, kind, cells: emptyCells(), gaps: 0, people: [] };
    sites.set(id, created);
    return created;
  };
  for (const movement of flow.movements) {
    if (!isOpen(movement) || !movement.legalForm) continue;
    const ed = edById(movement.originEdId);
    // D-76: a journey from a community team has the form facts of a start site, under the team's row.
    const entry =
      movement.originEdId === undefined
        ? site(`community-${movement.originCommunity?.siteCode}`, communityOriginLabel(movement.originCommunity), "ed")
        : site(`ed-${movement.originEdId}`, ed ? edShortName(ed) : movement.originEdId, "ed");
    const missing: string[] = [];
    for (const fact of recordedFacts(movement)) {
      entry.cells[fact.gap].total += 1;
      if (fact.at !== undefined) entry.cells[fact.gap].done += 1;
      else missing.push(GAP_LABEL[fact.gap]);
    }
    if (missing.length > 0) {
      const person = resolveSubjectPatient(movement, flow);
      entry.gaps += missing.length;
      entry.people.push({
        key: movement.id,
        name: person.formalName,
        umrn: person.umrn,
        detail: `Form ${movement.legalForm.code}`,
        missing,
        href: `${FORMS_HREF}?movement=${encodeURIComponent(encodeRecordAddress(movement.id))}`,
      });
    }
  }
  for (const subject of recentTellSubjects(flow, now, false)) {
    if (!subject.unitId) continue;
    const entry = site(`unit-${subject.unitId}`, subject.place, "ward");
    for (const party of subject.parties) {
      entry.cells[party].total += 1;
      if (!subject.missing.includes(party)) entry.cells[party].done += 1;
    }
    if (subject.missing.length > 0) {
      entry.gaps += subject.missing.length;
      entry.people.push({
        key: subject.key,
        name: subject.name,
        umrn: subject.umrn,
        detail: SUPPORT_NOTIFICATION_OCCASION_LABELS[subject.occasion],
        missing: subject.missing.map((party) => SUPPORT_NOTIFICATION_PARTY_SHORT[party]),
        // D-14: never read the patient link here, so an admission without a move opens its ward.
        href: subject.movementId ? movementHref(subject.movementId) : unitHref(subject.unitId),
      });
    }
  }
  return [...sites.values()].sort((a, b) => b.gaps - a.gaps || a.name.localeCompare(b.name));
}

export function cellTone(cell: GapCell): WfTone | null {
  if (cell.total === 0) return null;
  if (cell.done === cell.total) return "success";
  return cell.done / cell.total < 0.5 ? "warning" : "neutral";
}

export function GapPill({ cell, label }: { cell: GapCell; label: string }) {
  const tone = cellTone(cell);
  if (tone === null) {
    return (
      <span className={thirdEdition.gapPill} data-tone="none">
        <span aria-hidden="true">–</span>
        <span className={thirdEdition.srOnly}>{label} not applicable</span>
      </span>
    );
  }
  return <Frac done={cell.done} total={cell.total} label={`${label} recorded`} tone={tone} />;
}

// The global search's result rows and groups: their types, the Discreet names titles and the
// grouping of the engine's matches. Split out of `ward-global-search.tsx` (18 October 2026) to keep
// that file under the line cap; the palette and the phone menu's search both build rows here.

import type { GlobalSearchPreviewItem } from "@/components/ward-management/search/global-search-preview";
import type { CensusRow } from "@/components/ward-management/search/patient-census";
import type { SearchAnswer } from "@/components/ward-management/search/search-answers";
import { wardFactsLine } from "@/components/ward-management/search/search-places";
import { searchGroupOrder, type SmartSearchResults } from "@/components/ward-management/search/ward-smart-search";
import { referralBoardHref } from "@/components/ward-management/ed/ed-bed-search-step";
import { destinationUnit, stageCopy, type InboxItem } from "@/components/ward-management/ward-derivations";
import { movementHref, patientHref, unitHref } from "@/components/ward-management/shell/ward-facade";
import type { Unit } from "@/components/ward-management/ward-model";
import { formatDateOfBirth, patientListName } from "@/components/ward-management/ward-patients";
import {
  resolveSubjectPatient,
  withUmrnInPlaceOfMovementIds,
  type PatientLookup,
} from "@/components/ward-management/ward-patient-resolver";

/*
 * ⚠️ **BOTH HREFS COME FROM THE FACADE NOW, AND THIS FILE BUILDS NEITHER.** Until 2026-09-10 this
 * module held its own `personHref` and `movementHref`, private to it — two builders for two routes
 * that four other files also link to. `shell/ward-facade.ts` is the one place either route is
 * written down, so a route that changes changes once. They take an ID rather than the record, which
 * is why the call sites below read `patientHref(patient.id)` rather than `personHref(patient)`.
 */

export type SearchResultItem = GlobalSearchPreviewItem & {
  kindLabel: string;
  umrn?: string;
  dateOfBirth?: string;
  readyBeds?: number;
  siteName?: string;
  /** A movement, referral or ward-stay row's patient UMRN, used only to show its title discreetly on a phone. */
  subjectUmrn?: string;
};

/**
 * A result's title through the Discreet names setting: a person or movement row names a patient,
 * so on a phone with the setting on it reads initials plus UMRN. Every other row, and desktop, keeps
 * its title. `nameFor` is `usePatientNameDisplay()`.
 */
export function patientResultTitle(
  item: SearchResultItem,
  nameFor: (name: string, umrn: string | undefined | null) => string,
): string {
  if (item.kind === "person") return nameFor(item.title, item.umrn ?? item.subjectUmrn);
  if (item.kind === "movement" || item.subjectUmrn !== undefined) return nameFor(item.title, item.subjectUmrn);
  return item.title;
}

/**
 * A "Needs you now" row's line under its title (shell-4): the patient's name (family name first,
 * through the Discreet names setting) ahead of the UMRN the task detail already carries. A row
 * that resolves to no single person keeps its detail as it was.
 */
export function needsYouMeta(
  task: Pick<InboxItem, "detail" | "movementId">,
  lookup: PatientLookup,
  nameFor: (name: string, umrn: string | undefined | null) => string,
): string {
  const detail = withUmrnInPlaceOfMovementIds(task.detail, lookup);
  if (!task.movementId) return detail;
  const info = resolveSubjectPatient({ movementId: task.movementId }, lookup);
  if (!info.patient) return detail;
  const shown = nameFor(info.formalName, info.umrn);
  if (!detail.includes(info.umrn)) return `${shown} · ${detail}`;
  return detail.replace(info.umrn, shown.includes(info.umrn) ? shown : `${shown} · ${info.umrn}`);
}

/**
 * One census row as a search result, opening where that person's record lives: the movement, the
 * referral on the board, the ward (and bed, when one is recorded) or the person's own page.
 */
export function censusRowItem(row: CensusRow): SearchResultItem {
  const meta = [row.umrn, row.where, row.timeText].filter((part) => part.length > 0).join(" · ");
  const base = { title: row.name, meta, subjectUmrn: row.umrn, personId: row.patientRecordId ?? undefined };
  if (row.kind === "movement") {
    return { ...base, kind: "movement", kindLabel: "Movement", id: row.key, href: movementHref(row.key) };
  }
  if (row.kind === "referral") {
    return { ...base, kind: "referral", kindLabel: "Referral", id: row.key, href: referralBoardHref(row.key) };
  }
  if (row.kind === "admission" && row.unitId) {
    const href = `${unitHref(row.unitId)}${row.bedNumber !== undefined ? `?bed=${row.bedNumber}` : ""}`;
    return { ...base, kind: "stay", kindLabel: row.group === "ward" ? "On ward" : "Ward list", id: row.key, href };
  }
  return {
    ...base,
    kind: "person",
    kindLabel: "Person",
    id: row.patientRecordId ?? row.key,
    href: row.patientRecordId ? patientHref(row.patientRecordId) : "/ward-flow/search",
  };
}

/** Help's rows for a query, or its fixed reply (`note`) to a clinical question. */
export type HelpSearchRows = { readonly items: readonly SearchResultItem[]; readonly note?: string };

export type SearchResultGroup = {
  key: string;
  heading: string;
  items: SearchResultItem[];
};

/**
 * Every matched group in full, in the engine's intent order. Shared by this palette and the phone
 * menu's search, so both list the same records under the same headings.
 */
export function smartSearchGroups(
  smartResults: SmartSearchResults,
  trimmed: string,
  units: Unit[],
  lookup: PatientLookup,
  answer?: SearchAnswer,
  /** Help's own answers for the query, from the caller (`ward-global-search-help.tsx`). */
  help: readonly SearchResultItem[] = [],
): SearchResultGroup[] {
  const g: SearchResultGroup[] = [];

  if (smartResults.people.length > 0) {
    g.push({
      key: "people",
      heading: "People",
      items: smartResults.people.map((p) => ({
        kind: "person",
        kindLabel: "Person",
        id: p.id,
        // shell-8: Family, Given and DD/MM/YYYY, as every other list shows a person.
        title: patientListName(p),
        meta: `${p.umrn} · born ${formatDateOfBirth(p.dateOfBirth)}`,
        umrn: p.umrn,
        dateOfBirth: p.dateOfBirth,
        href: patientHref(p.id),
      })),
    });
  }

  if (smartResults.movements.length > 0) {
    g.push({
      key: "movements",
      heading: "Movements",
      items: smartResults.movements.map((m) => {
        const dest = destinationUnit(m, units);
        const subject = resolveSubjectPatient(m, lookup);
        // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
        return {
          kind: "movement",
          kindLabel: "Movement",
          id: m.id,
          title: subject.formalName,
          subjectUmrn: subject.umrn,
          meta: `${subject.umrn} · ${stageCopy[m.stage].label}${dest ? ` · ${dest.name}` : ""}`,
          href: movementHref(m.id),
        };
      }),
    });
  }

  if (smartResults.referrals.length > 0) {
    g.push({
      key: "referrals",
      heading: "Referrals",
      items: smartResults.referrals.map((r) => ({
        kind: "referral",
        kindLabel: "Referral",
        id: r.referral.id,
        title: r.formalName,
        subjectUmrn: r.umrn,
        personId: resolveSubjectPatient(r.referral, lookup).patient?.id,
        meta: `${r.umrn} · Waiting for a bed`,
        href: referralBoardHref(r.referral.id),
      })),
    });
  }
  if (smartResults.beds.length > 0) {
    g.push({
      key: "beds",
      heading: "Beds",
      items: smartResults.beds.map((b) => ({
        kind: "bed",
        kindLabel: "Bed",
        id: `${b.unit.id}:${b.bedNumber}`,
        title: `Bed ${b.bedNumber} · ${b.unit.name}`,
        meta: b.siteName,
        href: b.href,
      })),
    });
  }
  if (smartResults.wards.length > 0) {
    g.push({
      key: "wards",
      heading: smartResults.readyBedsOnly ? "Wards with a ready bed" : "Wards",
      items: smartResults.wards.map((w) => ({
        kind: "ward",
        kindLabel: "Ward",
        id: w.unit.id,
        title: w.unit.name,
        meta: [
          w.siteName,
          w.readyBeds === null ? "ready beds not recorded" : `${w.readyBeds} ready`,
          wardFactsLine(w.unit),
        ]
          .filter((part) => part.length > 0)
          .join(" · "),
        siteName: w.siteName,
        readyBeds: w.readyBeds ?? undefined,
        href: w.href,
      })),
    });
  }

  if (smartResults.emergencyDepartments.length > 0) {
    g.push({
      key: "eds",
      heading: "ED",
      items: smartResults.emergencyDepartments.map((e) => ({
        kind: "ed",
        kindLabel: "ED",
        id: e.ed.id,
        title: `${e.ed.name} (${e.ed.siteCode})`,
        meta: "Emergency Department",
        href: e.href,
      })),
    });
  }

  if (smartResults.communityTeams.length > 0) {
    g.push({
      key: "teams",
      heading: "Community",
      items: smartResults.communityTeams.map((c) => ({
        kind: "community",
        kindLabel: "Community",
        id: c.team.id,
        title: c.team.name,
        meta: "Community Mental Health Team",
        href: c.href,
      })),
    });
  }

  if (smartResults.legalForms.length > 0) {
    g.push({
      key: "forms",
      heading: "Legal",
      items: smartResults.legalForms.map((f) => ({
        kind: "form",
        kindLabel: "Legal Form",
        id: f.form.code.toLowerCase(),
        title: `Form ${f.form.code}`,
        meta: f.title,
        href: f.href,
      })),
    });
  }

  if (smartResults.views.length > 0) {
    g.push({
      key: "views",
      heading: "Screens",
      items: smartResults.views.map((v) => ({
        kind: "view",
        kindLabel: "View",
        id: v.view.key,
        title: v.view.title,
        meta: v.view.description ?? "View",
        href: v.href,
      })),
    });
  }

  if (smartResults.tasks.length > 0) {
    g.push({
      key: "tasks",
      heading: "Tasks",
      items: smartResults.tasks.map((t) => ({
        kind: "task",
        kindLabel: "Task",
        id: t.task.id,
        title: t.task.title,
        meta: withUmrnInPlaceOfMovementIds(t.task.detail, lookup),
        href: t.href,
        movementId: t.task.movementId,
        tone: t.task.tone,
      })),
    });
  }

  if (smartResults.suburbs.length > 0) {
    g.push({
      key: "suburbs",
      heading: "Suburb catchment",
      items: smartResults.suburbs.map((result) => ({
        kind: "suburb",
        kindLabel: "Suburb",
        id: result.suburb.toLowerCase(),
        title: result.postcodes.length > 0 ? `${result.suburb} ${result.postcodes.join(", ")}` : result.suburb,
        // A contested or unreviewed suburb names no single clinic: the lookup's own status says why.
        meta:
          result.status === "Reviewed clinic match"
            ? `${result.clinic} · ${result.service}`
            : `${result.status} · check in the suburb lookup`,
        href: result.href,
      })),
    });
  }

  if (smartResults.contacts.length > 0) {
    g.push({
      key: "contacts",
      heading: "Contacts",
      items: smartResults.contacts.map((contact) => ({
        kind: "contact",
        kindLabel: "Contact",
        id: contact.entry.id,
        title: contact.entry.name,
        meta: [contact.number, contact.entry.place].filter(Boolean).join(" · "),
        href: contact.href,
      })),
    });
  }

  if (help.length > 0) g.push({ key: "help", heading: "Help", items: [...help] });

  const order = searchGroupOrder(smartResults.intent, trimmed);
  const position = new Map<string, number>(order.map((key, index) => [key, index]));
  g.sort((left, right) => (position.get(left.key) ?? order.length) - (position.get(right.key) ?? order.length));
  if (!answer) return g;
  // A question's answer leads, and a record it already lists is not listed again further down.
  const answered = answer.rows.map(censusRowItem);
  const shown = new Set(answered.map((item) => item.href));
  const rest = g
    .map((group) => ({ ...group, items: group.items.filter((item) => !shown.has(item.href)) }))
    .filter((group) => group.items.length > 0);
  return [{ key: "answers", heading: answer.question.heading, items: answered }, ...rest];
}

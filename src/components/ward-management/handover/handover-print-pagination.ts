import type { HandoverRow, HandoverWard, HeldDischarge, RowGroup } from "./handover-model";

export type PaperItem =
  | { kind: "group"; group: RowGroup; continued: boolean }
  | { kind: "row"; row: HandoverRow }
  | { kind: "isbar"; row: HandoverRow };
export type ExtraEntry =
  { kind: "ward"; ward: HandoverWard } | { kind: "hold"; hold: HeldDischarge } | { kind: "noHolds" } | { kind: "sigs" };
type ExtraSectionId = "beds" | "holds" | "sigs";
export type ExtraSection = { id: ExtraSectionId; entries: ExtraEntry[]; continued: boolean };

export type PaperMeasurements = {
  mainBudget: number;
  extraBudget: number;
  firstPageCost: number;
  itemHeights: Record<string, number>;
  extraHeights: Record<string, number>;
  extraHeads: Record<string, number>;
};

export function paperItemKey(item: PaperItem): string {
  return item.kind === "group" ? `group:${item.group.id}` : `${item.kind}:${item.row.id}`;
}

export function extraEntryKey(entry: ExtraEntry): string {
  if (entry.kind === "ward") return `ward:${entry.ward.id}`;
  if (entry.kind === "hold") return `hold:${entry.hold.admission.id}`;
  return entry.kind;
}

const fallbackItemHeight = (item: PaperItem) => (item.kind === "group" ? 22 : item.kind === "isbar" ? 20 : 23);

/** Use measured, unscaled row heights. Keep headings and ISBAR with their patient. */
export function paginateHandoverItems(
  items: PaperItem[],
  fallbackBudget: number,
  firstPageCost: number,
  measured: PaperMeasurements | null,
): PaperItem[][] {
  const budget = measured?.mainBudget ?? fallbackBudget;
  const height = (item: PaperItem) => measured?.itemHeights[paperItemKey(item)] ?? fallbackItemHeight(item);
  const pages: PaperItem[][] = [[]];
  let used = measured?.firstPageCost ?? firstPageCost;
  let current: RowGroup | null = null;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    if (item.kind === "group") current = item.group;
    let need = height(item);
    // Reserve the whole first patient block when adding a heading, not just its first line.
    let next = index + 1;
    if (item.kind === "group" && items[next]?.kind === "row") need += height(items[next++]!);
    if ((item.kind === "group" || item.kind === "row") && items[next]?.kind === "isbar") {
      need += height(items[next]!);
    }
    const page = pages[pages.length - 1]!;
    if (item.kind !== "isbar" && used + need > budget && page.length > 0) {
      pages.push([]);
      used = 0;
      if (item.kind !== "group" && current !== null) {
        const continued: PaperItem = { kind: "group", group: current, continued: true };
        pages[pages.length - 1]!.push(continued);
        used += height(continued);
      }
    }
    pages[pages.length - 1]!.push(item);
    used += height(item);
  }
  return pages;
}

const EXTRA_SECTION: Record<ExtraEntry["kind"], ExtraSectionId> = {
  ward: "beds",
  hold: "holds",
  noHolds: "holds",
  sigs: "sigs",
};

/** Paginate the actual extra-section rows, preserving the approved landscape columns. */
export function paginateHandoverExtras(
  streams: ExtraEntry[][],
  fallbackBudget: number,
  measured: PaperMeasurements | null,
): ExtraSection[][][] {
  const budget = measured?.extraBudget ?? fallbackBudget;
  const columns = streams.map((stream) => {
    const pages: ExtraSection[][] = [[]];
    const seen = new Set<ExtraSectionId>();
    let used = 0;
    for (const entry of stream) {
      const id = EXTRA_SECTION[entry.kind];
      let page = pages[pages.length - 1]!;
      let section = page[page.length - 1]?.id === id ? page[page.length - 1]! : null;
      const head = measured?.extraHeads[id] ?? (id === "sigs" ? 0 : 50);
      const row = measured?.extraHeights[extraEntryKey(entry)] ?? (entry.kind === "sigs" ? 105 : 23);
      if (used + (section ? 0 : head) + row > budget && page.length > 0) {
        page = [];
        pages.push(page);
        section = null;
        used = 0;
      }
      if (section === null) {
        section = { id, entries: [], continued: seen.has(id) };
        seen.add(id);
        page.push(section);
        used += head;
      }
      section.entries.push(entry);
      used += row;
    }
    return pages;
  });
  const count = Math.max(...columns.map((pages) => pages.length));
  return Array.from({ length: count }, (_, index) => columns.map((pages) => pages[index] ?? []));
}

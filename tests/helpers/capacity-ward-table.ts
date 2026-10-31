// Readers for Capacity's bed map (the October 2026 redesign, `capacity-bed-map-cards.tsx`): one
// card per ward, grouped by health service, with Grid and Rows layouts.
//
// ⚠️ `showWardTable` and `ensureWardTable` are kept only because other suites still import them.
// They open the bed map's old Table layout (device audit option A, 11 Oct 2026), which the
// redesign removed, so a call now throws: a suite that still needs the ward table must migrate to
// the bed map readers below or to All wards (`/ward-flow/wards`), where every ward is a table now.
import { fireEvent, screen, within } from "@testing-library/react";

export function showWardTable(): void {
  const layouts = screen.getByRole("group", { name: "Bed map layout" });
  fireEvent.click(within(layouts).getByRole("button", { name: "Table" }));
}

/** Opens the Table layout only when the ward table is not already showing. */
export function ensureWardTable(): void {
  if (!screen.queryByTestId("ward-capacity-network-table")) showWardTable();
}

/** The bed map card ("Bed map", `#capacity-bed-map`). */
export function bedMapRegion(): HTMLElement {
  return screen.getByRole("region", { name: "Bed map" });
}

/**
 * One health service's group on the bed map, or null when the map draws none for it. Read by
 * selector rather than by role: a folded group's cards sit in a `hidden` panel, which role queries
 * skip, and they are still the map's cards.
 */
export function bedMapGroup(service: string, region: HTMLElement = bedMapRegion()): HTMLElement | null {
  return region.querySelector<HTMLElement>(`section[aria-label="${service}"]`);
}

/**
 * Every ward card in the region or group given, folded or open, in the order drawn. Each card is
 * the button that opens the ward drawer; within a group the order is `groupBedMapWardsByService`'s.
 */
export function bedMapCards(container: HTMLElement = bedMapRegion()): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="dialog"]'));
}

/** A group's fold control: the button inside its heading. */
export function bedMapGroupToggle(group: HTMLElement): HTMLButtonElement {
  const toggle = group.querySelector<HTMLButtonElement>("h3 > button");
  if (!toggle) throw new Error(`No fold control in the "${group.getAttribute("aria-label")}" group.`);
  return toggle;
}

/** A card's ward name as drawn, without the spelled-out codes kept for screen readers. */
export function wardCardName(card: HTMLElement): string {
  const name = card.querySelector('[class*="wardName"]');
  if (!name) throw new Error("A bed map card has no ward name.");
  const clone = name.cloneNode(true) as HTMLElement;
  for (const hidden of Array.from(clone.querySelectorAll('[class*="srOnly"]'))) hidden.remove();
  return (clone.textContent ?? "").trim();
}

/** A card's bed squares (decorative, `aria-hidden`), in the order drawn. */
export function bedSquares(card: HTMLElement): HTMLElement[] {
  return Array.from(card.querySelectorAll<HTMLElement>('span[aria-hidden="true"] > i'));
}

/** The squares of one kind, read from the class the card draws them with. */
export function bedSquaresOf(card: HTMLElement, kind: "ready" | "used" | "closed"): HTMLElement[] {
  const pattern = { ready: /cellReady/u, used: /cellUsed/u, closed: /cellClosed/u }[kind];
  return bedSquares(card).filter((square) => pattern.test(square.className));
}

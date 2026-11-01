import { fireEvent } from "@testing-library/react";

/**
 * Types into the kit's DateField or DateTimeField the way a person would: "2026-09-20" goes in as
 * "20/09/2026", and "2026-09-20T10:05" also types "10:05" in the time box beside it. Pass the date
 * box (what a label or test id finds). "" clears both boxes.
 */
export function typeDate(dateBox: HTMLElement, iso: string): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/u.exec(iso);
  const typed = match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
  fireEvent.change(dateBox, { target: { value: typed } });
  const group = dateBox.closest("[data-wf-date-time]");
  if (!group) return;
  const timeBox = group.querySelectorAll("input:not([type=hidden])")[1];
  if (timeBox) fireEvent.change(timeBox, { target: { value: match?.[4] ?? "" } });
}

import { fireEvent } from "@testing-library/react";

/**
 * Alerts redesign (Josh, 31 Oct 2026, point 17): three or more alerts of one recorded kind in a row
 * show as one group row that opens with Show each. Tests that read each alert's own row open every
 * group first. Returns how many groups it opened.
 */
export function openAlertKindGroups(root: ParentNode = document): number {
  const closed = [
    ...root.querySelectorAll<HTMLButtonElement>(
      '[data-testid="ward-alerts-kind-group"] > button[aria-expanded="false"]',
    ),
  ];
  for (const button of closed) fireEvent.click(button);
  return closed.length;
}

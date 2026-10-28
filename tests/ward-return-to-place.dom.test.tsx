import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it } from "vitest";

import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import {
  rememberReturnRow,
  rowWithAttribute,
  useReturnedView,
  useReturnToPlace,
} from "@/components/ward-management/use-return-to-place";
import { endWardFlowBrowserSession } from "@/components/ward-management/ward-browser-data";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { STATEWIDE_COORDINATOR } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Usability item 3: Back to a list brings back its tab and focuses the row that was opened. */

const findRow = (id: string) => rowWithAttribute("data-record-key", id, "li");

function List({ route }: { route: string }) {
  const returned = useReturnedView<{ tab: "open" | "closed" }>(route);
  const [tab, setTab] = useState<"open" | "closed">(returned?.tab ?? "open");
  useReturnToPlace(route, { tab }, findRow);
  return (
    <main>
      <button type="button" aria-pressed={tab === "closed"} onClick={() => setTab("closed")}>
        Closed
      </button>
      <ul>
        {["a", "b"].map((id) => (
          <li key={id} tabIndex={-1} data-record-key={id}>
            <button type="button" onClick={() => rememberReturnRow(route, id)}>
              Open {id}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

function go(path: string) {
  window.history.pushState(null, "", path);
}

function back(path: string) {
  window.history.replaceState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Leaves the list for a record: choose Closed, open row b, then the page changes. */
function leaveForRecord(route: string) {
  go(route);
  const view = render(<List route={route} />);
  fireEvent.click(screen.getByRole("button", { name: "Closed" }));
  fireEvent.click(screen.getByRole("button", { name: "Open b" }));
  view.unmount();
  go("/ward-flow/people/P-1");
}

beforeEach(() => {
  resetWardAccessStoreForTests();
  (document.activeElement as HTMLElement | null)?.blur?.();
});
afterEach(() => {
  endWardFlowBrowserSession();
});

it("Back brings back the tab and focuses the row that was opened", async () => {
  leaveForRecord("/list-back");
  back("/list-back");
  render(<List route="/list-back" />);
  expect(screen.getByRole("button", { name: "Closed" })).toHaveAttribute("aria-pressed", "true");
  await waitFor(() => expect(document.activeElement).toBe(findRow("b")));
});

it("arriving any other way opens the list fresh", async () => {
  leaveForRecord("/list-fresh");
  go("/list-fresh");
  render(<List route="/list-fresh" />);
  expect(screen.getByRole("button", { name: "Closed" })).toHaveAttribute("aria-pressed", "false");
  await new Promise((resolve) => window.setTimeout(resolve, 50));
  expect(document.activeElement).toBe(document.body);
});

it("a history step inside the open list, such as a drawer closing, is not a return", () => {
  go("/list-drawer");
  const view = render(<List route="/list-drawer" />);
  fireEvent.click(screen.getByRole("button", { name: "Closed" }));
  act(() => back("/list-drawer"));
  view.unmount();
  go("/list-drawer");
  render(<List route="/list-drawer" />);
  expect(screen.getByRole("button", { name: "Closed" })).toHaveAttribute("aria-pressed", "false");
});

it("a desk change forgets the place", () => {
  leaveForRecord("/list-desk");
  setWardAccess(STATEWIDE_COORDINATOR);
  back("/list-desk");
  render(<List route="/list-desk" />);
  expect(screen.getByRole("button", { name: "Closed" })).toHaveAttribute("aria-pressed", "false");
});

it("the end of the session forgets the place", () => {
  leaveForRecord("/list-session");
  endWardFlowBrowserSession();
  back("/list-session");
  render(<List route="/list-session" />);
  expect(screen.getByRole("button", { name: "Closed" })).toHaveAttribute("aria-pressed", "false");
});

it("Movements keeps its order and focuses the opened worklist row on Back", async () => {
  const renderMovements = () =>
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MovementsScreen />
      </WardFlowProvider>,
    );
  go("/ward-flow/movements");
  const first = renderMovements();
  const row = first.container.querySelector<HTMLElement>("li[data-ward-primitive='record-row'][data-record-key]")!;
  const id = row.getAttribute("data-record-key")!;
  fireEvent.click(row);
  fireEvent.click(screen.getByRole("radio", { name: "Longest wait" }));
  first.unmount();
  go("/ward-flow/people/P-1");

  back("/ward-flow/movements");
  renderMovements();
  expect(screen.getByRole("radio", { name: "Longest wait" })).toHaveAttribute("aria-checked", "true");
  await waitFor(() => expect(document.activeElement).toBe(findRow(id)));
});

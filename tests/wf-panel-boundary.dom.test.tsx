import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { Card, CardBody, CardHead, PanelBoundary, TabPanel } from "@/components/wf";

// Tier 1 item 5 (Josh, 4 Nov 2026): one broken panel cannot blank the whole screen.
let broken = true;
function Fragile() {
  if (broken) throw new Error("Synthetic record detail that must not reach the console");
  return <p>Panel content</p>;
}

afterEach(() => {
  broken = true;
  vi.restoreAllMocks();
});

it("shows an error line in place of the failing panel and keeps its siblings", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  render(
    <main>
      <h1>Board</h1>
      <PanelBoundary label="Transport">
        <Fragile />
      </PanelBoundary>
      <p>Other panel</p>
    </main>,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Transport could not be shown");
  expect(screen.getByRole("alert")).toHaveTextContent("The rest of the page still works.");
  expect(screen.getByText("Other panel")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Board" })).toBeVisible();
  // Our own diagnostic uses a fixed line and a recognised class, never record detail or labels.
  const ours = log.mock.calls.filter((call) => call[0] === "Ward Flow panel failed");
  expect(ours).toEqual([["Ward Flow panel failed", { type: "Error" }]]);
});

it("draws the panel again after Try again once it can render", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(
    <PanelBoundary>
      <Fragile />
    </PanelBoundary>,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("This section could not be shown");
  broken = false;
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(screen.getByText("Panel content")).toBeVisible();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("keeps the card head when the card body fails", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(
    <Card>
      <CardHead title="Waiting for a bed" />
      <CardBody>
        <Fragile />
      </CardBody>
    </Card>,
  );
  expect(screen.getByRole("heading", { name: "Waiting for a bed" })).toBeVisible();
  expect(screen.getByTestId("wf-panel-error")).toBeVisible();
});

it("tries a failing tab again when another tab is chosen", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { rerender } = render(
    <TabPanel idPrefix="t" id="now">
      <Fragile />
    </TabPanel>,
  );
  expect(screen.getByTestId("wf-panel-error")).toBeVisible();
  broken = false;
  rerender(
    <TabPanel idPrefix="t" id="later">
      <Fragile />
    </TabPanel>,
  );
  expect(screen.getByText("Panel content")).toBeVisible();
});

it("tries a retained tab again when it is shown again", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { rerender } = render(
    <TabPanel idPrefix="t" id="details">
      <Fragile />
    </TabPanel>,
  );
  expect(screen.getByTestId("wf-panel-error")).toBeInTheDocument();
  broken = false;
  rerender(
    <TabPanel idPrefix="t" id="details" hidden>
      <Fragile />
    </TabPanel>,
  );
  rerender(
    <TabPanel idPrefix="t" id="details">
      <Fragile />
    </TabPanel>,
  );
  expect(screen.getByText("Panel content")).toBeVisible();
});

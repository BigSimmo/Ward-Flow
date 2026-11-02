// Alerts redesign (1 Nov 2026), BUILD-SPEC "Broadcast composer": who gets it, the reasons Send
// waits for, the preview and the Send label, checked against the approved mock-up's composer().
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import {
  audienceGroups,
  audienceLabel,
  audienceRecipients,
  everyDesk,
} from "@/components/ward-management/alerts/broadcast-audience";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allEmergencyDepartments, allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const open = () => {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <AlertsScreen />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Broadcast alert" }));
};
const radio = (group: string, name: string) =>
  within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", { name });

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("broadcast audience", () => {
  const groups = audienceGroups(allUnits());

  it("puts every ward and ED desk in at least one group, so Everyone misses no desk", () => {
    expect(everyDesk(groups)).toHaveLength(allUnits().length + allEmergencyDepartments().length);
    expect(groups.map((group) => group.label).slice(0, 6)).toEqual([
      "Metro adult wards",
      "Older adult wards",
      "Youth and CAMHS",
      "Secure and forensic",
      "Regional (WACHS)",
      "ED desks",
    ]);
  });

  it("joins groups once each and names them for the Broadcast tab", () => {
    const audience = {
      mode: "groups" as const,
      groups: ["metro" as const, "secure" as const],
      picked: [],
      bedNow: false,
    };
    const ids = audienceRecipients(audience, groups, []).map((desk) => desk.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(audienceLabel(audience, groups)).toBe("Metro adult wards, Secure and forensic");
    expect(audienceLabel({ ...audience, mode: "pick" }, groups)).toBe("Chosen units");
  });
});

describe("broadcast composer", () => {
  it("opens on a bed call to metro adult wards and names the count on Send", () => {
    open();
    const metro = audienceGroups(allUnits())[0].desks.length;
    expect(radio("Audience", "By group")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: new RegExp(`Metro adult wards\\s*${metro}`) })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Wards with a bed now/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("ward-alerts-broadcast-confirm")).toHaveTextContent(`Send bed call to ${metro} units`);
    expect(screen.getByText("Bed call · Warning")).toBeInTheDocument();
  });

  it("says why Send is unavailable, step by step", () => {
    open();
    fireEvent.click(screen.getByRole("radio", { name: /Tell areas something/ }));
    fireEvent.click(screen.getByRole("button", { name: "Blank" }));
    expect(screen.getByText("Choose who gets it")).toBeInTheDocument();
    expect(screen.getByText("No one chosen yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ED desks/ }));
    expect(screen.getByText("Add a title and message")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Title$/i), { target: { value: "Synthetic title" } });
    fireEvent.change(screen.getByLabelText(/^Message$/i), { target: { value: "Synthetic message" } });
    expect(screen.getByText("Tick the box to send")).toBeInTheDocument();
    const eds = allEmergencyDepartments().length;
    fireEvent.click(screen.getByLabelText(`I'm authorised to send this to ${eds} units.`));
    const send = screen.getByTestId("ward-alerts-broadcast-confirm");
    expect(send).not.toHaveAttribute("aria-disabled");
    expect(send).toHaveTextContent(`Send to ${eds} units`);
  });

  it("chooses units by group with All and Clear, and counts each group", () => {
    open();
    fireEvent.click(radio("Audience", "Choose units"));
    const ed = screen.getByRole("group", { name: /ED desks/ });
    const eds = allEmergencyDepartments().length;
    expect(within(ed).getByText(`0 of ${eds}`)).toBeInTheDocument();
    fireEvent.click(within(ed).getByRole("button", { name: "All ED desks" }));
    expect(within(ed).getByText(`${eds} of ${eds}`)).toBeInTheDocument();
    fireEvent.click(within(ed).getByRole("button", { name: "Clear ED desks" }));
    expect(within(ed).getByText(`0 of ${eds}`)).toBeInTheDocument();
  });

  it("sends a bed call to the chosen wards only, then offers to extend it instead of a second", () => {
    open();
    const first = audienceGroups(allUnits())[0].desks[0];
    fireEvent.click(radio("Audience", "Choose units"));
    fireEvent.click(
      within(screen.getByRole("group", { name: /Metro adult wards/ })).getByRole("button", { name: /^Clear/ }),
    );
    fireEvent.click(within(screen.getByRole("group", { name: /Metro adult wards/ })).getByLabelText(first.name));
    fireEvent.click(screen.getByLabelText("I'm authorised to send this to 1 unit."));
    fireEvent.click(screen.getByTestId("ward-alerts-broadcast-confirm"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Current broadcast")).toHaveTextContent("Chosen units");

    fireEvent.click(screen.getByRole("button", { name: "Broadcast alert" }));
    expect(screen.getByText(/A bed call to Chosen units is already live/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Extend that one" })).toBeInTheDocument();
  });
});

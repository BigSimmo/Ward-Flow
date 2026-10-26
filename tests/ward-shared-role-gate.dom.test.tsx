import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WardAskForAccess, WardRolePicker } from "../src/components/ward-management/ward-shared-role-gate";
import { sharedMembership, sharedRequest } from "../src/components/ward-management/settings/access-shared-source";
import { phonePushRow } from "../src/components/ward-management/shell/ward-phone-push";
import { STANDARD_WARD_SITES } from "../src/components/ward-management/ward-sites";
import { HEALTH_SERVICES } from "../src/components/ward-management/ward-model";

const unit = STANDARD_WARD_SITES[0]!.units[0]!;
const membershipId = "3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9d";

describe("shared workspace role gate (role access plan, later pass)", () => {
  it("lists only the roles the access table allows, and works as the one picked", () => {
    const onChoose = vi.fn();
    render(
      <WardRolePicker
        choices={[
          { workingAs: membershipId, role: "ward", scope: { kind: "ward", unitIds: [unit.id] } },
          { workingAs: "bootstrap", role: "coordinator", scope: { kind: "statewide" } },
          // A row the access table would not allow is never offered.
          { workingAs: "4a5b6c7d-8e9f-4a0b-9c1d-2e3f4a5b6c7d", role: "ward", scope: { kind: "statewide" } },
        ]}
        onChoose={onChoose}
        onSignOut={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: `Nurse in charge, ${unit.name}` }));
    expect(onChoose).toHaveBeenCalledWith(membershipId);
    expect(screen.getByRole("button", { name: "Bed coordinator, Statewide" })).toBeInTheDocument();
  });

  it("asks for access from picked lists and then says it is waiting", async () => {
    const requestAccess = vi.fn(async () => null);
    render(
      <WardAskForAccess
        canRequest
        api={{ ownRequest: async () => null, requestAccess }}
        onRetry={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );
    // The coordinator and access admin roles are given, never asked for.
    const roles = [...(screen.getByLabelText("Role") as HTMLSelectElement).options].map((option) => option.value);
    expect(roles).not.toContain("coordinator");
    expect(roles).not.toContain("admin");
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "ward" } });
    fireEvent.change(screen.getByLabelText("Place"), {
      target: { value: JSON.stringify({ kind: "ward", unitIds: [unit.id] }) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask for access" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(`Nurse in charge, ${unit.name}`));
    expect(requestAccess).toHaveBeenCalledWith("ward", { kind: "ward", unitIds: [unit.id] });
  });

  it("shows the server's reason when a request is refused, and its open request on return", async () => {
    const { unmount } = render(
      <WardAskForAccess
        canRequest
        api={{ ownRequest: async () => null, requestAccess: async () => "That place is not in the workspace." }}
        onRetry={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ask for access" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That place is not in the workspace.");
    unmount();
    render(
      <WardAskForAccess
        canRequest
        api={{
          ownRequest: async () => ({
            id: "r1",
            actorId: "a1",
            role: "ed",
            scope: { kind: "ed", edId: "not-a-real-ed" },
            decision: null,
            minutes: { requested: -5 },
          }),
          requestAccess: vi.fn(),
        }}
        onRetry={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );
    expect(await screen.findByRole("status")).toHaveTextContent("You have asked for");
  });

  it("keeps delivery uncertain when the response is lost", async () => {
    render(
      <WardAskForAccess
        canRequest
        api={{
          ownRequest: async () => null,
          requestAccess: async () => {
            throw new Error("Response lost");
          },
        }}
        onRetry={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ask for access" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The request could not be confirmed");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Nothing was sent");
  });

  it("points to the access admin, with no not-wired note, when the server takes no requests", () => {
    render(<WardAskForAccess canRequest={false} api={null} onRetry={vi.fn()} onSignOut={vi.fn()} />);
    expect(screen.getByText("Ask your access admin directly.")).toBeInTheDocument();
    expect(screen.queryByText(/Not wired in this prototype/u)).toBeNull();
    expect(screen.queryByRole("button", { name: "Ask for access" })).toBeNull();
  });

  it("places the server's minutes on the demo clock and drops rows the access table refuses", () => {
    const row = {
      id: membershipId,
      actorId: "a1",
      role: "coordinator",
      scope: { kind: "statewide" },
      kind: "role" as const,
      grantedBy: "a2",
      approved: false,
      approvedBy: null,
      minutes: { granted: -60, expires: 1440, lastUsed: null },
    };
    expect(sharedMembership(row, 1000)).toMatchObject({
      grantedAt: 940,
      expiresAt: 2440,
      lastUsedAt: null,
      approvedBy: null,
      access: { role: "coordinator", scope: { kind: "statewide" } },
    });
    expect(sharedMembership({ ...row, approved: true, approvedBy: "a3" }, 1000)?.approvedBy).toBe("a3");
    expect(sharedMembership({ ...row, role: "ward" }, 1000)).toBeNull();
    expect(
      sharedRequest(
        {
          id: "r1",
          actorId: "a1",
          role: "officer",
          scope: { kind: "jobs", service: HEALTH_SERVICES[0] },
          decision: null,
          minutes: { requested: -5 },
        },
        1000,
      )?.requestedAt,
    ).toBe(995);
  });

  it("says phone alerts are not part of a role that is not sent them", () => {
    expect(phonePushRow("role")).toEqual({ checked: false, unavailable: true, sub: "Not part of your role" });
  });
});

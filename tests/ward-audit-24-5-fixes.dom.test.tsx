/**
 * Audit 24-5 (roles and access) fix RA-02: a transport officer role naming no health service is
 * read as the server reads it, shown to the admin as not active, and explained to the officer.
 * Synthetic data only.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WardAskForAccess } from "../src/components/ward-management/ward-shared-role-gate";
import { sharedMembership } from "../src/components/ward-management/settings/access-shared-source";
import {
  parseStoredAccess,
  resetWardAccessStoreForTests,
  sharedAccessNeedsService,
} from "../src/components/ward-management/shell/ward-access-store";
import type { SharedMembership } from "../src/components/ward-management/ward-shared-client";
import { membershipStatus } from "../src/components/ward-management/ward-access-admin";
import { HEALTH_SERVICES } from "../src/components/ward-management/ward-model";

const NEEDS_SERVICE =
  "Your transport officer role names no health service. Ask your access admin to give it again with one.";

beforeEach(() => {
  resetWardAccessStoreForTests();
  sessionStorage.clear();
});

describe("RA-02: transport officer role naming no health service", () => {
  it("says what to ask the access admin for, and keeps the Ask for access form", () => {
    render(
      <WardAskForAccess
        canRequest
        reason="role-needs-service"
        api={{ ownRequest: async () => null, requestAccess: async () => null }}
        onRetry={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );
    expect(screen.getByText(NEEDS_SERVICE)).toBeInTheDocument();
    expect(screen.queryByText("No Ward Flow role yet")).toBeNull();
    expect(screen.getByRole("button", { name: "Ask for access" })).toBeInTheDocument();
  });

  it("keeps the no-role wording for any other reason", () => {
    render(<WardAskForAccess canRequest={false} api={null} reason="no-role" onRetry={vi.fn()} onSignOut={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "No Ward Flow role yet" })).toBeInTheDocument();
    expect(screen.queryByText(NEEDS_SERVICE)).toBeNull();
  });

  it("reads an officer with no service as the server does, and keeps the local demo officer desk", () => {
    const bare = JSON.stringify({ role: "officer", scope: { kind: "jobs" } });
    const served = JSON.stringify({ role: "officer", scope: { kind: "jobs", service: HEALTH_SERVICES[0] } });
    expect(parseStoredAccess(bare)).toEqual({ role: "officer", scope: { kind: "jobs" } });
    expect(parseStoredAccess(bare, { shared: true })).toBeNull();
    expect(parseStoredAccess(served, { shared: true })).toEqual({
      role: "officer",
      scope: { kind: "jobs", service: HEALTH_SERVICES[0] },
    });
    expect(sharedAccessNeedsService(JSON.parse(bare))).toBe(true);
    expect(sharedAccessNeedsService(JSON.parse(served))).toBe(false);
    expect(sharedAccessNeedsService({ role: "ward", scope: { kind: "jobs" } })).toBe(false);
  });

  it("shows the admin an officer row with no service as not active, never dropped or active", () => {
    const row: SharedMembership = {
      id: "m1",
      actorId: "a1",
      role: "officer",
      scope: { kind: "jobs" },
      kind: "role" as const,
      grantedBy: "a2",
      approved: true,
      approvedBy: null,
      minutes: { granted: -60, expires: 1440, lastUsed: null },
    };
    const membership = sharedMembership(row, 1000);
    expect(membership).not.toBeNull();
    expect(membershipStatus(membership!, 1000)).toBe("inactive");
    const served = sharedMembership({ ...row, scope: { kind: "jobs", service: HEALTH_SERVICES[0] } }, 1000);
    expect(membershipStatus(served!, 1000)).toBe("active");
  });
});

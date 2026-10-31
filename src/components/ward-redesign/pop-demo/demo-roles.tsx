"use client";

import { useContext, useId, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  COMMUNITY_TEAM_PAGES,
  communityHubLists,
  communityTeamSlug,
} from "@/components/ward-management/community/community-derivations";
import { useUnscopedWardFlow } from "@/components/ward-management/shell/ward-access-context";
import {
  markDeskSwitch,
  setWardAccess,
  useWardAccessSnapshot,
} from "@/components/ward-management/shell/ward-access-store";
import { accessPlaceLabel } from "@/components/ward-management/shell/ward-access-labels";
import { useWardFeatureFlags } from "@/components/ward-management/shell/ward-feature-flag-store";
import { SharedAccessContext } from "@/components/ward-management/shell/ward-shared-access-context";
import { SharedSessionContext } from "@/components/ward-management/shell/ward-shared-session-context";
import {
  dispatchPersonaSyncForRole,
  usePersonaDeskId,
  useShellPersonaRole,
} from "@/components/ward-management/settings/persona-sync";
import { useWardFlowSelect, useWardNetwork } from "@/components/ward-management/ward-flow-provider";
import {
  ACCESS_ROLE_LABELS,
  STATEWIDE_COORDINATOR,
  WARD_ACCESS_ROLES,
  homeHrefFor,
  type WardAccess,
  type WardAccessRole,
} from "@/components/ward-management/ward-role-access";
import {
  exitDemoRole,
  selectDemoRole,
  useDemoRoleSession,
} from "@/components/ward-management/tools/ward-demo-role-session";
import styles from "./pop-demo.module.css";

/** The router, or null where the panel renders outside the app router (a panel rendered on its own in a test). */
function useOptionalRouter(): ReturnType<typeof useRouter> | null {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

/**
 * Mock-up fork of `tools/ward-demo-roles.tsx`. Same wiring; headed "See it as", laid out as a grid like
 * Scenario, with the two long help lines cut to one. Never an account switcher.
 */
export function DemoRolesMock({ enabled }: { enabled: boolean }) {
  const { shared } = useWardFlowSelect("shared");
  const account = useContext(SharedSessionContext);
  const accessApi = useContext(SharedAccessContext);
  // Check all existing host signals before mounting anything that reads an unscoped world.
  if (process.env.NEXT_PUBLIC_WARD_SHARED_ENABLED === "true" || shared?.enabled || account || accessApi) {
    return (
      <section className={styles.group} aria-label="See it as">
        <h3 className={styles.groupHead}>See it as</h3>
        <p className={styles.hint}>
          Role demos are available in the local synthetic demo. Use Switch role for your account.
        </p>
      </section>
    );
  }
  return <LocalDemoRoles enabled={enabled} />;
}

function LocalDemoRoles({ enabled }: { enabled: boolean }) {
  const world = useUnscopedWardFlow();
  const network = useWardNetwork();
  const { desk, access, previewOf } = useWardAccessSnapshot();
  const flags = useWardFeatureFlags();
  const roleFlag = flags.find((flag) => flag.name === "role-access");
  const persona = useShellPersonaRole();
  const personaDeskId = usePersonaDeskId();
  const session = useDemoRoleSession();
  const pathname = usePathname();
  const router = useOptionalRouter();
  const noteId = useId();
  const { unit, ed, team } = useMemo(() => {
    const unit =
      world.units.find((candidate) =>
        world.movements.some(
          (movement) => movement.acceptedUnitId === candidate.id || movement.referredUnitIds.includes(candidate.id),
        ),
      ) ?? world.units[0];
    const eds = network.sites.flatMap((site) => (site.emergencyDepartment ? [site.emergencyDepartment] : []));
    const ed =
      eds.find((candidate) => world.movements.some((movement) => movement.originEdId === candidate.id)) ?? eds[0];
    const team =
      COMMUNITY_TEAM_PAGES.find((candidate) => {
        const lists = communityHubLists(world.admissions, candidate, world.referrals);
        return lists.currentlyAdmitted.length + lists.dischargedIntoTheArea.length + lists.otherDepartures.length > 0;
      }) ?? COMMUNITY_TEAM_PAGES[0];
    return { unit, ed, team };
  }, [world.units, world.movements, world.admissions, world.referrals, network]);
  const choices: Record<WardAccessRole, WardAccess | null> = {
    coordinator: { role: "coordinator", scope: { kind: "statewide" } },
    bed_manager: unit ? { role: "bed_manager", scope: { kind: "site", siteCode: unit.siteCode } } : null,
    ward: unit ? { role: "ward", scope: { kind: "ward", unitIds: [unit.id] } } : null,
    ed: ed ? { role: "ed", scope: { kind: "ed", edId: ed.id } } : null,
    community: team ? { role: "community", scope: { kind: "team", teamName: team.name } } : null,
    officer: { role: "officer", scope: { kind: "jobs" } },
    executive: { role: "executive", scope: { kind: "statewide" } },
    admin: { role: "admin", scope: { kind: "statewide" } },
  };
  const current = roleFlag?.on ? access.role : "coordinator";
  // Name the desk actually held, from its access scope, not the candidate the next choice would open.
  const currentPlace = current === access.role ? demoPlaceLabel(access) : null;
  function demoPlaceLabel(held: WardAccess): string | null {
    const scope = held.scope;
    switch (scope.kind) {
      case "ward":
        return `Demo ward: ${accessPlaceLabel(held, world.units)}`;
      case "ed":
        return `Demo ED: ${
          network.sites.find((site) => site.emergencyDepartment?.id === scope.edId)?.emergencyDepartment?.name ??
          accessPlaceLabel(held, world.units)
        }`;
      case "site":
        return `Demo site: ${
          network.sites.find((site) => site.code === scope.siteCode)?.name ?? accessPlaceLabel(held, world.units)
        }`;
      case "team":
        return `Demo team: ${scope.teamName}`;
      default:
        return null;
    }
  }
  function go(next: WardAccess) {
    const href = homeHrefFor(next, communityTeamSlug);
    markDeskSwitch(pathname === href ? undefined : (pathname ?? undefined));
    if (router) router.push(href);
    else window.location.assign(href);
  }
  function choose(role: WardAccessRole) {
    const next = choices[role];
    if (!enabled || !next) return;
    selectDemoRole(next, {
      desk: previewOf ?? desk,
      deviceFlag: roleFlag?.source === "device" ? roleFlag.on : null,
      persona,
      personaDeskId,
    });
    go(next);
  }
  function exit() {
    if (!enabled) return;
    const original = exitDemoRole();
    if (original) go(original);
    else {
      // A reload keeps the existing local desk, but loses the memory-only return history.
      // Give that desk an explicit way back without inventing its previous role.
      setWardAccess(STATEWIDE_COORDINATOR);
      dispatchPersonaSyncForRole("coordinator");
      go(STATEWIDE_COORDINATOR);
    }
  }
  return (
    <section className={styles.group} aria-label="See it as">
      <h3 className={styles.groupHead}>
        See it as <span id={noteId}>Opens that role&rsquo;s demo desk · the scenario stays loaded</span>
      </h3>
      <div className={styles.grid} role="group" aria-label="Demo role">
        {WARD_ACCESS_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            className={styles.choice}
            aria-pressed={current === role}
            aria-describedby={noteId}
            aria-disabled={!enabled || !choices[role]}
            onClick={() => choose(role)}
          >
            <strong>{ACCESS_ROLE_LABELS[role]}</strong>
            {current === role ? <em>Current</em> : null}
            {!choices[role] ? <span>No demo desk in this scenario</span> : null}
          </button>
        ))}
      </div>
      {currentPlace || current === "admin" || current === "executive" || session || current !== "coordinator" ? (
        <div className={styles.roleLine}>
          <p aria-live="polite">
            {currentPlace ? `${currentPlace}.` : null}
            {current === "admin" ? " Access settings only; no patient data." : null}
            {current === "executive" ? " Aggregate reports and read-only controls." : null}
          </p>
          {session || current !== "coordinator" ? (
            <button type="button" className={styles.small} disabled={!enabled} onClick={exit}>
              {session ? "Exit role demo" : "Back to Bed coordinator"}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

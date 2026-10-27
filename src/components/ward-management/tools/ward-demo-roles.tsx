"use client";

import { useContext, useId, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

import { COMMUNITY_TEAM_PAGES, communityHubLists, communityTeamSlug } from "../community/community-derivations";
import { useUnscopedWardFlow } from "../shell/ward-access-context";
import { markDeskSwitch, useWardAccessSnapshot } from "../shell/ward-access-store";
import { useWardFeatureFlags } from "../shell/ward-feature-flag-store";
import { SharedAccessContext } from "../shell/ward-shared-access-context";
import { SharedSessionContext } from "../shell/ward-shared-session-context";
import { usePersonaDeskId, useShellPersonaRole } from "../settings/persona-sync";
import { useWardFlowSelect, useWardNetwork } from "../ward-flow-provider";
import {
  ACCESS_ROLE_LABELS,
  WARD_ACCESS_ROLES,
  homeHrefFor,
  type WardAccess,
  type WardAccessRole,
} from "../ward-role-access";
import { exitDemoRole, selectDemoRole, useDemoRoleSession } from "./ward-demo-role-session";
import styles from "./ward-demo-roles.module.css";

/** One role section in the existing desktop/phone Demo selector. Never an account switcher. */
export function WardDemoRoles({ enabled }: { enabled: boolean }) {
  const { shared } = useWardFlowSelect("shared");
  const account = useContext(SharedSessionContext);
  const accessApi = useContext(SharedAccessContext);
  // Check all existing host signals before mounting anything that reads an unscoped world.
  if (process.env.NEXT_PUBLIC_WARD_SHARED_ENABLED === "true" || shared?.enabled || account || accessApi) {
    return (
      <section className={styles.section} aria-label="Roles">
        <h3>Roles</h3>
        <p>Role demos are available in the local synthetic demo. Use Switch role for your account.</p>
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
  const router = useRouter();
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
  function go(next: WardAccess) {
    const href = homeHrefFor(next, communityTeamSlug);
    markDeskSwitch(pathname === href ? undefined : (pathname ?? undefined));
    router.push(href);
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
  }
  return (
    <section className={styles.section} aria-label="Roles">
      <h3>Roles</h3>
      <p id={noteId}>Choose a role to open its demo desk. Your scenario stays loaded. Synthetic data only.</p>
      <div className={styles.grid} role="group" aria-label="Demo role">
        {WARD_ACCESS_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            className={styles.choice}
            aria-pressed={current === role}
            aria-describedby={noteId}
            disabled={!enabled || !choices[role]}
            onClick={() => choose(role)}
          >
            <strong>{ACCESS_ROLE_LABELS[role]}</strong>
            {current === role ? <em>Selected</em> : null}
            {!choices[role] ? <span>No demo desk in this scenario</span> : null}
          </button>
        ))}
      </div>
      <p className={styles.current} aria-live="polite">
        Current role: {ACCESS_ROLE_LABELS[current]}.{current === "ward" && unit ? ` Demo ward: ${unit.name}.` : null}
        {current === "ed" && ed ? ` Demo ED: ${ed.name}.` : null}
        {current === "bed_manager" && unit
          ? ` Demo site: ${network.sites.find((site) => site.code === unit.siteCode)?.name ?? unit.siteCode}.`
          : null}
        {current === "community" && team ? ` Demo team: ${team.name}.` : null}
        {current === "admin" ? " Access settings only; no patient data." : null}
        {current === "executive" ? " Aggregate reports and read-only controls." : null}
      </p>
      {session ? (
        <button type="button" className={styles.exit} disabled={!enabled} onClick={exit}>
          Exit role demo
        </button>
      ) : null}
      <p>
        Reset demo below restarts the selected scenario. Exit role demo returns to your starting desk and keeps the
        scenario.
      </p>
    </section>
  );
}

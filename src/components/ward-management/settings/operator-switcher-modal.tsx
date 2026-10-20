"use client";

import { useContext, useId, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  Crosshair,
  Eye,
  Globe,
  History,
  Home,
  Search,
  BedSingle,
  Siren,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  Badge,
  Drawer,
  Icon,
  Kbd,
  StatusGlyph,
  TextInput,
  buttonClass,
  cx,
  durMinutes,
  useIsPhone,
  useOptionalToast,
} from "@/components/wf";
import { edHomeSummaries } from "@/components/ward-management/ed/ed-home-derivations";
import { hubEntries } from "@/components/ward-management/hub/hub-derivations";
import { wardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { isOpen as isOpenMovement } from "@/components/ward-management/ward-derivations";
import { useWardFlowClock, useWardFlowSelect, useWardNetwork } from "@/components/ward-management/ward-flow-provider";
import { useUnscopedWardFlow } from "@/components/ward-management/shell/ward-access-context";
import {
  setWardAccess,
  startAccessPreview,
  useWardAccessSnapshot,
} from "@/components/ward-management/shell/ward-access-store";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { accessPlaceLabel } from "@/components/ward-management/shell/ward-access-labels";
import { SharedAccessContext } from "@/components/ward-management/shell/ward-shared-access-context";
import {
  ACCESS_ROLE_LABELS,
  STATEWIDE_COORDINATOR,
  accessIsWholeNetwork,
  screenDecision,
  screenForPath,
  type WardAccess,
} from "@/components/ward-management/ward-role-access";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { HEALTH_SERVICES, type HealthService } from "@/components/ward-management/ward-model";
import { movementUmrn } from "@/components/ward-management/ward-patient-resolver";
import { edById } from "@/components/ward-management/ward-sites";
import { edHref, unitHref } from "@/components/ward-management/shell/ward-facade";

import {
  currentDeskId,
  deskActions,
  deskMatches,
  deskRoleLabel,
  recentDeskIds,
  rememberDesk,
  workstationDesks,
  type Desk,
  type DeskRole,
} from "./workstation-desks";
import { dispatchPersonaSyncForRole, useShellPersonaRole } from "./persona-sync";
import styles from "./workstation-switcher.module.css";

export interface OperatorSwitcherModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  /** Says a Preview control is not built yet, through the page's own toast. */
  readonly onPreview?: (name: string) => void;
  /** Optional callback to sync the clinical persona/role when a desk is selected. */
  readonly onSelectRole?: (role: DeskRole) => void;
}

const ROLE_ICON: Record<DeskRole, LucideIcon> = {
  coordinator: Globe,
  ward: BedSingle,
  ed: Siren,
  community: Home,
  officer: Truck,
};

const SERVICE_SWATCH: Record<string, string> = {
  "North Metro": "north",
  "South Metro": "south",
  "East Metro": "east",
  WACHS: "wachs",
  CAHS: "cahs",
  Private: "private",
};

function useSafePathname(): string {
  try {
    return usePathname() ?? "";
  } catch {
    return "";
  }
}

function sameAccess(a: WardAccess, b: WardAccess): boolean {
  return a.role === b.role && JSON.stringify(a.scope) === JSON.stringify(b.scope);
}

/**
 * Switch workstation, direction D (Josh, 9 Oct 2026): a site drawer with an inline preview.
 * Search and recents on top, the desk you are on and what it can do, the statewide desks, then
 * every hospital with its ED and wards. A click expands a desk in place with its live figures and
 * what that role can do; Open desk (or a double click) navigates to that role's own home.
 */
export function OperatorSwitcherModal({ isOpen, onClose, onPreview, onSelectRole }: OperatorSwitcherModalProps) {
  const baseId = useId();
  const network = useWardNetwork();
  // The whole workspace, not the desk's scoped one: this drawer is the demo's way to change desk.
  const { movements, units, bedReleases, admissions, leaveBeds, focusMovementId, configuration } =
    useUnscopedWardFlow();
  // The patient in focus is named from the desk's own scoped workspace (review on PR #330), so a
  // restricted desk never sees the UMRN of someone outside its care here.
  const scoped = useWardFlowSelect("movements", "patients", "referrals");
  // Role access plan PR 1: with the flag on, opening a desk takes that desk's access.
  const accessOn = useWardFeatureFlag("role-access");
  const { access: currentAccess } = useWardAccessSnapshot();
  // Signed in to the shared workspace, the role comes from the server, never from this drawer: a
  // desk here only opens its screens (a coordinator can still preview, read only).
  const shared = useContext(SharedAccessContext) !== null;
  const [previewOnly, setPreviewOnly] = useState(false);
  const now = useWardFlowClock();
  const router = useRouter();
  const toast = useOptionalToast();
  const pathname = useSafePathname();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hereOpen, setHereOpen] = useState(false);
  // Change view opens this drawer without a page toast, so a Preview tile says so here instead.
  const [previewNote, setPreviewNote] = useState<string | null>(null);

  const { statewide, sites, teams } = useMemo(
    () =>
      workstationDesks({
        hub: hubEntries({ units, bedReleases, admissions, leaveBeds, now, sites: network.sites }),
        eds: edHomeSummaries(movements, now, configuration.edAccessTargetMinutes),
        movements,
      }),
    [units, bedReleases, admissions, leaveBeds, movements, now, configuration.edAccessTargetMinutes, network],
  );
  const allDesks = useMemo(
    () => [...statewide, ...sites.flatMap((site) => site.desks), ...teams],
    [statewide, sites, teams],
  );
  const hereId = currentDeskId(pathname);
  const here = allDesks.find((desk) => desk.id === hereId);
  const [openSites, setOpenSites] = useState<ReadonlySet<string>>(() => new Set(here?.site ? [here.site] : []));
  const isCoordinatorRoute = wardChromeRole(pathname) === "coordinator";
  // Overall review (20 Oct 2026): a desk opened by its link is viewed as the person on the rail,
  // so the row says so rather than naming the desk's own role as though it were theirs.
  const viewerRole = useShellPersonaRole();
  const isPhone = useIsPhone();
  const searching = query.trim().length > 0;

  /** The access a desk gives. A ward's bed manager desk is the whole hospital. */
  function accessFor(desk: Desk): WardAccess {
    switch (desk.role) {
      case "coordinator":
        return STATEWIDE_COORDINATOR;
      case "ward":
        return { role: "ward", scope: { kind: "ward", unitIds: [desk.id] } };
      case "ed":
        return { role: "ed", scope: { kind: "ed", edId: desk.id } };
      case "community":
        return { role: "community", scope: { kind: "team", teamName: desk.name } };
      case "officer":
        return { role: "officer", scope: { kind: "jobs" } };
    }
  }

  const previewing = previewOnly && currentAccess.role === "coordinator";
  // In the shared workspace (not previewing) the signed-in role stays, so the rail keeps its persona
  // and a desk whose screens that role cannot open is not opened at all (review on PR #363).
  const keepsSignedInRole = accessOn && shared && !previewing;

  function takeAccess(access: WardAccess) {
    if (!accessOn) return;
    if (previewing) startAccessPreview(access);
    else if (!shared) setWardAccess(access);
  }

  /** False, with a note, when the signed-in role cannot open this address. */
  function reachable(href: string): boolean {
    if (!keepsSignedInRole || accessIsWholeNetwork(currentAccess)) return true;
    if (screenDecision(currentAccess, screenForPath(href), wardPlaceLookup(units)).open) return true;
    setPreviewNote("That desk is not part of your role. To work as another of your roles, use Switch role.");
    return false;
  }

  /**
   * B6 (Josh, 19 Oct 2026): it must be obvious the switch worked. Besides the new page and the
   * person on the rail, one short message names the desk and the role. A place name only, never a
   * patient, so nothing personal is shown. In the shared workspace the signed-in role stays, so the
   * message names that role, not the desk's.
   */
  function confirmSwitch(place: string, role: string) {
    toast?.push({
      tone: "success",
      title: `Now at ${place}`,
      body: keepsSignedInRole
        ? `Still working as ${ACCESS_ROLE_LABELS[currentAccess.role]}.`
        : accessOn
          ? `Working as ${role}. The menu shows this desk's pages.`
          : `Working as ${role}.`,
    });
  }

  /** Desks the old drawer only previewed: bed manager per hospital, executive, service coordinator, admin. */
  function openAccessDesk(access: WardAccess, href: string) {
    if (!reachable(href)) return;
    takeAccess(access);
    onClose();
    confirmSwitch(accessPlaceLabel(access, units), ACCESS_ROLE_LABELS[access.role]);
    router.push(href);
  }

  function open(desk: Desk): boolean {
    if (!reachable(desk.href)) return false;
    takeAccess(accessFor(desk));
    rememberDesk(desk.id);
    if (!keepsSignedInRole) {
      onSelectRole?.(desk.role);
      dispatchPersonaSyncForRole(desk.role);
    }
    onClose();
    confirmSwitch(desk.name, deskRoleLabel(desk.role));
    return true;
  }

  /** A desk link: opens the desk, or stays put when the signed-in role cannot open it. */
  const openLink = (desk: Desk) => (event: MouseEvent) => {
    if (!open(desk)) event.preventDefault();
  };

  // "Current" follows the role (Settings is the coordinator's desk); navigation is only blocked when
  // the browser is already on that desk's own home, so the coordinator home still opens from here.
  // With role access on, the access must match too: a service coordinator shares the statewide
  // home address but can still switch back to the statewide desk (review on PR #330).
  const atHome = (desk: Desk) => pathname === desk.href && (!accessOn || sameAccess(currentAccess, accessFor(desk)));

  function go(desk: Desk) {
    if (atHome(desk)) return;
    if (open(desk)) router.push(desk.href);
  }

  function toggleSite(site: string) {
    setOpenSites((current) => {
      const next = new Set(current);
      if (next.has(site)) next.delete(site);
      else next.add(site);
      return next;
    });
  }

  const recents = searching
    ? []
    : recentDeskIds()
        .filter((id) => id !== hereId)
        .map((id) => allDesks.find((desk) => desk.id === id))
        .filter((desk): desk is Desk => desk !== undefined)
        .slice(0, 3);

  // Owner answer 38: the wards a patient was referred to are named to coordinators only. Their
  // emergency department is not another ward, so that shortcut shows on every route.
  const focusMovement = focusMovementId
    ? scoped.movements.find((movement) => movement.id === focusMovementId && isOpenMovement(movement))
    : undefined;
  const focusWardIds =
    focusMovement && isCoordinatorRoute
      ? focusMovement.acceptedUnitId
        ? [focusMovement.acceptedUnitId]
        : focusMovement.referredUnitIds
      : [];
  const focusWards = focusWardIds
    .map((id) => units.find((unit) => unit.id === id))
    .filter((unit): unit is NonNullable<typeof unit> => unit !== undefined);
  const focusEd = focusMovement ? edById(focusMovement.originEdId) : undefined;

  const visibleSites = sites
    .map((site) => ({ ...site, desks: site.desks.filter((desk) => deskMatches(desk, query)) }))
    .filter((site) => site.desks.length > 0);
  const visibleTeams = teams.filter((desk) => deskMatches(desk, query));
  const visibleStatewide = statewide.filter((desk) => deskMatches(desk, query));
  const nothing = searching && !visibleSites.length && !visibleTeams.length && !visibleStatewide.length;

  const row = (desk: Desk, label?: string) => (
    <DeskRow
      key={desk.id}
      desk={desk}
      label={label}
      now={now}
      isHere={desk.id === hereId}
      isAtHome={atHome(desk)}
      isOpen={expanded === desk.id}
      onToggle={() => setExpanded((current) => (current === desk.id ? null : desk.id))}
      onGo={() => go(desk)}
      onOpen={openLink(desk)}
      accessTargetMinutes={configuration.edAccessTargetMinutes}
      compact={isPhone}
    />
  );

  const top = (
    <div className={styles.top}>
      <TextInput
        ref={searchRef}
        icon={Search}
        type="text"
        enterKeyHint="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onClear={() => setQuery("")}
        placeholder="Hospital, ward, ED or team"
        aria-label="Find a desk"
        autoComplete="off"
        boxClassName={styles.search}
      />
      {recents.length ? (
        <div className={styles.chipRow} role="group" aria-label="Recent desks">
          <span className={styles.chipLead}>
            <Icon icon={History} size={14} />
            Recent
          </span>
          {recents.map((desk) => (
            <Link key={desk.id} href={desk.href} className={styles.chip} onClick={openLink(desk)}>
              {desk.name}
            </Link>
          ))}
        </div>
      ) : null}
      {focusMovement && !searching ? (
        <div className={styles.chipRow} role="group" aria-label="Patient in focus" data-testid="workstation-focus">
          <span className={styles.chipLead}>
            <Icon icon={Crosshair} size={14} />
            Patient in focus
            <span className={styles.mono}>
              {movementUmrn(focusMovement, {
                patients: scoped.patients,
                referrals: scoped.referrals,
                movements: scoped.movements,
              })}
            </span>
          </span>
          {focusWards.map((unit) => (
            <Link
              key={unit.id}
              href={unitHref(unit.id)}
              className={styles.chip}
              onClick={openLink({ id: unit.id, role: "ward", name: unit.name, href: unitHref(unit.id) })}
            >
              <Icon icon={BedSingle} size={14} />
              {unit.name}
            </Link>
          ))}
          {focusEd ? (
            <Link
              href={edHref(focusEd.id)}
              className={styles.chip}
              onClick={openLink({ id: focusEd.id, role: "ed", name: focusEd.name, href: edHref(focusEd.id) })}
            >
              <Icon icon={Siren} size={14} />
              {focusEd.name}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      title="Go to a desk"
      testId="ward-operator-switcher-modal"
      // Audit settings-23: no search focus on a phone, so the keyboard does not cover the list.
      initialFocusRef={isPhone ? undefined : searchRef}
      contentClassName={styles.drawer}
      bodyClassName={styles.body}
      footer={
        <p className={styles.keys} aria-hidden="true" data-kbd-hint="">
          <Kbd>Enter</Kbd> Preview <Kbd>Double click</Kbd> Open <Kbd>Esc</Kbd> Close
        </p>
      }
      footerClassName={styles.foot}
    >
      {top}
      {/* shell-14 (13 Oct 2026): a statewide desk already shows as its own tile below (marked as the
          current page), so the "You are here" row is only for a site or team desk. */}
      {here && !searching && !statewide.some((desk) => desk.id === here.id) ? (
        <section className={styles.here} aria-label="Your desk">
          <button
            type="button"
            className={styles.hereHead}
            aria-expanded={hereOpen}
            aria-controls={`${baseId}-workstation-here-can`}
            onClick={() => setHereOpen((value) => !value)}
          >
            <span className={styles.roleIcon}>
              <Icon icon={ROLE_ICON[here.role]} size={16} />
            </span>
            <span className={styles.who}>
              <b>{here.name}</b>
              <span>
                {viewerRole === here.role
                  ? `You are here, ${deskRoleLabel(here.role)}`
                  : `You are viewing this desk as ${deskRoleLabel(viewerRole)}`}
              </span>
            </span>
            <DeskFigure desk={here} now={now} accessTargetMinutes={configuration.edAccessTargetMinutes} />
            <Icon icon={ChevronDown} size={14} className={styles.chev} />
          </button>
          {hereOpen ? (
            <div id={`${baseId}-workstation-here-can`} className={styles.hereBody}>
              <p className={styles.eyebrow}>You can here</p>
              <CanList role={here.role} />
            </div>
          ) : null}
        </section>
      ) : null}

      {!searching ? (
        <div className={styles.stateGrid} role="group" aria-label="Statewide desks">
          {statewide.map((desk) => (
            <Link
              key={desk.id}
              href={desk.href}
              className={styles.stateTile}
              aria-current={desk.id === hereId ? "page" : undefined}
              data-testid={`workstation-open-${desk.id}`}
              onClick={(event) => {
                if (atHome(desk) || !open(desk)) event.preventDefault();
              }}
            >
              <Icon icon={ROLE_ICON[desk.role]} size={16} />
              <span className={styles.who}>
                <b>{deskRoleLabel(desk.role)}</b>
                <span>{statewideLine(desk)}</span>
              </span>
              {desk.pastTarget ? <StatusGlyph tone="danger" /> : null}
            </Link>
          ))}
          {accessOn ? (
            <>
              <button
                type="button"
                className={styles.stateTile}
                data-testid="workstation-open-executive"
                onClick={() => openAccessDesk({ role: "executive", scope: { kind: "statewide" } }, STATISTICS_HREF)}
              >
                <Icon icon={Eye} size={16} />
                <span className={styles.who}>
                  <b>Executive</b>
                  <span>Statewide figures only</span>
                </span>
              </button>
              <button
                type="button"
                className={styles.stateTile}
                data-testid="workstation-open-admin"
                onClick={() => openAccessDesk({ role: "admin", scope: { kind: "statewide" } }, SETTINGS_HREF)}
              >
                <Icon icon={Users} size={16} />
                <span className={styles.who}>
                  <b>Access admin</b>
                  <span>Who works where, no patients</span>
                </span>
              </button>
            </>
          ) : null}
          {(accessOn
            ? []
            : ([
                ["Bed manager", Users],
                ["Executive", Eye],
              ] as const)
          ).map(([name, glyph]) => (
            <button
              key={name}
              type="button"
              className={cx(styles.stateTile, styles.preview)}
              title="No screen for this role yet"
              // Site review (12 Oct 2026): a working tile that says it is not wired (D-16), not greyed.
              onClick={() => (onPreview ? onPreview(name) : setPreviewNote(`${name} is not wired in this prototype.`))}
            >
              <Icon icon={glyph} size={16} />
              <span className={styles.who}>
                <b>{name}</b>
                <span>Preview</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {accessOn && currentAccess.role === "coordinator" && !searching ? (
        <label className={styles.empty}>
          <input
            type="checkbox"
            checked={previewOnly}
            onChange={(event) => setPreviewOnly(event.target.checked)}
            data-testid="workstation-preview-only"
          />{" "}
          Preview only, then come back to the coordinator desk in one tap
        </label>
      ) : null}
      {accessOn && shared && !searching ? (
        <p className={styles.empty} role="note" data-testid="workstation-shared-role-note">
          In the shared workspace your role comes from your sign-in. Opening a desk here shows its screens only. To work
          as another of your roles, use Switch role.
        </p>
      ) : null}
      {previewNote && !searching ? (
        <p className={styles.empty} role="status">
          {previewNote}
        </p>
      ) : null}

      <div className={styles.list}>
        {nothing ? <p className={styles.empty}>No desk matches &ldquo;{query.trim()}&rdquo;</p> : null}
        {searching && visibleStatewide.length ? (
          <DeskGroup label="Statewide" service="statewide">
            <div className={styles.site}>{visibleStatewide.map((desk) => row(desk))}</div>
          </DeskGroup>
        ) : null}
        {groupByService(visibleSites).map(([service, group]) => (
          <DeskGroup key={service} label={service} service={SERVICE_SWATCH[service] ?? "statewide"}>
            {accessOn && !searching && isHealthService(service) ? (
              <button
                type="button"
                className={buttonClass({ variant: "ghost", size: "sm" })}
                data-testid={`workstation-open-service-${SERVICE_SWATCH[service] ?? "other"}`}
                onClick={() =>
                  openAccessDesk({ role: "coordinator", scope: { kind: "service", service } }, COORDINATOR_HOME_HREF)
                }
              >
                {service} coordinator desk
              </button>
            ) : null}
            {group.map((site) => {
              const isSiteOpen = searching || openSites.has(site.site);
              const ed = site.desks.find((desk) => desk.role === "ed");
              const wards = site.desks.filter((desk) => desk.role === "ward");
              const ready = wards.reduce((sum, desk) => sum + (desk.ready ?? 0), 0);
              return (
                <div key={site.site} className={styles.site}>
                  <button
                    type="button"
                    className={styles.siteHead}
                    aria-expanded={isSiteOpen}
                    onClick={() => toggleSite(site.site)}
                    disabled={searching}
                  >
                    <Icon icon={ChevronDown} size={14} className={styles.chev} />
                    <Icon icon={Building2} size={16} />
                    <b className={styles.siteName}>{site.site}</b>
                    {ed ? (
                      <span className={styles.mini}>
                        {ed.pastTarget ? <StatusGlyph tone="danger" /> : null}
                        <span className={styles.mono}>{ed.waiting}</span> in ED
                      </span>
                    ) : null}
                    {wards.length ? (
                      <span className={styles.mini}>
                        <span className={styles.mono}>{ready}</span> ready
                      </span>
                    ) : null}
                  </button>
                  {isSiteOpen ? (
                    <div className={styles.siteBody}>
                      {/* The hospital is already named above, so its ED row says what it is. */}
                      {site.desks.map((desk) => row(desk, desk.role === "ed" ? "Emergency department" : undefined))}
                      {accessOn ? (
                        <BedManagerDesk
                          siteCode={siteCodeOf(site.desks, units)}
                          siteName={site.site}
                          onOpen={(access) => openAccessDesk(access, CAPACITY_HREF)}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </DeskGroup>
        ))}
        {visibleTeams.length ? (
          <TeamGroup
            count={visibleTeams.length}
            forceOpen={searching || visibleTeams.some((desk) => desk.id === hereId)}
          >
            {visibleTeams.map((desk) => row(desk))}
          </TeamGroup>
        ) : null}
      </div>
    </Drawer>
  );
}

const COORDINATOR_HOME_HREF = "/ward-flow";
const CAPACITY_HREF = "/ward-flow/capacity";
const STATISTICS_HREF = "/ward-flow/statistics";
const SETTINGS_HREF = "/ward-flow/settings";

function isHealthService(value: string): value is HealthService {
  return (HEALTH_SERVICES as readonly string[]).includes(value);
}

/** The hospital's code, read from its ED or one of its wards. */
function siteCodeOf(desks: readonly Desk[], units: readonly { id: string; siteCode: string }[]): string | undefined {
  for (const desk of desks) {
    const code = desk.role === "ed" ? edById(desk.id)?.siteCode : units.find((unit) => unit.id === desk.id)?.siteCode;
    if (code) return code;
  }
  return undefined;
}

function BedManagerDesk({
  siteCode,
  siteName,
  onOpen,
}: {
  siteCode: string | undefined;
  siteName: string;
  onOpen: (access: WardAccess) => void;
}) {
  if (!siteCode) return null;
  return (
    <button
      type="button"
      className={buttonClass({ variant: "ghost", size: "sm" })}
      data-testid={`workstation-open-bed-manager-${siteCode}`}
      onClick={() => onOpen({ role: "bed_manager", scope: { kind: "site", siteCode } })}
    >
      Bed manager desk, {siteName}
    </button>
  );
}

function groupByService(sites: { site: string; service?: string; desks: Desk[] }[]) {
  const groups = new Map<string, typeof sites>();
  for (const site of sites) {
    const key = site.service ?? "Other";
    groups.set(key, [...(groups.get(key) ?? []), site]);
  }
  return [...groups.entries()];
}

function statewideLine(desk: Desk): string {
  return desk.role === "officer" ? `${desk.activeJobs ?? 0} active` : `${desk.waiting ?? 0} waiting in EDs`;
}

/** The ED access target as people say it: `24h`, or `5h 30m` when it is not whole hours. */
function targetLabel(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : durMinutes(minutes);
}

function DeskGroup({ label, service, children }: { label: string; service: string; children: ReactNode }) {
  return (
    <section className={styles.group} aria-label={label}>
      <p className={styles.groupHead}>
        <span className={styles.svcDot} data-service={service} aria-hidden="true" />
        {label}
      </p>
      {children}
    </section>
  );
}

function TeamGroup({ count, forceOpen, children }: { count: number; forceOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const isOpen = forceOpen || open;
  return (
    <section className={styles.group} aria-label="Community teams">
      <div className={styles.site}>
        <button
          type="button"
          className={styles.siteHead}
          aria-expanded={isOpen}
          onClick={() => setOpen((value) => !value)}
          disabled={forceOpen}
        >
          <Icon icon={ChevronDown} size={14} className={styles.chev} />
          <Icon icon={Home} size={16} />
          <b className={styles.siteName}>Community teams</b>
          <span className={styles.mini}>
            <span className={styles.mono}>{count}</span> teams
          </span>
        </button>
        {isOpen ? <div className={styles.siteBody}>{children}</div> : null}
      </div>
    </section>
  );
}

function DeskFigure({ desk, now, accessTargetMinutes }: { desk: Desk; now: number; accessTargetMinutes: number }) {
  if (desk.role === "ward") {
    const age = desk.confirmedAt != null ? Math.max(0, now - desk.confirmedAt) : null;
    return (
      <span className={styles.fig}>
        <b className={styles.mono}>{desk.ready ?? 0}</b>
        <span className={styles.unit}>ready</span>
        {age == null ? (
          <span className={styles.age}>Never confirmed</span>
        ) : desk.stale ? (
          <span className={cx(styles.age, styles.stale)}>
            <StatusGlyph tone="warning" size={8} />
            Stale {durMinutes(age)}
          </span>
        ) : (
          <span className={styles.age}>{durMinutes(age)} ago</span>
        )}
      </span>
    );
  }
  if (desk.role === "ed" || desk.role === "coordinator") {
    return (
      <span className={styles.fig}>
        {desk.pastTarget ? <StatusGlyph tone="danger" /> : null}
        <b className={styles.mono}>{desk.waiting ?? 0}</b>
        <span className={styles.unit}>waiting</span>
        {desk.pastTarget ? (
          // shell-13: words stay neutral; the red glyph before the figure carries the tone.
          <span className={styles.age}>
            {desk.pastTarget} over {targetLabel(accessTargetMinutes)}
          </span>
        ) : null}
      </span>
    );
  }
  if (desk.role === "officer") {
    return (
      <span className={styles.fig}>
        <b className={styles.mono}>{desk.activeJobs ?? 0}</b>
        <span className={styles.unit}>active</span>
      </span>
    );
  }
  return null;
}

function DeskRow({
  desk,
  label,
  now,
  isHere,
  isAtHome,
  isOpen,
  onToggle,
  onGo,
  onOpen,
  accessTargetMinutes,
  compact = false,
}: {
  compact?: boolean;
  desk: Desk;
  label?: string;
  now: number;
  isHere: boolean;
  isAtHome: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onGo: () => void;
  onOpen: (event: MouseEvent) => void;
  accessTargetMinutes: number;
}) {
  const previewId = `workstation-desk-${desk.id}`;
  return (
    <div className={styles.desk} data-open={isOpen ? "true" : undefined} data-here={isHere ? "true" : undefined}>
      <div className={styles.deskRow}>
        <button
          type="button"
          className={cx(styles.deskHead, styles.deskHeadGrow)}
          aria-expanded={isOpen}
          aria-controls={previewId}
          onClick={onToggle}
          onDoubleClick={onGo}
          data-testid={`workstation-desk-${desk.id}`}
        >
          <Icon icon={ROLE_ICON[desk.role]} size={14} className={styles.rowIcon} />
          <span className={styles.deskName} title={desk.name}>
            {label ?? desk.name}
          </span>
          {isHere ? (
            <Badge tone="success" size="sm">
              Current
            </Badge>
          ) : null}
          <DeskFigure desk={desk} now={now} accessTargetMinutes={accessTargetMinutes} />
          <Icon icon={ChevronDown} size={14} className={styles.chev} />
        </button>
        {!isAtHome ? (
          <Link
            href={desk.href}
            className={buttonClass({ variant: "sec", size: "sm" })}
            onClick={onOpen}
            data-testid={`workstation-quick-open-${desk.id}`}
          >
            Open →
          </Link>
        ) : null}
      </div>
      {isOpen ? (
        <div id={previewId} className={styles.preview2}>
          {/* Audit settings-23: a phone already shows the figure in the row, so it skips the fact grid
              and folds what the desk can do, keeping Open desk in view. */}
          {compact ? (
            <details className={styles.canFold}>
              <summary>What this desk can do</summary>
              <CanList role={desk.role} short />
            </details>
          ) : (
            <>
              <DeskFacts desk={desk} now={now} accessTargetMinutes={accessTargetMinutes} />
              <CanList role={desk.role} short />
            </>
          )}
          <div className={styles.previewFoot}>
            <span className={styles.roleName}>{deskRoleLabel(desk.role)}</span>
            {isAtHome ? (
              <span className={buttonClass({ variant: "sec", size: "sm" })} aria-disabled="true">
                You are here
              </span>
            ) : (
              <Link
                href={desk.href}
                className={buttonClass({ variant: "pri", size: "sm" })}
                onClick={onOpen}
                data-testid={`workstation-open-${desk.id}`}
              >
                Open desk
                <Icon icon={ArrowRight} size={14} />
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DeskFacts({ desk, now, accessTargetMinutes }: { desk: Desk; now: number; accessTargetMinutes: number }) {
  let facts: [string, ReactNode, string?][] = [];
  if (desk.role === "ward") {
    const age = desk.confirmedAt != null ? Math.max(0, now - desk.confirmedAt) : null;
    facts = [
      [
        "Ready",
        desk.ready ?? 0,
        // The figure stays as the ward confirmed it; the beds still being cleaned are said beside it.
        desk.pendingPreparation ? `${desk.pendingPreparation} still being made ready` : "ward confirmed",
      ],
      ["Occupied", desk.occupied ?? 0],
      ["Closed", desk.closed ?? 0, `of ${desk.beds ?? 0} beds`],
      [
        "Confirmed",
        age == null ? "Never" : <span className={desk.stale ? styles.stale : undefined}>{durMinutes(age)} ago</span>,
        desk.stale ? "Stale" : undefined,
      ],
    ];
  } else if (desk.role === "ed") {
    facts = [
      ["Waiting", desk.waiting ?? 0, "for a bed"],
      [
        "Longest",
        desk.waiting ? <span>{durMinutes(desk.longestWaitMinutes ?? 0)}</span> : "None",
        `target ${targetLabel(accessTargetMinutes)}`,
      ],
    ];
  } else if (desk.role === "community") {
    return null;
  }
  if (!facts.length) return null;
  return (
    <dl className={styles.facts}>
      {facts.map(([label, value, sub]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className={styles.mono}>{value}</dd>
          {sub ? <span className={styles.sub}>{sub}</span> : null}
        </div>
      ))}
    </dl>
  );
}

function CanList({ role, short = false }: { role: DeskRole; short?: boolean }) {
  const { can, cannot } = deskActions(role);
  const shownCan = short ? can.slice(0, 3) : can;
  const shownCannot = cannot.slice(0, 2);
  return (
    <ul className={styles.can}>
      {shownCan.map((label) => (
        <li key={label}>
          <StatusGlyph tone="success" />
          <span>{label}</span>
        </li>
      ))}
      {shownCannot.map((item) => (
        <li key={item.label} className={styles.cannot}>
          <span className={styles.dash} aria-hidden="true" />
          <span>{item.label}</span>
          <span className={styles.by}>{item.by}</span>
        </li>
      ))}
    </ul>
  );
}

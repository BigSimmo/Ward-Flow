"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
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

import { Badge, Drawer, Icon, Kbd, StatusGlyph, TextInput, buttonClass, cx, durMinutes } from "@/components/wf";
import { edHomeSummaries } from "@/components/ward-management/ed/ed-home-derivations";
import { hubEntries } from "@/components/ward-management/hub/hub-derivations";
import { wardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { isOpen as isOpenMovement } from "@/components/ward-management/ward-derivations";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
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
import styles from "./workstation-switcher.module.css";

export interface OperatorSwitcherModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  /** Says a Preview control is not built yet, through the page's own toast. */
  readonly onPreview?: (name: string) => void;
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

/**
 * Switch workstation, direction D (Josh, 9 Oct 2026): a site drawer with an inline preview.
 * Search and recents on top, the desk you are on and what it can do, the statewide desks, then
 * every hospital with its ED and wards. A click expands a desk in place with its live figures and
 * what that role can do; Open desk (or a double click) navigates to that role's own home.
 */
export function OperatorSwitcherModal({ isOpen, onClose, onPreview }: OperatorSwitcherModalProps) {
  const {
    movements,
    units,
    bedReleases,
    admissions,
    leaveBeds,
    patients,
    referrals,
    focusMovementId,
    configuration,
    now,
  } = useWardFlow();
  const router = useRouter();
  const pathname = useSafePathname();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hereOpen, setHereOpen] = useState(false);

  const { statewide, sites, teams } = useMemo(
    () =>
      workstationDesks({
        hub: hubEntries({ units, bedReleases, admissions, leaveBeds, now }),
        eds: edHomeSummaries(movements, now, configuration.edAccessTargetMinutes),
        movements,
      }),
    [units, bedReleases, admissions, leaveBeds, movements, now, configuration.edAccessTargetMinutes],
  );
  const allDesks = useMemo(
    () => [...statewide, ...sites.flatMap((site) => site.desks), ...teams],
    [statewide, sites, teams],
  );
  const hereId = currentDeskId(pathname);
  const here = allDesks.find((desk) => desk.id === hereId);
  const [openSites, setOpenSites] = useState<ReadonlySet<string>>(() => new Set(here?.site ? [here.site] : []));
  const isCoordinatorRoute = wardChromeRole(pathname) === "coordinator";
  const searching = query.trim().length > 0;

  function open(desk: Desk) {
    rememberDesk(desk.id);
    onClose();
  }

  function go(desk: Desk) {
    if (desk.id === hereId) return;
    open(desk);
    router.push(desk.href);
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

  // Owner answer 38: the patient-in-focus shortcut names other wards, so it is coordinators-only,
  // exactly as on the rail's Change view.
  const focusMovement =
    isCoordinatorRoute && focusMovementId
      ? movements.find((movement) => movement.id === focusMovementId && isOpenMovement(movement))
      : undefined;
  const focusWardIds = focusMovement
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
      isOpen={expanded === desk.id}
      onToggle={() => setExpanded((current) => (current === desk.id ? null : desk.id))}
      onGo={() => go(desk)}
      onOpen={() => open(desk)}
      accessTargetMinutes={configuration.edAccessTargetMinutes}
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
            <Link key={desk.id} href={desk.href} className={styles.chip} onClick={() => open(desk)}>
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
            <span className={styles.mono}>{movementUmrn(focusMovement, { patients, referrals, movements })}</span>
          </span>
          {focusWards.map((unit) => (
            <Link
              key={unit.id}
              href={unitHref(unit.id)}
              className={styles.chip}
              onClick={() => open({ id: unit.id, role: "ward", name: unit.name, href: unitHref(unit.id) })}
            >
              <Icon icon={BedSingle} size={14} />
              {unit.name}
            </Link>
          ))}
          {focusEd ? (
            <Link
              href={edHref(focusEd.id)}
              className={styles.chip}
              onClick={() => open({ id: focusEd.id, role: "ed", name: focusEd.name, href: edHref(focusEd.id) })}
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
      title="Switch workstation"
      testId="ward-operator-switcher-modal"
      initialFocusRef={searchRef}
      contentClassName={styles.drawer}
      bodyClassName={styles.body}
      footer={
        <p className={styles.keys} aria-hidden="true">
          <Kbd>Enter</Kbd> Preview <Kbd>Double click</Kbd> Open <Kbd>Esc</Kbd> Close
        </p>
      }
      footerClassName={styles.foot}
    >
      {top}
      {here && !searching ? (
        <section className={styles.here} aria-label="Your desk">
          <button
            type="button"
            className={styles.hereHead}
            aria-expanded={hereOpen}
            aria-controls="workstation-here-can"
            onClick={() => setHereOpen((value) => !value)}
          >
            <span className={styles.roleIcon}>
              <Icon icon={ROLE_ICON[here.role]} size={16} />
            </span>
            <span className={styles.who}>
              <b>{here.name}</b>
              <span>You are here, {deskRoleLabel(here.role)}</span>
            </span>
            <DeskFigure desk={here} now={now} accessTargetMinutes={configuration.edAccessTargetMinutes} />
            <Icon icon={ChevronDown} size={14} className={styles.chev} />
          </button>
          {hereOpen ? (
            <div id="workstation-here-can" className={styles.hereBody}>
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
              onClick={(event) => {
                if (desk.id === hereId) event.preventDefault();
                else open(desk);
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
          {(
            [
              ["Bed manager", Users],
              ["Executive", Eye],
            ] as const
          ).map(([name, glyph]) => (
            <button
              key={name}
              type="button"
              className={cx(styles.stateTile, styles.preview)}
              aria-disabled="true"
              title="No screen for this role yet"
              onClick={() => onPreview?.(name)}
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

      <div className={styles.list}>
        {nothing ? <p className={styles.empty}>No desk matches &ldquo;{query.trim()}&rdquo;</p> : null}
        {searching && visibleStatewide.length ? (
          <DeskGroup label="Statewide" service="statewide">
            <div className={styles.site}>{visibleStatewide.map((desk) => row(desk))}</div>
          </DeskGroup>
        ) : null}
        {groupByService(visibleSites).map(([service, group]) => (
          <DeskGroup key={service} label={service} service={SERVICE_SWATCH[service] ?? "statewide"}>
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
    const age = desk.confirmedAt != null ? now - desk.confirmedAt : null;
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
          <span className={cx(styles.age, styles.danger)}>
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
  isOpen,
  onToggle,
  onGo,
  onOpen,
  accessTargetMinutes,
}: {
  desk: Desk;
  label?: string;
  now: number;
  isHere: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onGo: () => void;
  onOpen: () => void;
  accessTargetMinutes: number;
}) {
  const previewId = `workstation-desk-${desk.id}`;
  return (
    <div className={styles.desk} data-open={isOpen ? "true" : undefined} data-here={isHere ? "true" : undefined}>
      <button
        type="button"
        className={styles.deskHead}
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
      {isOpen ? (
        <div id={previewId} className={styles.preview2}>
          <DeskFacts desk={desk} now={now} accessTargetMinutes={accessTargetMinutes} />
          <CanList role={desk.role} short />
          <div className={styles.previewFoot}>
            <span className={styles.roleName}>{deskRoleLabel(desk.role)}</span>
            {isHere ? (
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
    const age = desk.confirmedAt != null ? now - desk.confirmedAt : null;
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
        desk.waiting ? (
          <span className={desk.pastTarget ? styles.danger : undefined}>
            {durMinutes(desk.longestWaitMinutes ?? 0)}
          </span>
        ) : (
          "None"
        ),
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

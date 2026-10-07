"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Clock, Copy, Layers, Phone, Radio, Search, Star } from "lucide-react";
import { NETWORK_ON_CALL_ROLES, roleRecordCounts, SERVICE_ON_CALL_ROLES } from "./on-call-roster";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, NOW_ANCHOR, siteByCode } from "@/components/ward-management/ward-sites";
import { formatInstantWithDay, minuteOfDay } from "@/components/ward-management/ward-clock";
import { useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { edHref } from "@/components/ward-management/shell/ward-facade";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFoot,
  CardHead,
  Count,
  FilterChip,
  Hero,
  HeroStat,
  HeroTrack,
  Icon,
  Inset,
  Kbd,
  Segmented,
  Select,
  SrOnly,
  StatusGlyph,
  TextInput,
  Timer,
  cx,
  dur,
  tableClasses,
} from "@/components/wf";

import styles from "./on-call.module.css";

interface RosterItem {
  id: string;
  service: string;
  role: string;
  facility: string;
  shift: string;
  route: "bed" | "switchboard";
}

/** Site names are owned by ward-sites.ts; read at call time because the network can be swapped. */
const siteName = (code: string): string => siteByCode(code)?.name ?? code;

function serviceFacilities(service: string): [string, string] | undefined {
  switch (service) {
    case "North Metro":
      return ["Sir Charles Gairdner / Graylands", siteName("SCGH")];
    case "South Metro":
      return [siteName("FSH"), "Fiona Stanley / Fremantle"];
    case "East Metro":
      return [siteName("RPH"), "Royal Perth / Bentley"];
    case "Private":
      return ["Private facilities liaison", "Private facilities liaison"];
    default:
      return undefined;
  }
}

const FAVOURITES_KEY = "ward-flow:on-call:favourites";
const ROLE_IDS = new Set(
  [...NETWORK_ON_CALL_ROLES, ...Object.values(SERVICE_ON_CALL_ROLES).flat()].map((role) => role.id),
);

const SERVICE_PREFERENCE_KEY = "ward-flow:on-call:service";
const NETWORK_SERVICE = "Statewide Network";

type RoleFilter = "all" | "coordinator" | "consultant" | "governance";

const ROLE_PURPOSES: Record<string, string> = {
  "Bed coordinator": "Statewide bed placement",
  "Governance lead": "Senior operational escalation",
  "Coordinator on call": "Service placement & transfers",
  "Duty consultant": "Specialist psychiatry advice",
};

const purposeOf = (item: RosterItem) =>
  item.service === "Private" ? "Private placement enquiries" : (ROLE_PURPOSES[item.role] ?? "Confirm role scope");

/** "Cover at" choices: board time now, or a fixed hour later today (03:00 is tomorrow). */
type CoverAt = "now" | "18" | "21" | "03";
const COVER_AT_ITEMS: { id: CoverAt; label: string }[] = [
  { id: "now", label: "Now" },
  { id: "18", label: "18:00" },
  { id: "21", label: "21:00" },
  { id: "03", label: "03:00" },
];

const DAY = 24 * 60;
const MIN_MS = 60_000;
const mod = (value: number) => ((value % DAY) + DAY) % DAY;
const hhmm = (minute: number) =>
  `${String(Math.floor(mod(minute) / 60)).padStart(2, "0")}:${String(mod(minute) % 60).padStart(2, "0")}`;

type ShiftWindow = { start: number; end: number; kind: string; businessHours: boolean };

/** Parses the roster's own words ("Overnight, 20:00 to 08:00"); never a second source of times. */
function shiftWindow(shift: string): ShiftWindow | undefined {
  const match = shift.match(/^(.*?),?\s*(\d{2}):(\d{2}) to (\d{2}):(\d{2})$/u);
  if (!match) return undefined;
  const [, words, sh, sm, eh, em] = match;
  const kind = (words ?? "")
    .replace("On call from home", "From home")
    .replace("Business hours only", "Business hours")
    .trim();
  return {
    start: Number(sh) * 60 + Number(sm),
    end: Number(eh) * 60 + Number(em),
    kind: kind || "Shift",
    businessHours: /business hours/iu.test(words ?? ""),
  };
}

function isOn(window: ShiftWindow, minute: number) {
  const m = mod(minute);
  return window.start < window.end ? m >= window.start && m < window.end : m >= window.start || m < window.end;
}

/** Minutes from `minute` until the window starts (off) or ends (on). */
function minutesToChange(window: ShiftWindow, minute: number) {
  const target = isOn(window, minute) ? window.end : window.start;
  const delta = mod(target - minute);
  return delta === 0 ? DAY : delta;
}

/** On-screen segments of a window across one day, as [from, to) minute pairs. */
function daySegments(window: ShiftWindow): [number, number][] {
  return window.start < window.end
    ? [[window.start, window.end]]
    : [
        [0, window.end],
        [window.start, DAY],
      ];
}

/**
 * Role directory only: roles and shifts are synthetic, while EDs come from the shared site directory.
 * No staff identity or contact method is held or rendered. Routing links open guidance on this page;
 * they do not initiate calls. Empty service filters describe missing records, never real coverage.
 */
export function OnCallScreen() {
  const boardNow = useWardFlowClock(NOW_ANCHOR);
  const [selectedService, setSelectedService] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<RoleFilter>("all");
  const [favourites, setFavourites] = useState<string[]>([]);
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [focusedRole, setFocusedRole] = useState<string | null>(null);
  const [coverAt, setCoverAt] = useState<CoverAt>("now");
  const [copyNotice, setCopyNotice] = useState("");

  // Reveal the print-only cover rows for native printing and restore each row afterwards.
  useEffect(() => {
    let revealed: HTMLElement[] = [];
    const expand = () => {
      if (revealed.length) return;
      revealed = [...window.document.querySelectorAll<HTMLElement>("tr[data-print-expand][hidden]")];
      revealed.forEach((row) => row.removeAttribute("hidden"));
    };
    const restore = () => {
      revealed.forEach((row) => {
        if (row.isConnected) row.setAttribute("hidden", "");
      });
      revealed = [];
    };
    window.addEventListener("beforeprint", expand);
    window.addEventListener("afterprint", restore);
    return () => {
      restore();
      window.removeEventListener("beforeprint", expand);
      window.removeEventListener("afterprint", restore);
    };
  }, []);
  const [preferenceNotice, setPreferenceNotice] = useState("");
  const favouritesChangedRef = useRef(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (favouritesChangedRef.current) return;
      try {
        const saved: unknown = JSON.parse(window.localStorage.getItem(FAVOURITES_KEY) ?? "[]");
        if (Array.isArray(saved))
          setFavourites([...new Set(saved.filter((id): id is string => typeof id === "string" && ROLE_IDS.has(id)))]);
      } catch {
        // Invalid or unavailable preferences never prevent use of the directory.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  function toggleFavourite(id: string) {
    favouritesChangedRef.current = true;
    const next = favourites.includes(id) ? favourites.filter((value) => value !== id) : [...favourites, id];
    setFavourites(next);
    try {
      window.localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
      setPreferenceNotice("");
    } catch {
      setPreferenceNotice("Favourites are available for this visit only; browser storage is unavailable.");
    }
  }
  const serviceChangedRef = useRef(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (serviceChangedRef.current) return;
      try {
        const saved = window.localStorage.getItem(SERVICE_PREFERENCE_KEY);
        if (saved && ["all", NETWORK_SERVICE, ...HEALTH_SERVICES].includes(saved)) setSelectedService(saved);
      } catch {
        // Preferences are optional; the directory remains usable without browser storage.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function selectService(service: string) {
    serviceChangedRef.current = true;
    setSelectedService(service);
    try {
      window.localStorage.setItem(SERVICE_PREFERENCE_KEY, service);
    } catch {
      // Keep the current selection in memory if storage is unavailable.
    }
  }
  const searchInputId = useId();
  const panelId = useId();
  const departments = allEmergencyDepartments();
  const counts = roleRecordCounts();
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const roster = useMemo<RosterItem[]>(
    () => [
      ...NETWORK_ON_CALL_ROLES.map((role) => ({
        ...role,
        service: NETWORK_SERVICE,
        facility: role.id === "bed-coordinator" ? "Central bed desk" : "Statewide Tier 3 desk",
        route: role.id === "bed-coordinator" ? ("bed" as const) : ("switchboard" as const),
      })),
      ...HEALTH_SERVICES.flatMap((service) =>
        SERVICE_ON_CALL_ROLES[service].map((role) => ({
          ...role,
          service,
          facility: serviceFacilities(service)?.[role.role === "Duty consultant" ? 1 : 0] ?? service,
          route: "switchboard" as const,
        })),
      ),
    ],
    [],
  );

  const boardMinute = minuteOfDay(boardNow);
  const referenceMinute = coverAt === "now" ? boardMinute : Number(coverAt) * 60;
  const referenceIsTomorrow = coverAt !== "now" && referenceMinute < boardMinute;
  const windows = useMemo(() => new Map(roster.map((item) => [item.id, shiftWindow(item.shift)])), [roster]);
  const onNow = roster.filter((item) => {
    const window = windows.get(item.id);
    return window ? isOn(window, boardMinute) : false;
  }).length;
  const nextChange = Math.min(
    ...roster.map((item) => {
      const window = windows.get(item.id);
      return window ? minutesToChange(window, boardMinute) : DAY;
    }),
  );

  const filteredRoster = roster.filter(
    (item) =>
      (selectedService === "all" || item.service === selectedService) &&
      (!favouritesOnly || favourites.includes(item.id)) &&
      (selectedRole === "all" ||
        (selectedRole === "coordinator" && item.role.toLowerCase().includes("coordinator")) ||
        (selectedRole === "consultant" && item.role === "Duty consultant") ||
        (selectedRole === "governance" && item.role === "Governance lead")) &&
      (!normalizedQuery ||
        [item.service, item.role, item.facility, item.shift, purposeOf(item)].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        )),
  );
  const filteredDepartments = departments.filter((department) => {
    const site = siteByCode(department.siteCode);
    return (
      (selectedService === "all" || site?.service === selectedService) &&
      (!normalizedQuery ||
        [department.name, department.siteCode, site?.name ?? "", site?.service ?? ""].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        ))
    );
  });
  const hasDirectoryFilters = selectedService !== "all" || Boolean(normalizedQuery);
  const hasFilters = hasDirectoryFilters || selectedRole !== "all" || favouritesOnly;
  const serviceHasNoRoles =
    selectedService !== "all" &&
    HEALTH_SERVICES.includes(selectedService as keyof typeof SERVICE_ON_CALL_ROLES) &&
    SERVICE_ON_CALL_ROLES[selectedService as keyof typeof SERVICE_ON_CALL_ROLES]?.length === 0;

  /* The panel follows the role the reader picked; otherwise the first favourite, then the first row. */
  const panelRole =
    filteredRoster.find((item) => item.id === focusedRole) ??
    filteredRoster.find((item) => favourites.includes(item.id)) ??
    filteredRoster[0];

  function clearFilters() {
    selectService("all");
    setSearchQuery("");
    setSelectedRole("all");
    setFavouritesOnly(false);
  }

  const serviceItems = [
    { id: "all", label: "All services", count: roster.length },
    { id: NETWORK_SERVICE, label: "Statewide", count: NETWORK_ON_CALL_ROLES.length },
    ...HEALTH_SERVICES.map((service) => ({
      id: service as string,
      label: service as string,
      count: SERVICE_ON_CALL_ROLES[service].length,
    })),
  ];

  const statusFor =
    coverAt === "now"
      ? `Status shown for now, ${formatInstantWithDay(boardNow, boardNow)}`
      : `Status shown for ${hhmm(referenceMinute)} ${referenceIsTomorrow ? "tomorrow" : "today"}`;

  async function copyRoute(item: RosterItem) {
    const text = `${item.role}, ${item.service}: reach via ${item.route === "bed" ? "bed desk" : "switchboard"}. ${item.shift} AWST.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopyNotice("Route copied");
    } catch {
      setCopyNotice("Copy unavailable in this browser");
    }
  }

  return (
    <div className={styles.screen} data-testid="ward-on-call-screen" data-ward-design="v6">
      <main id="main-content" className={styles.main}>
        <div data-testid="ward-on-call-hud-island">
          <Hero
            level={1}
            eyebrow="Statewide specialist coordination"
            title="On-call directory"
            stats={
              <>
                <HeroStat value={counts.recorded} label="Roles" />
                <HeroStat value={roster.filter((role) => role.role === "Duty consultant").length} label="Consultants" />
                <HeroStat value={departments.length} label="EDs" />
                <HeroStat
                  value={`${onNow}/${counts.recorded}`}
                  label="On now"
                  tone={onNow > 0 ? "success" : undefined}
                />
                <HeroStat value={dur(nextChange * MIN_MS)} label={`to ${hhmm(boardMinute + nextChange)} change`} />
              </>
            }
            bar={
              <HeroTrack
                label="Filter by health service"
                items={serviceItems}
                value={selectedService}
                onChange={selectService}
              />
            }
            barAside={
              <span className={styles.heroClock}>
                <Icon icon={Clock} size={14} />
                <span className={styles.heroClockTime}>{formatInstantWithDay(boardNow, boardNow)}</span>
                <span className={styles.heroClockZone}>AWST</span>
              </span>
            }
          />
        </div>

        <div className={styles.topGrid}>
          <Card aria-labelledby="ward-on-call-now" data-testid="ward-on-call-now" className={styles.rosterCard}>
            <CardHead
              id="ward-on-call-now"
              icon={Phone}
              title="On-call roles"
              meta={<Count n={filteredRoster.length} />}
              action={
                <div className={styles.headActions}>
                  {hasFilters ? (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : null}
                  <label className={styles.srOnlyLabel} htmlFor={searchInputId}>
                    Search roster and emergency departments
                  </label>
                  <TextInput
                    id={searchInputId}
                    type="search"
                    icon={Search}
                    trailing={<Kbd>/</Kbd>}
                    placeholder="Roles, hospitals, services"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    boxClassName={styles.search}
                  />
                  <FilterChip
                    pressed={favouritesOnly}
                    onPressedChange={setFavouritesOnly}
                    count={favourites.length}
                    className={styles.favouritesChip}
                  >
                    <Icon icon={Star} size={14} />
                    Favourites
                  </FilterChip>
                  <Select
                    aria-label="Filter on-call roles"
                    value={selectedRole}
                    onChange={(event) => setSelectedRole(event.target.value as RoleFilter)}
                    boxClassName={styles.roleSelect}
                  >
                    <option value="all">All roles</option>
                    <option value="coordinator">Coordinators</option>
                    <option value="consultant">Duty consultants</option>
                    <option value="governance">Governance lead</option>
                  </Select>
                </div>
              }
            />
            <CardBody flush className={styles.tableScroll}>
              <table className={cx(tableClasses.table, styles.rosterTable)} data-testid="ward-on-call-service-table">
                <thead>
                  <tr>
                    <th scope="col" className={styles.starCol}>
                      <SrOnly>Favourite</SrOnly>
                    </th>
                    <th scope="col">Service</th>
                    <th scope="col">Role</th>
                    <th scope="col">Contact for</th>
                    <th scope="col">Shift, AWST</th>
                    <th scope="col">Reach via</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoster.map((item) => {
                    const window = windows.get(item.id);
                    const on = window ? isOn(window, referenceMinute) : false;
                    const selected = panelRole?.id === item.id;
                    const favourite = favourites.includes(item.id);
                    return (
                      <Fragment key={item.id}>
                        <tr
                          data-testid={`ward-on-call-role-${item.id}`}
                          className={cx(styles.rosterRow, selected && tableClasses.selected)}
                          onClick={(event) => {
                            if ((event.target as HTMLElement).closest("a, button")) return;
                            setFocusedRole(item.id);
                          }}
                        >
                          <td className={styles.starCol}>
                            <button
                              type="button"
                              className={cx(styles.favouriteButton, favourite && styles.favouriteOn)}
                              aria-label={`Favourite ${item.role} for ${item.service}`}
                              aria-pressed={favourite}
                              onClick={() => toggleFavourite(item.id)}
                            >
                              <Icon icon={Star} size={16} />
                            </button>
                          </td>
                          <td className={styles.serviceCell}>
                            {item.service === NETWORK_SERVICE ? "Statewide network" : item.service}
                          </td>
                          <td>
                            <button
                              type="button"
                              className={styles.roleButton}
                              aria-label={`Coverage and handover for ${item.role} for ${item.service}`}
                              aria-pressed={selected}
                              aria-controls={panelId}
                              onClick={() => setFocusedRole(item.id)}
                            >
                              <span className={styles.roleName}>{item.role}</span>
                              <span className={styles.cellDetail}>{item.facility}</span>
                            </button>
                          </td>
                          <td className={styles.purposeCell}>{purposeOf(item)}</td>
                          <td className={styles.shiftCell}>
                            <span className={styles.shiftTimes}>
                              {window ? `${hhmm(window.start)} to ${hhmm(window.end)}` : item.shift}
                            </span>
                            {window ? (
                              <span className={cx(styles.shiftState, on && styles.shiftOn)}>
                                <StatusGlyph tone={on ? "success" : "neutral"} size={9} />
                                {on ? "On, ends" : `${window.kind},`}
                                <Timer
                                  at={(referenceMinute + minutesToChange(window, referenceMinute)) * MIN_MS}
                                  now={referenceMinute * MIN_MS}
                                  direction="in"
                                />
                              </span>
                            ) : null}
                          </td>
                          <td>
                            <a
                              className={styles.routingLink}
                              href={`#ward-reach-${item.route}`}
                              aria-label={`How to reach ${item.role} for ${item.service}`}
                            >
                              {item.route === "bed" ? "Bed desk" : "Switchboard"}
                            </a>
                          </td>
                        </tr>
                        <tr className={styles.printRow} hidden data-print-expand="" id={`ward-coverage-${item.id}`}>
                          <td colSpan={6}>
                            <span className={styles.printFact}>
                              <span>Current cover</span> <strong>Not verified</strong>
                            </span>
                            <span className={styles.printFact}>
                              <span>Last confirmed</span> <strong>Not recorded</strong>
                            </span>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                  {filteredRoster.length === 0 && (
                    <tr>
                      <td colSpan={6} className={styles.emptyTableState}>
                        {serviceHasNoRoles
                          ? `No on-call roles recorded for ${selectedService} in this prototype. Use the current site directory to confirm cover.`
                          : favouritesOnly
                            ? "No favourite roles match. Star a role in All roles, or clear filters to see the directory."
                            : "No on-call roles match your search."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardBody>
            <CardFoot
              meta={
                <span className={styles.footMeta}>
                  <span data-testid="ward-on-call-count" aria-live="polite">
                    <span className="sr-only">Synthetic records: </span>
                    {filteredRoster.length} {filteredRoster.length === 1 ? "role" : "roles"}
                    {hasFilters ? ` of ${counts.recorded}` : " recorded"}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{statusFor}</span>
                </span>
              }
            >
              <span className={styles.disclosure}>Roles and shifts are invented. Contact details are not held.</span>
            </CardFoot>
            {preferenceNotice && (
              <p className={styles.notice} role="status">
                {preferenceNotice}
              </p>
            )}
          </Card>

          <RolePanel
            id={panelId}
            item={panelRole}
            roster={roster}
            windows={windows}
            referenceMinute={referenceMinute}
            onCopy={copyRoute}
            copyNotice={copyNotice}
          />
        </div>

        <CoverChart
          roster={roster}
          windows={windows}
          coverAt={coverAt}
          onCoverAt={setCoverAt}
          referenceMinute={referenceMinute}
        />

        <div className={styles.lowerGrid}>
          <Card aria-labelledby="ward-on-call-ed" data-testid="ward-on-call-ed">
            <CardHead
              id="ward-on-call-ed"
              icon={Radio}
              title="ED liaison, by department"
              meta={
                <span aria-live="polite">
                  <span className="sr-only">Synthetic records: </span>
                  {filteredDepartments.length} {filteredDepartments.length === 1 ? "department" : "departments"}
                  {hasDirectoryFilters ? ` of ${departments.length}` : ""}
                </span>
              }
            />
            <CardBody flush className={styles.tableScroll}>
              <table className={cx(tableClasses.table, styles.edTable)} data-testid="ward-on-call-ed-table">
                <thead>
                  <tr>
                    <th scope="col">Hospital</th>
                    <th scope="col">Health service</th>
                    <th scope="col">Reach via</th>
                    <th scope="col">
                      <SrOnly>Workspace</SrOnly>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDepartments.map((department) => {
                    const site = siteByCode(department.siteCode);
                    return (
                      <tr key={department.id} data-testid={`ward-on-call-ed-row-${department.id}`}>
                        <td className={styles.siteCell} title={department.name}>
                          <span className={styles.roleName}>{site?.name ?? department.name}</span>
                          <span className={styles.cellDetail}>{department.siteCode} ED</span>
                        </td>
                        <td>{site?.service ?? "Regional"}</td>
                        <td>
                          <a
                            className={styles.routingLink}
                            href="#ward-reach-ed"
                            aria-label={`How to reach ${department.name}`}
                          >
                            Local ED liaison
                          </a>
                        </td>
                        <td className={styles.workspaceCell}>
                          <Link
                            className={styles.workspaceLink}
                            href={edHref(department.id)}
                            prefetch={false}
                            aria-label={`Open ${department.name} workspace`}
                          >
                            Open ED
                            <Icon icon={ArrowRight} size={14} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredDepartments.length === 0 && (
                    <tr>
                      <td colSpan={4} className={styles.emptyTableState}>
                        No emergency departments match the current filter or search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardBody>
          </Card>

          <Card aria-labelledby="ward-on-call-reaching" data-testid="ward-on-call-reaching">
            <CardHead
              id="ward-on-call-reaching"
              icon={Building2}
              title="Reaching a role"
              meta="current site directory"
            />
            <CardBody className={styles.reachList}>
              <div id="ward-reach-switchboard" tabIndex={-1} className={styles.reachItem}>
                <Icon icon={Building2} size={16} />
                <div>
                  <h3 className={styles.reachTitle}>Hospital switchboard</h3>
                  <p className={styles.reachText}>Ask for the on-call role and confirm who covers the shift.</p>
                </div>
              </div>
              <div id="ward-reach-bed" tabIndex={-1} className={styles.reachItem}>
                <Icon icon={Layers} size={16} />
                <div>
                  <h3 className={styles.reachTitle}>Bed coordination desk</h3>
                  <p className={styles.reachText}>Statewide placement queries, with the movement reference ready.</p>
                </div>
              </div>
              <div id="ward-reach-ed" tabIndex={-1} className={styles.reachItem}>
                <Icon icon={Radio} size={16} />
                <div>
                  <h3 className={styles.reachTitle}>Emergency department liaison</h3>
                  <p className={styles.reachText}>
                    The hospital directory reaches its local mental health liaison team.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <WardPrototypeFooter
          testId="ward-on-call-governance"
          note="Not a medical device. Lists update once a minute."
        />
      </main>
    </div>
  );
}

function RolePanel({
  id,
  item,
  roster,
  windows,
  referenceMinute,
  onCopy,
  copyNotice,
}: {
  id: string;
  item: RosterItem | undefined;
  roster: RosterItem[];
  windows: Map<string, ShiftWindow | undefined>;
  referenceMinute: number;
  onCopy: (item: RosterItem) => void;
  copyNotice: string;
}) {
  if (!item) {
    return (
      <Card id={id} className={styles.panel} aria-label="Role detail">
        <CardBody>
          <p className={styles.panelEmpty}>No role selected</p>
        </CardBody>
      </Card>
    );
  }
  const window = windows.get(item.id);
  const on = window ? isOn(window, referenceMinute) : false;
  /*
   * "If not reached" lists the other recorded roles for the same service, then the statewide
   * roles, in roster order. It is derived from the roster; no fallback procedure is recorded.
   */
  const sameService = roster.filter((role) => role.service === item.service);
  const network = roster.filter((role) => role.service === NETWORK_SERVICE);
  const chain = [...sameService, ...network.filter((role) => role.id === "bed-coordinator")]
    .filter((role, index, all) => all.findIndex((other) => other.id === role.id) === index)
    .slice(0, 2);
  const governance = network.find((role) => role.id === "governance-lead");
  if (governance && !chain.some((role) => role.id === governance.id)) chain.push(governance);

  return (
    <Card id={id} className={styles.panel} aria-labelledby={`${id}-title`} data-testid="ward-on-call-role-panel">
      <div className={styles.panelHead}>
        <div className={styles.panelTitleBlock}>
          <span className={styles.eyebrow}>
            {item.service === NETWORK_SERVICE ? "Statewide network" : item.service}
          </span>
          <h2 id={`${id}-title`} className={styles.panelTitle}>
            {item.role}
          </h2>
          <span className={styles.panelMeta}>
            {item.facility}
            {window ? ` · ${window.kind.toLowerCase()}` : ""}
          </span>
        </div>
        <Badge tone={on ? "success" : "neutral"}>{on ? "On now" : "Off now"}</Badge>
      </div>
      <div className={styles.panelBody}>
        <Inset className={styles.facts}>
          <dl className={styles.factGrid}>
            <div>
              <dt>Shift, AWST</dt>
              <dd>{window ? `${hhmm(window.start)} to ${hhmm(window.end)}` : item.shift}</dd>
            </div>
            <div>
              <dt>Reach via</dt>
              <dd>{item.route === "bed" ? "Bed desk" : "Switchboard"}</dd>
            </div>
            <div>
              <dt>Current cover</dt>
              <dd className={styles.notVerified}>
                <StatusGlyph tone="warning" size={9} />
                Not verified
              </dd>
            </div>
            <div>
              <dt>Last confirmed</dt>
              <dd>Not recorded</dd>
            </div>
          </dl>
        </Inset>

        <section aria-labelledby={`${id}-chain`}>
          <h3 id={`${id}-chain`} className={styles.eyebrow}>
            If not reached
          </h3>
          <ol className={styles.chain}>
            {chain.map((role, index) => {
              const roleWindow = windows.get(role.id);
              const roleOn = roleWindow ? isOn(roleWindow, referenceMinute) : false;
              return (
                <li key={role.id} className={styles.chainItem}>
                  <span className={styles.chainStep} aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className={styles.chainRole}>{role.role}</span>
                  <span className={cx(styles.chainState, roleOn && styles.shiftOn)}>
                    <StatusGlyph tone={roleOn ? "success" : "neutral"} size={9} />
                    {roleOn ? "On" : roleWindow ? `From ${hhmm(roleWindow.start)}` : "Not recorded"}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby={`${id}-before`}>
          <h3 id={`${id}-before`} className={styles.eyebrow}>
            Before you contact a team
          </h3>
          <Inset className={styles.checklist}>
            <ul>
              <li>
                <StatusGlyph tone="neutral" size={9} />
                Confirm cover in the current site directory
              </li>
              <li>
                <StatusGlyph tone="neutral" size={9} />
                Confirm role scope with the service
              </li>
              <li>
                <StatusGlyph tone="neutral" size={9} />
                Have the movement reference, referring site, reason for contact and urgency ready
              </li>
            </ul>
          </Inset>
        </section>
      </div>
      <CardFoot meta={copyNotice ? <span role="status">{copyNotice}</span> : undefined}>
        <Button size="sm" icon={Copy} onClick={() => onCopy(item)}>
          Copy route
        </Button>
      </CardFoot>
    </Card>
  );
}

const AXIS_HOURS = [0, 6, 12, 18, 24];

function CoverChart({
  roster,
  windows,
  coverAt,
  onCoverAt,
  referenceMinute,
}: {
  roster: RosterItem[];
  windows: Map<string, ShiftWindow | undefined>;
  coverAt: CoverAt;
  onCoverAt: (value: CoverAt) => void;
  referenceMinute: number;
}) {
  /*
   * Gaps are derived from the roster: within a service, the time a coordinator is on and the duty
   * consultant is not; and the off hours of any business-hours role.
   */
  const gaps: { id: string; text: string; tone: "warning" | "neutral" }[] = [];
  const seen = new Set<string>();
  for (const service of HEALTH_SERVICES) {
    const roles = roster.filter((item) => item.service === service);
    const coordinator = roles.find((item) => item.role === "Coordinator on call");
    const consultant = roles.find((item) => item.role === "Duty consultant");
    const cw = coordinator && windows.get(coordinator.id);
    const dw = consultant && windows.get(consultant.id);
    if (cw && dw && !cw.businessHours && cw.start !== dw.start && isOn(cw, dw.start - 1)) {
      const key = `consultant-${cw.start}-${dw.start}`;
      if (!seen.has(key)) {
        seen.add(key);
        gaps.push({ id: key, text: `No duty consultant ${hhmm(cw.start)} to ${hhmm(dw.start)}`, tone: "warning" });
      }
    }
  }
  for (const item of roster) {
    const window = windows.get(item.id);
    if (window?.businessHours)
      gaps.push({
        id: `off-${item.id}`,
        text: `${item.service} cover off ${hhmm(window.end)} to ${hhmm(window.start)}`,
        tone: "neutral",
      });
  }
  const pct = (minute: number) => `${(minute / DAY) * 100}%`;

  return (
    <Card aria-labelledby="ward-on-call-cover" data-testid="ward-on-call-cover">
      <CardHead
        id="ward-on-call-cover"
        icon={Clock}
        title="Cover over 24h"
        meta="synthetic shifts"
        action={
          <div className={styles.coverAt}>
            <span className={styles.coverAtLabel} aria-hidden="true">
              Cover at
            </span>
            <Segmented label="Cover at" items={COVER_AT_ITEMS} value={coverAt} onChange={onCoverAt} />
          </div>
        }
      />
      <CardBody>
        <div className={styles.chart}>
          <div className={styles.chartRow} aria-hidden="true">
            <span />
            <div className={styles.axis}>
              {AXIS_HOURS.map((hour) => (
                <span
                  key={hour}
                  className={cx(styles.axisTick, hour === 24 && styles.axisEnd)}
                  style={{ left: pct(hour * 60) }}
                >
                  {String(hour).padStart(2, "0")}:00
                </span>
              ))}
            </div>
          </div>
          <ul className={styles.chartRows}>
            {roster.map((item) => {
              const window = windows.get(item.id);
              return (
                <li key={item.id} className={styles.chartRow}>
                  <span className={styles.chartLabel}>
                    <strong>{item.role}</strong> {item.service === NETWORK_SERVICE ? "Statewide" : item.service}
                  </span>
                  <span className={styles.track}>
                    {AXIS_HOURS.slice(1, -1).map((hour) => (
                      <span key={hour} className={styles.grid} style={{ left: pct(hour * 60) }} aria-hidden="true" />
                    ))}
                    {window
                      ? daySegments(window).map(([from, to]) => (
                          <span
                            key={from}
                            className={cx(styles.bar, window.businessHours && styles.barBusiness)}
                            style={{ left: pct(from), width: pct(to - from) }}
                            aria-hidden="true"
                          />
                        ))
                      : null}
                    <span className={styles.coverLine} style={{ left: pct(mod(referenceMinute)) }} aria-hidden="true" />
                    <SrOnly>
                      {window ? `on call ${hhmm(window.start)} to ${hhmm(window.end)}` : "no shift recorded"}
                    </SrOnly>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </CardBody>
      <CardFoot
        meta={
          <span className={styles.gaps}>
            <strong className={styles.gapsLabel}>Cover gaps</strong>
            {gaps.map((gap) => (
              <span key={gap.id} className={styles.gap}>
                <StatusGlyph tone={gap.tone} size={9} />
                {gap.text}
              </span>
            ))}
          </span>
        }
      >
        <span className={styles.legend} aria-hidden="true">
          <span className={styles.legendItem}>
            <span className={styles.swatchOn} />
            On call
          </span>
          <span className={styles.legendItem}>
            <span className={styles.swatchBusiness} />
            Business hours
          </span>
          <span className={styles.legendItem}>
            <span className={styles.swatchLine} />
            Cover at
          </span>
        </span>
      </CardFoot>
    </Card>
  );
}

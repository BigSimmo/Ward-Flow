"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  BedDouble,
  Clock,
  Command,
  Ellipsis,
  Eye,
  Filter,
  HeartPulse,
  History,
  Moon,
  Network,
  Plus,
  Scale,
  Truck,
  Users,
  CircleCheck,
} from "lucide-react";

import * as wf from "@/components/wf";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHead,
  Field,
  Hero,
  HeroStat,
  HeroTrack,
  Icon,
  Inset,
  Kbd,
  LiveChip,
  Segmented,
  StatusGlyph,
  TextInput,
  TierTile,
  Timer,
  ToastView,
  cx,
  tableClasses,
  type LiveState,
  type WfTone,
} from "@/components/wf";
import { openWardDrawer, type WardDrawerId } from "@/components/ward-management/shell/ward-drawer-bus";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { applyAppearance, useAppearanceStore } from "@/components/ward-management/shell/ward-bar";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import styles from "./sovereign-showcase.module.css";

type Density = "comfortable" | "compact";
type Section = "all" | "foundations" | "interaction" | "live" | "drawers";
type Connection = "live" | "stale" | "offline";
type Feedback = { kind: "idle" | "error" | "success"; text: string };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const LABEL_MAX = 48;

const SECTIONS: { id: Section; label: string }[] = [
  { id: "all", label: "All" },
  { id: "foundations", label: "Foundations" },
  { id: "interaction", label: "Interaction" },
  { id: "live", label: "Live" },
  { id: "drawers", label: "Drawers" },
];

const TYPE_SCALE = [
  { size: 28, sample: "Clear hierarchy" },
  { size: 20, sample: "Page and hero titles" },
  { size: 16, sample: "Card titles" },
  { size: 14, sample: "Row names and labels" },
  { size: 13, sample: "Body for a working screen" },
  { size: 12, sample: "Meta under a value" },
  { size: 11, sample: "Eyebrow label" },
] as const;

const COLOUR_ROLES = [
  { token: "surface", means: "Cards and sheets" },
  { token: "canvas", means: "Page ground" },
  { token: "ink-1", means: "Primary text" },
  { token: "ink-3", means: "Meta text" },
  { token: "accent", means: "Selection and links" },
  { token: "pri-1", means: "Primary buttons" },
  { token: "hero-1", means: "Hero band" },
  { token: "line-ctl", means: "Control edges, 3:1" },
  { token: "danger", means: "Act now only, triangle" },
  { token: "warning", means: "At risk, amber circle" },
  { token: "success", means: "Done, tick" },
  { token: "info", means: "Moving, dot" },
] as const;
type ColourToken = (typeof COLOUR_ROLES)[number]["token"];

const RADII = [
  { id: "xs", label: "6" },
  { id: "sm", label: "8" },
  { id: "md", label: "10" },
  { id: "lg", label: "14" },
  { id: "xl", label: "20" },
  { id: "pill", label: "pill" },
] as const;

const STATUS_TONES: { tone: WfTone; word: string; means: string }[] = [
  { tone: "danger", word: "Overdue", means: "Act now. Overdue, offline, error" },
  { tone: "warning", word: "Stalled", means: "At risk. Due soon, stale, pulled" },
  { tone: "success", word: "Accepted", means: "Done. Accepted, ready" },
  { tone: "info", word: "En route", means: "Moving. Held, requested" },
  { tone: "neutral", word: "Routine", means: "Waiting. Routine, cleaning" },
  { tone: "closed", word: "Declined", means: "Declined or closed, never red" },
];

const SERVICE_KINDS = [
  { id: "ward", label: "Ward", icon: BedDouble },
  { id: "community", label: "Community", icon: Users },
  { id: "emergency", label: "Emergency", icon: HeartPulse },
  { id: "transport", label: "Transport", icon: Truck },
] as const;

const PRESETS = ["Moodjar M-04", "Bentley transfer", "Example row"] as const;

const DRAWERS = [
  { id: "referral", label: "Referral", name: "Referral", icon: Plus, meta: "Start a referral" },
  { id: "tasks", label: "Tasks", name: "Tasks", icon: CircleCheck, meta: "Open work" },
  { id: "activity", label: "Activity", name: "Activity", icon: History, meta: "Recent events" },
  { id: "tools", label: "Tools", name: "Tools", icon: Filter, meta: "Local only" },
  { id: "service", label: "Service", name: "Service selector", icon: Network, meta: "Scope" },
] as const satisfies readonly { id: WardDrawerId; label: string; name: string; icon: typeof Plus; meta: string }[];

/** Components exported by `@/components/wf`, counted from the module rather than typed in. */
const COMPONENT_COUNT = Object.entries(wf).filter(
  ([name, value]) => /^[A-Z]/u.test(name) && (typeof value === "function" || typeof value === "object"),
).length;

/** Relative luminance contrast between two computed colours ("rgb(…)"). */
function contrast(a: string, b: string): number | null {
  const parse = (value: string) =>
    value
      .match(/[\d.]+/gu)
      ?.slice(0, 3)
      .map(Number);
  const ca = parse(a);
  const cb = parse(b);
  if (!ca || !cb || ca.length < 3 || cb.length < 3) return null;
  const lum = ([r, g, bl]: number[]) =>
    [r!, g!, bl!]
      .map((channel) => {
        const c = channel / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      })
      .reduce((total, c, index) => total + c * [0.2126, 0.7152, 0.0722][index]!, 0);
  const [hi, lo] = [lum(ca), lum(cb)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

function toHex(value: string): string {
  const parts = value
    .match(/[\d.]+/gu)
    ?.slice(0, 3)
    .map(Number);
  if (!parts || parts.length < 3) return value;
  return `#${parts.map((part) => Math.round(part).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function SovereignShowcaseScreen() {
  const [section, setSection] = useState<Section>("all");
  const [draftLabel, setDraftLabel] = useState("Example row");
  const [draftDensity, setDraftDensity] = useState<Density>("comfortable");
  const [appliedLabel, setAppliedLabel] = useState("Example row");
  const [appliedDensity, setAppliedDensity] = useState<Density>("comfortable");
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle", text: "Change the example, then apply it" });
  const [swatch, setSwatch] = useState<ColourToken>("danger");
  const [swatchValue, setSwatchValue] = useState<{ hex: string; ratio: number | null } | null>(null);
  const [tokenCount, setTokenCount] = useState<number | null>(null);
  const [connection, setConnection] = useState<Connection>("live");
  const [paused, setPaused] = useState(false);
  const [toastOpen, setToastOpen] = useState(true);
  const [clearance, setClearance] = useState("");
  const appearance = useAppearanceStore();
  const [mountedAt] = useState(() => Date.now());
  const night = appearance === "dark";

  /* Token count and swatch values are read from the live stylesheet, so they follow the theme. */
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const names = new Set<string>();
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of Array.from(rules)) {
          if (!(rule instanceof CSSStyleRule) || !/(^|,)\s*:root\b/u.test(rule.selectorText)) continue;
          for (const property of Array.from(rule.style)) if (property.startsWith("--wf-")) names.add(property);
        }
      }
      setTokenCount(names.size || null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const probe = document.createElement("span");
      probe.style.color = `var(--wf-${swatch})`;
      probe.style.backgroundColor = "var(--wf-surface)";
      document.body.appendChild(probe);
      const style = getComputedStyle(probe);
      setSwatchValue({ hex: toHex(style.color), ratio: contrast(style.color, style.backgroundColor) });
      probe.remove();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [swatch, night]);

  function toggleNight() {
    const next = night ? "light" : "dark";
    applyAppearance(next);
    announceToWardShell(next === "dark" ? "Night theme on." : "Day theme on.");
  }

  function openExampleDrawer(id: WardDrawerId, label: string) {
    openWardDrawer(id);
    announceToWardShell("Opening " + label + ".");
  }

  function applyExample(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextLabel = draftLabel.trim();
    if (!nextLabel) {
      setFeedback({ kind: "error", text: "Enter a label to apply the example." });
      announceToWardShell("Example not applied. Enter a label.");
      return;
    }
    setAppliedLabel(nextLabel);
    setAppliedDensity(draftDensity);
    setFeedback({ kind: "success", text: "Example applied locally" });
    announceToWardShell("Example applied locally.");
  }

  const show = (id: Exclude<Section, "all">) => section === "all" || section === id;
  const chipState: LiveState = paused ? "paused" : connection;
  const offline = connection === "offline";
  const selectedRole = COLOUR_ROLES.find((role) => role.token === swatch)!;

  const liveRows = useMemo(
    () => [
      {
        id: "tier",
        label: "Tier 1 wait, Peel ED",
        at: mountedAt - (1 * HOUR + 58 * MINUTE),
        direction: "waiting" as const,
      },
      {
        id: "form",
        label: "Form 1A, Joondalup ED",
        at: mountedAt + 3 * HOUR + 11 * MINUTE,
        direction: "left" as const,
        thresholds: { dueSoon: 30 * MINUTE },
      },
      {
        id: "hold",
        label: "Bed hold, Moodjar M-04",
        at: mountedAt + 4 * MINUTE + 29_000,
        direction: "left" as const,
        thresholds: { dueSoon: 30 * MINUTE },
      },
    ],
    [mountedAt],
  );

  const tableRows = [
    {
      id: "example",
      tier: 3,
      label: appliedLabel,
      kind: "Ward",
      tone: "neutral" as WfTone,
      state: "Routine",
      purpose: "Editable sample",
      wait: 52 * MINUTE,
      thresholds: { dueSoon: 8 * HOUR },
    },
    {
      id: "comparison",
      tier: 2,
      label: "Comparison row",
      kind: "Community",
      tone: "success" as WfTone,
      state: "Accepted",
      purpose: "Static sample",
      wait: 3 * HOUR + 10 * MINUTE,
      thresholds: { dueSoon: 8 * HOUR },
    },
    {
      id: "attention",
      tier: 2,
      label: "Attention row",
      kind: "Emergency",
      tone: "warning" as WfTone,
      state: "Stalled",
      purpose: "Crosses 8h live",
      wait: 7 * HOUR + 59 * MINUTE,
      thresholds: { dueSoon: 8 * HOUR },
    },
    {
      id: "tier1",
      tier: 1,
      label: "Tier 1 row",
      kind: "Transport",
      tone: "danger" as WfTone,
      state: "Overdue",
      purpose: "Tier 1, 2h and 4h",
      wait: 4 * HOUR + MINUTE,
      thresholds: { dueSoon: 2 * HOUR, overdue: 4 * HOUR },
    },
  ];

  return (
    <main className={styles.workspace} id="main-content" data-ward-design="v6" aria-label="Design system showcase">
      <Hero
        level={1}
        eyebrow="Component reference"
        title="Design system showcase"
        stats={
          <>
            <HeroStat value={COMPONENT_COUNT} label="Components" />
            <HeroStat value={STATUS_TONES.length} label="Status tones" />
            <HeroStat value={tokenCount ?? "–"} label="Tokens" />
          </>
        }
        aside={
          <>
            <HeroTrack label="Showcase sections" items={SECTIONS} value={section} onChange={setSection} />
            <Button variant="onHero" size="sm" icon={Moon} aria-pressed={night} onClick={toggleNight}>
              Night
            </Button>
          </>
        }
      />

      {show("foundations") ? (
        <div className={styles.topGrid}>
          <Card aria-labelledby="showcase-foundations" id="foundations">
            <CardHead
              id="showcase-foundations"
              icon={Scale}
              title="Foundations"
              aside={<span className={styles.headMeta}>Tap a swatch</span>}
            />
            <CardBody className={styles.foundations}>
              <div className={styles.typeCol}>
                <h3 className={styles.eyebrow}>Type, {TYPE_SCALE.length} sizes</h3>
                <ul className={styles.typeList} aria-label="Type scale examples">
                  {TYPE_SCALE.map((row) => (
                    <li key={row.size}>
                      <span className={styles.typeSize}>{row.size}</span>
                      <span className={cx(styles.typeSample, styles[`fs${row.size}`])}>{row.sample}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={styles.colourCol}>
                <h3 className={styles.eyebrow}>Colour roles</h3>
                <div className={styles.swatchGrid} role="radiogroup" aria-label="Theme token swatches">
                  {COLOUR_ROLES.map((role) => (
                    <button
                      key={role.token}
                      type="button"
                      role="radio"
                      aria-checked={swatch === role.token}
                      className={cx(styles.swatch, swatch === role.token && styles.swatchOn)}
                      onClick={() => setSwatch(role.token)}
                    >
                      <span
                        className={styles.swatchChip}
                        style={{ background: `var(--wf-${role.token})` }}
                        aria-hidden="true"
                      />
                      {role.token}
                    </button>
                  ))}
                </div>
                <Inset className={styles.swatchDetail} aria-live="polite">
                  <span className={styles.swatchToken}>--wf-{swatch}</span>
                  <span className={styles.swatchMeans}>{selectedRole.means}</span>
                  <span className={styles.swatchValue}>
                    Now <strong>{swatchValue?.hex ?? "–"}</strong>
                  </span>
                  <span className={styles.swatchValue}>
                    Contrast on surface <strong>{swatchValue?.ratio ? swatchValue.ratio.toFixed(1) : "–"}</strong>
                  </span>
                </Inset>
              </div>
              <div className={styles.scales}>
                <div>
                  <h3 className={styles.eyebrow}>Radius</h3>
                  <ul className={styles.scaleRow}>
                    {RADII.map((radius) => (
                      <li key={radius.id}>
                        <span
                          className={styles.radiusBox}
                          style={{ borderRadius: `var(--wf-r-${radius.id})` }}
                          aria-hidden="true"
                        />
                        <span className={styles.scaleLabel}>{radius.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className={styles.eyebrow}>Depth</h3>
                  <ul className={styles.scaleRow}>
                    {(["e1", "e2", "e3"] as const).map((depth) => (
                      <li key={depth}>
                        <span
                          className={styles.depthBox}
                          style={{ boxShadow: `var(--wf-${depth})` }}
                          aria-hidden="true"
                        />
                        <span className={styles.scaleLabel}>{depth}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className={styles.eyebrow}>Space</h3>
                  <ul className={styles.scaleRow}>
                    {([1, 2, 3, 4] as const).map((step) => (
                      <li key={step}>
                        <span className={styles.spaceBar} style={{ width: `var(--wf-s-${step})` }} aria-hidden="true" />
                        <span className={styles.scaleLabel}>{step * 4}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card aria-labelledby="showcase-status" id="shared-components">
            <CardHead
              id="showcase-status"
              icon={Eye}
              title="Status language"
              aside={<span className={styles.headMeta}>Shape first, then colour</span>}
            />
            <CardBody flush>
              <table className={cx(tableClasses.table, styles.statusTable)}>
                <thead>
                  <tr>
                    <th scope="col">Chip</th>
                    <th scope="col">In a row</th>
                    <th scope="col">Means</th>
                  </tr>
                </thead>
                <tbody>
                  {STATUS_TONES.map((row) => (
                    <tr key={row.tone}>
                      <td>
                        <Badge tone={row.tone}>{row.word}</Badge>
                      </td>
                      <td>
                        <span className={styles.inRow}>
                          <StatusGlyph tone={row.tone} size={9} />
                          {row.word}
                        </span>
                      </td>
                      <td className={styles.means}>{row.means}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className={styles.kinds}>
                <h3 className={styles.eyebrow}>Service kinds</h3>
                <div className={styles.kindRow}>
                  {SERVICE_KINDS.map((kind) => (
                    <Badge key={kind.id}>
                      <span className={styles.kindChip}>
                        <Icon icon={kind.icon} size={14} />
                        {kind.label}
                      </span>
                    </Badge>
                  ))}
                </div>
                <p className={styles.redRule}>
                  <StatusGlyph tone="danger" size={9} />
                  Red means act now. Nothing else is red.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {show("interaction") ? (
        <Card aria-labelledby="showcase-interaction" id="interaction-example">
          <CardHead
            id="showcase-interaction"
            icon={Command}
            title="Interaction example"
            aside={<span className={styles.headMeta}>Nothing here is saved</span>}
          />
          <div className={styles.interactionGrid}>
            <form className={styles.exampleForm} onSubmit={applyExample} noValidate>
              <Field
                label="Example row label"
                id="showcase-example-label"
                help={feedback.kind === "error" ? undefined : "Short, non-clinical sample label"}
                error={feedback.kind === "error" ? feedback.text : undefined}
              >
                <TextInput
                  value={draftLabel}
                  maxLength={LABEL_MAX}
                  onChange={(event) => setDraftLabel(event.target.value)}
                  onClear={() => setDraftLabel("")}
                  trailing={
                    <span className={styles.counter}>
                      {draftLabel.length}/{LABEL_MAX}
                    </span>
                  }
                />
              </Field>
              <div className={styles.presets} role="group" aria-label="Sample labels">
                {PRESETS.map((preset) => (
                  <Button key={preset} size="sm" onClick={() => setDraftLabel(preset)}>
                    {preset}
                  </Button>
                ))}
              </div>
              <div className={styles.densityField}>
                <span className={styles.fieldLabel} id="showcase-density-label">
                  Table density
                </span>
                <Segmented
                  label="Table density"
                  items={[
                    { id: "comfortable", label: "Comfortable" },
                    { id: "compact", label: "Compact" },
                  ]}
                  value={draftDensity}
                  onChange={setDraftDensity}
                  size="md"
                />
              </div>
              <div className={styles.formActions}>
                <Button type="submit" variant="pri">
                  Apply example
                </Button>
                <Button disabledReason="No saved presets here">Save preset</Button>
              </div>
              <p className={cx(styles.feedback, feedback.kind === "success" && styles.feedbackDone)} role="status">
                {feedback.kind === "error" ? "Not applied" : feedback.text}
              </p>
            </form>

            <div className={styles.tableExample}>
              <div className={styles.tableHeading}>
                <h3>
                  Shared table{" "}
                  <span className={styles.tableMeta}>
                    {appliedDensity === "compact" ? "Compact" : "Comfortable"} density
                  </span>
                </h3>
                <span className={styles.headMeta}>Waits tick and cross thresholds</span>
              </div>
              <div className={styles.exampleTableScroll}>
                <table
                  className={cx(
                    tableClasses.table,
                    styles.exampleTable,
                    appliedDensity === "compact" && styles.exampleTableCompact,
                  )}
                >
                  <caption className={styles.srOnly}>
                    Synthetic rows showing shared table, kind and status components
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Example</th>
                      <th scope="col">Kind</th>
                      <th scope="col">State</th>
                      <th scope="col">Purpose</th>
                      <th scope="col" className={styles.waitHead}>
                        Waiting
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => (
                      <tr key={row.id}>
                        <th scope="row">
                          <span className={styles.exampleName}>
                            <TierTile tier={row.tier} />
                            <span data-example-label="">{row.label}</span>
                          </span>
                        </th>
                        <td>{row.kind}</td>
                        <td>
                          <span className={styles.inRow}>
                            <StatusGlyph tone={row.tone} size={9} />
                            {row.state}
                          </span>
                        </td>
                        <td className={styles.means}>{row.purpose}</td>
                        <td className={styles.waitCell}>
                          <WaitValue at={mountedAt - row.wait} thresholds={row.thresholds} paused={paused} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {show("live") || show("drawers") ? (
        <div className={styles.bottomGrid}>
          {show("live") ? (
            <Card aria-labelledby="showcase-live" id="live-and-time">
              <CardHead
                id="showcase-live"
                icon={Clock}
                title="Live and time"
                aside={
                  <LiveChip
                    state={chipState}
                    age={chipState === "live" ? "1s" : undefined}
                    asAt={mountedAt - 3 * MINUTE}
                    onTogglePause={() => setPaused((value) => !value)}
                  />
                }
              />
              <div className={styles.connection}>
                <span className={styles.fieldLabel}>Connection</span>
                <Segmented
                  label="Connection"
                  items={[
                    { id: "live", label: "Live" },
                    { id: "stale", label: "Stale" },
                    { id: "offline", label: "Offline" },
                  ]}
                  value={connection}
                  onChange={setConnection}
                  size="md"
                />
              </div>
              <ul className={styles.liveRows}>
                {liveRows.map((row) => (
                  <li key={row.id} className={styles.liveRow}>
                    <span className={styles.liveLabel}>{row.label}</span>
                    <LiveTimer
                      at={row.at}
                      direction={row.direction}
                      thresholds={"thresholds" in row ? row.thresholds : undefined}
                      paused={paused}
                      estimate={offline}
                      fast={row.id === "hold"}
                    />
                  </li>
                ))}
              </ul>
              <div className={styles.liveFoot}>
                <Button
                  size="sm"
                  disabledReason={offline ? "Paused while offline" : undefined}
                  onClick={() => setClearance("Example only, nothing was sent")}
                >
                  Request clearance
                </Button>
                {offline ? null : <span className={styles.headMeta}>{clearance || "Server action ready"}</span>}
              </div>
            </Card>
          ) : null}

          {show("drawers") ? (
            <Card aria-labelledby="showcase-drawers" id="drawer-triggers">
              <CardHead
                id="showcase-drawers"
                icon={Ellipsis}
                title="Drawer triggers"
                aside={<span className={styles.headMeta}>Glass sheets over a scrim</span>}
              />
              <CardBody className={styles.drawerBody}>
                <div className={styles.drawerGrid}>
                  {DRAWERS.map((drawer) => (
                    <div key={drawer.id} className={styles.drawerItem}>
                      <button
                        type="button"
                        className={styles.drawerButton}
                        aria-label={`Open ${drawer.name}`}
                        onClick={() => openExampleDrawer(drawer.id, drawer.name)}
                      >
                        <Icon icon={drawer.icon} size={16} />
                        <span>{drawer.label}</span>
                      </button>
                      <span className={styles.drawerMeta}>{drawer.meta}</span>
                    </div>
                  ))}
                </div>
                <Inset className={styles.keys}>
                  <Kbd>Esc</Kbd>
                  <span>closes any sheet</span>
                </Inset>
                <div className={styles.toastRow}>
                  <span className={styles.eyebrow}>Toast</span>
                  <div role="status" className={styles.toastSlot}>
                    {toastOpen ? (
                      <ToastView
                        tone="success"
                        title="Bed held, Moodjar M-04"
                        meta="28m left"
                        action={{ label: "Release", onAction: () => setToastOpen(false) }}
                      />
                    ) : (
                      <Button size="sm" icon={Activity} onClick={() => setToastOpen(true)}>
                        Show toast
                      </Button>
                    )}
                  </div>
                  <span className={styles.headMeta}>Stays until dismissed</span>
                </div>
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      <WardPrototypeFooter
        testId="ward-sovereign-governance"
        note="Synthetic design examples. Local controls change nothing in ward records."
      />
    </main>
  );
}

/** Waiting value for the example table: value over its state word. */
function WaitValue({
  at,
  thresholds,
  paused,
}: {
  at: number;
  thresholds: { dueSoon?: number; overdue?: number };
  paused: boolean;
}) {
  const now = wf.useMinuteNow({ paused });
  const ms = now - at;
  const flagged =
    (thresholds.overdue != null && ms >= thresholds.overdue) ||
    (thresholds.dueSoon != null && ms >= thresholds.dueSoon);
  return (
    <span className={styles.waitValue}>
      <Timer at={at} now={now} direction="waiting" thresholds={thresholds} hideDirection />
      {flagged ? null : <span className={styles.onTrack}>On track</span>}
    </span>
  );
}

/** Live list row: state word, then the timer chip. */
function LiveTimer({
  at,
  direction,
  thresholds,
  paused,
  estimate,
  fast,
}: {
  at: number;
  direction: "waiting" | "left";
  fast: boolean;
  thresholds?: { dueSoon?: number; overdue?: number };
  paused: boolean;
  estimate: boolean;
}) {
  const now = wf.useMinuteNow({ paused, fast });
  const ms = direction === "left" ? at - now : now - at;
  const soon = thresholds?.dueSoon != null && direction === "left" && ms <= thresholds.dueSoon;
  return (
    <span className={styles.liveValue}>
      {soon ? null : <span className={styles.onTrack}>On track</span>}
      <Timer at={at} now={now} direction={direction} thresholds={thresholds} chip estimate={estimate} />
    </span>
  );
}

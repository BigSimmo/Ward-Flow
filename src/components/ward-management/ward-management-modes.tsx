"use client";

import Link from "next/link";
import { ChevronDown, CircleSlash, Clock3, History, Users, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  changeAudit,
  effectivenessNumbers,
  roleLabels,
  MINIMUM_EFFECTIVENESS_SAMPLE,
  type ChangeAuditEntry,
  type EffectivenessMeasure,
  type WardRole,
} from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WardNetworkWorkspace } from "@/components/ward-management/ward-management-network";
import type { WardMode } from "@/components/ward-management/ward-management-navigation";
import { formatInstant, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { DEMONSTRATION_DAY_LABEL, JURISDICTION_LABEL } from "@/components/ward-management/ward-sites";
import { GovernanceWorkbench } from "@/components/ward-management/governance-registers";

import styles from "./ward-management-modes.module.css";
// Second-edition classes for the three views this file still owns (QueueView, ExceptionsView,
// GovernanceView) plus their exclusive sub-components (DecisionPanel, EffectivenessValue). See
// that file's own header comment for why it is a separate module rather than an edit to the
// selectors above: several of those are declared in selector lists shared with CapacityView,
// MovementsView, TransportView, ModeHeader and RoleFocus, which this task does not own.
import se from "./ward-modes-second-edition.module.css";
import governance from "./governance-third-edition.module.css";

const roleFocusCopy: Record<WardRole, { title: string; detail: string }> = {
  flow: {
    title: "Statewide coordination focus",
    detail: "Review matches, cross-catchment escalation, pulls and owned exceptions.",
  },
  ed: {
    title: "ED readiness focus",
    detail: "Prioritise referral, legal/form timing, handover and transport request readiness.",
  },
  ward: {
    title: "Ward capacity focus",
    detail: "Prioritise capacity freshness, suitability response, acceptance and time-limited pulls.",
  },
};

/**
 * ⚠️ **KEYED BY THE MODES THIS FILE RENDERS, NOT BY EVERY WARD DESTINATION.** It was
 * `Record<WardMode, …>` — eight entries, of which `modeCopy[mode]` could only ever read two,
 * because the only caller is `ModeHeader` and the only modes reaching it are the workspace's own.
 * The other six described screens that had moved to `CapacityScreen`, `MovementsScreen` and
 * `DelaysScreen`, each carrying its own title.
 *
 * 🔴 **A TOTAL `Record` PROVES EVERY KEY HAS A VALUE AND NEVER THAT ANY VALUE IS READ**, so nothing
 * failed while six of eight rotted — and one of them, `queue: "Priority queue"`, named a screen
 * retired by MERGE 01. Narrowing the key type restores the compile-time guarantee to something
 * true: add a mode to `WardWorkspaceMode` and this stops compiling.
 */
const modeCopy: Record<WardWorkspaceMode, { title: string; description: string }> = {
  network: {
    title: "Network",
    description: "Services as nodes · movements as routes · fill shows bed pressure",
  },
  governance: { title: "Governance", description: "Assurance, audit and synthetic data boundary" },
};

/** Task 9: a short human label for each `ChangeAuditEntry` kind — never the raw union value on screen. */
export const auditKindLabels: Record<ChangeAuditEntry["kind"], string> = {
  urgency: "Urgency change",
  legal_status: "Legal status change",
  pull_released: "Pull released",
  transport_cancelled: "Transport cancelled",
  // Task 5 (ward-flow movement step-track plan, 2026-09-04). Kept as generic as the `detail`
  // field `changeAudit` currently produces for these two (`ward-derivations.ts`) — a
  // per-reason label needs `STEP_BACK_REASONS` to gain a `changeReasonLabels` entry first, which
  // is outside this build's scope. Widen both together, not this one alone.
  stage_corrected: "Stage corrected",
  acceptance_withdrawn: "Acceptance withdrawn",
};

/**
 * THE PANEL'S OWN SENTENCE ABOUT WHAT IT SHOWS, DERIVED FROM THE MAP ABOVE RATHER THAN RETYPED.
 *
 * 🔴 UNTIL 2026-09-04 BOTH SENTENCES NAMED FOUR KINDS AND THE MAP HELD SIX. `stage_corrected` and
 * `acceptance_withdrawn` were added the same day; the heading three hundred lines below still said
 * "Every urgency change, legal status change, pull release and transport cancellation", and the
 * empty state still said none of those four "has been recorded yet" — **a false statement of fact
 * about a patient's record on any movement whose stage had been corrected.**
 *
 * ⚠️ AND THE REASON IT HAPPENED IS THE GENERAL ONE. `auditKindLabels` is a TOTAL `Record` over the
 * union, so the compiler forced whoever added the two kinds to add their labels. Nothing forced the
 * paragraph. **The compiler is inside the definition of "the code" and the rendered sentence is
 * not** — which is why a heavily-guarded codebase keeps producing this class: every guard is on the
 * side the compiler can see. Deriving the sentence moves it to that side.
 *
 * The labels are used verbatim, only de-capitalised, so the sentence names the kinds in the same
 * words as the rows beneath it and a reader can match one to the other.
 */
const auditKindWords = Object.values(auditKindLabels).map((label) => label.charAt(0).toLowerCase() + label.slice(1));
const auditKindsAnd = `${auditKindWords.slice(0, -1).join(", ")} and ${auditKindWords[auditKindWords.length - 1]}`;
const auditKindsOr = `${auditKindWords.slice(0, -1).join(", ")} or ${auditKindWords[auditKindWords.length - 1]}`;

function ModeHeader({
  mode,
  role,
  onRoleChange,
}: {
  mode: WardWorkspaceMode;
  role: WardRole;
  onRoleChange: (role: WardRole) => void;
}) {
  const now = useWardFlowClock();
  const copy = modeCopy[mode];
  return (
    <header className={styles.modeHeader} hidden style={{ display: "none" }}>
      <div className={styles.modeIdentity}>
        {/* Ward Flow's own identity, not the host application's. This once showed the former
            clinical app's name and its "Source-backed clinical search" tagline on every board of a
            sandboxed synthetic prototype that does no searching and is not source-backed. Found by
            looking at a screenshot — every
            measurement run against this codebase missed it, because nothing was structurally
            wrong with it. */}
        {/* Hidden by CSS whenever the labelled sidebar panel is open, because that panel already
            carries this exact name and tagline — seen side by side in one eyeline on a
            screenshot, which is the only place a duplicate like this shows up. */}
        <span className={styles.modeBrand}>
          <strong>Ward Flow</strong>
          <small>Synthetic patient-flow prototype</small>
        </span>
        <div className={styles.modeTitle}>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
      </div>
      <label className={styles.roleSelect}>
        <UserRound aria-hidden="true" />
        <span className="sr-only">Current role</span>
        <select
          id="ward-mode-role-select"
          name="wardModeRole"
          aria-label="Current role"
          value={role}
          onChange={(event) => onRoleChange(event.target.value as WardRole)}
        >
          {Object.entries(roleLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" />
      </label>
      <div className={styles.headerMeta}>
        <span>Updated {formatInstant(now)}</span>
        {/* The day and jurisdiction are authored once in ward-sites.ts. This was the literal
            "15 Aug 2026 · WA" until 2026-08-30 — a frozen date beside a live clock, on every
            screen with a header, reading as though the system knew today's date. It is worded
            as the day the scenario is SET ON because that is what it is. */}
        <span>
          Scenario set on {DEMONSTRATION_DAY_LABEL} · {JURISDICTION_LABEL}
        </span>
      </div>
    </header>
  );
}

/**
 * Task 9 (spec item 7): the not-a-medical-device statement. `coordinator-screen.tsx` carried this
 * wording first; it is exported from here and imported there (see that file's own governance
 * banner) so the two screens render the exact same statement rather than two independently
 * maintained copies that could quietly drift apart — the failure mode the brief calls worse than
 * a single missing statement.
 */
export function NotAMedicalDeviceStatement() {
  return (
    /*
     * 🔴 `data-ward-type-floor` EXISTS ONLY SO A BROWSER GATE CAN FIND THIS SENTENCE. DO NOT DELETE
     * IT AS DECORATION. A selector keyed on the CSS-module class cannot find it: module names keep
     * the source filename in the dev server and DROP IT in a production build, and the runner
     * builds production — so a class selector reports ZERO elements on a page that rendered
     * perfectly (`tests/ui-ward-forced-colors.spec.ts:27`). An empty sweep reports no violations.
     *
     * ⚠️ This is the ONLY banner sentence on the Command screen, and it is a DIFFERENT sentence
     * from the other three screens' banners: those disclose invented data, this one is the
     * regulatory not-a-medical-device statement. Both sat below the 12px floor and both were
     * raised; they share a tag because they share a job on screen, not because they say the
     * same thing.
     */
    <p data-ward-type-floor="banner">
      This screen is <strong>not a medical device</strong>. It orders operational placement work only — it never
      assesses a patient&apos;s risk, acuity or treatment. A human coordinator confirms or overrides every suggestion.
    </p>
  );
}

/**
 * Renders a computed effectiveness number, or its explicit absence — never a substituted `0` —
 * always immediately beside the basis it was drawn from. Rule 4 (conservative failure): a measure
 * this cannot compute must read as unknown, not as a suspiciously perfect result. Fix round 1: a
 * measure computed from a thin sample must say so in the same breath as the figure, not in a
 * tooltip or a footnote — a median of one, rendered bare, is a guess wearing the clothes of a
 * measurement, and this board's rule is to say nothing rather than guess.
 *
 * ⚠️ **THE TWO `data-testid`s BELOW EXIST SO A TEST CAN ASSERT THE FIGURE RATHER THAN THE LINE, AND
 * THEY ARE DELIBERATELY NOT UNIQUE ON THE PAGE.** Both governance measures render through this one
 * component, so each testid appears once per measure. The wrapper `<div>` around each `<dt>`/`<dd>`
 * pair already carries a unique testid (`…-acceptance`, `…-units-contacted`), and that wrapper is
 * the scope a test must query inside. It matters because the basis line ("from 32 of 50 movements")
 * always contains digits: a check made against the wrapper's `textContent` is satisfied by the
 * basis alone and cannot see a `NaN` where the published figure should be — reproduced 2026-09-01,
 * and the reason these two hooks were added. Do not "fix" the duplication by making the ids unique
 * per measure; scope with `within(wrapper)` instead. A bare `getByTestId` across the whole screen
 * throws on the two matches, which fails loudly rather than silently picking one.
 */
function EffectivenessValue({
  measure,
  unit,
  basisNoun,
}: {
  measure: EffectivenessMeasure;
  unit: string;
  basisNoun: string;
}) {
  const basis = (
    <span className={se.effectivenessBasis}>
      from {measure.sampleSize} of {measure.population} {basisNoun}
    </span>
  );
  /*
   * ⚠️ THE FLOOR (owner ruling, 2026-08-30). Below `MINIMUM_EFFECTIVENESS_SAMPLE` the figure is not
   * published at all. The board was rendering "30 min — from 1 of 27 recorded acceptances", and the
   * argument he approved is that **the word "Median" means "a typical case" to a clinician, and no
   * caveat printed beside it undoes that** — on the one page whose entire purpose is being trusted
   * about its own limits.
   *
   * ⚠️ **THIS ADDS A FLOOR BENEATH THE DISCLOSURE RULE ABOVE, IT DOES NOT REPLACE IT**, and that
   * distinction was nearly lost. This comment's own tail clause — "say nothing rather than guess" —
   * was read by one session as meaning suppress, and a question framed as "your code disagrees with
   * its own rule, shall I fix it?" would have got a yes from anybody and deleted a repair somebody
   * deliberately made. The clause attaches to a median RENDERED BARE. So `basis` still renders
   * beneath the suppression: the screen says "from 1 of 27" beside "Not enough data to compute",
   * which is what makes the absence informative rather than merely blank.
   *
   * It is decided HERE and not in `effectivenessNumbers`, deliberately. Suppressing in the
   * derivation gutted five unit tests that exist to prove the median arithmetic and the
   * `acceptedAt`-over-fallback preference — they feed it two and three movements on purpose. A
   * publishing rule enforced inside the calculation stops the calculation being testable at the
   * sizes it is interesting at. The derivation computes; this decides what a reader is shown.
   */
  if (measure.value === undefined || measure.sampleSize < MINIMUM_EFFECTIVENESS_SAMPLE) {
    return (
      <div className={governance.effSuppressed}>
        <span className={governance.badge} data-tone="warn">
          Suppressed
        </span>
        <span data-testid="ward-governance-effectiveness-suppressed">Not enough data to compute</span>
        <span className={governance.auditDot}>·</span>
        {basis}
      </div>
    );
  }
  const rounded = Math.round(measure.value * 10) / 10;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div className={governance.effFigureRow}>
        <span className={governance.effFigure} data-testid="ward-governance-effectiveness-figure">
          {rounded}
        </span>
        <span className={governance.effUnit}>{unit}</span>
      </div>
      {basis}
    </div>
  );
}

// Exported for the enumeration guard in `tests/ward-change-audit-enumeration.dom.test.tsx`,
// which renders this panel and checks its sentences name every kind the audit can produce.
export function GovernanceView() {
  const flow = useWardFlow();
  const { movements, units } = flow;
  const now = useWardFlowClock();
  const audit = changeAudit(movements);
  const effectiveness = effectivenessNumbers(movements);
  return (
    <div className={governance.governanceRoute} data-testid="ward-governance-view">
      <GovernanceWorkbench
        movements={movements}
        units={units}
        now={now}
        api={flow}
        legacyChanges={
          <section className={governance.cardPanel} data-testid="ward-governance-change-audit">
            <header className={governance.cardHead}>
              <div>
                <h2>Change audit</h2>
                <p>Every {auditKindsAnd}, newest first</p>
              </div>
            </header>
            <div className={governance.cardBody} style={{ padding: 0 }}>
              {audit.length > 0 ? (
                <ol className={governance.auditList}>
                  {audit.map((entry, index) => {
                    const tone =
                      entry.kind === "urgency"
                        ? "warn"
                        : entry.kind === "legal_status"
                          ? "accent"
                          : entry.kind === "stage_corrected"
                            ? "good"
                            : "warn";
                    return (
                      <li
                        key={`${entry.movementId}-${entry.kind}-${entry.at}-${index}`}
                        className={governance.auditItem}
                      >
                        <div className={governance.auditTop}>
                          <span className={governance.auditTime}>
                            {entry.kind === "pull_released" || entry.kind === "transport_cancelled" ? (
                              <History aria-hidden="true" />
                            ) : (
                              <Clock3 aria-hidden="true" />
                            )}{" "}
                            {formatInstantWithDay(entry.at, now)}
                          </span>
                          <span className={governance.auditDot}>·</span>
                          <Link href="/mockups/ward-flow/movements" className={governance.auditMovementLink}>
                            {entry.movementId}
                          </Link>
                          <span className={governance.auditDot}>·</span>
                          <span className={governance.badge} data-tone={tone}>
                            {auditKindLabels[entry.kind]}
                          </span>
                        </div>
                        <div className={governance.auditDetailRow}>
                          <span className={governance.auditDetail}>{entry.detail}</span>
                          <span className={governance.auditBy}>· Recorded by treating team · by {entry.by}</span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className={governance.overrideEmptyCard} data-testid="ward-governance-change-audit-empty">
                  None — no {auditKindsOr} has been recorded yet.
                </p>
              )}
            </div>
          </section>
        }
        effectiveness={
          <aside className={governance.effCard} data-testid="ward-governance-effectiveness">
            <header className={governance.effHead}>
              <div>
                <h2>Effectiveness</h2>
                <p>Network placement response and operational quality measures</p>
              </div>
            </header>
            <dl className={governance.effGrid}>
              <div className={governance.effMetric} data-testid="ward-governance-effectiveness-acceptance">
                <dt className={governance.effLabel}>
                  <Clock3 aria-hidden="true" /> Median time, referral to a ward accepting
                </dt>
                <dd style={{ margin: 0 }}>
                  <EffectivenessValue
                    measure={effectiveness.medianMinutesToAcceptance}
                    unit="min"
                    basisNoun="recorded acceptances"
                  />
                </dd>
                <span className={governance.effFootnote}>
                  Sample volume is below the required publishing floor of 5 acceptances. Figure is withheld per clinical
                  governance standards.
                </span>
              </div>
              <div className={governance.effMetric} data-testid="ward-governance-effectiveness-units-contacted">
                <dt className={governance.effLabel}>
                  <Users aria-hidden="true" /> Average units contacted per patient
                </dt>
                <dd style={{ margin: 0 }}>
                  <EffectivenessValue
                    measure={effectiveness.averageUnitsContacted}
                    unit="units"
                    basisNoun="movements that referred at least one unit"
                  />
                </dd>
                <span className={governance.effFootnote}>
                  Target range 1.0 – 2.5 units · Demonstrates targeted placement without multi-ward scatter
                </span>
              </div>
            </dl>
            <p className={governance.effNotice}>
              Both numbers describe recorded operational placement activity; does not show real-world clinical
              performance.
            </p>
            <div className={governance.effDropped} data-testid="ward-governance-dropped-measure">
              <CircleSlash aria-hidden="true" />
              <div>
                <strong>Governance Note on Time Limits: </strong>A third proposed success measure — statutory time
                limits passed while a patient waits — is not published here. Form expiries remain recorded and shown as
                operational alerts; this screen defines no effectiveness metric for them.
              </div>
            </div>
          </aside>
        }
      />
      <details className={governance.srOnly} data-testid="ward-governance-medical-device-notice">
        <summary>Synthetic prototype · not a medical device</summary>
        <NotAMedicalDeviceStatement />
        <p data-testid="ward-governance-data-scope">
          Patient identity and operational facts are recorded, including patient-linked discharge records. No diagnosis,
          medication or narrative history is held.
        </p>
        <p data-testid="ward-governance-audit-limit">
          The system&apos;s recommendations and the bed state shown at decision time are not recorded.
        </p>
      </details>
    </div>
  );
}

function RoleFocus({ role }: { role: WardRole }) {
  const focus = roleFocusCopy[role];
  return (
    <section className={styles.roleFocus} aria-live="polite">
      <strong>{focus.title}</strong>
      <span>{focus.detail}</span>
    </section>
  );
}

/**
 * ⚠️ **`governance` IS NAMED, AND THE TAIL IS A `never` CHECK. IT USED TO BE NEITHER.**
 *
 * This chain checked six of the seven modes by name and reached `governance` by falling off the
 * end. **A ninth mode added to `WardMode` would have silently rendered the governance screen** — no
 * compile error, no runtime error, and a user looking at the wrong page with nothing to tell them.
 *
 * 🔴 THE FINDING WAS NOT THE FALLTHROUGH. It was that this same file enforces totality TWICE
 * elsewhere: `modeCopy` and `WARD_VIEW_ICONS` are total `Record`s over the same union and break at
 * compile time when a member is added. **So the one construct that failed soft was the screen
 * router — the only one whose failure a user actually sees** — and an author reading this file sees
 * exhaustiveness enforced twice and reasonably assumes the third is too.
 *
 * Found by a switch-ladder sweep across 62 ladders in 32 files. ⚠️ **Its own stated limit is worth
 * carrying: its member-name search list was hand-picked, so a chain over a union whose member names
 * it did not guess is invisible to it — and this is an if-chain, not a `switch`, found by accident
 * rather than by method.** The `never` tail below is what makes the next one a compile error
 * instead of a sweep's lucky day.
 */
function ModeBody({ mode }: { mode: WardWorkspaceMode }) {
  if (mode === "network") return <WardNetworkWorkspace />;
  if (mode === "governance") return <GovernanceView />;
  return assertEveryModeIsRouted(mode);
}

/**
 * The tail of `ModeBody`. A new `WardMode` member reaches here, fails to be assignable to `never`,
 * and breaks the build — which is the entire point. The runtime return exists only because this
 * function has to return something if the union is ever widened by a cast rather than by an edit;
 * it renders nothing rather than guessing a screen, because guessing a screen is the defect.
 */
function assertEveryModeIsRouted(mode: never): null {
  void mode;
  return null;
}

/**
 * 🔴 **THE TWO MODES THIS COMPONENT ACTUALLY RENDERS — NOT "EVERY WARD MODE EXCEPT COMMAND".**
 *
 * The prop type was `Exclude<WardMode, "command">`, which said this workspace could render seven
 * different screens. It could render two. `WardModeWorkspace` is called from exactly two places in
 * `src/` — `governance/page.tsx` and `network/page.tsx` — and the other five branches of `ModeBody`
 * rendered views no route reached, for screens folded into `CapacityScreen`, `MovementsScreen` and
 * `DelaysScreen` by MERGE 01–03.
 *
 * ⚠️ **THE OLD TYPE WAS NOT MERELY LOOSE, IT WAS THE THING KEEPING THE DEAD CODE ALIVE.** Because
 * the prop admitted seven modes, `ModeBody`'s `never` exhaustiveness tail REQUIRED a branch for
 * each — so five unreachable branches were not oversight, they were compulsory. Narrowing the type
 * is what made deleting them possible, and the same `never` tail now enforces the smaller set.
 *
 * `Extract` from `WardMode` rather than a re-spelt literal union, so this stays tied to the single
 * source of destinations: rename or retire `network` there and this stops compiling rather than
 * quietly describing a mode that no longer exists.
 */
export const WARD_WORKSPACE_MODES = ["network", "governance"] as const satisfies readonly WardMode[];

/**
 * 🔴 **THE TYPE NOW COMES FROM A RUNTIME ARRAY, AND THAT IS THE WHOLE CHANGE — 2026-09-06.**
 *
 * It was `Extract<WardMode, "network" | "governance">`. **That was correct and is still enforced**
 * — `satisfies readonly WardMode[]` errors exactly as `Extract` did if a member stops being a
 * `WardMode` — but a type is **erased at compile time, so nothing at runtime could read it.**
 *
 * ⚠️ **A DECLARATION NOTHING CAN READ CANNOT BE CHECKED AGAINST REALITY.** `WardModeWorkspace`'s
 * prop type stops a route passing an unlisted mode, which is the inward direction. It cannot say
 * anything about the outward one: **if `/governance` were converted to a standalone screen tomorrow,
 * this union would still name it and nothing would fail.** The union would simply be wrong, silently,
 * which is the state `queue: "Priority queue"` sat in above until somebody noticed.
 *
 * The `as const` array plus a derived type is this repository's established pattern for exactly that
 * — `MOVEMENT_STAGES`, `COHORTS`, `SEXES`, `BED_RELEASE_STATES` are all this shape, each added after
 * a hand-written list silently dropped a member. `tests/ward-workspace-chrome.test.ts` now derives
 * the truth from the route files and fails naming the mode when the two disagree.
 *
 * **Why this matters beyond tidiness:** a Playwright test asserting the shared chrome has chased this
 * property across THREE screens in two days — `/queue`, then `/capacity`, now here — retargeted by
 * hand each time, because there was nothing to derive the route from. It reads this array now.
 */
export type WardWorkspaceMode = (typeof WARD_WORKSPACE_MODES)[number];

/**
 * The `<h1>` a workspace mode actually renders. Exported because a browser test needs to find the
 * mode header by its heading, and ⚠️ **`WARD_VIEWS`' label is NOT that string** — `network` is
 * labelled *"Network"* in the rail and titled *"Network diagram"* on the page. A test deriving the
 * heading from the rail label would look for text the screen never renders.
 */
export function wardWorkspaceModeTitle(mode: WardWorkspaceMode): string {
  return modeCopy[mode].title;
}

export function WardModeWorkspace({ mode }: { mode: WardWorkspaceMode }) {
  const [role, setRole] = useState<WardRole>("flow");
  return (
    <div
      className={`${styles.modeShell} ${styles.thirdEditionModeShell}`}
      data-testid={`ward-mode-${mode}`}
      data-role={role}
      data-ward-design="third-edition"
    >
      <ModeHeader mode={mode} role={role} onRoleChange={setRole} />
      <main id="main-content" className={styles.modeContent}>
        {mode !== "governance" && <RoleFocus role={role} />}
        <ModeBody mode={mode} />
      </main>
    </div>
  );
}

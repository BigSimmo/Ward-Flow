"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { DeclineRegister } from "@/components/ward-management/decline-register";
import { OverrideRegister } from "@/components/ward-management/override-register";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { DeclineEntry, InboxItem, OverrideEntry } from "@/components/ward-management/ward-derivations";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import type { Rejection, Unit } from "@/components/ward-management/ward-model";

import styles from "./coordinator.module.css";
import shortlistStyles from "./shortlist-panel.module.css";

type RegisterTabId = "declines" | "overrides" | "exceptions" | "refused";

/** Order fixed here, not derived — the same reasoning `hub-screen.tsx`'s own `TABS` array
 *  documents: arrow-key order, DOM order and the collapsed-bar's own priority (Exceptions and
 *  Refused actions demand a response; Declines and Overrides are records) all read off this one
 *  list, so it is the single place that decides all three at once. */
const REGISTER_TABS: { id: RegisterTabId; label: string }[] = [
  { id: "declines", label: "Declines" },
  { id: "overrides", label: "Overrides" },
  { id: "exceptions", label: "Exceptions" },
  { id: "refused", label: "Refused" },
];

type ExceptionDrawerProps = {
  items: InboxItem[];
  /** Display-only silence reminders derived from existing referral timestamps. Not inbox facts. */
  silenceReminders?: ReadonlyMap<string, string>;
  /** Transitions the reducer refused (`ward-flow-reducer.ts`'s `reject`), newest first. A
   * refusal is otherwise silent — the reducer returns state with the rejection appended rather
   * than throwing — so this is the one surface that makes a wrong role or a stale action visible
   * to a coordinator instead of swallowing it (Task 5). Rendered even when empty: an empty list
   * still tells a coordinator where to look, rather than leaving the section absent until the
   * first refusal ever happens. */
  rejections: Rejection[];
  /** Task 5: OD-3's unrestricted coordinator read (`allOverrides`) — the array
   *  `coordinator-screen.tsx` used to render as its own full-width row below `.regionGrid`
   *  before this bar absorbed it. Still the same array, still computed the same way; only where
   *  it renders moved. */
  overrides: OverrideEntry[];
  /** Task 5: the coordinator's whole-network decline register (`allDeclines`). See that
   *  function's own comment in `ward-derivations.ts` for why there is no ward-scoped
   *  counterpart to build here, unlike overrides. */
  declines: DeclineEntry[];
  /** Threaded through for `OverrideRegister`/`DeclineRegister`, which resolve a unit id to a
   *  name and carry no scope of their own — see `OverrideRegister`'s own prop comment. */
  units: Unit[];
  now: Instant;
  open: boolean;
  onToggle: () => void;
  onSelectMovement: (movementId: string) => void;
};

/**
 * Task 5 built the coordinator's bottom bar — Declines, Overrides, Exceptions and Refused
 * actions, one collapsed toggle and four tabs behind it, pinned outside `.body`'s own scroll so
 * it never went anywhere. **Task A (structured-wobbling-globe) moves that content out of the
 * bottom bar and into a panel in `.midCol`, directly beneath the Statewide flow diagram, matching
 * the Command mockup's `section.panel.tabsPanel`** — the owner has seen both arrangements and
 * asked for the mockup's. This keeps the exported name (`ExceptionDrawer`) rather than being
 * renamed and re-imported at its one call site, even though "drawer" now only describes what it
 * still is on a phone (see below); the alternative was a rename touching nothing but its own
 * import line, for no reader benefit.
 *
 * ⚠️ **ON A PHONE (below 48rem, where `.diagramRegion` is `display: none` and `FlowDiagram` does
 * not mount) THIS IS STILL A COLLAPSIBLE BAR — `open`/`onToggle` still matter there.** Above
 * 48rem the panel below (`.registersPanel`) is unconditionally visible regardless of `open`
 * (CSS ignores `data-open` outside the phone media query — see `coordinator.module.css`), matching
 * the mockup's own tabsPanel, which has no collapse control at all. Below 48rem the diagram is
 * gone, so "under the diagram" has nothing above it; the registers panel keeps its own collapse
 * there instead, defaulting shut, for the same reason Task 8 built it that way originally —
 * **on a phone, an open registers panel is what stands between a coordinator and Confirm**, and
 * selecting a row must still dismiss it in the same click (`onSelectMovement` below, unchanged).
 * `.exceptionsToggle` is therefore `display: none` above 48rem and restored only inside that one
 * query, rather than removed from the markup — removing it would have meant a second, phone-only
 * render branch here, when a CSS-only visibility swap keeps one tree for every width instead.
 *
 * ⚠️ **THE TOGGLE STILL READS "Registers", NOT "Exceptions".** A bar naming all four registers
 * after only one of them is exactly the kind of claim that stops being true the moment something
 * is added beside it — see `override-register.tsx`'s own file comment on a component that can be
 * asked to misdescribe its own scope. "Exceptions" and "Refused actions" still name their own
 * tabs verbatim, unreworded; only the label for the toggle holding all four needed an honest word
 * of its own.
 *
 * ⚠️ **REFUSALS ARE THEIR OWN TAB, SPLIT OUT OF EXCEPTIONS.** Ruling 2 below already kept their
 * COUNTS separate on the phone toggle, because an action-inbox item and a refusal are different
 * facts a coordinator responds to differently. This carries that same separation one step
 * further, into which panel each renders in, now that the bar holds four registers rather than
 * one.
 *
 * ⚠️ **ALL FOUR TABPANELS STAY MOUNTED AT EVERY WIDTH, NOT ONLY WHILE THE PHONE BAR IS OPEN.**
 * Task 5's original rule was "switching tabs toggles the `hidden` attribute, never the tree,
 * while the bar is open" — moving the panel out from behind a collapse that unmounts its whole
 * branch on every width makes that stronger, not weaker: `.registersPanel` (tab strip and all
 * four `role="tabpanel"` sections) is now unconditionally in the tree, and only its CSS
 * visibility is width- and `open`-dependent. A tab button's `aria-controls` can never dangle,
 * on a phone or off one, because the element it names is always mounted. `board/ward-board.tsx`'s
 * always-mounted detail panel follows the same discipline for the same reason.
 *
 * Ruling 2: each panel renders exactly what its own derivation returns — never an invented
 * category. The Exceptions tab in particular says, in its own words, that it detects three of the
 * spec's six exception categories; see that panel's own note below rather than fixing the gap
 * here, which is a separate, unauthorised task.
 *
 * Ruling 3: every tab's own count is the length of the exact array its panel renders — never a
 * number computed independently of what actually shows there (the "48 open movements" defect in
 * miniature is a header count that disagrees with the rows beneath it). The four counts on the
 * phone-only collapsed toggle (below, owner ruling 2026-09-07) are held to the same rule: each is
 * the same `.length` read that feeds its tab label, just rendered a second place. The new
 * persistent refusal marker in `coordinator-screen.tsx`'s governance banner (Task A) reads the
 * same `rejections.length` a third place, for the same reason — see that file's own comment.
 */
function commandInboxTitle(item: InboxItem): string {
  if (item.id.startsWith("bed-pull-") || item.title === "Bed pull expired") {
    return "Reserved time has passed, bed still held";
  }
  return item.title;
}

export function ExceptionDrawer({
  items,
  silenceReminders,
  rejections,
  overrides,
  declines,
  units,
  now,
  open,
  onToggle,
  onSelectMovement,
}: ExceptionDrawerProps) {
  // Task A: this component's whole tree is now always mounted (nothing here unmounts on `open`
  // any more), so this state simply survives for the page's lifetime — the last tab a coordinator
  // was reading stays selected across a phone collapse and reopen, the same "remember what was
  // open" courtesy `hub-screen.tsx`'s own kind filter gives its own tabs.
  const [activeTab, setActiveTab] = useState<RegisterTabId>("exceptions");
  // Owner, 26 Sept 2026: resolves a silence reminder's bare movement id to the patient's name.
  const resolvePatientIdentity = usePatientOf();

  // Newest first: `rejections` is appended to in raise order, so the array itself reads oldest
  // first — a coordinator wants to see what just got refused, not what got refused first today.
  const refusalsNewestFirst = [...rejections].reverse();

  // Escape key listener for accessible drawer/dialog dismissal
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onToggle();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onToggle]);

  const countFor: Record<RegisterTabId, number> = {
    declines: declines.length,
    overrides: overrides.length,
    exceptions: items.length,
    refused: rejections.length,
  };
  const inboxMovementIds = new Set(items.map((item) => item.movementId));
  const unmatchedSilence = [...(silenceReminders?.entries() ?? [])].filter(
    ([movementId]) => !inboxMovementIds.has(movementId),
  );

  /**
   * Left/Right (and Home/End) move between the four register tabs and select as they go — the
   * same `role="tablist"` promise and the same "moving costs nothing, so a second keypress to
   * confirm would only be slower than the mouse" reasoning `hub-screen.tsx`'s own `onTabsKeyDown`
   * documents for its kind filter.
   */
  function onTabsKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const order = REGISTER_TABS.map((tab) => tab.id);
    const current = order.indexOf(activeTab);
    let next = -1;
    if (event.key === "ArrowRight") next = (current + 1) % order.length;
    if (event.key === "ArrowLeft") next = (current - 1 + order.length) % order.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = order.length - 1;
    if (next === -1) return;
    event.preventDefault();
    const target = order[next];
    if (target === undefined) return;
    setActiveTab(target);
    // Focus follows selection, so the next arrow key continues from where the reader just landed.
    const el = event.currentTarget.querySelector<HTMLButtonElement>(`[data-register-tab="${target}"]`);
    el?.focus();
  }

  return (
    <section
      className={styles.registersRegion}
      aria-label="Declines, overrides and exceptions"
      data-testid="ward-coordinator-registers"
    >
      {/*
        Task A: phone-only now (`.exceptionsToggle` is `display: none` from 48rem up — see
        coordinator.module.css). Above 48rem the panel below is unconditionally visible and this
        button is not rendered visibly at all, so nothing here needs to "do something" at that
        width beyond what it already does — a hidden control is not a dead one, it is a control
        for a width this reader is not currently at.
      */}
      <button
        type="button"
        className={`${styles.exceptionsToggle} ${shortlistStyles.drawerToggleTouch}`}
        aria-expanded={open}
        aria-controls="ward-coordinator-registers-panel"
        onClick={onToggle}
      >
        {open ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
        <span id="ward-exceptions-toggle-label">Today’s answers</span>
        {/*
          Owner ruling, 2026-09-07 ("yes do the four counts"): the override register used to sit
          openly on the page, below the statewide flow, before Task 5 folded all four registers
          behind this one collapsed toggle. That fold made the screen honestly emptier — nothing
          here announced Declines, Overrides or Refused actions unless a coordinator opened the
          bar first, and Task 5's own comment (kept below in spirit, corrected here) reasoned that
          four counts would crowd the bar and so kept only two. The owner looked at the resulting
          screen and asked for all four back. They render here, on the CLOSED (phone) bar, in the
          same left-to-right order `REGISTER_TABS` fixes for the tabs behind it — each one still
          the exact `.length` of the array its own tabpanel below renders (Ruling 3), never a
          number computed apart from it, and never merged with a neighbour: an override and a
          decline are different facts a coordinator responds to differently, same reasoning that
          already kept the refused-actions count separate from exceptions. Above 48rem the same
          four counts are always visible a different way — the tab strip below never hides behind
          this toggle at all — so this group's job is specifically the phone-collapsed state.
        */}
        <span className={styles.exceptionsToggleCounts}>
          <span
            className={`${styles.exceptionsToggleRecordCount} ${shortlistStyles.tabularNum}`}
            data-testid="ward-exceptions-toggle-decline-count"
          >
            {declines.length === 1 ? "1 decline" : `${declines.length} declines`}
          </span>
          <span
            className={`${styles.exceptionsToggleRecordCount} ${shortlistStyles.tabularNum}`}
            data-testid="ward-exceptions-toggle-override-count"
          >
            {overrides.length === 0
              ? "No overrides"
              : overrides.length === 1
                ? "1 override"
                : `${overrides.length} overrides`}
          </span>
          <span
            className={`${styles.exceptionsToggleCount} ${shortlistStyles.tabularNum}`}
            data-testid="ward-exceptions-toggle-count"
          >
            {items.length === 1 ? "1 exception" : `${items.length} exceptions`}
          </span>
          {/* Whole-branch review I4 established that a refusal filed while this bar was SHUT
              changed nothing on screen — a refused PULL_PATIENT on a ward with no allocatable bed
              was invisible — so the refusals figure must live outside the `open` branch. It still
              does.

              ⚠️ IT WAS ALSO CONDITIONAL ON `rejections.length > 0`, AND THAT NO LONGER HOLDS.
              That was correct when it was a lone alarm badge beside a single exceptions count:
              nothing extra until the first refusal, then never silent again. It became wrong the
              moment the bar carried four peer counts. The owner asked to see four and saw three,
              because the fixture has no refusals — while "0 overrides" sat right beside it.

              The comment this replaces argued the case against itself: it said "0 declines" is
              itself the answer to "are there any", and that hiding it would make an empty register
              indistinguishable from one that was never counted. Both sentences are just as true of
              refusals. So all four now render at every value.

              The TONE stays conditional, which is the part of the original that survives: danger
              styling only once there is something to be alarmed about, so a quiet bar reads quiet
              while still answering the question. */}
          <span
            className={`${rejections.length > 0 ? styles.exceptionsToggleRefusalCount : styles.exceptionsToggleRecordCount} ${shortlistStyles.tabularNum}`}
            data-testid="ward-exceptions-toggle-refusal-count"
            title={`${rejections.length} refused action${rejections.length === 1 ? "" : "s"}`}
          >
            {rejections.length === 1 ? "1 refused" : `${rejections.length} refused`}
          </span>
        </span>
      </button>
      {/*
        Task A: no longer gated on `open`. Above 48rem this is unconditionally visible — CSS
        ignores `data-open` outside the phone media query (coordinator.module.css) — matching the
        mockup's own tabsPanel, which has no collapse control at all. Below 48rem `data-open`
        drives a plain `display: none`, not an unmount, which is what keeps every tab's
        `aria-controls` resolving to a real element at every width (see this file's own header
        comment).
      */}
      <div
        id="ward-coordinator-registers-panel"
        className={styles.registersPanel}
        data-open={open}
        role="region"
        aria-labelledby="ward-exceptions-toggle-label"
      >
        <div className={styles.registersTabs} role="tablist" aria-label="Today’s answers" onKeyDown={onTabsKeyDown}>
          {REGISTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`ward-register-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`ward-register-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              data-register-tab={tab.id}
              className={`${activeTab === tab.id ? styles.registerTabActive : styles.registerTab} ${shortlistStyles.drawerTabTouch}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}{" "}
              <span className={`${styles.registerTabCount} ${shortlistStyles.tabularNum}`}>{countFor[tab.id]}</span>
            </button>
          ))}
        </div>

        <section
          role="tabpanel"
          id="ward-register-panel-declines"
          aria-label="Declines"
          hidden={activeTab !== "declines"}
          className={styles.registerPanelBody}
          data-testid="ward-coordinator-decline-register"
        >
          <header className={styles.regionHeader}>
            <h2>Declines</h2>
            <span className={`${styles.regionCount} ${shortlistStyles.tabularNum}`}>
              {declines.length === 1 ? "1 decline" : `${declines.length} declines`}
            </span>
          </header>
          <DeclineRegister entries={declines} units={units} now={now} />
        </section>

        {/*
          Task 5: moved here verbatim from `coordinator-screen.tsx`, which used to render this
          exact heading, count and register as its own full-width row below `.regionGrid` — see
          this file's own header comment for why the heading text ("Override register") is kept
          unreworded even though the tab button beside it, above, reads the shorter "Overrides".
        */}
        <section
          role="tabpanel"
          id="ward-register-panel-overrides"
          // The unreworded heading, not the shorter tab label beside it — see this section's own
          // comment above.
          aria-label="Override register"
          hidden={activeTab !== "overrides"}
          className={styles.registerPanelBody}
          data-testid="ward-coordinator-override-register"
        >
          <header className={styles.regionHeader}>
            <h2>Override register</h2>
            <span className={`${styles.regionCount} ${shortlistStyles.tabularNum}`}>
              {overrides.length === 1 ? "1 override" : `${overrides.length} overrides`}
            </span>
          </header>
          <OverrideRegister entries={overrides} units={units} now={now} />
        </section>

        <section
          role="tabpanel"
          id="ward-register-panel-exceptions"
          aria-label="Exceptions"
          hidden={activeTab !== "exceptions"}
          className={styles.registerPanelBody}
        >
          {items.length === 0 ? (
            <p className={styles.placeholder}>No exceptions right now.</p>
          ) : (
            <ul className={styles.exceptionsList}>
              {items.map((item) => {
                const Icon = item.icon;
                const silenceCopy = silenceReminders?.get(item.movementId);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      data-testid={`ward-exception-${item.id}`}
                      data-tone={item.tone}
                      className={`${styles.exceptionRow} ${shortlistStyles.exceptionRowTouch}`}
                      onClick={() => onSelectMovement(item.movementId)}
                    >
                      <Icon
                        aria-hidden="true"
                        className={item.tone === "danger" ? styles.exceptionIconDanger : styles.exceptionIconWarning}
                      />
                      <span className={styles.exceptionRowBody}>
                        <span className={shortlistStyles.exceptionHeaderRow}>
                          <span className={styles.exceptionTitle}>{commandInboxTitle(item)}</span>
                          <span className={shortlistStyles.toneBadge} data-tone={item.tone}>
                            {item.tone === "danger" ? "Critical" : "Warning"}
                          </span>
                        </span>
                        <span className={styles.exceptionMeta}>
                          <span className={styles.exceptionDetail}>{item.detail}</span>
                          <span className={styles.exceptionOwnerDivider} aria-hidden="true">
                            ·
                          </span>
                          <span className={styles.exceptionOwner}>{item.owner}</span>
                        </span>
                        {silenceCopy !== undefined ? (
                          <span className={styles.exceptionReminder} data-testid={`ward-exception-silence-${item.id}`}>
                            {silenceCopy}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {unmatchedSilence.length > 0 ? (
            <ul className={styles.exceptionsList} data-testid="ward-silence-reminders">
              {unmatchedSilence.map(([movementId, copy]) => {
                // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
                const silenceWho = resolvePatientIdentity({ movementId }).displayName;
                return (
                  <li key={movementId}>
                    <button
                      type="button"
                      className={`${styles.exceptionRow} ${shortlistStyles.exceptionRowTouch}`}
                      onClick={() => onSelectMovement(movementId)}
                      data-testid={`ward-silence-reminder-${movementId}`}
                    >
                      <span className={styles.exceptionRowBody}>
                        <span className={styles.exceptionTitle}>{silenceWho}</span>
                        <span className={styles.exceptionReminder}>{copy}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>

        <section
          role="tabpanel"
          id="ward-register-panel-refused"
          aria-label="Refused"
          hidden={activeTab !== "refused"}
          className={styles.registerPanelBody}
          data-testid="ward-refusals"
        >
          <h3 className={styles.refusalsHeading}>Refused</h3>
          {refusalsNewestFirst.length === 0 ? (
            <p className={styles.placeholder}>No refused actions recorded yet.</p>
          ) : (
            <ul className={styles.refusalsList}>
              {refusalsNewestFirst.map((rejection) => (
                <li key={rejection.id} data-testid={`ward-refusal-${rejection.id}`} className={styles.refusalRow}>
                  <span className={styles.refusalAttempt}>{rejection.attempted}</span>
                  <span className={styles.refusalReason}>{rejection.reason}</span>
                  <span className={`${styles.refusalAt} ${shortlistStyles.tabularTimestamp}`}>
                    {formatInstantWithDay(rejection.at, now)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}

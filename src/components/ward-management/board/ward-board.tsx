"use client";

import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { WardNotFoundBody } from "@/components/ward-management/shell/ward-not-found";
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import Link from "next/link";
import { PhoneSheet, useIsPhone, useModalFocus } from "@/components/wf";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

import {
  admissionsForUnit,
  LEAVING_DESTINATIONS,
  type LeavingDestination,
} from "@/components/ward-management/ward-admissions";
import { bedsPendingPreparation, capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import {
  arrowTargets,
  constraintSentence,
  headlineAvailable,
  sinceYesterday,
} from "@/components/ward-management/ward-board-derivations";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { shiftEndInstant } from "@/components/ward-management/ward-board-time-features";
import { patientIdentityLine, resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { useWardFlowClock, useWardFlowSelect, useWardNetwork } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import { derivedBedReleases } from "@/components/ward-management/ward-discharge-dates";
import { CAPACITY_FIGURE_LABELS } from "@/components/ward-management/ward-morning-rollup";
import { confirmedHeldUpNote } from "@/components/ward-management/capacity/capacity-derivations";
import { unitHref, wardBoardHref } from "@/components/ward-management/shell/ward-facade";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { BED_RELEASE_BLOCKERS, type BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";

import { asAtStamp } from "./ward-daily-sheet";
import { StrandedPrompts, WardForecastShare } from "./stranded-prompts";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import styles from "./board.module.css";
import { useActionToast, useTaggedToast } from "@/components/ward-management/use-action-toast";
import { TransportExceptionDialog } from "@/components/ward-management/transport-exception-dialog";
import { arrivalGaps } from "@/components/ward-management/ward-transport-checks";
import type { TransportExceptionReason } from "@/components/ward-management/ward-model";
import {
  FLOW_TABS,
  boardArrivalAllowed,
  buildIncoming,
  buildOccupants,
  buildTiles,
  findUnit,
  movementForBoardArrival,
  outgoingToday,
  tileDomId,
  type BoardFilter,
  type BoardOrder,
  type FlowTab,
  type OutgoingBasis,
  type ShiftTileItem,
  type Tile,
} from "./ward-board-model";
import { WardBoardHeader } from "./ward-board-header";
import { WardBoardFlowColumn } from "./ward-board-flow-column";
import { WardBoardGridColumn } from "./ward-board-grid-column";
import { LeavingDestinationField, WardBoardDetailPanel } from "./ward-board-detail-panel";
import { WardBoardWorkBand } from "./ward-board-work-band";
import { WardBoardPrintSections } from "./ward-board-print-sections";
import { SAVE_NOT_CONFIRMED, saveProblem } from "@/components/ward-management/ward-save-failure";
import { refusalReasonText } from "@/components/ward-management/ward-refusal-words";
export { boardArrivalAllowed, movementForBoardArrival } from "./ward-board-model";

/**
 * The line that leads an occupied /board card. A recorded bed number comes first (Josh, 21 Oct
 * 2026), then surname and given name in full (D-83), because synthetic seeds reuse surnames and
 * so do real wards. Nothing recorded gives an empty string, and the card shows no line. Never invents a bed.
 */
export function boardCardLine(
  bedNumber: number | undefined,
  patient: { familyName: string; givenName: string } | null | undefined,
): string {
  const bed = bedNumber === undefined ? null : `Bed ${bedNumber}`;
  const given = patient?.givenName.trim();
  const name = patient ? (given ? `${patient.familyName}, ${given}` : patient.familyName) : null;
  return [bed, name].filter((part) => part !== null).join(" · ");
}

/**
 * The ward board, first pass: one ward's beds on a screen.
 *
 * **The deliverable is the rendered page, not the test.** This pass is deliberately the ugly
 * version — one component, one stylesheet, no decomposition — because every defect that has
 * reached a screen in this feature was found by rendering it and looking, and none of them were
 * found by a test. Polish is a later pass; being LOOKABLE is this one.
 *
 * Three rules govern what is below, each of which this prototype has broken before:
 *
 *   1. **Colour never carries a fact alone.** The stay band sets a fill shade, and the day count
 *      is printed on the same tile in text. The number IS the band (the bands are ranges of that
 *      one number), so a greyscale print, a colour-blind reader, or forced-colors mode loses
 *      nothing. The same applies to the past-expected-date marker: a heavy outline AND the words
 *      "past date".
 *   2. **A pulled-but-not-arrived bed is OCCUPIED.** The ward gave the bed away at the pull; the
 *      person may still be in an emergency department. `bedIsOccupied` already says so and this
 *      component must never re-decide it — such a tile renders as taken, reading "empty, waiting"
 *      instead of a day count, and is never drawn as a free bed.
 *   3. **No figure from the Mental Health Act, and no free text about anybody.** Every word on a
 *      tile comes from `STAY_BANDS` (the product owner's four, verbatim) or from a day count.
 *      Nothing here is a threshold, a target, or a legal clock.
 *
 * **It reads the shared ward-flow provider, like every other screen.** Owner decision 2026-09-01,
 * restoring DB-11 (2026-08-29, "the frozen view is dropped, everything is live") which a later
 * fixed-board decision had contradicted while both sat in this file at once.
 *
 * The refusal recorded here previously was that making the board live means re-anchoring the
 * admissions fixture, and `shiftInstants` is not idempotent — a second applier would double every
 * stay length, so nine days in a bed would read as eighteen. **Taking the provider's state is
 * precisely what avoids that**, rather than what risks it: `seedWardFlowStateAt` is the only door,
 * it seeds and shifts in ONE step, and `state.admissions` is therefore shifted exactly once. This
 * board now consumes an already-correct list instead of applying a second offset of its own.
 */

export function WardBoard({
  unitId,
  requireConfirmation = process.env.NODE_ENV !== "test",
}: {
  unitId: string;
  requireConfirmation?: boolean;
}) {
  // Live state, on the same terms as every other screen. Named `liveUnits` only because `unit`
  // below is the one this board is about; `now` and `admissions` keep their names so every
  // derivation beneath reads unchanged.
  const network = useWardNetwork();
  const {
    units: liveUnits,
    admissions,
    leaveBeds,
    recordWardDeparture,
    movements,
    bedReleases: liveBedReleases,
    patients,
    // The ward-scoped identity projection, never the full referral array: a ward-only screen must
    // not reach a referral's other destinations (ward-referral-screen-boundary). Older provider
    // adapters without it fall back to patient and movement links only.
    resolvePatientIdentity,
    rejections,
    dayZero,
    dispatch,
  } = useWardFlowSelect(
    "units",
    "admissions",
    "leaveBeds",
    "recordWardDeparture",
    "movements",
    "bedReleases",
    "patients",
    "resolvePatientIdentity",
    "rejections",
    "dayZero",
    "dispatch",
  );
  const now = useWardFlowClock();
  // D-80: a site bed manager blocks a release in its own name; the scope check keeps it to its wards.
  const raise = useWardRaise(useRouteRole() === "bed_manager" ? "bed_manager" : "ward");
  const [blockerDialogItem, setBlockerDialogItem] = useState<ShiftTileItem | null>(null);
  const [selectedBlocker, setSelectedBlocker] = useState<BedReleaseBlocker>(BED_RELEASE_BLOCKERS[0]);
  // Audit r1 item 4: an arrival with no transport leg and fit to travel open, waiting on a reason.
  const [arriveCheck, setArriveCheck] = useState<{ movementId: string; who: string } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    kind: "leaving" | "away_at_ed";
    who: string;
    /** The second identifier the confirmation shows: formal name, UMRN and bed (design audit DA-08). */
    identity?: string;
    item?: ShiftTileItem;
    admissionId?: string;
  } | null>(null);
  const dialogTriggerRef = useRef<HTMLElement | null>(null);
  const blockerDialogRef = useRef<HTMLDivElement | null>(null);
  const blockerCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const confirmDialogRef = useRef<HTMLDivElement | null>(null);
  const confirmCloseBtnRef = useRef<HTMLButtonElement | null>(null);

  const closeConfirmDialog = useCallback(() => {
    setPendingConfirm(null);
  }, []);

  const closeBlockerDialog = useCallback(() => {
    setBlockerDialogItem(null);
  }, []);

  // Both dialogs follow the shared modal contract: the page behind is inert and held still, focus
  // starts on the close button, Tab wraps inside, Escape closes only the dialog (handled first, so
  // the board's own Escape for the slide-out never also fires), and focus returns to the trigger.
  useModalFocus({
    open: pendingConfirm !== null,
    onClose: closeConfirmDialog,
    panelRef: confirmDialogRef,
    initialFocusRef: confirmCloseBtnRef,
    returnFocusRef: dialogTriggerRef,
    focusOnOpen: "immediate",
    keyPhase: "capture",
  });
  useModalFocus({
    open: blockerDialogItem !== null,
    onClose: closeBlockerDialog,
    panelRef: blockerDialogRef,
    initialFocusRef: blockerCloseBtnRef,
    returnFocusRef: dialogTriggerRef,
    focusOnOpen: "immediate",
    keyPhase: "capture",
  });
  // Item 44, build plan task G2 (§2 "Bed board, ward page and all seven statistics screens: a
  // sentence only."). A hook, so it is read unconditionally, before the "unknown unit" early
  // return further down.
  const service = useServiceScope();

  /*
   * SELECTION, and the one thing it is allowed to mean.
   *
   * The product owner has overruled the decision recorded at 281bdf83f, which built the people
   * panel as a list with no selection at all; that call was his to make and this is it. What that
   * commit's reasoning STILL binds is the part about identity: an `Admission` records the ward and
   * NEVER a bed, so a tile carries no bed identity and nothing here may number a tile, call it
   * "Bed 7", or let the grid read as a floor plan. The recorded order is seed order; the board's
   * ordering control changes only presentation and never turns that order into a location.
   *
   * Selection is therefore honest in exactly one direction. An occupied or waiting tile stands for
   * a PERSON, and `selectedKey` holds that person's admission id, which is a real handle on a real
   * record. A blocked, closed or empty tile stands for no particular bed — those tiles are counts
   * drawn somewhere rather than locations — so selecting one shows what the ward records about
   * that CLASS of bed and says, on the panel, that which bed is not recorded.
   *
   * Held as a key rather than an index so a re-render cannot slide the selection onto a different
   * person, and so nothing in this component ever has an ordinal to print.
   */
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const isPhone = useIsPhone();
  const [dateEdit, setDateEdit] = useState<{
    admissionId: string;
    time: string;
    day: "recorded" | "today" | "tomorrow";
  } | null>(null);
  /*
   * Audit CS3-07 (26 Oct 2026, replacing the earlier first-option default): where a person went
   * starts blank and must be chosen. The first option also counts as a statewide release, so a
   * default recorded it unseen, and the shift row's "They have left" had no picker at all. A choice
   * belongs to the person it was made for, so it never carries to the next one.
   */
  const [leavingChoice, setLeavingChoice] = useState<{ admissionId: string; destination: LeavingDestination } | null>(
    null,
  );
  const destinationFor = (admissionId: string | undefined): LeavingDestination | "" =>
    leavingChoice !== null && leavingChoice.admissionId === admissionId ? leavingChoice.destination : "";
  /*
   * Which of the two outgoing figures the "Going out today" list is built from. The toggle changes
   * what the board EMPHASISES; it hides no figure — all ten stay on the ward band in every state,
   * because a control that can remove the blocked-releases figure from a coordinator's screen is a
   * control that can hide the thing they most need to chase.
   */
  const [outgoingBasis, setOutgoingBasis] = useState<OutgoingBasis>("confirmed");
  const [bedFilter, setBedFilter] = useState<BoardFilter>("all");
  const [bedOrder, setBedOrder] = useState<BoardOrder>("stay");
  const [flowTab, setFlowTab] = useState<FlowTab>("outgoing");
  /*
   * Whether the printed sheet is shown on screen. Closed by default: it repeats the board's own
   * panels, which is why it moved down here, and a reader who wants it is one click away.
   *
   * A `<details>` element was the obvious choice and is the wrong one. The browser hides a closed
   * `details`' content through its own UA stylesheet, and no print rule reliably forces it open —
   * so the handover sheet would have printed as one line of summary text and a blank page. A
   * button plus a class the print stylesheet can override keeps the paper correct, which is the
   * half that matters most: the sheet exists to be printed.
   */
  const [sheetOpen, setSheetOpen] = useState(false);
  // Phone: Needs you opens on its first three items (device audit, 11 Oct 2026).
  const [shiftExpanded, setShiftExpanded] = useState(false);
  useEffect(() => {
    if (!sheetOpen) return;
    const timer = window.setTimeout(() => {
      const target = document.getElementById("ward-board-daily-sheet") || document.getElementById("ward-daily-sheet");
      target?.scrollIntoView({ behavior: wardScrollBehavior(), block: "start" });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [sheetOpen]);
  // A refusal stays until it is closed (CT-09); the shared toast region is the one place it is read.
  const setToastMessage = useActionToast({ testId: "ward-board-toast" });
  const boardToast = useTaggedToast("ward-board-toast");

  /*
   * Walkthrough D12 (25 Sept 2026): the board announced success without checking whether the
   * reducer refused. Real commands now return their own terminal outcome, including shared saves.
   * Standalone legacy dispatchers still compare their local refusal count on the next render.
   */
  const outcomeCheckRef = useRef<{
    prior: number;
    success: string;
    outcome?: WardCommandOutcome;
  } | null>(null);
  const [outcomeToken, setOutcomeToken] = useState(0);
  // `record` makes the dispatch itself, with a literal event type at the call site, so every
  // dispatch stays readable to the override-surfaces guard; this only brackets it with the check.
  // H-0371 (D-83, Josh 27 Oct 2026): the screen reader hears the toast's own words, the patient's
  // name included, as Handover and ED already say it: the shared toast region reads them once.
  const dispatchAndReport = useCallback(
    (record: () => ReturnType<WardCommandDispatch>, success: string) => {
      const check = { prior: rejections.length, success };
      const result = record();
      if (result && "then" in result) {
        void result.then((outcome) => {
          outcomeCheckRef.current = { ...check, outcome };
          setOutcomeToken((token) => token + 1);
        });
      } else {
        outcomeCheckRef.current = result ? { ...check, outcome: result } : check;
        setOutcomeToken((token) => token + 1);
      }
    },
    [rejections.length],
  );
  const { runRecorded: runDeparture } = useUndoableStep({
    dispatch,
    rejections,
    now,
    routeRole: "ward",
    toast: boardToast,
    onMessage: (message, tone) => setToastMessage(tone === "warning" ? { warning: message } : message),
  });
  const recordDepartureAndReport = (
    record: () => ReturnType<WardCommandDispatch>,
    success: string,
    admissionId: string,
  ) => {
    setLeavingChoice(null);
    return runDeparture(record, {
      success,
      undo: (at) => ({ type: "UNDO_DEPARTURE", role: "ward", now: at, admissionId, actingUnitId: unit.id }),
      undone: "Departure undone. This patient is back on the ward.",
    });
  };
  const confirmBoardArrival = (movementId: string, who: string, reason?: TransportExceptionReason) => {
    const movement = movements.find((candidate) => candidate.id === movementId);
    dispatchAndReport(
      () =>
        raise("PATIENT_ARRIVED", {
          movementId,
          actingUnitId: unit.id,
          ...(reason && movement ? { exception: { gaps: arrivalGaps(movement), reason } } : {}),
        }),
      `Patient arrived: ${who} confirmed on the ward.`,
    );
  };
  useEffect(() => {
    const check = outcomeCheckRef.current;
    if (outcomeToken === 0 || check === null) return;
    outcomeCheckRef.current = null;
    const refused = check.outcome
      ? undefined
      : rejections.length > check.prior
        ? rejections[rejections.length - 1]
        : undefined;
    const unaccepted = check.outcome && check.outcome.status !== "accepted";
    const msg = unaccepted
      ? check.outcome!.status === "refused"
        ? `Action refused: ${check.outcome!.message ? refusalReasonText(check.outcome!.message) : "The action was refused."}`
        : (check.outcome!.message ?? SAVE_NOT_CONFIRMED)
      : refused
        ? `Not recorded: ${refusalReasonText(refused.reason)}. Nothing was changed.`
        : check.success;
    setToastMessage(refused || unaccepted ? { warning: msg } : msg);
  }, [outcomeToken, rejections, setToastMessage]);
  /*
   * The tile to hand focus back to once the slide-out closes.
   *
   * A REF rather than a second piece of state, and the distinction is not cosmetic. The focus call
   * has to happen after React has committed the render that removed the panel — inside the click
   * handler it would move focus and then have it undone by the commit — but a state variable
   * written from inside that effect is a cascading render, which `react-hooks/set-state-in-effect`
   * fails the build on and which is right: nothing about "which control to focus" is part of what
   * this component renders. So the ref is set in the handler, read once after the close has
   * committed, and cleared without re-rendering anything.
   */
  const focusBackTo = useRef<string | null>(null);

  useEffect(() => {
    if (selectedKey !== null) return;
    const key = focusBackTo.current;
    if (key === null) return;
    focusBackTo.current = null;
    document.getElementById(tileDomId(key))?.focus();
  }, [selectedKey]);

  const closeDetail = useCallback(() => {
    focusBackTo.current = selectedKey;
    setSelectedKey(null);
    setDateEdit(null);
  }, [selectedKey]);

  /* Escape closes the slide-out from anywhere inside the board's three zones — the tiles and the
   * panel itself — and focus returns to the tile that opened it. Bound to the zones container
   * rather than to `window` so this board never intercepts a key press meant for something else on
   * the page, and NOT a focus trap: Tab continues out of the panel into the rest of the page,
   * because the panel is not modal and does not cover what it describes. */
  const onZoneKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Escape") return;
      // The phone sheet is portalled out of the zones but its events still bubble here through
      // React. It runs its own Escape (which spares an open select), so leave those to it.
      if (!event.currentTarget.contains(event.target as Node)) return;
      event.stopPropagation();
      closeDetail();
    },
    [closeDetail],
  );

  const found = findUnit(unitId, liveUnits, network.sites);
  if (found === undefined) {
    // Task A: a "Ward not found" page with no per-screen navigation mount was a dead end — there
    // was no way back to anything else in Ward Flow from it. Every other dynamic-route screen
    // used to mount the rail in BOTH its return branches (see `ed-screen.tsx`'s own not-found
    // branch) to fix that, one screen at a time.
    //
    // Task 8, 2026-09-11: neither branch mounts it directly any more. The third-edition rail
    // (`shell/ward-rail.tsx`) mounts once in `src/app/ward-flow/layout.tsx`, an ancestor
    // of this route regardless of which branch below runs, so this dead end stays fixed for free
    // rather than depending on this file (or any other) remembering to mount it twice.
    return (
      <div className={styles.screen} data-testid="ward-board-unknown-unit" data-ward-design="third-edition">
        <main id="main-content" className={styles.main}>
          <WardNotFoundBody title="Ward not found" list={{ href: "/ward-flow/wards", label: "All wards" }}>
            No ward matches this link. It never falls back to a different ward.
          </WardNotFoundBody>
        </main>
      </div>
    );
  }

  const { unit, site } = found;
  /*
   * Derived from the same admissions this page draws, so the header cannot disagree with the tiles
   * about who is in a bed.
   *
   * 🔴 **THE LAST SENTENCE HERE USED TO SAY "no leave beds are modelled on this board, and no
   * leave figure is rendered from them", AND THE SECOND HALF WAS FALSE.** `leaveBeds` was
   * `[] as const`. Two of the three derivations it feeds genuinely never read it —
   * `headlineAvailable` and `constraintSentence` both reduced to `capacityBreakdown(...).availableNow`
   * then (the headline now reads `readyBedsNow`, Audit 6). **But `capacityBreakdown` also returns `onLeave`, computed as
   * `leave.filter((bed) => bed.unitId === unit.id).length`, and this board renders it as a labelled
   * figure.** So the board announced **On leave: 0** on every ward, always.
   *
   * ⚠️ **It was wrong the day it was written, not merely wrong for data that did not exist yet.**
   * The seed carries two leave beds — `WL-001` on `rph-adult-secure`, `WL-002` on `scgh-older-adult`
   * — so two real wards printed a figure contradicted by the state this page was already holding.
   * **The absence was in an ARGUMENT rather than on the page**, which is why every wording rule this
   * project has written was blind to it (owner ruling D-23).
   *
   * The leave beds now come from the provider, the same live state every other screen reads.
   */
  const bedReleases = derivedBedReleases([...admissions], now);

  const available = headlineAvailable(unit, admissions, bedReleases, [...leaveBeds], now);
  // 🔴 THE FIGURE ABOVE IS CORRECT AND MUST NOT CHANGE. `availableNow` deliberately subtracts
  // nothing for a preparation note: asked in September whether a bed being cleaned should drop the
  // ward's number or merely refuse the pull, the owner chose the refusal, because the ward has not
  // changed what it can staff and its figures must not lurch as cleaning starts and stops. So the
  // defect this closes was never a wrong number — it was a correct number printed without the
  // sentence that makes it safe to act on, while the reducer refuses PULL_PATIENT with "every free
  // bed at X is still being made ready". Do not reach for the subtraction; it looks like the honest
  // fix and would silently reverse an owner ruling with every test still green.
  // Walkthrough D7 (25 Sept 2026): read the LIVE releases, because a preparation note is recorded
  // on a release in state; the rebuilt list above never carries one, so "being cleaned" never showed.
  const pendingPreparation = bedsPendingPreparation(unit.id, [...(liveBedReleases ?? [])]);
  const constraint = constraintSentence(unit, admissions, bedReleases, [...leaveBeds], now);
  const tiles = buildTiles(unit, admissions, bedReleases, now);
  // Read straight back out, purely to say how many closed tiles are on screen in the footnote below
  // — never re-derived. `buildTiles` already clamped this into the physically-empty pool; the
  // footnote must describe exactly what got drawn, not a second, unclamped copy of the figure.
  const closedTileCount = tiles.filter((tile) => tile.kind === "closed").length;

  /*
   * Scoped to THIS unit with the same helper `buildTiles` uses, so the panel and the grid can
   * never disagree about who is in a bed.
   *
   * **Written first as `arrowTargets(admissions, now)` and caught by rendering the page, not by a
   * test.** `admissions` is the whole network's 267 records, so the panel read every ward in the
   * state: it offered "Kimberley 28 people" on a twenty-bed ward and totalled about 180 against
   * eighteen occupants. Nothing failed — `arrowTargets` was correct and its nine assertions still
   * passed, because the defect was in the CALL and every one of them supplies its own admissions.
   * A derivation's tests cannot see a caller handing it the wrong set.
   */
  const targets = arrowTargets(admissionsForUnit(admissions, unit.id), now);
  /* Scoped inside `buildOccupants` with the same `admissionsForUnit(...)` + `bedIsOccupied` pair
   * `buildTiles` uses — see that function's own comment for the defect this prevents. */
  const occupants = buildOccupants(unit, admissions, now);
  /** The person's name for a board message, never their admission id (walkthrough D10). */
  const nameFor = (admissionId: string | undefined): string => {
    const admission = admissions.find((a) => a.id === admissionId);
    const subject = admission ?? { id: admissionId };
    const resolved = resolvePatientIdentity
      ? resolvePatientIdentity(subject)
      : resolveSubjectPatient(subject, { patients, movements });
    return resolved.patient ? resolved.displayName : "the patient (name not recorded)";
  };
  /** Design audit DA-08: a departure is confirmed against a second identifier, not the name alone. */
  const identityFor = (admissionId: string | undefined): string | undefined => {
    const admission = admissions.find((a) => a.id === admissionId);
    if (!admission) return undefined;
    const resolved = resolvePatientIdentity
      ? resolvePatientIdentity(admission)
      : resolveSubjectPatient(admission, { patients, movements });
    if (!resolved.patient) return undefined;
    return `${patientIdentityLine(resolved)}${admission.bedNumber === undefined ? "" : ` · Bed ${admission.bedNumber}`}`;
  };

  /*
   * THE WARD BAND'S TEN FIGURES, scoped to this one ward. The six canonical capacity figures stay
   * intact; four counts already visible elsewhere on this board join them so the band can support
   * the same rapid scan as the drawing without inventing a new fact.
   *
   * `capacityBreakdown` is the same function the morning page's ward-level rollup calls, given this
   * unit and the releases these admissions imply — so the board's bar and the home page's cards are
   * one arithmetic, not two. The labels come from `CAPACITY_FIGURE_LABELS`, the single vocabulary
   * spec D3/D14 requires to be identical at service, hospital and ward level; the words are never
   * retyped here, which is what stops this board drifting from the home page's.
   *
   * Ready here is `states.ready` (`readyBedsNow`, as the header prints), NOT `breakdown.availableNow`,
   * which still counts a bed pulled for an incoming patient (NA3-09, audit 26 Oct 2026).
   */
  const breakdown = capacityBreakdown(unit, [...bedReleases], [...leaveBeds], now);
  // The ruled Closed figure (`ward-bed-states.ts`), the same call `buildTiles` draws its closed
  // tiles from. `breakdown.held` is NOT this figure: it still counts a live pull's empty bed.
  const states = bedStates(unit, admissions, [...bedReleases], [...leaveBeds]);
  const incoming = buildIncoming(unit, admissions, movements, now);
  const outgoing = outgoingToday(unit, bedReleases, outgoingBasis, now);
  /*
   * `sinceYesterday` counts whatever it is given and deliberately cannot use `admissionsForUnit`,
   * which drops departed admissions and would make `discharged` permanently zero — see its own doc
   * comment. So this is the ONE list on this page filtered by hand, keeping `"departed"` admissions in,
   * and it is filtered by `unit.id` all the same: the whole network's records through here would
   * report the state's departures as this ward's.
   */
  const movement = sinceYesterday(
    admissions.filter((admission) => admission.unitId === unit.id),
    now,
  );

  /* Taken from the SAME `now` every figure above was derived from, which is the whole of DB-12 —
     see the stamp's own comment in the heading below. */
  const stamp = asAtStamp(now);

  const occupantByKey = new Map(occupants.map((occupant) => [occupant.key, occupant]));
  /** Name line for each occupied card (UX audit, 21 Oct 2026). A stay with no linked person and no bed number gets no line. */
  const cardNameByKey = new Map<string, string>();
  for (const occupant of occupants) {
    const admission = admissions.find((candidate) => candidate.id === occupant.key);
    if (!admission) continue;
    const resolved = resolvePatientIdentity
      ? resolvePatientIdentity(admission)
      : resolveSubjectPatient(admission, { patients, movements });
    const line = boardCardLine(admission.bedNumber, resolved.patient);
    if (line) cardNameByKey.set(occupant.key, line);
  }

  const selectedTile = selectedKey === null ? null : (tiles.find((tile) => tile.key === selectedKey) ?? null);
  const selectedOccupant =
    selectedTile === null || (selectedTile.kind !== "occupied" && selectedTile.kind !== "waiting")
      ? null
      : (occupantByKey.get(selectedTile.key) ?? null);

  const tileMatchesFilter = (tile: Tile, filter: BoardFilter): boolean => {
    const occupant = occupantByKey.get(tile.key);
    switch (filter) {
      // "Needs a look" is the Ward page's set (device audit, 11 Oct 2026: 9 here against 6 there
      // for the same ward): a person in a bed past their date, away at an ED, or held up by a
      // recorded barrier. A closed, out-of-service or pulled bed has its own count and key.
      case "look":
        return (
          tile.kind === "occupied" &&
          (tile.pastDate || tile.awayAtEd || (occupant !== undefined && occupant.blockReason !== null))
        );
      case "ready":
        return tile.kind === "empty";
      case "quiet":
        return tile.kind === "occupied" && occupant !== undefined && occupant.expectedDays === null;
      case "all":
      default:
        return true;
    }
  };

  let lookCount = 0;
  let readyCount = 0;
  let quietCount = 0;
  let blockedTileCount = 0;
  let emptyTileCount = 0;
  const filteredTiles: Tile[] = [];

  for (const tile of tiles) {
    if (tile.kind === "blocked") blockedTileCount++;
    if (tile.kind === "empty") emptyTileCount++;

    const isLook = tileMatchesFilter(tile, "look");
    const isReady = tileMatchesFilter(tile, "ready");
    const isQuiet = tileMatchesFilter(tile, "quiet");

    if (isLook) lookCount++;
    if (isReady) readyCount++;
    if (isQuiet) quietCount++;

    if (tileMatchesFilter(tile, bedFilter)) {
      filteredTiles.push(tile);
    }
  }

  const filterCounts: Record<BoardFilter, number> = {
    all: tiles.length,
    look: lookCount,
    ready: readyCount,
    quiet: quietCount,
  };

  const tileIndexMap = new Map<Tile, number>();
  for (let i = 0; i < tiles.length; i++) {
    tileIndexMap.set(tiles[i], i);
  }

  const orderedTiles = [...tiles].sort((a, b) => {
    const aIdx = tileIndexMap.get(a) ?? 0;
    const bIdx = tileIndexMap.get(b) ?? 0;
    if (bedOrder === "recorded") return aIdx - bIdx;
    const aOccupant = occupantByKey.get(a.key);
    const bOccupant = occupantByKey.get(b.key);
    if (bedOrder === "stay") {
      const aDays = aOccupant?.days ?? -1;
      const bDays = bOccupant?.days ?? -1;
      return bDays - aDays || aIdx - bIdx;
    }
    const aExpected = aOccupant?.expectedDays ?? Number.POSITIVE_INFINITY;
    const bExpected = bOccupant?.expectedDays ?? Number.POSITIVE_INFINITY;
    return aExpected - bExpected || aIdx - bIdx;
  });

  const onFlowTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = FLOW_TABS.indexOf(flowTab);
    const requestedIndex =
      event.key === "ArrowRight"
        ? (currentIndex + 1) % FLOW_TABS.length
        : event.key === "ArrowLeft"
          ? (currentIndex - 1 + FLOW_TABS.length) % FLOW_TABS.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? FLOW_TABS.length - 1
              : null;
    if (requestedIndex === null) return;
    event.preventDefault();
    const requestedTab = FLOW_TABS[requestedIndex];
    setFlowTab(requestedTab);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-flow-tab="${requestedTab}"]`)?.focus();
  };

  /*
   * WHAT THE "NEEDS A LOOK THIS SHIFT" BAND SAYS, derived from figures this page already holds.
   *
   * ⚠️ NOT ONE NUMBER IS COMPUTED HERE. `blockedTileCount` and `states.closed` are the tiles and the
   * triage bar's own figure; `incoming` and `outgoing` are the two flow lists rendered below. A digest
   * that recomputed them would be a second arithmetic on one screen, and this file already carries a
   * note about why the bar and the home page's cards must be one.
   *
   * NO BED IS NAMED. An `Admission` records the unit and never a bed, so "bed 09 is overdue" is a
   * sentence the model cannot support — the owner ruled on 2026-09-07 that this board carries no bed
   * identity at all. A count is the whole of what is true, and it is enough: a reader who sees "2 out
   * of service" goes to the grid, where the hatch shows which.
   *
   * ZEROES ARE DROPPED rather than printed as "none". The band exists to shorten a scan and a list of
   * nothings lengthens it. The empty case gets its own sentence instead, because a band that vanishes
   * when there is nothing to say cannot tell a reader that there is nothing to say.
   */
  const pulledIn = incoming.filter((person) => person.state === "pulled");
  const figures: { key: string; label: string; value: number; led?: boolean; note?: string }[] = [
    {
      key: "availableNow",
      label: CAPACITY_FIGURE_LABELS.availableNow,
      // Audit 6 (Josh, 20 Oct 2026): the one ready figure, the headline's, which leaves out pulled beds.
      value: states.ready,
    },
    // Keyed `held` because that is the `CAPACITY_FIGURE_LABELS` key; the label it carries is
    // "Closed" (2026-09-01 ruling 5) and the value is the ruled Closed, so it matches the tiles.
    { key: "held", label: CAPACITY_FIGURE_LABELS.held, value: states.closed },
    {
      key: "confirmedToday",
      label: CAPACITY_FIGURE_LABELS.confirmedToday,
      value: breakdown.confirmedToday,
      led: outgoingBasis === "confirmed",
      // NA3-06 (decision 16): Capacity's note, explaining the bed meeting's lower confirmed figure.
      note: confirmedHeldUpNote(breakdown.confirmedToday, breakdown.confirmedHeldUpToday),
    },
    {
      key: "expectedToday",
      label: CAPACITY_FIGURE_LABELS.expectedToday,
      value: breakdown.expectedToday,
      led: outgoingBasis === "expected",
    },
    { key: "blockedToday", label: CAPACITY_FIGURE_LABELS.blockedToday, value: breakdown.blockedToday },
    {
      key: "awayAtEd",
      label: "Away at an ED",
      value: occupants.filter((occupant) => occupant.awayAtEdHours !== null).length,
    },
    { key: "pulled", label: "Pulled, not arrived", value: pulledIn.length },
    { key: "blockedBeds", label: "Out of service", value: blockedTileCount },
    {
      key: "overThreeMonths",
      label: "Here over 3 months",
      value: tiles.filter((tile) => tile.kind === "occupied" && tile.bandId === "over-3-months").length,
    },
    { key: "onLeave", label: CAPACITY_FIGURE_LABELS.onLeave, value: breakdown.onLeave },
  ];

  const shiftTiles: ShiftTileItem[] = [];

  // 1. Confirmed or Expected discharges past their expected time or due today
  for (const occupant of occupants) {
    if (occupant.pastDate || (occupant.expectedDays !== null && occupant.expectedDays <= 0)) {
      const isConfirmed = occupant.confirmed;
      const daysPast =
        occupant.expectedDays !== null && occupant.expectedDays < 0 ? Math.abs(occupant.expectedDays) : 0;
      const blockerPhrase = occupant.blockReason
        ? occupant.blockReason.toLowerCase().startsWith("awaiting")
          ? ` ${occupant.blockReason.charAt(0).toUpperCase() + occupant.blockReason.slice(1).toLowerCase()}.`
          : ` Waiting on ${occupant.blockReason.toLowerCase()}.`
        : "";
      shiftTiles.push({
        key: `discharge-${occupant.key}`,
        selectableKey: occupant.key,
        label: isConfirmed ? "Confirmed discharge" : "Expected discharge",
        tone: "warn",
        // No "when" word: the label already says discharge (device audit, 11 Oct 2026: a lone
        // mono "Discharge" floated over the buttons on phone).
        when: "",
        chip: daysPast > 0 ? `${daysPast}d overdue` : "Due today",
        text: `${isConfirmed ? "Confirmed out" : "Expected out"} today, still here.${blockerPhrase}`,
        acts: [
          { word: "They have left", say: "would release this bed and make it ready" },
          { word: "Record a blocker", tone: "warn", say: "would record what is holding this discharge up" },
        ],
      });
    }
  }

  // 2. Out of service beds
  for (let index = 0; index < blockedTileCount; index += 1) {
    shiftTiles.push({
      key: `blocked-shift-${index}`,
      selectableKey: `blocked-${index}`,
      label: "Out of service",
      tone: "danger",
      when: "Unavailable",
      chip: "Out of service",
      // Bed board decision 5A (Josh, 26 Sept 2026): nothing records why a bed is out of service.
      text: "Out of service. Reason not recorded. No return date recorded.",
      // "Set a return date" was removed 25 Sept 2026 (Josh, leave-bed Q4 "A"): it recorded a LEAVE
      // bed for an out-of-service bed, which is the wrong record. How an out-of-service bed records
      // its return is decided separately.
      acts: [],
    });
  }

  // 3. Away at an ED
  for (const occupant of occupants) {
    if (occupant.awayAtEdHours !== null) {
      shiftTiles.push({
        key: `away-${occupant.key}`,
        selectableKey: occupant.key,
        label: "Away at an ED",
        tone: "warn",
        when: `${occupant.awayAtEdHours}h ago`,
        chip: `${occupant.awayAtEdHours}h away`,
        text: "Their patient is away at an emergency department. The bed is still held for them.",
        acts: [{ word: "Mark them back", say: "would record that the person in this bed is back on the ward" }],
      });
    }
  }

  // 4. Pulled beds
  for (const person of pulledIn) {
    shiftTiles.push({
      key: `pulled-${person.key}`,
      selectableKey: person.key,
      label: "Pulled bed",
      tone: null,
      when: person.bedGoneHours !== null ? `${person.bedGoneHours}h ago` : "Today",
      chip: person.bedGoneHours !== null ? `${person.bedGoneHours}h travelling` : "Pulled",
      text: `Pulled for ${nameFor(person.key)}, taken and not yet arrived.`,
      // "Release the bed" removed 2026-09-25 (owner decision, Q5, bed-release-link plan): it
      // dispatched RELEASE_BED against "the first live release on the unit", the same guess-by-ward
      // defect a bed release now refuses everywhere else that a release must name its own admission
      // (`BedRelease.admissionId`). Giving a pull back is a different, separate decision (not this
      // one) — not yet wired to any event here.
      // Walkthrough T2: offered only when the reducer would accept it for this person's movement.
      acts: (() => {
        const movement = movementForBoardArrival(movements, person.key);
        return movement && boardArrivalAllowed(movement)
          ? [{ word: "Patient arrived", say: "would record the arrival and fill this bed" }]
          : [];
      })(),
    });
  }

  // The ED-transfer confirm is opened from the detail panel with the admission only, so its second
  // identifier is looked up here, the same way as the departure confirm's (design audit DA-08).
  const confirmIdentity = pendingConfirm
    ? (pendingConfirm.identity ?? identityFor(pendingConfirm.admissionId))
    : undefined;
  const confirmAdmissionId = pendingConfirm?.admissionId || pendingConfirm?.item?.selectableKey;
  const confirmDestination = LEAVING_DESTINATIONS.find(
    (destination) => destination.id === destinationFor(confirmAdmissionId),
  )?.label;

  const handleConfirmAction = () => {
    if (!pendingConfirm) return;
    if (pendingConfirm.kind === "leaving") {
      const admissionId = pendingConfirm.admissionId || pendingConfirm.item?.selectableKey;
      const leavingDestination = destinationFor(admissionId);
      if (!admissionId || leavingDestination === "") return;
      recordDepartureAndReport(
        () =>
          recordWardDeparture
            ? recordWardDeparture(admissionId, unit.id, leavingDestination)
            : raise("RECORD_LEAVING", {
                admissionId: admissionId,
                actingUnitId: unit.id,
                leavingDestination,
              }),
        `Recorded departure: ${pendingConfirm.who} has left the ward.`,
        admissionId,
      );
      if (selectedTile && admissionId === selectedTile.key) {
        closeDetail();
      }
      // DR-08 (25 Oct 2026): the button that opened this dialog and the patient's tile both leave
      // with the patient, so focus would fall to the page. It goes to the "Before handover" band.
      focusBackTo.current = null;
      dialogTriggerRef.current = document.getElementById("ward-board-work-band-heading")?.closest("summary") ?? null;
    } else if (pendingConfirm.kind === "away_at_ed" && pendingConfirm.admissionId) {
      dispatchAndReport(
        () =>
          raise("RECORD_AWAY_AT_EMERGENCY_DEPARTMENT", {
            admissionId: pendingConfirm.admissionId!,
            actingUnitId: unit.id,
          }),
        `Recorded: ${pendingConfirm.who} is currently away at an emergency department. Their bed is still held.`,
      );
    }
    closeConfirmDialog();
  };

  const handleShiftAction = (item: ShiftTileItem, word: string) => {
    if (word === "They have left") {
      const leavingDestination = destinationFor(item.selectableKey);
      const executeLeaving = (leavingDestination: LeavingDestination) => {
        recordDepartureAndReport(
          () =>
            recordWardDeparture
              ? recordWardDeparture(item.selectableKey!, unit.id, leavingDestination)
              : raise("RECORD_LEAVING", {
                  admissionId: item.selectableKey!,
                  actingUnitId: unit.id,
                  leavingDestination,
                }),
          `Recorded departure: ${item.who || nameFor(item.selectableKey)} has left the ward.`,
          item.selectableKey!,
        );
      };

      // Audit CS3-07: with no destination chosen yet, the confirmation asks for one.
      if (!requireConfirmation && leavingDestination !== "") {
        executeLeaving(leavingDestination);
        return;
      }

      setPendingConfirm({
        kind: "leaving",
        who: item.who || nameFor(item.selectableKey),
        identity: identityFor(item.selectableKey),
        item,
        admissionId: item.selectableKey,
      });
      return;
    }
    if (word === "Patient arrived" || word === "They have arrived") {
      const matchingMovement = movementForBoardArrival(movements, item.selectableKey);
      if (!matchingMovement) {
        const msg = `Cannot confirm arrival: no movement matches ${item.who || nameFor(item.selectableKey)}.`;
        setToastMessage({ warning: msg });
        return;
      }
      if (arrivalGaps(matchingMovement).length > 0) {
        setArriveCheck({ movementId: matchingMovement.id, who: item.who || nameFor(item.selectableKey) });
        return;
      }
      confirmBoardArrival(matchingMovement.id, item.who || nameFor(item.selectableKey));
      return;
    }
    if (word === "Mark them back") {
      // Owner ruling 2026-09-25: a leave bed names its stay, so this ends THIS person's own leave,
      // if they have one, and never the ward's first leave bed or an invented id (the old guess
      // could end somebody else's leave).
      const matchingLeave = leaveBeds.find((b) => b.admissionId === item.selectableKey);
      const isAwayAtEd = occupants.some((o) => o.key === item.selectableKey && o.awayAtEdHours !== null);
      const who = item.who || nameFor(item.selectableKey);
      if (!matchingLeave && !isAwayAtEd) {
        const msg = `Nothing to mark back: no leave or emergency department absence is recorded for ${who}. Nothing was changed.`;
        setToastMessage({ warning: msg });
        return;
      }
      dispatchAndReport(
        () => {
          const commands: ReturnType<WardCommandDispatch>[] = [];
          if (matchingLeave) {
            commands.push(
              raise("END_LEAVE_BED", {
                leaveBedId: matchingLeave.id,
                actingUnitId: unit.id,
              }),
            );
          }
          if (isAwayAtEd) {
            commands.push(
              raise("RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT", {
                admissionId: item.selectableKey!,
                actingUnitId: unit.id,
              }),
            );
          }
          const completed = commands.filter((command): command is WardCommandOutcome =>
            Boolean(command && !("then" in command)),
          );
          const pending = commands.filter((command): command is Promise<WardCommandOutcome> =>
            Boolean(command && "then" in command),
          );
          const summarize = (outcomes: WardCommandOutcome[]) => {
            const unaccepted = outcomes.find((outcome) => outcome.status !== "accepted");
            if (unaccepted && outcomes.some((outcome) => outcome.status === "accepted"))
              // A mixed result is never reported as a refusal, so the "Action refused" prefix cannot
              // contradict the part that was saved. Only a failed step is "not confirmed" (review: #722).
              return {
                ...unaccepted,
                status: "failed" as const,
                message: saveProblem(unaccepted.status === "failed" ? "partlySaved" : "partlyRefused"),
              };
            return unaccepted ?? outcomes[0];
          };
          // This action may save both records. Success belongs to the whole action, including
          // either command's refusal/failure; legacy synchronous void adapters keep their path.
          if (pending.length)
            return Promise.all(pending).then((finished) => summarize([...completed, ...finished]) ?? finished[0]!);
          return summarize(completed);
        },
        `Returned to ward: ${who} marked back${isAwayAtEd && !matchingLeave ? " from the emergency department" : " from leave"}.`,
      );
      return;
    }
    if (word === "Record a blocker") {
      dialogTriggerRef.current =
        typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
      setSelectedBlocker(BED_RELEASE_BLOCKERS[0]);
      setBlockerDialogItem(item);
      return;
    }
  };

  // The end of the current shift, as the sidebar handover countdown counts to, so the board never
  // names a handover already past in the evening or overnight (Audit 24-6 TC-02).
  const handoverAt = formatInstantWithDay(shiftEndInstant(now), now);
  const shiftDigest =
    shiftTiles.length > 0
      ? `${shiftTiles.length} ${shiftTiles.length === 1 ? "thing needs" : "things need"} you before the handover at ${handoverAt}.`
      : `Nothing needs you before the handover at ${handoverAt}.`;

  const chooseFilter = (filter: BoardFilter) => {
    setBedFilter(filter);
    if (selectedTile !== null && !tileMatchesFilter(selectedTile, filter)) {
      focusBackTo.current = null;
      setSelectedKey(null);
    }
  };

  const gridColumn = (
    <WardBoardGridColumn
      isPhone={isPhone}
      bedFilter={bedFilter}
      bedOrder={bedOrder}
      chooseFilter={chooseFilter}
      closeDetail={closeDetail}
      filterCounts={filterCounts}
      filteredTiles={filteredTiles}
      cardNameByKey={cardNameByKey}
      occupantByKey={occupantByKey}
      occupants={occupants}
      orderedTiles={orderedTiles}
      selectedKey={selectedKey}
      setBedOrder={setBedOrder}
      setSelectedKey={setSelectedKey}
      tileIndexMap={tileIndexMap}
      tileMatchesFilter={tileMatchesFilter}
      tiles={tiles}
      unit={unit}
    />
  );

  /** The phone sheet's title: the card's own line, or what kind of bed it is. */
  const phoneSheetTitle =
    selectedTile === null
      ? ""
      : (cardNameByKey.get(selectedTile.key) ??
        (selectedTile.kind === "empty"
          ? "An empty bed"
          : selectedTile.kind === "closed"
            ? "A closed bed"
            : selectedTile.kind === "occupied" || selectedTile.kind === "waiting"
              ? "Who is in this bed"
              : "A bed out of service"));

  const detailPanel = (
    <WardBoardDetailPanel
      admissions={admissions}
      blockedTileCount={blockedTileCount}
      closeDetail={closeDetail}
      closedTileCount={closedTileCount}
      constraint={constraint}
      dateEdit={dateEdit}
      dayZero={dayZero}
      dialogTriggerRef={dialogTriggerRef}
      dispatchAndReport={dispatchAndReport}
      emptyTileCount={emptyTileCount}
      leavingDestination={destinationFor(selectedTile?.key)}
      movements={movements}
      nameFor={nameFor}
      now={now}
      patients={patients}
      raise={raise}
      recordDepartureAndReport={recordDepartureAndReport}
      recordWardDeparture={recordWardDeparture}
      requireConfirmation={requireConfirmation}
      resolvePatientIdentity={resolvePatientIdentity}
      selectedOccupant={selectedOccupant}
      selectedTile={selectedTile}
      setBlockerDialogItem={setBlockerDialogItem}
      setDateEdit={setDateEdit}
      setLeavingDestination={(destination) =>
        selectedTile && setLeavingChoice({ admissionId: selectedTile.key, destination })
      }
      setPendingConfirm={setPendingConfirm}
      setSelectedBlocker={setSelectedBlocker}
      unit={unit}
    />
  );

  return (
    <div className={styles.screen} data-testid="ward-board" data-ward-design="third-edition">
      <main id="main-content" className={styles.main}>
        <h1 className={styles.screenName}>Stays and discharges</h1>

        {/*
         * A `<div>`, NOT a `<header>` — found by printing the page and looking, not by a test.
         * The global print reset in `globals.css` carries `header, nav, button { display: none
         * !important }` to strip workspace chrome from a printed sheet. This block is a page
         * header, not workspace chrome, so as a `<header>` it vanished in print and a printed ward
         * board carried no ward name, no hospital and no headline figure at all — a sheet of
         * anonymous numbered boxes that could have come from any ward in the state. Other pages
         * fight that rule back with a `display: block !important` override; not using the element
         * is simpler and cannot be undone by a later reset. Nothing here is a landmark: the page's
         * one landmark is the `<main>` above.
         */}
        <WardBoardHeader
          available={available}
          constraint={constraint}
          incoming={incoming}
          outgoing={outgoing}
          pendingPreparation={pendingPreparation}
          pulledIn={pulledIn}
          service={service}
          site={site}
          stamp={stamp}
          states={states}
          unit={unit}
        />

        <div className={styles.wardTools}>
          <div className={styles.wardToolsLeft}>
            <nav className={styles.wardScreenNav} aria-label={`${unit.name} screens`}>
              <Link href={unitHref(unit.id)}>Ward home</Link>
              <span aria-current="page">Stays and discharges</span>
            </nav>
          </div>
          <div className={styles.wardToolsRight}>
            <button
              type="button"
              className={`${styles.topDailySheetButton}${sheetOpen ? ` ${styles.topDailySheetButtonOpen}` : ""}`}
              onClick={() => setSheetOpen((open) => !open)}
              aria-expanded={sheetOpen}
              aria-controls="ward-board-sheet-body"
              data-testid="ward-board-top-sheet-toggle"
            >
              <svg
                className={styles.topDailySheetIcon}
                viewBox="0 0 16 16"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5.5 2.5h5M6 1.5h4a1 1 0 0 1 1 1v1H5v-1a1 1 0 0 1 1-1z" />
                <rect x="3" y="3.5" width="10" height="11" rx="1.5" />
                <path d="M5.5 7h5M5.5 9.5h5M5.5 12h3" />
              </svg>
              <span>{sheetOpen ? "Hide shift brief" : "Show shift brief"}</span>
              <span
                className={`${styles.topDailySheetChevron}${sheetOpen ? ` ${styles.topDailySheetChevronOpen}` : ""}`}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>
            <details className={styles.wardSwitch}>
              <summary>
                <svg
                  className={styles.wardSwitchIcon}
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 8h14l-3-3M20 16H6l3 3" />
                </svg>
                <span className={styles.wardSwitchLabel}>Change ward</span>{" "}
                <span className={styles.wardSwitchCount}>{liveUnits.length} wards</span>
              </summary>
              <div className={styles.wardSwitchBody}>
                <p className={styles.wardSwitchHeading}>Choose a ward</p>
                <ul className={styles.wardSwitchList}>
                  {liveUnits.map((candidate) => (
                    <li key={candidate.id}>
                      <Link
                        href={wardBoardHref(candidate.id)}
                        aria-current={candidate.id === unit.id ? "page" : undefined}
                      >
                        <span>{candidate.name}</span>
                        {candidate.id === unit.id && <small>You are here</small>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </div>
        </div>

        {/*
         * THE WARD BAND — ten current figures for this one ward. Six retain the home page's exact
         * vocabulary; the other four repeat counts already present in the grid and flow regions.
         *
         * **Every label comes from `CAPACITY_FIGURE_LABELS`** (`ward-morning-rollup.ts`), the single
         * capacity vocabulary spec D3/D14 requires to be identical at service, hospital and ward
         * level. Retyping "Available now" here would pass every test today and cost the cheap rename
         * tomorrow — and, worse, would let this board and the morning page start calling one figure
         * two things. The values come from `capacityBreakdown` for THIS unit, which is the same
         * function the morning page's ward rollup calls, so the two surfaces are one arithmetic.
         *
         * **The toggle changes emphasis; it never hides a figure.** All ten are on the band in every
         * state. A control able to take the blocked-releases figure off a coordinator's screen is a
         * control able to hide the one thing they most need to chase, so the toggle instead selects
         * which of Confirmed today / Expected today the "Going out today" list below is built from —
         * the owner's own "daily discharges … and toggles to daily expects". The selected figure is
         * marked in WORDS ("shown in Going out") as well as by weight, because a mark carried by
         * weight alone is a mark a greyscale sheet loses.
         */}
        {/* Change 10 (D-77): on a phone every bed comes first, above the day figures. */}
        {isPhone && (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- catches Escape or arrow keys bubbling up from a focused tile
          <div className={styles.phoneBeds} onKeyDown={onZoneKeyDown}>
            {gridColumn}
          </div>
        )}
        <section className={styles.triage} aria-labelledby="ward-board-triage-heading" data-testid="ward-board-triage">
          <h2 id="ward-board-triage-heading" className={styles.triageHeading}>
            Today on this ward
          </h2>
          <dl className={styles.triageFigures}>
            {figures.map(({ key, label, value, led = false, note }) => {
              return (
                <div
                  key={key}
                  className={`${styles.triageFigure}${led ? ` ${styles.triageFigureLed}` : ""}`}
                  data-testid={`ward-board-figure-${key}`}
                  data-figure-key={key}
                  data-figure-led={led ? "true" : "false"}
                >
                  <dt className={styles.triageLabel}>{label}</dt>
                  <dd className={styles.triageValue}>{value}</dd>
                  {note && <dd className={styles.triageLedNote}>{note}</dd>}
                  {led && <dd className={styles.triageLedNote}>shown in Going out</dd>}
                </div>
              );
            })}
          </dl>
        </section>

        {/* Stranded-patient prompts (smart feature 12): long stays with no expected date, and people
            ready to leave but waiting on something outside the ward. Scoped to this ward. */}
        <StrandedPrompts
          admissions={admissionsForUnit(admissions, unit.id)}
          now={now}
          nameFor={nameFor}
          onOpen={setSelectedKey}
          bedReleases={liveBedReleases}
        />
        <WardForecastShare unit={unit} now={now} nameFor={nameFor} onOpen={setSelectedKey} />

        {/*
         * NEEDS A LOOK THIS SHIFT — the owner asked for the board's exceptions condensed into one
         * toggle rather than read off six panels, and this is that.
         *
         * ⚠️ EVERY FIGURE HERE IS ALREADY ON THIS PAGE. Nothing is computed for this band: the counts
         * come from `incoming`, `outgoing`, `blockedTileCount` and the same `breakdown` the triage bar
         * prints, so the band cannot disagree with the panels below it. A digest that derives its own
         * numbers is a second arithmetic, and two arithmetics on one screen eventually differ.
         *
         * NO BED IDENTITY, and this is the owner's ruling of 2026-09-07 rather than a style choice.
         * The drawing this came from named beds — "bed 09 overdue 7h", "bed 18 out of service" — and an
         * `Admission` records the unit and never a bed, so those sentences claim something the model
         * does not hold. They are counts here, and a count is the whole of what is true.
         *
         * A `<details>` IS PERMITTED HERE AND WAS NOT ELSEWHERE, so the two need telling apart. The
         * owner ruled a fold out on the network PICTURE (2026-08-29) because a folded group makes wards
         * disappear; the ruling says in terms that folding was permitted for the bed LIST, "where
         * folding only shortens a scroll". This is a list.
         *
         * ⚠️ AND IT IS NOT PART OF THE PRINTED SHEET. A closed `<details>` prints as its summary and a
         * blank space — the reason `sheetOpen` below is a button and not a `details` at all. The
         * handover sheet is its own document further down this page; this band is screen chrome, so
         * the stylesheet drops it from print rather than half-printing it.
         *
         * `open` by default: nothing is hidden from a reader who has not met the control.
         */}
        {/*
         * THE THREE ZONES, and the reading they are arranged to give: LEFT who is coming in and what
         * is going out, MIDDLE the beds themselves, RIGHT whichever one the reader has chosen. Left
         * to right that is in → in a bed → out, which is the flow this whole prototype is about.
         *
         * The right zone is a SLIDE-OUT rather than a permanent column: it is absent until a tile is
         * chosen, so it costs no width on a screen where nobody has chosen one, and it takes its own
         * grid track rather than sitting over the beds — a panel that covered the grid would force a
         * reader to close it to do the thing they opened it for. On a phone there is no third column
         * at all and it falls into the flow directly beneath the grid, which is the same arrangement
         * without the overlay a phone sheet would impose.
         */}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- catches Escape or arrow keys bubbling up from the focused control inside */}
        <div
          className={`${styles.zones}${selectedTile !== null ? ` ${styles.zonesOpen}` : ""}`}
          onKeyDown={onZoneKeyDown}
        >
          <WardBoardFlowColumn
            flowTab={flowTab}
            incoming={incoming}
            movement={movement}
            now={now}
            onFlowTabKeyDown={onFlowTabKeyDown}
            outgoing={outgoing}
            outgoingBasis={outgoingBasis}
            setFlowTab={setFlowTab}
            setOutgoingBasis={setOutgoingBasis}
            targets={targets}
          />

          {!isPhone && gridColumn}

          {/*
           * THE SLIDE-OUT. Present only while something is selected, so it costs no width otherwise,
           * and it takes its own grid track rather than covering the beds it describes — a reader who
           * has just chosen a tile wants to compare it with the others, and a panel over the grid
           * would make them close it to do that.
           *
           * NOT modal and NOT a focus trap: Tab leaves it into the rest of the page, Escape closes it
           * from anywhere in the zones, and focus returns to the exact tile that opened it. The tile's
           * own `aria-pressed` is what says which one is open.
           */}
          {/*
           * A PERMANENT COLUMN, not a slide-out — owner, 2026-08-30: make the side panels more
           * like the home page's.
           *
           * The home page keeps its right region always present and, with nothing chosen, says so:
           * "Select a movement from the priority queue to see its explainable shortlist." That is
           * the pattern this now follows. A panel that appears only on click has two costs: the
           * grid reflows under the reader's hands at the moment they click, and until they click
           * there is nothing telling them the beds are clickable at all.
           */}
          {isPhone ? (
            // Change 10 (D-77): on a phone the bed's record opens in a sheet over the grid.
            <PhoneSheet
              open={selectedTile !== null}
              onClose={closeDetail}
              title={phoneSheetTitle}
              closeLabel="Close bed record"
              // WARD-16: an empty, closed or pulled bed has two lines, so its sheet fits them.
              height={selectedOccupant ? "tall" : "content"}
              data-testid="ward-board-detail-sheet"
            >
              <div className={styles.detailSheetBody}>{detailPanel}</div>
            </PhoneSheet>
          ) : (
            detailPanel
          )}
          <WardBoardWorkBand
            blockerCloseBtnRef={blockerCloseBtnRef}
            blockerDialogItem={blockerDialogItem}
            blockerDialogRef={blockerDialogRef}
            closeBlockerDialog={closeBlockerDialog}
            dispatchAndReport={dispatchAndReport}
            handleShiftAction={handleShiftAction}
            liveBedReleases={liveBedReleases}
            nameFor={nameFor}
            raise={raise}
            selectedBlocker={selectedBlocker}
            setSelectedBlocker={setSelectedBlocker}
            setSelectedKey={setSelectedKey}
            setShiftExpanded={setShiftExpanded}
            setToastMessage={setToastMessage}
            shiftDigest={shiftDigest}
            shiftExpanded={shiftExpanded}
            shiftTiles={shiftTiles}
            unit={unit}
          />
        </div>

        <WardBoardPrintSections
          incoming={incoming}
          movement={movement}
          now={now}
          occupants={occupants}
          outgoing={outgoing}
          outgoingBasis={outgoingBasis}
          selectedKey={selectedKey}
          setSheetOpen={setSheetOpen}
          sheetOpen={sheetOpen}
          targets={targets}
          tiles={tiles}
          unit={unit}
        />

        {pendingConfirm ? (
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- a backdrop click closes it for the pointer, and the shared modal focus helper closes it on Escape
          <div
            ref={confirmDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-description"
            id="ward-board-confirm-dialog"
            tabIndex={-1}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeConfirmDialog();
            }}
            className={styles.modalBackdrop}
          >
            <div className={styles.confirmDialogPanel}>
              <div className={styles.modalHeader}>
                <h3 id="confirm-dialog-title" className={styles.confirmDialogTitle}>
                  {pendingConfirm.kind === "leaving"
                    ? "Confirm patient departure"
                    : "Confirm emergency department transfer"}
                </h3>
                <button
                  ref={confirmCloseBtnRef}
                  type="button"
                  onClick={closeConfirmDialog}
                  aria-label="Close dialog"
                  data-testid="ward-board-confirm-close"
                  className={styles.confirmCloseBtn}
                  // `--r0` is declared nowhere, so this stays inline: in a stylesheet it would trip the
                  // token-reference guard (tests/ward-css-token-references-resolve.test.ts).
                  style={{ borderRadius: "var(--r0, 0.25rem)" }}
                >
                  ✕
                </button>
              </div>

              <p id="confirm-dialog-description" className={styles.confirmDialogText}>
                {pendingConfirm.kind === "leaving" ? (
                  <>
                    Are you sure you want to record that <strong>{pendingConfirm.who}</strong> has left the ward? This
                    will record their discharge and make this bed available for new admissions.
                    {confirmDestination ? (
                      <span data-testid="ward-board-confirm-destination-text">
                        {" "}
                        Where they went: {confirmDestination}.
                      </span>
                    ) : null}
                  </>
                ) : (
                  <>
                    Are you sure you want to record that <strong>{pendingConfirm.who}</strong> has gone to an emergency
                    department? The bed will remain held for them while they are away.
                  </>
                )}
                {/* DA-08: both confirmations check a second identifier, not the name alone. */}
                {confirmIdentity ? (
                  <span className={styles.confirmIdentity} data-testid="ward-board-confirm-identity">
                    Check: {confirmIdentity}
                  </span>
                ) : null}
              </p>

              {pendingConfirm.kind === "leaving" ? (
                <LeavingDestinationField
                  id="ward-board-confirm-destination"
                  value={destinationFor(confirmAdmissionId)}
                  onChange={(destination) =>
                    confirmAdmissionId && setLeavingChoice({ admissionId: confirmAdmissionId, destination })
                  }
                />
              ) : null}

              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={closeConfirmDialog}
                  data-testid="ward-board-confirm-cancel"
                  className={styles.detailSecondaryBtn}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAction}
                  data-testid="ward-board-confirm-proceed"
                  className={styles.detailPrimaryBtn}
                  // Native `disabled`: transient inertness until where they went is chosen (CS3-07).
                  disabled={pendingConfirm.kind === "leaving" && destinationFor(confirmAdmissionId) === ""}
                  data-tone={pendingConfirm.kind === "leaving" ? "warn" : undefined}
                >
                  {pendingConfirm.kind === "leaving" ? "Record departure" : "Record ED transfer"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
      <TransportExceptionDialog
        open={arriveCheck !== null}
        who={arriveCheck?.who ?? "this patient"}
        action="Confirm arrival"
        gaps={(() => {
          const movement = arriveCheck && movements.find((candidate) => candidate.id === arriveCheck.movementId);
          return movement ? arrivalGaps(movement) : [];
        })()}
        onClose={() => setArriveCheck(null)}
        onConfirm={(reason) => {
          const pending = arriveCheck;
          setArriveCheck(null);
          if (pending) confirmBoardArrival(pending.movementId, pending.who, reason);
        }}
        testId="ward-board-arrive-check"
      />
      <WardPrototypeFooter />
    </div>
  );
}

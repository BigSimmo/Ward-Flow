"use client";

/**
 * Triage and risk: one entry that prints as the mental health triage (SMHMR900) and the risk
 * assessment and management plan (SMHMR905). Josh approved the mock-up (Option D, ported from
 * `d-lean.html` onto the kit) and it was built into the app on 7 Nov 2026, at
 * `/ward-flow/people/[patientId]/triage`, with Start a triage at `/ward-flow/triage/new`.
 *
 * Layout: the patient banner (kit Hero), a section index on the left (step chips on a phone), one
 * form column of six numbered sections, and the record in a tabbed slide-out. The form's answers
 * live in React only. Signing records codes alone on the person (`RECORD_TRIAGE_SIGNED`: urgency,
 * outcome, legal status, review and the risk flags marked present); the typed text is never in it,
 * so it never reaches the workspace or browser storage (HOW-WE-WORK §6). Every person is synthetic.
 */
import { BellRing, BookUser, Check, CircleHelp, FileText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  Button,
  Card,
  CardHead,
  Dialog,
  FormalName,
  Hero,
  HeroChip,
  HeroChips,
  HeroStat,
  Icon,
  buttonClass,
  useIsPhone,
  useOptionalToast,
  phoneRows,
} from "@/components/wf";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import { calendarDateOf } from "@/components/ward-management/ward-clock";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { confirmedWardCommand } from "@/components/ward-management/ward-command-completion";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useRoleGate, useRouteRole } from "@/components/ward-management/ward-role-gate";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { raiseReferralHref } from "@/components/ward-management/shell/ward-facade";

import { DecisionBody } from "./triage-risk-decision";
import { FOLDABLE, foldedSections, foldLine } from "./triage-risk-fold";
import {
  LEGAL_SHORT,
  LEGAL,
  REVIEW,
  SECTIONS,
  SIGNED_IN,
  TIER_LONG,
  TIER_SHORT,
  type SectionId,
} from "./triage-risk-data";
import { MentalStateBody } from "./triage-risk-mse";
import { perthWallClockDate, reviewTimeStamp } from "./triage-risk-text";
import { SectionCard, StatusMark, type FormApi } from "./triage-risk-parts";
import { AssessmentBody, ReviewBody } from "./triage-risk-review";
import { PlanBody, RiskBody } from "./triage-risk-risk";
import { AllFactorsDrawer, SummaryDocument, SummaryDrawer } from "./triage-risk-sheets";
import { HowToDrawer } from "./triage-risk-how";
import { ContactsPop, TeamPop } from "./triage-risk-pops";
import { seeBy } from "./triage-see-by";
import { navigateWithDirtyGuard, useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import { SignRail } from "./triage-risk-side";
import { TriageStart } from "./triage-risk-start";
import { TRIAGE_NEW_HREF, triageHrefFor, useTriagePeople } from "./use-triage-people";
import { summaryModel, summaryText } from "./triage-risk-summary";
import {
  allFactors,
  blankTriage,
  requirements,
  sectionStatus,
  triageSignedFields,
  type Target,
  type TriageState,
} from "./triage-risk-state";
import styles from "./triage-risk-form.module.css";
import startStyles from "./triage-risk-start.module.css";

const LEGAL_NAME: Readonly<Record<string, string>> = Object.fromEntries(LEGAL);

/**
 * A legal status in full words on larger screens and its short form ("CTO") on smaller ones (Josh,
 * 7 Nov 2026). Both are in the page; CSS shows one. The full name stays for screen readers at
 * every width, so the short form is hidden from them.
 */
function LegalName({ name }: { name: string }) {
  const short = LEGAL_SHORT[name];
  if (!short) return <>{name}</>;
  return (
    <span className={styles.legalName}>
      <span className={styles.legalFull}>{name}</span>
      <span className={styles.legalShort} aria-hidden="true">
        {short}
      </span>
    </span>
  );
}
const REVIEW_SHORT: Readonly<Record<string, string>> = Object.fromEntries(
  REVIEW.map(([v, label]) => [v, label.replace("At ", "")]),
);
const PARTS = [
  { part: "triage", title: "Triage", code: "SMHMR900" },
  { part: "risk", title: "Risk assessment and management plan", code: "SMHMR905" },
] as const;
const SUB: Readonly<Record<SectionId, string>> = {
  rev: "When, where and how you reviewed",
  note: "Reason and story",
  mse: "Tap what you observed, add detail if needed",
  dec: "Urgency, outcome, legal and actions",
  risk: "Past risk, current risk, then family violence",
  plan: "No low, medium or high rating",
};

type Sheet = "sum" | "how" | "all" | null;

const NOT_SIGNED = "Not signed. Try again.";

/**
 * Sends the signed triage and reports how it went: accepted, or refused or failed with the reason.
 * Kept outside the form so the component stays compiler-friendly.
 */
function signTriage(
  send: () => Parameters<typeof confirmedWardCommand>[0],
  settle: (outcome: { status: string; message?: string }) => void,
) {
  try {
    const completion = confirmedWardCommand(send());
    if ("then" in completion) void completion.then(settle, () => settle({ status: "failed", message: NOT_SIGNED }));
    else settle(completion);
  } catch {
    settle({ status: "failed", message: NOT_SIGNED });
  }
}

/** Back to the top: the app shell scrolls its content column, a phone scrolls the window. */
function scrollPageTop() {
  const behavior = reducedMotion() ? "auto" : "smooth";
  document.querySelector("[data-wf-scroller]")?.scrollTo({ top: 0, behavior });
  window.scrollTo({ top: 0, behavior });
}

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const shown = (el: Element | null): el is HTMLElement =>
  el instanceof HTMLElement && el.isConnected && el.getClientRects().length > 0;

/** Scrolls a section into view and puts focus on its first field. */
function goToSection(section: SectionId) {
  const card = document.getElementById(`triage-${section}`);
  if (!card) return;
  card.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  window.setTimeout(() => {
    const target = card.querySelector<HTMLElement>(
      "textarea, input, [role='radio'][tabindex='0'], button[aria-pressed='false']",
    );
    (target ?? card).focus({ preventScroll: true });
  }, 350);
}

/**
 * Goes to the exact field a target names. A factor that is not on the form opens All RAMP factors
 * and lands on its chip there. With no target, or none shown, it goes to the section.
 */
function goToTarget(section: SectionId, target: Target | undefined, openAllFactors: () => void) {
  const card = document.getElementById(`triage-${section}`);
  const field = target ? (card ?? document).querySelector(target.selector) : null;
  if (shown(field)) {
    field.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
    window.setTimeout(() => field.focus({ preventScroll: true }), 350);
    return;
  }
  if (target?.factor) {
    openAllFactors();
    // After the drawer has opened and put focus on its Close button.
    window.setTimeout(() => {
      const chip = document.querySelector(`[data-testid="triage-factors-sheet"] ${target.selector}`);
      if (!shown(chip)) return;
      chip.scrollIntoView({ block: "center" });
      chip.focus({ preventScroll: true });
    }, 300);
    return;
  }
  goToSection(section);
}

const TABBABLE =
  "button:not([disabled]):not([tabindex='-1']), input:not([disabled]), textarea:not([disabled]), [tabindex='0']";

/** Puts focus on a section's first control once it has opened (scrolling it into view if needed). */
function focusSectionStart(section: SectionId) {
  window.setTimeout(() => {
    const body = document.querySelector(`#triage-${section} [data-fold-body]`);
    const first = [...(body?.querySelectorAll<HTMLElement>(TABBABLE) ?? [])].find(shown);
    first?.focus();
  }, 0);
}

const sectionOf = (target: EventTarget | null): SectionId | null =>
  target instanceof Element
    ? ((target.closest<HTMLElement>("[data-section]")?.dataset.section as SectionId | undefined) ?? null)
    : null;
const isFoldChange = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest("[data-fold-change]"));

/**
 * The section being worked in (7 Nov 2026): the last one that took focus, or a press on a browser
 * that does not focus on a press. Focus leaving for the page or a slide-out releases it, so a
 * finished section folds; focus still inside keeps it open. `opening` holds a section a jump or
 * Change is opening until focus lands in it.
 */
function useEngagedSection() {
  const [engaged, setEngaged] = useState<SectionId | null>(null);
  const [opening, setOpening] = useState<SectionId | null>(null);
  useEffect(() => {
    // During a press the change waits for the press to end: a section folding above the pointer on
    // pointerdown would move the page under it, and the click would land on something else.
    let pressing = false;
    let queued: (() => void) | null = null;
    const apply = (change: () => void) => {
      if (pressing) queued = change;
      else change();
    };
    const engage = (id: SectionId | null) => () => {
      setEngaged(id);
      if (id) setOpening((current) => (current === id ? null : current));
    };
    const onFocusIn = (event: FocusEvent) => {
      if (isFoldChange(event.target)) return;
      apply(engage(sectionOf(event.target)));
    };
    const onFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget) return;
      // Focus went to the page itself (a press on plain text): released, unless it is still inside.
      window.setTimeout(() => {
        if (document.hasFocus() && !sectionOf(document.activeElement)) apply(engage(null));
      }, 0);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (isFoldChange(event.target)) return;
      pressing = true;
      const id = sectionOf(event.target);
      if (id) queued = engage(id);
    };
    let fallback = 0;
    const finish = () => {
      window.clearTimeout(fallback);
      if (!pressing) return;
      pressing = false;
      const change = queued;
      queued = null;
      change?.();
    };
    // After the click has run; a press that makes no click (a drag) ends a moment later.
    const onClick = () => window.setTimeout(finish, 0);
    const onPointerEnd = () => {
      if (!pressing) return;
      window.clearTimeout(fallback);
      fallback = window.setTimeout(finish, 400);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointerup", onPointerEnd);
    document.addEventListener("pointercancel", onPointerEnd);
    document.addEventListener("click", onClick);
    return () => {
      window.clearTimeout(fallback);
      document.removeEventListener("click", onClick);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerEnd);
      document.removeEventListener("pointercancel", onPointerEnd);
    };
  }, []);
  const open = useCallback((section: SectionId) => {
    setEngaged(null);
    setOpening(section);
  }, []);
  return { engaged, opening, open };
}

type FocusMemory = { el: HTMLElement; box: string | null; index: number; label: string; section: string | null };

/**
 * Keeps focus when a list redraws: when the focused control goes (an Other risk removed, a
 * suggestion taken), focus moves to the control now in its place in the same list, else to its
 * section heading, never to the top of the page.
 */
function useFocusKeeper(state: TriageState) {
  const last = useRef<FocusMemory | null>(null);
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const el = event.target;
      if (!(el instanceof HTMLElement)) return;
      const box = el.closest<HTMLElement>("[data-refocus]");
      last.current = {
        el,
        box: box?.dataset.refocus ?? null,
        index: box ? [...box.querySelectorAll("button")].indexOf(el as HTMLButtonElement) : -1,
        label: el.textContent ?? "",
        section: el.closest<HTMLElement>("[data-section]")?.dataset.section ?? null,
      };
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);
  useLayoutEffect(() => {
    const memory = last.current;
    if (!memory || shown(memory.el)) return;
    const active = document.activeElement;
    if (active && active !== document.body && active !== memory.el) return;
    let next: HTMLElement | null = null;
    if (memory.box) {
      const box = document.querySelector(`[data-refocus="${memory.box}"]`);
      const buttons = box ? [...box.querySelectorAll<HTMLButtonElement>("button")].filter(shown) : [];
      next =
        (memory.label ? buttons.find((b) => b.textContent === memory.label) : undefined) ??
        buttons[Math.min(Math.max(memory.index, 0), buttons.length - 1)] ??
        null;
    }
    if (!next && memory.section) {
      const heading = document.getElementById(`triage-h-${memory.section}`);
      if (heading) {
        heading.tabIndex = -1;
        next = heading;
      }
    }
    next?.focus({ preventScroll: true });
  }, [state]);
}

/** Start a triage (`/ward-flow/triage/new`): choosing a person opens their form, blank. */
export function TriageStartScreen() {
  const router = useRouter();
  return <TriageStart onChoose={(person) => router.push(triageHrefFor(person.id))} />;
}

/**
 * The triage form for one synthetic person (`/ward-flow/people/[patientId]/triage`). It opens blank,
 * with nothing pre-selected; a person this desk is not sent reads as not found, as the record does.
 */
export function TriageScreen({ patientId }: { patientId: string }) {
  const router = useRouter();
  const { byId } = useTriagePeople();
  const person = byId.get(patientId);
  // The desk sets the program (with Change); nothing clinical is filled in.
  const desk = useRouteRole();
  // The form keeps the person it opened with; a signed triage then changes `last` on the world copy.
  const [opened] = useState(() => (person ? blankTriage(person, desk) : null));
  const initial = opened ?? (person ? blankTriage(person, desk) : null);
  if (!initial)
    return (
      <main id="main-content" className={startStyles.main} data-testid="triage-not-found">
        <Hero level={1} eyebrow="Triage and risk · Synthetic" title="No such person" />
        <p className={startStyles.quiet}>
          No synthetic person on this workspace has that record. Start a triage to search for them.
        </p>
        <Link href={TRIAGE_NEW_HREF} className={buttonClass({ variant: "pri" })}>
          Start a triage
        </Link>
      </main>
    );
  return (
    <TriageForm
      key={initial.person.id}
      initial={initial}
      onStartNew={() =>
        // A button, not a link, so ask before leaving typed work like every other exit.
        navigateWithDirtyGuard(() => {
          router.push(TRIAGE_NEW_HREF);
          scrollPageTop();
        })
      }
    />
  );
}

function TriageForm({ initial, onStartNew }: { initial: TriageState; onStartNew: () => void }) {
  const isPhone = useIsPhone();
  const toast = useOptionalToast();
  const [state, setState] = useState<TriageState>(initial);
  const person = state.person;
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const { now: boardNow, dayZero } = useWardFlowSelect("now", "dayZero");
  const routeRole = useRouteRole();
  // Raised by name as this desk at the board clock, as every screen does (tests/ward-flow-raise.test.ts).
  const raise = useWardRaise(routeRole);
  const signGate = useRoleGate({ patientId: person.id })("RECORD_TRIAGE_SIGNED");
  const bedRequestHref = raiseReferralHref({ patientId: person.id });
  const canRequestBed = useCanOpenHref()(bedRequestHref);
  const [signing, setSigning] = useState(false);
  const [editingReview, setEditingReview] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [tab, setTab] = useState("sum");
  const [active, setActive] = useState<SectionId>("rev");
  // Josh (7 Nov 2026): the form runs on the board clock, as signing does. Now stamps it and the
  // future-time check measures against it, as Perth wall-clock time whatever the device's own zone.
  // M18 (10 Nov 2026): `now` is the real moment; the reviewed-time helpers read it on the Perth clock.
  const now = calendarDateOf(boardNow, dayZero).getTime();
  const navLock = useRef(0);
  useFocusKeeper(state);
  const engagement = useEngagedSection();
  const openSection = engagement.open;
  const signed = signedAt !== null;

  const say = useCallback(
    (message: string) => {
      if (toast) toast.push({ tone: "info", title: message });
      else announceToWardShell(message);
    },
    [toast],
  );
  const openSummary = useCallback((next = "sum") => {
    setTab(next);
    setSheet("sum");
  }, []);
  const jump = useCallback(
    (section: SectionId, target?: Target) => {
      setSheet(null);
      if (section === "rev") setEditingReview(true);
      // A folded section opens before the scroll, so the jump lands on its field.
      openSection(section);
      window.setTimeout(() => goToTarget(section, target, () => setSheet("all")), 0);
    },
    [openSection],
  );
  const formApi: FormApi = useMemo(
    () => ({
      state,
      update: (change) => setState(change),
      set: (key, value) => setState((s) => ({ ...s, [key]: value })),
      setText: (key, value) => setState((s) => ({ ...s, text: { ...s.text, [key]: value } })),
      say,
      isPhone,
      openSummary,
      now,
      jump,
    }),
    [state, say, isPhone, openSummary, now, jump],
  );

  const reqs = useMemo(() => requirements(state, now), [state, now]);
  const needed = reqs.filter((r) => r.blocks && !r.ok);
  const left = needed.length;
  const blocking = reqs.filter((r) => r.blocks).length;
  const percent = Math.round((100 * (blocking - left)) / blocking);
  const status = Object.fromEntries(SECTIONS.map((s) => [s.id, sectionStatus(reqs, s.id, state)])) as Record<
    SectionId,
    ReturnType<typeof sectionStatus>
  >;
  // Folds only when nothing is needed or left to check, so a fold never hides a check.
  const folded = foldedSections({
    done: Object.fromEntries(FOLDABLE.map((id) => [id, status[id].done && status[id].toCheck === 0])),
    engaged: engagement.engaged,
    opening: engagement.opening,
    signed,
  });
  const flagCount = allFactors(state).filter((f) => f.mark === "y").length;
  // The see-by time (Josh, 9 Nov 2026): arithmetic on the reviewed time and the chosen tier's window.
  const due = seeBy(
    state.urgency,
    state.text.revTime,
    perthWallClockDate(now),
    state.urgency ? TIER_LONG[state.urgency] : "",
  );
  // Leaving drops typed text (it is never stored), so warn before any way out once something is entered.
  useDirtyStateGuard({
    isDirty: !signed && state !== initial,
    confirmMessage: "Leave without signing? Ward Flow does not keep typed triage text, so it will be lost.",
  });

  // The index marks the section in view.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        // A click in the index has just set the section; scrolling there must not override it.
        if (Date.now() < navLock.current) return;
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.section as SectionId | undefined;
          if (entry.isIntersecting && id) setActive(id);
        }
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    document.querySelectorAll("[data-section]").forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  // Phone (8 Nov 2026): the step chips are one sliding row, so the chip for the section in view is
  // slid into sight inside the row. Only the row scrolls; the page itself never moves.
  const indexRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const row = indexRef.current;
    if (!isPhone || !row) return;
    const link = row.querySelector<HTMLElement>('[aria-current="location"]');
    if (!link) return;
    const left = link.offsetLeft - row.offsetLeft;
    const right = left + link.offsetWidth;
    const pad = 16;
    if (left - pad >= row.scrollLeft && right + pad <= row.scrollLeft + row.clientWidth) return;
    row.scrollTo({ left: Math.max(0, left - pad), behavior: reducedMotion() ? "auto" : "smooth" });
  }, [active, isPhone]);

  // S opens the summary, outside a field and with no slide-out open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (sheet || event.ctrlKey || event.metaKey || event.altKey || event.key.toLowerCase() !== "s") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      event.preventDefault();
      openSummary("sum");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, openSummary]);

  const signedNow = () => {
    setSheet(null);
    setSignedAt(reviewTimeStamp(calendarDateOf(boardNow, dayZero)));
    scrollPageTop();
    announceToWardShell(`Signed. Triage for ${person.name} is read-only.`);
  };
  // Signing records the person and the codes only (`triageSignedFields`); the typed text stays here.
  const confirmSign = () => {
    setConfirming(false);
    const fields = triageSignedFields(state);
    if (!fields || signing) return;
    setSigning(true);
    signTriage(
      () => raise("RECORD_TRIAGE_SIGNED", fields),
      (outcome) => {
        setSigning(false);
        if (outcome.status === "accepted") signedNow();
        else say(outcome.message ?? NOT_SIGNED);
      },
    );
  };
  const copySummary = () =>
    copyTextToClipboard(summaryText(summaryModel(state, signedAt ? { at: signedAt, by: SIGNED_IN } : undefined))).then(
      () => say("Summary copied."),
      () => say("Copy not allowed here. Select the summary text instead."),
    );

  // A desk that may not sign, or a signing still being saved, says why instead of what is left.
  const cannotSign = !signGate.allowed
    ? (signGate.reason ?? "This desk cannot sign a triage.")
    : signing
      ? "Signing…"
      : null;
  const sayCannotSign = () => say(cannotSign ?? "");
  const signButton = (where: "foot" | "bar" | "sheet") => (
    <Button
      variant="pri"
      disabledReason={cannotSign ?? (left ? `${left} left before signing` : undefined)}
      reasonDisplay="tooltip"
      onUnavailablePress={
        cannotSign
          ? sayCannotSign
          : () => {
              const names = needed.map((r) => r.label);
              say(
                `Still needed: ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` and ${names.length - 3} more` : ""}`,
              );
              if (where !== "sheet") openSummary("sum");
            }
      }
      onClick={() => {
        setSheet(null);
        setConfirming(true);
      }}
    >
      {where === "bar" ? "Sign" : "Sign and send"}
    </Button>
  );

  const bannerLink = (
    label: string,
    phoneLabel: string,
    icon: typeof BellRing,
    onClick: () => void,
    extra?: ReactNode,
  ) => (
    <Button
      variant="onHero"
      size="sm"
      icon={icon}
      className={phoneRows.heroPill}
      onClick={onClick}
      aria-haspopup="dialog"
    >
      {isPhone ? phoneLabel : label}
      {extra}
    </Button>
  );

  const notSet = <span className={styles.statEmpty}>Not set</span>;

  const howToButton = (
    <Button
      variant="onHero"
      size="sm"
      icon={CircleHelp}
      className={phoneRows.heroPill}
      onClick={() => setSheet("how")}
      aria-haspopup="dialog"
    >
      How to
    </Button>
  );

  const sectionBody: Record<SectionId, ReactNode> = {
    rev: <ReviewBody form={formApi} editing={editingReview} onEditing={setEditingReview} />,
    note: <AssessmentBody form={formApi} />,
    mse: <MentalStateBody form={formApi} />,
    dec: <DecisionBody form={formApi} />,
    risk: <RiskBody form={formApi} onAllFactors={() => setSheet("all")} />,
    plan: <PlanBody form={formApi} />,
  };

  // Tablet and phone: one row of step chips above the form. On a desktop the sign-off rail lists
  // the sections instead, so this row is hidden there (redesign, 13 Nov 2026).
  const indexLinks = SECTIONS.map((s) => (
    <a
      key={s.id}
      href={`#triage-${s.id}`}
      className={styles.indexLink}
      aria-current={active === s.id ? "location" : undefined}
      onClick={(event) => {
        event.preventDefault();
        navLock.current = Date.now() + 1200;
        setActive(s.id);
        jump(s.id);
      }}
    >
      <span className={styles.indexNum}>{s.n}</span>
      <span className={styles.grow}>{s.label}</span>
      <StatusMark status={status[s.id]} withText={false} />
    </a>
  ));

  return (
    <div className={styles.screen} data-testid="triage-risk-page">
      <main id="main-content" className={styles.main}>
        <Hero
          level={1}
          eyebrow={`Triage and risk · Synthetic · ${signed ? "Signed" : left ? `${left} left before signing` : "Ready to sign"}`}
          title={<FormalName name={person.name} />}
          titleMeta={person.meta}
          // 9 Nov 2026 (Josh): How to joins the record row at every width, so the banner's actions sit
          // together in one evenly spaced row instead of How to floating above them.
          stats={
            isPhone ? undefined : (
              <>
                <HeroStat
                  label="Urgency"
                  value={state.urgency ? `${state.urgency} ${TIER_SHORT[state.urgency]}` : notSet}
                />
                <HeroStat label="Legal" value={state.legal ? <LegalName name={LEGAL_NAME[state.legal]} /> : notSet} />
                <HeroStat label="Risk flags" value={flagCount} />
                <HeroStat label="Review" value={state.review ? REVIEW_SHORT[state.review] : notSet} />
              </>
            )
          }
          bar={
            <div className={styles.bannerBar}>
              <p className={styles.idLine}>
                <span>
                  UMRN <b className={styles.mono}>{person.umrn}</b>
                </span>
                <span>
                  DOB <b className={styles.mono}>{person.dob}</b>
                </span>
                {isPhone ? null : (
                  <span>
                    Location <b>{person.nowAt}</b>
                  </span>
                )}
                <span>
                  Community team <TeamPop patientId={person.id} recordHref={person.recordHref} />
                </span>
              </p>
              {/* Alert first, then allergies, legal status in full words (as typed), then the rest. */}
              <HeroChips label="Alerts, allergies and legal" className={styles.bannerTags}>
                {signed ? (
                  <HeroChip
                    value="Signed"
                    tone="success"
                    label={`${signedAt} by ${SIGNED_IN}`}
                    testId="triage-signed-tag"
                  />
                ) : null}
                {due ? <HeroChip value={`See by ${due.when}`} label={due.basis} testId="triage-see-by" /> : null}
                {person.alert ? <HeroChip value="Alert" tone="warning" label={person.alert} /> : null}
                <HeroChip
                  value="Allergies"
                  // A recorded allergy carries the amber mark, as the alert chip does; none reads plain.
                  // (Chips never take the triangle: tests/wf-triangle-guard.test.ts.)
                  tone={person.allergies === "Not recorded" ? undefined : "warning"}
                  label={person.allergies}
                />
                {person.legal ? (
                  <HeroChip value={<LegalName name={person.legal} />} label={person.legalTag} />
                ) : (
                  <HeroChip value="Legal status" label="Not recorded. Not legally checked." />
                )}
                {person.alertCount > 1 ? (
                  <HeroChip
                    value={`+${person.alertCount - 1}`}
                    label="more alerts"
                    onPress={() => openSummary("alerts")}
                  />
                ) : null}
              </HeroChips>
            </div>
          }
          barAside={
            <div className={`${phoneRows.heroPills} ${styles.heroLinks}`}>
              {bannerLink(
                "Alerts",
                "Alerts",
                BellRing,
                () => openSummary("alerts"),
                person.alertCount ? (
                  <>
                    {" "}
                    <span className={styles.heroCount}>{person.alertCount}</span>
                  </>
                ) : undefined,
              )}
              {bannerLink("Patient and referral", "Patient", BookUser, () => openSummary("patient"))}
              <ContactsPop patientId={person.id} recordHref={person.recordHref} />
              {howToButton}
            </div>
          }
          condensed={`${person.name} · ${person.umrn} · ${signed ? "Signed" : left ? `${left} left before signing` : "Ready to sign"}`}
        />

        <div className={styles.layout}>
          <nav ref={indexRef} className={styles.index} aria-label="Sections">
            {indexLinks}
          </nav>

          {/* The left rail (Josh, 13 Nov 2026: the nav reads more naturally on the left): sections, progress and
              Sign and send in one card. A tablet shows it after the form; the phone has its bar. */}
          {isPhone ? null : (
            <SignRail
              reqs={reqs}
              status={status}
              active={active}
              left={left}
              percent={percent}
              signed={signed}
              signedLine={signedAt ? `${signedAt} by ${SIGNED_IN}` : undefined}
              doneLine={(section) => foldLine(state, section)[0] ?? ""}
              onJump={(section, target) => {
                navLock.current = Date.now() + 1200;
                setActive(section);
                jump(section, target);
              }}
              onSummary={() => openSummary("sum")}
              signButton={signed ? null : signButton("foot")}
            />
          )}

          <div className={styles.mainCol}>
            {signed ? (
              <Card className={startStyles.card} aria-labelledby="triage-signed-title" data-testid="triage-signed">
                {/* Redesign (13 Nov 2026): what to do next sits under the title, above the signed entry. */}
                <div className={startStyles.signedHead}>
                  <span className={startStyles.chip} data-done="" aria-hidden="true">
                    <Icon icon={Check} size={16} />
                  </span>
                  <div className={startStyles.signedText}>
                    <h2 className={startStyles.signedTitle} id="triage-signed-title">
                      Triage signed
                    </h2>
                    <p className={startStyles.quiet}>
                      One entry, printed as SMHMR900 and SMHMR905. The form below is read-only.
                    </p>
                  </div>
                  <div className={startStyles.actions} role="group" aria-label="Next">
                    <Button variant="pri" onClick={copySummary} data-testid="triage-signed-copy">
                      Copy summary
                    </Button>
                    {/* Review finding 4 (12 Nov 2026): opens the new referral for this person, where the desk may. */}
                    {canRequestBed ? (
                      <Link href={bedRequestHref} className={buttonClass()} data-testid="triage-signed-bed-request">
                        Make a bed request
                      </Link>
                    ) : null}
                    <Link href={person.recordHref} className={buttonClass()}>
                      Open patient record
                    </Link>
                    <Button onClick={onStartNew}>Start another triage</Button>
                  </div>
                </div>
                <div className={startStyles.signedDoc}>
                  <SummaryDocument form={formApi} signed={{ at: signedAt, by: SIGNED_IN }} />
                </div>
                <p className={`${startStyles.quiet} ${startStyles.signedFoot}`} data-testid="triage-signed-record-line">
                  Signed to the patient record: urgency, outcome, legal status, review and risk flags only. The typed
                  assessment, mental state, formulation and plan are not part of that record.
                </p>
              </Card>
            ) : null}

            {/* Once signed the form is read-only: every control in the fieldset is disabled, the text stays readable. */}
            <fieldset
              className={`${styles.form} ${startStyles.readOnly}`}
              disabled={signed || signing}
              aria-label={signed ? "Signed triage, read-only" : undefined}
              data-testid="triage-form"
            >
              {/* Redesign (13 Nov 2026): one card per printed form, its sections as rows with a hairline
                  between them, in place of six cards and two divider headings. */}
              {PARTS.map(({ part, title, code }) => {
                const sections = SECTIONS.filter((s) => s.part === part);
                const doneHere = sections.filter((s) => status[s.id].done).length;
                return (
                  <Card
                    key={part}
                    as="div"
                    role="group"
                    aria-labelledby={`triage-part-${part}`}
                    className={styles.partCard}
                  >
                    <CardHead
                      eyebrow
                      id={`triage-part-${part}`}
                      title={title}
                      meta={<span className={styles.mono}>{code}</span>}
                      aside={
                        <span className={styles.partCount}>
                          <b className={styles.mono}>{doneHere}</b> of {sections.length} done
                        </span>
                      }
                    />
                    {sections.map((s) => (
                      <SectionCard
                        key={s.id}
                        id={s.id}
                        n={s.n}
                        title={s.label}
                        sub={SUB[s.id]}
                        status={status[s.id]}
                        active={active === s.id}
                        fold={
                          FOLDABLE.includes(s.id)
                            ? {
                                folded: folded.has(s.id),
                                line: foldLine(state, s.id),
                                onOpen: () => {
                                  openSection(s.id);
                                  focusSectionStart(s.id);
                                },
                              }
                            : undefined
                        }
                      >
                        {sectionBody[s.id]}
                      </SectionCard>
                    ))}
                  </Card>
                );
              })}
            </fieldset>
          </div>
        </div>
        <p className={styles.footNote}>
          Ward Flow prototype. Synthetic patient and figures only. Not validated clinical decision support. One entry
          prints as SMHMR900 and SMHMR905.
        </p>
      </main>

      {signed ? null : isPhone ? (
        <div className={styles.phoneBar} data-testid="triage-phone-bar">
          <button type="button" className={styles.phoneLeft} onClick={() => openSummary("sum")} aria-haspopup="dialog">
            {left ? (
              <>
                <b className={styles.mono}>{left}</b> left before signing
              </>
            ) : (
              "Ready to sign"
            )}
          </button>
          <Button onClick={() => openSummary("sum")} aria-haspopup="dialog">
            Summary
          </Button>
          {signButton("bar")}
        </div>
      ) : (
        // Tablet only: from 62.5rem up the Summary button sits in the sign-off rail.
        <Button className={styles.edgeTab} icon={FileText} onClick={() => openSummary("sum")} aria-haspopup="dialog">
          Summary <span className={styles.edgeCount}>{left ? `${left} needed` : "Ready"}</span>
        </Button>
      )}

      <SummaryDrawer
        form={formApi}
        open={sheet === "sum"}
        tab={tab}
        onTab={setTab}
        onClose={() => setSheet(null)}
        reqs={reqs}
        jump={jump}
        signButton={signed ? null : signButton("sheet")}
        signed={signedAt ? { at: signedAt, by: SIGNED_IN } : undefined}
      />
      <HowToDrawer
        open={sheet === "how"}
        onClose={() => setSheet(null)}
        onGoTo={(section) => jump(section)}
        onStartNew={() => {
          setSheet(null);
          onStartNew();
        }}
      />
      <AllFactorsDrawer form={formApi} open={sheet === "all"} onClose={() => setSheet(null)} />
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Sign triage for ${person.name}?`}
        description="Signing creates both records, SMHMR900 and SMHMR905. Check what you chose."
        size="sm"
        data-testid="triage-sign-dialog"
        primary={{ label: "Sign", onAction: confirmSign }}
        secondary={[{ label: "Keep editing", onAction: () => setConfirming(false), autoFocus: true }]}
      >
        <dl className={startStyles.confirmFacts}>
          <div>
            <dt>Urgency</dt>
            <dd>{state.urgency ? `${state.urgency} · ${TIER_LONG[state.urgency]}` : "–"}</dd>
          </div>
          <div>
            <dt>Outcome</dt>
            <dd>{state.outcome ?? "–"}</dd>
          </div>
          <div>
            <dt>Reviewer</dt>
            <dd>{SIGNED_IN}</dd>
          </div>
        </dl>
      </Dialog>
    </div>
  );
}

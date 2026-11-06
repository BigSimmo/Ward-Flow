"use client";

/**
 * Triage and risk (mock-up, 6 Nov 2026): one entry that prints as the mental health triage
 * (SMHMR900) and the risk assessment and management plan (SMHMR905). Ported from the approved
 * single-file prototype "Option D" (`d-lean.html`) onto the kit, for Josh's review. Not built into
 * the app (D-74): nothing is saved, signing is not wired, and every patient detail is synthetic.
 *
 * Layout: the patient banner (kit Hero), a section index on the left (step chips on a phone), one
 * form column of six numbered sections, and the record in a tabbed slide-out. State lives in React
 * only; nothing typed goes to browser storage (HOW-WE-WORK §6).
 */
import { BellRing, BookUser, CircleHelp, FileText, Inbox } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  Button,
  FormalName,
  Hero,
  HeroChip,
  HeroChips,
  HeroStat,
  Meter,
  useIsPhone,
  useOptionalToast,
} from "@/components/wf";
import { announce } from "@/components/wf/live-announcer";
import { phoneRows } from "@/components/wf/phone-rows";
import { useMinuteNow } from "@/components/wf/use-minute-now";

import { DecisionBody } from "./triage-risk-decision";
import { LEGAL, PATIENT, REVIEW, SECTIONS, TIER_SHORT, type SectionId } from "./triage-risk-data";
import { MentalStateBody } from "./triage-risk-mse";
import { SectionCard, StatusMark, type FormApi } from "./triage-risk-parts";
import { AssessmentBody, ReviewBody } from "./triage-risk-review";
import { PlanBody, RiskBody } from "./triage-risk-risk";
import { AllFactorsDrawer, HowToDrawer, SummaryDrawer } from "./triage-risk-sheets";
import {
  allFactors,
  blankTriage,
  exampleTriage,
  requirements,
  sectionStatus,
  type FactorMark,
  type Target,
  type TriageState,
} from "./triage-risk-state";
import styles from "./triage-risk-redesign.module.css";

const LEGAL_NAME: Readonly<Record<string, string>> = Object.fromEntries(LEGAL);
const REVIEW_SHORT: Readonly<Record<string, string>> = Object.fromEntries(
  REVIEW.map(([v, label]) => [v, label.replace("At ", "")]),
);
const SUB: Readonly<Record<SectionId, string>> = {
  rev: "When, where and how you reviewed",
  note: "Reason and story",
  mse: "Tap what you observed, add detail if needed",
  dec: "Urgency, outcome, legal and actions",
  risk: "Past risk, current risk, then family violence",
  plan: "No low, medium or high rating",
};

type Sheet = "sum" | "how" | "all" | null;

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

export function TriageRiskRedesign() {
  const isPhone = useIsPhone();
  const toast = useOptionalToast();
  const [state, setState] = useState<TriageState>(exampleTriage);
  const [start, setStart] = useState<"example" | "blank">("example");
  const [editingReview, setEditingReview] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [tab, setTab] = useState("sum");
  const [active, setActive] = useState<SectionId>("rev");
  const [tapMark, setTapMark] = useState<FactorMark>("y");
  const now = useMinuteNow();
  const navLock = useRef(0);
  useFocusKeeper(state);

  const say = useCallback(
    (message: string) => {
      if (toast) toast.push({ tone: "info", title: message });
      else announce(message);
    },
    [toast],
  );
  const openSummary = useCallback((next = "sum") => {
    setTab(next);
    setSheet("sum");
  }, []);
  const jump = useCallback((section: SectionId, target?: Target) => {
    setSheet(null);
    if (section === "rev") setEditingReview(true);
    window.setTimeout(() => goToTarget(section, target, () => setSheet("all")), 0);
  }, []);
  const form: FormApi = useMemo(
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
      tapMark,
      setTapMark,
    }),
    [state, say, isPhone, openSummary, now, jump, tapMark],
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
  const sectionsDone = SECTIONS.filter((s) => status[s.id].done).length;
  const flagCount = allFactors(state).filter((f) => f.mark === "y").length;

  const nextNeeded = () => {
    const first = needed[0];
    if (!first) return say("Everything needed is in.");
    jump(first.section, first.target);
  };

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

  const loadStart = (value: "example" | "blank") => {
    setStart(value);
    setState(value === "example" ? exampleTriage() : blankTriage());
    setEditingReview(false);
    if (value === "blank") say("Blank form. Nothing clinical is pre-selected.");
  };

  const signButton = (where: "foot" | "bar" | "sheet") => (
    <Button
      variant="pri"
      disabledReason={left ? `${left} left before signing` : undefined}
      reasonDisplay={where === "foot" ? "inline" : "tooltip"}
      onUnavailablePress={() => {
        const names = needed.map((r) => r.label);
        say(`Still needed: ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` and ${names.length - 3} more` : ""}`);
        if (where !== "sheet") openSummary("sum");
      }}
      onClick={() => {
        setSheet(null);
        say("Not wired in this prototype.");
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

  const sectionBody: Record<SectionId, ReactNode> = {
    rev: <ReviewBody form={form} editing={editingReview} onEditing={setEditingReview} />,
    note: <AssessmentBody form={form} />,
    mse: <MentalStateBody form={form} />,
    dec: <DecisionBody form={form} />,
    risk: <RiskBody form={form} onAllFactors={() => setSheet("all")} />,
    plan: <PlanBody form={form} />,
  };

  const indexGroup = (part: "triage" | "risk", title: string, code: string) => (
    <>
      <div className={styles.indexGroup}>
        <span>{title}</span>
        <span className={styles.mono}>{code}</span>
      </div>
      {SECTIONS.filter((s) => s.part === part).map((s) => (
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
      ))}
    </>
  );

  return (
    <div className={styles.screen} data-testid="triage-risk-page">
      <main id="main-content" className={styles.main}>
        <Hero
          level={1}
          eyebrow={`Triage and risk · Synthetic · ${left ? `${left} left before signing` : "Ready to sign"}`}
          title={<FormalName name={PATIENT.name} />}
          titleMeta={PATIENT.meta}
          aside={
            <Button
              variant="onHero"
              size="sm"
              icon={CircleHelp}
              className={phoneRows.heroPill}
              onClick={() => setSheet("how")}
            >
              How to
            </Button>
          }
          stats={
            isPhone ? undefined : (
              <>
                <HeroStat
                  label="Urgency"
                  value={state.urgency ? `${state.urgency} ${TIER_SHORT[state.urgency]}` : "–"}
                />
                <HeroStat label="Legal" value={state.legal ? LEGAL_NAME[state.legal] : "–"} />
                <HeroStat label="Risk flags" value={flagCount} />
                <HeroStat label="Review" value={state.review ? REVIEW_SHORT[state.review] : "–"} />
              </>
            )
          }
          bar={
            <div className={styles.bannerBar}>
              <p className={styles.idLine}>
                <span>
                  UMRN <b className={styles.mono}>{PATIENT.umrn}</b>
                </span>
                <span>
                  DOB <b className={styles.mono}>{PATIENT.dob}</b>
                </span>
                {isPhone ? null : (
                  <>
                    <span>
                      Now at <b>{PATIENT.nowAt}</b>
                    </span>
                    <span>
                      Community team <b>{PATIENT.team}</b>
                    </span>
                  </>
                )}
              </p>
              {/* Alert first, then allergies, legal status in full words (as typed), then the rest. */}
              <HeroChips label="Alerts, allergies and legal" className={styles.bannerTags}>
                <HeroChip value="Alert" tone="warning" label={PATIENT.alert} />
                <HeroChip value="Allergies" label="2" />
                <HeroChip value={PATIENT.legal} label={PATIENT.legalTag} />
                <HeroChip value="+2" label="more alerts" onPress={() => openSummary("alerts")} />
              </HeroChips>
            </div>
          }
          barAside={
            <div className={phoneRows.heroPills}>
              {bannerLink(
                "Alerts",
                "Alerts",
                BellRing,
                () => openSummary("alerts"),
                <>
                  {" "}
                  <span className={styles.heroCount}>{PATIENT.alertCount}</span>
                </>,
              )}
              {bannerLink("Patient profile", "Profile", BookUser, () => openSummary("profile"))}
              {isPhone ? null : bannerLink("Referral", "Referral", Inbox, () => openSummary("ref"))}
            </div>
          }
          condensed={`${PATIENT.name} · ${PATIENT.umrn} · ${left ? `${left} left before signing` : "Ready to sign"}`}
        />

        <div className={styles.layout}>
          <nav className={styles.index} aria-label="Sections">
            {indexGroup("triage", "Triage", "SMHMR900")}
            {indexGroup("risk", "Risk", "SMHMR905")}
            <div className={styles.indexFoot}>
              <span className={styles.mono}>
                {sectionsDone} of {SECTIONS.length} sections
              </span>
              <Meter value={percent} max={100} fill="data-1" label="Needed answers in" />
              <Button variant="ghost" size="sm" onClick={nextNeeded}>
                Go to next needed
              </Button>
              <Button variant="ghost" size="sm" onClick={() => openSummary("sum")} aria-haspopup="dialog">
                Open summary
              </Button>
            </div>
          </nav>

          <div className={styles.form}>
            {SECTIONS.map((s, index) => (
              <div key={s.id} className={styles.formPart}>
                {index === 0 ? (
                  <h2 className={styles.part}>
                    Triage <span className={styles.mono}>SMHMR900</span>
                  </h2>
                ) : null}
                {s.id === "risk" ? (
                  <h2 className={styles.part}>
                    Risk assessment and management plan <span className={styles.mono}>SMHMR905</span>
                  </h2>
                ) : null}
                <SectionCard id={s.id} n={s.n} title={s.label} sub={SUB[s.id]} status={status[s.id]}>
                  {sectionBody[s.id]}
                  {s.id === "plan" && !isPhone ? (
                    <div className={styles.signFoot}>
                      <span className={styles.grow}>
                        {left
                          ? `Needed: ${needed.map((r) => r.label).join(", ")}.`
                          : "Everything needed is in. Signing creates both records."}{" "}
                        Draft is not saved in this mock-up.
                      </span>
                      <Button variant="ghost" onClick={() => say("Not wired in this prototype.")}>
                        Awaiting information
                      </Button>
                      <Button onClick={() => say("Not wired in this prototype.")}>Save draft</Button>
                      {signButton("foot")}
                    </div>
                  ) : null}
                </SectionCard>
              </div>
            ))}
            <p className={styles.footNote}>
              Ward Flow prototype. Synthetic patient and figures only. Not validated clinical decision support. One
              entry prints as SMHMR900 and SMHMR905.
            </p>
          </div>
        </div>
      </main>

      {isPhone ? (
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
        <Button className={styles.edgeTab} icon={FileText} onClick={() => openSummary("sum")} aria-haspopup="dialog">
          Summary <span className={styles.edgeCount}>{left ? `${left} needed` : "Ready"}</span>
        </Button>
      )}

      <SummaryDrawer
        form={form}
        open={sheet === "sum"}
        tab={tab}
        onTab={setTab}
        onClose={() => setSheet(null)}
        reqs={reqs}
        jump={jump}
        signButton={signButton("sheet")}
      />
      <HowToDrawer open={sheet === "how"} onClose={() => setSheet(null)} example={start} onExample={loadStart} />
      <AllFactorsDrawer form={form} open={sheet === "all"} onClose={() => setSheet(null)} />
    </div>
  );
}

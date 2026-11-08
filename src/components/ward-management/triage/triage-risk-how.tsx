"use client";

/**
 * How to complete a triage (Josh approved the mock-up, 9 Nov 2026): five tabs so each answer is one
 * tap away. Steps carry a time guide, one tip and a Go to link that closes the drawer on that
 * section; Shortcuts, What gets saved, the PSOLIS map (filterable) and the Evidence follow.
 * Prototype guidance on synthetic data, not policy.
 */
import { FilePlus2 } from "lucide-react";
import { useState } from "react";

import { Button, DrawerFootRow, PanelDrawer, SearchField, tableClasses } from "@/components/wf";

import { PSOLIS_FIELD_MAP, SECTIONS, type SectionId } from "./triage-risk-data";
import styles from "./triage-risk-how.module.css";

type HowTab = "steps" | "keys" | "saved" | "psolis" | "evidence";

const TABS: { id: HowTab; label: string }[] = [
  { id: "steps", label: "Steps" },
  { id: "keys", label: "Shortcuts" },
  { id: "saved", label: "What gets saved" },
  { id: "psolis", label: "PSOLIS map" },
  { id: "evidence", label: "Evidence" },
];

type Step = { section: SectionId | null; title: string; time: string; text: string; tip: string };

/** One card per part of the form, in order. Section null is the banner. */
const STEPS: readonly Step[] = [
  {
    section: null,
    title: "Check the banner",
    time: "30 s",
    text: "Identity, legal status, allergies and alerts come from the record. Contacts and Community team open in place.",
    tip: "Fix a wrong detail at the source, in the patient record, not here.",
  },
  {
    section: "rev",
    title: "Review details",
    time: "2 min",
    text: "When, how and where you reviewed, how they arrived, who was present, the referrer, purpose, episode and sources.",
    tip: "Now stamps the reviewed time. Ask Aboriginal status every time.",
  },
  {
    section: "note",
    title: "Assessment",
    time: "5 min",
    text: "Write as you talk in one box. Open What to cover for prompts, then tap the problems.",
    tip: "Type .all to add every heading at once.",
  },
  {
    section: "mse",
    title: "Mental state",
    time: "3 min",
    text: "Tap a phrase to add it under its domain, or type. Nothing is assumed normal.",
    tip: "By phone, mark what you could not see.",
  },
  {
    section: "dec",
    title: "Triage decision",
    time: "1 min",
    text: "Choose urgency A to G yourself, then the outcome, actions and legal status.",
    tip: "The see-by time appears on the banner once you pick a tier with a window.",
  },
  {
    section: "risk",
    title: "Risk assessment",
    time: "5 min",
    text: "Tap the flags that are present. Answer Rest of history and Rest of current risk. Ask the three family violence questions alone, word for word.",
    tip: "Unmarked is never a silent No. Unsure? Mark it Not known in All RAMP factors.",
  },
  {
    section: "plan",
    title: "Formulation and plan",
    time: "5 min",
    text: "Who is at risk, of what, how soon, what keeps them safe, and the plan. Set the review, preview, then sign.",
    tip: "Type .form, .plan or .all for the headings.",
  },
];

const KEYS: readonly (readonly [key: string, where: string, does: string])[] = [
  ["S", "Anywhere on the form", "Opens the summary"],
  ["Y / N", "A family violence question", "Answers it and moves to the next"],
  [".all", "Assessment, or Formulation and plan", "Adds every missing heading"],
  [".form", "Formulation and plan", "Adds the formulation headings"],
  [".plan", "Formulation and plan", "Adds the safety plan headings"],
  ["Esc", "A drawer or pop-out", "Closes it"],
];

const EVIDENCE: readonly (readonly [source: string, why: string])[] = [
  ["WA MP 0155/21", "Standard mental health documentation: the triage (SMHMR900) and RAMP (SMHMR905) content."],
  ["WA MP 0181/24", "Safety planning with the person, in place of a risk rating."],
  [
    "NICE NG225 (2022)",
    "Do not use risk tools or scales to predict suicide or allocate care; assess needs and make a safety plan.",
  ],
  ["WA MP 0095/18", "Clinical handover in a structured form (iSoBAR)."],
];

function Steps({ onGoTo }: { onGoTo: (section: SectionId) => void }) {
  return (
    <div className={styles.pane}>
      <div className={styles.map} aria-hidden="true">
        {SECTIONS.map((s) => (
          <span key={s.id} className={s.part === "risk" ? styles.mapRisk : styles.mapTriage} />
        ))}
      </div>
      <div className={styles.mapLabels} aria-hidden="true">
        <span>Triage · sections 1 to 4</span>
        <span>Risk · 5 and 6</span>
      </div>
      <ol className={styles.steps}>
        {STEPS.map((step, index) => (
          <li key={step.title} className={styles.step}>
            <span className={styles.stepNo} aria-hidden="true">
              {index}
            </span>
            <div className={styles.stepBody}>
              <p className={styles.stepHead}>
                <b>{step.title}</b>
                <span className={styles.time}>{step.time}</span>
              </p>
              <p className={styles.stepText}>{step.text}</p>
              <p className={styles.tip}>{step.tip}</p>
              {step.section ? (
                <Button variant="ghost" size="sm" className={styles.goTo} onClick={() => onGoTo(step.section!)}>
                  Go to {step.title}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Shortcuts() {
  return (
    <div className={styles.pane}>
      <div className={styles.tableWrap}>
        <table className={tableClasses.table}>
          <thead>
            <tr>
              <th className={tableClasses.th} scope="col">
                Key or phrase
              </th>
              <th className={tableClasses.th} scope="col">
                Where
              </th>
              <th className={tableClasses.th} scope="col">
                What it does
              </th>
            </tr>
          </thead>
          <tbody>
            {KEYS.map(([key, where, does]) => (
              <tr key={key}>
                <td>
                  <kbd className={styles.kbd}>{key}</kbd>
                </td>
                <td>{where}</td>
                <td>{does}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.quiet}>Phrases add only the headings that are missing, so typing one twice is safe.</p>
    </div>
  );
}

function Saved() {
  return (
    <div className={styles.pane}>
      <div className={styles.callout}>
        <b>Signing records codes only.</b> Urgency, outcome, legal status, review date and the risk flags marked present
        go on the patient. Nothing you typed is part of that record.
      </div>
      <div className={styles.callout}>
        <b>Typed text is not kept.</b> The assessment, mental state, formulation and plan live on this page only.
        Leaving the page asks first, because what you typed would be lost. Copy summary before you leave if you need it.
      </div>
      <div className={styles.callout}>
        <b>Why it works this way.</b> Nothing clinical is pre-selected, unmarked risk factors never become a silent No,
        and there is no low, medium or high rating. The formulation and plan carry the judgement, and urgency is always
        your choice.
      </div>
    </div>
  );
}

function PsolisMap() {
  const [query, setQuery] = useState("");
  const words = query.trim().toLowerCase();
  const rows = words
    ? PSOLIS_FIELD_MAP.filter(([field, here]) => `${field} ${here}`.toLowerCase().includes(words))
    : PSOLIS_FIELD_MAP;
  return (
    <div className={styles.pane}>
      <SearchField
        id="triage-how-psolis"
        label="Find a PSOLIS field"
        placeholder="For example, urgency or interpreter"
        value={query}
        onValueChange={setQuery}
        count={words ? { shown: rows.length, total: PSOLIS_FIELD_MAP.length, noun: "fields" } : undefined}
      />
      <div className={styles.tableWrap}>
        <table className={tableClasses.table}>
          <thead>
            <tr>
              <th className={tableClasses.th} scope="col">
                PSOLIS field
              </th>
              <th className={tableClasses.th} scope="col">
                Here
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([field, here]) => (
              <tr key={field}>
                <td>{field}</td>
                <td>
                  <b>{here}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {words && !rows.length ? <p className={styles.quiet}>No PSOLIS field matches.</p> : null}
    </div>
  );
}

function Evidence() {
  return (
    <div className={styles.pane}>
      <dl className={styles.evidence}>
        {EVIDENCE.map(([source, why]) => (
          <div key={source}>
            <dt>{source}</dt>
            <dd>{why}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.quiet}>
        Prototype guidance on synthetic data, not policy. Not validated clinical decision support.
      </p>
    </div>
  );
}

export function HowToDrawer({
  open,
  onClose,
  onStartNew,
  onGoTo,
}: {
  open: boolean;
  onClose: () => void;
  /** Start a triage for someone else (7 Nov 2026: lives in How to; 9 Nov 2026: in the drawer's foot). */
  onStartNew: () => void;
  /** Close the drawer and go to a section of the form. */
  onGoTo: (section: SectionId) => void;
}) {
  const [tab, setTab] = useState<HowTab>("steps");
  return (
    <PanelDrawer
      open={open}
      onClose={onClose}
      title="How to complete a triage"
      subtitle="Six sections, about 15 to 25 minutes. Triage (SMHMR900), then risk (SMHMR905)."
      tabs={TABS}
      tab={tab}
      onTabChange={(next) => setTab(next as HowTab)}
      tabsLabel="How to"
      className={styles.drawer}
      bodyClassName={styles.body}
      testId="triage-how-sheet"
      foot={
        <>
          <span className={styles.footText}>A triage for someone else?</span>
          <DrawerFootRow>
            <Button icon={FilePlus2} onClick={onStartNew} data-testid="triage-start-new">
              Start a new triage
            </Button>
          </DrawerFootRow>
        </>
      }
    >
      {tab === "steps" ? <Steps onGoTo={onGoTo} /> : null}
      {tab === "keys" ? <Shortcuts /> : null}
      {tab === "saved" ? <Saved /> : null}
      {tab === "psolis" ? <PsolisMap /> : null}
      {tab === "evidence" ? <Evidence /> : null}
    </PanelDrawer>
  );
}

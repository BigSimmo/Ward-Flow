"use client";

/**
 * How to complete a triage (Josh approved the mock-up, 9 Nov 2026): five tabs so each answer is one
 * tap away. Steps carry a time guide, one tip and a Go to link that closes the drawer on that
 * section; Shortcuts, What gets saved, the PSOLIS map (filterable) and the Evidence follow.
 * Prototype guidance on synthetic data, not policy.
 */
import { Keyboard } from "lucide-react";
import { useState } from "react";

import { shortcutSectionsForDesk } from "@/components/ward-management/help/ward-help-content";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { Button, DrawerFootRow, PanelDrawer, SearchField, Sheet, tableClasses } from "@/components/wf";

import { GUIDES, PSOLIS_FIELD_MAP, SECTIONS, type SectionId } from "./triage-risk-data";
import { GuideList } from "./triage-risk-parts";
import type { GuideId } from "./triage-guide-context";
import styles from "./triage-risk-how.module.css";

export type HowTab = "cover" | "steps" | "psolis" | "about";

const TABS: { id: HowTab; label: string }[] = [
  { id: "cover", label: "Cover" },
  { id: "steps", label: "Steps" },
  { id: "psolis", label: "PSOLIS map" },
  { id: "about", label: "About this form" },
];

type Step = { section: SectionId | null; title: string; time: string; text: string; tip: string };

/** One card per part of the form, in order. Section null is the banner. */
const STEPS: readonly Step[] = [
  {
    section: null,
    title: "Check the banner",
    time: "30 s",
    text: "Identity, legal status, allergies and alerts come from the record. Contacts and Community team open in place; Patient and referral opens the summary.",
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
    text: "Choose urgency A to G yourself, and say why if it differs from the referrer. Then the outcome, actions and legal status.",
    tip: "The see-by time appears on the banner once you pick a tier with a window.",
  },
  {
    section: "risk",
    title: "Risk assessment",
    time: "5 min",
    text: "Carry forward the last RAMP where there is one and confirm each flag today. Tap the flags that are present, then answer Rest of history and Rest of current risk. Ask the three family violence questions alone, word for word.",
    tip: "Unmarked is never a silent No. Unsure? Mark it Not known in All RAMP factors.",
  },
  {
    section: "plan",
    title: "Formulation and plan",
    time: "5 min",
    text: "Who is at risk, of what, how soon, what keeps them safe, and the plan. Set the review, preview, then sign.",
    tip: "Type .form, .plan or .all for the headings. Build safety plan adds the six steps in the person's words.",
  },
];

const EVIDENCE: readonly (readonly [source: string, why: string])[] = [
  ["WA MP 0155/21", "Standard mental health documentation: the triage (SMHMR900) and RAMP (SMHMR905) content."],
  ["WA MP 0181/24", "Safety planning with the person, rather than a rating or score of their risk."],
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

/** Audit two (#82): the one shared shortcuts look, this page's keys first. */
function ShortcutsLook({ open, onClose }: { open: boolean; onClose: () => void }) {
  const role = useEffectiveWardAccess().role;
  const sections = shortcutSectionsForDesk(role, "Triage");
  return (
    <Sheet open={open} onClose={onClose} title="Keyboard shortcuts" testId="triage-shortcuts-sheet">
      {sections.map((section) => (
        <section key={section.group} aria-label={section.group}>
          <h3 className={styles.keysGroup}>{section.group}</h3>
          <dl className={styles.keys}>
            {section.rows.map(({ keys, short }) => (
              <div key={keys}>
                <dt>
                  {keys.split(" ").map((part) => (
                    <kbd key={part}>{part}</kbd>
                  ))}
                </dt>
                <dd>{short}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </Sheet>
  );
}

function Saved() {
  return (
    <>
      <div className={styles.callout}>
        {/* D-186 (Q14): every field signing saves (`TriageSignedRecord` in triage-record.ts). */}
        <b>Signing records codes only.</b> Urgency, outcome, legal status, review, the risk flags marked present,
        problems, actions, venue and referral type go on the patient, with when it was signed and by which desk. Nothing
        you typed is part of that record.
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
    </>
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
        <table className={tableClasses.table} aria-label="PSOLIS field map">
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

function About() {
  return (
    <div className={styles.pane}>
      <Saved />
      <Evidence />
    </div>
  );
}

function Evidence() {
  return (
    <>
      <p className={styles.footText}>Evidence this form follows.</p>
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
    </>
  );
}

export function HowToDrawer({
  open,
  onClose,
  onGoTo,
  tab,
  onTab,
  guide,
  noteText,
  onHeading,
}: {
  tab: HowTab;
  onTab: (tab: HowTab) => void;
  /** Which note What to cover adds to, and that note's words so far. */
  guide: GuideId;
  noteText: string;
  /** Closes the drawer and adds the heading to the note. */
  onHeading: (heading: string) => void;
  open: boolean;
  onClose: () => void;
  /** Close the drawer and go to a section of the form. */
  onGoTo: (section: SectionId) => void;
}) {
  const [keysOpen, setKeysOpen] = useState(false);
  return (
    <>
      <PanelDrawer
        open={open}
        onClose={onClose}
        title="How to complete a triage"
        subtitle="Six sections, about 15 to 25 minutes. Triage (SMHMR900), then risk (SMHMR905)."
        tabs={TABS}
        tab={tab}
        onTabChange={(next) => onTab(next as HowTab)}
        tabsLabel="How to"
        className={styles.drawer}
        bodyClassName={styles.body}
        testId="triage-how-sheet"
        foot={
          <>
            <span className={styles.footText}>Keys that work on this form.</span>
            <DrawerFootRow>
              <Button variant="ghost" icon={Keyboard} onClick={() => setKeysOpen(true)} data-testid="triage-shortcuts">
                Keyboard shortcuts
              </Button>
            </DrawerFootRow>
          </>
        }
      >
        {tab === "cover" ? (
          <>
            <p className={styles.footText}>Tap a heading to add it to the note.</p>
            <GuideList groups={GUIDES[guide]} text={noteText} onHeading={onHeading} columns={2} />
          </>
        ) : null}
        {tab === "steps" ? <Steps onGoTo={onGoTo} /> : null}
        {tab === "psolis" ? <PsolisMap /> : null}
        {tab === "about" ? <About /> : null}
      </PanelDrawer>
      <ShortcutsLook open={keysOpen} onClose={() => setKeysOpen(false)} />
    </>
  );
}

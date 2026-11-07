"use client";

/**
 * Triage and risk mock-up: the slide-outs, on the kit PanelDrawer.
 *
 * - Summary: the record (Summary, Referral, Last triage, Alerts, Profile), opened from the banner
 *   links, the section index and the phone bar. Summary holds "Before you sign" and the document
 *   the form builds as you go, which prints as SMHMR900 and SMHMR905.
 * - How to: the steps, the practice form switch and where each PSOLIS field went.
 * - All RAMP factors: every factor by area.
 *
 * Synthetic data only.
 */
import { Copy, FilePlus2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  Badge,
  Button,
  ChipGroup,
  DrawerFootRow,
  PanelDrawer,
  Segmented,
  StatusGlyph,
  tableClasses,
} from "@/components/wf";
import { phoneRows } from "@/components/wf/phone-rows";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";

import {
  ALERTS,
  AREA_NAME,
  AREAS,
  CONTACTS,
  FACTOR_NAME,
  HOW_TO,
  LAST_TRIAGE,
  PSOLIS_FIELD_MAP,
  REFERRER_URGENCY,
  type SectionId,
  type TriagePerson,
} from "./triage-risk-data";
import { Choice, type FormApi } from "./triage-risk-parts";
import { FactorRow } from "./triage-risk-risk";
import { allFactors, type Requirement, type Target } from "./triage-risk-state";
import {
  partText,
  summaryModel,
  summaryText,
  type DocBlock,
  type DocValue,
  type SignedBy,
} from "./triage-risk-summary";
import styles from "./triage-risk-redesign.module.css";

const summaryTabs = (alertCount: number) => [
  { id: "sum", label: "Summary" },
  { id: "ref", label: "Referral" },
  { id: "last", label: "Last triage" },
  { id: "alerts", label: "Alerts", ...(alertCount ? { count: alertCount } : {}) },
  { id: "profile", label: "Profile" },
];

/** Who the triage is for, in record words: legal status as typed, never checked. */
const legalWords = (person: TriagePerson) =>
  person.legal ? `${person.legal}, ${person.legalTag}` : "Not recorded. Not legally checked.";

/** Where a summary or "Before you sign" item goes: its section, and the field when there is one. */
export type Jump = (section: SectionId, target?: Target) => void;

/**
 * Copies through the Ward Flow copy helper (synthetic first line, no UMRN or birth date) and says
 * how it went; a browser that refuses gets the fallback line.
 */
function copyText(text: string, done: string, refused: string, say: (message: string) => void) {
  copyTextToClipboard(text).then(
    () => say(done),
    () => say(refused),
  );
}

function Facts({ rows }: { rows: readonly (readonly [string, ReactNode])[] }) {
  return (
    <dl className={styles.facts}>
      {rows.map(([label, value]) => (
        <div key={label} className={styles.fact}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Missing({ children }: { children: ReactNode }) {
  return <span className={styles.missing}>{children}</span>;
}

/** A value's runs of text, with the quiet ones muted. */
function Value({ value }: { value: DocValue }) {
  return (
    <>
      {value.map((bit, index) =>
        typeof bit === "string" ? bit : <Missing key={`${index}-${bit.quiet}`}>{bit.quiet}</Missing>,
      )}
    </>
  );
}

function Block({ block }: { block: DocBlock }) {
  if (block.kind === "facts")
    return <Facts rows={block.rows.map(([label, value]) => [label, <Value key={label} value={value} />] as const)} />;
  if (block.kind === "missing") return <p className={styles.missing}>{block.text}</p>;
  if (block.kind === "tags")
    return (
      <ul className={styles.docTags} aria-label={block.label}>
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  return (
    <p className={styles.docNote}>
      <Value value={block.value} />
    </p>
  );
}

function DocSection({
  letter,
  title,
  onEdit,
  onCopy,
  children,
}: {
  letter: string;
  title: string;
  /** Left out once signed: the record is read-only. */
  onEdit?: () => void;
  /** Copies this part alone, for its own PSOLIS box. */
  onCopy: () => void;
  children: ReactNode;
}) {
  return (
    <section className={styles.docSection} aria-labelledby={`triage-doc-${letter}`}>
      <div className={styles.docHead}>
        <h3 className={styles.docHeadTitle} id={`triage-doc-${letter}`}>
          <span className={styles.mono} aria-hidden="true">
            {letter}
          </span>
          {title}
        </h3>
        <span className={`${styles.docTools} ${styles.pushEnd}`}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopy}
            aria-label={`Copy ${title}`}
            data-testid={`triage-copy-part-${letter}`}
          >
            Copy
          </Button>
          {onEdit ? (
            <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit ${title}`}>
              Edit
            </Button>
          ) : null}
        </span>
      </div>
      {children}
    </section>
  );
}

/**
 * The document the form builds as it is filled in. Copy writes the same model as plain text. Once
 * signed it is read-only (no Edit) and shown in full.
 */
export function SummaryDocument({ form, jump, signed }: { form: FormApi; jump?: Jump; signed?: SignedBy }) {
  const { state, say } = form;
  const [open, setFull] = useState(false);
  const full = open || Boolean(signed);
  const model = summaryModel(state, signed);
  const copy = () =>
    copyText(summaryText(model), "Summary copied.", "Copy not allowed here. Select the summary text instead.", say);

  return (
    <>
      <article
        className={styles.doc}
        data-capped={full ? undefined : ""}
        aria-labelledby="triage-doc-title"
        data-testid="triage-summary-document"
      >
        <div className={styles.docTop}>
          <div className={styles.grow}>
            <div className={styles.quiet}>{model.kicker}</div>
            <div className={styles.docTitle} id="triage-doc-title">
              {model.name} {/* The UMRN stays on screen and is left out of a copy (ward-clipboard.ts). */}
              <span className={styles.mono}>
                {state.person.umrn} · {state.person.meta.split(" · ")[1]}
              </span>
            </div>
            <p className={styles.docKey} data-testid="triage-doc-key">
              {model.keyLine}
            </p>
          </div>
          {signed ? null : (
            <Button variant="ghost" size="sm" icon={Copy} onClick={copy} data-testid="triage-copy-summary">
              Copy
            </Button>
          )}
        </div>
        {model.parts.map((part) => (
          <DocSection
            key={part.letter}
            letter={part.letter}
            title={part.title}
            onEdit={jump && !signed ? () => jump(part.edit) : undefined}
            onCopy={() =>
              copyText(partText(part), `${part.title} copied.`, "Copy not allowed here. Select the text instead.", say)
            }
          >
            {part.blocks.map((block, index) => (
              <Block key={`${part.letter}-${index}`} block={block} />
            ))}
          </DocSection>
        ))}
        <section className={styles.docSign} aria-label="Signature">
          {model.signature.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </section>
        <p className={styles.docFoot}>{model.foot.join(" · ")}</p>
      </article>
      {signed ? null : (
        <Button
          variant="ghost"
          size="sm"
          className={styles.centre}
          onClick={() => setFull((v) => !v)}
          aria-expanded={full}
        >
          {full ? "Show less" : "Show full summary"}
        </Button>
      )}
    </>
  );
}

function BeforeYouSign({ reqs, jump }: { reqs: readonly Requirement[]; jump: Jump }) {
  const needed = reqs.filter((r) => r.blocks && !r.ok);
  const toCheck = reqs.filter((r) => !r.blocks && !r.ok);
  const counts = [needed.length ? `${needed.length} needed` : "", toCheck.length ? `${toCheck.length} to check` : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className={styles.gaps}>
      <div className={styles.gapsHead}>
        <StatusGlyph tone={needed.length ? "neutral" : "success"} size={10} />
        {needed.length ? "Before you sign" : "Ready to sign"}
        <span className={`${styles.mono} ${styles.pushEnd}`}>{counts}</span>
      </div>
      {needed.length || toCheck.length ? (
        <ChipGroup label="Go to what is left" className={styles.gapChips}>
          {[...needed, ...toCheck].map((r, index) => (
            <Button
              key={`${index}-${r.label}`}
              size="sm"
              className={phoneRows.chip}
              onClick={() => jump(r.section, r.target)}
            >
              <span className={styles.inlineMark}>
                <StatusGlyph tone={r.blocks ? "neutral" : "warning"} size={8} />
                {r.label}
              </span>
            </Button>
          ))}
        </ChipGroup>
      ) : null}
    </div>
  );
}

/** A record tab for a person the worked Example does not cover: what the synthetic record holds. */
function OtherPersonPane({
  title,
  rows,
  note,
}: {
  title: string;
  rows: readonly (readonly [string, ReactNode])[];
  note?: string;
}) {
  return (
    <>
      <h3 className={styles.paneHead}>{title}</h3>
      <Facts rows={rows} />
      {note ? <p className={styles.quiet}>{note}</p> : null}
    </>
  );
}

const notWired = (form: FormApi) => () => form.say("Not wired in this prototype.");

function CopyNumber({ form, label, number }: { form: FormApi; label: string; number: string }) {
  const copy = () => copyText(number, `Copied ${number}`, `Copy not allowed here: ${number}`, form.say);
  return <Button size="sm" variant="ghost" iconOnly icon={Copy} aria-label={`Copy ${label} number`} onClick={copy} />;
}

export function SummaryDrawer({
  form,
  open,
  tab,
  onTab,
  onClose,
  reqs,
  jump,
  signButton,
}: {
  form: FormApi;
  open: boolean;
  tab: string;
  onTab: (tab: string) => void;
  onClose: () => void;
  reqs: readonly Requirement[];
  jump: Jump;
  signButton: ReactNode;
}) {
  const left = reqs.filter((r) => r.blocks && !r.ok).length;
  const person = form.state.person;
  return (
    <PanelDrawer
      open={open}
      onClose={onClose}
      title={person.name}
      subtitle="This triage, the referral and the record. Synthetic."
      tag={
        <Badge tone={left ? "neutral" : "success"} className={styles.noShrink}>
          {left ? `${left} needed` : "Ready to sign"}
        </Badge>
      }
      tabs={summaryTabs(person.alertCount)}
      tab={tab}
      onTabChange={onTab}
      tabsLabel="Slide-out"
      className={styles.wideDrawer}
      testId="triage-summary-sheet"
      foot={
        <>
          <span className={styles.footText}>{left ? `${left} needed before signing` : "Ready to sign"}</span>
          <DrawerFootRow>
            <Button onClick={onClose}>Back to form</Button>
            {signButton}
          </DrawerFootRow>
        </>
      }
    >
      <div className={styles.pane}>
        {tab === "sum" ? (
          <>
            <BeforeYouSign reqs={reqs} jump={jump} />
            <SummaryDocument form={form} jump={jump} />
          </>
        ) : null}
        {tab === "ref" && !person.example ? (
          <OtherPersonPane
            title={person.referral ? `Referral ${person.referral.id}` : "No open referral"}
            rows={
              person.referral
                ? [
                    ["From", person.referral.from],
                    ["Urgency asked", person.referral.urgency ?? "No triage urgency asked"],
                    ["Legal", legalWords(person)],
                    ["Now at", person.nowAt],
                  ]
                : [["Referral", "This triage starts without a referral."]]
            }
          />
        ) : null}
        {tab === "ref" && person.example ? (
          <>
            <h3 className={styles.paneHead}>Referral R-1182</h3>
            <Facts
              rows={[
                [
                  "From",
                  <>
                    Dr P. Singh, ED registrar · Synthetic ED <span className={styles.mono}>(08) 5550 0190</span>
                    <CopyNumber form={form} label="referrer" number="(08) 5550 0190" />
                  </>,
                ],
                [
                  "Received",
                  <>
                    <span className={styles.mono}>06/11 08:55</span> · eReferral
                  </>,
                ],
                ["Type", "Emergency department"],
                ["Asks for", "Admission and bed review today"],
                ["Urgency asked", `${REFERRER_URGENCY} within 12 hours`],
                [
                  "Reason",
                  "Five days of rising agitation after a missed depot. Threatening staff in ED. Mother worried at home.",
                ],
                ["Legal", `${person.legal}, Form 5A (as typed). Not legally checked.`],
                ["Medically", "Bloods pending; obs stable"],
                ["Now at", "Synthetic ED · bay 7, security nearby"],
                [
                  "Documents",
                  <ChipGroup key="docs" label="Documents">
                    <Button size="sm" className={phoneRows.chip} onClick={notWired(form)}>
                      ED notes (synthetic preview)
                    </Button>
                    <Button size="sm" className={phoneRows.chip} onClick={notWired(form)}>
                      Obs chart
                    </Button>
                  </ChipGroup>,
                ],
              ]}
            />
          </>
        ) : null}
        {tab === "last" && !person.lastTriage ? (
          <OtherPersonPane
            title="No previous triage on record"
            rows={[["Past risk", "Answered fresh today. Nothing is carried forward."]]}
          />
        ) : null}
        {tab === "last" && person.lastTriage ? (
          <>
            <h3 className={styles.paneHead}>Last triage and RAMP · 12 Oct · Synthetic CMHT</h3>
            <Facts
              rows={[
                ["Urgency", LAST_TRIAGE.urgencyText],
                ["Outcome", LAST_TRIAGE.outcome],
                ["Flags then", LAST_TRIAGE.pastFlags.map((k) => FACTOR_NAME[k]).join(" · ")],
                ["Formulation", LAST_TRIAGE.formulation],
                ["Safety plan", LAST_TRIAGE.safetyPlan],
              ]}
            />
            <h3 className={styles.paneHead}>Admissions</h3>
            <Facts
              rows={[
                ["Last admission", "Sep 2026 · 14 days · Synthetic Hospital · CTO on discharge"],
                ["This year", "2 admissions, both after stopping treatment"],
              ]}
            />
          </>
        ) : null}
        {tab === "alerts" && !person.example ? (
          <OtherPersonPane
            title="Alerts"
            rows={[
              ["Alerts", person.alert ?? "None on the synthetic record"],
              ["Allergies", person.allergies],
            ]}
          />
        ) : null}
        {tab === "alerts" && person.example ? (
          <>
            <h3 className={styles.paneHead}>Alerts · newest first</h3>
            <ul className={styles.alertList}>
              {ALERTS.map((alert) => (
                <li key={alert.title}>
                  <StatusGlyph tone={alert.tone} size={10} />
                  <span>
                    <b>{alert.title}</b>
                    <span className={styles.quietBlock}>{alert.detail}</span>
                  </span>
                  <span className={styles.mono}>{alert.when}</span>
                </li>
              ))}
            </ul>
            <p className={styles.quiet}>Allergies: {person.allergies}</p>
          </>
        ) : null}
        {tab === "profile" && !person.example ? (
          <OtherPersonPane
            title="Identity"
            rows={[
              ["Name", `${person.name} · ${person.meta}`],
              [
                "UMRN",
                <span key="u" className={styles.mono}>
                  {person.umrn}
                </span>,
              ],
              [
                "DOB",
                <span key="d" className={styles.mono}>
                  {person.dob}
                </span>,
              ],
              ["Now at", person.nowAt],
              ["Legal", legalWords(person)],
            ]}
            note="Contacts and care details are drawn for the worked Example only."
          />
        ) : null}
        {tab === "profile" && person.example ? (
          <>
            <h3 className={styles.paneHead}>Identity</h3>
            <Facts
              rows={[
                ["Name", `${person.name} · ${person.meta}`],
                [
                  "UMRN",
                  <span key="u" className={styles.mono}>
                    {person.umrn}
                  </span>,
                ],
                [
                  "DOB",
                  <span key="d" className={styles.mono}>
                    {person.dob}
                  </span>,
                ],
                [
                  "Medicare",
                  <span key="m" className={styles.mono}>
                    SYN 2345 67890 1
                  </span>,
                ],
                ["Address", "Unit 4, 12 Sample Road, Midland WA 6056"],
                ["Aboriginal status", "Neither (recorded 12 Oct; ask again today)"],
                ["Language", "English · no interpreter"],
              ]}
            />
            <h3 className={styles.paneHead}>Contacts</h3>
            <Facts
              rows={CONTACTS.map(([label, number, who]) => [
                label,
                <>
                  {who ? `${who} ` : ""}
                  <span className={styles.mono}>{number}</span>
                  <CopyNumber form={form} label={label} number={number} />
                </>,
              ])}
            />
            <h3 className={styles.paneHead}>Care</h3>
            <Facts
              rows={[
                ["Community team", "Active · Synthetic East CMHT since 2019"],
                ["Legal", `${person.legal}, Form 5A (as typed). Not legally checked.`],
                ["Directive", "None recorded"],
                ["Nominated person", "None recorded"],
                ["Last contact", "30 Oct · depot clinic, missed"],
                ["Allergies", person.allergies],
              ]}
            />
            <Button className={styles.startSelf} onClick={notWired(form)}>
              Open full profile
            </Button>
          </>
        ) : null}
      </div>
    </PanelDrawer>
  );
}

export function HowToDrawer({
  open,
  onClose,
  example,
  onExample,
  onStartNew,
}: {
  open: boolean;
  onClose: () => void;
  example: "example" | "blank";
  onExample: (value: "example" | "blank") => void;
  /** Start a triage for someone else: the Start a triage step (7 Nov 2026: moved here from the banner). */
  onStartNew: () => void;
}) {
  return (
    <PanelDrawer
      open={open}
      onClose={onClose}
      title="How to complete a triage"
      subtitle="Patient details come from the record. You fill in the assessment only, top to bottom."
      className={styles.wideDrawer}
      testId="triage-how-sheet"
    >
      <div className={styles.pane}>
        <div className={styles.startNew}>
          <p className={`${styles.quiet} ${styles.grow}`}>
            <b>Someone else?</b> Choose who the triage is for, and the form opens blank. New, then Triage, in the app
            bar does the same.
          </p>
          <Button size="sm" icon={FilePlus2} onClick={onStartNew} data-testid="triage-start-new">
            Start a new triage
          </Button>
        </div>
        <ol className={styles.steps}>
          {HOW_TO.map(([title, text]) => (
            <li key={title}>
              <span>
                <b>{title}.</b> {text}
              </span>
            </li>
          ))}
        </ol>
        <div className={styles.stack}>
          <p className={styles.quiet}>
            <b>Practice form.</b> Synthetic example, or start blank. Nothing clinical is pre-selected when blank.
          </p>
          <Segmented
            size="md"
            label="Start state"
            items={[
              { id: "example", label: "Example" },
              { id: "blank", label: "Start blank" },
            ]}
            value={example}
            onChange={onExample}
          />
          <p className={styles.quiet}>Draft is not saved in this mock-up.</p>
        </div>
        <p className={styles.quiet}>
          <b>Phrases.</b> In the Assessment box type .all; in Formulation and plan type .form, .plan or .all. Each adds
          only the headings that are missing.
        </p>
        <p className={styles.quiet}>
          <b>Keys.</b> S opens the summary. Y and N answer the focused family violence question and move on.
        </p>
        <p className={styles.quiet}>
          <b>Why it works this way.</b> Nothing clinical is pre-selected, and unmarked risk factors never become a
          silent No. There is no low, medium or high rating; the formulation and plan carry the judgement. Urgency is
          always your choice.
        </p>
        <h3 className={styles.paneHead}>Where each PSOLIS field went</h3>
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
              {PSOLIS_FIELD_MAP.map(([field, here]) => (
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
        <p className={styles.quiet}>
          Based on WA MP 0155/21 (standard documentation), MP 0181/24 (safety planning) and NICE NG225. Prototype
          guidance on synthetic data, not policy.
        </p>
      </div>
    </PanelDrawer>
  );
}

export function AllFactorsDrawer({ form, open, onClose }: { form: FormApi; open: boolean; onClose: () => void }) {
  const factors = allFactors(form.state);
  return (
    <PanelDrawer
      open={open}
      onClose={onClose}
      title="All RAMP factors"
      subtitle="The flags are the same factors. Unmarked history takes your Rest of history answer; unmarked current factors take Rest of current risk."
      testId="triage-factors-sheet"
      foot={
        <>
          <span className={styles.footText}>Rest of current risk</span>
          <Choice
            label="Rest of current risk"
            options={[
              ["np", "Not present"],
              ["na", "Not assessed"],
            ]}
            value={form.state.rest}
            onChange={(v) => form.update((s) => ({ ...s, rest: v, restCov: null }))}
          />
          <DrawerFootRow>
            <Button variant="pri" onClick={onClose}>
              Done
            </Button>
          </DrawerFootRow>
        </>
      }
    >
      <div className={styles.pane}>
        <p className={styles.quiet}>
          Tap a factor to mark it present. Mark one Not known here only when you could not find out. Everything left
          unmarked takes your Rest of history or Rest of current risk answer.
        </p>
        {AREAS.map((area) => {
          const count = factors.filter((f) => f.area === area.id && f.mark === "y").length;
          return (
            <section key={area.id} className={styles.stack} aria-labelledby={`triage-area-${area.id}`}>
              <h3 className={styles.areaHead} id={`triage-area-${area.id}`}>
                {AREA_NAME[area.id]}
                <span className={`${styles.mono} ${styles.pushEnd}`}>{count ? `${count} present` : ""}</span>
              </h3>
              {(["bg", "now"] as const).map((kind) => (
                <div key={kind} className={styles.stack}>
                  <span className={styles.miniLabel}>{kind === "bg" ? "Background" : "Now"}</span>
                  <ChipGroup label={`${area.name}: ${kind === "bg" ? "background" : "now"}`}>
                    {area[kind].map(([id]) => (
                      <FactorRow key={id} form={form} flag={`${area.id}.${kind}.${id}`} />
                    ))}
                  </ChipGroup>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </PanelDrawer>
  );
}

"use client";

/**
 * Triage and risk: the slide-outs, on the kit PanelDrawer.
 *
 * - Summary: the record (Summary, Referral, Last triage, Alerts, Profile), opened from the banner
 *   links, the section index and the phone bar. Summary holds "Before you sign" and the document
 *   the form builds as you go, which prints as SMHMR900 and SMHMR905.
 * - How to: the steps, Start a new triage and where each PSOLIS field went.
 * - All RAMP factors: every factor by area.
 *
 * Synthetic data only.
 */
import { ArrowUpRight, Copy, FilePlus2, History, Inbox, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";

import {
  Badge,
  Button,
  ChipGroup,
  DrawerFootRow,
  PanelDrawer,
  StatusGlyph,
  buttonClass,
  tableClasses,
  phoneRows,
  type WfTone,
} from "@/components/wf";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";

import {
  AREA_NAME,
  AREAS,
  FACTOR_NAME,
  HOW_TO,
  PSOLIS_FIELD_MAP,
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
import styles from "./triage-risk-form.module.css";

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

function Facts({ rows, className }: { rows: readonly (readonly [string, ReactNode])[]; className?: string }) {
  return (
    <dl className={className ? `${styles.facts} ${className}` : styles.facts}>
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
export function SummaryDocument({
  form,
  jump,
  signed,
  copyWhenSigned = false,
}: {
  form: FormApi;
  jump?: Jump;
  signed?: SignedBy;
  /** The slide-out keeps its whole-document Copy once signed; the signed page has its own Copy summary. */
  copyWhenSigned?: boolean;
}) {
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
        data-print-output
        data-wf-print-doc="triage"
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
          {signed && !copyWhenSigned ? null : (
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

/** A record tab: what the synthetic record holds, as one card of label and value rows. */
function RecordPane({
  title,
  badge,
  rows,
  note,
}: {
  title: string;
  /** A status beside the heading (the last triage's urgency). */
  badge?: ReactNode;
  rows: readonly (readonly [string, ReactNode])[];
  note?: string;
}) {
  return (
    <>
      <h3 className={styles.paneHead}>
        {title}
        {badge ? <span className={styles.pushEnd}>{badge}</span> : null}
      </h3>
      <Facts rows={rows} className={styles.recordCard} />
      {note ? <p className={styles.quiet}>{note}</p> : null}
    </>
  );
}

/** One group on the Alerts tab: a quiet heading with its count, then one row per item. */
function FlagGroup({
  title,
  items,
  tone,
  empty,
  tag,
}: {
  title: string;
  items: readonly string[];
  tone: WfTone;
  empty: string;
  tag?: string;
}) {
  const id = useId();
  return (
    <section className={styles.recordGroup} aria-labelledby={id}>
      <h3 className={styles.paneHead} id={id}>
        {title}
        {items.length > 1 ? <span className={`${styles.mono} ${styles.pushEnd}`}>{items.length}</span> : null}
      </h3>
      <ul className={styles.recordList}>
        {items.length ? (
          items.map((item) => (
            <li key={item} className={styles.recordItem} data-tone={tone}>
              <StatusGlyph tone={tone} size={12} />
              <span className={styles.grow}>{item}</span>
              {tag ? (
                <Badge size="sm" className={styles.noShrink}>
                  {tag}
                </Badge>
              ) : null}
            </li>
          ))
        ) : (
          <li className={styles.recordItem} data-tone="none">
            <StatusGlyph tone="neutral" size={12} />
            <span className={styles.missing}>{empty}</span>
          </li>
        )}
      </ul>
    </section>
  );
}

/**
 * Alerts, allergies and legal status, as the banner shows them, each as its own card of rows so a
 * glance reads what is there and what is not. Read-only: they are corrected on the patient record.
 */
function AlertsPane({ person }: { person: TriagePerson }) {
  const alerts = person.alerts?.length ? person.alerts : person.alert ? [person.alert] : [];
  const allergies = person.allergies === "Not recorded" ? [] : person.allergies.split(" · ");
  return (
    <>
      <FlagGroup title="Alerts" items={alerts} tone="warning" empty="No alerts recorded" />
      <FlagGroup title="Allergies" items={allergies} tone="danger" empty="Not recorded" />
      <FlagGroup
        title="Legal status"
        items={person.legal ? [person.legal] : []}
        tone="info"
        tag="Not legally checked"
        empty="Not recorded. Not legally checked."
      />
      <RecordLink person={person} note="These come from the patient record. Correct them there." />
    </>
  );
}

/** Where the record's details are corrected: a quiet line and the way to the record. */
function RecordLink({ person, note }: { person: TriagePerson; note: string }) {
  return (
    <div className={styles.recordFoot}>
      <p className={`${styles.quiet} ${styles.grow}`}>{note}</p>
      <Link href={person.recordHref} className={buttonClass({ className: styles.noShrink })}>
        <ArrowUpRight size={14} aria-hidden="true" />
        Open patient record
      </Link>
    </div>
  );
}

/** A record tab with nothing to show: one calm card that says so and what it means for this triage. */
function EmptyPane({ icon: IconShape, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className={styles.emptyCard}>
      <span className={styles.emptyIcon} aria-hidden="true">
        <IconShape size={18} />
      </span>
      <h3 className={styles.emptyTitle}>{title}</h3>
      <p className={styles.emptyText}>{text}</p>
    </div>
  );
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
  signed,
}: {
  form: FormApi;
  open: boolean;
  tab: string;
  onTab: (tab: string) => void;
  onClose: () => void;
  reqs: readonly Requirement[];
  jump: Jump;
  signButton: ReactNode;
  /** Once signed, every view and copy shows the signed record, read-only (Codex review, #1494). */
  signed?: SignedBy;
}) {
  const left = signed ? 0 : reqs.filter((r) => r.blocks && !r.ok).length;
  const person = form.state.person;
  return (
    <PanelDrawer
      open={open}
      onClose={onClose}
      title={person.name}
      subtitle="Record, referral and triage · Synthetic"
      tag={
        <Badge tone={left ? "neutral" : "success"} className={styles.noShrink}>
          {signed ? "Signed" : left ? `${left} needed` : "Ready to sign"}
        </Badge>
      }
      tabs={summaryTabs(person.alertCount)}
      tab={tab}
      onTabChange={onTab}
      tabsLabel="Slide-out"
      className={styles.wideDrawer}
      bodyClassName={styles.sheetBody}
      testId="triage-summary-sheet"
      foot={
        <>
          <span className={styles.footText}>
            {signed
              ? `Signed ${signed.at} by ${signed.by}`
              : left
                ? `Signing unlocks once all ${left} are done.`
                : "Everything needed is done. Ready to sign."}
          </span>
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
            {signed ? null : <BeforeYouSign reqs={reqs} jump={jump} />}
            <SummaryDocument form={form} jump={signed ? undefined : jump} signed={signed} copyWhenSigned />
          </>
        ) : null}
        {tab === "ref" ? (
          person.referral ? (
            <RecordPane
              // D-39: record numbers stay off screens; the referral is named by where it came from.
              title={`Referral from ${person.referral.from}`}
              rows={[
                ["From", person.referral.from],
                ["Urgency asked", person.referral.urgency ?? "No triage urgency asked"],
                ["Legal", legalWords(person)],
                ["Now at", person.nowAt],
              ]}
            />
          ) : (
            <EmptyPane
              icon={Inbox}
              title="No open referral"
              text="This triage starts without one. Record who asked for it in Review details."
            />
          )
        ) : null}
        {tab === "last" && !person.last ? (
          <EmptyPane
            icon={History}
            title="No previous triage on record"
            text="Past risk is answered fresh today. Nothing is carried forward."
          />
        ) : null}
        {tab === "last" && person.last ? (
          <RecordPane
            title={person.last.label}
            badge={<Badge size="sm">{person.last.urgencyText}</Badge>}
            rows={[
              ["Outcome", person.last.outcome],
              ["Legal", `${person.last.legal} (as chosen then). Not legally checked.`],
              ["Review risk by", person.last.review],
              [
                "Flags then",
                [...person.last.pastFlags, ...person.last.nowFlags].map((k) => FACTOR_NAME[k]).join(" · ") ||
                  "None marked present",
              ],
            ]}
            note="A signed triage keeps its codes only. Its typed assessment, formulation and plan are not carried."
          />
        ) : null}
        {tab === "alerts" ? <AlertsPane person={person} /> : null}
        {tab === "profile" ? (
          <>
            <RecordPane
              title="Identity"
              rows={[
                ["Name", person.name],
                ["Sex and age", person.meta],
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
            />
            <RecordLink person={person} note="Contacts and care details are on the patient record." />
          </>
        ) : null}
      </div>
    </PanelDrawer>
  );
}

export function HowToDrawer({
  open,
  onClose,
  onStartNew,
}: {
  open: boolean;
  onClose: () => void;
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
      bodyClassName={styles.sheetBody}
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
        <p className={styles.quiet}>
          <b>Saving.</b> Save draft is not wired, so leaving the page drops what you typed. Signing records only the
          urgency, outcome, legal status, review and risk flags on the patient. The typed assessment, mental state,
          formulation and plan are not part of that record.
        </p>
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
      bodyClassName={styles.sheetBody}
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

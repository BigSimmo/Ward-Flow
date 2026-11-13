"use client";

/**
 * Triage and risk: the slide-outs, on the kit PanelDrawer.
 *
 * - Summary: the record (Summary, Patient and referral, Previous triages, Alerts), opened from the
 *   banner links, the section index and the phone bar. Summary holds "Before you sign" and the
 *   document the form builds as you go, which prints as SMHMR900 and SMHMR905.
 * - How to: the steps, Start a new triage and where each PSOLIS field went.
 * - All RAMP factors: every factor by area.
 *
 * Synthetic data only.
 */
import { ArrowUpRight, Copy, History, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";

import {
  Badge,
  Button,
  ChipGroup,
  DrawerFootRow,
  Meter,
  PanelDrawer,
  StatusGlyph,
  buttonClass,
  type WfTone,
} from "@/components/wf";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";

import {
  AREA_NAME,
  AREAS,
  FACTOR_NAME,
  SECTIONS,
  type PreviousTriage,
  type SectionId,
  type TriagePerson,
} from "./triage-risk-data";
import { Choice, type FormApi } from "./triage-risk-parts";
import { isbarText } from "./triage-risk-isbar";
import { legalLine } from "./triage-risk-people";
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

/**
 * The slide-out's tabs (Josh, 9 Nov 2026): four, not five. Patient and referral holds what were the
 * Referral and Profile tabs; Previous triages lists every earlier signed triage, not only the last.
 */
const summaryTabs = (alertCount: number, previousCount: number) => [
  { id: "sum", label: "Summary" },
  { id: "patient", label: "Patient and referral" },
  { id: "prev", label: "Previous triages", ...(previousCount ? { count: previousCount } : {}) },
  { id: "alerts", label: "Alerts", ...(alertCount ? { count: alertCount } : {}) },
];

/** The person's earlier signed triages, newest first; a fixture that names only `last` gives that one. */
const previousOf = (person: TriagePerson): readonly PreviousTriage[] =>
  person.previous ?? (person.last ? [person.last] : []);

/** Who the triage is for, in record words: legal status on record, never checked (D-186, Q11). */
const legalWords = (person: TriagePerson) => (person.legal ? legalLine(person) : "Not recorded. Not legally checked.");

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
    return (
      <Facts
        rows={block.rows.map(
          ([label, value]) =>
            [
              label,
              // A value with nothing recorded is marked so the printed copy can grey the whole line.
              value.every((bit) => typeof bit !== "string") ? (
                <span key={label} data-wf-print-blank="">
                  <Value value={value} />
                </span>
              ) : (
                <Value key={label} value={value} />
              ),
            ] as const,
        )}
      />
    );
  if (block.kind === "missing")
    return (
      <p className={styles.missing} data-wf-print-blank="">
        {block.text}
      </p>
    );
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
  const model = summaryModel(state, signed, form.reviewer);
  const copy = () =>
    copyText(summaryText(model), "Summary copied.", "Copy not allowed here. Select the summary text instead.", say);
  const copyIsbar = () =>
    copyText(
      isbarText(state, signed, form.reviewer),
      "iSoBAR copied.",
      "Copy not allowed here. Select the summary text instead.",
      say,
    );

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
            <span className={styles.docCopies}>
              <Button variant="ghost" size="sm" icon={Copy} onClick={copy} data-testid="triage-copy-summary">
                Copy
              </Button>
              <Button variant="ghost" size="sm" icon={Copy} onClick={copyIsbar} data-testid="triage-copy-isbar">
                Copy as iSoBAR
              </Button>
            </span>
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

/** The names of a section's open items: the first three, then "+N". Items to check read quieter. */
function OpenNames({ items }: { items: readonly Requirement[] }) {
  const shown = items.slice(0, 3);
  return (
    <span className={styles.signCheckItems}>
      {shown.map((r, index) => (
        <span key={`${index}-${r.label}`} className={r.blocks ? undefined : styles.signCheckSoft}>
          {index ? ", " : ""}
          {r.label}
        </span>
      ))}
      {items.length > shown.length ? (
        <span className={styles.signCheckSoft}> +{items.length - shown.length}</span>
      ) : null}
    </span>
  );
}

/**
 * "Before you sign" (Josh, 9 Nov 2026): one compact block instead of a chip per item. The head
 * counts what is needed and what to check and goes to the next needed item; a bar shows how much of
 * what is needed is done; then one line per section with its open items, each line going to that
 * section's first. Risk and plan wait behind Show while the triage sections still need answers.
 */
function BeforeYouSign({ reqs, jump }: { reqs: readonly Requirement[]; jump: Jump }) {
  const [showLater, setShowLater] = useState(false);
  const blocking = reqs.filter((r) => r.blocks);
  const needed = blocking.filter((r) => !r.ok);
  const toCheck = reqs.filter((r) => !r.blocks && !r.ok);
  const counts = [needed.length ? `${needed.length} needed` : "", toCheck.length ? `${toCheck.length} to check` : ""]
    .filter(Boolean)
    .join(" · ");
  const next = needed[0] ?? toCheck[0];
  const rows = SECTIONS.map((section) => {
    const open = reqs.filter((r) => r.section === section.id && !r.ok);
    // Needed items first, then the ones to check, each in the form's order.
    return { section, open: [...open.filter((r) => r.blocks), ...open.filter((r) => !r.blocks)] };
  });
  const triageLeft = rows.some((row) => row.section.n <= 4 && row.open.some((r) => r.blocks));
  const folded = triageLeft && !showLater;
  const laterNeeded = rows
    .filter((row) => row.section.n >= 5)
    .reduce((sum, row) => sum + row.open.filter((r) => r.blocks).length, 0);

  return (
    <section className={styles.signCheck} aria-labelledby="triage-sign-check-title" data-testid="triage-sign-check">
      <div className={styles.signCheckHead}>
        <StatusGlyph tone={needed.length ? "neutral" : "success"} size={10} />
        <h3 className={styles.signCheckTitle} id="triage-sign-check-title">
          {needed.length ? "Before you sign" : "Ready to sign"}
        </h3>
        <span className={`${styles.mono} ${styles.pushEnd}`}>{counts}</span>
        {next ? (
          <Button size="sm" onClick={() => jump(next.section, next.target)} data-testid="triage-sign-check-next">
            Go to next
          </Button>
        ) : null}
      </div>
      {blocking.length ? (
        <Meter
          value={blocking.length - needed.length}
          max={blocking.length}
          fill="success"
          label="Needed answers done"
          valueText={`${blocking.length - needed.length} of ${blocking.length} done`}
          className={styles.signCheckBar}
        />
      ) : null}
      <ul className={styles.signCheckList}>
        {rows
          .filter((row) => !(folded && row.section.n >= 5))
          .map(({ section, open }) => {
            const name = (
              <span className={styles.signCheckName}>
                <span className={styles.mono}>{section.n}</span> {section.label}
              </span>
            );
            if (!open.length)
              return (
                <li key={section.id} className={styles.signCheckRow} data-done="">
                  <StatusGlyph tone="success" size={8} />
                  {name}
                  <span className={styles.signCheckSoft}>Done</span>
                </li>
              );
            const first = open[0];
            const neededHere = open.filter((r) => r.blocks).length;
            return (
              <li key={section.id}>
                <button
                  type="button"
                  className={styles.signCheckRow}
                  onClick={() => jump(first.section, first.target)}
                  aria-label={`${section.label}: ${open.length} open. Go to ${first.label}.`}
                >
                  <StatusGlyph tone={neededHere ? "neutral" : "warning"} size={8} />
                  {name}
                  <OpenNames items={open} />
                  <span
                    className={neededHere ? styles.signCheckCount : `${styles.signCheckCount} ${styles.signCheckSoft}`}
                  >
                    {open.length}
                  </span>
                </button>
              </li>
            );
          })}
      </ul>
      {triageLeft ? (
        <Button
          variant="ghost"
          size="sm"
          className={styles.signCheckMore}
          onClick={() => setShowLater((v) => !v)}
          aria-expanded={!folded}
        >
          {folded ? `Show 5 and 6${laterNeeded ? ` · ${laterNeeded} needed` : ""}` : "Hide 5 and 6"}
        </Button>
      ) : null}
    </section>
  );
}

/** A record tab: what the synthetic record holds, as one card of label and value rows. */
function RecordPane({
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

/**
 * Previous triages (Josh, 9 Nov 2026): this person's earlier signed triages, newest first, one row
 * each from the workspace record. Codes only; nothing typed was kept, so nothing typed is shown.
 */
function PreviousPane({ person }: { person: TriagePerson }) {
  const previous = previousOf(person);
  if (!previous.length)
    return (
      <EmptyPane
        icon={History}
        title="No earlier triage for this person."
        text="Past risk is answered fresh today. Nothing is carried forward."
      />
    );
  const carried = previous[0].pastFlags.map((key) => FACTOR_NAME[key] ?? key);
  return (
    <>
      <h3 className={styles.paneHead}>
        Signed triages
        <span className={`${styles.mono} ${styles.pushEnd}`}>{previous.length}</span>
      </h3>
      <ul className={styles.prevList} data-testid="triage-previous-list">
        {previous.map((item, index) => (
          <li key={`${index}-${item.when}`} className={styles.prevItem}>
            <span className={styles.prevWhen}>{item.when}</span>
            <Badge size="sm" className={styles.noShrink}>
              {item.urgencyText}
            </Badge>
            <span className={styles.prevFacts}>
              {[
                item.outcome,
                // D-186 (Q11): a status picked from buttons reads "as chosen"; the row's date already says when.
                `${item.legal} (as chosen)`,
                `Review by ${item.review}`,
                `Signed by ${item.by ?? "–"}`,
              ].join(" · ")}
            </span>
          </li>
        ))}
      </ul>
      {carried.length ? (
        <p className={styles.quiet}>
          Carry forward in Risk assessment brings past flags from the {previous[0].when} triage only:{" "}
          {carried.join(", ")}. Typed notes are never kept.
        </p>
      ) : null}
    </>
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
      tabs={summaryTabs(person.alertCount, previousOf(person).length)}
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
        {tab === "patient" ? (
          <>
            {person.referral ? (
              <RecordPane
                // D-39: record numbers stay off screens; the referral is named by where it came from.
                title={`Referral from ${person.referral.from}`}
                rows={[
                  ["From", person.referral.from],
                  ["Urgency asked", person.referral.urgency ?? "No triage urgency asked"],
                  ...(person.referral.received ? [["Received", person.referral.received] as const] : []),
                ]}
              />
            ) : (
              <FlagGroup
                title="Referral"
                items={[]}
                tone="neutral"
                empty="No open referral. Record who asked for it in Review details."
              />
            )}
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
        {tab === "prev" ? <PreviousPane person={person} /> : null}
        {tab === "alerts" ? <AlertsPane person={person} /> : null}
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
                  <ChipGroup
                    label={`${area.name}: ${kind === "bg" ? "background" : "now"}`}
                    className={styles.factorList}
                  >
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

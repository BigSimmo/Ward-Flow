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
import { Copy } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

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
  FORMULATION_HEADINGS,
  HOW,
  HOW_TO,
  LEGAL,
  PATIENT,
  PSOLIS_FIELD_MAP,
  REFERRER_URGENCY,
  REVIEW,
  TIER_LONG,
  type SectionId,
} from "./triage-risk-data";
import { Choice, type FormApi } from "./triage-risk-parts";
import { FactorChip } from "./triage-risk-risk";
import {
  allFactors,
  areaShortName,
  fdvOutcome,
  hasLegalForm,
  mseLines,
  sinceLastText,
  type Requirement,
} from "./triage-risk-state";
import { parseHeadedText } from "./triage-risk-text";
import styles from "./triage-risk-redesign.module.css";

const SUMMARY_TABS = [
  { id: "sum", label: "Summary" },
  { id: "ref", label: "Referral" },
  { id: "last", label: "Last triage" },
  { id: "alerts", label: "Alerts", count: PATIENT.alertCount },
  { id: "profile", label: "Profile" },
];

const HOW_NAME: Readonly<Record<string, string>> = Object.fromEntries(HOW);
const LEGAL_SHORT: Readonly<Record<string, string>> = Object.fromEntries(LEGAL.map(([v, , short]) => [v, short]));
const REVIEW_NAME: Readonly<Record<string, string>> = Object.fromEntries(REVIEW);
const SITUATION = ["Why now", "Request", "Views"];

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

function DocSection({
  letter,
  title,
  onEdit,
  children,
}: {
  letter: string;
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section className={styles.docSection}>
      <h3 className={styles.docHead}>
        <span className={styles.mono} aria-hidden="true">
          {letter}
        </span>
        {title}
        <Button variant="ghost" size="sm" className={styles.pushEnd} onClick={onEdit} aria-label={`Edit ${title}`}>
          Edit
        </Button>
      </h3>
      {children}
    </section>
  );
}

/** The document the form builds as it is filled in. */
function SummaryDocument({ form, jump }: { form: FormApi; jump: (section: SectionId) => void }) {
  const { state, say } = form;
  const ref = useRef<HTMLElement>(null);
  const [full, setFull] = useState(false);
  const notes = parseHeadedText(state.text.note);
  const plan = parseHeadedText(state.text.rp);
  const situation = notes.filter(([h]) => SITUATION.includes(h));
  const background = notes.filter(([h]) => !SITUATION.includes(h));
  const formulation = plan.filter(([h]) => (FORMULATION_HEADINGS as readonly string[]).includes(h));
  const safety = plan.filter(([h]) => !(FORMULATION_HEADINGS as readonly string[]).includes(h));
  const mental = mseLines(state);
  const factors = allFactors(state);
  const present = factors.filter((f) => f.mark === "y");
  const unknown = factors.filter((f) => f.mark === "u");
  const pastPresent = present.filter((f) => f.kind === "bg");
  const nowPresent = present.filter((f) => f.kind === "now");
  const byArea = new Map<string, string[]>();
  for (const f of nowPresent) byArea.set(f.area, [...(byArea.get(f.area) ?? []), f.name]);
  const restNow = factors.filter((f) => f.kind === "now" && !f.mark).length;
  const restBg = factors.filter((f) => f.kind === "bg" && !f.mark).length;
  const since = sinceLastText(state);
  const fdv = fdvOutcome(state);
  const actions = [...state.actions, ...(state.copyGiven.length ? [`Plan copy to ${state.copyGiven.join(", ")}`] : [])];
  const otherNow = state.xr.filter((x) => x.k !== "bg").map((x) => x.t);
  const otherPast = state.xr.filter((x) => x.k === "bg").map((x) => x.t);
  const pairs = (list: readonly [string, string][]) => <Facts rows={list.map(([h, t]) => [h || "Note", t] as const)} />;

  const copy = () => {
    const doc = ref.current?.cloneNode(true) as HTMLElement | undefined;
    if (!doc) return;
    doc.querySelectorAll("button, [data-no-copy]").forEach((node) => node.remove());
    const text = (doc.innerText || doc.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
    copyText(text, "Summary copied.", "Copy not allowed here. Select the summary text instead.", say);
  };

  return (
    <>
      <article
        ref={ref}
        className={styles.doc}
        data-capped={full ? undefined : ""}
        aria-labelledby="triage-doc-title"
        data-testid="triage-summary-document"
      >
        <div className={styles.docTop}>
          <div className={styles.grow}>
            <div className={styles.quiet}>Mental health triage and risk · synthetic</div>
            <div className={styles.docTitle} id="triage-doc-title">
              {PATIENT.name} {/* The UMRN stays on screen and is left out of a copy (ward-clipboard.ts). */}
              <span className={styles.mono} data-no-copy="">
                {PATIENT.umrn} · {PATIENT.meta.split(" · ")[1]}
              </span>
            </div>
            <div className={styles.quiet}>
              {state.text.revTime ? `${state.text.revTime} · ` : ""}
              {state.how ? HOW_NAME[state.how] : "how not set"}
              {state.where ? ` · ${state.where}` : ""} · {PATIENT.author} · referral from Synthetic ED
            </div>
          </div>
          <Button variant="ghost" size="sm" icon={Copy} onClick={copy}>
            Copy
          </Button>
        </div>
        <Facts
          rows={[
            ["Urgency", state.urgency ? `${state.urgency} · ${TIER_LONG[state.urgency]}` : <Missing>–</Missing>],
            ["Outcome", state.outcome ?? <Missing>–</Missing>],
            [
              "Legal",
              state.legal ? (
                `${LEGAL_SHORT[state.legal]}${hasLegalForm(state) && state.text.legalForm.trim() ? ` · ${state.text.legalForm.trim()} (as typed)` : ""}`
              ) : (
                <Missing>–</Missing>
              ),
            ],
            ["Review risk", state.review ? REVIEW_NAME[state.review] : <Missing>–</Missing>],
          ]}
        />
        <DocSection letter="S" title="Situation" onEdit={() => jump("note")}>
          {situation.length ? pairs(situation) : <p className={styles.missing}>Reason not written yet.</p>}
          {state.problems.length ? <p className={styles.docNote}>Problems: {state.problems.join(", ")}.</p> : null}
        </DocSection>
        <DocSection letter="B" title="Background" onEdit={() => jump("note")}>
          {background.length ? pairs(background) : <p className={styles.missing}>Not written yet.</p>}
        </DocSection>
        <DocSection letter="A" title="Assessment" onEdit={() => jump("mse")}>
          {mental.length ? pairs(mental) : <p className={styles.missing}>Mental state not written yet.</p>}
          {formulation.length ? pairs(formulation) : null}
          <Facts
            rows={[
              ["Current risk", nowPresent.length ? `${nowPresent.length} present` : "None flagged"],
              ...[...byArea.entries()].map(([area, names]) => [areaShortName(area), names.join(", ")] as const),
              ...(otherNow.length ? [["Other current", otherNow.join(", ")] as const] : []),
              ...(otherPast.length ? [["Other past", otherPast.join(", ")] as const] : []),
              [
                "Past risk",
                pastPresent.length ? (
                  <>
                    {pastPresent.map((f) => f.name).join(", ")}
                    {state.fromLast.length ? <Missing> (from 12 Oct RAMP, checked)</Missing> : null}
                  </>
                ) : state.restPast ? (
                  "None recorded"
                ) : (
                  <Missing>Not answered</Missing>
                ),
              ],
            ]}
          />
          {since ? <p className={styles.docNote}>{since}</p> : null}
          <p className={styles.docNote}>
            {unknown.length ? `Not known: ${unknown.map((f) => f.name.toLowerCase()).join(", ")}. ` : ""}
            Other current factors ({restNow}):{" "}
            {state.rest === "np" ? "not present" : state.rest === "na" ? "not assessed" : "not answered"}. Other history
            ({restBg}):{" "}
            {state.restPast === "np" ? "not present" : state.restPast === "nk" ? "not known" : "not answered"}. FDV
            screen: {(fdv ?? "not done").toLowerCase()}.{state.changeable === "yes" ? " Risk may change quickly." : ""}
            {state.uncertain === "yes" ? " Some factors add uncertainty." : ""}
          </p>
        </DocSection>
        <DocSection letter="R" title="Plan" onEdit={() => jump("plan")}>
          {safety.length ? pairs(safety) : <p className={styles.missing}>Safety plan not written yet.</p>}
          {actions.length ? (
            <ul className={styles.docTags} aria-label="Actions">
              {actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          ) : null}
          {state.text.consultWho.trim() ? (
            <p className={styles.docNote}>Consulted: {state.text.consultWho.trim()}</p>
          ) : null}
          {state.urgency && state.urgency !== REFERRER_URGENCY && state.text.urgReason.trim() ? (
            <p className={styles.docNote}>
              Referrer urgency {REFERRER_URGENCY}, changed to {state.urgency}: {state.text.urgReason.trim()}
            </p>
          ) : null}
          {state.actions.includes("Bed request") ? (
            <p className={styles.docNote}>
              Medical clearance:{" "}
              {{ yes: "cleared", pending: "pending", na: "not needed" }[state.medical ?? ""] ?? "not recorded"}.
            </p>
          ) : null}
          {state.ahd && state.ahd !== "none" ? (
            <p className={styles.docNote}>
              {state.ahd === "ahd"
                ? `Advance health directive${state.ahdCopy === "onfile" ? " on the record" : state.ahdCopy === "toget" ? ", copy to be provided" : ""}: follow any relevant decision.`
                : state.ahd === "guard"
                  ? "Guardian in place."
                  : "Directive or guardian not asked."}
            </p>
          ) : null}
        </DocSection>
        <p className={styles.docFoot}>
          Prints as SMHMR900 and SMHMR905
          {state.sources.length ? ` · Collateral: ${state.sources.join(", ")}` : ""}
          {state.episode ? ` · ${state.episode} episode` : ""}
          {hasLegalForm(state) ? " · Legal form as typed. Not legally checked." : ""}
        </p>
      </article>
      <Button
        variant="ghost"
        size="sm"
        className={styles.centre}
        onClick={() => setFull((v) => !v)}
        aria-expanded={full}
      >
        {full ? "Show less" : "Show full summary"}
      </Button>
    </>
  );
}

function BeforeYouSign({ reqs, jump }: { reqs: readonly Requirement[]; jump: (section: SectionId) => void }) {
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
        <ChipGroup label="Go to what is left">
          {[...needed, ...toCheck].map((r) => (
            <Button key={r.label} size="sm" className={phoneRows.chip} onClick={() => jump(r.section)}>
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
  jump: (section: SectionId) => void;
  signButton: ReactNode;
}) {
  const left = reqs.filter((r) => r.blocks && !r.ok).length;
  return (
    <PanelDrawer
      open={open}
      onClose={onClose}
      title={PATIENT.name}
      subtitle="This triage, the referral and the record. Synthetic."
      tag={
        <Badge tone={left ? "neutral" : "success"} className={styles.noShrink}>
          {left ? `${left} needed` : "Ready to sign"}
        </Badge>
      }
      tabs={SUMMARY_TABS}
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
        {tab === "ref" ? (
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
                ["Legal", "CTO, Form 5A (as typed). Not legally checked."],
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
        {tab === "last" ? (
          <>
            <h3 className={styles.paneHead}>Last triage and RAMP · 12 Oct · Synthetic CMHT</h3>
            <Facts
              rows={[
                ["Urgency", "D within 48 hours"],
                ["Outcome", "Community follow-up; depot restarted"],
                [
                  "Flags then",
                  "Previous violence (history) · Weapons history · Absconding history · Significant alcohol or drug use",
                ],
                [
                  "Formulation",
                  "Risk to others rises with relapse and stopping treatment; settles on depot with family support.",
                ],
                [
                  "Safety plan",
                  "Depot fortnightly; mother to call the team if sleep drops; crisis line on the fridge.",
                ],
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
        {tab === "alerts" ? (
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
            <p className={styles.quiet}>Allergies: {PATIENT.allergies}</p>
          </>
        ) : null}
        {tab === "profile" ? (
          <>
            <h3 className={styles.paneHead}>Identity</h3>
            <Facts
              rows={[
                ["Name", `${PATIENT.name} · ${PATIENT.meta}`],
                [
                  "UMRN",
                  <span key="u" className={styles.mono}>
                    {PATIENT.umrn}
                  </span>,
                ],
                [
                  "DOB",
                  <span key="d" className={styles.mono}>
                    {PATIENT.dob}
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
                ["Legal", "CTO, Form 5A (as typed). Not legally checked."],
                ["Directive", "None recorded"],
                ["Nominated person", "None recorded"],
                ["Last contact", "30 Oct · depot clinic, missed"],
                ["Allergies", PATIENT.allergies],
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
}: {
  open: boolean;
  onClose: () => void;
  example: "example" | "blank";
  onExample: (value: "example" | "blank") => void;
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
            onChange={(v) => form.set("rest", v)}
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
                    {area[kind].map(([id, name]) => (
                      <FactorChip key={id} form={form} flag={`${area.id}.${kind}.${id}`} name={name} />
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

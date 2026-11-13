"use client";

import { Check, Info, Lock, LogOut, MessageCircle, Minus, Users } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardHead,
  Count,
  Hero,
  HeroAct,
  HeroFigures,
  HeroQuickChips,
  HeroTop,
} from "@/components/wf";
import { useCanLeaveDemo, useLeaveDemo } from "@/components/ward-management/shell/leave-demo";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import styles from "./about-demo.module.css";

/**
 * F-77 (Audit 15, A15-25): "About this demo". Plain facts for anyone shown the demo: what it is, that
 * every record is invented, what this browser keeps and sends, and how to leave. Every line is a fact
 * the source proves (Audit 15, "What the site sends and keeps", re-checked 13 Nov 2026 against
 * `api/session`, `front-door-pass.ts`, `ward-browser-data.ts`, `ward-flow-push-sw.js`,
 * `security-headers.ts` and `browser-error-report.ts`). Keep it that way when any of those change.
 * No clinical content.
 */

/** `meta` is the fact's scope or time. Figures and durations show in mono; words show as a small tag. */
type Row = { id: string; title: string; sub?: string; meta: string; figure?: boolean };

const IS = [
  "A demonstration of bed flow across WA mental health services",
  "Run on invented records only",
  "Kept in this browser",
] as const;

const IS_NOT = ["Connected to any hospital record", "Clinical decision support", "Approved for clinical use"] as const;

const DATA: readonly Row[] = [
  {
    id: "people",
    title: "Patients and staff",
    sub: "Invented names, records, phone numbers and events. No real person's information.",
    meta: "Invented",
  },
  {
    id: "places",
    title: "Hospitals and wards",
    sub: "Real WA service names, so the screens feel familiar. Their figures, rules and events are invented.",
    meta: "Real names",
  },
  {
    id: "endorsed",
    title: "Endorsement",
    sub: "No health service has endorsed or reviewed this demo.",
    meta: "None",
  },
];

const KEPT: readonly Row[] = [
  {
    id: "tab",
    title: "Working copy of the demo",
    sub: "Typed notes are left out. It goes when you close every demo tab.",
    meta: "This tab",
  },
  {
    id: "device",
    title: "Display settings, pins and reminders",
    sub: "Kept by code or ward name, never a patient's name.",
    meta: "This device",
  },
  {
    id: "offline",
    title: "App files for offline use",
    sub: "Code and icons only, never pages or records.",
    meta: "This device",
  },
  {
    id: "pass",
    title: "Demo pass",
    sub: "Signed. Holds neither the code nor your name.",
    meta: "8 hours",
    figure: true,
  },
  { id: "door", title: "Door marker", sub: "Says this site asks for a code.", meta: "30 days", figure: true },
];

const SENT: readonly Row[] = [
  { id: "changes", title: "Your changes", sub: "Nothing you do is saved on a server.", meta: "Not sent" },
  { id: "code", title: "Your demo code", sub: "Once, when you enter it, to open the demo.", meta: "This site" },
  {
    id: "error",
    title: "Error report, if a page breaks",
    sub: "The kind of error, which screen, the version and your desk. Never a name or anything you typed.",
    meta: "4 fields",
    figure: true,
  },
  { id: "outside", title: "Analytics, adverts, other sites", meta: "None" },
];

function Rows({ rows, testId }: { rows: readonly Row[]; testId: string }) {
  return (
    <ul className={styles.rows} data-testid={testId}>
      {rows.map((row) => (
        <li key={row.id} className={styles.row}>
          <span className={styles.rowMain}>
            <span className={styles.rowTitle}>{row.title}</span>
            {row.sub ? <span className={styles.rowSub}>{row.sub}</span> : null}
          </span>
          {row.figure ? (
            <span className={styles.rowFigure}>{row.meta}</span>
          ) : (
            <Badge size="sm" className={styles.rowTag}>
              {row.meta}
            </Badge>
          )}
        </li>
      ))}
    </ul>
  );
}

function GroupHead({ id, label, count }: { id: string; label: string; count: number }) {
  return (
    <h3 className={styles.groupHead} id={id}>
      {label}
      <Count n={count} className={styles.groupCount} />
    </h3>
  );
}

export function AboutDemoScreen() {
  const canLeave = useCanLeaveDemo();
  const leave = useLeaveDemo();

  return (
    <main id="main-content" className={styles.main} data-testid="ward-about-demo">
      <Hero level={1} title="About this demo" titleMeta="Synthetic data only · Not for clinical use">
        <HeroTop
          quickBar={false}
          figures={
            <HeroFigures
              label="This demo"
              testId="about-figures"
              items={[
                { id: "patients", value: 0, label: "real patients", testId: "about-figure-patients" },
                { id: "outside", value: 0, label: "outside sites", testId: "about-figure-outside" },
                { id: "pass", value: 8, unit: "h", label: "demo pass", testId: "about-figure-pass" },
              ]}
            />
          }
          act={
            <HeroAct
              tone="warning"
              testId="about-hero-act"
              title="Never type a real person's details"
              sub="Every record here is invented."
              action={
                canLeave
                  ? { label: "Leave the demo", phoneLabel: "Leave", onClick: leave, testId: "about-leave-demo-hero" }
                  : undefined
              }
            />
          }
          chips={
            <HeroQuickChips
              label="On this page"
              items={[
                { id: "what", label: "What this is", icon: <Info size={14} aria-hidden="true" />, href: "#about-what" },
                { id: "data", label: "The data", icon: <Users size={14} aria-hidden="true" />, href: "#about-data" },
                {
                  id: "privacy",
                  label: "Your privacy",
                  icon: <Lock size={14} aria-hidden="true" />,
                  href: "#about-privacy",
                },
                { id: "leave", label: "Leaving", icon: <LogOut size={14} aria-hidden="true" />, href: "#about-leave" },
              ]}
            />
          }
        />
      </Hero>

      <div className={styles.layout}>
        <div className={styles.column}>
          <Card aria-labelledby="about-what-title" data-testid="about-what" id="about-what">
            <CardHead iconPlain icon={Info} id="about-what-title" title="What this is" />
            <p className={styles.lead}>
              Ward Flow is a prototype for coordinating psychiatric beds across Western Australia: who needs a bed,
              where one is free, and what is holding each move up. Nothing on screen should guide anyone&apos;s care.
            </p>
            <div className={styles.isGrid}>
              <div>
                <h3 className={styles.capsLabel}>It is</h3>
                <ul className={styles.isList}>
                  {IS.map((line) => (
                    <li key={line}>
                      <Check size={14} aria-hidden="true" className={styles.isGlyph} />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className={styles.capsLabel}>It is not</h3>
                <ul className={styles.isList} data-testid="about-is-not">
                  {IS_NOT.map((line) => (
                    <li key={line}>
                      <Minus size={14} aria-hidden="true" className={styles.isNotGlyph} />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <Card aria-labelledby="about-data-title" data-testid="about-data" id="about-data">
            <CardHead iconPlain icon={Users} id="about-data-title" title="The data is invented" />
            <Rows rows={DATA} testId="about-data-rows" />
          </Card>

          <Card aria-labelledby="about-privacy-title" data-testid="about-privacy" id="about-privacy">
            <CardHead
              iconPlain
              icon={Lock}
              id="about-privacy-title"
              title="Your privacy"
              meta="Checked against the app's code, 13 Nov 2026"
            />
            <section aria-labelledby="about-kept-title" data-testid="about-kept">
              <GroupHead id="about-kept-title" label="Kept in this browser" count={KEPT.length} />
              <Rows rows={KEPT} testId="about-kept-facts" />
            </section>
            <section aria-labelledby="about-sent-title" data-testid="about-sent">
              <GroupHead id="about-sent-title" label="Sent from this browser" count={SENT.length} />
              <Rows rows={SENT} testId="about-sent-facts" />
            </section>
          </Card>
        </div>

        <aside className={styles.rail} aria-label="Leaving and questions">
          <Card aria-labelledby="about-leave-title" data-testid="about-leave" id="about-leave">
            <CardHead iconPlain icon={LogOut} id="about-leave-title" title="Leaving" />
            <ol className={styles.steps}>
              <li>
                <span className={styles.stepNo}>1</span>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>Leave the demo</span>
                  <span className={styles.rowSub}>Clears the demo, your pins and reminders, and ends your pass.</span>
                </span>
              </li>
              <li>
                <span className={styles.stepNo}>2</span>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>Clear this site&apos;s data</span>
                  <span className={styles.rowSub}>
                    Optional. In your browser settings, to remove display settings and offline files too.
                  </span>
                </span>
              </li>
            </ol>
            {canLeave ? (
              <div className={styles.foot}>
                <Button icon={LogOut} onClick={leave} data-testid="about-leave-demo">
                  Leave the demo
                </Button>
              </div>
            ) : null}
          </Card>

          <Card aria-labelledby="about-questions-title" data-testid="about-questions">
            <CardHead iconPlain icon={MessageCircle} id="about-questions-title" title="Questions" />
            <p className={styles.lead}>Ask the person who showed you this demo.</p>
            <p className={styles.quietFoot}>
              Screens may be shown on a shared display. Everything on them is invented.
            </p>
          </Card>
        </aside>
      </div>

      <WardPrototypeFooter testId="about-footer" />
    </main>
  );
}

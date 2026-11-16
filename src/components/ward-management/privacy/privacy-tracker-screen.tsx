"use client";

import { BookOpen, ListChecks, LockKeyhole, Users } from "lucide-react";
import { useState } from "react";

import { Badge, Card, CardHead, Hero, HeroAct, HeroFigures, HeroTop, HeroTrack, type WfTone } from "@/components/wf";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import {
  PRIVACY_CHECKED_ON,
  PRIVACY_ROLES,
  PRIVACY_SECTIONS,
  PRIVACY_SIGN_OFFS,
  type PrivacyCheck,
  type PrivacyCheckStatus,
} from "./privacy-tracker-data";
import styles from "./privacy-tracker.module.css";

/**
 * D-259 (Josh, 16 Nov 2026): Privacy and data. Where the app stands today against each Australian
 * and WA requirement for patient health data, with the evidence for each status, and a second view
 * of the finished policy written as if every requirement were met. Reference only: nothing here is
 * enforced, the app holds synthetic data, and it is not legal advice. Content lives in
 * `privacy-tracker-data.ts`.
 */

type View = "current" | "example";

const STATUS: Record<PrivacyCheckStatus, { label: string; tone: WfTone }> = {
  met: { label: "Met", tone: "success" },
  partly: { label: "Partly", tone: "warning" },
  notyet: { label: "Not yet", tone: "neutral" },
};

const ALL_CHECKS: readonly PrivacyCheck[] = [...PRIVACY_SECTIONS.flatMap((s) => s.checks), ...PRIVACY_SIGN_OFFS];

function count(checks: readonly PrivacyCheck[], status: PrivacyCheckStatus): number {
  return checks.filter((c) => c.status === status).length;
}

const TOTAL = ALL_CHECKS.length;
const MET = count(ALL_CHECKS, "met");
const PARTLY = count(ALL_CHECKS, "partly");
const NOT_YET = count(ALL_CHECKS, "notyet");

function Checks({ checks, view, testId }: { checks: readonly PrivacyCheck[]; view: View; testId: string }) {
  return (
    <ul className={styles.checks} data-testid={testId}>
      {checks.map((check) => {
        const status = view === "example" ? STATUS.met : STATUS[check.status];
        return (
          <li key={check.name} className={styles.check} data-status={view === "example" ? "met" : check.status}>
            <span className={styles.checkMain}>
              <span className={styles.checkName}>{check.name}</span>
              {view === "current" ? <span className={styles.evidence}>{check.evidence}</span> : null}
            </span>
            <Badge size="sm" tone={status.tone} className={styles.status}>
              {status.label}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}

export function PrivacyTrackerScreen() {
  const [view, setView] = useState<View>("current");
  const example = view === "example";

  return (
    <main id="main-content" className={styles.main} data-testid="ward-privacy" data-view={view}>
      <Hero level={1} title="Privacy and data" titleMeta="Not enforced · Synthetic data only · Not legal advice">
        <HeroTop
          quickBar={false}
          figures={
            <HeroFigures
              label="Requirements"
              testId="privacy-figures"
              items={
                example
                  ? [{ id: "ticked", value: TOTAL, label: `of ${TOTAL} met`, testId: "privacy-figure-ticked" }]
                  : [
                      { id: "met", value: MET, label: "met", testId: "privacy-figure-met" },
                      { id: "partly", value: PARTLY, label: "partly", testId: "privacy-figure-partly" },
                      { id: "notyet", value: NOT_YET, label: "not yet", testId: "privacy-figure-notyet" },
                      { id: "total", value: TOTAL, label: "checks", testId: "privacy-figure-total" },
                    ]
              }
            />
          }
          act={
            <HeroAct
              tone="warning"
              testId="privacy-hero-act"
              title="A target, not a promise"
              sub="Nothing here is enforced yet."
            />
          }
        >
          <HeroTrack
            label="View"
            value={view}
            onChange={setView}
            items={[
              { id: "current", label: "Current state" },
              { id: "example", label: "Example: all met" },
            ]}
          />
        </HeroTop>
      </Hero>

      <div className={styles.layout}>
        <div className={styles.column}>
          <Card aria-labelledby="privacy-short-title" data-testid="privacy-short">
            <CardHead
              iconPlain
              icon={ListChecks}
              id="privacy-short-title"
              title="In short"
              meta={example ? "Example policy" : `Checked ${PRIVACY_CHECKED_ON}`}
            />
            {example ? (
              <p className={styles.lead}>
                Ward Flow holds patient information only for bed flow and care coordination. It is hosted in Australia,
                every access is logged, and every requirement below is shown as met. This is an example of a finished
                policy, not how the app works today.
              </p>
            ) : (
              <p className={styles.lead}>
                Ward Flow meets {MET} of {TOTAL} checks today and has started {PARTLY} more. The biggest gaps: no
                privacy officer or signed privacy impact assessment, hosting partly offshore, multi-factor sign-in not
                required, no penetration test, no database backups, and a public code repository.
              </p>
            )}
          </Card>

          {PRIVACY_SECTIONS.map((section, index) => {
            const met = count(section.checks, "met");
            const titleId = `privacy-${section.id}-title`;
            return (
              <Card
                key={section.id}
                id={`privacy-${section.id}`}
                aria-labelledby={titleId}
                data-testid={`privacy-section-${section.id}`}
              >
                <CardHead
                  id={titleId}
                  title={`${index + 1}. ${section.title}`}
                  aside={
                    <Badge size="sm" variant="tag">
                      {example
                        ? `${section.checks.length} of ${section.checks.length} met`
                        : `${met} of ${section.checks.length} met`}
                    </Badge>
                  }
                />
                <div className={styles.cols}>
                  <section aria-label="Policy">
                    <h3 className={styles.capsLabel}>Policy</h3>
                    <ul className={styles.policy}>
                      {section.policy.map((line) => (
                        <li key={line.text}>
                          {line.lead ? <strong>{line.lead}: </strong> : null}
                          {line.text}
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section aria-label="Checks">
                    <h3 className={styles.capsLabel}>Checks</h3>
                    <Checks checks={section.checks} view={view} testId={`privacy-checks-${section.id}`} />
                  </section>
                </div>
                <p className={styles.source}>Source: {section.source}</p>
              </Card>
            );
          })}
        </div>

        <aside className={styles.rail} aria-label="Roles, sign-off and sections">
          <Card aria-labelledby="privacy-sections-title" data-testid="privacy-toc">
            <CardHead iconPlain icon={BookOpen} id="privacy-sections-title" title="Sections" />
            <ol className={styles.toc}>
              {PRIVACY_SECTIONS.map((section, index) => (
                <li key={section.id}>
                  <a href={`#privacy-${section.id}`}>
                    <span className={styles.tocNo}>{index + 1}</span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </Card>

          <Card aria-labelledby="privacy-roles-title" data-testid="privacy-roles">
            <CardHead iconPlain icon={Users} id="privacy-roles-title" title="Roles" />
            <ul className={styles.roles}>
              {PRIVACY_ROLES.map((role) => (
                <li key={role.role}>
                  <span className={styles.checkName}>{role.role}</span>
                  <span className={styles.evidence}>{role.duty}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card aria-labelledby="privacy-sign-title" data-testid="privacy-sign-off">
            <CardHead iconPlain icon={LockKeyhole} id="privacy-sign-title" title="Review and sign-off" />
            <Checks checks={PRIVACY_SIGN_OFFS} view={view} testId="privacy-checks-sign-off" />
          </Card>

          <Card aria-labelledby="privacy-note-title" data-testid="privacy-note">
            <CardHead iconPlain icon={ListChecks} id="privacy-note-title" title="Please note" />
            <ul className={styles.policy}>
              <li>These are intended requirements. Ward Flow meets only the ones marked Met.</li>
              <li>The prototype holds synthetic data only. Never enter real patient details.</li>
              <li>This is not legal advice. Check each item with the privacy officer and legal team.</li>
            </ul>
          </Card>
        </aside>
      </div>

      <WardPrototypeFooter testId="privacy-footer" />
    </main>
  );
}

"use client";

import { ChevronDown, ListChecks, ListTree, LockKeyhole, Users } from "lucide-react";
import { useState } from "react";

import {
  Badge,
  Card,
  CardHead,
  Hero,
  HeroAct,
  HeroFigures,
  HeroTop,
  HeroTrack,
  Icon,
  Menu,
  heroChipClassName,
  type WfTone,
} from "@/components/wf";
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
 * D-260 (Josh, 16 Nov 2026): Privacy and data. Where the app stands today against each Australian
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
      <Hero
        level={1}
        // Audit four #51: the title is the answer, not the header's own words.
        title={example ? `${TOTAL} of ${TOTAL} checks met` : `${MET} of ${TOTAL} checks met`}
        titleMeta="Not enforced · Synthetic data · Not legal advice"
        // Design review (27 Nov 2026): Jump to sits at the title row's right end, not on a row of its own.
        className={styles.heroAsideEnd}
        aside={
          <Menu
            label="Jump to a section"
            items={PRIVACY_SECTIONS.map((section, index) => ({
              id: section.id,
              label: `${index + 1}. ${section.title}`,
              onSelect: () => {
                document.getElementById(`privacy-${section.id}`)?.scrollIntoView({ block: "start" });
              },
            }))}
            trigger={(props) => (
              <button {...props} type="button" className={heroChipClassName} data-testid="privacy-jump">
                <Icon icon={ListTree} size={16} />
                <span>Jump to</span>
                <Icon icon={ChevronDown} size={14} />
              </button>
            )}
          />
        }
      >
        <HeroTop
          quickBar={false}
          figures={
            <HeroFigures
              label="Requirements"
              testId="privacy-figures"
              items={
                example
                  ? [{ id: "ticked", value: TOTAL, label: `of ${TOTAL} met`, testId: "privacy-figure-ticked" }]
                  : // Gate r10 look upgrade 2: the title already says how many are met, so the figures
                    // give the breakdown worst news first; each fact still shows once.
                    [
                      { id: "notyet", value: NOT_YET, label: "not yet", testId: "privacy-figure-notyet" },
                      { id: "partly", value: PARTLY, label: "partly", testId: "privacy-figure-partly" },
                      { id: "met", value: MET, label: "met", testId: "privacy-figure-met" },
                    ]
              }
            />
          }
          act={
            <HeroAct
              tone="warning"
              testId="privacy-hero-act"
              // The disclaimer is said once, in the title meta (audit two B22). The act keeps the one
              // instruction not said elsewhere.
              title="Check each item with the privacy officer and legal team"
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
                BedChart holds patient information only for bed flow and care coordination. It is hosted in Australia,
                keeps an audit trail, and every requirement below is shown as met. This is an example of a finished
                policy, not how the app works today.
              </p>
            ) : (
              <p className={styles.lead}>
                Not yet done: naming a privacy officer, signing the privacy impact assessment, moving all hosting to
                Australia, requiring multi-factor sign-in, an independent security test, database backups, and making
                the code repository private.
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

        <aside className={styles.rail} aria-label="Roles and sign-off">
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
        </aside>
      </div>

      <WardPrototypeFooter testId="privacy-footer" />
    </main>
  );
}

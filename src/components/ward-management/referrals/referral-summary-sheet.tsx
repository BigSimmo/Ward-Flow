"use client";
// Referrals redesign, round 5 (Josh, 31 October 2026): the referral summary, redesigned. Fork of
// IsbarSheet in src/components/ward-management/referrals/referral-board-sheets.tsx. The copied text
// is unchanged (isbarText). On screen: who and how long first, the key facts as a grid, ISBAR as
// five short lettered rows, the documents as chips you can open, and Full referral, which opens
// everything the referrer submitted in the same sheet.
// RQ9 (Josh, 3 Nov 2026): one Referral sheet with tabs. Summary and Full referral for everyone who
// can open it; Sent to only for the coordinator and the desk that sent it (referral-sheet-access.ts).
// Openable from anywhere through `openReferralRecord` (referral-sheet-bus.ts).

import { useState } from "react";
import { ORIGIN_NOT_RECORDED } from "@/components/ward-management/ward-model";
import { ClipboardCopy, TriangleAlert } from "lucide-react";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Referral } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { formatReferralIntakeTime } from "@/components/ward-management/ward-referral-seed-time";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { REFERRAL_SOURCE_WORDS, askingForShort, waitWords } from "./referral-board-parts";
import { isbarText, type IsbarRecorded } from "./referral-board-sheets";
import { UNIDENTIFIED_REFERRAL_PREFIX } from "./referral-inbox";
import { Button, Sheet, StatusGlyph, TabPanel, Tabs, TierTile, cx } from "@/components/wf";

import { ReferralDocuments } from "./referral-documents";
import { needTags } from "./referral-panel-tabs";
import { referralSentToVisible } from "./referral-sheet-access";
import type { ReferralSheetTab } from "./referral-sheet-bus";
import { ReferralSentTo } from "./referral-sheet-sent-to";
import s from "./referral-tabs.module.css";
import t from "./referral-sheet-tabs.module.css";

const TAB_PREFIX = "ward-referral-sheet";

function patientStory(referral: Referral): string {
  const lines = referral.history.split("\n");
  const body = lines[0]?.trim().startsWith(UNIDENTIFIED_REFERRAL_PREFIX) ? lines.slice(1) : lines;
  return body.join(" ").replace(/\s+/g, " ").trim();
}

function CopyButton({ text }: { text: string }) {
  const [result, setResult] = useState<"copied" | "failed" | null>(null);
  return (
    <Button
      variant="pri"
      size="sm"
      icon={ClipboardCopy}
      onClick={() => {
        // The result is said aloud as well as shown (design audit, Josh 1 Nov 2026); a refused copy
        // shows on the button rather than looking as if nothing happened.
        void copyTextToClipboard(text).then(
          () => {
            setResult("copied");
            announceToWardShell("Copied to the clipboard.");
          },
          () => {
            setResult("failed");
            announceToWardShell("Could not copy. Check clipboard access and try again.");
          },
        );
      }}
    >
      {result === "copied" ? "Copied" : result === "failed" ? "Could not copy" : "Copy summary"}
    </Button>
  );
}

export function ReferralSummarySheet({
  open,
  onClose,
  referral,
  name,
  umrn,
  demographics,
  now,
  recorded = {},
  initialTab = "summary",
}: {
  open: boolean;
  onClose: () => void;
  referral: Referral;
  name: string;
  umrn: string;
  demographics: string;
  now: Instant;
  recorded?: IsbarRecorded;
  /** RQ9: the tab the sheet opens on. "sent" falls back to Summary for a desk that may not see it. */
  initialTab?: ReferralSheetTab;
}) {
  const { dayZero, units } = useWardFlowSelect("dayZero", "units");
  const access = useEffectiveWardAccess();
  const sentVisible = referralSentToVisible(access, referral, units);
  const [chosen, setChosen] = useState<ReferralSheetTab>(initialTab);
  // A tab the desk may not see is never shown, even if asked for.
  const tab: ReferralSheetTab = chosen === "sent" && !sentVisible ? "summary" : chosen;
  const tabItems: { id: ReferralSheetTab; label: string; count?: number }[] = [
    { id: "summary", label: "Summary" },
    { id: "full", label: "Full referral" },
    ...(sentVisible ? [{ id: "sent" as const, label: "Sent to", count: referral.destinations.length }] : []),
  ];
  const intake = referral.intake;
  const text = isbarText(referral, name, umrn, demographics, now, recorded);
  const { waited, due, overdue } = waitWords(referral, now);
  const site = siteByCode(referral.originSiteCode)?.name ?? referral.originSiteCode ?? ORIGIN_NOT_RECORDED;
  const legal = recorded.legalStatus?.trim();
  const letterLegal = intake?.legalStatus?.trim();
  const legalMissing = !legal || /^not recorded$/i.test(legal);
  const clearance = recorded.clearance;
  const risks = intake?.riskFlags ?? [];
  const tags = needTags(referral);
  const reason = intake?.reasonForReferral?.replace(/\s+/g, " ").trim();
  const story = patientStory(referral);
  const asking = askingForShort(referral);

  const isbar: [string, string, string][] = [
    ["I", "Identify", `${name} · ${umrn} · ${demographics}`],
    [
      "S",
      "Situation",
      `Tier ${referral.urgency} from ${site} (${REFERRAL_SOURCE_WORDS[referral.source]}). Waiting ${waited}${due ? `, ${due}` : ""}.${asking && asking !== "Nothing open" ? ` Asking for ${asking.toLowerCase()}.` : ""}`,
    ],
    ["B", "Background", reason ? reason : "Reason for referral not recorded."],
    [
      "A",
      "Assessment",
      `Risk flags: ${risks.length > 0 ? risks.join(", ") : intake ? "none selected" : "not recorded"}. Medical clearance ${clearance ? (clearance.cleared ? "cleared" : "not cleared") : "not recorded"}.`,
    ],
    ["R", "Recommendation", tags.length > 0 ? tags.join(", ") : "No bed needs recorded."],
  ];

  return (
    <Sheet
      open={open}
      onClose={() => {
        setChosen(initialTab);
        onClose();
      }}
      title="Referral"
      description="From the referral record."
      headerBottom={
        <div className={t.tabsBar}>
          <Tabs label="Referral sections" idPrefix={TAB_PREFIX} value={tab} onChange={setChosen} items={tabItems} />
        </div>
      }
      footer={
        <div className={s.sheetFoot}>
          <span className={s.spacer} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setChosen(initialTab);
              onClose();
            }}
          >
            Close
          </Button>
          <CopyButton text={text} />
        </div>
      }
    >
      <div className={s.sum}>
        <header className={s.sumHead}>
          <TierTile tier={referral.urgency} />
          <div className={s.sumWho}>
            <b>{name}</b>
            <span>
              <span className={s.mono}>{umrn}</span> · {demographics}
            </span>
          </div>
          <span className={cx(s.sumWait, overdue && s.sumWaitOver)}>
            {overdue ? <TriangleAlert size={13} aria-hidden="true" /> : null}
            <b className={s.mono}>{waited}</b>
            <span>{due}</span>
          </span>
        </header>

        {tab === "full" ? (
          <TabPanel idPrefix={TAB_PREFIX} id="full">
            <div className={s.full} data-testid="ward-referral-full-referral">
              <section>
                <h4>Reason for referral</h4>
                <p>{reason || "Not recorded."}</p>
              </section>
              <section>
                <h4>Patient story</h4>
                <p>{story || "Not recorded."}</p>
              </section>
              <dl className={s.factGrid}>
                <div>
                  <dt>Referred from</dt>
                  <dd>
                    {site}
                    <span>{REFERRAL_SOURCE_WORDS[referral.source]}</span>
                  </dd>
                </div>
                <div>
                  <dt>Sent</dt>
                  <dd>{formatInstantWithDay(referral.raisedAt, now)}</dd>
                </div>
                <div>
                  <dt>Referrer</dt>
                  <dd>
                    {intake?.referrer.name ?? "Not recorded"}
                    {intake ? (
                      <span>
                        {intake.referrer.role} · {intake.referrer.phone}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt>Medical clearance</dt>
                  <dd>
                    {intake
                      ? intake.medicalClearance.cleared
                        ? "Cleared"
                        : `Pending, expected ${formatReferralIntakeTime(intake.medicalClearance.expectedAt, intake.medicalClearance, dayZero, now)}`
                      : "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt>Triage and RAMP</dt>
                  <dd>{intake ? (intake.triageAndRampCompleted ? "Done" : "Not completed") : "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Legal status on the letter</dt>
                  <dd>{letterLegal || "Not recorded"}</dd>
                </div>
              </dl>
              <section>
                <h4>Documents</h4>
                <ReferralDocuments charts={intake?.charts ?? []} toFollow={intake?.chartsToFollow} personName={name} />
              </section>
            </div>
          </TabPanel>
        ) : null}
        {tab === "summary" ? (
          <TabPanel idPrefix={TAB_PREFIX} id="summary" className={s.sum}>
            <dl className={s.factGrid}>
              <div>
                <dt>From</dt>
                <dd>
                  {site}
                  <span>{REFERRAL_SOURCE_WORDS[referral.source]}</span>
                </dd>
              </div>
              <div>
                <dt>Asking for</dt>
                <dd>
                  {asking}
                  <span>{tags.length > 0 ? tags.join(", ") : "No extra needs"}</span>
                </dd>
              </div>
              <div className={legalMissing ? s.factWarn : undefined}>
                <dt>Legal status</dt>
                <dd>
                  {legalMissing ? <StatusGlyph tone="warning" size={9} /> : null}
                  {legalMissing ? "Not recorded" : legal}
                  {letterLegal && !/^not recorded$/i.test(letterLegal) ? <span>Letter: {letterLegal}</span> : null}
                </dd>
              </div>
              <div className={!clearance?.cleared ? s.factWarn : undefined}>
                <dt>Medical clearance</dt>
                <dd>
                  {clearance ? (clearance.cleared ? "Cleared" : "Not cleared") : "Not recorded"}
                  {clearance ? (
                    <span>{formatInstantWithDay(clearance.at, now)}</span>
                  ) : intake ? (
                    <span>
                      Letter:{" "}
                      {intake.medicalClearance.cleared
                        ? "cleared"
                        : `pending, expected ${formatReferralIntakeTime(intake.medicalClearance.expectedAt, intake.medicalClearance, dayZero, now)}`}
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>

            {risks.length > 0 ? (
              <ul className={s.riskTags} aria-label="Risk flags on the referral letter">
                {risks.map((risk) => (
                  <li key={risk}>
                    <StatusGlyph tone="warning" size={9} />
                    {risk.charAt(0).toUpperCase() + risk.slice(1)} risk
                  </li>
                ))}
              </ul>
            ) : null}

            <ol className={s.isbar} aria-label="ISBAR">
              {isbar.map(([letter, label, words]) => (
                <li key={letter}>
                  <span className={s.isbarLetter} aria-hidden="true">
                    {letter}
                  </span>
                  <div>
                    <b>{label}</b>
                    <p>{words}</p>
                  </div>
                </li>
              ))}
            </ol>

            <section className={s.sumDocs}>
              <h4>Documents</h4>
              <ReferralDocuments charts={intake?.charts ?? []} toFollow={intake?.chartsToFollow} personName={name} />
            </section>
          </TabPanel>
        ) : null}
        {tab === "sent" ? (
          <TabPanel idPrefix={TAB_PREFIX} id="sent">
            <ReferralSentTo referral={referral} units={units} now={now} />
          </TabPanel>
        ) : null}
      </div>
    </Sheet>
  );
}

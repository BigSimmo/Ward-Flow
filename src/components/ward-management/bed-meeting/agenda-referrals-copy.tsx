"use client";

import { ClipboardCopy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/wf";

import { askingForShort, needWords, waitWords } from "../referrals/referral-board-parts";
import { copyTextToClipboard } from "../ward-clipboard";
import type { Instant } from "../ward-clock";
import type { Referral } from "../ward-model";
import { announceToWardShell } from "../shell/ward-live-region";

/** The waiting referrals as plain text, in queue order, for an email or the meeting's notes. */
export function agendaReferralsText(
  referrals: readonly Referral[],
  nameOf: (referral: Referral) => string,
  now: Instant,
  heading: string,
): string {
  return [
    heading,
    ...referrals.map((referral, index) => {
      const { waited, due } = waitWords(referral, now);
      return [
        `${index + 1}. T${referral.urgency} ${nameOf(referral)}`,
        `waiting ${waited}, ${due}`,
        `from ${referral.originSiteCode}`,
        `asking for ${askingForShort(referral)}`,
        needWords(referral).join(", ") || "no bed needs recorded",
      ].join(" | ");
    }),
  ].join("\n");
}

/**
 * R5 fold (Josh, 3 Nov 2026): the Referrals page's "Referrals for the bed meeting" sheet now lives
 * here, on the agenda's own Referrals list, so its Copy list comes with it. The result is said
 * aloud as well as shown, and a refused copy says so on the button.
 */
export function AgendaReferralsCopy({ text, className }: { text: () => string; className?: string }) {
  const [result, setResult] = useState<"copied" | "failed" | null>(null);
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={ClipboardCopy}
      className={className}
      data-testid="bed-meeting-agenda-referrals-copy"
      onClick={() => {
        void copyTextToClipboard(text()).then(
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
      {result === "copied" ? "Copied" : result === "failed" ? "Could not copy" : "Copy list"}
    </Button>
  );
}

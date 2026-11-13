"use client";

// The summary's Referrals today card: raised, accepted, declined and still open, with the refusals,
// admissions and parallel cap tiles under them.

import {
  Foot,
  MoreLink,
  Now,
  StatCardR,
  Strip,
  Tile,
} from "@/components/ward-management/statistics/redesign/statistics-redesign-parts";
import type { SummaryModel } from "./statistics-network-cards";
import { countInSentence, type StatisticsCount } from "./statistics-small-numbers";

export function StatisticsReferralsTodayCard({
  model,
  small,
  reportDayCaption,
}: {
  model: SummaryModel;
  small: (count: StatisticsCount) => number | string;
  reportDayCaption: string;
}) {
  const { executive, refRaised, refAccepted, refDeclined, refOpen, refused, admissionsCount, parallelReferralCap } =
    model;
  // Role view (executive): a count the small number rule withholds reads "not shown". When all four
  // are withheld, the card heading says it once.
  const refAllHeld =
    executive &&
    [refRaised, refAccepted, refDeclined, refOpen].every(
      (count) => typeof count !== "number" && count.kind === "withheld",
    );
  return (
    <StatCardR
      id="referrals-today"
      title="Referrals today"
      // Role view (executive): all four withheld reads once here, not as four big "not shown".
      meta={refAllHeld ? "not shown" : `${small(refRaised)} raised`}
      data-testid="ward-statistics-referrals-for-bed"
      foot={
        <Foot link={executive ? undefined : <MoreLink href="/ward-flow/referrals">Open referrals</MoreLink>}>
          <span data-testid="ward-statistics-admissions-today-count">{small(admissionsCount)}</span> admitted today
          <span className="sr-only" data-testid="ward-statistics-admissions-today-caption">
            {reportDayCaption}
          </span>
        </Foot>
      }
    >
      {/* The redesign's two by two (approved 1 Nov 2026, Q135). Each figure is the count the card
          has always shown, in the same order the tiles read. */}
      <Strip id="refBand" label="Referrals for a bed today" cols={2}>
        <Tile title="Accepted" fig={refAllHeld ? undefined : small(refAccepted)} />
        <Tile
          title="Still open"
          now={
            <Now>
              parallel cap <span data-testid="ward-statistics-refused-so-far-cap">{parallelReferralCap}</span>
            </Now>
          }
          fig={refAllHeld ? undefined : small(refOpen)}
          sub={
            <span data-testid="ward-statistics-refused-so-far-escalated">
              <span aria-hidden="true">{countInSentence(small(refused.escalatedCount))} escalated</span>
              <span className="sr-only">
                {` ${countInSentence(small(refused.escalatedCount), "open movement carries", "open movements carry")} a recorded escalation.`}
              </span>
            </span>
          }
        />
        <Tile
          title="Declined"
          fig={refAllHeld ? undefined : small(refDeclined)}
          sub={
            <span data-testid="ward-statistics-refused-so-far">
              <span className="sr-only" role="heading" aria-level={3}>
                Referrals where every ward asked so far has refused
              </span>
              {/* F-55 (A9-36): a withheld count reads as a sentence, never "0 of not shown refused so far". */}
              <span data-testid="ward-statistics-refused-so-far-count">
                <span data-testid="ward-statistics-refused-so-far-value">{countInSentence(small(refused.count))}</span>{" "}
                of{" "}
                <span data-testid="ward-statistics-refused-so-far-open-count">
                  {countInSentence(small(refused.openMovementCount))}
                </span>{" "}
                refused so far
              </span>
            </span>
          }
        />
        <Tile title="Raised" fig={refAllHeld ? undefined : small(refRaised)} sub="today" />
      </Strip>
    </StatCardR>
  );
}

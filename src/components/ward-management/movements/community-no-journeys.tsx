"use client";

import Link from "next/link";
import { ArrowRightLeft } from "lucide-react";

import { EmptyState, Hero, LiveChip, buttonClass } from "@/components/wf";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import { raiseReferralHref } from "@/components/ward-management/shell/ward-facade";
import styles from "./movements.module.css";
import local from "./community-no-journeys.module.css";

/**
 * Community clinician desk (D-76): Movements when the team has no journey at all. The board's
 * stage strip, timeline, corridors, worklist and transport panels would each be empty, so the page
 * says once what would put a journey here and offers the team's two ways on.
 */
export function CommunityNoJourneys({ teamName }: { teamName: string }) {
  const teamId = communityTeamSlug(teamName);
  return (
    <div className={styles.screen} data-testid="ward-movements-page" data-ward-rebuilt-screen="movements">
      <main id="main-content" className={styles.main}>
        <h1 className="sr-only">Movements</h1>
        <div className={local.body}>
          <Hero
            eyebrow={`Movements · ${teamName} team`}
            title="No journeys for the team"
            aside={<LiveChip state="live" onHero />}
          />
          {/* The kit's empty state on its own (it carries its border), with no card head repeating
              the title above it. */}
          <section aria-label="The team's journeys">
            <EmptyState
              icon={ArrowRightLeft}
              title="None yet"
              className={local.empty}
              action={
                <div className={local.actions}>
                  <Link
                    href={raiseReferralHref({ source: "community", teamId })}
                    className={buttonClass({ variant: "sec", size: "md" })}
                  >
                    Refer from team
                  </Link>
                  <Link
                    href={`/ward-flow/community/${teamId}`}
                    className={buttonClass({ variant: "ghost", size: "md" })}
                  >
                    Team&rsquo;s inpatients
                  </Link>
                </div>
              }
            />
          </section>
        </div>
        <WardPrototypeFooter note="Patient journeys, transport legs and departments are invented · Not approved for clinical use" />
      </main>
    </div>
  );
}

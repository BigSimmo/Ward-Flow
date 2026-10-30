/*
 * Redesign mock-up fork of `communityHowToReachPanel` (community-screen-panels.tsx). The contact
 * details are unchanged; the caveat and the "recorded / paired" lines, which took four lines under
 * them, are one footnote line. Their words are kept as they are.
 */

import {
  contactDecisionFor,
  contactForTeam,
} from "@/components/ward-management/community/community-team-contact-mapping";
import { REFERENCE_TEAM_CAVEAT } from "@/components/ward-management/reference/ward-reference-teams";
import type { CommunityScreenView } from "@/components/ward-management/community/community-screen";
import v6 from "@/components/ward-management/community/community-team-v6.module.css";
import local from "./community-team.module.css";

export function CommunityTeamHowToReach({ view }: { view: CommunityScreenView }) {
  const { team, isDemoMode } = view;
  const contact = contactForTeam(team.name);
  const decision = contactDecisionFor(team.name);
  return (
    <div style={{ display: isDemoMode ? "none" : "block" }} aria-hidden={isDemoMode ? "true" : undefined}>
      <section className={v6.sideCard} aria-label="How to reach this team" data-testid="ward-community-contact">
        <div className={v6.sideHead}>
          <h3 className={v6.sideTitle}>How to reach</h3>
          {contact === null ? null : <span className={v6.sideMeta}>Invented for the demo</span>}
        </div>
        <div className={v6.sideBody} role="region" aria-label="How to reach this team details">
          {contact === null ? (
            <p className={v6.sideNote}>
              Nobody has yet recorded which real service this name refers to, so no contact detail is shown. That is not
              a statement that this team has no phone number.
            </p>
          ) : (
            <>
              <dl className={v6.keyValues} data-testid="ward-community-contact-detail">
                {contact.publishedPhone === null ? null : (
                  <div>
                    <dt>Phone</dt>
                    <dd className={v6.mono}>
                      <a href={`tel:${contact.publishedPhone.replace(/[^\d+]/g, "")}`}>{contact.publishedPhone}</a>
                    </dd>
                  </div>
                )}
                {contact.publishedHours === null ? null : (
                  <div>
                    <dt>Hours</dt>
                    <dd>{contact.publishedHours}</dd>
                  </div>
                )}
                {contact.referralEmail === null ? null : (
                  <div>
                    <dt>Referrals</dt>
                    <dd>
                      <a href={`mailto:${contact.referralEmail}`}>{contact.referralEmail}</a>
                    </dd>
                  </div>
                )}
                {contact.address === null ? null : (
                  <div>
                    <dt>Address</dt>
                    <dd>{contact.address}</dd>
                  </div>
                )}
              </dl>
              <p className={local.contactFootnote}>
                {REFERENCE_TEAM_CAVEAT} Recorded {contact.recordedOn ?? "on a date the register does not give"}
                {decision === null
                  ? "."
                  : `. Paired with ${decision.serviceName} by ${decision.decidedBy} on ${decision.decidedOn}.`}
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

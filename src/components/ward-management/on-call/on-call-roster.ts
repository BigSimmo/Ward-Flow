import { HEALTH_SERVICES, type HealthService } from "@/components/ward-management/ward-model";

/**
 * 🔴 **WHO IS ON CALL — AND THIS FILE HOLDS NO PEOPLE, DELIBERATELY AND PERMANENTLY.**
 *
 * ⚠️ **THE MODEL HAS NO STAFF CONCEPT AT ALL.** Measured across `ward-model.ts` and `ward-sites.ts`:
 * no name field, no phone, pager, extension or address field, no shift-roster type, no person-on-call
 * type. The two things that come closest are `Movement.owner` (`"Flow coordinator"`,
 * `"Ward nurse in charge"` — a FUNCTION label) and `Movement.escalation.contact` (`"State bed
 * coordination desk"` — a DESK). ⚠️ **Neither has ever held a name or a number, and
 * `escalation.contact` is a known false-presence trap: a grep for "contact" in the model returns a
 * hit and could persuade a builder that a real contact concept exists here. It does not.**
 *
 * ## 🔴 Why this is a role label and a window, and never a person or a number
 *
 * **This screen's entire purpose is to be DIALLED.** A roster that is wrong is worse than no roster,
 * because a coordinator under pressure at three in the morning rings the number on it. ⚠️ **An
 * invented number would not read as invented at that hour** — it would read as the number.
 *
 * ✅ **So no contact method is rendered on this screen at all.** Not a real one, and not a disclosed
 * placeholder either. **That is deliberately STRICTER than this screen's drawing**, which shows a
 * placeholder extension and a placeholder address under a disclosure. Placeholders are defensible;
 * **none is safer, and it costs this screen nothing, because the drawing's own "Reaching a role"
 * panel already says a role is reached through the site directory kept OUTSIDE this prototype.** A
 * placeholder would add a thing to misread in exchange for nothing.
 *
 * ⚠️ **AND THE DRAWING'S TWO PLACEHOLDERS ARE DESCRIBED HERE, NEVER QUOTED.** The first draft of
 * this comment quoted both verbatim to be helpful, and `ward-on-call-holds-no-people.test.ts`
 * immediately went red on its own explanatory prose. **That is the guard working, not a false
 * positive**: a file scanner cannot tell a phone-shaped string being BANNED from one being USED, and
 * a rule with a carve-out for "but only in a comment" is a rule with a hole in it.
 *
 * 🔴 **`OnCallRole` CANNOT HOLD A CONTACT METHOD, AND THAT IS THE POINT OF THE TYPE.** It has three
 * fields and a test pins the whole key set (`tests/ward-on-call-holds-no-people.test.ts`), the same
 * way `ALLOWED_REFERRAL_FIELDS` pins `Referral`. **Adding `name`, `phone`, `extension`, `pager` or
 * `email` here is a red, not a review comment.** ⚠️ **If a real roster is ever wanted, it needs a
 * staff record, a source of truth for who holds a role right now, and a way to stay current when the
 * real roster changes — none of which exists. That is a growth the owner approves individually, not
 * a field somebody adds to this array.**
 */
export type OnCallRole = {
  /** Stable id for keys and test ids. Never a person's identifier — there is no person. */
  id: string;
  /** 🔴 A ROLE, NEVER A NAME. "Bed coordinator", not whoever is holding the phone tonight. */
  role: string;
  /** The shift window, as words. ⚠️ Invented, and labelled as invented wherever it renders. */
  shift: string;
};

/** The two roles the network holds rather than a service — invented, both of them. */
export const NETWORK_ON_CALL_ROLES: readonly OnCallRole[] = [
  { id: "bed-coordinator", role: "Bed coordinator", shift: "Overnight, 20:00 to 08:00" },
  { id: "governance-lead", role: "Governance lead", shift: "On call from home, 17:00 to 08:00" },
];

/**
 * The per-service roles.
 *
 * 🔴 **`WACHS` IS ABSENT ON PURPOSE AND THE SCREEN SAYS SO IN WORDS.** ⚠️ **An absent row and a row
 * reading "—" are not the same statement**: the first is silence a reader fills in themselves, and
 * on a screen somebody rings at three in the morning the thing they would fill in is *"there must be
 * somebody, I just cannot see them."* **The screen names the gap instead**, and
 * `servicesWithNoRoleRecorded()` below is what keeps that sentence true if this array changes.
 *
 * ⚠️ **"Not recorded" is a statement about THIS PROTOTYPE, never about the world.** Nothing here
 * knows whether a real service has somebody on call.
 */
export const SERVICE_ON_CALL_ROLES: Readonly<Record<HealthService, readonly OnCallRole[]>> = {
  "North Metro": [
    { id: "nm-coordinator", role: "Coordinator on call", shift: "Overnight, 20:00 to 08:00" },
    { id: "nm-consultant", role: "Duty consultant", shift: "Overnight, 22:00 to 08:00" },
  ],
  "South Metro": [
    { id: "sm-coordinator", role: "Coordinator on call", shift: "Overnight, 20:00 to 08:00" },
    { id: "sm-consultant", role: "Duty consultant", shift: "Overnight, 22:00 to 08:00" },
  ],
  "East Metro": [
    { id: "em-coordinator", role: "Coordinator on call", shift: "Overnight, 20:00 to 08:00" },
    { id: "em-consultant", role: "Duty consultant", shift: "Overnight, 22:00 to 08:00" },
  ],
  WACHS: [],
  CAHS: [],
  Private: [{ id: "pr-coordinator", role: "Coordinator on call", shift: "Business hours only, 08:00 to 17:00" }],
};

/**
 * Services holding no recorded role, derived rather than written down.
 *
 * ⚠️ **DERIVED, because the alternative is a hard-coded sentence naming WA Country that stays on the
 * screen after somebody adds a WACHS role** — a screen telling a coordinator nobody is on call for a
 * service that now has somebody. **A sentence about an absence has to be computed from the same
 * array the presence is.**
 */
export function servicesWithNoRoleRecorded(): HealthService[] {
  return HEALTH_SERVICES.filter((service) => SERVICE_ON_CALL_ROLES[service].length === 0);
}

/** How many roles this prototype records, and how many places it has to record one. */
export function roleRecordCounts(): { recorded: number; possible: number } {
  const perService = HEALTH_SERVICES.map((service) => SERVICE_ON_CALL_ROLES[service].length);
  const recorded = NETWORK_ON_CALL_ROLES.length + perService.reduce((total, count) => total + count, 0);
  /*
   * ⚠️ **THE DENOMINATOR IS A CHOICE AND IT IS WRITTEN DOWN RATHER THAN LEFT TO BE INFERRED.** Two
   * roles per health service (a coordinator and a duty consultant) plus the two network roles. It is
   * the shape this prototype expects, not a fact about any real service — so the screen words it as
   * what this prototype records, never as coverage.
   */
  const possible = NETWORK_ON_CALL_ROLES.length + HEALTH_SERVICES.length * 2;
  return { recorded, possible };
}

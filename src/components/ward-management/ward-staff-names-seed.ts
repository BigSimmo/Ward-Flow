/**
 * The invented staff names for the signed-in desk personas (Audit 16 A16-02 and A16-21, Audit 15
 * A15-06, Josh 13 Nov 2026).
 *
 * Every name is synthetic. Staff surnames are a style of their own and share nothing with a
 * patient's surname, hand-written or generated, so a doctor can never read as the person in the bed
 * behind the dialog.
 */

type StaffTitle = "Dr" | "RN" | "CNS" | "Sr";

export type StaffMember = {
  readonly title?: StaffTitle;
  readonly given: string;
  readonly family: string;
};

const dr = (given: string, family: string): StaffMember => ({ title: "Dr", given, family });
const person = (given: string, family: string): StaffMember => ({ given, family });

/** "Dr S. Orlenby": the short written form a signature uses. */
function staffInitialName(member: StaffMember): string {
  return [member.title, `${member.given[0]}.`, member.family].filter(Boolean).join(" ");
}

/** "sorrel.orlenby@example.org": a reserved example domain, never a real address. */
export function staffEmail(member: StaffMember): string {
  return `${member.given}.${member.family}@example.org`.toLowerCase();
}

/**
 * The signed-in desk personas (A15-06: "Dr S. Chen" read as a real clinician at a Perth bed desk).
 * `shell/ward-desk-personas.ts` and `settings/settings-profile.ts` read these, so the rail, the menu,
 * Settings and the triage signature name one person.
 */
export const DESK_PERSONA_STAFF = {
  coordinator: dr("Sorrel", "Orlenby"),
  ed: { title: "Sr", given: "Maeve", family: "Gallagher" },
  ward: { title: "RN", given: "Kit", family: "Vance" },
  officer: person("Ade", "Okafor"),
  community: person("Lou", "Hart"),
} as const satisfies Record<string, StaffMember>;

/** "Dr S. Orlenby": the signed-in coordinator, as the rail, Settings and triage write it. */
export const SIGNED_IN_COORDINATOR_NAME = staffInitialName(DESK_PERSONA_STAFF.coordinator);

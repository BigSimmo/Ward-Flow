/**
 * The one list of invented staff names: hospital doctors, GPs, community clinicians and the signed-in
 * desk personas (Audit 16 A16-02 and A16-21, Audit 15 A15-06, Josh 13 Nov 2026).
 *
 * Every name is synthetic. Staff surnames are a style of their own and share nothing with a
 * patient's surname, hand-written or generated, so a doctor can never read as the person in the bed
 * behind the dialog. `tests/ward-fix-A1-staff-names.test.ts` checks that: no clinician, GP or next of
 * kin carries a patient's full name, no clinician or GP carries a patient's surname, and every "Dr",
 * "RN", "CNS" or "Sr" name in the seed and persona sources is on this list.
 *
 * Practice names are invented compounds, never a real suburb or a pun on the doctor's name.
 */

export type StaffTitle = "Dr" | "RN" | "CNS" | "Sr";

export type StaffMember = {
  readonly title?: StaffTitle;
  readonly given: string;
  readonly family: string;
};

const dr = (given: string, family: string): StaffMember => ({ title: "Dr", given, family });
const person = (given: string, family: string): StaffMember => ({ given, family });

/** "Dr Imogen Tessaley". */
export function staffFullName(member: StaffMember): string {
  return [member.title, member.given, member.family].filter(Boolean).join(" ");
}

/** "Dr I. Tessaley": the short written form a GP line or a signature uses. */
export function staffInitialName(member: StaffMember): string {
  return [member.title, `${member.given[0]}.`, member.family].filter(Boolean).join(" ");
}

/** "Tessaley, Imogen": the list form the patient record uses for its contacts. */
export function staffListName(member: StaffMember): string {
  return `${member.family}, ${member.given}`;
}

/** "imogen.tessaley@example.org": a reserved example domain, never a real address. */
export function staffEmail(member: StaffMember): string {
  return `${member.given}.${member.family}@example.org`.toLowerCase();
}

/** Hospital doctors who write referrals and clear patients in the ED. */
export const HOSPITAL_DOCTORS = [
  dr("Imogen", "Tessaley"),
  dr("Rafe", "Velloran"),
  dr("Ottilie", "Askerby"),
  dr("Bastian", "Brindlecote"),
  dr("Wynne", "Carrowan"),
  dr("Cosima", "Draymont"),
  dr("Linus", "Elvanridge"),
  dr("Thea", "Fallowden"),
  dr("Arlo", "Gennaway"),
  dr("Mirren", "Hethersall"),
  dr("Silas", "Ivelcombe"),
  dr("Juno", "Jessamond"),
  dr("Ezra", "Kirrowan"),
  dr("Priya", "Lethbury"),
  dr("Hugo", "Mallender"),
  dr("Ines", "Norvale"),
] as const satisfies readonly StaffMember[];

/** Placeholder referrers for generated referrals: named synthetic clinicians, never "Synthetic clinician N". */
export const REFERRING_CLINICIANS = [
  dr("Anouk", "Ostervale"),
  dr("Callum", "Quillan"),
  dr("Dara", "Rathmoray"),
  dr("Felix", "Selwarden"),
  dr("Greer", "Tamberlin"),
  dr("Harlan", "Ulverby"),
  dr("Isla", "Varrendale"),
  dr("Jasper", "Wexcombe"),
  dr("Kezia", "Ysselby"),
  dr("Lionel", "Zenderby"),
] as const satisfies readonly StaffMember[];

export type GeneralPractitioner = { readonly doctor: StaffMember; readonly practice: string };

/** GPs and their practices. Several patients may share one, as people do. */
export const GENERAL_PRACTITIONERS: readonly GeneralPractitioner[] = [
  { doctor: dr("Alys", "Penderell"), practice: "Bellmoss Family Practice" },
  { doctor: dr("Tobin", "Corrisand"), practice: "Cindergate Medical" },
  { doctor: dr("Seren", "Haldevane"), practice: "Dovecrest Health" },
  { doctor: dr("Leif", "Ashwardine"), practice: "Elmbrae Medical Group" },
  { doctor: dr("Moira", "Kelvarren"), practice: "Greyquill Practice" },
  { doctor: dr("Ronan", "Tresswell"), practice: "Hollinbrook Medical" },
  { doctor: dr("Vida", "Quarrendell"), practice: "Inverbrae Health" },
  { doctor: dr("Edric", "Sollerby"), practice: "Larkmere Family Medical" },
  { doctor: dr("Nell", "Vardacombe"), practice: "Mossgate Medical Centre" },
  { doctor: dr("Corin", "Belstrade"), practice: "Northbrae Practice" },
  { doctor: dr("Halle", "Morrisande"), practice: "Oldquay Health" },
  { doctor: dr("Dmitri", "Rendlesham"), practice: "Pellbrook Family Practice" },
  { doctor: dr("Yara", "Castlemond"), practice: "Quaymoss Medical" },
  { doctor: dr("Bram", "Ellerwick"), practice: "Rookhaven Health" },
];

/** "Dr A. Penderell, Bellmoss Family Practice": the line the patient record shows. */
export function generalPractitionerLine(gp: GeneralPractitioner): string {
  return `${staffInitialName(gp.doctor)}, ${gp.practice}`;
}

/** Community clinicians named on a patient's community record. */
export const COMMUNITY_CLINICIANS = {
  caseManagerA: person("Lin", "Achterby"),
  caseManagerB: person("Grace", "Wendlebury"),
  caseManagerC: person("Dan", "Firthmoor"),
  caseManagerD: person("Minh", "Saltrennan"),
  psychiatristA: dr("Asha", "Tollemarsh"),
  psychiatristB: dr("Lu", "Vennacott"),
} as const satisfies Record<string, StaffMember>;

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

/** Every staff member on the list, for the name checks. */
export const ALL_STAFF: readonly StaffMember[] = [
  ...HOSPITAL_DOCTORS,
  ...REFERRING_CLINICIANS,
  ...GENERAL_PRACTITIONERS.map((gp) => gp.doctor),
  ...Object.values(COMMUNITY_CLINICIANS),
  ...Object.values(DESK_PERSONA_STAFF),
];

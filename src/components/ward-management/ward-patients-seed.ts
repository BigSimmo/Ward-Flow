import type { Patient } from "@/components/ward-management/ward-patients";
import type { RecordedSex, ReferralGender } from "@/components/ward-management/ward-model";

/**
 * Synthetic patients, and the names are a deliberate choice rather than filler.
 *
 * TWO REQUIREMENTS PULL IN OPPOSITE DIRECTIONS and both are real.
 *
 * The owner asked for RELATED-NAME SEARCH, which can only be demonstrated on things shaped like
 * names. "Test Patient Alpha" and "Patient 004" defeat the requirement they were meant to make safe:
 * you cannot show that a search finds a near-miss if there are no near-misses to find.
 *
 * And a screen of realistic Australian names is at its most dangerous in a room full of health
 * service staff — somebody may recognise a name, or find their own, and a synthetic list is one
 * screenshot away from being read as a patient list.
 *
 * So: NAME-SHAPED AND CLEARLY FICTIONAL. Invented surnames that no Perth phone book carries, paired
 * so that related-name search has something to prove — `Halloway` beside `Hallowin`, `Marrowby`
 * beside `Marrowbee`, `O'Quinn` beside `Oquinn`. A search for "hallow" finds two people, which is
 * the behaviour a clinician needs to see, and neither of them can be anybody.
 *
 * The screens that render these carry a visible synthetic-data marker. That belongs on the screen
 * rather than in this comment: the person in the room is the one who needs to know, and they will
 * never read this file.
 *
 * Dates of birth are fixed rather than computed, so a patient's age does not silently change with
 * the demo clock and every screenshot of this fixture agrees with every other.
 *
 * OWNER RULING R-2026-09-04-A adds nine more fields a patient may hold (see `ward-patients.ts`).
 * Every value below is invented, same as the names: the suburb names and their paired community
 * team are real, verified pairs from `ward-catchment.ts` (this repository's own catchment table,
 * not looked up at runtime here), so the pairing itself is not a mistake for anybody who checks —
 * but the house number, the GP and clinic name, the legal status detail and the interpreter/
 * Aboriginal-or-Torres-Strait-Islander-status values are all fictional and vary patient to patient
 * so the field set has something to render other than one repeated example.
 *
 * 🔴 `sex` (renamed from `sexOrGender`, same values) and `gender` (new, owner ruling
 * 2026-09-09/2026-09-10): every patient except PT-007 and PT-016 has both. For most, a
 * straight cis reading of the invented `sex` value is used for `gender` too. PT-041 (Chloe-Anne)
 * has `sex: "Male"` and `gender: "Female"` to exercise the trans gender placement ruling.
 * **PT-007 and PT-016 are left WITHOUT a `gender` on purpose, and it is not an oversight to fill in.**
 * Their `sex` is recorded as "Non-binary" — a real value the free-text field can hold — and `gender`
 * is fixed by the ruling to exactly two values, `"Female" | "Male"`. Forcing them into one would be
 * exactly the harm the ruling exists to prevent; leaving `gender` `undefined` is the honest "not yet
 * recorded" state, and they are the fixture's proof that this state is real data, not just a type
 * nobody exercises.
 *
 * PT-044 TO PT-104 were added for the ward seed-audit follow-up (task T0,
 * `D:/Temp/claude/seed-patient-link-audit.md`) so that every seeded movement, referral and
 * admission names a patient who actually agrees with it. See the comment directly above PT-044
 * for the rules those 61 rows follow, and the comment above `generateSeedPatient` further down for
 * the other 256 patients this task adds the generator for but does not itself build.
 */
export const wardPatients: Patient[] = [
  {
    id: "PT-001",
    umrn: "UM100001",
    givenName: "Talia",
    familyName: "Halloway",
    dateOfBirth: "1988-03-14",
    preferredName: "Tali",
    sex: "Female",
    gender: "Female",
    address: "No. 7, Ashfield",
    suburb: "Ashfield",
    generalPractitioner: "Dr A. Farrowmere, Hallowcrest Family Medical",
    catchmentCommunityTeam: "Midland Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-002",
    umrn: "UM100002",
    givenName: "Marcus",
    familyName: "Hallowin",
    dateOfBirth: "1961-11-02",
    preferredName: "Marc",
    sex: "Male",
    gender: "Male",
    address: "No. 23, Bassendean",
    suburb: "Bassendean",
    generalPractitioner: "Dr T. Oakenfell, Marrowvale Medical Centre",
    catchmentCommunityTeam: "Midland Community Team",
    legalStatus: "Involuntary patient (recorded)",
    aboriginalOrTorresStraitIslanderStatus: "Not stated",
    interpreterLanguage: "Vietnamese — interpreter required",
  },
  {
    id: "PT-003",
    umrn: "UM100003",
    givenName: "Ines",
    familyName: "Marrowby",
    dateOfBirth: "1995-07-21",
    preferredName: "Nes",
    sex: "Female",
    gender: "Female",
    address: "No. 5, Cannington",
    suburb: "Cannington",
    generalPractitioner: "Dr S. Brackenridge, Quillcross Family Practice",
    catchmentCommunityTeam: "Bentley Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Aboriginal, not Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-004",
    umrn: "UM100004",
    givenName: "Devan",
    familyName: "Marrowbee",
    dateOfBirth: "1974-01-09",
    preferredName: "Dev",
    sex: "Male",
    gender: "Male",
    address: "No. 118, Beckenham",
    suburb: "Beckenham",
    generalPractitioner: "Dr L. Winterthorn, Oquincrest Medical",
    catchmentCommunityTeam: "Bentley Community Team",
    legalStatus: "Community Treatment Order (recorded)",
    aboriginalOrTorresStraitIslanderStatus: "Not stated",
    interpreterLanguage: "Mandarin — interpreter required",
  },
  {
    id: "PT-005",
    umrn: "UM100005",
    givenName: "Roshan",
    familyName: "O'Quinn",
    dateOfBirth: "2003-05-30",
    preferredName: "Ro",
    sex: "Male",
    gender: "Male",
    address: "No. 61, Bertram",
    suburb: "Bertram",
    generalPractitioner: "Dr M. Ashgrove, Vandersloot Family Clinic",
    catchmentCommunityTeam: "Rockingham Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Torres Strait Islander, not Aboriginal",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-006",
    umrn: "UM100006",
    givenName: "Priya",
    familyName: "Oquinn",
    dateOfBirth: "1952-09-17",
    preferredName: "Pri",
    sex: "Female",
    gender: "Female",
    address: "No. 34, Caversham",
    suburb: "Caversham",
    generalPractitioner: "Dr R. Thistledown, Blennerhast Medical Group",
    catchmentCommunityTeam: "Midland Community Team",
    legalStatus: "Involuntary patient (recorded)",
    aboriginalOrTorresStraitIslanderStatus: "Not stated",
    interpreterLanguage: "Punjabi — interpreter required",
  },
  {
    id: "PT-007",
    umrn: "UM100007",
    givenName: "Feodora",
    familyName: "Blennerhast",
    dateOfBirth: "1969-12-25",
    preferredName: "Feo",
    // R7 (25 Sept 2026): sex Female, matching this person's linked referral RF-007; gender is
    // deliberately NOT recorded on the profile, so the seed keeps one fully recorded person whose
    // gender the clinician must fill in at referral (owner ruling 2026-09-10, point 3) and who needs
    // a coordinator's review before any allocation. RF-007 records it at referral, as that ruling says.
    sex: "Female",
    address: "No. 9, Como",
    suburb: "Como",
    generalPractitioner: "Dr J. Hollowfield, Farrowmere Medical Centre",
    catchmentCommunityTeam: "Bentley Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Aboriginal and Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-008",
    umrn: "UM100008",
    givenName: "Kwame",
    familyName: "Vandersloot",
    dateOfBirth: "1991-04-03",
    preferredName: "Kwe",
    sex: "Male",
    gender: "Male",
    address: "No. 88, East Fremantle",
    suburb: "East Fremantle",
    generalPractitioner: "Dr E. Cresswick, Oakenfell Community Health",
    catchmentCommunityTeam: "Alma Street (Fremantle) Community Team",
    legalStatus: "Community Treatment Order (recorded)",
    aboriginalOrTorresStraitIslanderStatus: "Not stated",
    interpreterLanguage: "Auslan — interpreter required",
  },
  {
    id: "PT-009",
    umrn: "UM100009",
    givenName: "Bao",
    familyName: "Davenport",
    dateOfBirth: "1986-05-12",
    preferredName: "Bao",
    sex: "Male",
    gender: "Male",
    address: "No. 14, Dianella",
    suburb: "Dianella",
    generalPractitioner: "Dr K. Sunder, Dianella Family Practice",
    catchmentCommunityTeam: "Mirrabooka Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "Cantonese — interpreter required",
  },
  {
    id: "PT-010",
    umrn: "UM100010",
    givenName: "Farah",
    familyName: "Davenporton",
    dateOfBirth: "1990-10-18",
    preferredName: "Fari",
    sex: "Female",
    gender: "Female",
    address: "No. 29, Mirrabooka",
    suburb: "Mirrabooka",
    generalPractitioner: "Dr N. Al-Mansoor, Mirrabooka Health Centre",
    catchmentCommunityTeam: "Mirrabooka Community Team",
    legalStatus: "Involuntary patient (recorded)",
    aboriginalOrTorresStraitIslanderStatus: "Not stated",
    interpreterLanguage: "Arabic — interpreter required",
  },
  {
    id: "PT-011",
    umrn: "UM100011",
    givenName: "Kaelan",
    familyName: "Ashford",
    dateOfBirth: "2008-04-12",
    preferredName: "Kae",
    sex: "Male",
    gender: "Male",
    address: "No. 41, Fremantle",
    suburb: "Fremantle",
    generalPractitioner: "Dr G. Vance, Portside Medical Practice",
    catchmentCommunityTeam: "Alma Street (Fremantle) Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-012",
    umrn: "UM100012",
    givenName: "Maya",
    familyName: "Ashgrove",
    dateOfBirth: "2007-08-25",
    preferredName: "May",
    sex: "Female",
    gender: "Female",
    address: "No. 76, Rockingham",
    suburb: "Rockingham",
    generalPractitioner: "Dr C. Lindell, Coastline Medical Group",
    catchmentCommunityTeam: "Rockingham Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-013",
    umrn: "UM100013",
    givenName: "Gianna",
    familyName: "Marrowvale",
    dateOfBirth: "1980-06-15",
    preferredName: "Gia",
    sex: "Female",
    gender: "Female",
    address: "No. 53, Midland",
    suburb: "Midland",
    generalPractitioner: "Dr M. Bellini, Swan Valley Health Clinic",
    catchmentCommunityTeam: "Midland Community Team",
    legalStatus: "Involuntary patient (recorded)",
    aboriginalOrTorresStraitIslanderStatus: "Not stated",
    interpreterLanguage: "Italian — interpreter required",
  },
  {
    id: "PT-014",
    umrn: "UM100014",
    givenName: "Rowena",
    familyName: "Kestrel",
    dateOfBirth: "1993-02-18",
    preferredName: "Ro",
    sex: "Female",
    gender: "Female",
    address: "No. 19, Midland",
    suburb: "Midland",
    generalPractitioner: "Dr H. Zhang, Midland Central Medical",
    catchmentCommunityTeam: "Midland Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "Cantonese — interpreter required",
  },
  {
    id: "PT-015",
    umrn: "UM100015",
    givenName: "Oona",
    familyName: "Flint",
    dateOfBirth: "1998-10-05",
    preferredName: "Oona",
    sex: "Female",
    gender: "Female",
    address: "No. 82, Armadale",
    suburb: "Armadale",
    generalPractitioner: "Dr T. Harbi, Armadale Family Clinic",
    catchmentCommunityTeam: "Armadale Community Team",
    legalStatus: "Involuntary patient (recorded)",
    aboriginalOrTorresStraitIslanderStatus: "Not stated",
    interpreterLanguage: "Arabic — interpreter required",
  },
  {
    id: "PT-016",
    umrn: "UM100016",
    givenName: "Sasha",
    familyName: "Quillcross",
    dateOfBirth: "1994-09-12",
    preferredName: "Sash",
    // R7 (25 Sept 2026): "Non-binary" was this person's GENDER, recorded in the old merged field.
    // Now sex Male and gender Non-binary, matching the linked movement WF-026.
    sex: "Male",
    gender: "Non-binary",
    address: "No. 104, Bentley",
    suburb: "Bentley",
    generalPractitioner: "Dr D. Winter, Hillview Health Practice",
    catchmentCommunityTeam: "Bentley Community Team",
    legalStatus: "Community Treatment Order (recorded)",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-017",
    umrn: "UM100017",
    givenName: "Clara",
    familyName: "Thistledown",
    dateOfBirth: "1948-03-20",
    preferredName: "Clare",
    sex: "Female",
    gender: "Female",
    address: "No. 12, Caversham",
    suburb: "Caversham",
    generalPractitioner: "Dr R. Thistledown, Blennerhast Medical Group",
    catchmentCommunityTeam: "Midland Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Aboriginal, not Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-018",
    umrn: "UM100018",
    givenName: "Arthur",
    familyName: "Winterthorn",
    dateOfBirth: "1944-11-14",
    preferredName: "Art",
    sex: "Male",
    gender: "Male",
    address: "No. 67, Como",
    suburb: "Como",
    generalPractitioner: "Dr J. Hollowfield, Farrowmere Medical Centre",
    catchmentCommunityTeam: "Bentley Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-019",
    umrn: "UM100019",
    givenName: "Ewan",
    familyName: "Shalecroft",
    dateOfBirth: "1974-05-18",
    preferredName: "Ewan",
    sex: "Male",
    gender: "Male",
    address: "No. 44, Armadale",
    suburb: "Armadale",
    generalPractitioner: "Dr T. Harbi, Armadale Family Clinic",
    catchmentCommunityTeam: "Armadale Community Team",
    legalStatus: "Community Treatment Order (recorded)",
    aboriginalOrTorresStraitIslanderStatus: "Aboriginal, not Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-020",
    umrn: "UM100020",
    givenName: "Dermot",
    familyName: "Hawthornby",
    dateOfBirth: "1989-08-22",
    preferredName: "Dermot",
    sex: "Male",
    gender: "Male",
    address: "No. 19, Fremantle",
    suburb: "Fremantle",
    generalPractitioner: "Dr C. Rowan, Port City Practice",
    catchmentCommunityTeam: "Alma Street (Fremantle) Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-021",
    umrn: "UM100021",
    givenName: "Callum",
    familyName: "Finchgrove",
    dateOfBirth: "1976-12-04",
    preferredName: "Cal",
    sex: "Male",
    gender: "Male",
    address: "No. 52, Rockingham",
    suburb: "Rockingham",
    generalPractitioner: "Dr M. O'Shea, Coastal Family Medical",
    catchmentCommunityTeam: "Rockingham Community Team",
    legalStatus: "Involuntary patient (recorded)",
    aboriginalOrTorresStraitIslanderStatus: "Not stated",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-022",
    umrn: "UM100022",
    givenName: "Margery",
    familyName: "Slateridge",
    dateOfBirth: "1946-02-14",
    preferredName: "Marge",
    sex: "Female",
    gender: "Female",
    address: "No. 8, Subiaco",
    suburb: "Subiaco",
    generalPractitioner: "Dr H. Vance, Parkview Health",
    catchmentCommunityTeam: "Inner City Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-023",
    umrn: "UM100023",
    givenName: "Tobias",
    familyName: "Wren",
    dateOfBirth: "1991-09-17",
    preferredName: "Toby",
    sex: "Male",
    gender: "Male",
    address: "No. 14, Greenfields",
    suburb: "Greenfields",
    generalPractitioner: "Dr E. Waters, Peel Family Practice",
    catchmentCommunityTeam: "Peel Community Team",
    legalStatus: "Involuntary patient (recorded)",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-024",
    umrn: "UM100024",
    givenName: "Ivo",
    familyName: "Bramblewick",
    dateOfBirth: "2002-04-11",
    preferredName: "Ivo",
    sex: "Male",
    gender: "Male",
    address: "No. 16, Joondalup",
    suburb: "Joondalup",
    generalPractitioner: "Dr S. Chen, Lakeside Medical Group",
    catchmentCommunityTeam: "Joondalup Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Torres Strait Islander, not Aboriginal",
    interpreterLanguage: "Tagalog — interpreter required",
  },
  {
    id: "PT-025",
    umrn: "UM100025",
    givenName: "Rosalind",
    familyName: "Kestrelworth",
    dateOfBirth: "1990-11-29",
    preferredName: "Ros",
    sex: "Female",
    gender: "Female",
    address: "No. 29, Stirling",
    suburb: "Stirling",
    generalPractitioner: "Dr K. Patel, Stirling Cross Health",
    catchmentCommunityTeam: "Stirling Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-026",
    umrn: "UM100026",
    givenName: "Alastair",
    familyName: "Pendelbury",
    dateOfBirth: "1958-07-03",
    preferredName: "Al",
    sex: "Male",
    gender: "Male",
    address: "No. 102, Albany",
    suburb: "Albany",
    generalPractitioner: "Dr G. Hughes, Harbour Medical",
    catchmentCommunityTeam: "Albany Community Team",
    legalStatus: "Involuntary patient (recorded)",
    aboriginalOrTorresStraitIslanderStatus: "Aboriginal, not Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-027",
    umrn: "UM100027",
    givenName: "Piet",
    familyName: "Sarrelton",
    dateOfBirth: "2003-01-25",
    preferredName: "Piet",
    sex: "Male",
    gender: "Male",
    address: "No. 14, Bunbury",
    suburb: "Bunbury",
    generalPractitioner: "Dr B. Craig, South West Health",
    catchmentCommunityTeam: "Bunbury Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-028",
    umrn: "UM100028",
    givenName: "Anselm",
    familyName: "Heronvale",
    dateOfBirth: "1987-06-19",
    preferredName: "Anse",
    sex: "Male",
    gender: "Male",
    address: "No. 37, Geraldton",
    suburb: "Geraldton",
    generalPractitioner: "Dr N. Brand, Batavia Medical",
    catchmentCommunityTeam: "Geraldton Community Team",
    legalStatus: "Community Treatment Order (recorded)",
    aboriginalOrTorresStraitIslanderStatus: "Aboriginal and Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-029",
    umrn: "UM100029",
    givenName: "Lucan",
    familyName: "Jasperwick",
    dateOfBirth: "1965-03-30",
    preferredName: "Luke",
    sex: "Male",
    gender: "Male",
    address: "No. 88, Kalgoorlie",
    suburb: "Kalgoorlie",
    generalPractitioner: "Dr W. Gold, Goldfields Medical Centre",
    catchmentCommunityTeam: "Kalgoorlie Community Team",
    legalStatus: "Involuntary patient (recorded)",
    aboriginalOrTorresStraitIslanderStatus: "Not stated",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-030",
    umrn: "UM100030",
    givenName: "Sunniva",
    familyName: "Myrtleford",
    dateOfBirth: "1945-10-12",
    preferredName: "Sunny",
    sex: "Female",
    gender: "Female",
    address: "No. 5, Falcon",
    suburb: "Falcon",
    generalPractitioner: "Dr E. Waters, Peel Family Practice",
    catchmentCommunityTeam: "Peel Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-031",
    umrn: "UM100031",
    givenName: "Harriet",
    familyName: "Starlingcroft",
    dateOfBirth: "2008-08-08",
    preferredName: "Hattie",
    sex: "Female",
    gender: "Female",
    address: "No. 63, Midland",
    suburb: "Midland",
    generalPractitioner: "Dr A. Farrowmere, Hallowcrest Family Medical",
    catchmentCommunityTeam: "Midland Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "Karen — interpreter required",
  },
  {
    id: "PT-032",
    umrn: "UM100032",
    givenName: "Elena",
    familyName: "Rostovska",
    dateOfBirth: "1979-04-05",
    preferredName: "Elena",
    sex: "Female",
    gender: "Female",
    address: "No. 91, Cannington",
    suburb: "Cannington",
    generalPractitioner: "Dr S. Brackenridge, Quillcross Family Practice",
    catchmentCommunityTeam: "Bentley Community Team",
    legalStatus: "Involuntary patient (recorded)",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "Russian — interpreter required",
  },
  {
    id: "PT-033",
    umrn: "UM100033",
    givenName: "Teodor",
    familyName: "Banksiavale",
    dateOfBirth: "1986-12-15",
    preferredName: "Teo",
    sex: "Male",
    gender: "Male",
    address: "No. 22, Victoria Park",
    suburb: "Victoria Park",
    generalPractitioner: "Dr J. Hollowfield, Farrowmere Medical Centre",
    catchmentCommunityTeam: "Bentley Community Team",
    legalStatus: "Community Treatment Order (recorded)",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "Mandarin — interpreter required",
  },
  {
    id: "PT-034",
    umrn: "UM100034",
    givenName: "Magnus",
    familyName: "Vancewell",
    dateOfBirth: "1972-09-02",
    preferredName: "Mag",
    sex: "Male",
    gender: "Male",
    address: "No. 110, Perth",
    suburb: "Perth",
    generalPractitioner: "Dr H. Vance, Parkview Health",
    catchmentCommunityTeam: "Inner City Community Team",
    legalStatus: "Involuntary patient (recorded)",
    aboriginalOrTorresStraitIslanderStatus: "Aboriginal, not Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-035",
    umrn: "UM100035",
    givenName: "Sarah",
    familyName: "Jenkinwood",
    dateOfBirth: "1997-02-18",
    preferredName: "Sarah",
    sex: "Female",
    gender: "Female",
    address: "No. 18, Balcatta",
    suburb: "Balcatta",
    generalPractitioner: "Dr V. Karrin, Balcatta Family Practice",
    catchmentCommunityTeam: "Stirling Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "Italian — interpreter required",
  },
  {
    id: "PT-036",
    umrn: "UM100036",
    givenName: "Luke",
    familyName: "Daviecroft",
    dateOfBirth: "1981-10-23",
    preferredName: "Luke",
    sex: "Male",
    gender: "Male",
    address: "No. 47, Guildford",
    suburb: "Guildford",
    generalPractitioner: "Dr T. Swan, Swan Valley Medical Centre",
    catchmentCommunityTeam: "Midland Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Not stated",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-037",
    umrn: "UM100037",
    givenName: "Liam",
    familyName: "Calvermere",
    dateOfBirth: "2005-06-14",
    preferredName: "Liam",
    sex: "Male",
    gender: "Male",
    address: "No. 31, Ellenbrook",
    suburb: "Ellenbrook",
    generalPractitioner: "Dr T. Oakenfell, Marrowvale Medical Centre",
    catchmentCommunityTeam: "Midland Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "Auslan — interpreter required",
  },
  {
    id: "PT-038",
    umrn: "UM100038",
    givenName: "Fiona",
    familyName: "Gallaglen",
    dateOfBirth: "1968-01-31",
    preferredName: "Fee",
    sex: "Female",
    gender: "Female",
    address: "No. 76, Claremont",
    suburb: "Claremont",
    generalPractitioner: "Dr H. Vance, Parkview Health",
    catchmentCommunityTeam: "Inner City Community Team",
    legalStatus: "Community Treatment Order (recorded)",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-039",
    umrn: "UM100039",
    givenName: "Dominic",
    familyName: "Barstowen",
    dateOfBirth: "1993-05-19",
    preferredName: "Dom",
    sex: "Male",
    gender: "Male",
    address: "No. 58, Baldivis",
    suburb: "Baldivis",
    generalPractitioner: "Dr M. O'Shea, Coastal Family Medical",
    catchmentCommunityTeam: "Rockingham Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "Spanish — interpreter required",
  },
  {
    id: "PT-040",
    umrn: "UM100040",
    givenName: "Beatrix",
    familyName: "Carstairson",
    dateOfBirth: "1952-11-08",
    preferredName: "Bea",
    sex: "Female",
    gender: "Female",
    address: "No. 83, Scarborough",
    suburb: "Scarborough",
    generalPractitioner: "Dr K. Patel, Stirling Cross Health",
    catchmentCommunityTeam: "Stirling Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Aboriginal, not Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-041",
    umrn: "UM100041",
    givenName: "Chloe-Anne",
    familyName: "Thornecliff",
    dateOfBirth: "1999-04-18",
    preferredName: "Chloe",
    sex: "Male",
    gender: "Female",
    address: "No. 42, Joondalup",
    suburb: "Joondalup",
    generalPractitioner: "Dr S. Chen, Lakeside Medical Group",
    catchmentCommunityTeam: "Joondalup Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-042",
    umrn: "UM100042",
    givenName: "Lucas",
    familyName: "Thornecliffe",
    dateOfBirth: "2011-06-15",
    preferredName: "Luke",
    sex: "Male",
    gender: "Male",
    address: "No. 19, Midland",
    suburb: "Midland",
    generalPractitioner: "Dr T. Oakenfell, Marrowvale Medical Centre",
    catchmentCommunityTeam: "East Metro Youth Community Team",
    legalStatus: "Involuntary patient (recorded) — Form 1A",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-043",
    umrn: "UM100043",
    givenName: "Fiona",
    familyName: "Vandermeer",
    dateOfBirth: "1989-08-15",
    preferredName: "Fee",
    sex: "Female",
    gender: "Female",
    address: "No. 88, Nedlands",
    suburb: "Nedlands",
    generalPractitioner: "Dr H. Vance, Parkview Health",
    catchmentCommunityTeam: "Inner City Community Team",
    legalStatus: "Involuntary patient (recorded) — Form 3A",
    aboriginalOrTorresStraitIslanderStatus: "Not stated",
    interpreterLanguage: "English — no interpreter required",
  },

  // ── PT-044 to PT-104, ward seed-audit follow-up task T0 (D:/Temp/claude/seed-patient-link-audit.md,
  // section 3; owner answers 25 Sept 2026: "all recommended"). Every one of the 268 admissions, 77
  // movements and 31 referrals the audit found unlinked or contradicting its patient needs an honest
  // link. These 61 are the hand-authored half — one per hand-written record — continuing this file's
  // UM1000xx record-number series. The other 256 (one per routine movement, one per unlinked bed
  // occupant) are built by `generateSeedPatient` below, next to the records they describe, not here.
  //
  // Deliberately MINIMAL rather than matching PT-001 to PT-043's full nine optional fields: the plan
  // asks only for identity plus sex/gender plus a suburb/catchmentCommunityTeam pair, and inventing
  // an address, GP, legal status, Aboriginal-or-Torres-Strait-Islander status or interpreter language
  // nobody asked for would be a clinical-shaped fact this task was not given. `preferredName` is
  // likewise left unset throughout.
  //
  // 🔴 GENDER, owner ruling given directly for this task: Female or Male only, or absent where it is
  // not yet recorded — never any other value, and never guessed from `sex`. Most records below carry
  // only a `sex` value on the movement/referral they are for (no separate gender was ever recorded on
  // that record), so `gender` stays unset for them, exactly like `Patient.gender`'s own "not yet
  // recorded" state elsewhere in this file. Where the record independently recorded a matching gender
  // (WF-RD05, and the 21 named below per the plan's own table), `gender` is set to it.
  //
  // SUBURB / CATCHMENT TEAM: only ever a pair already verified elsewhere in this file (PT-001 to
  // PT-043, or an earlier entry in this block) — never invented afresh and never looked up from
  // `ward-catchment.ts` at runtime, matching this file's existing practice. Where a record names a
  // suburb with no verified team pairing yet (Kununurra, Bellevue, Beechboro, Bullsbrook, Boya,
  // Brigadoon), the suburb is still the record's own true fact but `catchmentCommunityTeam` is left
  // unset. Where a record carries only a `homeRegion` and no suburb (the four AD-LEFT and three
  // AD-WAIT records), a verified suburb inside that region is used if one exists in this file already
  // (Kimberley and Wheatbelt have none, so both fields stay unset for those two).
  //
  // The 21 rows below (PT-044 to PT-064) are individually specified by the plan's own table (section
  // 3). The 40 after them (PT-065 to PT-104) follow the plan's one general rule for the remaining
  // hand-written records — the 14 rulings-demo overlay movements, the 19 unlinked referrals, and the
  // seven AD-LEFT/AD-WAIT records — in the exact order the plan lists them, which fixes the id
  // assignment.
  {
    id: "PT-044",
    umrn: "UM100044",
    givenName: "Imogen",
    familyName: "Orrindale",
    dateOfBirth: "1984-02-09",
    sex: "Female",
    gender: "Female",
    suburb: "Armadale",
    catchmentCommunityTeam: "Armadale Community Team",
  },
  {
    id: "PT-045",
    umrn: "UM100045",
    givenName: "Keira",
    familyName: "Pellingworth",
    dateOfBirth: "1990-07-23",
    sex: "Female",
    gender: "Female",
    suburb: "Cannington",
    catchmentCommunityTeam: "Bentley Community Team",
  },
  {
    id: "PT-046",
    umrn: "UM100046",
    givenName: "Rhys",
    familyName: "Cadwaller",
    dateOfBirth: "1979-11-30",
    sex: "Male",
    gender: "Male",
    suburb: "Kalgoorlie",
    catchmentCommunityTeam: "Kalgoorlie Community Team",
  },
  {
    id: "PT-047",
    umrn: "UM100047",
    givenName: "Noor",
    familyName: "Tremalow",
    dateOfBirth: "1993-03-04",
    sex: "Female",
    gender: "Female",
    suburb: "Greenfields",
    catchmentCommunityTeam: "Peel Community Team",
  },
  {
    id: "PT-048",
    umrn: "UM100048",
    givenName: "Owen",
    familyName: "Uskarby",
    dateOfBirth: "1982-09-15",
    sex: "Male",
    gender: "Male",
    suburb: "Rockingham",
    catchmentCommunityTeam: "Rockingham Community Team",
  },
  {
    id: "PT-049",
    umrn: "UM100049",
    givenName: "Winifred",
    familyName: "Ybarrow",
    dateOfBirth: "1947-05-02",
    sex: "Female",
    gender: "Female",
    suburb: "Balcatta",
    catchmentCommunityTeam: "Stirling Community Team",
  },
  {
    id: "PT-050",
    umrn: "UM100050",
    givenName: "Declan",
    familyName: "Nettlecombe",
    dateOfBirth: "1996-12-11",
    sex: "Male",
    gender: "Male",
    suburb: "Joondalup",
    catchmentCommunityTeam: "Joondalup Community Team",
  },
  {
    id: "PT-051",
    umrn: "UM100051",
    givenName: "Saoirse",
    familyName: "Loxbury",
    dateOfBirth: "1988-06-27",
    sex: "Female",
    gender: "Female",
    suburb: "Joondalup",
    catchmentCommunityTeam: "Joondalup Community Team",
  },
  {
    id: "PT-052",
    umrn: "UM100052",
    givenName: "Horace",
    familyName: "Iverstone",
    dateOfBirth: "1950-01-19",
    sex: "Male",
    gender: "Male",
    suburb: "Geraldton",
    catchmentCommunityTeam: "Geraldton Community Team",
  },
  {
    // WF-012: sex Female, gender Non-binary. The linked movement WF-012 records Non-binary, and R7
    // (25 Sept 2026) lets `Patient.gender` hold it, so the person and their movement now agree
    // (26 Sept 2026: one person showed two genders). The coordinator still reviews before
    // allocation, because gender is not female or male.
    id: "PT-053",
    umrn: "UM100053",
    givenName: "Ari",
    familyName: "Grimsdale",
    dateOfBirth: "1995-04-02",
    sex: "Female",
    gender: "Non-binary",
    suburb: "Rockingham",
    catchmentCommunityTeam: "Rockingham Community Team",
  },
  {
    id: "PT-054",
    umrn: "UM100054",
    givenName: "Callan",
    familyName: "Zennor",
    dateOfBirth: "1987-04-08",
    sex: "Male",
    gender: "Male",
    suburb: "Falcon",
    catchmentCommunityTeam: "Peel Community Team",
  },
  {
    id: "PT-055",
    umrn: "UM100055",
    givenName: "Tamsin",
    familyName: "Rookwell",
    dateOfBirth: "1991-10-14",
    sex: "Female",
    gender: "Female",
    suburb: "Geraldton",
    catchmentCommunityTeam: "Geraldton Community Team",
  },
  {
    id: "PT-056",
    umrn: "UM100056",
    givenName: "Jasper",
    familyName: "Embleton",
    dateOfBirth: "1985-08-21",
    sex: "Male",
    gender: "Male",
    suburb: "Subiaco",
    catchmentCommunityTeam: "Inner City Community Team",
  },
  {
    id: "PT-057",
    umrn: "UM100057",
    givenName: "Mirela",
    familyName: "Pardoe",
    dateOfBirth: "1998-01-06",
    sex: "Female",
    gender: "Female",
    suburb: "Nedlands",
    catchmentCommunityTeam: "Inner City Community Team",
  },
  {
    id: "PT-058",
    umrn: "UM100058",
    givenName: "Edmund",
    familyName: "Sallowfield",
    dateOfBirth: "1943-08-30",
    sex: "Male",
    gender: "Male",
    suburb: "Murdoch",
  },
  {
    // Mandurah: the deliberately contested suburb (`ward-catchment.ts`) — named because it is the
    // referral's own true fact, not because a team can be verified for it.
    id: "PT-059",
    umrn: "UM100059",
    givenName: "Reginald",
    familyName: "Wickerby",
    dateOfBirth: "1951-06-12",
    sex: "Male",
    gender: "Male",
    suburb: "Mandurah",
  },
  {
    id: "PT-060",
    umrn: "UM100060",
    givenName: "Cyril",
    familyName: "Coldharbour",
    dateOfBirth: "1945-02-25",
    sex: "Male",
    gender: "Male",
    suburb: "Murdoch",
  },
  {
    // RF-006: no fixed address. Suburb is correctly absent, not merely unverified.
    id: "PT-061",
    umrn: "UM100061",
    givenName: "Darcy",
    familyName: "Dunmorrow",
    dateOfBirth: "1989-05-17",
    sex: "Male",
    gender: "Male",
  },
  {
    id: "PT-062",
    umrn: "UM100062",
    givenName: "Ellery",
    familyName: "Esterhall",
    dateOfBirth: "2008-09-03",
    sex: "Female",
    gender: "Female",
    suburb: "Geraldton",
    catchmentCommunityTeam: "Geraldton Community Team",
  },
  {
    id: "PT-063",
    umrn: "UM100063",
    givenName: "Lorna",
    familyName: "Gorsebrook",
    dateOfBirth: "1986-12-01",
    sex: "Female",
    gender: "Female",
    suburb: "Fremantle",
    catchmentCommunityTeam: "Alma Street (Fremantle) Community Team",
  },
  {
    id: "PT-064",
    umrn: "UM100064",
    givenName: "Merrick",
    familyName: "Sedgeward",
    dateOfBirth: "1983-03-22",
    sex: "Male",
    gender: "Male",
    suburb: "Midland",
    catchmentCommunityTeam: "Midland Community Team",
  },

  // ── PT-065 to PT-104: the 40 remaining hand-authored records, one rule (section 3 of the audit
  // plan): sex is the record's own; date of birth is set so `patientCohort` gives the record's
  // cohort; suburb is the referral's named suburb where it has one, otherwise a verified suburb in
  // the admission's `homeRegion`, or unset if none exists; gender equals sex only where the record
  // itself separately recorded a gender, and is otherwise left "not yet recorded". Order fixes the
  // id: the 14 rulings-demo overlay movements, then the 19 unlinked referrals, then AD-LEFT-02 to
  // AD-LEFT-05, then AD-WAIT-01 to AD-WAIT-03 — the exact order the plan's section 2b lists them.
  {
    id: "PT-065", // WF-RD01
    umrn: "UM100065",
    givenName: "Freya",
    familyName: "Sorrelgate",
    dateOfBirth: "1994-05-19",
    sex: "Female",
  },
  {
    id: "PT-066", // WF-RD02
    umrn: "UM100066",
    givenName: "Anton",
    familyName: "Duskwell",
    dateOfBirth: "1988-06-14",
    sex: "Male",
  },
  {
    // WF-RD05 is the one overlay movement whose own record separately carries a matching gender
    // ("Adult Female/Female" in the plan's own notation), so gender is set here.
    id: "PT-067", // WF-RD05
    umrn: "UM100067",
    givenName: "Isla",
    familyName: "Ferngate",
    dateOfBirth: "1991-02-08",
    sex: "Female",
    gender: "Female",
  },
  {
    id: "PT-068", // WF-RD10
    umrn: "UM100068",
    givenName: "Milo",
    familyName: "Hartleymoor",
    dateOfBirth: "1983-06-30",
    sex: "Male",
  },
  {
    id: "PT-069", // WF-RD12
    umrn: "UM100069",
    givenName: "Verity",
    familyName: "Oakendell",
    dateOfBirth: "1996-06-12",
    sex: "Female",
  },
  {
    id: "PT-070", // WF-RD09-1AW
    umrn: "UM100070",
    givenName: "Aisling",
    familyName: "Brindlewood",
    dateOfBirth: "1990-01-25",
    sex: "Female",
  },
  {
    id: "PT-071", // WF-RD09-1AR
    umrn: "UM100071",
    givenName: "Marisol",
    familyName: "Cresthollow",
    dateOfBirth: "1987-03-17",
    sex: "Female",
  },
  {
    id: "PT-072", // WF-RD09-3C
    umrn: "UM100072",
    givenName: "Petra",
    familyName: "Duncannon",
    dateOfBirth: "1993-07-04",
    sex: "Female",
  },
  {
    id: "PT-073", // WF-RD09-3D
    umrn: "UM100073",
    givenName: "Rowan",
    familyName: "Elmsgate",
    dateOfBirth: "1985-06-09",
    sex: "Female",
  },
  {
    id: "PT-074", // WF-RD09-6A
    umrn: "UM100074",
    givenName: "Odette",
    familyName: "Galewood",
    dateOfBirth: "1999-04-21",
    sex: "Female",
  },
  {
    id: "PT-075", // WF-RD09-6B
    umrn: "UM100075",
    givenName: "Saskia",
    familyName: "Hollacombe",
    dateOfBirth: "1981-06-02",
    sex: "Female",
  },
  {
    id: "PT-076", // WF-RD09-6C
    umrn: "UM100076",
    givenName: "Amara",
    familyName: "Ingleforth",
    dateOfBirth: "1994-06-20",
    sex: "Female",
  },
  {
    id: "PT-077", // WF-RD09-5A
    umrn: "UM100077",
    givenName: "Xanthe",
    familyName: "Juniperwell",
    dateOfBirth: "1989-06-03",
    sex: "Female",
  },
  {
    id: "PT-078", // WF-RD09-5B
    umrn: "UM100078",
    givenName: "Fenella",
    familyName: "Larkstone",
    dateOfBirth: "1997-02-27",
    sex: "Female",
  },
  {
    id: "PT-079", // RF-001
    umrn: "UM100079",
    givenName: "Tilly",
    familyName: "Mossgrave",
    dateOfBirth: "2005-03-11",
    sex: "Female",
    suburb: "Armadale",
    catchmentCommunityTeam: "Armadale Community Team",
  },
  {
    // Kununurra: named because it is RF-002's own true suburb; no verified catchment-team pairing
    // exists in this file for it, so the team stays unset rather than invented.
    id: "PT-080", // RF-002
    umrn: "UM100080",
    givenName: "Carys",
    familyName: "Nightbourne",
    dateOfBirth: "1988-06-02",
    sex: "Female",
    suburb: "Kununurra",
  },
  {
    id: "PT-081", // RF-003
    umrn: "UM100081",
    givenName: "Emrys",
    familyName: "Oldacre",
    dateOfBirth: "1979-07-19",
    sex: "Male",
    suburb: "Nedlands",
    catchmentCommunityTeam: "Inner City Community Team",
  },
  {
    // RF-014 carries no sex of its own — left honestly unset rather than guessed.
    id: "PT-082", // RF-014
    umrn: "UM100082",
    givenName: "Reagan",
    familyName: "Pinewhistle",
    dateOfBirth: "1992-05-05",
    suburb: "Armadale",
    catchmentCommunityTeam: "Armadale Community Team",
  },
  {
    // RF-015 carries no sex of its own either — same as RF-014 above.
    id: "PT-083", // RF-015
    umrn: "UM100083",
    givenName: "Sasha",
    familyName: "Ridgewell",
    dateOfBirth: "1990-06-09",
    suburb: "Armadale",
    catchmentCommunityTeam: "Armadale Community Team",
  },
  {
    id: "PT-084", // RF-016
    umrn: "UM100084",
    givenName: "Nadia",
    familyName: "Summerholt",
    dateOfBirth: "1985-02-14",
    sex: "Female",
    suburb: "Albany",
    catchmentCommunityTeam: "Albany Community Team",
  },
  {
    id: "PT-085", // RF-017
    umrn: "UM100085",
    givenName: "Warrick",
    familyName: "Underbridge",
    dateOfBirth: "1983-06-30",
    sex: "Male",
    suburb: "Bunbury",
    catchmentCommunityTeam: "Bunbury Community Team",
  },
  {
    id: "PT-086", // RF-018
    umrn: "UM100086",
    givenName: "Imani",
    familyName: "Vellamoor",
    dateOfBirth: "1994-06-12",
    sex: "Female",
    suburb: "Geraldton",
    catchmentCommunityTeam: "Geraldton Community Team",
  },
  {
    id: "PT-087", // RF-019
    umrn: "UM100087",
    givenName: "Lior",
    familyName: "Waterstone",
    dateOfBirth: "1987-06-21",
    sex: "Female",
    suburb: "Joondalup",
    catchmentCommunityTeam: "Joondalup Community Team",
  },
  {
    id: "PT-088", // RF-020
    umrn: "UM100088",
    givenName: "Godfrey",
    familyName: "Xanderfield",
    dateOfBirth: "1953-04-09",
    sex: "Male",
    suburb: "Fremantle",
    catchmentCommunityTeam: "Alma Street (Fremantle) Community Team",
  },
  {
    id: "PT-089", // RF-021
    umrn: "UM100089",
    givenName: "Bianca",
    familyName: "Yewbridge",
    dateOfBirth: "1996-01-27",
    sex: "Female",
    suburb: "Subiaco",
    catchmentCommunityTeam: "Inner City Community Team",
  },
  {
    id: "PT-090", // RF-RGHS-01
    umrn: "UM100090",
    givenName: "Meredith",
    familyName: "Brackwater",
    dateOfBirth: "1991-03-03",
    sex: "Female",
    suburb: "Bassendean",
    catchmentCommunityTeam: "Midland Community Team",
  },
  {
    // Bellevue: RF-SCGA-07's own true suburb; no verified team pairing exists in this file.
    id: "PT-091", // RF-SCGA-07
    umrn: "UM100091",
    givenName: "Thaddeus",
    familyName: "Castleburn",
    dateOfBirth: "1980-06-10",
    sex: "Male",
    suburb: "Bellevue",
  },
  {
    id: "PT-092", // RF-GRYS-09
    umrn: "UM100092",
    givenName: "Yolanda",
    familyName: "Driftwood",
    dateOfBirth: "1989-06-07",
    sex: "Female",
    suburb: "Caversham",
    catchmentCommunityTeam: "Midland Community Team",
  },
  {
    // Beechboro: RF-SJGA-05's own true suburb; no verified team pairing exists in this file.
    id: "PT-093", // RF-SJGA-05
    umrn: "UM100093",
    givenName: "Cassia",
    familyName: "Emberfall",
    dateOfBirth: "1993-05-18",
    sex: "Female",
    suburb: "Beechboro",
  },
  {
    id: "PT-094", // RF-BTYO-05
    umrn: "UM100094",
    givenName: "Marguerite",
    familyName: "Foxglenn",
    dateOfBirth: "1951-06-25",
    sex: "Female",
    suburb: "Ashfield",
    catchmentCommunityTeam: "Midland Community Team",
  },
  {
    // Bullsbrook: RF-ARMA-01's own true suburb; no verified team pairing exists in this file.
    id: "PT-095", // RF-ARMA-01
    umrn: "UM100095",
    givenName: "Ottoline",
    familyName: "Greymantle",
    dateOfBirth: "1986-06-04",
    sex: "Female",
    suburb: "Bullsbrook",
  },
  {
    // Boya: RF-ARMA-02's own true suburb; no verified team pairing exists in this file.
    id: "PT-096", // RF-ARMA-02
    umrn: "UM100096",
    givenName: "Barnaby",
    familyName: "Ironbrook",
    dateOfBirth: "1977-06-09",
    sex: "Male",
    suburb: "Boya",
  },
  {
    // Brigadoon: RF-FSHS-01's own true suburb; no verified team pairing exists in this file.
    id: "PT-097", // RF-FSHS-01
    umrn: "UM100097",
    givenName: "Baxter",
    familyName: "Kettlewell",
    dateOfBirth: "1984-02-28",
    sex: "Male",
    suburb: "Brigadoon",
  },
  {
    // AD-LEFT-02's homeRegion is Kimberley — no suburb in this file has a verified pair there, so
    // both fields stay unset rather than guessed.
    id: "PT-098", // AD-LEFT-02
    umrn: "UM100098",
    givenName: "Reuben",
    familyName: "Longmarsh",
    dateOfBirth: "1975-06-06",
    sex: "Male",
  },
  {
    // AD-LEFT-03's homeRegion is Wheatbelt — same reasoning as PT-098 above.
    id: "PT-099", // AD-LEFT-03
    umrn: "UM100099",
    givenName: "Junia",
    familyName: "Moorcastle",
    dateOfBirth: "1982-06-01",
    sex: "Female",
  },
  {
    id: "PT-100", // AD-LEFT-04, homeRegion Great Southern
    umrn: "UM100100",
    givenName: "Ambrose",
    familyName: "Norwellgate",
    dateOfBirth: "1978-01-16",
    sex: "Male",
    suburb: "Albany",
    catchmentCommunityTeam: "Albany Community Team",
  },
  {
    id: "PT-101", // AD-LEFT-05, homeRegion Goldfields-Esperance
    umrn: "UM100101",
    givenName: "Silas",
    familyName: "Ottermill",
    dateOfBirth: "1981-06-08",
    sex: "Male",
    suburb: "Kalgoorlie",
    catchmentCommunityTeam: "Kalgoorlie Community Team",
  },
  {
    id: "PT-102", // AD-WAIT-01, homeRegion Peel
    umrn: "UM100102",
    givenName: "Bethan",
    familyName: "Quarrymoor",
    dateOfBirth: "1990-06-23",
    sex: "Female",
    suburb: "Greenfields",
    catchmentCommunityTeam: "Peel Community Team",
  },
  {
    id: "PT-103", // AD-WAIT-02, homeRegion Perth Metropolitan
    umrn: "UM100103",
    givenName: "Cornelius",
    familyName: "Ravenswood",
    dateOfBirth: "1949-07-11",
    sex: "Male",
    suburb: "Midland",
    catchmentCommunityTeam: "Midland Community Team",
  },
  {
    id: "PT-104", // AD-WAIT-03, homeRegion Goldfields-Esperance
    umrn: "UM100104",
    givenName: "Nova",
    familyName: "Vesperfield",
    dateOfBirth: "2010-02-14",
    sex: "Female",
    suburb: "Kalgoorlie",
    catchmentCommunityTeam: "Kalgoorlie Community Team",
  },
];

/**
 * ── Deterministic generated patients, `PT-G-<record id>` ─────────────────────────────────────
 *
 * Ward seed-audit follow-up (`D:/Temp/claude/seed-patient-link-audit.md`, section 3), task T0.
 * Section 3: "Generated patients are built next to the records they describe: inside
 * `unitOccupants` in `ward-admissions-seed.ts`, for occupants; inside `routineMovements` in
 * `ward-movements.ts`, for routine movements." T1 and T2 own those files and call
 * `generateSeedPatient` from there, next to each record — this file does not build the 256
 * generated patients itself and does not import either fixture to do so.
 *
 * 🔴 THE DIRECTION MATTERS, AND IT IS NOT A STYLE CHOICE. `tests/ward-flow-single-source.test.ts`
 * fails any file outside its own narrow allow-lists that imports `ward-movements.ts` or
 * `ward-admissions-seed.ts` — this file is on neither list. So the generator is exported for THOSE
 * files to call, the same direction every other shared helper in this codebase already runs
 * (`ward-flow-reducer.ts` already imports `wardPatients` from here, never the reverse). Do not
 * "fix" the combining below by having this file import the movements or admissions fixtures back —
 * that is exactly the shape the guard exists to catch.
 *
 * `combineWardPatients` is the "combined export" section 4 of the plan asks this file to carry: it
 * appends whatever generated patients a caller supplies to the hand-authored `wardPatients` above,
 * without ever reading where they came from. The actual combining — where `state.patients` is
 * assembled — belongs to whichever file is already allow-listed to read every fixture at once
 * (`ward-flow-reducer.ts`); that wiring is out of this task's scope (`ward-patients-seed.ts` only).
 *
 * Every generated patient is synthetic on the same two axes the rest of this file uses:
 * `PT-G-<record id>` is not a plausible record id (no seeded id anywhere in this fixture takes that
 * shape), and `UM5xxxxx` is a distinct number band from the hand-authored `UM1000xx` series.
 */

/** Two fixed lists a generated patient's name is drawn from "by index" (section 3) — deliberately
 *  a different naming style from the hand-authored compound surnames above, so a generated patient
 *  is recognisably from this list rather than a copy of a hand-authored one. Checked against every
 *  family name above: none shares a name or a near-miss spelling with the hand-authored set, so
 *  `nearPatients`/`findPatients` cannot confuse a generated occupant with a named record. */
// Every given name holds an "a", so typing "a" finds every seeded person (the typeahead scroll
// test's invariant, pinned in tests/ward-patient-model.test.ts as WF-PAT-02).
const GENERATED_GIVEN_NAMES = [
  "Alaric", "Bramwen", "Calder", "Delia", "Eamon", "Fiora", "Gareth", "Hazelle", "Isadora", "Junia",
  "Kalan", "Lark", "Maren", "Nolan", "Orla", "Petra", "Quinta", "Reya", "Sabine", "Tansy",
] as const;

const GENERATED_FAMILY_NAMES = [
  "Ferrowmoor", "Glasswell", "Huntmire", "Inkstone", "Jorrowfen", "Kellbourne", "Linforth", "Moongate",
  "Norrowfield", "Oxleyburn", "Pallowmere", "Quenfold", "Ridgeholt", "Stonevale", "Trelling",
  "Umberleigh", "Vosswick", "Whistlecombe", "Yarrowfen", "Zelmsworth",
] as const;

export type GeneratedSeedPatientCohort = "Youth" | "Adult" | "Older adult";

export type GeneratedSeedPatientInput = {
  /** The admission or movement id this patient exists for, e.g. `"AD-RPHS-01"` or `"WF-300"` —
   *  becomes the `PT-G-<record id>` identity. */
  recordId: string;
  /** The record's own sex, carried straight across — never invented. R7 (25 Sept 2026): any
   *  recorded sex; "Not recorded" becomes an absent `Patient.sex`. */
  sex: RecordedSex;
  /**
   * R7 (25 Sept 2026): the record's own gender, carried straight across when the caller has one
   * (admissions and movements now do). When this key is present it wins, and `undefined` means
   * not recorded; `genderRecorded` below then plays no part.
   */
  gender?: ReferralGender;
  /** The record's cohort (from `patientCohort`), which decides the date-of-birth band. */
  cohort: GeneratedSeedPatientCohort;
  /** A stable per-record number the caller assigns — e.g. a running count of generated patients
   *  built so far. Selects the name pair and offsets the date of birth within the cohort band, so
   *  the same `(recordId, sex, cohort, index)` always produces the same patient (section 3: "a date
   *  of birth from the cohort band plus the index ... names ... drawn from two fixed lists by
   *  index"). */
  index: number;
  /**
   * Ward capacity's `sexMix` is read from `gender`, not `sex` (owner ruling, 25 Sept 2026 — ward
   * counts follow gender), so a generated bed occupant needs a recorded `gender` to keep that count
   * honest, and defaults to true for that reason. Set `false` only for a generated patient the plan
   * itself calls out as gender-not-recorded.
   */
  genderRecorded?: boolean;
};

/** Whole-year age band per cohort, matching `patientCohort`'s own boundaries (`ward-patients.ts`):
 *  Youth under 25, Older adult 65 or over, Adult between. */
const COHORT_AGE_RANGE: Record<GeneratedSeedPatientCohort, { readonly min: number; readonly span: number }> = {
  Youth: { min: 16, span: 9 }, // 16–24
  Adult: { min: 25, span: 40 }, // 25–64
  "Older adult": { min: 65, span: 20 }, // 65–84
};

/** The demonstration day the rest of this fixture is authored against (the audit plan's own method
 *  section, and `tests/ward-flow-single-source.test.ts`'s neighbouring fixtures) — used only to
 *  turn a whole-years age into one literal ISO date per patient, never read at runtime. */
const REFERENCE_YEAR = 2026;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Builds a `PT-G-<recordId>` patient deterministically from its record's own facts and a caller-
 * supplied index. See `GeneratedSeedPatientInput` for what each field means.
 *
 * The birth month is always January to July (`(index % 7) + 1`), strictly before this fixture's
 * August demonstration day — so the chosen age never depends on whether a birthday has "already
 * happened" this year, and the cohort band boundaries above need no off-by-one buffer.
 */
export function generateSeedPatient(input: GeneratedSeedPatientInput): Patient {
  const { recordId, sex, cohort, index, genderRecorded = true } = input;
  const binarySex = sex === "Female" || sex === "Male" ? sex : undefined;
  const gender = "gender" in input ? input.gender : genderRecorded ? binarySex : undefined;
  const range = COHORT_AGE_RANGE[cohort];
  const age = range.min + (index % range.span);
  const birthYear = REFERENCE_YEAR - age;
  const birthMonth = (index % 7) + 1; // January–July, always before the August reference day
  const birthDay = (index % 27) + 1; // 1–27, valid in every month

  const givenName = GENERATED_GIVEN_NAMES[index % GENERATED_GIVEN_NAMES.length];
  // The family name moves on once every twenty patients, so the two lists pair up 400 ways rather
  // than the same twenty pairs repeating.
  const familyName =
    GENERATED_FAMILY_NAMES[Math.floor(index / GENERATED_GIVEN_NAMES.length) % GENERATED_FAMILY_NAMES.length];
  // UM5xxxxx — a distinct number band from the hand-authored UM1000xx series (section 3), and from
  // UM9xxxxx, which the tests type in as a new person's number and so must never already belong to
  // a seeded one.
  const umrn = `UM5${String(index % 100000).padStart(5, "0")}`;

  return {
    id: `PT-G-${recordId}`,
    umrn,
    givenName,
    familyName,
    dateOfBirth: `${birthYear}-${pad2(birthMonth)}-${pad2(birthDay)}`,
    ...(sex === "Not recorded" ? {} : { sex }),
    ...(gender === undefined ? {} : { gender }),
  };
}

/**
 * The "combined export" section 4 of the audit plan asks this file to carry: hand-authored
 * `wardPatients` above, plus whatever generated patients a caller has already built (T1's
 * occupants, T2's routine movements). Never imports those arrays itself — see the file-level
 * comment above this section for why.
 */
export function combineWardPatients(...generatedGroups: readonly (readonly Patient[])[]): Patient[] {
  return [...wardPatients, ...generatedGroups.flat()];
}

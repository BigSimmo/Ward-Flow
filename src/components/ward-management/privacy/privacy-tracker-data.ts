/**
 * Privacy and data tracker content (D-260, 16 Nov 2026). Screen audit 19 Nov 2026 (item 5): the
 * evidence lines are in plain words, with no file paths and no decision, migration or gate codes;
 * every status is as it was. Generated from the privacy research in the
 * project files (patient-data-requirements-checklist.md and current-state-tracker.md); edit both
 * together. Statuses were checked against main 928fa1a8 and the governance papers on 16 Nov 2026.
 * These are intended requirements only: nothing here is enforced, and this is not legal advice.
 */

export type PrivacyCheckStatus = "met" | "partly" | "notyet";

export type PrivacyCheck = { name: string; status: PrivacyCheckStatus; evidence: string };

type PrivacyPolicyLine = { lead?: string; text: string };

export type PrivacySection = {
  id: string;
  title: string;
  policy: readonly PrivacyPolicyLine[];
  checks: readonly PrivacyCheck[];
  source: string;
};

export const PRIVACY_CHECKED_ON = "16 Nov 2026";

export const PRIVACY_SECTIONS: readonly PrivacySection[] = [
  {
    id: "scope",
    title: "Purpose and scope",
    policy: [
      {
        text: "This policy sets out how BedChart collects, uses, stores, shares and disposes of patient and staff information.",
      },
      {
        lead: "Applies to",
        text: "everyone who uses, runs or supports BedChart, including health service staff, contractors and the vendor.",
      },
      {
        lead: "Covers",
        text: "patient details, bed and referral records, staff accounts, audit logs, backups and reports.",
      },
      {
        lead: "Purpose",
        text: "bed flow and care coordination across WA mental health services. Nothing else.",
      },
      {
        lead: "Operator",
        text: "The health service, a WA public health service. The vendor is a contracted service provider bound by the same privacy obligations.",
      },
      {
        lead: "Laws followed",
        text: "PRIS Act 2024 (WA), Health Services Act 2016 (WA), Mental Health Act (WA), State Records Act 2000 (WA), FOI Act 1992 (WA), and WA Health policies MP 0015/16, 0067/17, 0122/19, 0135/20, 0140/20 and 0144/20.",
      },
      {
        lead: "Where they apply",
        text: "Privacy Act 1988 (Cth) and its notifiable data incident scheme, My Health Records Act 2012 and Healthcare Identifiers Act 2010.",
      },
      {
        lead: "Also considered",
        text: "Cyber Security Act 2024 (Cth), Security of Critical Infrastructure Act 2018 (Cth), the Privacy Act statutory tort (Schedule 2) and the NSQHS Standards.",
      },
    ],
    checks: [
      {
        name: "Scope, purpose and laws confirmed by legal advice",
        status: "notyet",
        evidence: "Not yet done: legal advice. The laws are listed in the draft privacy impact assessment.",
      },
      {
        name: "Intended purpose statement signed",
        status: "notyet",
        evidence: "Not yet done: a signed statement of what BedChart is for.",
      },
    ],
    source: "Legal advice; all sources below",
  },
  {
    id: "governance",
    title: "Privacy governance",
    policy: [
      {
        text: "BedChart follows the 11 Information Privacy Principles, in force since 1 July 2026.",
      },
      {
        text: "Collection, use and disclosure are fair and reasonable. Information the app infers or generates counts as collected.",
      },
      {
        text: "A register lists every kind of personal information BedChart holds and why.",
      },
      {
        text: "A privacy impact assessment was signed before go-live, and is updated before any high privacy impact change.",
      },
      {
        text: "The health service has a named privacy officer and information sharing officer.",
      },
      {
        text: "Privacy complaints go to the privacy officer, and patients may take them to the WA Information Commissioner.",
      },
      {
        text: "Since 10 June 2025 people can sue for a serious invasion of privacy (Privacy Act Schedule 2). Serious misuse is treated as a legal risk as well as a privacy incident.",
      },
    ],
    checks: [
      {
        name: "Privacy impact assessment signed",
        status: "partly",
        evidence: "A draft is written. It is not signed.",
      },
      {
        name: "Privacy officer and information sharing officer named",
        status: "notyet",
        evidence: "Not yet named.",
      },
      {
        name: "Personal information register kept",
        status: "partly",
        evidence: "The list of fields is drafted. It is not approved.",
      },
      {
        name: "Real-data pilot sponsor named",
        status: "notyet",
        evidence: "Not yet named.",
      },
      {
        name: "Legal risk review covers the privacy tort",
        status: "notyet",
        evidence:
          "Not yet done: a legal risk review. People have been able to sue for a serious invasion of privacy since 10 June 2025.",
      },
    ],
    source: "PRIS Act 2024 (WA) · Privacy Act 1988 (Cth) Sch 2",
  },
  {
    id: "confidentiality",
    title: "Confidentiality",
    policy: [
      {
        text: "Every user keeps patient information confidential. Unauthorised collection, use or disclosure carries a fine of up to $5,000.",
      },
      {
        text: "Mental health information has its own duty of confidentiality.",
      },
      {
        text: "Information is disclosed only where the law requires or allows it, such as for a patient's care.",
      },
      {
        text: "Every user accepts a confidentiality and acceptable use statement at first sign-in and once a year.",
      },
    ],
    checks: [
      {
        name: "Confidentiality statement accepted by every user",
        status: "notyet",
        evidence: "Sign-in shows a note that the data is made up. Not yet built: a statement to accept.",
      },
    ],
    source: "Health Services Act 2016 (WA) confidentiality offences · Mental Health Act (WA) confidentiality offence",
  },
  {
    id: "collect",
    title: "Collecting only what is needed",
    policy: [
      {
        text: "BedChart collects only the fields on its approved field list.",
      },
      {
        text: "Set choices replace free text wherever possible.",
      },
      {
        text: "Patient names and typed text never appear in web addresses, alerts, logs, error reports or downloads.",
      },
      {
        text: "The health service gives patients a collection notice explaining why and how information is used.",
      },
    ],
    checks: [
      {
        name: "Field list approved by the privacy officer",
        status: "partly",
        evidence: "Drafted, not approved.",
      },
      {
        name: "Collection notice in use",
        status: "notyet",
        evidence: "Not yet written.",
      },
      {
        name: "No patient detail kept in browser storage outside prototype",
        status: "partly",
        evidence:
          "Unsaved drafts stay off the device only by a build setting. The demo's on-device store is not yet blocked for real data.",
      },
    ],
    source: "WA IPPs · MP 0015/16",
  },
  {
    id: "access",
    title: "Access control",
    policy: [
      {
        text: "Access is need-to-know, with the least access each role requires and separation of duties.",
      },
      {
        text: "Every person has their own account. Shared and generic logins are not allowed.",
      },
      {
        text: "Administrators use separate accounts for administration.",
      },
      {
        text: "Sign-in uses multi-factor authentication.",
      },
      {
        text: "Access is set by role and by ward or service.",
      },
      {
        text: "Break-glass access needs a reason, is logged, and is reviewed within one working week.",
      },
      {
        text: "Line managers review access every quarter. Accounts are removed the day a person leaves.",
      },
      {
        text: "The screen locks after 15 minutes without use.",
      },
    ],
    checks: [
      {
        name: "Multi-factor sign-in on every account",
        status: "partly",
        evidence: "A second sign-in step with an authenticator app is built. It is not yet required for every account.",
      },
      {
        name: "Quarterly access review completed",
        status: "notyet",
        evidence: "The review steps are drafted. Not yet done: a first review.",
      },
      {
        name: "Break-glass reviews up to date",
        status: "partly",
        evidence: "Each break-glass use is logged and cannot be edited. Not yet set: a review schedule and a reviewer.",
      },
      {
        name: "Unique account for each person",
        status: "met",
        evidence: "Each person has their own account. Sign-up is by invitation only, since 14 Nov.",
      },
      {
        name: "Access set by role and ward",
        status: "partly",
        evidence: "The server sets access by role and ward. The database alone does not yet block other wards.",
      },
      {
        name: "Screen locks after 15 minutes",
        status: "met",
        evidence: "The app locks itself when left unused.",
      },
      {
        name: "Sign-out ends a session at once",
        status: "met",
        evidence: "Signing out ends the session on the server.",
      },
      {
        name: "Front door sign-in required",
        status: "partly",
        evidence: "On for the demo. It must stay required for real data.",
      },
    ],
    source: "MP 0067/17 Information Security · MP 0015/16",
  },
  {
    id: "audit",
    title: "Audit log",
    policy: [
      {
        text: "Opening or changing a patient record leaves an entry naming the user, record, action and time.",
      },
      {
        text: "The privacy officer can see every record a person opened or changed.",
      },
      {
        text: "The log is read-only and tamper-proof. Nobody can edit or delete it, including administrators.",
      },
      {
        text: "Administrator actions are logged and protected.",
      },
      {
        text: "The log is checked weekly, and unusual access raises an alert.",
      },
      {
        text: "Server clocks are synced to a reliable time source.",
      },
      {
        text: "Logs are kept for as long as the records they describe.",
      },
    ],
    checks: [
      {
        name: "Tamper-proof audit log set up",
        status: "partly",
        evidence:
          "The audit, record access and break-glass logs cannot be edited or deleted. A restore practice run on 26 Oct lost those locks, so they need to be put back after any restore.",
      },
      {
        name: "Weekly log review on file",
        status: "notyet",
        evidence: "Not yet set: a review schedule and alerts for unusual access.",
      },
    ],
    source: "MP 0067/17 · MP 0144/20",
  },
  {
    id: "hosting",
    title: "Hosting and data location",
    policy: [
      {
        text: "All data is held and processed in Australia: database, servers, backups and logs.",
      },
      {
        text: "BedChart is an Australian-hosted cloud service (WA Health Cloud Zone B), assessed by HSS Security and Risk.",
      },
      {
        text: "No patient information goes to offshore error, push, analytics or AI services.",
      },
      {
        text: "Any My Health Record data stays in Australia.",
      },
      {
        text: "Where the Privacy Act applies, personal information is not disclosed overseas unless APP 8 is met.",
      },
      {
        text: "Each cloud provider holds an IRAP assessment or ISO 27001 certificate.",
      },
    ],
    checks: [
      {
        name: "Australian hosting confirmed for every provider",
        status: "notyet",
        evidence:
          "The database is in Sydney. The app servers are in Singapore. Error reports go to the United States. Phone alert services are global.",
      },
      {
        name: "HSS cloud risk assessment approved",
        status: "notyet",
        evidence: "Not yet done: approval from the health service's IT security team.",
      },
      {
        name: "Supabase organisation AI options turned off",
        status: "notyet",
        evidence: "Still on when checked on 3 Nov. The project owner is to switch them off.",
      },
      {
        name: "No overseas disclosure without APP 8 safeguards",
        status: "notyet",
        evidence: "Error reports go to the United States and the app servers are in Singapore.",
      },
      {
        name: "Cloud providers' IRAP or ISO 27001 evidence on file",
        status: "notyet",
        evidence: "Not yet held: provider certificates or assessments.",
      },
    ],
    source:
      "WA Offshoring Position · MP 0140/20 Cloud · My Health Records Act (data held in Australia) · APP 8 · ASD IRAP",
  },
  {
    id: "security",
    title: "Security",
    policy: [
      {
        text: "Information is encrypted in transit and at rest, including on phones and tablets.",
      },
      {
        text: "Encryption keys are managed through their whole life.",
      },
      {
        text: "Security management follows AS/ISO 27001, 27002 and 27799.",
      },
      {
        text: "BedChart meets the Essential Eight at Maturity Level One or higher.",
      },
      {
        text: "An independent penetration test runs before go-live, every year, and after major changes.",
      },
      {
        text: "No patient information stays on a device after sign-out.",
      },
      {
        text: "Critical security fixes are applied within 2 days. Unsupported software is removed.",
      },
      {
        text: "Security incidents go to the HSS ICT Service Desk, with a plan for escalation to police.",
      },
      {
        text: "Where the Privacy Act applies, reasonable steps protect information from misuse, loss and unauthorised access (APP 11).",
      },
      {
        text: "If a ransom is ever paid, it is reported to the Australian Signals Directorate within 3 days (Cyber Security Act 2024, businesses with turnover of $3 million or more).",
      },
      {
        text: "If a hospital using BedChart is a critical hospital under the SOCI Act 2018, BedChart sits inside that hospital's risk management program, and serious cyber incidents are reported to ASD (within half a day if critical).",
      },
    ],
    checks: [
      {
        name: "Penetration test passed",
        status: "notyet",
        evidence: "The brief for the test is written. Not yet done: an independent security test.",
      },
      {
        name: "Essential Eight assessment on file",
        status: "notyet",
        evidence: "Not yet assessed.",
      },
      {
        name: "Encryption in transit and at rest",
        status: "partly",
        evidence:
          "Connections are encrypted and the providers encrypt stored data by default. Not yet confirmed in writing.",
      },
      {
        name: "Strict content security policy",
        status: "met",
        evidence: "Each page allows only its own scripts to run.",
      },
      {
        name: "Sign-in token out of reach of page scripts",
        status: "notyet",
        evidence: "The sign-in token is still kept where page scripts can read it.",
      },
      {
        name: "Web push library reviewed",
        status: "notyet",
        evidence: "Not yet done: a review of the phone alert library.",
      },
      {
        name: "Repository private, history checked",
        status: "notyet",
        evidence: "The code repository is still public.",
      },
      {
        name: "Ransom payment reporting step in the incident plan",
        status: "notyet",
        evidence: "Not yet written: an incident plan. The Cyber Security Act 2024 sets a 3-day reporting time.",
      },
      {
        name: "Critical infrastructure (SOCI) status checked with each hospital",
        status: "notyet",
        evidence: "Not yet asked.",
      },
    ],
    source:
      "MP 0067/17 · ASD Essential Eight · WA Cyber Security Policy · APP 11 · Cyber Security Act 2024 (Cth) ransomware reporting · SOCI Act 2018 (Cth)",
  },
  {
    id: "sharing",
    title: "Use and sharing",
    policy: [
      {
        text: "Information is used only for bed flow and care coordination.",
      },
      {
        text: "Downloads carry no patient names. Prints and TV views are used only where approved.",
      },
      {
        text: "No use for research, reports or AI tools without separate approval.",
      },
      {
        text: "Sharing with another body happens only under a written information sharing agreement.",
      },
      {
        text: "An Aboriginal information assessment comes first. Sensitive Aboriginal information is shared only after consultation and consent.",
      },
      {
        text: "Information used for testing, training or reports is de-identified first, following OAIC and Office of the National Data Commissioner guidance.",
      },
    ],
    checks: [
      {
        name: "Sharing agreements and Aboriginal information assessments on file",
        status: "notyet",
        evidence: "Nothing is shared with other bodies yet. Not yet held: a cultural safety review.",
      },
      {
        name: "No names in downloads",
        status: "met",
        evidence: "Downloads carry no names.",
      },
      {
        name: "TV board privacy review",
        status: "notyet",
        evidence: "The TV board shows full names. Not yet done: a privacy review of it.",
      },
      {
        name: "De-identification method approved before any reuse",
        status: "partly",
        evidence: "The prototype holds made-up data only. Not yet set: a method for real data.",
      },
    ],
    source:
      "PRIS Act 2024 (WA) sharing and Aboriginal information provisions · HSA disclosure offence · OAIC De-identification Decision-Making Framework",
  },
  {
    id: "records",
    title: "Keeping and disposing of records",
    policy: [
      {
        text: "Each kind of record is kept for the period in the approved disposal authority.",
      },
      {
        text: "Patient records follow the Patient Information Retention and Disposal Schedule.",
      },
      {
        text: "Records are destroyed only under that authority, and each disposal is recorded.",
      },
      {
        text: "Backups and logs follow the same rules.",
      },
    ],
    checks: [
      {
        name: "Retention periods set by the records manager",
        status: "partly",
        evidence:
          "A plan for how long records are kept is drafted. Not yet named: a records manager. Some questions are still open.",
      },
      {
        name: "Disposal register kept",
        status: "notyet",
        evidence: "Not yet started.",
      },
      {
        name: "Paid backups and a passed restore drill",
        status: "notyet",
        evidence: "Not yet set up: database backups. A restore practice run did not keep the audit log locks.",
      },
    ],
    source: "State Records Act 2000 (WA) · MP 0144/20",
  },
  {
    id: "incidents",
    title: "Privacy incidents and concerns",
    policy: [
      {
        text: "A privacy incident is unauthorised access, use or disclosure, or loss, damage or destruction of information.",
      },
      {
        text: "Anyone who suspects a privacy incident tells the privacy officer straight away using Report a concern. No patient details are typed in.",
      },
      {
        text: "The privacy officer follows an incident response plan tested every year.",
      },
      {
        text: "Notifiable privacy incidents go to the WA Information Commissioner and the people affected as soon as practicable.",
      },
      {
        text: "Where the Privacy Act applies, a suspected privacy incident is assessed within 30 days.",
      },
      {
        text: "Security incidents also go to the HSS ICT Service Desk. Patient safety incidents follow the clinical incident policy.",
      },
    ],
    checks: [
      {
        name: "Incident response plan tested this year",
        status: "partly",
        evidence: "A plan is drafted. Not yet done: a practice run.",
      },
    ],
    source: "MP 0135/20 · PRIS Act 2024 (WA) · OAIC NDB scheme",
  },
  {
    id: "rights",
    title: "Patients' rights",
    policy: [
      {
        text: "Patients can ask to see or correct their information, including under the FOI Act 1992 (WA).",
      },
      {
        text: "BedChart can find and export one person's records when asked.",
      },
      {
        text: "Corrections record who changed what, when and why.",
      },
      {
        text: "Where the Privacy Act applies, access and correction also follow APP 12 and APP 13.",
      },
    ],
    checks: [
      {
        name: "Access and correction process tested",
        status: "partly",
        evidence: "The correction steps are drafted. Not yet tested. Not yet built: an export of one person's records.",
      },
      {
        name: "Access and correction meet APP 12 and 13 where they apply",
        status: "partly",
        evidence: "Each correction is kept in the audit log. Not yet built: an export of one person's records.",
      },
    ],
    source: "WA IPPs · FOI Act 1992 (WA) · APP 12 and 13",
  },
  {
    id: "clinical",
    title: "Clinical safety",
    policy: [
      {
        text: "BedChart is administrative bed management software and makes no clinical claims, so it sits outside TGA medical device rules.",
      },
      {
        text: "Any feature that scores or advises on a patient is reviewed against TGA clinical decision support guidance first.",
      },
      {
        text: "A clinical safety case is signed by the named clinical safety owner.",
      },
      {
        text: "Patient safety incidents linked to BedChart are managed as clinical incidents.",
      },
      {
        text: "Records meet the NSQHS Clinical Governance Standard for healthcare records (Actions 1.16 to 1.18).",
      },
    ],
    checks: [
      {
        name: "TGA exclusion confirmed",
        status: "partly",
        evidence: "The reasoning is drafted. Not yet done: a view from a regulatory adviser.",
      },
      {
        name: "Clinical safety case signed",
        status: "partly",
        evidence: "The safety case and hazard log are drafted. Not yet named: an owner. Not signed.",
      },
      {
        name: "Records carry a sample or real marker",
        status: "notyet",
        evidence: "Not yet done.",
      },
      {
        name: "Aboriginal cultural safety review held",
        status: "notyet",
        evidence: "Not yet held.",
      },
      {
        name: "Records checked against NSQHS Actions 1.16 to 1.18",
        status: "notyet",
        evidence: "Not yet held: a healthcare records review.",
      },
    ],
    source: "TGA item 14G exclusion · TGA CDSS guidance · MP 0122/19 · NSQHS Standards Actions 1.16 to 1.18",
  },
  {
    id: "ai",
    title: "Automated decisions, AI and identifiers",
    policy: [
      {
        text: "BedChart makes no automated decisions about patients. People make every decision.",
      },
      {
        text: "If that changes and the Privacy Act applies, the privacy policy explains them from 10 December 2026.",
      },
      {
        text: "No personal information is sent to AI tools.",
      },
      {
        text: "Individual Healthcare Identifiers, if ever used, are used only as the law allows.",
      },
    ],
    checks: [
      {
        name: "No automated decisions or AI use confirmed",
        status: "met",
        evidence: "People make every decision, and no real data goes to AI tools. Check again before release.",
      },
    ],
    source: "APP 1.7–1.9 · Healthcare Identifiers Act 2010",
  },
  {
    id: "vendors",
    title: "Vendors and contracts",
    policy: [
      {
        text: "Every provider contract protects health information and allows external audits.",
      },
      {
        text: "Vendor staff with access pass criminal record checks.",
      },
      {
        text: "Every subprocessor is listed and its supply chain risk agreed.",
      },
      {
        text: "Each provider has a data processing agreement and Australian hosting.",
      },
      {
        text: "External access is requested through WA Health forms HFN-057 and HFN-060.",
      },
    ],
    checks: [
      {
        name: "Contracts, checks and processing agreements on file",
        status: "notyet",
        evidence: "Not yet in place: data processing terms with the hosting, database and error report providers.",
      },
      {
        name: "Staff training and competency check",
        status: "partly",
        evidence: "A competency check is drafted.",
      },
    ],
    source: "MP 0067/17 · MP 0140/20",
  },
];

/** Section 16: the sign-offs that close the policy. */
export const PRIVACY_SIGN_OFFS: readonly PrivacyCheck[] = [
  {
    name: "Privacy officer approval",
    status: "notyet",
    evidence: "Not yet named: a privacy officer.",
  },
  {
    name: "Clinical safety owner approval",
    status: "notyet",
    evidence: "Not yet named: a clinical safety owner.",
  },
  {
    name: "Legal review",
    status: "notyet",
    evidence: "Not yet done.",
  },
  {
    name: "System owner approval",
    status: "notyet",
    evidence: "The project owner is the system owner. Not yet signed.",
  },
];

export const PRIVACY_ROLES: readonly { role: string; duty: string }[] = [
  {
    role: "Privacy officer",
    duty: "This policy, the PIA, privacy incidents, complaints and break-glass reviews",
  },
  {
    role: "Information sharing officer",
    duty: "Sharing agreements and Aboriginal information assessments",
  },
  {
    role: "Clinical safety owner",
    duty: "The clinical safety case and clinical incidents",
  },
  {
    role: "Records manager",
    duty: "Retention periods and disposal",
  },
  {
    role: "System owner",
    duty: "Hosting, security, vendors and access reviews",
  },
];

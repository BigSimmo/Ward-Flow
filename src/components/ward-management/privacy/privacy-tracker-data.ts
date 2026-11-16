/**
 * Privacy and data tracker content (D-260, 16 Nov 2026). Generated from the privacy research in the
 * project files (patient-data-requirements-checklist.md and current-state-tracker.md); edit both
 * together. Statuses were checked against main 928fa1a8 and the governance papers on 16 Nov 2026.
 * These are intended requirements only: nothing here is enforced, and this is not legal advice.
 */

export type PrivacyCheckStatus = "met" | "partly" | "notyet";

export type PrivacyCheck = { name: string; status: PrivacyCheckStatus; evidence: string };

export type PrivacyPolicyLine = { lead?: string; text: string };

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
        text: "This policy sets out how Ward Flow collects, uses, stores, shares and disposes of patient and staff information.",
      },
      {
        lead: "Applies to",
        text: "everyone who uses, runs or supports Ward Flow, including [Health service] staff, contractors and the vendor.",
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
        text: "[Health service], a WA public health service. The vendor is a contracted service provider bound by the same privacy obligations.",
      },
      {
        lead: "Laws followed",
        text: "PRIS Act 2024 (WA), Health Services Act 2016 (WA), Mental Health Act 2014 (WA), State Records Act 2000 (WA), FOI Act 1992 (WA), and WA Health policies MP 0015/16, 0067/17, 0122/19, 0135/20, 0140/20 and 0144/20.",
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
        evidence: "No legal advice sought. Laws listed in docs/ward-flow/governance/PRIVACY-IMPACT-ASSESSMENT.md §2.",
      },
      {
        name: "Intended purpose statement signed",
        status: "notyet",
        evidence: "Go/no-go G9.",
      },
    ],
    source: "Legal advice; all sources below",
  },
  {
    id: "governance",
    title: "Privacy governance",
    policy: [
      {
        text: "Ward Flow follows the 11 Information Privacy Principles, in force since 1 July 2026.",
      },
      {
        text: "Collection, use and disclosure are fair and reasonable. Information the app infers or generates counts as collected.",
      },
      {
        text: "A register lists every kind of personal information Ward Flow holds and why.",
      },
      {
        text: "A privacy impact assessment was signed before go-live, and is updated before any high privacy impact change.",
      },
      {
        text: "[Health service] has a named privacy officer and information sharing officer.",
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
        evidence: "Draft only, unsigned: docs/ward-flow/governance/PRIVACY-IMPACT-ASSESSMENT.md (go/no-go G4).",
      },
      {
        name: "Privacy officer and information sharing officer named",
        status: "notyet",
        evidence: "Not named (go/no-go G3, P1).",
      },
      {
        name: "Personal information register kept",
        status: "partly",
        evidence: "Field list drafted: docs/ward-flow/governance/DATA-MINIMISATION-FIELD-LIST.md. Not approved.",
      },
      {
        name: "Real-data pilot sponsor named",
        status: "notyet",
        evidence: "Go/no-go G1.",
      },
      {
        name: "Legal risk review covers the privacy tort",
        status: "notyet",
        evidence: "Privacy Act Sch 2 tort in force since 10 Jun 2025; no review on file.",
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
        evidence: "Sign-in shows a synthetic-data warning only. No statement to accept.",
      },
    ],
    source:
      "Health Services Act 2016 (WA) confidentiality offences · Mental Health Act 2014 (WA) confidentiality offence",
  },
  {
    id: "collect",
    title: "Collecting only what is needed",
    policy: [
      {
        text: "Ward Flow collects only the fields on its approved field list.",
      },
      {
        text: "Set choices replace free text wherever possible.",
      },
      {
        text: "Patient names and typed text never appear in web addresses, alerts, logs, error reports or downloads.",
      },
      {
        text: "[Health service] gives patients a collection notice explaining why and how information is used.",
      },
    ],
    checks: [
      {
        name: "Field list approved by the privacy officer",
        status: "partly",
        evidence: "Drafted, not approved (go/no-go P3).",
      },
      {
        name: "Collection notice in use",
        status: "notyet",
        evidence: "None written.",
      },
      {
        name: "No patient detail kept in browser storage outside prototype",
        status: "partly",
        evidence:
          "Drafts gated by build setting only, not workspace mode (go/no-go C1). Demo store not blocked in live (C2).",
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
        evidence:
          "Authenticator-app second step is supported (ward-supabase-auth.ts) but not required: requireSecondStep defaults to false in backend shared-http.mjs.",
      },
      {
        name: "Quarterly access review completed",
        status: "notyet",
        evidence: "Review procedure drafted (docs/ward-flow/governance/ACCESS-REVIEW.md); no review done (P5).",
      },
      {
        name: "Break-glass reviews up to date",
        status: "partly",
        evidence: "Break glass is logged and append-only (migration 011). No review schedule or reviewer (P5).",
      },
      {
        name: "Unique account for each person",
        status: "met",
        evidence: "Supabase accounts, invite-only sign-up since 14 Nov (D-173).",
      },
      {
        name: "Access set by role and ward",
        status: "partly",
        evidence:
          "Role and place access in backend (migration 008). Database rules alone do not yet block other wards (G12).",
      },
      {
        name: "Screen locks after 15 minutes",
        status: "met",
        evidence: "Idle lock in the app (ward-clinical-values idleLock).",
      },
      {
        name: "Sign-out ends a session at once",
        status: "met",
        evidence: "Server-side sign-outs (migration 011).",
      },
      {
        name: "Front door sign-in required",
        status: "partly",
        evidence: "On for the demo (D-130). Must stay required for real data.",
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
          "Audit, record access and break glass tables are append-only (migrations 001, 011). The 26 Oct hosted restore drill lost those locks (RETENTION-AND-BACKUP.md).",
      },
      {
        name: "Weekly log review on file",
        status: "notyet",
        evidence: "No review schedule and no unusual-access alerts.",
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
        text: "Ward Flow is an Australian-hosted cloud service (WA Health Cloud Zone B), assessed by HSS Security and Risk.",
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
          "Supabase is Sydney. Railway app and backend are Singapore (D-84). Sentry is US. Push services are global.",
      },
      {
        name: "HSS cloud risk assessment approved",
        status: "notyet",
        evidence: "No health service IT approval (go/no-go G6, S1).",
      },
      {
        name: "Supabase organisation AI options turned off",
        status: "notyet",
        evidence: "On at 3 Nov (Q391); the owner to switch off.",
      },
      {
        name: "No overseas disclosure without APP 8 safeguards",
        status: "notyet",
        evidence: "Sentry error reports go to the US; Railway servers in Singapore (D-84).",
      },
      {
        name: "Cloud providers' IRAP or ISO 27001 evidence on file",
        status: "notyet",
        evidence: "No provider certificates or assessments held.",
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
        text: "Ward Flow meets the Essential Eight at Maturity Level One or higher.",
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
        text: "If a hospital using Ward Flow is a critical hospital under the SOCI Act 2018, Ward Flow sits inside that hospital's risk management program, and serious cyber incidents are reported to ASD (within half a day if critical).",
      },
    ],
    checks: [
      {
        name: "Penetration test passed",
        status: "notyet",
        evidence: "Brief written (docs/ward-flow/governance/PENETRATION-TEST-BRIEF.md); no test run (G16).",
      },
      {
        name: "Essential Eight assessment on file",
        status: "notyet",
        evidence: "Not assessed.",
      },
      {
        name: "Encryption in transit and at rest",
        status: "partly",
        evidence: "HTTPS and provider encryption by default; not verified in writing.",
      },
      {
        name: "Strict content security policy",
        status: "met",
        evidence: "Per-request CSP nonce (src/proxy.ts).",
      },
      {
        name: "Sign-in token out of reach of page scripts",
        status: "notyet",
        evidence: "Token in sessionStorage (go/no-go C5, C14, H-0044).",
      },
      {
        name: "Web push library reviewed",
        status: "notyet",
        evidence: "web-push package not reviewed (C9).",
      },
      {
        name: "Repository private, history checked",
        status: "notyet",
        evidence: "Repository is public (G7).",
      },
      {
        name: "Ransom payment reporting step in the incident plan",
        status: "notyet",
        evidence: "No incident plan in repo. Cyber Security Act 2024 sets a 3-day reporting time.",
      },
      {
        name: "Critical infrastructure (SOCI) status checked with each hospital",
        status: "notyet",
        evidence: "Not asked yet.",
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
        evidence: "No sharing with other bodies yet. Cultural safety review not held (G10).",
      },
      {
        name: "No names in downloads",
        status: "met",
        evidence: "Exports carry no names (D-102).",
      },
      {
        name: "TV board privacy review",
        status: "notyet",
        evidence: "TV shows full names; no review (C15, P6).",
      },
      {
        name: "De-identification method approved before any reuse",
        status: "partly",
        evidence: "Prototype uses synthetic data only (hard rule 1); no method for real data.",
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
          "Retention plan drafted (docs/ward-flow/RETENTION-AND-BACKUP.md). No records manager; open questions (P4).",
      },
      {
        name: "Disposal register kept",
        status: "notyet",
        evidence: "None.",
      },
      {
        name: "Paid backups and a passed restore drill",
        status: "notyet",
        evidence: "Supabase free plan has no backups (G8). Hosted drill failed on audit locks.",
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
        evidence: "Plan drafted in the pilot papers. No drill (G15, B4).",
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
        text: "Ward Flow can find and export one person's records when asked.",
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
        evidence: "Correction process drafted (RETENTION-AND-BACKUP.md). Not tested; no one-person export.",
      },
      {
        name: "Access and correction meet APP 12 and 13 where they apply",
        status: "partly",
        evidence: "Corrections are audited (migration 001); no single-person export yet.",
      },
    ],
    source: "WA IPPs · FOI Act 1992 (WA) · APP 12 and 13",
  },
  {
    id: "clinical",
    title: "Clinical safety",
    policy: [
      {
        text: "Ward Flow is administrative bed management software and makes no clinical claims, so it sits outside TGA medical device rules.",
      },
      {
        text: "Any feature that scores or advises on a patient is reviewed against TGA clinical decision support guidance first.",
      },
      {
        text: "A clinical safety case is signed by the named clinical safety owner.",
      },
      {
        text: "Patient safety incidents linked to Ward Flow are managed as clinical incidents.",
      },
      {
        text: "Records meet the NSQHS Clinical Governance Standard for healthcare records (Actions 1.16 to 1.18).",
      },
    ],
    checks: [
      {
        name: "TGA exclusion confirmed",
        status: "partly",
        evidence:
          "Drafter's reasoning only (docs/ward-flow/governance/REGULATORY-CLASSIFICATION.md). No adviser view (G14).",
      },
      {
        name: "Clinical safety case signed",
        status: "partly",
        evidence:
          "Safety case and hazard log drafted (docs/ward-flow/governance/CLINICAL-SAFETY-CASE.md). No owner, not signed (G2, G11).",
      },
      {
        name: "Records carry a sample or real marker",
        status: "notyet",
        evidence: "Go/no-go C10.",
      },
      {
        name: "Aboriginal cultural safety review held",
        status: "notyet",
        evidence: "Go/no-go G10, hazard H-24.",
      },
      {
        name: "Records checked against NSQHS Actions 1.16 to 1.18",
        status: "notyet",
        evidence: "No healthcare records review held.",
      },
    ],
    source: "TGA item 14G exclusion · TGA CDSS guidance · MP 0122/19 · NSQHS Standards Actions 1.16 to 1.18",
  },
  {
    id: "ai",
    title: "Automated decisions, AI and identifiers",
    policy: [
      {
        text: "Ward Flow makes no automated decisions about patients. People make every decision.",
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
        evidence:
          "People make every decision; agents never get real data (AGENTS.md hard rule 1). Recheck before release.",
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
        evidence: "No data processing terms with Supabase, Railway or Sentry.",
      },
      {
        name: "Staff training and competency check",
        status: "partly",
        evidence: "Competency check drafted (docs/ward-flow/pilot/competency-check.md).",
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
    evidence: "No privacy officer.",
  },
  {
    name: "Clinical safety owner approval",
    status: "notyet",
    evidence: "No clinical safety owner.",
  },
  {
    name: "Legal review",
    status: "notyet",
    evidence: "Not done.",
  },
  {
    name: "System owner approval",
    status: "notyet",
    evidence: "The project owner is system owner; not signed.",
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

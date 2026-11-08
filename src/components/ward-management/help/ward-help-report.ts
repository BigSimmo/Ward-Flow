/**
 * REPORT A PROBLEM (Josh, 8 Nov 2026): a short pilot report a member of staff sends from Help. There
 * is no feedback backend, so the report goes by the device's email app (a `mailto:` link) to the
 * address in `NEXT_PUBLIC_WARD_SUPPORT_EMAIL`, or is copied for the pilot lead. The screen, desk,
 * version, browser and time are added for the reporter; they type only what happened.
 *
 * Patient details must never be sent. `findPatientDetails` looks for the likely identifiers below
 * and the report is refused while any is there. It is a safety net, not a guarantee: it catches the
 * common shapes (record numbers, Medicare and phone numbers, emails, full dates, "Mr Smith",
 * "SMITH, John") and says what kind it found, never the words themselves.
 *
 * Pure functions only, so the Help sheet loads this with the report view and nowhere else.
 */

export type PatientDetailKind =
  "record-number" | "medicare" | "phone" | "email" | "date" | "titled-name" | "surname-first";

const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*";

/** In the order they are named in the refusal. */
const CHECKS: readonly (readonly [PatientDetailKind, RegExp])[] = [
  // A UMRN, MRN or URN label before a number, a synthetic UM record number, or any run of six or
  // more digits with up to two letters in front.
  ["record-number", /\b(?:UMRN|MRN|URN)\b\s*(?:no\.?|number|#)?\s*:?\s*[A-Z]{0,2}\d|\b[A-Z]{0,2}\d{6,}\b/iu],
  // Ten or eleven digits, often grouped four, five and one.
  ["medicare", /\b\d{4}[ -]?\d{5}[ -]?\d(?:[ -]?\d)?\b/iu],
  // Australian mobiles and landlines ("0412 345 678", "+61 8 9224 1234"), and a Perth landline
  // without its area code ("9224 1234").
  ["phone", /(?:\+\s?61[ -]?|\b0)[2-478](?:[ -]?\d){8}\b|\b[69]\d{3} \d{4}\b/u],
  ["email", /[^\s@]+@[^\s@]+\.[^\s@]+/u],
  // A full date with a year: a date of birth looks like any other. The words alone ("the DOB field")
  // are allowed, so a report can still name the field that went wrong.
  [
    "date",
    new RegExp(
      `\\b\\d{1,2}[/.-]\\d{1,2}[/.-](?:\\d{4}|\\d{2})\\b|\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH},?\\s+\\d{4}\\b|\\b${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`,
      "iu",
    ),
  ],
  // A title before a capitalised name: "Mr Smith", "mrs O'Brien", "Dr. Ng". "Miss" and "Master"
  // only with their capital, so "I miss Bed 3" is not a name.
  ["titled-name", /\b(?:[Mm][Rr][Ss]?|[Mm][SsXx]|Miss|Master|[Dd][Rr]|[Pp]rof)\b\.?\s+[A-Z][A-Za-z'’-]+/u],
  // Surname first, as Ward Flow writes names: "SMITH, John".
  ["surname-first", /\b[A-Z][A-Z'’-]{2,},\s*[A-Z][a-z]/u],
];

const KIND_WORDS: Readonly<Record<PatientDetailKind, string>> = {
  "record-number": "a record number (UMRN or MRN)",
  medicare: "a Medicare number",
  phone: "a phone number",
  email: "an email address",
  date: "a date of birth or full date",
  "titled-name": "a name with a title, like Mr Smith",
  "surname-first": "a name written surname first",
};

/** The kinds of likely patient detail in `text`, each once, in a fixed order. */
export function findPatientDetails(text: string): PatientDetailKind[] {
  return CHECKS.filter(([, pattern]) => pattern.test(text)).map(([kind]) => kind);
}

/** "a and b", "a, b and c". */
function listWords(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/** The refusal: what kind was found (never the words), and that the time and screen are added. */
export function patientDetailRefusal(kinds: readonly PatientDetailKind[]): string {
  return `Remove patient details first. This looks like it has ${listWords(kinds.map((kind) => KIND_WORDS[kind]))}. The time and screen are added for you.`;
}

/** Longest "what happened": a mailto body much past this is cut short by some email apps. */
export const REPORT_MAX_LENGTH = 1000;

/**
 * The support address from `NEXT_PUBLIC_WARD_SUPPORT_EMAIL`, or null when unset or not one plain
 * address. Read as a literal so the build inlines it.
 */
export function supportEmail(configured = process.env.NEXT_PUBLIC_WARD_SUPPORT_EMAIL): string | null {
  const value = configured?.trim() ?? "";
  return /^[^\s@,;?&#/]+@[^\s@,;?&#/]+\.[^\s@,;?&#/]+$/u.test(value) ? value : null;
}

/** "Chrome 131 on Android" from a user agent string; "Unknown browser" when nothing is recognised. */
export function browserSummary(userAgent: string): string {
  const browsers: readonly (readonly [string, RegExp])[] = [
    ["Edge", /\bEdg(?:e|A|iOS)?\/(\d+)/u],
    ["Opera", /\bOPR\/(\d+)/u],
    ["Samsung Internet", /\bSamsungBrowser\/(\d+)/u],
    ["Firefox", /\b(?:Firefox|FxiOS)\/(\d+)/u],
    ["Chrome", /\b(?:HeadlessChrome|Chrome|CriOS)\/(\d+)/u],
    ["Safari", /\bVersion\/(\d+)[\d.]*\s+(?:Mobile\/\S+\s+)?Safari\//u],
  ];
  const systems: readonly (readonly [string, RegExp])[] = [
    ["iPadOS", /\biPad\b/u],
    ["iOS", /\biPhone\b|\biPod\b/u],
    ["Android", /\bAndroid\b/u],
    ["Windows", /\bWindows\b/u],
    ["ChromeOS", /\bCrOS\b/u],
    ["macOS", /\bMac OS X\b|\bMacintosh\b/u],
    ["Linux", /\bLinux\b/u],
  ];
  const browser = browsers.find(([, pattern]) => pattern.test(userAgent));
  const version = browser ? browser[1].exec(userAgent)?.[1] : undefined;
  const system = systems.find(([, pattern]) => pattern.test(userAgent))?.[0];
  const name = browser ? `${browser[0]}${version ? ` ${version}` : ""}` : "Unknown browser";
  return system ? `${name} on ${system}` : name;
}

/** "Sun 8 Nov 2026, 2:05 pm AWST (2026-11-08T06:05:00.000Z)": local for the reader, exact for the lead. */
export function reportTime(now: Date): string {
  const local = new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(now);
  return `${local} (${now.toISOString()})`;
}

export type ReportContext = {
  /** The screen's name, when Help knows it. */
  readonly screen?: string;
  /** The address path only: never a query or fragment. */
  readonly path: string;
  readonly desk: string;
  /** The newest What's new entry, standing in for a version number. */
  readonly version?: { readonly id: string; readonly date: string };
  readonly browser: string;
  readonly viewport?: { readonly width: number; readonly height: number };
  readonly time: string;
};

/** The report's lines: what happened, then what was added for the reporter. */
export function reportLines(context: ReportContext): readonly (readonly [string, string])[] {
  return [
    ["Screen", context.screen ? `${context.screen} (${context.path})` : context.path],
    ["Desk", context.desk],
    ["Version", context.version ? `latest change ${context.version.date} (${context.version.id})` : "not known"],
    ["Browser", context.browser],
    ...(context.viewport
      ? [["Window", `${context.viewport.width} × ${context.viewport.height}`] as const]
      : ([] as const)),
    ["Time", context.time],
  ];
}

/** The plain-text report, as emailed and copied. */
export function reportText(whatHappened: string, context: ReportContext): string {
  return [
    "Ward Flow problem report",
    "",
    "What happened:",
    whatHappened.trim(),
    "",
    ...reportLines(context).map(([label, value]) => `${label}: ${value}`),
  ].join("\n");
}

export function reportSubject(context: Pick<ReportContext, "screen" | "path">): string {
  return `Ward Flow problem report: ${context.screen ?? context.path}`;
}

/** The `mailto:` address that opens the email app with the report filled in. */
export function reportMailto(address: string, subject: string, body: string): string {
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

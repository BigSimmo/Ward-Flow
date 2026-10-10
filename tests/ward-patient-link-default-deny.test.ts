// tests/ward-patient-link-default-deny.test.ts
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * D-14 — THE PATIENT LINK IS DEFAULT-DENY, AND THIS FILE IS THE ENFORCEMENT.
 *
 * Ruling D-14 (`docs/ward-flow/owner-decisions-2026-09-1x.md`, Ward Lead's ruling under
 * delegation, 2026-09-11): *"Admission and Referral carry no `patientId`. Nothing joins a bed's
 * occupant to a person."* Fixing that absence and refusing everywhere the join is not explicitly
 * permitted are ONE change, not two — a guard satisfied only because the data could not reach it
 * "is not a guard. It is a coincidence with a comment." (the ruling's own words). The day the link
 * lands is the day this file has to mean something.
 *
 * **WHAT IT REFUSES.** Every `.ts`/`.tsx` file under `src/components/ward-management/**`,
 * production code only, that references `.patientId` (or the bracket form `["patientId"]`) — the
 * property both `Referral` and `Admission` now carry — UNLESS the file is named in `ALLOWLIST`
 * below, with a reason beside it.
 *
 * **WHY A TEXT SCAN, NOT AN IMPORT-GRAPH WALK.** `tests/ward-referral-screen-boundary.test.ts`
 * (FD-23's screen boundary) forbids IMPORTING the full `Referral` record — the right shape for a
 * type that carries every destination. `patientId` is a single string field that already reaches
 * every ward-facing component through props and context (`Admission[]`, `Referral[]` are handed
 * down whole), so which FILE imports the type says nothing about which file READS this one field
 * off it. The property-access text itself is what has to be scanned.
 *
 * **WHY THE ALLOWLIST IS AS SMALL AS IT IS, AND WHY TWO ENTRIES PRE-DATE THIS TASK.**
 * `search/patient-typeahead.tsx` (shipped 2026-09-05) and `search/record-preview.tsx` (shipped
 * shortly after) already read `Referral.patientId`, before this task existed, each at the same
 * bounded granularity — one person's own single linked referral, never a history across several —
 * and each says so in its own header comment. Excluding them here is a record of what already
 * shipped, not a new decision: this task populates the first real seed values for `patientId`
 * (`ward-movements.ts`, `ward-admissions-seed.ts`), which is what turns their read from a path that
 * could not resolve into one that sometimes does. **That consequence is named, not hidden — see
 * this task's own enumeration file — and it is exactly why D-14 exists: the day the link lands is
 * the day every existing reader of it becomes load-bearing, whether or not anybody touched that
 * reader today.**
 *
 * **WHAT THIS FILE DOES NOT DECIDE.** It does not rule that `patient-typeahead.tsx` or
 * `record-preview.tsx` are the RIGHT place for this read — that is Ward Lead's question, not this
 * guard's. It records the allowlist as it stands and refuses every OTHER file from joining it
 * silently. Widening the allowlist is a deliberate edit here, with a reason, exactly as narrowing
 * `tests/ward-referral-screen-boundary.test.ts`'s `SEES_EVERYTHING` would be.
 */

const WARD_DIR = resolve(process.cwd(), "src/components/ward-management");

/** Every `.ts`/`.tsx` file under the ward-management tree, recursively. This guards PRODUCTION
 *  code only — the test suite that exercises it lives entirely under `tests/`, outside this walk. */
function collectWardManagementFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      out.push(...collectWardManagementFiles(full));
      continue;
    }
    const ext = extname(entry);
    if (ext === ".ts" || ext === ".tsx") out.push(full);
  }
  return out;
}

/** Removes line and block comments so a doc comment discussing `.patientId` in prose — this file's
 *  own header included — is never mistaken for a real read. A cruder pass than
 *  `ward-referral-screen-boundary.test.ts`'s `scanSource` (no string/template/regex tracking),
 *  which is safe here only because the detector below looks for a dotted identifier that cannot
 *  legitimately appear inside an ordinary string this codebase writes; the anti-vacuity checks
 *  below prove it still catches a real forbidden read once comments are gone. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** A read of the patient link. Five shapes, alternated:
 *  1. `.patientId` (dot) or `["patientId"]` (bracket) access, on anything.
 *  2. A `const`/`let`/`var` destructuring declaration binding `patientId` with no nesting —
 *     `const { patientId } = r`, `let { patientId: id } = r`.
 *  3. The same, with exactly one level of nesting — `const { referral: { patientId } } = x`.
 *  4. An unannotated destructured arrow-callback parameter — `({ patientId }) => …`.
 *  5. An unannotated destructured `function` parameter, named or not — `function ({ patientId })
 *     { … }` / `function f({ patientId }) { … }`.
 *  Shapes 4 and 5 stop at the TYPE ANNOTATION, not at "parameter vs declaration": `({ patientId }:
 *  Props) =>` and `function f({ patientId }: Props)` are excluded because an annotation sits
 *  between `}` and `)`, not because a parameter can never be a read — an unannotated parameter
 *  destructure still pulls the field off whatever object was passed in, so it counts the same as a
 *  declaration. `[^}]*`/`[^{}]*` (never `.*`) is what lets every multi-brace shape span lines
 *  without a `dotAll`/`s` flag, since a negated character class already matches newlines. The
 *  detector does not try to tell a `Referral`/`Admission` apart from any other object, which is
 *  the conservative direction to be wrong in for a default-deny guard. `shell/ward-facade.ts`'s
 *  unrelated same-named URL parameter is handled by naming it in the allowlist with its own
 *  reason, not by narrowing this pattern. */
const PATIENT_LINK_READ =
  /\.patientId\b|(?<!\b[A-Z][A-Za-z0-9_]*)\[\s*["']patientId["']\s*\]|\b(?:const|let|var)\b\s*\{[^}]*\bpatientId\b[^}]*\}\s*=|\b(?:const|let|var)\b\s*\{[^{}]*\{[^{}]*\bpatientId\b[^{}]*\}[^{}]*\}\s*=|\(\s*\{[^}]*\bpatientId\b[^}]*\}\s*\)\s*=>|\bfunction\b\s*\w*\s*\(\s*\{[^}]*\bpatientId\b[^}]*\}\s*\)/;

/**
 * Every file permitted to contain a read of `.patientId`, and why. See this file's own header for
 * the two pre-existing entries; the other four are the plumbing this task adds, not a screen.
 */
const ALLOWLIST: ReadonlyArray<{ file: string; reason: string }> = [
  {
    file: "referrals/referral-inbox.ts",
    reason:
      "User-approved four-tab referral task: project identity only after an exact named ward recipient match, never other recipients or cross-referral history. Negative scoping cases are exercised in ward-referral-drawer-submission.test.ts.",
  },
  {
    file: "referrals/ward-referral-inbox.tsx",
    reason:
      "User-approved recipient inbox: resolve only its own projected patient identity; no whole referral destinations, network outcomes or patient referral history.",
  },
  {
    file: "ward-flow-storage-validation.ts",
    reason:
      "Ward Lead recovery decision, 2026-09-23: restore-only consistency checks compare explicit " +
      "patient links and return acceptance/refusal, never identity, referral history or destinations. " +
      "D-14's default-deny rule remains; D-19's disclosure boundary permits this exact non-rendering " +
      "reader. Any screen/history/export use requires a new decision.",
  },
  {
    file: "ward-discharge-records.ts",
    reason:
      "Q004 expressly approved discharge projection: unique-ID patient identity for coordinator or the admission own ward, guarded at runtime; no referral history or inferred links.",
  },
  {
    file: "ward-audit.ts",
    reason:
      "Q004 expressly approved session audit plumbing: unique resolved patient references only in coordinator-guarded detached audit records; no identity prose or search queries.",
  },
  {
    file: "search/patient-typeahead.tsx",
    reason:
      "Pre-existing, shipped 2026-09-05: reads Referral.patientId to show a person's OWN linked " +
      "referral inline in the search-as-you-type dropdown — one referral, its own state, never a " +
      "history across several. Not opened by this task; recorded as it already shipped.",
  },
  {
    file: "search/record-preview.tsx",
    reason:
      "Pre-existing search-console preview pane: reuses the identical read patient-typeahead.tsx " +
      "already ships, at the identical granularity — one person's own referral and the movement it " +
      "led to, never a referral history. Its own header comment discusses FD-23 directly and states " +
      "the scoping. Not opened by this task; recorded as it already shipped.",
  },
  {
    file: "shell/ward-facade.ts",
    reason:
      "A DIFFERENT field entirely: TargetOptions.patientId is a route query-string parameter name " +
      "for a URL-building helper (patientHref/buildHref), structurally unconnected to " +
      "Referral.patientId or Admission.patientId — no Referral or Admission value is ever read here.",
  },
  {
    file: "ward-admissions-seed.ts",
    reason:
      "D-14 seed authoring: threads the join through the fixture builders (Occupant, Departure) " +
      "that construct Admission literals. Writes the field into the static seed; consumes it for no " +
      "screen.",
  },
  {
    file: "ward-movements.ts",
    reason:
      "D-14 seed authoring: threads Referral.patientId through the MIDLAND_DEMONSTRATION_ROWS " +
      "builder and RF-010's own literal. Writes the field into the static seed; consumes it for no " +
      "screen.",
  },
  {
    file: "ward-flow-reducer.ts",
    reason:
      "The reducer itself: RECEIVE_REFERRAL validates an incoming patientId against state.patients " +
      "and copies it onto the created Referral (owner ruling 2026-09-02, pre-existing); PULL_PATIENT " +
      "(D-14, this task) derives Admission.patientId from the movement's own linked referral. This " +
      "IS the plumbing the guard exists to sit downstream of, not a screen.",
  },
  {
    file: "movements/movement-drawer.tsx",
    reason:
      "🔴 OWNER RULING O-16.3, 2026-09-11 — 'Yes show the patient name.' The Movement detail " +
      "drawer's Person section follows Movement.referralId -> Referral.patientId -> Patient and " +
      "renders the person's name. This entry exists because the owner OVERRULED the recommendation " +
      "to keep it denied, not because the guard was found inconvenient: the build was stopped when " +
      "this test refused it, the conflict was put to him, and he decided. Ruling ② — a coordinator " +
      "sees who the patient is wherever they are SELECTING or ACTING ON that person — wins over " +
      "D-14's default-deny on THIS screen, and on no other by implication. " +
      "⚠️ GRANULARITY, and it is the bound that keeps this compatible with FD-23: ONE movement's " +
      "OWN linked referral and the person it names. Never a list of a person's referrals, never " +
      "where else they have been referred, never a count of them — FD-23 protects disclosure of " +
      "WHERE, and this discloses no place, no ward and no other episode. " +
      "🔴 AND IT IS NOT GRANDFATHERED PAST THE SEED. Every patient in this app today is invented. " +
      "The moment real data reaches it, rendering a name on a coordinator's board is a live " +
      "privacy decision that needs its own review — this ruling was made about synthetic data and " +
      "says nothing about real data. If either bound is widened, this entry is void.",
  },
  {
    file: "referrals/referral-duplicate.ts",
    reason:
      "D-19, 2026-09-11. Reads Referral.patientId ACROSS SEVERAL of one person's referrals to " +
      "answer one boolean: is any of them still open. Deliberately outside the granularity bound " +
      "the two entries above are held to, because what FD-23 protects is disclosure of WHERE, and " +
      "this discloses no place, no ward, no time, no count. Permitted ONLY while: (1) the sentence " +
      "says that one is open and nothing else — a count is itself a disclosure; and (2) the read " +
      "is confined to the person already named on the form in progress, never reachable from a " +
      "free search, because without that bound this is a probe for whether any named person is " +
      "currently in a mental-health pathway. Both conditions are pinned by test; if either is " +
      "widened this entry is void and the read must stop.",
  },
  {
    file: "coordinator/shortlist-panel.tsx",
    reason:
      "Ward Lead decision, 2026-09-14, under OWNER RULING O-16.3 ruling ② — 'a coordinator sees " +
      "who the patient is wherever they are SELECTING or ACTING ON that person'. Command's " +
      "referral-placement panel is where the coordinator places ONE referral, so it shows that " +
      "referral's own patientId and links to that person's page. Same granularity bound as " +
      "movement-drawer.tsx: one referral's own linked person — never a list of the person's " +
      "referrals, never where else they have been referred, never a count. Coordinator-only: the " +
      "panel is rendered solely by coordinator/coordinator-screen.tsx. If it is ever rendered on a " +
      "ward, ED or community screen, or shows anything beyond that one link, this entry is void.",
  },
  {
    file: "ward-patient-resolver.ts",
    reason:
      "Owner mandate 2026-09-21: universal patient name and UMRN resolution across the entire program. " +
      "Provides centralized, safe single-patient lookup across movements, referrals, and admissions.",
  },
  {
    file: "handover/handover-page.tsx",
    reason: "Owner mandate 2026-09-21: clinical handover sheet displays patient name and UMRN for each active journey.",
  },
  {
    file: "community/community-screen.tsx",
    reason:
      "Community team hub: resolves and displays patient identity for active community care and referral episodes.",
  },
  {
    file: "patients/patient-now-adapter.ts",
    reason:
      "Patient-Now adapter: resolves live episode trajectory, active bed/admission, legal documents, " +
      "and transport for the person currently in focus. Confined to the single subject patient requested, " +
      "disclosing no other person's clinical episode.",
  },
  {
    file: "capacity/planned-admissions-reducer.ts",
    reason:
      "Planned admissions reducer (stream D, coordinator ruling A, 9 Oct 2026; flagged for Josh in " +
      "the PR): like PULL_PATIENT, CONVERT_PLANNED_ADMISSION copies the booking's own patientId onto " +
      "the Admission it creates. BOOK checks that patientId exists in state.patients and refuses a " +
      "second waiting booking or a person who holds a pulled or occupied stay; CONVERT refuses when " +
      "that person holds such a stay or is on an open movement; the forecast helper drops a linked " +
      "booking already counted through a waiting movement. Each is a yes/no on ids: reads compare ids " +
      "only, write state, render nothing and disclose no other stay, movement or referral.",
  },
  {
    file: "capacity/planned-admissions-panel.tsx",
    reason:
      "Planned admissions panel (stream D, coordinator ruling A, 9 Oct 2026; flagged for Josh in the " +
      "PR): coordinator Capacity screen only, mirroring the PULL_PATIENT picker. It reads patientId " +
      "solely to (1) drop people with a pulled/occupied stay, an open movement or a waiting booking " +
      "from the booking picker, a yes/no that shows no ward, bed or referral, and (2) name a booked person through " +
      "usePatientOf, never printing the id. Void if rendered on a ward screen.",
  },
].map((entry) => ({ ...entry, file: resolve(WARD_DIR, entry.file) }));

const shortPath = (file: string) => relative(process.cwd(), file).replace(/\\/g, "/");

describe("D-14 default-deny: the patient link is read only where explicitly permitted", () => {
  it("keeps every allowlisted file pointing at something real, with a reason beside it", () => {
    // NON-VACUITY on the allowlist's own shape: a stale or empty entry silently WIDENS what this
    // guard permits rather than narrowing it, exactly as `ward-referral-screen-boundary.test.ts`'s
    // `SEES_EVERYTHING` warns against for its own subtraction set.
    // 6 → 7 on 2026-09-11 by D-19 (`owner-decisions-2026-09-1x.md`, `f48747bbe4`), which admitted
    // `referrals/referral-duplicate.ts`. ⚠️ That entry is the FIRST one held to a different bound
    // from its neighbours: the six above are bounded by GRANULARITY — one person's own single
    // linked referral — and D-19 moved the bound for this one entry from the READ to the
    // DISCLOSURE, because what FD-23 protects is whether a ward learns WHERE ELSE a patient has
    // been, and a place-free, ward-free, time-free, count-free boolean discloses no location. Read
    // that entry's own reason before touching it; it names two conditions that void it if widened.
    // 10 → 11 on 2026-09-14: `coordinator/shortlist-panel.tsx`, by Ward Lead under O-16.3 ruling ②.
    // Read that entry's reason — it names what voids it.
    // 11 → 14 on 2026-09-21: owner mandate for universal name and UMRN display.
    // 14 → 15 on 2026-09-23: restore-only identity consistency, exact decision above.
    // 15 → 16 on 2026-09-24: patient-now adapter live episode trajectory resolution.
    // Approved recipient projection and its own inbox renderer add two exact, scoped readers.
    // 18 → 20 on 2026-10-09: stream D planned admissions, pending Ward Lead review (see entries).
    expect(ALLOWLIST.length, "the allowlist changed size — re-read this file's own header").toBe(20);
    for (const { file, reason } of ALLOWLIST) {
      expect(existsSync(file), `${shortPath(file)} is allow-listed but does not exist`).toBe(true);
      expect(reason.length, `${shortPath(file)} is allow-listed with no real reason beside it`).toBeGreaterThan(30);
    }
  });

  it("scans a real, non-trivial population of ward-management source files", () => {
    const files = collectWardManagementFiles(WARD_DIR);
    // The anti-vacuity floor the brief asks for: this guard must prove it actually walked
    // something, not merely that an empty scan reported no offenders.
    expect(
      files.length,
      "the ward-management source tree collapsed to almost nothing — this guard would prove nothing",
    ).toBeGreaterThan(80);
    expect(files.map((file) => basename(file))).toContain("ward-board.tsx");
    expect(files.map((file) => basename(file))).toContain("ward-screen.tsx");
    expect(files.map((file) => basename(file))).toContain("community-team-hub.tsx");
  });

  it("proves the detector can actually fire, before trusting what it did not flag", () => {
    // POSITIVE CONTROLS, synthetic. A detector that never fires would let the refusal test below
    // pass over every file for the wrong reason.
    expect(PATIENT_LINK_READ.test("const x = admission.patientId;")).toBe(true);
    expect(PATIENT_LINK_READ.test('const x = admission["patientId"];')).toBe(true);
    // TYPE-POSITION NEGATIVE CONTROL (25 September 2026): an indexed-access TYPE such as
    // `Movement["patientId"]` names the field's type and reads no value. A PascalCase name directly
    // before the bracket is a type; a value read (`admission["patientId"]`) is still caught above.
    expect(PATIENT_LINK_READ.test('type Id = Movement["patientId"];')).toBe(false);
    expect(PATIENT_LINK_READ.test('function f(id: Referral["patientId"]) {}')).toBe(false);
    expect(PATIENT_LINK_READ.test("const x = referral?.patientId ?? null;")).toBe(true);
    // DESTRUCTURING POSITIVE CONTROLS. `const { patientId } = r` and `let { patientId: id } = r`
    // both read the field off `r` without ever writing a dot or a bracket, so the two alternatives
    // above alone would miss them — this is the gap this task closes.
    expect(
      PATIENT_LINK_READ.test("const {\n  patientId,\n} = r;"),
      "a multi-line destructuring declaration must still be detected",
    ).toBe(true);
    expect(
      PATIENT_LINK_READ.test("let { patientId: id } = r;"),
      "a renamed destructuring binding must still be detected",
    ).toBe(true);
    // NESTED DESTRUCTURING POSITIVE CONTROL. One level of nesting: `patientId` sits inside an
    // inner `{ … }`, not the outer one, so the no-nesting alternative alone would miss it.
    expect(
      PATIENT_LINK_READ.test("const { referral: { patientId } } = x;"),
      "a one-level-nested destructuring declaration must still be detected",
    ).toBe(true);
    // DESTRUCTURED-CALLBACK-PARAMETER POSITIVE CONTROLS. `referrals.map(({ patientId }) =>
    // patientId)` and a `function` callback both read the field off whatever the caller passed in,
    // with no dot, no bracket, and no `const`/`let`/`var` keyword in sight.
    expect(
      PATIENT_LINK_READ.test("referrals.map(({ patientId }) => patientId)"),
      "an unannotated arrow-callback destructured parameter must be detected",
    ).toBe(true);
    expect(
      PATIENT_LINK_READ.test("list.filter(({ id, patientId }) => patientId === x)"),
      "an unannotated arrow-callback parameter with a sibling binding must still be detected",
    ).toBe(true);
    expect(
      PATIENT_LINK_READ.test("admissions.filter(function ({ patientId }) { return patientId; })"),
      "an unannotated function-callback destructured parameter must be detected",
    ).toBe(true);
    // NEGATIVE CONTROL. A bare local variable named `patientId` (the shape `person-screen.tsx` and
    // `ward-referral-drawer.tsx` legitimately use — a route parameter, never a property read off a
    // Referral or Admission) must not trip the guard, or the detector would forbid the fix along
    // with the leak.
    expect(PATIENT_LINK_READ.test("const routeText = `/people/${patientId}`;")).toBe(false);
    expect(PATIENT_LINK_READ.test("function f(patientId: PatientId) { return patientId; }")).toBe(false);
    // OBJECT-LITERAL CALL-ARGUMENT NEGATIVE CONTROL. `patientId` sits between braces here too, but
    // this is a call-site literal WRITING the key into a new object, not a declaration or a
    // parameter reading a field off it — tripping the guard here would forbid ordinary call sites.
    expect(
      PATIENT_LINK_READ.test("f({ patientId: subject.id })"),
      "an object-literal call argument must not trip the guard",
    ).toBe(false);
    // ANNOTATION-BOUNDARY NEGATIVE CONTROLS. Same destructured-parameter shape as the two positive
    // callback controls above, except a type annotation sits between `}` and `)` — the exact
    // boundary the comment above names. An annotated parameter is still just a parameter binding,
    // not a read off a `Referral`/`Admission`, and must not trip the guard either way it is written.
    expect(
      PATIENT_LINK_READ.test("const Screen = ({ patientId }: Props) => null;"),
      "an annotated arrow-callback parameter must not trip the guard",
    ).toBe(false);
    expect(
      PATIENT_LINK_READ.test("function PersonScreen({ patientId }: Props) { return null; }"),
      "an annotated named function parameter must not trip the guard",
    ).toBe(false);
    // A plain object literal assigned to a new name is a WRITE of the key, not a destructuring
    // READ off an existing `Referral`/`Admission` — `const payload = { … }` never has `patientId`
    // as a binding, it has it as a key being constructed.
    expect(
      PATIENT_LINK_READ.test("const payload = { patientId: subject.id };"),
      "an object literal on the right of an assignment must not trip the guard",
    ).toBe(false);

    // Comments are stripped BEFORE the real check runs, so prose merely naming the field must not
    // survive to the point the detector sees it.
    expect(withoutComments("// admission.patientId is mentioned only in prose\nconst y = 1;")).not.toMatch(
      PATIENT_LINK_READ,
    );
    // AND a stripper that deleted everything would make every check below vacuous — proved on a
    // REAL allowlisted file, which is known to contain both real code and a real read.
    const recordPreview = ALLOWLIST.find((entry) => entry.file.endsWith("record-preview.tsx"))!.file;
    const strippedRecordPreview = withoutComments(readFileSync(recordPreview, "utf8"));
    expect(strippedRecordPreview.length, "the comment stripper removed the whole file").toBeGreaterThan(2000);
    // POSITIVE CONTROL ON REAL PRODUCTION CODE, not just a synthetic string: proves this specific
    // allowlisted file really does contain a read the detector can see, so its absence from the
    // offenders list below is the allowlist working, not the detector missing it.
    expect(
      PATIENT_LINK_READ.test(strippedRecordPreview),
      "record-preview.tsx no longer reads .patientId — the allowlist entry may be stale",
    ).toBe(true);
  });

  it("refuses every ward-management file outside the allowlist that reads the patient link", () => {
    const files = collectWardManagementFiles(WARD_DIR);
    const allowlisted = new Set(ALLOWLIST.map((entry) => entry.file));
    const offenders = files
      .filter((file) => !allowlisted.has(file))
      .filter((file) => PATIENT_LINK_READ.test(withoutComments(readFileSync(file, "utf8"))))
      .map((file) => shortPath(file));
    expect(
      offenders,
      "a ward-management file outside the D-14 allowlist reads .patientId — a ward learning where " +
        "else a patient has been is exactly what this guard exists to stop. Hand this back to Ward " +
        "Lead rather than deciding it is fine and widening the allowlist yourself.",
    ).toEqual([]);
  });
});

# Regulatory classification: is Ward Flow a medical device?

_Created 2026-11-10 - audit item M62 (source A42), real-data gate (D-111 item 8, audit item 42); drafted on branch `claude/project-thread-bnphlk` (from `main` `29352cd0`); Documentation owns._

**Status:** the drafter's reasoning, for a qualified regulatory adviser to test. **It is not a
regulatory opinion.** A written view from a qualified adviser costs money, so it needs Josh's
spending approval with a hard cap before anyone is engaged. No adviser has been asked.

**Done when:** the adviser's written view is filed beside this page and the
[Clinical Safety Case section 2.4](CLINICAL-SAFETY-CASE.md#24-regulatory-status-for-a-regulatory-adviser-to-confirm)
is updated to match it.

All legal references below are from the drafter's memory, not checked against the current
legislation. The adviser must confirm each one, including item numbers and any amendments.

## 1. The intended purpose being assessed

From [Clinical Safety Case section 2.1](CLINICAL-SAFETY-CASE.md#21-intended-purpose): a shared,
current view of mental health bed capacity, ED waits, referrals, ward answers, transport and typed
Mental Health Act form details, **so that people decide placements**. The signed intended purpose
statement (D-87) replaces this once signed; the adviser should assess that statement.

It deliberately does not score risk or acuity, suggest or rank wards, re-sort the ED queue,
calculate Mental Health Act periods or expiry, release beds automatically, or email patient
details ([section 2.3](CLINICAL-SAFETY-CASE.md#23-out-of-scope-what-ward-flow-deliberately-does-not-do)).
`tests/ward-never-build-drift-guard.test.ts` and `tests/ward-ruling-guardrails.test.ts` guard
common forms of drift.

## 2. Drafter's reasoning

1. **Definition.** Under the Therapeutic Goods Act 1989, software is a medical device when its
   manufacturer intends it to be used for a therapeutic purpose such as diagnosis, prevention,
   monitoring, prediction, prognosis, treatment or alleviation of disease (section 41BD, to
   confirm). Intended purpose is judged from labelling, instructions, claims and how the product
   is presented, not only from what the code can do.
2. **Software exclusions.** Since 2021 the Therapeutic Goods (Excluded Goods) Determination 2018
   excludes some software. The drafter believes these exclusions are relevant (item numbers to
   confirm):
   - software that only manages health processes or facilities, such as bed management, patient
     flow, scheduling and administration, rather than diagnosing or treating a person;
   - electronic patient records and systems that only store and display information, without
     analysing it to give a new clinical result;
   - software that only enables communication between health professionals.
3. **Ward Flow against the exclusions.** Bed capacity, waits, referrals, transport and ward
   answers are administration of a health facility. Typed form details are shown as typed, not
   calculated (D-70, D-93). People make every placement decision. On this reading Ward Flow fits
   the process-management exclusion and is **not** a medical device.
4. **Not relying on the clinical decision support exemption.** If any part were found to support a
   clinical recommendation, the clinical decision support software exemption (Therapeutic Goods
   (Medical Devices) Regulations 2002, Schedule 4, to confirm) could apply, but it brings duties
   (notifying the TGA, reporting adverse events). The design aim is to stay outside the device
   definition, not to rely on that exemption.

## 3. What would change the answer

Any of these could make Ward Flow, or a part of it, a medical device. Each is already on the
never-build list or guarded, but the adviser should confirm the list is complete:

| Change                                                    | Why it matters                          | Guard today                                     |
| --------------------------------------------------------- | --------------------------------------- | ----------------------------------------------- |
| A risk, acuity or priority score                          | Predicts or ranks a clinical state      | Never-build rule; drift guard test              |
| Suggesting, ranking or pre-selecting a ward for a patient | Recommends a clinical placement         | D-71 items 2 and 6; ruling guard tests          |
| Calculating Mental Health Act periods or expiry           | Calculates a legal and clinical outcome | D-93; ruling guard tests                        |
| Re-ordering the ED queue by anything but wait order       | Triage-like prioritisation              | D-71 item 3, D-32                               |
| Alerts that tell staff what clinical action to take       | Could be treatment-directing            | Fixed alert text only                           |
| Marketing or training material claiming clinical benefit  | Intended purpose includes claims        | **No guard.** Review all wording before a pilot |

## 4. Questions for the adviser

1. Does the signed intended purpose statement fall within an exclusion? Which item?
2. Do the typed legal form times, shown as typed with no countdown (D-93), change that?
3. Do "Distance only, not suitability" road times (D-71 item 6) or the neutral fit line (D-110)
   count as decision support?
4. If a health service runs Ward Flow, who is the manufacturer for TGA purposes?
5. Is anything in section 3 missing?
6. Do the triage and risk form, its safety plan builder and its suggestion chips ("Suggested from
   mental state", "Suggested from risk flags", which add an item only when a person clicks one)
   count as decision support? Section 2 reasons only about beds, waits, referrals and transport.

## 5. Record

| Item                             | Who | Date | Where filed |
| -------------------------------- | --- | ---- | ----------- |
| Spending approval and cap (Josh) |     |      |             |
| Adviser engaged                  |     |      |             |
| Written view received            |     |      |             |
| Clinical Safety Case 2.4 updated |     |      |             |

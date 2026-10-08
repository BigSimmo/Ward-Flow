# Ward Flow: WA Mental Health Act forms review pack

**Version:** 1.1, corrected 8 October 2026. **Status:** draft for qualified review;
not legal approval or a compliance certificate. **Scope:** synthetic form-recording
and bed-flow demonstration. Signed statutory forms remain authoritative.

## Source and terminology

The [WA Chief Psychiatrist official forms register](https://www.chiefpsychiatrist.wa.gov.au/laws-and-rights/legislation/mental-health-act-2014-forms)
is the source for form names. The [WA legislation register](https://www.legislation.wa.gov.au/legislation/statutes.nsf/main_mrtitle_13534_homepage.html)
identified Act version **02-b0-02, 25 September 2025** as current during the
8 October audit. Recheck the current Act, regulations, forms and guidance
before any clinical review; a dated source check is not legal advice.

| Form         | Source-backed purpose                             | Prototype boundary                                                                    |
| ------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1A           | Referral for examination by a psychiatrist        | Record what the signed form states.                                                   |
| 3A / 3B / 3C | Official further-examination/detention form group | Use each official form's complete name and conditions; do not infer equivalence.      |
| 4A           | Transport order                                   | Record supplied form and transport facts; software does not authorise transport.      |
| 5A           | Community treatment order                         | **Not an involuntary inpatient treatment order.**                                     |
| 5B           | Continuation of community treatment order         | Do not represent it as an inpatient order.                                            |
| 6A / 6B      | Involuntary inpatient treatment order forms       | Inpatient placement and authorised-hospital requirements need qualified legal review. |

The earlier draft incorrectly named Form 5A as an inpatient order and attributed
an extension to Form 3D. The official register reviewed did not establish a Form
3D. Historical synthetic records may retain that code; it has **no verified period
or legal meaning here** and must not be represented as an approved statutory form.
This correction does not silently convert existing records to another form.

## Time and placement controls

- Typed expiry from the signed form remains the record. Software never creates a
  binding expiry or automatically detains, treats, discharges or changes legal status.
- D-29 permits sourced advisory periods only in
  `src/components/ward-management/legal-forms/act-periods-demo.ts`, labelled
  **Synthetic demo, not legally checked**. This pack does not introduce another
  period table or repeat unverified section numbers/durations.
- Existing destination eligibility checks are engineering controls over synthetic
  unit/legal-status data. They are not evidence of gazettal, legal interpretation,
  current hospital authority or real-world compliance.
- Ward Flow does not authorise seclusion or restraint. Expanding its intended
  purpose would require a separate clinical, legal and regulatory assessment.

## Required acceptance before real use

1. Obtain the health service's legal/clinical owner and documented review of
   every implemented form name, source, timer, correction and placement rule.
2. Verify authorised-hospital/unit reference data and ownership of updates. Test
   changes in status, correction, revocation and destination eligibility together.
3. Review patient rights, notification, advocacy and form-record evidence with
   appropriate WA bodies. Do not assume an electronic record replaces a signed
   statutory document or satisfies evidentiary requirements.
4. Reconcile unsupported historical form codes explicitly; retain provenance and
   require an authorised correction rather than silently relabelling records.
5. Record reviewer, date, source versions, scope, conditions and unresolved matters
   in the [production-readiness register](PRODUCTION-READINESS.md).

Local prototype builds and synthetic tests do not require these external approvals.
Clinical use does. Internal approval to prepare this pack is not external sign-off.

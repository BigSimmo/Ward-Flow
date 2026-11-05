# Current event catalogue, command models and route inventory

The route is selective. Its action notes and the additional command models have source review evidence; source digests detect later edits. This does not establish runtime or clinical acceptance.

## 178 CURRENT ENGINE EVENTS
Source-contract SHA256: 7c57a486f7a1b4c235d7271cc03b0add354cb85af66012a47865e12654000ecb
- RECORD_ADMISSION_CARE — diagram-reviewed; event roles: ward, coordinator, community
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:20
  Event/dispatch reference: src/components/ward-management/ward-flow-protected-record-events.ts:208
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1562
- RECORD_ADMISSION_FOLLOW_UP — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:21
  Event/dispatch reference: src/components/ward-management/ward-flow-protected-record-events.ts:208
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1561
- RECORD_PATIENT_DISCHARGE — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:22
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1560
- UPDATE_EXPECTED_DISCHARGE — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:23
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:223
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1771
- OPEN_DISCHARGE_RECORD — diagram-reviewed; event roles: coordinator, ward, community, bed_manager
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:25
  Event/dispatch reference: src/components/ward-management/ward-flow-protected-record-events.ts:177
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1557
- REVIEW_AUDIT_EVENT — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:26
  Event/dispatch reference: src/components/ward-management/ward-flow-protected-record-events.ts:130
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1558
- RAISE_REFERRAL — diagram-reviewed; event roles: ed, community, ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:37
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1555
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-send-events.ts:93
- RECORD_EXAMINATION — diagram-reviewed; event roles: ed, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:38
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:578
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1870
- RECORD_MEDICAL_CLEARANCE — diagram-reviewed; event roles: ed, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:39
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:164
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1861
- RECORD_ARRIVED_IN_DEPARTMENT — diagram-reviewed; event roles: ed, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:43
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:213
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1862
- RECORD_TRANSPORT_NEED — diagram-reviewed; event roles: ed, ward, community, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:52
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:226
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1863
- RECORD_LEGAL_FORM_RECEIVED — diagram-reviewed; event roles: ed, ward, community, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:59
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:463
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1528
- CORRECT_LEGAL_FORM_RECEIPT — diagram-reviewed; event roles: ed, ward, community, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:65
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1851
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-send-events.ts:416
- RECORD_LEGAL_FORM_EXPIRY — diagram-reviewed; event roles: ed, coordinator, ward
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:75
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1407
  Event/dispatch reference: src/components/ward-management/ward-flow-record-legal-events.ts:51
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1867
- RECORD_MOVEMENT_GENDER — diagram-reviewed; event roles: ed, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:80
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:509
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1868
- RECORD_NO_REFERRAL — diagram-reviewed; event roles: ed, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:81
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:294
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1864
- RECORD_ED_OUTCOME — diagram-reviewed; event roles: ed, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:84
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:325
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1865
- REFER_TO_UNITS — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:85
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1853
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-send-events.ts:686
- ACCEPT_IN_PRINCIPLE — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:86
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:874
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-answer-events.ts:107
- PULL_PATIENT — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:90
  Event/dispatch reference: src/components/ward-management/ward-flow-placement-events.ts:73
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:680
- DECLINE — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:91
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1901
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-answer-events.ts:239
- HANDOVER_READY — diagram-reviewed; event roles: ed, community, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:94
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1994
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:85
- TRANSPORT_ACCEPTED — diagram-reviewed; event roles: officer, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:95
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1995
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:128
- TRANSPORT_EN_ROUTE — diagram-reviewed; event roles: officer, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:96
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1996
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:178
- PATIENT_COLLECTED — diagram-reviewed; event roles: officer, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:97
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1997
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:229
  Event/dispatch reference: src/components/ward-management/ward-transport-collection-events.ts:11
- PATIENT_ARRIVED — diagram-reviewed; event roles: officer, ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:98
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1585
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:315
- CONFIRM_CAPACITY — diagram-reviewed; event roles: ward, bed_manager, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:100
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:297
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1773
- RECORD_WARD_INTAKE_CONSTRAINTS — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:103
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:820
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1876
- RECORD_ESCALATION — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:104
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1127
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1883
- ADVANCE_CLOCK — diagram-reviewed; event roles: demo
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:105
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1815
- RESET_SCENARIO — diagram-reviewed; event roles: demo
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:106
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1577
- SET_SCENARIO — diagram-reviewed; event roles: demo
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:107
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1577
- SET_CONFIGURATION — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:109
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1826
- CHANGE_URGENCY — diagram-reviewed; event roles: coordinator, ed, ward, community
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:112
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1857
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-send-events.ts:1209
- CHANGE_LEGAL_STATUS — diagram-reviewed; event roles: coordinator, ed, ward, community
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:113
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1858
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-send-events.ts:1250
- RELEASE_PULL — diagram-reviewed; event roles: coordinator, ward
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:114
  Event/dispatch reference: src/components/ward-management/ward-flow-placement-events.ts:443
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1987
- BOOK_TRANSPORT — diagram-reviewed; event roles: ed, ward, community, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:151
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1999
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:649
- CANCEL_TRANSPORT — diagram-reviewed; event roles: coordinator, ed, ward, community
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:173
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2000
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:829
- STOP_TRANSPORT — diagram-reviewed; event roles: coordinator, ed
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:183
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2001
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:1007
- RECORD_TRANSPORT_CAD — modelled; event roles: ed, ward, community, coordinator, officer
  Source-reviewed command model: Same job carrying a trimmed CAD number and cadAdded time/role.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:186
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2004
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:1120
  Event/dispatch reference: src/components/ward-management/ward-transport-collection-events.ts:30
  Subject: A movement’s current transport job
  Before: Live, unarrived, uncancelled transport with no nonblank CAD number
  After: Same job carrying a trimmed CAD number and cadAdded time/role
  Scope: ED, ward, community, coordinator or officer in EVENT_ROLE. Ward acts only for the sending stay/ward; shared scope also restricts ED to origin ED and community to the sending team. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: movementId; cadNumber is required text, trimmed after validation
  payload: actingUnitId required in practice for ward callers; role and now
  guards: Existing open movement and live job; no existing nonblank CAD number
  guards: Reject blank or placeholder CAD values; ward’s actingUnitId must identify the sending ward
  effects: Updates only movement.transport.cadNumber and cadAdded; does not dispatch, accept or advance the job
  tests: tests/ward-transport-cad-to-follow.test.ts
  Reviewed source: src/components/ward-management/ward-flow-transport-events.ts:1120; SHA256 e39eb7a1938c796e6d6bf98fd6fc594d719bffeddba39b8be5f5ed686fac0928
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:186; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-transport-collection-events.ts:30; SHA256 1ebf665a65645eb14f53647d07db90bef0a947b2a7e298f2b6f203b7c78d3496
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- RELEASE_HELD_BED — diagram-reviewed; event roles: coordinator, ward, ed
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:188
  Event/dispatch reference: src/components/ward-management/ward-flow-placement-events.ts:569
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1988
- RECORD_DIVERSION — diagram-reviewed; event roles: officer, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:190
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1144
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1884
- RELEASE_DIVERTED_BED — diagram-reviewed; event roles: coordinator, ward, ed
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:192
  Event/dispatch reference: src/components/ward-management/ward-flow-placement-events.ts:637
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1989
- REFER_TO_COMMUNITY_TEAM — diagram-reviewed; event roles: ed, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:193
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1852
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-send-events.ts:464
- RECORD_LEFT_DEPARTMENT — diagram-reviewed; event roles: ed, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:194
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:558
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1869
- FLAG_BED_RELEASE — diagram-reviewed; event roles: ward, bed_manager, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:197
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:369
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1774
- CONFIRM_BED_RELEASE — diagram-reviewed; event roles: ward, bed_manager, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:198
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:463
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1775
- REVERT_BED_RELEASE — diagram-reviewed; event roles: ward, bed_manager, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:202
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:502
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1776
- BLOCK_BED_RELEASE — diagram-reviewed; event roles: ward, bed_manager, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:203
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:541
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1777
- CLEAR_BED_RELEASE_BLOCK — diagram-reviewed; event roles: ward, bed_manager, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:204
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:581
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1778
- SET_BED_PREPARATION — diagram-reviewed; event roles: ward, bed_manager, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:205
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:618
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1779
- RECORD_LEAVE_BED — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:206
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1396
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:317
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1877
- END_LEAVE_BED — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:207
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:653
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1780
- RECORD_ABSENT_WITHOUT_LEAVE — modelled; event roles: ward, coordinator
  Source-reviewed command model: Leave-bed record carries absentWithoutLeave {since,steps:[]}; stay remains occupied.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:211
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1397
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:372
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1878
  Subject: An occupied admission and its held leave-bed record
  Before: Occupied stay, not away at ED, with no recorded absence
  After: Leave-bed record carries absentWithoutLeave {since,steps:[]}; stay remains occupied
  Scope: Ward or coordinator; every caller supplies the admission ward claim. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: admissionId; actingUnitId must match the stay’s ward; role and now
  guards: Stay must exist and be occupied
  guards: Reject another ward, existing absence, or a stay recorded away at an ED
  effects: Updates an existing leave-bed record or creates one with expectedReturn=now; preserves existing leave details
  effects: Keeps the admission and bed occupancy; return is recorded separately through END_LEAVE_BED
  tests: tests/ward-absence-and-cto.test.ts
  tests: tests/ward-away-from-ward-exclusive.test.ts
  Reviewed source: src/components/ward-management/ward-flow-record-stay-events.ts:372; SHA256 c5f1bf077a95e7863b2df7291cd9617f4181194752d1e9d5938df369de6bdce5
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:211; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-events.ts:1369; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- RECORD_ABSENCE_STEP — modelled; event roles: ward, coordinator
  Source-reviewed command model: Same absence with one timed step appended.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:212
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1398
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:424
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1879
  Subject: An existing absence without leave
  Before: Absence has no record of this listed missing-person step
  After: Same absence with one timed step appended
  Scope: Ward or coordinator; actingUnitId must equal the absence record’s unit. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: admissionId; actingUnitId; step from ABSENCE_STEPS; role and now
  guards: An absence record must exist for the admission
  guards: Step must be listed, not already recorded, and not earlier than absence.since
  effects: Appends {step,at} to absentWithoutLeave.steps; does not end absence, release a bed or contact anyone
  tests: tests/ward-absence-and-cto.test.ts
  Reviewed source: src/components/ward-management/ward-flow-record-stay-events.ts:424; SHA256 c5f1bf077a95e7863b2df7291cd9617f4181194752d1e9d5938df369de6bdce5
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:212; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-events.ts:1378; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- RECORD_COMMUNITY_TREATMENT_ORDER — modelled; event roles: community, coordinator
  Source-reviewed command model: Form 5A recorded with time and desk label; any ended order retained in earlier history.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:213
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1408
  Event/dispatch reference: src/components/ward-management/ward-flow-record-legal-events.ts:154
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1880
  Subject: A patient’s recorded community treatment order
  Before: Patient exists with no current order, no occupied stay and no open non-arrived placement
  After: Form 5A recorded with time and desk label; any ended order retained in earlier history
  Scope: Community or coordinator. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: patientId; role and now; no user-supplied lapse time
  guards: Reject missing patient or a current order without endedAt
  guards: Reject an occupied admission or open movement whose stage is not arrived; waitlisted/pulled stays alone do not block
  effects: Writes patient.communityTreatmentOrder; moves prior ended order and its earlier history into earlier
  effects: No automatic expiry, placement, legal-status change or bed move
  effects: The step can be taken back by UNDO_PATIENT_RECORD within the Undo window, filed against the patient record.
  tests: tests/ward-absence-and-cto.test.ts
  Reviewed source: src/components/ward-management/ward-flow-record-legal-events.ts:154; SHA256 1ea8f3c4f644456cfff2f29b16085917696fb2b118a50d08a9acdf056a18e04e
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:213; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-events.ts:1387; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- END_COMMUNITY_TREATMENT_ORDER — modelled; event roles: community, coordinator
  Source-reviewed command model: Same order retained with endedAt=now.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:214
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:666
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1781
  Subject: A patient’s current community treatment order
  Before: Order exists and has no endedAt
  After: Same order retained with endedAt=now
  Scope: Community or coordinator. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: patientId; role and now
  guards: Patient and an unended order must exist; repeat ending is refused
  effects: Adds endedAt; retains the order and earlier history; no timer or automatic end
  effects: The step can be taken back by UNDO_PATIENT_RECORD within the Undo window, filed against the patient record.
  tests: tests/ward-absence-and-cto.test.ts
  Reviewed source: src/components/ward-management/ward-flow-bed-events.ts:666; SHA256 a63ee87e0e4c23df938c2732ded19ca0e95f859bf586980d00fa0fdb648694f3
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:214; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-events.ts:1394; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- RECORD_LEAVING — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:218
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1392
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:122
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1583
- RECORD_AWAY_AT_EMERGENCY_DEPARTMENT — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:230
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1393
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:208
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1873
- RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:231
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1394
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:244
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1874
- RECORD_STAY_DISCHARGE_BLOCKER — modelled; event roles: ward, bed_manager, coordinator
  Source-reviewed command model: Stay blockReason and linked nondischarged releases carry the chosen blocker.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:234
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1395
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:264
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1875
  Subject: An occupied admission and its pending bed releases
  Before: Occupied stay with no blocker or another recorded blocker
  After: Stay blockReason and linked nondischarged releases carry the chosen blocker
  Scope: Ward, site bed manager or coordinator; actingUnitId must equal admission.unitId. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: admissionId; actingUnitId; blocker from BED_RELEASE_BLOCKERS; role and now
  guards: Admission must exist, be occupied and match actingUnitId
  guards: blocker must be a nonempty member of BED_RELEASE_BLOCKERS
  effects: Replaces admission.blockReason
  effects: For all linked releases not discharged, updates blocker, blockedBy, blockerRecordedAt and confirmedAt; moves no capacity figure or bed state
  tests: tests/ward-stay-discharge-blocker.test.ts
  Reviewed source: src/components/ward-management/ward-flow-record-stay-events.ts:264; SHA256 c5f1bf077a95e7863b2df7291cd9617f4181194752d1e9d5938df369de6bdce5
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:234; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-events.ts:1827; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- CLEAR_STAY_DISCHARGE_BLOCKER — modelled; event roles: ward, bed_manager, coordinator
  Source-reviewed command model: Admission blockReason=null; clearance retained on matching pending release or admission.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:235
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:246
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1772
  Subject: An admission’s current discharge blocker
  Before: Admission carries a non-null blockReason
  After: Admission blockReason=null; clearance retained on matching pending release or admission
  Scope: Ward, site bed manager or coordinator; actingUnitId must equal admission.unitId. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: admissionId; actingUnitId; optional reason from DISCHARGE_DELAY_CLEAR_REASONS; role and now
  guards: Admission and a current blocker must exist
  guards: If reason supplied it must be listed; no default reason is invented
  effects: Clears the stay blocker
  effects: If a same-ward nondischarged release has the same blocker, clears its blocker/blockedBy and appends clearance history there; otherwise appends stayBlockClearances
  effects: Does not release the bed or change admission state
  tests: tests/ward-stay-discharge-blocker.test.ts
  Reviewed source: src/components/ward-management/ward-flow-bed-events.ts:246; SHA256 a63ee87e0e4c23df938c2732ded19ca0e95f859bf586980d00fa0fdb648694f3
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:235; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-events.ts:1839; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- RECORD_OBSERVATION_LEVEL — modelled; event roles: ed, ward, coordinator
  Source-reviewed command model: Named target and any agreeing linked open counterpart carry the new observation and append from/to history.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:238
  Event/dispatch reference: src/components/ward-management/ward-flow-observation-events.ts:33
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1898
  Subject: An open movement or occupied admission and its agreeing live counterpart
  Before: Target has its recorded observation and retained change-count token
  After: Named target and any agreeing linked open counterpart carry the new observation and append from/to history
  Scope: EVENT_ROLE applies. Ward movement updates require its accepted ward; admission target requires its ward claim and refuses ED callers. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: target is {kind:movement,movementId,actingUnitId?} or {kind:admission,admissionId,actingUnitId}
  payload: observation is a valid Observation; expected editing token required once the target has prior changes; role and now
  guards: Valid observation; target exists; movement open or admission bed occupied
  guards: New value must differ; token must match and linked records must agree; missing token refused after first recorded change
  guards: Seeded links without matching observations stay unlinked rather than silently overwriting the other record
  guards: Accepted edits require a safe retained sequence allocator below Number.MAX_SAFE_INTEGER; exhaustion refuses before writing.
  guards: Accepted observation sequence is reducer-generated from retained movement/admission history, independent of the audit counter; restore permits missing legacy metadata or positive safe integers and refuses zero, fractions and unsafe values.
  effects: Updates observation and appends {at,sequence,from,to} on each linked record
  effects: No new placement or capacity allocation; staffing eligibility remains a separate pull check
  effects: Accepted observation history entries also carry sequence=max(all retained movement/admission observation sequences,0)+1; an agreeing linked counterpart receives that same edit sequence. PATIENT_ARRIVED uses retained accepted order before legacy minute timestamps. Genuinely unordered legacy ties retain the previous fallback; no historical order is invented.
  effects: An accepted edit marks its audit decision accepted with no reason code.
  tests: tests/ward-observation-levels.test.ts
  tests: tests/ward-observation-expected-token.test.ts
  tests: tests/ward-audit-s2-observation-join.test.ts
  tests: tests/ward-consolidated-domain-20261104.test.ts
  Reviewed source: src/components/ward-management/ward-flow-observation-events.ts:33; SHA256 275eabc8477f1bbfb0fff94c155c389a544304f1daebb6be8036d13c54ade72c
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:238; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-observation-events.ts:33; SHA256 275eabc8477f1bbfb0fff94c155c389a544304f1daebb6be8036d13c54ade72c
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
  Reviewed source: src/components/ward-management/ward-observation.ts:48; SHA256 b714525f0d4c6d18d050f9a3600f38c8de4e9a013595a77844c5c492fbdc2e3c
- RECORD_MOVEMENT_BLOCKER — diagram-reviewed; event roles: ed, community, ward, coordinator, officer
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:278
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:763
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1872
- CLEAR_MOVEMENT_BLOCKER — diagram-reviewed; event roles: ed, community, ward, coordinator, officer
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:285
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2137
- FLAG_MOVEMENT_TURNAROUND_PRIORITY — modelled; event roles: coordinator
  Source-reviewed command model: Same movement carries {unitId,flaggedAt,source}; no bed is promised.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:306
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2024
  Subject: A waiting movement’s receiving-unit preference
  Before: Waiting unplaced movement with an open suitable ward request and current turnaround source
  After: Same movement carries {unitId,flaggedAt,source}; no bed is promised
  Scope: Coordinator only, within its shared authorised scope. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: movementId; unitId; optional source cld or departure; finite now; role
  guards: Unit and target must exist; current source must be CLD-ready occupied criteria with feature enabled, or confirmed unblocked departure on an occupied stay
  guards: Clinical/legal gates must pass (allocation/freshness and the helper’s locked-bed security exception are separate); open request must match selected unit
  guards: Movement must be open, not arrived and unaccepted
  guards: Same unit/source preference already recorded is refused
  effects: Sets turnaroundPriority only; does not hold capacity, discharge anybody, accept a request or advance stage
  effects: Selectors later hide a preference whose original readiness source no longer qualifies
  tests: tests/ward-cld-turnaround-priority.test.ts
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:2024; SHA256 8e056e60e9ae556496e92a26fc4f9d9dd32e68d3f1fc16358889fe6442e826c8
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:306; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-events.ts:685; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-turnaround-priority.ts:65; SHA256 f4a062f776b7e676eb045bd32daf9aac4a636392dab5599a571687cbf47db4b8
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- FLAG_REFERRAL_TURNAROUND_PRIORITY — modelled; event roles: coordinator
  Source-reviewed command model: Same referral carries {unitId,flaggedAt,source}; no bed is promised.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:307
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2025
  Subject: A waiting referral’s receiving-unit preference
  Before: Waiting unplaced referral with an open suitable ward request and current turnaround source
  After: Same referral carries {unitId,flaggedAt,source}; no bed is promised
  Scope: Coordinator only, within its shared authorised scope. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: referralId; unitId; optional source cld or departure; finite now; role
  guards: Unit and target must exist; current source must be CLD-ready occupied criteria with feature enabled, or confirmed unblocked departure on an occupied stay
  guards: Clinical/legal gates must pass (allocation/freshness and the helper’s locked-bed security exception are separate); open request must match selected unit
  guards: Referral must still be queued with an unwithdrawn ward request; no linked movement may exist
  guards: Same unit/source preference already recorded is refused
  effects: Sets turnaroundPriority only; does not hold capacity, discharge anybody, accept a request or advance stage
  effects: Selectors later hide a preference whose original readiness source no longer qualifies
  tests: tests/ward-cld-turnaround-priority.test.ts
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:2025; SHA256 8e056e60e9ae556496e92a26fc4f9d9dd32e68d3f1fc16358889fe6442e826c8
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:307; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-events.ts:694; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-turnaround-priority.ts:65; SHA256 f4a062f776b7e676eb045bd32daf9aac4a636392dab5599a571687cbf47db4b8
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- MARK_REFERRAL_OPENED — modelled; event roles: ward, coordinator
  Source-reviewed command model: Same copy has openedAt=now; answer state unchanged.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:310
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1908
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-followup-events.ts:17
  Subject: One addressed ward’s copy of a referral
  Before: Ward copy exists without openedAt
  After: Same copy has openedAt=now; answer state unchanged
  Scope: Ward or coordinator; actingUnitId must equal unitId even for the coordinator. Named copy preferred, otherwise an unnamed ward copy. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: referralId; unitId; actingUnitId; role and now
  guards: Referral and an applicable ward copy must exist
  guards: Reject mismatched actingUnitId and a copy already stamped opened
  effects: Stamps openedAt once; does not answer, stop the decision clock or alter decidedAt
  tests: tests/ward-referral-followup.test.ts
  Reviewed source: src/components/ward-management/ward-flow-referral-followup-events.ts:102; SHA256 a7980fe9e58a4d1fcc774d48dfeb4e2673b66d0624fef24d00fae7b1fcf32039
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:310; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-events.ts:709; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- REQUEST_REFERRAL_INFORMATION — modelled; event roles: ward, coordinator
  Source-reviewed command model: New listed needs appended; existing open needs retained without duplication.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:311
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1909
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-followup-events.ts:118
  Subject: One awaiting ward copy’s information checklist
  Before: Ward copy queued and unwithdrawn
  After: New listed needs appended; existing open needs retained without duplication
  Scope: Ward for its own copy or coordinator; named copy preferred over unnamed. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: referralId; unitId; needs is a nonempty list from REFERRAL_INFORMATION_NEEDS
  payload: actingUnitId optional in type but required for ward’s own-unit check; role and now
  guards: Applicable ward copy must still await answer
  guards: Every need must be listed; at least one deduplicated need must not already be open
  effects: Appends {need,at,by} to informationNeeds; met historical needs can be requested again
  effects: No referral decision or decision-clock change
  tests: tests/ward-referral-followup.test.ts
  Reviewed source: src/components/ward-management/ward-flow-referral-followup-events.ts:118; SHA256 a7980fe9e58a4d1fcc774d48dfeb4e2673b66d0624fef24d00fae7b1fcf32039
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:311; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-events.ts:722; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- MARK_REFERRAL_INFORMATION_MET — modelled; event roles: ed, community, ward, coordinator
  Source-reviewed command model: Selected open request(s) stamped metAt and metBy; checklist history retained.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:313
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1910
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-followup-events.ts:55
  Subject: One information category requested by one or all current requesting wards
  Before: At least one requested listed need remains unmet on a queued, unwithdrawn ward copy
  After: Selected open request(s) stamped metAt and metBy; checklist history retained
  Scope: Sending ED/community/ward desk or coordinator. Ward requires referral.source=psychiatric_ward; shared boundary verifies the stored sender rather than destination ward identity. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: referralId; need from REFERRAL_INFORMATION_NEED_IDS
  payload: Exactly one target shape: wardUnitId string, or allRequestingWards:true; role and now
  guards: Reject invalid/ambiguous target or off-list need
  guards: Named target requires awaiting copy and an unmet need; all-target needs at least one current matching request
  effects: Named target stamps its first unmet matching entry; all-target stamps matching unmet entries on every awaiting ward copy
  effects: Does not answer any ward or stop its decision clock
  tests: tests/ward-referral-followup.test.ts
  tests: tests/ward-sender-information-supplied.test.ts
  Reviewed source: src/components/ward-management/ward-flow-referral-followup-events.ts:148; SHA256 a7980fe9e58a4d1fcc774d48dfeb4e2673b66d0624fef24d00fae7b1fcf32039
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:313; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-events.ts:733; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- ASSIGN_REFERRAL — modelled; event roles: coordinator, ed, community
  Source-reviewed command model: ownerHistory appended; its last owner is the current chasing desk.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:316
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1916
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-owner-events.ts:21
  Subject: The desk chasing a front-door referral
  Before: Referral not accepted or fully withdrawn; owner desk differs or is absent
  After: ownerHistory appended; its last owner is the current chasing desk
  Scope: Coordinator may assign any listed owner desk; ED/community may take only for their own role. Not a lock on other permitted actions. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: referralId; owner from REFERRAL_OWNER_DESKS; role and finite now
  guards: Referral must exist and not be accepted or fully withdrawn; the follow-up helper does not require a queued arm
  guards: Owner must be listed; reject another desk’s self-assignment and same current owner
  effects: Appends {owner,at,by}; destinations, answers and decision clock unchanged
  tests: tests/ward-referral-owner-and-calls.test.ts
  tests: tests/ward-referral-owner-and-calls-scope.test.ts
  Reviewed source: src/components/ward-management/ward-flow-referral-owner-events.ts:44; SHA256 13b724abff93f6ec86c6b232d9ea7f00e66609f8297122508a7976198f8ce19e
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:316; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-events.ts:757; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
  Reviewed source: src/components/ward-management/referrals/referral-owner-and-calls-model.ts:28; SHA256 783d84f0aa1cc62b1f388bfabaa637c851ef47570a4ebfefc94406d550e4bde3
- LOG_REFERRAL_CONTACT — modelled; event roles: coordinator, ed, community
  Source-reviewed command model: New checked contact/outcome entry appended.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:317
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1917
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-owner-events.ts:67
  Subject: A front-door referral’s call log
  Before: Referral not accepted or fully withdrawn, with prior contact history or none
  After: New checked contact/outcome entry appended
  Scope: Coordinator, ED or community, subject to record/place scope; contact names the called place, not acting authority. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: referralId; contact is psychiatric_ward/unitId, community_team/teamId, or referrer
  payload: outcome from REFERRAL_CONTACT_OUTCOMES; role and finite now
  guards: Referral must exist and not be accepted or fully withdrawn; the follow-up helper does not require a queued arm
  guards: Contact kind and outcome must be listed; named ward/team must exist
  effects: Appends checked {contact,outcome,at,by}; drops unrecognised contact fields
  effects: A logged call does not decide referral or pause its decision clock
  tests: tests/ward-referral-owner-and-calls.test.ts
  Reviewed source: src/components/ward-management/ward-flow-referral-owner-events.ts:67; SHA256 13b724abff93f6ec86c6b232d9ea7f00e66609f8297122508a7976198f8ce19e
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:317; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-events.ts:772; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
  Reviewed source: src/components/ward-management/referrals/referral-owner-and-calls-model.ts:28; SHA256 783d84f0aa1cc62b1f388bfabaa637c851ef47570a4ebfefc94406d550e4bde3
- RECORD_REFERRAL_COMMITMENT — modelled; event roles: coordinator, ward
  Source-reviewed command model: Checked step/promise/callback entry appended without answering referral.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:319
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1924
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-commitment-events.ts:24
  Subject: One awaiting ward copy’s response commitment
  Before: Open referral awaiting this ward, commitment absent or not resolved
  After: Checked step/promise/callback entry appended without answering referral
  Scope: Coordinator records any listed step/callback; ward only its own acknowledged/promised step. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: referralId; unitId; actingUnitId for ward; role and finite now
  payload: step and/or nextCallbackAt required; promisedFor required only with step=promised
  payload: promisedFor and nextCallbackAt must be finite and at or after now
  guards: Known ward and addressed, queued, unwithdrawn copy on open referral
  guards: Listed steps move forward; repeated response_requested and promised allowed; resolved blocks further entries
  guards: Ward cannot make callback-only entry; promise time refused on other steps
  effects: Appends commitment with unitId, at and desk label; keeps earlier entries
  effects: Does not change state, decidedAt, clocks or automatically call anyone
  tests: tests/ward-referral-commitments.test.ts
  Reviewed source: src/components/ward-management/ward-flow-referral-commitment-events.ts:24; SHA256 a304422664462b4413fa82c9ae19d0425aef260d8ccf65239ca708d722b08994
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:319; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-events.ts:789; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
  Reviewed source: src/components/ward-management/referrals/referral-owner-and-calls-model.ts:28; SHA256 783d84f0aa1cc62b1f388bfabaa637c851ef47570a4ebfefc94406d550e4bde3
  Reviewed source: src/components/ward-management/referrals/referral-commitments-model.ts:73; SHA256 b8ad888efb64576aa225df86d86b58d9e31306fda7791fe9815a00a4c6c82325
- ASK_MORE_WARDS — modelled; event roles: coordinator
  Source-reviewed command model: Additional named wards queued, preserving existing destinations.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:320
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1930
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-ask-events.ts:24
  Subject: An open community referral’s addressed wards
  Before: Open community referral has named ward request(s) with reusable bed requirements
  After: Additional named wards queued, preserving existing destinations
  Scope: Coordinator only; no automatic ranking or suggestion. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: referralId; nonempty distinct unitIds named by coordinator; role and now
  guards: Referral must be community source and not closed/withdrawn
  guards: Existing ward request must name a ward; any unnamed ward arm blocks expansion
  guards: Each new unit must exist, not have been asked before, be open and currently eligible
  guards: Awaiting existing wards plus additions must stay within parallelReferralCap
  effects: Copies original ward bed requirements into each new queued arm; stamps referredAt and addedBy
  effects: Does not answer existing arms, create a movement or reserve a bed
  tests: tests/ward-referral-ask-more-wards.test.ts
  Reviewed source: src/components/ward-management/ward-flow-referral-ask-events.ts:24; SHA256 d3c249774b280ef5c1b57d1f4c7575d2dce9ef721ec1f85ed2ac2c53e7874d08
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:320; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-referral-ask-events.ts:24; SHA256 d3c249774b280ef5c1b57d1f4c7575d2dce9ef721ec1f85ed2ac2c53e7874d08
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
  Reviewed source: src/components/ward-management/referrals/referral-owner-and-calls-model.ts:28; SHA256 783d84f0aa1cc62b1f388bfabaa637c851ef47570a4ebfefc94406d550e4bde3
- CLOSE_WARD_TO_ADMISSIONS — modelled; event roles: ward, bed_manager, coordinator
  Source-reviewed command model: isClosed=true with admissionsClosure reason/time/desk and optional expected reopening.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:323
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1937
  Event/dispatch reference: src/components/ward-management/ward-flow-ward-closure-events.ts:17
  Subject: A ward’s admissions closure
  Before: Known ward open to admissions
  After: isClosed=true with admissionsClosure reason/time/desk and optional expected reopening
  Scope: Ward for itself, site bed manager or coordinator within authorised scope. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: unitId; reason from WARD_CLOSURE_REASONS; optional until
  payload: actingUnitId for ward; role and now
  guards: Ward must exist and not already be closed
  guards: Listed reason; supplied until later than now and no farther than largest WARD_REOPEN_AFTER_HOURS choice
  effects: Writes closure record; existing holds/acceptances and bed figures remain
  effects: Eligibility/shortlists refuse new admissions; until is a prompt, never automatic reopening
  tests: tests/ward-closure.test.ts
  Reviewed source: src/components/ward-management/ward-flow-ward-closure-events.ts:44; SHA256 2fd18c518e21b86c1cda4b425c6cf5163251b409d3cddffd1f8a3b225f5142ef
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:323; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-events.ts:808; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- REOPEN_WARD_TO_ADMISSIONS — modelled; event roles: ward, bed_manager, coordinator
  Source-reviewed command model: isClosed=false; admissionsClosure removed.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:324
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1938
  Event/dispatch reference: src/components/ward-management/ward-flow-ward-closure-events.ts:72
  Subject: A ward’s admissions closure
  Before: Known ward marked closed
  After: isClosed=false; admissionsClosure removed
  Scope: Ward for itself, site bed manager or coordinator within authorised scope. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: unitId; actingUnitId for ward; role and now
  guards: Ward must exist and be closed
  effects: Removes closure record rather than advancing any waiting move; changes no bed count
  effects: Reopening is a person’s action; old closure-linked review/transition records are no longer current
  tests: tests/ward-closure.test.ts
  tests: tests/ward-loop-checks.test.ts
  Reviewed source: src/components/ward-management/ward-flow-ward-closure-events.ts:72; SHA256 2fd18c518e21b86c1cda4b425c6cf5163251b409d3cddffd1f8a3b225f5142ef
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:324; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-events.ts:819; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- SET_BED_CLOSED — modelled; event roles: ward, bed_manager, coordinator
  Source-reviewed command model: closed=true appends a mark; closed=false stamps active mark reopenedAt.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:326
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-closure-events.ts:24
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1941
  Subject: One exact numbered bed’s closure mark
  Before: Empty offerable bed is open, or numbered bed has active closed mark
  After: closed=true appends a mark; closed=false stamps active mark reopenedAt
  Scope: Ward, site bed manager or coordinator; actingUnitId must equal unitId. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: unitId; actingUnitId; integer bedNumber within 1..unit.beds; closed boolean
  payload: Optional listed reason when closing; no reason when reopening; role and now
  guards: Closing rejects already-closed, occupied/replayed seat, pulled/held bed, or no Ready capacity
  guards: Reopening requires an active mark and refuses any supplied reason
  effects: Records exact numbered mark and retains reopening history; does not rewrite allocatable confirmation
  effects: Derived Ready excludes active closed marks and recovers after reopen; existing stay seating retained
  tests: tests/ward-bed-closed-mark.test.ts
  tests: tests/ward-bed-closed-mark-kinds.test.ts
  Reviewed source: src/components/ward-management/ward-flow-bed-closure-events.ts:56; SHA256 e19afdf5df97f09582af829f62e2ff463cbf9ef8ba8e2b873e79ea7e7931497f
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:326; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-events.ts:827; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- RECORD_BED_MEETING_ACTION — modelled; event roles: coordinator
  Source-reviewed command model: meetingActions appended with chosen task, owner and due time.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:331
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-meeting-events.ts:30
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1975
  Subject: A movement or admission’s agreed meeting task
  Before: Subject exists and has no open action of this kind
  After: meetingActions appended with chosen task, owner and due time
  Scope: Coordinator chair only; owner names a role, not a person. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: subject {kind:movement|admission,id}; action from BED_MEETING_ACTION_KINDS
  payload: owner from BED_MEETING_ACTION_OWNERS; known unitId required for ward owner; dueAt later than now; role and now
  guards: Subject exists; action/owner listed; ward owner must name known ward
  guards: Reject dueAt not later than now or an existing open same-kind action
  effects: Appends task with recordedAt; does not change patient stage, occupancy or placement
  effects: No automatic execution when due
  effects: Before a new occurrence reuses its stable meeting inbox id, append returned snooze and released ownership boundaries where prior histories exist. Even a same-minute replacement starts without the preceding occurrence owner/snooze; histories are retained and the new occurrence may be claimed/snoozed again.
  tests: tests/ward-bed-meeting-actions.test.ts
  tests: tests/ward-consolidated-meeting-counts-20261104.test.ts
  Reviewed source: src/components/ward-management/ward-flow-bed-meeting-events.ts:61; SHA256 b28604a0b11e841e1daf151279719831992a89765e8553a84974993d57ed5e2c
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:331; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-events.ts:843; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- COMPLETE_BED_MEETING_ACTION — modelled; event roles: coordinator, ward, ed, community
  Source-reviewed command model: Same action stamped doneAt and doneBy.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:332
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-meeting-events.ts:105
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1976
  Subject: An open task on a movement or admission
  Before: Chosen subject carries an open action of this kind
  After: Same action stamped doneAt and doneBy
  Scope: Coordinator or owning ward/ED/community role; ward must match ownerUnitId. Site bed manager denied by EVENT_ROLE. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: subject {kind:movement|admission,id}; listed action; actingUnitId for ward owner; role and now
  guards: Subject and open listed action must exist
  guards: Caller must be coordinator or correct owning role/place
  effects: Retains task and stamps completion; does not enact the action or change subject’s stage
  tests: tests/ward-bed-meeting-actions.test.ts
  tests: tests/ward-bed-manager-actions.test.ts
  tests: tests/ward-consolidated-meeting-counts-20261104.test.ts
  Reviewed source: src/components/ward-management/ward-flow-bed-meeting-events.ts:105; SHA256 b28604a0b11e841e1daf151279719831992a89765e8553a84974993d57ed5e2c
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:332; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-events.ts:858; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- RECORD_RESTRICTIVE_PRACTICE_START — modelled; event roles: ward, coordinator
  Source-reviewed command model: New episode with typed start and recording metadata appended.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:336
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1948
  Event/dispatch reference: src/components/ward-management/ward-flow-restrictive-practice-events.ts:61
  Subject: A ward’s operational restrictive-practice episodes
  Before: Occupied stay on this ward with no open same-practice episode
  After: New episode with typed start and recording metadata appended
  Scope: Ward for itself or coordinator; site bed manager cannot record episodes. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: unitId; admissionId; practice from RESTRICTIVE_PRACTICE_IDS; startedAt
  payload: actingUnitId for ward; role and now; typed time finite and within last 24h, not future
  guards: Known ward, occupied admission belonging to it, listed practice
  guards: Reject invalid typed time and duplicate open practice for same stay
  effects: Appends Unit.restrictivePractice.episodes with generated id, startedAt, recordedAt and desk label
  effects: No legal limit or order computed; no occupancy change; separate departure guards require open episodes ended
  tests: tests/ward-restrictive-practice.test.ts
  tests: tests/ward-audit-s3-restrictive-practice-departure.test.ts
  Reviewed source: src/components/ward-management/ward-flow-restrictive-practice-events.ts:61; SHA256 5e2f0d1e4b5e3a3415d5114400ba622bb5e83a84787491e7a93f4f5a3c7f935b
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:336; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/restrictive-practice/ward-restrictive-practice.ts:136; SHA256 c605b305700a3df7cb0e8f7f1f923ac844971e33743d4227b677773e9ec056aa
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- RECORD_RESTRICTIVE_PRACTICE_END — modelled; event roles: ward, coordinator
  Source-reviewed command model: Same episode stamped with typed endedAt.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:337
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1949
  Event/dispatch reference: src/components/ward-management/ward-flow-restrictive-practice-events.ts:95
  Subject: One ward’s open restrictive-practice episode
  Before: Episode exists without endedAt
  After: Same episode stamped with typed endedAt
  Scope: Ward for itself or coordinator; site bed manager cannot end episodes. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: unitId; episodeId; endedAt; actingUnitId for ward; role and now
  payload: endedAt finite, within last 24h, not future or before startedAt
  guards: Known ward and open episode
  guards: Reject invalid/before-start typed time or already-ended episode; current admission occupancy is not required
  effects: Sets endedAt on episode and retains its start/recording metadata
  effects: No patient transfer, bed move or legal decision performed
  tests: tests/ward-restrictive-practice.test.ts
  Reviewed source: src/components/ward-management/ward-flow-restrictive-practice-events.ts:95; SHA256 5e2f0d1e4b5e3a3415d5114400ba622bb5e83a84787491e7a93f4f5a3c7f935b
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:337; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/restrictive-practice/ward-restrictive-practice.ts:147; SHA256 c605b305700a3df7cb0e8f7f1f923ac844971e33743d4227b677773e9ec056aa
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- RECORD_RESTRICTIVE_PRACTICE_FOLLOW_UP — modelled; event roles: ward, coordinator
  Reviewed command model: marks or clears one follow-up task on an ended restrictive-practice episode.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:339
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1950
  Event/dispatch reference: src/components/ward-management/ward-flow-restrictive-practice-events.ts:109
  Subject: One restrictive-practice episode on a ward
  Before: Episode ended, with its follow-up tasks marked so far
  After: The chosen follow-up task marked done or cleared
  Scope: ward or coordinator in the role table; authenticated reference scope applies.
  payload: unitId; episodeId; task from RESTRICTIVE_PRACTICE_FOLLOW_UP_TASKS; done (boolean); now; role.
  guards: The episode exists on the ward.
  guards: The episode has an end time recorded.
  guards: task is a listed follow-up task and done is a boolean.
  effects: Sets or removes the task in the episode's followUp; an empty followUp is removed.
  tests: tests/ward-legal-form-gap-items.test.ts
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:1950; SHA256 8e056e60e9ae556496e92a26fc4f9d9dd32e68d3f1fc16358889fe6442e826c8
  Reviewed source: src/components/ward-management/ward-flow-restrictive-practice-events.ts:109; SHA256 5e2f0d1e4b5e3a3415d5114400ba622bb5e83a84787491e7a93f4f5a3c7f935b
- RECORD_WARD_INCIDENT — modelled; event roles: ward, coordinator
  Source-reviewed command model: New category/time incident appended.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:340
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1951
  Event/dispatch reference: src/components/ward-management/ward-flow-restrictive-practice-events.ts:131
  Subject: A ward’s operational incident list
  Before: Known ward with existing or empty incident history
  After: New category/time incident appended
  Scope: Ward for itself or coordinator; site bed manager cannot record incidents. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: unitId; category from WARD_INCIDENT_CATEGORY_IDS; at finite within last24h and not future
  payload: actingUnitId for ward; role and now; no patient id or narrative
  guards: Known ward, listed category and valid typed time
  effects: Appends ward incident id/category/at/recordedAt/recordedBy
  effects: No patient, bed, stay or legal record changes; detailed incident report remains outside this app
  tests: tests/ward-restrictive-practice.test.ts
  Reviewed source: src/components/ward-management/ward-flow-restrictive-practice-events.ts:131; SHA256 5e2f0d1e4b5e3a3415d5114400ba622bb5e83a84787491e7a93f4f5a3c7f935b
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:340; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/restrictive-practice/ward-restrictive-practice.ts:160; SHA256 c605b305700a3df7cb0e8f7f1f923ac844971e33743d4227b677773e9ec056aa
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- SET_SECLUSION_ROOM_STATUS — modelled; event roles: ward, bed_manager, coordinator
  Source-reviewed command model: seclusionRoom replaced with status, time and desk label.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:341
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1952
  Event/dispatch reference: src/components/ward-management/ward-flow-restrictive-practice-events.ts:152
  Subject: A ward’s recorded seclusion-room availability
  Before: Room status absent or different
  After: seclusionRoom replaced with status, time and desk label
  Scope: Ward for itself, site bed manager or coordinator within authorised scope. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: unitId; status from SECLUSION_ROOM_STATUS_IDS; actingUnitId for ward; role and now
  guards: Known ward; listed status; repeat identical status refused
  effects: Writes only Unit.restrictivePractice.seclusionRoom
  effects: Does not start/end an episode or alter beds; selectors show an open seclusion episode as in use over the recorded availability
  tests: tests/ward-restrictive-practice.test.ts
  Reviewed source: src/components/ward-management/ward-flow-restrictive-practice-events.ts:152; SHA256 5e2f0d1e4b5e3a3415d5114400ba622bb5e83a84787491e7a93f4f5a3c7f935b
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:341; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/restrictive-practice/ward-restrictive-practice.ts:184; SHA256 c605b305700a3df7cb0e8f7f1f923ac844971e33743d4227b677773e9ec056aa
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- MARK_CANCELLED_MOVE_CHECK — modelled; event roles: coordinator, ward
  Source-reviewed command model: Selected item’s mark replaced with addressed/not_applicable and time/desk.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:345
  Event/dispatch reference: src/components/ward-management/ward-flow-loop-check-events.ts:58
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1963
  Subject: A cancelled move’s follow-up checklist
  Before: Move is cancelled, with prior mark or no mark for selected item
  After: Selected item’s mark replaced with addressed/not_applicable and time/desk
  Scope: Coordinator or ward that accepted this move. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: movementId; item from CANCELLED_MOVE_CHECK_ITEMS; mark from CANCELLED_MOVE_CHECK_MARKS
  payload: actingUnitId for ward; role and now
  guards: Movement exists and is cancelled; item/mark listed
  guards: Cannot mark pulled_bed addressed while cancelled move still holds a bed
  effects: Keeps one current mark per item; does not release beds, cancel transport or change movement stage
  tests: tests/ward-loop-checks.test.ts
  Reviewed source: src/components/ward-management/ward-flow-loop-check-events.ts:58; SHA256 ff8c33075771176af7fe4b39fee199eb3da5c97591401997d25b0455b83f5868
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:345; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/loop-checks/ward-loop-checks.ts:225; SHA256 67b1b35eaafcde31aa39f6d2f2e7a73aa9ae18859d17dd777426ba9a78404921
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- RECORD_ACCEPTANCE_CONDITION — modelled; event roles: coordinator, ward
  Source-reviewed command model: New condition appended tied to acceptedUnitId and acceptedAt.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:346
  Event/dispatch reference: src/components/ward-management/ward-flow-loop-check-events.ts:79
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1964
  Subject: A standing acceptance’s operational conditions
  Before: Open accepted move without this current condition
  After: New condition appended tied to acceptedUnitId and acceptedAt
  Scope: Coordinator or the accepting ward. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: movementId; condition from ACCEPTANCE_CONDITION_KINDS; agreedWith from its list
  payload: readyAt required only for bed_after_time: later than now and within largest ACCEPTANCE_BED_AFTER_HOURS choice
  payload: actingUnitId for ward; role and now
  guards: Movement must exist, be open and accepted
  guards: Reject duplicate current condition, off-list values, missing/out-of-range bed-after time or time on another condition
  effects: Appends condition and agreement provenance; does not hold a bed, change stage or modify eligibility
  effects: Times prompt review; no automatic condition completion
  tests: tests/ward-loop-checks.test.ts
  Reviewed source: src/components/ward-management/ward-flow-loop-check-events.ts:79; SHA256 ff8c33075771176af7fe4b39fee199eb3da5c97591401997d25b0455b83f5868
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:346; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/loop-checks/ward-loop-checks.ts:239; SHA256 67b1b35eaafcde31aa39f6d2f2e7a73aa9ae18859d17dd777426ba9a78404921
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- MARK_ACCEPTANCE_CONDITION_MET — modelled; event roles: coordinator, ward
  Source-reviewed command model: Condition retained with met {at,by}.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:347
  Event/dispatch reference: src/components/ward-management/ward-flow-loop-check-events.ts:80
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1965
  Subject: A current acceptance’s unmet condition
  Before: Open accepted move has this current condition not met
  After: Condition retained with met {at,by}
  Scope: Coordinator or the accepting ward. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: movementId; listed condition; actingUnitId for ward; role and now
  guards: Movement open and accepted; selected current condition exists and is not already met
  effects: Stamps met on that exact condition; leaves stage, placement, capacity and acceptance unchanged
  tests: tests/ward-loop-checks.test.ts
  Reviewed source: src/components/ward-management/ward-flow-loop-check-events.ts:80; SHA256 ff8c33075771176af7fe4b39fee199eb3da5c97591401997d25b0455b83f5868
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:347; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/loop-checks/ward-loop-checks.ts:250; SHA256 67b1b35eaafcde31aa39f6d2f2e7a73aa9ae18859d17dd777426ba9a78404921
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- RECORD_RESTRICTION_REVIEW — modelled; event roles: ward, bed_manager, coordinator
  Source-reviewed command model: One current review for restriction recorded/replaced.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:348
  Event/dispatch reference: src/components/ward-management/ward-flow-loop-check-events.ts:139
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1966
  Subject: A ward’s active restriction review reminder
  Before: Restriction currently active, with prior review or none
  After: One current review for restriction recorded/replaced
  Scope: Ward for itself, site bed manager or coordinator within authorised scope. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: unitId; restriction from WARD_RESTRICTION_KINDS; reviewer from RESTRICTION_REVIEWER_ROLES
  payload: expectedAt later than now and within largest RESTRICTION_REVIEW_AFTER_HOURS choice; actingUnitId for ward; role and now
  guards: Ward exists and named restriction is currently active; listed restriction/reviewer
  guards: Review time must be later than now and bounded by listed choices
  effects: Replaces review for same restriction, preserving others; closure review captures closure.startedAt
  effects: Does not lift restriction or reopen ward when time passes
  tests: tests/ward-loop-checks.test.ts
  Reviewed source: src/components/ward-management/ward-flow-loop-check-events.ts:139; SHA256 ff8c33075771176af7fe4b39fee199eb3da5c97591401997d25b0455b83f5868
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:348; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/loop-checks/ward-loop-checks.ts:262; SHA256 67b1b35eaafcde31aa39f6d2f2e7a73aa9ae18859d17dd777426ba9a78404921
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- MARK_CLOSURE_TRANSITION_ITEM — modelled; event roles: ward, bed_manager, coordinator
  Source-reviewed command model: Closure transitionMarks appended with current derived item and recording metadata.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:349
  Event/dispatch reference: src/components/ward-management/ward-flow-loop-check-events.ts:169
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1967
  Subject: A closed ward’s current handover checklist
  Before: Ward has admissionsClosure and selected still-pointing record is unmarked
  After: Closure transitionMarks appended with current derived item and recording metadata
  Scope: Ward for itself, site bed manager or coordinator within authorised scope. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: unitId; item from CLOSURE_TRANSITION_ITEM_KINDS; actingUnitId for ward; role and now
  payload: Record id: referralId for referral, plannedAdmissionId for booked_arrival, movementId for other listed item kinds
  guards: Ward must exist, be closed and carry admissionsClosure
  guards: Item must still point at the ward according to closureTransitionItems and must not already be marked
  effects: Appends derived item with at/by to current closure; does not move, cancel, reassign or release the underlying record
  tests: tests/ward-loop-checks.test.ts
  Reviewed source: src/components/ward-management/ward-flow-loop-check-events.ts:169; SHA256 ff8c33075771176af7fe4b39fee199eb3da5c97591401997d25b0455b83f5868
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:349; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/loop-checks/ward-loop-checks.ts:276; SHA256 67b1b35eaafcde31aa39f6d2f2e7a73aa9ae18859d17dd777426ba9a78404921
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- FLAG_MOVEMENT_URGENT — diagram-reviewed; event roles: coordinator, ed
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:350
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2077
- CLEAR_MOVEMENT_URGENT_FLAG — diagram-reviewed; event roles: coordinator, ed
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:351
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2101
- WITHDRAW_REFERRAL — diagram-reviewed; event roles: ed, community, ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:371
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1854
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-send-events.ts:894
- REQUEST_CAPACITY_REFRESH — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:374
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:681
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1782
- RECEIVE_REFERRAL — diagram-reviewed; event roles: community, ed, ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:389
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1902
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-answer-events.ts:356
- ADD_PATIENT — diagram-reviewed; event roles: ed, community, ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:393
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1790
  Event/dispatch reference: src/components/ward-management/ward-patient-registration-reducer.ts:39
- ARCHIVE_PATIENT — modelled; event roles: coordinator
  Source-reviewed command model: Patient removed from active patients list; audit event and sequence retained.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:395
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1792
  Event/dispatch reference: src/components/ward-management/ward-patient-archive-reducer.ts:10
  Subject: An erroneous standalone patient registration
  Before: Patient has only registration fields and no care records/references elsewhere
  After: Patient removed from active patients list; audit event and sequence retained
  Scope: Coordinator only, with shared record scope applied. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: patientId; reason from PATIENT_ARCHIVE_REASONS (duplicate, test, wrong_person); role and now
  guards: Patient must exist; listed archive reason
  guards: Registration facts include the optional typed details (preferred name, address, GP, catchment team, interpreter language, Indigenous status); refuse any non-registration fact or any state/audit care reference; prior archive-attempt audit entries do not block
  effects: Filters patient from patients; keeps sequence so id is not reused
  effects: Reducer audit wrapper retains the archive event/reason; no care record is removed
  effects: The step can be taken back by UNDO_PATIENT_RECORD within the Undo window.
  tests: tests/ward-patient-archive.test.ts
  Reviewed source: src/components/ward-management/ward-patient-archive-reducer.ts:10; SHA256 206b8f14ac315b38017a4fb081e294112dbf71edef38f60e93e5cc1fccec9d3b
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:395; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-patient-archive.ts:30; SHA256 dac2fb5609fdaaae98fcb3ca5e909248af9818be13a9338d00db45b2925f283a
  Reviewed source: src/components/ward-management/ward-patient-archive.ts:44; SHA256 dac2fb5609fdaaae98fcb3ca5e909248af9818be13a9338d00db45b2925f283a
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- ACCEPT_REFERRAL — diagram-reviewed; event roles: ward, coordinator, ed, community
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:425
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:859
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-answer-events.ts:697
- HOLD_REFERRAL_BED — modelled; event roles: ward, coordinator
  Source-reviewed command model: Same arm carries chosen heldBedNumber.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:426
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1904
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-answer-events.ts:664
  Subject: An accepted ward arm’s exact numbered bed hold
  Before: Current accepted, unwithdrawn ward arm without started bed journey; old numbered hold may exist
  After: Same arm carries chosen heldBedNumber
  Scope: Ward for its own beds or coordinator; shared place/record boundary also applies. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: referralId; unitId; actingUnitId; bedNumber; role and now
  guards: Known referral and currently accepted arm for unit; no linked movement or pulled/occupied/departed referral stay
  guards: Ward open; numbered bed valid, free, unheld and of required kind
  guards: Recheck current suitability using only override already recorded at acceptance
  effects: Sets/reassigns arm.heldBedNumber; retains acceptance author/time and referral state
  effects: Does not mint movement/admission or overwrite allocatable confirmation; hold is considered by bed availability checks
  tests: tests/ward-review-engine-regressions.test.ts
  tests: tests/ward-override-surfaces.test.ts
  Reviewed source: src/components/ward-management/ward-flow-referral-answer-events.ts:664; SHA256 f9ec8f13505e04398caa83f2bcacb04e4eb212fa967ea92da1132d6c46527bd2
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:426; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-flow-events.ts:1527; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- DECLINE_REFERRAL — diagram-reviewed; event roles: ward, coordinator, ed, community
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:437
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1905
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-answer-events.ts:1117
- RECORD_LOCAL_BED_SOUGHT — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:443
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1107
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1882
- RECORD_REFERRER_WITHDRAWAL — diagram-reviewed; event roles: coordinator, community, ed, ward
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:475
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:854
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1881
- ADD_REFERRAL_CORRECTION — diagram-reviewed; event roles: community, ed, ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:482
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1856
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-send-events.ts:1155
- STEP_BACK_STAGE — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:489
  Event/dispatch reference: src/components/ward-management/ward-flow-placement-events.ts:701
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1990
- WITHDRAW_ACCEPTANCE — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:490
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1906
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-answer-events.ts:1273
- WITHDRAW_WARD_REQUEST — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:493
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1855
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-send-events.ts:1100
- MARK_NOTICE_READ — diagram-reviewed; event roles: coordinator, ed, ward, officer, community, bed_manager
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:503
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2186
  Event/dispatch reference: src/components/ward-management/ward-inbox-reducer.ts:290
- ACKNOWLEDGE_INBOX_ITEM — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:524
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2187
  Event/dispatch reference: src/components/ward-management/ward-inbox-events.ts:41
  Event/dispatch reference: src/components/ward-management/ward-inbox-reducer.ts:312
- COMPLETE_INBOX_ITEM — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:525
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2188
  Event/dispatch reference: src/components/ward-management/ward-inbox-events.ts:71
  Event/dispatch reference: src/components/ward-management/ward-inbox-reducer.ts:349
- REOPEN_INBOX_ITEM — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:526
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2189
  Event/dispatch reference: src/components/ward-management/ward-inbox-events.ts:99
  Event/dispatch reference: src/components/ward-management/ward-inbox-reducer.ts:384
- TAKE_INBOX_ITEM_OWNERSHIP — modelled; event roles: coordinator
  Source-reviewed command model: Ownership history appended; current owner is acting role’s label.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:528
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2190
  Event/dispatch reference: src/components/ward-management/ward-inbox-events.ts:111
  Event/dispatch reference: src/components/ward-management/ward-inbox-reducer.ts:402
  Subject: A coordinator inbox row and its occurrence-specific history
  Before: Real current inbox row not already owned by this desk
  After: Ownership history appended; current owner is acting role’s label
  Scope: Coordinator role only; shared authenticated scope must also permit the row’s subject. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority. Scoped state projection retains this metadata for permitted meeting-action subjects by parsing the encoded subject id; metadata for other subjects stays excluded.
  payload: inboxItemId trimmed before lookup; role and now
  guards: Row must exist; same current owner for this occurrence refused
  effects: Appends {at,by} to inboxOwnership; underlying row/fact and its visibility unchanged
  tests: tests/ward-inbox-snooze.test.ts
  tests: tests/ward-consolidated-census-20261104.test.ts
  Reviewed source: src/components/ward-management/ward-inbox-reducer.ts:402; SHA256 4a7dde821d15d7032a38cb18333ed34872d78fb28e4be6efb382ad5e9095c81d
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:528; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-inbox-events.ts:111; SHA256 c3c63fd47887f9bbabdefc8aa6b6742f72848bc9f744afa55b2aa7efd80f037c
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
  Reviewed source: src/components/ward-management/ward-inbox-snooze.ts:84; SHA256 eda403a5e8fbf768036d873898501882422dad29ebc3c7362c7766a10daaf1dd
- RELEASE_INBOX_ITEM_OWNERSHIP — modelled; event roles: coordinator
  Source-reviewed command model: Ownership history appended with kind=released; ownership relinquished.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:529
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2191
  Event/dispatch reference: src/components/ward-management/ward-inbox-events.ts:121
  Event/dispatch reference: src/components/ward-management/ward-inbox-reducer.ts:422
  Subject: A coordinator inbox row and its occurrence-specific history
  Before: Ownership history’s current entry belongs to acting role, applying a current-row start when available
  After: Ownership history appended with kind=released; ownership relinquished
  Scope: Coordinator role only; shared authenticated scope must also permit the row’s subject. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority. Scoped state projection retains this metadata for permitted meeting-action subjects by parsing the encoded subject id; metadata for other subjects stays excluded.
  payload: inboxItemId trimmed before lookup; role and now
  guards: Current owner must match acting role after filtering entries older than the row’s current occurrence, if a start is available; this branch does not independently require row existence
  effects: Appends released history entry; does not delete prior ownership, resolve fact or hide row
  tests: tests/ward-inbox-snooze.test.ts
  tests: tests/ward-alerts-release-ownership.dom.test.tsx
  tests: tests/ward-consolidated-census-20261104.test.ts
  Reviewed source: src/components/ward-management/ward-inbox-reducer.ts:422; SHA256 4a7dde821d15d7032a38cb18333ed34872d78fb28e4be6efb382ad5e9095c81d
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:529; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-inbox-events.ts:121; SHA256 c3c63fd47887f9bbabdefc8aa6b6742f72848bc9f744afa55b2aa7efd80f037c
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
  Reviewed source: src/components/ward-management/ward-inbox-snooze.ts:84; SHA256 eda403a5e8fbf768036d873898501882422dad29ebc3c7362c7766a10daaf1dd
- SNOOZE_INBOX_ITEM — modelled; event roles: coordinator
  Source-reviewed command model: Latest snoozed entry hides row until chosen return time while fact remains.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:530
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2192
  Event/dispatch reference: src/components/ward-management/ward-inbox-events.ts:133
  Event/dispatch reference: src/components/ward-management/ward-inbox-reducer.ts:435
  Subject: A coordinator inbox row and its occurrence-specific history
  Before: Real current inbox row visible or previously snoozed
  After: Latest snoozed entry hides row until chosen return time while fact remains
  Scope: Coordinator role only; shared authenticated scope must also permit the row’s subject. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority. Scoped state projection retains this metadata for permitted meeting-action subjects by parsing the encoded subject id; metadata for other subjects stays excluded.
  payload: inboxItemId; reason from SNOOZE_REASON_IDS; finite until after now; role and now
  guards: Real row and listed reason
  guards: until within SNOOZE_MAX_MINUTES (currently24h); act-now row limited by RED_ROW_SNOOZE_CAP_MINUTES (currently60min)
  effects: Appends {kind:snoozed,at,by,until,reason}; no mutation of underlying patient/unit fact
  effects: Current-occurrence selectors return row when until passes or a newer occurrence starts
  tests: tests/ward-inbox-snooze.test.ts
  tests: tests/ward-consolidated-census-20261104.test.ts
  Reviewed source: src/components/ward-management/ward-inbox-reducer.ts:435; SHA256 4a7dde821d15d7032a38cb18333ed34872d78fb28e4be6efb382ad5e9095c81d
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:530; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-inbox-events.ts:133; SHA256 c3c63fd47887f9bbabdefc8aa6b6742f72848bc9f744afa55b2aa7efd80f037c
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
  Reviewed source: src/components/ward-management/ward-inbox-snooze.ts:84; SHA256 eda403a5e8fbf768036d873898501882422dad29ebc3c7362c7766a10daaf1dd
- UNSNOOZE_INBOX_ITEM — modelled; event roles: coordinator
  Source-reviewed command model: Snooze history appended with kind=returned; active snooze ends now.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:531
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2193
  Event/dispatch reference: src/components/ward-management/ward-inbox-events.ts:142
  Event/dispatch reference: src/components/ward-management/ward-inbox-reducer.ts:469
  Subject: A coordinator inbox row and its occurrence-specific history
  Before: History has an active snooze, applying a current-row start when available
  After: Snooze history appended with kind=returned; active snooze ends now
  Scope: Coordinator role only; shared authenticated scope must also permit the row’s subject. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority. Scoped state projection retains this metadata for permitted meeting-action subjects by parsing the encoded subject id; metadata for other subjects stays excluded.
  payload: inboxItemId trimmed before lookup; role and now
  guards: Active snooze must exist after occurrence filtering; expired or older-occurrence entry refused; this branch does not independently require row existence
  effects: Appends returned entry, retaining earlier history; an underlying row, if still present, returns to the active list without resolving its fact
  tests: tests/ward-inbox-snooze.test.ts
  tests: tests/ward-consolidated-census-20261104.test.ts
  Reviewed source: src/components/ward-management/ward-inbox-reducer.ts:469; SHA256 4a7dde821d15d7032a38cb18333ed34872d78fb28e4be6efb382ad5e9095c81d
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:531; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-inbox-events.ts:142; SHA256 c3c63fd47887f9bbabdefc8aa6b6742f72848bc9f744afa55b2aa7efd80f037c
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
  Reviewed source: src/components/ward-management/ward-inbox-snooze.ts:84; SHA256 eda403a5e8fbf768036d873898501882422dad29ebc3c7362c7766a10daaf1dd
- SET_ARRIVAL_DETAILS — diagram-reviewed; event roles: coordinator, ed, ward, community
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:532
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2002
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:1159
- SET_STEP_DOWN_CANDIDATE — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:533
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:701
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1783
- RECORD_WARD_DIAGNOSIS — modelled; event roles: ward, coordinator
  Reviewed command model: Latest ward diagnosis block with recording time and desk.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:535
  Event/dispatch reference: src/components/ward-management/ward-flow-diagnosis-events.ts:14
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2344
  Subject: One current admission
  Before: No ward diagnosis, or a different ward diagnosis block
  After: Latest ward diagnosis block with recording time and desk
  Scope: ward or coordinator. A ward must name the admission's own unit; authenticated scoped access must also permit the admission.
  payload: admissionId; block from TentativeDiagnosisBlock; now and role; actingUnitId when acting as ward.
  guards: Admission exists and is not departed.
  guards: Block is listed and differs from the current ward block.
  effects: Replaces admission.wardDiagnosis only; does not overwrite the referrer's tentativeDiagnosis or move a bed.
  tests: tests/ward-ward-diagnosis.test.ts
  Reviewed source: src/components/ward-management/ward-flow-diagnosis-events.ts:29; SHA256 c0c3188726823be6157098eb593cf59300372f9328512b293328cd76d8a16e4a
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:535; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- SET_DISCHARGE_BARRIER — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:536
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:724
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1784
- SET_DISCHARGE_CRITERIA — modelled; event roles: ward, coordinator
  Reviewed command model: Criteria set/reviewed, cleared, or one stored criterion ticked/unticked.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:537
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:752
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1785
  Subject: An occupied admission's criteria-led discharge record
  Before: Unset, current, paused or lapsed criteria
  After: Criteria set/reviewed, cleared, or one stored criterion ticked/unticked
  Scope: ward or coordinator, with ward actingUnitId equal to the stay's unit and authenticated admission scope.
  payload: admissionId; criteria string[] or null; met string[]; setByTreatingPsychiatrist boolean; optional patientSpecific string[] or tick {criterion,met}; actingUnitId for ward; finite now.
  guards: Admission must be occupied and time finite.
  guards: For setting or ticking criteria, only recorded voluntary patients are eligible; involuntary, CTO and unknown legal status refuse. criteria:null clears before this eligibility check.
  guards: Setting/changing the list needs the treating-psychiatrist flag; an ordinary tick keeps the stored list and refuses a lapsed review. Clearing with criteria:null does not require that flag.
  guards: Listed criteria must be unique and valid; patient-specific items obey count/length/trim bounds; ticks must name stored criteria.
  effects: Writes admission.dischargeCriteria; review resets its validity time and review-bound/lapsed ticks, while retained applicable ticks persist.
  effects: No departure, bed release or clinical eligibility decision is performed; typed patient-specific payloads follow the typed-text persistence boundary.
  tests: tests/ward-criteria-led-discharge.test.ts
  Reviewed source: src/components/ward-management/ward-flow-bed-events.ts:752; SHA256 a63ee87e0e4c23df938c2732ded19ca0e95f859bf586980d00fa0fdb648694f3
  Reviewed source: src/components/ward-management/ward-discharge-criteria.ts:271; SHA256 70e720fb09a6a8bd9ab6952b29e786e949b7c635b3eded6a97c9be8582648c5b
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2089; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- RECORD_ED_MEDICAL_DETERIORATION — modelled; event roles: ed, coordinator
  Reviewed command model: placement_requested, medically uncleared and explicitly paused; acceptance and reservation removed.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:538
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1217
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1885
  Subject: An accepted originating-ED movement before collection
  Before: Accepted/pulled pre-transfer placement with optional live transport
  After: placement_requested, medically uncleared and explicitly paused; acceptance and reservation removed
  Scope: ed or coordinator; actingPlaceId must equal movement.originEdId even for coordinator. A source-admission transfer cannot use this path; authenticated movement/place scope also applies.
  payload: movementId; actingPlaceId naming the originating ED; finite now not before movement.openedAt; role.
  guards: Movement exists, has an accepted psychiatric destination and is not closed, moving or already collected.
  guards: An unrecovered deterioration already recorded refuses; any held admission must be a consistent pulled reservation.
  effects: Releases pulled bed/admission and matching referral bed hold; clears acceptance, pull timer, admission linkage and ward request lists.
  effects: Cancels live transport, records withdrawal/release/cancellation unwind history, false medical clearance and deterioration stamp.
  effects: Copies negative clearance to the identity-matching referral and appends an acceptance-withdrawn notice to the former ward. A later re-clearance does not reallocate a bed.
  tests: tests/ward-medical-deterioration-ui.dom.test.tsx
  tests: tests/ward-reservation-release-capacity.test.ts
  Reviewed source: src/components/ward-management/ward-flow-record-events.ts:1217; SHA256 a29e705c2433c4c003f57fa88308339aeeeee7376952a5c82b7e6723f64856c5
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2112; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- RECORD_MOVEMENT_MEDICAL_CLEARANCE — diagram-reviewed; event roles: ed, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:539
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1323
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1886
- UPLOAD_PATIENT_FORM — diagram-reviewed; event roles: coordinator, ed, ward, community, officer
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:540
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:770
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1786
- RECORD_LEGAL_FORM_WRITTEN — diagram-reviewed; event roles: ed, coordinator, ward
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:542
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1409
  Event/dispatch reference: src/components/ward-management/ward-flow-record-legal-events.ts:274
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1887
- RECORD_LEGAL_FORM_CODE — modelled; event roles: ed, coordinator, ward
  Reviewed command model: Chosen form code without an invented written time.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:544
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1410
  Event/dispatch reference: src/components/ward-management/ward-flow-record-legal-events.ts:273
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1888
  Subject: A movement's current legal-form record
  Before: Current form, or no form recorded
  After: Chosen form code without an invented written time
  Scope: ed, coordinator or ward. Ward requires an admitted stay in its own scoped unit; ED cannot amend a closed movement. An admitted ward/coordinator may record a later form despite arrival closure.
  payload: movementId; recognised formCode; now; role. No writtenAt, region, ageBand or paperExpiresAt is carried by this command.
  guards: Movement exists; ward has an admitted stay.
  guards: Form code is recognised, differs from the current code, and is not 3C after 3D.
  guards: A closed record refuses except admitted non-ED recording.
  effects: Replaces legalForm code/kind with its retained form history, removes formedAt, prior paper expiry/receipt for a different form and legacy legalClock.
  effects: Does not calculate legal expiry or default the written time. Undo is part of UNDO_LEGAL_FORM_RECORD.
  effects: A new form code also clears the typed receipt mark and any paper details typed for the old form.
  tests: tests/ward-ed-handover-events.test.ts
  Reviewed source: src/components/ward-management/ward-flow-record-legal-events.ts:273; SHA256 1ea8f3c4f644456cfff2f29b16085917696fb2b118a50d08a9acdf056a18e04e
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2144; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-access-state.ts:817; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- RECORD_ED_PRESENTATION — modelled; event roles: ed, coordinator
  Reviewed command model: Canonical fixed-list choices, or field removed for an empty selection.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:546
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1411
  Event/dispatch reference: src/components/ward-management/ward-flow-record-legal-events.ts:204
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1889
  Subject: An open movement's ED presentation choices
  Before: Recorded ED presentation list or none
  After: Canonical fixed-list choices, or field removed for an empty selection
  Scope: ed or coordinator, additionally subject to authenticated movement/place scope.
  payload: movementId; presentations array of EdPresentation choices; now; role.
  guards: Movement exists and has no closure.
  guards: presentations must be an array and every item must be in the fixed ED list.
  effects: Filters choices into canonical list order, deduplicating them; empty choice removes edPresentations.
  effects: Does not change movement stage, diagnosis, legal status or capacity. Included in ED-step Undo.
  tests: tests/ward-ed-handover-events.test.ts
  Reviewed source: src/components/ward-management/ward-flow-record-legal-events.ts:204; SHA256 1ea8f3c4f644456cfff2f29b16085917696fb2b118a50d08a9acdf056a18e04e
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2152; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-undo.ts:92; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- RECORD_LEGAL_FORM_DETAILS — modelled; event roles: ed, coordinator, ward
  Reviewed command model: records the written legal form's typed details on the movement's current form.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:548
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1412
  Event/dispatch reference: src/components/ward-management/ward-flow-record-legal-events.ts:221
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1890
  Subject: The current legal form on one movement
  Before: Form recorded, details as last typed
  After: Form carries the typed maker, copy given, ending, consent and review-by values
  Scope: ed, coordinator or ward in the role table; a ward only for a person admitted to its own bed.
  payload: movementId; formCode; optional madeBy, copyGiven, endedBy, consent, reviewBy (omitted keeps, null clears); now; role.
  guards: The movement exists; a closed movement only when admitted and not ED.
  guards: formCode matches the movement's current form.
  guards: Each detail is from its list; reviewBy is a finite time; consent only for a Form 6B.
  effects: Replaces the form's details with the merged values; other form fields are unchanged.
  tests: tests/ward-legal-form-gap-items.test.ts
  Reviewed source: src/components/ward-management/ward-flow-record-events.ts:94; SHA256 a29e705c2433c4c003f57fa88308339aeeeee7376952a5c82b7e6723f64856c5
  Reviewed source: src/components/ward-management/ward-flow-record-legal-events.ts:221; SHA256 1ea8f3c4f644456cfff2f29b16085917696fb2b118a50d08a9acdf056a18e04e
- RECORD_COUNTRY_EXTENSION — diagram-reviewed; event roles: ed, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:549
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1413
  Event/dispatch reference: src/components/ward-management/ward-flow-record-legal-events.ts:378
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1891
- RECORD_LEGAL_FORM_CONTINUATION — diagram-reviewed; event roles: ed, coordinator, ward, community
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:550
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1414
  Event/dispatch reference: src/components/ward-management/ward-flow-record-legal-events.ts:411
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1892
- EVALUATE_ARRIVAL_LATENESS — diagram-reviewed; event roles: coordinator, ed, ward
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:551
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2003
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:1244
- RELEASE_AND_REOPEN_SEARCH — diagram-reviewed; event roles: coordinator, ward
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:552
  Event/dispatch reference: src/components/ward-management/ward-flow-placement-events.ts:763
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1991
- CLEAR_EXPECT_FLAG — diagram-reviewed; event roles: ward, coordinator, ed, community
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:553
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2199
- RAISE_EXPECT_FLAG — diagram-reviewed; event roles: ward, coordinator, ed, community
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:554
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2213
- FLAG_LEGAL_MISMATCH — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:555
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2235
- EVALUATE_LEAVE_BED_WARNINGS — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:556
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:814
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1787
- CONFIRM_MORNING_ROLLUP — diagram-reviewed; event roles: ward, bed_manager, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:557
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2258
- SEND_WARD_BUZZ — diagram-reviewed; event roles: coordinator, bed_manager
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:558
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2289
- RECORD_REPATRIATION — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:560
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1400
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:478
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1894
- RECORD_HOME_SERVICE_RETURN — modelled; event roles: coordinator
  Reviewed command model: Fresh requested record, or request with agreed/not_yet_agreed/declined answer.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:562
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2347
  Subject: One current stay's home-service return discussion
  Before: No request, a request without agreement, or an earlier recorded answer
  After: Fresh requested record, or request with agreed/not_yet_agreed/declined answer
  Scope: coordinator only; authenticated scope must permit the admission. A valid home site need not itself be the current admission site.
  payload: admissionId; step requested|answered; homeHospital required for request; answer required for answered; optional prerequisites from RETURN_PREREQUISITES and finite nextReviewAt; now; role.
  guards: Admission exists and is not departed; optional review date finite.
  guards: Request names a site in the current scenario. Answer requires an existing request and a listed answer.
  guards: Prerequisites are listed; a declined answer cannot carry agreed prerequisites.
  effects: Latest record per stay; fresh request clears earlier answer/prerequisites. Answer retains request and appends answer time/desk, with prerequisites unique in listed order.
  effects: Records a discussion only: does not book transport or a bed, raise a return movement or change the stay.
  tests: tests/ward-home-service-return.test.ts
  Reviewed source: src/components/ward-management/out-of-area/home-service-return.ts:122; SHA256 2f3fbdc6ba3e36b6eb890a51a7707e8b26f71eba4a803181220c17c63d1249d7
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:2347; SHA256 8e056e60e9ae556496e92a26fc4f9d9dd32e68d3f1fc16358889fe6442e826c8
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:562; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- FLAG_RETURN_EARLY — modelled; event roles: coordinator
  Reviewed command model: the coordinator flags an out-of-area stay as ready to return early to a home hospital.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:564
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2352
  Subject: One current out-of-area stay
  Before: No early-return flag on the stay
  After: An early-return flag naming the home hospital, time and role
  Scope: coordinator in the role table.
  payload: admissionId; homeHospital (listed site code); now; role.
  guards: The stay exists and has not departed.
  guards: homeHospital is a listed site.
  guards: The stay is not already flagged.
  effects: Appends a returnEarlyFlags record; the home ward site, community and officer desks see an alert while the stay is current.
  tests: tests/ward-return-early.test.ts
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:405; SHA256 8e056e60e9ae556496e92a26fc4f9d9dd32e68d3f1fc16358889fe6442e826c8
  Reviewed source: src/components/ward-management/out-of-area/return-early.ts:70; SHA256 28c9ec25e8d1fc5808db7af91d11f76ce64b235c292fdddfa60d1423ac2eedb3
- RECORD_DIRECTORY_CHECK — modelled; event roles: coordinator, bed_manager, ward, ed, community, officer
  Reviewed command model: Latest {entryId, at, by} check for that identifier.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:566
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2349
  Subject: An on-call directory entry identifier
  Before: Seeded check metadata or a previously recorded check
  After: Latest {entryId, at, by} check for that identifier
  Scope: coordinator, bed_manager, ward, ed, community or officer. This reducer validates identifier shape, not membership in the seeded directory; authenticated access remains separate.
  payload: entryId matching the 1–80 character slug pattern; now; role.
  guards: entryId must be a string matching the directory-entry slug grammar.
  effects: Replaces the latest check for the same identifier while retaining checks for other identifiers; audit records successive checks.
  effects: Does not change the directory's phone/contact data or verify it against an external service.
  tests: tests/ward-on-call-checks.test.ts
  Reviewed source: src/components/ward-management/on-call/on-call-checks.ts:40; SHA256 4c75385ac14339cbc7d98efc18af52257bb6ae185011b80e244fcf21f6d68e9d
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:566; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:2349; SHA256 8e056e60e9ae556496e92a26fc4f9d9dd32e68d3f1fc16358889fe6442e826c8
- RECORD_HANDOVER_SIGN_OFF — diagram-reviewed; event roles: coordinator, ward
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:569
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1399
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:457
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1893
- RECORD_SITE_HANDOVER_SIGN_OFF — modelled; event roles: bed_manager, coordinator
  Reviewed command model: Site sign-off with a snapshot of unsigned wards and unanswered bed calls.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:573
  Event/dispatch reference: src/components/ward-management/site-sign-off/site-handover-sign-off-reducer.ts:28
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2355
  Subject: One site and upcoming shift handover
  Before: No sign-off for this site/shift
  After: Site sign-off with a snapshot of unsigned wards and unanswered bed calls
  Scope: bed_manager for its own site or whole-network coordinator. A service coordinator is refused by authenticated command scope; signing does not sign any ward's sheet.
  payload: siteCode; integer finite shiftAt at a configured shift start; now; role.
  guards: Site has at least one ward.
  guards: shiftAt is the next handover in the one-shift sign-off window.
  guards: Site/shift has not already been signed. Open checks do not block signing.
  effects: Appends siteHandoverSignOffs with at/by/siteCode/shiftAt and reducer-derived unsignedUnitIds/unansweredBedCallIds.
  effects: Leaves ward sign-offs and bed calls open and unchanged. Creates the site-specific step Undo.
  tests: tests/ward-site-handover-sign-off.test.ts
  tests: tests/ward-handover-site-sign-off.dom.test.tsx
  Reviewed source: src/components/ward-management/site-sign-off/site-handover-sign-off-reducer.ts:26; SHA256 dc671972ed160a7492f79cde72ca6dab6dad70b59921bd378ecee4721b326db5
  Reviewed source: src/components/ward-management/site-sign-off/site-handover-sign-off.ts:80; SHA256 abebadfb3e48655f6e362172ed644ae06615e26916f33334ce17419955567a33
  Reviewed source: src/components/ward-management/ward-access-state.ts:683; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:573; SHA256 3eb41a56cb181aefe22ddccbbc6a1c684a25cad9aace23506f1288dcd7a833cc
- RECORD_CLINICAL_CONTACT — diagram-reviewed; event roles: community, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:577
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1401
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:654
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1895
- DISPATCH_BROADCAST_ALERT — diagram-reviewed; event roles: coordinator, bed_manager
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:581
  Event/dispatch reference: src/components/ward-management/alerts/ward-broadcast-reducer.ts:69
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2314
- ACKNOWLEDGE_BROADCAST_ALERT — diagram-reviewed; event roles: coordinator, ward, ed, officer, community, bed_manager
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:582
  Event/dispatch reference: src/components/ward-management/alerts/ward-broadcast-reducer.ts:151
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2315
- STAND_DOWN_BROADCAST_ALERT — diagram-reviewed; event roles: coordinator, bed_manager
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:583
  Event/dispatch reference: src/components/ward-management/alerts/ward-broadcast-reducer.ts:198
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2316
- EXTEND_BROADCAST_ALERT — modelled; event roles: coordinator, bed_manager
  Reviewed command model: Same active alert with expiry and duration each extended by the fixed default.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:584
  Event/dispatch reference: src/components/ward-management/alerts/ward-broadcast-reducer.ts:228
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2317
  Subject: An active broadcast alert
  Before: Active alert with current expiry/duration
  After: Same active alert with expiry and duration each extended by the fixed default
  Scope: coordinator or bed_manager. A scoped actor must control every recipient of the existing alert, not merely see one recipient.
  payload: alertId; now; role. Added duration is DEFAULT_BROADCAST_EXTENSION_MINUTES, not client text or a client-selected number.
  guards: Alert exists and is active at now; stood-down or expired alerts cannot be revived by extension.
  effects: Adds 30 minutes (current default) to stored durationMinutes and to existing expiresAt; preserves recipients, replies and acknowledgements.
  tests: tests/ward-top25-broadcast-extend.dom.test.tsx
  Reviewed source: src/components/ward-management/alerts/ward-broadcast-reducer.ts:228; SHA256 cd46a2fc3599a4dbc092b05eda177f7da454de1cd8642597fa17bf3281a11907
  Reviewed source: src/components/ward-management/alerts/ward-broadcast-reducer.ts:461; SHA256 cd46a2fc3599a4dbc092b05eda177f7da454de1cd8642597fa17bf3281a11907
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2368; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:704; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- ADD_BROADCAST_ALERT_UNITS — modelled; event roles: coordinator, bed_manager
  Reviewed command model: Existing recipients plus new unique named desks.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:585
  Event/dispatch reference: src/components/ward-management/alerts/ward-broadcast-reducer.ts:243
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2318
  Subject: An active directive or bed call's recipients
  Before: Existing recipient scope/list
  After: Existing recipients plus new unique named desks
  Scope: coordinator or bed_manager. Authenticated scope must cover the existing alert's full recipient set and every newly added desk.
  payload: alertId; non-empty unitIds array naming real desks; now; role.
  guards: Alert exists and is active; Pull now cannot add recipients.
  guards: Bed calls accept real wards only; directives may also name real ED desks.
  guards: At least one named desk has not already been asked.
  effects: Resolves previous scope into an explicit targetUnitIds list, appends only new ids and recomputes targetScopeLabel.
  effects: Does not reset expiry or clear previous replies/acknowledgements.
  tests: tests/ward-broadcast-add-units.test.ts
  Reviewed source: src/components/ward-management/alerts/ward-broadcast-reducer.ts:243; SHA256 cd46a2fc3599a4dbc092b05eda177f7da454de1cd8642597fa17bf3281a11907
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2378; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:704; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- RAISE_PULL_NOW — modelled; event roles: coordinator
  Reviewed command model: Same movement plus active Pull now addressed to the relevant wards.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:589
  Event/dispatch reference: src/components/ward-management/alerts/ward-broadcast-reducer.ts:293
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2319
  Subject: A waiting movement and a new patient-specific broadcast
  Before: Waiting open movement with wards considering/accepting it, no live Pull now
  After: Same movement plus active Pull now addressed to the relevant wards
  Scope: coordinator only; authenticated scope must permit the movement and every ward selected by pullNowWards.
  payload: movementId; now; role. Recipients, text, severity, deadlines and id are generated from state/constants.
  guards: Movement exists, is open and in PULL_NOW_LIVE_STAGES.
  guards: No currently live still-applicable Pull now exists for this movement.
  guards: At least one real relevant ward can be asked.
  effects: Prepends an active critical pull_now alert, increments broadcastSequence and records answerBy/expiry and movement stage-change count at dispatch.
  effects: Recipients are accepting ward, else real referred wards. Does not itself pull a bed, move the patient or change movement stage.
  tests: tests/ward-global-alerts.test.ts
  Reviewed source: src/components/ward-management/alerts/ward-broadcast-reducer.ts:293; SHA256 cd46a2fc3599a4dbc092b05eda177f7da454de1cd8642597fa17bf3281a11907
  Reviewed source: src/components/ward-management/alerts/ward-broadcast-model.ts:317; SHA256 e1a3636630af9d8a68e9e0b166d4d1985ba755f0553a0a955857ce1b03970e91
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2389; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:725; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- REPLY_BROADCAST_ALERT — modelled; event roles: ward, bed_manager, coordinator
  Reviewed command model: Reply appended; desk also acknowledged.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:591
  Event/dispatch reference: src/components/ward-management/alerts/ward-broadcast-reducer.ts:348
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2320
  Subject: One desk's answer to a bed call or Pull now
  Before: Active applicable alert with no answer or a different latest answer for this desk
  After: Reply appended; desk also acknowledged
  Scope: ward, bed_manager or coordinator, with authenticated place/record scope. A bed call accepts wards only; Pull now accepts only its target wards.
  payload: alertId; real unitId; answer from this alert kind's fixed list; optional beds, readyAt or reason as required by answer; now; role.
  guards: Alert exists and is active; Pull now's movement must still be waiting; directives use acknowledgement instead.
  guards: Unit is real and included when recipients are explicit; answer belongs to kind-specific list.
  guards: can_take needs whole beds in 1..BED_CALL_MAX_BEDS; after_discharge/bed_ready_at needs finite future readyAt within the configured horizon; Pull now cannot needs a listed decline reason.
  guards: An identical latest answer is refused.
  effects: Appends reply {unitId,answer,at,role,...conditional detail}; adds desk to acknowledgedUnits once.
  effects: Answers are reported capacity statements, not bed allocation or automatic movement transitions.
  tests: tests/ward-global-alerts.test.ts
  tests: tests/ward-broadcast-audience-bed-call-wards.test.ts
  Reviewed source: src/components/ward-management/alerts/ward-broadcast-reducer.ts:348; SHA256 cd46a2fc3599a4dbc092b05eda177f7da454de1cd8642597fa17bf3281a11907
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2399; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- BOOK_PLANNED_ADMISSION — modelled; event roles: coordinator, bed_manager, ward
  Reviewed command model: New PA-* record in booked state, holding no bed.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:594
  Event/dispatch reference: src/components/ward-management/capacity/planned-admissions-reducer.ts:73
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2326
  Subject: A future planned admission
  Before: No booking for this linked patient, or an initials-only booking to create
  After: New PA-* record in booked state, holding no bed
  Scope: coordinator, bed_manager or ward; ward may book its own ward only. Authenticated place/record scope additionally applies.
  payload: Exactly one of patientId or initials; sex; ageBand; reason; unitId; expectedArrivalAt; expectedStayDays; legalStatus; now/role. Optional gender, overrideReason, actingUnitId. Linked patient requires calendarDate for age validation.
  guards: Finite now and arrival, listed reason/legal status/gender and bounded whole expectedStayDays; destination unit exists.
  guards: Arrival must fall within the configured booking window; a newly chosen arrival cannot be in the past.
  guards: Ward caller must name its actingUnitId and all affected wards must be that unit.
  guards: Admission authorisation gate needs a listed override reason when applicable; other placement gates are rechecked on conversion.
  guards: Ward must be open to new admissions. Sex and ageBand are listed.
  guards: Linked patient exists, has no occupied/pulled bed or existing booked planned admission; recorded birth date matches cohort on arrival date. Initials-only requires 1–3 letters.
  effects: Appends a booked plan and increments plannedAdmissionSequence; linked gender comes from patient record, never event.
  effects: Stores a required same-ward authorisation override. No bed count or admission changes until conversion; initials invoke the typed-text persistence boundary.
  tests: tests/ward-planned-admissions.test.ts
  tests: tests/ward-audit24-1-planned-booking-authorised.test.ts
  Reviewed source: src/components/ward-management/capacity/planned-admissions-reducer.ts:299; SHA256 61ad20c2605a7461ce59b5fd80350ebbc3555aefe361eaa620eaa8904d713893
  Reviewed source: src/components/ward-management/capacity/planned-admissions-reducer.ts:263; SHA256 61ad20c2605a7461ce59b5fd80350ebbc3555aefe361eaa620eaa8904d713893
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2415; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- CHANGE_PLANNED_ADMISSION — modelled; event roles: coordinator, bed_manager, ward
  Reviewed command model: Still booked, with revised fields, changedAt and incremented changeCount.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:595
  Event/dispatch reference: src/components/ward-management/capacity/planned-admissions-reducer.ts:383
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2331
  Subject: An existing booked planned admission
  Before: booked plan with current ward/date/stay/reason/legal status/gender
  After: Still booked, with revised fields, changedAt and incremented changeCount
  Scope: coordinator, bed_manager or ward; a ward may change neither from nor to another ward. Authenticated record and destination scope also applies.
  payload: plannedAdmissionId; replacement reason/unitId/expectedArrivalAt/expectedStayDays/legalStatus; now/role. Optional gender, overrideReason, actingUnitId; calendarDate when a linked arrival changes calendar day.
  guards: Finite now and arrival, listed reason/legal status/gender and bounded whole expectedStayDays; destination unit exists.
  guards: Arrival must fall within the configured booking window; a newly chosen arrival cannot be in the past.
  guards: Ward caller must name its actingUnitId and all affected wards must be that unit.
  guards: Admission authorisation gate needs a listed override reason when applicable; other placement gates are rechecked on conversion.
  guards: Plan exists and remains booked.
  guards: Changing to a different closed ward refuses; an existing booking at a newly closed ward may remain there.
  guards: An overdue booking may retain its old arrival time while other fields change; moving a linked arrival date must still match its recorded cohort.
  guards: Authorisation override may persist for the same standing ward/gate; moving away drops an irrelevant override.
  effects: Replaces planning fields, records changedAt/count and record-derived linked gender. No bed is held or released.
  tests: tests/ward-planned-admissions.test.ts
  tests: tests/ward-audit24-1-planned-booking-authorised.test.ts
  Reviewed source: src/components/ward-management/capacity/planned-admissions-reducer.ts:383; SHA256 61ad20c2605a7461ce59b5fd80350ebbc3555aefe361eaa620eaa8904d713893
  Reviewed source: src/components/ward-management/capacity/planned-admissions-reducer.ts:263; SHA256 61ad20c2605a7461ce59b5fd80350ebbc3555aefe361eaa620eaa8904d713893
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2450; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- CANCEL_PLANNED_ADMISSION — modelled; event roles: coordinator, bed_manager, ward
  Reviewed command model: cancelled with cancel reason and time.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:596
  Event/dispatch reference: src/components/ward-management/capacity/planned-admissions-reducer.ts:459
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2336
  Subject: One booked planned admission
  Before: booked
  After: cancelled with cancel reason and time
  Scope: coordinator, bed_manager or ward, with own-ward identity for ward and authenticated booking scope.
  payload: plannedAdmissionId; unitId equal to booking's ward; listed cancellation reason; finite now; role; actingUnitId when ward.
  guards: Booking exists and state is booked.
  guards: Reason is listed; unitId matches booking; ward scope matches; now finite.
  effects: Retains the booking record, changing state/cancelledAt/cancelReason.
  effects: No capacity refund occurs because booking held no bed. Cancelled plans no longer count as pending arrivals.
  effects: The step can be taken back by UNDO_RELEASE_STEP within the Undo window, filed against the booking.
  tests: tests/ward-planned-admissions.test.ts
  Reviewed source: src/components/ward-management/capacity/planned-admissions-reducer.ts:459; SHA256 61ad20c2605a7461ce59b5fd80350ebbc3555aefe361eaa620eaa8904d713893
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2472; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- CONVERT_PLANNED_ADMISSION — modelled; event roles: ward, coordinator
  Reviewed command model: Plan arrived and linked to a new occupied admission.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:597
  Event/dispatch reference: src/components/ward-management/capacity/planned-admissions-reducer.ts:483
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:729
  Subject: A booked plan and its receiving ward
  Before: booked plan, no current linked bed/journey, ready eligible capacity
  After: Plan arrived and linked to a new occupied admission
  Scope: ward or coordinator only; ward must name its own booked ward. Authenticated booking/ward scope additionally applies.
  payload: plannedAdmissionId; unitId equal to booking's ward; finite now; role; actingUnitId for ward.
  guards: Plan exists and is booked; unit matches and is open. Linked patient has neither another held/occupied bed nor an open movement.
  guards: A Ready bed exists (pulledBedAvailability, counting live pulled admissions) and, when beds are pending preparation, more Ready beds than pending ones. Secure request requires a free locked bed. Other journeys' pending numbered reservations at the ward come off Ready and off the free locked and open counts first.
  guards: Current placement eligibility gates pass; only a recorded same-ward authorisation override waives that specific gate.
  guards: A gender-placement review requirement refuses this shortcut; use referral journey instead.
  effects: Creates an occupied AD-ARR-* admission with recorded patient/sex/gender/planned legal status, without a movement/referral; increments admissionSequence.
  effects: Decrements ward empty and allocatable counts by one, locked count when used, and increments sex mix.
  effects: Marks plan arrived with convertedAt/admissionId; does not create a numbered bed assignment or admit merely because its date passed.
  tests: tests/ward-planned-admissions.test.ts
  tests: tests/ward-planned-arrival-closed-bed.test.ts
  Reviewed source: src/components/ward-management/capacity/planned-admissions-reducer.ts:483; SHA256 61ad20c2605a7461ce59b5fd80350ebbc3555aefe361eaa620eaa8904d713893
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2486; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- RECORD_SUPPORT_NOTIFICATION — modelled; event roles: ward, coordinator
  Reviewed command model: Another told/not_applicable record appended.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:600
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1402
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:666
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1896
  Subject: One completed involuntary arrival/transfer or discharge, and one support party
  Before: No or earlier checklist Tell record
  After: Another told/not_applicable record appended
  Scope: ward or coordinator. Authenticated arriving movement must belong to its accepted ward scope; admission references and acting place are separately scoped.
  payload: occasion admission|transfer|discharge; party from checklist; outcome told|not_applicable; now/role. Arrival/transfer names movementId only; discharge admissionId only. told needs nonblank bounded who and optional contactedAt<=now; not_applicable needs nonblank bounded reason and forbids who/contactedAt.
  guards: now finite; occasion/party/outcome listed.
  guards: Named subject exists and meets completed involuntary arrival/transfer/discharge eligibility; arrival occasion matches recorded source.
  guards: Conditional text fields obey exclusive shape and length/time rules.
  effects: Appends uniquely numbered SN-* record with subject/occasion/party/desk/time and outcome detail; creates step Undo.
  effects: Advisory recording only: neither calculates legal duties/deadlines nor blocks or advances the journey. Typed who/reason invokes typed-text persistence boundary.
  tests: tests/ward-support-notifications.test.ts
  tests: tests/ward-discharge-support-notification.test.ts
  Reviewed source: src/components/ward-management/ward-flow-record-stay-events.ts:666; SHA256 c5f1bf077a95e7863b2df7291cd9617f4181194752d1e9d5938df369de6bdce5
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2503; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:866; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- SEND_RELEASE_SUPPORT_NOTICE — modelled; event roles: ward, coordinator
  Reviewed command model: confirmed release with service marked Sent.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:601
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1954
  Event/dispatch reference: src/components/ward-management/ward-flow-release-notice-events.ts:29
  Subject: One confirmed bed release and a support service
  Before: confirmed release with no Sent record for chosen service
  After: confirmed release with service marked Sent
  Scope: ward or coordinator; actingUnitId must equal the release's ward even for coordinator, and authenticated scope also applies.
  payload: releaseId; service from SUPPORT_SERVICE_TYPES; actingUnitId required and equal to release.unitId; now; role.
  guards: Release exists and remains confirmed.
  guards: Service is listed and has not already been notified.
  guards: Acting unit is the release's own unit.
  effects: Appends {service,at,by} to supportNoticesSent.
  effects: This prototype writes the record; no external pharmacy, transport or cleaning integration is invoked by this handler. No bed/stage change.
  tests: tests/ward-release-notices.test.ts
  Reviewed source: src/components/ward-management/ward-flow-release-notice-events.ts:52; SHA256 057ef764a841f671c0fac813c4f9485a121ca811c1228b7fec3b7abdbd94d5fd
  Reviewed source: src/components/ward-management/ward-flow-release-notice-events.ts:28; SHA256 057ef764a841f671c0fac813c4f9485a121ca811c1228b7fec3b7abdbd94d5fd
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- RECORD_DISCHARGE_DEPENDENCY — modelled; event roles: ward, coordinator
  Reviewed command model: Latest outstanding/done/not_needed state and owner recorded.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:603
  Event/dispatch reference: src/components/ward-management/discharges/discharge-dependency-events.ts:34
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1957
  Subject: One non-discharged bed release and one logistics kind
  Before: Missing or existing dependency for this kind
  After: Latest outstanding/done/not_needed state and owner recorded
  Scope: ward or coordinator, requiring release's own actingUnitId and authenticated release scope.
  payload: releaseId; actingUnitId equal to release ward; kind/owner/state from closed lists; now; role.
  guards: Release exists and is not discharged.
  guards: Kind, owner and state are listed.
  guards: Repeating the same already-outstanding owner/state refuses; done/not_needed can be reconfirmed.
  effects: Adds or replaces the dependency by kind, recording time and desk label.
  effects: Does not alter release stage, blocker, bed counts, or call an external service.
  tests: tests/ward-discharge-dependencies.test.ts
  Reviewed source: src/components/ward-management/discharges/discharge-dependency-events.ts:60; SHA256 dc256c1d387ba227491f407b6f56c3692ba3478fd4bd96dc95a5bb5b45e7e9dd
  Reviewed source: src/components/ward-management/discharges/discharge-dependency-events.ts:78; SHA256 dc256c1d387ba227491f407b6f56c3692ba3478fd4bd96dc95a5bb5b45e7e9dd
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- RECORD_DISCHARGE_PLAN_CHANGE — modelled; event roles: ward, coordinator
  Reviewed command model: One changed fact, with recorded change history where applicable.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:604
  Event/dispatch reference: src/components/ward-management/discharges/discharge-dependency-events.ts:49
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1958
  Subject: One non-discharged bed release's logistics plan
  Before: Current expected time or planned destination
  After: One changed fact, with recorded change history where applicable
  Scope: ward or coordinator, requiring release's own actingUnitId and authenticated release scope.
  payload: releaseId; actingUnitId equal to release ward; exactly one of finite expectedAt or listed leavingDestination; now; role.
  guards: Release exists and is not discharged.
  guards: Exactly one fact is carried and it differs from the current recorded fact.
  guards: Date is finite; destination is in LEAVING_DESTINATIONS.
  effects: Date branch updates BedRelease.expectedAt and appends planChanges; destination branch writes plannedDestination and appends a change only if a prior destination existed.
  effects: Done dependencies relying on a changed fact can be shown as needing recheck by selectors. Handler does not itself cancel logistics, change release stage or bed counts.
  effects: A date change on a release linked to a stay that has not departed also updates that stay's expected discharge date, date-move count and set-by (updateExpectedDischargeDate), and the stay's other pending releases.
  tests: tests/ward-discharge-dependencies.test.ts
  Reviewed source: src/components/ward-management/discharges/discharge-dependency-events.ts:101; SHA256 dc256c1d387ba227491f407b6f56c3692ba3478fd4bd96dc95a5bb5b45e7e9dd
  Reviewed source: src/components/ward-management/discharges/discharge-dependency-events.ts:49; SHA256 dc256c1d387ba227491f407b6f56c3692ba3478fd4bd96dc95a5bb5b45e7e9dd
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- RECORD_ARRIVAL_CHECK — modelled; event roles: ed, coordinator
  Reviewed command model: Chosen flag set to the opposite recorded boolean.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:605
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1960
  Event/dispatch reference: src/components/ward-management/ward-flow-release-notice-events.ts:44
  Subject: An open movement's pre-transfer checklist flag
  Before: Contraband-search or medication-chart flag false/unrecorded or true
  After: Chosen flag set to the opposite recorded boolean
  Scope: ed or coordinator; authenticated movement/place scope additionally applies.
  payload: movementId; check from ARRIVAL_CHECKS; done boolean; now; role.
  guards: Movement exists and has no closure.
  guards: Check is listed and done is boolean.
  guards: Unrecorded counts as false; trying to record the same effective value refuses.
  effects: Writes contrabandSearchDone or medicationChartDone only. false takes a mistaken tick back.
  effects: Does not itself certify a clinical assessment, create a notice or advance stage.
  tests: tests/ward-release-notices.test.ts
  tests: tests/ward-top25-admission-checklist.dom.test.tsx
  Reviewed source: src/components/ward-management/ward-flow-release-notice-events.ts:91; SHA256 057ef764a841f671c0fac813c4f9485a121ca811c1228b7fec3b7abdbd94d5fd
  Reviewed source: src/components/ward-management/ward-flow-release-notice-events.ts:43; SHA256 057ef764a841f671c0fac813c4f9485a121ca811c1228b7fec3b7abdbd94d5fd
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- UNDO_REFERRAL_DECISION — modelled; event roles: ward, coordinator, ed, community
  Reviewed command model: Referral restored to its pre-decision snapshot.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:609
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1751
  Event/dispatch reference: src/components/ward-management/ward-flow-undo-events.ts:98
  Subject: The latest accepted/declined decision snapshot on a referral
  Before: Referral exactly as the latest undoable decision left it
  After: Referral restored to its pre-decision snapshot
  Scope: ward, coordinator, ed or community in role table, then original acting role (and ward) or coordinator; authenticated reference scope applies.
  payload: referralId; now; role; optional recordSeq to bind the exact decision; actingUnitId when ward.
  guards: Referral and its decision Undo record exist; supplied recordSeq matches newest record.
  guards: now is not before the decision and is within UNDO_WINDOW_MINUTES (currently five).
  guards: Current referral deeply equals saved after snapshot; original-role/ward check passes.
  guards: An undone ACCEPT_REFERRAL refuses while a movement for the referral is not closed as did_not_proceed, or a stay from it holds a bed.
  effects: Restores full referral before snapshot, removes only notices created by that decision id/time, and consumes the Undo record.
  effects: Does not remove the audit evidence of the decision or Undo; a later reassessment can make this Undo inapplicable.
  tests: tests/ward-undo-and-bed-board.test.ts
  tests: tests/ward-undo-toast-record-seq.dom.test.tsx
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:98; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:1456; SHA256 8e056e60e9ae556496e92a26fc4f9d9dd32e68d3f1fc16358889fe6442e826c8
  Reviewed source: src/components/ward-management/ward-undo.ts:482; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- UNDO_AUDIT_REVIEW — modelled; event roles: coordinator
  Reviewed command model: That review removed while audit history remains.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:611
  Event/dispatch reference: src/components/ward-management/ward-flow-protected-record-events.ts:103
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1559
  Subject: One captured-event review in the current world generation
  Before: Latest review on its captured event
  After: That review removed while audit history remains
  Scope: coordinator only, with authenticated review/record scope; role check occurs before protected payload handling.
  payload: reviewId; expectedGeneration matching current worldGeneration; finite now; role.
  guards: expectedGeneration is a safe current counter; review exists uniquely in this generation.
  guards: No later review on that event remains; undo newest first.
  guards: Time is at or after review and within UNDO_WINDOW_MINUTES.
  effects: Removes that review from auditReviews and appends audited Undo; audit review ids are not reused.
  effects: Does not erase the reviewed event or its original review/Undo audit entries.
  tests: tests/ward-undo-and-bed-board.test.ts
  tests: tests/ward-governance.dom.test.tsx
  Reviewed source: src/components/ward-management/ward-flow-protected-record-events.ts:102; SHA256 8b3f5fac10eff9018aefb9cf83a8cfdd06fb5f97ca040a5176507e70b96c700b
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2556; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-undo.ts:482; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- PLACE_IN_BED — modelled; event roles: ward, coordinator
  Reviewed command model: Same stay recorded in the selected numbered bed and matching bed kind.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:613
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:96
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1770
  Subject: A current occupied/pulled stay on one ward
  Before: Stay in another numbered bed or with known kind but no number
  After: Same stay recorded in the selected numbered bed and matching bed kind
  Scope: ward or coordinator; ward must name admission's own unit. Authenticated stay/ward scope applies.
  payload: admissionId; integer bedNumber within unit.beds; now/role; actingUnitId for ward; optional listed overrideReason when moving a locked/secure/involuntary stay to an open bed.
  guards: Admission exists and bedIsOccupied; unit exists; new bed differs and is in range, unoccupied and not held by another journey.
  guards: Prior bed kind can be determined safely; resulting locked/free counts are supported.
  guards: Open-bed move that needs an override has a listed reason.
  effects: Updates admission bedNumber/bedKind, adjusts allocatableLocked only for kind changes; total empty/allocatable counts stay unchanged.
  effects: For a linked pulled stay, keeps movement heldBedNumber and accepted referral arm heldBedNumber aligned.
  effects: Captures the exact bed-placement Undo snapshot including prior kind, capacity revision and linked holds.
  tests: tests/ward-undo-and-bed-board.test.ts
  tests: tests/ward-release-pull-undo-guard.test.ts
  Reviewed source: src/components/ward-management/ward-flow-bed-events.ts:96; SHA256 a63ee87e0e4c23df938c2732ded19ca0e95f859bf586980d00fa0fdb648694f3
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2564; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- UNDO_PLACE_IN_BED — modelled; event roles: ward, coordinator
  Reviewed command model: Prior bed number/kind and associated hold numbers restored.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:614
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1752
  Event/dispatch reference: src/components/ward-management/ward-flow-undo-events.ts:134
  Subject: A stay's latest numbered-bed move
  Before: Stay still in saved destination bed; any changed kind capacity/linked holds unchanged
  After: Prior bed number/kind and associated hold numbers restored
  Scope: ward or coordinator; original acting role/ward or coordinator, plus authenticated stay scope.
  payload: admissionId; now; role; optional recordSeq; actingUnitId when ward.
  guards: Latest move record exists; exact supplied recordSeq, time-window and acting-role checks pass.
  guards: Stay remains current on same unit/in afterBed; changed kind capacity revision/count and linked pulled movement/referral arm still match saved after values.
  guards: Every restored numbered bed remains valid, unoccupied and unheld by another journey.
  effects: Restores bedNumber (or absence), bedKind (or absence), changed free-locked count and linked hold numbers without overwriting unrelated rows.
  effects: Consumes bed-placement Undo; same-kind moves do not overwrite or block on unrelated later capacity changes.
  tests: tests/ward-undo-and-bed-board.test.ts
  tests: tests/ward-release-pull-undo-guard.test.ts
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:134; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2577; SHA256 cc194f8c311719c50ea9d0fa4216f884b439ef3f4020bbab7106c278cbffaeff
  Reviewed source: src/components/ward-management/ward-undo.ts:482; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- UNDO_REFER_TO_UNITS — modelled; event roles: coordinator
  Reviewed command model: Movement offer/ward-referral changes reversed.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:617
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1753
  Event/dispatch reference: src/components/ward-management/ward-flow-undo-events.ts:261
  Subject: Latest undoable REFER_TO_UNITS on the named subject
  Before: Saved step record and unchanged post-step state
  After: Movement offer/ward-referral changes reversed
  Scope: coordinator only. Authenticated record/place scope remains required.
  payload: movementId; now; role; optional recordSeq matching the exact newest step.
  guards: A matching newest step Undo record exists for this exact subject/action family; a supplied recordSeq must match.
  guards: now is at/after the step and within UNDO_WINDOW_MINUTES (currently five).
  guards: Every affected row/whole-list patch still matches saved after values (a created notice may have been read); changed records refuse rather than overwrite newer work.
  guards: Any restored occupied/pulled bed is rechecked against current linked-patient, bed-number and hold conflicts; a sending-occupied/receiving-pulled transfer hold is allowed.
  guards: The complete proposed inverse must keep every leave attached to an occupied same-ward stay, with only one leave per stay; any restored or changed retained UMRN must have no other current owner. Blank, privacy-placeholder and UMRN not recorded values carry no retained identity claim.
  effects: Applies only saved before/after patches for REFER_TO_UNITS; removes newly created rows, restores removed/changed rows and removes appended entries.
  effects: Consumes that step Undo record; a removed stay loses its bed-placement Undo. Audit history remains; a unit allocatable revision advances instead of being rolled back.
  tests: tests/ward-undo-steps.test.ts
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:261; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:136; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:384; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- UNDO_ACCEPT_IN_PRINCIPLE — modelled; event roles: ward, coordinator
  Reviewed command model: Acceptance, held bed/admission and generated notices restored to pre-acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:618
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1754
  Event/dispatch reference: src/components/ward-management/ward-flow-undo-events.ts:262
  Subject: Latest undoable ACCEPT_IN_PRINCIPLE on the named subject
  Before: Saved step record and unchanged post-step state
  After: Acceptance, held bed/admission and generated notices restored to pre-acceptance
  Scope: ward or coordinator; original ward actingUnitId or coordinator. Authenticated record/place scope remains required.
  payload: movementId; actingUnitId when ward; now; role; optional recordSeq matching the exact newest step.
  guards: A matching newest step Undo record exists for this exact subject/action family; a supplied recordSeq must match.
  guards: now is at/after the step and within UNDO_WINDOW_MINUTES (currently five).
  guards: Every affected row/whole-list patch still matches saved after values (a created notice may have been read); changed records refuse rather than overwrite newer work.
  guards: Any restored occupied/pulled bed is rechecked against current linked-patient, bed-number and hold conflicts; a sending-occupied/receiving-pulled transfer hold is allowed.
  guards: The complete proposed inverse must keep every leave attached to an occupied same-ward stay, with only one leave per stay; any restored or changed retained UMRN must have no other current owner. Blank, privacy-placeholder and UMRN not recorded values carry no retained identity claim.
  effects: Applies only saved before/after patches for ACCEPT_IN_PRINCIPLE; removes newly created rows, restores removed/changed rows and removes appended entries.
  effects: Consumes that step Undo record; a removed stay loses its bed-placement Undo. Audit history remains; a unit allocatable revision advances instead of being rolled back.
  tests: tests/ward-undo-steps.test.ts
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:261; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:136; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:384; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- UNDO_LEGAL_FORM_RECORD — modelled; event roles: ed, coordinator, ward, community
  Reviewed command model: Newest recorded form/time/receipt/expiry and accompanying changed rows restored.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:619
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1755
  Event/dispatch reference: src/components/ward-management/ward-flow-undo-events.ts:263
  Subject: Latest undoable RECORD_LEGAL_FORM_WRITTEN, RECORD_LEGAL_FORM_CODE, RECORD_LEGAL_FORM_RECEIVED or RECORD_LEGAL_FORM_EXPIRY on the named subject
  Before: Saved step record and unchanged post-step state
  After: Newest recorded form/time/receipt/expiry and accompanying changed rows restored
  Scope: ed, coordinator, ward or community; original acting role or coordinator (role eligibility is not authority over another place). Authenticated record/place scope remains required. A ward must match the original ward captured in the saved Undo record, not merely a ward eligible to view or act on the movement now. Missing legacy ward provenance refuses a ward caller; coordinator handling remains available.
  payload: movementId; now; role; optional recordSeq matching the exact newest step.
  guards: A matching newest step Undo record exists for this exact subject/action family; a supplied recordSeq must match.
  guards: now is at/after the step and within UNDO_WINDOW_MINUTES (currently five).
  guards: Every affected row/whole-list patch still matches saved after values (a created notice may have been read); changed records refuse rather than overwrite newer work.
  guards: Any restored occupied/pulled bed is rechecked against current linked-patient, bed-number and hold conflicts; a sending-occupied/receiving-pulled transfer hold is allowed.
  guards: The legitimate legal-form Undo payload omits actingUnitId: reducer role consistency falls back to the saved record.unitId, while shared authenticated scope independently compares that original ward with the caller's scope.
  guards: The original ward is recorded on the source legal-form step even when its legitimate caller omitted actingUnitId: receipt provenance uses the sending stay or ward referral, while other form entries use the receiving stay. Another eligible ward cannot substitute for that original ward; coordinator and original-role rules otherwise remain.
  guards: The complete proposed inverse must keep every leave attached to an occupied same-ward stay, with only one leave per stay; any restored or changed retained UMRN must have no other current owner. Blank, privacy-placeholder and UMRN not recorded values carry no retained identity claim.
  effects: Applies only saved before/after patches for RECORD_LEGAL_FORM_WRITTEN, RECORD_LEGAL_FORM_CODE, RECORD_LEGAL_FORM_RECEIVED or RECORD_LEGAL_FORM_EXPIRY; removes newly created rows, restores removed/changed rows and removes appended entries.
  effects: Consumes that step Undo record; a removed stay loses its bed-placement Undo. Audit history remains; a unit allocatable revision advances instead of being rolled back.
  tests: tests/ward-audit-legal-group.test.ts
  tests: tests/ward-ed-handover-events.test.ts
  tests: tests/ward-consolidated-authority.test.ts
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:261; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:136; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:384; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- UNDO_SUPPORT_NOTIFICATION — modelled; event roles: ward, coordinator
  Reviewed command model: Newest Tell record removed from the subject's checklist.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:620
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1756
  Event/dispatch reference: src/components/ward-management/ward-flow-undo-events.ts:264
  Subject: Latest undoable RECORD_SUPPORT_NOTIFICATION on the named subject
  Before: Saved step record and unchanged post-step state
  After: Newest Tell record removed from the subject's checklist
  Scope: ward or coordinator; original acting role or coordinator; arriving movement must remain inside accepted-ward scope. Authenticated record/place scope remains required.
  payload: movementId or admissionId identifying the original Tell subject; now; role; optional recordSeq matching the exact newest step.
  guards: A matching newest step Undo record exists for this exact subject/action family; a supplied recordSeq must match.
  guards: now is at/after the step and within UNDO_WINDOW_MINUTES (currently five).
  guards: Every affected row/whole-list patch still matches saved after values (a created notice may have been read); changed records refuse rather than overwrite newer work.
  guards: Any restored occupied/pulled bed is rechecked against current linked-patient, bed-number and hold conflicts; a sending-occupied/receiving-pulled transfer hold is allowed.
  guards: The complete proposed inverse must keep every leave attached to an occupied same-ward stay, with only one leave per stay; any restored or changed retained UMRN must have no other current owner. Blank, privacy-placeholder and UMRN not recorded values carry no retained identity claim.
  effects: Applies only saved before/after patches for RECORD_SUPPORT_NOTIFICATION; removes newly created rows, restores removed/changed rows and removes appended entries.
  effects: Consumes that step Undo record; a removed stay loses its bed-placement Undo. Audit history remains; a unit allocatable revision advances instead of being rolled back.
  tests: tests/ward-undo-steps.test.ts
  tests: tests/ward-support-notifications.test.ts
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:261; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:136; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:384; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- UNDO_REPATRIATION — modelled; event roles: coordinator
  Reviewed command model: Return transport record and all generated journey/notice changes restored.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:621
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1757
  Event/dispatch reference: src/components/ward-management/ward-flow-undo-events.ts:265
  Subject: Latest undoable RECORD_REPATRIATION on the named subject
  Before: Saved step record and unchanged post-step state
  After: Return transport record and all generated journey/notice changes restored
  Scope: coordinator only. Authenticated record/place scope remains required.
  payload: admissionId; now; role; optional recordSeq matching the exact newest step.
  guards: A matching newest step Undo record exists for this exact subject/action family; a supplied recordSeq must match.
  guards: now is at/after the step and within UNDO_WINDOW_MINUTES (currently five).
  guards: Every affected row/whole-list patch still matches saved after values (a created notice may have been read); changed records refuse rather than overwrite newer work.
  guards: Any restored occupied/pulled bed is rechecked against current linked-patient, bed-number and hold conflicts; a sending-occupied/receiving-pulled transfer hold is allowed.
  guards: The complete proposed inverse must keep every leave attached to an occupied same-ward stay, with only one leave per stay; any restored or changed retained UMRN must have no other current owner. Blank, privacy-placeholder and UMRN not recorded values carry no retained identity claim.
  effects: Applies only saved before/after patches for RECORD_REPATRIATION; removes newly created rows, restores removed/changed rows and removes appended entries.
  effects: Consumes that step Undo record; a removed stay loses its bed-placement Undo. Audit history remains; a unit allocatable revision advances instead of being rolled back.
  tests: tests/ward-out-of-area-repatriation.test.ts
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:261; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:136; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:384; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- UNDO_FLAG_RETURN_EARLY — modelled; event roles: coordinator
  Reviewed command model: takes back the newest early-return flag on a stay within the Undo window.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:622
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1758
  Event/dispatch reference: src/components/ward-management/ward-flow-undo-events.ts:266
  Subject: The newest FLAG_RETURN_EARLY on one stay
  Before: Stay flagged early by that step
  After: Stay as it was before the flag
  Scope: coordinator in the role table.
  payload: admissionId; now; role; optional recordSeq.
  guards: A matching Undo record exists for this kind of step on this subject; a supplied recordSeq must match the newest record.
  guards: The undoing role is the role (and ward) that acted, or a coordinator; now is within UNDO_WINDOW_MINUTES.
  guards: The subject has not changed since the step, and restoring it would not put the patient in a second bed or clash with an occupied bed number.
  guards: The complete proposed inverse must keep every leave attached to an occupied same-ward stay, with only one leave per stay; any restored or changed retained UMRN must have no other current owner. Blank, privacy-placeholder and UMRN not recorded values carry no retained identity claim.
  effects: Restores the saved snapshot of the step, removes notices that step raised and consumes the Undo record.
  effects: The audit evidence of the step and of the Undo stays.
  tests: tests/ward-return-early.test.ts
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:1499; SHA256 8e056e60e9ae556496e92a26fc4f9d9dd32e68d3f1fc16358889fe6442e826c8
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:266; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
- UNDO_HANDOVER_SIGN_OFF — modelled; event roles: coordinator, ward
  Reviewed command model: Latest sign-off for that ward or network removed.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:623
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1759
  Event/dispatch reference: src/components/ward-management/ward-flow-undo-events.ts:267
  Subject: Latest undoable RECORD_HANDOVER_SIGN_OFF on the named subject
  Before: Saved step record and unchanged post-step state
  After: Latest sign-off for that ward or network removed
  Scope: coordinator or ward; original acting role/ward or coordinator; a ward must name its own ward. Authenticated record/place scope remains required. Only the statewide coordinator may omit unitId for a whole-network subject; a scoped coordinator must name a ward inside its scope.
  payload: unitId for ward sign-off; omitted names network subject; now; role; optional recordSeq matching the exact newest step.
  guards: A matching newest step Undo record exists for this exact subject/action family; a supplied recordSeq must match.
  guards: now is at/after the step and within UNDO_WINDOW_MINUTES (currently five).
  guards: Every affected row/whole-list patch still matches saved after values (a created notice may have been read); changed records refuse rather than overwrite newer work.
  guards: Any restored occupied/pulled bed is rechecked against current linked-patient, bed-number and hold conflicts; a sending-occupied/receiving-pulled transfer hold is allowed.
  guards: Shared scoped callers cannot resolve a missing unitId to the whole-network sign-off; an ordinary in-scope ward target remains allowed.
  guards: The complete proposed inverse must keep every leave attached to an occupied same-ward stay, with only one leave per stay; any restored or changed retained UMRN must have no other current owner. Blank, privacy-placeholder and UMRN not recorded values carry no retained identity claim.
  effects: Applies only saved before/after patches for RECORD_HANDOVER_SIGN_OFF; removes newly created rows, restores removed/changed rows and removes appended entries.
  effects: Consumes that step Undo record; a removed stay loses its bed-placement Undo. Audit history remains; a unit allocatable revision advances instead of being rolled back.
  tests: tests/ward-undo-steps.test.ts
  tests: tests/ward-consolidated-authority.test.ts
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:261; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:136; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:384; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- UNDO_SITE_HANDOVER_SIGN_OFF — modelled; event roles: bed_manager
  Reviewed command model: Latest sign-off for that site removed; no ward sign-off changed.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:626
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1760
  Event/dispatch reference: src/components/ward-management/ward-flow-undo-events.ts:268
  Subject: Latest undoable RECORD_SITE_HANDOVER_SIGN_OFF on the named subject
  Before: Saved step record and unchanged post-step state
  After: Latest sign-off for that site removed; no ward sign-off changed
  Scope: bed_manager only for its own site; coordinator is not eligible even if it signed as cover. Authenticated record/place scope remains required.
  payload: siteCode; now; role; optional recordSeq matching the exact newest step.
  guards: A matching newest step Undo record exists for this exact subject/action family; a supplied recordSeq must match.
  guards: now is at/after the step and within UNDO_WINDOW_MINUTES (currently five).
  guards: Every affected row/whole-list patch still matches saved after values (a created notice may have been read); changed records refuse rather than overwrite newer work.
  guards: Any restored occupied/pulled bed is rechecked against current linked-patient, bed-number and hold conflicts; a sending-occupied/receiving-pulled transfer hold is allowed.
  guards: The complete proposed inverse must keep every leave attached to an occupied same-ward stay, with only one leave per stay; any restored or changed retained UMRN must have no other current owner. Blank, privacy-placeholder and UMRN not recorded values carry no retained identity claim.
  effects: Applies only saved before/after patches for RECORD_SITE_HANDOVER_SIGN_OFF; removes newly created rows, restores removed/changed rows and removes appended entries.
  effects: Consumes that step Undo record; a removed stay loses its bed-placement Undo. Audit history remains; a unit allocatable revision advances instead of being rolled back.
  tests: tests/ward-undo-steps.test.ts
  tests: tests/ward-site-handover-sign-off.test.ts
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:261; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:136; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:384; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:283; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
- UNDO_ED_STEP — modelled; event roles: ed, ward, community, coordinator
  Reviewed command model: Newest ED board step and all records it changed restored.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:627
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1761
  Event/dispatch reference: src/components/ward-management/ward-flow-undo-events.ts:269
  Subject: Latest undoable RECORD_ARRIVED_IN_DEPARTMENT, RECORD_EXAMINATION, RECORD_MEDICAL_CLEARANCE, RECORD_TRANSPORT_NEED, RECORD_ED_PRESENTATION or HANDOVER_READY on the named subject
  Before: Saved step record and unchanged post-step state
  After: Newest ED board step and all records it changed restored
  Scope: ed, ward, community or coordinator; original acting role or coordinator. Authenticated record/place scope remains required.
  payload: movementId or referralId identifying original subject; now; role; optional recordSeq matching the exact newest step.
  guards: A matching newest step Undo record exists for this exact subject/action family; a supplied recordSeq must match.
  guards: now is at/after the step and within UNDO_WINDOW_MINUTES (currently five).
  guards: Every affected row/whole-list patch still matches saved after values (a created notice may have been read); changed records refuse rather than overwrite newer work.
  guards: Any restored occupied/pulled bed is rechecked against current linked-patient, bed-number and hold conflicts; a sending-occupied/receiving-pulled transfer hold is allowed.
  guards: The complete proposed inverse must keep every leave attached to an occupied same-ward stay, with only one leave per stay; any restored or changed retained UMRN must have no other current owner. Blank, privacy-placeholder and UMRN not recorded values carry no retained identity claim.
  effects: Applies only saved before/after patches for RECORD_ARRIVED_IN_DEPARTMENT, RECORD_EXAMINATION, RECORD_MEDICAL_CLEARANCE, RECORD_TRANSPORT_NEED, RECORD_ED_PRESENTATION or HANDOVER_READY; removes newly created rows, restores removed/changed rows and removes appended entries.
  effects: Consumes that step Undo record; a removed stay loses its bed-placement Undo. Audit history remains; a unit allocatable revision advances instead of being rolled back.
  tests: tests/ward-ed-examination-save.dom.test.tsx
  tests: tests/ward-ed-handover-events.test.ts
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:261; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:136; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:384; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- UNDO_TRANSPORT_STEP — modelled; event roles: officer, ward, coordinator
  Reviewed command model: Newest transport stage reversed, including arrival-created stay and affected bed/resource changes.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:628
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1762
  Event/dispatch reference: src/components/ward-management/ward-flow-undo-events.ts:270
  Subject: Latest undoable TRANSPORT_ACCEPTED, TRANSPORT_EN_ROUTE, PATIENT_COLLECTED or PATIENT_ARRIVED on the named subject
  Before: Saved step record and unchanged post-step state
  After: Newest transport stage reversed, including arrival-created stay and affected bed/resource changes
  Scope: officer, ward or coordinator; original acting role/ward or coordinator. Authenticated record/place scope remains required.
  payload: movementId; actingUnitId when ward; now; role; optional recordSeq matching the exact newest step.
  guards: A matching newest step Undo record exists for this exact subject/action family; a supplied recordSeq must match.
  guards: now is at/after the step and within UNDO_WINDOW_MINUTES (currently five).
  guards: Every affected row/whole-list patch still matches saved after values (a created notice may have been read); changed records refuse rather than overwrite newer work.
  guards: Any restored occupied/pulled bed is rechecked against current linked-patient, bed-number and hold conflicts; a sending-occupied/receiving-pulled transfer hold is allowed.
  guards: The complete proposed inverse must keep every leave attached to an occupied same-ward stay, with only one leave per stay; any restored or changed retained UMRN must have no other current owner. Blank, privacy-placeholder and UMRN not recorded values carry no retained identity claim.
  effects: Applies only saved before/after patches for TRANSPORT_ACCEPTED, TRANSPORT_EN_ROUTE, PATIENT_COLLECTED or PATIENT_ARRIVED; removes newly created rows, restores removed/changed rows and removes appended entries.
  effects: Consumes that step Undo record; a removed stay loses its bed-placement Undo. Audit history remains; a unit allocatable revision advances instead of being rolled back.
  tests: tests/ward-undo-steps.test.ts
  tests: tests/ward-undo-dependent-records.test.ts
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:261; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:136; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:384; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- UNDO_DEPARTURE — modelled; event roles: ward, coordinator
  Reviewed command model: Departure reversed, stay and capacity restored if still safe.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:629
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1763
  Event/dispatch reference: src/components/ward-management/ward-flow-undo-events.ts:271
  Subject: Latest undoable RECORD_LEAVING or RECORD_PATIENT_DISCHARGE on the named subject
  Before: Saved step record and unchanged post-step state
  After: Departure reversed, stay and capacity restored if still safe
  Scope: ward or coordinator; original acting role/ward or coordinator. Authenticated record/place scope remains required.
  payload: admissionId; actingUnitId when ward; now; role; optional recordSeq matching the exact newest step.
  guards: A matching newest step Undo record exists for this exact subject/action family; a supplied recordSeq must match.
  guards: now is at/after the step and within UNDO_WINDOW_MINUTES (currently five).
  guards: Every affected row/whole-list patch still matches saved after values (a created notice may have been read); changed records refuse rather than overwrite newer work.
  guards: Any restored occupied/pulled bed is rechecked against current linked-patient, bed-number and hold conflicts; a sending-occupied/receiving-pulled transfer hold is allowed.
  guards: The complete proposed inverse must keep every leave attached to an occupied same-ward stay, with only one leave per stay; any restored or changed retained UMRN must have no other current owner. Blank, privacy-placeholder and UMRN not recorded values carry no retained identity claim.
  effects: Applies only saved before/after patches for RECORD_LEAVING or RECORD_PATIENT_DISCHARGE; removes newly created rows, restores removed/changed rows and removes appended entries.
  effects: Consumes that step Undo record; a removed stay loses its bed-placement Undo. Audit history remains; a unit allocatable revision advances instead of being rolled back.
  tests: tests/ward-departure-undo-integrity.test.ts
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:261; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:136; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:384; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- UNDO_ABSENT_WITHOUT_LEAVE — modelled; event roles: ward, coordinator
  Reviewed command model: Newest absence record and related row changes reversed.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:630
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1764
  Event/dispatch reference: src/components/ward-management/ward-flow-undo-events.ts:272
  Subject: Latest undoable RECORD_ABSENT_WITHOUT_LEAVE on the named subject
  Before: Saved step record and unchanged post-step state
  After: Newest absence record and related row changes reversed
  Scope: ward or coordinator; original acting role/ward or coordinator. Authenticated record/place scope remains required.
  payload: admissionId; actingUnitId when ward; now; role; optional recordSeq matching the exact newest step.
  guards: A matching newest step Undo record exists for this exact subject/action family; a supplied recordSeq must match.
  guards: now is at/after the step and within UNDO_WINDOW_MINUTES (currently five).
  guards: Every affected row/whole-list patch still matches saved after values (a created notice may have been read); changed records refuse rather than overwrite newer work.
  guards: Any restored occupied/pulled bed is rechecked against current linked-patient, bed-number and hold conflicts; a sending-occupied/receiving-pulled transfer hold is allowed.
  guards: The complete proposed inverse must keep every leave attached to an occupied same-ward stay, with only one leave per stay; any restored or changed retained UMRN must have no other current owner. Blank, privacy-placeholder and UMRN not recorded values carry no retained identity claim.
  effects: Applies only saved before/after patches for RECORD_ABSENT_WITHOUT_LEAVE; removes newly created rows, restores removed/changed rows and removes appended entries.
  effects: Consumes that step Undo record; a removed stay loses its bed-placement Undo. Audit history remains; a unit allocatable revision advances instead of being rolled back.
  tests: tests/ward-engine-safety.test.ts
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:261; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:136; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:384; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
- UNDO_BED_MEETING_ACTION — modelled; event roles: coordinator, ward, ed, community, bed_manager
  Reviewed command model: One completed meeting action reopened to its exact prior state.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:632
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1765
  Event/dispatch reference: src/components/ward-management/ward-flow-undo-events.ts:273
  Subject: Latest undoable COMPLETE_BED_MEETING_ACTION or RECORD_BED_MEETING_ACTION on the named subject
  Before: Saved step record and unchanged post-step state
  After: One completed meeting action reopened to its exact prior state
  Scope: coordinator, ward, ed, community or bed_manager; original acting role/ward or coordinator. Authenticated record/place scope remains required.
  payload: subject {kind:movement|admission,id}; action BedMeetingActionKind; actingUnitId when ward; now; role; optional recordSeq matching the exact newest step.
  guards: A matching newest step Undo record exists for this exact subject/action family; a supplied recordSeq must match.
  guards: now is at/after the step and within UNDO_WINDOW_MINUTES (currently five).
  guards: Every affected row/whole-list patch still matches saved after values (a created notice may have been read); changed records refuse rather than overwrite newer work.
  guards: Any restored occupied/pulled bed is rechecked against current linked-patient, bed-number and hold conflicts; a sending-occupied/receiving-pulled transfer hold is allowed.
  guards: The complete proposed inverse must keep every leave attached to an occupied same-ward stay, with only one leave per stay; any restored or changed retained UMRN must have no other current owner. Blank, privacy-placeholder and UMRN not recorded values carry no retained identity claim.
  effects: Applies only saved before/after patches for COMPLETE_BED_MEETING_ACTION or RECORD_BED_MEETING_ACTION (Chase Undo); removes newly created rows, restores removed/changed rows and removes appended entries.
  effects: Consumes that step Undo record; a removed stay loses its bed-placement Undo. Audit history remains; a unit allocatable revision advances instead of being rolled back.
  tests: tests/ward-bed-meeting-undo.test.ts
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:261; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:136; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-undo.ts:384; SHA256 ad52fafbe54392dfa96cbe79dac75a1496c6aa044743b57360383d0fcd19c3f6
  Reviewed source: src/components/ward-management/ward-access-state.ts:655; SHA256 83b5ed2c9c4d152bab9160d291cd95fd69463c60ea11ff290a10e50845cdc96a
  Reviewed source: src/components/ward-management/ward-bed-meeting-undo-event-type.ts:10; SHA256 a112bd8031c48d720a344b7a3fe9821b6f41db2d88956a2b001f8e5fca8fdb41
- UNDO_BED_STEP — modelled; event roles: ward, bed_manager, coordinator
  Reviewed command model: takes back a bed closed or reopened, or a return from leave, within the Undo window.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:634
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1766
  Event/dispatch reference: src/components/ward-management/ward-flow-undo-events.ts:274
  Subject: One bed (unitId and bedNumber) or one leave bed record
  Before: Bed as the SET_BED_CLOSED or END_LEAVE_BED step left it
  After: Bed or leave record restored to before that step
  Scope: ward, bed_manager or coordinator in the role table.
  payload: now; role; optional recordSeq; actingUnitId when ward; leaveBedId, or unitId and bedNumber.
  guards: A matching Undo record exists for this kind of step on this subject; a supplied recordSeq must match the newest record.
  guards: The undoing role is the role (and ward) that acted, or a coordinator; now is within UNDO_WINDOW_MINUTES.
  guards: The subject has not changed since the step, and restoring it would not put the patient in a second bed or clash with an occupied bed number.
  guards: The complete proposed inverse must keep every leave attached to an occupied same-ward stay, with only one leave per stay; any restored or changed retained UMRN must have no other current owner. Blank, privacy-placeholder and UMRN not recorded values carry no retained identity claim.
  effects: Restores the saved snapshot of the step, removes notices that step raised and consumes the Undo record.
  effects: The audit evidence of the step and of the Undo stays.
  tests: tests/ward-tier1-undo.test.ts
  tests: tests/ward-undo-dependent-records.test.ts
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:1507; SHA256 8e056e60e9ae556496e92a26fc4f9d9dd32e68d3f1fc16358889fe6442e826c8
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:274; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
- UNDO_RELEASE_STEP — modelled; event roles: coordinator, ward, ed, community, bed_manager
  Reviewed command model: takes back a released bed, cancelled transport, withdrawn ward request or cancelled planned admission.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:635
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1767
  Event/dispatch reference: src/components/ward-management/ward-flow-undo-events.ts:275
  Subject: One movement, or one planned admission
  Before: As the release, cancel or withdraw step left it
  After: Restored to before that step
  Scope: coordinator, ward, ed, community or bed_manager in the role table.
  payload: now; role; optional recordSeq; actingUnitId when ward; movementId or plannedAdmissionId.
  guards: A matching Undo record exists for this kind of step on this subject; a supplied recordSeq must match the newest record.
  guards: The undoing role is the role (and ward) that acted, or a coordinator; now is within UNDO_WINDOW_MINUTES.
  guards: The subject has not changed since the step, and restoring it would not put the patient in a second bed or clash with an occupied bed number.
  guards: The complete proposed inverse must keep every leave attached to an occupied same-ward stay, with only one leave per stay; any restored or changed retained UMRN must have no other current owner. Blank, privacy-placeholder and UMRN not recorded values carry no retained identity claim.
  effects: Restores the saved snapshot of the step, removes notices that step raised and consumes the Undo record.
  effects: The audit evidence of the step and of the Undo stays.
  tests: tests/ward-tier1-undo.test.ts
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:1508; SHA256 8e056e60e9ae556496e92a26fc4f9d9dd32e68d3f1fc16358889fe6442e826c8
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:275; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
- UNDO_PATIENT_RECORD — modelled; event roles: community, coordinator
  Reviewed command model: takes back a community treatment order recorded or ended, or a record archived in error.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:636
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1768
  Event/dispatch reference: src/components/ward-management/ward-flow-undo-events.ts:276
  Subject: One patient record
  Before: As the CTO or archive step left it
  After: Patient record restored to before that step
  Scope: community or coordinator in the role table.
  payload: patientId; now; role; optional recordSeq.
  guards: A matching Undo record exists for this kind of step on this subject; a supplied recordSeq must match the newest record.
  guards: The undoing role is the role (and ward) that acted, or a coordinator; now is within UNDO_WINDOW_MINUTES.
  guards: The subject has not changed since the step, and restoring it would not put the patient in a second bed or clash with an occupied bed number.
  guards: The complete proposed inverse must keep every leave attached to an occupied same-ward stay, with only one leave per stay; any restored or changed retained UMRN must have no other current owner. Blank, privacy-placeholder and UMRN not recorded values carry no retained identity claim.
  effects: Restores the saved snapshot of the step, removes notices that step raised and consumes the Undo record.
  effects: The audit evidence of the step and of the Undo stays.
  tests: tests/ward-tier1-undo.test.ts
  tests: tests/ward-retained-umrn.test.ts
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:1509; SHA256 8e056e60e9ae556496e92a26fc4f9d9dd32e68d3f1fc16358889fe6442e826c8
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:276; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
  Reviewed source: src/components/ward-management/ward-retained-umrn.ts:25; SHA256 7968243f077b9d5c9a6fe6a56385f48ff6a97aa39cfdeec8fe97f05919693d80

## 111 BOXES ON THE ROUTE MAP  (lane = how it is coloured)
- [expected] A community team
- [expected] A crisis service
- [expected] Police
- [expected] Ambulance
- [expected] Another hospital
- [expected] A doctor in an ED
- [expected] A GP
- [heading] Who raises it  ·  seven — A doctor in an ED may only raise it as an ED referral — they cannot claim another source.
- [expected] A referral is raised — Somebody has decided this person needs to go somewhere.
- [expected] Addressed to up to three places at once — Up to the configured recipient cap. Distinct named psychiatric wards can be addressed together; duplicate recipients and mixing a broad ward request with named ward requests are refused.
- [expected] ①  Sent to a community team — Named as free text — there is no register of teams to choose from.
- [expected] ②  Sent to a psychiatric ward — Carries what the bed must be: sex, gender, secure, involuntary, high-acuity nursing.
- [expected] ③  Sent to an emergency department — Must say what it is FOR: a bed, a psychiatric review, or a medical assessment.
- [expected] The team answers
- [end] Accepted — community follow-up — The arm ends here. It never becomes a bed search.
- [end] Declined — four reasons — Outside the team's catchment · needs inpatient care, not community follow-up · the client declined or could not be contacted · already open to another team.
- [stall] No answer yet — The arm remains queued until answered or withdrawn. Other acceptances do not cancel a community arm. Displayed waiting/overdue indicators do not decide or close it.
- [stall] The referrer withdraws just this arm — A narrow exception added 17 September 2026, and only while the arm is still queued — a team that has already answered keeps its answer. The bed request stands.
- [diversion] It can also begin part-way through a bed search — Redirecting a bed search to a community team raises a real referral of this kind — or reuses a queued arm already asking that same team, rather than asking twice. So this arm does not only start at the front door.
- [note] This arm is exempt from the automatic cancellation — In both directions. A ward accepting does not close it, and it accepting does not close the bed search. It is the only arm that behaves this way.
- [expected] The ward answers
- [expected] Accepted — Records the ward answer, with an optional named bed reservation on the referral. It creates no movement or admission.
- [end] Declined — seven reasons — No suitable bed · age band not provided here · no bed of that designation · no secure bed · belongs to another service · referred elsewhere · another reason.
- [stall] No answer at all — The destination remains waiting until answered, withdrawn or cancelled by a competing acceptance. Current target/overdue displays can flag waiting; they do not choose an answer.
- [diversion] Every other waiting arm is cancelled — Automatically, the moment a ward OR a department accepts — except the community arm, which is exempt in both directions. The referrer is neither asked nor told.
- [diversion] The referrer takes the WHOLE referral back — The default, and the opposite of the community arm's one-arm exception: every still-queued destination goes at once. If a bed search is already running it releases the held bed and cancels the transport, and closes as 'did not proceed'. Refused once transport has collected the patient — that needs a coordinator, not an automatic withdrawal.
- [stall] A ward cannot accept while a department's bed search is live — One referral, two arms: if the emergency department already raised the bed search, the ward arm is refused until that movement closes or arrives. Neither arm's screen shows the other.
- [expected] It lands on that department's board — And the referrer can see their patient sitting there.
- [expected] Expected to arrive — Triaged, and not here yet. It sits on a separate list from the referrals.
- [stall] Expected, and never arrives — A queued ED arm can be declined or withdrawn before arrival, removing this expectation. Otherwise it stays until arrival; past 72 hours the screen adds a reminder but changes no record.
- [expected] Marked present — The only door between the two lists. Stamped once; a repeat keeps the earliest time.
- [expected] The department answers, or acts
- [expected] Accepted — the department takes them — And every other destination still waiting is cancelled on the spot, including the ward request sent alongside it. The referrer is not asked.
- [end] Declined — three reasons only — Belongs to another service · referred elsewhere · another reason. The four bed-shaped reasons are withheld on purpose: an ED is not being asked for a bed.
- [expected] A doctor raises a bed search from here — This is what creates the record that moves. It can be linked back to the referral that sent them, or raised for somebody nobody referred.
- [end] The department decides no bed is needed — Two labels, one behaviour: 'for community follow-up' raises no referral and tells no team — only the separate action below does that. Unwinds a held bed, an uncollected transport job and every live ward request. Refused once transport has collected them.
- [diversion] Referred straight to a community team instead — Ends the bed search and creates or reuses a real community referral. Available from the moment the bed search exists until the patient is collected — not only from a department. Refused once they are collected, and while a legal form has no conclusive examination outcome.
- [end] Left the department — Only recordable after an outcome has been recorded first.
- [seam] A separate movement is raised — Acceptance does not create the bed-search record. RAISE_REFERRAL creates it separately and can link it to the referral.
- [expected] Placement requested
- [expected] Wards are asked — One at a time, or several at once, up to three.
- [expected] A ward accepts in principle — Still no bed set aside.
- [expected] A bed is pulled and held — Empty, offered to nobody else. Four hours is the default, not a rule — a coordinator can set the hold anywhere between thirty minutes and four hours. The admission this creates now names the movement it came from — a join added by owner ruling on 21 September, and the first pointer of any kind between the patient's track and the bed's; it is empty for the beds seeded as already occupied, so anything reading it has to cope with nothing being there.
- [expected] Transport is booked — Five answers, none defaulted — provider, escort, CAD number, voluntary or involuntary, estimated time.
- [expected] Handover ready
- [expected] The crew accepts, and sets off
- [expected] The patient is collected — After this point, everything changes.
- [expected] The ward says they have arrived — Ward confirmation closes the movement and records the occupied stay. An officer Delivered stamp ends only the transport leg. STEP_BACK_STAGE refuses arrival; a separate scoped, time-limited Undo can correct the latest unchanged arrival snapshot.
- [expected] Occupied — on the ward
- [expected] Clinically ready to leave — The patient's departure and the named bed-release record proceed on two tracks.
- [stall] A ward declines — seven reasons — No bed · sex mix · no specialling · acuity mix · capability mismatch · bed pulled for an earlier referral · out of catchment.
- [stall] One ward's request is taken back — Seven reasons. The other wards asked carry on considering.
- [stall] The acceptance is withdrawn — A listed reason records why the acceptance is withdrawn. An uncollected pulled or stepped-back hold is released in the same act; cancel a live job first. Handover-ready and moving are refused.
- [end] The bed search is abandoned — Pulled from every ward still considering it, or — once a ward has accepted — the acceptance revoked and any held bed given back. It closes as 'did not proceed'. This is also where an examination outcome of a community order, or a revocation, lands while no bed is held yet.
- [stall] The held bed is given back — four reasons — NINE different actions delete that admission, not one — releasing the pull (four reasons of its own), releasing a held bed after transport was stopped, abandoning the bed search, the referrer withdrawing it, the department deciding no bed is needed, sending them to a community team instead, an examination outcome that ends it, releasing the bed a diverted journey held, and releasing the bed while reopening the search. Whichever it was, the admission record is deleted outright: nobody was ever in this bed.
- [stall] Transport cancelled before collection — A listed reason removes the job without moving the stage or automatically rebooking. The held-bed notice checks the admission link as well as stage, including a stepped-back pull.
- [diversion] The journey is stopped after collection — Three reasons, and somebody must say where the patient now is. The movement closes and the bed stays held.
- [record] Absent without leave is recorded — The occupied stay and held bed remain. The ward records absence, its steps and return against the admission; the current order can also create an action-inbox fact.
- [forced] A coordinator places them anyway — Eight of the bed checks can be passed by recording one of five reasons — the receiving team has agreed despite the mismatch · clinical urgency outweighs it · the bed information is known to be out of date · continuity with an earlier admission here · closer to home or family. Running out of one-to-one nursing or of high-acuity capacity can be passed the same way, and passing the acuity one also demands that the nurse unit manager was consulted.
- [stall] The one refusal nothing can override — If the ward is designated for one gender and the patient's recorded gender is the other, no reason passes it and the app will not even offer the list. Non-binary, Different term, and not-recorded genders can use the coordinator-reviewed exception. Every other bed check here can be forced; this one cannot.
- [forced] A patient with a non-binary, Different term, or unrecorded gender onto a single-gender ward — Only a coordinator, and only with one of six recorded reasons — a single room is available · the patient's stated preference, agreed with the ward · no single room is free and the ward agreed a plan for privacy · the only suitable ready bed, agreed with the ward · they know this ward from an earlier stay · closer to home or supports.
- [record] Record a form from the Forms page — The form selector and checked paper time reach the supported form-writing handler. Authorised users can save; refusal keeps the draft and shows the reason. This does not issue a legal instrument or calculate its statutory expiry.
- [diversion] No transport needed — Marked arrived straight from the held bed, with no journey recorded at all.
- [record] Pulling again when the bed is already held — Restoring an already-linked hold preserves its bed rather than consuming another. Current code rechecks the matching admission, patient placement, observation/high-acuity staffing, legal authority and gender before restoring the pulled stage.
- [stall] A held destination no longer suits — Current gender/legal facts are checked at forward steps. WITHDRAW_ACCEPTANCE can release an uncollected pulled or stepped-back hold atomically after any live job is cancelled; no obsolete three-step sequence should be assumed.
- [record] Cancellation keeps the bed facts separate — The hold is detected from the linked admission OR the pulled-or-later stage. Cancelling removes the job and preserves the bed and current stage, including after a step back.
- [record] The legal authority is revoked before collection — A revoked examination while a bed is held records the examination and flags release without refunding the bed. Acceptance, en-route and collection refuse while that hold is unresolved; physical arrival remains recordable.
- [diversion] Away at an ED, or on leave — An ED trip and leave name the occupied admission. Return records clear the relevant absence. Leave also records its kind and optional psychiatrist-authorisation answer; the bed stays held while away.
- [record] Closure limits corrections; admitted forms have a separate route — Most movement actions refuse closure. The admitting ward can still record a supported written form or typed expiry for a current occupied stay. STEP_BACK_STAGE refuses arrival, while a separate scoped Undo can reverse the latest unchanged transport/arrival snapshot within its window.
- [diversion] Sending a country patient home — Logged against the admission once it has been arranged off the system: home hospital, whether its ward agreed, road or flight, provider and tracking number. It books nothing. Only when the home ward agreed does it also open a new movement asking for a bed at home.
- [expected] Track one — the person leaves — Eight recorded departure destinations. A psychiatric transfer releases the sending ward bed while taking a receiving bed.
- [expected] Track two — the bed is released — Expected can go directly to discharged or pass through confirmed. The named admission leaving completes its release in the same write; capacity reconciliation prevents counting an already-recorded release or an over-capacity arrival twice.
- [stall] Stuck, or waiting on something — Seven things it can wait on, nine reasons it can be stuck. Neither is a stage.
- [end] Discharged to the community — Frees a bed.
- [diversion] Transferred to another psychiatric ward — Frees THIS ward's bed and gains the state nothing — the only one that is not a release.
- [end] Transferred to a general hospital — Frees a bed.
- [end] Moved to residential care — Frees a bed.
- [end] Left against advice — Frees a bed.
- [end] Died on the ward — Frees a bed.
- [end] Transferred to police or prison custody — Frees a bed.
- [end] Did not return — Frees a bed.
- [record] Is this the same person already? — Duplicate matching warns about number and demographic similarities. A duplicate record number blocks registration in both form and reducer; name similarity alone remains a review warning.
- [record] Add patient saves identity; referral saves intake — The current Add patient form asks for identity, optional gender and Aboriginal or Torres Strait Islander status. Clinical intake and location belong to the referral flow. Obsolete non-working Print/Save draft controls are hidden; the historical silent-discard finding no longer describes this screen.
- [record] Is the patient medically cleared? — Three answers, not two — unrecorded, cleared, and explicitly not cleared.
- [absent] The display follows wall-clock time — The provider updates elapsed wall-clock time at minute boundaries and catches up when the page becomes visible. A controlled test clock is separate. A display becoming overdue does not by itself prove that a domain action ran; check the event handler for that action.
- [record] Settings change current operational defaults — WardConfiguration carries twelve fields: access/decision/transfer/booking targets, parallel-recipient cap, pull hold, morning deadline, due-soon warnings and Forecast thresholds. A valid full draft is merged against its baseline or refused for conflicting fields; old optional keys take documented defaults.
- [record] Where they sit in the queue — Flagged urgent first, then the urgency tier, then whoever has waited longest, then the record's own id as a tie-break. Nothing else moves anybody up.
- [record] Duplicate bed requests are surfaced — The current duplicate-bed-request derivation finds multiple active requests for one linked patient and creates a coordinator fact row. It does not rank patients or choose a winner. This is distinct from a physical double-booking check.
- [record] Flagged urgent — Ten reasons. Lifts the patient above every urgency level, and re-sorts nothing on its own.
- [record] Escalated — Which wards were tried and who was rung. Six people it can be escalated to.
- [record] A ward states how many beds it can allocate — Set outright rather than counted up, and refused if it claims more beds than the ward physically has. Asking a ward to refresh it records that somebody asked, and moves no number at all.
- [record] The legal status changes — Four values. Changing it triggers nothing — even if it makes the accepted ward unlawful.
- [record] The legal paperwork arrives — Nine forms can be recorded as received — 1A, 3A, 3C, 3D, 5A, 5B, 6A, 6B, 6C. Receipt can be undone and recorded again; every expiry is a time a clinician typed.
- [record] An examination is recorded — Four outcomes. Only “a further examination is ordered” allows a second one.
- [record] The paperwork is written, continued, or attached — Written and continued forms record paper facts and clear legacy calculated clocks; same-form written-time edits preserve applicable typed facts. An admitted ward has a post-arrival route. A3C after3D is refused. A country1A extension requires a current country setting and a finite typed later paper expiry; no statutory duration is computed.
- [record] The ward's authority does not match the person's status — Two shapes, both named: an involuntary patient on a voluntary ward, and a voluntary patient on a locked one. It can be flagged, and it cannot be overridden: ward authority for an involuntary patient is never overridable (owner ruling, 25 September).
- [record] Somebody is told — Twenty-four kinds of notice. Written once, never rewritten, never deleted, never expiring.
- [record] The journey is diverted while it is under way — Only once the patient is actually in the vehicle — it is refused before collection, after arrival, and a second time on a movement already diverted. It records a reason and where they were taken instead. The held bed does not come back on its own: giving it back is a separate act, and refused unless this movement was in fact diverted.
- [stall] Expiry can be recorded for an admitted patient — The legal-event handler permits the ward to record a typed expiry for its admitted patient even when the movement is closed. This is a recorded time, not a computed legal limit. See ward-flow-record-legal-events.ts.
- [record] A clock somebody starts by hand — Two kinds, forty-eight hours and seven days, raised against a movement and cleared again. Only one can be open at a time — raising a second is refused, and so is clearing one that was never raised. Nothing starts it automatically and nothing expires it; it is a note about time, not a timer.
- [record] The rule for a bed kept during a medical trip — The unwired retention helper keeps the bed by default, including above the24-hour threshold; above threshold adds requiresReview. Only an explicit override changes freesBed. The numeric constant is24 while an adjacent historical provenance comment still says48.
- [record] A row appears in the coordinator's inbox — The current inbox derives fact rows from movements, stays, planned bookings and bed-meeting actions. Facts are acknowledged/owned/snoozed, never ticked away. The daily check is a commitment; its day-shaped ID can be completed and reopened.
- [record] Step-down, and what is holding the discharge up — Two settings on a known admission: step-down candidacy and one discharge barrier. The acting ward must match; a substantive barrier is refused for a stay under seven days. Neither moves a bed figure.
- [record] A discharge recorded the other way — A second event does exactly what recording a departure does, but only for a patient whose identity is linked, and only against the revision number the screen last read. Same result, different door.
- [record] The bed is being prepared — Cleaning/repair is a separate preparation flag. It does not directly rewrite the ward count; the pull handler separately refuses when every free bed is still being made ready.
- [record] Only the ward it belongs to may touch it — Confirming a release, reversing it, flagging it stuck, clearing that flag, marking the bed being cleaned, and finally freeing it are each refused to any other ward. It is what stops one ward's freed bed landing in another ward's figures.
- [record] The ward's own day, beside the patient's — A morning count a ward confirms, a message it can be sent, and a sweep that works out which beds on leave are worth warning about. None of them belongs to any one patient, which is why they sit off the journey rather than on it.
- [heading] Recorded alongside  · — Happens at some point without moving the journey.
- [heading] ←  Stalls, undos and endings — Grey goes back into the route. Teal does not.
- [heading] Read down the middle  ↓ — Read straight down.
- [heading] Diversions  → — It carries on, somewhere other than expected.

## 97 ACTIONS, and which boxes each is attached to
- RECEIVE_REFERRAL :: Raise a referral at the front door :: boxes = raised, addressed, armCommunity, armWard, armEd, srcCommunity, srcCrisis, srcPolice, srcAmbulance, srcHospital, srcEd, srcGp
- ADD_PATIENT :: Add a person who is not on file :: boxes = raised, rkDuplicate, rkIntakeLost
- RECORD_MEDICAL_CLEARANCE :: Record whether they are medically cleared :: boxes = addressed, rkClearance, edArrived
- RECORD_ARRIVED_IN_DEPARTMENT :: Mark that an expected patient has turned up :: boxes = addressed, edExpected, edArrived, edNeverArrives
- ACCEPT_REFERRAL :: Accept the referral :: boxes = wardAnswers, wardAccepted, othersCancelled, cmhtAnswers, cmhtAccepted, edAnswers, edAccepted, cmhtNothing, wardBlocked, dForced, dNonBinary
- DECLINE_REFERRAL :: Decline the referral :: boxes = wardAnswers, wardDeclined, cmhtAnswers, cmhtDeclined, edAnswers, edDeclined, cmhtNothing
- RECORD_REFERRER_WITHDRAWAL :: The referrer takes the referral back :: boxes = wardAnswers, cmhtWithdrawn, wardNothing, cmhtNothing, wardWithdrawn
- ADD_REFERRAL_CORRECTION :: Add a correction to a referral :: boxes = wardAnswers, addressed
- RECORD_LOCAL_BED_SOUGHT :: Record that a bed closer to home was looked for :: boxes = wardAnswers, addressed
- RAISE_REFERRAL :: Start a bed search from a department :: boxes = seam, placement, edRaise
- REFER_TO_UNITS :: Ask one or more wards :: boxes = asked, dForced
- ACCEPT_IN_PRINCIPLE :: A ward accepts in principle :: boxes = inPrinciple, dForced, dGenderHard
- DECLINE :: A ward declines the bed search :: boxes = sWardDecline
- WITHDRAW_WARD_REQUEST :: Take back one ward's request :: boxes = asked, sWithdrawWard
- WITHDRAW_ACCEPTANCE :: Undo a ward's acceptance :: boxes = sAcceptWithdrawn
- WITHDRAW_REFERRAL :: Abandon the bed search :: boxes = sAbandoned
- REFER_TO_COMMUNITY_TEAM :: Send them to a community team instead :: boxes = edToCommunity, cmhtFromSearch
- RECORD_ED_OUTCOME :: The department decides they need no bed :: boxes = edOutcome, edAnswers
- RECORD_NO_REFERRAL :: Record that nobody referred them :: boxes = placement, edRaise
- RECORD_ESCALATION :: Record an escalation :: boxes = asked, rkEscalate
- STEP_BACK_STAGE :: Correct the record backwards :: boxes = asked, inPrinciple, pulled
- PULL_PATIENT :: Take the bed :: boxes = pulled, dRepull, dForced, dGenderHard, dNoLongerSuits
- RELEASE_PULL :: Give the held bed back :: boxes = sPullReleased
- RELEASE_HELD_BED :: Release a bed left held by a stopped journey :: boxes = sStopTransport
- RECORD_TRANSPORT_NEED :: Record whether transport is needed :: boxes = booked, dNoTransport
- BOOK_TRANSPORT :: Book the transport :: boxes = booked
- HANDOVER_READY :: Confirm handover is ready :: boxes = handover, dNoLongerSuits
- TRANSPORT_ACCEPTED :: The crew accepts the job :: boxes = enroute, dNoLongerSuits
- TRANSPORT_EN_ROUTE :: The crew sets off :: boxes = enroute
- PATIENT_COLLECTED :: The patient is picked up :: boxes = collected, dNoLongerSuits
- PATIENT_ARRIVED :: The ward says they have arrived :: boxes = arrived, dNoTransport
- CANCEL_TRANSPORT :: Cancel the transport before collection :: boxes = sCancelTransport, dCancelLie
- STOP_TRANSPORT :: Stop the journey after collection :: boxes = sStopTransport
- RECORD_LEFT_DEPARTMENT :: Record that they have left the department :: boxes = edLeft
- RECORD_EXAMINATION :: Record an examination outcome :: boxes = dRevoked, rkExam, sAbandoned
- CHANGE_LEGAL_STATUS :: Change the legal status :: boxes = occupied, asked, rkLegalStatus
- RECORD_LEGAL_FORM_RECEIVED :: Mark a form as physically received :: boxes = occupied, rkForm
- CORRECT_LEGAL_FORM_RECEIPT :: Undo a form receipt :: boxes = occupied, rkForm
- RECORD_LEGAL_FORM_EXPIRY :: Record or extend a form's expiry :: boxes = occupied, rkForm, rkExpiryShut
- RECORD_MOVEMENT_GENDER :: Correct the recorded gender :: boxes = asked, pulled
- RECORD_LEAVING :: Record that the patient has left :: boxes = personLeaves, bedReleased, end0, end1, end2, end3, end4, end5, end6, end7
- RECORD_AWAY_AT_EMERGENCY_DEPARTMENT :: Record that they are away at an ED :: boxes = dAway
- RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT :: Record that they are back :: boxes = dAway
- RECORD_LEAVE_BED :: Record a bed as on leave :: boxes = dAway
- END_LEAVE_BED :: End a bed's leave :: boxes = dAway
- FLAG_BED_RELEASE :: Flag a bed as coming free :: boxes = bedReleased, ready
- CONFIRM_BED_RELEASE :: Confirm the discharge is going ahead :: boxes = bedReleased, ready
- REVERT_BED_RELEASE :: Put a confirmed discharge back to expected :: boxes = bedReleased, bedStuck, ready
- BLOCK_BED_RELEASE :: Flag a discharge as stuck :: boxes = bedStuck
- CLEAR_BED_RELEASE_BLOCK :: Clear the stuck flag :: boxes = bedStuck
- SET_BED_PREPARATION :: Mark a bed as being made ready :: boxes = bedReleased, rkPrep
- CONFIRM_CAPACITY :: Restate how many beds a ward has :: boxes = asked
- RECORD_WARD_INTAKE_CONSTRAINTS :: Record what is restricting a ward's intake :: boxes = asked
- REQUEST_CAPACITY_REFRESH :: Ask a ward to refresh its numbers :: boxes = asked
- CHANGE_URGENCY :: Change how urgent it is :: boxes = asked, rkUrgent
- FLAG_MOVEMENT_URGENT :: Flag it urgent :: boxes = asked, pulled, rkUrgent, rkQueue
- CLEAR_MOVEMENT_URGENT_FLAG :: Clear the urgent flag :: boxes = asked, pulled, rkUrgent
- RECORD_MOVEMENT_BLOCKER :: Say what is holding this up :: boxes = asked, pulled, handover
- CLEAR_MOVEMENT_BLOCKER :: Say nothing is holding it up :: boxes = asked, pulled, handover
- MARK_NOTICE_READ :: Mark a notice read :: boxes = rkNotice
- ACKNOWLEDGE_INBOX_ITEM :: Acknowledge an inbox row :: boxes = rkInbox
- COMPLETE_INBOX_ITEM :: Tick off an inbox row :: boxes = rkInbox
- REOPEN_INBOX_ITEM :: Reopen a completed row :: boxes = rkInbox
- ADVANCE_CLOCK :: Move the demonstration clock :: boxes = rkClock
- RESET_SCENARIO :: Reset the board :: boxes = NONE
- SET_SCENARIO :: Switch to a different simulated night :: boxes = NONE
- SET_CONFIGURATION :: Change the coordinator's settings :: boxes = rkSettings
- RECORD_PATIENT_DISCHARGE :: Record a patient’s physical departure :: boxes = rkDischarge, personLeaves
- OPEN_DISCHARGE_RECORD :: Open an authorised discharge record :: boxes = rkDischarge
- REVIEW_AUDIT_EVENT :: Record a governance review :: boxes = NONE
- RECORD_DIVERSION :: Divert a journey already under way :: boxes = rkDiversion
- RELEASE_DIVERTED_BED :: Give back the bed a diverted patient was holding :: boxes = rkDiversion
- SET_ARRIVAL_DETAILS :: Record how and when they are expected :: boxes = edExpected
- EVALUATE_ARRIVAL_LATENESS :: Work out whether an expected arrival is late :: boxes = edExpected
- SET_STEP_DOWN_CANDIDATE :: Mark somebody as a step-down candidate :: boxes = rkDischargePlan
- SET_DISCHARGE_BARRIER :: Record what is holding a discharge up :: boxes = rkDischargePlan
- UPDATE_EXPECTED_DISCHARGE :: Set or move the expected discharge date :: boxes = rkDischargePlan
- RECORD_ADMISSION_CARE :: Record care journey fact :: boxes = rkDischargePlan
- RECORD_ADMISSION_FOLLOW_UP :: Record follow-up arrangement :: boxes = rkDischargePlan
- RECORD_MOVEMENT_MEDICAL_CLEARANCE :: Record medical clearance against the movement :: boxes = rkClearance
- UPLOAD_PATIENT_FORM :: Attach a file to the movement :: boxes = rkLegalWritten
- RECORD_LEGAL_FORM_WRITTEN :: Record that a legal form was written :: boxes = rkLegalWritten
- RECORD_LEGAL_FORM_CONTINUATION :: Record that a form was continued :: boxes = rkLegalWritten
- RECORD_COUNTRY_EXTENSION :: Record a typed country Form 1A extension :: boxes = rkLegalWritten
- FLAG_LEGAL_MISMATCH :: Flag that the ward's authority does not match :: boxes = rkLegalMismatch
- RAISE_EXPECT_FLAG :: Start a forty-eight-hour or seven-day clock by hand :: boxes = rkExpectFlag
- CLEAR_EXPECT_FLAG :: Clear that hand-set clock :: boxes = rkExpectFlag
- RELEASE_AND_REOPEN_SEARCH :: Give the bed back and reopen the search, in one act :: boxes = sPullReleased
- CONFIRM_MORNING_ROLLUP :: Confirm the ward's morning count :: boxes = rkWardDay
- SEND_WARD_BUZZ :: Send a message to a ward :: boxes = rkWardDay
- EVALUATE_LEAVE_BED_WARNINGS :: Sweep the beds held during leave :: boxes = rkWardDay
- RECORD_REPATRIATION :: Log a repatriation arranged by phone :: boxes = dRepat
- RECORD_HANDOVER_SIGN_OFF :: Sign off the shift handover :: boxes = rkWardDay
- RECORD_CLINICAL_CONTACT :: Record that a team was contacted :: boxes = rkNotice
- DISPATCH_BROADCAST_ALERT :: Send a network-wide alert :: boxes = rkNotice
- ACKNOWLEDGE_BROADCAST_ALERT :: Acknowledge a network-wide alert :: boxes = rkNotice
- STAND_DOWN_BROADCAST_ALERT :: Stand down a network-wide alert :: boxes = rkNotice

## 11 STATE MACHINES
- A referral destination: states = raised | Waiting | Accepted | Declined | Cancelled | Withdrawn — a flag, not a state
- A movement: states = Movement created | Placement requested | Destination review | Accepted, awaiting bed | Bed pulled | Handover ready | Moving | Arrived | Closed — did not proceed
- An admission: states = No admission | Held | Occupied | Departed | Removed — not a state | Waitlisted
- A transport job: states = No job | Booked | Crew accepted | En route | Collected | Arrived | Deleted | Stopped
- A bed release: states = Not flagged | Expected | Confirmed | Discharged | Stuck — a flag, not a stage | Being made ready — a flag
- The front door — an expect becomes a referral: states = Raised | Expected to arrive | In the department | Medically cleared — or not
- A patient's legal status: states = Voluntary | Referred for psychiatric examination | Detained awaiting examination | Involuntary inpatient
- An examination: states = Not examined | Further examination ordered | Inpatient order | Community order, or revoked | Superseded
- A notice: states = Nothing sent | Raised, unread | Read
- A row in the coordinator's inbox: states = Not showing | Showing | Acknowledged | Commitment completed
- A legal form's receipt: states = Not recorded as received | Recorded as received | An expiry, typed by a clinician

## 74 WORD LISTS the map names
- DECLINE_REASONS
- SUPPORT_SERVICE_TYPES
- ARRIVAL_CHECKS
- BED_RELEASE_STATES
- BED_RELEASE_WAITING_ON
- HEALTH_SERVICES
- COHORTS
- BLOCKERS_MEANING_NOTHING_IS_BLOCKING
- SEXES
- RECORDED_SEXES
- URGENCY_LEVELS
- ATS_CATEGORIES
- TRAVEL_MODES
- ARRIVAL_MODES
- UPLOADED_FILE_TYPES
- SEX_DESIGNATIONS
- REFERRAL_GENDERS
- MOVEMENT_STAGES
- STEP_BACK_REASONS
- PAPER_EXPIRY_CORRECTION_REASONS
- LEGAL_FORM_MAKER_ROLES
- LEGAL_FORM_COPY_STATES
- LEGAL_FORM_ENDINGS
- LEGAL_FORM_CONSENT_STATES
- TRANSPORT_PROVIDERS
- TRANSPORT_LEGAL_STATUSES
- TRANSPORT_EXCEPTION_GAPS
- TRANSPORT_EXCEPTION_REASONS
- MOVEMENT_REFERRAL_ABSENCE_REASONS
- EXAMINATION_OUTCOMES
- ED_OUTCOMES
- REFERRAL_SOURCES
- REFERRAL_STATES
- COMMUNITY_DECLINE_REASONS
- HOME_REGIONS
- REFERRAL_DESTINATION_KINDS
- REFERRAL_PURPOSES
- COMMUNITY_REFERRAL_PURPOSES
- REFERRAL_ADDRESSING_STATES
- SUBURB_UNKNOWN_REASONS
- ABSENCE_STEPS
- URGENCY_CHANGE_REASONS
- LEGAL_STATUS_CHANGE_REASONS
- LEGAL_FORM_RECEIPT_CORRECTION_REASONS
- RELEASE_PULL_REASONS
- CANCEL_TRANSPORT_REASONS
- STOP_TRANSPORT_REASONS
- TRANSPORT_WHEREABOUTS
- DIVERSION_REASONS
- ESCALATION_CONTACTS
- BED_RELEASE_BLOCKERS
- WITHDRAWAL_REASONS
- WARD_REQUEST_WITHDRAWAL_REASONS
- OVERRIDE_REASONS
- REFERRAL_CAP_REASONS
- NOT_ON_SENDING_WARD_REASONS
- BED_PREPARATION_NOTES
- GENDER_PLACEMENT_REASONS
- URGENT_MARK_REASONS
- WARD_INTAKE_CONSTRAINTS
- DISCHARGE_DELAY_REASONS
- DISCHARGE_DELAY_CLEAR_REASONS
- ADMISSION_STATES
- FOLLOW_UP_STATES
- DISCHARGE_BARRIERS
- PULL_RELEASE_REASONS
- DISCHARGE_ROLE_LABELS
- PLANNED_ADMISSION_REASONS
- PLANNED_ADMISSION_CANCEL_REASONS
- PLANNED_ADMISSION_STATES
- RELEASE_BANDS
- GENDERS
- PATIENT_FIELDS
- ELIGIBILITY_GATES
# Current event catalogue, command models and route inventory

The route is selective. Its action notes and the additional command models have source review evidence; source digests detect later edits. This does not establish runtime or clinical acceptance.

## 194 CURRENT ENGINE EVENTS
Source-contract SHA256: 0873c62bf7c72255c924e82c939d36e74594ee43c51831c4d4ba4063b24262f0
- RECORD_ADMISSION_CARE — diagram-reviewed; event roles: ward, coordinator, community
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:20
  Event/dispatch reference: src/components/ward-management/ward-flow-protected-record-events.ts:213
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1580
- RECORD_ADMISSION_FOLLOW_UP — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:21
  Event/dispatch reference: src/components/ward-management/ward-flow-protected-record-events.ts:213
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1579
- RECORD_PATIENT_DISCHARGE — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:22
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1578
- UPDATE_EXPECTED_DISCHARGE — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:23
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:226
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1772
- OPEN_DISCHARGE_RECORD — diagram-reviewed; event roles: coordinator, ward, community, bed_manager
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:25
  Event/dispatch reference: src/components/ward-management/ward-flow-protected-record-events.ts:178
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1575
- REVIEW_AUDIT_EVENT — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:26
  Event/dispatch reference: src/components/ward-management/ward-flow-protected-record-events.ts:131
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1576
- RAISE_REFERRAL — diagram-reviewed; event roles: ed, community, ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:37
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1573
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-send-events.ts:92
- RECORD_EXAMINATION — diagram-reviewed; event roles: ed, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:38
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:549
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1872
- RECORD_MEDICAL_CLEARANCE — diagram-reviewed; event roles: ed, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:39
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:167
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1863
- RECORD_ARRIVED_IN_DEPARTMENT — diagram-reviewed; event roles: ed, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:43
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:216
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1864
- RECORD_TRANSPORT_NEED — diagram-reviewed; event roles: ed, ward, community, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:52
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:229
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1865
- RECORD_LEGAL_FORM_RECEIVED — diagram-reviewed; event roles: ed, ward, community, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:59
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:434
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1546
- CORRECT_LEGAL_FORM_RECEIPT — diagram-reviewed; event roles: ed, ward, community, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:65
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1853
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-send-events.ts:429
- RECORD_LEGAL_FORM_EXPIRY — diagram-reviewed; event roles: ed, coordinator, ward
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:75
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1358
  Event/dispatch reference: src/components/ward-management/ward-flow-record-legal-events.ts:52
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1869
- RECORD_MOVEMENT_GENDER — diagram-reviewed; event roles: ed, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:80
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:480
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1870
- RECORD_NO_REFERRAL — diagram-reviewed; event roles: ed, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:81
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:297
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1866
- RECORD_ED_OUTCOME — diagram-reviewed; event roles: ed, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:84
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:328
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1867
- REFER_TO_UNITS — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:85
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1855
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-send-events.ts:675
- ACCEPT_IN_PRINCIPLE — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:86
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:890
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-answer-events.ts:108
- PULL_PATIENT — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:90
  Event/dispatch reference: src/components/ward-management/ward-flow-placement-events.ts:79
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:694
- DECLINE — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:91
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1903
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-answer-events.ts:240
- HANDOVER_READY — diagram-reviewed; event roles: ed, community, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:94
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1997
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:85
- TRANSPORT_ACCEPTED — diagram-reviewed; event roles: officer, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:95
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1998
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:128
- TRANSPORT_EN_ROUTE — diagram-reviewed; event roles: officer, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:96
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1999
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:178
- PATIENT_COLLECTED — diagram-reviewed; event roles: officer, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:97
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2000
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:229
  Event/dispatch reference: src/components/ward-management/ward-transport-collection-events.ts:11
- PATIENT_ARRIVED — diagram-reviewed; event roles: officer, ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:98
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1603
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:315
- CONFIRM_CAPACITY — diagram-reviewed; event roles: ward, bed_manager, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:100
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:300
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1774
- RECORD_WARD_INTAKE_CONSTRAINTS — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:103
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:767
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1878
- RECORD_ESCALATION — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:104
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1065
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1885
- ADVANCE_CLOCK — diagram-reviewed; event roles: demo
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:105
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1817
- RESET_SCENARIO — diagram-reviewed; event roles: demo
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:106
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1595
- SET_SCENARIO — diagram-reviewed; event roles: demo
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:107
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1595
- SET_CONFIGURATION — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:109
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1828
- CHANGE_URGENCY — diagram-reviewed; event roles: coordinator, ed, ward, community
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:112
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1859
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-send-events.ts:1178
- CHANGE_LEGAL_STATUS — diagram-reviewed; event roles: coordinator, ed, ward, community
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:113
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1860
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-send-events.ts:1219
- RELEASE_PULL — diagram-reviewed; event roles: coordinator, ward
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:114
  Event/dispatch reference: src/components/ward-management/ward-flow-placement-events.ts:493
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1990
- EXTEND_PULL — modelled; event roles: coordinator, ward
  Reviewed command model (feature 11, 9 Nov 2026): the ward or coordinator adds a fixed amount to a pulled bed's Pull time limit.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:116
  Event/dispatch reference: src/components/ward-management/ward-flow-placement-events.ts:454
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1989
  Subject: One open movement whose bed is pulled now
  Before: A pulled bed with its Pull time limit
  After: The same pulled bed with a later Pull time limit and one more pullExtensions entry
  Scope: coordinator and ward in the role table; a ward acts only for the unit holding the bed (claim, not proof).
  payload: movementId; minutes (60, 120 or 240 from PULL_HOLD_EXTENSION_MINUTES); actingUnitId for a ward caller; now; role.
  guards: The movement exists, is not closed, is at stage pulled with a Pull time limit, and its patient has not been collected.
  guards: minutes is on the fixed list.
  guards: The new limit stays within PULL_HOLD_MAX_TOTAL_MINUTES (12 hours) of the pull; a lapsed limit is extended from now.
  effects: Moves Movement.pullExpiresAt later and appends { at, by, minutes } to Movement.pullExtensions; no bed count, stage or notice changes. PULL_PATIENT clears the list on a new pull.
  tests: tests/ward-extend-pull.test.ts
  Reviewed source: src/components/ward-management/ward-flow-placement-events.ts:454; SHA256 d03d664cb1f66c71f417fab7848bfbb308127dcb374dea22ffdeb14223d5e948
  Reviewed source: src/components/ward-management/ward-bed-hold-extension.ts:48; SHA256 668e77dbccc3fcaa5409abea768e539bb949659a919c68a81b0bfb4578cd04dc
- BOOK_TRANSPORT — diagram-reviewed; event roles: ed, ward, community, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:153
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2002
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:654
- CANCEL_TRANSPORT — diagram-reviewed; event roles: coordinator, ed, ward, community
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:175
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2003
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:840
- STOP_TRANSPORT — diagram-reviewed; event roles: coordinator, ed
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:185
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2004
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:1018
- RECORD_TRANSPORT_CAD — modelled; event roles: ed, ward, community, coordinator, officer
  Source-reviewed command model: Same job carrying a trimmed CAD number and cadAdded time/role.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:188
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2007
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:1131
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
  Reviewed source: src/components/ward-management/ward-flow-transport-events.ts:1126; SHA256 573cd3b2155de245658d45a432a45fd526cd829402d6b9c6b77ad8dc63f904cc
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:188; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-transport-collection-events.ts:30; SHA256 1ebf665a65645eb14f53647d07db90bef0a947b2a7e298f2b6f203b7c78d3496
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- RELEASE_HELD_BED — diagram-reviewed; event roles: coordinator, ward, ed
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:190
  Event/dispatch reference: src/components/ward-management/ward-flow-placement-events.ts:619
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1991
- RECORD_DIVERSION — diagram-reviewed; event roles: officer, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:192
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1092
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1886
- RELEASE_DIVERTED_BED — diagram-reviewed; event roles: coordinator, ward, ed
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:194
  Event/dispatch reference: src/components/ward-management/ward-flow-placement-events.ts:687
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1992
- REFER_TO_COMMUNITY_TEAM — diagram-reviewed; event roles: ed, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:195
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1854
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-send-events.ts:477
- RECORD_LEFT_DEPARTMENT — diagram-reviewed; event roles: ed, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:196
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:529
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1871
- FLAG_BED_RELEASE — diagram-reviewed; event roles: ward, bed_manager, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:199
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:372
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1775
- CONFIRM_BED_RELEASE — diagram-reviewed; event roles: ward, bed_manager, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:200
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:466
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1776
- REVERT_BED_RELEASE — diagram-reviewed; event roles: ward, bed_manager, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:204
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:505
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1777
- BLOCK_BED_RELEASE — diagram-reviewed; event roles: ward, bed_manager, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:205
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:544
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1778
- CLEAR_BED_RELEASE_BLOCK — diagram-reviewed; event roles: ward, bed_manager, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:206
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:584
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1779
- SET_BED_PREPARATION — diagram-reviewed; event roles: ward, bed_manager, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:207
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:621
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1780
- RECORD_LEAVE_BED — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:208
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1347
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:318
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1879
- END_LEAVE_BED — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:209
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:656
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1781
- RECORD_ABSENT_WITHOUT_LEAVE — modelled; event roles: ward, coordinator
  Source-reviewed command model: Leave-bed record carries absentWithoutLeave {since,steps:[]}; stay remains occupied.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:213
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1348
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:373
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1880
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
  Reviewed source: src/components/ward-management/ward-flow-record-stay-events.ts:373; SHA256 c3710e57ffa74c56374fd19198b2dd25941ae342206abe440657000ee1aae939
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:213; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-events.ts:1380; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- RECORD_ABSENCE_STEP — modelled; event roles: ward, coordinator
  Source-reviewed command model: Same absence with one timed step appended.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:214
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1349
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:425
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1881
  Subject: An existing absence without leave
  Before: Absence has no record of this listed missing-person step
  After: Same absence with one timed step appended
  Scope: Ward or coordinator; actingUnitId must equal the absence record’s unit. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: admissionId; actingUnitId; step from ABSENCE_STEPS; role and now
  guards: An absence record must exist for the admission
  guards: Step must be listed, not already recorded, and not earlier than absence.since
  effects: Appends {step,at} to absentWithoutLeave.steps; does not end absence, release a bed or contact anyone
  tests: tests/ward-absence-and-cto.test.ts
  Reviewed source: src/components/ward-management/ward-flow-record-stay-events.ts:425; SHA256 c3710e57ffa74c56374fd19198b2dd25941ae342206abe440657000ee1aae939
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:214; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-events.ts:1389; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- RECORD_COMMUNITY_TREATMENT_ORDER — modelled; event roles: community, coordinator
  Source-reviewed command model: Form 5A recorded with time and desk label; any ended order retained in earlier history.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:215
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1359
  Event/dispatch reference: src/components/ward-management/ward-flow-record-legal-events.ts:155
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1882
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
  Reviewed source: src/components/ward-management/ward-flow-record-legal-events.ts:155; SHA256 00105e89a350aa48ec39ce66907880bb7863bbc4cff2f4f31fc02ba659f1c6d9
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:215; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-events.ts:1398; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- END_COMMUNITY_TREATMENT_ORDER — modelled; event roles: community, coordinator
  Source-reviewed command model: Same order retained with endedAt=now.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:216
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:669
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1782
  Subject: A patient’s current community treatment order
  Before: Order exists and has no endedAt
  After: Same order retained with endedAt=now
  Scope: Community or coordinator. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: patientId; role and now
  guards: Patient and an unended order must exist; repeat ending is refused
  effects: Adds endedAt; retains the order and earlier history; no timer or automatic end
  effects: The step can be taken back by UNDO_PATIENT_RECORD within the Undo window, filed against the patient record.
  tests: tests/ward-absence-and-cto.test.ts
  Reviewed source: src/components/ward-management/ward-flow-bed-events.ts:667; SHA256 be57f071ee46dc50dc5c0ac2dd9474b8a75f474f65aa943661a8bd08d2ed8113
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:216; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-events.ts:1405; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- RECORD_LEAVING — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:220
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1343
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:123
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1601
- RECORD_AWAY_AT_EMERGENCY_DEPARTMENT — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:232
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1344
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:209
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1875
- RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:233
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1345
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:245
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1876
- RECORD_STAY_DISCHARGE_BLOCKER — modelled; event roles: ward, bed_manager, coordinator
  Source-reviewed command model: Stay blockReason and linked nondischarged releases carry the chosen blocker.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:236
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1346
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:265
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1877
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
  Reviewed source: src/components/ward-management/ward-flow-record-stay-events.ts:265; SHA256 c3710e57ffa74c56374fd19198b2dd25941ae342206abe440657000ee1aae939
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:236; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-events.ts:1838; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- CLEAR_STAY_DISCHARGE_BLOCKER — modelled; event roles: ward, bed_manager, coordinator
  Source-reviewed command model: Admission blockReason=null; clearance retained on matching pending release or admission.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:237
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:249
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1773
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
  Reviewed source: src/components/ward-management/ward-flow-bed-events.ts:247; SHA256 be57f071ee46dc50dc5c0ac2dd9474b8a75f474f65aa943661a8bd08d2ed8113
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:237; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-events.ts:1855; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- RECORD_OBSERVATION_LEVEL — modelled; event roles: ed, ward, coordinator
  Source-reviewed command model: Named target and any agreeing linked open counterpart carry the new observation and append from/to history.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:240
  Event/dispatch reference: src/components/ward-management/ward-flow-observation-events.ts:33
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1900
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
  Reviewed source: src/components/ward-management/ward-flow-observation-events.ts:33; SHA256 7e10fb51b2f76135bdfacbcd7643473e686dd0eb797e9e7906e427cdf26563cd
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:240; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-observation-events.ts:33; SHA256 7e10fb51b2f76135bdfacbcd7643473e686dd0eb797e9e7906e427cdf26563cd
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
  Reviewed source: src/components/ward-management/ward-observation.ts:48; SHA256 b714525f0d4c6d18d050f9a3600f38c8de4e9a013595a77844c5c492fbdc2e3c
- RECORD_MOVEMENT_BLOCKER — diagram-reviewed; event roles: ed, community, ward, coordinator, officer
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:280
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:710
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1874
- CLEAR_MOVEMENT_BLOCKER — diagram-reviewed; event roles: ed, community, ward, coordinator, officer
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:287
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2140
- FLAG_MOVEMENT_TURNAROUND_PRIORITY — modelled; event roles: coordinator
  Source-reviewed command model: Same movement carries {unitId,flaggedAt,source}; no bed is promised.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:308
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2027
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
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:2017; SHA256 7f16e741a6d120255f536b4f9571c4a8bdd8258f35909529a3514be1173baf8a
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:308; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-events.ts:692; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-turnaround-priority.ts:65; SHA256 f4a062f776b7e676eb045bd32daf9aac4a636392dab5599a571687cbf47db4b8
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- FLAG_REFERRAL_TURNAROUND_PRIORITY — modelled; event roles: coordinator
  Source-reviewed command model: Same referral carries {unitId,flaggedAt,source}; no bed is promised.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:309
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2028
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
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:2018; SHA256 7f16e741a6d120255f536b4f9571c4a8bdd8258f35909529a3514be1173baf8a
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:309; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-events.ts:701; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-turnaround-priority.ts:65; SHA256 f4a062f776b7e676eb045bd32daf9aac4a636392dab5599a571687cbf47db4b8
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- MARK_REFERRAL_OPENED — modelled; event roles: ward, coordinator
  Source-reviewed command model: Same copy has openedAt=now; answer state unchanged.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:312
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1910
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:312; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-events.ts:716; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- REQUEST_REFERRAL_INFORMATION — modelled; event roles: ward, coordinator
  Source-reviewed command model: New listed needs appended; existing open needs retained without duplication.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:313
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1911
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:313; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-events.ts:729; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- MARK_REFERRAL_INFORMATION_MET — modelled; event roles: ed, community, ward, coordinator
  Source-reviewed command model: Selected open request(s) stamped metAt and metBy; checklist history retained.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:315
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1912
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:315; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-events.ts:740; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- ASSIGN_REFERRAL — modelled; event roles: coordinator, ed, community
  Source-reviewed command model: ownerHistory appended; its last owner is the current chasing desk.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:318
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1918
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:318; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-events.ts:764; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
  Reviewed source: src/components/ward-management/referrals/referral-owner-and-calls-model.ts:28; SHA256 783d84f0aa1cc62b1f388bfabaa637c851ef47570a4ebfefc94406d550e4bde3
- LOG_REFERRAL_CONTACT — modelled; event roles: coordinator, ed, community
  Source-reviewed command model: New checked contact/outcome entry appended.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:319
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1919
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:319; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-events.ts:779; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
  Reviewed source: src/components/ward-management/referrals/referral-owner-and-calls-model.ts:28; SHA256 783d84f0aa1cc62b1f388bfabaa637c851ef47570a4ebfefc94406d550e4bde3
- RECORD_REFERRAL_COMMITMENT — modelled; event roles: coordinator, ward
  Source-reviewed command model: Checked step/promise/callback entry appended without answering referral.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:321
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1926
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:321; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-events.ts:796; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
  Reviewed source: src/components/ward-management/referrals/referral-owner-and-calls-model.ts:28; SHA256 783d84f0aa1cc62b1f388bfabaa637c851ef47570a4ebfefc94406d550e4bde3
  Reviewed source: src/components/ward-management/referrals/referral-commitments-model.ts:73; SHA256 b8ad888efb64576aa225df86d86b58d9e31306fda7791fe9815a00a4c6c82325
- ASK_MORE_WARDS — modelled; event roles: coordinator
  Source-reviewed command model: Additional named wards queued, preserving existing destinations.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:322
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1932
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:322; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-referral-ask-events.ts:24; SHA256 d3c249774b280ef5c1b57d1f4c7575d2dce9ef721ec1f85ed2ac2c53e7874d08
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
  Reviewed source: src/components/ward-management/referrals/referral-owner-and-calls-model.ts:28; SHA256 783d84f0aa1cc62b1f388bfabaa637c851ef47570a4ebfefc94406d550e4bde3
- CLOSE_WARD_TO_ADMISSIONS — modelled; event roles: ward, bed_manager, coordinator
  Source-reviewed command model: isClosed=true with admissionsClosure reason/time/desk and optional expected reopening.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:325
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1939
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:325; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-events.ts:815; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- REOPEN_WARD_TO_ADMISSIONS — modelled; event roles: ward, bed_manager, coordinator
  Source-reviewed command model: isClosed=false; admissionsClosure removed.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:326
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1940
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:326; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-events.ts:826; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- SET_BED_CLOSED — modelled; event roles: ward, bed_manager, coordinator
  Source-reviewed command model: closed=true appends a mark; closed=false stamps active mark reopenedAt.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:328
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-closure-events.ts:24
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1943
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:328; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-events.ts:834; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- RECORD_BED_MEETING_ACTION — modelled; event roles: coordinator
  Source-reviewed command model: meetingActions appended with chosen task, owner and due time.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:333
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-meeting-events.ts:30
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1977
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:333; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-events.ts:850; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- COMPLETE_BED_MEETING_ACTION — modelled; event roles: coordinator, ward, ed, community
  Source-reviewed command model: Same action stamped doneAt and doneBy.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:334
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-meeting-events.ts:105
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1978
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:334; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-events.ts:865; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- RECORD_RESTRICTIVE_PRACTICE_START — modelled; event roles: ward, coordinator
  Source-reviewed command model: New episode with typed start and recording metadata appended.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:338
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1950
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:338; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/restrictive-practice/ward-restrictive-practice.ts:136; SHA256 c605b305700a3df7cb0e8f7f1f923ac844971e33743d4227b677773e9ec056aa
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- RECORD_RESTRICTIVE_PRACTICE_END — modelled; event roles: ward, coordinator
  Source-reviewed command model: Same episode stamped with typed endedAt.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:339
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1951
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:339; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/restrictive-practice/ward-restrictive-practice.ts:147; SHA256 c605b305700a3df7cb0e8f7f1f923ac844971e33743d4227b677773e9ec056aa
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- RECORD_RESTRICTIVE_PRACTICE_FOLLOW_UP — modelled; event roles: ward, coordinator
  Reviewed command model: marks or clears one follow-up task on an ended restrictive-practice episode.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:341
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1952
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
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:1942; SHA256 7f16e741a6d120255f536b4f9571c4a8bdd8258f35909529a3514be1173baf8a
  Reviewed source: src/components/ward-management/ward-flow-restrictive-practice-events.ts:109; SHA256 5e2f0d1e4b5e3a3415d5114400ba622bb5e83a84787491e7a93f4f5a3c7f935b
- RECORD_WARD_INCIDENT — modelled; event roles: ward, coordinator
  Source-reviewed command model: New category/time incident appended.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:342
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1953
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:342; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/restrictive-practice/ward-restrictive-practice.ts:160; SHA256 c605b305700a3df7cb0e8f7f1f923ac844971e33743d4227b677773e9ec056aa
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- SET_SECLUSION_ROOM_STATUS — modelled; event roles: ward, bed_manager, coordinator
  Source-reviewed command model: seclusionRoom replaced with status, time and desk label.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:343
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1954
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:343; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/restrictive-practice/ward-restrictive-practice.ts:184; SHA256 c605b305700a3df7cb0e8f7f1f923ac844971e33743d4227b677773e9ec056aa
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- MARK_CANCELLED_MOVE_CHECK — modelled; event roles: coordinator, ward
  Source-reviewed command model: Selected item’s mark replaced with addressed/not_applicable and time/desk.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:347
  Event/dispatch reference: src/components/ward-management/ward-flow-loop-check-events.ts:58
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1965
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:347; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/loop-checks/ward-loop-checks.ts:225; SHA256 67b1b35eaafcde31aa39f6d2f2e7a73aa9ae18859d17dd777426ba9a78404921
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- RECORD_ACCEPTANCE_CONDITION — modelled; event roles: coordinator, ward
  Source-reviewed command model: New condition appended tied to acceptedUnitId and acceptedAt.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:348
  Event/dispatch reference: src/components/ward-management/ward-flow-loop-check-events.ts:79
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1966
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:348; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/loop-checks/ward-loop-checks.ts:239; SHA256 67b1b35eaafcde31aa39f6d2f2e7a73aa9ae18859d17dd777426ba9a78404921
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- MARK_ACCEPTANCE_CONDITION_MET — modelled; event roles: coordinator, ward
  Source-reviewed command model: Condition retained with met {at,by}.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:349
  Event/dispatch reference: src/components/ward-management/ward-flow-loop-check-events.ts:80
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1967
  Subject: A current acceptance’s unmet condition
  Before: Open accepted move has this current condition not met
  After: Condition retained with met {at,by}
  Scope: Coordinator or the accepting ward. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: movementId; listed condition; actingUnitId for ward; role and now
  guards: Movement open and accepted; selected current condition exists and is not already met
  effects: Stamps met on that exact condition; leaves stage, placement, capacity and acceptance unchanged
  tests: tests/ward-loop-checks.test.ts
  Reviewed source: src/components/ward-management/ward-flow-loop-check-events.ts:80; SHA256 ff8c33075771176af7fe4b39fee199eb3da5c97591401997d25b0455b83f5868
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:349; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/loop-checks/ward-loop-checks.ts:250; SHA256 67b1b35eaafcde31aa39f6d2f2e7a73aa9ae18859d17dd777426ba9a78404921
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- RECORD_RESTRICTION_REVIEW — modelled; event roles: ward, bed_manager, coordinator
  Source-reviewed command model: One current review for restriction recorded/replaced.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:350
  Event/dispatch reference: src/components/ward-management/ward-flow-loop-check-events.ts:139
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1968
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:350; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/loop-checks/ward-loop-checks.ts:262; SHA256 67b1b35eaafcde31aa39f6d2f2e7a73aa9ae18859d17dd777426ba9a78404921
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- MARK_CLOSURE_TRANSITION_ITEM — modelled; event roles: ward, bed_manager, coordinator
  Source-reviewed command model: Closure transitionMarks appended with current derived item and recording metadata.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:351
  Event/dispatch reference: src/components/ward-management/ward-flow-loop-check-events.ts:169
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1969
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:351; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/loop-checks/ward-loop-checks.ts:276; SHA256 67b1b35eaafcde31aa39f6d2f2e7a73aa9ae18859d17dd777426ba9a78404921
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- FLAG_MOVEMENT_URGENT — diagram-reviewed; event roles: coordinator, ed
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:352
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2080
- CLEAR_MOVEMENT_URGENT_FLAG — diagram-reviewed; event roles: coordinator, ed
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:353
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2104
- WITHDRAW_REFERRAL — diagram-reviewed; event roles: ed, community, ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:373
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1856
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-send-events.ts:883
- REQUEST_CAPACITY_REFRESH — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:376
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:684
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1783
- RECEIVE_REFERRAL — diagram-reviewed; event roles: community, ed, ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:391
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1904
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-answer-events.ts:362
- ADD_PATIENT — diagram-reviewed; event roles: ed, community, ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:395
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1792
  Event/dispatch reference: src/components/ward-management/ward-patient-registration-reducer.ts:39
- ARCHIVE_PATIENT — modelled; event roles: coordinator
  Source-reviewed command model: Patient removed from active patients list (withdrawn-only referrals unlinked, D-149); audit event and sequence retained.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:397
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1794
  Event/dispatch reference: src/components/ward-management/ward-patient-archive-reducer.ts:10
  Subject: An erroneous standalone patient registration
  Before: Patient has only registration fields, and nothing else names it except withdrawn or cancelled front-door referrals, audit rows, or Undo records older than the Undo window (D-149)
  After: Patient removed from active patients list; audit event and sequence retained
  Scope: Coordinator only, with shared record scope applied. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: patientId; reason from PATIENT_ARCHIVE_REASONS (duplicate, test, wrong_person); role and now
  guards: Patient must exist; listed archive reason
  guards: Registration facts include the optional typed details (preferred name, address, GP, catchment team, interpreter language, Indigenous status, and the ADMIN_DETAIL_FIELDS administrative details); refuse any non-registration fact, any open or answered referral, or any other state reference. D-149 (Josh, 11 Nov 2026): a front-door referral whose every destination was withdrawn by the referrer or cancelled does not block, audit rows do not block, and an Undo record blocks only while it is inside the Undo window (measured from the event's now). Each refusal names its reason, and the coordinator's card shows it instead of hiding
  effects: Filters patient from patients; keeps sequence so id is not reused
  effects: D-149: a withdrawn or cancelled referral that named the record stays in the referrals list with its patientId removed, so the stored workspace still validates
  effects: Reducer audit wrapper retains the archive event/reason; no care record is removed
  effects: The step can be taken back by UNDO_PATIENT_RECORD within the Undo window.
  tests: tests/ward-patient-archive.test.ts
  Reviewed source: src/components/ward-management/ward-patient-archive-reducer.ts:10; SHA256 fbe91ef4b0daad593da3144d30e40c65803851a4f31337bf61bd3004038c1900
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:397; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-patient-archive.ts:32; SHA256 9677f94adeb0eedb1a1b2b9e8f0c3f4bc36236e91f95f97f5d9198f56f8d1324
  Reviewed source: src/components/ward-management/ward-patient-archive.ts:54; SHA256 9677f94adeb0eedb1a1b2b9e8f0c3f4bc36236e91f95f97f5d9198f56f8d1324
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- ACCEPT_REFERRAL — diagram-reviewed; event roles: ward, coordinator, ed, community
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:427
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:873
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-answer-events.ts:728
- HOLD_REFERRAL_BED — modelled; event roles: ward, coordinator
  Source-reviewed command model: Same arm carries chosen heldBedNumber.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:428
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1906
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-answer-events.ts:695
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
  Reviewed source: src/components/ward-management/ward-flow-referral-answer-events.ts:680; SHA256 aa1c1e1bdf49c3e38ce3ca99d5e92e542e0d2956c43b9befa32e6915def5d7dc
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:428; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-flow-events.ts:1538; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- DECLINE_REFERRAL — diagram-reviewed; event roles: ward, coordinator, ed, community
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:439
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1907
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-answer-events.ts:1148
- RECORD_LOCAL_BED_SOUGHT — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:445
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1045
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1884
- RECORD_REFERRER_WITHDRAWAL — diagram-reviewed; event roles: coordinator, community, ed, ward
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:477
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:801
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1883
- ADD_REFERRAL_CORRECTION — diagram-reviewed; event roles: community, ed, ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:484
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1858
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-send-events.ts:1124
- STEP_BACK_STAGE — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:491
  Event/dispatch reference: src/components/ward-management/ward-flow-placement-events.ts:751
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1993
- WITHDRAW_ACCEPTANCE — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:492
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1908
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-answer-events.ts:1308
- WITHDRAW_WARD_REQUEST — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:495
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1857
  Event/dispatch reference: src/components/ward-management/ward-flow-referral-send-events.ts:1069
- MARK_NOTICE_READ — diagram-reviewed; event roles: coordinator, ed, ward, officer, community, bed_manager
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:505
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2189
  Event/dispatch reference: src/components/ward-management/ward-inbox-reducer.ts:290
- ACKNOWLEDGE_INBOX_ITEM — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:526
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2190
  Event/dispatch reference: src/components/ward-management/ward-inbox-events.ts:41
  Event/dispatch reference: src/components/ward-management/ward-inbox-reducer.ts:312
- COMPLETE_INBOX_ITEM — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:527
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2191
  Event/dispatch reference: src/components/ward-management/ward-inbox-events.ts:71
  Event/dispatch reference: src/components/ward-management/ward-inbox-reducer.ts:349
- REOPEN_INBOX_ITEM — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:528
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2192
  Event/dispatch reference: src/components/ward-management/ward-inbox-events.ts:99
  Event/dispatch reference: src/components/ward-management/ward-inbox-reducer.ts:384
- TAKE_INBOX_ITEM_OWNERSHIP — modelled; event roles: coordinator
  Source-reviewed command model: Ownership history appended; current owner is acting role’s label.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:530
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2193
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:530; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-inbox-events.ts:111; SHA256 c3c63fd47887f9bbabdefc8aa6b6742f72848bc9f744afa55b2aa7efd80f037c
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
  Reviewed source: src/components/ward-management/ward-inbox-snooze.ts:84; SHA256 eda403a5e8fbf768036d873898501882422dad29ebc3c7362c7766a10daaf1dd
- RELEASE_INBOX_ITEM_OWNERSHIP — modelled; event roles: coordinator
  Source-reviewed command model: Ownership history appended with kind=released; ownership relinquished.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:531
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2194
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:531; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-inbox-events.ts:121; SHA256 c3c63fd47887f9bbabdefc8aa6b6742f72848bc9f744afa55b2aa7efd80f037c
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
  Reviewed source: src/components/ward-management/ward-inbox-snooze.ts:84; SHA256 eda403a5e8fbf768036d873898501882422dad29ebc3c7362c7766a10daaf1dd
- SNOOZE_INBOX_ITEM — modelled; event roles: coordinator
  Source-reviewed command model: Latest snoozed entry hides row until chosen return time while fact remains.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:532
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2195
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:532; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-inbox-events.ts:133; SHA256 c3c63fd47887f9bbabdefc8aa6b6742f72848bc9f744afa55b2aa7efd80f037c
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
  Reviewed source: src/components/ward-management/ward-inbox-snooze.ts:84; SHA256 eda403a5e8fbf768036d873898501882422dad29ebc3c7362c7766a10daaf1dd
- UNSNOOZE_INBOX_ITEM — modelled; event roles: coordinator
  Source-reviewed command model: Snooze history appended with kind=returned; active snooze ends now.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:533
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2196
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:533; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-inbox-events.ts:142; SHA256 c3c63fd47887f9bbabdefc8aa6b6742f72848bc9f744afa55b2aa7efd80f037c
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
  Reviewed source: src/components/ward-management/ward-inbox-snooze.ts:84; SHA256 eda403a5e8fbf768036d873898501882422dad29ebc3c7362c7766a10daaf1dd
- SET_ARRIVAL_DETAILS — diagram-reviewed; event roles: coordinator, ed, ward, community
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:534
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2005
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:1170
- SET_STEP_DOWN_CANDIDATE — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:535
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:704
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1784
- RECORD_WARD_DIAGNOSIS — modelled; event roles: ward, coordinator
  Reviewed command model: Latest ward diagnosis block with recording time and desk.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:537
  Event/dispatch reference: src/components/ward-management/ward-flow-diagnosis-events.ts:14
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2357
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:537; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- MARK_WEEKEND_DISCHARGE_REVIEWED — modelled; event roles: ward, coordinator
  Reviewed command model: Weekend discharge review tick with weekend, time and desk.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:539
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2359
  Event/dispatch reference: src/components/ward-management/ward-flow-weekend-review-events.ts:15
  Subject: One current inpatient admission
  Before: No review tick for this weekend
  After: Weekend discharge review tick with weekend, time and desk
  Scope: ward or coordinator. A ward must name the admission's own unit; authenticated scoped access must also permit the admission.
  payload: admissionId; weekendStart instant; now and role; actingUnitId when acting as ward.
  guards: Admission exists and is pulled or occupied.
  guards: Weekend is within a week of now and not already ticked.
  effects: Appends to admission.weekendDischargeReviews only; changes no date, bed or plan.
  tests: tests/ward-weekend-discharge-review.test.ts
  Reviewed source: src/components/ward-management/ward-flow-weekend-review-events.ts:23; SHA256 1360db583261541d85f5978b485e46777413053f2ab988012b22b8aac4280ab2
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:539; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- RECORD_CHIEF_PSYCHIATRIST_NOTIFIED — modelled; event roles: ward, coordinator
  Source-reviewed command model: records the typed time the Chief Psychiatrist was told a person under 18 is on an adult ward; information only (item 4, held).
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:541
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2360
  Event/dispatch reference: src/components/ward-management/ward-flow-under-18-events.ts:14
  Subject: One current stay's chiefPsychiatristNotice
  Before: Pulled or occupied stay with or without an earlier notice record
  After: chiefPsychiatristNotice {notifiedAt, at, by} replaces any earlier one
  Scope: Ward for its own stay, or coordinator. EVENT_ROLE alone is not place authority.
  payload: admissionId; actingUnitId; notifiedAt (typed, never pre-filled, D-93)
  payload: role and now
  guards: Unknown admission, another ward's stay, or a stay that is not current refused
  guards: Non-finite times, or a notified time later than now, refused
  effects: Quietens the under 18 on an adult ward notice; computes no deadline and blocks no bed offer
  effects: A transfer starts the receiving stay without it
  tests: tests/ward-item4-under-18-adult-ward.dom.test.tsx
  Reviewed source: src/components/ward-management/ward-flow-under-18-events.ts:22; SHA256 040429c9d51419da086ae64aae4b653e5b0251d906ebde5a79fa77c66f33500d
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:541; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
- SET_DISCHARGE_BARRIER — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:542
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:727
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1785
- SET_CLINICALLY_READY — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:544
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:757
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1786
- SET_DISCHARGE_CRITERIA — modelled; event roles: ward, coordinator
  Reviewed command model: Criteria set/reviewed, cleared, or one stored criterion ticked/unticked.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:545
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:800
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1787
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
  Reviewed source: src/components/ward-management/ward-flow-bed-events.ts:753; SHA256 be57f071ee46dc50dc5c0ac2dd9474b8a75f474f65aa943661a8bd08d2ed8113
  Reviewed source: src/components/ward-management/ward-discharge-criteria.ts:271; SHA256 70e720fb09a6a8bd9ab6952b29e786e949b7c635b3eded6a97c9be8582648c5b
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2114; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- RECORD_ED_MEDICAL_DETERIORATION — modelled; event roles: ed, coordinator
  Reviewed command model: placement_requested, medically uncleared and explicitly paused; acceptance and reservation removed.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:546
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1165
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1887
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
  Reviewed source: src/components/ward-management/ward-flow-record-events.ts:1165; SHA256 901a830650fc830bfa41e4351b15fcea7e71bf475cc389ac2ece99fe698c4e06
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2134; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- RECORD_MOVEMENT_MEDICAL_CLEARANCE — diagram-reviewed; event roles: ed, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:547
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1271
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1888
- UPLOAD_PATIENT_FORM — diagram-reviewed; event roles: coordinator, ed, ward, community, officer
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:548
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:818
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1788
- RECORD_LEGAL_FORM_WRITTEN — diagram-reviewed; event roles: ed, coordinator, ward
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:550
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1360
  Event/dispatch reference: src/components/ward-management/ward-flow-record-legal-events.ts:275
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1889
- RECORD_LEGAL_FORM_CODE — modelled; event roles: ed, coordinator, ward
  Reviewed command model: Chosen form code without an invented written time.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:552
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1361
  Event/dispatch reference: src/components/ward-management/ward-flow-record-legal-events.ts:274
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1890
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
  Reviewed source: src/components/ward-management/ward-flow-record-legal-events.ts:274; SHA256 00105e89a350aa48ec39ce66907880bb7863bbc4cff2f4f31fc02ba659f1c6d9
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2168; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-access-state.ts:841; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- RECORD_ED_PRESENTATION — modelled; event roles: ed, coordinator
  Reviewed command model: Canonical fixed-list choices, or field removed for an empty selection.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:554
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1362
  Event/dispatch reference: src/components/ward-management/ward-flow-record-legal-events.ts:205
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1891
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
  Reviewed source: src/components/ward-management/ward-flow-record-legal-events.ts:205; SHA256 00105e89a350aa48ec39ce66907880bb7863bbc4cff2f4f31fc02ba659f1c6d9
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2194; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-undo.ts:92; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- RECORD_LEGAL_FORM_DETAILS — modelled; event roles: ed, coordinator, ward
  Reviewed command model: records the written legal form's typed details on the movement's current form.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:556
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1363
  Event/dispatch reference: src/components/ward-management/ward-flow-record-legal-events.ts:222
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1892
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
  Reviewed source: src/components/ward-management/ward-flow-record-events.ts:96; SHA256 901a830650fc830bfa41e4351b15fcea7e71bf475cc389ac2ece99fe698c4e06
  Reviewed source: src/components/ward-management/ward-flow-record-legal-events.ts:222; SHA256 00105e89a350aa48ec39ce66907880bb7863bbc4cff2f4f31fc02ba659f1c6d9
- RECORD_COUNTRY_EXTENSION — diagram-reviewed; event roles: ed, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:557
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1364
  Event/dispatch reference: src/components/ward-management/ward-flow-record-legal-events.ts:382
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1893
- RECORD_LEGAL_FORM_CONTINUATION — diagram-reviewed; event roles: ed, coordinator, ward, community
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:558
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1365
  Event/dispatch reference: src/components/ward-management/ward-flow-record-legal-events.ts:415
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1894
- EVALUATE_ARRIVAL_LATENESS — diagram-reviewed; event roles: coordinator, ed, ward
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:559
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2006
  Event/dispatch reference: src/components/ward-management/ward-flow-transport-events.ts:1260
- RELEASE_AND_REOPEN_SEARCH — diagram-reviewed; event roles: coordinator, ward
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:560
  Event/dispatch reference: src/components/ward-management/ward-flow-placement-events.ts:813
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1994
- CLEAR_EXPECT_FLAG — diagram-reviewed; event roles: ward, coordinator, ed, community
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:561
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2202
- REQUEST_PSYCH_REVIEW — modelled; event roles: ed, coordinator
  Reviewed command model (9 Nov 2026): the emergency department records that a psychiatric review was asked for; a time only, nothing ordered or scored.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:563
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2216
  Event/dispatch reference: src/components/ward-management/ward-flow-review-ready-events.ts:16
  Subject: One open movement
  Before: No psychReview recorded
  After: psychReview.requestedAt = now
  Scope: ED or coordinator (EVENT_ROLE); shared command scope checks the movement as for other movement commands.
  payload: movementId
  payload: role and now
  guards: Movement must exist and not be closed
  guards: Refused when a review is already asked for
  effects: Writes psychReview.requestedAt only; the ED Awaiting review list keeps its order
  effects: Undone by UNDO_ED_STEP
  tests: tests/ward-psych-review-ready-next.test.ts
  tests: tests/ward-event-permissions.test.ts
  Reviewed source: src/components/ward-management/ward-flow-review-ready-events.ts:61; SHA256 c8c07485713088517586cb0556d07e0a8ac812413934ba064f12d412b00936f4
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:2213; SHA256 7f16e741a6d120255f536b4f9571c4a8bdd8258f35909529a3514be1173baf8a
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:563; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
- RECORD_PSYCH_REVIEW_SEEN — modelled; event roles: ed, coordinator
  Reviewed command model (9 Nov 2026): records that the registrar or consultant saw the person for the review asked for; a time only.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:564
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2217
  Event/dispatch reference: src/components/ward-management/ward-flow-review-ready-events.ts:23
  Subject: One open movement with a review asked for
  Before: psychReview without the named grade seen
  After: psychReview.registrarSeenAt or consultantSeenAt = now
  Scope: ED or coordinator (EVENT_ROLE); shared command scope checks the movement.
  payload: movementId; grade registrar or consultant
  payload: role and now
  guards: Movement must exist and not be closed
  guards: Grade from PSYCH_REVIEW_GRADES
  guards: A review must have been asked for; each grade recorded once
  effects: Writes the seen time only; no examination, placement or order follows
  effects: Undone by UNDO_ED_STEP
  tests: tests/ward-psych-review-ready-next.test.ts
  tests: tests/ward-event-permissions.test.ts
  Reviewed source: src/components/ward-management/ward-flow-review-ready-events.ts:69; SHA256 c8c07485713088517586cb0556d07e0a8ac812413934ba064f12d412b00936f4
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:2214; SHA256 7f16e741a6d120255f536b4f9571c4a8bdd8258f35909529a3514be1173baf8a
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:564; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
- MARK_WARD_READY_FOR_NEXT — modelled; event roles: ward, coordinator
  Reviewed command model (9 Nov 2026): a ward says it is ready for its next patient, or cancels that; a fact for the coordinator, who still pulls by hand.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:565
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2218
  Event/dispatch reference: src/components/ward-management/ward-flow-review-ready-events.ts:31
  Subject: One ward
  Before: readyForNextAt absent (or present, for cancel)
  After: Unit.readyForNextAt = now, or removed on cancel
  Scope: Ward for itself or coordinator (EVENT_ROLE); shared command scope checks the unit.
  payload: unitId; optional cancel
  payload: actingUnitId for ward; role and now
  guards: Ward acts only for itself
  guards: Unit must exist
  guards: Mark refused when closed to admissions or already marked; cancel refused when not marked
  effects: Coordinator Home shows the ward and the first on its wait list as a fact; nothing is pulled
  effects: A PULL_PATIENT into the ward clears the mark
  tests: tests/ward-psych-review-ready-next.test.ts
  tests: tests/ward-event-permissions.test.ts
  Reviewed source: src/components/ward-management/ward-flow-review-ready-events.ts:84; SHA256 c8c07485713088517586cb0556d07e0a8ac812413934ba064f12d412b00936f4
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:2215; SHA256 7f16e741a6d120255f536b4f9571c4a8bdd8258f35909529a3514be1173baf8a
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:565; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
- RAISE_EXPECT_FLAG — diagram-reviewed; event roles: ward, coordinator, ed, community
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:566
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2227
- FLAG_LEGAL_MISMATCH — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:567
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2249
- EVALUATE_LEAVE_BED_WARNINGS — diagram-reviewed; event roles: ward, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:568
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:862
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1789
- CONFIRM_MORNING_ROLLUP — diagram-reviewed; event roles: ward, bed_manager, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:569
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2272
- SEND_WARD_BUZZ — diagram-reviewed; event roles: coordinator, bed_manager
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:570
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2303
- RECORD_REPATRIATION — diagram-reviewed; event roles: coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:572
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1351
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:479
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1896
- RECORD_HOME_SERVICE_RETURN — modelled; event roles: coordinator
  Reviewed command model: Fresh requested record, or request with agreed/not_yet_agreed/declined answer.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:574
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2365
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
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:2351; SHA256 7f16e741a6d120255f536b4f9571c4a8bdd8258f35909529a3514be1173baf8a
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:572; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- FLAG_RETURN_EARLY — modelled; event roles: coordinator
  Reviewed command model: the coordinator flags an out-of-area stay as ready to return early to a home hospital.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:576
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2370
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
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:410; SHA256 7f16e741a6d120255f536b4f9571c4a8bdd8258f35909529a3514be1173baf8a
  Reviewed source: src/components/ward-management/out-of-area/return-early.ts:70; SHA256 28c9ec25e8d1fc5808db7af91d11f76ce64b235c292fdddfa60d1423ac2eedb3
- RECORD_DIRECTORY_CHECK — modelled; event roles: coordinator, bed_manager, ward, ed, community, officer
  Reviewed command model: Latest {entryId, at, by} check for that identifier.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:578
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2367
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
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:576; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:2386; SHA256 7f16e741a6d120255f536b4f9571c4a8bdd8258f35909529a3514be1173baf8a
- RECORD_HANDOVER_SIGN_OFF — diagram-reviewed; event roles: coordinator, ward
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:581
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1350
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:458
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1895
- RECORD_SITE_HANDOVER_SIGN_OFF — modelled; event roles: bed_manager, coordinator
  Reviewed command model: Site sign-off with a snapshot of unsigned wards and unanswered bed calls.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:585
  Event/dispatch reference: src/components/ward-management/site-sign-off/site-handover-sign-off-reducer.ts:28
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2373
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
  Reviewed source: src/components/ward-management/ward-access-state.ts:696; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:583; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
- RECORD_TRIAGE_SIGNED — modelled; event roles: ed, community, ward, coordinator
  Reviewed command model (7 Nov 2026): a clinician signs a mental health triage and risk assessment (SMHMR900 and SMHMR905) for one person; closed-list codes only, never typed text.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:589
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2379
  Subject: One person on this workspace
  Before: No signed triage, or earlier signed triages, on the person
  After: One more signed triage record on the person: time, desk role and closed-list codes
  Scope: ed, community, ward and coordinator in the role table, the same desks as RAISE_REFERRAL; a shared desk is sent a record only with a person it is sent.
  payload: patientId; now; role; urgency (A to G); outcome (listed); legal (listed code); review (listed code); flags (RAMP factor keys marked present); problems and actions (webPSOLIS list codes, in the order chosen); venue and referralType (webPSOLIS list code or null).
  guards: The person exists on this workspace.
  guards: Urgency is one of A to G.
  guards: Outcome, legal status and review are each from their fixed lists.
  guards: Every flag is a RAMP factor key; unknown fields are dropped.
  guards: Problems and actions are arrays of at most 60 codes from their webPSOLIS lists (kept once each, in the order chosen); venue and referral type are null or a code from their list. Typed text is refused.
  effects: Appends a triages record (codes only); the patient record's Now tab lists it. No Undo: it is a signed record. Typed text (assessment, mental state, formulation, plan) stays in the form and is never in the event.
  tests: tests/ward-triage-signed.test.ts
  tests: tests/ward-event-permissions.test.ts
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:2378; SHA256 7f16e741a6d120255f536b4f9571c4a8bdd8258f35909529a3514be1173baf8a
  Reviewed source: src/components/ward-management/triage/triage-signed-reducer.ts:46; SHA256 88ebffb9dc86dd544d9bdac7f561fcf4998a3af62d9a19ffe4211c5325142666
  Reviewed source: src/components/ward-management/ward-access-state.ts:338; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- REQUEST_WARD_STAFF — modelled; event roles: ward, coordinator, bed_manager
  Source-reviewed command model: one open staff request per ward per shift, added or updated in place.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:593
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2375
  Subject: A ward's staff request for this shift or next shift
  Before: Known ward; no open request for that ward and shift, or one to update
  After: staffRequests holds one open request for the ward and shift with count and ordered reasons
  Scope: Ward, coordinator or site bed manager in EVENT_ROLE; a ward acts only for its own ward (actingUnitId must equal unitId). Executive changes nothing (D-80). Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: unitId; shift this or next; count 1, 2, 3 or 4 or more
  payload: reasons: one or more distinct items from STAFF_REQUEST_REASONS; actingUnitId for ward callers; role and now
  guards: Known unit; shift and count from their lists
  guards: Reject empty, duplicate or unlisted reasons, and a ward naming another ward
  effects: Appends a record, or updates count, reasons and updatedAt on the open one; never names a patient
  effects: Does not change beds, placement, movements or any patient stage
  tests: tests/ward-staff-requests.test.ts
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:2375; SHA256 7f16e741a6d120255f536b4f9571c4a8bdd8258f35909529a3514be1173baf8a
  Reviewed source: src/components/ward-management/staffing/staff-requests.ts:132; SHA256 d3e51d13faedefa5314d5f128c59473110a61bae075bd5ddb362788d5ae479f3
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:593; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
- CLOSE_WARD_STAFF_REQUEST — modelled; event roles: ward, coordinator, bed_manager
  Source-reviewed command model: an open staff request closed as arranged, not available or withdrawn.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:594
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2376
  Subject: An open staff request on a ward
  Before: Request exists on the named ward and is still open
  After: Request carries closedAt, closedBy and outcome
  Scope: Ward, coordinator or site bed manager in EVENT_ROLE; a ward acts only for its own ward (actingUnitId must equal unitId). Executive changes nothing (D-80). Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority. A ward may only withdraw; the coordinator or bed manager records any other outcome.
  payload: requestId and unitId; outcome from STAFF_REQUEST_OUTCOMES
  payload: actingUnitId for ward callers; role and now
  guards: Request found on that ward and open; outcome listed
  guards: Reject a ward recording an outcome other than withdrawn
  effects: Closes the one record; open lists and alerts drop it
  effects: Does not change beds, placement, movements or any patient stage
  tests: tests/ward-staff-requests.test.ts
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:2376; SHA256 7f16e741a6d120255f536b4f9571c4a8bdd8258f35909529a3514be1173baf8a
  Reviewed source: src/components/ward-management/staffing/staff-requests.ts:171; SHA256 d3e51d13faedefa5314d5f128c59473110a61bae075bd5ddb362788d5ae479f3
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:594; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
- RECORD_CLINICAL_CONTACT — diagram-reviewed; event roles: community, coordinator
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:598
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1352
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:665
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1897
- DISPATCH_BROADCAST_ALERT — diagram-reviewed; event roles: coordinator, bed_manager
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:602
  Event/dispatch reference: src/components/ward-management/alerts/ward-broadcast-reducer.ts:69
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2328
- ACKNOWLEDGE_BROADCAST_ALERT — diagram-reviewed; event roles: coordinator, ward, ed, officer, community, bed_manager
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:603
  Event/dispatch reference: src/components/ward-management/alerts/ward-broadcast-reducer.ts:151
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2329
- STAND_DOWN_BROADCAST_ALERT — diagram-reviewed; event roles: coordinator, bed_manager
  Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:604
  Event/dispatch reference: src/components/ward-management/alerts/ward-broadcast-reducer.ts:198
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2330
- EXTEND_BROADCAST_ALERT — modelled; event roles: coordinator, bed_manager
  Reviewed command model: Same active alert with expiry and duration each extended by the fixed default.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:605
  Event/dispatch reference: src/components/ward-management/alerts/ward-broadcast-reducer.ts:228
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2331
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
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2395; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:717; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- ADD_BROADCAST_ALERT_UNITS — modelled; event roles: coordinator, bed_manager
  Reviewed command model: Existing recipients plus new unique named desks.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:606
  Event/dispatch reference: src/components/ward-management/alerts/ward-broadcast-reducer.ts:243
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2332
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
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2394; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:717; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- RAISE_PULL_NOW — modelled; event roles: coordinator
  Reviewed command model: Same movement plus active Pull now addressed to the relevant wards.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:610
  Event/dispatch reference: src/components/ward-management/alerts/ward-broadcast-reducer.ts:293
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2333
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
  Reviewed source: src/components/ward-management/alerts/ward-broadcast-model.ts:317; SHA256 b27896e799de72fbb71c7782bc2a571627809762c61a40dcecb86b07007ca647
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2416; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:738; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- REPLY_BROADCAST_ALERT — modelled; event roles: ward, bed_manager, coordinator
  Reviewed command model: Reply appended; desk also acknowledged.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:612
  Event/dispatch reference: src/components/ward-management/alerts/ward-broadcast-reducer.ts:348
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2334
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
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2415; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- BOOK_PLANNED_ADMISSION — modelled; event roles: coordinator, bed_manager, ward
  Reviewed command model: New PA-* record in booked state, holding no bed.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:615
  Event/dispatch reference: src/components/ward-management/capacity/planned-admissions-reducer.ts:78
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2340
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
  guards: Linked patient exists, has no occupied/pulled bed or existing booked planned admission; recorded birth date matches cohort on arrival date. Initials-only requires 1–3 letters; the panel names digits and more than three letters separately, while blank initials get the generic "Initials are one to three letters." line; a direct event with neither patient nor initials is rejected by the patient-or-initials guard.
  effects: Appends a booked plan and increments plannedAdmissionSequence; linked gender comes from patient record, never event.
  effects: Stores a required same-ward authorisation override. No bed count or admission changes until conversion; initials invoke the typed-text persistence boundary.
  tests: tests/ward-planned-admissions.test.ts
  tests: tests/ward-audit24-1-planned-booking-authorised.test.ts
  Reviewed source: src/components/ward-management/capacity/planned-admissions-reducer.ts:334; SHA256 d91a5be952e2110e25d304edcac7c17bede49897d9115701033cc8be1e0c61df
  Reviewed source: src/components/ward-management/capacity/planned-admissions-reducer.ts:298; SHA256 d91a5be952e2110e25d304edcac7c17bede49897d9115701033cc8be1e0c61df
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2431; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- CHANGE_PLANNED_ADMISSION — modelled; event roles: coordinator, bed_manager, ward
  Reviewed command model: Still booked, with revised fields, changedAt and incremented changeCount.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:616
  Event/dispatch reference: src/components/ward-management/capacity/planned-admissions-reducer.ts:423
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2345
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
  Reviewed source: src/components/ward-management/capacity/planned-admissions-reducer.ts:418; SHA256 d91a5be952e2110e25d304edcac7c17bede49897d9115701033cc8be1e0c61df
  Reviewed source: src/components/ward-management/capacity/planned-admissions-reducer.ts:298; SHA256 d91a5be952e2110e25d304edcac7c17bede49897d9115701033cc8be1e0c61df
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2488; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- CANCEL_PLANNED_ADMISSION — modelled; event roles: coordinator, bed_manager, ward
  Reviewed command model: cancelled with cancel reason and time.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:617
  Event/dispatch reference: src/components/ward-management/capacity/planned-admissions-reducer.ts:499
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2350
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
  Reviewed source: src/components/ward-management/capacity/planned-admissions-reducer.ts:494; SHA256 d91a5be952e2110e25d304edcac7c17bede49897d9115701033cc8be1e0c61df
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2488; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- CONVERT_PLANNED_ADMISSION — modelled; event roles: ward, coordinator
  Reviewed command model: Plan arrived and linked to a new occupied admission.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:618
  Event/dispatch reference: src/components/ward-management/capacity/planned-admissions-reducer.ts:523
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:743
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
  Reviewed source: src/components/ward-management/capacity/planned-admissions-reducer.ts:518; SHA256 d91a5be952e2110e25d304edcac7c17bede49897d9115701033cc8be1e0c61df
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2516; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- RECORD_SUPPORT_NOTIFICATION — modelled; event roles: ward, coordinator, ed
  Reviewed command model: Another told/not_applicable record appended.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:622
  Event/dispatch reference: src/components/ward-management/ward-flow-record-events.ts:1353
  Event/dispatch reference: src/components/ward-management/ward-flow-record-stay-events.ts:677
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1898
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
  Reviewed source: src/components/ward-management/ward-flow-record-stay-events.ts:672; SHA256 c3710e57ffa74c56374fd19198b2dd25941ae342206abe440657000ee1aae939
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2519; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:896; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- SEND_RELEASE_SUPPORT_NOTICE — modelled; event roles: ward, coordinator
  Reviewed command model: confirmed release with service marked Sent.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:623
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1956
  Event/dispatch reference: src/components/ward-management/ward-flow-release-notice-events.ts:31
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
  Reviewed source: src/components/ward-management/ward-flow-release-notice-events.ts:55; SHA256 81d8ce05491f37320f53e7be9054404ad54c2e7244d4484901eaa5ada8f52536
  Reviewed source: src/components/ward-management/ward-flow-release-notice-events.ts:30; SHA256 81d8ce05491f37320f53e7be9054404ad54c2e7244d4484901eaa5ada8f52536
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- RECORD_DISCHARGE_DEPENDENCY — modelled; event roles: ward, coordinator
  Reviewed command model: Latest outstanding/done/not_needed state and owner recorded.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:625
  Event/dispatch reference: src/components/ward-management/discharges/discharge-dependency-events.ts:34
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1959
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
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- RECORD_DISCHARGE_PLAN_CHANGE — modelled; event roles: ward, coordinator
  Reviewed command model: One changed fact, with recorded change history where applicable.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:626
  Event/dispatch reference: src/components/ward-management/discharges/discharge-dependency-events.ts:49
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1960
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
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- RECORD_DISCHARGE_CHECK — modelled; event roles: ward, coordinator
  Reviewed command model: One discharge checklist item recorded as done, not needed or outstanding.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:628
  Event/dispatch reference: src/components/ward-management/discharges/discharge-check-events.ts:37
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2361
  Subject: One stay with a bed (not waitlisted) and one checklist item
  Before: Item not ticked, or ticked with a different state
  After: One discharge checklist item recorded as done, not needed or outstanding
  Scope: ward or coordinator. A ward must name the admission's own unit.
  payload: admissionId; item and state from closed lists; now and role; actingUnitId when acting as ward.
  guards: Admission exists and is not waitlisted.
  guards: Item and state are listed, and the state differs from the item's current ticked state.
  effects: Sets admission.dischargeChecks[item] with time and desk role.
  effects: Advisory only: never blocks RECORD_LEAVING or RECORD_PATIENT_DISCHARGE and changes no release or bed figure.
  tests: tests/ward-discharge-follow-through.test.ts
  Reviewed source: src/components/ward-management/discharges/discharge-check-events.ts:60; SHA256 584c52430b354fe68ebf1f0504c424400f28a32eb8f081f08ffb27a7016896d1
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:628; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
- RECORD_FOLLOW_UP_REPLY — modelled; event roles: community, coordinator
  Reviewed command model: The community team's follow-up reply recorded, with a listed reason when declined.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:630
  Event/dispatch reference: src/components/ward-management/discharges/discharge-check-events.ts:51
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:2362
  Subject: One stay with a bed (not waitlisted) referred to the acting community team
  Before: No reply, or a different reply or decline reason
  After: The community team's follow-up reply recorded, with a listed reason when declined
  Scope: community or coordinator. A community desk must name a known team the admission's referral named.
  payload: admissionId; reply from awaiting/accepted/declined; declineReason from a closed list only with declined; now and role; actingTeamId when acting as a community team.
  guards: Admission exists and is not waitlisted.
  guards: A community desk names its team, and the stay belongs to that team.
  guards: Reply is listed; a decline carries a listed reason and nothing else does; the same reply is not recorded twice.
  effects: Sets admission.followUpReply with time and desk role; the ward reads it on the discharge board and checklist.
  effects: Does not change the ward's followUp record, the care journey, any release or bed figure.
  tests: tests/ward-discharge-follow-through.test.ts
  Reviewed source: src/components/ward-management/discharges/discharge-check-events.ts:60; SHA256 584c52430b354fe68ebf1f0504c424400f28a32eb8f081f08ffb27a7016896d1
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:630; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
- RECORD_ARRIVAL_CHECK — modelled; event roles: ed, coordinator
  Reviewed command model: Chosen flag set to the opposite recorded boolean.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:631
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1962
  Event/dispatch reference: src/components/ward-management/ward-flow-release-notice-events.ts:47
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
  Reviewed source: src/components/ward-management/ward-flow-release-notice-events.ts:102; SHA256 81d8ce05491f37320f53e7be9054404ad54c2e7244d4484901eaa5ada8f52536
  Reviewed source: src/components/ward-management/ward-flow-release-notice-events.ts:46; SHA256 81d8ce05491f37320f53e7be9054404ad54c2e7244d4484901eaa5ada8f52536
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- UNDO_REFERRAL_DECISION — modelled; event roles: ward, coordinator, ed, community
  Reviewed command model: Referral restored to its pre-decision snapshot.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:635
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1752
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
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:1465; SHA256 7f16e741a6d120255f536b4f9571c4a8bdd8258f35909529a3514be1173baf8a
  Reviewed source: src/components/ward-management/ward-undo.ts:491; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- UNDO_AUDIT_REVIEW — modelled; event roles: coordinator
  Reviewed command model: That review removed while audit history remains.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:637
  Event/dispatch reference: src/components/ward-management/ward-flow-protected-record-events.ts:104
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1577
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
  Reviewed source: src/components/ward-management/ward-flow-protected-record-events.ts:103; SHA256 1eb306ce2963727a9c1e99aa60dd505b7ac247af29c50b7980f0617f6e1ee25e
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2587; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-undo.ts:491; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- PLACE_IN_BED — modelled; event roles: ward, coordinator
  Reviewed command model: Same stay recorded in the selected numbered bed and matching bed kind.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:639
  Event/dispatch reference: src/components/ward-management/ward-flow-bed-events.ts:99
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1771
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
  Reviewed source: src/components/ward-management/ward-flow-bed-events.ts:97; SHA256 be57f071ee46dc50dc5c0ac2dd9474b8a75f474f65aa943661a8bd08d2ed8113
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2592; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- UNDO_PLACE_IN_BED — modelled; event roles: ward, coordinator
  Reviewed command model: Prior bed number/kind and associated hold numbers restored.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:640
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1753
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
  Reviewed source: src/components/ward-management/ward-flow-events.ts:2612; SHA256 d8442fce2033d8962bf2804c711834fa8c4c511d3e99ce2b429d1b18e8f96d1e
  Reviewed source: src/components/ward-management/ward-undo.ts:491; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- UNDO_REFER_TO_UNITS — modelled; event roles: coordinator
  Reviewed command model: Movement offer/ward-referral changes reversed.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:643
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1754
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
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:138; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:393; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- UNDO_ACCEPT_IN_PRINCIPLE — modelled; event roles: ward, coordinator
  Reviewed command model: Acceptance, held bed/admission and generated notices restored to pre-acceptance.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:644
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1755
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
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:138; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:393; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- UNDO_LEGAL_FORM_RECORD — modelled; event roles: ed, coordinator, ward, community
  Reviewed command model: Newest recorded form/time/receipt/expiry and accompanying changed rows restored.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:645
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1756
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
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:138; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:393; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- UNDO_SUPPORT_NOTIFICATION — modelled; event roles: ward, coordinator
  Reviewed command model: Newest Tell record removed from the subject's checklist.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:646
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1757
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
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:138; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:393; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- UNDO_REPATRIATION — modelled; event roles: coordinator
  Reviewed command model: Return transport record and all generated journey/notice changes restored.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:647
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1758
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
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:138; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:393; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- UNDO_FLAG_RETURN_EARLY — modelled; event roles: coordinator
  Reviewed command model: takes back the newest early-return flag on a stay within the Undo window.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:648
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1759
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
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:1508; SHA256 7f16e741a6d120255f536b4f9571c4a8bdd8258f35909529a3514be1173baf8a
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:266; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
- UNDO_HANDOVER_SIGN_OFF — modelled; event roles: coordinator, ward
  Reviewed command model: Latest sign-off for that ward or network removed.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:649
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1760
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
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:138; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:393; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- UNDO_SITE_HANDOVER_SIGN_OFF — modelled; event roles: bed_manager
  Reviewed command model: Latest sign-off for that site removed; no ward sign-off changed.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:652
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1761
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
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:138; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:393; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:283; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
- UNDO_ED_STEP — modelled; event roles: ed, ward, community, coordinator
  Reviewed command model: Newest ED board step and all records it changed restored.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:653
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1762
  Event/dispatch reference: src/components/ward-management/ward-flow-undo-events.ts:269
  Subject: Latest undoable RECORD_ARRIVED_IN_DEPARTMENT, RECORD_EXAMINATION, RECORD_MEDICAL_CLEARANCE, RECORD_TRANSPORT_NEED, RECORD_ED_PRESENTATION, HANDOVER_READY, REQUEST_PSYCH_REVIEW or RECORD_PSYCH_REVIEW_SEEN on the named subject
  Before: Saved step record and unchanged post-step state
  After: Newest ED board step and all records it changed restored
  Scope: ed, ward, community or coordinator; original acting role or coordinator. Authenticated record/place scope remains required.
  payload: movementId or referralId identifying original subject; now; role; optional recordSeq matching the exact newest step.
  guards: A matching newest step Undo record exists for this exact subject/action family; a supplied recordSeq must match.
  guards: now is at/after the step and within UNDO_WINDOW_MINUTES (currently five).
  guards: Every affected row/whole-list patch still matches saved after values (a created notice may have been read); changed records refuse rather than overwrite newer work.
  guards: Any restored occupied/pulled bed is rechecked against current linked-patient, bed-number and hold conflicts; a sending-occupied/receiving-pulled transfer hold is allowed.
  guards: The complete proposed inverse must keep every leave attached to an occupied same-ward stay, with only one leave per stay; any restored or changed retained UMRN must have no other current owner. Blank, privacy-placeholder and UMRN not recorded values carry no retained identity claim.
  effects: Applies only saved before/after patches for RECORD_ARRIVED_IN_DEPARTMENT, RECORD_EXAMINATION, RECORD_MEDICAL_CLEARANCE, RECORD_TRANSPORT_NEED, RECORD_ED_PRESENTATION, HANDOVER_READY, REQUEST_PSYCH_REVIEW or RECORD_PSYCH_REVIEW_SEEN; removes newly created rows, restores removed/changed rows and removes appended entries.
  effects: Consumes that step Undo record; a removed stay loses its bed-placement Undo. Audit history remains; a unit allocatable revision advances instead of being rolled back.
  tests: tests/ward-ed-examination-save.dom.test.tsx
  tests: tests/ward-ed-handover-events.test.ts
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:261; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:138; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:393; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- UNDO_TRANSPORT_STEP — modelled; event roles: officer, ward, coordinator
  Reviewed command model: Newest transport stage reversed, including arrival-created stay and affected bed/resource changes.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:654
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1763
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
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:138; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:393; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- UNDO_DEPARTURE — modelled; event roles: ward, coordinator
  Reviewed command model: Departure reversed, stay and capacity restored if still safe.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:655
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1764
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
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:138; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:393; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- UNDO_ABSENT_WITHOUT_LEAVE — modelled; event roles: ward, coordinator
  Reviewed command model: Newest absence record and related row changes reversed.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:656
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1765
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
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:138; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:393; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
- UNDO_BED_MEETING_ACTION — modelled; event roles: coordinator, ward, ed, community, bed_manager
  Reviewed command model: One completed meeting action reopened to its exact prior state.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:658
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1766
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
  Reviewed source: src/components/ward-management/ward-undo.ts:74; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:138; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-undo.ts:393; SHA256 22a192fa0c973fff7b2b9b13038f17020b3990a33a0588af76ab2a4f79d035db
  Reviewed source: src/components/ward-management/ward-access-state.ts:668; SHA256 aff9d668ab52da5a8f185ac0169ee45d478cffb4aad491addc9809f5a352f2b5
  Reviewed source: src/components/ward-management/ward-bed-meeting-undo-event-type.ts:10; SHA256 a112bd8031c48d720a344b7a3fe9821b6f41db2d88956a2b001f8e5fca8fdb41
- UNDO_BED_STEP — modelled; event roles: ward, bed_manager, coordinator
  Reviewed command model: takes back a bed closed or reopened, or a return from leave, within the Undo window.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:660
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1767
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
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:1516; SHA256 7f16e741a6d120255f536b4f9571c4a8bdd8258f35909529a3514be1173baf8a
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:274; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
- UNDO_RELEASE_STEP — modelled; event roles: coordinator, ward, ed, community, bed_manager
  Reviewed command model: takes back a released bed, confirmed discharge sign-off, cancelled transport, withdrawn ward request or cancelled planned admission.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:661
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1768
  Event/dispatch reference: src/components/ward-management/ward-flow-undo-events.ts:275
  Subject: One movement, one bed release, or one planned admission
  Before: As the release, confirm, cancel or withdraw step left it
  After: Restored to before that step
  Scope: coordinator, ward, ed, community or bed_manager in the role table.
  payload: now; role; optional recordSeq; actingUnitId when ward; movementId, releaseId or plannedAdmissionId.
  guards: A matching Undo record exists for this kind of step on this subject; a supplied recordSeq must match the newest record.
  guards: The undoing role is the role (and ward) that acted, or a coordinator; now is within UNDO_WINDOW_MINUTES.
  guards: The subject has not changed since the step, and restoring it would not put the patient in a second bed or clash with an occupied bed number.
  guards: The complete proposed inverse must keep every leave attached to an occupied same-ward stay, with only one leave per stay; any restored or changed retained UMRN must have no other current owner. Blank, privacy-placeholder and UMRN not recorded values carry no retained identity claim.
  effects: Restores the saved snapshot of the step, removes notices that step raised and consumes the Undo record.
  effects: The audit evidence of the step and of the Undo stays.
  tests: tests/ward-tier1-undo.test.ts
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:1517; SHA256 7f16e741a6d120255f536b4f9571c4a8bdd8258f35909529a3514be1173baf8a
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:275; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
- UNDO_PATIENT_RECORD — modelled; event roles: community, coordinator
  Reviewed command model: takes back a community treatment order recorded or ended, or a record archived in error.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:662
  Event/dispatch reference: src/components/ward-management/ward-flow-reducer.ts:1769
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
  Reviewed source: src/components/ward-management/ward-flow-reducer.ts:1518; SHA256 7f16e741a6d120255f536b4f9571c4a8bdd8258f35909529a3514be1173baf8a
  Reviewed source: src/components/ward-management/ward-flow-undo-events.ts:276; SHA256 7344423b59a813fb2f73d630be0d158154dd5c64d718ec797aebe6de4c140b5e
  Reviewed source: src/components/ward-management/ward-retained-umrn.ts:25; SHA256 7968243f077b9d5c9a6fe6a56385f48ff6a97aa39cfdeec8fe97f05919693d80
- RECORD_CARE_PLAN — modelled; event roles: ward, ed, community, coordinator
  Source-reviewed command model: a new Current care plan on the patient; the previous Current plan becomes Superseded.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:666
  Event/dispatch reference: src/components/ward-management/ward-patient-care-plan-events.ts:14
  Event/dispatch reference: src/components/ward-management/ward-patient-care-plan-reducer.ts:44
  Subject: A patient record's care plans
  Before: Patient exists, holding zero or more care plans (at most one Current)
  After: New Current plan appended; any earlier Current plan marked Superseded, never deleted
  Scope: Ward, ED, community or coordinator in EVENT_ROLE. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: patientId; plan with type and what helps from fixed lists, agreed by (short text), typed dates, optional key contact and one short note
  payload: optional attachment as file type and size only (never the file or its name); role and now
  guards: Patient must exist; finite now; plan type and helps on their lists; agreed by and agreed date required
  guards: Short text over its limit refused, never shortened; attachment needs a listed type and a positive byte size; at most 20 plans per person
  effects: Replaces the patient's carePlans with the superseded list plus the new Current plan
  effects: Typed-text event: a session that sends it stops saving to browser storage
  tests: tests/ward-patient-care-plans.test.ts
  tests: tests/ward-event-permissions.test.ts
  Reviewed source: src/components/ward-management/ward-patient-care-plan-reducer.ts:44; SHA256 ebd947f4ec177d0acb998b35f3ebd66d0ac58b777c9a874e20ed3e67203caa1d
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:666; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-patient-care-plans.ts:98; SHA256 20f25414be8b4ae5eb1b9cc9eee189ba1ba08b0466b00ee6f7139876b963752f
- RECORD_TRIBUNAL_HEARING — modelled; event roles: ward, community, coordinator
  Source-reviewed command model: a Mental Health Tribunal hearing date held on the patient as typed.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:667
  Event/dispatch reference: src/components/ward-management/ward-patient-care-plan-events.ts:22
  Event/dispatch reference: src/components/ward-management/ward-patient-care-plan-reducer.ts:81
  Subject: A patient record's tribunal hearing
  Before: Patient exists, with or without an earlier hearing date
  After: tribunalHearing holds the typed date, optional typed time, role and time recorded; any earlier hearing and outcome replaced
  Scope: Ward, community or coordinator in EVENT_ROLE. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: patientId; date as YYYY-MM-DD; optional time as HH:MM; role and now
  guards: Patient must exist; finite now; a real calendar date; a 24-hour time when given
  effects: Shown as typed, never a countdown (D-93); a worded flag once the date has passed with no outcome
  tests: tests/ward-patient-care-plans.test.ts
  tests: tests/ward-event-permissions.test.ts
  Reviewed source: src/components/ward-management/ward-patient-care-plan-reducer.ts:81; SHA256 ebd947f4ec177d0acb998b35f3ebd66d0ac58b777c9a874e20ed3e67203caa1d
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:667; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-patient-care-plans.ts:149; SHA256 20f25414be8b4ae5eb1b9cc9eee189ba1ba08b0466b00ee6f7139876b963752f
- RECORD_TRIBUNAL_OUTCOME — modelled; event roles: ward, community, coordinator
  Source-reviewed command model: the outcome of the recorded tribunal hearing, held beside its date.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:668
  Event/dispatch reference: src/components/ward-management/ward-patient-care-plan-events.ts:33
  Event/dispatch reference: src/components/ward-management/ward-patient-care-plan-reducer.ts:95
  Subject: A patient record's tribunal hearing
  Before: Patient exists with a recorded hearing date
  After: tribunalHearing.outcome holds Held, Adjourned or Cancelled with role and time recorded
  Scope: Ward, community or coordinator in EVENT_ROLE. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: patientId; outcome from TRIBUNAL_OUTCOMES; role and now
  guards: Patient must exist; finite now; a hearing date must be recorded; outcome on the list
  effects: Clears the hearing-date-passed flag
  tests: tests/ward-patient-care-plans.test.ts
  tests: tests/ward-event-permissions.test.ts
  Reviewed source: src/components/ward-management/ward-patient-care-plan-reducer.ts:95; SHA256 ebd947f4ec177d0acb998b35f3ebd66d0ac58b777c9a874e20ed3e67203caa1d
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:668; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
- SET_CULTURAL_SUPPORT_REQUEST — modelled; event roles: ward, ed, community, coordinator
  Source-reviewed command model: cultural support the person or family asked for, set or taken off.
  Permission source: src/components/ward-management/ward-flow-event-roles.ts:669
  Event/dispatch reference: src/components/ward-management/ward-patient-care-plan-events.ts:41
  Event/dispatch reference: src/components/ward-management/ward-patient-care-plan-reducer.ts:107
  Subject: A patient record's cultural support request
  Before: Patient exists, with or without a request
  After: culturalSupportRequested holds the listed request, or is removed when request is null
  Scope: Ward, ED, community or coordinator in EVENT_ROLE. Shared authenticated command scope additionally checks the permitted place and stored record; EVENT_ROLE alone is not place authority.
  payload: patientId; request from CULTURAL_SUPPORT_REQUESTS or null; role and now
  guards: Patient must exist; finite now; request on the list or null
  effects: Never derived from the Aboriginal status field; set only by this event
  tests: tests/ward-patient-care-plans.test.ts
  tests: tests/ward-event-permissions.test.ts
  Reviewed source: src/components/ward-management/ward-patient-care-plan-reducer.ts:107; SHA256 ebd947f4ec177d0acb998b35f3ebd66d0ac58b777c9a874e20ed3e67203caa1d
  Reviewed source: src/components/ward-management/ward-flow-event-roles.ts:669; SHA256 f9c4dd2aa18c14b7b98ab03b46946cf70c309a6281278d4eda668faa4011d423
  Reviewed source: src/components/ward-management/ward-patient-care-plans.ts:168; SHA256 20f25414be8b4ae5eb1b9cc9eee189ba1ba08b0466b00ee6f7139876b963752f

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

## 98 ACTIONS, and which boxes each is attached to
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
- SET_CLINICALLY_READY :: Record clinically ready and why not gone :: boxes = rkDischargePlan
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
- A transport job: states = No job | Booked | Crew accepted | En route | Collected | Arrived | Stopped
- A bed release: states = Not flagged | Expected | Confirmed | Discharged | Stuck — a flag, not a stage | Being made ready — a flag
- The front door — an expect becomes a referral: states = Raised | Expected to arrive | In the department | Medically cleared — or not
- A patient's legal status: states = Voluntary | Referred for psychiatric examination | Detained awaiting examination | Involuntary inpatient
- An examination: states = Not examined | Further examination ordered | Inpatient order | Community order, or revoked | Superseded
- A notice: states = Nothing sent | Raised, unread | Read
- A row in the coordinator's inbox: states = Not showing | Showing | Acknowledged | Commitment completed
- A legal form's receipt: states = Not recorded as received | Recorded as received | An expiry, typed by a clinician

## 77 WORD LISTS the map names
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
- PSYCH_REVIEW_GRADES
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
- DISCHARGE_DELAY_CLEAR_REASONS
- ADMISSION_STATES
- FOLLOW_UP_STATES
- DISCHARGE_BARRIERS
- DISCHARGE_ROLE_LABELS
- PLANNED_ADMISSION_REASONS
- PLANNED_ADMISSION_CANCEL_REASONS
- PLANNED_ADMISSION_STATES
- RELEASE_BANDS
- GENDERS
- PATIENT_FIELDS
- ELIGIBILITY_GATES
- CARE_PLAN_TYPES
- CARE_PLAN_HELPS
- TRIBUNAL_OUTCOMES
- CULTURAL_SUPPORT_REQUESTS
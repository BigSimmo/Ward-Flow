# Error message inventory, 10 November 2026

**Audience:** Josh and builders. **Status:** draft for review; generated, then read by a person. **Owner:** Documentation.

M101 of the master audit list: every failure message on screen, and whether it tells the person what to do next.
`tests/ward-audit-m101-error-next-step.test.ts` keeps this list equal to the source and fails when a message
with no next step is added. Seed narratives, Help and tour text and the approved mock-up copies are left out.

**Still to do (a person):** read the rows marked No and decide, message by message, which need a next step.
Wording that touches a clinical term is Josh's to approve. The next-step check is a plain word match, so a Yes
is a lead, not proof the step is clear.

208 messages; 103 with no next step found.

| Next step | Message | Where |
| --------- | ------- | ----- |
| No | … … show a dash: a referral on record cannot be found. | `src/components/ward-management/statistics/statistics-teams-index.tsx` |
| No | … and no transport is booked. The handover cannot be marked ready until it is. | `src/components/ward-management/ed/ed-screen-derivations.ts` |
| No | … cannot be marked arrived before the patient has been collected. | `src/components/ward-management/officer/officer-screen-helpers.ts`, `src/components/ward-management/ward/ward-arrivals-corridor.tsx` |
| No | … has already closed (…). A patient cannot be collected for a movement that has ended. | `src/components/ward-management/officer/officer-screen-helpers.ts` |
| No | … has already closed (…). A patient cannot be marked arrived for a movement that has ended. | `src/components/ward-management/officer/officer-screen-helpers.ts` |
| No | … has already closed (…). A withdrawal cannot be added to a movement that has ended. | `src/components/ward-management/ed/ed-blocked-reasons.ts` |
| No | … has already closed (…). Transport cannot be accepted for a movement that has ended. | `src/components/ward-management/officer/officer-screen-helpers.ts` |
| No | … has already closed (…). Transport cannot be moved for a movement that has ended. | `src/components/ward-management/officer/officer-screen-helpers.ts` |
| No | … needs text: colour alone cannot carry a state in this app. | `src/components/ward-management/ward-chip.tsx` |
| No | …, so this action was not saved. | `src/components/ward-management/ward-save-failure.ts` |
| No | A bed carries no link back to the referral that named this team, so this list cannot be built for …. | `src/components/ward-management/community/community-screen-phone.tsx` |
| No | A written form expiry cannot shorten an existing recorded expiry. | `src/components/ward-management/ward-flow-record-legal-events.ts` |
| No | Accepted destination could not be resolved. | `src/components/ward-management/coordinator/shortlist-panel.tsx` |
| No | An appointment cannot be completed before its recorded time. | `src/components/ward-management/ward-care-journey.ts` |
| No | Appointment version is unavailable. | `src/components/ward-management/ward-care-journey.ts` |
| No | Cannot be moved. Two things are missing. | `src/components/ward-management/patients/patient-now-records.ts` |
| No | Cannot confirm arrival: no movement matches …. | `src/components/ward-management/board/ward-board.tsx` |
| No | Cannot record an outcome for a closed movement (…). | `src/components/ward-management/ed/ed-blocked-reasons.ts` |
| No | Cannot refer a closed movement (…). | `src/components/ward-management/ed/ed-blocked-reasons.ts` |
| No | Care actions are unavailable after a recorded death. | `src/components/ward-management/ward-care-journey.ts` |
| No | Covered so the next person cannot see this desk's patients. Records opened outside your care are closed. | `src/components/ward-management/shell/ward-access.tsx` |
| No | Declines cannot be broken down by reason: a movement carries an unrecognised reason, so no total is shown. | `src/components/ward-management/statistics/statistics-decline-reporting.ts` |
| No | Demo storage is unavailable. Changes stay in memory and may be lost when this page closes. | `src/components/ward-management/ward-flow-demo-storage-constants.ts` |
| No | Demonstration state is not saved on this device. A reload loses changes since the last save. | `src/components/ward-management/shell/ward-demo-saving-note.tsx` |
| No | Discharge records are unavailable for this role. | `src/components/ward-management/capacity/capacity-ward-drawer.tsx`, `src/components/ward-management/discharges/discharge-board.tsx` |
| No | Eligibility could not be determined for one of the selected wards. | `src/components/ward-management/coordinator/shortlist-panel.tsx` |
| No | Expected … has passed and was not confirmed. | `src/components/ward-management/patients/patient-now-ward.ts` |
| No | Form details can't be recorded for a closed movement. | `src/components/ward-management/ward-flow-record-legal-events.ts` |
| No | Form times are unavailable until this report is ready. | `src/components/ward-management/tools/ward-tool-form-times.tsx` |
| No | Gender or recorded sex is not female or male, or not yet recorded. The ward cannot accept until a coordinator records a reason after checking with the ward. | `src/components/ward-management/referrals/ward-referral-drawer-referral-step.tsx` |
| No | Individual alerts are unavailable for this desk. | `src/components/ward-management/shell/ward-executive-chrome.tsx` |
| No | Individual records are unavailable for executive reporting. | `src/components/ward-management/ward-public-search.tsx` |
| No | It cannot be undone, and it does not say where the patient went. | `src/components/ward-management/ed/ed-screen-row-forms.tsx` |
| No | Live referral and movement records are unavailable. | `src/components/ward-management/referrals/referral-match.tsx` |
| No | Messages are unavailable until this report is ready. | `src/components/ward-management/tools/ward-tool-messages.tsx` |
| No | My list is kept for this visit only. Browser storage is unavailable. | `src/components/ward-management/on-call/on-call-screen.tsx` |
| No | No longer running. The acceptance stands and cannot be withdrawn now. | `src/components/ward-management/movements/movement-workspace-cockpit.tsx` |
| No | No person on file for this bed, so the request cannot name them. | `src/components/ward-management/referrals/step-down-request.tsx` |
| No | Nobody has asked. Without it this person cannot travel even once a bed appears. | `src/components/ward-management/patients/patient-now-records.ts` |
| No | On-call is unavailable until this report is ready. | `src/components/ward-management/tools/ward-tool-on-call.tsx` |
| No | Printed or copied by hand only. Not sent by Ward Flow. | `src/components/ward-management/patients/patient-handover-pack-button.tsx` |
| No | Ready beds are unavailable until this report is ready. | `src/components/ward-management/tools/ward-bed-finder.tsx` |
| No | Referral is unavailable. | `src/components/ward-management/community/community-screen-drawer.tsx` |
| No | Referral is unavailable. No acceptance was recorded. | `src/components/ward-management/community/community-screen-drawer.tsx` |
| No | Referral is unavailable. No patient or clinical information has been inferred. | `src/components/ward-management/community/community-screen-drawer.tsx` |
| No | Reporting tags cannot be released safely. | `src/components/ward-management/statistics/executive-statistics-release.ts` |
| No | Rule change not saved. | `src/components/ward-management/settings/settings-screen.tsx` |
| No | Safe reload recovery could not be recorded. | `src/components/ward-management/ward-shared-client.ts` |
| No | Shared sign-in configuration is unavailable. | `src/components/ward-management/ward-shared-access.tsx`, `src/components/ward-management/ward-supabase-auth.ts` |
| No | Signed out so the next person cannot see this desk's patients or act as you. | `src/components/ward-management/shell/ward-access.tsx` |
| No | Statistics are unavailable for this desk. | `src/components/ward-management/statistics/statistics-ward-screen.tsx` |
| No | Table drafts are not saved. | `src/components/ward-management/ed/ed-screen-patient-dialog.tsx` |
| No | That cannot be true, so … excluded from the average and counted here instead. | `src/components/ward-management/statistics/statistics-ward-cards.tsx` |
| No | That file could not be read, so nothing was loaded. | `src/components/ward-management/tools/ward-demo-panel.tsx`, `src/components/ward-management/ward-scenario-import-owner.ts` |
| No | The bed pulled at … for … is offered again and the diverted journey is closed. This cannot be undone. | `src/components/ward-management/ed/ed-screen-referred.tsx` |
| No | The bed pulled at … for … is offered again and the diverted movement is closed. This cannot be undone. | `src/components/ward-management/ward/ward-arrivals-corridor.tsx` |
| No | The bed this job was booked against has been given back to the ward. … is still recorded as collecting this patient, and nothing has told them otherwise. A replacement cannot be booked until this job is cancelled. | `src/components/ward-management/movements/movement-workspace-cockpit.tsx` |
| No | The catchment table cannot settle which team serves this suburb, so choosing this is a deliberate step outside it. | `src/components/ward-management/referrals/referral-destination-options.ts` |
| No | The contact time must belong to this stay or its follow-up and cannot be in the future. | `src/components/ward-management/ward-care-journey.ts` |
| No | The current team cannot open this admission’s care record. | `src/components/ward-management/community/community-follow-up.tsx` |
| No | The demo menu could not load. | `src/components/ward-management/ward-shared-access.tsx` |
| No | The latest record could not be checked. Your choice is still here. | `src/components/ward-management/forecast/forecast-miss-reason-control.tsx` |
| No | The latest shared reason could not be checked. Your choice is still here. | `src/components/ward-management/forecast/use-forecast-model.ts` |
| No | The link could not be sent. | `src/components/ward-management/front-door/front-door.tsx` |
| No | The list could not be read from the server. | `src/components/ward-management/settings/access-shared-source.ts` |
| No | The password cannot be checked without a connection. | `src/components/ward-management/bed-meeting/tv-lock.tsx` |
| No | The password was not saved. | `src/components/ward-management/front-door/front-door.tsx` |
| No | The receiving unit is unavailable. | `src/components/ward-management/referrals/referral-match.tsx` |
| No | The saved demonstration could not be restored safely: …. A fresh synthetic demonstration has started. | `src/components/ward-management/ward-flow-demo-restore.ts` |
| No | The saved demonstration could not be restored safely. A fresh synthetic demonstration has started. | `src/components/ward-management/ward-flow-demo-restore.ts` |
| No | The time made cannot be later than now, so the form is not recorded. | `src/components/ward-management/coordinator/shortlist-panel.tsx` |
| No | The time written on the paper cannot be later than now. | `src/components/ward-management/ward/ward-leave-paper-authority.tsx` |
| No | The transfer cannot go ahead until it is signed off. | `src/components/ward-management/ward/ward-notification-center.tsx` |
| No | They already have a bed, or a pulled bed, on …, so this ward cannot send them as a new admission. | `src/components/ward-management/referrals/ward-referral-drawer-patient-step.tsx` |
| No | This browser cannot show notifications. | `src/components/ward-management/alerts/alerts-screen.tsx`, `src/components/ward-management/settings/settings-device-alerts.ts` |
| No | This browser cannot show notifications. The buzz sound still plays while Ward Flow is open. | `src/components/ward-management/settings/settings-alerts-check.tsx` |
| No | This browser could not keep your sign-in. A reload will ask you to sign in again. | `src/components/ward-management/use-ward-supabase-shared.ts` |
| No | This browser could not save the reason. Your choice is still here. | `src/components/ward-management/forecast/use-forecast-model.ts` |
| No | This cannot be undone here. | `src/components/ward-management/ed/ed-screen-row-menu.tsx` |
| No | This desk cannot sign a triage. | `src/components/ward-management/triage/triage-risk-form.tsx` |
| No | This discharge could not be found, so nothing was recorded. | `src/components/ward-management/discharges/discharge-dependency-events.ts` |
| No | This mixed-ward stay has no recorded current bed or bed kind; its capacity change cannot be determined safely. | `src/components/ward-management/ward-flow-bed-events.ts` |
| No | This patient cannot be referred while the journey is … — referral is only available while placement is requested or a destination is under review. | `src/components/ward-management/ward-derivations.ts` |
| No | This person already has a bed, or a pulled bed, on …, so they cannot be sent as a new admission. | `src/components/ward-management/referrals/use-ward-referral-drawer-state.ts` |
| No | This phone number cannot be rung. You can still send. | `src/components/ward-management/referrals/ward-referral-drawer-model.ts` |
| No | This referral is not sent. | `src/components/ward-management/referrals/ward-referral-drawer-rail.tsx` |
| No | This scenario could not be restored: …. Nothing was loaded. | `src/components/ward-management/ward-flow-scenario-file.ts` |
| No | This scenario could not be saved safely. Nothing was saved. | `src/components/ward-management/ward-flow-scenario-file.ts` |
| No | This scenario includes a carer, PSP or MHAS notification record, which cannot be saved to a file yet. Nothing was saved. | `src/components/ward-management/ward-flow-scenario-file.ts` |
| No | This scenario includes a repatriation, which cannot be saved to a file yet. Nothing was saved. | `src/components/ward-management/ward-flow-scenario-file.ts` |
| No | This scenario was saved by a different version of Ward Flow and cannot be loaded safely. | `src/components/ward-management/ward-flow-scenario-file.ts` |
| No | This takes them off this board and cannot be undone here. | `src/components/ward-management/ed/ed-screen-row-menu.tsx` |
| No | Threshold status is unavailable on this desk. The rule values are in Rules. | `src/components/ward-management/settings/settings-reference-card.tsx` |
| No | Training is on: changes stay in this practice world and are not saved for anyone. | `src/components/ward-management/ward-training-connection.tsx` |
| No | WardRecordRow … is toned "…" with no state word: colour alone cannot carry a state in this app. | `src/components/ward-management/ward-record-row.tsx` |
| No | Whether any other admission referred to this team has ended cannot be told from the record either, for the same reason. | `src/components/ward-management/community/community-screen-back-tab.tsx` |
| No | Which spelling is correct cannot be told — both forms are in real-world use — but both name the same locality. | `src/components/ward-management/ward-catchment.ts` |
| No | Who a community team has in a bed, who is expected back, and who it cannot see, chosen from this page. | `src/components/ward-management/statistics/statistics-sections.ts` |
| No | You cannot add the CAD number here. | `src/components/ward-management/patients/patient-now-transport-section.tsx` |
| No | You cannot book transport here. | `src/components/ward-management/patients/patient-now-transport-section.tsx`, `src/components/ward-management/patients/patient-transit-operations.tsx` |
| No | Your new patient is not saved. | `src/components/ward-management/patients/add-patient.tsx` |
| No | Your role cannot book. | `src/components/ward-management/capacity/planned-admissions-panel.tsx` |
| No | Your role cannot make this change. Nothing was changed. | `src/components/ward-management/ward-protected-refusal-reasons.ts` |
| Yes | … could not be confirmed as acknowledged. Check the alerts, then … again. | `src/components/ward-management/tasks-acknowledge-visible.tsx` |
| Yes | … queued action… on this … … not sent. Check the board, then try again. | `src/components/ward-management/ward-conflict-scope.ts` |
| Yes | … waiting changes were not sent. Their content was not retained after reload. Review the board before entering them again. | `src/components/ward-management/ward-command-recovery-run.ts` |
| Yes | … was not confirmed as loaded. Check the current scenario before trying again. | `src/components/ward-management/demo-reset/ward-demo-reset.tsx` |
| Yes | … was not confirmed. If it is not on the board, record it again. | `src/components/ward-management/officer/use-transport-command-feedback.ts` |
| Yes | A greyed button says why it cannot be used yet. Point at it or move to it with Tab to read the reason. | `src/components/ward-management/help-content/ward-help-reference.ts` |
| Yes | A transport job can be cancelled by the bed coordinator or by the referring emergency department. Anyone else, including a ward with no recorded booking, cannot cancel it themselves — they have to ask one of those two. | `src/components/ward-management/movements/movement-workspace-cockpit.tsx` |
| Yes | Booking details cannot be edited after collection. Ask the bed coordinator. | `src/components/ward-management/patients/patient-now-transport-section.tsx` |
| Yes | Booking details cannot be edited here. Ask the bed coordinator or booking team to cancel the active job first. | `src/components/ward-management/patients/patient-now-transport-section.tsx` |
| Yes | By phone, mark what you could not see. | `src/components/ward-management/triage/triage-risk-how.tsx` |
| Yes | By phone: if you cannot be sure they are alone and can speak freely, choose No. | `src/components/ward-management/triage/triage-risk-risk.tsx` |
| Yes | Care record access is unavailable. Reopen the current admission before recording. | `src/components/ward-management/community/community-screen-drawer.tsx` |
| Yes | Changes still waiting on this page were not saved, and a change already sent may still have been saved. Check the board after you sign in. | `src/components/ward-management/front-door/front-door-notice.ts` |
| Yes | Choose the reason this community team cannot take this referral before declining it. | `src/components/ward-management/referrals/referral-match-model.ts` |
| Yes | Choose the reason this emergency department cannot take this referral before declining it. | `src/components/ward-management/referrals/referral-match-model.ts` |
| Yes | Choose the reason this team cannot take this referral before declining it. | `src/components/ward-management/community/community-blocked-reasons.ts` |
| Yes | Choose the reason this ward cannot take this referral before declining it. | `src/components/ward-management/referrals/referral-match-model.ts` |
| Yes | Contact cannot be recorded here. | `src/components/ward-management/community/community-screen-modals.tsx` |
| Yes | Copy is unavailable in this browser. | `src/components/ward-management/tools/ward-tool-on-call.tsx` |
| Yes | Copy is unavailable in this browser. Select the number instead. | `src/components/ward-management/on-call/ward-contact-sheet.tsx` |
| Yes | Copy is unavailable in this browser. Select the text instead. | `src/components/ward-management/on-call/on-call-screen.tsx`, `src/components/ward-management/tools/ward-tool-messages.tsx` |
| Yes | Could not copy. Check clipboard access and try again. | `src/components/ward-management/bed-meeting/agenda-referrals-copy.tsx`, `src/components/ward-management/legal-forms/use-legal-forms-copy.ts`, `src/components/ward-management/referrals/referral-board-sheets.tsx`, `src/components/ward-management/referrals/referral-summary-sheet.tsx` |
| Yes | D-34 cannot cancel or refund a patient already collected or arrived; use the separately approved escalation pathway. | `src/components/ward-management/ward-flow-record-events.ts` |
| Yes | Decline was not confirmed. Your reason is kept; review the board before trying again. | `src/components/ward-management/ward/ward-answer-feedback.tsx` |
| Yes | Diagnostics could not be copied. Try again in a moment. | `src/components/ward-management/settings/settings-screen.tsx` |
| Yes | Document details could not load. Close this dialog and reload the page before trying again. | `src/components/ward-management/patients/patient-now-screen.tsx` |
| Yes | Exceptional access is read only. Clinical and record changes are unavailable. | `src/components/ward-management/patients/patient-now-screen.tsx` |
| Yes | Export failed. Try again. | `src/components/ward-management/ward-list-export-button.tsx` |
| Yes | Go through the registrar first unless it cannot wait. | `src/components/ward-management/on-call/on-call-directory.ts` |
| Yes | If a criterion cannot be met or there is a new concern, ask for a medical review. | `src/components/ward-management/ward/ward-discharge-criteria-card.tsx` |
| Yes | Individual activity, unread counts and record changes are unavailable for this desk. | `src/components/ward-management/shell/ward-executive-chrome.tsx` |
| Yes | Loading … was not confirmed. Refresh the page and check the board before trying again. | `src/components/ward-management/tools/ward-demo-panel.tsx` |
| Yes | Menu could not load. Check the connection, then try again. | `src/components/ward-management/shell-next/next-phone-menu.tsx`, `src/components/ward-management/shell/ward-phone-menu.tsx` |
| Yes | No interpreter available: do not ask through family or friends. Tap Could not ask. | `src/components/ward-management/triage/triage-risk-risk.tsx` |
| Yes | No matching admission is available to this team. Follow-up and patient contact cannot be recorded here. | `src/components/ward-management/community/community-screen-drawer.tsx` |
| Yes | Not alone: do not ask now. Tap Could not ask and choose why. | `src/components/ward-management/triage/triage-risk-risk.tsx` |
| Yes | Not saved on this device, because this world holds typed text. Reloading loses it, so use Save to file to keep it. | `src/components/ward-management/tools/ward-demo-panel.tsx` |
| Yes | Not sent. Check the connection and try again. | `src/components/ward-management/tools/ward-tools-quick-actions.tsx` |
| Yes | Not sent. Try again. | `src/components/ward-management/tools/ward-tools-quick-actions.tsx` |
| Yes | Observation history is full, so this change cannot be saved. Tell the bed coordinator. | `src/components/ward-management/ward-flow-observation-events.ts` |
| Yes | Older activity could not be read. Try again. | `src/components/ward-management/shell/ward-desk-audit.ts` |
| Yes | Opening records is unavailable. Reconnect and finish checking any uncertain save first. | `src/components/ward-management/ward-shared-client.ts` |
| Yes | Patient could not be added. Check the identity details and existing records. | `src/components/ward-management/patients/add-patient.tsx` |
| Yes | Patient could not be added. Check the record before trying again. | `src/components/ward-management/referrals/use-referral-command-completion.ts` |
| Yes | Patient could not be added. UMRN … already belongs to an existing record. Open that record instead of adding a second one. | `src/components/ward-management/patients/add-patient.tsx` |
| Yes | Phone alerts could not be changed. Try again. | `src/components/ward-management/settings/settings-device-alerts.ts` |
| Yes | Public settings are unavailable. Reconnect to confirm your executive report. | `src/components/ward-management/settings/settings-operational-source.tsx` |
| Yes | Record operations are unavailable for aggregate reporting. | `src/components/ward-management/ward-shared-client.ts` |
| Yes | Recovery storage could not be read. Review the board before repeating an action. | `src/components/ward-management/ward-command-recovery-run.ts` |
| Yes | Referral cannot be accepted: reload the current queued referral for this team. | `src/components/ward-management/community/community-screen.tsx` |
| Yes | Referral could not be confirmed. Check the Referrals board before trying again. | `src/components/ward-management/referrals/use-referral-command-completion.ts` |
| Yes | Reload recovery is unavailable on this browser. Keep this page open until your changes are confirmed. | `src/components/ward-management/ward-shared-access.tsx` |
| Yes | Review attempts cannot be reviewed. | `src/components/ward-management/governance-event-detail.tsx`, `src/components/ward-management/governance-phone.tsx` |
| Yes | Reviewed by phone. Record what you heard; mark what you could not see in one tap. | `src/components/ward-management/triage/triage-risk-mse.tsx` |
| Yes | Roles could not be read completely. Reload the list. | `src/components/ward-management/ward-access-directory.ts` |
| Yes | Search could not load. Check the connection, then type again. | `src/components/ward-management/shell-next/next-phone-menu-sheet.tsx`, `src/components/ward-management/shell/ward-phone-menu-sheet.tsx` |
| Yes | Session data could not be cleared. Close the browser to clear it. | `src/components/ward-management/settings/settings-screen.tsx` |
| Yes | Shared access changes are unavailable. Reconnect and finish checking any uncertain save first. | `src/components/ward-management/ward-shared-client.ts` |
| Yes | Shared access is unavailable. Reconnect and finish checking any uncertain save first. | `src/components/ward-management/ward-shared-access.tsx` |
| Yes | Shared sign-in is unavailable. Try again. | `src/components/ward-management/use-ward-supabase-shared.ts` |
| Yes | Shared test accounts cannot receive email, so a reset link will not reach them. Ask the Ward Flow coordinator to reset those. | `src/components/ward-management/front-door/front-door.tsx` |
| Yes | Sign-in service is unavailable. Try again. | `src/components/ward-management/front-door/use-front-door-auth.ts`, `src/components/ward-management/ward-supabase-auth.ts` |
| Yes | Sign-out cleanup could not be confirmed. Clear this site's browser data before sharing the device. | `src/components/ward-management/use-ward-supabase-shared.ts` |
| Yes | Signed out here, but this browser could not remove saved sign-in details. Clear this site's browser data before sharing the device. | `src/components/ward-management/ward-supabase-auth.ts` |
| Yes | Statistics are unavailable for this desk. Refresh the workspace to try again. | `src/components/ward-management/statistics/statistics-small-numbers.tsx` |
| Yes | Tap a factor to mark it present. Mark one Not known here only when you could not find out. Everything left unmarked takes your Rest of history or Rest of current risk answer. | `src/components/ward-management/triage/triage-risk-sheets.tsx` |
| Yes | The access log could not be read from the server. Open this tab again to retry. | `src/components/ward-management/settings/access-log.tsx` |
| Yes | The action could not be confirmed. Check its status before trying again. | `src/components/ward-management/shell/ward-step-up.tsx` |
| Yes | The action was …, but the shared board could not be refreshed. Press Retry to reload it before making more changes. | `src/components/ward-management/ward-save-failure.ts` |
| Yes | The action was sent but could not be confirmed. Check its status before trying again. | `src/components/ward-management/shell/ward-step-up.tsx` |
| Yes | The application failed to load. Try again, or reload the page. | `src/app/global-error.tsx` |
| Yes | The change could not open. Check the connection, then try again. | `src/components/ward-management/ward-shared-access.tsx` |
| Yes | The patient record link could not be checked. Check the patient, then try again. Nothing was changed. | `src/components/ward-management/ward-protected-refusal-reasons.ts` |
| Yes | The previous recovery record could not be read. Its outcome is unknown. Review the board before repeating an action. | `src/components/ward-management/ward-command-recovery-run.ts` |
| Yes | The request could not be confirmed. Reload to check its status before trying again. | `src/components/ward-management/ward-shared-role-gate.tsx` |
| Yes | The requested referral is unavailable. Choose a referral from the queue to continue. | `src/components/ward-management/referrals/referral-board.tsx` |
| Yes | The reset was not confirmed. Refresh the page and check the board before trying again. | `src/components/ward-management/tools/ward-demo-panel.tsx` |
| Yes | The rules file could not be downloaded. Try again in a moment. | `src/components/ward-management/settings/settings-screen.tsx` |
| Yes | The scenario file tools could not load, so nothing was changed. Try again. | `src/components/ward-management/ward-flow-demo-storage.ts` |
| Yes | The second step could not be set up. Try again. | `src/components/ward-management/ward-supabase-auth.ts` |
| Yes | The shared board could not be refreshed. Press Retry to reload it before making changes. | `src/components/ward-management/ward-save-failure.ts` |
| Yes | The shared board is full, so this change was not saved. Ask whoever runs the demonstration to reset the scenario before making more changes. | `src/components/ward-management/ward-save-failure.ts` |
| Yes | The sign-in service could not check your password. Try again when the connection is back. | `src/components/ward-management/bed-meeting/tv-lock.tsx` |
| Yes | The time received can't be later than now. Check the time on the form. | `src/components/ward-management/ward-flow-record-events.ts` |
| Yes | The transport save was not confirmed. Keep editing to review the error before trying again. | `src/components/ward-management/transport/use-transport-booking-close.ts` |
| Yes | This browser could not keep the recovery request. Allow this site to store data, then try again. | `src/components/ward-management/ward-supabase-auth.ts` |
| Yes | This browser could not save the TV lock. Check storage access and try again. | `src/components/ward-management/bed-meeting/tv-lock.tsx` |
| Yes | This browser could not unlock the TV. Check storage access and try again. | `src/components/ward-management/bed-meeting/tv-lock.tsx` |
| Yes | This desk cannot record this. Open Tools from the ward or the coordinator desk. | `src/components/ward-management/tools/ward-tool-feed.tsx` |
| Yes | This discharge record is unavailable. Return to the list and open it again. | `src/components/ward-management/capacity/capacity-ward-drawer.tsx` |
| Yes | This file could not be read. Select it again. | `src/components/ward-management/referrals/referral-flow-panels.tsx` |
| Yes | This link's account could not be shown. If you did not ask for this link, choose Cancel. | `src/components/ward-management/front-door/front-door.tsx` |
| Yes | This patient could not be confirmed as added. Check the patient list. If they are not there, add them again. | `src/components/ward-management/patients/add-patient.tsx` |
| Yes | This patient is past the point where a bed is only pulled. Handover is being prepared or the patient may already be moving, so the acceptance cannot be withdrawn here. Ring the ward. | `src/components/ward-management/movements/movement-workspace-cockpit.tsx` |
| Yes | This record could not be opened. Select it again to retry. | `src/components/ward-management/discharges/discharge-board.tsx` |
| Yes | This rules file could not be read. Select it again. | `src/components/ward-management/settings/settings-screen.tsx` |
| Yes | This stay's record could not be opened. Close the drawer and try again. | `src/components/ward-management/ward/ward-leave-paper-authority.tsx` |
| Yes | This ward cannot cancel a transport it did not book. Ask the sending emergency department or the bed coordinator. | `src/components/ward-management/ward/ward-arrivals-corridor.tsx` |
| Yes | Undo is unavailable because the workspace or working role changed. Review the current board. | `src/components/ward-management/alerts/alert-arrived-at-ward.tsx`, `src/components/ward-management/alerts/alert-release-ownership.tsx`, `src/components/ward-management/patients/patient-archive-panel.tsx`, `src/components/ward-management/use-undoable-step.ts` |
| Yes | Undo is unavailable until the shared board is ready. Wait for it to reconnect, then check the board. | `src/components/ward-management/alerts/alert-arrived-at-ward.tsx`, `src/components/ward-management/alerts/alert-release-ownership.tsx`, `src/components/ward-management/patients/patient-archive-panel.tsx`, `src/components/ward-management/use-undoable-step.ts` |
| Yes | Undo is unavailable. Review the current board before trying again. | `src/components/ward-management/ward/use-ward-command-completion.ts` |
| Yes | Update was not confirmed. Your time is kept; review the record before trying again. | `src/components/ward-management/discharges/discharge-detail-panes.tsx` |
| Yes | Ward Flow could not finish loading, so this was not recorded. Check the connection and try again. | `src/components/ward-management/ward-flow-slice-dispatch.ts` |
| Yes | Your change could not be checked. Review the current board. | `src/components/ward-management/coordinator/activity-own-command.tsx` |
| Yes | Your last change was not confirmed. The board is up to date. Press Retry to send it. | `src/components/ward-management/ward-shared-client.ts` |

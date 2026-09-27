# INGEST_MAP — tip → reference pack

| Tip file                             | Reference table                                                                     | Rule                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| ward-sites.ts                        | entities.facilities / wards_and_units / emergency_departments + capacity_assertions | Tip invented; do not overwrite tip with reference unless Phase 6         |
| ward-teams.ts                        | community_services / referral_pathway_entities                                      | Tip synthetic placeholders                                               |
| ward-catchment.ts                    | catchment_assertions                                                                | Tip demo; contested overlays block routing                               |
| ward-travel-bands.ts                 | distances.json                                                                      | Tip invented; only flip TRAVEL_BANDS_ARE_INVENTED when distances sourced |
| ward-admissions-seed / patients-seed | —                                                                                   | Demo journeys only                                                       |
| OneDrive Referring/Forms             | forms_catalogue_mh / catchment_doc_pointers / pathways                              | source_document_only                                                     |

**CI rule (recommended):** forbid importing `staffed_beds` into tip fixtures unless `operational_use_approved=true`.

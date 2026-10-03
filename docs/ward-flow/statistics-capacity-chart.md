# Statistics capacity explorer

The statistics summary uses one shared navigation from the statistics layout, with
an underline for the current page and a compact section selector on mobile. This
navigation serves the summary, network, comparisons, health service, ward, emergency
department and community statistics routes. The duplicate hub navigation is removed.

The graph compares the current bed snapshot by hospital or ward. Ready beds,
occupied beds and held beds come from `unitCapacity`; held means empty but not
allocatable. Out-of-service beds are not recorded and are excluded from the graph.
These measures are aggregate capacity, not a patient-to-bed suitability assessment.

Users can search, filter by health service, sort, switch between bed counts and
percentage shares, select bars, follow ward-statistics links, reset the view, and
export the filtered chart as synthetic-data CSV. Hospital aggregation follows the
filtered wards; a ward-name search includes only matching wards in that hospital.
Controls and selection use transient React state. No new persistence, URL state,
backend, chart dependency or patient data export is introduced. There is one chart
instance, with CSS bar geometry owned by React and native keyboard/touch controls.
Mobile stacks selected detail below the plot and keeps one natural page scroll.

The former empty trend panel and prototype provenance essay are removed. A concise
history limitation and synthetic-data disclosure remain. Specialist measures stay
in their existing disclosures. Community activity totals were decorative and are
replaced with the searchable canonical team directory. Referral measures now count
records raised today with a ward destination, once per referral in each measure;
raised includes withdrawn/cancelled requests. ED medians use individual elapsed
waits and are rounded only after aggregation. No historical series or target is
invented.

Verification is scoped to explorer interactions, shared navigation, existing hub
measure/reachability tests, changed-file checks and final browser inspection. Local
preview evidence is separate from deployment.

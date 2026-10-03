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

## Statistics family refinement

Network overview retains its accepted headroom, service gauges and hospital matrix.
Its lower admission chart uses four mutually exclusive admission stages; the former
six-step drawing mixed movement, preparation and admission populations. Exact tables
and explicitly labelled historical illustrations remain in disclosures.

Compare adds ward stay, blocker and long-stay measures, plus ED open, urgent and
unplaced measures. Search, metric selection, order, row selection and statistics
links use the same current derivations as the detailed tables. Service statistics
adds a ward-scoped capacity graph and referral placement destination distribution.
The existing distance visual stays. Ward pages show current capacity first, followed
by recorded discharge barriers and established current-stay bands. Missing stays
are counted separately. ED pages show the headline figures and an elapsed placement
wait dot plot, with overlapping urgent/unplaced filters and placement links.
Community handover distinguishes the discharge-date subset from other admission
states. Team comparisons use communityFigures, retaining unavailable membership
and the existing small-sample protection on person lists. Team-name heuristics
for health services and suburbs, unavailable history controls and inert service
buttons are removed.

StatisticsInsightChart has one instance per work area, uses React for current data,
scale geometry, filters and selection, and adds no dependency. Bars, category
distributions and elapsed-wait dots share labelled native-button interactions.
Selection resolves against visible current rows; filtered/removed records cannot
leave a stale inspector. Controls are ephemeral and resettable, with no URL or
persistence changes. CSV exports contain the current filtered measure, units,
availability and a synthetic-data header; ED exports include synthetic placement
identities. A missing measure is a blank CSV value with its availability reason.

Portrait layouts stack inspectors and use two columns for category distributions.
Zero-only distributions use compact baseline marks. Native scrolling and touch
selection need no gesture interception, hover or animation. Existing primary
navigation remains shared across the family. Secondary measures are revealed using
print-aware disclosures; required exception counts and operational actions remain
visible. Preview validation is scoped and does not establish production deployment.

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
All widths place selected detail below the plot and keeps one natural page scroll.

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
Travel-band comparisons use recorded categories. Ward pages show current capacity first, followed
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

Category distributions use a shared zero baseline and numerical guides at every width.
Zero-only distributions use compact baseline marks. Native scrolling and touch
selection need no gesture interception, hover or animation. Existing primary
navigation remains shared across the family. Secondary measures are revealed using
print-aware disclosures; required exception counts and operational actions remain
visible. Preview validation is scoped and does not establish production deployment.

## Chart review refinements

Charts use readable zero-based ticks, whole-number count axes, subtle guides and
lighter bars. Compact headers carry filtered counts and CSV export; Reset appears
only after a control changes. Category distributions keep their meaningful record
order without a redundant sorting control. Missing values and measured zero retain
their existing meanings and exports.

Inspectors open below plots so selection does not change comparison width or scale.
Arrow keys move between rows; Home and End reach the ends. Enter or Space selects
through native buttons. Close and Escape return focus to the selected row.
Capacity hospital aggregation works from service pages, and Reset restores the
page's initial grouping. ED wait charts mark operational 24h/48h guides when they
fall within the measured scale, and urgent records keep both a text label and a
warning-coloured dot. These defaults are separate from triage time and ED access
targets; no forecast, target or historical data is inferred.

The accepted Network overview top and existing exact tables, distance bands and
labelled historical illustrations are retained. Disclosure counts can wrap without
floating over their headings. There are no new chart libraries or dependencies.

## Disclosure and data-view alignment

Statistics disclosure rows use inset labels, separated rows and trailing chevrons;
Open/Close remains the native details interaction with keyboard access. Missing
ward/ED data-block styles are restored. Chart category labels and values share
tracks and baselines, including wrapping on phones; compact chart headers respond
to their actual module width.

Every insight offers a Data view of the plotted values with the same filters,
measure, availability and selection. Native table rows retain keyboard inspection
and focus return. CSV continues to contain the unrounded recorded values.
Service travel bands use the canonical travel-time vocabulary instead of the old
SVG's unsupported kilometre conversion. Counts and percentages retain the existing
out-of-area population; the synthetic travel disclosure and recorded band counts
remain available. The accepted Network overview top and existing precision tables
are retained.

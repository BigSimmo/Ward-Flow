"use client";

/**
 * Summary, Journey view: the patient journey from ED to discharge as a ribbon, then each stage's
 * breakdown. Reached with the view bar or #journey.
 */
export function StatisticsJourneyView({ onShowBoard }: { onShowBoard: () => void }) {
  void onShowBoard;
  return <section id="journey" aria-label="Journey" data-testid="ward-statistics-journey-view" />;
}

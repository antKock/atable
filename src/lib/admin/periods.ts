// Period filter for the usage dashboard. Client-safe (no server imports) so the
// FilterBar, the page and the server query layer all share one definition.
//
// `days` is the rolling window fed to the analytics_* RPCs (p_days / p_from).
// `ever` carries days = null — the query layer resolves it to "since the first
// real household". `span` labels the sampling window on the trend charts.

export type PeriodKey = "1m" | "3m" | "6m" | "ever";

export type PeriodDef = {
  key: PeriodKey;
  label: string; // chip label in the filter bar
  span: string; // human window shown on trend-chart subtitles
  days: number | null; // rolling window in days; null = all-time
};

export const PERIODS: PeriodDef[] = [
  { key: "1m", label: "1 mois", span: "30 jours", days: 30 },
  { key: "3m", label: "3 mois", span: "90 jours", days: 90 },
  { key: "6m", label: "6 mois", span: "180 jours", days: 180 },
  { key: "ever", label: "Depuis le début", span: "depuis le début", days: null },
];

// Default preserves the dashboard's historical 90-day window.
export const DEFAULT_PERIOD: PeriodKey = "3m";

export function isPeriodKey(v: unknown): v is PeriodKey {
  return v === "1m" || v === "3m" || v === "6m" || v === "ever";
}

export function resolvePeriod(key: unknown): PeriodDef {
  return PERIODS.find((p) => p.key === key) ?? PERIODS.find((p) => p.key === DEFAULT_PERIOD)!;
}

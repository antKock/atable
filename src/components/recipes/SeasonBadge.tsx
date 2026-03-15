import { t } from "@/lib/i18n/fr";

const SEASON_LABELS: Record<string, string> = {
  printemps: t.seasons.spring,
  ete: t.seasons.summer,
  automne: t.seasons.autumn,
  hiver: t.seasons.winter,
};

interface SeasonBadgeProps {
  season: string;
}

export default function SeasonBadge({ season }: SeasonBadgeProps) {
  const label = SEASON_LABELS[season] ?? season;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-medium"
      style={{
        background: "linear-gradient(155deg, rgba(110, 122, 56, 0.14), rgba(110, 122, 56, 0.08))",
        color: "var(--tag-chip-text)",
        border: "1px solid rgba(110, 122, 56, 0.18)",
        boxShadow: "0 1px 3px rgba(110, 122, 56, 0.1)",
      }}
    >
      {label}
    </span>
  );
}

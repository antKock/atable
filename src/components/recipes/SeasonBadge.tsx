import { t } from "@/lib/i18n/fr";

const SEASON_COLORS: Record<string, string> = {
  printemps: "var(--season-spring)",
  ete: "var(--season-summer)",
  automne: "var(--season-autumn)",
  hiver: "var(--season-winter)",
};

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
  const color = SEASON_COLORS[season] ?? "var(--muted-foreground)";
  const label = SEASON_LABELS[season] ?? season;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
        color,
      }}
    >
      {label}
    </span>
  );
}

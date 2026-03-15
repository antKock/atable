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
        background: `linear-gradient(155deg, color-mix(in srgb, ${color} 18%, transparent), color-mix(in srgb, ${color} 10%, transparent))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
        boxShadow: `0 1px 3px color-mix(in srgb, ${color} 15%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}

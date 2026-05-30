// Mijote dashboard chart palette + typography constants.
// Single source of truth for the Recharts components (which use inline styles,
// not CSS vars). Warm, harmonious chroma — do not introduce colours outside it.

export const PALETTE = {
  olive: "#6E7A38",
  oliveDeep: "#5D6A2E",
  oliveSoft: "#A8B490",
  ochre: "#C0922F",
  terracotta: "#B85C3D",
  sage: "#5E8B7A",
  clay: "#9C6B4A",
  ink: "#1A1A18",
  muted: "#6B6E68",
  faint: "#9A968C",
  grid: "#E5DED6",
  surface: "#FBF8F1",
  paper: "#F1ECDF",
  border: "#E8E0CC",
} as const;

// Add-method series colours (keyed by recipes.source).
export const METHOD_COLORS = {
  manual: "#6E7A38",
  url: "#C0922F",
  photo: "#B85C3D",
  voice: "#5E8B7A",
  unknown: "#C9C2B2",
} as const;

// Method display labels (French).
export const METHOD_LABELS = {
  manual: "Saisie manuelle",
  url: "Import URL",
  photo: "Photo",
  voice: "Vocal",
  unknown: "Indéterminé",
} as const;

// Platform series colours (keyed by device_sessions.platform).
export const PLATFORM_COLORS = {
  ios: "#6E7A38",
  android: "#C0922F",
  web: "#B85C3D",
  unknown: "#C9C2B2",
} as const;

export const PLATFORM_LABELS = {
  ios: "iOS",
  android: "Android",
  web: "Web",
  unknown: "Indéterminé",
} as const;

// Fonts — map the design's roles onto the app's loaded next/font variables.
export const FONT = "var(--font-inter), system-ui, sans-serif";
export const MONO = "var(--font-dm-mono), ui-monospace, monospace";

// Shared Recharts axis / grid / tooltip styling.
export const axisTick = {
  fontFamily: FONT,
  fontSize: 11,
  fill: PALETTE.faint,
  fontWeight: 500,
} as const;

export const axisProps = {
  tick: axisTick,
  tickLine: false,
  axisLine: { stroke: PALETTE.grid },
} as const;

export const gridProps = {
  stroke: PALETTE.grid,
  strokeDasharray: "2 5",
  vertical: false,
} as const;

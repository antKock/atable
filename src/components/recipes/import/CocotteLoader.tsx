import type { CSSProperties } from "react";

// Animated Mijote cocotte for the import loading screen. Same pot/lid/handle
// shapes as CocotteIllustration, re-grouped so parts can animate, with the
// viewBox extended upward (0 -38 80 106) to give the steam headroom. Motion
// lives in globals.css (.cocotte-body / .cocotte-lid / .cocotte-shadow /
// .steam-wisp), all gated behind prefers-reduced-motion: no-preference.
type CocotteLoaderProps = {
  size?: number;
  accent?: string;
  steam?: boolean;
};

export function CocotteLoader({
  size = 132,
  accent = "var(--accent)",
  steam = true,
}: CocotteLoaderProps) {
  return (
    <svg
      className="cocotte-svg"
      width={size}
      height={(size * 106) / 80}
      viewBox="0 -38 80 106"
      aria-hidden="true"
    >
      {steam && (
        <g
          className="steam"
          fill="none"
          stroke={accent}
          strokeWidth={2.4}
          strokeLinecap="round"
        >
          <path
            className="steam-wisp"
            style={{ "--d": "0s" } as CSSProperties}
            d="M31 16 q-5 -7 0 -13 q5 -6 0 -12 q-4 -6 0 -10"
          />
          <path
            className="steam-wisp"
            style={{ "--d": "0.7s" } as CSSProperties}
            d="M40 18 q6 -8 0 -15 q-6 -7 0 -13 q5 -6 0 -10"
          />
          <path
            className="steam-wisp"
            style={{ "--d": "1.25s" } as CSSProperties}
            d="M49 16 q5 -7 0 -13 q-5 -6 0 -12 q4 -6 0 -10"
          />
        </g>
      )}

      {/* Floor shadow */}
      <ellipse
        className="cocotte-shadow"
        cx={40}
        cy={68}
        rx={30}
        ry={2.6}
        fill={accent}
      />

      {/* Pot body (breathes) */}
      <g className="cocotte-body">
        <rect x={3} y={38} width={6} height={9} rx={3} fill={accent} />
        <rect x={71} y={38} width={6} height={9} rx={3} fill={accent} />
        <path
          d="M9 36 Q9 32 13 32 L67 32 Q71 32 71 36 L71 56 Q71 64 61 64 L19 64 Q9 64 9 56 Z"
          fill={accent}
        />
        <path
          d="M14 58 Q14 62 18 62 L62 62 Q66 62 66 58"
          stroke="rgba(255,255,255,0.30)"
          strokeWidth={1.5}
          fill="none"
        />
        <path d="M11 31 Q11 27 40 27 Q69 27 69 31 Z" fill="rgba(0,0,0,0.18)" />

        {/* Lid (jiggles) */}
        <g className="cocotte-lid">
          <path d="M10 30 Q10 22 40 22 Q70 22 70 30 Z" fill={accent} />
          <path
            d="M16 28 Q23 24 40 23.6"
            stroke="rgba(255,255,255,0.38)"
            strokeWidth={1.6}
            strokeLinecap="round"
            fill="none"
          />
          <circle cx={40} cy={19} r={2.6} fill={accent} />
        </g>
      </g>
    </svg>
  );
}

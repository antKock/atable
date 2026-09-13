interface CocotteIllustrationProps {
  size?: number;
  accent?: string;
}

export default function CocotteIllustration({
  size = 72,
  accent = "var(--accent)",
}: CocotteIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
      <g
        stroke={accent}
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        opacity="0.55"
      >
        <path d="M28 17 Q30 13 28 9 Q26 5 28 1" />
        <path d="M40 15 Q42 11 40 7 Q38 3 40 -1" />
        <path d="M52 17 Q54 13 52 9 Q50 5 52 1" />
      </g>
      <rect x="3" y="38" width="6" height="9" rx="3" fill={accent} />
      <rect x="71" y="38" width="6" height="9" rx="3" fill={accent} />
      <path
        d="M9 36 Q9 32 13 32 L67 32 Q71 32 71 36 L71 56 Q71 64 61 64 L19 64 Q9 64 9 56 Z"
        fill={accent}
      />
      <path
        d="M14 58 Q14 62 18 62 L62 62 Q66 62 66 58"
        stroke="rgba(255,255,255,0.30)"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M10 30 Q10 22 40 22 Q70 22 70 30 Z"
        fill={accent}
        opacity="0.78"
      />
      <circle cx="40" cy="19" r="2.5" fill={accent} opacity="0.78" />
      <ellipse
        cx="40"
        cy="68"
        rx="30"
        ry="2.5"
        fill={accent}
        opacity="0.10"
      />
    </svg>
  );
}

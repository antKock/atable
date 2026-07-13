interface CarnetIllustrationProps {
  size?: number;
  accent?: string;
}

// Empty-state mark for the recipe collection (« ton carnet »). Same flat,
// single-accent idiom as CocotteIllustration (viewBox 80×80, soft shadow
// ellipse, white-ish inner details) so both read as one system. The cocotte
// stays the app mascot (logo, import loader, photo placeholder); the carnet
// is the entity, shown when the collection is empty.
export default function CarnetIllustration({
  size = 72,
  accent = "var(--accent)",
}: CarnetIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
      {/* ground shadow */}
      <ellipse cx="40" cy="71" rx="22" ry="2.5" fill={accent} opacity="0.10" />
      {/* cover */}
      <path
        d="M26 16 L56 16 Q58 16 58 18 L58 66 Q58 68 56 68 L26 68 Q24 68 24 66 L24 18 Q24 16 26 16 Z"
        fill={accent}
      />
      {/* spiral binding */}
      <g stroke={accent} strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M30 14 Q30 10 33 10 Q36 10 36 14" />
        <path d="M38 14 Q38 10 41 10 Q44 10 44 14" />
        <path d="M46 14 Q46 10 49 10 Q52 10 52 14" />
      </g>
      {/* written lines */}
      <g
        stroke="rgba(255,255,255,0.40)"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <line x1="31" y1="28" x2="51" y2="28" />
        <line x1="31" y1="36" x2="51" y2="36" />
        <line x1="31" y1="44" x2="51" y2="44" />
        <line x1="31" y1="52" x2="45" y2="52" />
      </g>
    </svg>
  );
}

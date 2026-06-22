"use client";

import { useEffect, useMemo, useState } from "react";
import { CocotteLoader } from "./CocotteLoader";

// Full-screen loading state shown while any recipe import is in flight (link,
// photo, voice, or the iOS share sheet). A rotating playful headline over a
// fixed factual subline, an animated cocotte, and an indeterminate simmer bar.
// Styling/motion lives in globals.css (.loading-screen / .loading-phrase / …).

// Playful headline — ambiance only; the "what's happening" lives in the subline.
const PHRASES = [
  "Ça mijote…",
  "Ça frémit dans la cocotte…",
  "Ça sent déjà bon…",
  "Ça frétille là-dedans…",
  "La magie opère à feu doux…",
  "Presque à point…",
  "Patience, c'est bientôt servi…",
] as const;

const SUBLINE = "On range les ingrédients et les étapes au bon endroit";
const PHRASE_INTERVAL_MS = 2400;

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ImportLoading() {
  // Shuffle once on mount so phrases appear in a random order each time.
  const order = useMemo(() => shuffle(PHRASES.map((_, i) => i)), []);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setStep((p) => (p + 1) % order.length),
      PHRASE_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [order.length]);

  return (
    <div className="loading-screen">
      <div className="cocotte-stage">
        <CocotteLoader />
      </div>

      <div className="loading-copy">
        {/* key re-mounts the node each tick so the entrance animation replays */}
        <h2 key={step} className="loading-phrase">
          {PHRASES[order[step]]}
        </h2>
        <p className="loading-subline">{SUBLINE}</p>
      </div>

      <div className="simmer-bar" role="progressbar" aria-label="Import en cours">
        <span className="simmer-fill" />
      </div>
    </div>
  );
}

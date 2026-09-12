"use client";

import type { LucideIcon } from "lucide-react";

interface ImportCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

// Coquille partagée des trois modes d'import (photo, dictée, lien). Spec #24 :
// fermée = tuile haute « verbe + promesse » qui lance la méthode ; ouverte =
// panneau d'action (même en-tête, contenu rendu par l'importeur appelant).
// Le contenu déplié appartient aux importeurs et n'est pas touché ici.
export default function ImportCard({
  icon: Icon,
  title,
  description,
  expanded,
  onToggle,
  children,
}: ImportCardProps) {
  const header = (
    <>
      <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-[rgba(110,122,56,0.12)]">
        <Icon size={26} className="text-accent" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h3>
        <p className="mt-0.5 text-[13.5px] leading-snug text-muted-foreground">
          {description}
        </p>
      </div>
    </>
  );

  if (!expanded) {
    // Tuile fermée : un vrai <button> pleine largeur — le tap ouvre le panneau.
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-4 rounded-[22px] border-[1.5px] border-[rgba(110,122,56,0.22)] p-[18px] text-left transition-all hover:border-accent active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        style={{ background: "var(--card-gradient)", boxShadow: "var(--card-shadow)" }}
      >
        {header}
      </button>
    );
  }

  // Panneau ouvert : l'en-tête n'est plus cliquable (rien à replier — on change
  // de méthode via la rangée « Ou plutôt » du sélecteur) ; le contenu vit hors
  // de tout <button> pour que les inputs restent valides.
  return (
    <div
      className="rounded-[22px] border-[1.5px] border-accent p-[18px] pb-4"
      style={{
        background: "var(--card-gradient)",
        boxShadow: "0 2px 16px rgba(110,122,56,0.14)",
      }}
    >
      <div className="flex items-center gap-4">{header}</div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

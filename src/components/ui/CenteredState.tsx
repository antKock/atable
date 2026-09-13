import Link from "next/link";
import type { ReactNode } from "react";

// Style commun du CTA des états (Home vide, Bibliothèque vide, échec de
// chargement) : bouton plein dégradé, hauteur tactile 44 px.
const CTA_CLASS =
  "mt-6 inline-flex min-h-11 items-center rounded-lg px-6 text-sm font-medium text-white transition-opacity hover:opacity-90";
const CTA_STYLE = { background: "var(--btn-gradient)", boxShadow: "var(--btn-shadow)" } as const;

export type CenteredStateCta =
  { label: string; href: string } | { label: string; onClick: () => void };

type Props = {
  /** Illustration ou icône, déjà dimensionnée. */
  illustration: ReactNode;
  title: string;
  body?: ReactNode;
  cta?: CenteredStateCta;
  /** Variante resserrée (aucun résultat de recherche) : marge et titre réduits. */
  compact?: boolean;
};

/**
 * État centré « illustration + titre + texte + CTA » (revue 2026-09-12) :
 * une seule structure pour la Home vide, la Bibliothèque vide / sans résultat
 * et l'échec de chargement (`LoadErrorState`), qui s'écrivaient trois fois.
 * Composant serveur-compatible (aucun hook) : `title` et `body` arrivent
 * déjà traduits.
 */
export default function CenteredState({ illustration, title, body, cta, compact = false }: Props) {
  return (
    <div className={`mx-auto max-w-xs px-4 text-center ${compact ? "mt-12" : "mt-16"}`}>
      <div className={`flex justify-center ${compact ? "mb-4" : "mb-5"}`}>{illustration}</div>
      <p className={`text-foreground ${compact ? "display-italic-md" : "display-italic-lg"}`}>
        {title}
      </p>
      {body && <p className={`mt-2 text-muted-foreground ${compact ? "text-sm" : ""}`}>{body}</p>}
      {cta &&
        ("href" in cta ? (
          <Link href={cta.href} className={CTA_CLASS} style={CTA_STYLE}>
            {cta.label}
          </Link>
        ) : (
          <button type="button" onClick={cta.onClick} className={CTA_CLASS} style={CTA_STYLE}>
            {cta.label}
          </button>
        ))}
    </div>
  );
}

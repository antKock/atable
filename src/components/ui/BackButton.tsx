"use client";

import Link from "next/link";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { useT } from "@/lib/i18n/client";

// LE bouton retour de l'app (revue 2026-09-12 : 4 dessins différents dans
// 10 fichiers, unifiés ici). Quatre variantes, une par contexte :
//   - "circle"  : pastille blanche posée sur le hero de la fiche recette ;
//   - "header"  : flèche dans l'en-tête d'un écran plein (nouvelle recette,
//                 édition), à côté du titre ;
//   - "chevron" : chevron en tête des écrans du carnet (détail, profil,
//                 inviter, changer de carnet, fusion) ;
//   - "fixed"   : chevron fixé en haut à gauche sous la safe area (flux de
//                 récupération plein écran).
// `href` rend un <Link>, `onClick` un <button> — jamais les deux.
type Variant = "circle" | "header" | "chevron" | "fixed";

type Target = { href: string; onClick?: never } | { onClick: () => void; href?: never };

type Props = Target & {
  variant?: Variant;
  label?: string;
  className?: string;
};

const VARIANTS: Record<
  Variant,
  { className: string; style?: React.CSSProperties; icon: React.ReactNode }
> = {
  circle: {
    className:
      "absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    style: {
      background: "#fff",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.18), 0 1px 2px rgba(0, 0, 0, 0.10)",
    },
    icon: <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />,
  },
  header: {
    className:
      "flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
    icon: <ArrowLeft size={20} strokeWidth={1.75} aria-hidden="true" />,
  },
  chevron: {
    className:
      "mb-2 -ml-2 flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted",
    icon: <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />,
  },
  fixed: {
    className: "fixed left-2 z-10 flex h-10 w-10 items-center justify-center text-foreground",
    style: { top: "calc(env(safe-area-inset-top) + 13px)" },
    icon: <ChevronLeft size={22} strokeWidth={2.5} aria-hidden="true" />,
  },
};

export default function BackButton({
  variant = "chevron",
  label,
  className,
  href,
  onClick,
}: Props) {
  const t = useT();
  const v = VARIANTS[variant];
  const cls = className ? `${v.className} ${className}` : v.className;
  const aria = label ?? t.a11y.backButton;
  if (href !== undefined) {
    return (
      <Link href={href} aria-label={aria} className={cls} style={v.style}>
        {v.icon}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={aria} className={cls} style={v.style}>
      {v.icon}
    </button>
  );
}

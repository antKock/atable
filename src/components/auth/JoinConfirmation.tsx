"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { dropSwrCache } from "@/lib/swr";
import { getRecipePlaceholderGradient } from "@/lib/recipe-placeholder";
import type { JoinPreview, JoinThumbnail } from "@/lib/db/join-preview";
import type { MembershipRole } from "@/lib/auth/owner-context";

type Props = {
  householdName: string;
  joinCode: string;
  // Rôle porté par le code (Lot 3) : un code invité affiche la copy lecture seule.
  role?: MembershipRole;
  // Aperçu du carnet (vignettes + total). `null` = lecture en échec : on retombe
  // sur la cocotte, sans ligne de contexte — jamais un compteur inventé.
  preview?: JoinPreview | null;
};

// Liseré crème + ombre portée : la vignette est une photo posée sur la table,
// pas une carte de l'app (on est encore hors du carnet).
const TILE_SHADOW = "0 10px 26px rgba(0, 0, 0, 0.22), 0 0 0 4px rgba(245, 241, 232, 0.92)";

// Géométrie du héros selon le nombre de vignettes (décision design 2026-09-15) :
// jamais d'éventail incomplet — une recette se montre seule, deux se posent en
// paire, trois s'éventent. Au-delà, l'éventail ne tient pas dans la largeur.
const FAN = ["rotate(-13deg) translateX(-62px)", "rotate(13deg) translateX(62px)", "rotate(-1deg)"];
const PAIR = ["rotate(-8deg) translateX(-40px)", "rotate(8deg) translateX(40px)"];

export default function JoinConfirmation({
  householdName,
  joinCode,
  role = "member",
  preview = null,
}: Props) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const thumbnails = preview?.thumbnails ?? [];
  const count = preview?.count ?? 0;

  async function handleJoin() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/households/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        redirect?: string;
      };
      if (!response.ok || !data.redirect) {
        setError(data.error ?? t.joinLink.notFound);
        setLoading(false);
        return;
      }
      dropSwrCache(); // joined a household: previous session's cache is stale
      window.location.href = data.redirect;
    } catch {
      setError(t.joinLink.notFound);
      setLoading(false);
    }
  }

  // Ligne de contexte : le TOTAL du carnet, pas le nombre de vignettes. Carnet
  // vide → une promesse plutôt qu'un compteur à zéro, et jamais « ensemble »
  // pour un invité, qui ne peut rien ajouter.
  const context =
    preview === null
      ? null
      : count === 0
        ? role === "guest"
          ? t.joinLink.emptyGuest
          : t.joinLink.emptyMember
        : count === 1
          ? t.joinLink.oneRecipe
          : count === 2
            ? t.joinLink.twoRecipes
            : t.household.recipeCount(count);

  return (
    // Héros plein-bleed comme l'écran d'accueil : il déborde derrière la barre
    // d'état, donc on ignore le padding du layout (landing) et on gère les
    // safe-areas ici.
    <div className="bg-sage-radial fixed inset-0 flex flex-col text-background">
      <div
        className="flex flex-1 flex-col items-center justify-center overflow-hidden px-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 24px)" }}
      >
        <Hero thumbnails={thumbnails} alt={t.a11y.recipePhoto} />

        <p className="mt-7 text-[14.5px] font-medium tracking-[0.02em] text-background/85">
          {t.joinLink.welcome}
        </p>
        <h1
          className="display mt-2 text-center"
          style={{
            fontWeight: 700,
            fontSize: "clamp(30px, 9.5vw, 40px)",
            lineHeight: 1.04,
            letterSpacing: "-0.02em",
          }}
        >
          {householdName}
        </h1>

        {context && (
          <p className="mt-3.5 max-w-[280px] text-center text-[15px] font-medium leading-snug text-background/88">
            {context}
          </p>
        )}

        {role === "guest" && (
          <span className="mt-2.5 inline-flex items-center gap-1.5 text-[14px] text-background/80">
            <Eye size={15} strokeWidth={2} aria-hidden="true" />
            {t.joinLink.guestNote}
          </span>
        )}
      </div>

      <div
        className="mx-auto flex w-full max-w-[400px] flex-col gap-2.5 px-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 40px)" }}
      >
        {error && (
          <p role="alert" className="text-center text-sm font-medium text-background">
            {error}
          </p>
        )}

        {/* Mêmes pilules que l'accueil : crème pleine en primaire, contour à 55 % en secondaire. */}
        <button
          type="button"
          data-track="join.confirm"
          onClick={handleJoin}
          disabled={loading}
          className="flex h-[54px] items-center justify-center rounded-[27px] bg-background text-[17px] font-semibold tracking-[-0.005em] text-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/70"
        >
          {loading ? "…" : t.joinLink.confirm}
        </button>

        <Link
          href="/"
          data-track="join.home"
          className="flex h-[54px] items-center justify-center rounded-[27px] text-[17px] font-semibold tracking-[-0.005em] text-background transition-colors hover:bg-background/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/70"
          style={{ boxShadow: "inset 0 0 0 1.5px rgba(245, 241, 232, 0.55)" }}
        >
          {t.joinLink.notNow}
        </Link>
      </div>
    </div>
  );
}

/** Visuel du héros : cocotte quand le carnet est vide, sinon 1 à 3 vignettes. */
function Hero({
  thumbnails,
  alt,
}: {
  thumbnails: JoinThumbnail[];
  alt: (title: string) => string;
}) {
  if (thumbnails.length === 0) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- SVG local à filtre interne, comme l'accueil
      <img
        src="/cocotte-illustration.svg"
        alt=""
        aria-hidden="true"
        width={210}
        height={210}
        className="h-auto w-[min(210px,54vw)] select-none"
        draggable={false}
      />
    );
  }

  if (thumbnails.length === 1) {
    return (
      <div className="flex h-[214px] w-[250px] items-center justify-center">
        <Tile
          recipe={thumbnails[0]}
          alt={alt}
          className="relative h-[196px] w-[156px]"
          style={{ transform: "rotate(-2.5deg)" }}
        />
      </div>
    );
  }

  const isPair = thumbnails.length === 2;
  const transforms = isPair ? PAIR : FAN;

  return (
    <div className={`relative w-[250px] ${isPair ? "h-[196px]" : "h-[190px]"}`}>
      {thumbnails.map((recipe, i) => (
        <Tile
          key={recipe.id}
          recipe={recipe}
          alt={alt}
          className={
            isPair
              ? "absolute left-1/2 top-[12px] -ml-[69px] h-[172px] w-[138px]"
              : "absolute left-1/2 top-[14px] -ml-[66px] h-[166px] w-[132px]"
          }
          // La dernière carte passe devant : au centre pour l'éventail, à
          // droite pour la paire.
          style={{ transform: transforms[i], zIndex: i === transforms.length - 1 ? 2 : undefined }}
        />
      ))}
    </div>
  );
}

function Tile({
  recipe,
  alt,
  className,
  style,
}: {
  recipe: JoinThumbnail;
  alt: (title: string) => string;
  className: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      // `className` porte le positionnement (relative en solo, absolute en
      // paire/éventail) : le figer ici gagnerait sur celui de l'appelant —
      // deux utilitaires `position` dans le même attribut, c'est l'ordre de la
      // feuille Tailwind qui tranche, pas l'ordre des classes.
      className={`overflow-hidden rounded-[16px] ${className}`}
      style={{ boxShadow: TILE_SHADOW, ...style }}
    >
      {recipe.imageUrl ? (
        <Image
          src={recipe.imageUrl}
          alt={alt(recipe.title)}
          fill
          className="object-cover"
          sizes="160px"
        />
      ) : (
        // Illustration pas encore générée (~20 s après l'ajout) : le dégradé
        // déterministe des cartes recette, avec le titre — sinon la vignette
        // est un aplat de couleur qui ne dit rien du carnet.
        <div
          className="absolute inset-0 flex items-end p-3"
          style={{ background: getRecipePlaceholderGradient(recipe.id) }}
        >
          <span
            className="line-clamp-3 text-[13.5px] font-semibold leading-tight text-white"
            style={{ textShadow: "0 1px 6px rgba(0, 0, 0, 0.28)" }}
          >
            {recipe.title}
          </span>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { dropSwrCache } from "@/lib/swr";
import { createHouseholdQuick } from "@/lib/household-create";
import CodeEntryForm from "@/components/auth/CodeEntryForm";
import JoinForkScreen from "@/components/auth/JoinForkScreen";
import RecoverFlow from "@/components/auth/RecoverFlow";
import type { OnboardingVariant } from "@/lib/ab-onboarding";

// « join » = fork « Rejoindre un foyer » (#14, maquette 1.2) : code
// d'invitation OU récupération par email — la clé anti-doublon d'owner.
// Plus de vue « create » : « Créer un carnet » crée EN UN TAP (spec #23).
type View = "menu" | "join" | "joinCode" | "recover";

// A/B onboarding (#25) : même écran, mêmes trois actions, ordre différent.
// A (contrôle) : démo en primaire, créer en secondaire, rejoindre en tertiaire.
// B : « Commencer » (créer, puis droit sur la première recette) en primaire,
// « J'ai déjà un carnet » (rejoindre) en secondaire, « Voir un exemple » (démo)
// en lien texte.
export default function LandingScreen({
  variant = "a",
  probe = false,
}: {
  variant?: OnboardingVariant;
  probe?: boolean;
}) {
  const t = useT();
  const [view, setView] = useState<View>("menu");
  const [demoLoading, setDemoLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const busy = demoLoading || createLoading;

  async function handleCreate() {
    if (busy) return;
    setCreateLoading(true);
    setDemoError(null);
    try {
      const { redirect } = await createHouseholdQuick(t.household.createError);
      // Bras B (#25, décision du 2026-09-16) : on atterrit sur le carnet VIDE,
      // comme en A — pas sur l'écran d'import. Les premières lectures du journal
      // (#28) : 4 arrivants B sur 6 importaient, voyaient le formulaire et
      // faisaient « retour » — venus regarder, pas ajouter. L'état vide garde
      // un seul bouton vers l'import, pour ne pas surcharger l'arrivée ; qui a
      // l'intention d'ajouter le tape. (Le mode first=1 de /recipes/new reste
      // accessible par URL, plus relié ici.)
      window.location.href = redirect;
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : t.household.createError);
      setCreateLoading(false);
    }
  }

  async function handleTryApp() {
    if (busy) return;
    setDemoLoading(true);
    setDemoError(null);
    try {
      const response = await fetch("/api/demo/session", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as { error?: string }).error ?? t.household.leaveError);
      }
      dropSwrCache(); // entering the demo: previous session's cache is stale
      window.location.href = (data as { redirect?: string }).redirect ?? "/home";
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : t.household.leaveError);
      setDemoLoading(false);
    }
  }

  if (view === "join") {
    return (
      <JoinForkScreen
        onCode={() => setView("joinCode")}
        onRecover={() => setView("recover")}
        onBack={() => setView("menu")}
      />
    );
  }

  if (view === "joinCode") {
    return <CodeEntryForm onCancel={() => setView("join")} />;
  }

  if (view === "recover") {
    return <RecoverFlow onBack={() => setView("join")} />;
  }

  // `track` : identifiant du journal des événements (#28) — par action, pas par
  // position, pour comparer les bras A/B sur la même cible.
  const demoAction = {
    label: variant === "b" ? t.landing.seeExample : t.landing.tryApp,
    onClick: handleTryApp,
    loading: demoLoading,
    track: "landing.demo",
  };
  const createAction = {
    label: variant === "b" ? t.landing.start : t.landing.createHousehold,
    onClick: handleCreate,
    loading: createLoading,
    track: "landing.start",
  };
  const joinAction = {
    label: variant === "b" ? t.landing.haveCookbook : t.landing.joinHousehold,
    onClick: () => setView("join"),
    loading: false,
    track: "landing.join",
  };
  const [primary, secondary, tertiary] =
    variant === "b"
      ? [createAction, joinAction, demoAction]
      : [demoAction, createAction, joinAction];

  // Welcome / first-launch (Mijote onboarding 06-A). Sage hero is full-bleed
  // (extends behind status bar + home indicator), so we render fixed inset-0
  // and ignore the parent (landing)/layout safe-area padding.
  return (
    <div className="bg-sage-radial fixed inset-0 flex flex-col text-background">
      <div className="landing-hero-pad flex flex-1 flex-col items-center justify-center px-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- local SVG with internal Gaussian blur filter; next/image would force dangerouslyAllowSVG globally */}
        <img
          src="/cocotte-illustration.svg"
          alt=""
          aria-hidden="true"
          width={320}
          height={320}
          className="landing-cocotte h-auto select-none"
          draggable={false}
        />
        <h1
          className="display landing-title mt-7 text-center"
          style={{
            fontWeight: 700,
            fontSize: "clamp(72px, 23vw, 92px)",
            lineHeight: 0.95,
            letterSpacing: "-0.025em",
          }}
        >
          {t.landing.title}
        </h1>
      </div>

      <div
        className="mx-auto flex w-full max-w-[400px] flex-col gap-2.5 px-6"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 40px)",
        }}
      >
        {probe && (
          <p className="text-center text-[12px] font-medium tracking-wide text-background/80 uppercase">
            {t.landing.probeBadge}
          </p>
        )}
        {demoError && (
          <p role="alert" className="text-center text-sm font-medium text-background">
            {demoError}
          </p>
        )}

        {/* Primary — cream pill · Secondary — ghost outlined pill (1.5px cream
            @55%) · Tertiary — text link. L'ordre dépend du bras. */}
        <button
          type="button"
          onClick={primary.onClick}
          data-track={primary.track}
          disabled={busy}
          className="flex h-[54px] items-center justify-center rounded-[27px] bg-background text-[17px] font-semibold tracking-[-0.005em] text-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          {primary.loading ? "…" : primary.label}
        </button>

        <button
          type="button"
          onClick={secondary.onClick}
          data-track={secondary.track}
          disabled={busy}
          className="flex h-[54px] items-center justify-center rounded-[27px] bg-transparent text-[17px] font-semibold tracking-[-0.005em] text-background transition-colors hover:bg-background/10 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/70"
          style={{ boxShadow: "inset 0 0 0 1.5px rgba(245, 241, 232, 0.55)" }}
        >
          {secondary.loading ? "…" : secondary.label}
        </button>

        <button
          type="button"
          onClick={tertiary.onClick}
          data-track={tertiary.track}
          disabled={busy}
          className="flex w-full items-center justify-center bg-transparent py-[14px] text-[16px] font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/70"
        >
          {tertiary.loading ? "…" : tertiary.label}
        </button>
      </div>
    </div>
  );
}

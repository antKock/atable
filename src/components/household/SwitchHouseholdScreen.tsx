"use client";

import { useState } from "react";
import { ChevronRight, KeyRound, Plus } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import BackButton from "@/components/ui/BackButton";
import CreateHouseholdForm from "@/components/auth/CreateHouseholdForm";
import CodeEntryForm from "@/components/auth/CodeEntryForm";

type View = "menu" | "create" | "join";

// « Créer ou rejoindre un foyer » depuis le hub. Sémantique ADDITIVE (Lot 4) :
// l'appareil AJOUTE un foyer à l'owner courant (les routes create/join
// détectent la session et n'émettent plus de nouvelle session/cookie). Les
// formulaires d'onboarding sont réutilisés tels quels — leur `onSuccess` par
// défaut suit le `redirect` renvoyé (vers le hub / le nouveau foyer), sans
// réécrire le cookie.
export default function SwitchHouseholdScreen() {
  const t = useT();
  const [view, setView] = useState<View>("menu");

  if (view === "create") {
    return <CreateHouseholdForm onCancel={() => setView("menu")} />;
  }
  if (view === "join") {
    return <CodeEntryForm onCancel={() => setView("menu")} />;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-4">
      <BackButton href="/household" />

      <h1 className="display-xl mb-3 text-foreground">{t.switchHousehold.title}</h1>
      <p className="mb-6 max-w-[380px] text-sm leading-relaxed text-muted-foreground">
        {t.switchHousehold.body}
      </p>

      <div className="divide-y divide-border rounded-xl border border-border bg-surface">
        <button
          type="button"
          onClick={() => setView("create")}
          className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
        >
          <Plus size={18} className="shrink-0 text-accent" aria-hidden="true" />
          <span className="flex-1 text-[15px] font-medium text-foreground">
            {t.switchHousehold.create}
          </span>
          <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setView("join")}
          className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
        >
          <KeyRound size={18} className="shrink-0 text-accent" aria-hidden="true" />
          <span className="flex-1 text-[15px] font-medium text-foreground">
            {t.switchHousehold.join}
          </span>
          <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

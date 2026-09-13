"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BackButton from "@/components/ui/BackButton";
import { useLocale, useT } from "@/lib/i18n/client";
import { FIRST_RECIPE_SAMPLE_URL } from "@/lib/ab-onboarding";
import ImportSelector from "@/components/recipes/import/ImportSelector";
import RecipeForm, { type MemberFoyer } from "@/components/recipes/form/RecipeForm";
import type { ImportedRecipeData } from "@/lib/import";
import type { RecipeSource } from "@/lib/schemas/recipe";

type View = "intent" | "form";

export default function NewRecipeFlow({ memberFoyers = [] }: { memberFoyers?: MemberFoyer[] }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  // The form step is a real history entry (?view=form, pushed in openForm) so
  // the Android hardware back / browser back returns to the import chooser
  // instead of leaving the page. Derived from the URL, not component state.
  const view: View = searchParams.get("view") === "form" ? "form" : "intent";
  const [importedData, setImportedData] = useState<ImportedRecipeData | null>(null);
  const [source, setSource] = useState<RecipeSource>("manual");
  // Whether WE pushed the ?view=form entry. False when the URL was loaded
  // directly (fresh tab): there is nothing under it to pop back to.
  const pushedForm = useRef(false);

  // Captured once at mount: a URL handed in by the iOS share sheet via
  // /recipes/new?import=url&url=… (see DeepLinkHandler). Read eagerly so it
  // survives the history cleanup below.
  const [autoImportUrl] = useState<string | null>(() =>
    searchParams.get("import") === "url" ? searchParams.get("url") : null,
  );

  // Running inside the iOS Share Extension's WebView (?ext=1): the native sheet
  // provides its own header, so we hide the app chrome and dismiss-on-save.
  const [isExt] = useState(() => searchParams.get("ext") === "1");

  // Première recette d'un carnet neuf (?first=1, bras B du A/B onboarding #25) :
  // titre et promesse dédiés, pas de bouton retour sur le choix de méthode (rien
  // derrière : la personne vient de la landing). Le reste de l'écran est celui
  // de #24, à l'identique.
  const [isFirst] = useState(() => searchParams.get("first") === "1");

  // Base URL of this flow: ext=1 and first=1 are sticky across the history
  // cleanup and the form step; view=form is the only transient param.
  const baseUrl = (() => {
    const params = new URLSearchParams();
    if (isExt) params.set("ext", "1");
    if (isFirst) params.set("first", "1");
    const q = params.toString();
    return q ? `/recipes/new?${q}` : "/recipes/new";
  })();
  const formUrl = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}view=form`;

  // Strip the import params from the URL so a refresh doesn't re-trigger the
  // import. Doesn't affect autoImportUrl (already captured above). Keep ext=1 so
  // the extension chrome stays hidden across the cleanup.
  const cleaned = useRef(false);
  useEffect(() => {
    if (autoImportUrl && !cleaned.current) {
      cleaned.current = true;
      router.replace(baseUrl);
    }
  }, [autoImportUrl, baseUrl, router]);

  // Shallow pushState (no server round-trip, component stays mounted so the
  // imported data survives). Next syncs useSearchParams with it.
  function openForm() {
    pushedForm.current = true;
    window.history.pushState(null, "", formUrl);
  }

  function handleImportComplete(data: ImportedRecipeData, importSource: RecipeSource) {
    setImportedData(data);
    setSource(importSource);
    openForm();
  }

  function handleManual() {
    setImportedData(null);
    setSource("manual");
    openForm();
  }

  function handleBack() {
    if (view === "form") {
      if (pushedForm.current) {
        window.history.back();
      } else {
        router.replace(baseUrl);
      }
    } else {
      router.back();
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-6">
      {/* Header — hidden in the Share Extension (the native sheet has its own). */}
      {!isExt && (
        <div className="mb-8">
          <div className="flex items-center gap-3">
            {!(isFirst && view === "intent") && (
              <BackButton variant="header" onClick={handleBack} />
            )}
            <h1
              className="display"
              style={
                isFirst
                  ? {
                      fontWeight: 700,
                      fontSize: 34,
                      lineHeight: 1.05,
                      letterSpacing: "-0.02em",
                      color: "var(--foreground)",
                    }
                  : {
                      fontStyle: "italic",
                      fontWeight: 500,
                      fontSize: 28,
                      letterSpacing: "-0.015em",
                      color: "var(--foreground)",
                    }
              }
            >
              {isFirst ? t.import.firstTitle : t.import.title}
            </h1>
          </div>
          {isFirst && view === "intent" && (
            <p className="text-muted-foreground mt-2.5 max-w-[320px] text-[15px] leading-relaxed">
              {t.import.firstLead}
            </p>
          )}
        </div>
      )}

      {view === "intent" ? (
        <ImportSelector
          onImportComplete={handleImportComplete}
          onManual={handleManual}
          autoImportUrl={autoImportUrl}
          sampleUrl={isFirst ? FIRST_RECIPE_SAMPLE_URL[locale] : null}
        />
      ) : (
        <RecipeForm
          mode="create"
          initialData={importedData}
          source={source}
          stickySubmit
          shareExtension={isExt}
          memberFoyers={memberFoyers}
        />
      )}
    </div>
  );
}

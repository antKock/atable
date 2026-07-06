"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { t } from "@/lib/i18n/fr";
import ImportSelector from "./ImportSelector";
import RecipeForm from "./RecipeForm";
import type { ImportedRecipeData } from "@/lib/import";
import type { RecipeSource } from "@/lib/schemas/recipe";

type View = "intent" | "form";

export default function NewRecipeFlow() {
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

  // Strip the import params from the URL so a refresh doesn't re-trigger the
  // import. Doesn't affect autoImportUrl (already captured above). Keep ext=1 so
  // the extension chrome stays hidden across the cleanup.
  const cleaned = useRef(false);
  useEffect(() => {
    if (autoImportUrl && !cleaned.current) {
      cleaned.current = true;
      router.replace(isExt ? "/recipes/new?ext=1" : "/recipes/new");
    }
  }, [autoImportUrl, isExt, router]);

  // Shallow pushState (no server round-trip, component stays mounted so the
  // imported data survives). Next syncs useSearchParams with it.
  function openForm() {
    pushedForm.current = true;
    window.history.pushState(
      null,
      "",
      isExt ? "/recipes/new?ext=1&view=form" : "/recipes/new?view=form",
    );
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
        router.replace(isExt ? "/recipes/new?ext=1" : "/recipes/new");
      }
    } else {
      router.back();
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-6">
      {/* Header — hidden in the Share Extension (the native sheet has its own). */}
      {!isExt && (
        <div className="mb-8 flex items-center gap-3">
          <button
            onClick={handleBack}
            aria-label={t.a11y.backButton}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft size={20} strokeWidth={1.75} />
          </button>
          <h1
            style={{
              fontFamily: "var(--font-fraunces)",
              fontVariationSettings: '"opsz" 144',
              fontStyle: "italic",
              fontWeight: 500,
              fontSize: 28,
              letterSpacing: "-0.015em",
              color: "var(--foreground)",
            }}
          >
            {t.import.title}
          </h1>
        </div>
      )}

      {view === "intent" ? (
        <ImportSelector
          onImportComplete={handleImportComplete}
          onManual={handleManual}
          autoImportUrl={autoImportUrl}
        />
      ) : (
        <RecipeForm
          mode="create"
          initialData={importedData}
          source={source}
          stickySubmit
          shareExtension={isExt}
        />
      )}
    </div>
  );
}

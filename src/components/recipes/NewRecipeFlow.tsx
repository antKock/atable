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
  const [view, setView] = useState<View>("intent");
  const [importedData, setImportedData] = useState<ImportedRecipeData | null>(null);
  const [source, setSource] = useState<RecipeSource>("manual");

  // Captured once at mount: a URL handed in by the iOS share sheet via
  // /recipes/new?import=url&url=… (see DeepLinkHandler). Read eagerly so it
  // survives the history cleanup below.
  const [autoImportUrl] = useState<string | null>(() =>
    searchParams.get("import") === "url" ? searchParams.get("url") : null,
  );

  // Strip the import params from the URL so a refresh doesn't re-trigger the
  // import. Doesn't affect autoImportUrl (already captured above).
  const cleaned = useRef(false);
  useEffect(() => {
    if (autoImportUrl && !cleaned.current) {
      cleaned.current = true;
      router.replace("/recipes/new");
    }
  }, [autoImportUrl, router]);

  function handleImportComplete(data: ImportedRecipeData, importSource: RecipeSource) {
    setImportedData(data);
    setSource(importSource);
    setView("form");
  }

  function handleManual() {
    setImportedData(null);
    setSource("manual");
    setView("form");
  }

  function handleBack() {
    if (view === "form") {
      setView("intent");
      setImportedData(null);
    } else {
      router.back();
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-6">
      {/* Header */}
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

      {view === "intent" ? (
        <>
          <p className="mb-8 text-[15px] text-muted-foreground">
            {t.import.subtitle}
          </p>
          <ImportSelector
            onImportComplete={handleImportComplete}
            onManual={handleManual}
            autoImportUrl={autoImportUrl}
          />
        </>
      ) : (
        <RecipeForm
          mode="create"
          initialData={importedData}
          source={source}
          stickySubmit
        />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { t } from "@/lib/i18n/fr";
import ImportSelector from "./ImportSelector";
import RecipeForm from "./RecipeForm";
import type { ImportedRecipeData } from "@/lib/import";
import type { RecipeSource } from "@/lib/schemas/recipe";

type View = "intent" | "form";

export default function NewRecipeFlow() {
  const router = useRouter();
  const [view, setView] = useState<View>("intent");
  const [importedData, setImportedData] = useState<ImportedRecipeData | null>(null);
  const [source, setSource] = useState<RecipeSource>("manual");

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

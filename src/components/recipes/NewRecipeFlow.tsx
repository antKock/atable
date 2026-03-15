"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { t } from "@/lib/i18n/fr";
import ImportSelector from "./ImportSelector";
import RecipeForm from "./RecipeForm";
import type { ImportedRecipeData } from "@/lib/import";

type View = "intent" | "form";

export default function NewRecipeFlow() {
  const router = useRouter();
  const [view, setView] = useState<View>("intent");
  const [importedData, setImportedData] = useState<ImportedRecipeData | null>(null);

  function handleImportComplete(data: ImportedRecipeData) {
    setImportedData(data);
    setView("form");
  }

  function handleManual() {
    setImportedData(null);
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
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-semibold text-foreground">
          {view === "intent" ? t.import.title : t.actions.addRecipe}
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
          stickySubmit
        />
      )}
    </div>
  );
}

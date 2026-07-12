"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, FolderInput } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n/fr";
import ShareButton from "./ShareButton";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import HouseholdPickerDialog, {
  type PickerFoyer,
} from "@/components/household/HouseholdPickerDialog";

type Foyer = { id: string; name: string };

type Props = {
  recipeId: string;
  recipeTitle: string;
  /** Foyer actuel de la recette (marqué « Actuel », non sélectionnable). */
  currentHouseholdId: string;
  /** Foyers où l'owner est MEMBRE — destinations possibles du déplacement. */
  memberFoyers: Foyer[];
  /** MEMBRE du foyer de la recette : débloque éditer/supprimer/déplacer. Un
   *  INVITÉ (false) ne voit que « Partager » (lecture seule sinon). */
  canManage: boolean;
};

// Pill d'actions du hero (fiche recette) : Partager · Éditer · Supprimer, plus
// « Déplacer » (4ᵉ icône) en multi-foyer (maquette 2.4, Lot 4). Extraite en
// composant client pour porter l'état du dialog de déplacement. Pour un INVITÉ,
// seul « Partager » est rendu (canManage=false).
export default function RecipeActionPill({
  recipeId,
  recipeTitle,
  currentHouseholdId,
  memberFoyers,
  canManage,
}: Props) {
  const router = useRouter();
  const [moveOpen, setMoveOpen] = useState(false);
  const [moving, setMoving] = useState(false);

  // « Déplacer » n'a de sens que pour un membre, avec au moins un AUTRE foyer membre.
  const canMove = canManage && memberFoyers.some((f) => f.id !== currentHouseholdId);

  const pickerFoyers: PickerFoyer[] = memberFoyers.map((f) => ({
    id: f.id,
    name: f.name,
    disabled: f.id === currentHouseholdId,
    badge: f.id === currentHouseholdId ? t.household.picker.current : undefined,
  }));

  async function handleMove(householdId: string) {
    setMoving(true);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? t.household.picker.moveError);
      }
      const target = memberFoyers.find((f) => f.id === householdId);
      setMoveOpen(false);
      toast.success(
        target ? t.household.picker.moved(target.name) : t.feedback.recipeUpdated,
        { duration: 2500 },
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.household.picker.moveError, {
        duration: Infinity,
      });
    } finally {
      setMoving(false);
    }
  }

  return (
    <>
      <div
        className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full p-1"
        style={{
          background: "#fff",
          boxShadow:
            "0 2px 8px rgba(0, 0, 0, 0.18), 0 1px 2px rgba(0, 0, 0, 0.10)",
        }}
      >
        <ShareButton
          recipeId={recipeId}
          recipeTitle={recipeTitle}
          className="flex h-7 w-7 items-center justify-center rounded-full text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          iconSize={14}
          iconStroke={1.75}
        />
        {/* Éditer / Déplacer / Supprimer : membres uniquement. Un invité s'arrête
            à « Partager » (pas de séparateur orphelin). */}
        {canManage && (
          <>
            <div className="h-4 w-px bg-border" />
            <Link
              href={`/recipes/${recipeId}/edit`}
              aria-label={t.actions.edit}
              className="flex h-7 w-7 items-center justify-center rounded-full text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Pencil size={14} strokeWidth={1.75} />
            </Link>
            {canMove && (
              <>
                <div className="h-4 w-px bg-border" />
                <button
                  type="button"
                  aria-label={t.actions.move}
                  onClick={() => setMoveOpen(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <FolderInput size={14} strokeWidth={1.75} />
                </button>
              </>
            )}
            <div className="h-4 w-px bg-border" />
            <ConfirmDeleteDialog
              recipeId={recipeId}
              triggerClassName="flex h-7 w-7 items-center justify-center rounded-full text-foreground hover:bg-secondary hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              triggerIconSize={14}
              triggerIconStroke={1.75}
            />
          </>
        )}
      </div>

      {canMove && (
        <HouseholdPickerDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          title={t.household.picker.moveTitle}
          foyers={pickerFoyers}
          onSelect={handleMove}
          busy={moving}
          note={t.household.picker.lockNote}
        />
      )}
    </>
  );
}

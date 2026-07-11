"use client";

import { Check, Lock } from "lucide-react";
import { t } from "@/lib/i18n/fr";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PickerFoyer = {
  id: string;
  name: string;
  /** Affiché en sous-titre (« N recettes ») quand fourni. */
  recipeCount?: number;
  /** Ligne inerte (foyer actuel lors d'un déplacement) avec un badge. */
  disabled?: boolean;
  badge?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  foyers: PickerFoyer[];
  /** Tap sur un foyer = confirme ET agit (pas de bouton, décision n°10). */
  onSelect: (householdId: string) => void;
  /** Verrouille la liste pendant l'action (POST/PATCH en cours). */
  busy?: boolean;
  /** Note discrète en bas (ex. « les foyers invités sont en lecture seule »). */
  note?: string;
};

// Dialog de choix de foyer (maquette 0.4 / 2.4, Lot 4). Réutilise ui/dialog
// (Radix) — mobile ET desktop, décision n°8 (pas de bottom-sheet à créer).
// Servi à l'enregistrement d'une recette (choix du foyer) et au déplacement.
export default function HouseholdPickerDialog({
  open,
  onOpenChange,
  title,
  foyers,
  onSelect,
  busy = false,
  note,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {note && <DialogDescription>{note}</DialogDescription>}
        </DialogHeader>

        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {foyers.map((foyer) => {
            const inert = foyer.disabled || busy;
            return (
              <li key={foyer.id}>
                <button
                  type="button"
                  disabled={inert}
                  onClick={() => !foyer.disabled && onSelect(foyer.id)}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span
                        className={`truncate text-[15px] font-medium ${
                          foyer.disabled ? "text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {foyer.name}
                      </span>
                      {foyer.badge && (
                        <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                          {foyer.badge}
                        </span>
                      )}
                    </span>
                    {foyer.recipeCount !== undefined && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {t.household.recipeCount(foyer.recipeCount)}
                      </span>
                    )}
                  </span>
                  {foyer.disabled ? (
                    <Lock size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <Check size={18} className="shrink-0 text-accent opacity-0" aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

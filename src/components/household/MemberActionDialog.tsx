"use client";

import { useRouter } from "next/navigation";
import { Eye, LogOut, UserCog } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { useApiMutation } from "@/hooks/useApiMutation";
import { haptics } from "@/lib/haptics";
import type { MembershipRole } from "@/lib/auth/owner-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type MemberTarget = {
  ownerId: string;
  displayName: string;
  role: MembershipRole;
};

type Props = {
  householdId: string;
  member: MemberTarget | null;
  onClose: () => void;
};

// Dialog rôle-aware (décision n°8 : dialog, pas de sheet) déclenché en tapant
// un membre sur le détail du foyer (Lot 3, maquette 2.2). Deux actions : basculer
// le rôle (membre ⇄ invité) et retirer du foyer. Les règles serveur (membre
// only, dernier membre, self, démo) sont dans l'API — ici on route les 4xx.
export default function MemberActionDialog({ householdId, member, onClose }: Props) {
  const t = useT();
  const router = useRouter();
  // `loading` repasse à false après CHAQUE appel, succès compris : plus de
  // dialog figée au 2ᵉ membre (#7 — l'ancien état manuel ne se remettait à
  // false que dans le catch, et router.refresh() ne redémonte pas ce composant).
  const roleMutation = useApiMutation({ fallbackError: t.household.memberAction.roleError });
  const removeMutation = useApiMutation({ fallbackError: t.household.memberAction.removeError });
  const isSubmitting = roleMutation.loading || removeMutation.loading;

  const close = () => {
    if (!isSubmitting) onClose();
  };

  async function changeRole(nextRole: MembershipRole) {
    if (!member) return;
    void haptics.light();
    const data = await roleMutation.run(
      `/api/households/${householdId}/members/${member.ownerId}`,
      {
        method: "PATCH",
        body: { role: nextRole },
      },
    );
    if (!data) return;
    onClose();
    router.refresh();
  }

  async function remove() {
    if (!member) return;
    void haptics.heavy();
    const data = await removeMutation.run(
      `/api/households/${householdId}/members/${member.ownerId}`,
      {
        method: "DELETE",
      },
    );
    if (!data) return;
    onClose();
    router.refresh();
  }

  const isGuest = member?.role === "guest";

  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && close()}>
      {member && (
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{member.displayName}</DialogTitle>
            <DialogDescription>
              {isGuest
                ? t.household.memberAction.subtitleGuest
                : t.household.memberAction.subtitleMember}
            </DialogDescription>
          </DialogHeader>

          {/* Actions en lignes icône + libellé (maquette 2.2 / MemberActionScreen),
              bien démarquées : chaque action porte une icône de tête. */}
          <div className="flex flex-col gap-1">
            {/* Bascule de rôle */}
            <Button
              variant="ghost"
              type="button"
              data-track="household.member_role"
              disabled={isSubmitting}
              onClick={() => changeRole(isGuest ? "member" : "guest")}
              className="min-h-11 justify-start gap-3 px-3"
            >
              {isGuest ? (
                <UserCog size={18} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Eye size={18} strokeWidth={2} aria-hidden="true" />
              )}
              {isGuest ? t.household.memberAction.toMember : t.household.memberAction.toGuest}
            </Button>

            {/* Retrait (destructif) */}
            <Button
              variant="ghost"
              type="button"
              data-track="household.member_remove"
              disabled={isSubmitting}
              onClick={remove}
              className="min-h-11 justify-start gap-3 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut size={18} strokeWidth={2} aria-hidden="true" />
              {t.household.memberAction.remove}
            </Button>
            <p className="px-3 text-xs text-muted-foreground">
              {t.household.memberAction.removeBody}
            </p>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

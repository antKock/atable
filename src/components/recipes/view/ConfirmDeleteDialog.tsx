"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/client";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useInvalidateRecipeLists } from "@/lib/swr";

interface ConfirmDeleteDialogProps {
  recipeId: string;
  triggerClassName?: string;
  triggerIconSize?: number;
  triggerIconStroke?: number;
  triggerLabel?: string;
  /** Identifiant `data-track` (#28) posé sur le déclencheur. */
  track?: string;
}

export default function ConfirmDeleteDialog({
  recipeId,
  triggerClassName,
  triggerIconSize,
  triggerIconStroke,
  triggerLabel,
  track,
}: ConfirmDeleteDialogProps) {
  const t = useT();
  const router = useRouter();
  const invalidateRecipeLists = useInvalidateRecipeLists();
  const [open, setOpen] = useState(false);
  const { run, loading: isDeleting } = useApiMutation({ fallbackError: t.feedback.deleteError });

  async function handleDelete() {
    const data = await run(`/api/recipes/${recipeId}`, { method: "DELETE" });
    setOpen(false);
    if (!data) return;
    toast.success(t.feedback.recipeDeleted, { duration: 2500 });
    invalidateRecipeLists();
    router.push("/home");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerLabel ? (
          <button
            type="button"
            aria-label={triggerLabel}
            data-track={track}
            className={
              triggerClassName ??
              "text-xs text-muted-foreground underline underline-offset-[3px] decoration-[rgba(107,110,104,0.4)]"
            }
          >
            {triggerLabel}
          </button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.actions.delete}
            data-track={track}
            className={
              triggerClassName ??
              "min-h-11 min-w-[44px] text-muted-foreground hover:text-destructive"
            }
          >
            <Trash2
              size={triggerIconSize ?? (triggerClassName ? 16 : 20)}
              strokeWidth={triggerIconStroke ?? 2}
            />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t.deleteDialog.title}</DialogTitle>
          <DialogDescription>{t.deleteDialog.body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isDeleting}
            className="min-h-11"
          >
            {t.deleteDialog.cancel}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            className="min-h-11"
          >
            {t.deleteDialog.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

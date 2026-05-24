"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
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
import { t } from "@/lib/i18n/fr";

interface ConfirmDeleteDialogProps {
  recipeId: string;
  triggerClassName?: string;
  triggerIconSize?: number;
  triggerIconStroke?: number;
}

export default function ConfirmDeleteDialog({
  recipeId,
  triggerClassName,
  triggerIconSize,
  triggerIconStroke,
}: ConfirmDeleteDialogProps) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/recipes/${recipeId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? t.feedback.deleteError);
      }

      setOpen(false);
      toast.success(t.feedback.recipeDeleted, { duration: 2500 });
      mutate("/api/carousels");
      mutate("/api/library");
      router.push("/home");
    } catch (err) {
      setOpen(false);
      toast.error(
        err instanceof Error ? err.message : t.feedback.deleteError,
        { duration: Infinity }
      );
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t.actions.delete}
          className={triggerClassName ?? "min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive"}
        >
          <Trash2
            size={triggerIconSize ?? (triggerClassName ? 16 : 20)}
            strokeWidth={triggerIconStroke ?? 2}
          />
        </Button>
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
            className="min-h-[44px]"
          >
            {t.deleteDialog.cancel}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            className="min-h-[44px]"
          >
            {t.deleteDialog.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

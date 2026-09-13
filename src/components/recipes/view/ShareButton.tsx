"use client";

import { Share } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/client";
import { useApiMutation } from "@/hooks/useApiMutation";
import { isNativeApp } from "@/lib/native";

type Props = {
  recipeId: string;
  recipeTitle: string;
  className?: string;
  iconSize?: number;
  iconStroke?: number;
};

// Mints (or fetches) the recipe's capability link, then hands it to the native
// share sheet when available, falling back to clipboard copy + toast on desktop.
export default function ShareButton({
  recipeId,
  recipeTitle,
  className,
  iconSize = 14,
  iconStroke = 1.75,
}: Props) {
  const t = useT();
  // Toast d'erreur unique (t.share.shareError, 2,5 s) quelle que soit la cause
  // — le message serveur n'est pas plus utile ici.
  const { run, loading } = useApiMutation<{ url?: string }>({
    fallbackError: t.share.shareError,
    toastError: false,
  });

  async function handleShare() {
    if (loading) return;
    try {
      const data = await run(`/api/recipes/${recipeId}/share`);
      if (!data?.url) throw new Error(t.share.shareError);
      const url = data.url;

      // Native iOS shell: use the Capacitor Share plugin — navigator.share is
      // unreliable in WKWebView. Web: Web Share API, then clipboard fallback.
      if (isNativeApp()) {
        try {
          const { Share: CapShare } = await import("@capacitor/share");
          await CapShare.share({ title: recipeTitle, url });
        } catch {
          // User dismissed the native sheet — not an error.
        }
      } else if (navigator.share) {
        try {
          await navigator.share({ title: recipeTitle, url });
        } catch {
          // User dismissed the share sheet — not an error.
        }
      } else {
        await navigator.clipboard.writeText(url);
        toast.success(t.share.linkCopied, { duration: 2000 });
      }
    } catch {
      toast.error(t.share.shareError, { duration: 2500 });
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={loading}
      aria-label={t.share.action}
      className={className}
    >
      <Share size={iconSize} strokeWidth={iconStroke} />
    </button>
  );
}

"use client";

import { useState } from "react";
import { Share } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n/fr";
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
  const [loading, setLoading] = useState(false);

  async function handleShare() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/share`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? t.share.shareError);
      }
      const url: string = data.url;

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
    } finally {
      setLoading(false);
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

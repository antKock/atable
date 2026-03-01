"use client";

import { useEffect } from "react";
import { t } from "@/lib/i18n/fr";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-muted-foreground">{t.feedback.loadError}</p>
      <button
        onClick={reset}
        className="text-sm text-accent underline underline-offset-4"
      >
        {t.retry}
      </button>
    </div>
  );
}

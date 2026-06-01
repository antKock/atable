"use client";

import { useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/fr";

// Canonical App Store listing for Mijote (id 6772487648).
const APP_STORE_URL =
  "https://apps.apple.com/fr/app/mijote-tes-recettes/id6772487648";
const DISMISS_COOKIE = "mijote_install_dismissed";
const DISMISS_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

type Props = {
  // The viewer's foyer join code — revealed only after they tap install, so they
  // can re-join their household inside the freshly-installed app (Safari and the
  // app's WebView don't share a cookie jar, so the session can't carry over).
  code: string;
};

// Shown only to iOS web visitors (gated server-side in the (app) layout). Two
// steps: nudge to install, then surface the foyer code for the handoff.
export default function InstallAppBanner({ code }: Props) {
  const [hidden, setHidden] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  function dismiss() {
    document.cookie = `${DISMISS_COOKIE}=1; max-age=${DISMISS_MAX_AGE}; path=/`;
    setHidden(true);
  }

  function openStore() {
    // New tab so Safari keeps the current page → the user returns to step 2.
    window.open(APP_STORE_URL, "_blank");
  }

  function handleInstall() {
    openStore();
    setShowCode(true);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(t.installBanner.codeCopied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the code is visible on screen anyway.
    }
  }

  if (hidden) return null;

  return (
    <div className="relative mx-4 mb-4 mt-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3">
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.installBanner.dismiss}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/20"
      >
        <X size={16} />
      </button>

      {!showCode ? (
        <>
          <p className="pr-8 text-sm font-semibold text-foreground">
            {t.installBanner.title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t.installBanner.body}
          </p>
          <Button
            type="button"
            size="lg"
            onClick={handleInstall}
            className="mt-3 h-[50px] w-full min-h-11 rounded-xl"
          >
            {t.installBanner.install}
          </Button>
        </>
      ) : (
        <>
          <p className="pr-8 text-sm font-semibold text-foreground">
            {t.installBanner.codeTitle}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t.installBanner.codeBody}
          </p>
          <button
            type="button"
            onClick={copyCode}
            aria-label={t.installBanner.copyCode}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-background px-2.5 py-1 font-mono text-sm font-medium text-foreground transition-colors hover:bg-accent/10"
          >
            {code}
            {copied ? (
              <Check size={14} className="text-accent" />
            ) : (
              <Copy size={14} className="text-muted-foreground" />
            )}
          </button>
          <button
            type="button"
            onClick={openStore}
            className="mt-3 block text-xs font-medium text-accent transition-opacity hover:opacity-80"
          >
            {t.installBanner.reopenStore}
          </button>
        </>
      )}
    </div>
  );
}

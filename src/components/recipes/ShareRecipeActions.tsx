"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { t } from "@/lib/i18n/fr";
import { Button } from "@/components/ui/button";
import CreateHouseholdForm from "@/components/auth/CreateHouseholdForm";
import CodeEntryForm from "@/components/auth/CodeEntryForm";
import RecipeReminderCard from "@/components/recipes/RecipeReminderCard";

export type ViewerState = "guest" | "friend" | "owner";

type Props = {
  token: string;
  viewerState: ViewerState;
  recipeId: string;
  recipeTitle: string;
  recipePhotoUrl: string | null;
};

type Flow = "none" | "create" | "join";
type Status = "idle" | "adding" | "added" | "error";

// Sticky footer matching RecipeForm's submit dock (gradient fade to the cream bg
// + safe-area padding). Houses the contextual call-to-action.
function Dock({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20"
      style={{
        padding: "12px 16px max(16px, env(safe-area-inset-bottom))",
        background:
          "linear-gradient(to bottom, transparent, var(--background) 12px, var(--background))",
      }}
    >
      <div className="mx-auto max-w-2xl">{children}</div>
    </div>
  );
}

// Drives the contextual call-to-action on the public share page:
//  - guest  → create a foyer (or join one) then save the recipe into it
//  - friend → add the recipe to their existing foyer
//  - owner  → passive badge (already theirs)
export default function ShareRecipeActions({
  token,
  viewerState,
  recipeId,
  recipeTitle,
  recipePhotoUrl,
}: Props) {
  const [flow, setFlow] = useState<Flow>("none");
  const [status, setStatus] = useState<Status>("idle");

  async function copyToHousehold(): Promise<string | null> {
    const res = await fetch("/api/recipes/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.recipeId) {
      throw new Error(data.error ?? t.share.addError);
    }
    return data.recipeId as string;
  }

  // Guest path: the household was just created/joined (session cookie is now
  // set), so the copy call is authenticated. Land on the saved copy.
  async function handleGuestSuccess() {
    try {
      const id = await copyToHousehold();
      window.location.href = id ? `/recipes/${id}` : "/home";
    } catch {
      // The household exists either way — drop them home rather than stranding.
      window.location.href = "/home";
    }
  }

  async function handleAddToHousehold() {
    if (status === "adding") return;
    setStatus("adding");
    try {
      await copyToHousehold();
      setStatus("added");
    } catch {
      setStatus("error");
    }
  }

  const reminderCard = (
    <RecipeReminderCard
      recipeId={recipeId}
      title={recipeTitle}
      photoUrl={recipePhotoUrl}
    />
  );

  if (flow === "create") {
    return (
      <CreateHouseholdForm
        onCancel={() => setFlow("none")}
        onSuccess={handleGuestSuccess}
        headerSlot={reminderCard}
        secondary={{ label: t.share.haveHousehold, onClick: () => setFlow("join") }}
      />
    );
  }

  if (flow === "join") {
    return (
      <CodeEntryForm
        onCancel={() => setFlow("none")}
        onSuccess={handleGuestSuccess}
        headerSlot={reminderCard}
      />
    );
  }

  if (viewerState === "owner") {
    return (
      <Dock>
        <div className="flex justify-center">
          <div
            className="inline-flex items-center gap-2 rounded-full bg-white px-[18px] py-[11px] text-sm font-medium text-muted-foreground"
            style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}
          >
            <Check size={16} strokeWidth={2.4} className="text-primary" />
            {t.share.alreadyOwned}
          </div>
        </div>
      </Dock>
    );
  }

  if (viewerState === "friend" && status === "added") {
    return (
      <Dock>
        <div
          className="flex h-[50px] min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-primary"
          style={{
            background: "rgba(110,122,56,0.10)",
            boxShadow: "inset 0 0 0 1px rgba(110,122,56,0.30)",
          }}
        >
          <Check size={17} strokeWidth={2.4} />
          {t.share.added}
        </div>
        <Link
          href="/home"
          className="mt-2 flex items-center justify-center gap-1.5 py-1 text-[13.5px] font-medium text-primary"
        >
          {t.share.viewMyHousehold}
          <ArrowRight size={15} strokeWidth={2} />
        </Link>
      </Dock>
    );
  }

  // Guest "save" and friend "add" share the exact RecipeForm save button.
  const isFriend = viewerState === "friend";
  return (
    <Dock>
      <Button
        type="button"
        size="lg"
        disabled={isFriend && status === "adding"}
        onClick={isFriend ? handleAddToHousehold : () => setFlow("create")}
        className="h-[50px] w-full min-h-11 rounded-xl"
      >
        {isFriend
          ? status === "adding"
            ? t.share.adding
            : t.share.addToHousehold
          : t.share.save}
      </Button>
      {isFriend && status === "error" && (
        <p role="alert" className="mt-2 text-center text-[13.5px] text-destructive">
          {t.share.addError}
        </p>
      )}
    </Dock>
  );
}

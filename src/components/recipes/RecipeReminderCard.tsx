import { t } from "@/lib/i18n/fr";
import { getRecipePlaceholderGradient } from "@/lib/recipe-placeholder";

type Props = {
  recipeId: string;
  title: string;
  photoUrl: string | null;
};

// The one piece of new UI sanctioned by the share handoff: a compact reminder
// of the recipe being saved, placed above the title on the create/join-foyer
// screens so the guest keeps context while signing up.
export default function RecipeReminderCard({ recipeId, title, photoUrl }: Props) {
  return (
    <div
      className="flex items-center gap-3 rounded-[14px] bg-white p-2.5"
      style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}
    >
      <div
        className="h-11 w-11 flex-none rounded-[10px] bg-cover bg-center"
        style={
          photoUrl
            ? { backgroundImage: `url(${photoUrl})` }
            : { background: getRecipePlaceholderGradient(recipeId) }
        }
      />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 text-xs text-muted-foreground">
          {t.share.reminderLabel}
        </div>
        <div
          className="truncate text-foreground"
          style={{
            fontFamily: "var(--font-fraunces)",
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {title}
        </div>
      </div>
    </div>
  );
}

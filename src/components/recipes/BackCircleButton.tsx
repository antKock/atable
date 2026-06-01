import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { t } from "@/lib/i18n/fr";

// Clean white circular back control overlaid top-left on the recipe hero.
// Shared by the authenticated fiche and the in-app variant of the public share
// page so both use the exact same affordance.
export default function BackCircleButton({
  href,
  label = t.a11y.backButton,
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{
        background: "#fff",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.18), 0 1px 2px rgba(0, 0, 0, 0.10)",
      }}
    >
      <ArrowLeft size={18} strokeWidth={1.75} />
    </Link>
  );
}

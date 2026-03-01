"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, BookOpen } from "lucide-react";
import { t } from "@/lib/i18n/fr";

const navItems = [
  { href: "/", label: t.nav.home, icon: Home },
  { href: "/recipes/new", label: t.nav.add, icon: Plus, isAdd: true },
  { href: "/library", label: t.nav.library, icon: BookOpen },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile bottom nav bar */}
      <nav
        aria-label={t.a11y.mainNav}
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex h-16 items-center justify-around">
          {navItems.map(({ href, label, icon: Icon, isAdd }) => {
            const isActive = pathname === href;
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
                    isAdd
                      ? "relative"
                      : isActive
                        ? "text-accent"
                        : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isAdd ? (
                    <span className="flex h-13 w-13 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md">
                      <Icon size={24} />
                    </span>
                  ) : (
                    <>
                      <Icon size={22} />
                      <span>{label}</span>
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop/tablet side rail */}
      <nav
        aria-label={t.a11y.mainNav}
        className="fixed left-0 top-0 hidden h-full w-56 flex-col border-r border-border bg-surface lg:flex"
      >
        <div className="px-6 py-8">
          <span className="text-xl font-semibold text-foreground">{t.appName}</span>
        </div>
        <ul className="flex flex-col gap-1 px-3">
          {navItems.map(({ href, label, icon: Icon, isAdd }) => {
            const isActive = pathname === href;
            return (
              <li key={href}>
                {isAdd ? (
                  <Link
                    href={href}
                    className="flex min-h-[44px] items-center gap-3 rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
                  >
                    <Icon size={18} />
                    {t.actions.addRecipe}
                  </Link>
                ) : (
                  <Link
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors ${
                      isActive
                        ? "bg-accent/10 font-medium text-accent"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

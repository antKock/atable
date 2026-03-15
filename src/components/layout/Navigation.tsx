"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, BookOpen } from "lucide-react";
import { t } from "@/lib/i18n/fr";

const navItems = [
  { href: "/home", label: t.nav.home, icon: Home },
  { href: "/recipes/new", label: t.nav.add, icon: Plus, isAdd: true },
  { href: "/library", label: t.nav.library, icon: BookOpen },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile bottom nav bar — frosted glass */}
      <nav
        aria-label={t.a11y.mainNav}
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 lg:hidden"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          backgroundColor: "var(--background)",
        }}
      >
        <ul className="flex h-14 items-center justify-around">
          {navItems.map(({ href, label, icon: Icon, isAdd }) => {
            const isActive = pathname === href;
            return (
              <li key={href} className="flex-1 flex justify-center">
                <Link
                  href={href}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                  className="flex h-11 w-11 items-center justify-center transition-colors"
                >
                  {isAdd ? (
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-full text-white"
                      style={{
                        background: "var(--btn-gradient)",
                        boxShadow: "var(--btn-shadow)",
                      }}
                    >
                      <Icon size={22} strokeWidth={2.5} />
                    </span>
                  ) : (
                    <Icon
                      size={26}
                      strokeWidth={isActive ? 2.4 : 1.8}
                      style={{
                        color: isActive ? "var(--accent)" : "var(--nav-inactive)",
                        filter: isActive ? "drop-shadow(0 0 4px rgba(110, 122, 56, 0.35))" : "none",
                        transition: "color 0.2s, filter 0.2s",
                      }}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop/tablet side rail — frosted glass */}
      <nav
        aria-label={t.a11y.mainNav}
        className="fixed left-0 top-0 z-50 hidden h-full w-56 flex-col border-r border-border/50 lg:flex"
        style={{
          backgroundColor: "var(--background)",
        }}
      >
        <div className="px-6 py-8">
          <span className="text-xl font-extrabold tracking-tight text-foreground">
            a<span className="text-accent">table</span>
          </span>
        </div>
        <ul className="flex flex-col gap-1 px-3">
          {navItems.map(({ href, label, icon: Icon, isAdd }) => {
            const isActive = pathname === href;
            return (
              <li key={href}>
                {isAdd ? (
                  <Link
                    href={href}
                    className="flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
                    style={{
                      background: "var(--btn-gradient)",
                      boxShadow: "var(--btn-shadow)",
                    }}
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

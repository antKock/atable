"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, BookOpen } from "lucide-react";
import { t } from "@/lib/i18n/fr";

const navItems = [
  { href: "/home", label: t.nav.home, icon: Home },
  { href: "/recipes/new", label: t.nav.add, icon: Plus, isAdd: true },
  { href: "/library", label: t.nav.library, icon: BookOpen },
];

function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const baseline = window.innerHeight;

    function handleResize() {
      // Si le viewport visible perd plus de 150px, on considère le clavier ouvert
      setOpen(baseline - vv.height > 150);
    }

    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, []);

  return open;
}

type NavigationProps = {
  /** Hide the lg+ fixed wordmark (e.g. when DemoBanner already occupies the top). */
  hideWordmark?: boolean;
};

export default function Navigation({ hideWordmark = false }: NavigationProps) {
  const pathname = usePathname();
  const keyboardOpen = useKeyboardOpen();
  // Home page renders its own Mijote heading — skip the fixed wordmark there.
  const showWordmark = !hideWordmark && pathname !== "/home";

  return (
    <>
      {/* Desktop-only wordmark (top-left, fixed) */}
      {showWordmark && (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-6 top-6 z-40 hidden items-center gap-2 lg:flex"
      >
        <span
          style={{
            fontFamily: "var(--font-fraunces)",
            fontVariationSettings: '"opsz" 144',
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: 22,
            letterSpacing: "-0.02em",
            color: "var(--foreground)",
            lineHeight: 1,
          }}
        >
          Mijote
        </span>
      </div>
      )}

      {/* Floating pill nav — universelle, tous breakpoints */}
      <nav
        aria-label={t.a11y.mainNav}
        aria-hidden={keyboardOpen}
        className="fixed left-1/2 z-50"
        style={{
          bottom: "max(env(safe-area-inset-bottom), 12px)",
          width: "min(calc(100% - 32px), 380px)",
          height: 60,
          background: "rgba(245, 241, 232, 0.92)",
          backdropFilter: "blur(10px) saturate(140%)",
          WebkitBackdropFilter: "blur(10px) saturate(140%)",
          border: "1px solid var(--border)",
          borderRadius: 999,
          boxShadow:
            "0 6px 18px rgba(0, 0, 0, 0.10), 0 2px 6px rgba(0, 0, 0, 0.05)",
          opacity: keyboardOpen ? 0 : 1,
          transform: `translateX(-50%) translateY(${keyboardOpen ? "100%" : "0"})`,
          transition: "opacity 0.2s, transform 0.25s ease-out",
          pointerEvents: keyboardOpen ? "none" : "auto",
        }}
      >
        <ul className="flex h-full items-center justify-around px-3">
          {navItems.map(({ href, label, icon: Icon, isAdd }) => {
            const isActive = pathname === href;
            return (
              <li key={href} className="flex flex-1 justify-center">
                <Link
                  href={href}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                  className="flex h-11 w-11 items-center justify-center transition-colors"
                >
                  {isAdd ? (
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white"
                      style={{
                        background: "var(--btn-gradient)",
                        boxShadow: "var(--btn-shadow)",
                      }}
                    >
                      <Icon size={22} strokeWidth={2.5} />
                    </span>
                  ) : (
                    <Icon
                      size={24}
                      strokeWidth={isActive ? 2.4 : 1.75}
                      style={{
                        color: isActive
                          ? "var(--accent)"
                          : "var(--nav-inactive)",
                        filter: isActive
                          ? "drop-shadow(0 0 4px rgba(110, 122, 56, 0.35))"
                          : "none",
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
    </>
  );
}

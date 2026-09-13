import { headers } from "next/headers";
import LandingScreen from "@/components/auth/LandingScreen";
import {
  AB_ONBOARDING_FRESH_HEADER,
  AB_ONBOARDING_HEADER,
  isIosNativeUa,
  isOnboardingVariant,
  type OnboardingVariant,
} from "@/lib/ab-onboarding";
import { trackStat } from "@/lib/admin/track-stat";

// A/B onboarding (#25) : le bras est tiré par le proxy (cookie + en-têtes
// injectés). Sans en-tête (flag éteint, crawler) → bras A, rien n'est compté.
// Une affectation fraîche est comptée ici, une fois, dans stats_daily.
export default async function LandingPage() {
  const hdrs = await headers();
  const header = hdrs.get(AB_ONBOARDING_HEADER);
  const variant: OnboardingVariant = isOnboardingVariant(header) ? header : "a";
  if (header && hdrs.get(AB_ONBOARDING_FRESH_HEADER) === "1") {
    trackStat(variant === "b" ? "ab_onboarding_b" : "ab_onboarding_a");
    if (isIosNativeUa(hdrs.get("user-agent") ?? "")) trackStat("landing_first_open_ios");
  }
  return <LandingScreen variant={variant} />;
}

// Lecture Supabase du dashboard v3 (RPC 043 + tables) → assembleV3.
// Une seule fonction, appelée par la page /admin/stats, le digest hebdo, et
// les pages Explorer / Santé (qui n'en lisent qu'une partie).

import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/db/types";
import { getBilledOpenAiSpend } from "@/lib/admin/openai-costs";
import type { AppStoreDailyRow } from "@/lib/admin/app-store";
import type { Person } from "@/lib/admin/v3/people";
import {
  assembleV3,
  type AbDailyRow,
  type CarnetRow,
  type DailyRow,
  type DemoRow,
  type HealthRow,
  type RawV3,
  type SharingRow,
  type WeeklyActiveRow,
  type WeeklyRecipesRow,
} from "@/lib/admin/v3/assemble";
import { addDays, iso, lastSunday } from "@/lib/admin/v3/weeks";

const WEEKS = 12;

function demoSeedMin(): number {
  const n = Number(process.env.DEMO_SEED_MIN);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export async function loadRawV3(now: Date = new Date()): Promise<RawV3> {
  const supabase = createServerClient();
  // Nom de fonction contraint par le schéma généré ; les arguments sont
  // validés par appel (`Database["public"]["Functions"][fn]["Args"]`).
  const rpc = <
    T,
    Fn extends keyof Database["public"]["Functions"] = keyof Database["public"]["Functions"],
  >(
    fn: Fn,
    params?: Database["public"]["Functions"][Fn]["Args"],
  ) =>
    supabase.rpc(fn, params as never).then(({ data, error }) => {
      if (error) throw new Error(`${fn}: ${error.message}`);
      return (data ?? []) as T;
    });

  // App Store : 12 semaines closes + 4 de comparaison.
  const appStoreFrom = addDays(lastSunday(now), -(WEEKS + 4) * 7);

  const [
    people,
    weeklyActive,
    weeklyRecipes,
    demo,
    healthRows,
    sharingRows,
    carnets,
    daily,
    appStore,
    abOnboarding,
    billedUsd,
  ] = await Promise.all([
    rpc<Person[]>("analytics_v3_people"),
    rpc<WeeklyActiveRow[]>("analytics_v3_weekly_active", { p_weeks: WEEKS + 4 }),
    rpc<WeeklyRecipesRow[]>("analytics_v3_weekly_recipes", { p_weeks: WEEKS + 4 }),
    rpc<DemoRow[]>("analytics_v3_demo", { p_days: 28 }),
    rpc<HealthRow[]>("analytics_v3_health", { p_days: 28 }),
    rpc<SharingRow[]>("analytics_v3_sharing", { p_days: 84 }),
    rpc<CarnetRow[]>("analytics_v3_carnets"),
    // 12 semaines closes + la semaine en cours (funnel App Store hebdo), et 14 + 28 jours
    // pour les médianes par jour de semaine du bloc « 7 derniers jours ».
    rpc<DailyRow[]>("analytics_v3_daily", { p_days: (WEEKS + 2) * 7 }),
    supabase
      .from("app_store_daily")
      .select(
        "day, source_type, source_info, dl_first_time, dl_redownload, dl_update, eng_impressions, eng_impressions_uniq, eng_page_views, eng_page_views_uniq, eng_taps",
      )
      .gte("day", appStoreFrom)
      .then(({ data, error }) => {
        if (error) throw new Error(`app_store_daily: ${error.message}`);
        return (data ?? []) as AppStoreDailyRow[];
      }),
    // A/B onboarding (046) : affectations par bras + premières ouvertures iOS,
    // même fenêtre que l'App Store (funnel hebdo).
    rpc<AbDailyRow[]>("analytics_v3_ab_onboarding", { p_since: appStoreFrom }),
    getBilledOpenAiSpend(28),
  ]);

  const health = healthRows[0];
  if (!health) throw new Error("analytics_v3_health: aucune ligne");

  return {
    people,
    weeklyActive,
    weeklyRecipes,
    demo,
    health,
    appStore,
    sharing: sharingRows[0] ?? { links: 0, links_dated_estimate: false, copies: 0 },
    carnets,
    daily,
    abOnboarding,
    billedUsd,
    demoSeedMin: demoSeedMin(),
    now,
  };
}

export async function getDashboardV3(now: Date = new Date()) {
  const raw = await loadRawV3(now);
  return { data: assembleV3(raw), raw };
}

export { iso };

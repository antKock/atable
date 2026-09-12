// Calendrier des fenêtres du dashboard v3 : semaines ISO (lundi → dimanche),
// « 4 sem. » = les 4 semaines pleines terminées le dernier dimanche, comparées
// aux 4 précédentes. Tout est calculé en UTC sur des dates ISO (YYYY-MM-DD).

export const DAY_MS = 86_400_000;

export const iso = (d: Date): string => d.toISOString().slice(0, 10);

export function addDays(isoDay: string, n: number): string {
  const d = new Date(isoDay + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso + "T00:00:00Z").getTime() - new Date(fromIso + "T00:00:00Z").getTime()) / DAY_MS);
}

/** Dernier dimanche strictement avant `today` (fin de la dernière semaine ISO close). */
export function lastSunday(today: Date): string {
  const d = new Date(iso(today) + "T00:00:00Z");
  const dow = d.getUTCDay(); // 0 = dimanche
  const back = dow === 0 ? 7 : dow;
  d.setUTCDate(d.getUTCDate() - back);
  return iso(d);
}

export type Window = { from: string; to: string };

/** Fenêtre de `weeks` semaines closes se terminant `endSunday` (inclus). */
export function weeksEnding(endSunday: string, weeks: number): Window {
  return { from: addDays(endSunday, -(weeks * 7 - 1)), to: endSunday };
}

export function inWindow(isoDay: string, w: Window): boolean {
  return isoDay >= w.from && isoDay <= w.to;
}

/** Semaine ISO « 2026-W37 » du jour donné. */
export function isoWeekLabel(isoDay: string): string {
  const d = new Date(isoDay + "T00:00:00Z");
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Lundi de la semaine ISO contenant le jour. */
export function weekStart(isoDay: string): string {
  const d = new Date(isoDay + "T00:00:00Z");
  const dow = d.getUTCDay() || 7;
  return addDays(isoDay, -(dow - 1));
}

/** Les `n` lundis des semaines closes, du plus ancien au plus récent. */
export function weekStarts(endSunday: string, n: number): string[] {
  const last = addDays(endSunday, -6);
  return Array.from({ length: n }, (_, i) => addDays(last, -7 * (n - 1 - i)));
}

export function shortDate(isoDay: string): string {
  return new Date(isoDay + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function monthLabel(isoMonth: string): string {
  const s = new Date(isoMonth.slice(0, 7) + "-01T00:00:00Z").toLocaleDateString("fr-FR", { month: "long", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

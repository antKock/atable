import { createServerClient } from "@/lib/supabase/server";
import { aliasForOwner } from "@/lib/alias";
import type { Database, Json } from "@/lib/db/types";

// Données de la page Parcours (#28, spec §8.2) : le « replay pauvre » — les
// dernières sessions, et la timeline BRUTE d'un appareil anonyme groupée par
// session. On affiche le brut (y compris les cibles de secours `?button…`) :
// c'est là qu'on voit ce qu'on n'avait pas prévu.

export type SessionRow = Database["public"]["Views"]["v_sessions"]["Row"];
export type EventRow = Database["public"]["Views"]["v_event_sessions"]["Row"];

export type SessionListItem = SessionRow & { display_name: string | null };

export type Timeline = {
  anonId: string;
  displayName: string | null;
  ownerId: string | null;
  sessions: { sessionNo: number; startedAt: string; events: EventRow[] }[];
};

/** Surnoms des owners (nom choisi, sinon alias stocké, sinon alias calculé) — jamais d'e-mail. */
async function displayNames(ownerIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(ownerIds.filter(Boolean))];
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data } = await createServerClient().from("owners").select("id, name, alias").in("id", ids);
  for (const o of data ?? []) out.set(o.id, o.name ?? o.alias ?? aliasForOwner(o.id));
  return out;
}

export async function listSessions(opts: {
  demo?: boolean;
  ownerId?: string;
  limit?: number;
}): Promise<SessionListItem[]> {
  const supabase = createServerClient();
  let q = supabase
    .from("v_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.ownerId) q = q.eq("owner_id", opts.ownerId);
  else q = q.eq("is_demo", opts.demo ?? false);
  const { data, error } = await q;
  if (error) throw new Error(`parcours: sessions (${error.message})`);
  const rows = data ?? [];
  const names = await displayNames(rows.map((r) => r.owner_id ?? ""));
  return rows.map((r) => ({
    ...r,
    display_name: r.owner_id ? (names.get(r.owner_id) ?? null) : null,
  }));
}

export async function getTimeline(anonId: string): Promise<Timeline | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("v_event_sessions")
    .select("*")
    .eq("anon_id", anonId)
    .order("at", { ascending: true })
    .order("id", { ascending: true })
    .limit(2000);
  if (error) throw new Error(`parcours: timeline (${error.message})`);
  const events = data ?? [];
  if (events.length === 0) return null;
  const ownerId = events.find((e) => e.owner_id)?.owner_id ?? null;
  const names = ownerId ? await displayNames([ownerId]) : new Map<string, string>();
  const sessions: Timeline["sessions"] = [];
  for (const e of events) {
    const no = e.session_no ?? 0;
    const last = sessions[sessions.length - 1];
    if (!last || last.sessionNo !== no) {
      sessions.push({ sessionNo: no, startedAt: e.at ?? "", events: [e] });
    } else {
      last.events.push(e);
    }
  }
  sessions.reverse(); // la plus récente en haut, événements dans l'ordre à l'intérieur
  return {
    anonId,
    displayName: ownerId ? (names.get(ownerId) ?? null) : null,
    ownerId,
    sessions,
  };
}

// ----- Rendu d'une ligne -----------------------------------------------------

function str(props: Json | null, key: string): string | undefined {
  if (!props || typeof props !== "object" || Array.isArray(props)) return undefined;
  const v = (props as Record<string, Json | undefined>)[key];
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined;
}

function paramsShort(props: Json | null): string {
  if (!props || typeof props !== "object" || Array.isArray(props)) return "";
  const params = (props as Record<string, Json | undefined>).params;
  if (!params || typeof params !== "object" || Array.isArray(params)) return "";
  return Object.values(params as Record<string, Json | undefined>)
    .map((v) => (typeof v === "string" ? v.slice(0, 8) : ""))
    .filter(Boolean)
    .join(" ");
}

const fmtMs = (v: string | undefined) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return n >= 10_000 ? `${Math.round(n / 1000)} s` : `${n} ms`;
};

/** Une ligne lisible par événement : `{ what, detail, tone }`. */
export function describeEvent(e: EventRow): { what: string; detail: string; tone: "ok" | "warn" | "bad" | "" } {
  const p = e.props;
  const route = str(p, "route") ?? "";
  switch (e.name) {
    case "screen.viewed":
      return { what: "écran", detail: `${route} ${paramsShort(p)}`.trim(), tone: "" };
    case "screen.left":
      return { what: "quitte", detail: `${route} · ${fmtMs(str(p, "duration_ms"))}`, tone: "" };
    case "ui.clicked": {
      const target = str(p, "target") ?? "";
      return { what: "clic", detail: target, tone: target.startsWith("?") ? "warn" : "" };
    }
    case "ui.seen":
      return { what: "vu", detail: str(p, "target") ?? "", tone: "" };
    case "api.called": {
      const status = Number(str(p, "status"));
      const bits = [
        `${str(p, "method") ?? ""} ${route} → ${status}`,
        fmtMs(str(p, "duration_ms")),
        str(p, "error_code"),
        str(p, "method_kind"),
        str(p, "recipe_id")?.slice(0, 8),
      ].filter(Boolean);
      return { what: "api", detail: bits.join(" · "), tone: status >= 500 ? "bad" : status >= 400 ? "warn" : "ok" };
    }
    case "error.shown":
      return { what: "erreur", detail: `${str(p, "kind") ?? ""} · ${route}`, tone: "bad" };
    case "recipe.cooking_started":
      return { what: "cuisine", detail: str(p, "recipe_id")?.slice(0, 8) ?? "", tone: "ok" };
    case "app.opened":
      return { what: "ouvre", detail: "", tone: "" };
    case "app.resumed":
      return { what: "reprend", detail: "", tone: "" };
    default:
      return { what: e.name ?? "?", detail: JSON.stringify(p), tone: "" };
  }
}

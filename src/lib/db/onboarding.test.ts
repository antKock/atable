import { describe, it, expect, beforeEach } from "vitest";
import { attachNewHouseholdToOwner, provisionOwnerWithHousehold } from "./onboarding";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";

// Sagas d'onboarding (lot 5) : ordre des écritures et SÉMANTIQUE des
// compensations (cf. commentaire de tête d'onboarding.ts). Mock FIFO : c'est
// ici qu'il a sa place, pas dans les tests de routes.
let supa: SupabaseMock;
beforeEach(() => {
  supa = createSupabaseMock();
});

const writes = () => supa.calls.map((c) => `${c.ops[0].method}:${c.table}`);
const payloadOf = (table: string, method: string) =>
  supa.calls.find((c) => c.table === table && c.ops[0].method === method)?.ops[0].args[0];
const deletesOf = (table: string) =>
  supa.calls.filter((c) => c.table === table && c.ops[0].method === "delete");

const OWNER = { id: "owner-1", alias: "Marcassin Songeur", demoTrialStartedAt: null };
const CREATE = {
  kind: "create" as const,
  name: "Chez nous",
  joinCode: "OLIVE-4821",
  guestJoinCode: "THYME-0001",
  origin: "landing" as const,
};

describe("provisionOwnerWithHousehold — foyer neuf", () => {
  it("owner → foyer → membership → session, dans cet ordre ; session pointée sur l'owner", async () => {
    supa.queueResults([
      { error: null }, // insert owner
      { data: { id: "hh-1" } }, // insert household
      { error: null }, // insert membership
      { data: { id: "sid-1" } }, // insert device_session
    ]);
    const r = await provisionOwnerWithHousehold(supa.client, {
      owner: OWNER,
      household: CREATE,
      role: "member",
      deviceName: "iPhone",
    });
    expect(r).toEqual({ ownerId: "owner-1", householdId: "hh-1", sessionId: "sid-1" });
    expect(writes()).toEqual([
      "insert:owners",
      "insert:households",
      "insert:memberships",
      "insert:device_sessions",
    ]);
    expect(payloadOf("owners", "insert")).toEqual({
      id: "owner-1",
      alias: "Marcassin Songeur",
      demo_trial_started_at: null,
    });
    expect(payloadOf("households", "insert")).toEqual({
      name: "Chez nous",
      join_code: "OLIVE-4821",
      guest_join_code: "THYME-0001",
      origin: "landing",
    });
    expect(payloadOf("memberships", "insert")).toEqual({
      owner_id: "owner-1",
      household_id: "hh-1",
      role: "member",
    });
    expect(payloadOf("device_sessions", "insert")).toEqual({
      owner_id: "owner-1",
      household_id: "hh-1",
      device_name: "iPhone",
    });
  });

  it("échec de l'insert owner : rien à compenser, erreur relancée", async () => {
    supa.queueResult({ error: { message: "owner insert failed" } });
    await expect(
      provisionOwnerWithHousehold(supa.client, {
        owner: OWNER,
        household: CREATE,
        role: "member",
        deviceName: "x",
      }),
    ).rejects.toThrow("owner insert failed");
    expect(deletesOf("owners")).toHaveLength(0);
    expect(deletesOf("households")).toHaveLength(0);
  });

  it("échec du foyer : l'owner est supprimé (cascade), pas de delete foyer", async () => {
    supa.queueResults([
      { error: null },
      { data: null, error: { message: "household insert failed" } },
    ]);
    await expect(
      provisionOwnerWithHousehold(supa.client, {
        owner: OWNER,
        household: CREATE,
        role: "member",
        deviceName: "x",
      }),
    ).rejects.toThrow("household insert failed");
    expect(deletesOf("households")).toHaveLength(0);
    expect(deletesOf("owners")).toHaveLength(1);
  });

  it("échec du membership ou de la session : foyer neuf supprimé PUIS owner (ordre inverse)", async () => {
    supa.queueResults([
      { error: null },
      { data: { id: "hh-1" } },
      { error: { message: "membership failed" } },
    ]);
    await expect(
      provisionOwnerWithHousehold(supa.client, {
        owner: OWNER,
        household: CREATE,
        role: "member",
        deviceName: "x",
      }),
    ).rejects.toThrow("membership failed");
    expect(writes().slice(-2)).toEqual(["delete:households", "delete:owners"]);
    expect(deletesOf("households")[0].ops.find((o) => o.method === "eq")!.args).toEqual([
      "id",
      "hh-1",
    ]);
    expect(deletesOf("owners")[0].ops.find((o) => o.method === "eq")!.args).toEqual([
      "id",
      "owner-1",
    ]);
  });

  it("une compensation qui échoue ne masque pas l'erreur d'origine", async () => {
    supa.queueResults([
      { error: null },
      { data: { id: "hh-1" } },
      { error: null },
      { data: null, error: { message: "session failed" } },
      { error: { message: "delete failed" } }, // delete household (ignoré)
    ]);
    await expect(
      provisionOwnerWithHousehold(supa.client, {
        owner: OWNER,
        household: CREATE,
        role: "member",
        deviceName: "x",
      }),
    ).rejects.toThrow("session failed");
  });
});

describe("provisionOwnerWithHousehold — foyer existant (rejoindre, démo)", () => {
  const EXISTING = { kind: "existing" as const, householdId: "hh-demo" };

  it("owner → membership (rôle du code) → session ; aucun insert de foyer", async () => {
    supa.queueResults([{ error: null }, { error: null }, { data: { id: "sid-1" } }]);
    const r = await provisionOwnerWithHousehold(supa.client, {
      owner: { id: "owner-1", alias: "A" },
      household: EXISTING,
      role: "guest",
      deviceName: "Android",
    });
    expect(r).toEqual({ ownerId: "owner-1", householdId: "hh-demo", sessionId: "sid-1" });
    expect(writes()).toEqual(["insert:owners", "insert:memberships", "insert:device_sessions"]);
    expect(payloadOf("memberships", "insert")).toMatchObject({
      household_id: "hh-demo",
      role: "guest",
    });
    // Pas de demo_trial_started_at quand il n'est pas fourni (démo).
    expect("demo_trial_started_at" in (payloadOf("owners", "insert") as object)).toBe(false);
  });

  it("échec de la session : l'owner est supprimé, le foyer PRÉEXISTANT jamais", async () => {
    supa.queueResults([
      { error: null },
      { error: null },
      { data: null, error: { message: "session failed" } },
    ]);
    await expect(
      provisionOwnerWithHousehold(supa.client, {
        owner: { id: "owner-1", alias: "A" },
        household: EXISTING,
        role: "member",
        deviceName: "x",
      }),
    ).rejects.toThrow("session failed");
    expect(deletesOf("households")).toHaveLength(0);
    expect(deletesOf("owners")).toHaveLength(1);
  });
});

describe("attachNewHouseholdToOwner (création additive)", () => {
  it("foyer 'additif' + membership membre sur l'owner existant, sans session", async () => {
    supa.queueResults([{ data: { id: "hh-2" } }, { error: null }]);
    const r = await attachNewHouseholdToOwner(supa.client, {
      ownerId: "owner-real",
      name: "Second",
      joinCode: "A-1",
      guestJoinCode: "B-2",
    });
    expect(r).toEqual({ householdId: "hh-2" });
    expect(writes()).toEqual(["insert:households", "insert:memberships"]);
    expect(payloadOf("households", "insert")).toMatchObject({ origin: "additif" });
  });

  it("échec du membership : le foyer neuf est supprimé, l'owner (préexistant) jamais", async () => {
    supa.queueResults([{ data: { id: "hh-2" } }, { error: { message: "membership failed" } }]);
    await expect(
      attachNewHouseholdToOwner(supa.client, {
        ownerId: "o",
        name: "S",
        joinCode: "A",
        guestJoinCode: "B",
      }),
    ).rejects.toThrow("membership failed");
    expect(deletesOf("households")).toHaveLength(1);
    expect(deletesOf("owners")).toHaveLength(0);
  });
});

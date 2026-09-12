import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiRequest, ApiError } from "./api-client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("apiRequest", () => {
  it("POST par défaut, corps JSON sérialisé avec content-type", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    const data = await apiRequest<{ ok: boolean }>("/api/x", { body: { a: 1 }, fallbackError: "f" });
    expect(data).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/x");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("sans corps : ni body ni content-type (DELETE)", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const data = await apiRequest("/api/x", { method: "DELETE", fallbackError: "f" });
    expect(data).toEqual({});
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
    expect(fetchMock.mock.calls[0][1].headers).toBeUndefined();
  });

  it("lève ApiError avec le message et le code du serveur", async () => {
    fetchMock.mockResolvedValue(jsonResponse(429, { error: "Trop vite", code: "RATE_LIMIT" }));
    const err = await apiRequest("/api/x", { fallbackError: "f" }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("Trop vite");
    expect(err.status).toBe(429);
    expect(err.code).toBe("RATE_LIMIT");
  });

  it("retombe sur fallbackError quand la réponse d'erreur n'est pas du JSON (page proxy)", async () => {
    fetchMock.mockResolvedValue(new Response("<html>502</html>", { status: 502 }));
    await expect(apiRequest("/api/x", { fallbackError: "Réessaie" })).rejects.toThrow("Réessaie");
  });

  it("retombe sur fallbackError quand `error` est vide", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { error: "" }));
    await expect(apiRequest("/api/x", { fallbackError: "Réessaie" })).rejects.toThrow("Réessaie");
  });
});

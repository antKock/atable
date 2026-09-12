// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { useRecipeSave } from "./useRecipeSave";
import { initFormState, type FormState } from "./recipe-form-state";
import { uploadPhoto } from "@/hooks/usePhotoUpload";
import { notifyShareExtensionDone } from "@/lib/share-extension";

const push = vi.fn();
const replace = vi.fn();
const mutate = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace, refresh: vi.fn() }) }));
vi.mock("swr", () => ({ useSWRConfig: () => ({ mutate }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/review", () => ({ maybeRequestReview: vi.fn() }));
vi.mock("@/lib/share-extension", () => ({ notifyShareExtensionDone: vi.fn() }));
vi.mock("@/hooks/usePhotoUpload", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/usePhotoUpload")>();
  const uploadPhoto = vi.fn();
  return { ...actual, uploadPhoto, usePhotoUpload: () => ({ uploadPhoto }) };
});

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function form(overrides: Partial<FormState> = {}): FormState {
  return { ...initFormState({ initialData: null, isEdit: false }), title: "Tarte", ...overrides };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("useRecipeSave — création", () => {
  it("POST /api/recipes, toast, invalidation des deux listes, navigation replace vers la fiche", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "r-9" }));
    const { result } = renderHook(() => useRecipeSave({ mode: "create", source: "url" }));
    const ok = await result.current.save(form(), "hh-1");
    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/recipes");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({ title: "Tarte", source: "url", householdId: "hh-1" });
    expect(toast.success).toHaveBeenCalled();
    expect(mutate).toHaveBeenCalledWith("/api/carousels");
    expect(mutate).toHaveBeenCalledWith("/api/library");
    expect(replace).toHaveBeenCalledWith("/recipes/r-9");
    expect(push).not.toHaveBeenCalled();
  });

  it("Share Extension : ferme la feuille au lieu de naviguer", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "r-9" }));
    const { result } = renderHook(() => useRecipeSave({ mode: "create", shareExtension: true }));
    await result.current.save(form());
    expect(notifyShareExtensionDone).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("erreur serveur : toast avec le message serveur, renvoie false, pas de navigation", async () => {
    fetchMock.mockResolvedValue(jsonResponse(429, { error: "Trop de recettes" }));
    const { result } = renderHook(() => useRecipeSave({ mode: "create" }));
    expect(await result.current.save(form())).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Trop de recettes", { duration: Infinity });
    expect(replace).not.toHaveBeenCalled();
  });

  it("réponse 2xx sans id (page proxy) : erreur générique, false", async () => {
    fetchMock.mockResolvedValue(new Response("<html>", { status: 200 }));
    const { result } = renderHook(() => useRecipeSave({ mode: "create" }));
    expect(await result.current.save(form())).toBe(false);
    expect(toast.error).toHaveBeenCalled();
  });

  it("photo en attente : willUploadPhoto, upload différé APRÈS la navigation, repli régénération si l'upload échoue", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(201, { id: "r-9" }))
      .mockResolvedValueOnce(jsonResponse(200, {}));
    vi.mocked(uploadPhoto).mockResolvedValue({ error: "trop lourde" });
    const file = new File([new Uint8Array(3)], "p.jpg", { type: "image/jpeg" });
    const { result } = renderHook(() => useRecipeSave({ mode: "create" }));
    await result.current.save(form({ photoFile: file }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).willUploadPhoto).toBe(true);
    expect(replace).toHaveBeenCalledWith("/recipes/r-9");
    expect(uploadPhoto).toHaveBeenCalledWith(file, "r-9");
    await flush();
    // Repli : PUT regenerateImage sur la recette créée.
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/recipes/r-9");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toMatchObject({ regenerateImage: true, title: "Tarte" });
    expect(toast.error).toHaveBeenCalled();
  });
});

describe("useRecipeSave — édition", () => {
  it("PUT /api/recipes/[id] avec photoUrl null si retirée, puis push vers la fiche", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: "r-1" }));
    const { result } = renderHook(() => useRecipeSave({ mode: "edit", recipeId: "r-1" }));
    const ok = await result.current.save(form({ photoRemoved: true }));
    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/recipes/r-1");
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body);
    expect(body.photoUrl).toBeNull();
    expect(body.source).toBeUndefined();
    expect(push).toHaveBeenCalledWith("/recipes/r-1");
  });

  it("édition avec photo : upload différé, PAS de repli régénération sur échec", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: "r-1" }));
    vi.mocked(uploadPhoto).mockResolvedValue({ error: "x" });
    const file = new File([new Uint8Array(3)], "p.jpg", { type: "image/jpeg" });
    const { result } = renderHook(() => useRecipeSave({ mode: "edit", recipeId: "r-1" }));
    await result.current.save(form({ photoFile: file }));
    await flush();
    expect(uploadPhoto).toHaveBeenCalledWith(file, "r-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalled();
  });
});

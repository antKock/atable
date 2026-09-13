// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import TagInput from "@/components/recipes/form/TagInput";

afterEach(() => cleanup());

const TAGS = [
  { id: "t1", name: "Dessert", category: "Type de plat" },
  { id: "t2", name: "Végétarien", category: "Régime alimentaire" },
  { id: "t3", name: "Perso", category: null },
];

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function renderInput(props: Partial<React.ComponentProps<typeof TagInput>> = {}) {
  const onAdd = vi.fn();
  render(
    // Cache SWR neuf par test (pas de provider localStorage ici).
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <TagInput selectedTags={[]} onAdd={onAdd} onRemove={vi.fn()} {...props} />
    </SWRConfig>,
  );
  return { onAdd };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("TagInput (revue 2026-09-12 : SWR + TagListbox)", () => {
  it("charge le catalogue via /api/tags et liste les options groupées, index à plat", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { tags: TAGS }));
    renderInput();
    const input = screen.getByRole("combobox", { name: "Tags" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/tags"));
    fireEvent.change(input, { target: { value: "e" } });
    const options = await screen.findAllByRole("option");
    // « Dessert », « Végétarien », « Perso » + « Créer ‘e’ » (pas de correspondance exacte)
    expect(options.map((o) => o.id)).toEqual(["tag-option-0", "tag-option-1", "tag-option-2", "tag-option-3"]);
    expect(options[3].textContent).toContain("Créer");
  });

  it("sélection au clavier : ArrowDown ×2 + Enter → onAdd du 2e tag à plat", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { tags: TAGS }));
    const { onAdd } = renderInput();
    const input = screen.getByRole("combobox", { name: "Tags" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.change(input, { target: { value: "e" } });
    await screen.findAllByRole("option");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAdd).toHaveBeenCalledWith(TAGS[1]);
  });

  it("affiche une erreur quand le catalogue ne charge pas, sans bloquer la création", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 502 }));
    renderInput();
    expect((await screen.findByRole("alert")).textContent).toContain("Impossible de charger les tags");
    const input = screen.getByRole("combobox", { name: "Tags" });
    fireEvent.change(input, { target: { value: "Nouveau" } });
    expect((await screen.findAllByRole("option"))[0].textContent).toContain("Créer");
  });

  it("créer un tag : POST /api/tags, ajout au cache, onAdd, sans refetch", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { tags: TAGS }))
      .mockResolvedValueOnce(jsonResponse(201, { id: "t9", name: "Nouveau", category: null }));
    const { onAdd } = renderInput();
    const input = screen.getByRole("combobox", { name: "Tags" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.change(input, { target: { value: "Nouveau" } });
    const create = (await screen.findAllByRole("option")).at(-1)!;
    fireEvent.mouseDown(create);
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ id: "t9", name: "Nouveau", category: null }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].method).toBe("POST");
  });

  it("échec de création : message serveur affiché, pas d'onAdd", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { tags: TAGS }))
      .mockResolvedValueOnce(jsonResponse(422, { error: "Nom de tag trop long" }));
    const { onAdd } = renderInput();
    const input = screen.getByRole("combobox", { name: "Tags" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.change(input, { target: { value: "Nouveau" } });
    fireEvent.mouseDown((await screen.findAllByRole("option")).at(-1)!);
    expect((await screen.findByRole("alert")).textContent).toContain("Nom de tag trop long");
    expect(onAdd).not.toHaveBeenCalled();
  });
});

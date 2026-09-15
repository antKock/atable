import { describe, expect, it } from "vitest";
import { pickJoinThumbnails, type JoinThumbnail } from "./join-preview";

const r = (id: string, imageUrl: string | null): JoinThumbnail => ({
  id,
  title: `Recette ${id}`,
  imageUrl,
});

describe("pickJoinThumbnails", () => {
  it("garde l'ordre de récence quand tout est illustré", () => {
    const picked = pickJoinThumbnails([r("a", "u1"), r("b", "u2"), r("c", "u3"), r("d", "u4")]);
    expect(picked.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("fait remonter les recettes illustrées devant celles sans image", () => {
    // Les deux dernières recettes ajoutées attendent encore leur illustration.
    const picked = pickJoinThumbnails([r("a", null), r("b", null), r("c", "u3"), r("d", "u4")]);
    expect(picked.map((p) => p.id)).toEqual(["c", "d", "a"]);
  });

  it("complète avec des recettes sans image quand il n'y en a pas assez", () => {
    const picked = pickJoinThumbnails([r("a", null), r("b", "u2"), r("c", null)]);
    expect(picked.map((p) => p.id)).toEqual(["b", "a", "c"]);
  });

  it("rend moins de trois vignettes sur un carnet qui démarre", () => {
    expect(pickJoinThumbnails([])).toEqual([]);
    expect(pickJoinThumbnails([r("a", "u1")]).map((p) => p.id)).toEqual(["a"]);
    expect(pickJoinThumbnails([r("a", null), r("b", "u2")]).map((p) => p.id)).toEqual(["b", "a"]);
  });
});

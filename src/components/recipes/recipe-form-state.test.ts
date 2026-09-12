import { describe, it, expect } from "vitest";
import { buildRecipePayload, formReducer, initFormState, type FormState } from "./recipe-form-state";

const base = (): FormState => ({
  ...initFormState({ initialData: null, isEdit: false }),
  title: "  Tarte  ",
  ingredients: "pommes",
  steps: "",
  notes: " ",
  selectedTags: [{ id: "t1", name: "Dessert", category: null }],
  seasons: ["automne"],
  servings: 4,
});

describe("buildRecipePayload", () => {
  it("normalise les textes (trim, vide → null) et aplatit les tags", () => {
    const p = buildRecipePayload(base(), { isEdit: true });
    expect(p).toMatchObject({
      title: "Tarte",
      ingredients: "pommes",
      steps: null,
      notes: null,
      tagIds: ["t1"],
      seasons: ["automne"],
      servings: 4,
    });
  });

  it("édition : photoUrl null si retirée, regenerateImage si demandé, jamais de source", () => {
    const p = buildRecipePayload(
      { ...base(), photoRemoved: true, regenerateRequested: true },
      { isEdit: true },
    );
    expect(p.photoUrl).toBeNull();
    expect(p.regenerateImage).toBe(true);
    expect(p.source).toBeUndefined();
    expect(p.willUploadPhoto).toBeUndefined();
  });

  it("création : source (manual par défaut), foyer choisi, willUploadPhoto si une photo suit", () => {
    const file = new File([new Uint8Array(3)], "p.jpg", { type: "image/jpeg" });
    const p = buildRecipePayload({ ...base(), photoFile: file }, { isEdit: false, chosenHouseholdId: "hh-2" });
    expect(p.source).toBe("manual");
    expect(p.householdId).toBe("hh-2");
    expect(p.willUploadPhoto).toBe(true);
    expect("photoUrl" in p).toBe(false);
  });

  it("création sans photo ni foyer : pas de clés optionnelles", () => {
    const p = buildRecipePayload(base(), { isEdit: false, source: "url" });
    expect(p.source).toBe("url");
    expect(p.householdId).toBeUndefined();
    expect(p.willUploadPhoto).toBeUndefined();
  });
});

describe("formReducer — invariants photo", () => {
  const file = new File([new Uint8Array(3)], "p.jpg", { type: "image/jpeg" });

  it("remplacer une photo annule la suppression et la régénération", () => {
    const s = formReducer({ ...base(), photoRemoved: true, regenerateRequested: true }, { type: "replacePhoto", file });
    expect(s).toMatchObject({ photoFile: file, photoRemoved: false, regenerateRequested: false });
  });

  it("retirer la photo annule le fichier en attente et la régénération", () => {
    const s = formReducer({ ...base(), photoFile: file, regenerateRequested: true }, { type: "removePhoto" });
    expect(s).toMatchObject({ photoFile: null, photoRemoved: true, regenerateRequested: false });
  });

  it("demander la régénération abandonne le fichier en attente", () => {
    const s = formReducer({ ...base(), photoFile: file }, { type: "requestRegenerate" });
    expect(s).toMatchObject({ photoFile: null, regenerateRequested: true });
  });

  it("addTag ignore un doublon", () => {
    const s = formReducer(base(), { type: "addTag", tag: { id: "t1", name: "Dessert", category: null } });
    expect(s.selectedTags).toHaveLength(1);
  });
});

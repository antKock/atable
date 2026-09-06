import { describe, expect, it } from "vitest";
import { t as fr } from "./fr";
import { en } from "./en";

// Parité structurelle fr/en et « pas de français qui fuit » dans en.ts. Le
// typage `Dictionary` garantit déjà la forme ; ce test attrape ce que tsc ne
// voit pas : une valeur EN copiée-collée du FR, un pluriel calqué sur la règle
// française (n > 1) alors que l'anglais met le pluriel partout sauf à 1.

type Leaf = { path: string; value: unknown };

function leaves(node: unknown, prefix = ""): Leaf[] {
  if (node !== null && typeof node === "object") {
    return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
      leaves(value, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [{ path: prefix, value: node }];
}

// Caractères qui n'apparaissent jamais dans une phrase anglaise de l'app.
const FRENCH_MARKERS = /[éèêàçùœ«»]/;

// Une fonction du dictionnaire prend des nombres (pluriels, compteurs) ou des
// chaînes (noms). On évalue chaque fonction avec des arguments factices des
// deux types et on vérifie le texte produit (certaines renvoient l'argument
// tel quel, ex. `a11y.recipeCard(title)` — d'où le String()).
const SAMPLE_ARGS: unknown[][] = [
  [0, 0],
  [1, 1],
  [2, 2],
  ["Sample", "Sample"],
];

function evaluated(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "function") {
    return SAMPLE_ARGS.map((args) => String((value as (...a: unknown[]) => unknown)(...args)));
  }
  throw new Error(`feuille de type inattendu : ${typeof value}`);
}

describe("dictionnaires fr / en", () => {
  it("mêmes feuilles (parité structurelle)", () => {
    const frPaths = leaves(fr).map((l) => l.path).sort();
    const enPaths = leaves(en).map((l) => l.path).sort();
    expect(enPaths).toEqual(frPaths);
  });

  it("chaque feuille a le même type (chaîne ↔ chaîne, fonction ↔ fonction)", () => {
    const enByPath = new Map(leaves(en).map((l) => [l.path, l.value]));
    for (const { path, value } of leaves(fr)) {
      expect(typeof enByPath.get(path), path).toBe(typeof value);
    }
  });

  it("aucune valeur EN ne contient de français (chaînes et fonctions évaluées)", () => {
    const offenders = leaves(en)
      .flatMap(({ path, value }) => evaluated(value).map((s) => ({ path, s })))
      .filter(({ s }) => FRENCH_MARKERS.test(s));
    expect(offenders).toEqual([]);
  });

  it("pluriels anglais : singulier à 1 seulement", () => {
    expect(en.household.recipeCount(0)).toBe("0 recipes");
    expect(en.household.recipeCount(1)).toBe("1 recipe");
    expect(en.household.recipeCount(2)).toBe("2 recipes");
    expect(en.household.peopleCount(0)).toBe("0 people");
    expect(en.household.peopleCount(1)).toBe("1 person");
    expect(en.household.peopleCount(3)).toBe("3 people");
    expect(en.import.screenshot.count(0)).toBe("0 images selected");
    expect(en.import.screenshot.count(1)).toBe("1 image selected");
  });

  it("pluriels français : singulier à 0 et 1", () => {
    expect(fr.household.recipeCount(0)).toBe("0 recette");
    expect(fr.household.recipeCount(1)).toBe("1 recette");
    expect(fr.household.recipeCount(2)).toBe("2 recettes");
  });
});

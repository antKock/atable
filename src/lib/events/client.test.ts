// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { clickTarget, screenRoute } from "./client";

describe("screenRoute — motif Next depuis le chemin et useParams()", () => {
  it("remplace les valeurs de params par [clé], identifiants dans params", () => {
    expect(screenRoute("/recipes/abc-123", { id: "abc-123" })).toEqual({
      route: "/recipes/[id]",
      params: { id: "abc-123" },
    });
    expect(screenRoute("/household/h1/invite", { id: "h1" })).toEqual({
      route: "/household/[id]/invite",
      params: { id: "h1" },
    });
  });
  it("sans params : le chemin est le motif", () => {
    expect(screenRoute("/home", {})).toEqual({ route: "/home" });
    expect(screenRoute("/", {})).toEqual({ route: "/" });
  });
  it("gère les valeurs encodées et les catch-all", () => {
    expect(screenRoute("/r/a%20b", { token: "a b" })).toEqual({
      route: "/r/[token]",
      params: { token: "a b" },
    });
    expect(screenRoute("/x/a/b", { rest: ["a", "b"] })).toEqual({
      route: "/x/[rest]",
      params: { rest: "a/b" },
    });
  });
});

describe("clickTarget — data-track le plus proche, trace de secours, none", () => {
  function el(html: string, selector: string): Element {
    document.body.innerHTML = html;
    return document.querySelector(selector)!;
  }
  it("data-track sur le bouton", () => {
    expect(clickTarget(el(`<button data-track="import.url">x</button>`, "button"))).toBe(
      "import.url",
    );
  });
  it("data-track sur un ancêtre, clic sur un enfant du bouton", () => {
    const span = el(`<div data-track="recipe.share"><button><span>x</span></button></div>`, "span");
    expect(clickTarget(span)).toBe("recipe.share");
  });
  it("trace de secours sans data-track : ?tag#id, jamais le texte", () => {
    expect(clickTarget(el(`<button id="go">Commencer</button>`, "button"))).toBe("?button#go");
    expect(clickTarget(el(`<a href="/x">Lien</a>`, "a"))).toBe("?a");
  });
  it("none désactive, non cliquable ignoré", () => {
    expect(clickTarget(el(`<button data-track="none">x</button>`, "button"))).toBeNull();
    expect(clickTarget(el(`<div><p>texte</p></div>`, "p"))).toBeNull();
    expect(clickTarget(null)).toBeNull();
  });
});

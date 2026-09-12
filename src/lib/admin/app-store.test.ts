import { describe, it, expect } from "vitest";
import { sourceLabel } from "./app-store";

describe("sourceLabel", () => {
  it("traduit la source Apple et nomme les referrers connus", () => {
    expect(sourceLabel("App Store search", "")).toBe("Recherche App Store");
    expect(sourceLabel("App referrer", "com.openai.chat")).toBe("Depuis une app · ChatGPT");
    expect(sourceLabel("App referrer", "com.example.unknown")).toBe("Depuis une app · com.example.unknown");
    expect(sourceLabel("Something new", "")).toBe("Something new");
  });
});

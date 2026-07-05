import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import openai from "@/lib/openai";
import { createServerClient } from "@/lib/supabase/server";
import { enrichRecipe, regenerateImage, sanitizeDietTags } from "./enrichment";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";
import { chatCompletion, enrichmentResult, imageResponse } from "@/test/openai-mock";
import { recipeDbRow } from "@/test/fixtures";

vi.mock("@/lib/openai", () => ({
  default: {
    chat: { completions: { create: vi.fn() } },
    audio: { transcriptions: { create: vi.fn() } },
    images: { generate: vi.fn() },
  },
}));
// Cost metering writes to Supabase; stub it so it doesn't consume queued mock
// results. Metering itself is covered by ai-cost.test.ts.
vi.mock("@/lib/ai-cost", () => ({
  recordAiCost: vi.fn(),
  textCostUsd: () => 0,
  imageCostUsd: () => 0,
}));
vi.mock("@/lib/supabase/server");

const mockChat = openai.chat.completions.create as unknown as Mock;
const mockImages = openai.images.generate as unknown as Mock;

let supa: SupabaseMock;

beforeEach(() => {
  vi.resetAllMocks();
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
});

/** All payloads passed to `.update()` on a given table, in order. */
function updatePayloads(table: string): Record<string, unknown>[] {
  return supa.calls
    .filter((c) => c.table === table)
    .flatMap((c) => c.ops)
    .filter((op) => op.method === "update")
    .map((op) => op.args[0] as Record<string, unknown>);
}

describe("enrichRecipe — skip path", () => {
  it("does nothing when metadata, tags and image are all present", async () => {
    supa.queueResults([
      { data: recipeDbRow({ photo_url: "https://x/p.jpg", enrichment_status: "enriched" }) },
      { count: 2 }, // recipe_tags count
    ]);
    await enrichRecipe("recipe-1");
    expect(mockChat).not.toHaveBeenCalled();
    expect(mockImages).not.toHaveBeenCalled();
    expect(updatePayloads("recipes")).toHaveLength(0);
  });

  it("only updates enrichment_status when content is complete but status is stale", async () => {
    supa.queueResults([
      { data: recipeDbRow({ photo_url: "https://x/p.jpg", enrichment_status: "pending" }) },
      { count: 2 },
      { error: null }, // status update
    ]);
    await enrichRecipe("recipe-1");
    expect(mockChat).not.toHaveBeenCalled();
    expect(updatePayloads("recipes")).toEqual([{ enrichment_status: "enriched" }]);
  });
});

describe("enrichRecipe — full enrichment", () => {
  const sparse = () =>
    recipeDbRow({
      prep_time: null,
      cook_time: null,
      cost: null,
      complexity: null,
      seasons: [],
      image_prompt: null,
      photo_url: null,
      generated_image_url: null,
      enrichment_status: "pending",
    });

  it("fills empty metadata, attaches tags and generates an image", async () => {
    supa.queueResults([
      { data: sparse() }, // 1. recipe select
      { count: 0 }, // 2. recipe_tags count
      { data: [{ name: "Dessert" }, { name: "Végétarien" }] }, // 3. predefined tags
      { error: null }, // 4. recipes metadata update
      { data: [{ id: "t1", name: "Dessert" }, { id: "t2", name: "Végétarien" }] }, // 5. matching tags
      { error: null }, // 6. recipe_tags insert
      { error: null }, // 7. recipes image update
    ]);
    mockChat.mockResolvedValue(chatCompletion(enrichmentResult()));
    mockImages.mockResolvedValue(imageResponse());

    await enrichRecipe("recipe-1");

    expect(mockChat.mock.calls[0][0].model).toBe("gpt-4o-mini");
    const updates = updatePayloads("recipes");
    const metadataUpdate = updates.find((u) => "enrichment_status" in u)!;
    expect(metadataUpdate.prep_time).toBe("20-30 min");
    expect(metadataUpdate.enrichment_status).toBe("enriched");

    expect(mockImages).toHaveBeenCalledTimes(1);
    expect(supa.uploadMock).toHaveBeenCalledTimes(1);
    const imageUpdate = updates.find((u) => u.image_status === "generated")!;
    expect(imageUpdate).toBeDefined();
    expect(supa.calls.some((c) => c.table === "recipe_tags" &&
      c.ops.some((op) => op.method === "insert"))).toBe(true);
  });

  it("skips image generation when skipImage is set (user photo incoming)", async () => {
    supa.queueResults([
      { data: sparse() }, // 1. recipe select
      { count: 0 }, // 2. recipe_tags count
      { data: [{ name: "Dessert" }] }, // 3. predefined tags
      { error: null }, // 4. recipes metadata update
      { data: [{ id: "t1", name: "Dessert" }] }, // 5. matching tags
      { error: null }, // 6. recipe_tags insert
    ]);
    mockChat.mockResolvedValue(chatCompletion(enrichmentResult()));

    await enrichRecipe("recipe-1", { skipImage: true });

    // Metadata still runs...
    expect(mockChat).toHaveBeenCalledTimes(1);
    // ...but no image is generated, and image_status is left untouched.
    expect(mockImages).not.toHaveBeenCalled();
    expect(supa.uploadMock).not.toHaveBeenCalled();
    expect(updatePayloads("recipes").some((u) => "image_status" in u)).toBe(false);
  });

  it("marks the recipe failed when the OpenAI call errors", async () => {
    supa.queueResults([
      { data: sparse() },
      { count: 0 },
      { data: [] },
      { error: null }, // failed-status update
    ]);
    mockChat.mockRejectedValue(new Error("OpenAI unavailable"));

    await enrichRecipe("recipe-1");

    expect(updatePayloads("recipes")).toContainEqual({ enrichment_status: "failed" });
    expect(mockImages).not.toHaveBeenCalled();
  });

  it("marks the recipe failed when it cannot be found", async () => {
    supa.queueResults([
      { data: null, error: { message: "not found" } },
      { error: null }, // failed-status update
    ]);
    await enrichRecipe("missing-recipe");
    expect(updatePayloads("recipes")).toContainEqual({ enrichment_status: "failed" });
    expect(mockChat).not.toHaveBeenCalled();
  });
});

describe("sanitizeDietTags", () => {
  it("drops Végétarien when an animal-protein tag is present", () => {
    expect(sanitizeDietTags(["Poisson", "Végétarien", "Plat principal"]))
      .toEqual(["Poisson", "Plat principal"]);
    expect(sanitizeDietTags(["Fruits de mer", "Végétarien"])).toEqual(["Fruits de mer"]);
    expect(sanitizeDietTags(["Poulet", "Végétarien", "Végan"])).toEqual(["Poulet"]);
  });

  it("drops Végan (but not Végétarien) when Œufs is present", () => {
    expect(sanitizeDietTags(["Œufs", "Végétarien", "Végan"])).toEqual(["Œufs", "Végétarien"]);
  });

  it("keeps diet tags on genuinely vegetarian recipes", () => {
    expect(sanitizeDietTags(["Légumineuses", "Végétarien", "Végan", "Indienne"]))
      .toEqual(["Légumineuses", "Végétarien", "Végan", "Indienne"]);
  });
});

describe("enrichRecipe — tag semantics (besoin #1)", () => {
  const sparse = () =>
    recipeDbRow({
      prep_time: null,
      cook_time: null,
      cost: null,
      complexity: null,
      seasons: [],
      image_prompt: null,
      photo_url: "https://x/p.jpg", // skip the image branch
      enrichment_status: "pending",
    });

  it("injects tag definitions and attribution rules into the system prompt", async () => {
    supa.queueResults([
      { data: sparse() },
      { count: 0 },
      {
        data: [
          { name: "Végétarien", description: "STRICT : aucune viande, volaille, poisson…" },
          { name: "Poisson", description: null },
        ],
      },
      { error: null }, // metadata update
      { data: [] }, // matching tags
    ]);
    mockChat.mockResolvedValue(chatCompletion(enrichmentResult()));

    await enrichRecipe("recipe-1");

    const systemPrompt = mockChat.mock.calls[0][0].messages[0].content as string;
    expect(systemPrompt).toContain("- Végétarien : STRICT : aucune viande, volaille, poisson…");
    expect(systemPrompt).toContain("- Poisson"); // definition-less tag still listed
    expect(systemPrompt).toContain("Règles d'attribution des tags");
  });

  it("strips contradictory diet tags from the LLM response before insertion", async () => {
    supa.queueResults([
      { data: sparse() },
      { count: 0 },
      { data: [{ name: "Poisson" }, { name: "Végétarien" }] },
      { error: null }, // metadata update
      { data: [{ id: "t1", name: "Poisson" }] }, // matching tags
      { error: null }, // recipe_tags insert
    ]);
    mockChat.mockResolvedValue(
      chatCompletion(enrichmentResult({ tags: ["Poisson", "Végétarien"] })),
    );

    await enrichRecipe("recipe-1");

    const tagLookup = supa.calls
      .filter((c) => c.table === "tags")
      .flatMap((c) => c.ops)
      .find((op) => op.method === "in")!;
    expect(tagLookup.args[1]).toEqual(["Poisson"]);
  });
});

describe("regenerateImage", () => {
  it("recomputes the prompt, then generates and stores a new image", async () => {
    supa.queueResults([
      {
        data: {
          title: "Tarte aux pommes",
          ingredients: "pommes",
          steps: "cuire",
          image_prompt: "old prompt",
        },
      }, // recipe select
      { error: null }, // image_status pending
      { error: null }, // image_prompt refresh
      { error: null }, // final update
    ]);
    mockChat.mockResolvedValue(
      chatCompletion({ imagePrompt: "A fresh apple pie, overhead" }),
    );
    mockImages.mockResolvedValue(imageResponse());

    await regenerateImage("recipe-1");

    // The prompt was recomputed (LLM call) rather than the stored one replayed
    expect(mockChat).toHaveBeenCalledTimes(1);
    expect(mockImages).toHaveBeenCalledTimes(1);
    expect(supa.uploadMock).toHaveBeenCalledTimes(1);

    const updates = updatePayloads("recipes");
    const promptUpdate = updates.find((u) => "image_prompt" in u)!;
    expect(promptUpdate.image_prompt).toBe("A fresh apple pie, overhead");
    // The image was generated from the new prompt, not the stored one
    expect(mockImages.mock.calls[0][0].prompt).toContain("A fresh apple pie, overhead");

    const finalUpdate = updates.find((u) => u.image_status === "generated")!;
    expect(finalUpdate).toBeDefined();
    expect(typeof finalUpdate.generated_image_url).toBe("string");
  });

  it("falls back to the stored prompt when the recompute fails", async () => {
    supa.queueResults([
      {
        data: {
          title: "Tarte",
          ingredients: null,
          steps: null,
          image_prompt: "stored prompt",
        },
      }, // recipe select
      { error: null }, // image_status pending
      { error: null }, // final update
    ]);
    mockChat.mockRejectedValue(new Error("LLM down"));
    mockImages.mockResolvedValue(imageResponse());

    await regenerateImage("recipe-1");

    expect(mockImages).toHaveBeenCalledTimes(1);
    expect(mockImages.mock.calls[0][0].prompt).toContain("stored prompt");
    expect(updatePayloads("recipes").find((u) => u.image_status === "generated")).toBeDefined();
  });

  it("marks the image failed when the recipe is missing", async () => {
    supa.queueResults([
      { data: null, error: { message: "not found" } },
      { error: null }, // failed-status update
    ]);
    await regenerateImage("recipe-1");
    expect(mockImages).not.toHaveBeenCalled();
    expect(updatePayloads("recipes")).toContainEqual({ image_status: "failed" });
  });
});

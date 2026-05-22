import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import openai from "@/lib/openai";
import { createServerClient } from "@/lib/supabase/server";
import { enrichRecipe, regenerateImage } from "./enrichment";
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
    await enrichRecipe("recipe-1", false);
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
    await enrichRecipe("recipe-1", false);
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

    await enrichRecipe("recipe-1", true);

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

  it("marks the recipe failed when the OpenAI call errors", async () => {
    supa.queueResults([
      { data: sparse() },
      { count: 0 },
      { data: [] },
      { error: null }, // failed-status update
    ]);
    mockChat.mockRejectedValue(new Error("OpenAI unavailable"));

    await enrichRecipe("recipe-1", true);

    expect(updatePayloads("recipes")).toContainEqual({ enrichment_status: "failed" });
    expect(mockImages).not.toHaveBeenCalled();
  });

  it("marks the recipe failed when it cannot be found", async () => {
    supa.queueResults([
      { data: null, error: { message: "not found" } },
      { error: null }, // failed-status update
    ]);
    await enrichRecipe("missing-recipe", false);
    expect(updatePayloads("recipes")).toContainEqual({ enrichment_status: "failed" });
    expect(mockChat).not.toHaveBeenCalled();
  });
});

describe("regenerateImage", () => {
  it("generates a new image and stores its URL", async () => {
    supa.queueResults([
      { data: { image_prompt: "An apple pie" } }, // recipe select
      { error: null }, // image_status pending
      { error: null }, // final update
    ]);
    mockImages.mockResolvedValue(imageResponse());

    await regenerateImage("recipe-1");

    expect(mockImages).toHaveBeenCalledTimes(1);
    expect(supa.uploadMock).toHaveBeenCalledTimes(1);
    const updates = updatePayloads("recipes");
    const finalUpdate = updates.find((u) => u.image_status === "generated")!;
    expect(finalUpdate).toBeDefined();
    expect(typeof finalUpdate.generated_image_url).toBe("string");
  });

  it("marks the image failed when the recipe has no image_prompt", async () => {
    supa.queueResults([
      { data: { image_prompt: null } },
      { error: null }, // failed-status update
    ]);
    await regenerateImage("recipe-1");
    expect(mockImages).not.toHaveBeenCalled();
    expect(updatePayloads("recipes")).toContainEqual({ image_status: "failed" });
  });
});

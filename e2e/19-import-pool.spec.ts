import { test, expect } from "@playwright/test";
import { newVisitor, createHouseholdViaUI, uniqueName } from "./helpers/onboarding";
import { db } from "./helpers/db";

// Conservation 30 jours des envois d'import, refus possible
// (docs/specs/ocr-appareil/01-conservation-imports.md). Le flag est allumé dans
// le harnais ; un visiteur sonde (défaut) ne voit rien et rien n'est gardé.

const NOTICE = /gardé 30 jours pour corriger et améliorer les imports/;
// JPEG 1×1 : l'OCR échoue (clé OpenAI factice) → import en échec, justement gardé.
const TINY_JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

async function samplesOf(ownerId: string) {
  const { data, error } = await db()
    .from("import_samples")
    .select("id, method, status, error_code, files")
    .eq("owner_id", ownerId);
  if (error) throw error;
  return data ?? [];
}

/** Owner de la session créée à l'instant (la suite E2E tourne sur un seul worker). */
async function latestOwnerId() {
  const { data } = await db()
    .from("device_sessions")
    .select("owner_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data!.owner_id as string;
}

test("un vrai visiteur voit la mention, son import (même en échec) est gardé, le refus supprime tout", async ({
  browser,
}) => {
  const { page } = await newVisitor(browser, { probe: false });
  await createHouseholdViaUI(page, uniqueName("Foyer Conservation"));
  const ownerId = await latestOwnerId();

  await page.goto("/recipes/new");
  await expect(page.getByText(NOTICE)).toBeVisible();

  // Import photo en échec (OCR impossible sans vraie clé) : gardé avec son code.
  const res = await page.request.post("/api/recipes/import/screenshot", {
    data: { images: [TINY_JPEG] },
  });
  expect(res.status()).toBe(422);
  await expect
    .poll(async () =>
      (await samplesOf(ownerId)).map((s) => `${s.method}/${s.status}/${s.error_code}`),
    )
    .toEqual(["photo/422/EXTRACTION_FAILED"]);
  const [sample] = await samplesOf(ownerId);
  expect(sample.files).toEqual([`${sample.id}/1.jpg`]);

  // Refus depuis l'écran d'import : confirmation, et tout est supprimé.
  await page.getByRole("button", { name: "Ne pas les garder" }).click();
  await expect(page.getByText(/C'est noté : on ne gardera pas tes envois/)).toBeVisible();
  expect(await samplesOf(ownerId)).toEqual([]);
  const { data: files } = await db().storage.from("import-pool").list(sample.id);
  expect(files ?? []).toEqual([]);

  // Plus de mention ; le réglage du profil reflète le refus et permet d'y revenir.
  await page.goto("/recipes/new");
  await expect(page.getByText(NOTICE)).toHaveCount(0);
  await page.goto("/household/profile");
  const toggle = page.getByRole("switch", { name: "Aider à améliorer les imports" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await page.goto("/recipes/new");
  await expect(page.getByText(NOTICE)).toBeVisible();
});

test("un visiteur sonde ne voit pas la mention et rien n'est gardé", async ({ browser }) => {
  const { page } = await newVisitor(browser); // sonde par défaut
  await createHouseholdViaUI(page, uniqueName("Foyer Sonde"));
  const ownerId = await latestOwnerId();
  await page.goto("/recipes/new");
  await expect(page.getByText(NOTICE)).toHaveCount(0);
  await page.request.post("/api/recipes/import/screenshot", { data: { images: [TINY_JPEG] } });
  await page.waitForTimeout(1000);
  expect(await samplesOf(ownerId)).toEqual([]);
});

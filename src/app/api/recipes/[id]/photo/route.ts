import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { withOwnerAuth, requireMember } from "@/lib/api/with-owner-auth";
import { householdIds } from "@/lib/auth/owner-context";

// Stay under Vercel's 4.5 MB function body limit; the client resizes photos
// to ~150-300 KB WebP before upload, so this only guards the raw-file fallback.
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
};

type RouteContext = { params: Promise<{ id: string }> };

// Uploads a recipe photo through the server (service role) so the Storage
// bucket needs no anon write policies. Path is derived from the session's
// household, never from client input.
export const POST = withOwnerAuth(
  async (request: NextRequest, { params }: RouteContext, owner) => {
    const { id } = await params;
    const formData = await request.formData();
    const photo = formData.get("photo");

    if (!photo || !(photo instanceof File)) {
      return NextResponse.json({ error: "Photo requise" }, { status: 400 });
    }
    if (photo.size > MAX_PHOTO_BYTES) {
      return NextResponse.json(
        { error: "Photo trop volumineuse (max 4 Mo)" },
        { status: 400 }
      );
    }
    const mime = photo.type.split(";")[0];
    const ext = EXT_BY_MIME[mime];
    if (!ext) {
      return NextResponse.json(
        { error: "Format d'image non supporté" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // La recette doit exister dans un foyer de l'owner ; l'upload est une
    // écriture → MEMBRE requis sur LE foyer de la recette (Lot 4). Le chemin
    // Storage reste rangé par foyer.
    const { data: existing } = await supabase
      .from("recipes")
      .select("id, household_id")
      .eq("id", id)
      .in("household_id", householdIds(owner))
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    const forbidden = requireMember(owner, existing.household_id);
    if (forbidden) return forbidden;
    const householdId = existing.household_id;

    const path = `${householdId}/${id}/photo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("recipe-photos")
      .upload(path, await photo.arrayBuffer(), {
        upsert: true,
        contentType: mime,
        // Long cache: served directly (unoptimized) → keep Supabase egress low.
        cacheControl: "2592000", // 30 days
      });

    if (uploadError) throw new Error(uploadError.message);

    const { data: urlData } = supabase.storage
      .from("recipe-photos")
      .getPublicUrl(path);
    // Cache-buster: the path is stable across replacements but the file is
    // cached 30 days, so a fresh query param forces clients to refetch.
    const url = `${urlData.publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await supabase
      .from("recipes")
      .update({
        photo_url: url,
        // The user's photo is the image now — settle image_status so any
        // "image pending" spinner clears (notably when creation deferred AI
        // generation because this upload was expected).
        image_status: "none",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("household_id", householdId);

    if (updateError) throw new Error(updateError.message);

    revalidatePath("/");
    revalidatePath("/recipes/[id]", "page");

    return NextResponse.json({ url });
  },
);

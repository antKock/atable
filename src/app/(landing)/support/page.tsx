import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import SupportFr, { metadataFr } from "./content-fr";
import SupportEn, { metadataEn } from "./content-en";

// Page servie dans la langue de l'appareil (chantier Version EN, Lot 3) :
// même URL, contenu FR ou EN — voir docs/specs/i18n/00-socle.md (pas de /en).
export async function generateMetadata(): Promise<Metadata> {
  return (await getLocale()) === "en" ? metadataEn : metadataFr;
}

export default async function SupportPage() {
  // `support.links` (#28) : tout lien de la page (contact, confidentialité…) hérite.
  return (
    <div data-track="support.links">
      {(await getLocale()) === "en" ? <SupportEn /> : <SupportFr />}
    </div>
  );
}

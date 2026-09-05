import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import PrivacyFr, { metadataFr } from "./content-fr";
import PrivacyEn, { metadataEn } from "./content-en";

// Source de vérité éditoriale : docs/politique-confidentialite.md (FR).
// Page servie dans la langue de l'appareil (chantier Version EN, Lot 3).
export async function generateMetadata(): Promise<Metadata> {
  return (await getLocale()) === "en" ? metadataEn : metadataFr;
}

export default async function PrivacyPolicyPage() {
  return (await getLocale()) === "en" ? <PrivacyEn /> : <PrivacyFr />;
}

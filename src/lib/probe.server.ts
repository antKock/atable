import { headers } from "next/headers";
import { isProbeHeaders } from "@/lib/probe";

/** La requête courante vient-elle d'une sonde (#26) ? Composants et routes serveur. */
export async function isProbeRequest(): Promise<boolean> {
  try {
    return isProbeHeaders(await headers());
  } catch {
    // Hors contexte requête (tests unitaires, scripts) : pas une sonde.
    return false;
  }
}

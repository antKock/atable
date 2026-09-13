import { shortDate } from "@/lib/admin/v3/weeks";
import { METRIC_EPOCHS, PRODUCT_EVENTS } from "@/lib/admin/epochs";
import { CHANNEL_LABELS } from "@/lib/admin/v3/people";

export default function Definitions() {
  return (
    <>
      <details className="defs" id="defs">
        <summary>Définitions &amp; limites (une seule fois, pour toute la page)</summary>
        <dl>
          <dt>Cuisinier actif</dt>
          <dd>
            Personne réelle (≥ 1 carnet réel, aucun carnet démo/test) active au moins un jour sur 28
            j. v1 = a ouvert l&apos;app ; v2 = a consulté ou ajouté une recette (consultation
            comptée depuis le 13 sept. 2026).
          </dd>
          <dt>Nouvelle personne</dt>
          <dd>
            Création d&apos;une identité réelle (sortie de démo, landing, invitation). Canal =
            plateforme de la première session, ou « invitation » si le carnet existait déjà.
          </dd>
          <dt>Activée à 7 j</dt>
          <dd>
            ≥ 3 recettes ajoutées ET ≥ 1 jour actif après J+1, dans les 7 jours suivant le premier
            carnet.
          </dd>
          <dt>Rétention M1 / M2 / M3</dt>
          <dd>
            Mois de 28 jours : active au moins un jour entre J+28 et J+55 (M1), J+56 et J+83 (M2),
            J+84 et J+111 (M3). Cohorte = mois du premier carnet. Bloc 1 : version glissante
            (arrivées des 4 semaines closes il y a 8 semaines).
          </dd>
          <dt>Comparaisons</dt>
          <dd>
            Semaines ISO ; « 4 sem. » = 4 semaines pleines terminées dimanche, comparées aux 4
            précédentes. Le % est toujours accompagné de n/N ; il passe en gris sous 20 personnes,
            avec la marge d&apos;erreur (Wilson 95 %) au survol.
          </dd>
          <dt>Repères marché</dt>
          <dd>
            Médianes publiées (AppTweak 2025 pour la fiche App Store ; AppsFlyer/Adjust/data.ai via
            UXCam pour la rétention). Ordres de grandeur, définitions proches mais pas identiques
            (D30 = actif le jour 30 ; notre M1 = actif au moins un jour entre J+28 et J+55).
          </dd>
          <dt>Limites connues</dt>
          <dd>
            Avant le {shortDate(METRIC_EPOCHS.ownerGrain)} : personne ≡ session (majorant) et jours
            actifs sous-capturés. Essais démo comptés depuis le{" "}
            {shortDate(METRIC_EPOCHS.demoTrials)}, conversions marquées depuis le{" "}
            {shortDate(METRIC_EPOCHS.conversionMarker)}, stats App Store depuis le{" "}
            {shortDate(METRIC_EPOCHS.appStoreDaily)} (compteurs arrondis, seuillés, J-1). Fiche 1.3
            en ligne le {shortDate(PRODUCT_EVENTS.appStoreListingV2)}. Aucune donnée anonyme de
            landing. Canaux : {Object.values(CHANNEL_LABELS).join(", ")}.
          </dd>
        </dl>
      </details>
    </>
  );
}

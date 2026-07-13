import Link from "next/link";
import type { Metadata } from "next";

// Source de vérité éditoriale : docs/politique-confidentialite.md.
// Toute mise à jour du markdown doit être répercutée ici.

export const metadata: Metadata = {
  title: "Politique de confidentialité — Mijote",
  description:
    "Politique de confidentialité de l'application Mijote. Aucune publicité, aucun pistage, données minimales.",
  alternates: { canonical: "/legal/confidentialite" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Politique de confidentialité — Mijote",
    description:
      "Politique de confidentialité de l'application Mijote. Aucune publicité, aucun pistage, données minimales.",
    type: "article",
  },
};

const updatedAt = "29 juin 2026";
const contactEmail = "kocken.anthony@gmail.com";

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-10 mb-3 scroll-mt-20 text-xl font-semibold tracking-tight text-foreground"
    >
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-6 mb-2 text-base font-semibold text-foreground">
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="my-3 leading-relaxed text-foreground/90">{children}</p>;
}

function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="my-3 list-disc space-y-1.5 pl-6 text-foreground/90">
      {children}
    </ul>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border border-foreground/15 bg-foreground/5 px-3 py-2 text-left font-medium">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="border border-foreground/15 px-3 py-2 align-top text-foreground/90">
      {children}
    </td>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-6 sm:pt-10">
      <nav className="mb-6 text-sm">
        <Link
          href="/"
          className="text-foreground/70 hover:text-foreground hover:underline"
        >
          ← Retour à l&apos;accueil
        </Link>
      </nav>

      <article>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Politique de confidentialité
        </h1>
        <p className="mt-2 text-sm text-foreground/60">
          Dernière mise à jour : {updatedAt}
        </p>

        <H2 id="qui-sommes-nous">1. Qui sommes-nous</H2>
        <P>
          Mijote (« l&apos;Application », « le Service ») est une application
          de gestion de recettes de cuisine et de planification de menus,
          accessible sur le Web, sur l&apos;App Store iOS et sur Google Play
          (Android).
        </P>
        <P>Le responsable du traitement des données personnelles est :</P>
        <UL>
          <li>
            <strong>Anthony Kocken</strong>, éditeur indépendant de
            l&apos;Application.
          </li>
          <li>
            Contact :{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="text-foreground underline underline-offset-2 hover:no-underline"
            >
              {contactEmail}
            </a>
          </li>
          <li>
            Application accessible à l&apos;adresse :{" "}
            <a
              href="https://mijote.anthonykocken.fr"
              className="text-foreground underline underline-offset-2 hover:no-underline"
            >
              https://mijote.anthonykocken.fr
            </a>
          </li>
        </UL>

        <H2 id="approche">2. Notre approche : le strict minimum de données</H2>
        <P>
          Mijote est conçue pour fonctionner <strong>sans compte
          traditionnel</strong>. Vous n&apos;avez besoin de fournir{" "}
          <strong>
            ni adresse e-mail, ni nom, ni numéro de téléphone, ni mot de passe
          </strong>
          . L&apos;accès repose sur la notion de <strong>carnet</strong> : un
          carnet de recettes partagé, ouvert au moyen d&apos;un{" "}
          <strong>code d&apos;invitation</strong>.
        </P>
        <P>Nous nous engageons sur les principes suivants :</P>
        <UL>
          <li>
            <strong>Aucune publicité, aucun profilage publicitaire.</strong>
          </li>
          <li>
            <strong>
              Aucun outil de mesure d&apos;audience ni de traçage
            </strong>{" "}
            (pas de Google Analytics, pas de cookies tiers, pas de pixels de
            suivi).
          </li>
          <li>
            <strong>Aucune vente ni location</strong> de vos données à des
            tiers.
          </li>
          <li>
            <strong>Aucun suivi entre applications ou entre sites</strong> (pas
            de « tracking » au sens de l&apos;App Store).
          </li>
        </UL>

        <H2 id="donnees-traitees">3. Données que nous traitons</H2>
        <H3>3.1 Données que vous nous fournissez</H3>
        <UL>
          <li>
            <strong>Nom du carnet</strong> : le libellé que vous choisissez pour
            votre carnet partagé (ex. « Cuisine de Marie »).
          </li>
          <li>
            <strong>Contenu des recettes</strong> : titres, listes
            d&apos;ingrédients, étapes de préparation, temps de préparation et
            de cuisson, coût estimé, saisons, étiquettes (tags) et photos que
            vous ajoutez.
          </li>
          <li>
            <strong>Contenu soumis aux fonctions d&apos;import</strong> :
            lorsque vous importez une recette, vous nous transmettez, selon la
            méthode choisie : un <strong>enregistrement audio</strong> (dictée
            vocale), une ou plusieurs <strong>images</strong> (photo ou capture
            d&apos;écran), ou une <strong>adresse de page web</strong> (lien
            URL). Le traitement de ces éléments est détaillé à la{" "}
            <a href="#imports-ia" className="underline underline-offset-2">
              section 5
            </a>
            .
          </li>
        </UL>

        <H3>3.2 Données collectées automatiquement</H3>
        <UL>
          <li>
            <strong>Nom d&apos;appareil</strong> : lors de la connexion
            d&apos;un appareil à un carnet, nous dérivons un libellé lisible (ex.
            « Apple iPhone 15 · Safari ») à partir de l&apos;en-tête technique
            « User-Agent » de votre navigateur. Cela vous permet de reconnaître
            et de gérer les appareils connectés à votre carnet. L&apos;en-tête
            brut n&apos;est pas conservé.
          </li>
          <li>
            <strong>Métadonnées de session</strong> : des identifiants
            techniques aléatoires (générés automatiquement, sans lien avec votre
            identité réelle) et la date de dernière activité de chaque
            appareil.
          </li>
          <li>
            <strong>Adresse IP</strong> : utilisée{" "}
            <strong>uniquement et de façon temporaire</strong> pour limiter le
            nombre de tentatives de connexion à un carnet (protection contre les
            abus). Elle <strong>n&apos;est pas enregistrée</strong> dans notre
            base de données et n&apos;est pas associée à votre contenu.
          </li>
          <li>
            <strong>Rapports d&apos;erreur (plantages)</strong> : en cas
            d&apos;erreur technique ou de plantage, un rapport est transmis à
            notre prestataire <strong>Sentry</strong> (voir{" "}
            <a href="#sous-traitants" className="underline underline-offset-2">
              section 6
            </a>
            ). Il peut contenir le message d&apos;erreur, le type
            d&apos;appareil, la version du système et un identifiant technique
            de session, afin de diagnostiquer et corriger le problème. Il{" "}
            <strong>ne contient pas le contenu de vos recettes</strong>.
          </li>
        </UL>

        <H3>3.3 Données que nous ne collectons PAS</H3>
        <P>
          Nom réel, adresse e-mail, numéro de téléphone, adresse postale, mot
          de passe, données de géolocalisation, données de santé, données
          bancaires ou de paiement, identifiants publicitaires, contacts,
          historique de navigation.
        </P>

        <H2 id="finalites">4. Finalités et bases légales du traitement</H2>
        <Table>
          <thead>
            <tr>
              <Th>Donnée</Th>
              <Th>Finalité</Th>
              <Th>Base légale (RGPD)</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>Nom du carnet, recettes, photos, tags</Td>
              <Td>
                Fournir le service : créer, stocker et partager vos recettes
                dans le carnet
              </Td>
              <Td>
                Exécution du contrat (les conditions d&apos;utilisation du
                Service)
              </Td>
            </tr>
            <tr>
              <Td>
                Code d&apos;invitation, identifiants de session, nom
                d&apos;appareil
              </Td>
              <Td>
                Vous authentifier de manière anonyme et gérer l&apos;accès des
                appareils au carnet
              </Td>
              <Td>Exécution du contrat</Td>
            </tr>
            <tr>
              <Td>Contenu soumis aux imports (audio, images, URL)</Td>
              <Td>
                Réaliser l&apos;import demandé et structurer la recette
              </Td>
              <Td>
                Exécution du contrat (fonctionnalité que vous déclenchez
                explicitement)
              </Td>
            </tr>
            <tr>
              <Td>Adresse IP</Td>
              <Td>Limiter les tentatives de connexion abusives</Td>
              <Td>Intérêt légitime (sécurité du Service)</Td>
            </tr>
            <tr>
              <Td>Rapports d&apos;erreur (plantages)</Td>
              <Td>
                Diagnostiquer et corriger les dysfonctionnements, améliorer la
                stabilité
              </Td>
              <Td>Intérêt légitime (qualité et sécurité du Service)</Td>
            </tr>
          </tbody>
        </Table>

        <H2 id="imports-ia">5. Imports par intelligence artificielle</H2>
        <P>
          Pour transformer un enregistrement vocal, une photo ou une page web
          en recette structurée, l&apos;Application fait appel au service{" "}
          <strong>OpenAI</strong> (voir{" "}
          <a href="#sous-traitants" className="underline underline-offset-2">
            section 6
          </a>
          ).
        </P>
        <UL>
          <li>
            <strong>Import par dictée vocale</strong> : l&apos;enregistrement
            audio est transmis à OpenAI pour transcription, puis le texte
            obtenu est structuré.{" "}
            <strong>L&apos;enregistrement audio n&apos;est jamais conservé</strong>{" "}
            par Mijote : seul le texte de la recette résultante est enregistré.
          </li>
          <li>
            <strong>Import par photo / capture d&apos;écran</strong> :
            l&apos;image est transmise à OpenAI pour en extraire le texte de la
            recette.{" "}
            <strong>
              Les images d&apos;import ne sont pas conservées
            </strong>{" "}
            par Mijote : seule la recette structurée résultante est
            enregistrée. (Les photos que vous{" "}
            <strong>ajoutez délibérément</strong> à une recette, à
            l&apos;inverse, sont conservées — voir{" "}
            <a href="#conservation" className="underline underline-offset-2">
              section 8
            </a>
            .)
          </li>
          <li>
            <strong>Import par lien URL</strong> : le contenu textuel de la
            page web est récupéré — directement, ou pour certaines sources
            (Instagram, sites protégeant l&apos;accès automatisé) via notre
            prestataire <strong>Apify</strong> (voir{" "}
            <a href="#sous-traitants" className="underline underline-offset-2">
              section 6
            </a>
            ) à qui l&apos;adresse est transmise — puis transmis à OpenAI pour
            structuration.{" "}
            <strong>
              L&apos;adresse URL et le contenu brut de la page ne sont pas
              conservés.
            </strong>
          </li>
        </UL>
        <P>
          Ces traitements ne sont déclenchés que{" "}
          <strong>lorsque vous utilisez explicitement</strong> la fonction
          d&apos;import correspondante.
        </P>

        <H2 id="sous-traitants">6. Hébergement et sous-traitants</H2>
        <P>
          Pour fonctionner, l&apos;Application s&apos;appuie sur les
          prestataires techniques suivants, qui agissent en qualité de{" "}
          <strong>sous-traitants</strong> pour notre compte :
        </P>
        <Table>
          <thead>
            <tr>
              <Th>Prestataire</Th>
              <Th>Rôle</Th>
              <Th>Données concernées</Th>
              <Th>Localisation</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>
                <strong>Vercel</strong>
              </Td>
              <Td>Hébergement de l&apos;application</Td>
              <Td>Données techniques de requête, journaux</Td>
              <Td>
                Union européenne (Paris, <code>cdg1</code>)
              </Td>
            </tr>
            <tr>
              <Td>
                <strong>Supabase</strong>
              </Td>
              <Td>Base de données et stockage des photos</Td>
              <Td>Carnets, recettes, sessions, photos</Td>
              <Td>
                Union européenne (Irlande, <code>eu-west-1</code>)
              </Td>
            </tr>
            <tr>
              <Td>
                <strong>Upstash</strong>
              </Td>
              <Td>Limitation de débit (sécurité)</Td>
              <Td>Adresse IP, identifiants de session</Td>
              <Td>
                Royaume-Uni (Londres, <code>eu-west-2</code>)
              </Td>
            </tr>
            <tr>
              <Td>
                <strong>OpenAI</strong>
              </Td>
              <Td>
                Transcription audio, lecture d&apos;images, structuration de
                texte
              </Td>
              <Td>
                Contenu soumis aux imports (
                <a href="#imports-ia" className="underline underline-offset-2">
                  section 5
                </a>
                )
              </Td>
              <Td>États-Unis</Td>
            </tr>
            <tr>
              <Td>
                <strong>Apify</strong>
              </Td>
              <Td>
                Récupération du contenu de pages web lors de l&apos;import par
                lien (Instagram, sites protégeant l&apos;accès automatisé)
              </Td>
              <Td>Adresse de la page à importer</Td>
              <Td>États-Unis</Td>
            </tr>
            <tr>
              <Td>
                <strong>Sentry</strong>
              </Td>
              <Td>Journalisation des erreurs et rapports de plantage</Td>
              <Td>
                Messages d&apos;erreur, contexte technique (type
                d&apos;appareil, système, identifiant de session)
              </Td>
              <Td>États-Unis</Td>
            </tr>
          </tbody>
        </Table>
        <P>
          Concernant <strong>OpenAI</strong> : les données transmises via leur
          interface de programmation (API){" "}
          <strong>
            ne sont pas utilisées pour entraîner leurs modèles
          </strong>{" "}
          et sont conservées par OpenAI pour une durée limitée (à des fins de
          prévention des abus) avant suppression, conformément à leur politique
          de traitement des données API.
        </P>

        <H2 id="transferts">
          7. Transferts de données hors Union européenne
        </H2>
        <P>
          <strong>Vercel</strong> et <strong>Supabase</strong>, qui hébergent
          l&apos;essentiel de vos données, opèrent{" "}
          <strong>au sein de l&apos;Union européenne</strong>. Plusieurs
          sous-traitants traitent néanmoins des données en dehors de
          l&apos;UE :
        </P>
        <UL>
          <li>
            <strong>OpenAI</strong> (imports IA) opère aux{" "}
            <strong>États-Unis</strong> ;
          </li>
          <li>
            <strong>Apify</strong> (import par lien) opère aux{" "}
            <strong>États-Unis</strong> ;
          </li>
          <li>
            <strong>Sentry</strong> (rapports d&apos;erreur) opère aux{" "}
            <strong>États-Unis</strong> ;
          </li>
          <li>
            <strong>Upstash</strong> (limitation de débit) opère au{" "}
            <strong>Royaume-Uni</strong>.
          </li>
        </UL>
        <P>
          Ces transferts sont encadrés par des garanties appropriées au sens
          du RGPD : clauses contractuelles types de la Commission européenne,
          décision d&apos;adéquation Royaume-Uni du 28 juin 2021, et/ou adhésion
          au cadre de protection des données UE–États-Unis (
          <em>EU–US Data Privacy Framework</em>) pour les prestataires établis
          aux États-Unis.
        </P>

        <H2 id="conservation">8. Durées de conservation</H2>
        <Table>
          <thead>
            <tr>
              <Th>Donnée</Th>
              <Th>Durée de conservation</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>
                Carnet, recettes, photos, sessions d&apos;appareil
              </Td>
              <Td>
                Conservés tant que le carnet existe ; supprimés lorsque vous
                supprimez le carnet (voir{" "}
                <a
                  href="#suppression"
                  className="underline underline-offset-2"
                >
                  section 11
                </a>
                )
              </Td>
            </tr>
            <tr>
              <Td>
                Cookie de session (<code>atable_session</code>)
              </Td>
              <Td>1 an (renouvelable à chaque connexion)</Td>
            </tr>
            <tr>
              <Td>Adresse IP (limitation de débit)</Td>
              <Td>1 heure maximum</Td>
            </tr>
            <tr>
              <Td>Contenu soumis aux imports, côté OpenAI</Td>
              <Td>Durée limitée fixée par OpenAI, puis suppression</Td>
            </tr>
            <tr>
              <Td>Rapports d&apos;erreur (Sentry)</Td>
              <Td>
                Durée limitée fixée par Sentry (90 jours par défaut), puis
                suppression
              </Td>
            </tr>
            <tr>
              <Td>Journaux techniques (hébergeur)</Td>
              <Td>Durée limitée, à des fins de sécurité et de diagnostic</Td>
            </tr>
          </tbody>
        </Table>
        <P>
          Aucune suppression automatique des carnets inactifs n&apos;est
          appliquée à ce jour : vos recettes restent disponibles tant que vous
          ne les supprimez pas.
        </P>

        <H2 id="cookies">9. Cookies et stockage local</H2>
        <P>
          L&apos;Application{" "}
          <strong>
            n&apos;utilise aucun cookie publicitaire ou de mesure
            d&apos;audience
          </strong>
          . Aucun bandeau de consentement aux cookies n&apos;est donc
          nécessaire.
        </P>
        <UL>
          <li>
            <strong>
              Cookie <code>atable_session</code>
            </strong>{" "}
            : cookie <strong>strictement nécessaire</strong> au fonctionnement
            du Service. Il vous maintient connecté à votre carnet. Il est
            sécurisé (inaccessible au JavaScript, signé cryptographiquement,
            transmis uniquement en HTTPS) et a une durée de vie d&apos;un an.
          </li>
          <li>
            <strong>Stockage local du navigateur</strong> (
            <code>localStorage</code>) : utilisé à des fins strictement
            fonctionnelles — accélérer l&apos;affichage via une mémoire tampon
            des données déjà chargées, et conserver un identifiant technique
            aléatoire servant à organiser le stockage de vos photos. Ces
            informations restent sur votre appareil.
          </li>
        </UL>

        <H2 id="securite">10. Sécurité</H2>
        <P>
          Nous mettons en œuvre des mesures techniques visant à protéger vos
          données : chiffrement des échanges (HTTPS), cookie de session
          sécurisé et signé cryptographiquement, limitation des tentatives de
          connexion, et accès aux données restreint à votre carnet.
        </P>
        <P>
          Toutefois,{" "}
          <strong>
            le code d&apos;invitation d&apos;un carnet fait office de clé
            d&apos;accès
          </strong>{" "}
          : quiconque possède ce code peut ouvrir le carnet. Nous vous
          recommandons de ne le partager qu&apos;avec les personnes de
          confiance.
        </P>

        <H2 id="suppression">11. Suppression de vos données</H2>
        <P>
          Vous gardez le contrôle de vos données directement depuis
          l&apos;Application :
        </P>
        <UL>
          <li>
            <strong>Quitter le carnet</strong> : déconnecte l&apos;appareil
            utilisé. Les recettes du carnet sont conservées pour les autres
            appareils.
          </li>
          <li>
            <strong>Supprimer le carnet</strong> : supprime{" "}
            <strong>définitivement</strong> l&apos;ensemble des recettes, des
            étiquettes, des sessions d&apos;appareil et le carnet lui-même.
          </li>
          <li>
            <strong>Supprimer une recette</strong> : supprime la recette
            concernée et ses étiquettes associées.
          </li>
        </UL>
        <P>
          La suppression d&apos;un carnet satisfait l&apos;exigence d&apos;un
          chemin clair de suppression des données de l&apos;utilisateur.
        </P>

        <H2 id="droits">12. Vos droits</H2>
        <P>
          Conformément au RGPD, vous disposez des droits d&apos;
          <strong>accès</strong>, de <strong>rectification</strong>, d&apos;
          <strong>effacement</strong>, de <strong>limitation</strong>, d&apos;
          <strong>opposition</strong> et de <strong>portabilité</strong> de vos
          données.
        </P>
        <UL>
          <li>
            Les droits de <strong>rectification</strong> et d&apos;
            <strong>effacement</strong> s&apos;exercent directement dans
            l&apos;Application (modification ou suppression de vos recettes,
            suppression du carnet).
          </li>
          <li>
            Pour toute autre demande (accès, copie de vos données, opposition),
            vous pouvez nous contacter à l&apos;adresse indiquée à la{" "}
            <a
              href="#qui-sommes-nous"
              className="underline underline-offset-2"
            >
              section 1
            </a>
            .
          </li>
        </UL>
        <P>
          L&apos;Application ne nous permettant pas de relier un carnet à une
          identité réelle, nous pourrons être amenés à vous demander des
          éléments permettant d&apos;établir que vous êtes bien membre du carnet
          concerné avant de donner suite à une demande.
        </P>
        <P>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez
          introduire une réclamation auprès de la{" "}
          <strong>
            Commission nationale de l&apos;informatique et des libertés (CNIL)
          </strong>{" "}
          —{" "}
          <a
            href="https://www.cnil.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            www.cnil.fr
          </a>
          .
        </P>

        <H2 id="mineurs">13. Mineurs</H2>
        <P>
          L&apos;Application n&apos;est pas destinée aux enfants et ne collecte
          pas sciemment de données les concernant. Aucune donnée n&apos;est
          demandée permettant de connaître l&apos;âge des utilisateurs.
        </P>

        <H2 id="modifications">14. Modifications de la présente politique</H2>
        <P>
          Cette politique de confidentialité peut être amenée à évoluer. Toute
          modification substantielle sera signalée par la mise à jour de la
          date figurant en tête de document.
        </P>

        <H2 id="contact">15. Contact</H2>
        <P>
          Pour toute question relative à la présente politique ou au traitement
          de vos données :{" "}
          <a
            href={`mailto:${contactEmail}`}
            className="text-foreground underline underline-offset-2 hover:no-underline"
          >
            {contactEmail}
          </a>
          .
        </P>
      </article>
    </main>
  );
}

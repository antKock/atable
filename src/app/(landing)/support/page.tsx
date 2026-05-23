import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support — À Table",
  description:
    "Aide et contact pour l'application À Table. Comment importer une recette, partager un foyer, supprimer ses données.",
  alternates: { canonical: "/support" },
  robots: { index: true, follow: true },
};

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

function P({ children }: { children: React.ReactNode }) {
  return <p className="my-3 leading-relaxed text-foreground/90">{children}</p>;
}

function FAQ({
  question,
  children,
}: {
  question: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group my-2 rounded-xl border border-foreground/10 bg-background/50 p-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer items-center justify-between gap-2 text-base font-medium text-foreground">
        {question}
        <span
          aria-hidden="true"
          className="text-foreground/40 transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/80">
        {children}
      </div>
    </details>
  );
}

export default function SupportPage() {
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
          Support
        </h1>
        <p className="mt-2 text-foreground/70">
          Une question, un bug, une idée ? La meilleure manière de nous joindre,
          c&apos;est par e-mail. Réponse sous 2 jours ouvrés en général.
        </p>

        <H2 id="contact">Nous écrire</H2>
        <P>
          Pour toute demande — assistance, signalement de bug, suggestion,
          exercice de vos droits RGPD :{" "}
          <a
            href={`mailto:${contactEmail}?subject=${encodeURIComponent("Support À Table")}`}
            className="text-foreground underline underline-offset-2 hover:no-underline"
          >
            {contactEmail}
          </a>
          .
        </P>
        <P>
          Pour aider au diagnostic, merci d&apos;indiquer dans votre message :
        </P>
        <ul className="my-3 list-disc space-y-1 pl-6 text-foreground/90">
          <li>Le modèle d&apos;appareil (iPhone, navigateur).</li>
          <li>L&apos;action que vous tentiez de faire.</li>
          <li>Ce que vous voyez à l&apos;écran (capture si possible).</li>
        </ul>

        <H2 id="faq">Questions fréquentes</H2>

        <FAQ question="Comment ajouter une recette ?">
          <p>
            Depuis l&apos;écran d&apos;accueil, appuyez sur le bouton{" "}
            <strong>+ Ajouter</strong>. Trois choix :
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Photo / capture d&apos;écran</strong> — l&apos;IA extrait
              le titre, les ingrédients et les étapes.
            </li>
            <li>
              <strong>Dictée vocale</strong> — vous parlez, on transcrit et on
              structure.
            </li>
            <li>
              <strong>Lien URL</strong> — collez l&apos;adresse d&apos;un blog
              culinaire, on récupère et on met en forme.
            </li>
          </ul>
          <p>
            La recette apparaît immédiatement ; l&apos;enrichissement (tags,
            temps, image générée) se fait en tâche de fond.
          </p>
        </FAQ>

        <FAQ question="Comment partager mon foyer avec ma famille ?">
          <p>
            Ouvrez l&apos;écran <strong>Foyer</strong> depuis la barre de
            navigation. Le <strong>code d&apos;invitation</strong> y est
            affiché (ex. <code>THYME-0421</code>). Communiquez-le à la personne
            que vous voulez ajouter : elle l&apos;entrera sur l&apos;écran
            d&apos;accueil de l&apos;application.
          </p>
          <p>
            ⚠️ Le code fait office de clé d&apos;accès : ne le partagez
            qu&apos;avec les personnes de confiance.
          </p>
        </FAQ>

        <FAQ question="J'ai perdu mon code d'invitation, comment retrouver mon foyer ?">
          <p>
            Si un appareil est encore connecté au foyer, ouvrez l&apos;écran{" "}
            <strong>Foyer</strong> : le code y est toujours visible.
          </p>
          <p>
            Si plus aucun appareil n&apos;est connecté et que vous avez perdu
            le code, le foyer ne peut malheureusement plus être récupéré.
            C&apos;est le revers de la médaille d&apos;une authentification
            anonyme — nous ne stockons ni e-mail ni mot de passe pour vérifier
            votre identité.
          </p>
        </FAQ>

        <FAQ question="Mon import de recette n'a pas fonctionné, que faire ?">
          <p>L&apos;import par IA peut échouer dans quelques cas :</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Photo trop floue ou texte trop petit</strong> —
              rapprochez-vous, prenez plusieurs clichés.
            </li>
            <li>
              <strong>Page web protégée</strong> (paywall, JavaScript lourd) —
              copiez le texte de la recette et utilisez la saisie manuelle.
            </li>
            <li>
              <strong>Dictée vocale dans un endroit bruyant</strong> —
              réessayez au calme.
            </li>
          </ul>
          <p>
            En dernier recours, vous pouvez créer la recette manuellement
            depuis le bouton <strong>+ Ajouter → Saisie manuelle</strong>.
          </p>
        </FAQ>

        <FAQ question="Comment supprimer mes données ?">
          <p>Vous avez le contrôle total depuis l&apos;application :</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Supprimer une recette</strong> : depuis sa page,
              menu&nbsp;…&nbsp;→ Supprimer.
            </li>
            <li>
              <strong>Quitter le foyer</strong> : déconnecte uniquement
              l&apos;appareil actuel. Les recettes restent pour les autres
              membres.
            </li>
            <li>
              <strong>Supprimer le foyer</strong> : supprime{" "}
              <strong>définitivement</strong> l&apos;ensemble des recettes, des
              tags, des sessions et le foyer lui-même. Action à double
              confirmation, irréversible.
            </li>
          </ul>
          <p>
            Pour toute autre demande RGPD (accès, copie, portabilité),
            contactez-nous par e-mail à l&apos;adresse plus haut.
          </p>
        </FAQ>

        <FAQ question="L'application est-elle gratuite ?">
          <p>
            Oui. Pas de publicité, pas d&apos;achat intégré, pas
            d&apos;abonnement. L&apos;application est financée par son éditeur
            indépendant.
          </p>
        </FAQ>

        <FAQ question="Y a-t-il une version web ?">
          <p>
            Oui — l&apos;application est avant tout un site web responsive
            accessible à{" "}
            <a
              href="https://atable.anthonykocken.fr"
              className="underline underline-offset-2"
            >
              atable.anthonykocken.fr
            </a>
            . Vous pouvez l&apos;utiliser depuis n&apos;importe quel
            navigateur, et l&apos;ajouter à l&apos;écran d&apos;accueil de
            votre téléphone (mode PWA).
          </p>
        </FAQ>

        <H2 id="legal">Mentions et confidentialité</H2>
        <P>
          Politique de confidentialité complète :{" "}
          <Link
            href="/legal/confidentialite"
            className="text-foreground underline underline-offset-2 hover:no-underline"
          >
            /legal/confidentialite
          </Link>
          .
        </P>
        <P>
          Éditeur : Anthony Kocken, éditeur indépendant. Contact :{" "}
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

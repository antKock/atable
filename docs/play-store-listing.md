# Mijote — Fiche & formulaires Google Play Console

> Source de vérité pour tout ce qu'il faut remplir dans la **Play Console**.
> Adapté de la fiche iOS (`app-store-listing.md`) + des privacy labels
> (`app-store-privacy-labels.md`), avec les écarts constatés au 2026-06-29
> (voir l'encadré ⚠️ Sentry plus bas). Ton : **tutoiement** (comme iOS) ;
> la politique de confidentialité garde le **vouvoiement**.

---

## 1. Détails de l'app (Store listing)

| Champ Play | Limite | Valeur |
|---|---|---|
| **Nom de l'app** | 30 car. | `Mijote - Tes Recettes` *(déjà saisi dans la console)* |
| **Description courte** | 80 car. | `Toutes tes recettes réunies comme par magie : photo, voix, lien ou saisie.` (74 car.) |
| **Description complète** | 4000 car. | voir bloc ci-dessous |

> ℹ️ Google Play est **plus permissif qu'Apple** sur les caractères : les
> `…`, `·`, emojis, séparateurs sont autorisés. On peut donc réutiliser le
> texte iOS tel quel (il est déjà « safe »).

### Description complète (à coller)

```
Toutes tes recettes, enfin réunies au même endroit. Celles que tu sauvegardes
sur Instagram, le carnet jauni de ta grand-mère, le lien d'un blog que tu
adores, ou ta recette à toi que tu peaufines au fil des essais — Mijote les
rassemble en quelques secondes, prêtes à cuisiner.

QUATRE FAÇONS D'AJOUTER UNE RECETTE

• PHOTO — prends en photo le carnet de ta grand-mère ou un screenshot
  Instagram. On extrait le titre, les ingrédients et les étapes pour toi.
• VOIX — dicte la recette pendant qu'on te la raconte au téléphone. On
  transcrit et on met en forme.
• LIEN — colle l'adresse d'un blog culinaire. On récupère le contenu et
  on en fait une vraie recette, lisible, sans le bruit autour.
• À LA MAIN — tape directement ta recette si tu la connais par cœur ou
  si tu veux la composer pas à pas. Tu restes en contrôle de A à Z.

Chaque recette se complète toute seule : temps de préparation, coût estimé,
saisons, étiquettes (végétarien, rapide, comfort food...). Une jolie
illustration est même générée pour reconnaître chaque plat d'un coup d'œil.
Tu restes maître : modifie, complète, remplace l'image par tes propres
photos.

SIMPLE À ADOPTER, À AIMER, À PARTAGER

• ESSAI EN UN CLIC — explore une bibliothèque démo avant même de créer
  ton foyer. Tu vois ce que ça donne, sans rien fournir.
• PAS DE COMPTE — quand tu te lances, pas d'e-mail, pas de mot de passe,
  pas de publicité. On te respecte assez pour ne rien te demander
  d'inutile.
• FOYER PARTAGÉ — quand tu veux partager, crée un foyer et passe le code
  d'invitation à qui tu veux. Vos recettes sont les mêmes sur tous vos
  téléphones. Ton ou ta partenaire ajoute la recette du dimanche midi,
  tu la retrouves dans ta cuisine du mardi soir.

RETROUVER, SANS CHERCHER

• Accueil par envies : Rapide, Végétarien, Comfort food, De saison,
  Apéro, Desserts...
• Filtres précis : par ingrédient, durée, coût, régime, type de plat.
• Mode « De saison » : ne voir que ce qui se cuisine maintenant.
• Pendant que tu cuisines, l'écran reste allumé tout seul — pas besoin
  de réveiller ton téléphone les mains tachées de farine.

TON FOYER, TES RÈGLES

• Renomme le foyer, gère les appareils connectés, quitte ou supprime
  le foyer en deux tapotements.
• Suppression définitive et complète à tout moment — c'est ton contenu,
  jamais le nôtre.

CONFIDENTIALITÉ

• Pas de profilage publicitaire, pas de pixels de suivi, pas d'identifiant
  publicitaire — jamais.
• Aucune vente de tes données à des tiers.
• Politique de confidentialité : mijote.anthonykocken.fr/legal/confidentialite

POUR QUI ?

Pour celles et ceux qui aiment cuisiner et qui en ont assez de chercher
« cette recette de la dernière fois » dans douze endroits différents. Pour
les foyers qui veulent garder vivantes les vraies recettes — celles qu'on
mange, pas celles d'un site sponsorisé. Pour les gens marre des apps
bourrées de pubs et de paywalls.

Mijote est gratuit, sans publicité, sans achat intégré.
```

---

## 2. Catégorisation

| Champ | Valeur |
|---|---|
| **Catégorie d'application** | Cuisine et boissons (*Food & Drink*) |
| **Tags** | recettes, cuisine, organisation, foyer (choisis dans la liste fermée Google) |
| **E-mail de contact** | `kocken.anthony@gmail.com` |
| **Site web** | `https://mijote.anthonykocken.fr` |
| **Téléphone** | optionnel → laisser vide |

---

## 3. Ressources graphiques

| Asset | Spéc Google | Statut |
|---|---|---|
| **Icône de l'app** | 512×512 PNG 32-bit | ✅ générée → `assets/play/icon-512.png` |
| **Image de présentation (feature graphic)** | 1024×500 PNG/JPG — **obligatoire** | ✅ générée → `assets/play/feature-graphic.png` |
| **Captures téléphone** | 2 à 8, 16:9 ou 9:16, ≥ 320 px — **obligatoire (min 2)** | ⏳ à capturer depuis l'app |
| **Captures 7" / 10" tablette** | optionnel | ⏳ si tu veux apparaître sur tablette |

> Les captures iOS (1290×2796) ne sont pas au bon ratio Google. Le plus simple :
> je les capture depuis l'émulateur Android (ou un vrai tél). Voir §10.

---

## 4. ⚠️ Data safety (Sécurité des données) — formulaire obligatoire

> Le pendant Google des « privacy nutrition labels » iOS. **Écart important
> détecté le 2026-06-29** : la doc iOS disait « pas de Sentry » — c'est
> désormais FAUX (Sentry capture les erreurs/crashs). Donc on déclare en plus
> les **journaux de plantage**, ce que la fiche iOS n'avait pas. À répercuter
> aussi sur les privacy labels iOS + la politique de confidentialité (sujet
> séparé, voir §11).

### Questions d'en-tête

| Question | Réponse |
|---|---|
| Ton app collecte/partage des données utilisateur ? | **Oui, collecte** |
| Les données sont-elles chiffrées en transit ? | **Oui** (HTTPS partout) |
| Possibilité de demander la suppression des données ? | **Oui** — suppression du foyer dans l'app (Réglages → supprimer le foyer), effacement complet |
| Les données sont-elles « partagées » (transfert à un tiers) ? | **Non** — OpenAI / Supabase / Upstash / Sentry agissent comme **sous-traitants** pour notre compte (= traitement, pas partage au sens Google) |

### Types de données collectées

Pour **chaque** ligne : *Collectée = Oui*, *Partagée = Non*, *Liée à l'identité = Oui*
(tout est rattaché au foyer persistant), *Traitement éphémère = Non*.

| Catégorie Google | Type | Finalité (Purpose) | Pourquoi |
|---|---|---|---|
| **Informations personnelles** | Identifiants utilisateur (*User IDs*) | Fonctionnalité de l'app | ID de foyer / session (compte anonyme) |
| **Photos et vidéos** | Photos | Fonctionnalité de l'app | Photos ajoutées aux recettes + images d'import |
| **Fichiers audio** | Enregistrements vocaux | Fonctionnalité de l'app | Dictée vocale transmise à OpenAI |
| **Activité dans l'app** | Autres contenus générés par l'utilisateur | Fonctionnalité de l'app | Titres, ingrédients, étapes des recettes |
| **Activité dans l'app** | Interactions avec l'app | Fonctionnalité + Personnalisation | Compteurs de consultation (« vues récemment ») |
| **Infos et performances de l'app** | **Journaux de plantage** (*Crash logs*) | Fonctionnalité de l'app | **Sentry** — erreurs/crashs (pas de traçage perf, `tracesSampleRate: 0`) |

### À NE PAS déclarer (cohérent avec iOS)

| Élément | Raison |
|---|---|
| Nom, e-mail, téléphone | Jamais collectés — auth 100 % anonyme |
| Localisation | Aucune géolocalisation |
| Infos financières / achats | Aucun paiement, aucun achat intégré |
| Contacts, santé, navigation | Non collectés |
| Adresse IP | Limitation de débit (sécurité), conservée ~1 h, jamais en base → usage sécurité, non déclaré |

---

## 5. Classification du contenu (questionnaire IARC)

| Question | Réponse |
|---|---|
| Catégorie | **Utilitaire / Productivité / Communication / Autre** (pas un jeu) |
| Violence, sexualité, langage grossier, drogues, jeux d'argent | **Non** à tout |
| Localisation partagée avec d'autres utilisateurs | **Non** |
| Achats numériques | **Non** |
| **Les utilisateurs peuvent-ils interagir / partager du contenu ?** | **Oui, partiellement** — un utilisateur peut partager **ses propres recettes** via un lien (`/r/...`) ou au sein d'un foyer privé. ⚠️ Pas de messagerie ni de contenu public entre inconnus. Réponds honnêtement « oui » à « partage de contenu » s'il est demandé ; ça ne monte pas la classification. |

➡️ **Classification attendue : PEGI 3 / Tout public.**

---

## 6. Public cible et contenu

| Champ | Valeur recommandée |
|---|---|
| **Tranches d'âge cibles** | **18 ans et plus** (le plus simple ; évite les obligations « Familles »). 13+ resterait acceptable vu le contenu inoffensif, mais 18+ simplifie. |
| App destinée aux enfants ? | **Non** |

---

## 7. Annonces (Ads)

| Question | Réponse |
|---|---|
| L'app contient-elle des annonces ? | **Non** |

---

## 8. Accès à l'app (App access — pour les évaluateurs Google)

> Google a besoin de pouvoir tester l'app. Mijote n'a **pas de connexion**.

```
Aucune connexion n'est nécessaire. À l'ouverture, appuie sur « Essayer la
démo » (essai en un clic) pour accéder à une bibliothèque de recettes
complète et tester toutes les fonctionnalités, sans compte ni e-mail.

Pour tester le partage de foyer : crée un foyer depuis l'écran d'accueil,
un code d'invitation est généré, aucune information personnelle requise.
```

➡️ Champ « Toutes les fonctionnalités sont disponibles sans identifiants
particuliers » → **coché**, avec les instructions ci-dessus en complément.

---

## 9. URLs & divers

| Champ | Valeur |
|---|---|
| **Privacy Policy URL** | `https://mijote.anthonykocken.fr/legal/confidentialite` |
| **Site web / Marketing** | `https://mijote.anthonykocken.fr` |
| **Application gratuite** | Oui (irréversible une fois publiée gratuite) |
| **Pays de distribution** | À choisir (France + francophonie a minima) |

---

## 10. Captures d'écran — à produire

Min. **2** captures téléphone (idéalement 4-6), ratio 9:16, ≥ 1080 px de large.
Écrans à montrer (mêmes que la story iOS) :
1. Accueil par envies (carrousels)
2. Une recette enrichie (métadonnées + illustration)
3. Les 4 façons d'ajouter une recette (écran d'import)
4. Filtres / recherche
5. Foyer partagé (code d'invitation)

> Je peux les capturer depuis l'émulateur Android (Pixel) ou tu me fournis
> un appareil. Dis-moi.

---

## 11. Écarts corrigés (suivi)

- [x] **Politique de confidentialité** : **Sentry** ajouté comme sous-traitant
  (§3.2, §4, §6, §7, §8) dans `docs/politique-confidentialite.md` **et** la page
  publiée `src/app/(landing)/legal/confidentialite/page.tsx` — 2026-06-29.
- [x] **Privacy labels iOS** (`app-store-privacy-labels.md`) : *Diagnostics →
  Crash Data* (Sentry) ajouté ; la ligne « pas de Sentry » corrigée.
- [x] **Apify** (import Instagram/URL) : ajouté comme sous-traitant
  (reçoit l'URL à importer) — §5, §6, §7.

> ⏳ **À confirmer par toi** : la **région du projet Sentry**. J'ai écrit
> « États-Unis » (hypothèse prudente). Si ton projet Sentry est en région UE
> (`de.sentry.io`), on peut déplacer Sentry hors de la section « transferts
> hors UE ». Mention iOS « accessible sur le Web et l'App Store iOS » → mise à
> jour en ajoutant Google Play.

---

## 12. Ordre de remplissage Play Console

1. **Store listing** : nom, descriptions, icône, feature graphic, captures (§1, §3, §10)
2. **Catégorisation** + contacts (§2)
3. **Data safety** (§4)
4. **Content rating** (§5)
5. **Public cible** (§6) + **Annonces** (§7)
6. **App access** (§8) + politique de confidentialité (§9)
7. Puis promouvoir la release *Test interne* → *Production*.
```

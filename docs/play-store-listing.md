# Mijote — Fiche & formulaires Google Play Console

> Source de vérité pour tout ce qu'il faut remplir dans la **Play Console**.
> Adapté de la fiche iOS (`app-store-listing.md`) + des privacy labels
> (`app-store-privacy-labels.md`), avec les écarts constatés au 2026-06-29
> (voir l'encadré ⚠️ Sentry plus bas). Ton : **tutoiement** (comme iOS) ;
> la politique de confidentialité garde le **vouvoiement**.

---

## 1. Détails de l'app (Store listing) — **refonte 2026-09-06**

> Alignée sur la refonte App Store (`marketing/fiche-app-store.md`). Différence Play :
> **la description est indexée pour la recherche** (pas de champ mots-clés) → garder
> « recettes », « livre de recettes », « carnet », « Instagram », « TikTok », « photo »,
> « dictée », « partage » dans le texte, ce que la description fait naturellement.

| Champ Play | Limite | Valeur |
|---|---|---|
| **Nom de l'app** | 30 car. | `Mijote — Livre de recettes` (26) — remplace « Mijote - Tes Recettes » |
| **Description courte** | 80 car. | `Importe tes recettes depuis Instagram, une photo ou ta voix. Zéro saisie.` (73) |
| **Description complète** | 4000 car. | bloc ci-dessous (identique à l'App Store FR) |

### Description complète (à coller)

```
Marre de chercher « cette recette de la dernière fois » entre douze captures d'écran, un lien Instagram perdu et un vieux cahier ? Mijote les réunit dans un seul livre de recettes — et remplit les fiches tout seul.

Gratuit, sans publicité, sans abonnement.

QUATRE FAÇONS D'AJOUTER UNE RECETTE

• PHOTO — prends en photo le carnet de ta grand-mère ou un screenshot Instagram. On extrait le titre, les ingrédients et les étapes pour toi.
• VOIX — dicte la recette pendant qu'on te la raconte au téléphone. On transcrit et on met en forme.
• LIEN — colle l'adresse d'un blog culinaire. On récupère le contenu et on en fait une vraie recette, lisible, sans le bruit autour.
• À LA MAIN — tape directement ta recette si tu la connais par cœur ou si tu veux la composer pas à pas. Tu restes en contrôle de A à Z.

Chaque recette se complète toute seule : temps de préparation, coût estimé, saisons, étiquettes (végétarien, rapide, comfort food). Une jolie illustration est même générée pour reconnaître chaque plat d'un coup d'œil. Tu restes maître : modifie, complète, remplace l'image par tes propres photos.

SIMPLE À ADOPTER, À AIMER, À PARTAGER

• ESSAI EN UN CLIC — explore un carnet démo avant même de créer le tien. Tu vois ce que ça donne, sans rien fournir.
• PAS DE COMPTE — quand tu te lances, pas d'e-mail, pas de mot de passe, pas de publicité. On te respecte assez pour ne rien te demander d'inutile.
• CARNET PARTAGÉ — crée ton carnet et invite qui tu veux, en membre ou en invité (lecture seule). Vos recettes sont les mêmes sur tous vos téléphones. Ton ou ta partenaire ajoute la recette du dimanche midi, tu la retrouves dans ta cuisine du mardi soir.
• PARTAGE PAR LIEN — envoie une recette à qui tu veux par un simple lien. La personne l'ouvre direct, sans compte et sans rien installer, et la garde dans son carnet en un geste.

RETROUVER, SANS CHERCHER

• Accueil par envies : Rapide, Végétarien, Comfort food, De saison, Apéro, Desserts.
• Filtres précis : par ingrédient, durée, coût, régime, type de plat.
• Mode « De saison » : ne voir que ce qui se cuisine maintenant.
• Pendant que tu cuisines, l'écran reste allumé tout seul — pas besoin de réveiller ton téléphone les mains tachées de farine.

TON CARNET, TES RÈGLES

• Renomme ton carnet, gère membres et invités, quitte ou supprime le carnet en deux tapotements.
• Suppression définitive et complète à tout moment — c'est ton contenu, jamais le nôtre.

CONFIDENTIALITÉ

• Pas de profilage publicitaire, pas de pixels de suivi, pas d'identifiant publicitaire.
• Aucune vente de tes données à des tiers.
• Politique de confidentialité : mijote.anthonykocken.fr/legal/confidentialite

POUR QUI ?

Pour celles et ceux qui aiment cuisiner et qui en ont assez de chercher « cette recette de la dernière fois » dans douze endroits différents. Pour les maisonnées qui veulent garder vivantes les vraies recettes — celles qu'on mange, pas celles d'un site sponsorisé. Pour les gens marre des apps bourrées de pubs et d'abonnements.

Mijote est gratuit, sans publicité et sans abonnement.
```

---

## 2. Catégorisation

| Champ | Valeur |
|---|---|
| **Catégorie d'application** | Cuisine et boissons (*Food & Drink*) |
| **Tags** | recettes, cuisine, organisation, foyer (choisis dans la liste fermée Google) |

> ℹ️ Google **n'a pas de champ mots-clés libre** (il indexe la description).
> Les mots-clés Apple, pour mémoire : `recettes, cuisine, foyer, famille, IA,
> vocal, photo, OCR, importer, partage, menu, saison, végétarien, rapide` —
> assure-toi que les principaux apparaissent dans la description complète.
| **E-mail de contact** | `kocken.anthony@gmail.com` |
| **Site web** | `https://mijote.anthonykocken.fr` |
| **Téléphone** | optionnel → laisser vide |

---

## 3. Ressources graphiques — **produites le 2026-09-06**

| Asset | Spéc Google | Fichier |
|---|---|---|
| **Icône** | 512×512 PNG | `assets/play/icon-512.png` (inchangée) |
| **Feature graphic** | 1024×500 — obligatoire | `assets/play/feature-graphic.png` (FR, refaite : Fraunces + « Livre de recettes — importe, cuisine et partage ») · `feature-graphic-en.png` (EN) |
| **Captures téléphone** | 2-8, ratio ≤ 2:1, 320-3840 px | `marketing/visuels-play-store/export-phone/` (FR) · `export-phone-en/` (EN) — 6 × **1440×2560** (9:16), cadre Android (poinçon, status bar Android), captures réelles en émulation Pixel |
| **Captures tablette 10"** | 2-8, ratio ≤ 2:1 | `export-tablet/` · `export-tablet-en/` — 6 × 2064×2752 (mêmes que l'iPad : cadre neutre, réutilisables) |
| **Captures tablette 7"** | optionnel | réutiliser les 10" |

> ⚠️ Les captures iOS 1290×2796 sont **refusées** par Play (ratio 2,17:1 > 2:1) — d'où
> l'export 9:16 dédié. Pipeline : `visuels-play-store/index-play-*.html` → `export-play-*.html`
> (sources `android/`). Ordre d'upload : 01 → 06, mêmes messages que l'App Store.

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

> **Mise à jour 2026-09-05** (chantier foyer #14/#15) : ajout du **nom** et de
> l'**adresse e-mail** (profil, facultatifs). À reporter dans la Play Console
> (Règles → Sécurité des données → Gérer), sans nouveau build ; Google relit le
> formulaire sous quelques jours. Resend (envoi des e-mails) est un sous-traitant
> supplémentaire : toujours « partage = Non ».

Pour **chaque** ligne : *Collectée = Oui*, *Partagée = Non*, *Liée à l'identité = Oui*
(tout est rattaché au carnet/profil persistant), *Traitement éphémère = Non*.

| Catégorie Google | Type | Finalité (Purpose) | Pourquoi |
|---|---|---|---|
| **Informations personnelles** | Identifiants utilisateur (*User IDs*) | Fonctionnalité de l'app | ID d'owner / carnet / session (compte anonyme) |
| **Informations personnelles** | **Nom** | Fonctionnalité de l'app | Nom de profil facultatif, affiché aux autres membres — *ajouté 2026-09-05* |
| **Informations personnelles** | **Adresse e-mail** | Fonctionnalité de l'app, Gestion du compte | E-mail de secours facultatif, lien/code de connexion via Resend — *ajouté 2026-09-05* |
| **Photos et vidéos** | Photos | Fonctionnalité de l'app | Photos ajoutées aux recettes + images d'import |
| **Fichiers audio** | Enregistrements vocaux | Fonctionnalité de l'app | Dictée vocale transmise à OpenAI |
| **Activité dans l'app** | Autres contenus générés par l'utilisateur | Fonctionnalité de l'app | Titres, ingrédients, étapes des recettes |
| **Activité dans l'app** | Interactions avec l'app | Fonctionnalité + Personnalisation + **Analyse** | Compteurs de consultation, jours d'activité par appareil, agrégats quotidiens (statistiques internes, aucun outil tiers) |
| **Infos et performances de l'app** | **Journaux de plantage** (*Crash logs*) | Fonctionnalité de l'app | **Sentry** — erreurs/crashs (pas de traçage perf, `tracesSampleRate: 0`) |

### À NE PAS déclarer (cohérent avec iOS)

| Élément | Raison |
|---|---|
| Téléphone, adresse postale | Jamais collectés (nom et e-mail : déclarés depuis 2026-09-05, voir tableau) |
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

## 8. Accès à l'app (App access — pour les évaluateurs Google) — **màj 2026-09-06**

> Les évaluateurs Google sont anglophones et verront l'interface **EN** (langue de
> l'appareil) → instructions en anglais. Cocher « Toutes les fonctionnalités sont
> disponibles sans identifiants particuliers » + coller :

```
No credentials required: the app works entirely without an account or login.

The app follows the device language: French or English. In our vocabulary, a "cookbook" ("carnet" in French) is a shared recipe collection.

Two ways to test:

1. Demo mode (recommended) — "Try the app" on the landing screen. Opens a demo cookbook pre-filled with about thirty recipes. Same screens and interactions as a user-created cookbook; recipes added in the demo are not kept (a banner says so).

2. Create a cookbook — "Create a cookbook" on the landing screen. Only a cookbook name is required: no email, password or identifier. Access is tied to the device (anonymous session) and can be extended to other people by invitation.

Worth checking:
- Sharing: gear icon on Home → "Cookbook & profile" → your cookbook → invite. Two invite links: member (can add and edit) and guest (read-only). Opening a link (/join/CODE) on another device joins the cookbook. A person can belong to several cookbooks.
- Optional backup email: "Cookbook & profile" → your profile. Used only to send a sign-in link to recover access on a new phone. No password, no marketing emails.
- Data deletion: cookbook detail → "Delete the cookbook" permanently deletes the cookbook and its recipes; "Leave this cookbook" removes only the current person.

Android permissions, requested when the user first tries the feature (never at launch):
- Microphone (RECORD_AUDIO): voice dictation import
- Camera (CAMERA): import by photographing a book or notebook
- Import from a screenshot uses the system picker (no storage permission)

Imports (photo, voice, web link) need an internet connection — content is analyzed server-side. Recipe illustrations are generated automatically; users can replace them with their own photos.

No in-app purchases, no ads, no third-party login. Recipes shared by link (/r/TOKEN) are unlisted pages visible only to people who have the link.
```

---

## 9. URLs & divers

| Champ | Valeur |
|---|---|
| **Privacy Policy URL** | `https://mijote.anthonykocken.fr/legal/confidentialite` |
| **Site web / Marketing** | `https://mijote.anthonykocken.fr` |
| **Application gratuite** | Oui (irréversible une fois publiée gratuite) |
| **Pays de distribution** | À choisir (France + francophonie a minima) |

---

## 10. Captures d'écran — ✅ produites (voir §3)

Six visuels par langue, même séquence que l'App Store : hook → sources d'import →
fiche remplie → bibliothèque → partage (membres/invités) → gratuité.

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

---

## 13. Côté app Android — **avant publication en production**

- [x] `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` + `CAMERA` déclarés dans le manifeste
  (import vocal et plugin caméra, 2026-06-29).
- [ ] **Rebuild `.aab`** : le build en test fermé est `versionCode 3 / versionName 1.0`
  (juin). L'app charge le web de prod (`capacitor.config.ts`), donc les fonctionnalités
  (carnets partagés, EN…) y sont déjà, mais la fiche 1.3 et le Data safety à jour
  méritent un binaire `versionCode 4 / versionName 1.3` (`npx cap sync android` puis
  build signé), puis promotion Test fermé → **Production**.
- [ ] Data safety : reporter **nom** + **e-mail** (voir §4) avant la promotion.

---

## 14. Fiche EN (en-US) — traduction Play

| Champ | Valeur |
|---|---|
| **Nom** | `Mijote: Recipe Book & Keeper` (28) |
| **Description courte** | `Import recipes from Instagram, a photo or your voice. Zero typing.` (66) |
| **Description complète** | bloc ci-dessous (identique à l'App Store EN) |

```
Tired of hunting for "that recipe from last time" across a dozen screenshots, a lost Instagram link and an old notebook? Mijote gathers them all into one cookbook — and fills in the cards for you.

Free, no ads, no subscription.

FOUR WAYS TO ADD A RECIPE

• PHOTO — snap your grandmother's notebook or an Instagram screenshot. We extract the title, ingredients and steps for you.
• VOICE — dictate the recipe while someone tells it to you over the phone. We transcribe it and shape it up.
• LINK — paste the address of a cooking blog. We fetch the content and turn it into a real, readable recipe, without the noise around it.
• BY HAND — type your recipe directly if you know it by heart or want to build it step by step. You stay in control from A to Z.

Every recipe completes itself: prep time, estimated cost, seasons, tags (vegetarian, quick, comfort food). A lovely illustration is even generated so you can spot each dish at a glance. You stay in charge: edit, complete, or swap the image for your own photos.

EASY TO ADOPT, TO LOVE, TO SHARE

• ONE-TAP TRIAL — explore a demo cookbook before even creating your own. See what it feels like without giving anything away.
• NO ACCOUNT — when you get started: no email, no password, no ads. We respect you enough not to ask for anything unnecessary.
• SHARED COOKBOOK — create a cookbook and pass the invite code to whoever you like. Your recipes are the same on all your phones. Your partner adds the Sunday lunch recipe, you find it in your kitchen on Tuesday night.
• SHARE BY LINK — send a recipe to anyone with a simple link. They open it right away, no account, nothing to install, and can keep it in their own cookbook in one tap.

FIND, WITHOUT SEARCHING

• Browse by craving: Quick, Vegetarian, Comfort food, In season, Appetizers, Desserts.
• Precise filters: by ingredient, time, cost, diet, dish type.
• "In season" mode: only see what's worth cooking right now.
• While you cook, the screen stays awake on its own — no need to wake your phone with flour-covered hands.

YOUR COOKBOOK, YOUR RULES

• Rename your cookbook, manage members and guests, leave or delete it in two taps.
• Full and permanent deletion at any time — it's your content, never ours.

PRIVACY

• No ad profiling, no tracking pixels, no advertising identifier.
• Your data is never sold to anyone.
• Privacy policy: mijote.anthonykocken.fr/legal/confidentialite

WHO IS IT FOR?

For people who love to cook and are tired of digging for "that recipe from last time" in twelve different places. For households that want to keep real recipes alive — the ones you actually eat, not the ones from a sponsored site. For anyone fed up with apps stuffed with ads and subscriptions.

Mijote is free, with no ads and no subscription.
```

---

## 15. Nouveautés (release notes) — **limite Play : 500 caractères**

### FR (438 car.)

```
Grosse fournée ! Ton carnet se partage, ton accès est sauvegardé, et tout le reste est plus rapide.
• Invite qui tu veux dans ton carnet, en membre ou en invité (lecture seule).
• Plusieurs carnets, et tu choisis où ranger chaque recette.
• Email de secours (optionnel) pour retrouver ton accès si tu changes de téléphone.
• Accueil repensé, import plus rapide et plus précis, étiquettes plus justes.
• Mijote existe désormais en anglais.
```

### EN (356 car.)

```
Big batch! Your cookbook is shareable, your access is backed up, and everything else got faster.
• Invite anyone into your cookbook, as a member or a read-only guest.
• Several cookbooks, and you choose where each recipe goes.
• Optional backup email to get your access back on a new phone.
• Redesigned home, faster and more accurate imports, better tags.
```

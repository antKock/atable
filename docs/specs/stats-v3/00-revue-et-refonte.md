# Dashboard `/admin/stats` — revue PM / Product Analyst et proposition de refonte (v3)

> Rédigé le 2026-09-12 à partir de la page en prod (v2 du 2026-08-14 + section 00 App Store du
> 2026-09-12), des données prod du jour et des bonnes pratiques citées en fin de document.
> Statut : **structure validée par Anthony le 2026-09-12** (décisions en §4.7) — **maquette HTML** `temp/stats-v3-preview.html` (non commitée, chiffres prod du 12/09) à valider, puis lot A.

## 0. TL;DR

- La page actuelle est une **vitrine d'instrumentation** : 7 sections, 33 cartes, 8 KPI + 4 signaux,
  7 900 px de haut, organisée par **chantier et par source de données** (Foyer lots 1-4, #14, 032, IA)
  plutôt que par **question produit**. Elle dit beaucoup, mais ne répond pas en un écran à
  « est-ce que ça va, et qu'est-ce que je fais cette semaine ? ».
- Le signal le plus important pour une app grand public — **la rétention** — est en 5ᵉ rangée de la
  section 02, mesuré en semaines pour un produit utilisé quelques fois par mois. Or les données prod
  montrent une **rétention M1 qui se dégrade de cohorte en cohorte** (42 % → 18 % → 14 %) et
  personne d'une cohorte n'est encore là à M3, à deux exceptions près. La page ne le crie pas.
- **Refonte proposée** : une page blanche organisée autour d'une **North Star** (personnes qui
  utilisent réellement Mijote chaque mois) et de son arbre d'inputs, en 5 blocs qui suivent le
  parcours — *En un coup d'œil · Acquérir · Activer · Retenir · Engager* — plus un bloc *Santé &
  économie* replié en bas. % et effectifs toujours ensemble, fenêtres uniformes de 4 semaines, une
  définition par carte au lieu de la prose, mobile d'abord pour le premier écran.
- 3 lots : **A** restructuration sans nouvelle instrumentation (le gros de la valeur), **B**
  instrumentation « usage réel » (consultation de recettes) pour une North Star honnête, **C**
  scission ops / explorateur de carnets.

---

## 1. Ce que la page doit servir (cadrage PM)

Un seul utilisateur : Anthony, fondateur solo, qui l'ouvre dans trois situations :

| Situation | Question | Cadence | Aujourd'hui |
|---|---|---|---|
| Revue hebdo | Le produit progresse-t-il ? Les gens reviennent-ils ? Qu'est-ce qui bloque ? | 1×/semaine, 10 min | Impossible en un écran ; il faut lire 7 sections |
| Après un lancement (1.3, campagne, feature) | Est-ce que ça a marché, sur quel maillon ? | ponctuel | Partiellement (section 00 depuis ce matin, funnel démo) |
| Contrôle ops | Quelque chose est-il cassé ou anormalement cher ? | quotidien, 30 s | Mélangé au reste (section 06, échecs, coûts, sondes démo) |

Un dashboard qui sert trois cadences différentes sur une seule page longue ne sert bien aucune des
trois (Few : « un dashboard tient sur un écran ou ce n'est pas un dashboard »).

---

## 2. Revue de l'existant

### 2.1 Regard PM — structure et hiérarchie

1. **Pas de North Star, pas d'arbre.** La carte badgée « North star » est le *cumul* de personnes
   et de carnets — une courbe qui ne peut que monter, donc une vanity metric. Les 8 KPI mélangent des
   étapes (acquisition, conversion, engagement, qualité) et des fenêtres différentes (30 j, « depuis le
   16 août », 8 cohortes hebdo, global). Sur un écran 1440 px, la rangée déborde sur deux lignes avec
   un KPI orphelin.
2. **Organisation par chantier, pas par question.** Les sections *Carnets & cercles* et *Compte &
   sécurité* sont des audits d'adoption des lots Foyer (invité, multi-carnet, profil nommé, fusions,
   tokens). Ce sont des vérifications ponctuelles post-lancement, pas un suivi permanent. Le jargon
   interne fuit dans les titres : « Lot 3 », « Lot 4 », « #14 », « 032 », « grain owner », « heartbeat ».
3. **La rétention est enterrée** et mal grainée. Rétention hebdo sur 8 semaines pour un produit
   « quand je cuisine » (fréquence naturelle : quelques jours actifs par mois) — la courbe tombe
   mécaniquement à zéro et n'est pas lisible. Aucune table de cohortes avec effectifs.
4. **Aucun repère de « bien / pas bien ».** Pas de cible, pas de benchmark, deltas seulement sur 3 KPI
   et sur une base « 30 j vs 30 j précédents » gated à n ≥ 5. Le lecteur doit savoir par cœur si 27 %
   de conversion démo est bon.
5. **Ops et produit mélangés.** Échecs d'enrichissement, réconciliation de facture OpenAI, frictions
   démo, tokens brûlés : nécessaires, mais d'une autre cadence. Ils allongent la page et diluent.
6. **Filtres incohérents.** Période, plateforme et sélecteur de carnets ne s'appliquent qu'à une
   partie des cartes (badges « global »). Le sélecteur de carnets est un outil d'exploration/debug,
   pas une vue PM.
7. **Prose défensive partout.** Les notes d'époque (➀ ➁, « majorant », « identités fantômes »,
   « non mesuré avant le rollup ») sont honnêtes et précieuses, mais visibles en permanence sur une
   dizaine de cartes. Elles doivent vivre dans une définition dépliable par carte.
8. **Pas pensé mobile.** Grille 12 colonnes, cartes de 250 px, tooltips au survol. Un fondateur regarde
   ses chiffres sur son téléphone.

### 2.2 Regard Product Analyst — définitions et fiabilité

| Métrique actuelle | Problème | Ce qu'il faudrait |
|---|---|---|
| « Personnes actives » (MAU/WAU) = ≥ 1 ping | Le ping = « a ouvert l'app ». Sur les 44 MAU du jour, **14 n'ont ajouté aucune recette en 30 j** ; on ne sait pas s'ils ont consulté quoi que ce soit. L'événement d'activité est trop faible pour porter une North Star | Événement de rétention = **action principale** (Lenny/Berezovsky) : consulter ou ajouter une recette. Deux niveaux : « a ouvert » / « a utilisé » |
| Stickiness WAU/MAU | Ratio conçu pour des produits quotidiens ; bruité et peu actionnable ici | Distribution des jours actifs / 28 j (déjà présente) suffit |
| Rétention par cohorte hebdo, 8 semaines | Grain inadapté à la fréquence d'usage ; pas d'effectifs affichés ; pourcentages sur n = 10-20 | **Rétention mensuelle non bornée** (actif entre J+30 et J+59 = M1) par cohorte mensuelle, en **table** avec n/N et ombrage, courbes superposées pour comparer les cohortes entre elles |
| Cumul personnes / carnets « North star » | Ne peut que monter | Nouvelles personnes / semaine + personnes actives 28 j (déjà les strates par génération) |
| Funnel démo → carnet | Mélange essais web et app ; téléchargements iOS et essais démo n'ont pas le même dénominateur (dit dans la note, mais le tunnel est quand même affiché en un seul bloc) | **Un funnel par canal**, jamais fusionnés : App Store (impressions → fiche → install → 1ʳᵉ ouverture → carnet) et Web (essai démo web → carnet) |
| Activation 7 j = ≥ 1 recette | Trop bas : la 1ʳᵉ recette est souvent créée dans la minute qui suit la conversion (c'est le geste de sortie de démo) | « Aha » à définir sur les données : ex. **≥ 3 recettes ET ≥ 1 retour après J+1** dans les 7 j. À calibrer contre la rétention M1 (l'activation qui prédit le mieux M1 est la bonne) |
| Deltas 30 j vs 30 j | Fenêtres glissantes qui coupent les semaines ; un seul point de comparaison | Semaines ISO, comparaison **4 semaines vs 4 semaines précédentes**, et série hebdo derrière chaque KPI |
| Fenêtres | 30 j, période sélectionnée, « depuis le 16 août », 8 cohortes, 90 j, cumul… sur la même page | **Une** fenêtre de comparaison (4 sem.) pour les KPI, **une** période sélectionnée pour toutes les séries, clamp à l'époque affiché en libellé |
| Pourcentages | Affichés sur n < 20 sans effectif (activation 0 %, conversion 0 %, 100 % couverture) | **% et n/N toujours ensemble** ; % grisé sous N < 20 avec marge d'erreur (a16z, PostHog : à petit volume, un % seul trompe) |
| Couverture IA 100 %, pipeline 100 % | Problème résolu → n'a plus rien d'un KPI | Pastille de santé (vert/rouge) en bas, alerte si < 95 % |
| Coût / recette, / image | Bonne unité pour le pipeline, mauvaise pour le modèle économique envisagé (déblocage à coût fixe, cf. [[Stratégie]]) | **Coût IA / personne active / mois** — c'est ce chiffre que le prix unique doit couvrir |
| Partage : copies 30 j / liens émis depuis toujours | Ratio explicitement non comparable | Dater l'émission des liens (colonne `share_token_created_at`) ou ne montrer que les copies |

**Fiabilité à documenter une fois pour toutes** (dans un panneau « définitions & limites » plutôt que
dans chaque carte) : owner ≡ session avant le 2026-07-10 (majorant), jours actifs sous-capturés avant
le correctif ping, essais démo comptés depuis le 2026-07-17, marqueur de conversion depuis le
2026-08-14, compteurs Apple arrondis/seuillés et disponibles à J-1, pas de lien personne ↔ source
App Store.

### 2.3 Ce que les données disent aujourd'hui (et que la page ne montre pas)

Prod, 2026-09-12 : 81 personnes réelles, 63 carnets, 591 recettes, 44 actives sur 30 j, 22 sur 7 j,
21 avec e-mail de secours (26 %).

Rétention mensuelle non bornée par cohorte d'arrivée (actif au moins un jour dans le mois considéré) :

| Cohorte | N | Actifs M1 (J+30 → J+59) | Actifs M2 (J+60 → J+89) | Encore actifs ces 30 j |
|---|---|---|---|---|
| Mai | 12 | 5 (42 %) | 2 | 4 |
| Juin | 17 | 3 (18 %) | 2 | 3 |
| Juillet | 15 | 1 / 7 éligibles | — | 5 |
| Août | 20 | pas encore éligible | — | 18 |
| Septembre | 14 | — | — | 14 |

Lecture : la courbe **ne s'aplatit pas** (Lenny/Casey : l'aplatissement est le signal n°1 de
product-market fit), et **chaque nouvelle cohorte retient moins bien** que la précédente — l'inverse
de ce qu'on veut voir. Mai est probablement un cercle proche (amis/famille), ce qui explique une
partie de l'écart, mais Juin → Juillet reste une baisse. Parmi les 44 actives sur 30 j : 14 n'ont rien
ajouté, 13 ont ajouté 1-4 recettes, 11 entre 5 et 19, 6 plus de 20. Le produit a un **noyau
d'utilisateurs intenses** et une **majorité qui essaie puis s'évapore**. C'est LA question produit
du moment, et c'est ce que la v3 doit mettre en haut à gauche.

À nuancer : jours actifs sous-capturés avant le 2026-07-10 (la cohorte Mai/Juin est un peu
pessimiste sur M1), et un « actif » = ouverture de l'app, pas usage réel — d'où le lot B.

---

## 3. Bonnes pratiques retenues (et comment elles s'appliquent)

| Principe | Source | Application à Mijote |
|---|---|---|
| Un dashboard tient sur **un écran**, l'important en haut à gauche, minimum d'encre non-donnée, groupes logiques séparés | Stephen Few, *Information Dashboard Design* ; [Common Pitfalls](https://www.perceptualedge.com/articles/Whitepapers/Common_Pitfalls.pdf) | Premier écran = North Star + 5 inputs + santé. Le reste est en dessous, par question |
| **North Star + arbre d'inputs** : une métrique de valeur livrée, ses drivers de niveau 1 et 2 | [Amplitude](https://amplitude.com/blog/product-north-star-metric), [Mixpanel](https://mixpanel.com/blog/north-star-metric/), [UXCam](https://uxcam.com/blog/north-star-metric-framework/) | NSM = personnes qui utilisent réellement Mijote sur 28 j ; inputs = nouvelles personnes activées + personnes retenues |
| **Goals → Signals → Metrics**, ne garder que les catégories HEART qui servent l'objectif du moment | [Kerry Rodden, HEART](https://kerryrodden.com/heart/) ; [Productcompass](https://www.productcompass.pm/p/the-google-heart-framework) | Objectif 2026-T3/T4 : rétention et activation. Adoption (téléchargements) et engagement sont des inputs ; « happiness » = note App Store 5,0 et retours qualitatifs, pas sur la page |
| Lire des **courbes de cohortes**, pas des chiffres ; comparer chaque cohorte à la précédente ; l'aplatissement = PMF ; événement de rétention = action principale ; grain = fréquence naturelle d'usage | [Lenny — What is good retention](https://www.lennysnewsletter.com/p/what-is-good-retention-issue-29), [Casey Winters](https://www.caseyaccidental.com/p/what-is-good-retention-an-exhaustive-benchmark-study-with-lenny-rachitsky), [Berezovsky — Measuring cohort retention](https://www.lennysnewsletter.com/p/measuring-cohort-retention) | Table de cohortes mensuelles M0-M3, événement = consulter/ajouter une recette, non bornée |
| À petit volume : **3-5 métriques**, comptes plutôt que %, compléter par le qualitatif | [a16z — 16 startup metrics](https://a16z.com/16-startup-metrics/), [PostHog — early-stage analytics](https://posthog.com/blog/early-stage-analytics) | n/N partout, % seulement si N ≥ 20 ; lien direct vers les carnets d'une cohorte pour aller *regarder* ce que font les gens |
| Benchmarks grand public : D1 ≈ 25 %, D7 ≈ 12 %, D30 ≈ 6 % ; DAU/MAU ≥ 20 % = bon ; Food & Drink : fiche → install ≈ 53 % (US 2025), impression → install ≈ 3,6 % toutes catégories | [UXCam retention](https://uxcam.com/blog/mobile-app-retention-benchmarks/), [Business of Apps](https://www.businessofapps.com/guide/mobile-app-retention/), [AppTweak](https://www.apptweak.com/en/aso-blog/average-app-conversion-rate-per-category), [Business of Apps ASO](https://www.businessofapps.com/marketplace/app-store-optimization/research/app-store-optimization-statistics/) | Afficher le benchmark en filigrane sous les KPI concernés (rétention, conversion fiche) — Mijote est déjà bien au-dessus sur la fiche (16 % impression → install) |
| Gouvernance : chaque métrique a une définition, un calcul, une source, un journal des changements | UXCam NSM framework | Le registre `METRIC_EPOCHS` existe déjà ; l'exposer dans un panneau « définitions » unique |

---

## 4. Proposition de refonte (page blanche)

### 4.1 North Star et arbre

**North Star — « Cuisiniers actifs »** : personnes réelles ayant **consulté ou ajouté** au moins une
recette dans les 28 derniers jours. (Lot A : proxy = ≥ 1 recette ajoutée OU ≥ 1 jour actif ; lot B :
vraie définition avec la consultation instrumentée.)

```
Cuisiniers actifs (28 j)
├── Nouvelles personnes activées
│   ├── Acquisition   : téléchargements iOS · essais démo web · arrivées par invitation/partage
│   ├── Conversion    : essai → 1er carnet (par canal)
│   └── Activation    : carnet → « aha » (≥ 3 recettes et 1 retour dans les 7 j)
└── Personnes retenues
    ├── Rétention M1 / M2 / M3 par cohorte
    ├── Profondeur    : recettes consultées / ajoutées par personne active
    └── Boucle        : liens partagés → copies → nouvelles personnes ; invités
Contraintes : coût IA / cuisinier actif / mois · santé pipeline · sécurité du compte (e-mail)
```

### 4.2 Structure de la page

Barre : **aucun filtre**. Période figée à **12 semaines** pour toutes les séries (« tout » n'existe que
sur la table de cohortes) ; plus de filtre plateforme global (la plateforme devient une dimension des
cartes acquisition) ; le sélecteur de carnets part dans une page « Explorer » (lot C). Seuls éléments
de barre : date des données, lien « Définitions & limites », lien « Explorer » (lot C).

**Bloc 1 — En un coup d'œil** *(tient sur un écran, y compris mobile)*

- **North Star** en grand : cuisiniers actifs 28 j, sparkline 12 semaines, delta vs 4 semaines
  précédentes, N total de personnes.
- **5 inputs** en tuiles : nouvelles personnes (4 sem.), activées à 7 j, **rétention M1 glissante**
  (personnes arrivées dans les 4 semaines closes il y a 8 semaines, actives au moins un jour entre
  J+28 et J+55 — fenêtre toujours complète, mise à jour chaque lundi, comparée à la cohorte glissante
  de la semaine précédente), recettes / cuisinier actif, coût IA / cuisinier actif. Chaque tuile :
  % en grand + n/N dessous, comparaison 4 sem., sparkline hebdo, benchmark en filigrane quand il
  existe. La cohorte glissante lisse (chevauchement) et porte sur des arrivées d'il y a 2-3 mois :
  le signal précoce, c'est l'activation (« ≥ 1 retour après J+1 »).
- **Santé** : trois pastilles vert/rouge — pipeline IA (succès < 95 % ou échecs en attente), crons
  (demo-reset, app-store-sync : dernier passage < 36 h), démo (seed ≥ 30). Rien d'autre.
- **Ce qui a bougé** *(v2 du lot A)* : trois phrases générées (plus fortes variations sur 4 sem.),
  ex. « Rétention M1 de la cohorte de juillet : 1/7, contre 3/17 en juin ».

**Bloc 2 — Acquérir** *(d'où viennent les gens, par canal, jamais fusionné)*

- Tunnel **App Store** : impressions → vues de fiche → premiers téléchargements → 1ʳᵉ ouverture iOS
  → 1er carnet iOS (benchmark fiche → install en filigrane).
- Tunnel **Web** : essais démo web → 1er carnet web (landing non mesurée, dit une fois).
- **Invitations & partage** : personnes arrivées par code invité ou lien de partage.
- Série hebdo « nouvelles personnes par canal » (iOS store / web / invitation) avec repères produit
  (1.3, campagnes Ads/Insta) — la seule série avec repères visibles.
- Origine App Store (recherche / navigation / referrers nommés dont ChatGPT).

**Bloc 3 — Activer** *(du carnet au premier vrai usage)*

- Funnel post-carnet par cohorte hebdo : carnet → 1ʳᵉ recette (J0) → 3 recettes (J7) → 1 retour après
  J+1 → activé. En n/N, 8 dernières semaines en petites colonnes.
- **Par première méthode d'ajout** (photo / URL / voix / manuel / copie partagée) : laquelle active le
  mieux ? C'est directement actionnable sur l'onboarding.
- Délai médian démo → carnet (une valeur, pas un histogramme).

**Bloc 4 — Retenir** *(la question du moment)*

- **Table de cohortes mensuelles** : lignes = mois d'arrivée, colonnes = M0 M1 M2 M3, cellule = % en
  grand + n/N dessous, ombrage proportionnel ; cellules non éligibles grisées. C'est la carte centrale
  de la page (mois calendaires : ici on lit l'histoire ; le KPI du bloc 1 est la version glissante).
- **Courbes de rétention** superposées par cohorte (M0→M3), pour voir si une cohorte fait mieux que
  la précédente et si ça s'aplatit.
- **Personnes actives 28 j par génération** (le layer cake existant, conservé tel quel : il est bon).
- **À rattraper** : nombre de personnes actives le mois dernier et silencieuses ce mois (avec lien
  vers l'explorateur, lot C) — le pont vers l'action.

**Bloc 5 — Engager** *(ce que font ceux qui restent)*

- Distribution recettes ajoutées / personne active 28 j (0 · 1-4 · 5-19 · 20+) — montre le noyau
  intense vs la longue traîne.
- Consultation vs ajout (lot B) : combien *cuisinent* réellement avec l'app.
- Mix des méthodes d'ajout dans le temps (conservé).
- **Boucle de partage** : liens émis (datés) → copies → nouvelles personnes ; invités par carnet. Le
  multi-carnet devient une ligne de texte.

**Bloc 6 — Santé & économie** *(replié par défaut, cadence ops)*

- Coût IA / cuisinier actif / mois, total 4 sem., part démo, réconciliation facture.
- Pipeline : échecs à relancer (table existante), couverture.
- Sécurité du compte : « personnes actives sans e-mail de secours » (le risque, en compte) ; tokens
  en une ligne.
- Démo : essais, appels IA, frictions 403, sondes exclues.

**Panneau « Définitions & limites »** (lien en haut de page, une seule fois) : formule de chaque
métrique, source, époque de naissance, réserves de fiabilité — généré depuis le registre.

### 4.3 Règles de présentation

- **Pourcentage ET effectif, toujours les deux** : le % est l'unité de comparaison (en grand), le
  n/N est toujours visible dessous. Sous N < 20, le % passe en gris (fragile : une personne = plusieurs
  points) avec la marge d'erreur au survol (intervalle de Wilson à 95 %).
- **Semaines ISO** comme grain des séries ; KPI comparés sur 4 semaines vs 4 précédentes.
- **Une période** pour toute la page ; clamp à l'époque signalé dans le libellé (« depuis le 16 août »).
- **Zéro jargon interne** dans les titres (pas de lot, migration, grain, heartbeat) ; une ligne de
  sous-titre en français courant ; définition dépliable (ⓘ) par carte.
- **Repères d'époque** : petits marqueurs discrets, légende unique en bas de page.
- **Benchmarks** en filigrane, jamais en jugement automatique (petits volumes).
- **Mobile** : bloc 1 en une colonne, tuiles empilées, graphiques à 2 par ligne max ; interactions au
  toucher (pas de tooltip-only).
- **Couleurs** : palette actuelle conservée (elle est bonne) ; les générations gardent leur couleur.

### 4.4 Ce qui disparaît (et pourquoi)

| Carte actuelle | Sort | Raison |
|---|---|---|
| Évolution du parc (cumuls) | supprimée | vanity ; remplacée par nouvelles personnes / sem. |
| Stickiness | supprimée | inadaptée à la fréquence d'usage |
| Appareils par personne | → définitions | mesure de bruit, pas de produit |
| Profils nommés, fusions, tokens funnel | → bloc 6, une ligne | audit ponctuel terminé |
| Top 20 carnets | → page Explorer | exploration, pas pilotage |
| Répartition plateforme (donut) | → dimension des cartes acquisition | |
| Couverture IA, pipeline (jauges) | → pastille santé | résolu, alerte seulement |
| Frictions démo, activité démo | → bloc 6 | ops |
| Délai démo → carnet (histogramme) | → une médiane dans Activer | |
| Carnets par personne, personnes par carnet | → une ligne dans Engager | adoption acquise |
| Rétention hebdo 8 semaines | remplacée | par la table mensuelle |

### 4.5 Instrumentation à ajouter

| Besoin | Pour | Effort |
|---|---|---|
| **Consultation de recette datée par personne** (`recipe_views` quotidien : owner, day, count) — ou un type d'activité dans `daily_activity` | North Star « usage réel », bloc 5, activation « retour » | lot B, léger : un compteur atomique à l'ouverture d'une recette, purgé après 13 mois |
| Émission des liens de partage datée | boucle de partage comparable | lot B, trivial |
| Canal d'arrivée d'une personne (`ios-store` / `web` / `invite` / `share`) dérivé de la 1ʳᵉ session + origine du carnet | bloc 2 | lot A, calcul SQL, pas de nouvelle donnée |
| 1ʳᵉ ouverture iOS après install | tunnel App Store complet | lot A : 1ʳᵉ `device_session` iOS par owner |

Rien de tout cela ne touche la vie privée au-delà de l'existant (compteurs par personne, pas de
contenu).

### 4.6 Lots et estimation

| Lot | Contenu | Effort | Prérequis |
|---|---|---|---|
| **A — Restructurer** | Nouvelle page (blocs 1-4 + 6 replié), table de cohortes mensuelles, funnels par canal, activation par méthode, règles n/N, panneau définitions, mobile | 2-3 jours | maquette HTML validée (comme pour la v2) ; migration additive pour les nouvelles fonctions SQL |
| **B — Usage réel** | `recipe_views`, North Star v2, bloc 5 complet, activation recalibrée contre M1 | 1 jour + 4 semaines d'accumulation avant lecture | lot A |
| **C — Scinder** | Page Explorer (carnets, top, filtre carnet, liste « à rattraper »), page Santé (ops) | 1 jour | lot A |

Ordre conseillé : A, puis B immédiatement (pour accumuler), C quand le besoin d'aller voir un carnet
précis se fait sentir.

### 4.7 Décisions (Anthony, 2026-09-12)

0. **Ajustements après lecture de la maquette** : le KPI rétention du bloc 1 devient **glissant** (cohorte des
   4 semaines closes il y a 8 semaines, fenêtre J+28 → J+55, MAJ hebdo) ; les **% sont affichés partout**,
   avec n/N dessous et % grisé sous N < 20 (règle §4.3). ✅

1. **Événement de rétention** = consulter ou ajouter une recette. ✅
2. **Activation** = ≥ 3 recettes ET ≥ 1 retour après J+1 dans les 7 j, seuil à calibrer contre M1. ✅
   Premier calibrage sur les 53 personnes arrivées de juin à début septembre : la **première méthode
   d'ajout** sépare déjà nettement — URL 9 activées / 17, manuel 5 / 7, photo 3 / 13, aucune recette
   0 / 13. Le bloc *Activer* est donc directement actionnable (onboarding, premier import proposé).
3. **Benchmarks** : affichés en filigrane sous les KPI concernés, avec la source et la catégorie, en
   tant que « repère marché » (études publiques AppsFlyer/Adjust/data.ai pour la rétention, AppTweak
   pour la fiche App Store), jamais comme jugement automatique. Détail en §4.8.
4. **Période figée à 12 semaines** sur toute la page ; « tout » n'existe que sur la table de cohortes.
   Plus de sélecteur de période, de plateforme ni de carnet sur l'écran principal. ✅
5. **Digest hebdo par e-mail** (bloc 1 en texte) à `kocken.anthony@gmail.com`. ✅ Spécifié en §4.9.

### 4.8 Benchmarks : ce qu'on affiche et d'où ça vient

Un benchmark ici = la **médiane du marché** publiée par un acteur qui agrège des milliers d'apps,
pour la catégorie la plus proche de Mijote quand elle existe. Ce n'est pas « telle app concurrente »
(pas de données publiques par app), c'est le standard observé.

| KPI Mijote | Repère marché | Valeur (2025) | Source | Lecture |
|---|---|---|---|---|
| Fiche App Store → téléchargement | Food & Drink, US App Store | ≈ 53 % ; toutes catégories ≈ 34 % | [AppTweak](https://www.apptweak.com/en/aso-blog/average-app-conversion-rate-per-category) | Apple seuille les vues de fiche : comparer sur des mois entiers seulement |
| Impression → téléchargement | toutes catégories | ≈ 3,6 % | [Business of Apps](https://www.businessofapps.com/marketplace/app-store-optimization/research/app-store-optimization-statistics/) | Mijote ≈ 16 % depuis la 1.3 (petit volume, mais très au-dessus) |
| Rétention J1 / J7 / J30 (post-install, apps grand public) | médiane iOS | ≈ 25 % / 12 % / 6 % | [UXCam](https://uxcam.com/blog/mobile-app-retention-benchmarks/), [Business of Apps](https://www.businessofapps.com/guide/mobile-app-retention/) | Notre M1 (actif entre J+30 et J+59) n'est pas la même définition que D30 (actif le jour 30) : on affiche le repère avec cette réserve, à titre d'ordre de grandeur — 18 % M1 est *au-dessus* d'un D30 à 6 % |
| Jours actifs / mois | DAU/MAU ≥ 20 % « bon » pour des apps quotidiennes | — | Pushwoosh, UXCam | Non pertinent pour un usage « quand je cuisine » : **pas affiché** |
| Activation, essai → carnet, coût IA / personne | aucun standard public comparable | — | — | Comparaison à nous-mêmes (cohorte précédente) uniquement |

Règle : le repère s'affiche en gris sous la valeur (« repère marché ≈ 34 %, AppTweak 2025 »), avec un
ⓘ vers la définition et la réserve. Il disparaît quand N < 20.

### 4.9 Digest hebdo par e-mail

- **Quand** : lundi 07:00 Europe/Paris, cron VPS → `GET /api/cron/weekly-digest` (même garde
  `CRON_SECRET`, idempotent par semaine ISO : une ligne `digests_sent(week)`).
- **À qui** : `DIGEST_TO` (variable d'env, = `kocken.anthony@gmail.com`), via Resend (déjà en place
  pour les magic links), expéditeur `EMAIL_FROM`.
- **Contenu** = le bloc 1 en texte, semaine ISO précédente vs les 4 précédentes :
  1. Cuisiniers actifs 28 j (valeur, delta, N total).
  2. Nouvelles personnes (par canal), activées à 7 j (n/N), rétention M1 de la dernière cohorte
     complète (n/N), recettes / cuisinier actif, coût IA / cuisinier actif.
  3. « Ce qui a bougé » : les 3 plus fortes variations en une phrase chacune.
  4. Santé : pipeline, crons, démo — une ligne, rouge si un voyant est au rouge.
  5. Lien vers `/admin/stats`.
- **Rendu** : texte brut + HTML minimal (pas de graphique), 15 lignes, lisible sur téléphone.
- **Code** : le calcul du bloc 1 est un module pur `src/lib/admin/overview.ts` partagé par la page et
  le digest — une seule définition des chiffres.
- **Silence** : si le cron échoue, Sentry `captureException` ; pas de moniteur Crons (seat).
- Lot : **A** (le digest est l'usage principal du bloc 1).

# Mijote — Fiche App Store Connect

> Source de vérité pour tous les champs à remplir dans **App Store Connect**
> au moment de la soumission. Le ton est le **tutoiement** (cohérent avec
> les apps grand public récentes : Doctolib, Yuka, Spotify…). La politique
> de confidentialité et la page support gardent le **vouvoiement** (cadre
> plus formel).
>
> Voir aussi :
> - [`app-store-roadmap.md`](./app-store-roadmap.md) — pilotage global
> - [`app-store-privacy-labels.md`](./app-store-privacy-labels.md) — privacy nutrition labels (à recopier dans ASC)
> - [`politique-confidentialite.md`](./politique-confidentialite.md) — texte de la politique de confidentialité

---

## 1. Nom de l'app (≤ 30 caractères)

**🎯 Choix retenu** : `Mijote — Tes recettes` (21 car.)

> Note : caractère **`—`** (tiret cadratin, U+2014), pas `-` (tiret simple).
> Apple recommande le cadratin pour les séparateurs de display name.

Pourquoi *Mijote* :
- Verbe culinaire évocateur (chaleur, savoir-faire, temps).
- Court, mémorable, brandable, prononçable en plusieurs langues.
- 6 lettres sans caractère spécial → aucun problème de saisie ou de recherche.
- L'apparence française est un atout marketing à l'international.

Pourquoi *Tes recettes* :
- Tutoiement → ton intime et chill, cohérent avec les apps grand public 2026.
- « Recettes » = mot-clé SEO fort obligatoire dans le nom.
- « Tes » porte la propriété (différenciateur produit : ce sont **tes**
  recettes, pas celles d'une base mondiale type Marmiton).

---

## 2. Sous-titre (≤ 30 caractères)

**🎯 Choix retenu** : `Réunies comme par magie` (23 car.)

Lu d'un trait avec le nom : *« Mijote — Tes recettes, réunies comme par magie. »*

- **Réunies** : capture le « rassemblement » depuis les 3 sources d'import
  (photo, voix, lien) sans avoir à les énumérer.
- **Comme par magie** : porte l'IA sans la nommer. Ton chaleureux,
  opposé au registre tech.
- L'allitération en /m/ (**M**ijote… co**mm**e… **m**agie) donne du
  rythme à l'oral.

---

## 3. Description longue (≤ 4 000 caractères)

> La règle d'écriture : **la valeur d'abord, la techno après.** On parle
> d'usages et de moments de vie, pas d'« API » ou de « LLM ». L'IA n'est
> jamais nommée — elle se devine dans le résultat (« on extrait »,
> « on structure », « tout se complète tout seul »).

```
Toutes les recettes de ta famille, enfin réunies au même endroit. Celles de
ta grand-mère sur un cahier jauni, celles que tu sauvegardes sur Instagram,
celles que ton oncle dicte par téléphone, celles d'un blog que tu adores —
Mijote les rassemble en quelques secondes, prêtes à cuisiner.

━━━ Trois façons d'ajouter une recette en 30 secondes ━━━

• PHOTO — prends en photo le carnet de ta grand-mère ou un screenshot
  Instagram. On extrait le titre, les ingrédients et les étapes pour toi.
• VOIX — dicte la recette de ton oncle pendant qu'il te la raconte au
  téléphone. On transcrit et on met en forme.
• LIEN — colle l'adresse d'un blog culinaire. On récupère le contenu et
  on en fait une vraie recette, lisible, sans le bruit autour.

Chaque recette se complète toute seule : temps de préparation, coût estimé,
saisons, étiquettes (végétarien, rapide, comfort food…). Une jolie
illustration est même générée pour reconnaître chaque plat d'un coup d'œil.
Tu restes maître : modifie, complète, remplace l'image par tes propres
photos.

━━━ Cuisiner ensemble, comme à la maison ━━━

• FOYER PARTAGÉ — crée un foyer, partage le code d'invitation à ta
  famille, et vos recettes sont les mêmes sur tous vos téléphones. Ton
  conjoint·e ajoute la recette du dimanche midi, tu la retrouves dans ta
  cuisine du mardi soir.
• PAS DE COMPTE — pas d'e-mail, pas de mot de passe, pas de publicité.
  On te respecte assez pour ne rien te demander d'inutile.
• ESSAI EN UN CLIC — explore une bibliothèque démo avant même de créer
  ton foyer.

━━━ Retrouver, sans chercher ━━━

• Accueil par envies : Rapide, Végétarien, Comfort food, De saison,
  Apéro, Desserts…
• Filtres précis : par ingrédient, durée, coût, régime, type de plat.
• Mode « De saison » : ne voir que ce qui se cuisine maintenant.
• Mode lecture pensé pour la cuisine : grandes polices, étapes pas-à-pas,
  l'écran reste allumé pendant que tu travailles les mains tachées de
  farine.

━━━ Ton foyer, tes règles ━━━

• Renomme le foyer, gère les appareils connectés, quitte ou supprime
  le foyer en deux tapotements.
• Suppression définitive et complète à tout moment — c'est ton contenu,
  jamais le nôtre.

━━━ Confidentialité ━━━

• Pas de profilage publicitaire, pas de pixels de suivi, pas d'identifiant
  publicitaire — jamais.
• Aucune vente de tes données à des tiers.
• Politique de confidentialité : mijote.anthonykocken.fr/legal/confidentialite

━━━ Pour qui ? ━━━

Pour les foyers qui aiment cuisiner ensemble et qui en ont assez de
chercher « cette recette de la dernière fois » dans douze endroits
différents. Pour les familles qui veulent garder vivantes les vraies
recettes — celles qu'on mange, pas celles d'un site sponsorisé. Pour celles
et ceux qui en ont marre des apps bourrées de pubs et de paywalls.

Mijote est gratuit, sans publicité, sans achat intégré.
```

≈ 3 100 caractères. Tutoiement appliqué partout, scénarios de vie plutôt
que listes de features techniques.

---

## 4. Mots-clés ASO (≤ 100 caractères, séparés par virgules, **sans espaces**, **sans répéter le nom**)

**🎯 Choix retenu** (98 car.) :

```
recettes,cuisine,foyer,famille,IA,vocal,photo,OCR,importer,partage,menu,saison,végétarien,rapide
```

Règles :
- Ne pas répéter « Mijote » : Apple cherche déjà dans le nom et le sous-titre.
- Pas de mots vides (« et », « ou »).
- Singulier privilégié au pluriel (« recette » matche déjà « recettes »).
- Anglicismes que les utilisateurs francophones tapent quand même
  (« OCR », « IA ») — ce champ est purement fonctionnel pour la recherche,
  c'est la *seule* exception au principe « pas de techno dans la fiche ».

---

## 5. Catégorie

- **Principale** : Cuisine et boissons (*Food & Drink*)
- **Secondaire** (optionnelle) : Style de vie (*Lifestyle*) — apporte de la visibilité hors recherche pure cuisine.

---

## 6. URLs

| Champ ASC | Valeur | Statut |
|---|---|---|
| **Privacy Policy URL** | `https://mijote.anthonykocken.fr/legal/confidentialite` | ✅ en ligne |
| **Support URL** | `https://mijote.anthonykocken.fr/support` | ✅ en ligne |
| **Marketing URL** *(optionnel)* | `https://mijote.anthonykocken.fr` | ✅ en ligne |

---

## 7. Promotional text (≤ 170 caractères)

> Champ modifiable **sans repasser en review Apple** — utile pour les promos saisonnières.

**🎯 Valeur de départ** (142 car.) :

```
Toutes les recettes de ta famille, rassemblées au même endroit sans ressaisir. Une photo, une dictée ou un lien, et c'est dans ta cuisine.
```

### Versions saisonnières à garder sous le coude

- **Fêtes** :
  ```
  Le repas du réveillon de Mamie, la sauce de tonton, les desserts de ta belle-mère : enfin tout au même endroit. Sans compte, sans pub.
  ```
- **Rentrée** :
  ```
  Marre de chercher cette recette du dimanche midi ? Mijote la garde, l'enrichit et la partage à toute la famille.
  ```

---

## 8. What's New (notes de version v1.0)

```
Bienvenue dans Mijote ! Le moyen le plus simple de rassembler toutes les
recettes de ta famille au même endroit : celles que tu as sur ton
téléphone, celles d'Instagram, celles qu'on te dicte par téléphone, celles
d'un blog que tu adores. Une photo, une dictée ou un lien, et c'est prêt à
cuisiner.

Tes retours nous aident à progresser : kocken.anthony@gmail.com
```

---

## 9. Autres champs ASC à remplir

| Champ | Valeur |
|---|---|
| **Bundle ID** | `fr.anthonykocken.mijote` *(verrouillé à partir de l'enregistrement Apple — ne pas modifier après création de l'App ID)* |
| **SKU / UGS** | `mijote-apple` *(identifiant interne ; couvre iPad + macOS Catalyst + visionOS si extensions futures)* |
| **Langue principale** | Français (France) |
| **Tranche d'âge** | 4+ (aucun contenu sensible) |
| **In-App Purchases** | Aucun |
| **Game Center** | Non |
| **Sign in with Apple** | Non requis (auth anonyme — voir audit roadmap §3 axe 2) |
| **Politique de contenu UGC** | Pas de UGC public → pas de modération à déclarer |
| **Privacy nutrition labels** | Suivre `app-store-privacy-labels.md` pas à pas |
| **Équipe Apple Developer** | ⚠️ basculer sur **ta propre équipe** dans le sélecteur ASC (pas « Naiane » ou « Riverman studio ») |
| **Capabilities App ID** | Aucune à activer au v1 (cf. roadmap Phase 0). Push, Associated Domains, App Attest peuvent être ajoutés plus tard sur un App ID existant. |

---

## 10. Assets visuels (à fournir au moment de la soumission)

| Asset | Statut | Notes |
|---|---|---|
| **Icône 1024×1024** | ✅ source vectorielle prête | `docs/icons/mijote-icon-1024.svg` (master) + exports PNG dans `docs/icons/` et `public/icons/icon-{1024,512,192}.png`. La version iOS (`ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`) est en 1024×1024 sans alpha (conforme Apple). |
| **Screenshots 6.7" iPhone** | ⏳ à capturer en simulateur Xcode | 5 à 10 screenshots, 1290 × 2796 px — **obligatoire** |
| **Screenshots 6.5" iPhone** | ⏳ recommandé | Fallback automatique sinon |
| **Screenshots iPad 12.9"** | ⏳ recommandé | Si tu veux apparaître en recherche iPad (l'app est déjà Universal — `TARGETED_DEVICE_FAMILY = "1,2"`) |

---

## 11. Ordre de soumission

1. Créer l'App ID dans le portail développeur Apple avec le Bundle ID
   `fr.anthonykocken.mijote` (Phase 0 dernière case côté portail).
2. Créer l'app dans ASC avec ce Bundle ID + le SKU + langue principale.
3. Coller tous les champs textuels ci-dessus (sections 1 à 9).
4. Suivre `app-store-privacy-labels.md` pour les privacy labels.
5. Uploader icône + screenshots (section 10).
6. TestFlight pointant sur staging (Phase 4).
7. Soumettre pour review Apple (Phase 4).

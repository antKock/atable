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
  enfantin-positif, opposé au registre tech.
- L'allitération en /m/ (**M**ijote… co**mm**e… **m**agie) donne du
  rythme à l'oral.

---

## 3. Description longue (≤ 4 000 caractères)

```
Mijote transforme une photo, une dictée vocale ou un lien web en recette
structurée, prête à cuisiner. Pas de compte, pas de mot de passe — juste un
foyer partagé en famille via un code d'invitation.

━━━ Trois façons d'ajouter une recette en 30 secondes ━━━

• PHOTO ou capture d'écran — tu photographies le carnet de ta grand-mère ou
  un screenshot Instagram, on extrait le titre, les ingrédients et les
  étapes.
• DICTÉE VOCALE — tu parles, on transcrit, on structure. Pratique pour
  noter une recette en sortant du marché.
• LIEN URL — tu colles l'adresse d'un blog culinaire, on récupère le
  contenu et on le met en forme.

Chaque recette est ensuite enrichie automatiquement : temps de préparation,
temps de cuisson, coût estimé, saisons, tags (végétarien, rapide, comfort
food…). Une illustration est générée pour reconnaître la recette d'un coup
d'œil. Tu peux tout modifier ou remplacer l'image par tes propres photos.

━━━ Cuisiner ensemble, sans usine à gaz ━━━

• FOYER PARTAGÉ — tu crées un foyer, tu reçois un code d'invitation, tu le
  partages à ta famille. Tous les appareils accèdent à la même
  bibliothèque, synchronisée en temps réel.
• AUCUN COMPTE À CRÉER — pas d'e-mail, pas de mot de passe, pas de
  publicité. L'application fonctionne sans inscription traditionnelle.
• MODE DÉMO — tu veux tester ? Accès direct à une bibliothèque démo,
  zéro friction.

━━━ Retrouve ce que tu cherches ━━━

• Accueil par carrousels thématiques : Nouveautés, De saison, Rapide,
  Végétarien, Comfort food, Apéro, Desserts…
• Recherche et filtres : par titre, ingrédient, type de plat, cuisine,
  régime, durée, coût, saison.
• Toggle « De saison » : ne montrer que ce qui se cuisine maintenant.
• Mode lecture optimisé pour cuisiner : grandes polices, étapes scrollables,
  l'écran reste allumé pendant la préparation.

━━━ Gérer ton foyer ━━━

• Renommer le foyer, gérer les appareils connectés, quitter ou supprimer
  le foyer en deux tapotements.
• Suppression définitive et complète des données possible à tout moment.

━━━ Confidentialité ━━━

• Pas de profilage publicitaire, pas de pixels de suivi, pas d'identifiant
  publicitaire — jamais.
• Aucune vente de tes données à des tiers.
• Politique de confidentialité : mijote.anthonykocken.fr/legal/confidentialite

━━━ Pour qui ? ━━━

Pour les foyers qui veulent rassembler leurs recettes au même endroit sans
ressaisir à la main, et les partager avec leur conjoint·e, leurs enfants,
leurs colocs ou leurs parents. Pour celles et ceux qui aiment cuisiner et
qui en ont assez des apps bourrées de pubs et de paywalls.

Mijote est gratuit, sans publicité, sans achat intégré.
```

≈ 2 600 caractères. Tutoiement appliqué partout (« tu photographies »,
« tes propres photos », « tu cherches »…).

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
- Anglicismes que les utilisateurs francophones tapent quand même (« OCR », « IA »).

---

## 5. Catégorie

- **Principale** : Cuisine et boissons (*Food & Drink*)
- **Secondaire** (optionnelle) : Style de vie (*Lifestyle*) — apporte de la visibilité hors recherche pure cuisine.

---

## 6. URLs

| Champ ASC | Valeur | Statut |
|---|---|---|
| **Privacy Policy URL** | `https://mijote.anthonykocken.fr/legal/confidentialite` | À déployer (rebrand) |
| **Support URL** | `https://mijote.anthonykocken.fr/support` | À déployer (rebrand) |
| **Marketing URL** *(optionnel)* | `https://mijote.anthonykocken.fr` | À déployer (rebrand) |

---

## 7. Promotional text (≤ 170 caractères)

> Champ modifiable **sans repasser en review Apple** — utile pour les promos saisonnières.

**🎯 Valeur de départ** (146 car.) :

```
Photographie une recette, dicte-la ou colle un lien — Mijote la structure en quelques secondes. Tes recettes en famille, sans compte, sans pub.
```

### Versions saisonnières à garder sous le coude

- **Fêtes** :
  ```
  Les recettes de famille de tout le monde, enfin au même endroit. Importe-les en photo, voix ou lien. Sans compte, sans pub.
  ```
- **Rentrée** :
  ```
  Marre de chercher cette recette du dimanche midi ? Mijote la garde, l'enrichit et la partage à ton foyer.
  ```

---

## 8. What's New (notes de version v1.0)

```
Bienvenue dans Mijote ! Cette première version te permet de :
• Importer des recettes en photo, par dictée vocale ou via une URL
• Partager ta bibliothèque en famille via un code d'invitation
• Filtrer tes recettes par saison, type de plat, régime, durée et coût
• Cuisiner depuis ton iPhone avec un mode lecture optimisé

Tes retours sont les bienvenus : kocken.anthony@gmail.com
```

---

## 9. Autres champs ASC à remplir

| Champ | Valeur |
|---|---|
| **Bundle ID** | `fr.anthonykocken.mijote` *(aligné avec le rebrand le 2026-05-23 — possible parce qu'aucun App ID n'avait encore été créé chez Apple. Pour les rebrands ultérieurs il faudra le garder car immuable)* |
| **Langue principale** | Français (France) |
| **Tranche d'âge** | 4+ (aucun contenu sensible) |
| **In-App Purchases** | Aucun |
| **Game Center** | Non |
| **Sign in with Apple** | Non requis (auth anonyme — voir audit roadmap §3 axe 2) |
| **Politique de contenu UGC** | Pas de UGC public → pas de modération à déclarer |
| **Privacy nutrition labels** | Suivre `app-store-privacy-labels.md` pas à pas |
| **Équipe Apple Developer** | ⚠️ basculer sur **ta propre équipe** dans le sélecteur ASC (pas « Naiane » ou « Riverman studio ») |

---

## 10. Assets visuels (à fournir au moment de la soumission)

| Asset | Statut | Notes |
|---|---|---|
| **Icône 1024×1024** | ⚠️ `public/icons/icon-1024.png` est un upscale flou — à refaire depuis une source vectorielle | PNG, sans canal alpha, coins carrés (Apple les arrondit) |
| **Screenshots 6.7" iPhone** | ⏳ à capturer en simulateur Xcode | 5 à 10 screenshots, 1290 × 2796 px — **obligatoire** |
| **Screenshots 6.5" iPhone** | ⏳ recommandé | Fallback automatique sinon |
| **Screenshots iPad 12.9"** | ⏳ recommandé | Si tu veux apparaître en recherche iPad |

---

## 11. Ordre de soumission

1. Créer l'app dans ASC avec le bundle ID + nom + langue (Phase 0 dernière case).
2. Coller tous les champs textuels ci-dessus (sections 1 à 9).
3. Suivre `app-store-privacy-labels.md` pour les privacy labels.
4. Uploader icône + screenshots (sections 10).
5. TestFlight pointant sur staging (Phase 4).
6. Soumettre pour review Apple (Phase 4).

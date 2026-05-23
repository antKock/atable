# À Table — Fiche App Store Connect

> Source de vérité pour tous les champs à remplir dans **App Store Connect**
> au moment de la soumission. Les choix ont été composés à partir de l'audit
> des features du repo (mai 2026) et des best practices ASO 2026.
>
> Voir aussi :
> - [`app-store-roadmap.md`](./app-store-roadmap.md) — pilotage global
> - [`app-store-privacy-labels.md`](./app-store-privacy-labels.md) — privacy nutrition labels (à recopier dans ASC)
> - [`politique-confidentialite.md`](./politique-confidentialite.md) — texte de la politique de confidentialité

---

## 1. Nom de l'app (≤ 30 caractères)

**🎯 Choix retenu** : `À Table — Recettes Foyer` (24 car.)

Rationnel : le nom doit contenir le mot-clé le plus fort selon les best practices ASO 2026 — « recettes » est central. « Foyer » est le vocabulaire produit récurrent et différenciateur.

| Option | Car. | Note |
|---|---|---|
| **À Table — Recettes Foyer** ⭐ | 24 | Mot-clé fort + différenciateur. |
| À Table : Cuisine en famille | 28 | Plus émotionnel, moins searchable. |
| À Table | 7 | Court, marquant, mais 0 mot-clé. |

⚠️ **À vérifier dans ASC** : disponibilité du nom (terme générique, parfois déjà pris). Si conflit : `À Table — Recettes en foyer` ou `À Table Recettes`.

---

## 2. Sous-titre (≤ 30 caractères)

**🎯 Choix retenu** : `Photo, voix ou lien : on gère` (30 car.)

Rationnel : met en avant les 3 imports — *le* différenciateur produit.

| Option | Car. | Note |
|---|---|---|
| **Photo, voix ou lien : on gère** ⭐ | 30 | Différenciateur produit. |
| Recettes en famille, sans compte | 30 | Met en avant l'absence de friction d'auth. |
| L'IA structure vos recettes | 27 | Saturé en 2026, à éviter. |

---

## 3. Description longue (≤ 4 000 caractères)

```
À Table transforme une photo, une dictée vocale ou un lien web en recette
structurée, prête à cuisiner. Pas de compte, pas de mot de passe — juste un
foyer partagé en famille via un code d'invitation.

━━━ Trois façons d'ajouter une recette en 30 secondes ━━━

• PHOTO ou capture d'écran — vous photographiez le carnet de votre grand-mère
  ou un screenshot Instagram, l'IA extrait le titre, les ingrédients et les
  étapes.
• DICTÉE VOCALE — vous parlez, on transcrit, on structure. Pratique pour
  noter une recette en sortant du marché.
• LIEN URL — collez l'adresse d'un blog culinaire, on récupère le contenu et
  on le met en forme.

Chaque recette est ensuite enrichie automatiquement : temps de préparation,
temps de cuisson, coût estimé, saisons, tags (végétarien, rapide, comfort
food…). Une illustration est générée pour reconnaître la recette d'un coup
d'œil. Vous pouvez tout modifier ou remplacer l'image par vos propres
photos.

━━━ Cuisiner ensemble, sans usine à gaz ━━━

• FOYER PARTAGÉ — créez un foyer, recevez un code d'invitation, partagez-le
  à votre famille. Tous les appareils accèdent à la même bibliothèque,
  synchronisée en temps réel.
• AUCUN COMPTE À CRÉER — pas d'e-mail, pas de mot de passe, pas de
  publicité. L'application fonctionne sans inscription traditionnelle.
• MODE DÉMO — vous voulez tester ? Accès direct à une bibliothèque démo,
  zéro friction.

━━━ Retrouvez ce que vous cherchez ━━━

• Accueil par carrousels thématiques : Nouveautés, De saison, Rapide,
  Végétarien, Comfort food, Apéro, Desserts…
• Recherche et filtres : par titre, ingrédient, type de plat, cuisine,
  régime, durée, coût, saison.
• Toggle « De saison » : ne montrer que ce qui se cuisine maintenant.
• Mode lecture optimisé pour cuisiner : grandes polices, étapes scrollables,
  l'écran reste allumé pendant la préparation.

━━━ Gérer son foyer ━━━

• Renommer le foyer, gérer les appareils connectés, quitter ou supprimer le
  foyer en deux tapotements.
• Suppression définitive et complète des données possible à tout moment.

━━━ Confidentialité ━━━

• Pas de profilage publicitaire, pas de pixels de suivi, pas d'identifiant
  publicitaire — jamais.
• Aucune vente de vos données à des tiers.
• Politique de confidentialité : atable.anthonykocken.fr/legal/confidentialite

━━━ Pour qui ? ━━━

Pour les foyers qui veulent rassembler leurs recettes au même endroit sans
ressaisir à la main, et les partager avec leur conjoint·e, leurs enfants,
leurs colocs ou leurs parents. Pour celles et ceux qui aiment cuisiner et
qui en ont assez des apps bourrées de pubs et de paywalls.

À Table est gratuit, sans publicité, sans achat intégré.
```

≈ 2 600 caractères. Beaucoup de mots-clés naturellement intégrés.

---

## 4. Mots-clés ASO (≤ 100 caractères, séparés par virgules, **sans espaces**, **sans répéter le nom**)

**🎯 Choix retenu** (98 car.) :

```
recettes,cuisine,foyer,famille,IA,vocal,photo,OCR,importer,partage,menu,saison,végétarien,rapide
```

Règles :
- Ne pas répéter « À Table » : Apple cherche déjà dans le nom et le sous-titre.
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
| **Privacy Policy URL** | `https://atable.anthonykocken.fr/legal/confidentialite` | ✅ en ligne |
| **Support URL** | `https://atable.anthonykocken.fr/support` | ✅ en ligne |
| **Marketing URL** *(optionnel)* | `https://atable.anthonykocken.fr` | ✅ |

---

## 7. Promotional text (≤ 170 caractères)

> Champ modifiable **sans repasser en review Apple** — utile pour les promos saisonnières.

**🎯 Valeur de départ** (150 car.) :

```
Photographiez une recette, dictez-la ou collez un lien — l'IA structure tout en quelques secondes. Vos recettes en famille, sans compte, sans pub.
```

### Versions saisonnières à garder sous le coude

- **Fêtes** :
  ```
  Les recettes de famille de tout le monde, enfin au même endroit. Importez-les en photo, voix ou lien. Sans compte, sans pub.
  ```
- **Rentrée** :
  ```
  Marre de chercher cette recette du dimanche midi ? À Table la garde, l'enrichit et la partage à votre foyer.
  ```

---

## 8. What's New (notes de version v1.0)

```
Bienvenue dans À Table ! Cette première version vous permet de :
• Importer des recettes en photo, par dictée vocale ou via une URL
• Partager votre bibliothèque en famille via un code d'invitation
• Filtrer vos recettes par saison, type de plat, régime, durée et coût
• Cuisiner depuis votre iPhone avec un mode lecture optimisé

Vos retours sont les bienvenus : kocken.anthony@gmail.com
```

---

## 9. Autres champs ASC à remplir

| Champ | Valeur |
|---|---|
| **Bundle ID** | `fr.anthonykocken.atable` |
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

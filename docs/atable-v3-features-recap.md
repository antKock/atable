# À Table — Récap des besoins fonctionnels

## 1. Enrichissement automatique des recettes par IA

Un seul appel LLM (GPT-4o-mini via API OpenAI) par recette pour extraire :

- **Tags** : sélection parmi une liste de tags prédéfinis
- **Saison** : multi-select parmi Printemps, Été, Automne, Hiver
- **Temps de préparation** : tranche parmi une liste prédéfinie
- **Temps de cuisson** : tranche parmi une liste prédéfinie
- **Complexité** : niveau de difficulté (facile / moyen / difficile)
- **Coût** : estimation parmi 3 niveaux (€, €€, €€€)
- **Prompt image** : description optimisée pour la génération visuelle

Le LLM reçoit le titre + ingrédients + étapes, ainsi que les listes de valeurs possibles (tags, saisons, tranches de prep/cuisson), et retourne un JSON structuré.

**Déclenchement** : asynchrone, **après chaque sauvegarde** de la recette (création et édition). L'utilisateur n'est jamais bloqué — la recette est visible immédiatement, les métadonnées IA apparaissent une fois le traitement terminé. L'utilisateur peut ensuite ajuster manuellement tous les champs enrichis.

## 2. Génération d'images par IA

- API : **DALL-E 3** (via OpenAI), format **1024x1024**
- Style : **flat illustration réaliste** (aplats, ombres douces, style vectoriel propre)
- **Déclenchement** : uniquement à la **création initiale** (post-sauvegarde, même flow asynchrone que l'enrichissement). À l'édition d'une recette, l'image n'est **pas re-générée automatiquement** — uniquement sur action explicite de l'utilisateur (bouton de re-génération)
- Mécanisme de re-génération manuelle si le résultat n'est pas satisfaisant
- Fallback vers un placeholder si pas d'image disponible
- L'utilisateur peut aussi uploader sa propre photo pour remplacer ou compléter l'image générée

### Stratégie de déploiement (enrichissement + images)

1. Implémenter la mécanique complète sur les **nouvelles recettes** uniquement
2. Valider la qualité des résultats sur quelques recettes (ajuster prompt et paramètres si besoin)
3. Une fois satisfait, lancer un **batch sur les recettes existantes** (pour ne payer qu'une fois)

### Prompt image — construction

Le prompt final envoyé à DALL-E 3 est composé de deux parties, toujours en anglais pour de meilleurs résultats :

**Partie 1 — Description du plat** (générée par GPT-4o-mini pour chaque recette)

Instructions système données au LLM :

```
Describe the dish visually in 1-2 English sentences for an image generator.
Mention: the type of container (plate, bowl, glass, cutting board…),
the dominant colors of the ingredients, visible textures,
and the garnish/finishing of the dish.
Never mention brands, people, or text.
```

**Partie 2 — Suffixe de style** (fixe, appendu à chaque prompt)

```
Flat realistic illustration, soft shadows, smooth gradients, clean vector-like style,
warm natural color palette, overhead 3/4 angle view, simple neutral background,
no text, no watermark, no hands, no utensils outside the plate
```

### Exemples de prompts finaux

**Mojito** :
`A tall clear glass filled with a mojito, crushed ice, fresh mint leaves, lime wedges, light green hue with condensation on the glass. Flat realistic illustration, soft shadows, smooth gradients, clean vector-like style, warm natural color palette, overhead 3/4 angle view, simple neutral background, no text, no watermark, no hands, no utensils outside the plate`

**Gratin dauphinois** :
`A golden bubbling potato gratin in a round ceramic baking dish, crispy browned top with melted cheese, creamy layers visible on the side. Flat realistic illustration, soft shadows, smooth gradients, clean vector-like style, warm natural color palette, overhead 3/4 angle view, simple neutral background, no text, no watermark, no hands, no utensils outside the plate`

## 3. Système de tags

- **Liste de tags prédéfinis curatés**, organisés par catégories (les catégories structurent l'autocomplétion côté UI)
- L'IA sélectionne uniquement parmi cette liste prédéfinie — elle ne crée pas de nouveaux tags
- Seul l'utilisateur peut créer ses propres tags personnalisés
- **UX de sélection** : champ avec autocomplétion groupée par catégorie ; les tags sélectionnés s'affichent sous forme de chips/badges visuels
- Disponible à la création et à l'édition d'une recette

### Liste de tags prédéfinis

**Type de plat** : Apéro, Entrée, Plat, Accompagnement, Dessert, Goûter, Petit-déjeuner, Brunch, Boisson, Sauce / Condiment, Pain / Boulange

**Régime alimentaire** : Végétarien, Végan, Sans gluten, Sans lactose, Sans porc, Halal

**Protéine principale** : Bœuf, Poulet, Porc, Agneau, Poisson, Fruits de mer, Œufs, Tofu / Protéines végétales

**Cuisine** : Française, Italienne, Asiatique, Mexicaine, Indienne, Libanaise / Orientale, Américaine, Africaine

**Occasion** : Comfort food, Barbecue, Fêtes, Pique-nique

**Caractéristiques** : Rapide, Batch cooking, Meal prep, One pot, Famille, Recette de base, Épicé

## 3b. Saison (propriété dédiée)

- Champ séparé des tags, **multi-select** : Printemps, Été, Automne, Hiver
- Une recette peut cocher plusieurs saisons (ex : crumble pomme-poire → Automne + Hiver)
- Inféré par le LLM à partir des ingrédients (fraises → été, courge → automne, agrumes → hiver…)
- Côté UI : traitement privilégié avec un **toggle "De saison"** visible en haut des filtres, qui filtre automatiquement sur la saison en cours
- Ajustable manuellement par l'utilisateur

## 4. Temps de préparation & cuisson

Structure standard **prep time + cook time** (schéma mental habituel des utilisateurs, compatible schema.org Recipe pour le SEO), mais exprimés en tranches plutôt qu'en valeurs précises.

**Prep time** : < 10 min, 10-20 min, 20-30 min, 30-45 min, > 45 min

**Cook time** : Aucune, < 15 min, 15-30 min, 30 min - 1h, 1h - 2h, > 2h

- "Aucune" en cuisson couvre les recettes sans cuisson (tartare, salade, ceviche…)
- Le temps total est calculé côté UI en additionnant les bornes, ce qui alimente un filtre de recherche (ex : "recettes de moins de 30 min")
- Le LLM choisit parmi ces tranches, l'utilisateur peut ajuster manuellement

## 5. Coût estimé

Basé sur le coût par personne/portion :

- **€** (économique) : < 5€/personne — ingrédients courants (pâtes, légumineuses, légumes de base…)
- **€€** (modéré) : 5-15€/personne — viandes courantes, poissons, quelques ingrédients spéciaux
- **€€€** (coûteux) : > 15€/personne — fruits de mer, pièces nobles, produits premium (truffe, safran…)

Déterminé par le LLM en fonction des ingrédients, ajustable manuellement par l'utilisateur.

## 6. PWA

- **Manifest.json** : nom, icônes, couleurs, `display: standalone`
- Permet l'ajout à l'écran d'accueil via les mécanismes natifs du navigateur
- Pas de bouton ou guide d'installation custom pour le moment

## 7. Compte démo — isolation des données

- Le compte démo (existant) permet à des visiteurs de tester l'app sans créer de compte
- Les modifications et ajouts de recettes effectués en démo sont **stockés uniquement en local** (côté navigateur)
- Le contenu de référence du compte démo reste intact et identique pour tous les visiteurs
- Chaque session démo est indépendante : les changements d'un visiteur n'impactent pas les autres

---

## Stack technique

| Composant | Choix |
|-----------|-------|
| Frontend / Hosting | Vercel (Next.js) |
| Base de données | Supabase |
| Stockage images | OVH Object Storage (S3-compatible, zéro egress) |
| Domaine | OVH (existant) |
| API IA (enrichissement) | OpenAI — GPT-4o-mini |
| API IA (images) | OpenAI — DALL-E 3 |

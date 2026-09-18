# Conservation 30 jours des images d'import — textes et plan (à relire)

> Décidé par Anthony le 2026-09-18 : conserver 30 jours les images envoyées à l'import photo,
> pour disposer d'un pool de test réel ; **refus possible**, annoncé **explicitement** au moment de
> l'envoi (pas de fenêtre de consentement, pas d'e-mail). Ce document rassemble les textes et le
> plan technique **pour relecture, avant tout code**. Rien n'est actif tant que la politique et les
> déclarations des stores ne sont pas publiées.

## 0. Décisions et périmètre

| Sujet | Choix |
|---|---|
| Quoi | Les **images** de l'import photo (capture, photo de livre, manuscrit). **Pas l'audio** (la promesse « jamais conservé » reste vraie pour la dictée). |
| Durée | 30 jours après l'import, puis suppression automatique. |
| Base légale | Intérêt légitime (améliorer la lecture des recettes), avec **droit d'opposition** mis en avant (RGPD art. 21.4). |
| Refus | Lien dans le panneau d'import photo (avant l'envoi) + réglage dans le profil. Refuser **supprime aussi** les images déjà gardées. |
| Qui | Toutes les personnes, sauf : visiteurs démo, sondes (#26), admin. |
| Où | Bucket OVH **privé** dédié (jamais le bucket public des photos de recettes). |
| Accès | Admin uniquement, par script. Jamais affiché dans l'app, jamais partagé, jamais utilisé pour entraîner un modèle d'un tiers. |

## 1. Textes dans l'app

L'app tutoie ; la politique vouvoie.

### 1.1 Panneau d'import photo (`ScreenshotImporter`, sous la zone de choix des images)

Une ligne discrète, toujours visible tant que la personne n'a pas refusé :

| | FR | EN |
|---|---|---|
| Mention | Tes photos sont gardées 30 jours pour améliorer la lecture des recettes. | Your photos are kept for 30 days to help us read recipes better. |
| Lien | Ne pas les garder | Don't keep them |
| Après un clic (remplace la ligne) | C'est noté : tes photos ne seront pas gardées. Tu peux changer d'avis dans ton profil. | Got it: your photos won't be kept. You can change this in your profile. |

- Le lien porte `data-track="import.photo_pool_optout"` (nouvel identifiant du catalogue #28).
- Une fois le refus enregistré, la ligne disparaît du panneau (plus rien à annoncer).

### 1.2 Profil (`ProfileForm`, section sous l'e-mail de secours)

| | FR | EN |
|---|---|---|
| Libellé de l'interrupteur | Aider à améliorer la lecture des photos | Help improve photo reading |
| Description | Les images que tu envoies pour importer une recette sont gardées 30 jours, puis supprimées. Elles ne servent qu'à tester et améliorer la lecture des recettes, et ne sont jamais partagées. Désactiver supprime aussi celles déjà gardées. | Images you send to import a recipe are kept for 30 days, then deleted. They're only used to test and improve how we read recipes, and are never shared. Turning this off also deletes the ones already kept. |

`data-track="household.photo_pool_toggle"`. Pas de réglage pour les sessions démo (le profil n'existe pas).

## 2. Politique de confidentialité (FR, `content-fr.tsx`)

**§3 Données collectées — puce « Contenu soumis aux fonctions d'import »** : inchangée.

**§4 Finalités — nouvelle ligne du tableau** (après « Contenu soumis aux imports ») :

| Donnée | Finalité | Base légale |
|---|---|---|
| Images d'import photo (conservées 30 jours) | Tester et améliorer la lecture des recettes à partir de photos (comparer des méthodes de lecture, mesurer les erreurs) | Intérêt légitime (qualité du Service). Vous pouvez vous y opposer à tout moment, sans justification (voir section 5). |

**§5 Imports par IA — la puce « Import par photo / capture d'écran » devient :**

> **Import par photo / capture d'écran** : l'image est transmise à OpenAI pour en extraire le texte
> de la recette. **Les images d'import sont conservées 30 jours** par Mijote, dans un espace de
> stockage privé en France, pour tester et améliorer la lecture des recettes, puis supprimées
> automatiquement. Elles ne sont ni publiées, ni partagées, ni utilisées pour entraîner un modèle
> d'un tiers. **Vous pouvez refuser cette conservation** avant l'envoi, depuis l'écran d'import
> (« Ne pas les garder »), ou à tout moment depuis votre profil (« Aider à améliorer la lecture des
> photos ») : les images déjà conservées sont alors supprimées. (Les photos que vous **ajoutez
> délibérément** à une recette sont conservées tant que la recette existe — voir section 8.)

La puce « Import par dictée vocale » ne change pas (« L'enregistrement audio n'est jamais conservé »).

**§6 Sous-traitants — ligne OVHcloud, colonne « Données concernées »** : ajouter « images d'import
(30 jours) ».

**§8 Durées de conservation — nouvelle ligne** :

| Donnée | Durée |
|---|---|
| Images d'import photo | 30 jours après l'import, puis suppression automatique ; supprimées immédiatement si vous refusez la conservation ou si vous supprimez votre profil ou le carnet |

**§12 Vos droits** : ajouter une phrase après la liste des droits :
> Vous pouvez vous opposer à la conservation des images d'import directement depuis l'Application
> (écran d'import photo ou profil), sans avoir à nous écrire.

**Date** : `updatedAt` au jour de la publication.

## 3. Privacy policy (EN, `content-en.tsx`)

**§4 — new row**

| Data | Purpose | Legal basis |
|---|---|---|
| Photo import images (kept for 30 days) | Testing and improving how recipes are read from photos (comparing reading methods, measuring errors) | Legitimate interest (service quality). You can object at any time, without giving a reason (see section 5). |

**§5 — "Photo / screenshot import" becomes:**

> **Photo / screenshot import**: the image is sent to OpenAI to extract the recipe text. **Import
> images are kept for 30 days** by Mijote, in private storage in France, to test and improve how we
> read recipes, then deleted automatically. They are never published, shared, or used to train a
> third party's model. **You can refuse this** before sending, from the import screen ("Don't keep
> them"), or at any time from your profile ("Help improve photo reading"): images already kept are
> then deleted. (Photos you **deliberately add** to a recipe are kept as long as the recipe exists —
> see section 8.)

**§6** OVHcloud row: add "import images (30 days)". **§8** new row: "Photo import images — 30 days
after import, then deleted automatically; deleted immediately if you refuse, or if you delete your
profile or the cookbook." **§12**: "You can object to the retention of import images directly in
the app (photo import screen or profile), without writing to us."

## 4. Déclarations des stores (par Anthony, pas d'API)

### App Store Connect — App Privacy

⚠ **Relire d'abord ce qui est déclaré aujourd'hui** pour « Photos or Videos » (les images partent
déjà chez OpenAI sans être stockées). Réponses proposées :

| Question | Réponse |
|---|---|
| Type de donnée | **User Content › Photos or Videos** |
| Collectée ? | Oui |
| Liée à l'identité ? | **Oui** (rattachée au profil pour pouvoir la supprimer au refus) |
| Utilisée pour le suivi (tracking) ? | Non |
| Finalités | **App Functionality** (l'import lui-même) + **Analytics** (« évaluer l'efficacité des fonctionnalités existantes » : c'est la définition Apple qui colle le mieux au test de la lecture) |

### Google Play — Data safety

| Question | Réponse |
|---|---|
| Photos and videos › Photos | Collectées, **non partagées** (OpenAI et OVH sont des sous-traitants) |
| Traitement éphémère ? | Non (30 jours) |
| Collecte facultative ? | Oui (l'utilisateur peut refuser) |
| Finalités | App functionality, Analytics |
| Suppression sur demande | Oui (dans l'app) |

**Ordre de publication** : politique FR/EN en prod → App Privacy + Data safety mis à jour → puis
seulement activation de la conservation (flag, §5.6). Pas de nouvelle version iOS nécessaire :
tout est côté serveur et web.

## 5. Plan technique

### 5.1 Stockage

- **Bucket OVH privé dédié** `mijote-import-pool` (prod) et `mijote-import-pool-staging` :
  objets **sans ACL public-read** (le bucket des photos est public). Nouvelles variables
  `IMPORT_POOL_BUCKET` (+ mêmes identifiants S3), vérifiées par `env-check`. Hors sauvegardes
  nocturnes (données à durée courte, inutile de les garder dans une sauvegarde de 30+ jours).
- Chemin : `${importId}/${n}.jpg` (JPEG tel que reçu, déjà redimensionné par le client). Aucun
  identifiant de personne dans le chemin.
- Volume estimé : ≈ 40 imports/jour × 1,6 image × 400 Ko ≈ 25 Mo/jour, **≈ 0,8 Go** sur 30 jours.

### 5.2 Base — migration `056_import_pool.sql`

```sql
ALTER TABLE owners ADD COLUMN photo_pool_opt_out boolean NOT NULL DEFAULT false;

CREATE TABLE import_samples (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),   -- = importId, renvoyé au client
  owner_id      uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  household_id  uuid REFERENCES households(id) ON DELETE CASCADE,
  recipe_id     uuid REFERENCES recipes(id) ON DELETE SET NULL, -- rattachée à l'enregistrement
  image_count   int  NOT NULL,
  image_kind    text,                                           -- `kind` de gpt-4o
  extracted     jsonb NOT NULL,                                 -- sortie de l'OCR (comparée à la recette enregistrée)
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT now() + interval '30 days'
);
-- RLS sans policy, service role uniquement (comme 027/051).
```

- Vérité terrain gratuite : `extracted` (ce que l'OCR a lu) contre la **recette enregistrée après
  corrections** (`recipe_id`) — l'écart mesure les erreurs réelles de lecture.
- **Sauvegardes** : les dumps nocturnes de la base sont gardés 14 jours (`mijote-backups`) ; une
  ligne `import_samples` (métadonnées et `extracted`, **pas les images**) peut donc y survivre
  jusqu'à 44 jours. C'est couvert par la ligne « sauvegardes » de la politique (§8) ; à vérifier au
  moment de la publication.
- Numéro : prochain libre au moment du code (056 aujourd'hui ; une autre session travaille en
  parallèle).
- `db:types` régénérés et committés avec la migration (règle CLAUDE.md) ; migration **avant** le
  code (`migrate.mjs … --dry-run` d'abord).

### 5.3 Route `POST /api/recipes/import/screenshot`

Après une extraction réussie, et seulement si : flag actif, owner non démo / non sonde / non admin,
`photo_pool_opt_out = false`, **plafond non atteint** (5 imports gardés par personne et par jour,
pour ne pas avoir un pool fait d'une seule personne) :
1. insérer `import_samples` ;
2. écrire les images dans le bucket privé ;
3. renvoyer `importId` dans la réponse (un identifiant, pas du contenu).

Tout est best-effort : un échec de stockage ne fait **jamais** échouer l'import (log + Sentry).
Journal #28 : prop `pooled: true|false` sur `api.called`.

### 5.4 Rattachement à la recette

Le formulaire pré-rempli garde `importId` et l'envoie avec `POST /api/recipes` ; la route pose
`import_samples.recipe_id` si l'échantillon appartient au même owner.

### 5.5 Refus et suppression

- `POST /api/profile/photo-pool` `{ optOut: boolean }` : met à jour `owners.photo_pool_opt_out` ;
  si `optOut = true`, supprime **immédiatement** les lignes `import_samples` de l'owner et leurs
  objets S3.
- Le lien du panneau appelle la même route, et le panneau relit l'état depuis le contexte owner
  (`OwnerContext` gagne `photoPoolOptOut`).
- Suppression du profil ou du carnet : cascade en base + suppression des objets S3 dans les
  chemins de suppression existants.

### 5.6 Purge et activation

- Cron `demo-reset` (nocturne) : supprime les `import_samples` expirés et leurs objets ; voyant
  « dernière purge » dans la page Santé (même principe que les sauvegardes).
- Flag **`IMPORT_POOL_ENABLED`** : la mention du panneau et la conservation ne s'activent qu'avec
  lui. Rollback = retirer le flag (+ purge manuelle).

### 5.7 Outils

- `scripts/bench/ocr-pool/pull-import-samples.mjs` : télécharge localement (hors git, dossier
  `fixtures/`) les échantillons non expirés + la recette enregistrée comme vérité, au format du
  pool public, pour les passer dans le banc existant. Les copies locales suivent la même règle de
  30 jours (le script purge les siennes).

### 5.8 Tests

- vitest : route (conservation si tout est réuni ; rien pour démo, sonde, admin, refus, plafond,
  flag coupé ; un échec S3 ne casse pas l'import) ; refus = suppression des objets ; purge.
- E2E : le lien « Ne pas les garder » enregistre le refus et fait disparaître la mention ; le
  réglage du profil ; `catalog.test.ts` (nouveaux `data-track`).
- Staging : un import réel sans sonde depuis un compte de test → objet dans le bucket privé
  **non lisible publiquement** (vérifier le 403 sur l'URL directe), puis refus → objet supprimé.

## 6. Point à trancher : interaction avec l'OCR sur l'appareil

Si l'OCR passe sur l'iPhone (Vision + luna), le serveur ne reçoit plus les images que pour les
secours (≈ 14 %) : le pool ne contiendrait **que les cas difficiles**, et plus d'images iOS
« normales ». Deux options :

- **A. Garder ce que le serveur reçoit** (simple, cohérent avec l'argument « tes photos restent
  sur ton téléphone ») : le pool réel se constitue d'ici là (tout passe encore par le serveur
  aujourd'hui) et reste représentatif des cas durs ensuite.
- **B. Échantillonner** : l'app envoie aussi, en tâche de fond, une image sur cinq des imports lus
  sur l'appareil, uniquement si la personne n'a pas refusé. Pool représentatif, mais les photos
  quittent le téléphone même quand ce n'est pas nécessaire.

Recommandation : **A**. La décision n'est à prendre qu'avec l'intégration Vision.

## 7. Ordre de livraison

1. Relecture de ce document (textes, déclarations, plan).
2. Migration 056 + code derrière le flag, sur staging, protocole habituel.
3. Politique FR/EN en prod (texte seulement, flag coupé).
4. Anthony met à jour App Privacy et Data safety.
5. Activation du flag en prod.

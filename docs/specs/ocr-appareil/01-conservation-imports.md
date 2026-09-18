# Conservation 30 jours des envois d'import (photos et dictées) — textes et plan (à relire)

> Décidé par Anthony le 2026-09-18 : conserver 30 jours ce que les personnes envoient pour
> importer une recette — **images** (import photo) et **enregistrements audio** (dictée) — pour
> **diagnostiquer les erreurs** (les reproduire à partir des données d'origine) et **améliorer**
> les imports (pool de test réel). **Refus possible**, annoncé **explicitement** au moment de
> l'envoi (pas de fenêtre de consentement, pas d'e-mail). Ce document rassemble les textes et le
> plan technique **pour relecture, avant tout code**. Rien n'est actif tant que la politique et les
> déclarations des stores ne sont pas publiées.

## 0. Décisions et périmètre

| Sujet | Choix |
|---|---|
| Quoi | Les **images** de l'import photo et les **enregistrements audio** de la dictée, avec ce que l'IA en a tiré (texte lu, transcription, recette extraite) et, en cas d'échec, le code d'erreur. **Pas** l'import par lien (voir §8). |
| Quels imports | **Réussis et en échec** : les échecs sont justement ce qu'on veut reproduire. |
| Durée | 30 jours après l'import, puis suppression automatique. |
| Finalités | 1. Diagnostiquer et corriger les erreurs d'import en les reproduisant ; 2. tester et améliorer la lecture des photos et la transcription. |
| Base légale | Intérêt légitime (qualité du Service), avec **droit d'opposition** mis en avant (RGPD art. 21.4). |
| Refus | Une ligne dans les panneaux photo et dictée (avant l'envoi) + un réglage dans le profil. **Un seul choix** pour les deux. Refuser **supprime aussi** ce qui a déjà été gardé. |
| Qui | Toutes les personnes, sauf : visiteurs démo, sondes (#26), admin. |
| Où | Bucket OVH **privé** dédié (jamais le bucket public des photos de recettes). |
| Accès | Admin uniquement, par script. Jamais affiché dans l'app, jamais partagé, jamais utilisé pour entraîner un modèle d'un tiers. |

## 1. Textes dans l'app

L'app tutoie ; la politique vouvoie.

### 1.1 Panneau d'import photo (`ScreenshotImporter`, sous la zone de choix des images)

| | FR | EN |
|---|---|---|
| Mention | Tes photos sont gardées 30 jours pour corriger et améliorer les imports. | Your photos are kept for 30 days so we can fix and improve imports. |
| Lien | Ne pas les garder | Don't keep them |
| Après un clic | C'est noté : on ne gardera ni tes photos ni tes dictées. Tu peux changer d'avis dans ton profil. | Got it: we won't keep your photos or dictations. You can change this in your profile. |

### 1.2 Panneau de dictée (`VoiceImporter`, sous « 3 minutes max »)

| | FR | EN |
|---|---|---|
| Mention | Ta dictée est gardée 30 jours pour corriger et améliorer les imports. | Your dictation is kept for 30 days so we can fix and improve imports. |
| Lien | Ne pas la garder | Don't keep it |
| Après un clic | (même message qu'en 1.1) | (same as 1.1) |

- Liens : `data-track="import.pool_optout"` (nouvel identifiant du catalogue #28, un seul pour les
  deux panneaux : le panneau parent donne déjà la méthode).
- Une fois le refus enregistré, la ligne disparaît des deux panneaux.

### 1.3 Profil (`ProfileForm`, section sous l'e-mail de secours)

| | FR | EN |
|---|---|---|
| Libellé de l'interrupteur | Aider à améliorer les imports | Help improve imports |
| Description | Les photos et les dictées que tu envoies pour importer une recette sont gardées 30 jours, puis supprimées. Elles servent uniquement à corriger les erreurs et à améliorer les imports, et ne sont jamais partagées. Désactiver supprime aussi celles déjà gardées. | Photos and dictations you send to import a recipe are kept for 30 days, then deleted. They're only used to fix errors and improve imports, and are never shared. Turning this off also deletes the ones already kept. |

`data-track="household.import_pool_toggle"`. Pas de réglage pour les sessions démo (le profil
n'existe pas).

## 2. Politique de confidentialité (FR, `content-fr.tsx`)

**§3 Données collectées — puce « Contenu soumis aux fonctions d'import »** : inchangée.

**§4 Finalités — nouvelle ligne du tableau** (après « Contenu soumis aux imports ») :

| Donnée | Finalité | Base légale |
|---|---|---|
| Photos et enregistrements vocaux d'import, et ce qui en a été extrait (conservés 30 jours) | Diagnostiquer et corriger les erreurs d'import en les reproduisant ; tester et améliorer la lecture des photos et la transcription | Intérêt légitime (qualité du Service). Vous pouvez vous y opposer à tout moment, sans justification (voir section 5). |

**§5 Imports par IA — les deux premières puces deviennent :**

> **Import par dictée vocale** : l'enregistrement audio est transmis à OpenAI pour transcription,
> puis le texte obtenu est structuré.
>
> **Import par photo / capture d'écran** : l'image est transmise à OpenAI pour en extraire le texte
> de la recette.

**Et un paragraphe est ajouté après la liste :**

> **Conservation des envois d'import.** Les photos et enregistrements vocaux que vous envoyez pour
> importer une recette sont **conservés 30 jours** par Mijote, avec ce qui en a été extrait, dans
> un espace de stockage privé en France, puis supprimés automatiquement. Ils servent uniquement à
> diagnostiquer et corriger les erreurs d'import (en les reproduisant) et à améliorer la lecture
> des photos et la transcription. Ils ne sont ni publiés, ni partagés, ni utilisés pour entraîner
> un modèle d'un tiers. **Vous pouvez refuser cette conservation** avant l'envoi, depuis l'écran
> d'import (« Ne pas les garder »), ou à tout moment depuis votre profil (« Aider à améliorer les
> imports ») : ce qui a déjà été conservé est alors supprimé. Les photos que vous **ajoutez
> délibérément** à une recette sont, elles, conservées tant que la recette existe (voir section 8).

La puce « Import par lien URL » ne change pas.

**§6 Sous-traitants — ligne OVHcloud, colonne « Données concernées »** : ajouter « envois d'import
(photos et enregistrements vocaux, 30 jours) ».

**§8 Durées de conservation — nouvelle ligne** :

| Donnée | Durée |
|---|---|
| Photos et enregistrements vocaux d'import | 30 jours après l'import, puis suppression automatique ; supprimés immédiatement si vous refusez la conservation ou si vous supprimez votre profil ou le carnet |

**§12 Vos droits** : ajouter une phrase après la liste des droits :
> Vous pouvez vous opposer à la conservation des envois d'import directement depuis l'Application
> (écrans d'import ou profil), sans avoir à nous écrire.

**Date** : `updatedAt` au jour de la publication.

## 3. Privacy policy (EN, `content-en.tsx`)

**§4 — new row**

| Data | Purpose | Legal basis |
|---|---|---|
| Import photos and voice recordings, and what was extracted from them (kept for 30 days) | Diagnosing and fixing import errors by reproducing them; testing and improving photo reading and transcription | Legitimate interest (service quality). You can object at any time, without giving a reason (see section 5). |

**§5 — the first two bullets become:**

> **Voice dictation import**: the audio recording is sent to OpenAI for transcription, then the
> resulting text is structured.
>
> **Photo / screenshot import**: the image is sent to OpenAI to extract the recipe text.

**New paragraph after the list:**

> **Retention of import submissions.** Photos and voice recordings you send to import a recipe are
> **kept for 30 days** by Mijote, together with what was extracted from them, in private storage in
> France, then deleted automatically. They are only used to diagnose and fix import errors (by
> reproducing them) and to improve photo reading and transcription. They are never published,
> shared, or used to train a third party's model. **You can refuse this** before sending, from the
> import screen ("Don't keep them"), or at any time from your profile ("Help improve imports"):
> anything already kept is then deleted. Photos you **deliberately add** to a recipe are kept as
> long as the recipe exists (see section 8).

**§6** OVHcloud row: add "import submissions (photos and voice recordings, 30 days)". **§8** new
row: "Import photos and voice recordings — 30 days after import, then deleted automatically;
deleted immediately if you refuse, or if you delete your profile or the cookbook." **§12**: "You
can object to the retention of import submissions directly in the app (import screens or
profile), without writing to us."

## 4. Déclarations des stores (par Anthony, pas d'API)

### App Store Connect — App Privacy

⚠ **Relire d'abord ce qui est déclaré aujourd'hui** pour « Photos or Videos » et « Audio Data »
(les deux partent déjà chez OpenAI sans être stockés). Réponses proposées, **pour chacun des deux
types** :

| Question | Réponse |
|---|---|
| Types de données | **User Content › Photos or Videos** et **User Content › Audio Data** |
| Collectées ? | Oui |
| Liées à l'identité ? | **Oui** (rattachées au profil pour pouvoir les supprimer au refus) |
| Utilisées pour le suivi (tracking) ? | Non |
| Finalités | **App Functionality** (l'import lui-même, et la correction de ses erreurs) + **Analytics** (« évaluer l'efficacité des fonctionnalités existantes » : la définition Apple qui colle le mieux au test des imports) |

### Google Play — Data safety

| Question | Réponse |
|---|---|
| Photos and videos › Photos ; Audio › Voice or sound recordings | Collectées, **non partagées** (OpenAI et OVH sont des sous-traitants) |
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
  objets **sans ACL public-read** (le bucket des photos est public). Nouvelle variable
  `IMPORT_POOL_BUCKET` (+ mêmes identifiants S3), vérifiée par `env-check`. Le bucket n'est pas
  sauvegardé (données à durée courte).
- Chemins : `${sampleId}/${n}.jpg` (photo, JPEG tel que reçu, déjà redimensionné par le client) ou
  `${sampleId}/audio.${ext}` (dictée, fichier tel que reçu : webm, mp4, ogg). Aucun identifiant de
  personne dans le chemin.
- Volume estimé sur 30 jours : photos ≈ 40 imports/jour × 1,6 image × 400 Ko ≈ **0,8 Go** ;
  dictées ≈ 5/jour × 1 Mo ≈ **0,15 Go**.

### 5.2 Base — migration `056_import_samples.sql`

```sql
ALTER TABLE owners ADD COLUMN import_pool_opt_out boolean NOT NULL DEFAULT false;

CREATE TABLE import_samples (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),   -- sampleId, renvoyé au client
  owner_id      uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  household_id  uuid REFERENCES households(id) ON DELETE CASCADE,
  recipe_id     uuid REFERENCES recipes(id) ON DELETE SET NULL, -- rattaché à l'enregistrement
  method        text NOT NULL CHECK (method IN ('photo', 'voice')),
  file_count    int  NOT NULL,
  status        int  NOT NULL,                                  -- statut HTTP de l'import
  error_code    text,                                           -- EXTRACTION_FAILED, TRANSCRIPTION_FAILED…
  image_kind    text,                                           -- photo : `kind` de gpt-4o
  transcript    text,                                           -- dictée : transcription brute
  extracted     jsonb,                                          -- recette extraite (null en échec)
  model         text,                                           -- modèle utilisé, pour rejouer à l'identique
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT now() + interval '30 days'
);
CREATE INDEX import_samples_expires_idx ON import_samples (expires_at);
CREATE INDEX import_samples_owner_idx ON import_samples (owner_id);
-- RLS sans policy, service role uniquement (comme 027/051).
```

- **Diagnostic** : pour une erreur vue dans Sentry ou dans `/admin/parcours`, `sampleId` relie
  l'erreur aux données d'origine (voir §5.3) ; on rejoue avec le même modèle. Pour la dictée, la
  transcription gardée permet de savoir si l'erreur vient de la transcription ou de la
  structuration.
- **Vérité terrain gratuite** : `extracted` contre la **recette enregistrée après corrections**
  (`recipe_id`) — l'écart mesure les vraies erreurs d'import.
- **Sauvegardes** : les dumps nocturnes de la base sont gardés 14 jours (`mijote-backups`) ; une
  ligne `import_samples` (transcription et recette extraite, **pas les fichiers**) peut donc y
  survivre jusqu'à 44 jours. C'est couvert par la mention des sauvegardes dans la politique (§6) ;
  à relire au moment de la publication.
- Numéro : prochain libre au moment du code (056 aujourd'hui ; une autre session travaille en
  parallèle). `db:types` régénérés et committés avec la migration (règle CLAUDE.md) ; migration
  **avant** le code (`migrate.mjs … --dry-run` d'abord).

### 5.3 Routes d'import photo et dictée

Après l'extraction, **réussie ou en échec** (hors 400 de validation et 429 de quota : rien n'a été
traité), et seulement si : flag actif, owner non démo / non sonde / non admin,
`import_pool_opt_out = false`, **plafond non atteint** (10 envois gardés par personne et par jour,
pour ne pas avoir un pool fait d'une seule personne ; les échecs passent toujours) :
1. insérer `import_samples` ;
2. écrire les fichiers dans le bucket privé ;
3. renvoyer `sampleId` dans la réponse (un identifiant, pas du contenu) ;
4. poser `sample_id` sur `api.called` (journal #28 : un identifiant, autorisé) et en tag Sentry
   si l'import a échoué.

Tout est best-effort : un échec de stockage ne fait **jamais** échouer l'import (log + Sentry).
`extractRecipeFromVoice` renvoie aussi la transcription (comme `imageKind` pour la photo), sans
l'exposer au client.

### 5.4 Rattachement à la recette

Le formulaire pré-rempli garde `sampleId` et l'envoie avec `POST /api/recipes` ; la route pose
`import_samples.recipe_id` si l'échantillon appartient au même owner.

### 5.5 Refus et suppression

- `POST /api/profile/import-pool` `{ optOut: boolean }` : met à jour
  `owners.import_pool_opt_out` ; si `optOut = true`, supprime **immédiatement** les lignes
  `import_samples` de l'owner et leurs fichiers.
- Les liens des panneaux appellent la même route ; les panneaux lisent l'état depuis le contexte
  owner (`OwnerContext` gagne `importPoolOptOut`).
- Suppression du profil ou du carnet : cascade en base + suppression des fichiers dans les chemins
  de suppression existants.

### 5.6 Purge et activation

- Cron `demo-reset` (nocturne) : supprime les `import_samples` expirés et leurs fichiers ; voyant
  « dernière purge » dans la page Santé (même principe que les sauvegardes).
- Flag **`IMPORT_POOL_ENABLED`** : les mentions des panneaux et la conservation ne s'activent
  qu'avec lui. Rollback = retirer le flag (+ purge manuelle).

### 5.7 Outils

- `scripts/import-samples/pull.mjs prod|staging [--id=…] [--errors] [--method=photo|voice]` :
  télécharge localement (hors git) les échantillons non expirés ; au format du pool public pour les
  passer dans le banc (`scripts/bench/`), ou un seul échantillon (`--id`) pour reproduire une
  erreur. Les copies locales suivent la même règle de 30 jours (le script purge les siennes).
- `scripts/import-samples/replay.mjs <sampleId>` : rejoue l'import avec le code actuel et compare
  au résultat d'origine.

### 5.8 Tests

- vitest : routes photo et dictée (conservation en succès **et** en échec ; rien pour démo, sonde,
  admin, refus, plafond, flag coupé, 400/429 ; un échec S3 ne casse pas l'import ; `sampleId`
  jamais accompagné de contenu dans la réponse) ; refus = suppression des fichiers ; purge.
- E2E : le lien « Ne pas les garder » enregistre le refus et fait disparaître les deux mentions ;
  le réglage du profil ; `catalog.test.ts` (nouveaux `data-track`).
- Staging : un import photo et une dictée réels sans sonde depuis un compte de test → fichiers
  dans le bucket privé **non lisibles publiquement** (403 sur l'URL directe), puis refus → fichiers
  supprimés.

## 6. Point à trancher plus tard : interaction avec l'OCR sur l'appareil

Si l'OCR passe sur l'iPhone (Vision + luna), le serveur ne reçoit plus les images que pour les
secours (≈ 14 %) : le pool photo ne contiendrait **que les cas difficiles**. Deux options :

- **A. Garder ce que le serveur reçoit**, plus le **texte lu par Vision** (c'est lui qui part au
  serveur, et c'est ce qu'il faut pour reproduire une erreur de structuration) ;
- **B. Échantillonner** : l'app envoie aussi, en tâche de fond, une image sur cinq des imports lus
  sur l'appareil, sauf refus. Pool représentatif, mais des photos quittent le téléphone sans
  nécessité.

Recommandation : **A**. À décider avec l'intégration Vision.

## 7. Ordre de livraison

1. Relecture de ce document (textes, déclarations, plan).
2. Migration + code derrière le flag, sur staging, protocole habituel.
3. Politique FR/EN en prod (texte seulement, flag coupé).
4. Anthony met à jour App Privacy et Data safety.
5. Activation du flag en prod.

## 8. Question ouverte : l'import par lien

La même logique de diagnostic vaudrait pour l'import par lien (garder l'adresse et le texte de
la page pour reproduire un échec sur un site donné). Aujourd'hui la politique promet que
« l'adresse URL et le contenu brut de la page ne sont pas conservés ». Non inclus ici, faute de
décision ; si on l'ajoute, c'est le même mécanisme (même refus, même durée), sans nouvelle
déclaration dans les stores (une adresse web publique n'est pas une donnée personnelle au sens
des stores).

# Conservation 30 jours des envois d'import — décisions, textes et plan

> Décidé par Anthony le 2026-09-18 : conserver 30 jours **tout ce que les personnes envoient pour
> importer une recette** — images (photo), enregistrements audio (dictée), liens et texte des pages
> (URL, Instagram compris) — pour **diagnostiquer les erreurs** (les reproduire à partir des
> données d'origine) et **améliorer** les imports (pool de test réel). **Refus possible**, annoncé
> **explicitement** par une mention unique sur l'écran d'import (pas de fenêtre de consentement,
> pas d'e-mail).
>
> **Livraison en deux voies** (décision Anthony) :
> - **politique de confidentialité** : par `staging` → prod, comme d'habitude (fait, `1c03ceb`) ;
> - **code de la fonctionnalité** : sur la **branche dédiée `imports-next`** (worktree séparé),
>   partagée avec l'étape 2 du chantier Instagram (extension iOS), pour ne pas bloquer le canal
>   `staging` → prod pendant le développement. Fusion dans `staging` quand tout est prêt.

## 0. Décisions et périmètre

| Sujet | Choix |
|---|---|
| Quoi | Photo : les **images**. Dictée : l'**enregistrement audio** + la transcription. Lien : l'**adresse** + le **texte récupéré** (page nettoyée, légende Instagram, rendu du crawler) + la voie utilisée. Dans les trois cas : la recette extraite et, en échec, le code d'erreur. |
| Quels imports | **Réussis et en échec** : les échecs sont ce qu'on veut reproduire. Pas les 400 de validation ni les 429 de quota (rien n'a été traité). |
| Durée | 30 jours après l'import, puis suppression automatique. |
| Finalités | 1. Diagnostiquer et corriger les erreurs d'import en les reproduisant ; 2. tester et améliorer les imports. |
| Base légale | Intérêt légitime (qualité du Service), **droit d'opposition** mis en avant (RGPD art. 21.4). |
| Refus | **Une mention générale sur l'écran d'import** (vue avant tout envoi, quelle que soit la méthode) + un réglage dans le profil. Refuser **supprime aussi** ce qui a déjà été gardé. |
| Plafond | 100 envois gardés par personne et par jour (garde-fou contre un abus ; les échecs passent toujours). Le rééquilibrage entre personnes se fait à l'utilisation. |
| Qui | Toutes les personnes, sauf : visiteurs démo, sondes (#26), admin. |
| Où | Bucket OVH **privé** dédié (jamais le bucket public des photos de recettes). |
| Accès | Admin uniquement, par script. Jamais affiché dans l'app, jamais partagé, jamais utilisé pour entraîner un modèle d'un tiers. |

## 1. Textes dans l'app

L'app tutoie ; la politique vouvoie.

### 1.1 Écran d'import (`ImportSelector`, `/recipes/new`, sous les méthodes)

Une ligne discrète, visible tant que la personne n'a pas refusé :

| | FR | EN |
|---|---|---|
| Mention | Ce que tu envoies pour importer une recette est gardé 30 jours pour corriger et améliorer les imports. | What you send to import a recipe is kept for 30 days so we can fix and improve imports. |
| Lien | Ne pas les garder | Don't keep them |
| Après un clic (remplace la ligne) | C'est noté : on ne gardera pas tes envois. Tu peux changer d'avis dans ton profil. | Got it: we won't keep what you send. You can change this in your profile. |

Lien : `data-track="import.pool_optout"` (nouvel identifiant du catalogue #28).

**Import lancé automatiquement** (extension de partage iOS, `/recipes/new?import=url&url=…&ext=1`,
et tout lien profond du même type) : l'écran d'import n'est **jamais affiché**, l'import part au
chargement. La mention s'affiche alors **sur le formulaire pré-rempli**, au même format ; « Ne pas
les garder » enregistre le refus **et supprime l'envoi qui vient d'être gardé** (`sampleId`
connu). Rien à changer côté natif.

### 1.2 Profil (`ProfileForm`, section sous l'e-mail de secours)

| | FR | EN |
|---|---|---|
| Libellé de l'interrupteur | Aider à améliorer les imports | Help improve imports |
| Description | Les photos, dictées et liens que tu envoies pour importer une recette sont gardés 30 jours, puis supprimés. Ils servent uniquement à corriger les erreurs et à améliorer les imports, et ne sont jamais partagés. Désactiver supprime aussi ceux déjà gardés. | Photos, dictations and links you send to import a recipe are kept for 30 days, then deleted. They're only used to fix errors and improve imports, and are never shared. Turning this off also deletes the ones already kept. |

`data-track="household.import_pool_toggle"`. Pas de réglage pour les sessions démo (le profil
n'existe pas).

## 2. Politique de confidentialité — **faite** (`1c03ceb`, sur staging)

FR et EN, date au 18/09 :
- §4 finalités : nouvelle ligne « Envois d'import … conservés 30 jours » (intérêt légitime,
  opposition possible) ;
- §5 : les trois promesses « jamais conservé / pas conservé » (dictée, photo, lien) sont retirées
  au profit d'un paragraphe **« Conservation des envois d'import »** (30 jours, stockage privé en
  France, diagnostic et amélioration, jamais partagé ni utilisé pour entraîner un modèle tiers,
  refus depuis l'écran d'import ou le profil) ;
- §6 OVHcloud : « envois d'import (30 jours) » ;
- §8 durées : « Envois d'import — 30 jours » et **« Sauvegardes de la base de données — 14 jours »** ;
- §12 droits : l'opposition se fait directement dans l'app.

⚠ **Fenêtre de décalage** : si la politique part en prod avant la fonctionnalité, elle annonce une
conservation et des réglages qui n'existent pas encore. C'est sans risque (on fait moins que ce
qu'on annonce) ; à défaut, promouvoir la politique avec la fusion de `imports-next`.

## 3. Déclarations des stores (par Anthony, pas d'API)

### App Store Connect — App Privacy

⚠ **Relire d'abord ce qui est déclaré aujourd'hui.** Réponses proposées :

| Question | Réponse |
|---|---|
| Types de données | **User Content › Photos or Videos** et **User Content › Audio Data**. Les liens : pas de catégorie adaptée (une adresse publique choisie par la personne n'est pas un « historique de navigation ») → rien à déclarer, à confirmer à la lecture du formulaire. |
| Collectées ? | Oui |
| Liées à l'identité ? | **Oui** (rattachées au profil pour pouvoir les supprimer au refus) |
| Utilisées pour le suivi (tracking) ? | Non |
| Finalités | **App Functionality** (l'import et la correction de ses erreurs) + **Analytics** (« évaluer l'efficacité des fonctionnalités existantes ») |

### Google Play — Data safety

| Question | Réponse |
|---|---|
| Photos and videos › Photos ; Audio › Voice or sound recordings | Collectées, **non partagées** (OpenAI et OVH sont des sous-traitants) |
| Traitement éphémère ? | Non (30 jours) |
| Collecte facultative ? | Oui (l'utilisateur peut refuser) |
| Finalités | App functionality, Analytics |
| Suppression sur demande | Oui (dans l'app) |

Pas de nouvelle version iOS nécessaire : tout est côté serveur et web.

## 4. Plan technique (branche `imports-next`)

### 4.1 Stockage

- **Bucket OVH privé dédié** `mijote-import-pool` (prod) et `mijote-import-pool-staging` : objets
  **sans ACL public-read**. Variable `IMPORT_POOL_BUCKET` (+ identifiants S3 existants), vérifiée
  par `env-check`. Le bucket n'est pas sauvegardé (données à durée courte).
- Chemins (aucun identifiant de personne) : `${sampleId}/${n}.jpg` (photo, tel que reçu),
  `${sampleId}/audio.${ext}` (dictée, tel que reçu), `${sampleId}/page.txt` (lien : texte
  récupéré, tel que passé au modèle).
- Volume estimé sur 30 jours : photos ≈ 0,8 Go, dictées ≈ 0,15 Go, liens ≈ 0,1 Go.
- **Harnais local / E2E** : pas d'OVH → pilote de repli sur Supabase Storage local (bucket privé
  créé par `e2e-setup`), comme pour les photos.

### 4.2 Base — migration (prochain numéro libre)

```sql
ALTER TABLE owners ADD COLUMN import_pool_opt_out boolean NOT NULL DEFAULT false;

CREATE TABLE import_samples (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),   -- sampleId, renvoyé au client
  owner_id      uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  household_id  uuid REFERENCES households(id) ON DELETE CASCADE,
  recipe_id     uuid REFERENCES recipes(id) ON DELETE SET NULL, -- rattaché à l'enregistrement
  method        text NOT NULL CHECK (method IN ('photo', 'voice', 'url')),
  file_count    int  NOT NULL DEFAULT 0,
  status        int  NOT NULL,                                  -- statut HTTP de l'import
  error_code    text,                                           -- EXTRACTION_FAILED, TRANSCRIPTION_FAILED, SITE_BLOCKED…
  url           text,                                           -- lien : adresse importée
  path          text,                                           -- lien : voie (direct, crawler, instagram…)
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

- **Diagnostic** : `sampleId` relie une erreur (Sentry, `/admin/parcours`) aux données d'origine ;
  on rejoue avec le même modèle. Dictée : la transcription dit si l'erreur vient de la
  transcription ou de la structuration. Lien : le texte gardé dit si l'erreur vient de la lecture
  de la page ou de la structuration.
- **Vérité terrain gratuite** : `extracted` contre la **recette enregistrée après corrections**.
- **Sauvegardes** : une ligne peut survivre 14 jours de plus dans les dumps de la base (pas les
  fichiers) — c'est ce que dit maintenant la politique (§8).
- `db:types` régénérés et committés avec la migration ; migration appliquée **avant** le code
  (`migrate.mjs … --dry-run` d'abord), au moment de la fusion.

### 4.3 Routes d'import (photo, dictée, lien)

Après l'extraction, réussie ou en échec, si : flag actif, owner non démo / non sonde / non admin,
`import_pool_opt_out = false`, plafond non atteint (les échecs passent toujours) :
1. insérer `import_samples` ;
2. écrire les fichiers dans le bucket privé ;
3. renvoyer `sampleId` dans la réponse (un identifiant, pas du contenu) ;
4. poser `sample_id` sur `api.called` (journal #28) et en tag Sentry si l'import a échoué.

Best-effort : un échec de stockage ne fait **jamais** échouer l'import (log + Sentry).
`extractRecipeFromVoice` / `extractRecipeFromUrl` renvoient aussi ce qu'il faut garder
(transcription, texte et voie), sans l'exposer au client — même principe que `imageKind`.

### 4.4 Rattachement à la recette

Le formulaire pré-rempli garde `sampleId` et l'envoie avec `POST /api/recipes` ; la route pose
`import_samples.recipe_id` si l'échantillon appartient au même owner.

### 4.5 Refus et suppression

- `POST /api/profile/import-pool` `{ optOut: boolean }` : met à jour `owners.import_pool_opt_out` ;
  si `optOut = true`, supprime **immédiatement** les lignes et les fichiers de l'owner.
- La mention de l'écran d'import appelle la même route ; l'état vient du contexte owner
  (`OwnerContext.importPoolOptOut`).
- Suppression du profil ou du carnet : cascade en base + suppression des fichiers.

### 4.6 Purge et activation

- Cron `demo-reset` (nocturne) : supprime les échantillons expirés et leurs fichiers ; voyant
  « dernière purge » dans la page Santé.
- Flag **`IMPORT_POOL_ENABLED`** : la mention et la conservation ne s'activent qu'avec lui.
  Rollback = retirer le flag (+ purge manuelle).

### 4.7 Outils

- `scripts/import-samples/pull.mjs prod|staging [--id=…] [--errors] [--method=…]
  [--max-per-owner=N]` : télécharge localement (hors git) les échantillons non expirés — au format
  du pool du banc, ou un seul (`--id`) pour reproduire une erreur. Les copies locales suivent la
  même règle de 30 jours.
- `scripts/import-samples/replay.mjs <sampleId>` : rejoue l'import avec le code actuel et compare.

### 4.8 Tests

- vitest : trois routes (succès **et** échec gardés ; rien pour démo, sonde, admin, refus, plafond,
  flag coupé, 400/429 ; échec S3 sans effet sur l'import ; réponse sans contenu en plus de
  `sampleId`) ; refus = suppression ; purge ; rattachement à la recette.
- E2E : la mention et son lien (refus enregistré, mention disparue) ; le réglage du profil ;
  `catalog.test.ts`.
- Staging (après fusion) : un import de chaque méthode sans sonde depuis un compte de test →
  fichiers dans le bucket privé **non lisibles publiquement** (403 sur l'URL directe) ; refus →
  fichiers supprimés.

## 5. Interaction avec l'OCR sur l'appareil (à décider avec l'intégration Vision)

Si l'OCR passe sur l'iPhone, le serveur ne reçoit plus les images que pour les secours (≈ 14 %).
Recommandation : **garder ce que le serveur reçoit, plus le texte lu par Vision** (c'est lui qui
part au serveur, et il suffit à reproduire une erreur de structuration) plutôt que d'envoyer des
images en plus.

## 6. Ordre de livraison

1. Politique FR/EN sur `staging` (fait), promotion en prod au go d'Anthony.
2. Branche `imports-next` : migration + code derrière le flag, vérifiés sur la stack locale.
3. Création des buckets privés (prod + staging) et des variables Dokploy.
4. Fusion dans `staging` → migration staging → contrôles réels → promotion.
5. Anthony met à jour App Privacy et Data safety.
6. Activation du flag en prod.

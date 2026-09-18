# Chantier « Instagram sans Apify » — Socle

> Cadré par Anthony le 2026-09-18. Étape 1 sur staging le 2026-09-18 (f50303d), go prod
> en attente. Étape 2 : conception ci-dessous, **pas de code Swift avant accord**. En cas
> d'écart doc ↔ code, le code fait foi.

## 0. Pourquoi

L'import Instagram passait **uniquement** par Apify (`apify/instagram-reel-scraper`), avec un
compte en plan FREE (5 $ de crédit par mois). Crédit épuisé = import Instagram cassé. Or la
légende (seule chose qu'on utilise, la transcription est désactivée) est lisible sans connexion
sur deux pages publiques d'Instagram.

## 1. Étape 1 — lecture directe par le serveur (livrée sur staging)

### Chaîne (`src/lib/import.ts` → `readInstagramCaption`)

1. **Cache** Redis `ig:caption:{code}`, 24 h (`src/lib/instagram-cache.ts`) : un reel importé
   par plusieurs personnes n'est lu qu'une fois. Contenu public uniquement, sans lien avec la
   personne. Best-effort : si Redis est en panne, l'import se fait sans cache.
2. **Page embed** `/p/{code}/embed/captioned/` → `.Caption` (retours à la ligne conservés).
3. **Page du reel** `/reel/{code}/` → `og:description`, préfixe « N likes, N comments - compte
   on date: » retiré.
4. **Apify** (inchangé) si les deux pages échouent : statut ≠ 200, redirection (mur de
   connexion), légende absente ou < 20 caractères.
5. Sinon, l'erreur actuelle (`SITE_UNREACHABLE` / `EXTRACTION_FAILED`, codes inchangés). Une
   légende directe courte sert de dernier recours si Apify échoue aussi.

`src/lib/instagram.ts` : formats `/p/`, `/reel/`, `/reels/`, `/tv/`, `/{compte}/reel|p/`,
`instagr.am`, paramètres ignorés (`igsh`, `utm_*`), liens courts `/share/…` (la redirection est
lue sans être suivie). User-agent Safari iPhone, 5 s par page, hôtes fixes (l'URL fournie n'est
jamais rechargée telle quelle).

### Mesure et alertes

- Journal (#28) : `api.called` de `/api/recipes/import/url` + `ig_path` (`direct_embed` |
  `direct_og` | `apify` | `cache` | `failed`), `ig_fallback` (raisons par page :
  `http_429/login_wall`…), `ig_read_ms`. Lecture : `scripts/events/queries/instagram-paths.sql`.
  Log serveur `[import/instagram] path=… read_ms=…` (visible même pour les sondes, qui ne sont
  pas journalisées).
- **Alerte immédiate (Sentry)** : 3 lectures directes abandonnées d'affilée (un succès remet
  le compteur à zéro) → `captureMessage` niveau `error`, au plus une fois toutes les 10 min
  par conteneur. L'empreinte `instagram-direct-blocked` + **jour** crée une issue neuve par
  jour de panne : les issues ne sont jamais résolues, et la seule règle d'alerte n'envoie
  d'e-mail que pour une issue nouvelle ou existante de **haute priorité** (un `warning`
  resterait muet).
- Santé (`/admin/sante`, `/api/admin/health`, veilleur #27 → Sentry une fois par jour) :
  - **Instagram** : rouge si plus de 30 % des lectures (hors cache) passent au secours ou
    échouent sur 24 h, à partir de 5 lectures ;
  - **Crédit Apify** : rouge au-delà de 80 % du plafond mensuel (`GET /v2/users/me/limits`).
    Alerté par la prod seule (le compte est le même pour les deux environnements).
- Coûts : une ligne `ai_costs` Apify **seulement** quand Apify est appelé, à 0 $
  (`APIFY_PRICING` = 0, plan gratuit). La ligne luna `import_instagram` ne change pas.

### Vérifié le 2026-09-18

| | Lecture de la légende | Import complet |
|---|---|---|
| Lecture directe depuis le Mac (Node), 6 reels | 0,4 à 0,8 s, 6/6 par la page embed | — |
| Lecture directe depuis le VPS (staging, sondes), 6 reels + 3 formats d'URL | 0,6 à 1,2 s, 6/6 par la page embed ; doublons servis par le cache en 9 ms | 1,7 à 3,3 s, 8/8 réussis |
| Apify, mêmes reels | **64 s** (démarrage à froid, au-delà du budget de 55 s) puis 10 s | — |

Les og:description et embed donnent **exactement** le même texte sur les 3 reels de référence
(test `instagram.test.ts`). Le journal local a bien reçu `ig_path` / `ig_fallback` /
`ig_read_ms` (voies `direct_embed`, `cache`, `failed`/`unsupported_url`).

L'extension de partage iOS en profite **sans nouvelle version** : elle charge
`/recipes/new?import=url&url=…&ext=1`, dont la page appelle la même route
`/api/recipes/import/url` (`ImportSelector.tsx`).

## 2. Étape 2 — lecture depuis le téléphone dans l'extension (conception)

### 2.1 Vérification préalable : ce qu'Instagram met dans le partage

**Pas encore faite** : il faut un iPhone réel avec Instagram (pas d'Instagram dans le
simulateur), et les logs Traefik ne gardent pas les chargements `?ext=1`. Test **sans code,
en 2 minutes**, avec l'app Raccourcis :

1. Raccourcis → nouveau raccourci → *Afficher dans la feuille de partage* (types : tout).
2. Actions : *Obtenir le type de* « Entrée du raccourci », *Afficher le résultat* ; puis une
   seconde fois *Afficher le résultat* sur « Entrée du raccourci » elle-même.
3. Dans Instagram, sur un reel : Partager → … → le raccourci. Noter les types (URL ? texte ?)
   et le contenu (le lien seul, ou la légende ?).

Si la légende y est, l'extension n'a rien à télécharger : elle transmet le texte (même
mécanisme que ci-dessous, sans le téléchargement). À ma connaissance, Instagram ne partage
que le lien (`/reel/{code}/?igsh=…`, parfois sous forme de texte, d'où le repli texte déjà
présent dans `ShareViewController.swift`), mais c'est à confirmer.

### 2.2 Mécanisme proposé

```
Extension (Swift)                        Serveur
─────────────────                        ───────
URL partagée ─┬─► charge /recipes/new?import=url&url=…&ext=1&igref=R   (tout de suite, écran inchangé)
              │
              └─► (en parallèle) si lien Instagram :
                  URLSession éphémère GET instagram.com/p/{code}/embed/captioned/  (4 s max, 1,5 Mo max)
                  POST /api/instagram/page  (cookie de session App Group,
                       en-tête x-mijote-igref: R, corps = HTML brut)  ──►  extraction serveur
                                                                           (extractEmbedCaption, même code qu'à l'étape 1)
                                                                           → Redis ig:device:R = {ownerId, code, caption}, TTL 5 min
Page /recipes/new ── POST /api/recipes/import/url {url, igref: R} ──►  chaîne :
                                                                       cache → téléphone (attend ig:device:R ≤ 3 s)
                                                                       → lecture par le VPS → Apify → erreur
```

- **L'extension télécharge sans analyser** : aucune logique de format côté Swift. Si
  Instagram change sa page, on corrige `src/lib/instagram.ts` et on pousse, sans passer par
  l'App Store.
- **En parallèle, pas en série** : la page web démarre pendant le téléchargement (~1 s de
  démarrage, soit l'ordre de grandeur de la lecture), et le serveur attend le HTML du
  téléphone au plus 3 s. L'utilisateur voit le même écran de chargement. Si le téléphone
  n'a rien envoyé (délai dépassé, pas de réseau, HTML inexploitable), on continue avec la
  chaîne de l'étape 1.
- **La référence `R`** (UUID v4 tiré par l'extension) circule dans l'URL de la page, puis
  dans le corps de l'import. Elle ne contient rien d'autre qu'un identifiant aléatoire.
- **Authentification** : le cookie de session `atable_session` que l'extension lit déjà dans
  l'App Group (`UserDefaults(suiteName:)`) est posé sur le POST (en-tête `Cookie`). La route
  est derrière `withOwnerAuth` : même personne que l'import.
- **Anti-empoisonnement** : une légende envoyée par un téléphone n'est **jamais** écrite dans
  le cache partagé `ig:caption:*`. Elle ne sert qu'à l'import de la même personne (`ownerId`
  vérifié) et du même reel (`code` vérifié), puis elle expire. Sinon, un compte malveillant
  pourrait imposer une fausse légende sur un reel populaire à tous les autres.
- **Garde-fous de la route** : corps ≤ 1,5 Mo (413 applicatif, cf. `body-limit.ts`), limite
  de 30 envois par heure et par owner, `content-type: text/html`. Jamais de HTML dans les logs
  ni dans le journal.
- **Mesure** : nouvelle valeur `ig_path = "device"`, et `ig_device` = raison de non-usage
  (`absent`, `timeout`, `unparsable`, `mismatch`), toujours des catégories. Le voyant de
  santé compte `device` comme une lecture directe.

### 2.3 Chaîne et compatibilité

Téléphone → (échec ou HTML inexploitable) lecture par le VPS → Apify. Les versions de l'app
déjà installées n'envoient pas d'`igref` : elles suivent la chaîne de l'étape 1, sans
changement. Le web et Android ne sont pas concernés : un navigateur ne peut pas lire
instagram.com (CORS), et Android n'a pas d'extension équivalente.

### 2.4 Contraintes de l'extension

- **Mémoire** (≈ 120 Mo pour une extension de partage) : 1 Mo de HTML dans un `Data`, sans
  analyse ni `String` intermédiaire. On coupe au-delà de 1,5 Mo (la page embed fait environ
  280 Ko).
- **Temps** : 4 s pour le GET et 3 s pour le POST, avec une `URLSessionConfiguration.ephemeral`
  (pas de cookie Instagram, rien qui persiste). Si l'utilisateur ferme la feuille, la tâche
  est annulée et le serveur continue seul.
- **Visible** : rien. Pas de nouvel écran ni de texte, pas de nouvelle permission. ATS : https
  uniquement, aucune exception à déclarer.
- **App Privacy** : l'extension contacte instagram.com pour une page que l'utilisateur a
  choisi de partager, et le serveur reçoit un contenu public qu'il reçoit déjà par l'URL.
  A priori, pas de nouvelle donnée collectée, mais **à relire avant la soumission**.

### 2.5 Ce qui demande une version iOS, et le regroupement

| Morceau | Où | Revue App Store ? |
|---|---|---|
| Route `POST /api/instagram/page`, attente de `igref` dans la chaîne, prop `ig_path=device` | serveur | non (poussé d'abord, inactif tant qu'aucun build n'envoie `igref`) |
| `ImportSelector` : relayer `igref` de l'URL de la page vers le POST d'import | web | non |
| `ShareViewController.swift` : UUID, `igref` dans l'URL, GET embed + POST | extension iOS | **oui** |

Environ 60 lignes de Swift dans la seule extension, sans nouvel entitlement ni nouvelle cible.
À **grouper avec le build du chantier « OCR sur l'appareil » (Apple Vision)** : le serveur
est livré avant, les deux changements natifs partent dans le même build, et il n'y a qu'une
revue. La note de version n'a pas à le mentionner (rien de visible).

## 3. Gain estimé

- **Coût Apify** : 0 $ réel aujourd'hui (plan gratuit), donc pas d'économie directe. Le gain
  est de ne plus dépendre du **plafond de 5 $** : au pic de mi-septembre (≈ 74 reels en
  2 jours, 1,47 $ sur le cycle), une croissance d'environ ×3 aurait épuisé le crédit et cassé
  l'import. Avec la lecture directe, Apify ne sert plus qu'au secours, et le crédit est
  surveillé.
- **Latence** : lecture de la légende 0,6 à 1,2 s depuis le VPS, contre 10 s pour Apify à
  chaud et 64 s à froid. Un démarrage à froid d'Apify dépassait le budget d'import (55 s) et
  finissait en `TIMEOUT` : ce cas disparaît pour les lectures directes.
- **Taux de secours** : à lire une semaine après la mise en prod
  (`node scripts/events/query.mjs prod scripts/events/queries/instagram-paths.sql`).

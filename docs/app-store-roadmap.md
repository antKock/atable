# Mijote — Roadmap publication App Store iOS

> Document de pilotage pour la mise en ligne d'Mijote sur l'Apple App Store.
> Créé le 2026-05-20. Statut au 2026-05-23 : **Phases 0.5, 1, 2 et 3 (côté
> code) livrées** · **Phase 0** : compte Apple validé, app App Store Connect
> restant à créer · prochaines étapes : icône vectorielle, screenshots,
> saisie ASC (cf. [`app-store-listing.md`](./app-store-listing.md)).

---

## 1. Décision stratégique

**On ne repart pas de zéro. On ne fait pas de refonte React Native.**

Mijote est un produit Next.js 16 fonctionnel, déployé sur Vercel, avec backend
Supabase. Le passer sur l'App Store est un **problème d'emballage et de
conformité, pas de réécriture.**

| Option | Verdict | Raison |
|---|---|---|
| Repartir de zéro | ❌ | Jette un produit fonctionnel sans gain. |
| Refonte React Native | ❌ | 100 % de l'UI (Radix/shadcn/Tailwind) à réécrire. Des mois. |
| Natif Swift | ❌ | Pire encore. |
| **Capacitor (`server.url` → Vercel)** | ✅ | L'app passe dans l'App Store quasi telle quelle. |

**Architecture retenue :** Capacitor crée une coque iOS native dont la WebView
charge l'URL Vercel **en production (first-party)**. Le code web et le code natif
partagent un seul et même build. Tout le lourd (OpenAI, Supabase, Redis) reste
côté serveur sur Vercel.

⚠️ **Non négociable :** la WebView charge l'origine Vercel directement. Ne
**jamais** servir depuis `capacitor://localhost` en appelant l'API en
cross-origin → le cookie de session `SameSite=Lax` ne serait jamais envoyé.

---

## 2. Plan macro

| Phase | Contenu | Bloque le code ? |
|---|---|---|
| **0** ⏳ — Compte Apple | Apple Developer Program **validé 2026-05-23** ; reste à créer l'app dans App Store Connect | Non (parallèle) |
| **0.5** ✅ — Environnements staging/prod | Staging par branche — **livré 2026-05-22** | — |
| **1** ✅ — Correctifs code | 5 fixes conformité + robustesse — **livrés en prod 2026-05-22** | — |
| **2** ✅ — Intégration Capacitor | Capacitor + projet iOS + `server.url` par env + haptics — **livré 2026-05-22** | — |
| **3** ⏳ — Préparation soumission | Politique + support + offline en prod ; fiche App Store draftée ([`app-store-listing.md`](./app-store-listing.md)). Reste : icône vectorielle, screenshots, saisie ASC. | Non |
| **4** — Test & soumission | Test device réel → TestFlight → review Apple | — |
| **5** — Post-launch | Push notifications (APNs) | — |

**Ordre conseillé :** Phase 0 et 0.5 en parallèle et en premier → Phase 1 →
Phase 2 → 3 → 4. La Phase 5 vient après le lancement. **État au 2026-05-23 :**
Phases 0.5, 1, 2 livrées ; Phase 0 quasi finie (reste App Store Connect) ;
Phase 3 en cours.

### L'approche : incrémental, web-first

- Chaque correctif de Phase 1 est **déployable seul**, sans régression web.
  On commite, on déploie sur staging, on vérifie, on promeut en prod.
- Capacitor (Phase 2) est **purement additif** : nouveau dossier `ios/`, aucune
  modification du code web. Si ça plante, le web n'est pas affecté.
- Branches : `chore/appstore-prep` pour la Phase 1, `feat/capacitor-ios` pour la
  Phase 2. À tout moment le site web reste sain.

---

## 3. Résumé de l'audit

Audit complet réalisé le 2026-05-20 sur trois axes.

### Axe 1 — Compatibilité technique : **bonne**

Aucun blocage architectural. Tout le traitement lourd tourne côté serveur Vercel.
Points à corriger : safe-areas iOS (`viewport-fit=cover` absent), pas de service
worker (→ app vide hors-ligne, prévoir une page de repli).

### Axe 2 — Auth : **anonyme, sans vrai login**

Système anonyme basé sur le **foyer (household)**, cookie-only. Un « utilisateur »
= une session d'appareil rattachée à un foyer. Pas de mot de passe : posséder un
code d'invitation (`THYME-0421`) *est* l'identifiant.

- ✅ **Bonne nouvelle :** pas d'OAuth → **pas de « Sign in with Apple »
  obligatoire**, pas de redirections externes.
- ⚠️ **Risque principal :** le cookie `atable_session` (`SameSite=Lax`, `httpOnly`,
  `secure` en prod, `maxAge` 1 an) est posé **sur une réponse `303`** par les
  routes d'auth → fragile en WKWebView. À refactorer (cf. Fix 1.2).
- ⚠️ ITP de WebKit peut tronquer le `maxAge` 1 an → déconnexions surprises (géré
  gracieusement : l'app redemande create/join).

### Axe 3 — Plugins natifs

| Plugin / clé | Statut | Usage |
|---|---|---|
| `NSMicrophoneUsageDescription` | Obligatoire | Import vocal (`getUserMedia`) |
| `NSPhotoLibraryUsageDescription` | Obligatoire | Import photo/screenshot |
| `NSCameraUsageDescription` | Obligatoire | Feuille iOS « Prendre une photo » → crash sans la clé |
| `@capacitor/splash-screen` | v1 | Évite l'écran blanc pendant le chargement de la WebView |
| `@capacitor/status-bar` | v1 | Texte de la barre d'état en sombre (app thème clair) |
| `@capacitor/haptics` | **v1** | Retour tactile (cf. §Phase 2) |
| `@capacitor/share` | Confort | Améliore le partage du code d'invitation |
| `@capacitor/preferences` | Confort | Migrer le `device_token` hors de `localStorage` |
| Push notifications (APNs) | **Phase 5** | Infrastructure inexistante — chantier à part |

**Règle Apple 4.2 (« minimum functionality ») :** caméra + micro + partage natif
+ haptique + fonctions IA → risque de rejet faible.

**IAP :** aucune dépendance de paiement → pas de paywall → pas de commission
Apple à gérer pour la v1.

---

## 4. Phase 0 — Compte Apple

> **Avancement — 2026-05-23.** Inscription au **Apple Developer Program**
> **validée par Apple** (payée le 2026-05-22, validation < 24 h). Reste à créer
> l'app dans App Store Connect.

- [x] S'inscrire à l'**Apple Developer Program** — 99 $/an, formule
      *Individual*. ✅ Payé le 2026-05-22, validé le 2026-05-23.
- [ ] Créer l'app dans **App Store Connect** : nom, bundle ID
      (`fr.anthonykocken.mijote`), langue principale. ⚠️ Bien basculer sur
      **sa propre équipe** dans le sélecteur (pas « Naiane » / « Riverman
      studio », qui ne sont pas à nous).

---

## 5. Phase 0.5 — Environnements staging/prod

> **✅ PHASE 0.5 LIVRÉE — 2026-05-22.** L'environnement staging est en place et
> vérifié de bout en bout. (La moitié « prod » l'avait été le 2026-05-20 :
> cutover vers le projet Supabase dédié `atable`.)
>
> **Ce qui a été fait — et ce qui diffère du plan initial décrit plus bas :**
>
> - **Branche `staging`** créée depuis `main` → déploiement Vercel **Preview**
>   → domaine `staging.mijote.anthonykocken.fr` (live, HTTP 200, certificat OK).
> - **Backend Supabase de staging = le projet `Vibe-antKoc` réutilisé** — et
>   **non** un nouveau projet `atable-staging`. L'offre gratuite Supabase est
>   limitée à **2 projets par organisation**, et l'organisation concernée était
>   pleine : un projet dédié était impossible. `Vibe-antKoc` (l'ancien
>   fourre-tout) contenait encore les 5 tables atable d'avant le cutover →
>   elles ont été **vidées puis re-seedées** comme base de staging.
>   ⚠️ `Vibe-antKoc` héberge aussi un projet tiers (`pousse_*`) : ne jamais y
>   faire de `db reset`, ne toucher que les 5 tables atable.
> - **Redis : partagé avec la prod** (pas de 2ᵉ base). Redis ne stocke que des
>   compteurs de rate-limit et des drapeaux de révocation de session — aucune
>   donnée réelle, pas de collision de clés possible → une base dédiée
>   n'apportait rien.
> - **Variables Vercel scope Preview** : les 3 variables Supabase repointées sur
>   `Vibe-antKoc` ; `SESSION_SIGNING_SECRET`, `CRON_SECRET`, `OPENAI_SERVICE_KEY`,
>   `DEMO_HOUSEHOLD_ID` et `UPSTASH_*` laissés partagés avec la prod.
> - **Protection de déploiement** (`ssoProtection`) désactivée → le domaine
>   staging et les previews sont publiquement joignables (requis pour la WebView
>   iOS en Phase 2).
> - Le projet `tree-story`, mis en pause auparavant « pour libérer un slot »,
>   était dans une **autre organisation** → cette mise en pause ne servait à
>   rien et peut être annulée.
>
> **Suivis non bloquants :** clé OpenAI dédiée à staging avec plafond de
> dépense ; purge des vieilles photos pré-cutover du bucket `recipe-photos`
> de `Vibe-antKoc`.

### Pourquoi c'est indispensable

Avec l'approche WebView, l'app iOS pointe sur `server.url`. **Chaque déploiement
en prod modifie instantanément l'app installée chez les utilisateurs**, sans
repasser par la review Apple. Staging devient le **seul filet de sécurité** :
on teste sur staging → on promeut en prod.

### Le piège : un environnement ≠ un déploiement Vercel

Si staging et prod partagent la **même base Supabase**, tester sur staging
**corrompt les données de prod** : la base de données doit impérativement être
séparée. Le reste du backend se partage ou non selon qu'il contient ou non de
vraies données (cf. matrice plus bas).

| Composant | Prod | Staging |
|---|---|---|
| Déploiement Vercel | `mijote.anthonykocken.fr` | `staging.mijote.anthonykocken.fr` |
| Projet Supabase (BDD) | projet `atable` dédié | projet `Vibe-antKoc` réutilisé |
| Upstash Redis | base actuelle | **partagée** (données éphémères) |
| OpenAI | clé partagée | clé partagée |

> Note : Upstash Redis est probablement provisionné via le **Marketplace Vercel**
> (onglet Storage du projet) — d'où l'impression de ne pas avoir de compte
> Upstash. Supabase ne fournit **pas** de Redis (c'est du Postgres).

### Architecture retenue : staging par branche (« Chemin A »)

**Décision actée :** le staging suit le **modèle par branche** — « **Chemin A** »
— retenu pour sa simplicité. Les *Custom Environments* de Vercel Pro restent une
alternative « plus propre » mais **non retenue** (cf. ⚠️ Plan Vercel).

- **`main`** → environnement **Production** → variables scope « Production »
- **`staging`** (nouvelle branche) → déploiement Vercel **Preview** → variables
  scope « Preview » → domaine custom `staging.mijote.anthonykocken.fr`
- Branches de feature → previews éphémères → utilisent aussi les variables
  « Preview » → tapent le backend staging (parfait pour tester)

**Workflow git :**

```
feature/xxx  →  merge dans  staging  →  déploie staging  →  test
                                    ↓ (validé)
                staging  →  merge dans  main  →  déploie prod
```

Après chaque release, `main` et `staging` sont alignées.

### Matrice des variables d'environnement

| Variable (scope Preview) | Prod | Staging | Réalisé |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | projet `atable` | projet `Vibe-antKoc` | ✅ séparé |
| `SUPABASE_SERVICE_ROLE_KEY` | `atable` | `Vibe-antKoc` | ✅ séparé |
| `UPSTASH_REDIS_REST_URL` / `TOKEN` | base prod | *idem prod* | partagé — Redis sans données réelles |
| `SESSION_SIGNING_SECRET` | secret prod | *idem prod* | partagé — cookies liés à l'hôte, sessions en bases distinctes |
| `DEMO_HOUSEHOLD_ID` | `00000…000` | `00000…000` | partagé — même UUID de seed |
| `OPENAI_SERVICE_KEY` | clé partagée | *idem prod* | partagé — suivi : clé staging dédiée + plafond |
| `CRON_SECRET` | secret prod | *idem prod* | partagé — les crons ne tournent pas sur Preview |

### Checklist Phase 0.5 — ✅ réalisée le 2026-05-22

- [x] Branche git `staging` créée depuis `main`.
- [x] Backend Supabase staging = projet `Vibe-antKoc` réutilisé : migrations
      `001`→`004` déjà présentes ; les 5 tables atable vidées de leurs données
      pré-cutover, puis re-seedées via `supabase/seed.sql` (1 foyer démo +
      13 recettes).
- [x] Redis : partagé avec la prod (décision actée — pas de base dédiée).
- [x] Variables scope « Preview » dans Vercel : 3 variables Supabase repointées
      sur `Vibe-antKoc` via l'API REST (le CLI échoue en `git_branch_required`
      sur ce scope) ; le reste laissé partagé.
- [x] Domaine `staging.mijote.anthonykocken.fr` assigné à la branche `staging`,
      protection de déploiement levée, CNAME DNS en place — domaine live.
- [x] Vérifié : le déploiement staging tape bien le backend `Vibe-antKoc`
      (test par foyer marqueur) et répond sans mur SSO.

### ⚠️ Plan Vercel

Publier une vraie app = **usage commercial**, interdit par le plan **Hobby
(gratuit)**. Prévoir **Vercel Pro (~20 $/mois)**. Pro débloque aussi les *Custom
Environments* (séparation encore plus propre que le modèle par branche).

---

## 6. Phase 1 — Correctifs code

> **✅ TERMINÉE — 2026-05-22.** Les 5 correctifs sont implémentés, vérifiés
> (`tsc`, 125 tests, build de production) et **déployés en production**
> (PR #1, commit `5bb5cf7`). Le cron `demo-reset` a été testé de bout en bout
> sur le Supabase prod : `GET` authentifié → `{reset:true,deleted:1,restored:0}`,
> les 13 recettes seed préservées, la recette non-seed supprimée. En prod,
> `GET /api/cron/demo-reset` → `401` (handler atteint) ; il tournera chaque
> nuit à 3h. Vérifs WKWebView des fixes 1.1 et 1.2 → reportées en Phase 4.

Branche : `chore/appstore-prep`. Aucune dépendance entre les fixes → ordre libre.
Chacun est déployable seul, sans régression web. Classés du plus simple au plus
consistant.

### Fix 1.3 — Retirer les en-têtes de debug `x-dbg-*` · XS · ✅ FAIT

- **Fichier :** `src/middleware.ts` (~lignes 49-56).
- **Changement :** supprimer les 3 `response.headers.set('x-dbg-*', …)`.
- **Impact web :** aucun.
- **Vérif :** DevTools → Network → plus de `x-dbg-*` dans les réponses.

### Fix 1.5 — Cron `GET` + domaine périmé · XS · ✅ FAIT

- **Fichiers :** `src/app/api/cron/demo-reset/route.ts`,
  `src/components/household/InviteLinkDisplay.tsx:17`.
- **Changement :** (a) exporter un handler `GET` (Vercel Cron envoie un GET, pas
  un POST → la route 405 actuellement et ne tourne jamais) ; (b) remplacer le
  fallback codé en dur `https://atable.app/...` par `window.location.origin`.
- **Impact web :** corrige deux bugs.
- **Vérif :** route appelée en GET avec le bon `Authorization` → 200 ; lien
  d'invitation pointe vers le bon domaine.

### Fix 1.1 — Safe-areas iOS · S · ✅ FAIT

- **Fichiers :** `src/app/layout.tsx` (export `viewport`) + en-têtes des layouts
  `(app)` / `(landing)`.
- **Changement :** (a) ajouter `viewportFit: "cover"` à l'objet `Viewport`
  (sans ça, tous les `env(safe-area-inset-*)` valent 0 sur iPhone à encoche) ;
  (b) ajouter `padding-top: env(safe-area-inset-top)` sur les en-têtes sticky.
- **Impact web :** nul sur desktop. Sans risque.
- **Vérif :** simulateur iOS → nav basse et en-têtes ne passent plus sous
  l'encoche / la barre d'accueil.

### Fix 1.4 — Séparer « Quitter » / « Supprimer le foyer » · S/M · ✅ FAIT

- **Fichiers :** `src/components/household/LeaveHouseholdDialog.tsx`,
  API `src/app/api/households/[id]/route.ts` (le `DELETE` gère déjà les deux cas).
- **Changement :** exposer **deux CTA distincts** au lieu d'un bouton unique au
  comportement variable :
  - **Quitter le foyer** → supprime seulement la session de l'appareil.
  - **Supprimer le foyer** → supprime tout (recettes + foyer + sessions), quel
    que soit le nombre de membres. **Double validation** (dialogue de
    confirmation à deux temps) — décision actée : pas de blocage ni de saisie du
    nom, juste une double confirmation.
- **Impact web :** amélioration UX (action aujourd'hui ambiguë).
- **Conformité :** satisfait l'exigence Apple d'un chemin clair de suppression
  des données.
- **Vérif :** « Quitter » → session partie, données conservées ; « Supprimer »
  → tout disparaît, retour à `/`.

### Fix 1.2 — Refacto auth : cookie sur `200 JSON` au lieu de `303` · M · ✅ FAIT

- **Fichiers :** 3 routes (`api/demo/session`, `api/households`,
  `api/households/join`) + leurs composants clients appelants
  (`LandingScreen` / `CreateHouseholdForm` / `CodeEntryForm` / `JoinConfirmation`).
- **Changement :** les routes posent le cookie sur une réponse `200` JSON
  (`{ ok: true, redirect: "/home" }`) au lieu d'un `303` ; les clients lisent le
  JSON puis font `window.location.href = redirect`.
- **Pourquoi :** poser un cookie sur un `303` est fragile en WKWebView.
- **Impact web :** identique sur navigateur (plus propre). Chemin critique → à
  tester avec soin.
- **Vérif :** sur web, les 3 flux (démo / créer / rejoindre) connectent bien et
  le cookie `atable_session` est présent. Test WKWebView → Phase 4.

**Total Phase 1 :** ~10-12 fichiers, dont 8 en modifications mineures.

---

## 7. Phase 2 — Intégration Capacitor

> **✅ PHASE 2 LIVRÉE — 2026-05-22.** Scaffold Capacitor, projet iOS, `server.url`
> par environnement et retours haptiques sont en place (PR #4 + PR #5 ;
> 280 tests verts, `tsc` clean, 100 % additif). Le build Xcode réel et le test
> sur device se feront en Phase 4.

Branche : `feat/capacitor-ios`. Couche additive, ne touche pas le code web.

- [x] Capacitor installé : `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`,
      `@capacitor/haptics`, `@capacitor/splash-screen`, `@capacitor/status-bar`.
- [x] `npx cap add ios` → projet Xcode généré (`ios/`).
- [x] User-agent custom : `appendUserAgent` = `MijoteNative/1.0` (sans token de
      `BOT_UA_PATTERN` — `WhatsApp`, `Facebot`…, cf. `middleware.ts:20` — sinon
      bypass d'auth).
- [x] Clés Info.plist : `NSMicrophoneUsageDescription`,
      `NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription` (descriptions FR).
- [x] Plugins v1 : `splash-screen` (durée + couleur configurées), `status-bar`,
      `haptics`.
- [x] Helpers `src/lib/native.ts` (détection web/natif) + `src/lib/haptics.ts`,
      avec tests. La WebView charge le site first-party (jamais Safari).
- [x] **`server.url` par environnement.** Piloté par `CAP_ENV` dans
      `capacitor.config.ts` : `CAP_ENV=staging npx cap sync ios` → staging,
      `npx cap sync ios` (défaut) → prod. `allowNavigation` liste les 2 domaines.
- [x] **Haptics câblés** sur les 5 points d'appel : début/fin d'enregistrement
      vocal (`medium`), import de recette réussi — voix/photo/URL (`success`),
      copie du code d'invitation (`light`), suppression de foyer (`heavy`).

### Points d'appel haptiques (v1)

- Démarrer / arrêter l'enregistrement vocal.
- Recette importée avec succès (URL / photo / voix).
- Copie du code d'invitation.
- Retour « lourd » sur « Supprimer le foyer ».

### Détection web vs natif (un seul codebase)

- Cookie posé au 1er chargement à partir du paramètre `?native=1` de `server.url`,
  **et/ou** user-agent custom `MijoteNative/1.0` (lisible par le middleware).
- Le web ignore simplement ce flag → zéro impact.

---

## 8. Phase 3 — Préparation soumission

> **Tous les textes à coller dans App Store Connect** sont consignés dans
> [`app-store-listing.md`](./app-store-listing.md) (nom, sous-titre,
> description, mots-clés, catégorie, URLs, promo text, what's new,
> autres champs ASC). À utiliser comme source de vérité au moment de la
> saisie dans ASC.

- [ ] **Icône App Store 1024×1024 px** — `public/icons/icon-1024.png` existe
      (upscale flou via `sips`). À re-générer depuis une source vectorielle.
- [ ] Screenshots par taille d'écran requise (6.7" iPhone obligatoire ;
      idéalement 6.5" + iPad) — à capturer en simulateur Xcode.
- [x] **Texte de la fiche App Store** (nom, sous-titre, description, mots-clés,
      catégorie, URLs, promo text, what's new) — drafté dans
      [`app-store-listing.md`](./app-store-listing.md). Reste à **coller dans
      ASC**.
- [x] **Politique de confidentialité** — publiée à
      `https://mijote.anthonykocken.fr/legal/confidentialite` (source :
      `src/app/(landing)/legal/confidentialite/page.tsx`, contenu :
      [`politique-confidentialite.md`](./politique-confidentialite.md)).
- [x] **Page de support** — publiée à
      `https://mijote.anthonykocken.fr/support`
      (source : `src/app/(landing)/support/page.tsx`).
- [~] **Privacy nutrition labels** — drafté dans
      [`app-store-privacy-labels.md`](./app-store-privacy-labels.md) ; reste à
      **recopier dans ASC**.
- [x] **Page de repli hors-ligne** — `public/offline.html` bundlé via webDir +
      `ios/App/App/MainViewController.swift` qui la charge sur erreur réseau
      (à valider en Phase 4 sur Xcode).

---

## 9. Phase 4 — Test & soumission

- [ ] Test sur **device iOS réel** : flux create / join / demo (le cookie !),
      micro, photo/caméra, safe-areas, splash screen, barre d'état.
- [ ] Build Xcode → Archive → upload vers App Store Connect.
- [ ] **TestFlight** (bêta) pointant sur staging.
- [ ] Soumission review Apple (délai ~24-48 h).

---

## 10. Phase 5 — Post-launch

- [ ] Push notifications : intégration APNs + table `device_tokens` + plugin
      `@capacitor/push-notifications`. Chantier net, infrastructure inexistante.
- [ ] Statique offline plus poussé si besoin.

---

## 11. Bugs trouvés pendant l'audit

- ✅ **Cron `demo-reset` ne tournait jamais** : route `POST`-only, Vercel Cron
  envoie un `GET` → 405. **Résolu — Fix 1.5, déployé le 2026-05-22.** Vérifié
  end-to-end : une recette démo qui traînait depuis le 2026-03-16 a été nettoyée.
- ✅ **Domaine périmé** `https://atable.app/join/...` codé en dur dans
  `InviteLinkDisplay.tsx`. **Résolu — Fix 1.5.**
- ✅ **En-têtes `x-dbg-*`** exposaient des internes de session. **Résolu — Fix 1.3.**
- ⬜ `useDeviceToken` / `DeviceTokenProvider` = code mort (UUID `localStorage`
  jamais envoyé). Toujours présent — hors scope Phase 1, à nettoyer.

---

## 12. Décisions actées

- **Approche :** Capacitor `server.url` → Vercel, pas de réécriture.
- **WebView :** charge l'origine Vercel en first-party (jamais `capacitor://`).
- **Auth :** anonyme/household, pas de « Sign in with Apple » nécessaire.
- **Suppression de données :** deux CTA « Quitter le foyer » / « Supprimer le
  foyer » ; « Supprimer » = double validation uniquement.
- **Haptics :** inclus en v1.
- **User-agent natif :** `MijoteNative/1.0`.
- **Backend prod :** projet Supabase `atable` **dédié** (offre gratuite), migré
  depuis le fourre-tout partagé `Vibe-antKoc` le 2026-05-20.
- **Staging :** modèle par branche (« **Chemin A** »), **livré le 2026-05-22**.
  Backend Supabase séparé (projet `Vibe-antKoc` réutilisé, faute de pouvoir
  créer un projet dédié) ; Redis et secrets partagés avec la prod (cf. §5).
  Vercel Pro probablement requis (usage commercial).
- **Push notifications :** reportées en Phase 5.

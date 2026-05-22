# À Table — Roadmap publication App Store iOS

> Document de pilotage pour la mise en ligne d'À Table sur l'Apple App Store.
> Créé le 2026-05-20. Statut : **Phase 1 livrée (2026-05-22)** — Phases 0,
> 0.5 (staging) et 2+ à venir.

---

## 1. Décision stratégique

**On ne repart pas de zéro. On ne fait pas de refonte React Native.**

À Table est un produit Next.js 16 fonctionnel, déployé sur Vercel, avec backend
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
| **0** — Compte Apple | Apple Developer Program (99 $/an), App Store Connect | Non (parallèle) |
| **0.5** — Environnements staging/prod | Dédoubler Vercel + Supabase + Upstash | Non (parallèle) |
| **1** ✅ — Correctifs code | 5 fixes conformité + robustesse — **livrés en prod 2026-05-22** | — |
| **2** — Intégration Capacitor | Projet iOS, plugins, clés Info.plist | Dépend d'un Mac/Xcode |
| **3** — Préparation soumission | Assets, fiche App Store, conformité | Non |
| **4** — Test & soumission | Test device réel → TestFlight → review Apple | — |
| **5** — Post-launch | Push notifications (APNs) | — |

**Ordre conseillé :** Phase 0 et 0.5 en parallèle et en premier → Phase 1 →
Phase 2 → 3 → 4. La Phase 5 vient après le lancement.

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

- [ ] S'inscrire à l'**Apple Developer Program** — 99 $/an, vérification
      d'identité (compter quelques jours de délai).
- [ ] Créer l'app dans **App Store Connect** : nom, bundle ID
      (ex. `fr.anthonykocken.atable`), langue principale.

---

## 5. Phase 0.5 — Environnements staging/prod

> **Avancement — 2026-05-20.** La moitié « **prod** » de cette phase est
> **faite** : la production tourne désormais sur un **projet Supabase `atable`
> dédié** (offre **gratuite**), en remplacement du projet fourre-tout partagé
> `Vibe-antKoc`. Les 3 variables Supabase ont été repointées sur les 3 scopes
> Vercel (Production / Preview / Development), la prod a été redéployée puis
> vérifiée de bout en bout (écriture, lecture, bundle client). **Reste à
> faire :** créer l'environnement **staging** (le reste de cette phase).
>
> **Capacité Supabase :** l'offre gratuite autorise **2 projets actifs**.
> Slot 1 = `atable` (prod). Le projet `tree-story` a été **mis en pause** pour
> libérer le slot 2, qui accueillera `atable-staging` — staging reste donc
> gratuit lui aussi.
>
> **Nettoyage en attente :** supprimer les 5 tables atable + le bucket
> `recipe-photos` de l'ancien projet `Vibe-antKoc`.

### Pourquoi c'est indispensable

Avec l'approche WebView, l'app iOS pointe sur `server.url`. **Chaque déploiement
en prod modifie instantanément l'app installée chez les utilisateurs**, sans
repasser par la review Apple. Staging devient le **seul filet de sécurité** :
on teste sur staging → on promeut en prod.

### Le piège : un environnement ≠ un déploiement Vercel

Si staging et prod partagent la même base Supabase / le même Redis, tester sur
staging **corrompt les données de prod**. Il faut **dédoubler tout le backend.**

| Composant | Prod | Staging |
|---|---|---|
| Déploiement Vercel | `atable.anthonykocken.fr` | `staging.atable.anthonykocken.fr` |
| Projet Supabase (BDD) | projet `atable` dédié ✅ | **nouveau** projet `atable-staging` |
| Upstash Redis | base actuelle | **nouvelle** base Redis |
| OpenAI | clé partagée OK | clé partagée OK |

> Note : Upstash Redis est probablement provisionné via le **Marketplace Vercel**
> (onglet Storage du projet) — d'où l'impression de ne pas avoir de compte
> Upstash. Supabase ne fournit **pas** de Redis (c'est du Postgres).

### Architecture retenue : staging par branche (« Chemin A »)

**Décision actée :** le staging suit le **modèle par branche** — « **Chemin A** »
— retenu pour sa simplicité. Les *Custom Environments* de Vercel Pro restent une
alternative « plus propre » mais **non retenue** (cf. ⚠️ Plan Vercel).

- **`main`** → environnement **Production** → variables scope « Production »
- **`staging`** (nouvelle branche) → déploiement Vercel **Preview** → variables
  scope « Preview » → domaine custom `staging.atable.anthonykocken.fr`
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

| Variable | Prod | Staging | Identique ? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | projet prod | projet staging | ❌ |
| `SUPABASE_SERVICE_ROLE_KEY` | prod | staging | ❌ |
| `UPSTASH_REDIS_REST_URL` / `TOKEN` | base prod | base staging | ❌ |
| `SESSION_SIGNING_SECRET` | secret A | **secret B** | ❌ (étanchéité sessions) |
| `DEMO_HOUSEHOLD_ID` | UUID démo prod | UUID démo staging | ✅ si seed défaut `00000…000` |
| `OPENAI_SERVICE_KEY` | — | — | ✅ partageable |
| `CRON_SECRET` | secret C | secret D | au choix |

### Checklist Phase 0.5

- [ ] Créer la branche git `staging` à partir de `main`.
- [ ] **Supabase staging :** créer le projet `atable-staging` (slot 2 de l'offre
      gratuite Supabase, libéré en mettant `tree-story` en pause).
- [ ] `supabase link --project-ref <ref-staging>` puis `supabase db push`
      (applique les 4 migrations `001`→`004`).
- [ ] Exécuter `supabase/seed.sql` sur le projet staging (crée le foyer démo).
- [ ] **Upstash staging :** créer une 2ᵉ base Redis (Vercel → Storage). Saisir
      `UPSTASH_REDIS_REST_URL` / `_TOKEN` **à la main** sous le scope Preview
      (éviter que l'auto-injection écrase les valeurs prod).
- [ ] Renseigner toutes les variables scope « Preview » dans Vercel (cf. matrice).
      ⚠️ Aujourd'hui les 3 variables Supabase « Preview » pointent encore sur le
      projet **prod** `atable` (choix temporaire du cutover) → les repointer sur
      `atable-staging` ici.
- [ ] Assigner le domaine `staging.atable.anthonykocken.fr` à la branche `staging`.
- [ ] Vérifier : un déploiement staging fonctionne et tape bien le backend staging.

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

Branche : `feat/capacitor-ios`. Couche additive, ne touche pas le code web.

- [ ] Installer Capacitor : `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`.
- [ ] Configurer `server.url` :
  - Build **Debug / TestFlight** → `https://staging.atable.anthonykocken.fr`
  - Build **Release / App Store** → `https://atable.anthonykocken.fr`
  - Ajouter `?native=1` à l'URL pour la détection côté serveur.
- [ ] User-agent custom : `appendUserAgentString` = `ATableNative/1.0`.
      ⚠️ Ne **pas** y mettre de token de `BOT_UA_PATTERN` (`WhatsApp`, `Facebot`,
      `Twitterbot`, etc., cf. `middleware.ts:20`) → sinon bypass d'auth.
- [ ] `npx cap add ios` → génère le projet Xcode.
- [ ] Clés Info.plist : `NSMicrophoneUsageDescription`,
      `NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription`.
- [ ] Plugins v1 : `@capacitor/splash-screen`, `@capacitor/status-bar`,
      `@capacitor/haptics`.

### Points d'appel haptiques (v1)

- Démarrer / arrêter l'enregistrement vocal.
- Recette importée avec succès (URL / photo / voix).
- Copie du code d'invitation.
- Retour « lourd » sur « Supprimer le foyer ».

### Détection web vs natif (un seul codebase)

- Cookie posé au 1er chargement à partir du paramètre `?native=1` de `server.url`,
  **et/ou** user-agent custom `ATableNative/1.0` (lisible par le middleware).
- Le web ignore simplement ce flag → zéro impact.

---

## 8. Phase 3 — Préparation soumission

- [ ] Icône app 1024×1024 px.
- [ ] Screenshots par taille d'écran requise.
- [ ] Description, mots-clés, catégorie.
- [ ] Politique de confidentialité (URL publique).
- [ ] Privacy nutrition labels dans App Store Connect.
- [ ] Page de repli hors-ligne (la WebView est vide sans réseau).
- [ ] Retirer / désactiver les en-têtes de debug restants (cf. Fix 1.3).

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
- **User-agent natif :** `ATableNative/1.0`.
- **Backend prod :** projet Supabase `atable` **dédié** (offre gratuite), migré
  depuis le fourre-tout partagé `Vibe-antKoc` le 2026-05-20.
- **Staging :** modèle par branche (« **Chemin A** »), backend Supabase +
  Upstash dédoublé. Vercel Pro probablement requis (usage commercial).
- **Push notifications :** reportées en Phase 5.

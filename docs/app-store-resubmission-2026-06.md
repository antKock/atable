# Mijote — Resoumission App Store (juin 2026)

> Guide opératoire pour soumettre la nouvelle version iOS. À jour au **2026-06-01**.
> Tout le code (web + couche native) est en **prod** et vérifié. Il ne reste que
> la **build native + soumission** (Mac/Xcode requis).

---

## 0. TL;DR — pourquoi cette soumission, et ce qu'elle embarque

Mijote est une **coque Capacitor dont la WebView charge l'URL Vercel prod**. Conséquence
structurante :

- **Tout changement web est déjà live** pour les utilisateurs actuels (la WebView charge
  la prod) → **ne nécessite AUCUNE resoumission.**
- **Seuls les changements natifs** (entitlements, plugins Capacitor, Info.plist) imposent
  une nouvelle build + revue Apple.

**Vérifié :** depuis la dernière build soumise (état du 2026-05-23), **rien n'a touché
`ios/` ni `capacitor.config.ts` à part le lot natif ci-dessous.** C'est donc l'unique
raison de cette resoumission.

---

## 1. Ce qui a changé depuis la dernière version soumise

### 1.A — Natif (la raison de cette build — à embarquer)

| Changement | Détail | Action native requise |
|---|---|---|
| **Universal Links** | Liens `/r/<token>` ouvrent l'app au lieu de Safari. AASA servi en prod sur `/.well-known/apple-app-site-association` (vérifié `200` + `application/json`). `ios/App/App/App.entitlements` déclare `applinks:` prod + staging. `DeepLinkHandler` route le lien dans la WebView. | **Capability Associated Domains** dans Xcode (+ provisioning) |
| **Partage natif** | `@capacitor/share` (le `navigator.share` est non fiable en WKWebView). | **Plugin natif** (`cap sync`) |
| **Notation App Store** | `@capacitor-community/in-app-review` — demandé 1 fois après la 3ᵉ recette ajoutée. | **Plugin natif** (`cap sync`) |

> Ces 3 items sont la **seule** raison de la resoumission.

### 1.B — Web déjà en ligne (FYI — pour les release notes & la review)

Déjà servi en prod, donc **déjà actif pour tous les utilisateurs sans mise à jour**. À
mentionner dans les *release notes* et utile à la review (le reviewer verra ces écrans) :

- **Partage de recettes** : lien public `/r/<token>` (fiche en lecture seule), sauvegarde
  invité (créer/rejoindre un foyer), « Ajouter à mon foyer » pour un membre d'un autre foyer.
- **Bannière d'installation iOS web** : incite les visiteurs **Safari** (pas l'app) à
  installer, avec passage du code de foyer. ⚠️ **Masquée dans l'app** (`isNativeApp()`), donc
  invisible pour le reviewer → pas de risque « l'app me pousse à télécharger une app ».
- **Mise à jour silencieuse** (build-id polling) : la WebView se recharge seule quand un
  nouveau déploiement sort.
- **Dashboard d'usage** `/admin/stats` (admin uniquement, non visible des utilisateurs).
- **Sécurité Supabase** : RLS activée, policies storage.
- Divers **ajustements design / i18n (tutoiement)** déjà en place.

---

## 2. Pré-requis

- Un **Mac** avec **Xcode** à jour. (Projet en **Swift Package Manager** — pas de CocoaPods,
  pas de dossier `Pods/` ni de `.xcworkspace`.)
- Accès au compte **Apple Developer** (Team ID `7H527R9HJJ`) et à **App Store Connect**.
- Repo à jour : `git checkout main && git pull` (doit contenir le merge PR #67).
- Signing **automatique** recommandé (Xcode gère le provisioning profile).

---

## 3. Étapes — dans l'ordre

### Étape 1 — Synchroniser le projet natif (build **prod**)

```bash
git checkout main && git pull
npm ci
npx cap sync ios      # PAS de CAP_ENV → la WebView pointera sur la PROD
```
> `cap sync` intègre les 3 nouveaux plugins via **Swift Package Manager** (`@capacitor/app`,
> `@capacitor/share`, `@capacitor-community/in-app-review`) et copie la config.
> Pour une build de **test** sur staging, utiliser `CAP_ENV=staging npx cap sync ios`.

### Étape 2 — Activer Associated Domains (Xcode)

1. Ouvrir **`ios/App/App.xcodeproj`** dans Xcode (projet SPM → il n'y a **pas** de `.xcworkspace`).
2. Cible **App** → onglet **Signing & Capabilities**.
3. **+ Capability** → **Associated Domains**.
4. Vérifier la présence de :
   - `applinks:mijote.anthonykocken.fr`
   - `applinks:staging.mijote.anthonykocken.fr`
   (le fichier `App.entitlements` les contient déjà ; Xcode doit pointer dessus via
   `CODE_SIGN_ENTITLEMENTS`. Si Xcode crée un fichier en double, garder un seul fichier
   avec ces 2 entrées.)
5. S'assurer que le **provisioning profile** inclut bien Associated Domains (en signing
   automatique, Xcode le régénère seul).

### Étape 3 — Incrémenter version & build

- **Build (CFBundleVersion / `CURRENT_PROJECT_VERSION`)** : passer de `1` → `2` (obligatoire,
  doit être strictement supérieur au build déjà soumis).
- **Version (`MARKETING_VERSION`)** : recommandé `1.0` → `1.1` (nouvelle version fonctionnelle).

### Étape 4 — Tests (voir §4 pour le détail) sur **simulateur puis device réel**

Ne pas soumettre avant d'avoir validé au minimum les Universal Links **sur un device réel**.

### Étape 5 — Archive & upload

1. Xcode → sélectionner **Any iOS Device (arm64)**.
2. **Product → Archive**.
3. **Distribute App → App Store Connect → Upload**.
4. Attendre le traitement du build dans App Store Connect (quelques minutes).

### Étape 6 — TestFlight (recommandé)

- Tester le build uploadé via **TestFlight** sur un device réel (surtout Universal Links +
  partage natif) avant de soumettre à la review.

### Étape 7 — Soumettre à la review

- App Store Connect → nouvelle version `1.1` → sélectionner le build.
- **Release notes** (exemple) : « Partage de recettes par lien, sauvegarde en un geste,
  améliorations diverses. »
- **Notes pour la review** (important, l'app est en **auth anonyme par foyer**, sans login) :
  rappeler comment tester (créer un foyer, ajouter une recette, ouvrir un lien `/r/…`).
- Soumettre. Revue ≈ **24–48 h**.

### Étape 8 — Post-validation

- ⚠️ **Ne pas communiquer / annoncer le partage avant que l'app validée soit en ligne.**
  Tant que l'ancienne app est la version publiée, un utilisateur qui a l'app et clique un
  lien atterrit dans **Safari** (sa session vit dans la WebView de l'app, pas dans Safari)
  → traité comme invité. Les Universal Links corrigent ça **une fois la nouvelle app
  publiée**.

---

## 4. Plan de tests

### 4.A — Web (prod) — ✅ TESTÉ & VALIDÉ le 2026-06-01

Le web est en prod ; testé sans build native. **Tous les parcours ci-dessous validés.**

| Parcours | Étapes | Attendu |
|---|---|---|
| Lien proprio | Fiche recette → icône **Partager** | Feuille de partage (ou « Lien copié » sur desktop) → `https://mijote.anthonykocken.fr/r/<token>` |
| Invité | Ouvrir le `/r/<token>` en **navigation privée** | Fiche en lecture seule + « Enregistrer cette recette » → créer un foyer (carte recette affichée) → recette sauvegardée |
| Fallback rejoindre | Depuis l'écran créer → « J'ai déjà un foyer — le rejoindre » | Écran code → rejoint → recette ajoutée |
| Ami autre foyer | Ouvrir le lien connecté à un **autre** foyer | « Ajouter à mon foyer » → « Ajoutée à ton foyer » |
| Proprio | Ouvrir son propre lien connecté | Badge passif « Déjà dans ton foyer » |
| Bannière install | iOS **Safari**, connecté | Bannière → « Installer » ouvre l'App Store + révèle le code de foyer |

### 4.B — Natif (sur la build — simulateur puis **device réel**)

| Test | Comment | Attendu |
|---|---|---|
| **Universal Link (device réel)** | S'envoyer un lien `https://mijote.anthonykocken.fr/r/<token>` (Messages/Notes), le taper | **L'app s'ouvre** directement sur la recette (pas Safari) |
| Universal Link (simulateur) | `xcrun simctl openurl booted https://mijote.anthonykocken.fr/r/<token>` | L'app route vers la recette (le simulateur est capricieux sur les UL → préférer le device) |
| **Partage natif** | Dans l'app, fiche recette → **Partager** | **Feuille de partage native iOS** (pas seulement presse-papier) |
| **Notation** | Ajouter **3 recettes** dans l'app | Dialogue de notation peut apparaître (Apple le throttle / TestFlight ne l'affiche pas — vérifier surtout **l'absence de crash**) |
| Bannière install **absente dans l'app** | Naviguer dans l'app | La bannière d'installation **ne doit PAS** s'afficher (gate `isNativeApp()`) |

### 4.C — Non-régression (build native)

- Lancement → splash → home charge bien la prod.
- Créer un foyer / rejoindre via code.
- Ajouter une recette (manuel + import), enrichissement.
- Mode **offline au lancement** : couper le réseau → page `offline.html`.
- Photos : upload + affichage.

> Astuce test UL si l'AASA semble pas pris en compte (cache CDN Apple) : ajouter
> temporairement `?mode=developer` au domaine **staging** dans `App.entitlements`
> (jamais sur le domaine **prod** pour la build soumise).

---

## 5. Risques & points de vigilance

- **Build pointant sur prod** : la build de release doit être `npx cap sync ios` **sans**
  `CAP_ENV` → WebView sur `mijote.anthonykocken.fr`. (Staging = builds de test uniquement.)
- **Provisioning** : si Associated Domains manque dans le profil → l'app build mais les UL
  ne marchent pas. Vérifier en signing automatique.
- **Numéro de build** : doit être strictement supérieur au précédent, sinon upload refusé.
- **Compat plugins** : les 3 plugins sont en **v8** (alignés sur `@capacitor/core@8`).
- **Pas de secret exposé** : l'`appID` de l'AASA (`7H527R9HJJ.fr.anthonykocken.mijote`) est
  public par nature, c'est normal.

---

## 6. Checklist finale

- [ ] `git pull` sur `main` (merge PR #67 présent)
- [ ] `npm ci` && `npx cap sync ios` (sans `CAP_ENV`)
- [ ] Xcode : capability **Associated Domains** (prod + staging)
- [ ] Build number incrémenté (+ version `1.1`)
- [x] Tests web (§4.A) OK — validé 2026-06-01
- [ ] Tests natifs simulateur (§4.B) OK
- [ ] **Universal Link testé sur device réel** OK
- [ ] Non-régression (§4.C) OK
- [ ] Archive → Upload → TestFlight OK
- [ ] Release notes + notes review renseignées
- [ ] Soumis à la review
- [ ] (Après validation) communiquer le partage

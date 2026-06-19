# Share Extension iOS — « Mijote » dans la share sheet (Plan C)

Objectif : quand on partage une **URL** depuis une autre app (Instagram…),
« Mijote » apparaît dans la share sheet ; un tap ouvre une **feuille Mijote sur
place** (sans quitter l'app source) qui charge le flow d'import, montre le
loading, le formulaire pré-rempli, et permet de **valider/corriger puis
enregistrer**.

## Pourquoi cette approche (et pas « ouvrir l'app »)

Apple **n'autorise pas** une Share Extension à ouvrir son app conteneur :
- `extensionContext.open` ne marche que pour les Today widgets (renvoie `false`
  pour une Share Extension — vérifié).
- Le hack responder-chain `openURL:` est **mort depuis iOS 18** (UIKit force un
  `false`). C'était le « blink » qu'on observait.
- Confirmé par un ingénieur Apple DTS : *« there isn't a supported way to do
  this »*.

Ce que fait Messenger/WhatsApp n'est PAS ouvrir l'app : c'est **afficher l'UI de
leur propre extension sur place** et faire le travail dedans. C'est le modèle
voulu par Apple, et c'est ce qu'on adopte : **une Share Extension avec UI qui
héberge un `WKWebView`** chargeant notre flow d'import web existant.

```
Insta → Partager → Mijote → [feuille Mijote s'ouvre sur place]
   → WKWebView charge https://<host>/recipes/new?import=url&url=…&ext=1
   → loading screen (déjà codé) → formulaire pré-rempli
   → relire / corriger → Enregistrer → la feuille se ferme → retour Insta
```

- Bundle app : `fr.anthonykocken.mijote`
- Bundle extension : `fr.anthonykocken.mijote.ShareExtension`
- App Group : `group.fr.anthonykocken.mijote`
- Team ID : `7H527R9HJJ` · Deployment target : **iOS 15.0**

## Le nœud : authentifier le WebView de l'extension

L'auth de l'app est **100 % par cookie** (`atable_session`, JWT signé). Le
WebView de l'extension a son **propre** cookie store → il faut lui injecter ce
cookie. Le cookie est `httpOnly` (le JS ne peut pas le lire) **mais le natif
oui** via `WKHTTPCookieStore`.

Mécanique :
1. **App** : au passage en arrière-plan, lit `atable_session` depuis son cookie
   store et l'écrit dans un **Keychain partagé**.
2. **Extension** : lit le cookie dans le Keychain partagé, l'injecte dans le
   cookie store de son WebView, puis charge l'URL d'import.

App Group + Keychain Sharing sont les mécanismes **recommandés par Apple** pour
partager des données app ↔ extension.

---

## Phase 0 — Capabilities (🔧 manuel : portail + Xcode)

1. **Portail Apple Developer** : créer l'App Group `group.fr.anthonykocken.mijote`.
2. **Xcode**, sur les **DEUX** cibles (`App` et `ShareExtension`),
   onglet *Signing & Capabilities* :
   - **+ Capability → App Groups** → cocher `group.fr.anthonykocken.mijote`.
   - **+ Capability → Keychain Sharing** → groupe `fr.anthonykocken.mijote`.
3. Vérifier que la cible `ShareExtension` existe déjà (créée précédemment) avec :
   - Bundle id `fr.anthonykocken.mijote.ShareExtension`, Team `7H527R9HJJ`,
     iOS 15, signing Automatic.
   - `Info.plist` : `NSExtensionPrincipalClass = $(PRODUCT_MODULE_NAME).ShareViewController`
     + règle d'activation `NSExtensionActivationSupportsWebURLWithMaxCount = 1`
     et `NSExtensionActivationSupportsText = true`. (Déjà en place.)

> La règle d'activation est ce qui fait **apparaître Mijote** dans la share
> sheet — c'est le mécanisme Apple, on n'y touche pas.

---

## Phase 1 — Exporter le cookie de session vers le Keychain partagé (💻 cible App)

Côté natif app : à `applicationDidEnterBackground` / `didBecomeActive`, lire le
cookie `atable_session` du WebView et l'écrire dans le Keychain partagé.

- Lecture : `WKWebsiteDataStore.default().httpCookieStore.getAllCookies { … }`
  → filtrer `name == "atable_session"`.
- Écriture : Keychain, `kSecAttrAccessGroup = "<TeamID>.fr.anthonykocken.mijote"`.

⚠️ À vérifier tôt : que la WebView Capacitor utilise bien
`WKWebsiteDataStore.default()` (sinon on lit le mauvais store).

Testable isolément : poser un log de la valeur écrite, vérifier qu'elle arrive
dans le Keychain.

---

## Phase 2 — `ShareViewController` qui héberge le WebView (💻 cible ShareExtension)

Remplacer l'extension sans-UI (l'actuel `ShareViewController.swift`, hérité de
l'approche openURL — **à jeter**) par un `UIViewController` qui :

- présente une **barre de nav** (« Annuler » + titre « Importer dans Mijote »),
- extrait l'URL partagée (la logique d'extraction actuelle est correcte et
  réutilisable),
- lit le cookie depuis le Keychain partagé et l'injecte dans
  `webView.configuration.websiteDataStore.httpCookieStore`,
- charge `https://<host>/recipes/new?import=url&url=<encodé>&ext=1`,
- **dismiss auto au succès** : la page web appelle
  `window.webkit.messageHandlers.mijoteExt.postMessage("done")` après save →
  le natif (via `WKScriptMessageHandler`) ferme l'extension,
- cas **pas de session** (jamais connecté) → message « Ouvre Mijote et
  connecte-toi d'abord ».

---

## Phase 3 — Adaptations web (💻 réutilise l'existant)

- L'auto-import depuis `?import=url&url=…` est **déjà codé** (`NewRecipeFlow` +
  `ImportSelector` + `ImportLoading`).
- Ajouter le flag `?ext=1` :
  - masque le chrome (nav / bottom bar) pour un formulaire focalisé,
  - après un enregistrement réussi, `postMessage("done")` vers le natif.
- ~20 lignes, pas de refonte.

---

## Phase 4 — Host prod / staging (💻)

L'extension charge la **même origine** que le build (prod
`https://mijote.anthonykocken.fr` ou staging
`https://staging.mijote.anthonykocken.fr`), en miroir de `capacitor.config.ts`.

---

## Phase 5 — Image (lot suivant, se greffe sans rework)

Même `ShareViewController` + WebView. La règle d'activation ajoute l'image ;
l'image passe au web via `postMessage` (base64) vers le flow screenshot
existant. À détailler le moment venu.

---

## Soumission App Store

- Bumper `CURRENT_PROJECT_VERSION` (nouveau binaire avec extension → review).
- `Product > Archive` → upload. Fiche App Store **unique**, l'extension est
  embarquée.
- Conforme : WebView de notre propre site, App Group + Keychain Sharing,
  **aucune API privée**.

---

## Risques résiduels à valider

1. **Capacitor & cookie store** — confirmer `WKWebsiteDataStore.default()`.
2. **Mémoire sur device réel** — le WKWebView est hors-process (OK en théorie),
   à valider sur iPhone physique. Repli éventuel : formulaire natif Swift.

---

## Historique

L'approche initiale (v1) ouvrait l'app via un scheme custom `mijote://import`
puis routait dans `DeepLinkHandler`. **Abandonnée** : iOS ≥ 18 interdit à une
Share Extension d'ouvrir son app conteneur. Le scheme custom et la branche
`mijote://` de `DeepLinkHandler` ont été retirés. Tout le travail TS (loading
screen + auto-import via `?import=url&url=…`) est **conservé** : il est réutilisé
tel quel par le WebView de l'extension.

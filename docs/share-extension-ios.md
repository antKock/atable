# Share Extension iOS — « Mijote » dans la share sheet (cas URL)

Objectif : quand on partage une **URL** depuis une autre app (Instagram…),
« Mijote » apparaît dans la share sheet ; un tap ouvre l'app directement sur
l'import URL avec le lien pré-rempli.

Ce guide couvre **uniquement la partie native Xcode**. Le code TS/Next
(`DeepLinkHandler`, écran de loading, lecture du param `?import=url&url=…`) et
le scheme `mijote://` dans l'`Info.plist` principal sont gérés côté repo
séparément — voir la section « Pré-requis repo » en bas.

- Bundle app : `fr.anthonykocken.mijote`
- Bundle extension : `fr.anthonykocken.mijote.ShareExtension`
- Team ID : `7H527R9HJJ`
- Deployment target : **iOS 15.0**
- Pas d'App Group, pas de plugin (inutiles pour le cas URL).

---

## Étape 1 — Créer la cible Share Extension

1. Ouvrir `ios/App/App.xcworkspace` dans Xcode (le **workspace**, pas le
   `.xcodeproj`).
2. `File > New > Target…`
3. Choisir **Share Extension** (section iOS). `Next`.
4. Renseigner :
   - **Product Name** : `ShareExtension`
   - **Language** : Swift
   - Laisser le reste par défaut. `Finish`.
5. Si Xcode propose « Activate "ShareExtension" scheme? » → **Activate**.

Xcode crée un dossier `ShareExtension/` avec : `ShareViewController.swift`,
`Info.plist`, `MainInterface.storyboard`, `ShareExtension.entitlements`, et
ajoute la build phase « Embed App Extensions » sur le target `App`.

---

## Étape 2 — Régler le target de l'extension

Sélectionner le projet `App` dans le navigateur → target **ShareExtension** :

- Onglet **General** :
  - **Minimum Deployments / iOS** : `15.0`
- Onglet **Signing & Capabilities** :
  - **Automatically manage signing** : coché
  - **Team** : `Anthony Kocken (7H527R9HJJ)`
  - **Bundle Identifier** : `fr.anthonykocken.mijote.ShareExtension`

> Avec le signing automatique, l'App ID de l'extension est créé tout seul côté
> Apple Developer. **Aucune action sur le portail nécessaire** (on n'utilise pas
> d'App Group).

---

## Étape 3 — Supprimer le storyboard (UI inutile)

On veut une extension **sans interface** : tap → l'app s'ouvre direct. On retire
le storyboard fourni par le template.

1. Dans `ShareExtension/`, sélectionner **`MainInterface.storyboard`** →
   `Delete` → **Move to Trash**.

---

## Étape 4 — Remplacer `ShareViewController.swift`

Ouvrir `ShareExtension/ShareViewController.swift` et **remplacer tout le
contenu** par :

```swift
import UIKit
import UniformTypeIdentifiers

// Share Extension sans UI : extrait l'URL partagée, ouvre l'app hôte via le
// scheme custom mijote://import?url=<encodé>, puis se ferme immédiatement.
class ShareViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        extractSharedURL { [weak self] url in
            guard let self = self else { return }
            if let url = url {
                self.openMainApp(with: url)
            }
            self.extensionContext?.completeRequest(returningItems: nil)
        }
    }

    private func extractSharedURL(completion: @escaping (URL?) -> Void) {
        guard
            let item = extensionContext?.inputItems.first as? NSExtensionItem,
            let providers = item.attachments
        else { completion(nil); return }

        // 1) Pièce jointe de type URL (cas le plus courant).
        if let p = providers.first(where: {
            $0.hasItemConformingToTypeIdentifier(UTType.url.identifier)
        }) {
            p.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { data, _ in
                DispatchQueue.main.async { completion(data as? URL) }
            }
            return
        }

        // 2) Fallback : texte contenant un lien (Instagram partage parfois du texte).
        if let p = providers.first(where: {
            $0.hasItemConformingToTypeIdentifier(UTType.text.identifier)
        }) {
            p.loadItem(forTypeIdentifier: UTType.text.identifier, options: nil) { data, _ in
                let url = (data as? String).flatMap { Self.firstURL(in: $0) }
                DispatchQueue.main.async { completion(url) }
            }
            return
        }

        completion(nil)
    }

    private static func firstURL(in text: String) -> URL? {
        let detector = try? NSDataDetector(
            types: NSTextCheckingResult.CheckingType.link.rawValue
        )
        let range = NSRange(text.startIndex..., in: text)
        guard
            let match = detector?.firstMatch(in: text, options: [], range: range),
            let r = Range(match.range, in: text)
        else { return nil }
        return URL(string: String(text[r]))
    }

    private func openMainApp(with sharedURL: URL) {
        var components = URLComponents()
        components.scheme = "mijote"
        components.host = "import"
        components.queryItems = [
            URLQueryItem(name: "url", value: sharedURL.absoluteString)
        ]
        guard let deepLink = components.url else { return }

        // UIApplication.shared est indisponible dans une extension :
        // on remonte la responder chain jusqu'à un objet qui sait ouvrir une URL.
        let selector = NSSelectorFromString("openURL:")
        var responder: UIResponder? = self
        while let r = responder {
            if r.responds(to: selector) {
                r.perform(selector, with: deepLink)
                return
            }
            responder = r.next
        }
    }
}
```

---

## Étape 5 — Configurer l'`Info.plist` de l'extension

Ouvrir `ShareExtension/Info.plist` (clic droit > Open As > Source Code pour
éditer le XML). Dans le dictionnaire **`NSExtension`**, faire deux choses :

1. **Supprimer** la clé `NSExtensionMainStoryboard` (elle pointe vers le
   storyboard qu'on a supprimé).
2. **Ajouter** `NSExtensionPrincipalClass` + la règle d'activation.

Le bloc `NSExtension` doit ressembler à ceci :

```xml
<key>NSExtension</key>
<dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.share-services</string>
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).ShareViewController</string>
    <key>NSExtensionAttributes</key>
    <dict>
        <key>NSExtensionActivationRule</key>
        <dict>
            <key>NSExtensionActivationSupportsWebURLWithMaxCount</key>
            <integer>1</integer>
            <key>NSExtensionActivationSupportsText</key>
            <true/>
        </dict>
    </dict>
</dict>
```

> C'est `NSExtensionActivationRule` qui fait **apparaître Mijote** dans la share
> sheet : ici pour 1 URL web, ou du texte (qui peut contenir un lien).

---

## Étape 6 — Build & test

1. En haut de Xcode, choisir le scheme **`App`** (pas `ShareExtension`) et un
   simulateur ou ton iPhone. `Cmd+R`.
2. **Test rapide (simulateur OK)** :
   - Ouvrir **Safari**, aller sur une page de recette.
   - Bouton Partager → la liste doit contenir **Mijote**.
   - Tap sur Mijote → l'app Mijote s'ouvre sur l'import URL pré-rempli.
3. **Test réel (device physique requis)** :
   - Depuis **Instagram**, ouvrir un Reel/post de recette → Partager → **Mijote**.
4. Vérifier les deux démarrages :
   - **App fermée** (cold start) puis partage.
   - **App déjà ouverte** (warm start) puis partage.

> Si Mijote n'apparaît pas : vérifier la règle d'activation (Étape 5) et que
> l'extension est bien dans « Embed App Extensions » du target `App`
> (target App > Build Phases).

> Si Mijote apparaît mais l'app ne s'ouvre pas : vérifier que le scheme
> `mijote` est bien déclaré dans l'`Info.plist` **principal** (voir Pré-requis
> repo).

---

## Étape 7 — Soumission App Store

- Bumper le build : target `App` > General > **Build** (`CURRENT_PROJECT_VERSION`),
  +1. (Ajouter une extension = nouveau binaire → passe en review.)
- `Product > Archive` → upload via l'Organizer.
- La fiche App Store reste **unique** : l'extension est embarquée, une seule
  soumission, une seule review.

---

## Pré-requis repo (géré côté code, hors Xcode)

Ces éléments sont/seront commités dans le repo — listés ici pour info :

1. **`ios/App/App/Info.plist`** — déclaration du scheme custom `mijote` :

   ```xml
   <key>CFBundleURLTypes</key>
   <array>
       <dict>
           <key>CFBundleURLName</key>
           <string>fr.anthonykocken.mijote</string>
           <key>CFBundleURLSchemes</key>
           <array>
               <string>mijote</string>
           </array>
       </dict>
   </array>
   ```

2. **`src/components/DeepLinkHandler.tsx`** — prise en charge de
   `mijote://import?url=…` → `router.push('/recipes/new?import=url&url=…')`.

3. **`NewRecipeFlow` / écran de loading** — lecture de `?import=url&url=…`,
   affichage d'un loading plein écran, auto-import, puis formulaire pré-rempli.

> `AppDelegate.swift` n'a **aucune** modification à recevoir : il délègue déjà
> l'ouverture d'URL au proxy Capacitor, qui émet l'event `appUrlOpen`.

---

## Notes / pièges

- `npx cap sync ios` **ne supprime pas** le target ajouté (il ne touche qu'aux
  assets web + SPM). Penser quand même à **commiter** `project.pbxproj` après
  création du target.
- La responder-chain + `openURL:` est le pattern standard et accepté pour
  ouvrir l'app hôte depuis une Share Extension.
- Pour partager une **image** plus tard (lot 2) : là il faudra un **App Group**
  (`group.fr.anthonykocken.mijote`, à enregistrer côté portail + activer sur les
  deux targets) **et** un mini-plugin Capacitor — hors périmètre de ce guide.
```

import UIKit
import WebKit
import UniformTypeIdentifiers

// Partagé avec l'app via l'App Group (cf. AppDelegate.mirrorSessionCookieToAppGroup).
private let appGroupID = "group.fr.anthonykocken.mijote"
private let sessionCookieName = "atable_session"

// Couleurs de marque (cf. src/app/globals.css).
private extension UIColor {
    static let mijoteCream = UIColor(red: 0xF5/255, green: 0xF1/255, blue: 0xE8/255, alpha: 1)
    static let mijoteInk = UIColor(red: 0x1A/255, green: 0x1A/255, blue: 0x18/255, alpha: 1)
    static let mijoteAccent = UIColor(red: 0x6E/255, green: 0x7A/255, blue: 0x38/255, alpha: 1)
}

// Share Extension AVEC UI (modèle « Messenger ») : présente une feuille Mijote
// sur place, héberge un WKWebView authentifié (cookie réinjecté depuis l'App
// Group) qui charge le flow d'import web existant. Ne tente PAS d'ouvrir l'app
// conteneur (interdit par iOS ≥ 18).
class ShareViewController: UIViewController, WKScriptMessageHandler {

    private var navBar: UINavigationBar!
    private var webView: WKWebView!
    private var didStart = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .mijoteCream
        setupNavBar()
        setupWebView()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !didStart else { return }
        didStart = true
        extractSharedURL { [weak self] sharedURL in
            guard let self = self else { return }
            guard let sharedURL = sharedURL else {
                self.showMessage("Aucun lien à importer n'a été trouvé.")
                return
            }
            self.startImport(sharedURL)
        }
    }

    // MARK: - UI

    private func setupNavBar() {
        let navBar = UINavigationBar()
        navBar.translatesAutoresizingMaskIntoConstraints = false

        // Thème marque : fond crème, titre encre, bouton accent.
        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = .mijoteCream
        appearance.shadowColor = .clear
        appearance.titleTextAttributes = [.foregroundColor: UIColor.mijoteInk]
        navBar.standardAppearance = appearance
        navBar.scrollEdgeAppearance = appearance
        navBar.tintColor = .mijoteAccent

        let item = UINavigationItem(title: "Importer dans Mijote")
        item.leftBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .cancel, target: self, action: #selector(cancel)
        )
        navBar.items = [item]
        view.addSubview(navBar)
        NSLayoutConstraint.activate([
            navBar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            navBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            navBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        self.navBar = navBar
    }

    private func setupWebView() {
        let contentController = WKUserContentController()
        // La page web signale la fin (recette enregistrée) via
        // window.webkit.messageHandlers.mijoteExt.postMessage("done").
        contentController.add(self, name: "mijoteExt")
        let config = WKWebViewConfiguration()
        config.userContentController = contentController

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: navBar.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        self.webView = webView
    }

    private func showMessage(_ text: String) {
        let label = UILabel()
        label.text = text
        label.numberOfLines = 0
        label.textAlignment = .center
        label.textColor = .secondaryLabel
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            label.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 32),
            label.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -32),
        ])
    }

    // MARK: - Import

    private func startImport(_ sharedURL: URL) {
        guard
            let defaults = UserDefaults(suiteName: appGroupID),
            let token = defaults.string(forKey: sessionCookieName),
            let domain = defaults.string(forKey: "\(sessionCookieName)_domain")
        else {
            showMessage("Ouvre Mijote et connecte-toi d'abord, puis réessaie.")
            return
        }

        guard let cookie = HTTPCookie(properties: [
            .domain: domain,
            .path: "/",
            .name: sessionCookieName,
            .value: token,
            .secure: true,
        ]) else {
            showMessage("Session illisible.")
            return
        }

        var comps = URLComponents()
        comps.scheme = "https"
        comps.host = domain
        comps.path = "/recipes/new"
        comps.queryItems = [
            URLQueryItem(name: "import", value: "url"),
            URLQueryItem(name: "url", value: sharedURL.absoluteString),
            URLQueryItem(name: "ext", value: "1"),
        ]
        guard let importURL = comps.url else {
            showMessage("Lien invalide.")
            return
        }

        // Injecter le cookie AVANT de charger, puis charger.
        let store = webView.configuration.websiteDataStore.httpCookieStore
        store.setCookie(cookie) { [weak self] in
            self?.webView.load(URLRequest(url: importURL))
        }
    }

    // MARK: - Actions

    @objc private func cancel() {
        extensionContext?.completeRequest(returningItems: nil)
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        // La recette a été enregistrée côté web → on ferme la feuille.
        if message.name == "mijoteExt" {
            extensionContext?.completeRequest(returningItems: nil)
        }
    }

    // MARK: - Extraction de l'URL partagée

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
}

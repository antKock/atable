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
                self.showMessage(NSLocalizedString("share.noLink", comment: "Share sheet: no URL in the shared item"))
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

        let item = UINavigationItem(title: NSLocalizedString("share.title", comment: "Share sheet title"))
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
            showMessage(NSLocalizedString("share.notSignedIn", comment: "Share sheet: no session cookie in the app group"))
            return
        }

        guard let cookie = HTTPCookie(properties: [
            .domain: domain,
            .path: "/",
            .name: sessionCookieName,
            .value: token,
            .secure: true,
        ]) else {
            showMessage(NSLocalizedString("share.badSession", comment: "Share sheet: cookie could not be built"))
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
        // Instagram : le téléphone lit aussi la page publique, en parallèle du
        // chargement de la page d'import (cf. InstagramRelay). `igref` relie les deux.
        let igRef = InstagramRelay.accepts(sharedURL) ? UUID().uuidString.lowercased() : nil
        if let igRef = igRef {
            comps.queryItems?.append(URLQueryItem(name: "igref", value: igRef))
        }
        guard let importURL = comps.url else {
            showMessage(NSLocalizedString("share.badLink", comment: "Share sheet: import URL could not be built"))
            return
        }
        if let igRef = igRef {
            InstagramRelay.relay(sharedURL, ref: igRef, domain: domain, sessionToken: token)
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

// MARK: - Instagram lu par le téléphone

// Chantier « Instagram sans Apify », étape 2 (docs/specs/instagram/00-socle.md §2.2).
// Instagram peut bloquer l'adresse du serveur ; le téléphone, lui, lit la page
// publique partagée depuis la connexion de l'utilisateur. L'extension la
// télécharge SANS l'analyser et la poste (compressée) au serveur, qui en extrait
// la légende : un changement de format d'Instagram se corrige côté serveur, sans
// nouvelle version. Au mieux en quelques secondes, sinon rien : le serveur
// attend au plus 3 s puis lit la page lui-même. Aucun effet visible.
private enum InstagramRelay {
    private static let maxPageBytes = 3_000_000
    private static let maxUploadBytes = 1_500_000

    // Éphémère : aucun cookie Instagram, rien ne persiste. Délais courts.
    private static let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 4
        config.timeoutIntervalForResource = 6
        config.httpShouldSetCookies = false
        config.httpCookieAcceptPolicy = .never
        config.urlCache = nil
        return URLSession(configuration: config)
    }()

    static func accepts(_ url: URL) -> Bool {
        guard url.scheme == "https", let host = url.host?.lowercased() else { return false }
        return host == "instagram.com" || host.hasSuffix(".instagram.com") || host == "instagr.am"
    }

    // Safari iPhone : la page publique contient alors la légende (og:description).
    private static var userAgent: String {
        let v = UIDevice.current.systemVersion.replacingOccurrences(of: ".", with: "_")
        return "Mozilla/5.0 (iPhone; CPU iPhone OS \(v) like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
    }

    static func relay(_ pageURL: URL, ref: String, domain: String, sessionToken: String) {
        var get = URLRequest(url: pageURL)
        get.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        get.setValue(Locale.preferredLanguages.prefix(2).joined(separator: ","), forHTTPHeaderField: "Accept-Language")
        session.dataTask(with: get) { data, response, error in
            guard
                error == nil,
                let data = data,
                let http = response as? HTTPURLResponse,
                http.statusCode == 200,
                data.count <= maxPageBytes
            else { return }

            var comps = URLComponents()
            comps.scheme = "https"
            comps.host = domain
            comps.path = "/api/instagram/page"
            comps.queryItems = [
                URLQueryItem(name: "ref", value: ref),
                // URL finale (après les redirections des liens courts).
                URLQueryItem(name: "url", value: (http.url ?? pageURL).absoluteString),
            ]
            guard let postURL = comps.url else { return }

            var post = URLRequest(url: postURL)
            post.httpMethod = "POST"
            post.timeoutInterval = 3
            post.setValue("text/html; charset=utf-8", forHTTPHeaderField: "Content-Type")
            post.setValue("\(sessionCookieName)=\(sessionToken)", forHTTPHeaderField: "Cookie")
            // Deflate brut (Apple « zlib » = RFC 1951 sans en-tête) : ≈ 4,5× moins à envoyer (763 → 168 Ko mesurés).
            if let packed = try? (data as NSData).compressed(using: .zlib) as Data {
                post.setValue("deflate-raw", forHTTPHeaderField: "X-Mijote-Body-Encoding")
                post.httpBody = packed
            } else {
                post.httpBody = data
            }
            guard (post.httpBody?.count ?? 0) <= maxUploadBytes else { return }
            session.dataTask(with: post).resume()
        }.resume()
    }
}

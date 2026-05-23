import UIKit
import Capacitor
import WebKit

/// Capacitor bridge view controller that swaps in `public/offline.html`
/// (bundled by `cap sync`) when the WebView fails to load the remote
/// server.url due to a network-level error.
///
/// Wired to `Base.lproj/Main.storyboard` via `customClass="MainViewController"`.
/// We become the WKWebView's navigationDelegate and forward every call to
/// Capacitor's original delegate so cookies, plugins and deep links keep
/// working unchanged.
class MainViewController: CAPBridgeViewController {

    /// Capacitor's internal navigation delegate, captured the moment the
    /// WebView is ready.
    private weak var capacitorDelegate: WKNavigationDelegate?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let webView = bridge?.webView else { return }
        capacitorDelegate = webView.navigationDelegate
        webView.navigationDelegate = self
    }
}

extension MainViewController: WKNavigationDelegate {

    // MARK: - Methods we intercept

    func webView(_ webView: WKWebView,
                 didFailProvisionalNavigation navigation: WKNavigation!,
                 withError error: Error) {
        capacitorDelegate?.webView?(webView,
                                    didFailProvisionalNavigation: navigation,
                                    withError: error)
        loadOfflineFallbackIfNeeded(into: webView, after: error)
    }

    func webView(_ webView: WKWebView,
                 didFail navigation: WKNavigation!,
                 withError error: Error) {
        capacitorDelegate?.webView?(webView,
                                    didFail: navigation,
                                    withError: error)
        loadOfflineFallbackIfNeeded(into: webView, after: error)
    }

    // MARK: - Pure forwarding (optional WKNavigationDelegate methods)

    func webView(_ webView: WKWebView,
                 didStartProvisionalNavigation navigation: WKNavigation!) {
        capacitorDelegate?.webView?(webView, didStartProvisionalNavigation: navigation)
    }

    func webView(_ webView: WKWebView,
                 didReceiveServerRedirectForProvisionalNavigation navigation: WKNavigation!) {
        capacitorDelegate?.webView?(webView,
                                    didReceiveServerRedirectForProvisionalNavigation: navigation)
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        capacitorDelegate?.webView?(webView, didCommit: navigation)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        capacitorDelegate?.webView?(webView, didFinish: navigation)
    }

    // MARK: - Forwarding methods that have a required completion handler
    //
    // For these, we MUST guarantee the handler is called exactly once. If
    // Capacitor's delegate implements the method, we let it call the handler;
    // otherwise we fall back to the default decision so the request is not
    // stuck waiting for a response that never comes.

    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let selector = Selector(("webView:decidePolicyForNavigationAction:decisionHandler:"))
        if let delegate = capacitorDelegate, delegate.responds(to: selector) {
            delegate.webView?(webView,
                              decidePolicyFor: navigationAction,
                              decisionHandler: decisionHandler)
        } else {
            decisionHandler(.allow)
        }
    }

    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        let selector = Selector(("webView:decidePolicyForNavigationResponse:decisionHandler:"))
        if let delegate = capacitorDelegate, delegate.responds(to: selector) {
            delegate.webView?(webView,
                              decidePolicyFor: navigationResponse,
                              decisionHandler: decisionHandler)
        } else {
            decisionHandler(.allow)
        }
    }

    func webView(_ webView: WKWebView,
                 didReceive challenge: URLAuthenticationChallenge,
                 completionHandler: @escaping (URLSession.AuthChallengeDisposition,
                                               URLCredential?) -> Void) {
        let selector = Selector(("webView:didReceiveAuthenticationChallenge:completionHandler:"))
        if let delegate = capacitorDelegate, delegate.responds(to: selector) {
            delegate.webView?(webView,
                              didReceive: challenge,
                              completionHandler: completionHandler)
        } else {
            completionHandler(.performDefaultHandling, nil)
        }
    }

    // MARK: - Fallback logic

    /// Loads `offline.html` from the app bundle when the failure is clearly a
    /// network problem (offline, DNS, host unreachable, timeout). Server-side
    /// 4xx/5xx errors fall through untouched — the user will see whatever the
    /// remote site rendered.
    private func loadOfflineFallbackIfNeeded(into webView: WKWebView, after error: Error) {
        let nsError = error as NSError
        guard nsError.domain == NSURLErrorDomain else { return }

        switch nsError.code {
        case NSURLErrorNotConnectedToInternet,
             NSURLErrorNetworkConnectionLost,
             NSURLErrorTimedOut,
             NSURLErrorCannotFindHost,
             NSURLErrorCannotConnectToHost,
             NSURLErrorDataNotAllowed,
             NSURLErrorInternationalRoamingOff,
             NSURLErrorDNSLookupFailed:
            break
        default:
            return
        }

        guard let url = Bundle.main.url(forResource: "offline", withExtension: "html") else {
            return
        }
        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }
}

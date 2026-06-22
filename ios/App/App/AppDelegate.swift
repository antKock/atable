import UIKit
import Capacitor
import WebKit

// Partagé avec la Share Extension via l'App Group : l'app y miroite le cookie
// de session, l'extension le réinjecte dans son propre WKWebView pour être
// authentifiée. Le domaine est stocké aussi pour que l'extension sache quel
// host charger (prod/staging) sans configuration en dur.
private let appGroupID = "group.fr.anthonykocken.mijote"
private let sessionCookieName = "atable_session"

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    // Lit le cookie de session du WebView et l'écrit dans l'App Group.
    // getAllCookies rend la main sur la main queue.
    private func mirrorSessionCookieToAppGroup() {
        WKWebsiteDataStore.default().httpCookieStore.getAllCookies { cookies in
            guard
                let cookie = cookies.first(where: { $0.name == sessionCookieName }),
                let defaults = UserDefaults(suiteName: appGroupID)
            else { return }
            defaults.set(cookie.value, forKey: sessionCookieName)
            defaults.set(cookie.domain, forKey: "\(sessionCookieName)_domain")
            NSLog("[Mijote] cookie de session miroité (domain=%@, len=%d)",
                  cookie.domain, cookie.value.count)
        }
    }

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
        mirrorSessionCookieToAppGroup()
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
        mirrorSessionCookieToAppGroup()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

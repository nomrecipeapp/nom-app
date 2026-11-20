import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        ShareInbox.moveToApp()

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        ShareInbox.moveToApp()
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    // Nom coming back from the background (for example after Share to Nom opened it)
    func sceneWillEnterForeground(_ scene: UIScene) {
        ShareInbox.moveToApp()
    }
}

// Share to Nom: the share extension (ShareExtension/ShareViewController.swift) leaves
// shared links in the App Group. This moves them into the storage the Preferences
// plugin reads ("CapacitorStorage." + key), where src/shareInbox.js picks them up.
// Safe before the App Group is set up: it just finds nothing.
enum ShareInbox {
    static let appGroup = "group.com.nomrecipeapp.nom"
    static let groupKey = "shareInbox"
    static let appKey = "CapacitorStorage.nom-share-inbox"

    static func moveToApp() {
        guard let shared = UserDefaults(suiteName: appGroup),
              let links = shared.stringArray(forKey: groupKey), !links.isEmpty else { return }
        var all: [String] = []
        if let existing = UserDefaults.standard.string(forKey: appKey),
           let data = existing.data(using: .utf8),
           let list = try? JSONSerialization.jsonObject(with: data) as? [String] {
            all = list
        }
        all.append(contentsOf: links)
        guard let data = try? JSONSerialization.data(withJSONObject: all),
              let json = String(data: data, encoding: .utf8) else { return }
        UserDefaults.standard.set(json, forKey: appKey)
        shared.removeObject(forKey: groupKey)
    }
}

import UIKit
import UniformTypeIdentifiers

// Share to Nom: the card that shows up when someone taps Nom in the share sheet
// (TikTok, Instagram, Safari, anywhere with a link).
// 1. Finds the link in what was shared.
// 2. Saves it in the App Group, a spot Nom can read too, so it's never lost.
// 3. Opens Nom, which lands on Add with the link importing.
// If Nom can't be opened, the link waits and opens in Add the next time Nom opens.
class ShareViewController: UIViewController {
    private let appGroup = "group.com.nomrecipeapp.nom"
    private let inboxKey = "shareInbox"
    private let openNomLink = URL(string: "nomrecipeapp://share")!

    private let card = UIView()
    private let label = UILabel()
    private var started = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear

        card.backgroundColor = UIColor(red: 0.99, green: 0.98, blue: 0.96, alpha: 1)
        card.layer.cornerRadius = 20
        card.layer.shadowColor = UIColor.black.cgColor
        card.layer.shadowOpacity = 0.12
        card.layer.shadowRadius = 16
        card.layer.shadowOffset = CGSize(width: 0, height: 4)
        card.translatesAutoresizingMaskIntoConstraints = false

        label.text = "Saving to Nom..."
        label.font = .systemFont(ofSize: 17, weight: .semibold)
        label.textColor = UIColor(red: 0.16, green: 0.15, blue: 0.13, alpha: 1)
        label.numberOfLines = 0
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(card)
        card.addSubview(label)
        NSLayoutConstraint.activate([
            card.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            card.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            card.widthAnchor.constraint(equalToConstant: 280),
            label.topAnchor.constraint(equalTo: card.topAnchor, constant: 24),
            label.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -24),
            label.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            label.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !started else { return }
        started = true
        Task { await shareToNom() }
    }

    private func shareToNom() async {
        guard let link = await findLink() else {
            show("Couldn't find a link here. Try Copy link, then paste it into Add in Nom.", closeAfter: 3)
            return
        }
        saveForNom(link)
        show("Saved to Nom! Opening Nom...", closeAfter: nil)
        if openNom() {
            try? await Task.sleep(nanoseconds: 400_000_000)
            close()
        } else {
            show("Saved to Nom! Open Nom to finish adding it.", closeAfter: 2.5)
        }
    }

    // MARK: Find the link

    private func findLink() async -> URL? {
        let items = extensionContext?.inputItems as? [NSExtensionItem] ?? []
        let providers = items.flatMap { $0.attachments ?? [] }
        for type in [UTType.url.identifier, UTType.plainText.identifier] {
            for provider in providers where provider.hasItemConformingToTypeIdentifier(type) {
                if let text = await Self.loadText(provider, type), let url = Self.firstLink(in: text) {
                    return url
                }
            }
        }
        // Some apps put the shared text on the item itself
        for item in items {
            if let text = item.attributedContentText?.string, let url = Self.firstLink(in: text) {
                return url
            }
        }
        return nil
    }

    private nonisolated static func loadText(_ provider: NSItemProvider, _ type: String) async -> String? {
        await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: type, options: nil) { item, _ in
                if let url = item as? URL {
                    continuation.resume(returning: url.absoluteString)
                } else if let text = item as? String {
                    continuation.resume(returning: text)
                } else if let data = item as? Data {
                    continuation.resume(returning: String(data: data, encoding: .utf8))
                } else {
                    continuation.resume(returning: nil)
                }
            }
        }
    }

    // The first web link in some text (TikTok and Instagram sometimes share a sentence with the link inside)
    private static func firstLink(in text: String) -> URL? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if let url = URL(string: trimmed), ["http", "https"].contains(url.scheme?.lowercased() ?? "") {
            return url
        }
        guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) else { return nil }
        let range = NSRange(text.startIndex..., in: text)
        return detector.matches(in: text, range: range)
            .compactMap { $0.url }
            .first { ["http", "https"].contains($0.scheme?.lowercased() ?? "") }
    }

    // MARK: Hand it to Nom

    private func saveForNom(_ link: URL) {
        guard let shared = UserDefaults(suiteName: appGroup) else { return }
        var links = shared.stringArray(forKey: inboxKey) ?? []
        links.append(link.absoluteString)
        shared.set(Array(links.suffix(50)), forKey: inboxKey)
    }

    // Apple doesn't give share extensions a way to open their app, so this walks up to
    // the app object and asks it to open nomrecipeapp://share (the common workaround).
    // If it ever stops working, the saved link still opens in Add next time Nom opens.
    private func openNom() -> Bool {
        let selector = NSSelectorFromString("openURL:options:completionHandler:")
        guard let appClass = NSClassFromString("UIApplication") else { return false }
        var responder: UIResponder? = self
        while let current = responder {
            if current.isKind(of: appClass), current.responds(to: selector) {
                typealias OpenURL = @convention(c) (NSObject, Selector, NSURL, NSDictionary, AnyObject?) -> Void
                let open = unsafeBitCast(current.method(for: selector), to: OpenURL.self)
                open(current, selector, openNomLink as NSURL, NSDictionary(), nil)
                return true
            }
            responder = current.next
        }
        return false
    }

    // MARK: Card

    private func show(_ message: String, closeAfter seconds: Double?) {
        label.text = message
        guard let seconds else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds) { [weak self] in self?.close() }
    }

    private func close() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}

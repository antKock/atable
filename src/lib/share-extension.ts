// Bridge to the native iOS Share Extension host (ios/App/ShareExtension/
// ShareViewController.swift). The extension loads the import flow in a WKWebView
// with ?ext=1 and registers a "mijoteExt" WKScriptMessageHandler; once a recipe
// is saved we post "done" so the extension dismisses its sheet automatically.

/** Tells the hosting Share Extension (if any) that the work is finished. No-op
 *  in a normal browser / the native app, where the handler doesn't exist. */
export function notifyShareExtensionDone(): void {
  const handler = (
    window as unknown as {
      webkit?: {
        messageHandlers?: { mijoteExt?: { postMessage: (msg: string) => void } };
      };
    }
  ).webkit?.messageHandlers?.mijoteExt;
  handler?.postMessage("done");
}

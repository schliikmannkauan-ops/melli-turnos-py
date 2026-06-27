// Guarded service worker registration.
// Skips Lovable preview, dev, iframes, and supports ?sw=off kill switch.
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const url = new URL(window.location.href);
  const host = window.location.hostname;
  const inIframe = window.self !== window.top;
  const isPreviewHost =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");
  const killSwitch = url.searchParams.get("sw") === "off";

  if (!import.meta.env.PROD || inIframe || isPreviewHost || killSwitch) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        regs
          .filter((r) => r.active?.scriptURL.endsWith("/sw.js"))
          .forEach((r) => r.unregister());
      })
      .catch(() => undefined);
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

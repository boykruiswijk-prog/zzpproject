// E-aanvulling 3 remains preview-only until Boy reviews it.
export function cyberToevoegenPreview(hostname = typeof window === "undefined" ? "" : window.location.hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".lovable.app");
}
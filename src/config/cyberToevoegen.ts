// E4 vrijgegeven 23-10 na groene testcontrole.
export const CYBER_TOEVOEGEN_PUBLIEK = true;

export function cyberToevoegenPreview(hostname = typeof window === "undefined" ? "" : window.location.hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return CYBER_TOEVOEGEN_PUBLIEK || host === "localhost" || host === "127.0.0.1" || host.endsWith(".lovable.app");
}
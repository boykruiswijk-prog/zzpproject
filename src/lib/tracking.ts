/**
 * GA4-meting via gtag (Consent Mode v2 uit index.html bepaalt wat er mag).
 * Interne omgevingen (/admin, /portal, /mijn-zp) sturen nooit iets naar GA4.
 */

export const GA_ID = "G-YY7YJFFEZN";

type Params = Record<string, string | number | boolean | undefined | unknown[]>;

/** Paden die nooit gemeten worden (ook met taalprefix). */
export function isNietGemetenPad(pathname: string): boolean {
  const p = pathname.replace(/^\/(nl|en|de|fr)(?=\/|$)/, "") || "/";
  return ["/admin", "/portal", "/mijn-zp"].some((x) => p === x || p.startsWith(`${x}/`));
}

/** Zet de officiële GA-opt-out-vlag voor het huidige pad (blokkeert ook automatische pageviews). */
export function zetGaUitschakeling(pathname: string) {
  if (typeof window === "undefined") return;
  (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = isNietGemetenPad(pathname);
}

export function trackGa(event: string, params: Params = {}) {
  if (typeof window === "undefined") return;
  if (isNietGemetenPad(window.location.pathname)) return;
  const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
  if (typeof gtag === "function") gtag("event", event, params);
  if (import.meta.env.DEV) console.log(`[Track] ${event}`, params);
}

interface TrackingEvent {
  action: string;
  category: string;
  label?: string;
  value?: number;
}

export function trackEvent({ action, category, label, value }: TrackingEvent) {
  trackGa(action, { event_category: category, event_label: label, value });
}

// ── Contactklikken: één globale listener voor ALLE tel:- en wa.me-links ──
let contactListener = false;
export function installeerContactKlikMeting() {
  if (typeof document === "undefined" || contactListener) return;
  contactListener = true;
  document.addEventListener(
    "click",
    (e) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") || "";
      const page = window.location.pathname;
      if (href.startsWith("tel:")) trackGa("phone_click", { page, link_text: (a.textContent || "").trim().slice(0, 60) });
      else if (/^https?:\/\/(api\.)?wa\.me\//.test(href)) trackGa("whatsapp_click", { page });
    },
    { capture: true },
  );
}

/** @deprecated gemeten via installeerContactKlikMeting (voorkomt dubbele events). */
export const trackPhone = () => {};
/** @deprecated gemeten via installeerContactKlikMeting (voorkomt dubbele events). */
export const trackWhatsApp = () => {};

export const trackCTA = (label: string) => {
  trackEvent({ action: "cta_click", category: "conversion", label });
  if (label.includes("gesprek") || label.includes("advies")) {
    trackEvent({ action: "adviesgesprek_click", category: "lead", label: "adviesgesprek CTA geklikt" });
  }
};

export const trackFormStart = (form: string) =>
  trackEvent({ action: "form_start", category: "lead", label: form });

export const trackFormComplete = (form: string) =>
  trackEvent({ action: "form_complete", category: "lead", label: form });

export const trackQualificationResult = (qualified: boolean, branch: string) =>
  trackEvent({ action: qualified ? "qualified" : "not_qualified", category: "qualification", label: branch });

export const trackContactFormSubmit = () =>
  trackEvent({ action: "contact_form_submit", category: "lead", label: "contactformulier verzonden" });

// ── BAV-wizard (geen persoonsgegevens in parameters) ──
const page = () => (typeof window === "undefined" ? "" : window.location.pathname);

export const trackBeginCheckout = (pakket: string, sector: string) =>
  trackGa("begin_checkout", { pakket, page: page(), sector: sector || "(nog niet gekozen)" });

export const trackWizardStep = (step: number, step_name: string) =>
  trackGa("wizard_step", { step, step_name, page: page() });

export const trackWizardValidationError = (step: number, veldnaam: string) =>
  trackGa("wizard_validation_error", { step, veldnaam, page: page() });

export const trackAddPaymentInfo = (pakket: string, value: number) =>
  trackGa("add_payment_info", { payment_type: "sepa", pakket, value, currency: "EUR" });

export const trackPurchase = (transactionId: string, pakketId: string, pakketNaam: string, value: number) =>
  trackGa("purchase", {
    transaction_id: transactionId,
    value,
    currency: "EUR",
    items: [{ item_id: pakketId, item_name: pakketNaam, price: value, quantity: 1 }],
  });

export type LeadFormulier = "offerte" | "contact" | "terugbel" | "aanvraag";
export const trackGenerateLead = (formulier: LeadFormulier) =>
  trackGa("generate_lead", { formulier, page: page() });

// ── Chat Zeker ──
export const trackChatOpen = () => trackGa("chat_open", { page: page() });
export const trackChatHandoff = (methode: string) => trackGa("chat_handoff", { methode, page: page() });

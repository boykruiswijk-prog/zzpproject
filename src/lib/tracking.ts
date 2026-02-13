/**
 * Lightweight CTA event tracking utility.
 * Events are logged to console in dev and can be wired to
 * Google Analytics / PostHog / any analytics provider later.
 */

interface TrackingEvent {
  action: string;
  category: string;
  label?: string;
  value?: number;
}

export function trackEvent({ action, category, label, value }: TrackingEvent) {
  // Push to GA4 if available
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", action, {
      event_category: category,
      event_label: label,
      value,
    });
  }

  // Log in development
  if (import.meta.env.DEV) {
    console.log(`[Track] ${category} / ${action}${label ? ` — ${label}` : ""}`);
  }
}

// Pre-defined events for consistent naming
export const trackCTA = (label: string) =>
  trackEvent({ action: "cta_click", category: "conversion", label });

export const trackPhone = () =>
  trackEvent({ action: "phone_click", category: "contact", label: "023-201-0502" });

export const trackWhatsApp = () =>
  trackEvent({ action: "whatsapp_click", category: "contact", label: "whatsapp" });

export const trackFormStart = (form: string) =>
  trackEvent({ action: "form_start", category: "lead", label: form });

export const trackFormComplete = (form: string) =>
  trackEvent({ action: "form_complete", category: "lead", label: form });

export const trackQualificationResult = (qualified: boolean, branch: string) =>
  trackEvent({
    action: qualified ? "qualified" : "not_qualified",
    category: "qualification",
    label: branch,
  });

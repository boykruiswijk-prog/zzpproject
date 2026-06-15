// Centrale mapping voor lead-notificaties.
// Alle e-mails gaan naar info@zpzaken.nl tenzij hier per type overschreven.

export type LeadType =
  | "contact"
  | "bav"
  | "screening-basis"
  | "screening-uitgebreid"
  | "screening-compleet"
  | "mijn-zp-certificaat"
  | "mijn-zp-pauzeren"
  | "mijn-zp-documenten"
  | "verzekering-aanvraag";

export interface LeadNotificationConfig {
  recipient: string;
  replyTo?: string;
  ccUser?: boolean; // CC de gebruiker zelf
  subjectTemplate: (ref: string) => string;
  label: string;
}

export const LEAD_NOTIFICATIONS: Record<LeadType, LeadNotificationConfig> = {
  contact: {
    recipient: "info@zpzaken.nl",
    subjectTemplate: (ref) => `Nieuw contactverzoek via zpzaken.nl - ${ref}`,
    label: "Contactverzoek",
  },
  bav: {
    recipient: "info@zpzaken.nl",
    subjectTemplate: (ref) => `Nieuwe BAV-aanvraag via zpzaken.nl - ${ref}`,
    label: "BAV-aanvraag",
  },
  "screening-basis": {
    recipient: "info@zpzaken.nl",
    subjectTemplate: (ref) => `Nieuwe screening (Basis €49) via zpzaken.nl - ${ref}`,
    label: "Screening Basis",
  },
  "screening-uitgebreid": {
    recipient: "info@zpzaken.nl",
    subjectTemplate: (ref) => `Nieuwe screening (Uitgebreid €129) via zpzaken.nl - ${ref}`,
    label: "Screening Uitgebreid",
  },
  "screening-compleet": {
    recipient: "info@zpzaken.nl",
    subjectTemplate: (ref) => `Nieuwe screening (Compleet €179) via zpzaken.nl - ${ref}`,
    label: "Screening Compleet",
  },
  "mijn-zp-certificaat": {
    recipient: "info@zpzaken.nl",
    ccUser: true,
    subjectTemplate: (ref) => `Nieuwe certificaat-aanvraag via zpzaken.nl - ${ref}`,
    label: "Certificaat-aanvraag",
  },
  "mijn-zp-pauzeren": {
    recipient: "info@zpzaken.nl",
    ccUser: true,
    subjectTemplate: (ref) => `Nieuwe pauzeer-aanvraag via zpzaken.nl - ${ref}`,
    label: "Pauzeer-aanvraag",
  },
  "mijn-zp-documenten": {
    recipient: "info@zpzaken.nl",
    ccUser: true,
    subjectTemplate: (ref) => `Documenten opgevraagd via zpzaken.nl - ${ref}`,
    label: "Documenten opgevraagd",
  },
  "verzekering-aanvraag": {
    recipient: "info@zpzaken.nl",
    ccUser: true,
    subjectTemplate: (ref) => `Nieuwe verzekeringsaanvraag via zpzaken.nl - ${ref}`,
    label: "Verzekeringsaanvraag",
  },
};

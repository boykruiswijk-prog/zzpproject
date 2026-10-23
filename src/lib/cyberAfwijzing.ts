import { beoordeelCyber } from "../../supabase/functions/_shared/cyber";

export const CYBER_LATER_TEKST = "Je kunt je aanvraag voor de BAV + AVB gewoon afronden. Heb je dit later geregeld, dan voeg je cyber toe via Mijn ZP.";
const uitleg: Record<string, string> = {
  a: "Cyber kan niet bij de sectoren en werkzaamheden die in deze vraag staan.",
  b: "Cyber kan alleen als je een actief antivirusprogramma op al je apparaten hebt, ook op Apple-apparaten.",
  c: "Cyber kan alleen als je minimaal wekelijks een back-up van je belangrijke gegevens maakt, los van je computer of in de cloud.",
  d: "Cyber kan alleen als je updates en patches binnen 30 dagen installeert.",
  e: "Cyber kan alleen als het besturingssysteem op je apparaten nog wordt ondersteund.",
  f: "Cyber kan alleen als maximaal 10% van je omzet uit de VS of Canada komt en je geen vestiging buiten de EER of het VK hebt.",
};
export function cyberAfwijsRedenen(antwoorden: unknown) {
  return beoordeelCyber(antwoorden).redenen.map((id) => ({ id, tekst: uitleg[id] }));
}
export function cyberStapKeuze(antwoorden: unknown, zonderCyber = false) {
  const toets = beoordeelCyber(antwoorden);
  return { verder: toets.volledig && (toets.toegestaan || zonderCyber), cyber: toets.toegestaan && !zonderCyber };
}
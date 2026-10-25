// Waarom kan het team bij deze klantkaart geen BAV-certificaat genereren? null = niet geblokkeerd.
// Cyberinstellingen (zoals het cyberjaarmaximum) spelen hier nooit mee.
import { actiefKlantContract } from "../../supabase/functions/_shared/certificaatRegels";

type Contract = { type: string; status: string; eind_datum?: string | null };

export function certificaatBlokkadeReden(contracten: Contract[], vandaag: string): string | null {
  if (actiefKlantContract(contracten, vandaag)) return null;
  if (!contracten.some((c) => c.type === "verzekering")) {
    return "Bij deze klantkaart staat geen BAV + AVB-contract. Genereren kan alleen op de klantkaart waar het contract staat.";
  }
  return "Het verzekeringscontract van deze klant is opgezegd of afgelopen. Genereren is geblokkeerd.";
}

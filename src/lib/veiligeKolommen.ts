// Beveiligingscheck 2-11: teamrollen hebben geen leesrecht meer op IBAN-kolommen.
// Daarom nooit select("*") op deze tabellen; gebruik deze lijsten. Gemaskeerde IBAN en geldigheid
// komen uit RPC iban_maskers, het volledige IBAN alleen via de knop (RPC iban_inzien, gelogd).
import { supabase } from "@/integrations/supabase/client";

export const LEAD_KOLOMMEN = "id,created_at,updated_at,type,status,voornaam,achternaam,email,telefoon,geboortedatum,bedrijfsnaam,kvk_nummer,beroep,omzet,verzekering_type,verzekerd_bedrag,eigen_risico,ingangsdatum,opmerkingen,bron,assigned_to,converted_at,exact_status,exact_relatie_id,exact_abonnement_id,exact_sync_op,exact_fout,vereist_handmatige_beoordeling,gekozen_pakket,extra_data,sepa_akkoord,sepa_akkoord_datum,adres_straat,adres_huisnummer,adres_postcode,adres_plaats,branche,exact_account_id,geactiveerd_door,geactiveerd_op,activatie_log,exact_invoice_id,exact_invoice_number,exact_invoice_amount,exact_invoice_created_at,pauze_start_datum,pauze_reden,pauze_door,pauze_reminder_verzonden_op,opzeg_datum,opzeg_reden,opzeg_toelichting,opzeg_door,heractivering_datum,heractivering_door,functie_bij_aanvraag,functie_bij_heractivering,exact_creditnota_id,exact_creditnota_amount,exact_creditnota_created_at,pauze_toelichting,polis_einddatum,exact_credit_invoice_id_pauze,exact_credit_invoice_bedrag,exact_credit_invoice_aangemaakt_op,exact_factuur_id_hervat,exact_factuur_bedrag_hervat,exact_factuur_aangemaakt_op_hervat,exact_invoice_status,exact_credit_invoice_id_opzeg,exact_credit_invoice_bedrag_opzeg,exact_credit_invoice_aangemaakt_op_opzeg,is_test,exact_relatie_code,offerte_verstuurd_op,kvk_startdatum,tarief_type,starter_tot,starter_controle_status,starter_beoordeeld_door,starter_beoordeeld_op,starter_toelichting,kvk_datum_bron,kvk_gegevens,cyber_voorwaarden_versie,cyber_ingangsdatum,cyber_einddatum,cyber_nieuwe_voorwaarden_per,exact_invoice_verwijderd_op,exact_invoice_gecontroleerd_op,vlag,vlag_notitie,vlag_datum,vlag_door,vlag_op,handmatige_bron,aangemaakt_door,gekoppeld_onderneming_id,gekoppeld_persoon_id,status_voor_koppeling,aanvraag_afgerond_op,aanvraag_afgerond_reden";

export const ONDERNEMING_KOLOMMEN = "id,kvk,naam,rechtsvorm,created_at,updated_at,is_test,exact_relatie_code,afas_contactpersoon,bron,afwijkingen,exact_account_id,exact_account_naam,exact_koppeling_status,exact_naam_gelijkenis,facturatie_blokkade,facturatie_blokkade_reden,branche,sector,straat,huisnummer,postcode,plaats,factuur_email,kvk_naam,kvk_handelsnamen,kvk_rechtsvorm,kvk_straat,kvk_huisnummer,kvk_postcode,kvk_plaats,kvk_postadres,kvk_adres_afgeschermd,kvk_datum_inschrijving,kvk_datum_aanvang,kvk_sbi,kvk_opgehaald_op,kvk_bron,kvk_status,kvk_overgenomen_op,kvk_overgenomen_door,vlag,vlag_notitie,vlag_datum,vlag_door,vlag_op,samengevoegd_naar,samengevoegd_op";

export const SCREENING_KOLOMMEN = "id,voornaam,achternaam,email,telefoon,bedrijfsnaam,kvk_nummer,beroep,sector,screening_type,status,otentica_flow_id,otentica_status,otentica_rapport_url,otentica_webhook_data,notities,aangemeld_op,bijgewerkt_op,rekeninghouder,incasso_akkoord,incasso_akkoord_op,bedrag,incasso_status,exact_status,exact_relatie_id,exact_transactie_id,exact_sync_op,exact_fout,is_test";

export type IbanMaskerBron = "lead" | "onderneming" | "bav" | "screening" | "sepa";
export type IbanMasker = { iban: string | null; geldig: boolean };

/** Gemaskeerd IBAN (eerste 8 en laatste 4 tekens, rest *) en mod-97-geldigheid per id. Nooit het volledige IBAN. */
export async function laadIbanMaskers(bron: IbanMaskerBron, ids: string[]): Promise<Map<string, IbanMasker>> {
  const uniek = Array.from(new Set(ids.filter(Boolean)));
  const kaart = new Map<string, IbanMasker>();
  if (!uniek.length) return kaart;
  let data: unknown = null;
  try {
    const r = await (supabase.rpc as any)("iban_maskers", { _bron: bron, _ids: uniek });
    if (r?.error) return kaart;
    data = r?.data;
  } catch { return kaart; }
  for (const r of (data ?? []) as { id: string; iban: string | null; geldig: boolean }[]) kaart.set(r.id, { iban: r.iban, geldig: !!r.geldig });
  return kaart;
}

/** Voegt gemaskeerd IBAN (iban) en iban_geldig toe aan rijen met een id. */
export async function metIbanMasker<T extends { id: string }>(bron: IbanMaskerBron, rijen: T[]): Promise<(T & { iban: string | null; iban_geldig: boolean })[]> {
  const kaart = await laadIbanMaskers(bron, rijen.map((r) => r.id));
  return rijen.map((r) => ({ ...r, iban: kaart.get(r.id)?.iban ?? null, iban_geldig: kaart.get(r.id)?.geldig ?? false }));
}

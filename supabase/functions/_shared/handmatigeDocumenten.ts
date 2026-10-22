import { beoordelingKeuze, handmatigeAanvraag } from "./aanvraagBeoordeling.ts";
import { autoInvitePortalLead } from "./portalAccess.ts";
import { verstuurMachtigingBevestiging } from "./sepaBewijs.ts";
import { COMPANY_ADDRESS_FULL } from "./company.ts";

/** Reuse immutable evidence; never reconstruct consent from mutable lead fields. */
export async function verstuurHandmatigeDocumenten(admin: any, req: Request, lead: any, userId: string, mailCertificaat: () => Promise<{ ok: boolean; error?: string }>, opts: { dryRun?: boolean } = {}) {
  const keuze = beoordelingKeuze(lead.extra_data);
  if (!handmatigeAanvraag(lead) || !keuze.akkoord) throw new Error("Handmatige acceptatie is nog niet goedgekeurd.");
  if (opts.dryRun && !lead.is_test) throw new Error("Droge documentcontrole is alleen voor testaanvragen.");
  if (lead.is_test && !opts.dryRun) return { test: true, certificaat: false, sepa: false, mijnZp: false };
  // Older sends may predate the evidence timestamp or invitation record. Read all
  // successful delivery proofs before any effect; a failed read must never resend.
  const [mails, uitnodigingen] = await Promise.all([
    admin.from("lead_notification_log").select("lead_type,metadata").eq("lead_id", lead.id).eq("status", "sent"),
    admin.from("portal_invitations").select("id").eq("lead_id", lead.id).limit(1),
  ]);
  if (mails.error || uitnodigingen.error) throw new Error("Eerdere verzendingen konden niet worden gecontroleerd; er is niets verstuurd.");
  const historie = mails.data ?? [];
  const alCertificaat = historie.some((r: any) => r.lead_type === "certificaat");
  const alMijnZp = historie.some((r: any) => r.lead_type === "portal_invite") || (uitnodigingen.data ?? []).length > 0;
  let alSepa = historie.some((r: any) => r.metadata?.soort === "sepa_machtiging" || r.lead_type === "bav-sepa-machtiging");
  // Check evidence before sending any document, so missing evidence cannot leave a partial send.
  let bewijs: any = null;
  if (!keuze.geenSepa) {
    const r = await admin.from("sepa_machtiging_bewijs").select("*")
      .eq("bron_id", lead.id).eq("dienst", "bav").order("created_at").limit(1).maybeSingle();
    if (r.error) throw new Error("SEPA-bewijs kon niet worden gecontroleerd; er is niets verstuurd.");
    bewijs = r.data;
    if (bewijs) {
      const gelogd = await admin.from("lead_notification_log").select("id").eq("status", "sent")
        .eq("metadata->>soort", "sepa_machtiging").eq("metadata->>bewijs_id", bewijs.id).limit(1);
      if (gelogd.error) throw new Error("Eerdere SEPA-verzending kon niet worden gecontroleerd; er is niets verstuurd.");
      alSepa = alSepa || !!bewijs.bevestigingsmail_verzonden_op || (gelogd.data ?? []).length > 0;
    }
    if (!bewijs && !alSepa) throw new Error("SEPA-bewijs ontbreekt; er is niets verstuurd.");
  }
  if (opts.dryRun) return { test: true, dryRun: true, volgorde: [
    ...(!alCertificaat ? ["certificaat"] : []),
    ...(!keuze.geenSepa && !alSepa ? ["sepa"] : []),
    ...(!alMijnZp ? ["mijnZp"] : []),
  ], overgeslagen: { certificaat: alCertificaat, sepa: keuze.geenSepa || alSepa, mijnZp: alMijnZp } };
  const cert = alCertificaat ? { ok: true } : await mailCertificaat();
  if (!cert.ok) throw new Error(cert.error || "Certificaatmail mislukt.");
  let sepa = false;
  if (!keuze.geenSepa) {
    if (!alSepa) {
      await verstuurMachtigingBevestiging(admin, req, {
        fnName: "generate-certificate", leadType: "bav-sepa-machtiging", record: bewijs,
        data: { type: bewijs.type, incassantNaam: bewijs.incassant_naam, incassantAdres: COMPANY_ADDRESS_FULL, incassantId: bewijs.incassant_id,
          mandaatkenmerk: bewijs.mandaatkenmerk, reden: bewijs.reden, debiteurNaam: bewijs.debiteur_naam, debiteurAdres: bewijs.debiteur_adres, iban: bewijs.iban },
        email: lead.email, aanhef: [lead.voornaam, lead.achternaam].filter(Boolean).join(" "), bedragOfReden: bewijs.reden,
      });
    }
      const { data: verzonden } = await admin.from("sepa_machtiging_bewijs").select("bevestigingsmail_verzonden_op").eq("id", bewijs.id).maybeSingle();
      if (!verzonden?.bevestigingsmail_verzonden_op) throw new Error("Certificaatmail verstuurd, SEPA-mail nog niet. De Mijn ZP-uitnodiging is nog niet verstuurd.");
    }
    sepa = true;
  }
  const portal = alMijnZp ? { verstuurd: false, reden: "al_uitgenodigd" } : await autoInvitePortalLead(admin, req, lead.id, userId, "generate-certificate", { naHandmatigAkkoord: true });
  if (portal.error) throw new Error(`Certificaat en eventuele SEPA zijn verwerkt; Mijn ZP nog niet: ${portal.error}`);
  return { certificaat: true, sepa, mijnZp: portal.verstuurd || portal.reden === "al_uitgenodigd" || portal.reden === "al_geclaimd" };
}
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { maskeerIban } from "@/lib/sepaMachtiging";

type Bewijs = {
  id: string;
  mandaatkenmerk: string;
  type: string;
  akkoord_op: string;
  ip_adres: string | null;
  tekst_versie: string;
  iban: string;
  bevestigingsmail_id: string | null;
  bevestigingsmail_verzonden_op: string | null;
};

/** Beheerblok "SEPA-machtiging" op lead- en screeningdetail. */
export function SepaMachtigingBewijsBlok({ bronId }: { bronId: string }) {
  const [rows, setRows] = useState<Bewijs[] | null>(null);
  useEffect(() => {
    let actief = true;
    supabase
      .from("sepa_machtiging_bewijs")
      .select("id, mandaatkenmerk, type, akkoord_op, ip_adres, tekst_versie, iban, bevestigingsmail_id, bevestigingsmail_verzonden_op")
      .eq("bron_id", bronId)
      .order("created_at", { ascending: true })
      .then(({ data }) => { if (actief) setRows((data as Bewijs[]) ?? []); });
    return () => { actief = false; };
  }, [bronId]);

  const openPdf = async (kenmerk: string) => {
    const { data, error } = await supabase.storage.from("sepa-machtigingen").createSignedUrl(`${kenmerk}.pdf`, 300);
    if (error || !data?.signedUrl) { alert("PDF niet gevonden in de opslag."); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="text-muted-foreground text-xs font-medium">SEPA-machtiging</div>
      {rows === null ? (
        <p className="text-sm text-muted-foreground">Laden…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Geen online vastgelegde machtiging (aanvraag van vóór het bewijsrecord).</p>
      ) : rows.map((r) => (
        <dl key={r.id} className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Kenmerk</dt><dd className="font-mono text-xs break-all">{r.mandaatkenmerk}</dd>
          <dt className="text-muted-foreground">Type</dt><dd>{r.type === "doorlopend" ? "Doorlopend" : "Eenmalig"}</dd>
          <dt className="text-muted-foreground">Akkoord op</dt><dd>{new Date(r.akkoord_op).toLocaleString("nl-NL")}</dd>
          <dt className="text-muted-foreground">IP-adres</dt><dd>{r.ip_adres ?? "-"}</dd>
          <dt className="text-muted-foreground">IBAN</dt><dd>{maskeerIban(r.iban)}</dd>
          <dt className="text-muted-foreground">Tekstversie</dt><dd>{r.tekst_versie}</dd>
          <dt className="text-muted-foreground">Bevestigingsmail</dt>
          <dd>{r.bevestigingsmail_verzonden_op ? `Verzonden ${new Date(r.bevestigingsmail_verzonden_op).toLocaleString("nl-NL")}` : "Niet (bevestigd) verzonden"}</dd>
          <dt className="text-muted-foreground">PDF</dt>
          <dd><Button variant="outline" size="sm" onClick={() => openPdf(r.mandaatkenmerk)}><FileText className="h-4 w-4" />Machtiging openen</Button></dd>
        </dl>
      ))}
    </div>
  );
}

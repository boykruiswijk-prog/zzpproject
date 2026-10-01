import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatDateNL } from "@/lib/dateFormat";
import { CERT_VELDEN, actueelCertificaat, type KlantCertificaat } from "@/lib/klantCertificaten";

const STATUS_LABEL: Record<string, string> = { bevestigd: "Bevestigd", voorstel: "Voorstel", afgewezen: "Afgewezen" };

export function CertificatenKlant({ ondernemingId }: { ondernemingId: string }) {
  const { isSupervisorOrAdmin } = useAuth();
  const { toast } = useToast();
  const [certs, setCerts] = useState<KlantCertificaat[]>([]);
  const [gedeeld, setGedeeld] = useState<Map<string, { id: string; naam: string }[]>>(new Map());
  const [herlaad, setHerlaad] = useState(0);
  const [bezig, setBezig] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("klant_certificaten" as any).select(CERT_VELDEN)
        .eq("onderneming_id", ondernemingId).order("aanvraagdatum", { ascending: false });
      const eigen = ((data ?? []) as unknown) as KlantCertificaat[];
      setCerts(eigen);
      const nummers = Array.from(new Set(eigen.map((c) => c.certificaatnummer)));
      const m = new Map<string, { id: string; naam: string }[]>();
      if (nummers.length) {
        const { data: anderen } = await supabase.from("klant_certificaten" as any)
          .select("certificaatnummer,onderneming_id,koppeling_status,ondernemingen(naam)")
          .in("certificaatnummer", nummers).neq("onderneming_id", ondernemingId).neq("koppeling_status", "afgewezen");
        for (const a of (anderen ?? []) as any[]) {
          const lijst = m.get(a.certificaatnummer) ?? [];
          if (!lijst.some((x) => x.id === a.onderneming_id)) lijst.push({ id: a.onderneming_id, naam: a.ondernemingen?.naam ?? "andere klant" });
          m.set(a.certificaatnummer, lijst);
        }
      }
      setGedeeld(m);
    })();
  }, [ondernemingId, herlaad]);

  async function beoordeel(c: KlantCertificaat, bevestigen: boolean) {
    setBezig(c.id);
    const { error } = await supabase.rpc("beoordeel_klant_certificaat" as any, { _id: c.id, _bevestigen: bevestigen });
    setBezig(null);
    if (error) { toast({ title: "Niet gelukt", description: error.message, variant: "destructive" }); return; }
    toast({ title: bevestigen ? "Certificaat bevestigd" : "Koppeling afgewezen" });
    setHerlaad((x) => x + 1);
  }

  const actueel = actueelCertificaat(certs);
  const historie = certs.filter((c) => c.id !== actueel?.id);

  const Rij = ({ c, groot }: { c: KlantCertificaat; groot?: boolean }) => (
    <div className={`flex flex-wrap items-center gap-2 border-t border-border py-2 first:border-t-0 ${c.koppeling_status === "afgewezen" ? "opacity-60" : ""}`}>
      <span className={`tabular-nums ${groot ? "text-lg font-semibold" : "font-medium"}`}>{c.certificaatnummer}</span>
      <span className="text-sm text-muted-foreground whitespace-nowrap">{formatDateNL(c.aanvraagdatum)}</span>
      {c.pakket && <span className="text-sm text-muted-foreground truncate max-w-[16rem]" title={c.pakket}>{c.pakket}</span>}
      <Badge variant={c.koppeling_status === "bevestigd" ? "secondary" : "outline"}>{STATUS_LABEL[c.koppeling_status]}</Badge>
      {c.koppeling_status === "voorstel" && c.waarschuwing && (
        <Badge variant="outline" className={c.match_type === "F" ? "border-destructive text-destructive" : "border-amber-500 text-amber-700"} title={`Aanvraag: ${c.bron_naam ?? "—"} · ${c.bron_contact ?? "—"}`}>
          {c.match_type === "F" && <AlertTriangle className="mr-1 h-3 w-3" />}{c.waarschuwing}
        </Badge>
      )}
      {(gedeeld.get(c.certificaatnummer) ?? []).map((o) => (
        <Link key={o.id} to={`/admin/klanten/${o.id}`}><Badge variant="outline" className="border-amber-500 text-amber-700 hover:bg-muted">Nummer ook in gebruik bij {o.naam}</Badge></Link>
      ))}
      {c.koppeling_status === "voorstel" && isSupervisorOrAdmin && (
        <span className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" disabled={bezig === c.id} onClick={() => beoordeel(c, true)}><Check className="mr-1 h-3 w-3" />Bevestigen</Button>
          <Button size="sm" variant="outline" disabled={bezig === c.id} onClick={() => beoordeel(c, false)}><X className="mr-1 h-3 w-3" />Afwijzen</Button>
        </span>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Certificaten</CardTitle></CardHeader>
      <CardContent className="text-sm">
        {!actueel && historie.length === 0 ? <p className="text-muted-foreground">Geen certificaat bekend.</p> : (
          <>
            {actueel && <><p className="text-xs text-muted-foreground">Actueel (laatste aanvraag)</p><Rij c={actueel} groot /></>}
            {historie.length > 0 && <><p className="mt-3 text-xs text-muted-foreground">Historie</p>{historie.map((c) => <Rij key={c.id} c={c} />)}</>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

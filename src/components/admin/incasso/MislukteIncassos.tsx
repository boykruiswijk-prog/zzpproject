// Overzicht 'Mislukte incasso's' en lijst voor Sandra (besluit Boy 9-11-2026). Alleen lezen uit de Exact-cache.
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateNL } from "@/lib/dateFormat";
import { euroNL } from "./Incasso";
import { CATEGORIE_LABEL, jaNee, type MisluktRij } from "@/lib/mislukteIncassos";

export function MislukteIncassosOverzicht() {
  const { data, error } = useQuery({
    queryKey: ["mislukte-incassos"], retry: false,
    queryFn: async () => { const { data, error } = await supabase.rpc("mislukte_incassos_overzicht" as any); if (error) throw error; return (data ?? []) as MisluktRij[]; },
  });
  if (error) return null;
  return (
    <Card><CardHeader><CardTitle className="text-base">Mislukte incasso's ({data?.length ?? 0})</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">Uit Exact (alleen lezen, dagelijks ververst): terugboekingen en vervallen incassofacturen die niet meer in de incassorun komen. Rekeningnummers worden niet getoond.</p>
        <div className="overflow-x-auto"><table className="w-full text-left">
          <thead className="text-xs text-muted-foreground"><tr><th className="p-1">Klant</th><th className="p-1">Factuur</th><th className="p-1">Bedrag</th><th className="p-1">Datum</th><th className="p-1">Soort</th><th className="p-1">Reden (Exact)</th><th className="p-1">Rekening</th><th className="p-1">Machtiging</th></tr></thead>
          <tbody>{(data ?? []).map((r) => (
            <tr key={r.factuurnummer} className="border-t">
              <td className="p-1">{r.onderneming_id ? <Link className="text-primary hover:underline" to={`/admin/klanten/${r.onderneming_id}`}>{r.klant ?? "Klant"}</Link> : r.klant ?? "Onbekend"}</td>
              <td className="p-1">{r.factuurnummer}</td><td className="p-1">{euroNL(r.bedrag)}</td>
              <td className="p-1">{r.factuurdatum ? formatDateNL(r.factuurdatum) : "-"}</td>
              <td className="p-1"><Badge variant={r.categorie === "terugboeking" ? "destructive" : "secondary"}>{CATEGORIE_LABEL[r.categorie] ?? r.categorie}</Badge></td>
              <td className="p-1">{r.reden ?? "Exact geeft geen reden"}</td>
              <td className="p-1">{jaNee(r.heeft_rekening)}</td><td className="p-1">{jaNee(r.heeft_machtiging)}</td>
            </tr>))}</tbody>
        </table></div>
      </CardContent>
    </Card>
  );
}

export function KlantenZonderBankgegevens() {
  const { data, error } = useQuery({
    queryKey: ["klanten-zonder-bankgegevens"], retry: false,
    queryFn: async () => { const { data, error } = await supabase.rpc("klanten_zonder_bankgegevens" as any); if (error) throw error; return (data ?? []) as { klant: string | null; factuurnummer: string }[]; },
  });
  if (error) return null;
  return (
    <Card><CardHeader><CardTitle className="text-base">Klanten zonder rekeningnummer of machtiging in Exact ({data?.length ?? 0})</CardTitle></CardHeader>
      <CardContent className="space-y-1 text-sm">
        {(data ?? []).length === 0 && <p className="text-muted-foreground">Geen klanten gevonden (of de bankgegevens zijn nog niet uit Exact opgehaald).</p>}
        {(data ?? []).map((r) => <p key={r.factuurnummer}>{r.klant ?? "Onbekend"} · factuur {r.factuurnummer}</p>)}
      </CardContent>
    </Card>
  );
}

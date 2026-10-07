import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const LABEL: Record<string, string> = { bedrijfsnaam: "Bedrijfsnaam", straat: "Straat", huisnummer: "Huisnummer", postcode: "Postcode", plaats: "Plaats", kvk_startdatum: "Startdatum KVK" };

/** KVK-controle bij een aanvraag: KVK is leidend, afwijkende klantopgave zichtbaar. */
export function KvkLeadAfwijkingen({ lead }: { lead: { kvk_gegevens?: any; kvk_datum_bron?: string | null } }) {
  const g = lead.kvk_gegevens;
  if (!g) return null;
  const afw: { veld: string; klant: string; kvk: string }[] = g.afwijkingen ?? [];
  return (
    <Card>
      <CardHeader><CardTitle className="flex flex-wrap items-center gap-2 text-base">KVK-controle
        <Badge variant={g.status === "ok" ? "secondary" : "destructive"}>{g.status === "ok" ? "KVK leidend" : "KVK-controle niet beschikbaar"}</Badge></CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {g.status !== "ok" && <p>De gegevens van de klant zijn gebruikt. Startdatum handmatig controleren.</p>}
        {g.adres_bron === "klant_kvk_afgeschermd" && <p>Adres is afgeschermd in het handelsregister; het opgegeven adres is gebruikt.</p>}
        {lead.kvk_datum_bron && <p className="text-muted-foreground">Bron startdatum: {lead.kvk_datum_bron === "kvk_api" ? "KVK API" : "opgegeven door klant"}</p>}
        {g.status === "ok" && (afw.length === 0 ? <p className="text-muted-foreground">Opgave van de klant komt overeen met de KVK.</p> : (
          <ul className="space-y-1">{afw.map((a) => <li key={a.veld}><span className="text-muted-foreground">{LABEL[a.veld] ?? a.veld}:</span> klant {a.klant || "-"} <Badge variant="outline">wijkt af</Badge> KVK <span className="font-medium">{a.kvk}</span></li>)}</ul>
        ))}
      </CardContent>
    </Card>
  );
}

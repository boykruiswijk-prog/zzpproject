import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalPolicies } from "@/hooks/usePortalData";
import { SepaMachtigingBlok, bouwFrontendMachtiging } from "@/components/shared/SepaMachtigingBlok";
import { isValidIban, mandaatkenmerkVoor, redenBav } from "@/lib/sepaMachtiging";
import { formatDateNL } from "@/lib/dateFormat";
import { ERKENNING_TEKST, OVERGANG_TEKST, RECHTSVORMEN, datumsFout, datumsMelding, machtigingFout, nieuweOndernemingFout } from "../../../supabase/functions/_shared/rechtsvormwijziging";

const leeg = { naam: "", kvk: "", rechtsvorm: "BV", straat: "", huisnummer: "", postcode: "", plaats: "", land: "Nederland" };
const STATUS: Record<string, string> = { nieuw: "Ontvangen, wij beoordelen je verzoek", in_behandeling: "Goedgekeurd, wordt verwerkt", afgerond: "Verwerkt", gearchiveerd: "Gesloten" };

export default function PortalRechtsvorm() {
  const qc = useQueryClient();
  const { data: polissen = [], isLoading } = usePortalPolicies();
  const geldig = (polissen as any[]).filter((p) => p.status === "geldig");
  const { data: verzoeken = [] } = useQuery({
    queryKey: ["mijn-rechtsvormwijzigingen"],
    queryFn: async () => ((await (supabase.rpc as any)("mijn_rechtsvormwijzigingen")).data ?? []) as any[],
  });
  const aanvraagId = useMemo(() => crypto.randomUUID(), []);
  const [polisId, setPolisId] = useState("");
  const [eind, setEind] = useState(""); const [ingang, setIngang] = useState("");
  const [nieuw, setNieuw] = useState(leeg);
  const [nieuweRekening, setNieuweRekening] = useState(false);
  const [iban, setIban] = useState(""); const [houder, setHouder] = useState("");
  const [akkoord, setAkkoord] = useState(false); const [akkoordOp, setAkkoordOp] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false); const [klaar, setKlaar] = useState(false);
  const kiesPolis = polisId || (geldig.length === 1 ? geldig[0].id : "");
  const zet = (k: keyof typeof leeg, v: string) => setNieuw((n) => ({ ...n, [k]: v }));

  async function versturen() {
    const f = (!kiesPolis ? "Kies je huidige polis." : null) ?? datumsFout(eind, ingang) ?? nieuweOndernemingFout(nieuw)
      ?? machtigingFout({ nieuweRekening, ibanGeldig: isValidIban(iban), rekeninghouder: houder, akkoord });
    setFout(f); if (f) return;
    setBezig(true);
    const { data, error } = await supabase.functions.invoke("klant-rechtsvormwijziging", {
      body: { aanvraag_id: aanvraagId, polis_id: kiesPolis, einddatum: eind, ingangsdatum: ingang, nieuw, nieuwe_rekening: nieuweRekening,
        iban: nieuweRekening ? iban : "", rekeninghouder: nieuweRekening ? houder : "", sepa_akkoord: nieuweRekening && akkoord, client_akkoord_op: akkoordOp, pagina_url: window.location.href },
    });
    setBezig(false);
    if (error || !(data as any)?.success) {
      let m: string | undefined; try { m = (await (error as any)?.context?.json?.())?.melding; } catch { /* geen detail */ }
      setFout(m ?? "Er ging iets mis. Probeer het opnieuw of bel 020 - 457 3077."); return;
    }
    setKlaar(true); qc.invalidateQueries({ queryKey: ["mijn-rechtsvormwijzigingen"] });
  }

  return (
    <PortalLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Mijn onderneming wijzigt van rechtsvorm</h1>
          <p className="text-muted-foreground">Bijvoorbeeld van eenmanszaak naar bv, of andersom. Je oude onderneming stopt op de einddatum die je opgeeft en je nieuwe onderneming gaat in op de ingangsdatum die je kiest. Wij koppelen beide ondernemingen, zodat je gegevens en historie bij elkaar blijven.</p>
          <p className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm" data-testid="erkenning">{ERKENNING_TEKST}</p>
        </div>

        {verzoeken.length > 0 && (
          <Card><CardHeader><CardTitle className="text-base">Je verzoeken</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">{verzoeken.map((v) => (
              <p key={v.id}>{v.nieuwe_naam} per {formatDateNL(v.ingangsdatum)}: <strong>{STATUS[v.status] ?? v.status}</strong></p>))}</CardContent></Card>
        )}

        {klaar ? (
          <Card><CardContent className="pt-6 space-y-2" role="status">
            <CheckCircle2 className="h-8 w-8 text-primary" />
            <p className="font-semibold">Je verzoek is ontvangen.</p>
            <p className="text-sm text-muted-foreground">Wij controleren de gegevens. Na akkoord stopt je oude polis op {formatDateNL(eind)} en gaat je nieuwe polis in op {formatDateNL(ingang)}. De status zie je hier in Mijn ZP.</p>
            <Link to="/portal" className="text-primary underline text-sm">Terug naar overzicht</Link>
          </CardContent></Card>
        ) : isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : geldig.length === 0 ? (
          <p>Je hebt geen actieve polis. Bel ons op 020 - 457 3077.</p>
        ) : (
          <Card><CardContent className="pt-6 space-y-5 text-sm">
            <div className="space-y-1"><Label htmlFor="rv-polis">Huidige polis</Label>
              <select id="rv-polis" className="w-full rounded-md border border-input bg-background p-2" value={kiesPolis} onChange={(e) => setPolisId(e.target.value)}>
                <option value="">Kies je polis</option>
                {geldig.map((p) => <option key={p.id} value={p.id}>{p.certificate_number ?? "Polis"} {p.company_name ? `, ${p.company_name}` : ""}</option>)}
              </select></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="rv-eind">Einddatum oude onderneming</Label><Input id="rv-eind" type="date" value={eind} onChange={(e) => setEind(e.target.value)} /></div>
              <div><Label htmlFor="rv-ingang">Ingangsdatum nieuwe onderneming</Label><Input id="rv-ingang" type="date" value={ingang} onChange={(e) => setIngang(e.target.value)} /></div>
            </div>
            <p className="text-xs text-muted-foreground" data-testid="overgang">{OVERGANG_TEKST}</p>
            {(() => { const m = datumsMelding(eind, ingang); return m && <p role="status" data-testid="datum-melding" className={m.soort === "gat" ? "rounded-md border border-oranje/50 bg-oranje/10 p-2" : "rounded-md bg-muted p-2"}>{m.tekst}</p>; })()}
            <div className="space-y-3"><p className="font-medium">Nieuwe onderneming</p>
              <div><Label htmlFor="rv-naam">Bedrijfsnaam</Label><Input id="rv-naam" value={nieuw.naam} maxLength={200} onChange={(e) => zet("naam", e.target.value)} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label htmlFor="rv-kvk">KvK-nummer</Label><Input id="rv-kvk" inputMode="numeric" maxLength={12} value={nieuw.kvk} onChange={(e) => zet("kvk", e.target.value)} /></div>
                <div><Label htmlFor="rv-vorm">Rechtsvorm</Label>
                  <select id="rv-vorm" className="w-full rounded-md border border-input bg-background p-2" value={nieuw.rechtsvorm} onChange={(e) => zet("rechtsvorm", e.target.value)}>
                    {RECHTSVORMEN.map((r) => <option key={r} value={r}>{r === "BV" ? "Bv" : r}</option>)}</select></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2"><Label htmlFor="rv-straat">Straat</Label><Input id="rv-straat" value={nieuw.straat} onChange={(e) => zet("straat", e.target.value)} /></div>
                <div><Label htmlFor="rv-nr">Huisnummer</Label><Input id="rv-nr" value={nieuw.huisnummer} onChange={(e) => zet("huisnummer", e.target.value)} /></div>
                <div><Label htmlFor="rv-pc">Postcode</Label><Input id="rv-pc" value={nieuw.postcode} onChange={(e) => zet("postcode", e.target.value)} /></div>
                <div><Label htmlFor="rv-plaats">Plaats</Label><Input id="rv-plaats" value={nieuw.plaats} onChange={(e) => zet("plaats", e.target.value)} /></div>
                <div><Label htmlFor="rv-land">Land</Label><Input id="rv-land" value={nieuw.land} onChange={(e) => zet("land", e.target.value)} /></div>
              </div>
            </div>
            <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={nieuweRekening} onChange={(e) => setNieuweRekening(e.target.checked)} />
              <span>Mijn nieuwe onderneming heeft een nieuwe zakelijke rekening</span></label>
            {nieuweRekening && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label htmlFor="rv-iban">IBAN</Label><Input id="rv-iban" autoComplete="off" value={iban} onChange={(e) => setIban(e.target.value)} /></div>
                  <div><Label htmlFor="rv-houder">Rekeninghouder</Label><Input id="rv-houder" value={houder} onChange={(e) => setHouder(e.target.value)} /></div>
                </div>
                <SepaMachtigingBlok
                  data={bouwFrontendMachtiging({ type: "doorlopend", mandaatkenmerk: mandaatkenmerkVoor(aanvraagId), reden: redenBav(), debiteurNaam: houder,
                    debiteurAdres: { straat: nieuw.straat, huisnummer: nieuw.huisnummer, postcode: nieuw.postcode, plaats: nieuw.plaats, land: nieuw.land }, iban })}
                  checked={akkoord} onCheckedChange={(v) => { setAkkoord(v); setAkkoordOp(v ? new Date().toISOString() : null); }} />
              </div>
            )}
            {fout && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">{fout}</p>}
            <div className="flex gap-2"><Button variant="outline" asChild><Link to="/portal">Annuleren</Link></Button>
              <Button onClick={versturen} disabled={bezig}>{bezig && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Verzoek versturen</Button></div>
          </CardContent></Card>
        )}
      </div>
    </PortalLayout>
  );
}

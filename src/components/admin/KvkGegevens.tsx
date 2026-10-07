import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateNL } from "@/lib/dateFormat";

const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
export const KVK_NIET_BESCHIKBAAR = "KVK-controle niet beschikbaar";

type Ond = Record<string, any>;
export function kvkVerschillen(o: Ond) {
  const rijen = [
    { veld: "Naam", eigen: o.naam, kvk: o.kvk_naam },
    { veld: "Straat", eigen: o.straat, kvk: o.kvk_straat, adres: true },
    { veld: "Huisnummer", eigen: o.huisnummer, kvk: o.kvk_huisnummer, adres: true },
    { veld: "Postcode", eigen: o.postcode, kvk: o.kvk_postcode, adres: true },
    { veld: "Plaats", eigen: o.plaats, kvk: o.kvk_plaats, adres: true },
  ];
  return rijen.map((r) => ({ ...r, verschil: !!r.kvk && norm(r.eigen) !== norm(r.kvk) && !(r.adres && o.kvk_adres_afgeschermd) }));
}

async function verversen(ids: string[]) {
  const { data, error } = await supabase.functions.invoke("kvk-basisprofiel", { body: { modus: "verversen", onderneming_ids: ids } });
  if (error) throw error;
  return data as { ok: boolean; melding?: string; uitkomst?: { id: string; ok: boolean; melding?: string }[] };
}

async function overnemen(ids: string[], naam: boolean, adres: boolean) {
  const { data, error } = await (supabase.rpc as any)("kvk_gegevens_overnemen", { _ids: ids, _naam: naam, _adres: adres });
  if (error) throw error;
  return data as { verwerkt: number; adres_overgeslagen_afgeschermd: number };
}

/** Klantkaart: "KVK (leidend)" naast "Opgegeven / huidige gegevens". Overnemen alleen door admin, nooit automatisch, Exact blijft ongemoeid. */
export function KvkVergelijking({ ond, onGewijzigd }: { ond: Ond; onGewijzigd: () => void }) {
  const { isSupervisorOrAdmin, isAdmin } = useAuth();
  const { toast } = useToast();
  const [bezig, setBezig] = useState<string | null>(null);
  const rijen = kvkVerschillen(ond);
  const heeftVerschil = rijen.some((r) => r.verschil);

  async function ververs() {
    setBezig("ververs");
    try {
      const r = await verversen([ond.id]);
      const u = r.uitkomst?.[0];
      if (!r.ok || !u?.ok) toast({ title: r.melding || u?.melding || KVK_NIET_BESCHIKBAAR, variant: "destructive" });
      else toast({ title: "KVK-gegevens opgehaald" });
      onGewijzigd();
    } catch (e: any) { toast({ title: KVK_NIET_BESCHIKBAAR, description: e?.message, variant: "destructive" }); }
    setBezig(null);
  }
  async function neemOver(naam: boolean, adres: boolean) {
    if (!window.confirm("KVK-gegevens overnemen in de klantgegevens? Exact wordt niet aangepast.")) return;
    setBezig("over");
    try { const r = await overnemen([ond.id], naam, adres); toast({ title: "Overgenomen", description: r.adres_overgeslagen_afgeschermd ? "Adres is afgeschermd in de KVK en niet overgenomen." : undefined }); onGewijzigd(); }
    catch (e: any) { toast({ title: "Overnemen mislukt", description: e?.message, variant: "destructive" }); }
    setBezig(null);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">KVK-gegevens</CardTitle>
        {isSupervisorOrAdmin && <Button size="sm" variant="outline" onClick={ververs} disabled={!!bezig}>{bezig === "ververs" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} KVK-gegevens verversen</Button>}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!ond.kvk_opgehaald_op ? (
          <p className="text-muted-foreground">{ond.kvk_status && ond.kvk_status !== "ok" ? `${KVK_NIET_BESCHIKBAAR} (${ond.kvk_status}).` : "Nog niet opgehaald uit het handelsregister."}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead><tr className="text-xs text-muted-foreground"><th className="py-1 pr-3">Veld</th><th className="py-1 pr-3">KVK (leidend)</th><th className="py-1">Opgegeven / huidig</th></tr></thead>
                <tbody>
                  {rijen.map((r) => (
                    <tr key={r.veld} className={r.verschil ? "bg-accent/10" : undefined}>
                      <td className="py-1 pr-3 text-muted-foreground">{r.veld}</td>
                      <td className="py-1 pr-3 font-medium">{r.adres && ond.kvk_adres_afgeschermd ? <span className="text-muted-foreground">afgeschermd</span> : r.kvk || "onbekend"}</td>
                      <td className="py-1">{r.eigen || "-"} {r.verschil && <Badge variant="outline" className="ml-1">wijkt af</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              {[ond.kvk_rechtsvorm, ond.kvk_handelsnamen?.length ? `handelsnamen: ${ond.kvk_handelsnamen.join(", ")}` : null,
                ond.kvk_datum_inschrijving && `ingeschreven ${formatDateNL(ond.kvk_datum_inschrijving)}`, ond.kvk_datum_aanvang && `aanvang ${formatDateNL(ond.kvk_datum_aanvang)}`,
                `opgehaald ${formatDateNL(ond.kvk_opgehaald_op)}`].filter(Boolean).join(" · ")}
            </p>
            {ond.kvk_adres_afgeschermd && <p className="text-xs">Het adres is afgeschermd in het handelsregister. Het opgegeven adres blijft in gebruik.</p>}
            {isAdmin && heeftVerschil && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => neemOver(true, true)} disabled={!!bezig}>Naam en adres overnemen uit KVK</Button>
                <Button size="sm" variant="outline" onClick={() => neemOver(true, false)} disabled={!!bezig}>Alleen naam</Button>
              </div>
            )}
            {heeftVerschil && !isAdmin && <p className="text-xs text-muted-foreground">Overnemen kan alleen een admin doen.</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Batch voor bestaande klanten: ophalen en verschillen tonen; overnemen alleen na expliciete keuze door een admin. */
export function KvkBatch() {
  const { isAdmin, isSupervisorOrAdmin } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Ond[]>([]);
  const [voortgang, setVoortgang] = useState<{ klaar: number; totaal: number; fout: number } | null>(null);
  const [keuze, setKeuze] = useState<Set<string>>(new Set());
  const [laad, setLaad] = useState(0);

  useEffect(() => {
    (async () => {
      const alle: Ond[] = [];
      for (let a = 0; ; a += 1000) {
        const { data } = await supabase.from("ondernemingen").select("id,naam,kvk,straat,huisnummer,postcode,plaats,kvk_naam,kvk_straat,kvk_huisnummer,kvk_postcode,kvk_plaats,kvk_adres_afgeschermd,kvk_opgehaald_op,kvk_status,is_test")
          .eq("is_test", false).not("kvk", "is", null).range(a, a + 999);
        alle.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      setRows(alle);
    })();
  }, [laad]);

  const metVerschil = useMemo(() => rows.filter((o) => o.kvk_opgehaald_op && kvkVerschillen(o).some((r) => r.verschil)), [rows]);
  if (!isSupervisorOrAdmin) return null;

  async function start() {
    const ids = rows.filter((o) => /^\d{8}$/.test(o.kvk ?? "")).map((o) => o.id);
    setVoortgang({ klaar: 0, totaal: ids.length, fout: 0 });
    let fout = 0;
    for (let i = 0; i < ids.length; i += 25) {
      try {
        const r = await verversen(ids.slice(i, i + 25));
        if (!r.ok) { toast({ title: r.melding || KVK_NIET_BESCHIKBAAR, variant: "destructive" }); break; }
        fout += (r.uitkomst ?? []).filter((u) => !u.ok).length;
      } catch (e: any) { toast({ title: KVK_NIET_BESCHIKBAAR, description: e?.message, variant: "destructive" }); break; }
      setVoortgang({ klaar: Math.min(i + 25, ids.length), totaal: ids.length, fout });
    }
    setLaad((x) => x + 1);
  }
  async function neemOver(adres: boolean) {
    const ids = Array.from(keuze);
    if (!ids.length || !window.confirm(`KVK-${adres ? "naam en adres" : "naam"} overnemen voor ${ids.length} klanten? Exact wordt niet aangepast.`)) return;
    try { const r = await overnemen(ids, true, adres); toast({ title: `${r.verwerkt} klanten bijgewerkt`, description: r.adres_overgeslagen_afgeschermd ? `${r.adres_overgeslagen_afgeschermd} afgeschermde adressen overgeslagen` : undefined }); setKeuze(new Set()); setLaad((x) => x + 1); }
    catch (e: any) { toast({ title: "Overnemen mislukt", description: e?.message, variant: "destructive" }); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">KVK-gegevens bestaande klanten</CardTitle>
        <Button size="sm" variant="outline" onClick={start} disabled={!!voortgang && voortgang.klaar < voortgang.totaal}><RefreshCw className="h-4 w-4" /> KVK-gegevens verversen</Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{rows.length} klanten met KVK-nummer, {rows.filter((o) => o.kvk_opgehaald_op).length} opgehaald, {metVerschil.length} met verschillen. Er wordt niets automatisch overschreven.</p>
        {voortgang && <p>Voortgang: {voortgang.klaar} / {voortgang.totaal}{voortgang.fout ? ` (${voortgang.fout} niet gelukt)` : ""}</p>}
        {metVerschil.length > 0 && (
          <>
            {isAdmin && <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setKeuze(keuze.size === metVerschil.length ? new Set() : new Set(metVerschil.map((o) => o.id)))}>{keuze.size === metVerschil.length ? "Niets selecteren" : "Alles selecteren"}</Button>
              <Button size="sm" disabled={!keuze.size} onClick={() => neemOver(true)}>Naam en adres overnemen ({keuze.size})</Button>
              <Button size="sm" variant="outline" disabled={!keuze.size} onClick={() => neemOver(false)}>Alleen naam ({keuze.size})</Button>
            </div>}
            <ul className="max-h-[480px] space-y-2 overflow-y-auto">
              {metVerschil.map((o) => (
                <li key={o.id} className="flex gap-2 rounded-md border border-border p-2">
                  {isAdmin && <Checkbox checked={keuze.has(o.id)} onCheckedChange={(v) => setKeuze((s) => { const n = new Set(s); v ? n.add(o.id) : n.delete(o.id); return n; })} aria-label={`Selecteer ${o.naam}`} />}
                  <div className="min-w-0">
                    <Link to={`/admin/klanten/${o.id}`} className="font-medium hover:text-primary">{o.naam}</Link>
                    <ul className="text-xs text-muted-foreground">{kvkVerschillen(o).filter((r) => r.verschil).map((r) => <li key={r.veld}>{r.veld}: {r.eigen || "-"} → <span className="text-foreground">{r.kvk}</span></li>)}</ul>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

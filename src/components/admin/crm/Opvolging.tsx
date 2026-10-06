import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateNL } from "@/lib/dateFormat";
import { uploadBijlagen } from "@/lib/crmBijlagen";
import { BijlageKiezer } from "./BijlageKiezer";
import { CrmTijdlijn } from "./CrmTijdlijn";
import { LopendeProducten, useMagBeeindigen } from "./LopendeProducten";

type Ond = { id: string; naam: string; rechtsvorm: string | null; kvk: string | null; exact_account_id?: string | null };
export type Voorganger = { ond: Ond; tot: string };

/** Haalt opvolgers (voortgezet als) en de keten van voorgangers op. */
export function useOpvolging(ondernemingId: string, herlaad = 0) {
  const [opvolger, setOpvolger] = useState<{ ond: Ond; per: string } | null>(null);
  const [voorgangers, setVoorgangers] = useState<Voorganger[]>([]);
  useEffect(() => {
    (async () => {
      const { data: na } = await supabase.from("onderneming_opvolging").select("naar_onderneming_id,ingangsdatum").eq("van_onderneming_id", ondernemingId).order("vastgelegd_op", { ascending: false }).limit(1);
      if (na?.[0]) {
        const { data: o } = await supabase.from("ondernemingen").select("id,naam,rechtsvorm,kvk").eq("id", na[0].naar_onderneming_id).maybeSingle();
        setOpvolger(o ? { ond: o as Ond, per: na[0].ingangsdatum } : null);
      } else setOpvolger(null);
      const keten: Voorganger[] = []; const gezien = new Set([ondernemingId]); let huidig = ondernemingId;
      for (let i = 0; i < 10; i++) {
        const { data: v } = await supabase.from("onderneming_opvolging").select("van_onderneming_id,ingangsdatum").eq("naar_onderneming_id", huidig).limit(1);
        if (!v?.[0] || gezien.has(v[0].van_onderneming_id)) break;
        const { data: o } = await supabase.from("ondernemingen").select("id,naam,rechtsvorm,kvk").eq("id", v[0].van_onderneming_id).maybeSingle();
        if (!o) break;
        keten.push({ ond: o as Ond, tot: v[0].ingangsdatum }); gezien.add(o.id); huidig = o.id;
      }
      setVoorgangers(keten);
    })();
  }, [ondernemingId, herlaad]);
  return { opvolger, voorgangers };
}

export function OpvolgerBanner({ opvolger }: { opvolger: { ond: Ond; per: string } | null }) {
  if (!opvolger) return null;
  return (
    <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
      Voortgezet als <Link to={`/admin/klanten/${opvolger.ond.id}`} className="font-medium text-primary hover:underline">{opvolger.ond.naam}</Link> per {formatDateNL(opvolger.per)}.
    </div>
  );
}

export function ExactRelatieLabel({ ond, heeftVoorganger }: { ond: Ond; heeftVoorganger: boolean }) {
  if (!heeftVoorganger || ond.exact_account_id) return null;
  return <Badge variant="outline" className="border-amber-500 text-amber-700">Taak Roxy: Exact-relatie aanmaken</Badge>;
}

/** Alleen-lezen historie van alle voorgangers, elk onder een duidelijke scheiding. */
export function VoorgangerHistorie({ voorgangers }: { voorgangers: Voorganger[] }) {
  if (!voorgangers.length) return null;
  return (
    <div className="space-y-4">
      {voorgangers.map((v) => (
        <section key={v.ond.id} className="space-y-3 border-t-4 border-muted pt-4">
          <h2 className="text-lg font-semibold break-words">
            Historie van <Link to={`/admin/klanten/${v.ond.id}`} className="hover:text-primary">{v.ond.naam}</Link> ({v.ond.rechtsvorm || "rechtsvorm onbekend"}, KvK {v.ond.kvk || "onbekend"}) tot {formatDateNL(v.tot)}
          </h2>
          <LopendeProducten ondernemingId={v.ond.id} ondernemingNaam={v.ond.naam} readOnly titel="Contracten en polissen (alleen lezen)" />
          <CrmTijdlijn ondernemingen={[{ id: v.ond.id, naam: v.ond.naam }]} personen={[]} readOnly titel="Notities (alleen lezen)" />
        </section>
      ))}
    </div>
  );
}

export function OndernemingswijzigingKnop({ ond, onKlaar }: { ond: Ond; onKlaar?: () => void }) {
  const mag = useMagBeeindigen();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [modus, setModus] = useState<"nieuw" | "bestaand">("nieuw");
  const [naam, setNaam] = useState(""); const [kvk, setKvk] = useState(""); const [rechtsvorm, setRechtsvorm] = useState("BV");
  const [zoek, setZoek] = useState(""); const [kandidaten, setKandidaten] = useState<Ond[]>([]); const [gekozen, setGekozen] = useState<Ond | null>(null);
  const [datum, setDatum] = useState(new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" }));
  const [soort, setSoort] = useState("rechtsvormwijziging");
  const [toelichting, setToelichting] = useState("");
  const [beeindigen, setBeeindigen] = useState(true);
  const [bestanden, setBestanden] = useState<File[]>([]);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    const h = (e: Event) => { if ((e as CustomEvent).detail === ond.id) setOpen(true); };
    window.addEventListener("open-ondernemingswijziging", h);
    return () => window.removeEventListener("open-ondernemingswijziging", h);
  }, [ond.id]);

  useEffect(() => {
    if (modus !== "bestaand" || zoek.trim().length < 2) { setKandidaten([]); return; }
    const t = setTimeout(async () => {
      const q = zoek.trim().replace(/[%,()]/g, "");
      const { data } = await supabase.from("ondernemingen").select("id,naam,rechtsvorm,kvk").or(`naam.ilike.%${q}%,kvk.eq.${q.replace(/\D/g, "") || "0"}`).neq("id", ond.id).limit(8);
      setKandidaten((data ?? []) as Ond[]);
    }, 250);
    return () => clearTimeout(t);
  }, [zoek, modus, ond.id]);

  if (!mag) return null;

  async function opslaan() {
    setBezig(true);
    const { data, error } = await supabase.rpc("crm_ondernemingswijziging", {
      _van: ond.id, _naar: modus === "bestaand" ? gekozen?.id ?? null : null, _naam: naam, _kvk: kvk, _rechtsvorm: rechtsvorm,
      _ingangsdatum: datum, _soort: soort, _toelichting: toelichting, _beeindigen: beeindigen,
    } as any);
    if (error) { setBezig(false); toast.error(error.message); return; }
    const res = data as any;
    if (bestanden.length && user && res?.notitie_id) (await uploadBijlagen(res.notitie_id, bestanden, user.id)).forEach((f) => toast.error(f));
    setBezig(false); setOpen(false);
    toast.success("Ondernemingswijziging vastgelegd");
    onKlaar?.();
    if (res?.naar_onderneming_id) navigate(`/admin/klanten/${res.naar_onderneming_id}`);
  }
  const geldig = datum && (modus === "nieuw" ? naam.trim().length >= 2 && (!kvk || kvk.replace(/\D/g, "").length === 8) : !!gekozen);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Ondernemingswijziging vastleggen</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ondernemingswijziging: {ond.naam}</DialogTitle>
            <DialogDescription>Bijvoorbeeld eenmanszaak naar BV. Contactpersonen worden ook aan de nieuwe onderneming gekoppeld. Er wordt geen Exact-relatie aangemaakt.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <Select value={modus} onValueChange={(v) => setModus(v as any)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="nieuw">Nieuwe onderneming aanmaken</SelectItem><SelectItem value="bestaand">Bestaande onderneming kiezen</SelectItem></SelectContent></Select>
            {modus === "nieuw" ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="sm:col-span-3"><Label>Naam</Label><Input value={naam} onChange={(e) => setNaam(e.target.value)} /></div>
                <div className="sm:col-span-2"><Label>KvK</Label><Input value={kvk} inputMode="numeric" maxLength={8} onChange={(e) => setKvk(e.target.value.replace(/\D/g, ""))} /></div>
                <div><Label>Rechtsvorm</Label><Input value={rechtsvorm} onChange={(e) => setRechtsvorm(e.target.value)} /></div>
              </div>
            ) : (
              <div className="space-y-1"><Label>Zoek op naam of KvK</Label><Input value={zoek} onChange={(e) => setZoek(e.target.value)} />
                {kandidaten.map((k) => <button key={k.id} type="button" onClick={() => setGekozen(k)} className={`block w-full rounded border p-2 text-left ${gekozen?.id === k.id ? "border-primary" : "border-border"}`}>{k.naam} <span className="text-xs text-muted-foreground">{k.rechtsvorm} · KvK {k.kvk ?? "-"}</span></button>)}
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <div><Label>Ingangsdatum</Label><Input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} /></div>
              <div><Label>Soort</Label><Select value={soort} onValueChange={setSoort}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="rechtsvormwijziging">Rechtsvormwijziging</SelectItem><SelectItem value="overname">Overname</SelectItem><SelectItem value="overig">Overig</SelectItem></SelectContent></Select></div>
            </div>
            <div><Label>Toelichting</Label><Textarea rows={3} value={toelichting} onChange={(e) => setToelichting(e.target.value)} /></div>
            <BijlageKiezer bestanden={bestanden} onChange={setBestanden} />
            <p role="note" className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">Een polis gaat niet mee naar een nieuw KvK-nummer. De klant moet een nieuwe aanvraag doen. Beëindig de oude polis per de dag vóór de ingangsdatum van de nieuwe polis, zodat er geen gat in de dekking zit en de klant niet dubbel betaalt.</p>
            <label className="flex items-start gap-2"><Checkbox checked={beeindigen} onCheckedChange={(v) => setBeeindigen(v === true)} />
              <span>Lopende contracten en polissen van {ond.naam} beeindigen per de dag voor de ingangsdatum (reden ondernemingswijziging). Te veel gefactureerd wordt alleen als concept-creditnota klaargezet.</span></label>
          </div>
          <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
            <Button onClick={opslaan} disabled={!geldig || bezig}>{bezig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Vastleggen</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

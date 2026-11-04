import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCheck } from "lucide-react";
import { isGeldigTelefoon } from "../../../supabase/functions/_shared/telefoon";

type Adres = { onderneming_id: string; naam: string; straat: string | null; huisnummer: string | null; postcode: string | null; plaats: string | null };
type Status = { tonen: boolean; telefoon_ontbreekt?: boolean; adressen?: Adres[] };

/** "Maak je gegevens compleet": alleen als telefoon of adres ontbreekt; "Later" verbergt 7 dagen. Nooit mail of sms. */
export function GegevensCompleet() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["mijn-gegevens-status"],
    queryFn: async (): Promise<Status> => {
      const { data, error } = await (supabase.rpc as any)("mijn_gegevens_status");
      if (error) return { tonen: false };
      return data as Status;
    },
  });
  const [tel, setTel] = useState("");
  const [adres, setAdres] = useState<Record<string, Partial<Adres>>>({});
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [klaar, setKlaar] = useState(false);

  if (klaar) return <Card className="border-primary/30 bg-primary/5"><CardContent className="py-4 text-sm">Dank je wel, je gegevens zijn bijgewerkt.</CardContent></Card>;
  if (!data?.tonen) return null;

  const veld = (id: string, k: keyof Adres) => (adres[id]?.[k] as string | undefined) ?? "";
  const zet = (id: string, k: keyof Adres, v: string) => setAdres((a) => ({ ...a, [id]: { ...a[id], [k]: v } }));

  const later = async () => {
    await (supabase.rpc as any)("mijn_gegevens_later");
    qc.invalidateQueries({ queryKey: ["mijn-gegevens-status"] });
  };
  const opslaan = async () => {
    setFout(null);
    if (data.telefoon_ontbreekt && tel.trim() && !isGeldigTelefoon(tel)) { setFout("Vul een geldig telefoonnummer in, bijvoorbeeld 06 12345678 of +32 470 12 34 56."); return; }
    const adressen = (data.adressen ?? []).map((a) => ({ onderneming_id: a.onderneming_id, straat: veld(a.onderneming_id, "straat"), huisnummer: veld(a.onderneming_id, "huisnummer"), postcode: veld(a.onderneming_id, "postcode"), plaats: veld(a.onderneming_id, "plaats") }))
      .filter((a) => a.straat || a.huisnummer || a.postcode || a.plaats);
    if (!tel.trim() && adressen.length === 0) { setFout("Vul minstens één gegeven in, of kies Later."); return; }
    setBezig(true);
    const { error } = await (supabase.rpc as any)("mijn_gegevens_aanvullen", { _telefoon: tel.trim() || null, _adressen: adressen });
    setBezig(false);
    if (error) { setFout(error.message); return; }
    setKlaar(true);
    qc.invalidateQueries({ queryKey: ["mijn-gegevens-status"] });
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg"><UserCheck className="h-5 w-5 text-primary" /> Maak je gegevens compleet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-foreground/80">Dan kunnen we je snel helpen als je ons belt of als er iets met je verzekering is.</p>
        {data.telefoon_ontbreekt && (
          <div className="max-w-sm space-y-1">
            <Label htmlFor="gc-tel">Telefoonnummer</Label>
            <Input id="gc-tel" type="tel" inputMode="tel" autoComplete="tel" placeholder="06 12345678" value={tel} onChange={(e) => setTel(e.target.value)} />
          </div>
        )}
        {(data.adressen ?? []).map((a) => (
          <fieldset key={a.onderneming_id} className="space-y-2">
            <legend className="text-sm font-medium">Adres van {a.naam}</legend>
            <div className="grid gap-2 sm:grid-cols-[2fr,1fr]">
              {!a.straat && <Input aria-label="Straat" placeholder="Straat" autoComplete="address-line1" value={veld(a.onderneming_id, "straat")} onChange={(e) => zet(a.onderneming_id, "straat", e.target.value)} />}
              {!a.huisnummer && <Input aria-label="Huisnummer" placeholder="Huisnummer" value={veld(a.onderneming_id, "huisnummer")} onChange={(e) => zet(a.onderneming_id, "huisnummer", e.target.value)} />}
              {!a.postcode && <Input aria-label="Postcode" placeholder="Postcode" autoComplete="postal-code" value={veld(a.onderneming_id, "postcode")} onChange={(e) => zet(a.onderneming_id, "postcode", e.target.value)} />}
              {!a.plaats && <Input aria-label="Plaats" placeholder="Plaats" autoComplete="address-level2" value={veld(a.onderneming_id, "plaats")} onChange={(e) => zet(a.onderneming_id, "plaats", e.target.value)} />}
            </div>
          </fieldset>
        ))}
        {fout && <p role="alert" className="text-sm text-destructive">{fout}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={opslaan} disabled={bezig}>{bezig ? "Opslaan..." : "Opslaan"}</Button>
          <Button size="sm" variant="ghost" onClick={later} disabled={bezig}>Later</Button>
        </div>
      </CardContent>
    </Card>
  );
}

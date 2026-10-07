import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Loader2, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToonTestrecords } from "@/hooks/useToonTestrecords";

export type ZoekResultaat = {
  id: string; titel: string | null; score: number; redenen: string[]; link: string; onderneming_id?: string | null;
  contactpersoon?: string | null; email?: string | null; exact_relatie_code?: string | null; bav_nummer?: string | null;
  kvk?: string | null; plaats?: string | null; iban?: string | null; status?: string | null; type?: string | null;
  lead_link?: string; aanvraag_link?: string; polisnummer?: string | null; is_test?: boolean;
};
export type ZoekGroepen = { klanten: ZoekResultaat[]; contracten: ZoekResultaat[]; leads: ZoekResultaat[]; opzeggingen: ZoekResultaat[]; service: ZoekResultaat[] };

const GROEPEN: { key: keyof ZoekGroepen; label: string }[] = [
  { key: "klanten", label: "Klanten" },
  { key: "contracten", label: "Contracten" },
  { key: "leads", label: "Leads en aanvragen" },
  { key: "opzeggingen", label: "Opzeggingen" },
  { key: "service", label: "Serviceaanvragen" },
];

/** Roept de beveiligde RPC zoek_universeel aan (alleen verzekering/supervisor/admin). IBAN komt alleen gemaskeerd terug. */
export async function zoekUniverseel(q: string, metTest = false): Promise<ZoekGroepen> {
  const { data, error } = await (supabase.rpc as any)("zoek_universeel", { _zoek: q, _met_test: metTest });
  if (error) throw error;
  return data as ZoekGroepen;
}

function Details({ r }: { r: ZoekResultaat }) {
  const delen = [
    r.contactpersoon, r.email,
    r.exact_relatie_code && `Exact-relatiecode ${r.exact_relatie_code}`,
    r.bav_nummer && `BAV-nummer ${r.bav_nummer}`,
    r.polisnummer && `Polisnummer ${r.polisnummer}`,
    r.kvk && `KVK ${r.kvk}`, r.plaats, r.iban && `IBAN ${r.iban}`, r.status && `status ${r.status}`,
  ].filter(Boolean);
  return delen.length ? <p className="break-words text-xs text-muted-foreground">{delen.join(" · ")}</p> : null;
}

/** Globale zoekbalk bovenaan het beheer. Zoekt op naam, bedrijf, nummers, IBAN, e-mail(domein), telefoon, postcode, plaats en referenties. */
export function UniverseleZoekbalk() {
  const { toonTest } = useToonTestrecords();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [res, setRes] = useState<ZoekGroepen | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const loc = useLocation();

  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    const klik = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", klik);
    return () => document.removeEventListener("mousedown", klik);
  }, []);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setRes(null); setFout(null); return; }
    let weg = false;
    const h = setTimeout(async () => {
      setLaden(true);
      try { const r = await zoekUniverseel(t, toonTest); if (!weg) { setRes(r); setFout(null); } }
      catch (e: any) { if (!weg) setFout(e?.message ?? "Zoeken mislukt"); }
      finally { if (!weg) setLaden(false); }
    }, 350);
    return () => { weg = true; clearTimeout(h); };
  }, [q, toonTest]);

  const totaal = res ? GROEPEN.reduce((n, g) => n + (res[g.key]?.length ?? 0), 0) : 0;

  return (
    <div ref={wrap} className="relative mb-6 min-w-0">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        aria-label="Zoek in het beheer" className="min-h-11 pl-9 pr-9"
        placeholder="Zoek op naam, bedrijf, BAV-nummer, Exact-relatiecode, IBAN, KVK, e-mail, telefoon, postcode of factuurnummer" />
      {q && <button type="button" aria-label="Zoekterm wissen" onClick={() => { setQ(""); setRes(null); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-lg">
          {laden && !res ? <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
            : fout ? <p className="text-sm text-destructive">{fout}</p>
            : totaal === 0 ? <p className="text-sm text-muted-foreground">Niets gevonden.</p>
            : GROEPEN.filter((g) => res?.[g.key]?.length).map((g) => (
              <section key={g.key} className="mb-3 last:mb-0">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label} ({res![g.key].length})</h3>
                <ul className="space-y-1">
                  {res![g.key].map((r) => (
                    <li key={r.id}>
                      <Link to={r.link} className="block rounded-md p-2 hover:bg-muted">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{r.titel || "Onbekend"}</span>
                          <Badge variant="outline" className="tabular-nums">{r.score}</Badge>
                          {r.is_test && <Badge variant="secondary">test</Badge>}
                          {!r.onderneming_id && g.key !== "klanten" && <span className="text-xs text-muted-foreground">nog niet gekoppeld aan een klant</span>}
                        </div>
                        <Details r={r} />
                        <p className="text-xs text-muted-foreground">Match: {r.redenen.join("; ")}</p>
                      </Link>
                      {(r.lead_link || r.aanvraag_link) && r.onderneming_id && (
                        <Link to={(r.lead_link || r.aanvraag_link)!} className="ml-2 text-xs text-primary hover:underline">Open {g.key === "leads" ? "lead" : "melding"}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}

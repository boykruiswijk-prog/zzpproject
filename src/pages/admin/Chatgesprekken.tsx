import { formatDateTimeNL } from "@/lib/dateFormat";
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ToonTestrecordsSchakelaar } from "@/components/admin/ToonTestrecordsSchakelaar";
import { useToonTestrecords } from "@/hooks/useToonTestrecords";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react";

interface Sessie { id: string; taal: string; startpagina: string | null; aantal_berichten: number; lead_id: string | null; is_test: boolean; created_at: string }
interface Bericht { id: string; sessie_id: string; rol: string; tekst: string; feedback: number | null; created_at: string; acties: any }

export default function Chatgesprekken() {
  const { toonTest } = useToonTestrecords();
  const [sessies, setSessies] = useState<Sessie[]>([]);
  const [feedback, setFeedback] = useState<Record<string, { op: number; neer: number }>>({});
  const [laden, setLaden] = useState(true);
  const [taal, setTaal] = useState("alle");
  const [alleenTerugbel, setAlleenTerugbel] = useState(false);
  const [zoek, setZoek] = useState("");
  const [gekozen, setGekozen] = useState<string | null>(null);
  const [detail, setDetail] = useState<Bericht[]>([]);

  useEffect(() => {
    (async () => {
      setLaden(true);
      let q = supabase.from("chat_sessions").select("id,taal,startpagina,aantal_berichten,lead_id,is_test,created_at").order("created_at", { ascending: false }).limit(500);
      if (!toonTest) q = q.eq("is_test", false);
      const { data } = await q;
      const lijst = (data as Sessie[]) ?? [];
      setSessies(lijst);
      if (lijst.length) {
        const { data: fb } = await supabase.from("chat_messages").select("sessie_id,feedback").in("sessie_id", lijst.map((s) => s.id)).not("feedback", "is", null);
        const m: Record<string, { op: number; neer: number }> = {};
        for (const r of fb ?? []) { const x = (m[r.sessie_id] ??= { op: 0, neer: 0 }); if (r.feedback === 1) x.op++; else x.neer++; }
        setFeedback(m);
      }
      setLaden(false);
    })();
  }, [toonTest]);

  useEffect(() => {
    if (!gekozen) { setDetail([]); return; }
    supabase.from("chat_messages").select("id,sessie_id,rol,tekst,feedback,created_at,acties").eq("sessie_id", gekozen).order("created_at").then(({ data }) => setDetail((data as Bericht[]) ?? []));
  }, [gekozen]);

  const zichtbaar = useMemo(() => sessies.filter((s) =>
    (taal === "alle" || s.taal === taal) && (!alleenTerugbel || s.lead_id) && (!zoek || (s.startpagina ?? "").includes(zoek))), [sessies, taal, alleenTerugbel, zoek]);

  return (
    <AdminLayout>
      <Helmet><title>Chatgesprekken | Beheer</title></Helmet>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="min-w-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle>Chatgesprekken met Zeker</CardTitle>
            <ToonTestrecordsSchakelaar />
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <select aria-label="Filter op taal" value={taal} onChange={(e) => setTaal(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                <option value="alle">Alle talen</option>{["nl", "en", "de", "fr"].map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={alleenTerugbel} onChange={(e) => setAlleenTerugbel(e.target.checked)} /> Alleen met terugbelverzoek</label>
              <Input placeholder="Startpagina bevat…" value={zoek} onChange={(e) => setZoek(e.target.value)} className="h-9 w-48" />
              <span className="text-sm text-muted-foreground">Bewaartermijn 90 dagen</span>
            </div>
            {laden ? <Loader2 className="h-5 w-5 animate-spin" /> : zichtbaar.length === 0 ? <p className="text-sm text-muted-foreground">Geen gesprekken.</p> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Datum</TableHead><TableHead>Taal</TableHead><TableHead className="text-right">Berichten</TableHead><TableHead>Startpagina</TableHead><TableHead>Terugbelverzoek</TableHead><TableHead>Feedback</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {zichtbaar.map((s) => (
                      <TableRow key={s.id} onClick={() => setGekozen(s.id)} className={`cursor-pointer ${gekozen === s.id ? "bg-muted" : ""}`}>
                        <TableCell className="whitespace-nowrap text-xs tabular-nums">{formatDateTimeNL(s.created_at)}{s.is_test && <Badge variant="outline" className="ml-2">Test</Badge>}</TableCell>
                        <TableCell className="uppercase">{s.taal}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.aantal_berichten}</TableCell>
                        <TableCell className="max-w-[180px]"><div className="truncate font-mono text-xs" title={s.startpagina ?? ""}>{s.startpagina ?? "-"}</div></TableCell>
                        <TableCell>{s.lead_id ? <Link to={`/admin/leads/${s.lead_id}`} onClick={(e) => e.stopPropagation()} className="text-primary underline">Ja</Link> : "Nee"}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{feedback[s.id] ? <span className="inline-flex items-center gap-2"><ThumbsUp className="h-3 w-3" />{feedback[s.id].op}<ThumbsDown className="h-3 w-3" />{feedback[s.id].neer}</span> : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader><CardTitle className="text-base">Gesprek</CardTitle></CardHeader>
          <CardContent className="max-h-[70vh] space-y-2 overflow-y-auto">
            {!gekozen ? <p className="text-sm text-muted-foreground">Kies een gesprek in de lijst.</p> : detail.map((b) => (
              <div key={b.id} className={`rounded-lg px-3 py-2 text-sm ${b.rol === "user" ? "ml-6 bg-primary/10" : "mr-6 bg-muted"}`}>
                <div className="mb-1 flex justify-between gap-2 text-xs text-muted-foreground"><span>{b.rol === "user" ? "Bezoeker" : "Zeker"}</span><span className="tabular-nums">{formatDateTimeNL(b.created_at)}</span></div>
                <p className="whitespace-pre-wrap break-words">{b.tekst}</p>
                {b.acties?.acties?.length ? <p className="mt-1 text-xs text-muted-foreground">Knoppen: {b.acties.acties.join(", ")}</p> : null}
                {b.feedback ? <p className="mt-1 text-xs">{b.feedback === 1 ? "Duim omhoog" : "Duim omlaag"}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

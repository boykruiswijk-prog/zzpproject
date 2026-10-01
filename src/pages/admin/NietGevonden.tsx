import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Copy, Check, Loader2 } from "lucide-react";
import { stelRedirectVoor } from "@/lib/redirectVoorstel";

interface Rij {
  id: string;
  pad: string;
  aantal: number;
  laatste_op: string;
  laatste_referrer: string | null;
  afgehandeld: boolean;
}

export default function NietGevonden() {
  const [rijen, setRijen] = useState<Rij[]>([]);
  const [slugs, setSlugs] = useState<string[]>([]);
  const [laden, setLaden] = useState(true);
  const [toonAfgehandeld, setToonAfgehandeld] = useState(false);

  const laad = async () => {
    setLaden(true);
    const [{ data }, { data: arts }] = await Promise.all([
      supabase
        .from("not_found_log")
        .select("id,pad,aantal,laatste_op,laatste_referrer,afgehandeld")
        .order("aantal", { ascending: false })
        .limit(500),
      supabase.from("articles").select("slug").eq("is_published", true),
    ]);
    setRijen((data as Rij[]) || []);
    setSlugs((arts || []).map((a) => a.slug));
    setLaden(false);
  };

  useEffect(() => {
    void laad();
  }, []);

  const zichtbaar = useMemo(
    () => rijen.filter((r) => toonAfgehandeld || !r.afgehandeld),
    [rijen, toonAfgehandeld],
  );

  const kopieer = async (r: Rij) => {
    const naar = stelRedirectVoor(r.pad, slugs);
    const regel = `{ from: ${JSON.stringify(r.pad.replace(/^\/+|\/+$/g, ""))}, to: ${JSON.stringify(naar)} },`;
    await navigator.clipboard.writeText(regel);
    toast({ title: "Redirect-regel gekopieerd", description: regel });
  };

  const markeer = async (r: Rij) => {
    const { error } = await supabase.from("not_found_log").update({ afgehandeld: true }).eq("id", r.id);
    if (error) toast({ title: "Opslaan mislukt", description: error.message, variant: "destructive" });
    else setRijen((rs) => rs.map((x) => (x.id === r.id ? { ...x, afgehandeld: true } : x)));
  };

  return (
    <AdminLayout>
      <Helmet>
        <title>Niet-gevonden pagina's | Beheer</title>
      </Helmet>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Niet-gevonden pagina's</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setToonAfgehandeld((v) => !v)}>
            {toonAfgehandeld ? "Verberg afgehandeld" : "Toon afgehandeld"}
          </Button>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Adressen waar bezoekers op een niet-bestaande pagina kwamen, meest bezocht bovenaan. Kopieer de
            voorgestelde redirect-regel en voeg die toe aan de lijst met oude adressen.
          </p>
          {laden ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : zichtbaar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen niet-gevonden pagina's.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pad</TableHead>
                  <TableHead className="text-right">Aantal</TableHead>
                  <TableHead>Laatst</TableHead>
                  <TableHead>Voorstel</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {zichtbaar.map((r) => (
                  <TableRow key={r.id} className={r.afgehandeld ? "opacity-50" : ""}>
                    <TableCell className="max-w-xs font-mono text-xs">
                      <div className="line-clamp-2 break-all" title={r.pad}>{r.pad}</div>
                      {r.laatste_referrer && (
                        <div className="truncate text-muted-foreground" title={r.laatste_referrer}>via {r.laatste_referrer}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.aantal}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums">
                      {formatDateTimeNL(r.laatste_op)}
                    </TableCell>
                    <TableCell className="max-w-xs font-mono text-xs">
                      <div className="line-clamp-2 break-all" title={stelRedirectVoor(r.pad, slugs)}>{stelRedirectVoor(r.pad, slugs)}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => kopieer(r)}>
                        <Copy className="mr-1 h-3 w-3" /> Redirect voorstellen
                      </Button>
                      {!r.afgehandeld && (
                        <Button size="sm" variant="ghost" onClick={() => markeer(r)} aria-label="Markeer als afgehandeld">
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}

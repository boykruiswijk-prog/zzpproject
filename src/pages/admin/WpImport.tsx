import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Download, Loader2, PlayCircle, Search } from "lucide-react";

interface RapportRow {
  slug: string;
  titel: string;
  woorden: number;
  bestaat_al: boolean;
  categorie: string;
  categorie_hub: string;
  categorie_onzeker: boolean;
  prioriteit: boolean;
  aantal_afbeeldingen: number;
  afbeeldingen: string[];
  status: string;
  reden?: string;
}

interface Resultaat {
  mode: string;
  route: string;
  samenvatting: {
    gevonden_in_bron: number;
    verwerkt: number;
    bestaat_al: number;
    nieuw: number;
    overgeslagen: number;
    geimporteerd: number;
    prioriteit_ontbreekt_in_bron: string[];
    afbeeldingen_totaal: number;
  };
  opmerkingen: string[];
  rapport: RapportRow[];
}

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "geimporteerd") return "default";
  if (s === "fout") return "destructive";
  if (s === "nieuw") return "outline";
  return "secondary";
};

export default function WpImport() {
  const [busy, setBusy] = useState<"dryrun" | "import" | null>(null);
  const [result, setResult] = useState<Resultaat | null>(null);
  const [slugs, setSlugs] = useState("");
  const [filter, setFilter] = useState("");

  const run = async (mode: "dryrun" | "import") => {
    if (mode === "import" && !confirm("Importeren als concept (is_published = false). Bestaande slugs worden nooit overschreven. Doorgaan?")) return;
    setBusy(mode);
    try {
      const slugList = slugs.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
      const { data, error } = await supabase.functions.invoke("wp-import", {
        body: { mode, slugs: slugList.length ? slugList : undefined },
      });
      if (error) throw error;
      setResult(data as Resultaat);
      toast({
        title: mode === "dryrun" ? "Dryrun klaar" : "Import klaar",
        description: `${(data as Resultaat).samenvatting.verwerkt} artikelen verwerkt via ${(data as Resultaat).route}.`,
      });
    } catch (e) {
      toast({ title: "Mislukt", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const rows = (result?.rapport ?? []).filter((r) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return r.slug.includes(q) || r.titel.toLowerCase().includes(q) || r.status.includes(q);
  });

  return (
    <AdminLayout>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
        <title>WordPress-import | ZP Zaken admin</title>
      </Helmet>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Download className="h-7 w-7" /> WordPress-import
          </h1>
          <p className="text-muted-foreground">
            Eenmalige contentmigratie van zpzaken.nl naar de kennisbank. Alles komt binnen als concept; bestaande slugs
            worden nooit overschreven.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Uitvoeren</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Optioneel: specifieke slugs (komma of witruimte gescheiden)</label>
              <Input value={slugs} onChange={(e) => setSlugs(e.target.value)} placeholder="uurtarief-berekenen-zzper, zzp-aftrekposten" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => run("dryrun")} disabled={busy !== null}>
                {busy === "dryrun" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
                Dryrun
              </Button>
              <Button onClick={() => run("import")} disabled={busy !== null}>
                {busy === "import" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-1" />}
                Importeren
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Samenvatting ({result.mode}, route: {result.route})</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 text-sm">
                <div><div className="text-muted-foreground">Gevonden</div><div className="text-2xl font-bold">{result.samenvatting.gevonden_in_bron}</div></div>
                <div><div className="text-muted-foreground">Verwerkt</div><div className="text-2xl font-bold">{result.samenvatting.verwerkt}</div></div>
                <div><div className="text-muted-foreground">Nieuw</div><div className="text-2xl font-bold">{result.samenvatting.nieuw}</div></div>
                <div><div className="text-muted-foreground">Bestaat al</div><div className="text-2xl font-bold">{result.samenvatting.bestaat_al}</div></div>
                <div><div className="text-muted-foreground">Overgeslagen</div><div className="text-2xl font-bold">{result.samenvatting.overgeslagen}</div></div>
                <div><div className="text-muted-foreground">Geïmporteerd</div><div className="text-2xl font-bold">{result.samenvatting.geimporteerd}</div></div>
                <div className="sm:col-span-3 lg:col-span-6 text-muted-foreground">
                  Afbeeldingen in content die nog naar de oude URL wijzen: {result.samenvatting.afbeeldingen_totaal}
                </div>
                {result.samenvatting.prioriteit_ontbreekt_in_bron.length > 0 && (
                  <div className="sm:col-span-3 lg:col-span-6">
                    <div className="text-muted-foreground">Prioriteitsslugs niet gevonden in de bron:</div>
                    <div className="text-sm">{result.samenvatting.prioriteit_ontbreekt_in_bron.join(", ")}</div>
                  </div>
                )}
                {result.opmerkingen.length > 0 && (
                  <div className="sm:col-span-3 lg:col-span-6">
                    <div className="text-muted-foreground">Opmerkingen:</div>
                    <ul className="list-disc pl-5">{result.opmerkingen.map((o) => <li key={o}>{o}</li>)}</ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle className="text-base">Resultaat per artikel ({rows.length})</CardTitle>
                <Input className="max-w-xs" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Zoek slug, titel of status" />
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Slug</TableHead>
                      <TableHead>Titel</TableHead>
                      <TableHead>Woorden</TableHead>
                      <TableHead>Categorie</TableHead>
                      <TableHead>Afb.</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.slug}>
                        <TableCell className="font-mono text-xs">
                          {r.slug}
                          {r.prioriteit && <Badge variant="destructive" className="ml-2">prioriteit</Badge>}
                        </TableCell>
                        <TableCell className="max-w-[280px] truncate">{r.titel}</TableCell>
                        <TableCell>{r.woorden}</TableCell>
                        <TableCell>
                          {r.categorie} <span className="text-muted-foreground text-xs">({r.categorie_hub})</span>
                          {r.categorie_onzeker && <Badge variant="secondary" className="ml-2">onzeker</Badge>}
                        </TableCell>
                        <TableCell>{r.aantal_afbeeldingen}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                          {r.reden && <div className="text-xs text-muted-foreground mt-1">{r.reden}</div>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

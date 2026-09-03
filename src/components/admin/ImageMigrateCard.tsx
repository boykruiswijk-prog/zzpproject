import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Image as ImageIcon, Loader2, PlayCircle, Search } from "lucide-react";

interface MigrateRow {
  origin_url: string;
  storage_path: string;
  nieuwe_url: string;
  artikelen: string[];
  status: string;
  reden?: string;
  bron?: string;
  bytes_voor?: number;
  bytes_na?: number;
}

interface MigrateResult {
  mode: string;
  bucket: string;
  samenvatting: Record<string, number | string>;
  artikelen_aangepast: { slug: string; content: boolean; image_url: boolean }[];
  pdfs: { url: string; storage_path: string; status: string; reden?: string }[];
  rapport: MigrateRow[];
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`;

const variant = (s: string): "default" | "secondary" | "destructive" | "outline" =>
  s === "gemigreerd" ? "default" : s === "mislukt" ? "destructive" : s === "bestond_al" ? "secondary" : "outline";

export function ImageMigrateCard() {
  const [busy, setBusy] = useState<"dryrun" | "import" | null>(null);
  const [result, setResult] = useState<MigrateResult | null>(null);

  const run = async (mode: "dryrun" | "import") => {
    if (
      mode === "import" &&
      !confirm("Afbeeldingen downloaden, naar webp omzetten, opslaan in storage en de artikel-URL's herschrijven. Doorgaan?")
    )
      return;
    setBusy(mode);
    try {
      const { data, error } = await supabase.functions.invoke("image-migrate", { body: { mode } });
      if (error) throw error;
      setResult(data as MigrateResult);
      toast({
        title: mode === "dryrun" ? "Dryrun klaar" : "Migratie klaar",
        description: `${(data as MigrateResult).samenvatting.bestanden_gevonden} bestanden gevonden.`,
      });
    } catch (e) {
      toast({ title: "Mislukt", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const s = result?.samenvatting;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ImageIcon className="h-5 w-5" /> Afbeeldingen loskoppelen van WordPress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Haalt elke afbeelding uit de artikelcontent en <code>image_url</code> op bij de originele bron op
          zpzaken.nl, slaat hem als webp (max. 1600 px breed) op in storage en herschrijft de URL's. PDF's onder
          wp-content/uploads worden alleen bewaard, niet herschreven.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => run("dryrun")} disabled={busy !== null}>
            {busy === "dryrun" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
            Dryrun
          </Button>
          <Button onClick={() => run("import")} disabled={busy !== null}>
            {busy === "import" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-1" />}
            Migreren
          </Button>
        </div>

        {s && (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 text-sm border-t pt-4">
            <div><div className="text-muted-foreground">Gevonden</div><div className="text-2xl font-bold">{s.bestanden_gevonden}</div></div>
            <div><div className="text-muted-foreground">Gemigreerd</div><div className="text-2xl font-bold">{s.gemigreerd}</div></div>
            <div><div className="text-muted-foreground">Bestond al</div><div className="text-2xl font-bold">{s.bestond_al}</div></div>
            <div><div className="text-muted-foreground">Mislukt</div><div className="text-2xl font-bold">{s.mislukt}</div></div>
            <div><div className="text-muted-foreground">PDF's</div><div className="text-2xl font-bold">{s.pdfs_gemigreerd}/{s.pdfs_gevonden}</div></div>
            <div><div className="text-muted-foreground">Artikelen aangepast</div><div className="text-2xl font-bold">{s.artikelen_aangepast}</div></div>
            <div className="sm:col-span-3 lg:col-span-6 text-muted-foreground">
              Grootte voor: {mb(Number(s.bytes_voor))} → na: {mb(Number(s.bytes_na))} · bucket {result?.bucket}
              {Number(s.resterend) > 0 && ` · nog ${s.resterend} te doen (voer nogmaals uit)`}
            </div>
          </div>
        )}

        {result && result.rapport.length > 0 && (
          <div className="overflow-x-auto max-h-[420px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bronbestand</TableHead>
                  <TableHead>Storage-pad</TableHead>
                  <TableHead>Artikelen</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rapport.map((r) => (
                  <TableRow key={r.storage_path}>
                    <TableCell className="font-mono text-xs max-w-[280px] truncate">{r.origin_url}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[240px] truncate">{r.storage_path}</TableCell>
                    <TableCell className="text-xs">{r.artikelen.join(", ")}</TableCell>
                    <TableCell>
                      <Badge variant={variant(r.status)}>{r.status}</Badge>
                      {r.reden && <div className="text-xs text-muted-foreground mt-1">{r.reden}</div>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

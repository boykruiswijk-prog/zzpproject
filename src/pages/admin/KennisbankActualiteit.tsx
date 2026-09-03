/**
 * Verouderingscheck kennisbank: scant alle artikelen op verouderde signalen.
 * Signaleert alleen, repareert niets automatisch.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { formatDateNL } from "@/lib/dateFormat";
import { AlertTriangle, CalendarClock, Coins, Euro, ExternalLink, Search, ShieldAlert } from "lucide-react";
import {
  controleerArtikelen,
  EERSTE_CONTROLEJAAR,
  LAATSTE_VERDACHTE_JAAR,
  type ArtikelVoorControle,
  type SignaalType,
} from "@/lib/contentActualiteit";
import { HUIDIG_BELASTINGJAAR } from "@/data/fiscaleCijfers";

const SIGNAAL_ICON: Record<SignaalType, typeof Euro> = {
  jaartal: CalendarClock,
  bedrag: Euro,
  regeling: ShieldAlert,
  token: AlertTriangle,
  controledatum: Coins,
};

const SIGNAAL_LABEL: Record<SignaalType, string> = {
  jaartal: "Jaartallen",
  bedrag: "Bedragen",
  regeling: "Regelingen",
  token: "Tokens",
  controledatum: "Controledatum",
};

export default function KennisbankActualiteit() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"alle" | "concept" | "gepubliceerd">("alle");
  const [type, setType] = useState<"alle" | SignaalType>("alle");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-articles-actualiteit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select(
          "id,slug,title,category,is_published,content,excerpt,published_at,updated_at,content_reviewed_at",
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ArtikelVoorControle[];
    },
  });

  const resultaten = useMemo(() => controleerArtikelen(data ?? []), [data]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return resultaten.filter((r) => {
      if (status === "concept" && r.artikel.is_published) return false;
      if (status === "gepubliceerd" && !r.artikel.is_published) return false;
      if (type !== "alle" && !r.signalen.some((s) => s.type === type)) return false;
      if (
        query &&
        !r.artikel.title.toLowerCase().includes(query) &&
        !r.artikel.slug.toLowerCase().includes(query)
      )
        return false;
      return true;
    });
  }, [resultaten, q, status, type]);

  const totaalSignalen = resultaten.reduce((sum, r) => sum + r.score, 0);
  const zonderControle = resultaten.filter((r) => !r.laatsteInhoudelijkeControle).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-7 w-7" /> Verouderingscheck kennisbank
          </h1>
          <p className="text-muted-foreground">
            Signaleert verouderde jaartallen, losse bedragen en gewijzigde regelingen. Er wordt niets
            automatisch aangepast — actualiseer per artikel met een officiele bron. Actueel
            belastingjaar: {HUIDIG_BELASTINGJAAR}, verdachte jaartallen {EERSTE_CONTROLEJAAR}–
            {LAATSTE_VERDACHTE_JAAR}.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{resultaten.length}</div>
              <div className="text-sm text-muted-foreground">artikelen gescand</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{totaalSignalen}</div>
              <div className="text-sm text-muted-foreground">signalen totaal</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{zonderControle}</div>
              <div className="text-sm text-muted-foreground">nooit inhoudelijk gecontroleerd</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek op titel of slug"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle statussen</SelectItem>
                <SelectItem value="concept">Alleen concepten</SelectItem>
                <SelectItem value="gepubliceerd">Alleen gepubliceerd</SelectItem>
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle soorten signalen</SelectItem>
                <SelectItem value="jaartal">Jaartallen</SelectItem>
                <SelectItem value="bedrag">Losse bedragen</SelectItem>
                <SelectItem value="regeling">Gewijzigde regelingen</SelectItem>
                <SelectItem value="token">Kapotte tokens</SelectItem>
                <SelectItem value="controledatum">Controledatum</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Scannen…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Geen artikelen gevonden.</div>
            ) : (
              <Accordion type="multiple" className="divide-y divide-border">
                {filtered.map((r) => (
                  <AccordionItem key={r.artikel.id} value={r.artikel.id} className="border-0">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={
                              r.score >= 10
                                ? "border-red-400 text-red-700"
                                : r.score >= 4
                                  ? "border-orange-400 text-orange-700"
                                  : "border-green-400 text-green-700"
                            }
                          >
                            {r.score} signalen
                          </Badge>
                          <span className="font-medium">{r.artikel.title}</span>
                          {!r.artikel.is_published && (
                            <Badge variant="outline" className="border-orange-400 text-orange-700">
                              Concept
                            </Badge>
                          )}
                          <Badge variant="outline">{r.artikel.category}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          /{r.artikel.slug} ·{" "}
                          {r.laatsteInhoudelijkeControle
                            ? `inhoudelijk gecontroleerd ${formatDateNL(r.laatsteInhoudelijkeControle)}`
                            : "nooit inhoudelijk gecontroleerd"}
                          {r.artikel.updated_at
                            ? ` · laatst bewerkt ${formatDateNL(r.artikel.updated_at)}`
                            : ""}
                        </div>
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {r.signalen.map((s) => (
                            <Badge key={s.type} variant="secondary" className="text-[11px]">
                              {SIGNAAL_LABEL[s.type]}: {s.aantal}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-3">
                        {r.signalen.length === 0 && (
                          <p className="text-sm text-muted-foreground">Geen signalen gevonden.</p>
                        )}
                        {r.signalen.map((s) => {
                          const Icon = SIGNAAL_ICON[s.type];
                          return (
                            <div key={s.type} className="rounded-md border border-border p-3">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                {s.omschrijving} ({s.aantal})
                              </div>
                              {s.voorbeelden.length > 0 && (
                                <ul className="mt-2 text-sm text-muted-foreground list-disc pl-5 space-y-1">
                                  {s.voorbeelden.map((v) => (
                                    <li key={v}>{v}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" onClick={() => navigate(`/admin/kennisbank/${r.artikel.id}`)}>
                            Artikel bewerken
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <a
                              href={`/kennisbank/${r.artikel.slug}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Bekijk online <ExternalLink className="h-3.5 w-3.5 ml-1" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

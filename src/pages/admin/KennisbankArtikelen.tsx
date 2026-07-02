import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useArticleCategoryList } from "@/hooks/useArticleCategoriesAdmin";
import { formatDateNL } from "@/lib/dateFormat";
import { Plus, Search, FileText } from "lucide-react";

interface Row {
  id: string;
  slug: string;
  title: string;
  category: string;
  is_published: boolean;
  published_at: string | null;
  updated_at: string;
  author_name: string | null;
}

export default function KennisbankArtikelen() {
  const navigate = useNavigate();
  const { data: categories } = useArticleCategoryList();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"alle" | "concept" | "gepubliceerd">("alle");
  const [cat, setCat] = useState<string>("alle");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("id,slug,title,category,is_published,published_at,updated_at,author_name")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (status === "concept" && r.is_published) return false;
      if (status === "gepubliceerd" && !r.is_published) return false;
      if (cat !== "alle" && r.category !== cat) return false;
      if (query && !r.title.toLowerCase().includes(query) && !r.slug.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [data, q, status, cat]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><FileText className="h-7 w-7" /> Kennisbank</h1>
            <p className="text-muted-foreground">Artikelen, blogs en nieuwsitems voor de website.</p>
          </div>
          <Button onClick={() => navigate("/admin/kennisbank/nieuw")}>
            <Plus className="h-4 w-4 mr-1" /> Nieuw artikel
          </Button>
        </div>

        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Zoek op titel of slug" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle statussen</SelectItem>
                <SelectItem value="concept">Alleen concepten</SelectItem>
                <SelectItem value="gepubliceerd">Alleen gepubliceerd</SelectItem>
              </SelectContent>
            </Select>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle rubrieken</SelectItem>
                {(categories ?? []).map((c) => (
                  <SelectItem key={c.slug} value={c.label}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Laden…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Geen artikelen gevonden.</div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => navigate(`/admin/kennisbank/${r.id}`)}
                    className="w-full text-left p-4 hover:bg-muted/40 transition-colors flex items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{r.title}</span>
                        {r.is_published ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">Gepubliceerd</Badge>
                        ) : (
                          <Badge variant="outline" className="border-orange-400 text-orange-700">Concept</Badge>
                        )}
                        <Badge variant="outline">{r.category}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        /{r.slug} · {r.author_name ?? "onbekend"} · bewerkt {formatDateNL(r.updated_at)}
                        {r.is_published && r.published_at ? ` · gepubliceerd ${formatDateNL(r.published_at)}` : ""}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

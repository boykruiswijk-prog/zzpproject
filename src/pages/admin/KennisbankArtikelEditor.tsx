import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useArticleCategoryList } from "@/hooks/useArticleCategoriesAdmin";
import { MarkdownEditor } from "@/components/admin/kennisbank/MarkdownEditor";
import { toast } from "@/hooks/use-toast";
import { logActiviteit } from "@/lib/activiteitenLog";
import { ArrowLeft, Save, Upload, ExternalLink, Sparkles, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function calcReadTime(md: string): string {
  const words = (md || "").replace(/[#>*_`\-\[\]()]/g, " ").split(/\s+/).filter(Boolean).length;
  const min = Math.max(1, Math.round(words / 220));
  return `${min} min`;
}

interface FormState {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  image_url: string;
  content: string;
  published_at: string;
  is_published: boolean;
  seo_title: string;
  seo_description: string;
  author_name: string;
}

const emptyForm: FormState = {
  title: "", slug: "", excerpt: "", category: "", image_url: "",
  content: "", published_at: "", is_published: false,
  seo_title: "", seo_description: "", author_name: "",
};

export default function KennisbankArtikelEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "nieuw";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: categories } = useArticleCategoryList();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Bestaand artikel laden
  const { data: existing, isLoading } = useQuery({
    queryKey: ["admin-article", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase.from("articles").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existing) {
      setForm({
        title: existing.title ?? "",
        slug: existing.slug ?? "",
        excerpt: existing.excerpt ?? "",
        category: existing.category ?? "",
        image_url: existing.image_url ?? "",
        content: existing.content ?? "",
        published_at: existing.published_at ? existing.published_at.slice(0, 10) : "",
        is_published: !!existing.is_published,
        seo_title: existing.seo_title ?? "",
        seo_description: existing.seo_description ?? "",
        author_name: existing.author_name ?? "",
      });
      setSlugTouched(true);
    }
  }, [existing]);

  // Vul standaard: auteur = ingelogde gebruiker, slug volgt titel tot handmatig aangepast
  useEffect(() => {
    if (isNew && !form.author_name && user) {
      (async () => {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
        setForm((f) => ({ ...f, author_name: profile?.full_name ?? user.email ?? "" }));
      })();
    }
  }, [isNew, user, form.author_name]);

  useEffect(() => {
    if (!slugTouched && form.title) {
      setForm((f) => ({ ...f, slug: slugify(f.title) }));
    }
  }, [form.title, slugTouched]);

  const readTime = useMemo(() => calcReadTime(form.content), [form.content]);

  async function handleImageUpload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("article-images").upload(path, file, { upsert: false, cacheControl: "3600" });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("article-images").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: pub.publicUrl }));
      toast({ title: "Afbeelding geüpload" });
    } catch (e: any) {
      toast({ title: "Uploaden mislukt", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function checkSlugUnique(slug: string): Promise<boolean> {
    const q = supabase.from("articles").select("id").eq("slug", slug);
    const { data } = isNew ? await q : await q.neq("id", id!);
    return !data || data.length === 0;
  }

  async function save(publish?: boolean) {
    const nextPublished = publish ?? form.is_published;

    if (!form.title.trim()) { toast({ title: "Titel is verplicht", variant: "destructive" }); return; }
    if (!form.slug.trim()) { toast({ title: "Slug is verplicht", variant: "destructive" }); return; }
    if (nextPublished && !form.category) { toast({ title: "Kies een rubriek voor publicatie", variant: "destructive" }); return; }

    const unique = await checkSlugUnique(form.slug);
    if (!unique) { toast({ title: "Slug bestaat al", description: "Kies een andere slug.", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const payload: any = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        excerpt: form.excerpt || null,
        category: form.category || "Algemeen",
        image_url: form.image_url || null,
        content: form.content || null,
        read_time: readTime,
        published_at: form.published_at ? new Date(form.published_at).toISOString() : new Date().toISOString(),
        is_published: nextPublished,
        seo_title: form.seo_title || null,
        seo_description: form.seo_description || null,
        author_name: form.author_name || null,
        author_id: user?.id ?? null,
      };

      const wasPublished = !!existing?.is_published;

      let savedId = id;
      if (isNew) {
        const { data, error } = await supabase.from("articles").insert(payload).select("id").single();
        if (error) throw error;
        savedId = data.id;
        await logActiviteit({
          actie_type: "artikel_aangemaakt",
          omschrijving: `Artikel aangemaakt: "${payload.title}"${nextPublished ? " (direct gepubliceerd)" : " (concept)"}`,
        });
        if (nextPublished) {
          await logActiviteit({ actie_type: "artikel_gepubliceerd", omschrijving: `Artikel gepubliceerd: "${payload.title}"` });
        }
      } else {
        const { error } = await supabase.from("articles").update(payload).eq("id", id!);
        if (error) throw error;
        await logActiviteit({ actie_type: "artikel_bewerkt", omschrijving: `Artikel bewerkt: "${payload.title}"` });
        if (nextPublished && !wasPublished) {
          await logActiviteit({ actie_type: "artikel_gepubliceerd", omschrijving: `Artikel gepubliceerd: "${payload.title}"` });
        }
      }

      qc.invalidateQueries({ queryKey: ["admin-articles"] });
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["article", form.slug] });

      toast({ title: nextPublished ? "Artikel gepubliceerd" : "Artikel opgeslagen" });
      if (isNew && savedId) navigate(`/admin/kennisbank/${savedId}`, { replace: true });
      else setForm((f) => ({ ...f, is_published: nextPublished }));
    } catch (e: any) {
      toast({ title: "Opslaan mislukt", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (!isNew && isLoading) return <AdminLayout><div className="p-8">Laden…</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/kennisbank")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Terug
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{isNew ? "Nieuw artikel" : "Artikel bewerken"}</h1>
              <div className="flex items-center gap-2 mt-1">
                {form.is_published ? (
                  <Badge className="bg-green-100 text-green-800 border-green-200">Gepubliceerd</Badge>
                ) : (
                  <Badge variant="outline" className="border-orange-400 text-orange-700">Concept</Badge>
                )}
                {!isNew && form.slug && (
                  <a href={`/kennisbank/${form.slug}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1">
                    Bekijk op website <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => save(false)} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> Opslaan als concept
            </Button>
            <Button onClick={() => save(true)} disabled={saving}>
              {form.is_published ? "Bijwerken (gepubliceerd)" : "Publiceren"}
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle>Inhoud</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Titel *</Label>
                  <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Titel van het artikel" />
                </div>
                <div>
                  <Label>Slug *</Label>
                  <Input value={form.slug} onChange={(e) => { setSlugTouched(true); setForm((f) => ({ ...f, slug: slugify(e.target.value) })); }} placeholder="url-vriendelijke-slug" />
                  <p className="text-xs text-muted-foreground mt-1">Wordt de URL: /kennisbank/{form.slug || "…"}</p>
                </div>
                <div>
                  <Label>Samenvatting (excerpt)</Label>
                  <Textarea rows={2} value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} placeholder="Korte omschrijving voor de kaartweergave" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>Inhoud (Markdown, tekstverwerker)</Label>
                    <span className="text-xs text-muted-foreground">Leestijd: {readTime}</span>
                  </div>
                  <MarkdownEditor value={form.content} onChange={(v) => setForm((f) => ({ ...f, content: v }))} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Live voorvertoning (zoals op website)</CardTitle></CardHeader>
              <CardContent>
                <article className="prose prose-lg max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {form.content || "_Nog geen inhoud._"}
                  </ReactMarkdown>
                </article>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Publicatie</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pub">Gepubliceerd</Label>
                  <Switch id="pub" checked={form.is_published} onCheckedChange={(v) => setForm((f) => ({ ...f, is_published: v }))} />
                </div>
                <div>
                  <Label>Publicatiedatum</Label>
                  <Input type="date" value={form.published_at} onChange={(e) => setForm((f) => ({ ...f, published_at: e.target.value }))} />
                </div>
                <div>
                  <Label>Rubriek {form.is_published && "*"}</Label>
                  <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue placeholder="Kies rubriek" /></SelectTrigger>
                    <SelectContent>
                      {(categories ?? []).map((c) => (
                        <SelectItem key={c.slug} value={c.label}>
                          {c.label}{c.hub_slug ? ` · ${c.hub_slug}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Auteur</Label>
                  <Input value={form.author_name} onChange={(e) => setForm((f) => ({ ...f, author_name: e.target.value }))} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Cover-afbeelding</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {form.image_url && (
                  <img src={form.image_url} alt="cover" className="w-full h-40 object-cover rounded-md border" />
                )}
                <Input value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://…" />
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full">
                  <Upload className="h-4 w-4 mr-1" /> {uploading ? "Uploaden…" : "Upload afbeelding"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>SEO</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>SEO titel</Label>
                  <Input value={form.seo_title} onChange={(e) => setForm((f) => ({ ...f, seo_title: e.target.value }))} maxLength={70} />
                </div>
                <div>
                  <Label>SEO omschrijving</Label>
                  <Textarea rows={3} value={form.seo_description} onChange={(e) => setForm((f) => ({ ...f, seo_description: e.target.value }))} maxLength={170} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

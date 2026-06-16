import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Power, Linkedin, Instagram } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDateNL } from "@/lib/dateFormat";

type Platform = "linkedin" | "instagram";

interface SocialFeature {
  id: string;
  platform: Platform;
  post_url: string;
  preview_image_url: string | null;
  preview_text: string | null;
  published_at: string | null;
  featured_until: string | null;
  active: boolean;
}

const empty = {
  platform: "linkedin" as Platform,
  post_url: "",
  preview_image_url: "",
  preview_text: "",
  published_at: new Date().toISOString().slice(0, 10),
  featured_until: "",
  active: true,
};

export default function AdminSocialMediaFeatures() {
  const [items, setItems] = useState<SocialFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Platform>("linkedin");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SocialFeature | null>(null);
  const [form, setForm] = useState({ ...empty });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("social_media_features")
      .select("*")
      .order("published_at", { ascending: false });
    if (error) toast({ title: "Kon posts niet laden", description: error.message, variant: "destructive" });
    setItems((data as SocialFeature[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty, platform: tab });
    setDialogOpen(true);
  };

  const openEdit = (item: SocialFeature) => {
    setEditing(item);
    setForm({
      platform: item.platform,
      post_url: item.post_url,
      preview_image_url: item.preview_image_url || "",
      preview_text: item.preview_text || "",
      published_at: item.published_at ? item.published_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
      featured_until: item.featured_until ? item.featured_until.slice(0, 10) : "",
      active: item.active,
    });
    setDialogOpen(true);
  };

  const validUrl = (v: string) => {
    try { new URL(v); return true; } catch { return false; }
  };

  const save = async () => {
    if (!validUrl(form.post_url)) return toast({ title: "Post URL is ongeldig", variant: "destructive" });
    if (!form.preview_image_url) return toast({ title: "Preview afbeelding URL is verplicht", variant: "destructive" });

    const payload = {
      platform: form.platform,
      post_url: form.post_url,
      preview_image_url: form.preview_image_url || null,
      preview_text: form.preview_text?.slice(0, 200) || null,
      published_at: form.published_at ? new Date(form.published_at).toISOString() : new Date().toISOString(),
      featured_until: form.featured_until ? new Date(form.featured_until).toISOString() : null,
      active: form.active,
    };

    const { error } = editing
      ? await supabase.from("social_media_features").update(payload).eq("id", editing.id)
      : await supabase.from("social_media_features").insert(payload);

    if (error) return toast({ title: "Opslaan mislukt", description: error.message, variant: "destructive" });
    toast({ title: editing ? "Post bijgewerkt" : "Post toegevoegd" });
    setDialogOpen(false);
    load();
  };

  const toggleActive = async (item: SocialFeature) => {
    const { error } = await supabase.from("social_media_features").update({ active: !item.active }).eq("id", item.id);
    if (error) return toast({ title: "Update mislukt", variant: "destructive" });
    load();
  };

  const remove = async (item: SocialFeature) => {
    if (!confirm("Deze post echt verwijderen?")) return;
    const { error } = await supabase.from("social_media_features").delete().eq("id", item.id);
    if (error) return toast({ title: "Verwijderen mislukt", variant: "destructive" });
    toast({ title: "Verwijderd" });
    load();
  };

  const renderList = (platform: Platform) => {
    const filtered = items.filter((i) => i.platform === platform);
    if (loading) return <p className="text-muted-foreground">Laden…</p>;
    if (!filtered.length) return <p className="text-muted-foreground">Nog geen posts. Voeg er een toe.</p>;
    return (
      <div className="space-y-3">
        {filtered.map((item) => (
          <Card key={item.id} className="p-4 flex gap-4 items-center">
            {item.preview_image_url ? (
              <img src={item.preview_image_url} alt="" className="h-20 w-20 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="h-20 w-20 rounded-lg bg-muted flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={item.active ? "default" : "secondary"}>{item.active ? "Actief" : "Inactief"}</Badge>
                {item.published_at && <span className="text-xs text-muted-foreground">{formatDateNL(item.published_at)}</span>}
              </div>
              <p className="text-sm line-clamp-2">{item.preview_text || item.post_url}</p>
              <a href={item.post_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
                {item.post_url}
              </a>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button size="sm" variant="ghost" onClick={() => openEdit(item)} title="Bewerken"><Pencil className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => toggleActive(item)} title={item.active ? "Deactiveren" : "Activeren"}><Power className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => remove(item)} title="Verwijderen"><Trash2 className="h-4 w-4" /></Button>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Social media features</h1>
            <p className="text-muted-foreground text-sm">Beheer posts die op Over Ons getoond worden.</p>
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Nieuwe post</Button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Platform)}>
          <TabsList>
            <TabsTrigger value="linkedin"><Linkedin className="h-4 w-4 mr-2" /> LinkedIn</TabsTrigger>
            <TabsTrigger value="instagram"><Instagram className="h-4 w-4 mr-2" /> Instagram</TabsTrigger>
          </TabsList>
          <TabsContent value="linkedin" className="mt-4">{renderList("linkedin")}</TabsContent>
          <TabsContent value="instagram" className="mt-4">{renderList("instagram")}</TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Post bewerken" : "Nieuwe post toevoegen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Platform</Label>
              <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v as Platform })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Post URL *</Label>
              <Input value={form.post_url} onChange={(e) => setForm({ ...form, post_url: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label>Preview afbeelding URL *</Label>
              <Input value={form.preview_image_url} onChange={(e) => setForm({ ...form, preview_image_url: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label>Preview tekst (max 200 tekens)</Label>
              <Textarea maxLength={200} value={form.preview_text} onChange={(e) => setForm({ ...form, preview_text: e.target.value })} rows={3} />
              <p className="text-xs text-muted-foreground mt-1">{form.preview_text.length}/200</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Publicatiedatum</Label>
                <Input type="date" value={form.published_at} onChange={(e) => setForm({ ...form, published_at: e.target.value })} />
              </div>
              <div>
                <Label>Featured tot (optioneel)</Label>
                <Input type="date" value={form.featured_until} onChange={(e) => setForm({ ...form, featured_until: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Actief</Label>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuleren</Button>
            <Button onClick={save}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

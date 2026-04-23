import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Upload, FolderOpen } from "lucide-react";

interface FileRow {
  name: string;
  created_at?: string;
  metadata?: { size?: number };
}

export default function PortalDocuments() {
  const { user } = usePortalAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.storage.from("klant-documenten").list(user.id, {
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error) {
      toast({ title: "Laden mislukt", description: error.message, variant: "destructive" });
    } else {
      setFiles(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("klant-documenten").upload(path, file);
    setUploading(false);
    e.target.value = "";
    if (error) {
      toast({ title: "Upload mislukt", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Geüpload" });
      load();
    }
  };

  const handleDownload = async (name: string) => {
    if (!user) return;
    const { data, error } = await supabase.storage
      .from("klant-documenten")
      .createSignedUrl(`${user.id}/${name}`, 3600);
    if (error || !data) {
      toast({ title: "Download mislukt", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <PortalLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Documenten</h1>
        <Button variant="accent" asChild disabled={uploading}>
          <label className="cursor-pointer">
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Upload bestand
            <input type="file" className="hidden" onChange={handleUpload} />
          </label>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mijn bestanden</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <Loader2 className="h-6 w-6 animate-spin text-accent" />}
          {!loading && files.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>Nog geen documenten geüpload.</p>
            </div>
          )}
          <ul className="divide-y">
            {files.map((f) => (
              <li key={f.name} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-sm">{f.name.replace(/^\d+-/, "")}</p>
                  {f.created_at && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(f.created_at).toLocaleString("nl-NL")}
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => handleDownload(f.name)}>
                  <Download className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </PortalLayout>
  );
}

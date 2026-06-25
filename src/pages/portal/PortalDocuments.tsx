import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download } from "lucide-react";

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
      <h1 className="text-3xl font-bold mb-6">Documenten</h1>

      <Card>
        <CardHeader>
          <CardTitle>Mijn bestanden</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <Loader2 className="h-6 w-6 animate-spin text-accent" />}
          {!loading && files.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">
              Er zijn op dit moment geen documenten beschikbaar.
            </p>
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

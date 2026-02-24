import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Loader2, Package, FileArchive } from "lucide-react";
import { Link } from "react-router-dom";

export default function DbaCheckBulk() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [batchName, setBatchName] = useState("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zipFile || !batchName.trim() || !user) return;

    setIsUploading(true);
    try {
      // 1. Upload ZIP to storage
      const zipPath = `bulk/${crypto.randomUUID()}_${zipFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("dba-documents")
        .upload(zipPath, zipFile);
      if (uploadError) throw uploadError;

      // 2. Create batch record
      const { data: batch, error: batchError } = await supabase
        .from("dba_batches")
        .insert({
          name: batchName.trim(),
          zip_file_url: zipPath,
          zip_filename: zipFile.name,
          status: "uploading",
          created_by: user.id,
        })
        .select()
        .single();
      if (batchError) throw batchError;

      // 3. Trigger processing
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-dba`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ batch_id: batch.id, action: "process" }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Fout bij verwerking");

      toast({
        title: "Batch aangemaakt!",
        description: `${result.total_candidates} kandidaten gevonden en gekoppeld.`,
      });
      navigate(`/admin/dba-checks/bulk/${batch.id}`);
    } catch (error: any) {
      console.error(error);
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link to="/admin/dba-checks">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              Bulk Wet DBA Check
            </h1>
            <p className="text-muted-foreground">
              Upload een ZIP met toetsingsformulieren en KVK-uittreksels
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Hoe werkt het?</CardTitle>
            <CardDescription>
              Het systeem pakt de ZIP uit, herkent welke documenten toetsingsformulieren en KVK-uittreksels zijn, 
              koppelt ze aan elkaar op basis van kandidaatnaam/bedrijfsnaam, en voert per kandidaat de volledige analyse uit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div className="p-3 rounded-lg bg-secondary/50">
                <div className="font-bold text-lg text-primary mb-1">1</div>
                <p className="text-muted-foreground">ZIP uploaden</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <div className="font-bold text-lg text-primary mb-1">2</div>
                <p className="text-muted-foreground">AI koppelt documenten</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <div className="font-bold text-lg text-primary mb-1">3</div>
                <p className="text-muted-foreground">Batch analyse & review</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Batch gegevens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="batchName">Batchnaam / Opdrachtgever *</Label>
                <Input
                  id="batchName"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="bijv. PB Projects - Februari 2026"
                  required
                />
              </div>
              <div>
                <Label htmlFor="zipFile">ZIP-bestand met documenten *</Label>
                <div className="mt-2">
                  <label
                    htmlFor="zipFile"
                    className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                  >
                    {zipFile ? (
                      <div className="flex items-center gap-3 text-sm">
                        <FileArchive className="h-8 w-8 text-primary" />
                        <div>
                          <p className="font-medium">{zipFile.name}</p>
                          <p className="text-muted-foreground">
                            {(zipFile.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload className="h-10 w-10" />
                        <span className="text-sm font-medium">Upload ZIP-bestand</span>
                        <span className="text-xs">
                          Bevat .docx toetsingsformulieren en optioneel .pdf KVK-uittreksels
                        </span>
                      </div>
                    )}
                  </label>
                  <input
                    id="zipFile"
                    type="file"
                    accept=".zip"
                    onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                    className="hidden"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" size="lg" disabled={isUploading || !zipFile || !batchName.trim()}>
            {isUploading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Bezig met verwerken...
              </>
            ) : (
              <>
                <Package className="h-5 w-5 mr-2" />
                Batch starten
              </>
            )}
          </Button>
        </form>
      </div>
    </AdminLayout>
  );
}

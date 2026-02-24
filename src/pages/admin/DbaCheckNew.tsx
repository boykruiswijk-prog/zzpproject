import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useCreateDbaCheck } from "@/hooks/useDbaChecks";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Loader2, FileText } from "lucide-react";
import { Link } from "react-router-dom";

export default function DbaCheckNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createCheck = useCreateDbaCheck();
  const [clientName, setClientName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [extractedText, setExtractedText] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // For .txt files, read directly
      if (selectedFile.name.endsWith(".txt")) {
        const reader = new FileReader();
        reader.onload = (evt) => setExtractedText(evt.target?.result as string || "");
        reader.readAsText(selectedFile);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      toast({ title: "Vul een klantnaam in", variant: "destructive" });
      return;
    }
    if (!file && !extractedText && !projectDescription) {
      toast({ title: "Upload een document of plak de tekst", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      let uploadedUrl = "";
      let originalFilename = "";

      if (file) {
        originalFilename = file.name;
        const filePath = `${crypto.randomUUID()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("dba-documents")
          .upload(filePath, file);

        if (uploadError) throw uploadError;
        uploadedUrl = filePath;

        // If Word document, we need the user to also paste text content
        if (!extractedText && !file.name.endsWith(".txt")) {
          // For Word docs, we'll use the project description + whatever text we have
          if (!projectDescription && !extractedText) {
            toast({
              title: "Plak de inhoud van het document",
              description: "Word-documenten kunnen niet automatisch uitgelezen worden. Plak de tekst hieronder.",
              variant: "destructive",
            });
            setIsUploading(false);
            return;
          }
        }
      }

      const textToAnalyze = extractedText || projectDescription;

      const result = await createCheck.mutateAsync({
        client_name: clientName.trim(),
        project_description: projectDescription || null,
        uploaded_file_url: uploadedUrl || null,
        original_filename: originalFilename || null,
        extracted_text: textToAnalyze || null,
      });

      toast({ title: "Check aangemaakt!", description: "Je kunt nu de analyse starten." });
      navigate(`/admin/dba-checks/${result.id}`);
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
            <h1 className="text-2xl font-bold">Nieuwe Wet DBA Check</h1>
            <p className="text-muted-foreground">Upload een overeenkomst voor analyse</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Klantgegevens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="clientName">Klantnaam / Bedrijfsnaam *</Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="bijv. PB Projects"
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Document uploaden</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="file">Overeenkomst (Word of tekst)</Label>
                <div className="mt-2">
                  <label
                    htmlFor="file"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                  >
                    {file ? (
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-5 w-5 text-primary" />
                        <span className="font-medium">{file.name}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload className="h-8 w-8" />
                        <span className="text-sm">Klik om een bestand te selecteren</span>
                        <span className="text-xs">.docx, .doc, .txt</span>
                      </div>
                    )}
                  </label>
                  <input
                    id="file"
                    type="file"
                    accept=".docx,.doc,.txt,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="extractedText">
                  Inhoud overeenkomst (plak hier de volledige tekst)
                </Label>
                <Textarea
                  id="extractedText"
                  value={extractedText}
                  onChange={(e) => setExtractedText(e.target.value)}
                  placeholder="Plak hier de volledige tekst van de overeenkomst..."
                  className="min-h-[200px]"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Projectomschrijving</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="projectDescription">
                  Projectomschrijving (optioneel - wordt apart geanalyseerd en herschreven)
                </Label>
                <Textarea
                  id="projectDescription"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Beschrijf het project / de werkzaamheden..."
                  className="min-h-[120px]"
                />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" disabled={isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Bezig met uploaden...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Check aanmaken
              </>
            )}
          </Button>
        </form>
      </div>
    </AdminLayout>
  );
}

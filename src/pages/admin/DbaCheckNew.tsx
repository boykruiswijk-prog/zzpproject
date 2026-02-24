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
  const [kvkFile, setKvkFile] = useState<File | null>(null);
  const [kvkText, setKvkText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [extractedText, setExtractedText] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const name = selectedFile.name.toLowerCase();
      if (name.endsWith(".txt")) {
        const reader = new FileReader();
        reader.onload = (evt) => setExtractedText(evt.target?.result as string || "");
        reader.readAsText(selectedFile);
      } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
        try {
          const mammoth = await import("mammoth");
          const arrayBuffer = await selectedFile.arrayBuffer();
          const result = await mammoth.default.extractRawText({ arrayBuffer });
          let text = result.value;
          
          // Parse docx XML to extract checkbox states (mammoth strips these)
          try {
            const { unzipSync } = await import("fflate");
            const uint8 = new Uint8Array(arrayBuffer);
            const files = unzipSync(uint8);
            const docXml = files["word/document.xml"];
            if (docXml) {
              const xmlText = new TextDecoder().decode(docXml);
              // Find all checkbox SDT elements and their checked state
              // Word uses <w14:checked w14:val="1"/> for checked, val="0" for unchecked
              const checkboxRegex = /<w:sdt>[\s\S]*?<\/w:sdt>/g;
              const checkboxStates: boolean[] = [];
              
              let match;
              while ((match = checkboxRegex.exec(xmlText)) !== null) {
                const sdtBlock = match[0];
                if (sdtBlock.includes("w14:checkbox") || sdtBlock.includes("w:checkbox")) {
                  const isChecked = /w14:checked[^/]*w14:val="1"/.test(sdtBlock) || 
                                    /w14:checked[^>]*val="1"/.test(sdtBlock);
                  checkboxStates.push(isChecked);
                }
              }
              
              if (checkboxStates.length > 0) {
                console.log("Extracted checkbox states:", checkboxStates);
                // Inject checkbox symbols into the checklist section
                const checklistIdx = text.indexOf("Aanvullende documentatie");
                if (checklistIdx !== -1) {
                  const before = text.substring(0, checklistIdx);
                  let after = text.substring(checklistIdx);
                  
                  const docNames = [
                    "Overeenkomst Eindopdrachtgever",
                    "Identiteits verklaring",
                    "Curriculum Vitae",
                    "Uittreksel Kamer van Koophandel",
                    "Polis beroeps en bedrijfsaansprakelijkheid",
                    "VOG verklaring",
                    "VCA certificering",
                  ];
                  
                  // Checkboxes come in pairs per doc: [aanwezig, niet_aanwezig]
                  for (let i = 0; i < docNames.length; i++) {
                    const cbIdx = i * 2;
                    if (cbIdx + 1 < checkboxStates.length) {
                      const sym1 = checkboxStates[cbIdx] ? "☒" : "☐";
                      const sym2 = checkboxStates[cbIdx + 1] ? "☒" : "☐";
                      // Replace doc name with annotated version
                      after = after.replace(
                        docNames[i],
                        `${docNames[i]}\t${sym1}\t${sym2}`
                      );
                    }
                  }
                  
                  // Handle VCA sub-items
                  const vcaStart = docNames.length * 2;
                  if (vcaStart < checkboxStates.length) {
                    const vcaBaseSym = checkboxStates[vcaStart] ? "☒" : "☐";
                    after = after.replace("VCA basis", `${vcaBaseSym}  VCA basis`);
                  }
                  if (vcaStart + 1 < checkboxStates.length) {
                    const vcaVolSym = checkboxStates[vcaStart + 1] ? "☒" : "☐";
                    after = after.replace("VCA VOL", `${vcaVolSym}  VCA VOL`);
                  }
                  
                  text = before + after;
                }
              }
            }
          } catch (zipErr) {
            console.warn("Could not parse docx XML for checkboxes:", zipErr);
          }
          
          setExtractedText(text);
          
          // Auto-extract project description from document
          // Look for "Omschrijving werkzaamheden" or "Projectomschrijving" section
          const descriptionLabels = [
            "Omschrijving werkzaamheden",
            "Projectomschrijving", 
            "Omschrijving van de werkzaamheden",
            "Werkzaamheden",
          ];
          for (const label of descriptionLabels) {
            const labelIdx = text.toLowerCase().indexOf(label.toLowerCase());
            if (labelIdx !== -1) {
              // Get text after the label until the next section header or double newline
              const afterLabel = text.substring(labelIdx + label.length);
              // Skip any colons, newlines, or whitespace right after label
              const contentStart = afterLabel.search(/[^\s:]/);
              if (contentStart !== -1) {
                const content = afterLabel.substring(contentStart);
                // Find end: next section header (line starting with a known header pattern) or "Aanvullende documentatie"
                const endPatterns = [
                  /\n\s*(?:Aanvullende documentatie|Startdatum|Einddatum|Uurtarief|Uren per week|Opdrachtgever|Eindopdrachtgever|Specifieke vaardigheden|Eigen materiaal)/i,
                ];
                let endIdx = content.length;
                for (const pattern of endPatterns) {
                  const match = content.match(pattern);
                  if (match && match.index !== undefined && match.index < endIdx) {
                    endIdx = match.index;
                  }
                }
                const extracted = content.substring(0, endIdx).trim();
                if (extracted.length > 10) {
                  setProjectDescription(extracted);
                  break;
                }
              }
            }
          }
          
          toast({ title: "Tekst geëxtraheerd uit document" });
        } catch {
          toast({ title: "Kon tekst niet automatisch uitlezen", description: "Plak de tekst handmatig hieronder.", variant: "destructive" });
        }
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
      let kvkFileUrl = "";
      let kvkFilename = "";

      if (file) {
        originalFilename = file.name;
        const filePath = `${crypto.randomUUID()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("dba-documents")
          .upload(filePath, file);
        if (uploadError) throw uploadError;
        uploadedUrl = filePath;

        if (!extractedText && !projectDescription) {
          toast({
            title: "Geen tekst beschikbaar",
            description: "Upload een .docx of .txt bestand, of plak de tekst handmatig.",
            variant: "destructive",
          });
          setIsUploading(false);
          return;
        }
      }

      if (kvkFile) {
        kvkFilename = kvkFile.name;
        const kvkPath = `kvk/${crypto.randomUUID()}_${kvkFile.name}`;
        const { error: kvkUploadError } = await supabase.storage
          .from("dba-documents")
          .upload(kvkPath, kvkFile);
        if (kvkUploadError) throw kvkUploadError;
        kvkFileUrl = kvkPath;
      }

      const textToAnalyze = extractedText || projectDescription;

      const result = await createCheck.mutateAsync({
        client_name: clientName.trim(),
        project_description: projectDescription || null,
        uploaded_file_url: uploadedUrl || null,
        original_filename: originalFilename || null,
        extracted_text: textToAnalyze || null,
        kvk_file_url: kvkFileUrl || null,
        kvk_filename: kvkFilename || null,
        kvk_text: kvkText || null,
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
            <p className="text-muted-foreground">Upload het toetsingsformulier voor screening</p>
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
              <CardTitle>Gegevens ter toetsing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="file">Toetsingsformulier ZP kandidaat (Word of tekst)</Label>
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
                        <span className="text-sm">Upload het ingevulde toetsingsformulier</span>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>KVK Uittreksel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="kvkFile">Upload KVK uittreksel (PDF)</Label>
                <div className="mt-2">
                  <label
                    htmlFor="kvkFile"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                  >
                    {kvkFile ? (
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-5 w-5 text-primary" />
                        <span className="font-medium">{kvkFile.name}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload className="h-8 w-8" />
                        <span className="text-sm">Upload KVK uittreksel</span>
                        <span className="text-xs">.pdf</span>
                      </div>
                    )}
                  </label>
                  <input
                    id="kvkFile"
                    type="file"
                    accept=".pdf"
                    onChange={async (e) => {
                      const f = e.target.files?.[0] || null;
                      setKvkFile(f);
                      if (f && f.name.toLowerCase().endsWith(".pdf")) {
                        try {
                          const pdfjsLib = await import("pdfjs-dist");
                          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
                          const arrayBuffer = await f.arrayBuffer();
                          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                          let text = "";
                          for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i);
                            const content = await page.getTextContent();
                            text += content.items.map((item: any) => item.str).join(" ") + "\n";
                          }
                          setKvkText(text.trim());
                          toast({ title: "Tekst geëxtraheerd uit KVK uittreksel" });
                        } catch {
                          toast({ title: "Kon PDF niet uitlezen", description: "Plak de tekst handmatig.", variant: "destructive" });
                        }
                      }
                    }}
                    className="hidden"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="kvkText">
                  KVK bedrijfsomschrijving (automatisch uit PDF, of plak handmatig)
                </Label>
                <Textarea
                  id="kvkText"
                  value={kvkText}
                  onChange={(e) => setKvkText(e.target.value)}
                  placeholder="bijv. 'Adviesbureau op het gebied van organisatie en management', 'IT-consultancy en softwareontwikkeling'..."
                  className="min-h-[100px]"
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

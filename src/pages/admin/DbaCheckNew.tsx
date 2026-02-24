import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useCreateDbaCheck } from "@/hooks/useDbaChecks";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Loader2, FileText } from "lucide-react";
import { Link } from "react-router-dom";

const DOCUMENT_CHECKLIST_ITEMS = [
  { key: "overeenkomst_eindopdrachtgever", label: "Overeenkomst Eindopdrachtgever" },
  { key: "identiteitsverklaring", label: "Identiteitsverklaring" },
  { key: "curriculum_vitae", label: "Curriculum Vitae" },
  { key: "kvk_uittreksel", label: "Uittreksel Kamer van Koophandel" },
  { key: "polis_bav", label: "Polis beroeps- en bedrijfsaansprakelijkheid" },
  { key: "vog_verklaring", label: "VOG verklaring" },
  { key: "vca_basis", label: "VCA basis" },
  { key: "vca_vol", label: "VCA VOL" },
  { key: "vil_vcu", label: "VIL VCU" },
];

export default function DbaCheckNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createCheck = useCreateDbaCheck();
  const [isUploading, setIsUploading] = useState(false);

  // Candidate fields
  const [clientName, setClientName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidatePhone, setCandidatePhone] = useState("");
  const [rechtsvorm, setRechtsvorm] = useState("");
  const [opdrachtgever, setOpdrachtgever] = useState("");
  const [eindopdrachtgever, setEindopdrachtgever] = useState("");
  const [functie, setFunctie] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [startdatum, setStartdatum] = useState("");
  const [einddatum, setEinddatum] = useState("");
  const [optieVerlenging, setOptieVerlenging] = useState("");
  const [uurtarief, setUurtarief] = useState("");
  const [urenPerWeek, setUrenPerWeek] = useState("");
  const [specifiekeVaardigheden, setSpecifiekeVaardigheden] = useState("");
  const [treedtZelfstandigOp, setTreedtZelfstandigOp] = useState(false);
  const [eigenMateriaalWerkwijze, setEigenMateriaalWerkwijze] = useState(false);

  // Document checklist
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  // File uploads
  const [file, setFile] = useState<File | null>(null);
  const [kvkFile, setKvkFile] = useState<File | null>(null);
  const [kvkText, setKvkText] = useState("");
  const [extractedText, setExtractedText] = useState("");

  const toggleChecklist = (key: string) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
          setExtractedText(result.value);
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
      toast({ title: "Vul een naam ZP kandidaat in", variant: "destructive" });
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
        candidate_email: candidateEmail || null,
        candidate_phone: candidatePhone || null,
        rechtsvorm: rechtsvorm || null,
        opdrachtgever: opdrachtgever || null,
        eindopdrachtgever: eindopdrachtgever || null,
        functie: functie || null,
        project_name: projectName || null,
        project_description: projectDescription || null,
        startdatum: startdatum || null,
        einddatum: einddatum || null,
        optie_verlenging: optieVerlenging || null,
        uurtarief: uurtarief || null,
        uren_per_week: urenPerWeek || null,
        specifieke_vaardigheden: specifiekeVaardigheden || null,
        treedt_zelfstandig_op: treedtZelfstandigOp,
        eigen_materiaal_werkwijze: eigenMateriaalWerkwijze,
        document_checklist: checklist,
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
            <p className="text-muted-foreground">Toetsing ZP kandidaat</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ZP Kandidaat gegevens */}
          <Card>
            <CardHeader>
              <CardTitle>Gegevens ZP kandidaat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientName">Naam ZP kandidaat *</Label>
                  <Input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Volledige naam" required />
                </div>
                <div>
                  <Label htmlFor="rechtsvorm">Rechtsvorm</Label>
                  <Input id="rechtsvorm" value={rechtsvorm} onChange={(e) => setRechtsvorm(e.target.value)} placeholder="bijv. Eenmanszaak, VOF, BV" />
                </div>
                <div>
                  <Label htmlFor="candidateEmail">E-mailadres</Label>
                  <Input id="candidateEmail" type="email" value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)} placeholder="email@voorbeeld.nl" />
                </div>
                <div>
                  <Label htmlFor="candidatePhone">Telefoonnummer</Label>
                  <Input id="candidatePhone" value={candidatePhone} onChange={(e) => setCandidatePhone(e.target.value)} placeholder="06-12345678" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Opdrachtgegevens */}
          <Card>
            <CardHeader>
              <CardTitle>Opdrachtgegevens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="opdrachtgever">Opdrachtgever</Label>
                  <Input id="opdrachtgever" value={opdrachtgever} onChange={(e) => setOpdrachtgever(e.target.value)} placeholder="bijv. PB Projects" />
                </div>
                <div>
                  <Label htmlFor="eindopdrachtgever">Eindopdrachtgever</Label>
                  <Input id="eindopdrachtgever" value={eindopdrachtgever} onChange={(e) => setEindopdrachtgever(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="functie">Functie</Label>
                  <Input id="functie" value={functie} onChange={(e) => setFunctie(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="projectName">Project</Label>
                  <Input id="projectName" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="projectDescription">Opdrachtomschrijving</Label>
                <Textarea id="projectDescription" value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} placeholder="Beschrijf de werkzaamheden..." className="min-h-[100px]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="startdatum">Startdatum</Label>
                  <Input id="startdatum" type="date" value={startdatum} onChange={(e) => setStartdatum(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="einddatum">Einddatum</Label>
                  <Input id="einddatum" type="date" value={einddatum} onChange={(e) => setEinddatum(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="optieVerlenging">Optie tot verlenging</Label>
                  <Input id="optieVerlenging" value={optieVerlenging} onChange={(e) => setOptieVerlenging(e.target.value)} placeholder="Ja / Nee" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="uurtarief">Uurtarief ZP'er</Label>
                  <Input id="uurtarief" value={uurtarief} onChange={(e) => setUurtarief(e.target.value)} placeholder="€" />
                </div>
                <div>
                  <Label htmlFor="urenPerWeek">Aantal uur per week</Label>
                  <Input id="urenPerWeek" value={urenPerWeek} onChange={(e) => setUrenPerWeek(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="specifiekeVaardigheden">Specifieke vaardigheden, kennis, opleiding</Label>
                <Textarea id="specifiekeVaardigheden" value={specifiekeVaardigheden} onChange={(e) => setSpecifiekeVaardigheden(e.target.value)} className="min-h-[80px]" />
              </div>
            </CardContent>
          </Card>

          {/* Zelfstandigheid */}
          <Card>
            <CardHeader>
              <CardTitle>Zelfstandigheid</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <Checkbox id="treedtZelfstandig" checked={treedtZelfstandigOp} onCheckedChange={(c) => setTreedtZelfstandigOp(!!c)} />
                <Label htmlFor="treedtZelfstandig" className="cursor-pointer">Treedt zelfstandig naar buiten toe</Label>
              </div>
              <div className="flex items-center space-x-3">
                <Checkbox id="eigenMateriaal" checked={eigenMateriaalWerkwijze} onCheckedChange={(c) => setEigenMateriaalWerkwijze(!!c)} />
                <Label htmlFor="eigenMateriaal" className="cursor-pointer">Zelfstandigheid (eigen materiaal, werkwijze enz.)</Label>
              </div>
            </CardContent>
          </Card>

          {/* Aanvullende documentatie checklist */}
          <Card>
            <CardHeader>
              <CardTitle>Aanvullende documentatie</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Vink aan welke documenten aanwezig zijn. Niet-aangevinkte items worden als aandachtspunt opgenomen in het ZP Approved stempel.</p>
              <div className="space-y-3">
                {DOCUMENT_CHECKLIST_ITEMS.map((item) => (
                  <div key={item.key} className="flex items-center space-x-3">
                    <Checkbox
                      id={item.key}
                      checked={!!checklist[item.key]}
                      onCheckedChange={() => toggleChecklist(item.key)}
                    />
                    <Label htmlFor={item.key} className="cursor-pointer">{item.label}</Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Document uploaden */}
          <Card>
            <CardHeader>
              <CardTitle>Overeenkomst uploaden</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="file">Overeenkomst (Word of tekst)</Label>
                <div className="mt-2">
                  <label htmlFor="file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors">
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
                  <input id="file" type="file" accept=".docx,.doc,.txt,.pdf" onChange={handleFileChange} className="hidden" />
                </div>
              </div>
              <div>
                <Label htmlFor="extractedText">Inhoud overeenkomst (automatisch uit document, of plak handmatig)</Label>
                <Textarea id="extractedText" value={extractedText} onChange={(e) => setExtractedText(e.target.value)} placeholder="Tekst wordt automatisch ingevuld bij upload..." className="min-h-[200px]" />
              </div>
            </CardContent>
          </Card>

          {/* KVK Uittreksel */}
          <Card>
            <CardHeader>
              <CardTitle>KVK Uittreksel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="kvkFile">Upload KVK uittreksel (PDF)</Label>
                <div className="mt-2">
                  <label htmlFor="kvkFile" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors">
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
                <Label htmlFor="kvkText">KVK bedrijfsomschrijving (automatisch uit PDF, of plak handmatig)</Label>
                <Textarea id="kvkText" value={kvkText} onChange={(e) => setKvkText(e.target.value)} placeholder="Tekst wordt automatisch ingevuld bij upload..." className="min-h-[100px]" />
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

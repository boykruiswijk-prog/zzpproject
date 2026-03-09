import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2, Award, Save, AlertTriangle, CheckCircle2, XCircle, Plus, Trash2 } from "lucide-react";
import type { DbaCheck } from "@/hooks/useDbaChecks";

interface CertificateField {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "boolean";
  dbColumn: string;
}

const CERTIFICATE_FIELDS: CertificateField[] = [
  { key: "client_name", label: "Naam ZP kandidaat", type: "text", dbColumn: "client_name" },
  { key: "opdrachtgever", label: "Opdrachtgever", type: "text", dbColumn: "opdrachtgever" },
  { key: "eindopdrachtgever", label: "Eindopdrachtgever", type: "text", dbColumn: "eindopdrachtgever" },
  { key: "functie", label: "Functie", type: "text", dbColumn: "functie" },
  { key: "project_name", label: "Project", type: "text", dbColumn: "project_name" },
  { key: "opdrachtomschrijving", label: "Opdrachtomschrijving", type: "textarea", dbColumn: "rewritten_description" },
  { key: "startdatum", label: "Startdatum", type: "date", dbColumn: "startdatum" },
  { key: "einddatum", label: "Einddatum", type: "date", dbColumn: "einddatum" },
  { key: "optie_verlenging", label: "Optie tot verlenging", type: "text", dbColumn: "optie_verlenging" },
  { key: "uurtarief", label: "Uurtarief", type: "text", dbColumn: "uurtarief" },
  { key: "uren_per_week", label: "Aantal uur per week", type: "text", dbColumn: "uren_per_week" },
  { key: "specifieke_vaardigheden", label: "Specifieke vaardigheden", type: "textarea", dbColumn: "specifieke_vaardigheden" },
  { key: "treedt_zelfstandig_op", label: "Treedt zelfstandig naar buiten", type: "boolean", dbColumn: "treedt_zelfstandig_op" },
  { key: "eigen_materiaal_werkwijze", label: "Eigen materiaal en werkwijze", type: "boolean", dbColumn: "eigen_materiaal_werkwijze" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  check: DbaCheck;
  onSaveAndCertify: (updatedValues: Record<string, any>) => Promise<void>;
  isLoading: boolean;
}

export function CertificatePreviewDialog({ open, onOpenChange, check, onSaveAndCertify, isLoading }: Props) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [complianceScore, setComplianceScore] = useState<number>(0);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [kvkMatch, setKvkMatch] = useState(false);
  const [kvkExplanation, setKvkExplanation] = useState("");
  const [kvkSuggestions, setKvkSuggestions] = useState<string[]>([]);
  const [fieldResults, setFieldResults] = useState<Array<{ field_name: string; present: boolean; value: string }>>([]);
  const [documentChecklist, setDocumentChecklist] = useState<Array<{ document_name: string; status: string }>>([]);

  // Helper: try to get a value from field_results by matching field name
  const getFromFieldResults = (fieldKey: string): string => {
    if (!check?.field_results?.length) return "";
    const nameMap: Record<string, string[]> = {
      client_name: ["naam zp kandidaat", "naam zp", "naam"],
      opdrachtgever: ["opdrachtgever"],
      eindopdrachtgever: ["eindopdrachtgever"],
      functie: ["functie"],
      project_name: ["project"],
      startdatum: ["startdatum"],
      einddatum: ["einddatum"],
      optie_verlenging: ["optie tot verlenging", "verlenging"],
      uurtarief: ["uurtarief", "tarief"],
      uren_per_week: ["aantal uur per week", "uur per week", "uren"],
      specifieke_vaardigheden: ["specifieke vaardigheden", "vaardigheden"],
    };
    const searchTerms = nameMap[fieldKey] || [fieldKey.replace(/_/g, " ")];
    for (const result of check.field_results) {
      const fn = (result.field_name || "").toLowerCase();
      if (searchTerms.some(t => fn.includes(t))) {
        return result.value || result.excerpt || "";
      }
    }
    return "";
  };

  useEffect(() => {
    if (open && check) {
      // Initialize candidate fields
      const initial: Record<string, any> = {};
      for (const field of CERTIFICATE_FIELDS) {
        if (field.key === "opdrachtomschrijving") {
          initial[field.key] = check.rewritten_description || check.project_description || "";
        } else if (field.type === "boolean") {
          initial[field.key] = (check as any)[field.dbColumn] ?? false;
        } else {
          const directVal = (check as any)[field.dbColumn];
          initial[field.key] = directVal || getFromFieldResults(field.key) || "";
        }
      }
      setValues(initial);

      // Initialize compliance score
      setComplianceScore(check.suggestions?.[0]?.score ?? 0);

      // Initialize missing fields (aandachtspunten)
      setMissingFields(check.missing_fields?.length ? [...check.missing_fields] : []);

      // Initialize KVK check
      if (check.kvk_check_result) {
        setKvkMatch(check.kvk_check_result.match ?? false);
        setKvkExplanation(check.kvk_check_result.explanation || "");
        setKvkSuggestions(check.kvk_check_result.suggestions?.length ? [...check.kvk_check_result.suggestions] : []);
      } else {
        setKvkMatch(false);
        setKvkExplanation("");
        setKvkSuggestions([]);
      }

      // Initialize field results
      if (check.field_results?.length) {
        setFieldResults(check.field_results.map((fr: any) => ({
          field_name: fr.field_name || "",
          present: fr.present ?? fr.filled ?? false,
          value: fr.value || fr.excerpt || fr.issue || "",
        })));
      } else {
        setFieldResults([]);
      }

      // Initialize document checklist
      const rawChecklist = check.document_checklist;
      if (Array.isArray(rawChecklist) && rawChecklist.length > 0) {
        setDocumentChecklist(rawChecklist.map((item: any) => ({
          document_name: item.document_name || "",
          status: typeof item.status === "string" ? item.status : "niet_aanwezig",
        })));
      } else {
        setDocumentChecklist([]);
      }
    }
  }, [open, check]);

  const handleChange = (key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    // Map candidate fields back to DB columns
    const dbValues: Record<string, any> = {};
    for (const field of CERTIFICATE_FIELDS) {
      const val = values[field.key];
      if (field.key === "opdrachtomschrijving") {
        dbValues["rewritten_description"] = val || null;
      } else if (field.type === "boolean") {
        dbValues[field.dbColumn] = !!val;
      } else if (field.type === "date") {
        dbValues[field.dbColumn] = val || null;
      } else {
        dbValues[field.dbColumn] = val || null;
      }
    }

    // Save compliance score into suggestions JSONB
    const existingSuggestions = check.suggestions?.[0] || {};
    dbValues["suggestions"] = [{ ...existingSuggestions, score: complianceScore }];

    // Save missing fields (aandachtspunten)
    dbValues["missing_fields"] = missingFields.filter(f => f.trim() !== "");

    // Save KVK check result
    if (check.kvk_check_result || kvkExplanation || kvkSuggestions.length > 0) {
      dbValues["kvk_check_result"] = {
        ...(check.kvk_check_result || {}),
        match: kvkMatch,
        explanation: kvkExplanation,
        suggestions: kvkSuggestions.filter(s => s.trim() !== ""),
      };
    }

    // Save field results
    if (fieldResults.length > 0) {
      dbValues["field_results"] = fieldResults.map(fr => ({
        field_name: fr.field_name,
        present: fr.present,
        filled: fr.present,
        value: fr.present ? fr.value : undefined,
        excerpt: fr.present ? fr.value : undefined,
        issue: !fr.present ? fr.value : undefined,
      }));
    }

    // Save document checklist
    if (documentChecklist.length > 0) {
      dbValues["document_checklist"] = documentChecklist.filter(d => d.document_name.trim() !== "");
    }

    await onSaveAndCertify(dbValues);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Certificaat voorvertoning — Controleer & pas aan
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-2">
          Controleer en pas alle velden aan voordat het definitieve PDF-certificaat en analyserapport worden gegenereerd.
        </p>

        {/* ═══ SECTION 1: Candidate Info ═══ */}
        <div className="space-y-4 mt-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Kandidaatgegevens</h3>
          {CERTIFICATE_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={field.key} className="text-sm font-medium">
                {field.label}
              </Label>
              {field.type === "text" && (
                <Input
                  id={field.key}
                  value={values[field.key] || ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  disabled={isLoading}
                />
              )}
              {field.type === "textarea" && (
                <Textarea
                  id={field.key}
                  value={values[field.key] || ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  rows={field.key === "opdrachtomschrijving" ? 6 : 3}
                  disabled={isLoading}
                />
              )}
              {field.type === "date" && (
                <Input
                  id={field.key}
                  type="date"
                  value={values[field.key] || ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  disabled={isLoading}
                />
              )}
              {field.type === "boolean" && (
                <div className="flex items-center gap-2">
                  <Switch
                    id={field.key}
                    checked={!!values[field.key]}
                    onCheckedChange={(checked) => handleChange(field.key, checked)}
                    disabled={isLoading}
                  />
                  <span className="text-sm text-muted-foreground">
                    {values[field.key] ? "Ja" : "Nee"}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <Separator className="my-4" />

        {/* ═══ SECTION 2: Compliance Score ═══ */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Compliance Score</h3>
          <div className="flex items-center gap-4">
            <Input
              type="number"
              min={0}
              max={100}
              value={complianceScore}
              onChange={(e) => setComplianceScore(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
              className="w-24"
              disabled={isLoading}
            />
            <span className="text-sm text-muted-foreground">/ 100</span>
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${complianceScore}%`,
                  backgroundColor: complianceScore >= 75 ? "hsl(142 76% 36%)" : complianceScore >= 50 ? "hsl(48 96% 53%)" : "hsl(0 84% 60%)",
                }}
              />
            </div>
          </div>
          {complianceScore < 75 && (
            <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 p-2 rounded-md">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              Score onder 75% — scorebalk op certificaat wordt rood weergegeven.
            </div>
          )}
        </div>

        <Separator className="my-4" />

        {/* ═══ SECTION 3: Field Results (Veldencontrole) ═══ */}
        {fieldResults.length > 0 && (
          <>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Veldencontrole</h3>
              <div className="space-y-2">
                {fieldResults.map((fr, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 rounded-md bg-muted/30">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...fieldResults];
                        updated[i] = { ...updated[i], present: !updated[i].present };
                        setFieldResults(updated);
                      }}
                      className="mt-1 flex-shrink-0"
                      disabled={isLoading}
                    >
                      {fr.present ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                    </button>
                    <div className="flex-1 space-y-1">
                      <Input
                        value={fr.field_name}
                        onChange={(e) => {
                          const updated = [...fieldResults];
                          updated[i] = { ...updated[i], field_name: e.target.value };
                          setFieldResults(updated);
                        }}
                        className="h-8 text-sm font-medium"
                        placeholder="Veldnaam"
                        disabled={isLoading}
                      />
                      <Input
                        value={fr.value}
                        onChange={(e) => {
                          const updated = [...fieldResults];
                          updated[i] = { ...updated[i], value: e.target.value };
                          setFieldResults(updated);
                        }}
                        className="h-8 text-sm"
                        placeholder={fr.present ? "Waarde" : "Reden / issue"}
                        disabled={isLoading}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setFieldResults(fieldResults.filter((_, j) => j !== i))}
                      className="mt-1 text-muted-foreground hover:text-destructive"
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFieldResults([...fieldResults, { field_name: "", present: true, value: "" }])}
                disabled={isLoading}
              >
                <Plus className="h-3 w-3 mr-1" /> Veld toevoegen
              </Button>
            </div>
            <Separator className="my-4" />
          </>
        )}

        {/* ═══ SECTION 4: Aandachtspunten ═══ */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Aandachtspunten</h3>
          {missingFields.length === 0 && (
            <p className="text-sm text-muted-foreground italic">Geen aandachtspunten.</p>
          )}
          <div className="space-y-2">
            {missingFields.map((field, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm flex-shrink-0">•</span>
                <Input
                  value={field}
                  onChange={(e) => {
                    const updated = [...missingFields];
                    updated[i] = e.target.value;
                    setMissingFields(updated);
                  }}
                  className="h-8 text-sm"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setMissingFields(missingFields.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMissingFields([...missingFields, ""])}
            disabled={isLoading}
          >
            <Plus className="h-3 w-3 mr-1" /> Aandachtspunt toevoegen
          </Button>
        </div>

        <Separator className="my-4" />

        {/* ═══ SECTION 5: KVK Check ═══ */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">KVK Check</h3>
          <div className="flex items-center gap-3">
            <Switch
              checked={kvkMatch}
              onCheckedChange={setKvkMatch}
              disabled={isLoading}
            />
            <span className="text-sm font-medium">{kvkMatch ? "Match gevonden" : "Geen match"}</span>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Toelichting</Label>
            <Textarea
              value={kvkExplanation}
              onChange={(e) => setKvkExplanation(e.target.value)}
              rows={3}
              placeholder="Toelichting KVK check..."
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Suggesties</Label>
            {kvkSuggestions.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm flex-shrink-0">•</span>
                <Input
                  value={s}
                  onChange={(e) => {
                    const updated = [...kvkSuggestions];
                    updated[i] = e.target.value;
                    setKvkSuggestions(updated);
                  }}
                  className="h-8 text-sm"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setKvkSuggestions(kvkSuggestions.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setKvkSuggestions([...kvkSuggestions, ""])}
              disabled={isLoading}
            >
              <Plus className="h-3 w-3 mr-1" /> Suggestie toevoegen
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-6 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Annuleren
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading} className="bg-primary hover:bg-primary/90">
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Opslaan & Certificaat afgeven
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

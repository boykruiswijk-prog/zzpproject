import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Award, Save } from "lucide-react";
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
      const initial: Record<string, any> = {};
      for (const field of CERTIFICATE_FIELDS) {
        if (field.key === "opdrachtomschrijving") {
          initial[field.key] = check.rewritten_description || check.project_description || "";
        } else if (field.type === "boolean") {
          initial[field.key] = (check as any)[field.dbColumn] ?? false;
        } else {
          // Direct DB value first, then fallback to field_results extraction
          const directVal = (check as any)[field.dbColumn];
          initial[field.key] = directVal || getFromFieldResults(field.key) || "";
        }
      }
      setValues(initial);
    }
  }, [open, check]);

  const handleChange = (key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    // Map back to DB columns
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
    await onSaveAndCertify(dbValues);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Certificaat voorvertoning — Controleer & pas aan
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-2">
          Controleer onderstaande velden. Pas eventueel aan voordat het definitieve PDF-certificaat wordt gegenereerd.
        </p>

        <div className="space-y-4 mt-2">
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

        <DialogFooter className="mt-4 gap-2">
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

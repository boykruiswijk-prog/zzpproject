import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEOHead } from "@/components/SEOHead";

export default function DbaVerificatie() {
  const { token } = useParams<{ token: string }>();

  const { data: check, isLoading } = useQuery({
    queryKey: ["dba-verificatie", token],
    queryFn: async () => {
      if (!token) return null;
      const { data, error } = await supabase
        .from("dba_checks")
        .select("client_name, certificate_number, certified_at, status, field_results, suggestions, verification_token")
        .eq("verification_token", token)
        .eq("status", "certified")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!check) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <SEOHead title="Certificaat niet gevonden | ZP Zaken" description="Dit Wet DBA certificaat bestaat niet of is niet meer geldig." />
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-8 text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Certificaat niet gevonden</h1>
            <p className="text-muted-foreground">
              Dit certificaat bestaat niet of is niet meer geldig.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const score = (check.suggestions as any)?.[0]?.score;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-background p-4">
      <SEOHead title={`Wet DBA Certificaat ${check.certificate_number} | ZP Zaken`} description={`Geverifieerd Wet DBA certificaat voor ${check.client_name}`} />
      <Card className="max-w-lg w-full border-emerald-200">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center">
            <ShieldCheck className="h-10 w-10 text-emerald-600" />
          </div>
          <CardTitle className="text-2xl">Wet DBA Certificaat</CardTitle>
          <p className="text-muted-foreground mt-1">
            Dit certificaat is afgegeven door ZP Zaken
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <Badge className="bg-emerald-100 text-emerald-900 text-lg px-4 py-1">
              {check.certificate_number}
            </Badge>
          </div>

          <div className="grid gap-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Klant</span>
              <span className="font-medium">{check.client_name}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Status</span>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="font-medium text-emerald-700">Gecertificeerd</span>
              </div>
            </div>
            {score !== undefined && (
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Compliance score</span>
                <span className="font-bold text-emerald-700">{score}/100</span>
              </div>
            )}
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Afgegeven op</span>
              <span className="font-medium">
                {check.certified_at
                  ? new Date(check.certified_at).toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "-"}
              </span>
            </div>
          </div>

          <div className="text-center text-xs text-muted-foreground pt-4 border-t">
            <p>Dit certificaat is geverifieerd via ZP Zaken.</p>
            <p className="mt-1">www.zpzaken.nl</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

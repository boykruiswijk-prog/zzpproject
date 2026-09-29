import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function PortalInviteAccept() {
  const { token } = useParams<{ token: string }>();
  const { user, isLoading } = usePortalAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "accepting" | "success" | "error" | "mailed">("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (isLoading || !token) return;

    if (!user) {
      // Niet ingelogd: laat de server een inloglink mailen naar het adres van de uitnodiging.
      if (status !== "idle") return;
      setStatus("accepting");
      supabase.functions.invoke("portal-invite-login", { body: { token } }).then(({ data }) => {
        const r = data as { success?: boolean; error?: string } | null;
        if (r && r.success === false) {
          setStatus("error");
          setMessage(r.error === "expired"
            ? "Deze uitnodiging is verlopen. Vraag een nieuwe inloglink aan via de inlogpagina."
            : "Deze uitnodiging is niet geldig.");
          return;
        }
        setStatus("mailed");
      });
      return;
    }

    const accept = async () => {
      setStatus("accepting");
      const { data, error } = await supabase.rpc("accept_portal_invitation", { _token: token });
      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }
      const result = data as { success: boolean; error?: string; already_accepted?: boolean };
      if (!result.success) {
        setStatus("error");
        const map: Record<string, string> = {
          invalid_token: "Deze uitnodiging is niet geldig.",
          expired: "Deze uitnodiging is verlopen.",
          email_mismatch: "Je bent ingelogd met een ander e-mailadres dan waarvoor de uitnodiging is verstuurd.",
          not_authenticated: "Log eerst in om de uitnodiging te accepteren.",
        };
        setMessage(map[result.error || ""] || result.error || "Onbekende fout");
        return;
      }
      setStatus("success");
      setTimeout(() => navigate("/portal", { replace: true }), 1500);
    };

    accept();
  }, [token, user, isLoading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Uitnodiging accepteren</CardTitle>
          <CardDescription>Je polis en facturen worden gekoppeld aan je account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(status === "idle" || status === "accepting" || isLoading) && (
            <Loader2 className="h-10 w-10 animate-spin text-accent mx-auto" />
          )}
          {status === "mailed" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
              <p className="font-medium">We hebben je een inloglink gestuurd</p>
              <p className="text-sm text-muted-foreground">Open de mail en klik op de knop om direct in te loggen bij Mijn ZP.</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
              <p>Gelukt! Je wordt doorgestuurd...</p>
            </>
          )}
          {status === "error" && (
            <>
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <p className="text-sm">{message}</p>
              <Button asChild variant="outline">
                <Link to="/portal/login">Nieuwe inloglink aanvragen</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

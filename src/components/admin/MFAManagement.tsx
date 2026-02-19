import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck, ShieldOff, Trash2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Factor {
  id: string;
  friendly_name: string | null;
  status: string;
  created_at: string;
}

export function MFAManagement() {
  const { toast } = useToast();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    loadFactors();
  }, []);

  const loadFactors = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error && data) {
      setFactors(
        data.totp.map((f) => ({
          id: f.id,
          friendly_name: f.friendly_name,
          status: f.status,
          created_at: f.created_at,
        }))
      );
    }
    setIsLoading(false);
  };

  const handleRemoveFactor = async (factorId: string) => {
    setIsRemoving(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      toast({
        title: "Fout bij verwijderen",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "2FA verwijderd",
        description: "De authenticator is losgekoppeld. Je moet 2FA opnieuw instellen bij de volgende login.",
      });
      await loadFactors();
    }
    setIsRemoving(false);
  };

  const verifiedFactors = factors.filter((f) => f.status === "verified");
  const hasActiveMFA = verifiedFactors.length > 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hasActiveMFA ? (
              <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-accent" />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <ShieldOff className="h-5 w-5 text-destructive" />
              </div>
            )}
            <div>
              <CardTitle className="text-lg">Tweestapsverificatie (2FA)</CardTitle>
              <CardDescription>
                {hasActiveMFA
                  ? "2FA is actief op je account"
                  : "2FA is niet actief — wordt gevraagd bij volgende login"}
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={loadFactors}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {hasActiveMFA ? (
          <div className="space-y-3">
            {verifiedFactors.map((factor) => (
              <div
                key={factor.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  <div>
                    <p className="font-medium text-sm">
                      {factor.friendly_name || "Authenticator App"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ingesteld op{" "}
                      {new Date(factor.created_at).toLocaleDateString("nl-NL", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4 mr-1" />
                      Verwijderen
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>2FA verwijderen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Als je 2FA verwijdert, wordt je bij de volgende login gevraagd om het opnieuw in te stellen. Je account is tijdelijk minder beveiligd.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuleren</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleRemoveFactor(factor.id)}
                        disabled={isRemoving}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isRemoving ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : null}
                        Verwijderen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Je hebt nog geen authenticator gekoppeld. Bij je volgende login wordt je gevraagd om 2FA in te stellen.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MFAVerifyProps {
  onVerified: () => void;
  onCancel: () => void;
}

export function MFAVerify({ onVerified, onCancel }: MFAVerifyProps) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [factorId, setFactorId] = useState<string>("");

  useEffect(() => {
    loadFactors();
  }, []);

  const loadFactors = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data.totp.length) {
      toast({
        title: "Geen 2FA factor gevonden",
        description: "Er is geen authenticator gekoppeld aan dit account.",
        variant: "destructive",
      });
      return;
    }
    // Use the first verified TOTP factor
    const verifiedFactor = data.totp.find(f => f.status === "verified");
    if (verifiedFactor) {
      setFactorId(verifiedFactor.id);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6 || !factorId) return;
    setIsLoading(true);

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });

    if (challengeError) {
      toast({
        title: "Verificatie mislukt",
        description: challengeError.message,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      toast({
        title: "Ongeldige code",
        description: "De ingevoerde code is onjuist. Probeer opnieuw.",
        variant: "destructive",
      });
      setCode("");
      setIsLoading(false);
      return;
    }

    onVerified();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && code.length === 6) {
      handleVerify();
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">Tweestapsverificatie</CardTitle>
        <CardDescription>
          Voer de 6-cijferige code in uit je authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mfa-code">Verificatiecode</Label>
          <Input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={handleKeyDown}
            className="text-center text-2xl tracking-[0.5em] font-mono"
            autoComplete="one-time-code"
            autoFocus
          />
        </div>

        <Button
          onClick={handleVerify}
          className="w-full"
          disabled={code.length !== 6 || isLoading || !factorId}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Verifiëren...
            </>
          ) : (
            "Verifiëren"
          )}
        </Button>

        <Button variant="ghost" onClick={onCancel} className="w-full text-muted-foreground">
          Annuleren
        </Button>
      </CardContent>
    </Card>
  );
}

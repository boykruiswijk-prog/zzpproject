import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MFAEnrollProps {
  onEnrolled: () => void;
  
}

export function MFAEnroll({ onEnrolled }: MFAEnrollProps) {
  const { toast } = useToast();
  const [factorId, setFactorId] = useState<string>("");
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [verifyCode, setVerifyCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    enrollFactor();
  }, []);

  const enrollFactor = async () => {
    setIsEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator App",
    });

    if (error) {
      toast({
        title: "Fout bij instellen 2FA",
        description: error.message,
        variant: "destructive",
      });
      setIsEnrolling(false);
      return;
    }

    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setIsEnrolling(false);
  };

  const handleVerify = async () => {
    if (verifyCode.length !== 6) return;
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
      code: verifyCode,
    });

    if (verifyError) {
      toast({
        title: "Code ongeldig",
        description: "Controleer de code in je authenticator app en probeer opnieuw.",
        variant: "destructive",
      });
      setVerifyCode("");
      setIsLoading(false);
      return;
    }

    toast({
      title: "2FA ingeschakeld ✓",
      description: "Tweestapsverificatie is succesvol ingesteld.",
    });
    onEnrolled();
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isEnrolling) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">Tweestapsverificatie instellen</CardTitle>
        <CardDescription>
          Scan de QR-code met je authenticator app (Google Authenticator, Authy, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* QR Code */}
        <div className="flex justify-center">
          <div className="rounded-lg border bg-white p-3">
            <img src={qrCode} alt="QR Code voor 2FA" className="h-48 w-48" />
          </div>
        </div>

        {/* Manual secret */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Kun je niet scannen? Voer deze code handmatig in:
          </Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">
              {secret}
            </code>
            <Button variant="outline" size="icon" onClick={copySecret} className="shrink-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Verify code */}
        <div className="space-y-2">
          <Label htmlFor="totp-code">Verificatiecode</Label>
          <Input
            id="totp-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
            className="text-center text-2xl tracking-[0.5em] font-mono"
            autoComplete="one-time-code"
          />
        </div>

        <Button
          onClick={handleVerify}
          className="w-full"
          disabled={verifyCode.length !== 6 || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Verifiëren...
            </>
          ) : (
            "Activeer 2FA"
          )}
        </Button>

      </CardContent>
    </Card>
  );
}

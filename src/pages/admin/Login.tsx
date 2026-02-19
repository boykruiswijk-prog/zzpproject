import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MFAVerify } from "@/components/admin/MFAVerify";
import { MFAEnroll } from "@/components/admin/MFAEnroll";

type LoginStep = "credentials" | "mfa_verify" | "mfa_enroll";

export default function AdminLogin() {
  const { user, isLoading: authLoading, isTeamMember } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<LoginStep>("credentials");

  // If already logged in and is team member, redirect
  if (!authLoading && user && isTeamMember) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setIsLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      toast({
        title: "Inloggen mislukt",
        description: "Controleer je e-mailadres en wachtwoord.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Check if user has MFA factors
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const verifiedFactors = factorsData?.totp.filter(f => f.status === "verified") || [];

    if (verifiedFactors.length > 0) {
      // User has MFA - needs to verify
      setStep("mfa_verify");
      setIsLoading(false);
      return;
    }

    // No MFA enrolled - prompt to set it up
    setStep("mfa_enroll");
    setIsLoading(false);
  };

  const handleMFAVerified = () => {
    toast({
      title: "Succesvol ingelogd ✓",
      description: "Tweestapsverificatie voltooid.",
    });
    navigate("/admin");
  };

  const handleMFAEnrolled = () => {
    navigate("/admin");
  };

  const handleCancel = async () => {
    await supabase.auth.signOut();
    setStep("credentials");
    setPassword("");
  };

  if (step === "mfa_verify") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <MFAVerify onVerified={handleMFAVerified} onCancel={handleCancel} />
      </div>
    );
  }

  if (step === "mfa_enroll") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <MFAEnroll onEnrolled={handleMFAEnrolled} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">ZP Zaken Dashboard</CardTitle>
          <CardDescription>
            Log in om toegang te krijgen tot het admin dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mailadres</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jouw@email.nl"
                required
                autoComplete="email"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Wachtwoord</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Voer je wachtwoord in"
                  required
                  autoComplete="current-password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || authLoading || !email.trim() || !password.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Bezig met inloggen...
                </>
              ) : (
                "Inloggen"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

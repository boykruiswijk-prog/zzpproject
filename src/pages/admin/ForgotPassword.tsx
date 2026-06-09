import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, ArrowLeft, CheckCircle } from "lucide-react";

const RESET_REDIRECT_PATH = "/admin/reset-password";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isLoading) return;
    setIsLoading(true);

    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}${RESET_REDIRECT_PATH}`,
    });

    // Always show success — don't reveal if email exists
    setIsSent(true);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Wachtwoord vergeten</CardTitle>
          <CardDescription>
            Voer je e-mailadres in en we sturen je een resetlink.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSent ? (
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Als dit e-mailadres bekend is, ontvang je binnen enkele minuten een resetlink.
              </p>
              <Link
                to="/admin/login"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Terug naar inloggen
              </Link>
            </div>
          ) : (
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
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !email.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Bezig met verzenden...
                  </>
                ) : (
                  "Stuur resetlink"
                )}
              </Button>
              <div className="text-center">
                <Link
                  to="/admin/login"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Terug naar inloggen
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail } from "lucide-react";

const THROTTLE_MS = 30_000;

export default function PortalLogin() {
  const { user } = usePortalAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const redirect = params.get("redirect") || "/portal";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (user) navigate(redirect, { replace: true });
  }, [user, redirect, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || cooldown > 0) return;
    setLoading(true);

    try {
      const { error } = await supabase.functions.invoke("send-portal-magiclink", {
        body: { email: email.trim(), redirect },
      });
      if (error) {
        // eslint-disable-next-line no-console
        console.debug("[portal-login] send-portal-magiclink:", error.message);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.debug("[portal-login] invoke failed:", err);
    }

    setLoading(false);
    setSent(true);
    setCooldown(THROTTLE_MS / 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Klantportaal</CardTitle>
          <CardDescription>
            Vraag een inloglink aan om je polis, facturen en documenten te bekijken.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                <Mail className="h-6 w-6 text-accent" />
              </div>
              <p className="text-sm text-muted-foreground">
                Als dit e-mailadres bij ons bekend is, ontvang je binnen enkele minuten een
                inloglink in je inbox.
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={cooldown > 0}
                onClick={() => {
                  setSent(false);
                }}
              >
                {cooldown > 0 ? `Opnieuw aanvragen (${cooldown}s)` : "Ander e-mailadres gebruiken"}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="login-email">E-mailadres</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="jij@bedrijf.nl"
                />
              </div>
              <Button
                type="submit"
                variant="accent"
                className="w-full"
                disabled={loading || cooldown > 0}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Stuur mij een inloglink"
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Je ontvangt een eenmalige, tijdgebonden link per e-mail. Geen wachtwoord nodig.
              </p>
            </form>
          )}

          <p className="text-xs text-muted-foreground text-center mt-6">
            <Link to="/" className="hover:underline">← Terug naar de website</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, RefreshCw, ExternalLink } from "lucide-react";

const ADMIN_EMAIL = "boy.kruiswijk@zpzaken.nl";

type TokenRow = {
  id: string;
  expires_at: string;
  division_code: string;
  environment: string;
  updated_at: string;
};

type Mapping = {
  id: string;
  pakket_naam: string;
  exact_subscription_type_id: string;
  omschrijving: string | null;
  actief: boolean;
};

type FailedBav = {
  id: string;
  bedrijfsnaam: string;
  email: string;
  pakket_naam: string;
  exact_foutmelding: string | null;
  exact_fout: string | null;
  aangemeld_op: string;
};

export default function Integraties() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<TokenRow | null>(null);
  const [mapping, setMapping] = useState<Mapping[]>([]);
  const [failed, setFailed] = useState<FailedBav[]>([]);
  const [stats, setStats] = useState({ ok: 0, fail: 0 });
  const [exactTypes, setExactTypes] = useState<{ ID: string; Code: string; Description: string }[]>([]);
  const [testMode, setTestMode] = useState(true);
  const [testing, setTesting] = useState(false);

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  useEffect(() => {
    const status = params.get("status");
    const msg = params.get("message");
    if (status === "success") toast.success("Exact Online succesvol gekoppeld!");
    if (status === "error") toast.error(`Exact koppeling mislukt: ${msg ?? "onbekend"}`);
  }, [params]);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: t }, { data: m }, { data: f }, { data: today }] = await Promise.all([
      supabase.from("exact_tokens").select("*").maybeSingle(),
      supabase.from("exact_subscription_mapping").select("*").order("pakket_naam"),
      supabase
        .from("bav_aanmeldingen")
        .select("id,bedrijfsnaam,email,pakket_naam,exact_foutmelding,exact_fout,aangemeld_op")
        .eq("exact_status", "fout")
        .order("aangemeld_op", { ascending: false })
        .limit(50),
      supabase
        .from("bav_aanmeldingen")
        .select("exact_status")
        .gte("aangemeld_op", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    ]);
    setToken((t as TokenRow) ?? null);
    if (t) setTestMode((t as TokenRow).environment === "test");
    setMapping((m as Mapping[]) ?? []);
    setFailed((f as FailedBav[]) ?? []);
    const all = (today as { exact_status: string }[]) ?? [];
    setStats({
      ok: all.filter((x) => x.exact_status === "gesynchroniseerd").length,
      fail: all.filter((x) => x.exact_status === "fout").length,
    });
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) loadAll();
  }, [isAdmin]);

  if (!user) return null;
  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-2">Geen toegang</h1>
          <p className="text-muted-foreground">
            Deze pagina is alleen toegankelijk voor de hoofdadmin.
          </p>
        </div>
      </AdminLayout>
    );
  }

  const handleConnect = () => {
    // Client_id wordt via env wel niet exposed — gebruik een edge function init zou netter zijn,
    // maar Exact's auth endpoint heeft de client_id in de URL nodig. We hebben deze niet client-side.
    // Daarom: redirect via een kleine init-edge-function route is niet nodig; we vragen admin
    // de autorisatie URL eenmalig handmatig op via Exact docs OF we maken een init function.
    // Eenvoudigste: open de Exact OAuth URL via edge function door client_id daar te lezen.
    window.location.href = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/exact-oauth-init`;
  };

  const fetchExactTypes = async () => {
    const { data, error } = await supabase.functions.invoke("exact-list-subscription-types");
    if (error) return toast.error(`Ophalen mislukt: ${error.message}`);
    const items = (data as { items?: { ID: string; Code: string; Description: string }[] })?.items ?? [];
    setExactTypes(items);
    toast.success(`${items.length} subscription types opgehaald`);
  };

  const saveMapping = async (id: string, value: string) => {
    const { error } = await supabase
      .from("exact_subscription_mapping")
      .update({ exact_subscription_type_id: value })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Mapping bijgewerkt");
    loadAll();
  };

  const testSync = async () => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("exact-test-sync");
    setTesting(false);
    if (error) return toast.error(`Test mislukt: ${error.message}`);
    const result = data as { success: boolean; result?: { success?: boolean; error?: string } };
    if (result.success && result.result?.success) {
      toast.success("Test aanmelding succesvol naar Exact verstuurd");
    } else {
      toast.error(`Test mislukt: ${result.result?.error ?? "onbekend"}`);
    }
    loadAll();
  };

  const retrySync = async (id: string) => {
    const { error } = await supabase
      .from("bav_aanmeldingen")
      .update({ exact_status: "wachtend", exact_foutmelding: null, exact_fout: null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status gereset op 'wachtend' — handmatige herverwerking nodig");
    loadAll();
  };

  const markManual = async (id: string) => {
    const { error } = await supabase
      .from("bav_aanmeldingen")
      .update({ exact_status: "handmatig_verwerkt" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Gemarkeerd als handmatig verwerkt");
    loadAll();
  };

  const tokenStatus = (() => {
    if (!token) return { label: "Niet verbonden", color: "bg-muted text-muted-foreground" };
    const expired = new Date(token.expires_at).getTime() < Date.now();
    if (expired) return { label: "Token verlopen", color: "bg-yellow-500 text-white" };
    return { label: "Actief", color: "bg-green-500 text-white" };
  })();

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-3xl font-bold">Integraties</h1>
          <p className="text-muted-foreground">Beheer externe koppelingen — Exact Online</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* SECTIE 1 — Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Exact Online — Status
                  <Badge className={tokenStatus.color}>{tokenStatus.label}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Environment</p>
                  <p className="font-medium">{token?.environment ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Divisie code</p>
                  <p className="font-medium">{token?.division_code ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Laatste token refresh</p>
                  <p className="font-medium">
                    {token?.updated_at ? new Date(token.updated_at).toLocaleString("nl-NL") : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Token verloopt</p>
                  <p className="font-medium">
                    {token?.expires_at ? new Date(token.expires_at).toLocaleString("nl-NL") : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Succesvolle syncs vandaag</p>
                  <p className="font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> {stats.ok}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Mislukte syncs vandaag</p>
                  <p className="font-medium flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" /> {stats.fail}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* SECTIE 2 — Autorisatie */}
            <Card>
              <CardHeader>
                <CardTitle>Eenmalige autorisatie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Klik hieronder om je Exact Online account te koppelen. Je wordt doorgestuurd
                  naar Exact om toestemming te geven. Hierna komen tokens automatisch in de
                  database en hoeft dit niet opnieuw.
                </p>
                <Button onClick={handleConnect} size="lg" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Verbind met Exact Online
                </Button>
              </CardContent>
            </Card>

            {/* SECTIE 6 — Test mode */}
            <Card>
              <CardHeader>
                <CardTitle>Test mode</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Test mode {testMode ? "AAN" : "UIT"}</p>
                  <p className="text-sm text-muted-foreground">
                    Wanneer aan: alle bedrijfsnamen krijgen TEST_ prefix in Exact. Wijzigen van
                    deze toggle gebeurt via de EXACT_TEST_MODE secret in Supabase.
                  </p>
                </div>
                <Switch checked={testMode} disabled />
              </CardContent>
            </Card>

            {/* SECTIE 3 — Subscription mapping */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Subscription mapping
                  <Button onClick={fetchExactTypes} variant="outline" size="sm" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Haal types op uit Exact
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {exactTypes.length > 0 && (
                  <div className="rounded-md border p-3 bg-muted/30 text-xs space-y-1 max-h-48 overflow-auto">
                    <p className="font-semibold">Beschikbare Exact types:</p>
                    {exactTypes.map((t) => (
                      <div key={t.ID} className="font-mono">
                        {t.Code} — {t.Description} → <span className="text-primary">{t.ID}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-3">
                  {mapping.map((m) => (
                    <div key={m.id} className="grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-3">
                        <p className="font-medium">{m.pakket_naam}</p>
                        <p className="text-xs text-muted-foreground">{m.omschrijving}</p>
                      </div>
                      <Input
                        className="col-span-7 font-mono text-xs"
                        defaultValue={m.exact_subscription_type_id}
                        onBlur={(e) => {
                          if (e.target.value !== m.exact_subscription_type_id) {
                            saveMapping(m.id, e.target.value);
                          }
                        }}
                      />
                      <div className="col-span-2">
                        {m.exact_subscription_type_id.startsWith("TODO_") ? (
                          <Badge variant="destructive">Leeg</Badge>
                        ) : (
                          <Badge className="bg-green-500 text-white">Gekoppeld</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* SECTIE 4 — Test sync */}
            <Card>
              <CardHeader>
                <CardTitle>Test sync</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Verstuurt een mock BAV aanmelding met bedrijfsnaam{" "}
                  <code className="text-xs">TEST_Verbindingstest_[timestamp]</code> naar Exact.
                </p>
                <Button onClick={testSync} disabled={testing} className="gap-2">
                  {testing && <Loader2 className="h-4 w-4 animate-spin" />}
                  Verstuur test aanmelding naar Exact
                </Button>
              </CardContent>
            </Card>

            {/* SECTIE 5 — Mislukte syncs */}
            <Card>
              <CardHeader>
                <CardTitle>Mislukte syncs ({failed.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {failed.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Geen mislukte syncs 🎉</p>
                ) : (
                  <div className="space-y-2">
                    {failed.map((f) => (
                      <div key={f.id} className="border rounded-md p-3 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <p className="font-medium">{f.bedrijfsnaam}</p>
                            <p className="text-xs text-muted-foreground">
                              {f.email} • {f.pakket_naam} •{" "}
                              {new Date(f.aangemeld_op).toLocaleString("nl-NL")}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => retrySync(f.id)}>
                              Opnieuw proberen
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => markManual(f.id)}>
                              Markeer handmatig
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-red-600 font-mono bg-red-50 p-2 rounded">
                          {f.exact_foutmelding ?? f.exact_fout}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

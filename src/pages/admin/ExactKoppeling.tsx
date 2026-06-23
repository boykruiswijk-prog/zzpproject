import { useEffect, useState } from "react";
import { formatDateNL } from "@/lib/dateFormat";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, Loader2, RefreshCw, Plug, Unlink, ExternalLink, Eye, Repeat } from "lucide-react";

type ExactConfig = {
  id: string;
  client_id: string | null;
  client_secret: string | null;
  divisie_code: string | null;
  redirect_uri: string | null;
  base_url: string | null;
  webhook_secret: string | null;
  access_token: string | null;
  refresh_token: string | null;
  access_token_expires_at: string | null;
  refresh_token_obtained_at: string | null;
  is_actief: boolean;
  last_sync_at: string | null;
  last_error: string | null;
};

type SyncLog = {
  id: string;
  created_at: string;
  trigger_type: string | null;
  status: string | null;
  exact_account_id: string | null;
  error_message: string | null;
  http_status: number | null;
  payload: unknown;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const RECOMMENDED_REDIRECT = `${SUPABASE_URL}/functions/v1/exact-oauth-callback`;

export default function ExactKoppeling() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [config, setConfig] = useState<ExactConfig | null>(null);
  const [form, setForm] = useState({
    client_id: "",
    client_secret: "",
    divisie_code: "",
    redirect_uri: RECOMMENDED_REDIRECT,
    webhook_secret: "",
  });
  const [logs, setLogs] = useState<SyncLog[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/admin/login");
      return;
    }
    if (!isAdmin) {
      navigate("/admin");
      return;
    }
    loadAll();
  }, [user, isAdmin, authLoading, navigate]);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: cfg }, { data: logRows }] = await Promise.all([
      // table not yet in generated types
      supabase.from("exact_config").select("*").maybeSingle(),
      // table not yet in generated types
      supabase
        .from("exact_sync_log")
        .select("id,created_at,trigger_type,status,exact_account_id,error_message,http_status,payload")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const c = (cfg as ExactConfig | null) ?? null;
    setConfig(c);
    if (c) {
      setForm({
        client_id: c.client_id ?? "",
        client_secret: c.client_secret ?? "",
        divisie_code: c.divisie_code ?? "",
        redirect_uri: c.redirect_uri ?? RECOMMENDED_REDIRECT,
        webhook_secret: c.webhook_secret ?? "",
      });
    }
    setLogs((logRows as SyncLog[]) ?? []);
    setLoading(false);
  };

  const saveConfig = async () => {
    setSaving(true);
    const payload = {
      client_id: form.client_id.trim() || null,
      client_secret: form.client_secret.trim() || null,
      divisie_code: form.divisie_code.trim() || null,
      redirect_uri: form.redirect_uri.trim() || null,
      webhook_secret: form.webhook_secret.trim() || null,
    };
    let error;
    if (config) {
      // table not yet in generated types
      ({ error } = await supabase.from("exact_config").update(payload).eq("id", config.id));
    } else {
      // table not yet in generated types
      ({ error } = await supabase.from("exact_config").insert(payload));
    }
    setSaving(false);
    if (error) return toast.error(`Opslaan mislukt: ${error.message}`);
    toast.success("Configuratie opgeslagen");
    loadAll();
  };

  const copyRedirect = async () => {
    await navigator.clipboard.writeText(RECOMMENDED_REDIRECT);
    toast.success("Redirect URI gekopieerd");
  };

  const startOAuth = async () => {
    setConnecting(true);
    const { data, error } = await supabase.functions.invoke("exact-oauth-start");
    setConnecting(false);
    if (error) return toast.error(`Kon flow niet starten: ${error.message}`);
    const res = data as { authorization_url?: string; error?: string };
    if (res.error) return toast.error(res.error);
    if (res.authorization_url) {
      window.open(res.authorization_url, "_blank", "noopener,noreferrer");
      toast.info("Autorisatie geopend in nieuw venster. Ververs hierna deze pagina.");
    }
  };

  const testConnection = async () => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("exact-sync", {
      body: { test: true, trigger_type: "admin_test" },
    });
    setTesting(false);
    if (error) return toast.error(`Test mislukt: ${error.message}`);
    const res = data as { success: boolean; exact_data?: { d?: unknown }; error?: string };
    if (!res.success) return toast.error(res.error ?? "Test mislukt");
    toast.success("Koppeling werkt — Exact heeft gereageerd");
    loadAll();
  };

  const [syncing, setSyncing] = useState(false);
  const [switchingDiv, setSwitchingDiv] = useState(false);
  const [selectedLog, setSelectedLog] = useState<SyncLog | null>(null);

  const syncNow = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("exact-sync", {
      body: { action: "sync_now", trigger_type: "manual_sync" },
    });
    setSyncing(false);
    if (error) return toast.error(`Sync mislukt: ${error.message}`);
    const res = data as { success: boolean; accounts_count?: number; invoices_count?: number; divisie_code?: string; error?: string };
    if (!res.success) return toast.error(res.error ?? "Sync mislukt");
    toast.success(`Sync OK — divisie ${res.divisie_code}, ${res.accounts_count} relaties, ${res.invoices_count} facturen`);
    loadAll();
  };

  const switchDivision = async () => {
    setSwitchingDiv(true);
    const { data, error } = await supabase.functions.invoke("exact-sync", {
      body: { action: "switch_division", trigger_type: "switch_division" },
    });
    setSwitchingDiv(false);
    if (error) return toast.error(`Wisselen mislukt: ${error.message}`);
    const res = data as { success: boolean; previous_division?: string; new_division?: string; changed?: boolean; note?: string; error?: string };
    if (!res.success) return toast.error(res.error ?? "Wisselen mislukt");
    if (res.changed) toast.success(`Divisie gewisseld: ${res.previous_division} → ${res.new_division}`);
    else toast.info(res.note ?? `Zelfde divisie: ${res.new_division}`);
    loadAll();
  };

  const disconnect = async () => {
    if (!config) return;
    if (!confirm("Weet je zeker dat je de Exact-koppeling wilt ontkoppelen?")) return;
    // table not yet in generated types
    const { error } = await supabase
      .from("exact_config")
      .update({
        is_actief: false,
        access_token: null,
        refresh_token: null,
        access_token_expires_at: null,
      })
      .eq("id", config.id);
    if (error) return toast.error(error.message);
    toast.success("Koppeling ontkoppeld");
    loadAll();
  };

  const status = (() => {
    if (!config?.client_id) return { label: "Niet geconfigureerd", color: "bg-muted text-muted-foreground" };
    if (config.last_error) return { label: "Fout", color: "bg-red-500 text-white" };
    if (config.is_actief && config.refresh_token) return { label: "Actief", color: "bg-green-500 text-white" };
    if (config.client_id && !config.refresh_token) return { label: "Wacht op autorisatie", color: "bg-orange-500 text-white" };
    return { label: "Onbekend", color: "bg-muted" };
  })();

  const isGreen = status.label === "Actief";

  const refreshIn = (() => {
    if (!config?.access_token_expires_at) return null;
    const mins = Math.round((new Date(config.access_token_expires_at).getTime() - Date.now()) / 60000);
    return mins;
  })();

  const refreshTokenValidUntil = (() => {
    if (!config?.refresh_token_obtained_at) return null;
    return new Date(new Date(config.refresh_token_obtained_at).getTime() + 30 * 24 * 60 * 60 * 1000);
  })();

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-3xl font-bold">Exact Online koppeling</h1>
          <p className="text-muted-foreground">OAuth2-verbinding met Exact Online — administratie ZP Zaken B.V.</p>
        </div>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Status
              <Badge className={status.color}>{status.label}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Divisie</p>
              <div className="flex items-center gap-2">
                <p className="font-medium">{config?.divisie_code ?? "—"}</p>
                {isGreen && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    onClick={switchDivision}
                    disabled={switchingDiv}
                  >
                    {switchingDiv ? <Loader2 className="h-3 w-3 animate-spin" /> : <Repeat className="h-3 w-3" />}
                    Wissel administratie
                  </Button>
                )}
              </div>
            </div>
            <div>
              <p className="text-muted-foreground">Laatste sync</p>
              <p className="font-medium">
                {config?.last_sync_at ? new Date(config.last_sync_at).toLocaleString("nl-NL") : "—"}
              </p>
            </div>
            {config?.last_error && (
              <div className="col-span-2 text-xs font-mono bg-red-50 text-red-700 p-2 rounded">
                {config.last_error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuratie */}
        <Card>
          <CardHeader>
            <CardTitle>Configuratie</CardTitle>
            <CardDescription>
              Gegevens van de app-registratie in Exact Online.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Aanbevolen Redirect URI (kopieer naar Exact)</Label>
              <div className="flex gap-2">
                <Input readOnly value={RECOMMENDED_REDIRECT} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={copyRedirect}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Client ID</Label>
                <Input
                  value={form.client_id}
                  onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <Label>Client Secret</Label>
                <Input
                  type="password"
                  value={form.client_secret}
                  onChange={(e) => setForm({ ...form, client_secret: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <Label>Divisie code</Label>
                <Input
                  value={form.divisie_code}
                  onChange={(e) => setForm({ ...form, divisie_code: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <Label>Redirect URI (in Exact)</Label>
                <Input
                  value={form.redirect_uri}
                  onChange={(e) => setForm({ ...form, redirect_uri: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
              <div className="col-span-2">
                <Label>Webhook secret (optioneel)</Label>
                <Input
                  type="password"
                  value={form.webhook_secret}
                  onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <Button onClick={saveConfig} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Opslaan
            </Button>
          </CardContent>
        </Card>

        {/* Acties */}
        <Card>
          <CardHeader>
            <CardTitle>Acties</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {!isGreen && (
              <Button onClick={startOAuth} disabled={connecting} className="gap-2">
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                Verbind met Exact Online
              </Button>
            )}
            {isGreen && (
              <>
                <Button onClick={syncNow} disabled={syncing} className="gap-2">
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Sync nu
                </Button>
                <Button onClick={testConnection} disabled={testing} variant="outline" className="gap-2">
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  Test koppeling
                </Button>
                <Button onClick={disconnect} variant="outline" className="gap-2">
                  <Unlink className="h-4 w-4" />
                  Ontkoppelen
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Tokenstatus */}
        {isGreen && (
          <Card>
            <CardHeader>
              <CardTitle>Tokenstatus</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Access token vernieuwt</p>
                <p className="font-medium">
                  {refreshIn !== null
                    ? refreshIn > 0
                      ? `over ${refreshIn} minuten`
                      : "nu (verlopen — wordt bij volgende call ververst)"
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Refresh token geldig tot</p>
                <p className="font-medium">
                  {refreshTokenValidUntil
                    ? formatDateNL(refreshTokenValidUntil)
                    : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sync log */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Sync log ({logs.length})
              <Button variant="outline" size="sm" onClick={loadAll} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Ververs
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nog geen sync-events.</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground text-left">
                    <tr>
                      <th className="py-2 pr-3">Tijdstip</th>
                      <th className="py-2 pr-3">Trigger</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Account ID</th>
                      <th className="py-2 pr-3">HTTP</th>
                      <th className="py-2">Foutmelding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id} className="border-t">
                        <td className="py-2 pr-3">{new Date(l.created_at).toLocaleString("nl-NL")}</td>
                        <td className="py-2 pr-3">{l.trigger_type}</td>
                        <td className="py-2 pr-3">
                          <Badge
                            className={
                              l.status === "success"
                                ? "bg-green-500 text-white"
                                : l.status === "error"
                                ? "bg-red-500 text-white"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {l.status}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 font-mono">{l.exact_account_id ?? "—"}</td>
                        <td className="py-2 pr-3">{l.http_status ?? "—"}</td>
                        <td className="py-2 text-red-600 max-w-md truncate" title={l.error_message ?? ""}>
                          {l.error_message ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

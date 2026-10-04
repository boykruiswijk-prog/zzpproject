import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, RefreshCw, ExternalLink } from "lucide-react";
import { ExactEmailImportBlock } from "@/components/admin/ExactEmailImportBlock";
import { ExactMandaatImportBlock } from "@/components/admin/ExactMandaatImportBlock";
import { amsterdamDagGrenzen, bepaalExactHealth, herkoppelenVoor } from "@/lib/exactHealth";

type TokenRow = {
  id: string;
  access_token_expires_at: string | null;
  divisie_code: string | null;
  is_actief: boolean;
  updated_at: string;
  refresh_token_obtained_at: string | null;
  last_error: string | null;
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
  const { user, isAdmin } = useAuth();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<TokenRow | null>(null);
  const [mapping, setMapping] = useState<Mapping[]>([]);
  const [failed, setFailed] = useState<FailedBav[]>([]);
  const [stats, setStats] = useState({ ok: 0, fail: 0 });
  const [lastKeepalive, setLastKeepalive] = useState<string | null>(null);
  const [exactTypes, setExactTypes] = useState<{ ID: string; Code: string; Description: string }[]>([]);
  const [screeningEnabled, setScreeningEnabled] = useState(false);

  useEffect(() => {
    const status = params.get("status");
    const msg = params.get("message");
    if (status === "success") toast.success("Exact Online succesvol gekoppeld!");
    if (status === "error") toast.error(`Exact koppeling mislukt: ${msg ?? "onbekend"}`);
  }, [params]);

  const loadAll = async () => {
    setLoading(true);
    const dag = amsterdamDagGrenzen();
    const [{ data: t }, { data: screening }, { data: m }, { data: f }, { data: today }, { data: ka }] = await Promise.all([
      supabase.from("exact_config").select("id,access_token_expires_at,divisie_code,is_actief,updated_at,refresh_token_obtained_at,last_error").maybeSingle(),
      supabase.from("integratie_config").select("enabled").eq("naam", "exact_online").maybeSingle(),
      supabase.from("exact_subscription_mapping").select("*").order("pakket_naam"),
      supabase
        .from("bav_aanmeldingen")
        .select("id,bedrijfsnaam,email,pakket_naam,exact_foutmelding,exact_fout,aangemeld_op")
        .eq("exact_status", "fout")
        .order("aangemeld_op", { ascending: false })
        .limit(50),
      supabase
        .from("exact_sync_log")
        .select("status")
        .gte("created_at", dag.start)
        .lt("created_at", dag.eind)
        .limit(1000),
      supabase
        .from("exact_sync_log")
        .select("created_at")
        .eq("trigger_type", "keepalive")
        .eq("status", "success")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setToken((t as TokenRow) ?? null);
    setLastKeepalive((ka as { created_at: string } | null)?.created_at ?? null);
    setScreeningEnabled(screening?.enabled === true);
    setMapping((m as Mapping[]) ?? []);
    setFailed((f as FailedBav[]) ?? []);
    const all = (today as { status: string | null }[]) ?? [];
    setStats({
      ok: all.filter((x) => x.status === "success").length,
      fail: all.filter((x) => x.status === "error").length,
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
            Deze pagina is alleen toegankelijk voor admin en supervisor.
          </p>
        </div>
      </AdminLayout>
    );
  }

  const handleConnect = async () => {
    // exact-oauth-start controleert de ingelogde admin en genereert een state-token
    // dat de callback valideert. Nooit direct naar Exact redirecten zonder state.
    const { data, error } = await supabase.functions.invoke("exact-oauth-start");
    if (error || !data?.authorization_url) {
      toast.error(`Koppeling starten mislukt: ${error?.message ?? data?.error ?? "onbekende fout"}`);
      return;
    }
    window.location.href = data.authorization_url as string;
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

  const health = bepaalExactHealth({
    isActief: !!token?.is_actief,
    lastError: token?.last_error,
    laatsteKeepaliveSucces: lastKeepalive,
  });
  const badgeVariant =
    health.kind === "ok" ? "bg-green-600 text-white"
    : health.kind === "verouderd" ? "bg-orange-500 text-white"
    : health.kind === "fout" ? "bg-destructive text-destructive-foreground"
    : "bg-muted text-muted-foreground";
  const fmt = (v: string | Date | null | undefined) => (v ? new Date(v).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" }) : "—");
  const herkoppel = herkoppelenVoor(token?.refresh_token_obtained_at);

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
                  <Badge className={badgeVariant}>{health.label}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                {health.kind === "fout" && (
                  <div className="col-span-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive break-words">
                    {health.melding}
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">BAV-koppeling</p>
                  <p className="font-medium">{token?.is_actief ? "Actief" : "Uitgeschakeld"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Divisie code</p>
                  <p className="font-medium">{token?.divisie_code ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Laatste token refresh</p>
                  <p className="font-medium">{fmt(token?.refresh_token_obtained_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Laatste controle</p>
                  <p className="font-medium">{fmt(lastKeepalive)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Opnieuw koppelen vóór</p>
                  <p className="font-medium">{fmt(herkoppel)}</p>
                  <p className="text-xs text-muted-foreground">Ter informatie; de dagelijkse controle verlengt dit automatisch.</p>
                </div>
                <div />
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

            <Card>
              <CardHeader><CardTitle>Dienstschakelaars</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><span>BAV-AVB via Exact</span><Badge variant={token?.is_actief ? "default" : "secondary"}>{token?.is_actief ? "Actief" : "Uit"}</Badge></div>
                <div className="flex items-center justify-between"><span>Screening via Exact</span><Badge variant={screeningEnabled ? "default" : "secondary"}>{screeningEnabled ? "Actief" : "Uit"}</Badge></div>
                <Button asChild variant="outline"><Link to="/admin/exact-koppeling">Exact-koppeling beheren</Link></Button>
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
            <ExactEmailImportBlock />
            <ExactMandaatImportBlock />
          </>
        )}
      </div>
    </AdminLayout>
  );
}

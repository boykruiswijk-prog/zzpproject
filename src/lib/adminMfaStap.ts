import { supabase } from "@/integrations/supabase/client";

export function openAdminMfa() {
  const next = window.location.pathname + window.location.search + window.location.hash;
  window.location.assign(`/admin/login?next=${encodeURIComponent(next)}`);
}

/** Check before a mutation; no automatic retry of cancellation or mail. */
export async function controleerAdminMfa(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!error && data?.currentLevel === "aal2") return true;
  openAdminMfa();
  return false;
}

export async function verwerkMfaFout(error: unknown, data?: { error?: string } | null): Promise<boolean> {
  const response = (error as { context?: unknown } | null)?.context;
  const body = response instanceof Response ? await response.clone().json().catch(() => null) : data;
  if (body?.error !== "mfa_required") return false;
  openAdminMfa();
  return true;
}
import { useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";

const KEY = "zp_toon_testrecords";
const listeners = new Set<() => void>();

function lees(): boolean {
  try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function zetToonTestrecords(v: boolean) {
  try { sessionStorage.setItem(KEY, v ? "1" : "0"); } catch { /* noop */ }
  listeners.forEach((l) => l());
}

/**
 * Testrecords (is_test = true) zijn standaard verborgen in het beheer.
 * Alleen admin/supervisor kan ze tijdelijk (per browsersessie) tonen.
 */
export function useToonTestrecords() {
  const { isSupervisorOrAdmin } = useAuth();
  const aan = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    lees,
    () => false,
  );
  return {
    toonTest: isSupervisorOrAdmin && aan,
    magSchakelen: isSupervisorOrAdmin,
    zet: zetToonTestrecords,
  };
}

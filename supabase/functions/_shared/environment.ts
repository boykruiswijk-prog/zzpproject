// Centrale, fail-safe omgevingsdetectie voor alle Edge Functions.
//
// Regels (de veilige interpretatie wint altijd):
//
// 1. Productie iff de aanroep aantoonbaar van het productiedomein komt
//    (Origin- of Referer-host eindigt op `zpzaken.nl`).
// 2. APP_ENV is uitsluitend een SECUNDAIRE override die productie naar
//    preview kan downgraden ('preview' | 'development' | 'staging' | 'test').
//    APP_ENV kan NOOIT een niet-productie host naar productie upgraden.
// 3. Als er geen request beschikbaar is (cron / server-to-server zonder
//    Origin/Referer), valt de bepaling terug op APP_ENV. Bij twijfel:
//    preview.
//
// Concreet eindresultaat: zodra het frontend-domein zpzaken.nl is, schakelt
// alle mailafhandeling vanzelf naar productiegedrag. Tot die tijd blijft
// alles in preview-modus, ook als APP_ENV=production. Geen handmatige
// secretwissel nodig bij livegang.

const PRODUCTION_HOST_SUFFIXES = ["zpzaken.nl"];
const PREVIEW_APP_ENVS = new Set(["preview", "development", "dev", "staging", "test"]);

export type Environment = {
  isProduction: boolean;
  hostSource: "origin" | "referer" | "none";
  host: string | null;
  appEnv: string;
  reason: string;
};

function extractHost(headerValue: string | null): string | null {
  if (!headerValue) return null;
  try {
    return new URL(headerValue).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostIsProduction(host: string | null): boolean {
  if (!host) return false;
  return PRODUCTION_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
}

export function resolveEnvironment(req?: Request | null): Environment {
  const appEnv = (Deno.env.get("APP_ENV") || "production").toLowerCase().trim();

  let host: string | null = null;
  let hostSource: Environment["hostSource"] = "none";
  if (req) {
    const originHost = extractHost(req.headers.get("origin"));
    const refererHost = extractHost(req.headers.get("referer"));
    if (originHost) {
      host = originHost;
      hostSource = "origin";
    } else if (refererHost) {
      host = refererHost;
      hostSource = "referer";
    }
  }

  // Geen host beschikbaar → server-to-server / cron. Val terug op APP_ENV,
  // maar alleen 'production' telt als productie; al het andere is preview.
  if (!host) {
    const isProduction = appEnv === "production";
    return {
      isProduction,
      hostSource,
      host: null,
      appEnv,
      reason: isProduction
        ? "no request host; APP_ENV=production → production (server-to-server)"
        : `no request host; APP_ENV=${appEnv} → preview (veilig)`,
    };
  }

  const hostProd = hostIsProduction(host);

  // Host is geen productiedomein → ALTIJD preview, ongeacht APP_ENV.
  if (!hostProd) {
    return {
      isProduction: false,
      hostSource,
      host,
      appEnv,
      reason: `host '${host}' is geen productiedomein → preview (veilig, APP_ENV=${appEnv} genegeerd)`,
    };
  }

  // Host is productiedomein, maar APP_ENV downgradet expliciet naar preview.
  if (PREVIEW_APP_ENVS.has(appEnv)) {
    return {
      isProduction: false,
      hostSource,
      host,
      appEnv,
      reason: `host '${host}' is productie, maar APP_ENV='${appEnv}' downgradet → preview (veilig)`,
    };
  }

  return {
    isProduction: true,
    hostSource,
    host,
    appEnv,
    reason: `host '${host}' is productiedomein en APP_ENV='${appEnv}' → production`,
  };
}

export function isProductionRequest(req?: Request | null): boolean {
  return resolveEnvironment(req).isProduction;
}

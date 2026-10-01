// Serverentry voor de prerender (scripts/prerender.ts). Rendert per route de
// volledige componentboom naar HTML, zodat crawlers zonder JavaScript de echte
// inhoud zien. De browser rendert daarna opnieuw met createRoot.
import { renderToPipeableStream } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { HelmetProvider, type HelmetServerState } from "react-helmet-async";
import { QueryClient } from "@tanstack/react-query";
import { Writable } from "node:stream";
import i18n from "./i18n/config";
import { AppProviders, AppRoutes } from "./App";

export interface RenderResult {
  html: string;
  helmet: HelmetServerState | undefined;
}

export async function render(url: string, preloaded: Record<string, unknown> = {}): Promise<RenderResult> {
  const lang = url.match(/^\/(en|de|fr)(\/|$)/)?.[1] ?? "nl";
  await i18n.changeLanguage(lang);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  for (const [key, data] of Object.entries(preloaded)) client.setQueryData(JSON.parse(key), data);
  const helmetContext: { helmet?: HelmetServerState } = {};

  const html = await new Promise<string>((resolve, reject) => {
    let out = "";
    const sink = new Writable({
      write(chunk, _enc, cb) {
        out += chunk.toString();
        cb();
      },
      final(cb) {
        resolve(out);
        cb();
      },
    });
    const timer = setTimeout(() => reject(new Error(`render timeout ${url}`)), 20000);
    const stream = renderToPipeableStream(
      <HelmetProvider context={helmetContext}>
        <AppProviders client={client}>
          <StaticRouter location={url}>
            <AppRoutes />
          </StaticRouter>
        </AppProviders>
      </HelmetProvider>,
      {
        onAllReady() {
          clearTimeout(timer);
          stream.pipe(sink);
        },
        onShellError(err) {
          clearTimeout(timer);
          reject(err);
        },
        onError(err) {
          console.warn(`[ssr] ${url}: ${err instanceof Error ? err.message : String(err)}`);
        },
      },
    );
  });
  return { html, helmet: helmetContext.helmet };
}

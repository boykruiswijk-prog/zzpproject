// Spoed 12-11-2026 12:34: tabbladnaam en inhoud nooit van een vorige klant.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { useEffect, useState } from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate, useParams, matchPath } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { AdminTitelBeheer, useAdminDetailTitel, adminPaginaNaam, ADMIN_ROUTE_TITELS } from "@/lib/adminTitels";

// Vertraagde "database": A antwoordt bewust trager dan C, zodat een laat antwoord van A zichtbaar zou worden.
const klanten: Record<string, { id: string; naam: string; ms: number }> = {
  A: { id: "A", naam: "Barts Consultancy", ms: 60 }, C: { id: "C", naam: "Cees Bouw BV", ms: 5 },
};
const leads: Record<string, { id: string; voornaam: string; achternaam: string }> = { B: { id: "B", voornaam: "Bea", achternaam: "Lead" } };
const wacht = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Zelfde patroon als KlantDetail: leegmaken bij ander id, late antwoorden negeren, naam alleen bij juist id.
function KlantPagina() {
  const { id } = useParams();
  const [ond, setOnd] = useState<any>(null);
  const [laden, setLaden] = useState(true);
  useEffect(() => {
    let actief = true;
    if (ond && ond.id !== id) setOnd(null);
    (async () => { setLaden(true); const k = klanten[id!]; await wacht(k.ms); if (!actief) return; setOnd(k); setLaden(false); })();
    return () => { actief = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const juist = !!ond && ond.id === id;
  useAdminDetailTitel(ond?.naam, id, ond?.id);
  return <div>{laden || !juist ? <p>laden</p> : <h1>{ond.naam}</h1>}</div>;
}
// Zelfde patroon als LeadDetail: react-query per id, oude cache bij ander id telt als laden.
function LeadPagina() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ["lead", id], queryFn: async () => { await wacht(5); return leads[id!] ?? null; } });
  const verkeerd = !!data && data.id !== id;
  const lead = verkeerd ? undefined : data;
  useAdminDetailTitel(lead ? `${lead.voornaam} ${lead.achternaam}` : "", id, lead?.id);
  return isLoading || verkeerd ? <p>laden</p> : <h1>{lead?.voornaam} {lead?.achternaam}</h1>;
}
let nav: (p: string) => void = () => {};
function Nav() { nav = useNavigate(); return null; }

function app() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/admin/klanten/A"]}>
        <Nav /><AdminTitelBeheer />
        <Routes>
          <Route path="/admin/klanten/:id" element={<KlantPagina />} />
          <Route path="/admin/leads" element={<h1>Leadsoverzicht</h1>} />
          <Route path="/admin/leads/:id" element={<LeadPagina />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("admin tabbladnaam", () => {
  it("KlantDetail A -> Leads -> LeadDetail B -> KlantDetail C: titel en naam horen altijd bij de URL", async () => {
    app();
    expect(document.title).toBe("Klant | ZP Zaken admin");
    await screen.findByRole("heading", { name: "Barts Consultancy" });
    expect(document.title).toBe("Barts Consultancy | Klant | ZP Zaken admin");

    act(() => nav("/admin/leads"));
    expect(document.title).toBe("Leads | ZP Zaken admin");
    expect(screen.queryByText("Barts Consultancy")).toBeNull();

    act(() => nav("/admin/leads/B"));
    expect(document.title).toBe("Lead | ZP Zaken admin");
    await screen.findByRole("heading", { name: "Bea Lead" });
    expect(document.title).toBe("Bea Lead | Lead | ZP Zaken admin");

    act(() => nav("/admin/klanten/C"));
    expect(document.title).toBe("Klant | ZP Zaken admin");
    expect(screen.queryByText("Bea Lead")).toBeNull();
    await screen.findByRole("heading", { name: "Cees Bouw BV" });
    expect(document.title).toBe("Cees Bouw BV | Klant | ZP Zaken admin");
  });

  it("klant A -> klant C direct: een laat antwoord van A verschijnt nooit", async () => {
    app();
    act(() => nav("/admin/klanten/C"));
    await screen.findByRole("heading", { name: "Cees Bouw BV" });
    await act(() => wacht(100)); // A's trage antwoord is nu binnen
    expect(screen.queryByText("Barts Consultancy")).toBeNull();
    expect(document.title).toBe("Cees Bouw BV | Klant | ZP Zaken admin");
  });

  it("naam bij een ander id dan de URL komt nooit in de titel", async () => {
    function Stale() { useAdminDetailTitel("Barts Consultancy", "C", "A"); return null; }
    render(<MemoryRouter initialEntries={["/admin/klanten/C"]}><AdminTitelBeheer /><Stale /></MemoryRouter>);
    await waitFor(() => expect(document.title).toBe("Klant | ZP Zaken admin"));
  });
});

describe("elke adminroute heeft een eigen titel", () => {
  const app = readFileSync("src/App.tsx", "utf8");
  const routes = [...app.matchAll(/path="(\/admin[^"]*)"/g)].map((m) => m[1]);
  it("alle adminroutes uit App.tsx staan in de titeltabel", () => {
    expect(routes.length).toBeGreaterThan(40);
    const tabel = new Set(ADMIN_ROUTE_TITELS.map(([p]) => p));
    expect(routes.filter((r) => !tabel.has(r))).toEqual([]);
  });
  it.each(routes)("%s krijgt zijn eigen standaardtitel", (r) => {
    const voorbeeld = r.replace(/:[a-z]+/g, "x123");
    const eigen = ADMIN_ROUTE_TITELS.find(([p]) => p === r)![1];
    expect(adminPaginaNaam(voorbeeld)).toBe(eigen);
    expect(matchPath({ path: r, end: true }, voorbeeld)).not.toBeNull();
  });
  it("adminpagina's zetten zelf geen <title> meer en detailpagina's gebruiken de centrale hook", () => {
    for (const f of ["KlantDetail", "PersoonDetail", "LeadDetail"]) {
      const s = readFileSync(`src/pages/admin/${f}.tsx`, "utf8");
      expect(s).toContain("useAdminDetailTitel(");
      expect(s).not.toContain("<title>");
    }
  });
});

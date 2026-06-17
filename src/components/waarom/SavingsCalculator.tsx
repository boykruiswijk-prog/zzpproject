import { useState, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight } from "lucide-react";
import { LocalizedLink } from "@/components/LocalizedLink";

import { bavPakketten } from "@/data/bavPakketten";

// Pakketten afgeleid uit single source of truth (src/data/bavPakketten.ts).
// 'monthly' = vergelijkbare maandprijs, 'yearly' = jaarbedrag.
const packages = bavPakketten.map((p) => {
  const yearly = p.periode === "jaar" ? p.prijs : p.prijs * 12;
  const monthly = p.periode === "jaar" ? Math.round(p.prijs / 12) : p.prijs;
  return {
    id: p.id,
    label: p.name,
    monthly,
    yearly,
    dekking: `€${(p.dekkingen.bav.perGebeurtenis / 1_000_000).toLocaleString("nl-NL")}.000.000`,
    popular: p.id === "jaarlijks-cyber",
  };
});

const professions = [
  { id: "ict", label: "ICT & Software (laag risico)", monthly: 42 },
  { id: "consultancy", label: "Consultancy & Advies (gemiddeld risico)", monthly: 55 },
  { id: "marketing", label: "Marketing & Communicatie (laag risico)", monthly: 38 },
  { id: "juridisch", label: "Juridisch & Financieel (hoog risico)", monthly: 75 },
  { id: "bouw", label: "Bouw & Techniek (hoog risico)", monthly: 85 },
  { id: "zorg", label: "Zorg & Welzijn (gemiddeld risico)", monthly: 60 },
  { id: "overig", label: "Overig kantoorwerk (laag risico)", monthly: 35 },
];

const fmt = (n: number) => Math.round(n).toLocaleString("nl-NL");
const fmt2 = (n: number) => n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function PackageCards({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-sm font-semibold text-foreground block mb-3">Kies je ZP Zaken pakket</label>
      <div className="grid grid-cols-3 gap-2">
        {packages.map((p) => {
          const active = value === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onChange(p.id)}
              className={`relative text-left p-3 rounded-xl border transition-all ${
                active
                  ? "border-accent bg-accent/5 shadow-sm"
                  : "border-border bg-card hover:border-accent/40"
              }`}
            >
              {p.popular && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                  Meest gekozen
                </span>
              )}
              <p className="text-xs font-semibold text-foreground leading-tight">{p.label}</p>
              <p className="text-base font-bold text-accent mt-1">€{p.monthly}<span className="text-xs font-normal text-muted-foreground">/mnd</span></p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{p.dekking}</p>
              <p className="text-[11px] text-accent font-medium mt-1">✓ Dagelijks opzegbaar</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResultBlock({
  label,
  value,
  subtext,
  variant = "muted",
  badge,
}: {
  label: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  variant?: "muted" | "brand" | "highlight";
  badge?: string;
}) {
  const styles =
    variant === "brand"
      ? "bg-[#FFF5F5] border border-accent/20"
      : variant === "highlight"
      ? "bg-card border border-border shadow-md"
      : "bg-muted border border-transparent";
  return (
    <div className={`rounded-xl p-5 ${styles}`}>
      {badge && (
        <span className="inline-block bg-accent text-accent-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2">
          {badge}
        </span>
      )}
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className={`text-2xl font-bold ${variant === "highlight" ? "text-accent text-3xl md:text-4xl" : "text-foreground"}`}>{value}</div>
      {subtext && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{subtext}</p>}
    </div>
  );
}

function CancellationBlock() {
  return (
    <div className="rounded-xl p-5 bg-[#FFF5F5] border border-accent/20">
      <span className="inline-block bg-accent text-accent-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2">
        Uniek in Nederland
      </span>
      <p className="text-xs text-muted-foreground mb-3">Opzegtermijn</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-lg p-3">
          <p className="text-[11px] text-muted-foreground mb-1">Markt standaard</p>
          <p className="text-xl font-bold text-foreground">1 jaar</p>
          <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
            De meeste verzekeraars hanteren een minimale looptijd van 1 jaar met opzegtermijn van 1-3 maanden
          </p>
        </div>
        <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
          <p className="text-[11px] text-accent mb-1">ZP Zaken</p>
          <p className="text-xl font-bold text-accent">Dagelijks</p>
          <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
            Geen minimale looptijd. Geen opzegtermijn. Jij bepaalt wanneer je stopt.
          </p>
        </div>
      </div>
    </div>
  );
}

export function SavingsCalculator() {
  const [tab, setTab] = useState("platform");

  // Tab 1
  const [hourlyRate, setHourlyRate] = useState(85);
  const [hoursPerYear, setHoursPerYear] = useState(1400);
  const [platformRate, setPlatformRate] = useState(0.85);
  const [pkg1, setPkg1] = useState("jaarlijks");

  // Tab 2
  const [revenue, setRevenue] = useState(80000);
  const [profession, setProfession] = useState("ict");
  const [pkg2, setPkg2] = useState("jaarlijks");

  const selectedPkg1 = packages.find((p) => p.id === pkg1)!;
  const selectedPkg2 = packages.find((p) => p.id === pkg2)!;
  const selectedProfession = professions.find((p) => p.id === profession)!;

  const r1 = useMemo(() => {
    const platformCost = hoursPerYear * platformRate;
    const zpCost = selectedPkg1.yearly;
    const saving = platformCost - zpCost;
    const savingHour = hoursPerYear > 0 ? saving / hoursPerYear : 0;
    const zpHour = hoursPerYear > 0 ? zpCost / hoursPerYear : 0;
    return { platformCost, zpCost, saving, saving5y: saving * 5, savingHour, zpHour };
  }, [hoursPerYear, platformRate, selectedPkg1]);

  const r2 = useMemo(() => {
    const marketCost = selectedProfession.monthly * 12;
    const zpCost = selectedPkg2.yearly;
    const saving = marketCost - zpCost;
    return { marketCost, zpCost, saving, saving5y: saving * 5 };
  }, [selectedProfession, selectedPkg2]);

  const ctaPkg = tab === "platform" ? selectedPkg1 : selectedPkg2;

  return (
    <div className="max-w-6xl mx-auto">
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-1 sm:grid-cols-2 w-full h-auto bg-muted p-1 mb-6 gap-1">
          <TabsTrigger
            value="platform"
            className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground py-3 text-sm font-semibold whitespace-normal h-auto"
          >
            Ik werk via een platform of bemiddelaar
          </TabsTrigger>
          <TabsTrigger
            value="self"
            className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground py-3 text-sm font-semibold whitespace-normal h-auto"
          >
            Ik zoek zelf een verzekering
          </TabsTrigger>
        </TabsList>

        {/* TAB 1 */}
        <TabsContent value="platform" className="mt-0">
          <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm grid lg:grid-cols-2 gap-8">
            {/* Inputs */}
            <div className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-foreground block mb-2">Jouw uurtarief</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                  <Input
                    type="number"
                    min={25}
                    max={300}
                    step={5}
                    placeholder="bijv. 85"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value) || 0)}
                    className="pl-7 pr-20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">per uur</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-sm font-semibold text-foreground">Gewerkte uren per jaar</label>
                  <span className="text-base font-bold text-foreground">{hoursPerYear.toLocaleString("nl-NL")} uur</span>
                </div>
                <Slider
                  value={[hoursPerYear]}
                  onValueChange={([v]) => setHoursPerYear(v)}
                  min={800}
                  max={1800}
                  step={50}
                  className="[&_[data-slot=range]]:bg-accent [&_[data-slot=thumb]]:border-accent"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>800 uur</span><span>1.800 uur</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-sm font-semibold text-foreground">Verzekeringskosten via jouw platform</label>
                  <span className="text-base font-bold text-foreground">€{fmt2(platformRate)} per gewerkt uur</span>
                </div>
                <Slider
                  value={[platformRate * 100]}
                  onValueChange={([v]) => setPlatformRate(v / 100)}
                  min={50}
                  max={200}
                  step={5}
                  className="[&_[data-slot=range]]:bg-accent [&_[data-slot=thumb]]:border-accent"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>€0,50</span><span>€2,00</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Platforms rekenen gemiddeld €0,75-€1,25 per gewerkt uur voor verzekering als onderdeel van hun servicepakket. Raadpleeg je contract voor de exacte kosten.
                </p>
              </div>

              <PackageCards value={pkg1} onChange={setPkg1} />
            </div>

            {/* Results */}
            <div className="space-y-4">
              <ResultBlock
                label="Kosten via jouw platform"
                value={<>€{fmt(r1.platformCost)}<span className="text-sm font-normal">/jaar</span></>}
                subtext={<>Gebaseerd op €{fmt2(platformRate)} per gewerkt uur</>}
              />
              <ResultBlock
                label="Jouw polis via ZP Zaken"
                value={<>€{fmt(r1.zpCost)}<span className="text-sm font-normal">/jaar</span></>}
                subtext="BAV + AVB, geen eigen risico, bij elke opdrachtgever gedekt"
                variant="brand"
              />
              <ResultBlock
                label="Jouw besparing per jaar"
                value={<>€{fmt(r1.saving)}</>}
                subtext={<>Over 5 jaar: <strong className="text-accent">€{fmt(r1.saving5y)}</strong></>}
                variant="highlight"
              />
              <ResultBlock
                label="Kosten per gewerkt uur via ZP Zaken"
                value={<>€{fmt2(r1.zpHour)}<span className="text-sm font-normal"> /uur</span></>}
                subtext={<>Ter vergelijking: via jouw platform betaal je €{fmt2(platformRate)} per uur</>}
                badge="Alleen ZP Zaken rekent dit zo transparant"
              />
              <CancellationBlock />
            </div>
          </div>
        </TabsContent>

        {/* TAB 2 */}
        <TabsContent value="self" className="mt-0">
          <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm grid lg:grid-cols-2 gap-8">
            {/* Inputs */}
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-sm font-semibold text-foreground">Jouw jaaromzet</label>
                  <span className="text-base font-bold text-foreground">€{revenue.toLocaleString("nl-NL")} per jaar</span>
                </div>
                <Slider
                  value={[revenue]}
                  onValueChange={([v]) => setRevenue(v)}
                  min={20000}
                  max={250000}
                  step={5000}
                  className="[&_[data-slot=range]]:bg-accent [&_[data-slot=thumb]]:border-accent"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>€20.000</span><span>€250.000</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground block mb-2">Jouw beroepscategorie</label>
                <Select value={profession} onValueChange={setProfession}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {professions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Marktgemiddelde gebaseerd op gangbare premies bij grote Nederlandse verzekeraars voor BAV en AVB apart.
                </p>
              </div>

              <PackageCards value={pkg2} onChange={setPkg2} />
            </div>

            {/* Results */}
            <div className="space-y-4">
              <ResultBlock
                label="Gemiddelde marktprijs"
                value={<>€{fmt(r2.marketCost)}<span className="text-sm font-normal">/jaar</span></>}
                subtext={<>BAV + AVB apart bij gangbare verzekeraars voor {selectedProfession.label.split(" (")[0]}</>}
              />
              <ResultBlock
                label="Jouw polis via ZP Zaken"
                value={<>€{fmt(r2.zpCost)}<span className="text-sm font-normal">/jaar</span></>}
                subtext="BAV + AVB gecombineerd in één polis"
                variant="brand"
              />
              <ResultBlock
                label="Jouw besparing per jaar"
                value={<>€{fmt(r2.saving)}</>}
                subtext={<>Over 5 jaar: <strong className="text-accent">€{fmt(r2.saving5y)}</strong></>}
                variant="highlight"
              />
              <div className="rounded-xl p-5 bg-muted">
                <p className="text-xs text-muted-foreground mb-3">Eigen risico</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-card rounded-lg p-3 text-center">
                    <p className="text-[11px] text-muted-foreground mb-1">Markt gemiddeld</p>
                    <p className="text-xl font-bold text-foreground">€1.500</p>
                  </div>
                  <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 text-center">
                    <p className="text-[11px] text-accent mb-1">ZP Zaken</p>
                    <p className="text-xl font-bold text-accent">€0</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  Bij een claim betaal je bij ZP Zaken nooit eigen risico
                </p>
              </div>
              <CancellationBlock />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground text-center mt-6 max-w-3xl mx-auto">
        Berekeningen zijn gebaseerd op marktgemiddelden en dienen ter indicatie. Werkelijke kosten kunnen afwijken op basis van beroep, dekking en verzekeraar. ZP Zaken-premies zijn gebaseerd op jaarlijkse betaling met 10% korting.
      </p>

      <div className="mt-8 max-w-2xl mx-auto text-center space-y-3">
        <Button asChild size="lg" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
          <LocalizedLink to="/verzekeringen">
            Direct afsluiten :  {ctaPkg.label} voor €{ctaPkg.monthly}/maand <ArrowRight className="h-5 w-5 ml-1" />
          </LocalizedLink>
        </Button>
        <div>
          <LocalizedLink to="/contact" className="text-sm text-muted-foreground hover:text-accent underline-offset-4 hover:underline">
            Of plan eerst een gratis adviesgesprek →
          </LocalizedLink>
        </div>
      </div>
    </div>
  );
}

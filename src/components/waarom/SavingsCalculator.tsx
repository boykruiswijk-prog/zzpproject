import { useState, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { AlertTriangle } from "lucide-react";

const intermediaries = [
  { id: "circle8", label: "Circle8", rate: 0.88, eigenRisicoAVB: 0, eigenRisicoBAV: 0, bavDekking: "€1.500.000", note: "Eigen risico gedekt via bundel" },
  { id: "headfirst", label: "HeadFirst", rate: 0.88, eigenRisicoAVB: 500, eigenRisicoBAV: 2500, bavDekking: "marktconform", note: "Via Alicia Benefits" },
  { id: "magnit", label: "Magnit", rate: 0.88, eigenRisicoAVB: 500, eigenRisicoBAV: 2500, bavDekking: "marktconform", note: "Via Alicia Benefits" },
  { id: "unknown", label: "Ik weet het niet", rate: 0.88, eigenRisicoAVB: 500, eigenRisicoBAV: 2500, bavDekking: "onbekend", note: "Gemiddelde marktwaarden" },
];

export function SavingsCalculator() {
  const [selectedIntermediary, setSelectedIntermediary] = useState("circle8");
  const [hourlyRate, setHourlyRate] = useState(85);
  const [hoursPerYear, setHoursPerYear] = useState(1400);
  const zpCostPerMonth = 45;

  const intermediary = intermediaries.find((i) => i.id === selectedIntermediary)!;

  const result = useMemo(() => {
    const intermediairCost = hoursPerYear * intermediary.rate;
    const zpCost = zpCostPerMonth * 12;
    const saving = intermediairCost - zpCost;
    const saving5y = saving * 5;
    const revenue = hoursPerYear * hourlyRate;
    const savingPct = revenue > 0 ? (saving / revenue) * 100 : 0;
    return { intermediairCost, zpCost, saving, saving5y, savingPct };
  }, [hourlyRate, hoursPerYear, intermediary.rate]);

  const hasRiskDifference = intermediary.eigenRisicoBAV > 0;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-card border border-border rounded-2xl p-8 md:p-10 shadow-sm">
        {/* Intermediary selector */}
        <div className="mb-8">
          <label className="text-sm font-semibold text-foreground block mb-3">Welke intermediair gebruik je?</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {intermediaries.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedIntermediary(item.id)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                  selectedIntermediary === item.id
                    ? "bg-accent text-accent-foreground border-accent shadow-sm"
                    : "bg-muted text-muted-foreground border-border hover:border-accent/40"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-8 mb-10">
          <div>
            <div className="flex justify-between items-baseline mb-3">
              <label className="text-sm font-semibold text-foreground">Uurtarief</label>
              <span className="text-lg font-bold text-foreground">€{hourlyRate}/uur</span>
            </div>
            <Slider
              value={[hourlyRate]}
              onValueChange={([v]) => setHourlyRate(v)}
              min={50}
              max={150}
              step={5}
              className="[&_[data-slot=range]]:bg-accent [&_[data-slot=thumb]]:border-accent"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>€50</span><span>€150</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-baseline mb-3">
              <label className="text-sm font-semibold text-foreground">Gewerkte uren per jaar</label>
              <span className="text-lg font-bold text-foreground">{hoursPerYear.toLocaleString("nl-NL")} uur</span>
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
        </div>

        {/* Cost results */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-muted rounded-xl p-5">
            <p className="text-xs text-muted-foreground mb-1">Jaarkosten via {intermediary.label}</p>
            <p className="text-2xl font-bold text-muted-foreground">€{Math.round(result.intermediairCost).toLocaleString("nl-NL")}<span className="text-sm font-normal">/jaar</span></p>
          </div>
          <div className="bg-accent/10 border border-accent/20 rounded-xl p-5">
            <p className="text-xs text-accent mb-1">Jaarkosten via ZP Zaken</p>
            <p className="text-2xl font-bold text-accent">€{result.zpCost}<span className="text-sm font-normal">/jaar</span></p>
          </div>
        </div>

        {/* Risk comparison */}
        {hasRiskDifference && (
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-muted rounded-xl p-5 text-center">
              <p className="text-xs text-muted-foreground mb-1">Eigen risico BAV via {intermediary.label}</p>
              <p className="text-2xl font-bold text-destructive">€{intermediary.eigenRisicoBAV.toLocaleString("nl-NL")}</p>
            </div>
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-5 text-center">
              <p className="text-xs text-accent mb-1">Eigen risico bij ZP Zaken</p>
              <p className="text-2xl font-bold text-accent">€0</p>
            </div>
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-5 text-center">
              <p className="text-xs text-destructive mb-1">Jouw risicoverschil</p>
              <p className="text-2xl font-bold text-destructive">€{intermediary.eigenRisicoBAV.toLocaleString("nl-NL")}<span className="text-sm font-normal"> /incident</span></p>
            </div>
          </div>
        )}

        {/* Savings highlight */}
        <div className="bg-accent/5 border-2 border-accent rounded-xl p-6 text-center mb-6">
          <p className="text-sm text-muted-foreground mb-1">Jouw jaarlijkse besparing</p>
          <p className="text-4xl md:text-5xl font-bold text-accent">€{Math.round(result.saving).toLocaleString("nl-NL")}<span className="text-lg font-normal">/jaar</span></p>
          <div className="flex flex-wrap justify-center gap-6 mt-4 text-sm">
            <span className="text-foreground font-medium">Over 5 jaar: <strong className="text-accent">€{Math.round(result.saving5y).toLocaleString("nl-NL")}</strong></span>
            <span className="text-foreground font-medium">Van je omzet: <strong className="text-accent">{result.savingPct.toFixed(1)}%</strong></span>
          </div>
        </div>

        <p className="text-center font-semibold text-foreground">Dit zijn jouw centen. Niet die van een tussenpersoon.</p>
      </div>

      {/* Risk warning banner */}
      {hasRiskDifference && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 mt-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm text-destructive font-medium">
            Let op: bij een beroepsfout via {intermediary.label} betaal je zelf de eerste €{intermediary.eigenRisicoBAV.toLocaleString("nl-NL")}. Bij ZP Zaken betaal je €0.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center mt-4 max-w-xl mx-auto">
        Berekening op basis van Combi Uitgebreid pakket (€45/maand). Tarieven intermediair zijn indicatief op basis van gangbare marktprijzen. Jouw werkelijke besparing kan hoger of lager zijn.
      </p>
    </div>
  );
}

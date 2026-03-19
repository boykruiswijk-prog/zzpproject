import { useState, useMemo } from "react";
import { Slider } from "@/components/ui/slider";

export function SavingsCalculator() {
  const [hourlyRate, setHourlyRate] = useState(85);
  const [hoursPerYear, setHoursPerYear] = useState(1400);
  const intermediairRate = 0.88;
  const zpCostPerMonth = 45;

  const result = useMemo(() => {
    const intermediairCost = hoursPerYear * intermediairRate;
    const zpCost = zpCostPerMonth * 12;
    const saving = intermediairCost - zpCost;
    const saving5y = saving * 5;
    const revenue = hoursPerYear * hourlyRate;
    const savingPct = revenue > 0 ? (saving / revenue) * 100 : 0;
    return { intermediairCost, zpCost, saving, saving5y, savingPct };
  }, [hourlyRate, hoursPerYear]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-card border border-border rounded-2xl p-8 md:p-10 shadow-sm">
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

        {/* Results */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-muted rounded-xl p-5">
            <p className="text-xs text-muted-foreground mb-1">Jaarkosten via intermediair</p>
            <p className="text-2xl font-bold text-muted-foreground">€{Math.round(result.intermediairCost).toLocaleString("nl-NL")}<span className="text-sm font-normal">/jaar</span></p>
          </div>
          <div className="bg-accent/10 border border-accent/20 rounded-xl p-5">
            <p className="text-xs text-accent mb-1">Jaarkosten via ZP Zaken</p>
            <p className="text-2xl font-bold text-accent">€{result.zpCost}<span className="text-sm font-normal">/jaar</span></p>
          </div>
        </div>

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

      <p className="text-xs text-muted-foreground text-center mt-4 max-w-xl mx-auto">
        Berekening op basis van Combi Uitgebreid pakket (€45/maand). Tarieven intermediair zijn indicatief op basis van gangbare marktprijzen. Jouw werkelijke besparing kan hoger of lager zijn.
      </p>
    </div>
  );
}

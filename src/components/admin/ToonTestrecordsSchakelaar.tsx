import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToonTestrecords } from "@/hooks/useToonTestrecords";

export function ToonTestrecordsSchakelaar() {
  const { toonTest, magSchakelen, zet } = useToonTestrecords();
  if (!magSchakelen) return null;
  return (
    <div className="flex items-center gap-2">
      <Switch id="toon-testrecords" checked={toonTest} onCheckedChange={zet} />
      <Label htmlFor="toon-testrecords" className="text-sm cursor-pointer whitespace-nowrap">
        Toon testrecords
      </Label>
    </div>
  );
}

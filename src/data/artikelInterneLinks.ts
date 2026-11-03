// Interne links onder de best scorende kennisbankartikelen (groeiplan T3).
// Alleen bestaande publieke routes; linkteksten beschrijven de bestemming.
export interface ArtikelLink { to: string; label: string }

const BAV: ArtikelLink = { to: "/bav-zzp", label: "BAV verzekering voor zzp'ers: BAV en AVB in één polis" };
const AVB: ArtikelLink = { to: "/bedrijfsaansprakelijkheidsverzekering", label: "Bedrijfsaansprakelijkheidsverzekering (AVB) voor zzp'ers" };
const ICT: ArtikelLink = { to: "/zzp-verzekering-ict", label: "Beroepsaansprakelijkheidsverzekering voor ICT-zzp'ers" };
const CONSULTANT: ArtikelLink = { to: "/zzp-verzekering-consultant", label: "Beroepsaansprakelijkheidsverzekering voor consultants" };
const BOUW: ArtikelLink = { to: "/zzp-verzekering-bouw", label: "Aansprakelijkheidsverzekering voor zzp'ers in de bouw" };
const INTERIM: ArtikelLink = { to: "/zzp-verzekering-interim-manager", label: "Verzekering voor zzp interim managers" };
const STARTERS: ArtikelLink = { to: "/starters", label: "Starterspakket BAV + AVB voor nieuwe zzp'ers" };

export const ARTIKEL_INTERNE_LINKS: Record<string, ArtikelLink[]> = {
  "verschil-bav-avb-zzp": [BAV, AVB, ICT, CONSULTANT, BOUW],
  "wat-kosten-verzekeringen-voor-zzp-ers": [BAV, AVB, STARTERS, ICT, INTERIM],
  "starten-met-ondernemen-als-zzper": [STARTERS, BAV, AVB, CONSULTANT],
  "zzp-of-eenmanszaak": [BAV, AVB, STARTERS],
  "bedrijfsaansprakelijkheidsverzekering-zzp": [AVB, BAV, BOUW, ICT],
};

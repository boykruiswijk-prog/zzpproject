export const ADMIN_BRANCHES = [
  "IT & ICT",
  "HR & Finance consultancy",
  "PR & Marketing",
  "Management consultancy",
  "Coaches",
  "Zakelijke dienstverlening",
] as const;

export type AdminBranche = (typeof ADMIN_BRANCHES)[number];

const SECTOR_NAAR_BRANCHE: Record<string, AdminBranche> = {
  ICT: "IT & ICT",
  "Management consultancy": "Management consultancy",
  "Reclame- & marketingbureaus": "PR & Marketing",
  Coaches: "Coaches",
  "Zakelijke dienstverlening": "Zakelijke dienstverlening",
  Zorg: "Zakelijke dienstverlening",
  "Bouw & techniek": "Zakelijke dienstverlening",
  Overig: "Zakelijke dienstverlening",
};

export function brancheVoorSector(sector: string | null | undefined): AdminBranche | null {
  if (!sector) return null;
  return SECTOR_NAAR_BRANCHE[sector] ?? null;
}
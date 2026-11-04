import type { Document } from "./documentenLijst";

export const CYBER_DOCUMENTEN: (Document & { bytes: number; sha256: string })[] = [
  { id: "cyber-verzekeringskaart", titel: "Verzekeringskaart CyberClear by Hiscox", type: "verzekeringskaart", path: "/voorwaarden/verzekeringskaart-cyberclear-hiscox-2022.pdf", productCode: "2022", bytes: 219293, sha256: "157c79b423b71469c33cc96512938319af6dcbdc463e185d57b5bea44a29932f" },
  { id: "cyber-polisvoorwaarden", titel: "Polisvoorwaarden CyberClear by Hiscox", type: "polisvoorwaarden", path: "/voorwaarden/polisvoorwaarden-cyberclear-hiscox-hcc-2022-01.pdf", productCode: "HCC-2022/01", bytes: 1347269, sha256: "198789f50489780c8b71bea43c4ebaf7e2bd03c4f658d4a1270a04ac2a0cdf56" },
];
#!/usr/bin/env python3
"""Genereert src/data/nlKaart.ts (provinciegrenzen als SVG) en src/data/nlPlaatsen.ts (plaats -> coordinaat).

Open data, eenmalig gedownload (geen API per verzoek):
- Provincies: https://cartomap.github.io/nl/wgs84/provincie_2023.geojson (CBS/PDOK, CC BY 4.0)
- Plaatsen:   https://download.geonames.org/export/dump/NL.zip (GeoNames, CC BY 4.0), klasse P, >= 1000 inwoners
Gebruik: python3 scripts/genereer-nl-kaart.py /pad/prov.geojson /pad/NL.txt
"""
import json, math, sys

prov_pad, nl_pad = sys.argv[1], sys.argv[2]
LON0, LAT0, K = 3.2, 53.62, 1000 / 4.2
COS = math.cos(math.radians(52.2))

def proj(lon, lat):
    return round((lon - LON0) * COS * K, 1), round((LAT0 - lat) * K, 1)

GN = {"01": "Drenthe", "02": "Fryslân", "03": "Gelderland", "04": "Groningen", "05": "Limburg", "06": "Noord-Brabant",
      "07": "Noord-Holland", "09": "Utrecht", "10": "Zeeland", "11": "Zuid-Holland", "15": "Overijssel", "16": "Flevoland"}

provs = []
for f in json.load(open(prov_pad))["features"]:
    naam = f["properties"]["statnaam"]
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    d, sx, sy, n = [], 0, 0, 0
    for poly in polys:
        for ring in poly:
            pts = [proj(*p) for p in ring]
            d.append("M" + "L".join(f"{x} {y}" for x, y in pts) + "Z")
            for x, y in pts: sx += x; sy += y; n += 1
    provs.append({"naam": naam, "d": "".join(d)})

plaatsen = {}
for regel in open(nl_pad, encoding="utf-8"):
    c = regel.rstrip("\n").split("\t")
    if c[6] != "P" or int(c[14] or 0) < 1000 or c[10] not in GN: continue
    lat, lon, pop = float(c[4]), float(c[5]), int(c[14])
    for naam in {c[1], c[2]}:
        k = naam.lower()
        if k not in plaatsen or plaatsen[k][3] < pop:
            plaatsen[k] = (round(lat, 3), round(lon, 3), GN[c[10]], pop)

with open("src/data/nlKaart.ts", "w", encoding="utf-8") as o:
    o.write("// Gegenereerd door scripts/genereer-nl-kaart.py uit open data (CBS/PDOK provinciegrenzen 2023). Niet met de hand wijzigen.\n")
    o.write(f"export const NL_KAART_PROJECTIE = {{ lon0: {LON0}, lat0: {LAT0}, k: {K}, cos: {COS} }} as const;\n")
    o.write("export const NL_PROVINCIES: { naam: string; d: string }[] = " + json.dumps(provs, ensure_ascii=False) + ";\n")

with open("src/data/nlPlaatsen.ts", "w", encoding="utf-8") as o:
    o.write("// Gegenereerd door scripts/genereer-nl-kaart.py uit GeoNames NL (CC BY 4.0), plaatsen vanaf 1000 inwoners. Niet met de hand wijzigen.\n")
    o.write("// sleutel = plaatsnaam in kleine letters -> [breedte, lengte, provincie]\n")
    o.write("export const NL_PLAATSEN: Record<string, [number, number, string]> = " +
            json.dumps({k: [v[0], v[1], v[2]] for k, v in sorted(plaatsen.items())}, ensure_ascii=False) + ";\n")
print(len(provs), "provincies,", len(plaatsen), "plaatsnamen")

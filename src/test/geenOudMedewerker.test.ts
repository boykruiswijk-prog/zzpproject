// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Segments prevent the regression test itself from containing banned filenames.
const removed = [
  ["team", "hero"], ["team", "meeting"], ["team", "cheers"],
  ["team", "walking"], ["zp", "boy", "laptop"],
  ["team", "member", "4"], ["team", "member", "mystery"],
].map((segments) => segments.join("-"));

function filesUnder(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(file) : [file];
  });
}
const files = ["index.html", ...["src", "public", "scripts"].flatMap(filesUnder)];
// Old hashed build URLs stay served by hosting; these overwrite them with an office photo.
const replacements = [
  "cheers-BcxwwRl8.jpg", "cheers-BzPrp9Ls.webp", "hero-Bv-2VzH5.jpg", "hero-BtK-9ByH.webp",
  "meeting-Cug9OgIW.jpg", "meeting-B8kfn_fb.webp", "member-4-zwSnkyKg.jpg",
  "member-mystery-pznLVMGj.jpg", "walking-DOXdr9bP.jpg", "walking-BYQ1hDLA.webp",
].map((name) => path.join("public", "assets", `team-${name}`)).concat(
  ["sEEvQ6-X.jpg", "1OalQy_T.webp"].map((h) => path.join("public", "assets", `${["zp", "boy", "laptop"].join("-")}-${h}`)),
);
const textFile = /\.(?:[cm]?[jt]sx?|css|html|json|svg|xml|txt|webmanifest|csv|md|py|sql)$/i;

describe("Besluit A9", () => {
  it("bevat geen verwijderde afbeeldingen of bestandsnaamvarianten", () => {
    expect(files.filter((file) => !replacements.includes(file) && removed.some((name) => path.basename(file).includes(name)))).toEqual([]);
    expect(fs.existsSync(path.join("src", "components", "home", ["Team", "Section.tsx"].join("")))).toBe(false);
  });
  it("bevat geen imports, srcsets, preloads of metadata voor verwijderde foto’s", () => {
    const matches = files.filter((file) => textFile.test(file)).flatMap((file) => {
      const content = fs.readFileSync(file, "utf8");
      return removed.filter((name) => content.includes(name)).map((name) => `${file}: ${name}`);
    });
    expect(matches).toEqual([]);
  });
  it("behoudt Boys bevestigde foto en gebruikt bestaande kantoorbeelden", () => {
    for (const file of ["team-boy-calling.webp", "office-meeting-room.webp", "office-flowers.webp"]) {
      expect(fs.existsSync(path.join("src/assets", file))).toBe(true);
    }
    expect(fs.readFileSync("src/components/layout/PageHero.tsx", "utf8")).toContain("backgroundImage || officeMeetingRoom");
  });
  it("overschrijft oude gehashte build-URL's met het kantoorbeeld", () => {
    const office = fs.readFileSync("src/assets/office-meeting-room.webp");
    expect(replacements).toHaveLength(12);
    for (const file of replacements) {
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.readFileSync(file).equals(office)).toBe(true);
    }
  });
});

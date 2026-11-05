import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync("drizzle/migrations/0247_robots_toegang_postgres_strikt.sql", "utf8");
const basis = readFileSync("drizzle/migrations/0246_robots_toegang_postgres.sql", "utf8");

describe("A30/A31 robottoegang", () => {
  it("beheerverbinding via session_user, nooit current_user (security definer)", () => {
    expect(sql).toMatch(/session_user = 'postgres'/);
    expect(sql).not.toMatch(/current_user\s*=/);
  });
  it("anon en authenticated JWT vallen niet onder de beheeruitzondering", () => {
    expect(sql).toMatch(/NOT IN \('anon', 'authenticated'\)/);
  });
  it("service_role toegestaan, rollen alleen admin/supervisor", () => {
    expect(sql).toMatch(/= 'service_role'/);
    expect(basis).toMatch(/robot_toegang\(ARRAY\['admin'\]::app_role\[\]\)/);
    expect(basis).toMatch(/robot_toegang\(ARRAY\['admin','supervisor'\]::app_role\[\]\)/);
  });
  it("hulpfunctie niet aanroepbaar voor anon/authenticated", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.robot_toegang\(app_role\[\]\) FROM PUBLIC, anon, authenticated/);
  });
});

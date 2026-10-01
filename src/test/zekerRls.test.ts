// Anon mag chatgegevens nooit lezen (live tegen de backend; overslaan zonder netwerk/env).
import { describe, it, expect } from "vitest";
const URL = process.env.VITE_SUPABASE_URL ?? "https://eugkavokktjwpqaqlwsj.supabase.co";
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Z2thdm9ra3Rqd3BxYXFsd3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMDcyOTIsImV4cCI6MjA4Mzg4MzI5Mn0.dWRkQ9LwEx-7NhDQlcfLMXE3aimwKzBbiG56AvN6Kbk";
describe("RLS chat", () => {
  for (const t of ["chat_messages", "chat_sessions", "chat_rate_limit"]) {
    it(`anon kan ${t} niet lezen`, async () => {
      let res: Response;
      try { res = await fetch(`${URL}/rest/v1/${t}?select=*&limit=1`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }); }
      catch { return; }
      if (res.ok) expect(await res.json()).toEqual([]);
      else expect([401, 403, 404]).toContain(res.status);
    });
  }
  it("anon kan de kennisbankzoeker niet aanroepen", async () => {
    let res: Response;
    try { res = await fetch(`${URL}/rest/v1/rpc/zeker_zoek_artikelen`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: '{"_q":"bav"}' }); }
    catch { return; }
    expect(res.ok).toBe(false);
  });
});

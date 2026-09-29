// @vitest-environment node
import { describe, expect, it } from "vitest";
import { normalizeAlarmError } from "../../supabase/functions/_shared/exactAlarm";

describe("Exact-alarm throttle-sleutel", () => {
  it("normaliseert nummers en datums uit dezelfde fout", () => {
    expect(normalizeAlarmError("HTTP 401 op 2026-09-29T17:26:08Z"))
      .toBe(normalizeAlarmError("HTTP 403 op 2026-09-30T03:17:59Z"));
  });

  it("houdt verschillende fouten verschillend", () => {
    expect(normalizeAlarmError("Geen toegang tot administratie 4401707"))
      .not.toBe(normalizeAlarmError("Token vernieuwen mislukt 401"));
  });
});
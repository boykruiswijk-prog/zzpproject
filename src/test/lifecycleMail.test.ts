import { describe, it, expect, vi } from "vitest";
import { verstuurLifecycleMail, magOnefellowMailen, isGeenOpdrachtReden } from "../../supabase/functions/_shared/lifecycleMail";

describe("lifecycle mails (gemockte verzender)", () => {
  it("pauze → 1 klantmail + 1 interne mail gelogd, geen Onefellow", async () => {
    const send = vi.fn(async () => ({ ok: true, message_id: "m1" }));
    const logs: Record<string, unknown>[] = [];
    const deps = { send, insertLog: async (r: Record<string, unknown>) => { logs.push(r); } };
    const reden = "geen opdracht ";
    await verstuurLifecycleMail(deps, { actie: "pauzeren", doel: "klant", leadId: "L", to: "k@x.nl", subject: "s", html: "h" });
    await verstuurLifecycleMail(deps, { actie: "pauzeren", doel: "intern", leadId: "L", to: "info@zpzaken.nl", subject: "s", html: "h" });
    if (magOnefellowMailen(false, reden)) {
      await verstuurLifecycleMail(deps, { actie: "pauzeren", doel: "onefellow", leadId: "L", to: "info@onefellow.nl", subject: "s", html: "h" });
    }
    expect(send).toHaveBeenCalledTimes(2);
    expect(logs.map((l) => l.lead_type)).toEqual(["polis-pauzeren-klant", "polis-pauzeren-intern"]);
    expect(logs.every((l) => l.status === "sent")).toBe(true);
  });

  it("mislukte of overgeslagen mail wordt als failed met reden gelogd", async () => {
    const logs: Record<string, unknown>[] = [];
    await verstuurLifecycleMail(
      { send: async () => ({ ok: false, error: "preview_single_mail_limit" }), insertLog: async (r) => { logs.push(r); } },
      { actie: "hervatten", doel: "intern", leadId: "L", to: "info@zpzaken.nl", subject: "s", html: "h" },
    );
    expect(logs[0]).toMatchObject({ status: "failed", error_message: "preview_single_mail_limit" });
  });

  it("reden-herkenning en schakelaar", () => {
    expect(isGeenOpdrachtReden("geen opdracht ")).toBe(true);
    expect(isGeenOpdrachtReden("geen_opdrachten")).toBe(true);
    expect(isGeenOpdrachtReden("vakantie")).toBe(false);
    expect(magOnefellowMailen(false, "geen_opdrachten")).toBe(false);
    expect(magOnefellowMailen(true, "geen opdracht ")).toBe(true);
  });
});

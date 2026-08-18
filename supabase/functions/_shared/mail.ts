// Eén bron van waarheid voor afzender + preview-redirect van uitgaande mail.
//
// - getFromAddress(): RESEND_FROM_ADDRESS, anders "ZP Zaken <info@zpzaken.nl>".
//   Er is GEEN terugval meer op een Resend-sandboxafzender.
// - createMailGate(fnName, req): bepaalt via resolveEnvironment() of we in
//   productie zitten. In preview gaat élke mail naar boy.kruiswijk@zpzaken.nl,
//   zonder bcc, met "[PREVIEW] " voor het onderwerp, en maximaal één mail per
//   verzendactie (per functie-aanroep). Wie de mail oorspronkelijk zou krijgen
//   staat in het onderwerp en bovenaan de body.
//
// Cron-pad: een aanroep zonder Origin/Referer heeft geen host. resolveEnvironment
// valt dan expliciet terug op APP_ENV (alleen APP_ENV=production → productie).
// Die beslissing wordt altijd gelogd (env.reason + hostSource), zodat een
// ontbrekende header nooit stilzwijgend tot preview leidt.

import { resolveEnvironment, type Environment } from "./environment.ts";

export const PREVIEW_RECIPIENT = "boy.kruiswijk@zpzaken.nl";
export const DEFAULT_FROM_ADDRESS = "ZP Zaken <info@zpzaken.nl>";

export function getFromAddress(): string {
  const configured = (Deno.env.get("RESEND_FROM_ADDRESS") ?? "").trim();
  return configured.length > 0 ? configured : DEFAULT_FROM_ADDRESS;
}

export interface MailPlanInput {
  to: string | string[];
  subject: string;
  html: string;
  bcc?: string | string[];
}

export interface MailPlan {
  send: boolean;
  reason?: string;
  from: string;
  to: string[];
  bcc: string[] | undefined;
  subject: string;
  html: string;
  redirected: boolean;
  originalTo: string[];
}

export interface MailGate {
  env: Environment;
  isProduction: boolean;
  /** Bereken de definitieve mail (ontvangers/onderwerp/body) en log één regel. */
  plan(input: MailPlanInput): MailPlan;
}

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).map((s) => s.trim()).filter(Boolean);
}

export function createMailGate(fnName: string, req?: Request | null): MailGate {
  const env = resolveEnvironment(req ?? null);
  const from = getFromAddress();
  let previewMailUsed = false;

  console.log(
    `[mail] ${fnName} environment resolved: ${JSON.stringify({
      isProduction: env.isProduction,
      hostSource: env.hostSource,
      host: env.host,
      appEnv: env.appEnv,
      reason: env.reason,
    })}`,
  );

  return {
    env,
    isProduction: env.isProduction,
    plan(input: MailPlanInput): MailPlan {
      const originalTo = asArray(input.to);
      const originalBcc = asArray(input.bcc);

      if (env.isProduction) {
        const plan: MailPlan = {
          send: originalTo.length > 0,
          reason: originalTo.length > 0 ? undefined : "no_recipient",
          from,
          to: originalTo,
          bcc: originalBcc.length ? originalBcc : undefined,
          subject: input.subject,
          html: input.html,
          redirected: false,
          originalTo,
        };
        logPlan(fnName, env, plan);
        return plan;
      }

      // Preview: hooguit één mail per verzendactie.
      if (previewMailUsed) {
        const plan: MailPlan = {
          send: false,
          reason: "preview_single_mail_limit",
          from,
          to: [],
          bcc: undefined,
          subject: `[PREVIEW] ${input.subject}`,
          html: input.html,
          redirected: true,
          originalTo,
        };
        logPlan(fnName, env, plan);
        return plan;
      }
      previewMailUsed = true;

      const origineel = originalTo.length ? originalTo.join(", ") : "(geen ontvanger)";
      const banner =
        `<div style="background:#fff3cd;border:1px solid #ffe08a;padding:12px;margin-bottom:16px;font-family:Arial,sans-serif;font-size:13px;color:#664d03">
          <strong>PREVIEW-omgeving.</strong> Deze mail was oorspronkelijk bedoeld voor: <strong>${origineel}</strong>` +
        (originalBcc.length ? ` (bcc: ${originalBcc.join(", ")})` : "") +
        `. In productie gaat hij naar die ontvanger(s).</div>`;

      const plan: MailPlan = {
        send: true,
        from,
        to: [PREVIEW_RECIPIENT],
        bcc: undefined,
        subject: `[PREVIEW] ${input.subject} (origineel naar ${origineel})`,
        html: banner + input.html,
        redirected: true,
        originalTo,
      };
      logPlan(fnName, env, plan);
      return plan;
    },
  };
}

function logPlan(fnName: string, env: Environment, plan: MailPlan) {
  console.log(
    `[mail] ${JSON.stringify({
      function: fnName,
      from: plan.from,
      environment: env.isProduction ? "production" : "preview",
      env_reason: env.reason,
      host_source: env.hostSource,
      app_env: env.appEnv,
      to: plan.to,
      bcc: plan.bcc ?? [],
      original_to: plan.originalTo,
      redirected: plan.redirected,
      send: plan.send,
      skip_reason: plan.reason ?? null,
      subject: plan.subject,
    })}`,
  );
}

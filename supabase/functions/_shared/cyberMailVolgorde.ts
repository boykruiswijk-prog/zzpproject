/** Both callers use the same existing certificate route before confirmation. */
export async function cyberMailVolgorde(
  certificaat: () => Promise<{ ok: boolean; status?: string }>,
  bevestiging: () => Promise<string>,
) {
  const document = await certificaat();
  if (!document.ok) return { certificaat: document.status ?? "mail_mislukt", bevestiging: "niet_verzonden_certificaat" };
  return { certificaat: document.status ?? "verzonden", bevestiging: await bevestiging() };
}
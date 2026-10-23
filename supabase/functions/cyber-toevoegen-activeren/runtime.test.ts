// No credential values leave this probe; a missing managed service identity blocks integration evidence.
Deno.test("managed service identity is available for database integration", () => {
  if (!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    throw new Error("Managed service identity unavailable to local test runtime");
  }
});